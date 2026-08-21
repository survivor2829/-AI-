const { DEMO_DELAYS } = require('../config/demo-data');
const { getBillById } = require('./business-service');
const { formatDateTime } = require('../utils/format');

const completedPayments = new Map();

function createReceipt(bill) {
  const paidAt = new Date();
  const suffix = String(paidAt.getTime()).slice(-10);

  return {
    id: `receipt-${suffix}`,
    receiptNo: `DEMO-RCPT-${suffix}`,
    orderNo: `DEMO${suffix}`,
    billId: bill.id,
    houseId: bill.houseId,
    house: bill.house,
    period: bill.period,
    feeType: bill.feeType,
    amountFen: bill.amountFen,
    paymentMethod: '微信支付（模拟）',
    paidAt: formatDateTime(paidAt),
    status: 'SUCCESS',
  };
}

function simulatePayment(billId, options = {}) {
  const delayMs = Number.isFinite(options.delayMs)
    ? options.delayMs
    : DEMO_DELAYS.paymentMs;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (completedPayments.has(billId)) {
        resolve(Object.assign({}, completedPayments.get(billId)));
        return;
      }

      const bill = getBillById(billId);
      if (!bill) {
        reject(new Error('BILL_NOT_FOUND'));
        return;
      }

      const receipt = createReceipt(bill);
      completedPayments.set(billId, receipt);
      resolve(Object.assign({}, receipt));
    }, delayMs);
  });
}

module.exports = {
  simulatePayment,
};
