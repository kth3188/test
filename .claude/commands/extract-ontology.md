# 온톨로지 추출

개인 지식 DB에서 온톨로지를 JSON-LD 형식으로 추출합니다.

## 실행 절차
1. POST /api/sync/export 엔드포인트를 호출합니다:
   ```bash
   curl -s -X POST http://localhost:3001/api/sync/export \
     -H "Content-Type: application/json" \
     -d '{"format": "jsonld"}'
   ```
2. 통계를 조회합니다:
   ```bash
   curl -s http://localhost:3001/api/stats
   ```
3. 결과를 사용자에게 요약하여 표시합니다

$ARGUMENTS
