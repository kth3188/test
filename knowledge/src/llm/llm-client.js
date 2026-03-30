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

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  return response.content[0].text;
}

/**
 * JSON 응답을 기대하는 LLM 호출
 */
async function chatJson(systemPrompt, userMessage, options = {}) {
  const text = await chat(systemPrompt, userMessage, options);
  if (!text) return null;

  // JSON 블록 추출 (```json ... ``` 또는 순수 JSON)
  const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch (e) {
      console.error('JSON 파싱 실패:', e.message);
      return null;
    }
  }
  return null;
}

module.exports = { getClient, chat, chatJson };
