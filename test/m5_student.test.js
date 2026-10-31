// Mission 5 — 팀이 직접 쓰는 테스트
// 1) src/orderQuery.js 를 리뷰해서 결함을 찾는다 (docs/REVIEW_NOTES.md 에 기록).
// 2) 결함마다 '고치기 전에 실패하는' 테스트를 아래에 작성한다. (실패하는 화면을 AI_USAGE_LOG 에 남긴다)
// 3) 결함을 고치고 테스트가 통과하는지 확인한다.
// 아래 todo 테스트를 복사해 채우면 된다. (todo 표시를 지우면 실패가 정식으로 보고된다)
// 도구: createContext, createFakeClock, seedOrder (src/testkit.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const { createContext, createFakeClock, seedOrder } = require("../src/testkit");
const { getOrderDetail, listOrders } = require("../src/orderQuery");

test("TODO 결함 A: (여기에 결함을 설명하는 제목을 쓴다)", { todo: true }, () => {
  // const ctx = createContext();
  // const o = seedOrder(ctx, { items: [["P1", 2]] });
  assert.fail("아직 작성하지 않았습니다");
});

test("TODO 결함 B: (여기에 결함을 설명하는 제목을 쓴다)", { todo: true }, () => {
  assert.fail("아직 작성하지 않았습니다");
});

test("TODO 결함 C: (여기에 결함을 설명하는 제목을 쓴다)", { todo: true }, () => {
  assert.fail("아직 작성하지 않았습니다");
});
