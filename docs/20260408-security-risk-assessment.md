# Security Risk Assessment — test-estimator

작성일: 2026-04-08
범위: `src/app/admin/**`, `src/app/api/**`, `src/app/embed.js/route.ts`, `src/lib/cafe24/**`, `src/lib/cors.ts`, `prisma/schema.prisma`
관점: 보안 전문가 1차 평가 (시니어 보안 에이전트가 별도 교차 검증)

## 위험도 등급

- **C(Critical)**: 즉시 수정 필요. 운영 배포 차단 사유.
- **H(High)**: 운영 전 반드시 수정.
- **M(Medium)**: MVP 외 단계에서 수정.
- **L(Low)**: 정보성 / hardening.

---

## C-1. 관리자 영역 인증 부재

- 위치: `src/app/admin/**/*`, `src/app/admin/layout.tsx`
- 현황: `/admin` 라우트 전체에 인증 미들웨어/세션 검사 없음. `middleware.ts` 부재. 누구나 상품 생성·몰 연동 정보 열람 가능.
- 영향: 몰 OAuth 토큰·client_secret이 저장된 시스템을 임의 조작. 동적 상품 무한 생성 → 결제 시스템 오염.
- 권고: NextAuth/Clerk/세션 쿠키 + `middleware.ts` 적용. 최소 BASIC AUTH라도 즉시 적용.

## C-2. 쇼핑몰 API CORS 와일드카드 + 인증 없음

- 위치: `src/lib/cors.ts:8`, `src/app/api/shop/products/[cafe24ProductNo]/checkout/route.ts`
- 현황: `Access-Control-Allow-Origin: origin ?? "*"` — 요청 Origin을 그대로 반사. 화이트리스트 검증 없음. checkout 엔드포인트는 인증·rate-limit·CAPTCHA 없이 누구나 호출 가능.
- 영향:
  1. 임의 사이트에서 호출 → Cafe24 Admin API로 동적 상품 무한 생성 (몰 DB 오염, 호출 비용, Cafe24 rate limit 소진).
  2. `mall.read_*/write_*` 권한이 묶인 토큰을 가진 백엔드를 임의로 트리거.
- 권고:
  - `Cafe24Mall.allowedOrigins[]` 컬럼을 두고 정확 일치만 허용.
  - checkout 호출에 reCAPTCHA/Turnstile + IP rate limit 결합.
  - DynamicProduct 생성 횟수/IP·세션당 쿼터.

## C-3. Cafe24 client_secret/access_token/refresh_token 평문 저장

- 위치: `prisma/schema.prisma` `Cafe24Mall.clientSecret/accessToken/refreshToken`
- 현황: 모두 평문. KMS/encryption-at-rest layer 없음.
- 영향: DB 백업·로그·SQL 인젝션·읽기 권한 유출 시 모든 연동 몰의 토큰이 즉시 탈취되어 상품/주문/회원 API가 외부에서 호출됨. 영구적 신뢰 손실.
- 권고: 애플리케이션 레이어에서 envelope encryption (예: `node:crypto` AES-256-GCM + KMS 마스터 키). 최소 Postgres `pgcrypto` 확장의 `pgp_sym_encrypt`. 키 회전 정책 정의. <!-- cSpell:ignore pgcrypto -->

## H-1. Cafe24 install 콜백 HMAC 미검증

- 위치: `src/app/api/cafe24/install/route.ts`
- 현황: Cafe24 앱스토어가 install 시 보내는 `hmac`/`timestamp` 파라미터를 검증하지 않음. mall_id를 임의로 위조해 OAuth 플로우 진입 가능.
- 영향: 공격자가 자신의 mall_id로 진입 후 정상 flow를 모방하거나, 피싱용 redirect로 사용 가능. Cafe24 앱 심사 거절 사유.
- 권고: Cafe24 문서의 "App Install Verification" HMAC SHA256 (`client_secret` 기반) 검증 추가, timestamp ±5분 윈도우.

