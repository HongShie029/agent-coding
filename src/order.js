// Mission 2 — 주문 생성과 상태 관리 (SRS: FR-ORD-01, FR-ORD-02, FR-STK-01~03 / US-07)
// 계약은 docs/API_CONTRACT.md 의 "2. 주문" 을 읽는다.
const { AppError } = require("./errors");
const { copy } = require("./util");

const ORDER_STATUS = {
  PENDING_PAYMENT: "PENDING_PAYMENT", // 결제대기
  PAID: "PAID", // 결제완료
  PREPARING: "PREPARING", // 배송준비
  SHIPPING: "SHIPPING", // 배송중
  DELIVERED: "DELIVERED", // 배송완료
  CANCELED: "CANCELED", // 취소
};

// 상태 전이표 (docs/API_CONTRACT.md) — 데이터로 두고 canTransition 이 읽는다.
const TRANSITIONS = {
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PREPARING, ORDER_STATUS.CANCELED],
  [ORDER_STATUS.PREPARING]: [ORDER_STATUS.SHIPPING],
  [ORDER_STATUS.SHIPPING]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELED]: [],
};

// from 상태에서 to 상태로 바꿀 수 있으면 true. (docs/API_CONTRACT.md 의 상태 전이표 참고)
function canTransition(from, to) {
  // "constructor" 같은 객체 기본 속성 이름이 표 조회에 걸리지 않도록 hasOwn 으로 확인한다.
  if (typeof from !== "string" || !Object.hasOwn(TRANSITIONS, from)) return false;
  return TRANSITIONS[from].includes(to);
}

// 주문 상태를 바꾼다. 없는 주문은 NOT_FOUND, 허용되지 않은 전이는 INVALID_STATE. 바뀐 주문의 복사본을 돌려준다.
function changeStatus(ctx, orderId, to) {
  const order = ctx.store.orders.get(orderId);
  if (!order) {
    throw new AppError("NOT_FOUND", "주문을 찾을 수 없습니다", { orderId });
  }
  if (!canTransition(order.status, to)) {
    throw new AppError("INVALID_STATE", "허용되지 않는 주문 상태 변경입니다", { from: order.status, to });
  }
  order.status = to;
  return copy(order);
}

// 장바구니의 상품으로 주문을 만든다. input = { address }
// 이 함수는 의도적으로 동기 함수이다. 재고 검사와 차감 사이에 다른 코드가 끼어들 수 없으므로
// 마지막 재고를 두 구매자가 동시에 주문해도 한 명만 성공한다. (await 를 넣지 않는다)
function createOrder(ctx, userId, input = {}) {
  // ---- 1) 검사 단계: 저장소를 전혀 바꾸지 않는다 ----------------------------

  // 배송지: 문자열이고, 앞뒤 공백을 제거한 값이 비어 있지 않아야 한다.
  const rawAddress = input == null ? undefined : input.address;
  const address = typeof rawAddress === "string" ? rawAddress.trim() : "";
  if (address === "") {
    throw new AppError("INVALID_ADDRESS", "배송지를 입력해 주세요", {});
  }

  // 빈 장바구니
  const cart = ctx.store.carts.get(userId);
  if (!cart || cart.size === 0) {
    throw new AppError("EMPTY_CART", "장바구니가 비어 있습니다", {});
  }

  // 재고 전수 검사: 첫 부족 상품에서 멈추지 않고 부족한 상품을 모두 모은다.
  const shortages = [];
  for (const [productId, requested] of cart) {
    const product = ctx.store.products.get(productId);
    const sellable = product && product.status === "ON_SALE";
    const available = sellable ? product.stock : 0; // 판매 중지 · 없는 상품은 0
    if (requested > available) {
      shortages.push({
        productId,
        name: product ? product.name : productId,
        requested,
        available,
      });
    }
  }
  if (shortages.length > 0) {
    throw new AppError("OUT_OF_STOCK", "재고가 부족한 상품이 있습니다", { shortages });
  }

  // ---- 2) 변경 단계: 모든 검사를 통과한 뒤에만 저장소를 수정한다 -------------

  // 주문 시점의 상품명 · 단가 스냅샷 (상품 객체를 참조하지 않고 값을 복사한다)
  const items = [];
  for (const [productId, quantity] of cart) {
    const product = ctx.store.products.get(productId);
    items.push({ productId, name: product.name, unitPrice: product.price, quantity });
  }

  ctx.store.seq.order += 1;
  const id = `ORD-${String(ctx.store.seq.order).padStart(4, "0")}`;

  const order = {
    id,
    userId,
    status: ORDER_STATUS.PENDING_PAYMENT,
    items,
    totalAmount: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    address,
    createdAt: ctx.clock.now().toISOString(),
  };

  // 재고 차감
  for (const item of items) {
    ctx.store.products.get(item.productId).stock -= item.quantity;
  }

  ctx.store.orders.set(id, order);
  ctx.store.carts.delete(userId); // 장바구니 비우기

  return copy(order);
}

module.exports = { ORDER_STATUS, canTransition, changeStatus, createOrder };