const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '../../db/personal.db');

let _db = null;

/**
 * DB 인스턴스 가져오기 (싱글턴)
 */
function getDb(dbPath = process.env.KNOWLEDGE_DB_PATH || DEFAULT_DB_PATH) {
  if (_db) return _db;

  // DB 디렉토리 생성
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

  db.exec(schema);

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

module.exports = { getDb, initDb, closeDb };