## H-2. mall_id 입력 검증 부재 → SSRF/Subdomain 변조 가능성

- 위치: `src/app/api/cafe24/install/route.ts:9`, `src/lib/cafe24/oauth.ts:11`, `src/lib/cafe24/client.ts:60`
- 현황: 사용자가 보낸 `mall_id`를 그대로 `https://${mallId}.cafe24api.com/...` 템플릿에 삽입. 정규식 검증(`^[a-z0-9]{3,20}$` 등) 없음.
- 영향: `..`, `@`, `:`, `#`, `/` 등 특수문자가 들어간 mall_id로 URL 파싱 우회 → 비정상 호스트 호출(SSRF) 또는 OAuth flow 변조.
- 권고: mall_id 화이트리스트 정규식 검증 + URL 파싱 후 hostname이 `*.cafe24api.com`인지 재확인.

## H-3. OAuth state 쿠키 — multi-mall 상호 덮어쓰기 / scope 부족

- 위치: `src/app/api/cafe24/install/route.ts:28`
- 현황: 단일 쿠키 이름 `cafe24_oauth_state`에 `state:mallId`만 저장. 동시 install 시 마지막 것이 덮어씀. `__Host-` prefix 없음.
- 권고: `__Host-cafe24_oauth_state_<mallId>` 형태 또는 서명된 JWT, 그리고 redirect_uri/scope hash 포함.

## H-4. 동적 상품 생성 남용 (자원 고갈/비용 공격)

- 위치: `src/app/api/shop/products/[cafe24ProductNo]/checkout/route.ts`
- 현황: 인증 없이 호출하면 매번 `prisma.dynamicProduct.create` + Cafe24 `POST /admin/products`. TTL은 60분이지만 정리 배치/한도 없음.
- 영향: 무인증 D-DoS → DB 폭증 + Cafe24 rate limit 소진 + 몰 관리자 화면 오염.
- 권고: 세션·IP·mall당 quota, exponential backoff, BotID/Turnstile, idempotency key.

## H-5. 관리자 페이지에 토큰/시크릿 노출 가능성

- 위치: `src/app/admin/malls/page.tsx` (확인 권장)
- 현황: 관리자 인증이 없는 상태에서 `Cafe24Mall` row를 SSR 렌더링하면 `clientSecret`·`accessToken`이 HTML에 직렬화될 수 있음.
- 권고: Prisma `select` 화이트리스트, DTO 변환 강제, 토큰류는 절대 클라이언트로 송출 금지.

## M-1. 에러 응답 정보 노출

- 위치: `cafe24/oauth/callback/route.ts:101`, `cafe24/client.ts:581`, `checkout/route.ts:354`
- 현황: 업스트림 에러 본문(`err.message` / `text`)을 그대로 클라이언트에 반환. Cafe24 응답에 토큰/내부 ID가 들어있을 수 있음.
- 권고: 일반화된 에러 메시지 + 서버 로그로만 상세 보존.

<!-- cSpell:ignore HSTS -->

## M-2. CSP/HSTS/Permissions-Policy 등 보안 헤더 부재

- 위치: `next.config.ts`
- 권고: `headers()` 또는 `vercel.ts`에서 CSP, HSTS(`max-age=63072000; includeSubDomains; preload`), `X-Frame-Options: DENY`(또는 frame-ancestors), Referrer-Policy 적용.

## M-3. embed.js 무결성/출처 검증 없음

- 위치: `src/app/embed.js/route.ts`
- 현황: `Cache-Control: max-age=60`, `Allow-Origin: *`, SRI/버전 해시 없음. 관리자가 어느 몰에 임베드했는지 추적 불가.
- 권고: 빌드 시점 해시를 URL에 포함, 필요 시 `referer` allow-list와 결합.

## M-4. embed.js Shadow DOM 외부 데이터 → innerHTML 사용

