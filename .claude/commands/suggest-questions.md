# 탐구 질문 생성

현재 지식 DB를 분석하여 탐구할 질문을 LLM으로 생성합니다.
"실체적 진실" 추구 철학에 따라 지식의 빈틈을 찾습니다.

## 실행 절차
1. POST /api/questions/generate 엔드포인트를 호출합니다:
   ```bash
   curl -s -X POST http://localhost:3001/api/questions/generate \
     -H "Content-Type: application/json" \
     -d '{"limit": 5}'
   ```
2. 생성된 질문을 사용자에게 표시합니다
3. 기존 미해결 질문도 함께 조회합니다:
   ```bash
   curl -s "http://localhost:3001/api/questions"
   ```

## 참고: ANTHROPIC_API_KEY 환경변수가 필요합니다

$ARGUMENTS
