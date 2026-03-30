const Database = require('better-sqlite3');
const path = require('path');
const { getDb } = require('../db/db');

const ORG_DB_PATH = path.join(__dirname, '../../db/organization.db');

/**
 * 개인 DB에서 조직 DB로 엔티티/관계를 내보내기
 * @param {object} options
 * @param {number} options.minConfidence - 최소 신뢰도 (기본 0.5)
 * @param {string} options.domain - 특정 도메인만 내보내기
 * @returns {object} 내보내기 결과
 */
function exportToOrganization(options = {}) {
  const { minConfidence = 0.5, domain } = options;
  const personalDb = getDb();
  const orgDb = new Database(ORG_DB_PATH);
  orgDb.pragma('journal_mode = WAL');
  orgDb.pragma('foreign_keys = ON');

  let exportedEntities = 0;
  let exportedRelations = 0;

  try {
    const transaction = orgDb.transaction(() => {
      const entities = personalDb.prepare('SELECT * FROM entities').all();

      for (const entity of entities) {
        orgDb.prepare(`
          INSERT INTO entities (name, type, description)
          VALUES (?, ?, ?)
          ON CONFLICT(name) DO UPDATE SET
            type = COALESCE(excluded.type, entities.type),
            description = CASE
              WHEN length(excluded.description) > length(COALESCE(entities.description, ''))
              THEN excluded.description
              ELSE entities.description
            END
        `).run(entity.name, entity.type, entity.description);
        exportedEntities++;
      }

      const relations = personalDb.prepare(`
        SELECT r.*, s.name as subject_name, o.name as object_name
        FROM relations r
        JOIN entities s ON r.subject_id = s.id
        JOIN entities o ON r.object_id = o.id
        WHERE r.confidence >= ?
      `).all(minConfidence);

      for (const rel of relations) {
        const subj = orgDb.prepare('SELECT id FROM entities WHERE name = ?').get(rel.subject_name);
        const obj = orgDb.prepare('SELECT id FROM entities WHERE name = ?').get(rel.object_name);

        if (subj && obj) {
          const existing = orgDb.prepare(
            'SELECT id FROM relations WHERE subject_id = ? AND predicate = ? AND object_id = ?'
          ).get(subj.id, rel.predicate, obj.id);

          if (!existing) {
            orgDb.prepare(
              'INSERT INTO relations (subject_id, predicate, object_id, confidence) VALUES (?, ?, ?, ?)'
            ).run(subj.id, rel.predicate, obj.id, rel.confidence);
            exportedRelations++;
          }
        }
      }
    });

    transaction();
  } finally {
    orgDb.close();
  }

  return { exportedEntities, exportedRelations };
}

/**
 * 개인 DB를 JSON-LD 형식으로 내보내기
 */
function exportToJsonLd(options = {}) {
  const { minConfidence = 0.5 } = options;
  const db = getDb();

  const entities = db.prepare('SELECT * FROM entities').all();
  const relations = db.prepare(`
    SELECT r.*, s.name as subject_name, o.name as object_name
    FROM relations r
    JOIN entities s ON r.subject_id = s.id
    JOIN entities o ON r.object_id = o.id
    WHERE r.confidence >= ?
  `).all(minConfidence);

  const attributes = db.prepare(`
    SELECT a.*, e.name as entity_name
    FROM attributes a
    JOIN entities e ON a.entity_id = e.id
  `).all();

  // JSON-LD 구성
  const graph = entities.map(entity => {
    const entityRels = relations.filter(
      r => r.subject_name === entity.name || r.object_name === entity.name
    );
    const entityAttrs = attributes.filter(a => a.entity_name === entity.name);

    const node = {
      '@id': `ont:entity_${entity.id}`,
      '@type': entity.type ? `ont:${entity.type}` : 'ont:Entity',
      'ont:name': entity.name,
      'ont:description': entity.description,
    };

    // 속성 추가
    for (const attr of entityAttrs) {
      node[`ont:${attr.key}`] = attr.value;
    }

    // 관계 추가
    const relatedTo = entityRels
      .filter(r => r.subject_name === entity.name)
      .map(r => ({
        '@id': `ont:entity_${r.object_id}`,
        'ont:predicate': r.predicate,
        'ont:confidence': r.confidence,
      }));

    if (relatedTo.length > 0) {
      node['ont:relatedTo'] = relatedTo;
    }

    return node;
  });

  return {
    '@context': {
      'ont': 'http://org-ontology/v1/',
    },
    '@graph': graph,
  };
}

module.exports = { exportToOrganization, exportToJsonLd };
