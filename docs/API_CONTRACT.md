# MiniMall 핵심 주문 흐름 — 함수 계약서

이 문서는 구현해야 할 함수의 **입력 · 출력 · 오류**를 정의한다. 테스트와 채점은 이 계약을 기준으로 한다.
계약에 없는 동작은 정하지 않았으므로, 필요하면 팀이 `docs/PLAN.md` 에 가정을 적고 진행한다.

## 0. 공통 규칙

- 모든 함수의 첫 인자는 `ctx`(저장소 + 모의 PG + 시계), 둘째 인자는 `userId`(로그인한 구매자) 이다. 로그인 · 인증은 이 과제의 범위 밖이다.
- 업무 오류는 `new AppError(code, message, details)` 로 던진다. `code` 만 테스트가 확인한다. (메시지는 자유)
- **반환값은 복사본**이어야 한다. 반환된 객체를 고쳐도 저장소(`ctx.store`)의 데이터가 바뀌면 안 된다. (`src/util.js` 의 `copy` 사용 가능)
- 금액은 **원 단위 정수**이다. 소수점 계산을 하지 않는다.
- **본인의 주문이 아니면 `NOT_FOUND`** 로 응답한다. (남의 주문의 존재 여부를 알려 주지 않기 위해 `FORBIDDEN` 이 아니다)
- 결제 수단 정보(카드번호 등)는 어디에도 저장 · 기록하지 않는다.
- 외부 라이브러리를 추가하지 않는다. (Node.js 기본 기능만 사용)

### 오류 코드표

| code | 의미 |
|---|---|
| `INVALID_QUANTITY` | 수량이 1~99 사이의 정수가 아님 |
| `NOT_FOUND` | 없는 상품 · 판매 중지 상품 · 장바구니에 없는 상품 · 없는 주문 · 남의 주문 |
| `OUT_OF_STOCK` | 재고 부족 (품절 포함) |
| `INVALID_ADDRESS` | 배송지가 비어 있거나 문자열이 아님 |
| `EMPTY_CART` | 빈 장바구니로 주문 |
| `INVALID_STATE` | 현재 주문 상태에서 할 수 없는 동작 |
| `PAYMENT_FAILED` | PG 결제 실패(시간 초과 포함) |
| `REFUND_FAILED` | PG 환불 실패(시간 초과 포함) |

### 데이터 구조 (`ctx.store`)

```text
products : Map(productId -> { id, name, price, stock, status })     status: "ON_SALE" | "STOPPED"
carts    : Map(userId -> Map(productId -> quantity))                담은 순서가 유지된다
orders   : Map(orderId -> order)
payments : Map(orderId -> payment[])                                 결제 시도마다 1건씩 쌓인다
seq      : { order, payment }                                        번호 발급용 카운터
inflight : Map                                                       진행 중인 비동기 작업(중복 방지에 사용 가능)
```

```text
order   = { id, userId, status, items: [{ productId, name, unitPrice, quantity }], totalAmount, address, createdAt }
payment = { id, orderId, amount, status, attempt, txId?, paidAt?, failureReason?, refund? }
          status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED"
          refund: { status: "SUCCEEDED" | "FAILED", refundId?, reason?, at }
```

## 1. 장바구니 (`src/cart.js`) — US-05, US-06

| 함수 | 동작 |
|---|---|
| `addToCart(ctx, userId, productId, quantity)` | 장바구니에 담는다. 이미 담긴 상품이면 수량을 **합산**한다. 담은 뒤의 `getCart` 결과를 돌려준다. |
| `changeQuantity(ctx, userId, productId, quantity)` | 담긴 상품의 수량을 `quantity` 로 **바꾼다**(합산 아님). 바뀐 장바구니를 돌려준다. |
| `removeItem(ctx, userId, productId)` | 담긴 상품을 뺀다. 바뀐 장바구니를 돌려준다. |
| `getCart(ctx, userId)` | `{ userId, items: [{ productId, name, unitPrice, quantity, lineTotal }], totalAmount }` |

