const {
  BRAND,
  CURRENT_HOUSE,
  QUICK_INTENTS,
  FEATURED_SERVICES,
  SERVICE_GROUPS,
  DEMO_DELAYS,
} = require('../../config/demo-data');
const { interpretMessage } = require('../../services/ai-service');
const { queryCurrentBill } = require('../../services/business-service');
const { simulatePayment } = require('../../services/payment-service');
const { formatMoney } = require('../../utils/format');
const {
  EVENTS,
  FLOW_STATES,
  SHEET_STATES,
  createInitialUiState,
  transitionUi,
} = require('../../utils/flow-state');

function billForView(bill) {
  return Object.assign({}, bill, {
    amountText: formatMoney(bill.amountFen),
    items: bill.items.map((item) => Object.assign({}, item, {
      amountText: formatMoney(item.amountFen),
    })),
  });
}

function receiptForView(receipt) {
  return Object.assign({}, receipt, {
    amountText: formatMoney(receipt.amountFen),
  });
}

Page({
  data: Object.assign(createInitialUiState(), {
    brand: BRAND,
    house: CURRENT_HOUSE,
    houseLabel: `${CURRENT_HOUSE.community} · ${CURRENT_HOUSE.address}`,
    quickIntents: QUICK_INTENTS,
    featuredServices: FEATURED_SERVICES,
    serviceGroups: SERVICE_GROUPS,
    statusBarHeight: 24,
    headerTop: 28,
    headerRight: 0,
    contentTop: 122,
    safeBottom: 0,
    halfSheetHeight: 304,
    chatBottom: 154,
    inputValue: '',
    voiceState: 'idle',
    messages: [],
    bill: null,
    receipt: null,
    isBusy: false,
    statusText: '',
    detailVisible: false,
    scrollIntoView: '',
  }),

  onLoad() {
    this._messageSequence = 0;
    this._requestSequence = 0;
    this._voiceTimers = [];

    let windowInfo = {};
    try {
      windowInfo = wx.getWindowInfo
        ? wx.getWindowInfo()
        : wx.getSystemInfoSync();
    } catch (error) {
      windowInfo = {};
    }

    const statusBarHeight = windowInfo.statusBarHeight || 24;
    const windowWidth = windowInfo.windowWidth || windowInfo.screenWidth || 375;
    const windowHeight = windowInfo.windowHeight || windowInfo.screenHeight || 844;
    const screenHeight = windowInfo.screenHeight || windowInfo.windowHeight || 844;
    const safeAreaBottom = windowInfo.safeArea && windowInfo.safeArea.bottom
      ? windowInfo.safeArea.bottom
      : screenHeight;
    const safeBottom = Math.max(0, screenHeight - safeAreaBottom);
    let headerTop = statusBarHeight + 4;
    let headerRight = 0;

    try {
      const menuButton = wx.getMenuButtonBoundingClientRect
        ? wx.getMenuButtonBoundingClientRect()
        : null;
      if (menuButton && menuButton.left > 0 && menuButton.left < windowWidth) {
        const pageSidePadding = 16;
        headerTop = menuButton.top || headerTop;
        headerRight = Math.max(0, windowWidth - menuButton.left + 8 - pageSidePadding);
      }
    } catch (error) {
      // 非微信环境或游客模式取不到胶囊位置时，使用安全默认间距。
    }

    const rpx = windowWidth / 750;
    const halfSheetHeight = Math.round(Math.min(
      Math.max(windowHeight * 0.36, 520 * rpx),
      640 * rpx,
    ));

    this.setData({
      statusBarHeight,
      headerTop,
      headerRight,
      contentTop: statusBarHeight + 98,
      safeBottom,
      halfSheetHeight,
      chatBottom: safeBottom + 154,
    });
  },

  onReady() {
    if (!wx.createSelectorQuery) return;

    wx.nextTick(() => {
      wx.createSelectorQuery()
        .select('.app-header')
        .boundingClientRect((rect) => {
          if (rect && rect.bottom > 0 && Math.abs(rect.bottom - this.data.contentTop) > 1) {
            this.setData({ contentTop: Math.ceil(rect.bottom) });
          }
        })
        .exec();
    });
  },

  onUnload() {
    this._requestSequence += 1;
    this._clearVoiceTimers();
  },

  _currentUiState() {
    return {
      flowState: this.data.flowState,
      sheetState: this.data.sheetState,
      conversationStarted: this.data.conversationStarted,
    };
  },

  _applyTransition(event, patch = {}) {
    const next = transitionUi(this._currentUiState(), event);
    this.setData(Object.assign({}, next, patch));
  },

  _appendMessage(role, text) {
    const message = {
      id: `message-${Date.now()}-${this._messageSequence += 1}`,
      role,
      text,
    };
    this.setData({
      messages: this.data.messages.concat(message),
    });
    this._scrollToBottom();
  },

  _scrollToBottom() {
    this.setData({ scrollIntoView: '' });
    wx.nextTick(() => {
      this.setData({ scrollIntoView: 'chat-bottom' });
    });
  },

  _clearVoiceTimers() {
    (this._voiceTimers || []).forEach((timer) => clearTimeout(timer));
    this._voiceTimers = [];
  },

  async _submitText(rawText) {
    const text = String(rawText || '').trim();
    if (!text || this.data.isBusy) return;

    const requestId = this._requestSequence += 1;
    this._applyTransition(EVENTS.START_INTERACTION, {
      inputValue: '',
      isBusy: true,
      statusText: '正在理解您的需求…',
    });
    this._appendMessage('user', text);

    try {
      const result = await interpretMessage(text, {
        houseId: CURRENT_HOUSE.id,
      });
      if (requestId !== this._requestSequence) return;

      this._appendMessage('assistant', result.reply);

      if (result.intent === 'OPEN_SERVICES') {
        this._applyTransition(EVENTS.CHAT_READY, {
          isBusy: false,
          statusText: '',
        });
        this._applyTransition(EVENTS.OPEN_SERVICES);
        return;
      }

      if (result.intent !== 'QUERY_ARREARS') {
        this._applyTransition(EVENTS.CHAT_READY, {
          isBusy: false,
          statusText: '',
        });
        return;
      }

      this.setData({ statusText: '正在查询物业账单…' });
      const bill = await queryCurrentBill(CURRENT_HOUSE.id);
      if (requestId !== this._requestSequence) return;

      this._appendMessage('assistant', '已为您查到 1 笔待缴账单，请核对房屋、账期和金额。');
      this._applyTransition(EVENTS.BILL_READY, {
        bill: billForView(bill),
        receipt: null,
        isBusy: false,
        statusText: '',
      });
      this._scrollToBottom();
    } catch (error) {
      if (requestId !== this._requestSequence) return;
      this._appendMessage('assistant', '暂时没有查询成功，请稍后再试，或从“全部服务”进入缴费中心。');
      this._applyTransition(EVENTS.FAIL, {
        isBusy: false,
        statusText: '',
      });
    }
  },

  handleInputChange(event) {
    this.setData({ inputValue: event.detail.value });
  },

  handleComposerFocus() {
    if (this.data.sheetState !== SHEET_STATES.COLLAPSED) {
      this.setData({ sheetState: SHEET_STATES.COLLAPSED });
    }
  },

  handleSubmit(event) {
    this._submitText(event.detail.value);
  },

  handleQuickIntent(event) {
    this._submitText(event.currentTarget.dataset.prompt);
  },

  handleVoice() {
    if (this.data.isBusy || this.data.voiceState !== 'idle') return;

    this._clearVoiceTimers();
    this.setData({
      voiceState: 'recording',
      sheetState: SHEET_STATES.COLLAPSED,
    });
    wx.showToast({ title: '模拟录音中', icon: 'none', duration: 600 });

    this._voiceTimers.push(setTimeout(() => {
      this.setData({ voiceState: 'recognizing' });
    }, Math.floor(DEMO_DELAYS.voiceMs / 2)));

    this._voiceTimers.push(setTimeout(() => {
      const recognizedText = '帮我查一下物业欠费';
      this.setData({
        voiceState: 'idle',
        inputValue: recognizedText,
      });
      this._submitText(recognizedText);
    }, DEMO_DELAYS.voiceMs));
  },

  handleSheetStateChange(event) {
    const { state } = event.detail;
    if (state === SHEET_STATES.FULL || state === SHEET_STATES.COLLAPSED) {
      this.setData({ sheetState: state });
    }
  },

  handleSheetClose() {
    this._applyTransition(EVENTS.CLOSE_SERVICES);
  },

  handleServiceSelect(event) {
    const item = event.detail.item;
    if (!item) return;

    this.setData({ sheetState: SHEET_STATES.COLLAPSED });

    if (item.id === 'arrears' || item.id === 'property-payment') {
      this._submitText(item.prompt);
      return;
    }

    this._applyTransition(EVENTS.START_INTERACTION, {
      inputValue: '',
      isBusy: false,
      statusText: '',
    });
    this._appendMessage('user', item.prompt);
    this._appendMessage(
      'assistant',
      `“${item.title}”已纳入一期能力。本轮 Demo 先展示服务入口，您可以继续体验查欠费和模拟缴费。`,
    );
    this._applyTransition(EVENTS.CHAT_READY);
  },

  requestPaymentConfirmation() {
    if (!this.data.bill || this.data.receipt || this.data.isBusy) return;
    this._applyTransition(EVENTS.REQUEST_CONFIRMATION);
  },

  cancelPaymentConfirmation() {
    if (this.data.flowState === FLOW_STATES.CONFIRMING) {
      this._applyTransition(EVENTS.CANCEL_CONFIRMATION);
    }
  },

  async confirmPayment() {
    if (!this.data.bill || this.data.flowState !== FLOW_STATES.CONFIRMING) return;

    this._applyTransition(EVENTS.PAYMENT_START, {
      isBusy: true,
      statusText: '正在完成模拟支付…',
    });

    try {
      const receipt = await simulatePayment(this.data.bill.id);
      this._appendMessage('assistant', '模拟支付已完成，电子回执已生成。');
      this._applyTransition(EVENTS.PAYMENT_SUCCESS, {
        receipt: receiptForView(receipt),
        isBusy: false,
        statusText: '',
      });
      this._scrollToBottom();
    } catch (error) {
      this._appendMessage('assistant', '模拟支付没有完成，请重新确认。');
      this._applyTransition(EVENTS.FAIL, {
        isBusy: false,
        statusText: '',
      });
    }
  },

  showBillDetails() {
    if (this.data.bill) {
      this.setData({ detailVisible: true });
    }
  },

  hideBillDetails() {
    this.setData({ detailVisible: false });
  },

  showReceiptNotice() {
    wx.showToast({
      title: 'Demo 回执已生成',
      icon: 'success',
    });
  },

  showHouseNotice() {
    wx.showToast({
      title: '当前为演示房屋',
      icon: 'none',
    });
  },

  openConversationMenu() {
    wx.showActionSheet({
      itemList: ['新建会话'],
      success: ({ tapIndex }) => {
        if (tapIndex === 0) this.resetConversation();
      },
    });
  },

  returnHome() {
    this.resetConversation();
  },

  resetConversation() {
    this._requestSequence += 1;
    this._clearVoiceTimers();
    const initial = createInitialUiState();
    this.setData(Object.assign({}, initial, {
      inputValue: '',
      voiceState: 'idle',
      messages: [],
      bill: null,
      receipt: null,
      isBusy: false,
      statusText: '',
      detailVisible: false,
      scrollIntoView: '',
    }));
  },

  noop() {},
});
