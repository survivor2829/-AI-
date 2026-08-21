function formatMoney(amountFen) {
  const safeFen = Number.isFinite(amountFen) ? amountFen : 0;
  return `¥${(safeFen / 100).toFixed(2)}`;
}

function pad(number) {
  return String(number).padStart(2, '0');
}

function formatDateTime(date) {
  const value = date instanceof Date ? date : new Date(date);
  return [
    value.getFullYear(),
    '-',
    pad(value.getMonth() + 1),
    '-',
    pad(value.getDate()),
    ' ',
    pad(value.getHours()),
    ':',
    pad(value.getMinutes()),
    ':',
    pad(value.getSeconds()),
  ].join('');
}

module.exports = {
  formatMoney,
  formatDateTime,
};