규칙
1. `quantity` 는 **1~99 의 정수**여야 한다. 아니면 `INVALID_QUANTITY`. (`"2"`, `1.5`, `null` 도 오류) — 수량 0 으로 삭제하는 방식은 지원하지 않는다. 삭제는 `removeItem`.
2. 없는 상품 · `STOPPED` 상품은 `NOT_FOUND`. (장바구니에 이미 담긴 상품이 `STOPPED` 가 된 경우의 `changeQuantity` 도 `NOT_FOUND`)
3. 담은 뒤(또는 바꾼 뒤) 수량이 재고를 넘으면 `OUT_OF_STOCK` 이고 `details.maxAddable` 에 **지금 더 담을 수 있는 최대 수량**을 넣는다. (재고 0 인 품절 상품은 0) 오류가 나면 장바구니는 **전혀 바뀌지 않는다.**
4. 장바구니에 없는 상품의 `changeQuantity` · `removeItem` 은 `NOT_FOUND`.
5. 장바구니 항목은 **담은 순서**대로 나온다. 장바구니가 없는 구매자의 `getCart` 는 `items: []`, `totalAmount: 0`.
6. 구매자마다 장바구니는 분리된다.

## 2. 주문 (`src/order.js`) — US-07

| 함수 | 동작 |
|---|---|
| `createOrder(ctx, userId, { address })` | 장바구니의 상품으로 주문을 만든다. 만들어진 주문의 복사본을 돌려준다. |
| `canTransition(from, to)` | 상태 전이가 허용되면 `true` |
| `changeStatus(ctx, orderId, to)` | 주문 상태를 바꾸고 바뀐 주문의 복사본을 돌려준다. |

`createOrder` 규칙
1. `address` 는 **공백을 제거**한 뒤 비어 있지 않은 문자열이어야 한다. 아니면 `INVALID_ADDRESS`. 저장되는 값은 공백을 제거한 값이다.
2. 장바구니가 비어 있으면 `EMPTY_CART`.
3. 장바구니의 **모든 상품**의 재고를 확인한다. 하나라도 부족하면(판매 중지 · 품절 포함) `OUT_OF_STOCK` 이고
   `details.shortages = [{ productId, name, requested, available }]` 에 **부족한 상품을 모두** 담는다. (판매 중지 상품의 `available` 은 0)
   이때 **재고 · 장바구니 · 주문은 아무것도 바뀌지 않는다.**
4. 모두 충분하면 재고를 차감하고 주문을 만든다.
   - `id`: `ORD-0001`, `ORD-0002` … (4자리, 순차)
   - `status`: `PENDING_PAYMENT`
   - `items`: 주문 **시점**의 `{ productId, name, unitPrice, quantity }` (이후 가격이 바뀌어도 주문은 바뀌지 않는다)
   - `totalAmount`: 단가 × 수량의 합
   - `createdAt`: `ctx.clock.now().toISOString()`
   - 주문이 만들어지면 그 구매자의 장바구니는 비워진다.
5. 마지막 재고를 두 구매자가 동시에 주문하면 한 명만 성공하고 재고는 **0 미만이 되지 않는다.**

상태 전이표 (`canTransition` / `changeStatus`)

| 현재 상태 | 바꿀 수 있는 상태 |
|---|---|
| `PENDING_PAYMENT` (결제대기) | `PAID`, `CANCELED` |
| `PAID` (결제완료) | `PREPARING`, `CANCELED` |
| `PREPARING` (배송준비) | `SHIPPING` |
| `SHIPPING` (배송중) | `DELIVERED` |
| `DELIVERED` (배송완료), `CANCELED` (취소) | 없음 |

- 표에 없는 전이는 `canTransition` 이 `false`, `changeStatus` 는 `INVALID_STATE`(`details: { from, to }`). 없는 주문은 `NOT_FOUND`.

## 3. 결제 (`src/payment.js`) — US-08

`async payOrder(ctx, userId, orderId)` → `{ order, payment, alreadyPaid }`

모의 PG: `await ctx.pg.charge({ orderId, amount, idempotencyKey })` → `{ ok: true, txId }` 또는 `{ ok: false, reason }`. 시간 초과 시 **예외를 던진다.**

