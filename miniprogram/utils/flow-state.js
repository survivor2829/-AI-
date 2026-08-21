const FLOW_STATES = Object.freeze({
  DISCOVERY: 'discovery',
  INTERPRETING: 'interpreting',
  CHATTING: 'chatting',
  BILL_READY: 'billReady',
  CONFIRMING: 'confirming',
  PAYING: 'paying',
  RECEIPT: 'receipt',
  ERROR: 'error',
});

const SHEET_STATES = Object.freeze({
  HALF: 'half',
  COLLAPSED: 'collapsed',
  FULL: 'full',
});

const EVENTS = Object.freeze({
  RESET: 'RESET',
  START_INTERACTION: 'START_INTERACTION',
  CHAT_READY: 'CHAT_READY',
  BILL_READY: 'BILL_READY',
  REQUEST_CONFIRMATION: 'REQUEST_CONFIRMATION',
  CANCEL_CONFIRMATION: 'CANCEL_CONFIRMATION',
  PAYMENT_START: 'PAYMENT_START',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  FAIL: 'FAIL',
  OPEN_SERVICES: 'OPEN_SERVICES',
  CLOSE_SERVICES: 'CLOSE_SERVICES',
});

function createInitialUiState() {
  return {
    flowState: FLOW_STATES.DISCOVERY,
    sheetState: SHEET_STATES.HALF,
    conversationStarted: false,
  };
}

function transitionUi(current, event) {
  const state = Object.assign({}, current);

  switch (event) {
    case EVENTS.RESET:
      return createInitialUiState();
    case EVENTS.START_INTERACTION:
      return Object.assign(state, {
        flowState: FLOW_STATES.INTERPRETING,
        sheetState: SHEET_STATES.COLLAPSED,
        conversationStarted: true,
      });
    case EVENTS.CHAT_READY:
      state.flowState = FLOW_STATES.CHATTING;
      return state;
    case EVENTS.BILL_READY:
      state.flowState = FLOW_STATES.BILL_READY;
      return state;
    case EVENTS.REQUEST_CONFIRMATION:
      state.flowState = FLOW_STATES.CONFIRMING;
      return state;
    case EVENTS.CANCEL_CONFIRMATION:
      state.flowState = FLOW_STATES.BILL_READY;
      return state;
    case EVENTS.PAYMENT_START:
      state.flowState = FLOW_STATES.PAYING;
      return state;
    case EVENTS.PAYMENT_SUCCESS:
      state.flowState = FLOW_STATES.RECEIPT;
      return state;
    case EVENTS.FAIL:
      state.flowState = FLOW_STATES.ERROR;
      return state;
    case EVENTS.OPEN_SERVICES:
      state.sheetState = SHEET_STATES.FULL;
      return state;
    case EVENTS.CLOSE_SERVICES:
      state.sheetState = SHEET_STATES.COLLAPSED;
      return state;
    default:
      return state;
  }
}

module.exports = {
  EVENTS,
  FLOW_STATES,
  SHEET_STATES,
  createInitialUiState,
  transitionUi,
};
