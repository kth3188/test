const { parseMarkdown } = require('./markdown-to-db');

/**
 * 마크다운에서 규칙 기반으로 엔티티/관계/속성을 추출
 * (LLM 없이 구조화된 섹션에서 추출)
 * @param {string} markdownContent - 마크다운 원본
 * @returns {object} 추출 결과
 */
function extractFromStructured(markdownContent) {
  const parsed = parseMarkdown(markdownContent);
  const entities = [];
  const relations = [];

  // 주 엔티티 (노트 제목)
  const mainEntity = {
    name: parsed.frontmatter.title,
    type: parsed.frontmatter.domain,
    description: parsed.definition,
  };
  entities.push(mainEntity);

  // 관련 개체에서 엔티티 및 관계 추출
  for (const rel of parsed.relatedEntities) {
    entities.push({
      name: rel.name,
      type: null, // LLM이 추후 분류
      description: rel.description,
    });

    relations.push({
      subject: mainEntity.name,
      predicate: rel.relationType,
      object: rel.name,
      confidence: confidenceToNumber(parsed.frontmatter.confidence),
    });
  }

  return {
    entities,
    relations,
    attributes: parsed.attributes.map(a => ({
      entityName: mainEntity.name,
      ...a,
    })),
    openQuestions: parsed.openQuestions,
    tags: parsed.frontmatter.tags,
    frontmatter: parsed.frontmatter,
    rawContent: markdownContent,
  };
}

/**
 * 신뢰도 문자열을 숫자로 변환
 */
function confidenceToNumber(confidence) {
  const map = { high: 0.9, medium: 0.6, low: 0.3 };
  return map[confidence] || 0.5;
}

/**
 * 숫자 신뢰도를 문자열로 변환
 */
function confidenceToString(num) {
  if (num >= 0.7) return 'high';
  if (num >= 0.4) return 'medium';
  return 'low';
}

module.exports = {
  extractFromStructured,
  confidenceToNumber,
  confidenceToString,
};
