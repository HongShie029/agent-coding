// Mission 5 공개 테스트 — 에이전트가 쓴 주문 조회 코드 리뷰 (US-09)
// src/orderQuery.js 는 "에이전트가 작성했다고 가정한" 코드이며 결함이 숨어 있다.
// 이 파일에는 결함 1개를 드러내는 테스트만 들어 있다. 나머지 결함은 팀이 리뷰로 찾아
// test/m5_student.test.js 에 '먼저 실패하는 테스트'로 재현한 뒤 고친다.
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, seedOrder } = require("../src/testkit");
const { getOrderDetail, listOrders } = require("../src/orderQuery");

test("US-09 정상: 본인의 주문 상세에서 상품, 금액, 배송지, 상태를 볼 수 있다", () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { items: [["P1", 2], ["P2", 1]], address: "서울시 중구 세종대로 110" });
  const d = getOrderDetail(ctx, "u1", o.id);
  assert.equal(d.id, o.id);
  assert.equal(d.status, "PENDING_PAYMENT");
  assert.equal(d.address, "서울시 중구 세종대로 110");
  assert.equal(d.items.length, 2);
  assert.equal(d.totalAmount, 2 * 15000 + 59000);
});

test("US-09 보안: 다른 구매자의 주문번호로 접근하면 조회가 거부된다 (NOT_FOUND)", () => {
  const ctx = createContext();
  const o = seedOrder(ctx, { userId: "u1" });
  assert.throws(() => getOrderDetail(ctx, "u2", o.id), (e) => e.code === "NOT_FOUND");
});

test("US-09 예외: 주문이 하나도 없으면 빈 목록이다", () => {
  const ctx = createContext();
  const r = listOrders(ctx, "u1");
  assert.equal(r.total, 0);
  assert.deepEqual(r.items, []);
});
