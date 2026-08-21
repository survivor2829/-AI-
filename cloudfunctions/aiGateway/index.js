const http = require('http');
const https = require('https');

const ALLOWED_INTENTS = new Set([
  'QUERY_ARREARS',
  'OPEN_SERVICES',
  'SMALL_TALK',
  'UNSUPPORTED',
]);

function fallback(text) {
  const value = String(text || '').trim();

  if (/欠费|物业费|缴费|账单/.test(value)) {
    return {
      intent: 'QUERY_ARREARS',
      slots: {},
      reply: '好的，我来查询当前房屋的待缴物业账单。',
      source: 'demo-fallback',
    };
  }

  if (/全部服务|能做什么|服务列表|办事大厅/.test(value)) {
    return {
      intent: 'OPEN_SERVICES',
      slots: {},
      reply: '可以，已为您打开全部物业服务。',
      source: 'demo-fallback',
    };
  }

  if (/装修|交房|搬家|停车|人工/.test(value)) {
    return {
      intent: 'UNSUPPORTED',
      slots: {},
      reply: '这项服务已纳入一期能力，本轮 Demo 先展示服务入口。',
      source: 'demo-fallback',
    };
  }

  return {
    intent: 'SMALL_TALK',
    slots: {},
    reply: '我可以帮您查欠费，也可以打开全部物业服务。',
    source: 'demo-fallback',
  };
}

function endpointFromBaseUrl(baseUrl) {
  const trimmed = baseUrl.replace(/\/$/, '');
  return trimmed.endsWith('/chat/completions')
    ? trimmed
    : `${trimmed}/chat/completions`;
}

function requestJson(urlString, apiKey, payload, timeoutMs) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'http:' ? http : https;
    const body = JSON.stringify(payload);
    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: timeoutMs,
    }, (response) => {
      const chunks = [];
      let size = 0;

      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
          request.destroy(new Error('MODEL_RESPONSE_TOO_LARGE'));
          return;
        }
        chunks.push(chunk);
      });

      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`MODEL_HTTP_${response.statusCode}`));
          return;
        }

        try {
          resolve(JSON.parse(raw));
        } catch (error) {
          reject(new Error('MODEL_INVALID_JSON'));
        }
      });
    });

    request.on('timeout', () => request.destroy(new Error('MODEL_TIMEOUT')));
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function parseAssistantJson(content) {
  const text = typeof content === 'string'
    ? content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : '';
  const value = JSON.parse(text);

  if (!value || !ALLOWED_INTENTS.has(value.intent)) {
    throw new Error('MODEL_INVALID_INTENT');
  }

  const slots = {};
  if (value.slots && typeof value.slots.houseId === 'string') {
    slots.houseId = value.slots.houseId.slice(0, 80);
  }

  return {
    intent: value.intent,
    slots,
    reply: typeof value.reply === 'string' && value.reply.trim()
      ? value.reply.trim().slice(0, 240)
      : '好的，我来帮您处理。',
    source: 'model',
  };
}

async function callModel(text, context) {
  const baseUrl = process.env.MODEL_BASE_URL;
  const apiKey = process.env.MODEL_API_KEY;
  const model = process.env.MODEL_NAME;

  if (!baseUrl || !apiKey || !model) {
    throw new Error('MODEL_NOT_CONFIGURED');
  }

  const response = await requestJson(
    endpointFromBaseUrl(baseUrl),
    apiKey,
    {
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: [
            '你是物业办事意图识别器。只返回一个 JSON 对象，不要 Markdown。',
            '字段仅允许 intent、slots、reply。',
            'intent 只能是 QUERY_ARREARS、OPEN_SERVICES、SMALL_TALK、UNSUPPORTED。',
            '不要生成、猜测或复述任何账单金额、订单号、支付结果。',
            'QUERY_ARREARS 用于查欠费、物业费、账单或缴费诉求。',
            'OPEN_SERVICES 用于用户要求查看全部服务。',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            text,
            houseId: context && typeof context.houseId === 'string'
              ? context.houseId
              : undefined,
          }),
        },
      ],
    },
    8000,
  );

  const content = response
    && response.choices
    && response.choices[0]
    && response.choices[0].message
    && response.choices[0].message.content;

  return parseAssistantJson(content);
}

exports.main = async (event = {}) => {
  const text = typeof event.text === 'string' ? event.text.trim().slice(0, 500) : '';
  if (!text) {
    return {
      intent: 'UNSUPPORTED',
      slots: {},
      reply: '请告诉我您想办理什么。',
      source: 'demo-fallback',
    };
  }

  if (event.forceFallback) {
    return fallback(text);
  }

  try {
    return await callModel(text, event.context || {});
  } catch (error) {
    return fallback(text);
  }
};
