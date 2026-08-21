const { DEMO_DELAYS } = require('../config/demo-data');

const ALLOWED_INTENTS = new Set([
  'QUERY_ARREARS',
  'OPEN_SERVICES',
  'SMALL_TALK',
  'UNSUPPORTED',
]);

function localInterpret(text) {
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
      reply: '这项能力已放入一期服务范围，本轮 Demo 先展示入口；您也可以先体验对话查欠费和模拟缴费。',
      source: 'demo-fallback',
    };
  }

  return {
    intent: 'SMALL_TALK',
    slots: {},
    reply: '我可以帮您查欠费、了解装修进度和交房准备，也可以从“全部服务”直接办理。',
    source: 'demo-fallback',
  };
}

function normalizeResult(raw) {
  if (!raw || !ALLOWED_INTENTS.has(raw.intent)) {
    return null;
  }

  const slots = {};
  if (raw.slots && typeof raw.slots.houseId === 'string') {
    slots.houseId = raw.slots.houseId.slice(0, 80);
  }

  return {
    intent: raw.intent,
    slots,
    reply: typeof raw.reply === 'string' && raw.reply.trim()
      ? raw.reply.trim().slice(0, 240)
      : '好的，我来帮您处理。',
    source: raw.source === 'model' ? 'model' : 'demo-fallback',
  };
}

function callCloudFunction(text, context, timeoutMs) {
  return new Promise((resolve, reject) => {
    if (typeof wx === 'undefined' || !wx.cloud || !wx.cloud.callFunction) {
      reject(new Error('CLOUD_UNAVAILABLE'));
      return;
    }

    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error('AI_TIMEOUT'));
      }
    }, timeoutMs);

    wx.cloud.callFunction({
      name: 'aiGateway',
      data: { text, context },
    }).then(({ result }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    }).catch((error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function interpretMessage(text, context = {}, options = {}) {
  if (options.forceFallback) {
    return localInterpret(text);
  }

  try {
    const raw = await callCloudFunction(
      text,
      context,
      options.timeoutMs || DEMO_DELAYS.aiTimeoutMs,
    );
    return normalizeResult(raw) || localInterpret(text);
  } catch (error) {
    return localInterpret(text);
  }
}

module.exports = {
  interpretMessage,
};
