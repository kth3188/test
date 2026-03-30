# 온톨로지 추출

개인 지식 DB에서 온톨로지 트리플을 추출하여 정형화된 온톨로지를 생성합니다.

## 실행 방법
1. entities, relations 테이블에서 모든 트리플을 조회합니다
2. 신뢰도 기준으로 필터링합니다 (기본: confidence >= 0.5)
3. 엔티티 타입별로 분류합니다
4. JSON-LD 형식으로 온톨로지를 생성합니다
5. 결과를 파일로 저장하거나 조직 DB로 내보냅니다

## 사용법
```
/extract-ontology [--domain 도메인] [--min-confidence 0.5] [--format jsonld|json]
```

## 출력 형식
- JSON-LD: W3C 표준 호환
- JSON: 간단한 자체 형식

## 통계
- 총 엔티티 수, 관계 수
- 도메인별 분포
- 신뢰도 분포
