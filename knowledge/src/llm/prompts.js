/**
 * LLM 프롬프트 템플릿
 * 모든 프롬프트는 한국어 응답을 기본으로 합니다.
 */

const EXTRACT_ENTITIES = `당신은 텍스트에서 지식 온톨로지의 엔티티(개체)를 추출하는 전문가입니다.

주어진 텍스트에서 다음을 추출하세요:
1. 엔티티: 고유한 개념, 사물, 장소, 인물, 조직 등
2. 각 엔티티의 유형 (개념/사물/장소/인물/조직/사건/기술 중 하나)
3. 각 엔티티의 간단한 설명

JSON 형식으로 응답하세요:
\`\`\`json
{
  "entities": [
    {"name": "엔티티명", "type": "유형", "description": "간단한 설명"}
  ]
}
\`\`\``;

const EXTRACT_RELATIONS = `당신은 텍스트에서 엔티티 간의 관계를 추출하는 전문가입니다.

가능한 관계 유형: 상위개념, 하위개념, 관련, 원인, 결과, 구성요소, 위치, 시간, 소속, 반대, 유사

주어진 텍스트와 엔티티 목록에서 관계를 추출하세요.

JSON 형식으로 응답하세요:
\`\`\`json
{
  "relations": [
    {"subject": "주체", "predicate": "관계유형", "object": "객체", "confidence": 0.8}
  ]
}
\`\`\``;

const SUGGEST_QUESTIONS = `당신은 지식의 빈틈을 찾아내는 탐구 전문가입니다.
"실체적 진실"을 추구하는 관점에서, 주어진 지식에 대해 탐구해야 할 질문들을 생성하세요.

질문 유형:
1. 확장 질문: 현재 지식에서 빠진 측면
2. 검증 질문: 확인이 필요한 사항
3. 연결 질문: 다른 개체와의 관계
4. 깊이 질문: 구체적인 메커니즘이나 세부사항

JSON 형식으로 응답하세요:
\`\`\`json
{
  "questions": [
    {"question": "질문 내용", "type": "질문유형", "priority": "high|medium|low", "relatedEntity": "관련 엔티티명"}
  ]
}
\`\`\``;

const VALIDATE_FACT = `당신은 사실 검증 전문가입니다.
주어진 정보의 정확성과 신뢰도를 평가하세요.

JSON 형식으로 응답하세요:
\`\`\`json
{
  "assessment": "평가 내용",
  "confidence": 0.8,
  "issues": ["발견된 문제점"],
  "suggestions": ["개선 제안"]
}
\`\`\``;

const SUMMARIZE_FOR_NOTE = `당신은 구조화된 정보를 읽기 쉬운 노트 형태로 변환하는 전문가입니다.
주어진 엔티티 정보와 관계를 한국어 마크다운 노트로 요약하세요.

다음 형식을 따르세요:
- 핵심 내용을 간결하게 정리
- 중요한 관계를 명확히 서술
- 미해결 질문이 있으면 포함`;

const ENRICH_NOTE = `당신은 지식 보강 전문가입니다.
사용자가 작성한 마크다운 노트를 분석하고, 비정형 텍스트에서 추가로 추출할 수 있는 엔티티, 관계, 속성을 찾아주세요.

이미 구조화된 섹션(## 관련 개체, ## 속성)의 내용은 제외하고,
정의 섹션이나 기타 자유 텍스트에서만 추가 정보를 추출하세요.

JSON 형식으로 응답하세요:
\`\`\`json
{
  "additionalEntities": [
    {"name": "엔티티명", "type": "유형", "description": "설명"}
  ],
  "additionalRelations": [
    {"subject": "주체", "predicate": "관계유형", "object": "객체", "confidence": 0.7}
  ],
  "additionalAttributes": [
    {"entityName": "엔티티명", "key": "속성키", "value": "속성값"}
  ],
  "suggestedQuestions": ["추가 탐구 질문"]
}
\`\`\``;

module.exports = {
  EXTRACT_ENTITIES,
  EXTRACT_RELATIONS,
  SUGGEST_QUESTIONS,
  VALIDATE_FACT,
  SUMMARIZE_FOR_NOTE,
  ENRICH_NOTE,
};
