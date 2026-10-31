// Mission 3 — 결제 (SRS: FR-PAY-01, FR-PAY-02, FR-PAY-05 / US-08)
// 계약은 docs/API_CONTRACT.md 의 "3. 결제" 를 읽는다. 외부 결제대행사는 ctx.pg (모의 PG) 로 호출한다.
const { AppError } = require("./errors");
const { copy, findOwnedOrder } = require("./util");
const { changeStatus } = require("./order");

// 본인의 '결제대기' 주문을 결제한다. 성공하면 { order, payment, alreadyPaid } 를 돌려준다.
async function payOrder(ctx, userId, orderId) {
  throw new Error("NOT_IMPLEMENTED: payOrder");
}

module.exports = { payOrder };
