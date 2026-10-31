// Mission 2 공개 테스트 — 주문 생성과 상태 관리 (US-07)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart, getCart } = require("../src/cart");
const { createOrder, canTransition, changeStatus, ORDER_STATUS } = require("../src/order");
const { seedOrder } = require("../src/testkit");

const ADDR = "서울시 중구 세종대로 110";

// 이 파일은 Mission 1 의 결과물(addToCart)을 사용한다. 장바구니 담기를 직접 저장소에 심어 두면 M1 없이도 시험할 수 있다.
function fillCart(ctx, userId, lines) {
  const m = new Map(lines);
  ctx.store.carts.set(userId, m);
}

test("US-07 정상: 주문이 '결제대기'로 생성되고 주문번호가 발급되며 재고가 차감된다", () => {
  const ctx = createContext();
  fillCart(ctx, "u1", [["P1", 2], ["P2", 1]]);
  const order = createOrder(ctx, "u1", { address: ADDR });
  assert.match(order.id, /^ORD-\d{4}$/);
  assert.equal(order.status, ORDER_STATUS.PENDING_PAYMENT);
  assert.equal(order.userId, "u1");
  assert.equal(order.address, ADDR);
  assert.equal(order.totalAmount, 2 * 15000 + 59000);
  assert.deepEqual(order.items.map((i) => [i.productId, i.quantity, i.unitPrice]), [["P1", 2, 15000], ["P2", 1, 59000]]);
  assert.equal(ctx.store.products.get("P1").stock, 8);
  assert.equal(ctx.store.products.get("P2").stock, 2);
});

test("주문이 만들어지면 장바구니는 비워진다", () => {
  const ctx = createContext();
  fillCart(ctx, "u1", [["P1", 1]]);
  createOrder(ctx, "u1", { address: ADDR });
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("US-07 예외: 재고가 부족하면 주문이 생성되지 않고 부족한 상품이 안내되며 재고는 변하지 않는다", () => {
  const ctx = createContext();
  fillCart(ctx, "u1", [["P2", 3]]);
  seedOrder(ctx, { userId: "u2", items: [["P2", 2]] }); // 다른 구매자가 먼저 2개를 가져가 남은 재고는 1
  assert.throws(
    () => createOrder(ctx, "u1", { address: ADDR }),
    (e) => {
      assert.equal(e.code, "OUT_OF_STOCK");
      assert.equal(e.details.shortages.length, 1);
      assert.equal(e.details.shortages[0].productId, "P2");
      assert.equal(e.details.shortages[0].name, "기계식 키보드");
      assert.equal(e.details.shortages[0].requested, 3);
      assert.equal(e.details.shortages[0].available, 1);
      return true;
    }
  );
  assert.equal(ctx.store.products.get("P2").stock, 1);
  assert.equal(ctx.store.orders.size, 1); // 시드된 주문 1건뿐
});

test("US-07 예외: 배송지가 없거나 공백이면 INVALID_ADDRESS 이고 주문이 생기지 않는다", () => {
  const ctx = createContext();
  fillCart(ctx, "u1", [["P1", 1]]);
  for (const address of [undefined, "", "   "]) {
    assert.throws(() => createOrder(ctx, "u1", { address }), (e) => e.code === "INVALID_ADDRESS");
  }
  assert.equal(ctx.store.orders.size, 0);
  assert.equal(ctx.store.products.get("P1").stock, 10);
});

test("빈 장바구니로는 주문할 수 없다 (EMPTY_CART)", () => {
  const ctx = createContext();
  assert.throws(() => createOrder(ctx, "u1", { address: ADDR }), (e) => e.code === "EMPTY_CART");
});

test("US-07 경계(FR-STK-03): 마지막 1개를 두 구매자가 동시에 주문하면 한 명만 성공한다", async () => {
  const ctx = createContext();
  fillCart(ctx, "u1", [["P5", 1]]);
  fillCart(ctx, "u2", [["P5", 1]]);
  const results = await Promise.allSettled([
    (async () => createOrder(ctx, "u1", { address: ADDR }))(),
    (async () => createOrder(ctx, "u2", { address: ADDR }))(),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  const rejected = results.find((r) => r.status === "rejected");
  assert.equal(rejected.reason.code, "OUT_OF_STOCK");
  assert.equal(ctx.store.products.get("P5").stock, 0);
});

test("FR-ORD-02: 주문 상태는 정해진 순서로만 바뀐다", () => {
  assert.equal(canTransition("PENDING_PAYMENT", "PAID"), true);
  assert.equal(canTransition("PAID", "PREPARING"), true);
  assert.equal(canTransition("PREPARING", "SHIPPING"), true);
  assert.equal(canTransition("SHIPPING", "DELIVERED"), true);
  assert.equal(canTransition("PENDING_PAYMENT", "SHIPPING"), false);
  assert.equal(canTransition("DELIVERED", "PAID"), false);
  assert.equal(canTransition("CANCELED", "PAID"), false);
});

test("허용되지 않은 상태 변경은 INVALID_STATE 이고 상태는 그대로이다", () => {
  const ctx = createContext();
  const order = seedOrder(ctx, { status: "PENDING_PAYMENT" });
  assert.throws(() => changeStatus(ctx, order.id, "SHIPPING"), (e) => e.code === "INVALID_STATE");
  assert.equal(ctx.store.orders.get(order.id).status, "PENDING_PAYMENT");
  assert.equal(changeStatus(ctx, order.id, "PAID").status, "PAID");
});

test("존재하지 않는 주문의 상태를 바꾸면 NOT_FOUND", () => {
  const ctx = createContext();
  assert.throws(() => changeStatus(ctx, "ORD-9999", "PAID"), (e) => e.code === "NOT_FOUND");
});
