// Mission 5 — 팀이 직접 쓰는 재현 테스트 (결함 A~E, 고치기 전에는 모두 실패해야 한다)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { getOrderDetail, listOrders } = require("../src/orderQuery");

// 주문의 createdAt 을 직접 지정한다 (testkit 의 시계 사용법에 의존하지 않기 위해)
function setCreatedAt(ctx, id, iso) { ctx.store.orders.get(id).createdAt = iso; }

test("결함 A: 다른 구매자의 주문 상세를 읽을 수 있다 (소유자 검사 누락) — 규칙 1", () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { userId: "u1", address: "서울시 중구 세종대로 110" });
  assert.throws(() => getOrderDetail(ctx, "u2", o.id), (e) => e.code === "NOT_FOUND");
  // 없는 주문과 같은 오류여야 한다 (존재 여부를 알려 주지 않음)
  assert.throws(() => getOrderDetail(ctx, "u1", "ORD-9999"), (e) => e.code === "NOT_FOUND");
});

test("결함 B: 상품 가격이 바뀌면 과거 주문의 단가 · 합계가 같이 바뀐다 — 규칙 2", () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { items: [["P1", 2], ["P2", 1]] });
  ctx.store.products.get("P1").price = 99999; // 주문 후 가격 인상
  ctx.store.products.get("P2").price = 1;     // 주문 후 가격 인하
  const d = getOrderDetail(ctx, "u1", o.id);
  assert.equal(d.items[0].unitPrice, 15000);
  assert.equal(d.items[0].lineTotal, 30000);
  assert.equal(d.items[1].unitPrice, 59000);
  assert.equal(d.totalAmount, 2 * 15000 + 59000);
});

test("결함 C: 목록이 오래된 순이다 / 같은 시각이면 큰 주문번호가 먼저여야 한다 — 규칙 3", () => {
  const ctx = createContext();
  const a = seedOrder(ctx, {}); const b = seedOrder(ctx, {}); const c = seedOrder(ctx, {}); const d = seedOrder(ctx, {});
  setCreatedAt(ctx, a.id, "2026-01-01T00:00:00.000Z");
  setCreatedAt(ctx, b.id, "2026-01-02T00:00:00.000Z");
  setCreatedAt(ctx, c.id, "2026-01-03T00:00:00.000Z");
  setCreatedAt(ctx, d.id, "2026-01-03T00:00:00.000Z"); // c 와 같은 시각 → 번호가 큰 d 가 먼저
  const ids = listOrders(ctx, "u1").items.map((x) => x.orderId);
  assert.deepEqual(ids, [d.id, c.id, b.id, a.id]);
});

test("결함 D: 페이지가 1부터가 아니라 0부터 계산되어 첫 페이지가 건너뛰어진다 — 규칙 4", () => {
  const ctx = createContext();
  for (let i = 0; i < 12; i++) {
    const o = seedOrder(ctx, {});
    setCreatedAt(ctx, o.id, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`);
  }
  const p1 = listOrders(ctx, "u1"); // 기본 page=1, pageSize=10
  assert.equal(p1.total, 12);
  assert.equal(p1.items.length, 10);
  assert.equal(p1.items[0].orderId, "ORD-0012"); // 최신 주문이 첫 페이지 맨 앞
  const p2 = listOrders(ctx, "u1", { page: 2 });
  assert.equal(p2.items.length, 2);
  assert.equal(p2.items[1].orderId, "ORD-0001");
  assert.deepEqual(listOrders(ctx, "u1", { page: 3 }).items, []); // 범위 밖
});

test("결함 E: 대표 상품명의 '외 N건' 이 나머지가 아니라 전체 종류 수로 표시된다 — 규칙 5", () => {
  const ctx = createContext();
  const one = seedOrder(ctx, { items: [["P1", 5]] });
  const three = seedOrder(ctx, { items: [["P1", 1], ["P2", 1], ["P5", 1]] });
  const r = listOrders(ctx, "u1").items;
  const nameOf = (id) => r.find((x) => x.orderId === id).representativeName;
  const firstName = ctx.store.orders.get(three.id).items[0].name;
  assert.equal(nameOf(one.id), ctx.store.orders.get(one.id).items[0].name); // 종류 1개: 상품명만
  assert.equal(nameOf(three.id), `${firstName} 외 2건`);                    // 종류 3개: 외 2건
});