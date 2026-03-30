const { getDb } = require('./db');

// ==================== 노트 CRUD ====================

function createNote(title, domain, content, confidence = 'medium') {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO notes (title, domain, content, confidence) VALUES (?, ?, ?, ?)'
  );
  return stmt.run(title, domain, content, confidence);
}

function getNote(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM notes WHERE id = ?').get(id);
}

function listNotes({ domain, limit = 50, offset = 0 } = {}) {
  const db = getDb();
  if (domain) {
    return db.prepare(
      'SELECT id, title, domain, confidence, created_at, updated_at FROM notes WHERE domain = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    ).all(domain, limit, offset);
  }
  return db.prepare(
    'SELECT id, title, domain, confidence, created_at, updated_at FROM notes ORDER BY updated_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

function updateNote(id, { title, domain, content, confidence }) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (domain !== undefined) { fields.push('domain = ?'); values.push(domain); }
  if (content !== undefined) { fields.push('content = ?'); values.push(content); }
  if (confidence !== undefined) { fields.push('confidence = ?'); values.push(confidence); }

  if (fields.length === 0) return null;

  fields.push("updated_at = datetime('now')");
  values.push(id);

  return db.prepare(`UPDATE notes SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteNote(id) {
  const db = getDb();
  return db.prepare('DELETE FROM notes WHERE id = ?').run(id);
}

// ==================== 엔티티 CRUD ====================

function createEntity(name, type = null, description = null) {
  const db = getDb();
  // UPSERT: 이미 존재하면 description 업데이트
  const stmt = db.prepare(
    `INSERT INTO entities (name, type, description) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       type = COALESCE(excluded.type, entities.type),
       description = COALESCE(excluded.description, entities.description)`
  );
  return stmt.run(name, type, description);
}

function getEntity(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM entities WHERE id = ?').get(id);
}

function getEntityByName(name) {
  const db = getDb();
  return db.prepare('SELECT * FROM entities WHERE name = ?').get(name);
}

function listEntities({ type, limit = 100, offset = 0 } = {}) {
  const db = getDb();
  if (type) {
    return db.prepare(
      'SELECT * FROM entities WHERE type = ? ORDER BY name LIMIT ? OFFSET ?'
    ).all(type, limit, offset);
  }
  return db.prepare(
    'SELECT * FROM entities ORDER BY name LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

function updateEntity(id, { name, type, description }) {
  const db = getDb();
  const fields = [];
  const values = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (type !== undefined) { fields.push('type = ?'); values.push(type); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }

  if (fields.length === 0) return null;
  values.push(id);

  return db.prepare(`UPDATE entities SET ${fields.join(', ')} WHERE id = ?`).run(...values);
}

function deleteEntity(id) {
  const db = getDb();
  return db.prepare('DELETE FROM entities WHERE id = ?').run(id);
}

// ==================== 관계 CRUD ====================

function createRelation(subjectId, predicate, objectId, sourceNoteId = null, confidence = 0.5) {
  const db = getDb();
  const stmt = db.prepare(
    'INSERT INTO relations (subject_id, predicate, object_id, source_note_id, confidence) VALUES (?, ?, ?, ?, ?)'
  );
  return stmt.run(subjectId, predicate, objectId, sourceNoteId, confidence);
}

function getRelationsForEntity(entityId) {
  const db = getDb();
  return db.prepare(`
    SELECT r.*,
           s.name as subject_name, s.type as subject_type,
           o.name as object_name, o.type as object_type
    FROM relations r
    JOIN entities s ON r.subject_id = s.id
    JOIN entities o ON r.object_id = o.id
    WHERE r.subject_id = ? OR r.object_id = ?
    ORDER BY r.confidence DESC
  `).all(entityId, entityId);
}

function deleteRelationsByNote(noteId) {
  const db = getDb();
  return db.prepare('DELETE FROM relations WHERE source_note_id = ?').run(noteId);
}

// ==================== 속성 CRUD ====================

function createAttribute(entityId, key, value, sourceNoteId = null) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO attributes (entity_id, key, value, source_note_id) VALUES (?, ?, ?, ?)'
  ).run(entityId, key, value, sourceNoteId);
}

function getAttributesForEntity(entityId) {
  const db = getDb();
  return db.prepare('SELECT * FROM attributes WHERE entity_id = ?').all(entityId);
}

function deleteAttributesByNote(noteId) {
  const db = getDb();
  return db.prepare('DELETE FROM attributes WHERE source_note_id = ?').run(noteId);
}

// ==================== 태그 ====================

function getOrCreateTag(name) {
  const db = getDb();
  db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
  return db.prepare('SELECT * FROM tags WHERE name = ?').get(name);
}

function setNoteTags(noteId, tagNames) {
  const db = getDb();
  db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);
  const insertStmt = db.prepare('INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)');
  for (const name of tagNames) {
    const tag = getOrCreateTag(name);
    insertStmt.run(noteId, tag.id);
  }
}

function getNoteTags(noteId) {
  const db = getDb();
  return db.prepare(`
    SELECT t.name FROM tags t
    JOIN note_tags nt ON t.id = nt.tag_id
    WHERE nt.note_id = ?
  `).all(noteId).map(r => r.name);
}

// ==================== 미해결 질문 ====================

function createQuestion(question, relatedEntityId = null, sourceNoteId = null) {
  const db = getDb();
  return db.prepare(
    'INSERT INTO open_questions (question, related_entity_id, source_note_id) VALUES (?, ?, ?)'
  ).run(question, relatedEntityId, sourceNoteId);
}

function listQuestions({ status = 'open', limit = 50 } = {}) {
  const db = getDb();
  return db.prepare(
    'SELECT q.*, e.name as entity_name FROM open_questions q LEFT JOIN entities e ON q.related_entity_id = e.id WHERE q.status = ? ORDER BY q.created_at DESC LIMIT ?'
  ).all(status, limit);
}

function answerQuestion(id, answer) {
  const db = getDb();
  return db.prepare(
    "UPDATE open_questions SET answer = ?, status = 'answered' WHERE id = ?"
  ).run(answer, id);
}

function dismissQuestion(id) {
  const db = getDb();
  return db.prepare(
    "UPDATE open_questions SET status = 'dismissed' WHERE id = ?"
  ).run(id);
}

// ==================== 검색 ====================

function searchNotes(query, limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT n.id, n.title, n.domain, n.confidence, n.created_at,
           snippet(notes_fts, 1, '<mark>', '</mark>', '...', 64) as snippet
    FROM notes_fts f
    JOIN notes n ON f.rowid = n.id
    WHERE notes_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit);
}

function searchEntities(query, limit = 20) {
  const db = getDb();
  return db.prepare(`
    SELECT e.id, e.name, e.type, e.description,
           snippet(entities_fts, 0, '<mark>', '</mark>', '...', 64) as snippet
    FROM entities_fts f
    JOIN entities e ON f.rowid = e.id
    WHERE entities_fts MATCH ?
    ORDER BY rank
    LIMIT ?
  `).all(query, limit);
}

// ==================== 그래프 데이터 ====================

function getGraphData() {
  const db = getDb();
  const nodes = db.prepare('SELECT id, name, type FROM entities').all();
  const edges = db.prepare(`
    SELECT r.id, r.subject_id as source, r.object_id as target,
           r.predicate as label, r.confidence
    FROM relations r
  `).all();
  return { nodes, edges };
}

// ==================== 통합: 노트 저장 파이프라인 ====================

/**
 * 마크다운 노트를 파싱하여 DB에 저장하는 전체 파이프라인
 */
function saveNoteWithExtraction(extractionResult, markdownContent) {
  const db = getDb();
  const { frontmatter, entities, relations, attributes, openQuestions, tags } = extractionResult;

  const transaction = db.transaction(() => {
    // 1. 노트 저장
    const noteResult = createNote(
      frontmatter.title,
      frontmatter.domain,
      markdownContent,
      frontmatter.confidence
    );
    const noteId = noteResult.lastInsertRowid;

    // 2. 태그 저장
    if (tags && tags.length > 0) {
      setNoteTags(noteId, tags);
    }

    // 3. 엔티티 저장
    const entityIds = {};
    for (const entity of entities) {
      const result = createEntity(entity.name, entity.type, entity.description);
      const entityRecord = getEntityByName(entity.name);
      entityIds[entity.name] = entityRecord.id;
    }

    // 4. 관계 저장
    for (const rel of relations) {
      const subjectId = entityIds[rel.subject];
      const objectId = entityIds[rel.object];
      if (subjectId && objectId) {
        createRelation(subjectId, rel.predicate, objectId, noteId, rel.confidence);
      }
    }

    // 5. 속성 저장
    for (const attr of attributes) {
      const entityId = entityIds[attr.entityName];
      if (entityId) {
        createAttribute(entityId, attr.key, attr.value, noteId);
      }
    }

    // 6. 미해결 질문 저장
    const mainEntityId = entityIds[frontmatter.title] || null;
    for (const question of openQuestions) {
      createQuestion(question, mainEntityId, noteId);
    }

    return { noteId, entityCount: entities.length, relationCount: relations.length };
  });

  return transaction();
}

module.exports = {
  // 노트
  createNote, getNote, listNotes, updateNote, deleteNote,
  // 엔티티
  createEntity, getEntity, getEntityByName, listEntities, updateEntity, deleteEntity,
  // 관계
  createRelation, getRelationsForEntity, deleteRelationsByNote,
  // 속성
  createAttribute, getAttributesForEntity, deleteAttributesByNote,
  // 태그
  getOrCreateTag, setNoteTags, getNoteTags,
  // 질문
  createQuestion, listQuestions, answerQuestion, dismissQuestion,
  // 검색
  searchNotes, searchEntities,
  // 그래프
  getGraphData,
  // 통합
  saveNoteWithExtraction,
};
