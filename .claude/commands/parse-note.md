# 마크다운 노트 파싱

사용자가 지정한 마크다운 파일을 읽어 지식 DB에 파싱하여 저장합니다.

## 실행 절차
1. 인자로 받은 파일 경로에서 마크다운 내용을 읽습니다 (없으면 knowledge/notes/ 에서 가장 최근 파일)
2. 읽은 마크다운 내용을 POST /api/notes 엔드포인트로 전송합니다:
   ```bash
   curl -s -X POST http://localhost:3001/api/notes \
     -H "Content-Type: application/json" \
     -d "{\"content\": \"$(cat 파일경로)\"}"
   ```
3. 응답에서 추출된 엔티티 수, 관계 수를 사용자에게 보고합니다
4. 미해결 질문이 생성되었으면 함께 표시합니다

## 서버가 실행 중이어야 합니다
```bash
node knowledge/src/server.js
```

$ARGUMENTS
