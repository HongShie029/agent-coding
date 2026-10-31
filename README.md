# MiniMall 실습 — 에이전틱 코딩 미니 프로젝트

AI 활용 소프트웨어 공학 5강 실전 연습용 스타터 프로젝트입니다. (수업용 가상 서비스)

## 준비
- Node.js 18 이상 (`node --version`) — 별도 설치할 패키지는 없습니다. (`npm install` 불필요)
- 터미널과 사용 중인 코딩 에이전트 도구

## 시작하기
```bash
npm test          # 전체 공개 테스트 — 처음에는 대부분 실패하는 것이 정상입니다
npm run test:m1   # Mission 1 만 실행
```

## 폴더 안내
| 경로 | 설명 |
|---|---|
| `AGENTS.md` | 에이전트에게 주는 프로젝트 규칙 (Mission 0 에서 완성) |
| `docs/SRS_발췌.md` | 이번 실습의 요구사항 · 사용자 스토리 · 수락 기준 |
| `docs/API_CONTRACT.md` | 함수 계약서 (구현의 기준) |
| `docs/PLAN.md` | 팀 계획서 (작성) |
| `docs/AI_USAGE_LOG.md` | 에이전트 사용 기록 (미션마다 작성) |
| `docs/REVIEW_NOTES.md` | Mission 5 코드 리뷰 노트 |
| `docs/RETRO.md` | 팀 회고 |
| `src/` | 구현 (미션별 파일) — `errors / util / pg / seed / testkit` 은 수정 금지 |
| `test/` | 공개 테스트 — 수정 금지 (`m5_student.test.js` 는 직접 작성) |

## 미션 순서
Mission 0(준비) → 1(장바구니) → 2(주문) → 3(결제) → 4(취소·환불) → 5(코드 리뷰) → 도전(자동 취소, 선택)

미션 설명과 채점 기준은 학생용 문제지(Word)를 보세요.

## 제출
수업 공지의 방식을 따릅니다. 일반적으로 이 폴더(`node_modules` 없음)를 압축한 파일 또는 저장소 링크, 그리고 `docs/` 의 기록 문서를 제출합니다.
