# 조직 온톨로지 동기화

개인 지식 DB와 조직 온톨로지 DB 간 양방향 동기화를 수행합니다.

## 실행 절차

### 내보내기 (개인 → 조직)
```bash
curl -s -X POST http://localhost:3001/api/sync/export \
  -H "Content-Type: application/json" \
  -d '{}'
```

### 가져오기 (조직 → 개인)
```bash
curl -s -X POST http://localhost:3001/api/sync/import \
  -H "Content-Type: application/json" \
  -d '{"entityName": "검색어"}'
```

### 양방향
내보내기를 먼저 실행한 후 가져오기를 실행합니다.

$ARGUMENTS