- 위치: `src/app/embed.js/route.ts:840` `container.innerHTML = html`
- 현황: `escapeHtml`로 옵션 라벨 escape 처리는 되어 있으나, 향후 라벨에 HTML/마크다운 허용 추가 시 XSS 발생 가능. `state.error`도 일부 escape 후 삽입.
- 권고: 가능한 부분은 DOM API(`textContent`, `createElement`)로 전환. innerHTML 사용 부위는 escape 누락 회귀 방지 테스트.

## M-5. quote/checkout 입력 검증 한계

- 위치: `quote/route.ts:14`, `checkout/route.ts:14`
- 현황: `selections.max(50)`만 있고 `groupId`/`itemId` 길이/형식 검증 없음. 동일 group에 50개 동일 selection을 반복하면 N² 검증 비용. (현재 로직은 set으로 short-circuit하나 입력 파싱은 통과)
- 권고: groupId/itemId `cuid()` 패턴 검증, selections `unique` 강제.

## M-6. Prisma — N+1·트랜잭션 미사용

- 위치: `checkout/route.ts:300-330`
- 현황: dynamicProduct create → Cafe24 API → update 사이가 트랜잭션 아님. Cafe24 등록은 성공했으나 update 실패 시 orphan 발생. 보상 트랜잭션(`deleteDynamicProduct`)은 정의돼 있으나 호출되지 않음.
- 권고: try/catch에서 Cafe24 보상 삭제 호출 또는 outbox 패턴.

## L-1. dynamic product name 식별자 노출

- 위치: `checkout/route.ts:317` `${product.name} #${dyn.id.slice(-6)}`
- 영향: cuid 일부 노출 — 추측 공격 표면 미미.

## L-2. Node `crypto.randomBytes` 동기 호출

- 위치: `install/route.ts:23`
- 영향: 16바이트라 미미. `randomUUID` 권장.

## L-3. `pnpm-lock.yaml` lock & dependency audit 정책 부재

- 권고: GH `pnpm audit` CI step.

---

## 우선순위 조치 로드맵

1. **Day 0**: C-1, C-2 (admin auth + CORS allowlist + checkout rate limit) — 외부 노출 차단.
2. **Day 1-3**: C-3 (시크릿 암호화), H-1·H-2 (Cafe24 install 검증, mall_id sanitize).
3. **Week 1**: H-3·H-4·H-5, M-1·M-2.
4. **Week 2+**: M-3~M-6, L 항목.

## 검증 방법

- 차단: `curl` 외부 origin → checkout 200이면 fail.
- 토큰 암호화: DB row에서 평문 토큰이 보이면 fail.
- HMAC: 임의 mall_id 로 install 호출 시 401이어야 함.
- Rate limit: 동일 IP 100회/분 호출 시 429.

## 교차 검증

이 문서는 1차 평가다. `senior-security-reviewer` 서브에이전트로 독립 재검토하고 누락/오판을 보강한다.

---

# 부록 A. 시니어 보안 에이전트 교차 검증 결과 (2026-04-08)

## 등급 조정

| 1차 항목               | 조정         | 사유                                                                                                                                      |
| ---------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| H-5 (관리자 토큰 노출) | **→ C-B**    | `admin/malls/page.tsx`가 `select` 화이트리스트 없이 `findMany()` 호출. RSC payload에 `clientSecret/accessToken/refreshToken` 직렬화 확정. |
| H-2 (mall_id sanitize) | **→ C 후보** | callback 경로에서 `client_secret`이 임의 host로 POST되는 SSRF. 단순 SSRF가 아니라 시크릿 외부 유출.                                       |
| M-1 (에러 노출)        | **→ H-F**    | Cafe24 raw 응답이 `err.message`로 클라이언트에 그대로 반환. 내부 식별자/필드명/스코프 누출.                                               |
| M-6 (트랜잭션 미사용)  | **→ H-E**    | Cafe24 등록 성공 + DB update 실패 시 `deleteDynamicProduct` 보상 호출 누락 → orphan 누적.                                                 |

