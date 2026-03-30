const { chatJson } = require('./llm-client');
const { SUGGEST_QUESTIONS, ENRICH_NOTE, EXTRACT_ENTITIES, EXTRACT_RELATIONS } = require('./prompts');
const queries = require('../db/queries');

/**
 * 노트 저장 시 LLM을 통해 추가 엔티티/관계 추출 및 질문 생성
 * @param {string} markdownContent - 원본 마크다운
 * @param {object} basicExtraction - 규칙 기반 추출 결과
 * @returns {object} LLM 보강 결과
 */
async function enrichNote(markdownContent, basicExtraction) {
  const enrichResult = await chatJson(
    ENRICH_NOTE,
    `다음은 사용자가 작성한 마크다운 노트입니다:\n\n${markdownContent}\n\n이미 추출된 엔티티: ${basicExtraction.entities.map(e => e.name).join(', ')}`
  );

  return enrichResult || {
    additionalEntities: [],
    additionalRelations: [],
    additionalAttributes: [],
    suggestedQuestions: [],
  };
}

/**
 * 기존 지식 기반으로 탐구 질문 생성
 * @param {string} domain - 특정 도메인 (null이면 전체)
 * @param {number} limit - 최대 질문 수
 */
async function generateQuestions(domain = null, limit = 5) {
  // 최근 노트와 엔티티 수집
  const recentNotes = queries.listNotes({ domain, limit: 10 });
  const entities = queries.listEntities({ limit: 50 });

  if (entities.length === 0) {
    return { questions: [] };
  }

  // 기존 미해결 질문 조회
  const existingQuestions = queries.listQuestions({ status: 'open', limit: 20 });

  const context = [
    '=== 최근 노트 ===',
    ...recentNotes.map(n => `- ${n.title} (${n.domain || '미분류'}, 신뢰도: ${n.confidence})`),
    '',
    '=== 주요 엔티티 ===',
    ...entities.map(e => `- ${e.name} (${e.type || '미분류'}): ${e.description || '설명 없음'}`),
    '',
    '=== 기존 미해결 질문 ===',
    ...existingQuestions.map(q => `- ${q.question}`),
  ].join('\n');

  const result = await chatJson(
    SUGGEST_QUESTIONS,
    `다음은 현재 지식 DB의 상태입니다. 이를 기반으로 ${limit}개의 새로운 탐구 질문을 생성하세요.\n\n${context}`
  );

  if (result && result.questions) {
    // DB에 저장
    for (const q of result.questions) {
      const entity = q.relatedEntity ? queries.getEntityByName(q.relatedEntity) : null;
      queries.createQuestion(q.question, entity?.id || null, null);
    }
  }

  return result || { questions: [] };
}

/**
 * 비정형 텍스트에서 엔티티와 관계를 LLM으로 추출
 * @param {string} text - 자유 텍스트
 * @returns {object} 추출 결과
 */
async function extractFromFreeText(text) {
  // 엔티티 추출
  const entitiesResult = await chatJson(
    EXTRACT_ENTITIES,
    `다음 텍스트에서 엔티티를 추출하세요:\n\n${text}`
  );

  if (!entitiesResult || !entitiesResult.entities) {
    return { entities: [], relations: [] };
  }

  // 관계 추출
  const entityNames = entitiesResult.entities.map(e => e.name).join(', ');
  const relationsResult = await chatJson(
    EXTRACT_RELATIONS,
    `다음 텍스트에서 엔티티 간의 관계를 추출하세요.\n\n텍스트:\n${text}\n\n엔티티 목록: ${entityNames}`
  );

  return {
    entities: entitiesResult.entities || [],
    relations: relationsResult?.relations || [],
  };
}

module.exports = {
  enrichNote,
  generateQuestions,
  extractFromFreeText,
};
