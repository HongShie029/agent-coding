// Mission 4 — 주문 취소와 환불 (SRS: FR-ORD-04, FR-PAY-03, FR-STK-01 / US-10)
// 계약은 docs/API_CONTRACT.md 의 "4. 취소 · 환불" 을 읽는다.
const { AppError } = require("./errors");
const { copy, findOwnedOrder, restoreStock } = require("./util");
const { changeStatus } = require("./order");

const CANCELABLE = ["PENDING_PAYMENT", "PAID"];

// 취소 시도 한 번을 수행한다. 성공하면 { order } 를 돌려주고, 환불이 실패하면 REFUND_FAILED 를 던진다.
async function runCancel(ctx, order) {
  // 결제대기: PG 호출 없이 바로 취소하고 재고를 복원한다.
  if (order.status === "PENDING_PAYMENT") {
    const canceled = changeStatus(ctx, order.id, "CANCELED");
    restoreStock(ctx, order);
    return { order: canceled };
  }

  // 결제완료: 환불이 먼저이고, 환불이 성공했을 때만 상태와 재고를 바꾼다.
  // 환불 대상은 저장된 '성공한 결제 기록'이며, 금액도 그 기록에서 가져온다.
  const records = ctx.store.payments.get(order.id) || [];
  const payment = records.find((r) => r.status === "SUCCEEDED");
  if (!payment) {
    throw new AppError("INVALID_STATE", "환불할 결제 기록이 없습니다", { status: order.status });
  }

  // try/catch 는 PG 호출에만 둔다. 시간 초과(예외)는 실패와 같은 경로로 처리한다.
  let res;
  try {
    res = await ctx.pg.refund({ txId: payment.txId, amount: payment.amount });
  } catch (err) {
    res = { ok: false, reason: "PG_ERROR" };
  }

  const at = ctx.clock.now().toISOString();

  if (res && res.ok === true) {
    // 아래 세 가지 변경은 await 없이 한 덩어리로 실행한다.
    payment.status = "REFUNDED";
    payment.refund = { status: "SUCCEEDED", refundId: res.refundId, at };
    const canceled = changeStatus(ctx, order.id, "CANCELED");
    restoreStock(ctx, order);
    return { order: canceled };
  }

  // 환불 실패: 결제 기록에 실패만 남기고 주문 상태 · 결제 status · 재고는 그대로 둔다. (나중에 다시 취소 가능)
  const reason = (res && res.reason) || "UNKNOWN";
  payment.refund = { status: "FAILED", reason, at };
  throw new AppError("REFUND_FAILED", "환불에 실패했습니다", { reason });
}

// 본인의 주문을 취소한다. 성공하면 { order } 를 돌려준다.
async function cancelOrder(ctx, userId, orderId) {
  // 주의: 이 함수는 첫 await 전까지 동기로 실행된다. 아래 inflight 확인과 등록 사이에 await 를 넣지 않는다.

  // 1) 본인의 주문이 아니면 없는 주문과 똑같이 NOT_FOUND
  const order = findOwnedOrder(ctx, userId, orderId);

  // 2) 같은 주문의 취소가 이미 진행 중이면 새로 시작하지 않고 그 결과를 같이 기다린다. (환불 · 재고 복원은 한 번)
  //    상태 검사보다 먼저 하는 이유: 결제대기 취소는 즉시 CANCELED 가 되어, 동시에 온 요청이 공유 대신 INVALID_STATE 를 받게 되기 때문이다.
  const key = `cancel:${orderId}`;
  const running = ctx.store.inflight.get(key);
  if (running) {
    const shared = await running;
    return { order: copy(shared.order) };
  }

  // 3) 취소할 수 있는 상태는 PENDING_PAYMENT, PAID 뿐. 그 밖(이미 취소 포함)은 거부하며 환불 · 재고에 아무 일도 없다.
  if (!CANCELABLE.includes(order.status)) {
    throw new AppError("INVALID_STATE", "취소할 수 없는 주문 상태입니다", { status: order.status });
  }

  // 4) 새 취소 시도를 시작하고 inflight 에 등록한다. 끝나면(성공 · 실패 모두) 반드시 지운다.
  const attempt = (async () => {
    try {
      return await runCancel(ctx, order);
    } finally {
      ctx.store.inflight.delete(key);
    }
  })();
  ctx.store.inflight.set(key, attempt);

  const result = await attempt;
  return { order: copy(result.order) };
}

module.exports = { cancelOrder };