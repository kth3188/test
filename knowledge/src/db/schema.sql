-- 온톨로지 지식 시스템 DB 스키마

-- 노트 (원본 마크다운 보존)
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  domain TEXT,
  content TEXT NOT NULL,
  confidence TEXT DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 엔티티 (개체)
CREATE TABLE IF NOT EXISTS entities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  type TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 관계 (트리플: 주체-술어-객체)
CREATE TABLE IF NOT EXISTS relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  object_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  source_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  confidence REAL DEFAULT 0.5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 속성 (엔티티의 key-value)
CREATE TABLE IF NOT EXISTS attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_id INTEGER NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  source_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL
);

-- 태그
CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

-- 노트-태그 연결
CREATE TABLE IF NOT EXISTS note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- 미해결 질문 (능동적 탐구용)
CREATE TABLE IF NOT EXISTS open_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  related_entity_id INTEGER REFERENCES entities(id) ON DELETE SET NULL,
  source_note_id INTEGER REFERENCES notes(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'open',
  answer TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_relations_subject ON relations(subject_id);
CREATE INDEX IF NOT EXISTS idx_relations_object ON relations(object_id);
CREATE INDEX IF NOT EXISTS idx_relations_note ON relations(source_note_id);
CREATE INDEX IF NOT EXISTS idx_attributes_entity ON attributes(entity_id);
CREATE INDEX IF NOT EXISTS idx_open_questions_status ON open_questions(status);
CREATE INDEX IF NOT EXISTS idx_notes_domain ON notes(domain);

-- FTS5 전문검색 (한국어 포함)
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  title, content, content=notes, content_rowid=id,
  tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  name, description, content=entities, content_rowid=id,
  tokenize='unicode61'
);

-- FTS 동기화 트리거
CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, title, content) VALUES('delete', old.id, old.title, old.content);
  INSERT INTO notes_fts(rowid, title, content) VALUES (new.id, new.title, new.content);
END;

CREATE TRIGGER IF NOT EXISTS entities_ai AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, name, description) VALUES (new.id, new.name, new.description);
END;

CREATE TRIGGER IF NOT EXISTS entities_ad AFTER DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, name, description) VALUES('delete', old.id, old.name, old.description);
END;

CREATE TRIGGER IF NOT EXISTS entities_au AFTER UPDATE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, name, description) VALUES('delete', old.id, old.name, old.description);
  INSERT INTO entities_fts(rowid, name, description) VALUES (new.id, new.name, new.description);
END;
