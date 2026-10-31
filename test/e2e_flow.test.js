// 통합 테스트 — 장바구니 → 주문 → 결제 → 취소까지 한 흐름 (모든 미션을 마친 뒤 실행)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart, changeQuantity, createOrder, payOrder, cancelOrder, getOrderDetail, listOrders } = require("../src");

test("구매 흐름: 담기 → 수량 변경 → 주문 → 결제 → 내역 조회", async () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 1);
  addToCart(ctx, "u1", "P2", 1);
  changeQuantity(ctx, "u1", "P1", 3);
  const order = createOrder(ctx, "u1", { address: "서울시 중구 세종대로 110" });
  assert.equal(order.totalAmount, 3 * 15000 + 59000);
  assert.equal(ctx.store.products.get("P1").stock, 7);
  const paid = await payOrder(ctx, "u1", order.id);
  assert.equal(paid.order.status, "PAID");
  const detail = getOrderDetail(ctx, "u1", order.id);
  assert.equal(detail.status, "PAID");
  const list = listOrders(ctx, "u1");
  assert.equal(list.total, 1);
  assert.equal(list.items[0].representativeName, "무선 마우스 외 1건");
});

test("구매 흐름: 결제 후 취소하면 환불되고 재고가 돌아온다", async () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P2", 2);
  const order = createOrder(ctx, "u1", { address: "서울시 중구 세종대로 110" });
  await payOrder(ctx, "u1", order.id);
  const canceled = await cancelOrder(ctx, "u1", order.id);
  assert.equal(canceled.order.status, "CANCELED");
  assert.equal(ctx.pg.refunds.length, 1);
  assert.equal(ctx.store.products.get("P2").stock, 3);
});
