# 온톨로지 지식 시스템 (Ontology Knowledge System)

## 프로젝트 개요
군 조직에서 비전문가가 온톨로지 구축에 기여할 수 있는 중간층 시스템.
마크다운 → LLM 정형화 → DB → 사용자 친화적 UI의 파이프라인.

## 핵심 철학: 실체적 진실 추구
- 모든 지식에는 출처와 신뢰도가 명시되어야 한다
- 시스템은 능동적으로 미해결 질문을 생성하고 사용자에게 탐구를 유도한다
- 모순되는 정보는 삭제하지 않고 병렬 보존하며 검증을 유도한다

## 기술 스택
- **런타임**: Node.js
- **DB**: SQLite (better-sqlite3)
- **LLM**: Claude API (1차), Ollama (추후)
- **프론트엔드**: 바닐라 JS + Tailwind CSS
- **파서**: gray-matter + remark

## 프로젝트 구조
```
knowledge/           # 온톨로지 시스템 루트
├── notes/           # 사용자 마크다운 노트
│   └── templates/   # 노트 템플릿
├── db/              # SQLite DB 파일
├── src/
│   ├── parser/      # 마크다운 ↔ DB 양방향 변환
│   ├── db/          # DB 스키마 및 쿼리
│   ├── llm/         # LLM 통합 (Claude API)
│   ├── api/         # REST API (Express)
│   └── sync/        # 조직 동기화
└── frontend/        # 웹 UI
```

## 코드 컨벤션
- 코드 주석은 한국어로 작성
- 변수명/함수명은 영어 camelCase
- 파일명은 kebab-case
- DB 테이블/컬럼은 snake_case

## 온톨로지 용어 정의
- **엔티티(Entity)**: 지식의 기본 단위. 개념, 사물, 장소, 인물, 조직 등
- **릴레이션(Relation)**: 두 엔티티 간의 관계 (트리플: 주체-술어-객체)
- **속성(Attribute)**: 엔티티의 key-value 속성
- **트리플(Triple)**: (주체, 관계, 객체) 형태의 지식 표현 단위
- **신뢰도(Confidence)**: 정보의 확실성 수준 (high/medium/low 또는 0.0~1.0)

## 관계 유형 (predicate)
상위개념, 하위개념, 관련, 원인, 결과, 구성요소, 위치, 시간, 소속, 반대, 유사

## 마크다운 노트 규칙
- YAML frontmatter 필수 (title, domain, tags, confidence)
- `## 관련 개체` 섹션에서 `**[개체명]**: 설명 (관계: 유형)` 패턴 사용
- `## 속성` 섹션에서 `- key: value` 패턴 사용
- `## 미해결 질문` 섹션으로 탐구 과제 기록

## 빌드/실행 명령어
```bash
# 의존성 설치
npm install

# 지식 시스템 서버 실행 (포트 3001)
node knowledge/src/server.js

# 기존 기상 API 서버 (포트 3000)
node server.js
```

## 환경변수
- `ANTHROPIC_API_KEY`: Claude API 키 (.env 파일에 설정)
- `LLM_BACKEND`: 'claude' 또는 'ollama' (기본: claude)
- `KNOWLEDGE_DB_PATH`: DB 파일 경로 (기본: knowledge/db/personal.db)
