const Database = require('./sqlite-wrapper');
const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '../../db/personal.db');

let _db = null;

/**
 * sql.js WASM 초기화 (앱 시작 시 1회 호출)
 */
async function initSqlEngine() {
  await Database.initialize();
}

/**
 * DB 인스턴스 가져오기 (싱글턴)
 */
function getDb(dbPath = process.env.KNOWLEDGE_DB_PATH || DEFAULT_DB_PATH) {
  if (_db) return _db;

  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _db = new Database(dbPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('busy_timeout = 5000');

  return _db;
}

/**
 * DB 초기화 (스키마 적용)
 */
function initDb(dbPath) {
  if (_db) { _db.close(); _db = null; }

  const db = getDb(dbPath);
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');

  // sql.js는 FTS5 미지원 → FTS5/트리거 관련 문장 제거
  const filteredSchema = schema
    .replace(/CREATE VIRTUAL TABLE.*?;/gs, '-- FTS5 skipped (sql.js)')
    .replace(/CREATE TRIGGER.*?END;/gs, '-- Trigger skipped (sql.js)');

  db.exec(filteredSchema);

  console.log('DB 초기화 완료:', dbPath);

  _db.close();
  _db = null;

  return null;
}

/**
 * DB 연결 종료
 */
function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}

module.exports = { getDb, initDb, closeDb, initSqlEngine };
