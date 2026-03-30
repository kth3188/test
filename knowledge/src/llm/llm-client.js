const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

/**
 * Claude API 클라이언트 가져오기
 */
function getClient() {
  if (_client) return _client;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('ANTHROPIC_API_KEY가 설정되지 않았습니다. LLM 기능이 비활성화됩니다.');
    return null;
  }

  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Claude API 호출 (범용)
 * @param {string} systemPrompt - 시스템 프롬프트
 * @param {string} userMessage - 사용자 메시지
 * @param {object} options - 추가 옵션
 * @returns {string} 응답 텍스트
 */
async function chat(systemPrompt, userMessage, options = {}) {
  const client = getClient();
  if (!client) {
    return null;
  }

  const {
    model = 'claude-sonnet-4-6',
    maxTokens = 4096,
    temperature = 0.3,
  } = options;

  try {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // 응답 구조 검증
    if (!response.content || !Array.isArray(response.content) || response.content.length === 0) {
      console.error('LLM 응답 구조 이상:', JSON.stringify(response).slice(0, 200));
      return null;
    }

    const textBlock = response.content.find(c => c.type === 'text');
    return textBlock ? textBlock.text : null;
  } catch (err) {
    if (err.status === 429) {
      console.warn('LLM API 속도 제한. 10초 후 재시도...');
      await new Promise(r => setTimeout(r, 10000));
      return chat(systemPrompt, userMessage, options);
    }
    console.error('LLM API 호출 실패:', err.message);
    return null;
  }
}

/**
 * JSON 응답을 기대하는 LLM 호출
 */
async function chatJson(systemPrompt, userMessage, options = {}) {
  const text = await chat(systemPrompt, userMessage, options);
  if (!text) return null;

  // 1. JSON 코드블록에서 추출 시도
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (e) {
      console.error('JSON 코드블록 파싱 실패:', e.message, '원문:', codeBlockMatch[1].slice(0, 200));
    }
  }

  // 2. 첫 번째 유효한 JSON 객체/배열 추출 (비탐욕적)
  const jsonPatterns = [
    /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/,  // 중첩 1단계 객체
    /\[[\s\S]*?\]/,                       // 배열
  ];

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        // 다음 패턴 시도
      }
    }
  }

  // 3. 전체 텍스트가 JSON인지 시도
  try {
    return JSON.parse(text.trim());
  } catch (e) {
    console.error('JSON 추출 실패. LLM 응답:', text.slice(0, 300));
    return null;
  }
}

module.exports = { getClient, chat, chatJson };