규칙
1. 본인의 주문이 아니면 `NOT_FOUND`.
2. 주문이 이미 결제된 상태(성공한 결제 기록이 있음)이면 **PG 에 다시 요청하지 않고** 기존 결과를 `alreadyPaid: true` 로 돌려준다.
3. `PENDING_PAYMENT` 가 아닌 주문(예: 취소됨)은 `INVALID_STATE` 이고 PG 에 요청하지 않는다.
4. PG 에는 **서버가 가진 주문 금액**(`order.totalAmount`)을 보낸다. 시도마다 서로 다른 `idempotencyKey` 를 보낸다.
5. 성공하면 주문 → `PAID`, 결제 기록 `status: "SUCCEEDED"`(`txId`, `paidAt` 포함).
6. 실패(`ok: false`) 또는 시간 초과(예외)이면 `PAYMENT_FAILED`(`details.reason`: PG 가 준 사유, 예외이면 `"PG_ERROR"`). 결제 기록은 `status: "FAILED"`, `failureReason` 을 남기고 **주문은 `PENDING_PAYMENT` 로 유지**하여 다시 결제할 수 있게 한다.
6-1. 결제 시도마다 결제 기록이 1건 쌓이며 `attempt` 는 1부터 증가한다.
7. 같은 주문에 대해 결제 요청이 **동시에 여러 번** 와도 PG 요청은 **한 번**이다. (버튼 연타) 그 결과가 실패이면 동시에 온 요청 모두 같은 실패를 받는다.
8. 서로 다른 주문의 결제는 서로 영향을 주지 않는다.
9. 결제 기록에는 결제 수단(카드번호 등)과 관련된 필드가 없다.

## 4. 취소 · 환불 (`src/cancel.js`) — US-10

`async cancelOrder(ctx, userId, orderId)` → `{ order }`

모의 PG: `await ctx.pg.refund({ txId, amount })` → `{ ok: true, refundId }` 또는 `{ ok: false, reason }`. 시간 초과 시 예외.

규칙
1. 본인의 주문이 아니면 `NOT_FOUND`.
2. 취소할 수 있는 상태는 `PENDING_PAYMENT`, `PAID` 뿐이다. 그 밖(이미 취소 포함)은 `INVALID_STATE` 이고 **환불 · 재고에 아무 일도 일어나지 않는다.**
3. `PENDING_PAYMENT` 취소: PG 호출 없이 주문 → `CANCELED`, 주문 상품의 재고를 **복원**한다.
4. `PAID` 취소: 결제 금액으로 PG 에 **환불**을 요청한다.
   - 성공: 결제 기록 `status: "REFUNDED"`, `refund: { status: "SUCCEEDED", refundId, at }`, 주문 → `CANCELED`, 재고 복원.
   - 실패(`ok: false` 또는 예외): `REFUND_FAILED`(`details.reason`, 예외이면 `"PG_ERROR"`). 결제 기록에 `refund: { status: "FAILED", reason, at }` 를 남기고 **주문은 `PAID` 로 남기며 재고는 복원하지 않는다.** 나중에 다시 취소를 시도할 수 있다.
5. 같은 주문의 취소 요청이 **동시에 두 번** 와도 환불 · 재고 복원은 **한 번**이다.

## 5. 주문 조회 (`src/orderQuery.js`) — US-09  ·  Mission 5

`getOrderDetail(ctx, userId, orderId)` → `{ id, status, createdAt, address, items: [{ productId, name, unitPrice, quantity, lineTotal }], totalAmount }`
`listOrders(ctx, userId, { page = 1, pageSize = 10 })` → `{ page, pageSize, total, items: [{ orderId, createdAt, representativeName, totalAmount, status }] }`

규칙
1. 본인의 주문만 조회할 수 있다. 남의 주문 · 없는 주문은 `NOT_FOUND`.
2. 상세의 단가 · 금액은 **주문 시점의 값**이다. (상품 가격이 바뀌거나 상품이 삭제되어도 변하지 않는다)
3. 목록은 **최신순**이다. 같은 시각이면 주문번호가 큰 것이 먼저.
4. 페이지는 1부터 시작한다. 기본 한 페이지 10건. `total` 은 본인 주문의 전체 건수. 범위를 벗어난 페이지는 `items: []`.
5. `representativeName`: 상품 종류가 하나면 그 상품명, 여럿이면 `"{첫 상품명} 외 {나머지 종류 수}건"`.
6. 목록에는 본인의 주문만 나온다.

## 6. 도전 과제 (`src/expiry.js`) — FR-ORD-05

`expirePendingOrders(ctx, { timeoutMinutes = 30 })` → 취소된 주문번호 배열(오름차순)

1. `PENDING_PAYMENT` 상태로 `timeoutMinutes` 분 **이상** 지난 주문(`ctx.clock.now() - createdAt`)을 `CANCELED` 로 바꾸고 재고를 복원한다.
2. 다른 상태의 주문은 건드리지 않는다. 같은 호출을 반복해도 재고는 한 번만 복원된다.
