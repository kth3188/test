#!/usr/bin/env node
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DEFAULT_DB_PATH = path.join(__dirname, '../../db/personal.db');

/**
 * 스키마 마이그레이션 시스템
 * DB에 마이그레이션 이력 테이블을 관리하고 순차적으로 마이그레이션을 실행합니다.
 */

// 마이그레이션 정의
const MIGRATIONS = [
  {
    version: 1,
    name: 'initial_schema',
    description: '초기 스키마 (notes, entities, relations, attributes, tags, open_questions, FTS5)',
    up: (db) => {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      db.exec(schema);
    },
  },
  {
    version: 2,
    name: 'add_sources_and_claims',
    description: 'sources 테이블, entity_claims 테이블 추가',
    up: (db) => {
      // sources 테이블이 이미 schema.sql에 포함되어 있으므로
      // 이전 버전 DB에서 업그레이드할 때만 실행
      db.exec(`
        CREATE TABLE IF NOT EXISTS sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          text TEXT NOT NULL,
          entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
          source_note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS entity_claims (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
          field TEXT NOT NULL,
          value TEXT NOT NULL,
          source_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
          confidence REAL DEFAULT 0.5,
          status TEXT DEFAULT 'active',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_sources_note ON sources(source_note_id);
        CREATE INDEX IF NOT EXISTS idx_sources_entity ON sources(entity_id);
        CREATE INDEX IF NOT EXISTS idx_entity_claims_entity ON entity_claims(entity_id);
        CREATE INDEX IF NOT EXISTS idx_entity_claims_status ON entity_claims(status);
      `);
    },
  },
];

function ensureMigrationTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function getCurrentVersion(db) {
  const row = db.prepare('SELECT MAX(version) as version FROM schema_migrations').get();
  return row.version || 0;
}

function migrate(dbPath = DEFAULT_DB_PATH) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  ensureMigrationTable(db);
  const currentVersion = getCurrentVersion(db);

  console.log(`현재 스키마 버전: ${currentVersion}`);

  const pending = MIGRATIONS.filter(m => m.version > currentVersion);

  if (pending.length === 0) {
    console.log('마이그레이션이 필요하지 않습니다.');
    db.close();
    return;
  }

  for (const migration of pending) {
    console.log(`마이그레이션 실행: v${migration.version} - ${migration.name}`);
    try {
      db.transaction(() => {
        migration.up(db);
        db.prepare(
          'INSERT INTO schema_migrations (version, name, description) VALUES (?, ?, ?)'
        ).run(migration.version, migration.name, migration.description);
      })();
      console.log(`  완료: ${migration.description}`);
    } catch (err) {
      console.error(`  실패: ${err.message}`);
      db.close();
      process.exit(1);
    }
  }

  console.log(`스키마 버전 ${currentVersion} → ${pending[pending.length - 1].version} 마이그레이션 완료`);
  db.close();
}

// CLI 실행
if (require.main === module) {
  const dbPath = process.argv[2] || process.env.KNOWLEDGE_DB_PATH || DEFAULT_DB_PATH;
  migrate(dbPath);

  // 조직 DB도 마이그레이션
  const orgDbPath = path.join(path.dirname(dbPath), 'organization.db');
  if (fs.existsSync(orgDbPath)) {
    console.log('\n조직 DB 마이그레이션:');
    migrate(orgDbPath);
  }
}

module.exports = { migrate, MIGRATIONS };
