// Mission 3 — 결제 (SRS: FR-PAY-01, FR-PAY-02, FR-PAY-05 / US-08)
// 계약은 docs/API_CONTRACT.md 의 "3. 결제" 를 읽는다. 외부 결제대행사는 ctx.pg (모의 PG) 로 호출한다.
const { AppError } = require("./errors");
const { copy, findOwnedOrder } = require("./util");
const { changeStatus } = require("./order");

const pad4 = (n) => String(n).padStart(4, "0");

// 결제 시도 한 번을 수행한다. (PG 호출 + 기록 + 주문 상태 변경)
// 성공하면 { order, payment } 를 돌려주고, 실패하면 PAYMENT_FAILED 를 던진다.
async function runChargeAttempt(ctx, order) {
  // 결제 기록은 PG 호출 전에 PENDING 으로 먼저 남긴다. (시도마다 1건, attempt 는 1부터 증가)
  let records = ctx.store.payments.get(order.id);
  if (!records) {
    records = [];
    ctx.store.payments.set(order.id, records);
  }
  const attempt = records.length + 1;
  ctx.store.seq.payment += 1;

  // 결제 수단(카드번호 등) 관련 필드는 두지 않는다.
  const payment = {
    id: `PAY-${pad4(ctx.store.seq.payment)}`,
    orderId: order.id,
    amount: order.totalAmount, // 금액은 요청 인자가 아니라 서버가 가진 주문 금액
    status: "PENDING",
    attempt,
  };
  records.push(payment);

  // try/catch 는 PG 호출에만 둔다. 시간 초과(예외)는 실패와 같은 경로로 처리한다.
  let res;
  try {
    res = await ctx.pg.charge({
      orderId: order.id,
      amount: order.totalAmount,
      idempotencyKey: `${order.id}:${attempt}`, // 시도마다 서로 다른 키
    });
  } catch (err) {
    res = { ok: false, reason: "PG_ERROR" };
  }

  if (res && res.ok === true) {
    payment.status = "SUCCEEDED";
    payment.txId = res.txId;
    payment.paidAt = ctx.clock.now().toISOString();
    const paidOrder = changeStatus(ctx, order.id, "PAID"); // 상태 전이표를 거친다
    return { order: paidOrder, payment: copy(payment) };
  }

  // 실패(ok: false) 또는 시간 초과: 기록만 FAILED 로 남기고 주문은 PENDING_PAYMENT 로 유지한다.
  const reason = (res && res.reason) || "UNKNOWN";
  payment.status = "FAILED";
  payment.failureReason = reason;
  throw new AppError("PAYMENT_FAILED", "결제에 실패했습니다", { reason });
}

// 본인의 '결제대기' 주문을 결제한다. 성공하면 { order, payment, alreadyPaid } 를 돌려준다.
async function payOrder(ctx, userId, orderId) {
  // 주의: 이 함수는 첫 await 전까지 동기로 실행된다. 아래 inflight 확인과 등록 사이에 await 를 넣지 않는다.

  // 1) 본인의 주문이 아니면 없는 주문과 똑같이 NOT_FOUND (PG 호출 없음)
  const order = findOwnedOrder(ctx, userId, orderId);

  // 2) 이미 결제 성공 기록이 있으면 PG 에 다시 요청하지 않고 기존 결과를 돌려준다.
  const records = ctx.store.payments.get(orderId) || [];
  const succeeded = records.find((r) => r.status === "SUCCEEDED");
  if (succeeded) {
    return { order: copy(order), payment: copy(succeeded), alreadyPaid: true };
  }

  // 3) 결제대기가 아닌 주문(취소됨 등)은 결제 불가 (PG 호출 없음)
  if (order.status !== "PENDING_PAYMENT") {
    throw new AppError("INVALID_STATE", "결제할 수 없는 주문 상태입니다", { status: order.status });
  }

  // 4) 같은 주문의 결제가 이미 진행 중이면 새로 시작하지 않고 그 결과를 같이 기다린다.
  const key = `pay:${orderId}`;
  const running = ctx.store.inflight.get(key);
  if (running) {
    const shared = await running; // 실패하면 같은 PAYMENT_FAILED 가 그대로 전달된다
    return { order: copy(shared.order), payment: copy(shared.payment), alreadyPaid: false };
  }

  // 5) 새 결제 시도를 시작하고 inflight 에 등록한다. 성공 · 실패 모두 끝나면 반드시 지운다(재결제를 위해).
  const attempt = (async () => {
    try {
      return await runChargeAttempt(ctx, order);
    } finally {
      ctx.store.inflight.delete(key);
    }
  })();
  ctx.store.inflight.set(key, attempt);

  const result = await attempt;
  return { order: copy(result.order), payment: copy(result.payment), alreadyPaid: false };
}

module.exports = { payOrder };