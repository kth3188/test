const matter = require('gray-matter');

// 관계 유형 매핑
const RELATION_TYPES = [
  '상위개념', '하위개념', '관련', '원인', '결과',
  '구성요소', '위치', '시간', '소속', '반대', '유사'
];

/**
 * 마크다운 노트를 파싱하여 구조화된 데이터로 변환
 * @param {string} markdownContent - 마크다운 원본 텍스트
 * @returns {object} 파싱된 구조화 데이터
 */
function parseMarkdown(markdownContent) {
  // 1. YAML frontmatter 파싱 (오류 방어)
  let frontmatter = {};
  let content = markdownContent;
  try {
    const parsed = matter(markdownContent);
    frontmatter = parsed.data || {};
    content = parsed.content;
  } catch (err) {
    console.warn('YAML frontmatter 파싱 실패, 전체를 본문으로 처리:', err.message);
    frontmatter = {};
    content = markdownContent;
  }

  // 2. 섹션별 분리
  const sections = parseSections(content);

  // 3. 엔티티-관계 추출 (관련 개체 섹션)
  const relatedEntities = parseRelatedEntities(sections['관련 개체'] || '');

  // 4. 속성 추출
  const attributes = parseAttributes(sections['속성'] || '');

  // 5. 미해결 질문 추출
  const openQuestions = parseQuestions(sections['미해결 질문'] || '');

  // 6. 출처 추출
  const sources = parseSources(sections['출처/근거'] || sections['출처'] || '');

  // 7. 정의 텍스트
  const definition = (sections['정의'] || '').trim();

  return {
    frontmatter: {
      title: frontmatter.title || '제목 없음',
      domain: frontmatter.domain || null,
      created: frontmatter.created || new Date().toISOString().split('T')[0],
      tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : (frontmatter.tags ? [String(frontmatter.tags)] : []),
      confidence: frontmatter.confidence || 'medium',
    },
    definition,
    relatedEntities,
    attributes,
    openQuestions,
    sources,
    rawContent: markdownContent,
  };
}

/**
 * 마크다운을 ## 섹션별로 분리
 */
function parseSections(content) {
  const sections = {};
  const sectionRegex = /^## (.+)$/gm;
  let lastKey = null;
  let lastIndex = 0;

  let match;
  while ((match = sectionRegex.exec(content)) !== null) {
    if (lastKey !== null) {
      sections[lastKey] = content.slice(lastIndex, match.index).trim();
    }
    lastKey = match[1].trim();
    lastIndex = match.index + match[0].length;
  }

  if (lastKey !== null) {
    sections[lastKey] = content.slice(lastIndex).trim();
  }

  return sections;
}

/**
 * 관련 개체 섹션에서 엔티티와 관계 추출
 * 패턴: - **[개체명]**: 설명 (관계: 유형)
 */
function parseRelatedEntities(text) {
  const entities = [];
  const lines = text.split('\n').filter(l => l.trim().startsWith('-'));

  for (const line of lines) {
    // **[개체명]** 또는 **개체명** 패턴 매칭
    const entityMatch = line.match(/\*\*\[?([^\]\*]+)\]?\*\*/);
    if (!entityMatch) continue;

    const name = entityMatch[1].trim();

    // 설명 추출 (**: 뒤부터 (관계: 앞까지)
    const afterBold = line.slice(line.indexOf('**', line.indexOf('**') + 2) + 2);
    let description = '';
    let relationType = '관련'; // 기본값

    // (관계: 유형) 패턴 매칭
    const relationMatch = afterBold.match(/\(관계:\s*([^)]+)\)/);
    if (relationMatch) {
      relationType = relationMatch[1].trim();
      description = afterBold.replace(relationMatch[0], '').replace(/^[:\s]+/, '').trim();
    } else {
      description = afterBold.replace(/^[:\s]+/, '').trim();
    }

    entities.push({ name, description, relationType });
  }

  return entities;
}

/**
 * 속성 섹션에서 key-value 추출
 * 패턴: - key: value
 */
function parseAttributes(text) {
  const attributes = [];
  const lines = text.split('\n').filter(l => l.trim().startsWith('-'));

  for (const line of lines) {
    const kvMatch = line.match(/^-\s+([^:]+):\s+(.+)$/);
    if (kvMatch) {
      attributes.push({
        key: kvMatch[1].trim(),
        value: kvMatch[2].trim(),
      });
    }
  }

  return attributes;
}

/**
 * 미해결 질문 섹션에서 질문 추출
 */
function parseQuestions(text) {
  return text
    .split('\n')
    .filter(l => l.trim().startsWith('-'))
    .map(l => l.replace(/^-\s+/, '').trim())
    .filter(q => q.length > 0);
}

/**
 * 출처/근거 섹션에서 출처 추출
 */
function parseSources(text) {
  return text
    .split('\n')
    .filter(l => l.trim().startsWith('-'))
    .map(l => l.replace(/^-\s+/, '').trim())
    .filter(s => s.length > 0);
}

module.exports = {
  parseMarkdown,
  parseSections,
  parseRelatedEntities,
  parseAttributes,
  parseQuestions,
  parseSources,
  RELATION_TYPES,
};
