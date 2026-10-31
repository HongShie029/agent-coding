// Mission 5 — 주문 조회 (SRS: FR-ORD-03 / US-09)
// ※ 이 파일은 "코딩 에이전트가 작성해 PR 로 올린 코드" 라고 가정한다. 팀은 리뷰어로서 이 코드를 검토한다.
const { AppError } = require("./errors");

function getOrderDetail(ctx, userId, orderId) {
  const order = ctx.store.orders.get(orderId);
  if (!order || order.userId !== userId) throw new AppError("NOT_FOUND", "주문을 찾을 수 없습니다", { orderId });
  const items = order.items.map((i) => {
    const unitPrice = i.unitPrice;
    return { ...i, unitPrice, lineTotal: unitPrice * i.quantity };
  });
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    address: order.address,
    items,
    totalAmount: items.reduce((s, i) => s + i.lineTotal, 0),
  };
}

function representativeName(order) {
  const first = order.items[0].name;
  return order.items.length > 1 ? `${first} 외 ${order.items.length - 1}건` : first;
}

function listOrders(ctx, userId, { page = 1, pageSize = 10 } = {}) {
  const mine = [...ctx.store.orders.values()]
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const start = (page - 1) * pageSize;
  return {
    page,
    pageSize,
    total: mine.length,
    items: mine.slice(start, start + pageSize).map((o) => ({
      orderId: o.id,
      createdAt: o.createdAt,
      representativeName: representativeName(o),
      totalAmount: o.totalAmount,
      status: o.status,
    })),
  };
}

module.exports = { getOrderDetail, listOrders };
