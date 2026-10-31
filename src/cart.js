// Mission 1 — 장바구니 (SRS: FR-CART-01, FR-CART-02 / US-05, US-06)
// 계약(입력 · 출력 · 오류 코드)은 docs/API_CONTRACT.md 의 "1. 장바구니" 를 읽는다.
const { AppError } = require("./errors");

const MAX_QTY = 99;

// 장바구니에 상품을 담는다. 이미 담긴 상품이면 수량을 합산한다. 담은 뒤의 장바구니(getCart 형식)를 돌려준다.
function addToCart(ctx, userId, productId, quantity) {
  throw new Error("NOT_IMPLEMENTED: addToCart");
}

// 담긴 상품의 수량을 quantity 로 바꾼다. 바뀐 장바구니를 돌려준다.
function changeQuantity(ctx, userId, productId, quantity) {
  throw new Error("NOT_IMPLEMENTED: changeQuantity");
}

// 담긴 상품을 장바구니에서 뺀다. 바뀐 장바구니를 돌려준다.
function removeItem(ctx, userId, productId) {
  throw new Error("NOT_IMPLEMENTED: removeItem");
}

// 장바구니를 { userId, items: [{ productId, name, unitPrice, quantity, lineTotal }], totalAmount } 형식으로 돌려준다.
function getCart(ctx, userId) {
  throw new Error("NOT_IMPLEMENTED: getCart");
}

module.exports = { addToCart, changeQuantity, removeItem, getCart, MAX_QTY };