## 신규 항목

- **H-G**: `Cafe24Mall.storefrontOrigin`을 Cafe24 응답(`primary_domain`)에서 그대로 신뢰. protocol whitelist(`https:`) 검증 부재 → 향후 form action/redirect 회귀 표면.
- **M-E**: `oauth/callback`이 매 콜백마다 `clientId/clientSecret`을 DB upsert. 단일 client 모델인데 DB에 보관 자체가 회전 정책과 충돌.
- **M-F**: state cookie `__Host-` prefix 미사용. staging 환경에서 `secure=false`.
- **M-G**: checkout이 `prisma.create → cafe24 fetch → prisma.update` 동기 직렬. 동시 요청 폭증 시 Prisma pool 고갈. Queue/Workflow 권장.
- **L-D**: `cafe24Fetch`가 만료시간 기반 갱신만 함. 시계 오차로 401 발생 시 재시도 없음.
- **L-E**: `oauth/callback` 의 `cookie.split(":")` 가 state hex 가정. 가정 명시 필요.

## Day 0 차단 범위(조정)

**최소 6건**: C-1(관리자 인증) + C-B(select 화이트리스트, 1줄 패치) + C-2(CORS allowlist + checkout 차단) + C-3(시크릿 암호화 착수) + H-1(install HMAC) + H-2(mall_id regex + hostname 재검증).

---

# 부록 B. 운영 모델 반영 — 다대일 / 1인 다견적

## 운영 모델 (확인)

- **디스플레이 상품(Product) ↔ 동적 상품(DynamicProduct)** 은 1:N. 한 디스플레이 상품에 여러 옵션 조합이 모두 별개 동적 상품으로 등록됨.
- **1명의 고객이 여러 견적**을 동시에/연속으로 주문 가능. 같은 옵션 조합으로도 시점에 따라 가격/구성이 달라질 수 있으므로 dedupe가 단순 selection hash로 끝나면 안 됨.
- **주문 주체와 견적 생성 주체가 분리**되지 않음 (현재 무인증). 따라서 "한 사람이 여러 견적을 만든다"는 것이 정상 트래픽이고, 이를 악용 트래픽과 구분할 신호가 없다.

## 이 모델이 만드는 추가 위험

### C-2 (CORS/checkout 남용) — 영향 재평가

- 기존 권고였던 "selection hash dedupe"는 **사용 불가**. 정상 사용자도 동일 옵션을 의도적으로 여러 번 견적할 수 있음. 따라서 abuse 차단은 dedupe가 아닌 **rate-limit + 비용 기반 throttle + bot 검증**에 의존해야 한다.
- 결론: H-D의 mitigation 우선순위가 더 높아짐. Turnstile/BotID 필수.

### H-E (보상 트랜잭션) — 영향 재평가

- 한 디스플레이 상품에 N개 동적 상품이 정상적으로 누적되는 모델이므로, **orphan과 정상 누적이 외형상 구분 불가**. cleanup 배치가 잘못 동작하면 정상 IN_CART 상품을 지울 수 있음.
- 권고:
  1. `DynamicProduct.status` 외에 **명시적 lifecycle** (`CREATED → REGISTERED → IN_CART → ORDERED → ARCHIVED|FAILED`) 정의.
  2. `expiresAt`은 `IN_CART` 진입 후 60분, `ORDERED` 전이 후에는 무한 보존.
  3. sweeper는 `(status IN ('CREATED','REGISTERED') AND expiresAt < now)` 만 대상.
  4. Cafe24 측에는 sweep 시 반드시 `deleteDynamicProduct` 호출.

### 신규 위험: **N-1. 동적 상품 ↔ 주문 매칭 무결성**

