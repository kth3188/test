const express = require('express');
const router = express.Router();
const queries = require('../db/queries');
const { extractFromStructured } = require('../parser/entity-extractor');
const { entityToMarkdown, regenerateNoteMarkdown } = require('../parser/db-to-markdown');
const { enrichNote, generateQuestions } = require('../llm/active-inquiry');
const { exportToOrganization, exportToJsonLd } = require('../sync/export');
const { importFromOrganization } = require('../sync/import');

// ==================== 노트 API ====================

// 노트 목록
router.get('/notes', (req, res) => {
  const { domain, limit, offset } = req.query;
  const notes = queries.listNotes({
    domain: domain || undefined,
    limit: Math.min(parseInt(limit) || 50, 500),
    offset: parseInt(offset) || 0,
  });
  res.json({ notes });
});

// 노트 상세
router.get('/notes/:id', (req, res) => {
  const note = queries.getNote(parseInt(req.params.id));
  if (!note) return res.status(404).json({ error: '노트를 찾을 수 없습니다.' });

  const tags = queries.getNoteTags(note.id);
  res.json({ ...note, tags });
});

// 노트 생성 (마크다운 → 파싱 → DB)
router.post('/notes', async (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') return res.status(400).json({ error: '내용은 문자열이어야 합니다.' });
    if (content.length > 500000) return res.status(400).json({ error: '내용이 너무 깁니다 (최대 500KB).' });
    if (!content) return res.status(400).json({ error: '마크다운 내용이 필요합니다.' });

    // 1. 규칙 기반 추출
    const extraction = extractFromStructured(content);

    // 2. DB 저장
    const result = queries.saveNoteWithExtraction(extraction, content);

    // 3. LLM 보강 (비동기, 실패해도 기본 저장은 완료)
    let llmEnrichment = null;
    try {
      llmEnrichment = await enrichNote(content, extraction);
    } catch (err) {
      console.warn('LLM 보강 실패 (기본 저장은 완료):', err.message);
    }

    res.json({
      noteId: Number(result.noteId),
      entityCount: result.entityCount,
      relationCount: result.relationCount,
      llmEnrichment,
    });
  } catch (err) {
    console.error('노트 생성 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 노트 수정
router.put('/notes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const note = queries.getNote(id);
  if (!note) return res.status(404).json({ error: '노트를 찾을 수 없습니다.' });

  const { content, title, domain, confidence } = req.body;

  // 마크다운 내용이 변경되면 재파싱
  if (content && content !== note.content) {
    // 기존 관계/속성 삭제 후 재추출
    queries.deleteRelationsByNote(id);
    queries.deleteAttributesByNote(id);

    const extraction = extractFromStructured(content);
    queries.updateNote(id, {
      title: extraction.frontmatter.title,
      domain: extraction.frontmatter.domain,
      content,
      confidence: extraction.frontmatter.confidence,
    });

    // 태그 업데이트
    if (extraction.tags.length > 0) {
      queries.setNoteTags(id, extraction.tags);
    }
  } else {
    queries.updateNote(id, { title, domain, confidence });
  }

  res.json({ success: true });
});

// 노트 삭제
router.delete('/notes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  queries.deleteNote(id);
  res.json({ success: true });
});

// 노트 재파싱 (마크다운 → DB 갱신)
router.post('/notes/:id/reparse', (req, res) => {
  const id = parseInt(req.params.id);
  const note = queries.getNote(id);
  if (!note) return res.status(404).json({ error: '노트를 찾을 수 없습니다.' });

  const db = require('../db/db').getDb();
  const result = db.transaction(() => {
    queries.deleteRelationsByNote(id);
    queries.deleteAttributesByNote(id);

    const extraction = extractFromStructured(note.content);

    const entityIds = {};
    for (const entity of extraction.entities) {
      queries.createEntity(entity.name, entity.type, entity.description);
      const record = queries.getEntityByName(entity.name);
      entityIds[entity.name] = record.id;
    }

    for (const rel of extraction.relations) {
      const subId = entityIds[rel.subject];
      const objId = entityIds[rel.object];
      if (subId && objId) {
        queries.createRelation(subId, rel.predicate, objId, id, rel.confidence);
      }
    }

    for (const attr of extraction.attributes) {
      const entId = entityIds[attr.entityName];
      if (entId) {
        queries.createAttribute(entId, attr.key, attr.value, id);
      }
    }

    return extraction.entities.length;
  })();

  res.json({ success: true, entityCount: result });
});

// 노트 마크다운 재생성 (DB → 마크다운)
router.post('/notes/:id/regenerate', (req, res) => {
  const id = parseInt(req.params.id);
  const note = queries.getNote(id);
  if (!note) return res.status(404).json({ error: '노트를 찾을 수 없습니다.' });

  // 주 엔티티와 관련 데이터 수집
  const mainEntity = queries.getEntityByName(note.title);
  if (!mainEntity) {
    return res.status(404).json({ error: '주 엔티티를 찾을 수 없습니다.' });
  }

  const relations = queries.getRelationsForEntity(mainEntity.id);
  const attributes = queries.getAttributesForEntity(mainEntity.id);
  const questionList = queries.listQuestions({ status: 'open' })
    .filter(q => q.related_entity_id === mainEntity.id || q.source_note_id === id);

  const markdown = regenerateNoteMarkdown(note, [mainEntity], relations, attributes, questionList);

  // DB 업데이트
  queries.updateNote(id, { content: markdown });

  res.json({ success: true, content: markdown });
});

// ==================== 엔티티 API ====================

router.get('/entities', (req, res) => {
  const { type, limit, offset } = req.query;
  const entities = queries.listEntities({
    type: type || undefined,
    limit: Math.min(parseInt(limit) || 100, 500),
    offset: parseInt(offset) || 0,
  });
  res.json({ entities });
});

router.get('/entities/:id', (req, res) => {
  const entity = queries.getEntity(parseInt(req.params.id));
  if (!entity) return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });

  const relations = queries.getRelationsForEntity(entity.id);
  const attributes = queries.getAttributesForEntity(entity.id);

  res.json({ ...entity, relations, attributes });
});

