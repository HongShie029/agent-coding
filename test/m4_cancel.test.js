// Mission 4 공개 테스트 — 주문 취소와 환불 (US-10)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { cancelOrder } = require("../src/cancel");
const { changeStatus } = require("../src/order");

test("US-10 정상: '결제완료' 주문을 취소하면 '취소'가 되고 환불이 요청되며 재고가 복원된다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { status: "PAID", items: [["P1", 2]] });
  assert.equal(ctx.store.products.get("P1").stock, 8);
  const result = await cancelOrder(ctx, "u1", order.id);
  assert.equal(result.order.status, "CANCELED");
  assert.equal(ctx.pg.refunds.length, 1);
  assert.equal(ctx.pg.refunds[0].amount, 30000);
  assert.match(ctx.pg.refunds[0].txId, /^TX-SEED/);
  const [pay] = ctx.store.payments.get(order.id);
  assert.equal(pay.status, "REFUNDED");
  assert.equal(pay.refund.status, "SUCCEEDED");
  assert.match(pay.refund.refundId, /^RF-/);
  assert.equal(ctx.store.products.get("P1").stock, 10);
});

test("US-10 정상: '결제대기' 주문을 취소하면 환불 요청 없이 '취소'가 되고 재고가 복원된다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { status: "PENDING_PAYMENT", items: [["P2", 1]] });
  const result = await cancelOrder(ctx, "u1", order.id);
  assert.equal(result.order.status, "CANCELED");
  assert.equal(ctx.pg.refunds.length, 0);
  assert.equal(ctx.store.products.get("P2").stock, 3);
});

test("US-10 예외: '배송준비' 이후 주문은 취소할 수 없고 재고 · 결제는 변하지 않는다", async () => {
  for (const status of ["PREPARING", "SHIPPING", "DELIVERED"]) {
    const ctx = createContext();
    const order = seedOrder(ctx, { status, items: [["P1", 1]] });
    await assert.rejects(cancelOrder(ctx, "u1", order.id), (e) => e.code === "INVALID_STATE", status);
    assert.equal(ctx.pg.refunds.length, 0);
    assert.equal(ctx.store.products.get("P1").stock, 9);
    assert.equal(ctx.store.orders.get(order.id).status, status);
  }
});

test("US-10 예외: PG 환불이 실패하면 오류가 기록되고 주문은 '결제완료'로 남으며 재고는 복원되지 않는다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { status: "PAID", items: [["P1", 2]] });
  ctx.pg.failNextRefund("REFUND_REJECTED");
  await assert.rejects(cancelOrder(ctx, "u1", order.id), (e) => e.code === "REFUND_FAILED" && e.details.reason === "REFUND_REJECTED");
  const [pay] = ctx.store.payments.get(order.id);
  assert.equal(pay.refund.status, "FAILED");
  assert.equal(pay.refund.reason, "REFUND_REJECTED");
  assert.equal(ctx.store.orders.get(order.id).status, "PAID");
  assert.equal(ctx.store.products.get("P1").stock, 8);
});

test("환불 실패 뒤 다시 취소하면 성공할 수 있다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { status: "PAID", items: [["P1", 2]] });
  ctx.pg.failNextRefund();
  await assert.rejects(cancelOrder(ctx, "u1", order.id));
  const result = await cancelOrder(ctx, "u1", order.id);
  assert.equal(result.order.status, "CANCELED");
  assert.equal(ctx.store.products.get("P1").stock, 10);
});

test("남의 주문은 취소할 수 없다 (NOT_FOUND)", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { userId: "u1", status: "PAID" });
  await assert.rejects(cancelOrder(ctx, "u2", order.id), (e) => e.code === "NOT_FOUND");
  assert.equal(ctx.pg.refunds.length, 0);
});
