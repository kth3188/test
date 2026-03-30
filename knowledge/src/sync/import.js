const Database = require('better-sqlite3');
const path = require('path');
const { getDb } = require('../db/db');
const { entityToMarkdown } = require('../parser/db-to-markdown');
const { extractFromStructured } = require('../parser/entity-extractor');
const queries = require('../db/queries');
const fs = require('fs');

const ORG_DB_PATH = path.join(__dirname, '../../db/organization.db');

/**
 * 조직 DB에서 개인 DB로 관련 정보를 가져오기
 * @param {object} options
 * @param {string} options.domain - 관심 도메인
 * @param {string} options.entityName - 특정 엔티티 검색
 * @param {number} options.depth - 관계 탐색 깊이 (기본 1)
 * @returns {object} 가져오기 결과
 */
function importFromOrganization(options = {}) {
  const { domain, entityName, depth = 1 } = options;
  const orgDb = new Database(ORG_DB_PATH, { readonly: true });

  let importedNotes = 0;
  const results = [];

  try {
    // 대상 엔티티 검색
    let entities;
    if (entityName) {
      entities = orgDb.prepare(
        "SELECT * FROM entities WHERE name LIKE ?"
      ).all(`%${entityName}%`);
    } else if (domain) {
      entities = orgDb.prepare(
        "SELECT * FROM entities WHERE type = ?"
      ).all(domain);
    } else {
      entities = orgDb.prepare(
        "SELECT * FROM entities LIMIT 20"
      ).all();
    }

    for (const entity of entities) {
      // 개인 DB에 이미 존재하는 엔티티는 건너뛰기
      const existing = queries.getEntityByName(entity.name);
      if (existing) continue;

      // 관계 조회
      const relations = orgDb.prepare(`
        SELECT r.*, s.name as subject_name, o.name as object_name
        FROM relations r
        JOIN entities s ON r.subject_id = s.id
        JOIN entities o ON r.object_id = o.id
        WHERE r.subject_id = ? OR r.object_id = ?
      `).all(entity.id, entity.id);

      // 속성 조회
      const attributes = orgDb.prepare(
        'SELECT * FROM attributes WHERE entity_id = ?'
      ).all(entity.id);

      // 마크다운 노트로 변환
      const relForMd = relations.map(r => ({
        targetName: r.subject_id === entity.id ? r.object_name : r.subject_name,
        predicate: r.predicate,
        description: '',
      }));

      const markdown = entityToMarkdown({
        name: entity.name,
        type: entity.type,
        description: entity.description,
        relations: relForMd,
        attributes: attributes.map(a => ({ key: a.key, value: a.value })),
        sources: ['조직 온톨로지에서 가져옴'],
        openQuestions: [],
      }, {
        domain: entity.type || domain,
        tags: ['조직동기화'],
        confidence: 'medium',
      });

      // 개인 DB에 저장
      const extraction = extractFromStructured(markdown);
      const saved = queries.saveNoteWithExtraction(extraction, markdown);

      // 마크다운 파일로도 저장
      const fileName = entity.name.replace(/[/\\?%*:|"<>]/g, '_');
      const filePath = path.join(__dirname, '../../notes', `${fileName}.md`);
      fs.writeFileSync(filePath, markdown, 'utf-8');

      results.push({
        entityName: entity.name,
        noteId: Number(saved.noteId),
        filePath,
      });
      importedNotes++;
    }
  } finally {
    orgDb.close();
  }

  return { importedNotes, results };
}

module.exports = { importFromOrganization };