router.put('/entities/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { name, type, description } = req.body;
  queries.updateEntity(id, { name, type, description });
  res.json({ success: true });
});

// 엔티티를 마크다운 노트로 변환
router.get('/entities/:id/markdown', (req, res) => {
  const entity = queries.getEntity(parseInt(req.params.id));
  if (!entity) return res.status(404).json({ error: '엔티티를 찾을 수 없습니다.' });

  const relations = queries.getRelationsForEntity(entity.id);
  const attributes = queries.getAttributesForEntity(entity.id);
  const questions = queries.listQuestions({ status: 'open' })
    .filter(q => q.related_entity_id === entity.id);

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
    sources: [],
    openQuestions: questions.map(q => q.question),
  }, { domain: entity.type });

  res.json({ markdown });
});

// ==================== 그래프 API ====================

router.get('/graph', (req, res) => {
  const graphData = queries.getGraphData();
  res.json(graphData);
});

// ==================== 검색 API ====================

router.get('/search', (req, res) => {
  const { q, limit } = req.query;
  if (!q) return res.status(400).json({ error: '검색어가 필요합니다.' });
  if (q.length > 200) return res.status(400).json({ error: '검색어가 너무 깁니다.' });

  const notes = queries.searchNotes(q, parseInt(limit) || 20);
  const entities = queries.searchEntities(q, parseInt(limit) || 20);

  res.json({ notes, entities });
});

// ==================== 질문 API ====================

router.get('/questions', (req, res) => {
  const { status, limit } = req.query;
  const questions = queries.listQuestions({
    status: status || 'open',
    limit: parseInt(limit) || 50,
  });
  res.json({ questions });
});

router.post('/questions/:id/answer', (req, res) => {
  const { answer } = req.body;
  if (!answer) return res.status(400).json({ error: '답변이 필요합니다.' });
  queries.answerQuestion(parseInt(req.params.id), answer);
  res.json({ success: true });
});

router.post('/questions/:id/dismiss', (req, res) => {
  queries.dismissQuestion(parseInt(req.params.id));
  res.json({ success: true });
});

// 새 탐구 질문 생성 (LLM)
router.post('/questions/generate', async (req, res) => {
  try {
    const { domain, limit } = req.body;
    const result = await generateQuestions(domain, limit || 5);
    res.json(result);
  } catch (err) {
    console.error('질문 생성 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== 마크다운 내보내기 ====================

router.post('/export/markdown', (req, res) => {
  const { entityIds } = req.body;
  if (!entityIds || !Array.isArray(entityIds)) {
    return res.status(400).json({ error: 'entityIds 배열이 필요합니다.' });
  }

  const markdowns = [];
  for (const id of entityIds) {
    const entity = queries.getEntity(id);
    if (!entity) continue;

    const relations = queries.getRelationsForEntity(entity.id);
    const attributes = queries.getAttributesForEntity(entity.id);

    const relForMd = relations.map(r => ({
      targetName: r.subject_id === entity.id ? r.object_name : r.subject_name,
      predicate: r.predicate,
      description: '',
    }));

    const md = entityToMarkdown({
      name: entity.name,
      type: entity.type,
      description: entity.description,
      relations: relForMd,
      attributes: attributes.map(a => ({ key: a.key, value: a.value })),
      sources: [],
      openQuestions: [],
    }, { domain: entity.type });

    markdowns.push({ entityId: id, name: entity.name, markdown: md });
  }

  res.json({ markdowns });
});

// ==================== 통계 API ====================

router.get('/stats', (req, res) => {
  const stats = queries.getStats();
  res.json(stats);
});

// ==================== 조직 동기화 API ====================

// 개인 → 조직 내보내기
router.post('/sync/export', (req, res) => {
  try {
    const { minConfidence, domain, format } = req.body;

    if (format === 'jsonld') {
      const jsonld = exportToJsonLd({ minConfidence });
      return res.json({ format: 'jsonld', data: jsonld });
    }

    const result = exportToOrganization({ minConfidence, domain });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('내보내기 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

// 조직 → 개인 가져오기
router.post('/sync/import', (req, res) => {
  try {
    const { domain, entityName, depth } = req.body;
    const result = importFromOrganization({ domain, entityName, depth });
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('가져오기 오류:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
