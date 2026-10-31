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

// from 상태에서 to 상태로 바꿀 수 있으면 true. (docs/API_CONTRACT.md 의 상태 전이표 참고)
function canTransition(from, to) {
  throw new Error("NOT_IMPLEMENTED: canTransition");
}

// 주문 상태를 바꾼다. 없는 주문은 NOT_FOUND, 허용되지 않은 전이는 INVALID_STATE. 바뀐 주문의 복사본을 돌려준다.
function changeStatus(ctx, orderId, to) {
  throw new Error("NOT_IMPLEMENTED: changeStatus");
}

// 장바구니의 상품으로 주문을 만든다. input = { address }
function createOrder(ctx, userId, input = {}) {
  throw new Error("NOT_IMPLEMENTED: createOrder");
}

module.exports = { ORDER_STATUS, canTransition, changeStatus, createOrder };
