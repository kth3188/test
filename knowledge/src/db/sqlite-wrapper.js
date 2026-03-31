/**
 * sql.js 기반 better-sqlite3 호환 래퍼
 * 순수 JS(WASM)라 Windows에서 빌드 도구 없이 동작합니다.
 *
 * 사용법: 앱 시작 시 await DatabaseWrapper.initialize()를 1회 호출한 후
 *         new DatabaseWrapper(path)로 동기적으로 사용합니다.
 */
const fs = require('fs');
const path = require('path');

let _SQL = null;

class DatabaseWrapper {
  /**
   * sql.js WASM 초기화 (앱 시작 시 1회 호출 필요)
   */
  static async initialize() {
    if (_SQL) return;
    const initSqlJs = require('sql.js');
    _SQL = await initSqlJs();
  }

  constructor(dbPath, options = {}) {
    if (!_SQL) {
      throw new Error('DatabaseWrapper.initialize()를 먼저 await 해주세요.');
    }

    this._path = dbPath;
    this._readonly = options.readonly || false;

    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this._db = new _SQL.Database(new Uint8Array(buffer));
    } else {
      this._db = new _SQL.Database();
    }

    this._saveTimer = null;
    this._dirty = false;
  }

  _save() {
    if (this._readonly) return;
    const data = this._db.export();
    const dir = path.dirname(this._path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this._path, Buffer.from(data));
    this._dirty = false;
  }

  _deferredSave() {
    if (this._readonly) return;
    this._dirty = true;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), 100);
  }

  _immediateSave() {
    if (this._readonly) return;
    if (this._saveTimer) clearTimeout(this._saveTimer);
    const data = this._db.export();
    const dir = path.dirname(this._path);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this._path, Buffer.from(data));
    this._dirty = false;
  }

  pragma(str) {
    try {
      const result = this._db.exec(`PRAGMA ${str}`);
      if (result.length > 0 && result[0].values.length > 0) {
        return result[0].values[0][0];
      }
    } catch {
      // sql.js에서 일부 PRAGMA 미지원
    }
    return undefined;
  }

  exec(sql) {
    this._db.run(sql);
    this._immediateSave();
  }

  prepare(sql) {
    return new StatementWrapper(this, sql);
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self._db.run('BEGIN TRANSACTION');
      try {
        const result = fn.apply(this, args);
        self._db.run('COMMIT');
        self._immediateSave();
        return result;
      } catch (err) {
        try { self._db.run('ROLLBACK'); } catch { /* 무시 */ }
        throw err;
      }
    };
  }

  close() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    if (this._dirty) this._save();
    this._db.close();
  }
}

class StatementWrapper {
  constructor(dbWrapper, sql) {
    this._dbWrapper = dbWrapper;
    this._sql = sql;
  }

  all(...params) {
    const flatParams = this._flattenParams(params);
    const results = [];
    const stmt = this._dbWrapper._db.prepare(this._sql);
    try {
      if (flatParams.length > 0) stmt.bind(flatParams);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
    } finally {
      stmt.free();
    }
    return results;
  }

  get(...params) {
    const flatParams = this._flattenParams(params);
    const stmt = this._dbWrapper._db.prepare(this._sql);
    try {
      if (flatParams.length > 0) stmt.bind(flatParams);
      if (stmt.step()) {
        return stmt.getAsObject();
      }
      return undefined;
    } finally {
      stmt.free();
    }
  }

  run(...params) {
    const flatParams = this._flattenParams(params);
    this._dbWrapper._db.run(this._sql, flatParams);
    this._dbWrapper._deferredSave();

    const lastId = this._dbWrapper._db.exec('SELECT last_insert_rowid() as id');
    const changes = this._dbWrapper._db.exec('SELECT changes() as c');

    return {
      changes: changes[0]?.values[0]?.[0] || 0,
      lastInsertRowid: lastId[0]?.values[0]?.[0] || 0,
    };
  }

  _flattenParams(params) {
    if (params.length === 0) return [];
    if (params.length === 1 && Array.isArray(params[0])) return params[0];
    return params;
  }
}

module.exports = DatabaseWrapper;
