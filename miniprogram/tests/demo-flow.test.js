const test = require('node:test');
const assert = require('node:assert/strict');

const {
  EVENTS,
  FLOW_STATES,
  SHEET_STATES,
  createInitialUiState,
  transitionUi,
} = require('../utils/flow-state');
const { queryCurrentBill } = require('../services/business-service');
const { simulatePayment } = require('../services/payment-service');
const { interpretMessage } = require('../services/ai-service');
const { CURRENT_HOUSE } = require('../config/demo-data');
const aiGateway = require('../../cloudfunctions/aiGateway/index');

test('service drawer transitions never overwrite the active transaction flow', () => {
  let state = createInitialUiState();
  assert.deepEqual(state, {
    flowState: FLOW_STATES.DISCOVERY,
    sheetState: SHEET_STATES.HALF,
    conversationStarted: false,
  });

  state = transitionUi(state, EVENTS.START_INTERACTION);
  state = transitionUi(state, EVENTS.BILL_READY);
  assert.equal(state.flowState, FLOW_STATES.BILL_READY);
  assert.equal(state.sheetState, SHEET_STATES.COLLAPSED);

  state = transitionUi(state, EVENTS.OPEN_SERVICES);
  assert.equal(state.sheetState, SHEET_STATES.FULL);
  assert.equal(state.flowState, FLOW_STATES.BILL_READY);

  state = transitionUi(state, EVENTS.CLOSE_SERVICES);
  assert.equal(state.sheetState, SHEET_STATES.COLLAPSED);
  assert.equal(state.flowState, FLOW_STATES.BILL_READY);
});

test('manually closing services keeps the same blank conversation collapsed', () => {
  let state = createInitialUiState();

  state = transitionUi(state, EVENTS.OPEN_SERVICES);
  assert.equal(state.sheetState, SHEET_STATES.FULL);
  assert.equal(state.conversationStarted, false);

  state = transitionUi(state, EVENTS.CLOSE_SERVICES);
  assert.equal(state.sheetState, SHEET_STATES.COLLAPSED);
  assert.equal(state.conversationStarted, false);

  state = transitionUi(state, EVENTS.RESET);
  assert.equal(state.sheetState, SHEET_STATES.HALF);
});

test('bill and receipt amounts come from deterministic business data', async () => {
  const bill = await queryCurrentBill(CURRENT_HOUSE.id, { delayMs: 0 });
  assert.equal(bill.amountFen, 68000);

  const receipt = await simulatePayment(bill.id, { delayMs: 0 });
  assert.equal(receipt.amountFen, bill.amountFen);
  assert.equal(receipt.billId, bill.id);
  assert.equal(receipt.status, 'SUCCESS');
});

test('local AI fallback recognizes arrears intent without inventing money', async () => {
  const result = await interpretMessage(
    '帮我查一下物业欠费',
    { houseId: CURRENT_HOUSE.id },
    { forceFallback: true },
  );

  assert.equal(result.intent, 'QUERY_ARREARS');
  assert.equal(result.source, 'demo-fallback');
  assert.equal(JSON.stringify(result).includes('amount'), false);
});

test('cloud gateway degrades deterministically when model config is absent', async () => {
  const result = await aiGateway.main({ text: '我要查欠费', forceFallback: true });
  assert.equal(result.intent, 'QUERY_ARREARS');
  assert.equal(result.source, 'demo-fallback');
  assert.equal(JSON.stringify(result).includes('amount'), false);
});
