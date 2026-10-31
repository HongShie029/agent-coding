// Challenge 공개 테스트 — 결제대기 주문 자동 취소 (FR-ORD-05)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, createFakeClock, seedOrder } = require("../src/testkit");
const { expirePendingOrders } = require("../src/expiry");

test("결제대기 30분이 지난 주문은 취소되고 재고가 복원된다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const o = seedOrder(ctx, { items: [["P1", 3]] });
  assert.equal(ctx.store.products.get("P1").stock, 7);
  clock.advanceMinutes(30);
  const ids = expirePendingOrders(ctx);
  assert.deepEqual(ids, [o.id]);
  assert.equal(ctx.store.orders.get(o.id).status, "CANCELED");
  assert.equal(ctx.store.products.get("P1").stock, 10);
});

test("30분이 되기 전에는 취소되지 않는다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const o = seedOrder(ctx);
  clock.advanceMinutes(29);
  assert.deepEqual(expirePendingOrders(ctx), []);
  assert.equal(ctx.store.orders.get(o.id).status, "PENDING_PAYMENT");
});

test("결제가 끝난 주문은 건드리지 않는다", () => {
  const clock = createFakeClock();
  const ctx = createContext({ clock });
  const o = seedOrder(ctx, { status: "PAID" });
  clock.advanceMinutes(120);
  assert.deepEqual(expirePendingOrders(ctx), []);
  assert.equal(ctx.store.orders.get(o.id).status, "PAID");
});
