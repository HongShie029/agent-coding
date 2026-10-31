// Mission 1 공개 테스트 — 장바구니 (US-05, US-06)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext } = require("../src/testkit");
const { addToCart, changeQuantity, removeItem, getCart } = require("../src/cart");

const code = (c) => (e) => e && e.code === c;

test("US-05 정상: 재고 10개 상품을 2개 담으면 수량 2가 된다", () => {
  const ctx = createContext();
  const cart = addToCart(ctx, "u1", "P1", 2);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].productId, "P1");
  assert.equal(cart.items[0].quantity, 2);
  assert.equal(cart.items[0].unitPrice, 15000);
  assert.equal(cart.items[0].lineTotal, 30000);
  assert.equal(cart.totalAmount, 30000);
});

test("US-05 정상: 이미 2개 담긴 상품을 3개 더 담으면 5로 합산된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  const cart = addToCart(ctx, "u1", "P1", 3);
  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].quantity, 5);
});

test("US-05 경계: 재고 10개 상품을 11개 담으면 거부되고 최대 수량이 안내된다", () => {
  const ctx = createContext();
  assert.throws(() => addToCart(ctx, "u1", "P1", 11), (e) => e.code === "OUT_OF_STOCK" && e.details.maxAddable === 10);
  assert.equal(getCart(ctx, "u1").items.length, 0);
});

test("US-05 경계: 합산 수량이 재고를 넘으면 거부되고 담을 수 있는 남은 수량이 안내된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P2", 2); // 재고 3
  assert.throws(() => addToCart(ctx, "u1", "P2", 2), (e) => e.code === "OUT_OF_STOCK" && e.details.maxAddable === 1);
  assert.equal(getCart(ctx, "u1").items[0].quantity, 2);
});

test("FR-STK-02: 품절 상품은 담을 수 없다", () => {
  const ctx = createContext();
  assert.throws(() => addToCart(ctx, "u1", "P3", 1), code("OUT_OF_STOCK"));
});

test("존재하지 않거나 판매 중지된 상품은 NOT_FOUND", () => {
  const ctx = createContext();
  assert.throws(() => addToCart(ctx, "u1", "P4", 1), code("NOT_FOUND"));
  assert.throws(() => addToCart(ctx, "u1", "NOPE", 1), code("NOT_FOUND"));
});

test("수량은 1~99 사이의 정수여야 한다 (INVALID_QUANTITY)", () => {
  const ctx = createContext();
  for (const q of [0, -1, 1.5, 100, "2", null, undefined, NaN]) {
    assert.throws(() => addToCart(ctx, "u1", "P1", q), code("INVALID_QUANTITY"), `quantity=${String(q)}`);
  }
});

test("US-06 정상: 수량을 바꾸면 소계와 총액이 즉시 갱신된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const cart = changeQuantity(ctx, "u1", "P1", 4);
  assert.equal(cart.items.find((i) => i.productId === "P1").lineTotal, 60000);
  assert.equal(cart.totalAmount, 60000 + 59000);
});

test("US-06 정상: 상품을 삭제하면 목록에서 사라지고 총액이 갱신된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  addToCart(ctx, "u1", "P2", 1);
  const cart = removeItem(ctx, "u1", "P1");
  assert.deepEqual(cart.items.map((i) => i.productId), ["P2"]);
  assert.equal(cart.totalAmount, 59000);
});

test("US-06 경계: 수량 0 또는 음수는 거부된다 (삭제는 removeItem 을 쓴다)", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  assert.throws(() => changeQuantity(ctx, "u1", "P1", 0), code("INVALID_QUANTITY"));
  assert.throws(() => changeQuantity(ctx, "u1", "P1", -3), code("INVALID_QUANTITY"));
  assert.equal(getCart(ctx, "u1").items[0].quantity, 2);
});

test("수량 변경도 재고를 넘을 수 없다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P2", 1);
  assert.throws(() => changeQuantity(ctx, "u1", "P2", 4), (e) => e.code === "OUT_OF_STOCK" && e.details.maxAddable === 3);
  assert.equal(getCart(ctx, "u1").items[0].quantity, 1);
});

test("구매자마다 장바구니는 분리된다", () => {
  const ctx = createContext();
  addToCart(ctx, "u1", "P1", 2);
  assert.equal(getCart(ctx, "u2").items.length, 0);
  assert.equal(getCart(ctx, "u2").totalAmount, 0);
});
