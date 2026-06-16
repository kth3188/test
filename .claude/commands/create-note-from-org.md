# 조직 온톨로지에서 노트 생성

조직 온톨로지에서 특정 엔티티를 검색하여 개인용 마크다운 노트로 가져옵니다.

## 실행 절차
1. 인자로 받은 엔티티명으로 조직에서 가져오기를 실행합니다:
   ```bash
   curl -s -X POST http://localhost:3001/api/sync/import \
     -H "Content-Type: application/json" \
     -d '{"entityName": "엔티티명"}'
   ```
2. 생성된 노트를 확인합니다:
   ```bash
   curl -s http://localhost:3001/api/notes
   ```

$ARGUMENTS
