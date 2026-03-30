const { RELATION_TYPES } = require('./markdown-to-db');

/**
 * DB의 엔티티 데이터를 마크다운 노트로 역변환
 * @param {object} entityData - 엔티티 정보
 * @param {string} entityData.name - 엔티티 이름
 * @param {string} entityData.type - 엔티티 유형
 * @param {string} entityData.description - 엔티티 설명
 * @param {object[]} entityData.relations - 관련 관계 목록
 * @param {object[]} entityData.attributes - 속성 목록
 * @param {string[]} entityData.sources - 출처 목록
 * @param {string[]} entityData.openQuestions - 미해결 질문 목록
 * @param {object} options - 변환 옵션
 * @param {string} options.domain - 도메인
 * @param {string[]} options.tags - 태그 목록
 * @param {string} options.confidence - 신뢰도
 * @returns {string} 마크다운 문자열
 */
function entityToMarkdown(entityData, options = {}) {
  const {
    name,
    type,
    description = '',
    relations = [],
    attributes = [],
    sources = [],
    openQuestions = [],
  } = entityData;

  const {
    domain = type || '',
    tags = [],
    confidence = 'medium',
  } = options;

  const today = new Date().toISOString().split('T')[0];

  // YAML 값 이스케이프 (콜론, 따옴표 등 특수문자 처리)
  const yamlEscape = (str) => {
    if (!str) return '';
    if (/[:#\[\]{}&*!|>'"`,@]/.test(str) || str.includes('\n')) {
      return `"${str.replace(/"/g, '\\"')}"`;
    }
    return str;
  };

  const frontmatter = [
    '---',
    `title: ${yamlEscape(name)}`,
    `domain: ${yamlEscape(domain)}`,
    `created: ${today}`,
    `tags: [${tags.map(t => yamlEscape(t)).join(', ')}]`,
    `confidence: ${confidence}`,
    '---',
  ].join('\n');

  // 본문 섹션들
  const sections = [];

  // 제목
  sections.push(`# ${name}`);

  // 정의
  sections.push('## 정의');
  sections.push(description || '(설명 없음)');

  // 관련 개체
  if (relations.length > 0) {
    sections.push('## 관련 개체');
    for (const rel of relations) {
      const desc = rel.description ? ` ${rel.description}` : '';
      sections.push(`- **[${rel.targetName}]**:${desc} (관계: ${rel.predicate})`);
    }
  }

  // 속성
  if (attributes.length > 0) {
    sections.push('## 속성');
    for (const attr of attributes) {
      sections.push(`- ${attr.key}: ${attr.value}`);
    }
  }

  // 출처/근거
  if (sources.length > 0) {
    sections.push('## 출처/근거');
    for (const source of sources) {
      sections.push(`- ${source}`);
    }
  }

  // 미해결 질문
  if (openQuestions.length > 0) {
    sections.push('## 미해결 질문');
    for (const q of openQuestions) {
      sections.push(`- ${q}`);
    }
  }

  return frontmatter + '\n\n' + sections.join('\n\n') + '\n';
}

/**
 * 노트 DB 레코드를 마크다운으로 재생성
 * (DB에서 직접 수정된 엔티티/관계/속성을 반영)
 * @param {object} noteRecord - notes 테이블 레코드
 * @param {object[]} entities - 관련 엔티티 목록
 * @param {object[]} relations - 관련 관계 목록
 * @param {object[]} attributes - 관련 속성 목록
 * @param {object[]} questions - 미해결 질문 목록
 * @returns {string} 재생성된 마크다운
 */
function regenerateNoteMarkdown(noteRecord, entities, relations, attributes, questions, tags, sources) {
  const mainEntity = entities.find(e => e.name === noteRecord.title) || {
    name: noteRecord.title,
    description: '',
  };

  // 관계를 관련 개체 형태로 변환 (방향성 보존)
  const relatedEntities = relations.map(r => {
    const isSubject = r.subject_name === mainEntity.name;
    return {
      targetName: isSubject ? r.object_name : r.subject_name,
      predicate: r.predicate,
      description: '',
    };
  });

  const attrs = attributes.map(a => ({
    key: a.key,
    value: a.value,
  }));

  const openQuestions = questions
    .filter(q => q.status === 'open')
    .map(q => q.question);

  const sourceTexts = (sources || []).map(s => s.text || s);

  return entityToMarkdown(
    {
      name: mainEntity.name,
      type: mainEntity.type,
      description: mainEntity.description,
      relations: relatedEntities,
      attributes: attrs,
      sources: sourceTexts,
      openQuestions,
    },
    {
      domain: noteRecord.domain,
      tags: tags || [],
      confidence: noteRecord.confidence,
    }
  );
}

module.exports = {
  entityToMarkdown,
  regenerateNoteMarkdown,
};
