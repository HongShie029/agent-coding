// Mission 4 — 주문 취소와 환불 (SRS: FR-ORD-04, FR-PAY-03, FR-STK-01 / US-10)
// 계약은 docs/API_CONTRACT.md 의 "4. 취소 · 환불" 을 읽는다.
const { AppError } = require("./errors");
const { findOwnedOrder, restoreStock } = require("./util");
const { changeStatus } = require("./order");

// 본인의 주문을 취소한다. 성공하면 { order } 를 돌려준다.
async function cancelOrder(ctx, userId, orderId) {
  throw new Error("NOT_IMPLEMENTED: cancelOrder");
}

module.exports = { cancelOrder };
