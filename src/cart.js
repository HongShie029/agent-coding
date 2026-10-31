// Mission 1 — 장바구니 (SRS: FR-CART-01, FR-CART-02 / US-05, US-06)
// 계약(입력 · 출력 · 오류 코드)은 docs/API_CONTRACT.md 의 "1. 장바구니" 를 읽는다.
const { AppError } = require("./errors");

const MAX_QTY = 99;

// ---- 내부 보조 함수 -------------------------------------------------------

// 수량은 1~99 의 정수여야 한다. ("2", 1.5, null, undefined, NaN, 0, 음수 모두 거부)
function validateQuantity(quantity) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
    throw new AppError("INVALID_QUANTITY", `수량은 1~${MAX_QTY} 사이의 정수여야 합니다`, { quantity });
  }
}

// 판매 중인 상품만 돌려준다. 없는 상품 · 판매 중지 상품은 NOT_FOUND.
function getSellableProduct(ctx, productId) {
  const product = ctx.store.products.get(productId);
  if (!product || product.status !== "ON_SALE") {
    throw new AppError("NOT_FOUND", "상품을 찾을 수 없습니다", { productId });
  }
  return product;
}

// 저장소의 장바구니(Map)를 읽기만 한다. 없으면 undefined (이 함수는 저장소를 만들지 않는다).
function findCart(ctx, userId) {
  return ctx.store.carts.get(userId);
}

// ---- 공개 함수 ------------------------------------------------------------

// 장바구니를 { userId, items: [{ productId, name, unitPrice, quantity, lineTotal }], totalAmount } 형식으로 돌려준다.
// 내부 Map 을 그대로 내보내지 않고 새 객체로 만들어 돌려준다(복사본).
function getCart(ctx, userId) {
  const cart = findCart(ctx, userId);
  const items = [];
  let totalAmount = 0;

  if (cart) {
    // Map 은 담은 순서를 유지한다.
    for (const [productId, quantity] of cart) {
      const product = ctx.store.products.get(productId);
      if (!product) continue; // 상품은 논리 삭제(STOPPED)만 되므로 정상 상황에서는 일어나지 않는다.
      const lineTotal = product.price * quantity;
      items.push({
        productId,
        name: product.name,
        unitPrice: product.price,
        quantity,
        lineTotal,
      });
      totalAmount += lineTotal;
    }
  }

  return { userId, items, totalAmount };
}

// 장바구니에 상품을 담는다. 이미 담긴 상품이면 수량을 합산한다. 담은 뒤의 장바구니(getCart 형식)를 돌려준다.
function addToCart(ctx, userId, productId, quantity) {
  // 1) 검사 단계 — 저장소를 건드리지 않는다.
  validateQuantity(quantity);
  const product = getSellableProduct(ctx, productId);

  const cart = findCart(ctx, userId);
  const current = cart && cart.has(productId) ? cart.get(productId) : 0;
  const nextQuantity = current + quantity;

  if (nextQuantity > product.stock) {
    throw new AppError("OUT_OF_STOCK", "재고가 부족합니다", {
      productId,
      // 지금 더 담을 수 있는 최대 수량 (이미 담은 수량을 뺀 값, 품절이면 0)
      maxAddable: Math.max(0, product.stock - current),
    });
  }

  // 2) 변경 단계 — 모든 검사를 통과한 뒤에만 저장소를 수정한다.
  let target = cart;
  if (!target) {
    target = new Map();
    ctx.store.carts.set(userId, target);
  }
  target.set(productId, nextQuantity);

  return getCart(ctx, userId);
}

// 담긴 상품의 수량을 quantity 로 바꾼다(합산 아님). 바뀐 장바구니를 돌려준다.
function changeQuantity(ctx, userId, productId, quantity) {
  // 1) 검사 단계
  validateQuantity(quantity);
  const product = getSellableProduct(ctx, productId); // 담겨 있어도 STOPPED 이면 NOT_FOUND

  const cart = findCart(ctx, userId);
  if (!cart || !cart.has(productId)) {
    throw new AppError("NOT_FOUND", "장바구니에 없는 상품입니다", { productId });
  }

  if (quantity > product.stock) {
    throw new AppError("OUT_OF_STOCK", "재고가 부족합니다", {
      productId,
      // 수량을 '바꾸는' 것이므로 지금 설정할 수 있는 최대 수량은 재고 전체이다.
      maxAddable: Math.max(0, product.stock),
    });
  }

  // 2) 변경 단계 (기존 키를 덮어쓰면 Map 의 순서는 유지된다)
  cart.set(productId, quantity);

  return getCart(ctx, userId);
}

// 담긴 상품을 장바구니에서 뺀다. 바뀐 장바구니를 돌려준다.
function removeItem(ctx, userId, productId) {
  // 1) 검사 단계 — 판매 중지된 상품도 장바구니에서는 뺄 수 있다(PLAN 가정).
  const cart = findCart(ctx, userId);
  if (!cart || !cart.has(productId)) {
    throw new AppError("NOT_FOUND", "장바구니에 없는 상품입니다", { productId });
  }

  // 2) 변경 단계
  cart.delete(productId);

  return getCart(ctx, userId);
}

module.exports = { addToCart, changeQuantity, removeItem, getCart, MAX_QTY };