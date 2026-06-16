# 지식 DB 검색

지식 DB에서 키워드로 노트와 엔티티를 검색합니다.

## 실행 절차
1. 인자로 받은 검색어를 GET /api/search 엔드포인트로 전송합니다:
   ```bash
   curl -s "http://localhost:3001/api/search?q=검색어"
   ```
2. 관련 노트와 엔티티 목록을 정리하여 사용자에게 표시합니다
3. 엔티티의 관계 그래프도 함께 조회합니다:
   ```bash
   curl -s "http://localhost:3001/api/entities/ID"
   ```

## 서버가 실행 중이어야 합니다
```bash
node knowledge/src/server.js
```

$ARGUMENTS