- 위치: `checkout/route.ts` + (현재 미구현) order webhook 처리
- 현황: DynamicProduct가 어느 Cafe24 order로 결제됐는지 추적할 컬럼이 schema에 없음 (`orderId`, `paidAt` 등). 한 사람이 여러 견적 중 일부만 결제하면, 미결제 견적과 결제된 견적을 구분할 근거가 Cafe24 webhook 없이는 없음.
- 영향:
  1. 가격 변조 검증 사후 불가 — 결제 완료된 동적 상품의 `finalPrice` 가 실제 결제 금액과 일치하는지 감사 불가.
  2. 환불·취소 처리 시 어느 DynamicProduct를 ARCHIVED로 둘지 결정 불가.
  3. **재고/한정 옵션** 도입 시 race condition (동일 옵션 N건 동시 견적 후 1건만 결제, 나머지는 그대로 카트에 잠김).
- 권고:
  - `DynamicProduct`에 `cafe24OrderId`, `paidAmount`, `paidAt`, `cancelledAt` 컬럼 추가.
  - Cafe24 order webhook 구독(`order_created`, `order_paid`, `order_cancelled`) → 매칭 키는 `custom_product_code = DynamicProduct.id` 활용 (이미 `dynamic-product.ts`에 customCode 필드 존재).
  - 결제 금액 ≠ `finalPrice` 시 알람 (변조 의심).
  - 한정 옵션은 견적 생성 시 soft-reserve, TTL 만료/결제 시 해제.

### 신규 위험: **N-2. 1인 다견적 — 동일 카트 내 동적 상품 충돌**

- 위치: `dynamic-product.ts:buildAddToCartUrl` / `buildAddToCartFormHtml`
- 현황: `duplicated_item_check=F`로 강제 추가하지만, Cafe24 카트는 `product_no` 단위. 동일 사용자가 다른 견적을 연속 생성하면 카트에 N개의 [DYN] 상품이 쌓임. 사용자가 카트에서 일부만 삭제할 경우 우리 DB의 `IN_CART` 상태와 어긋남.
- 권고:
  - 카트 진입 직후 `DynamicProduct.status = HANDED_OFF` 로 변경 (우리는 카트 내부 상태를 알 수 없음).
  - 위 N-1의 webhook으로만 `ORDERED` 확정.
  - 사용자에게 "이전 견적이 카트에 남아 있을 수 있음" 안내.

### 신규 위험: **N-3. 견적 단계의 옵션 스냅샷 부재**

- 위치: `prisma/schema.prisma` `DynamicProduct.selectedOptions Json`
- 현황: 선택된 `groupId/itemId` 만 저장. 견적 시점의 `label`, `addPrice`, `basePrice` 스냅샷이 없음. 관리자가 옵션 가격을 수정한 직후 결제되면 결제 금액과 견적 시점 금액의 인과관계 추적 불가.
- 권고: `DynamicProduct.priceBreakdown Json` (basePrice, options[{groupName,label,addPrice}], finalPrice, calculatedAt) 추가. 이는 가격 변조 분쟁·환불·세무 감사에 필수.

### 신규 위험: **N-4. 견적-체크아웃 원자성 (TOCTOU)**

- 위치: `checkout/route.ts:75-105`
- 현황: 같은 selection으로 quote 응답을 받은 직후 관리자가 `OptionItem.addPrice` 또는 `enabled=false`로 수정하면, checkout 시점에 `calculateQuote`가 다른 가격을 반환. 클라이언트는 이전 가격을 본 채 결제 진입.
- 권고:
  - `quote` 응답에 `quoteId`(서명된 토큰, 5분 TTL, payload=resolvedItems+finalPrice)를 발급.
  - `checkout`은 `quoteId`만 받고 서버 측 재계산 결과와 비교, 불일치 시 422.
  - 1인 다견적 모델에서는 quote ↔ checkout 매칭이 핵심 무결성 포인트.

## 우선순위 추가

- **Day 1-3**: N-3(스냅샷), N-4(quoteId 서명) — 가격 무결성 직결.
- **Week 1**: N-1(webhook + orderId), N-2(상태 머신).
- **Week 2+**: 한정 옵션 reserve.
