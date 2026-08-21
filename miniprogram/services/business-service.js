const { BILLS, CURRENT_HOUSE, DEMO_DELAYS } = require('../config/demo-data');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeBill(source) {
  const items = source.items.map((item) => Object.assign({}, item));
  const amountFen = items.reduce((total, item) => total + item.amountFen, 0);

  return Object.assign({}, source, {
    amountFen,
    house: clone(CURRENT_HOUSE),
    items,
  });
}

function getBillById(billId) {
  const source = BILLS.find((bill) => bill.id === billId);
  return source ? normalizeBill(source) : null;
}

function queryCurrentBill(houseId, options = {}) {
  const delayMs = Number.isFinite(options.delayMs)
    ? options.delayMs
    : DEMO_DELAYS.businessMs;

  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const source = BILLS.find(
        (bill) => bill.houseId === houseId && bill.status === 'UNPAID',
      );

      if (!source) {
        reject(new Error('NO_UNPAID_BILL'));
        return;
      }

      resolve(normalizeBill(source));
    }, delayMs);
  });
}

module.exports = {
  getBillById,
  queryCurrentBill,
};
