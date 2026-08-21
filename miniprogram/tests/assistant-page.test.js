const test = require('node:test');
const assert = require('node:assert/strict');

let pageDefinition;

global.wx = {
  getWindowInfo() {
    return {
      statusBarHeight: 24,
      windowWidth: 390,
      screenHeight: 844,
      windowHeight: 844,
      safeArea: { bottom: 824 },
    };
  },
  getMenuButtonBoundingClientRect() {
    return { left: 303, right: 375, top: 28, bottom: 60, width: 72, height: 32 };
  },
  nextTick(callback) {
    callback();
  },
  showToast() {},
  showActionSheet() {},
};

global.Page = (definition) => {
  pageDefinition = definition;
};

require('../pages/assistant/index');

function mountPage() {
  const page = Object.assign({}, pageDefinition, {
    data: JSON.parse(JSON.stringify(pageDefinition.data)),
  });
  page.setData = (patch) => {
    Object.assign(page.data, patch);
  };
  page.onLoad();
  return page;
}

test('assistant page completes the demo payment flow and preserves flow under drawer changes', async () => {
  const page = mountPage();

  assert.equal(page.data.flowState, 'discovery');
  assert.equal(page.data.sheetState, 'half');
  assert.equal(page.data.headerTop, 28);
  assert.equal(page.data.headerRight, 79);
  assert.equal(page.data.halfSheetHeight, 304);

  await page._submitText('帮我查一下物业欠费');
  assert.equal(page.data.flowState, 'billReady');
  assert.equal(page.data.sheetState, 'collapsed');
  assert.equal(page.data.bill.amountFen, 68000);

  page.handleSheetStateChange({ detail: { state: 'full' } });
  assert.equal(page.data.sheetState, 'full');
  assert.equal(page.data.flowState, 'billReady');

  page.handleSheetClose();
  assert.equal(page.data.sheetState, 'collapsed');
  assert.equal(page.data.flowState, 'billReady');

  page.requestPaymentConfirmation();
  assert.equal(page.data.flowState, 'confirming');

  await page.confirmPayment();
  assert.equal(page.data.flowState, 'receipt');
  assert.equal(page.data.receipt.amountFen, 68000);
  assert.equal(page.data.receipt.status, 'SUCCESS');

  page.returnHome();
  assert.equal(page.data.flowState, 'discovery');
  assert.equal(page.data.sheetState, 'half');
  assert.equal(page.data.conversationStarted, false);
  assert.equal(page.data.messages.length, 0);
  assert.equal(page.data.bill, null);
  assert.equal(page.data.receipt, null);
});
