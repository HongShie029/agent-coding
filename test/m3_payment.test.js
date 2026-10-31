// Mission 3 공개 테스트 — 결제 (US-08)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { payOrder } = require("../src/payment");

test("US-08 정상: 결제에 성공하면 주문이 '결제완료'가 되고 결제 내역이 기록된다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { items: [["P1", 2]] });
  const result = await payOrder(ctx, "u1", order.id);
  assert.equal(result.order.status, "PAID");
  assert.equal(result.payment.status, "SUCCEEDED");
  assert.equal(result.payment.amount, 30000);
  assert.match(result.payment.txId, /^TX-/);
  assert.equal(ctx.store.orders.get(order.id).status, "PAID");
  assert.equal(ctx.store.payments.get(order.id).length, 1);
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(ctx.pg.charges[0].amount, 30000);
  assert.ok(ctx.pg.charges[0].idempotencyKey);
});

test("US-08 예외: 결제가 실패하면 사유가 안내되고 주문은 '결제대기'로 유지된다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx);
  ctx.pg.failNextCharge("LIMIT_EXCEEDED");
  await assert.rejects(payOrder(ctx, "u1", order.id), (e) => e.code === "PAYMENT_FAILED" && e.details.reason === "LIMIT_EXCEEDED");
  assert.equal(ctx.store.orders.get(order.id).status, "PENDING_PAYMENT");
  const [rec] = ctx.store.payments.get(order.id);
  assert.equal(rec.status, "FAILED");
  assert.equal(rec.failureReason, "LIMIT_EXCEEDED");
});

test("US-08: 실패한 뒤 같은 주문을 다시 결제할 수 있다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx);
  ctx.pg.failNextCharge();
  await assert.rejects(payOrder(ctx, "u1", order.id));
  const result = await payOrder(ctx, "u1", order.id);
  assert.equal(result.order.status, "PAID");
  assert.equal(ctx.store.payments.get(order.id).length, 2);
});

test("US-08 경계(FR-PAY-05): 결제 버튼을 연달아 눌러도 PG 결제 요청은 한 번이다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx);
  const [a, b] = await Promise.all([payOrder(ctx, "u1", order.id), payOrder(ctx, "u1", order.id)]);
  assert.equal(ctx.pg.charges.length, 1);
  assert.equal(a.order.status, "PAID");
  assert.equal(b.order.status, "PAID");
});

test("이미 결제된 주문을 다시 결제 요청해도 추가 결제는 없다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx);
  await payOrder(ctx, "u1", order.id);
  const again = await payOrder(ctx, "u1", order.id);
  assert.equal(again.alreadyPaid, true);
  assert.equal(ctx.pg.charges.length, 1);
});

test("남의 주문은 결제할 수 없다 (NOT_FOUND)", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { userId: "u1" });
  await assert.rejects(payOrder(ctx, "u2", order.id), (e) => e.code === "NOT_FOUND");
  assert.equal(ctx.pg.charges.length, 0);
});

test("US-08 보안: 결제 기록에는 카드번호 같은 결제 수단 정보가 없다", async () => {
  const ctx = createContext();
  const order = seedOrder(ctx);
  await payOrder(ctx, "u1", order.id);
  const [rec] = ctx.store.payments.get(order.id);
  assert.ok(!Object.keys(rec).some((k) => /card|number|cvc|pan/i.test(k)), "결제 기록에 결제 수단 필드가 있으면 안 된다");
});
