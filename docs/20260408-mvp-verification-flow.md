# 20260408 — 검증용 MVP 설계

본 문서는 `test-estimator` 프로젝트의 **최초 검증용 MVP** 범위를 정의한다.
목표는 "가변 옵션 상품 → 동적 Cafe24 상품 생성 → 장바구니 유입"의 전 과정을
end-to-end 로 한 번 돌려보는 것이다. 실제 운영 수준의 디테일(인증, 권한, 에러
복구, 재고 동기화 등)은 이 단계에서 다루지 않는다.

## 0. 핵심 제약 및 설계 결정

### 0.1 Cafe24 옵션 갯수 한계
- **Cafe24는 한 상품의 옵션 조합 가짓수가 1000개로 제한된다.**
- 책자/굿즈처럼 (표지 재질 × 페이지 수 × 제본 × 사이즈 × 코팅 × …) 옵션 카테고리가 많으면 조합 수가 1000개를 쉽게 초과한다.
- 따라서 디스플레이 상품 하나에 모든 옵션 조합을 사전 등록하는 방식은 **원천적으로 불가능**하다.

### 0.2 동적 상품 생성 방식 채택 이유
- 디스플레이 상품은 **카탈로그·최저가 노출용**으로만 사용한다. 자체 옵션·가격은 여기에 담지 않는다.
- 고객이 자체 옵션 폼에서 선택한 조합 → test-estimator가 최종 가격을 계산 → **그 조합 전용 일회용 상품**을 Cafe24에 즉시 등록 → 그 상품만 장바구니에 담아 결제로 넘긴다.
- 즉 **결제 대상은 항상 동적으로 만든 1개짜리 상품**이며, 이렇게 해야 고객이 선택한 옵션·견적이 결제·주문·매출 데이터에 정확히 반영된다.
- 대안(추가옵션 input 주입 방식)은 가격 가산 표현이 제한적이고 1000 조합 한도를 우회할 수 없으므로 본 프로젝트에는 부적합하다.

### 0.3 카디널리티 (1:N 정책)
- **Cafe24 facade product → test-estimator Product : 1:N**
  - 같은 facade에 여러 옵션 설정(예: 책자A / 책자B 변형)을 둘 수 있다.
  - embed 시점에 어떤 Product 설정을 쓸지 식별자를 함께 전달해야 한다.
- **Product → DynamicProduct : 1:N**
  - 같은 옵션 조합이라도 매번 새 DynamicProduct를 만든다 (캐싱·재사용 금지).
  - 고객이 다르면 첨부 파일·디자인 번호가 다르므로 동일 옵션도 별개 동적 상품.
- **DynamicProduct → Cafe24 일회용 상품 : 1:1, 단 1회성**
  - 주문 완료가 감지되면 즉시 `selling = F` 처리(비활성화)해 목록에서 사라지게 한다.
  - 미결제 만료(TTL) 동적 상품은 정리(`DELETE`) cron으로 회수.

### 0.4 첨부 파일 / 디자인 번호 처리
- **표지 디자인 편집 번호(`wepnpSeqno`)**: jarvis 외부 에디터가 발급하는 식별자.
- **디자인 파일 첨부**: 외부 S3에 직접 업로드, test-estimator는 결과 URL/파일명만 보관.
- 두 값은 동적 상품 생성 시 **Cafe24 추가옵션(additional_options)** 으로 함께 등록한다.
  - jarvis dps의 `updateAddOption` 패턴 차용:
    `POST /api/v2/admin/products/{no}/options` → `use_additional_option: T`,
    `additional_options: [{ name: "wepnpSeqno", text }, { name: "fileUpload", text }]`
  - 장바구니 담기 시 위 추가옵션 값으로 `wepnpSeqno`와 `<a href="S3 URL">파일명</a>` 문자열을 전달해 주문서에 기록되게 한다.
- 관리자는 주문 동기화 후 주문 항목의 추가옵션 값으로 디자인 파일·편집번호에 접근해 생산 진행.

### 0.5 주문 동기화 (웹훅 미사용)
- Cafe24 주문 웹훅 대신 **관리자가 명시적으로 호출하는 동기화 작업**으로 처리한다.
  - 이유: 웹훅 등록·검증·재전송 정책 관리 부담을 피하고, 관리자가 "주문이 들어왔는지" 능동적으로 확인하는 워크플로우가 생산 현장에 더 잘 맞음.
- 호출 형태: `GET /api/v2/admin/orders?start_date=&end_date=&embed=items,receivers,buyer,return,cancellation,exchange` (KST 기준).
- 동기화 결과 중 우리 동적 상품(`custom_product_code` prefix `DYN-` 매칭)이 포함된 주문이 있으면:
  1. 해당 DynamicProduct status를 `ORDERED`로 전이
  2. 해당 Cafe24 일회용 상품을 `selling: F`로 비활성화 (목록에서 사라짐)
  3. 주문 메타·추가옵션 값(wepnpSeqno, fileUpload) 스냅샷을 보관해 관리자가 생산 단계에서 조회 가능하게 한다.

## 1. 용어

| 용어 | 정의 |
|---|---|
| **디스플레이 상품 (Facade Product)** | Cafe24 몰에 실제로 등록되어 있고, 쇼핑객이 상세 페이지로 진입하는 "간판" 상품. 이 상품의 원래 옵션은 사용하지 않거나 최소한으로 유지. |
| **자체 옵션 (Custom Options)** | 디스플레이 상품에는 존재하지 않고, test-estimator가 관리하는 책자·굿즈용 세부 옵션들. |
| **동적 주문 상품 (Dynamic Product)** | 고객이 "구매하기"를 누른 시점에 계산된 최종 가격으로 Cafe24에 즉시 등록되는 **미진열 일회용 상품**. 해당 고객만 장바구니에 담는 용도. |
| **연결 (Binding)** | facade ↔ Product 의 N:1 매핑. 한 facade에 여러 옵션 설정(Product) 가능. |
| **표지 디자인 편집번호 (`wepnpSeqno`)** | 외부 jarvis 에디터가 발급하는 디자인 식별자. 동적 상품의 추가옵션 값으로 보관. |
| **첨부 파일** | 외부 S3에 업로드된 디자인 원본. test-estimator는 URL·파일명만 보관, 추가옵션의 a 링크 형태로 주문서에 기록. |

## 2. MVP 범위

### 2.1 구현할 것
1. **관리자 화면 (간단)**
   - 좌측 사이드바 + 상단 헤더 레이아웃
   - 페이지:
     - `/admin` 대시보드 (통계는 placeholder)
     - `/admin/products` 연결된 상품 목록
     - `/admin/products/new` 새 연결 생성 (Cafe24 상품 번호 + 기본 옵션 몇 개 입력)
     - `/admin/products/[id]` 옵션 편집
2. **쇼핑몰 → 관리 서버 API** (CORS 허용, 몰 도메인 허용)
   - `GET  /api/shop/products/:cafe24ProductNo` — 해당 디스플레이 상품에 바인딩된 자체 옵션 스키마 JSON 반환
   - `POST /api/shop/products/:cafe24ProductNo/quote` — 선택된 옵션 조합을 받아 최종 가격 계산 결과 반환
   - `POST /api/shop/products/:cafe24ProductNo/checkout` — 최종 선택으로 동적 Cafe24 상품 등록 후 장바구니 URL 반환
3. **쇼핑몰 삽입형 옵션 Form (JS 스크립트 임베드)**
   - MVP부터 JS 스크립트 주입 방식으로 구현 (iframe 사용하지 않음)
   - 쇼핑몰 측에 `<script src="https://<app>/embed.js" data-product-no="..."></script>` 한 줄 삽입
   - `embed.js` 는 지정 엘리먼트(기본 `#test-estimator-root`, 없으면 script 바로 뒤)에 Shadow DOM 컨테이너 생성 후 폼 렌더
   - 현재는 모든 옵션을 `<select>` / `<input type="number">` 로만 렌더
   - 향후: 이미지 스와치, 경고 배너, 수량 제한 안내 등 다양한 컴포넌트 타입 지원 (`OptionGroup.displayType` 확장)
4. **디스플레이 상품 정책**
   - 디스플레이 상품은 상품 카드/상세의 **기본가·최저가 노출용**으로만 사용
   - 디스플레이 상품에 붙어 있는 Cafe24 자체 옵션/입력 옵션은 **무시** (고객이 건드려도 동적 상품 생성 시 참조하지 않음)
   - 디스플레이 상품 상세 페이지의 기본 "구매하기/장바구니" 버튼은 숨기거나 비활성화 (쇼핑몰 측 CSS 또는 embed.js가 대체 버튼 제공)
5. **동적 상품 등록 로직**
   - Cafe24 Admin API `POST /api/v2/admin/products` 호출
   - 진열/검색 모두 숨김 (`display=F`, `selling=T`, `list_icon` 없음 등)
   - 생성 성공 시 `DynamicProduct` 레코드 저장
   - 이어서 장바구니 담기 API 호출 또는 장바구니 딥링크 반환
   - 실패 시 FAILED 상태 기록, 사용자에게 에러 표시

### 2.2 하지 않을 것 (명시적 Out of Scope)
- 관리자 로그인/권한
- 쇼핑몰 도메인 화이트리스트 기반 인증 (MVP에서는 Origin 체크만)
- 재고 실시간 동기화
- 주문 완료 웹훅 수신 및 동적 상품 정리 배치
- 가격 규칙(PriceRule) 엔진 — MVP는 옵션별 addPrice 합산만
- 다국어, 통화 변환
- SEO, 이미지 CDN

## 3. 데이터 흐름

```
┌─────────────────────┐     ┌──────────────────────┐     ┌────────────────────┐
│  Cafe24 쇼핑몰       │     │  test-estimator       │     │  Cafe24 Admin API   │
│  (디스플레이 상품 페이지)  │     │  (Next.js on Vercel)  │     │                    │
└──────────┬──────────┘     └──────────┬───────────┘     └─────────┬──────────┘
           │ 1. iframe embed            │                           │
           │ /embed/:productNo          │                           │
           ├───────────────────────────▶│                           │
           │                            │ 2. GET /api/shop/.../:no  │
           │                            │   → 옵션 스키마            │
           │                            │                           │
           │ 3. 사용자 옵션 선택         │                           │
           │                            │ 4. POST .../quote         │
           │                            │   → 실시간 가격            │
           │                            │                           │
           │ 5. 구매 클릭                │                           │
           │                            │ 6. POST .../checkout      │
           │                            │                           │
           │                            │ 7. 동적 상품 등록          │
           │                            ├──────────────────────────▶│
           │                            │ 8. product_no 반환         │
           │                            │◀──────────────────────────┤
           │                            │                           │
           │ 9. 장바구니 URL 리턴         │                           │
           │◀───────────────────────────┤                           │
           │                            │                           │
           │ 10. /order/basket 으로 이동 │                           │
           ├───────────────────────────────────────────────────────▶│
```

## 4. 파일 구조 계획

```
src/
  app/
    (admin)/
      layout.tsx              # 사이드바 + 헤더
      admin/
        page.tsx              # 대시보드
        products/
          page.tsx            # 목록
          new/page.tsx        # 생성
          [id]/page.tsx       # 편집
    embed.js/
      route.ts                # GET — 쇼핑몰에 삽입되는 부트스트랩 JS 서빙
    api/
      shop/
        products/
          [cafe24ProductNo]/
            route.ts                    # GET (옵션 스키마)
            quote/route.ts              # POST (가격 계산)
            checkout/route.ts           # POST (동적 상품 등록 + 장바구니)
  lib/
    prisma.ts
    cafe24/
      client.ts               # OAuth 토큰 포함한 fetch 래퍼
      create-dynamic-product.ts
      add-to-cart.ts
    pricing/
      calculate.ts            # addPrice 합산 로직 (MVP용)
  components/
    admin/
      sidebar.tsx
      header.tsx
      product-option-editor.tsx
  embed/
    bootstrap.ts              # 쇼핑몰 페이지에서 실행되는 진입점 (IIFE로 번들)
    option-form.ts            # 옵션 렌더러 (Shadow DOM 내부)
```

## 5. 검증 체크리스트

- [ ] 관리자에서 Cafe24 테스트몰의 상품번호로 Product 생성
- [ ] OptionGroup 2~3개, OptionItem 몇 개 등록
- [ ] 테스트몰 디스플레이 상품 상세페이지에 `<script src=".../embed.js" data-product-no="...">` 삽입 후 옵션 폼 렌더 확인
- [ ] 옵션 변경 시 /quote 호출로 가격이 실시간 갱신
- [ ] "구매하기" 클릭 → /checkout 호출 → Cafe24 테스트몰에 미진열 상품 생성 확인
- [ ] DynamicProduct 레코드에 product_no 기록됨
- [ ] 반환된 장바구니 URL로 이동 → 생성된 상품이 담긴 상태 확인

## 6. 다음 단계 예고 (MVP 이후)

- 컴포넌트 타입 확장 (이미지 스와치, 경고 배너, 조건부 노출)
- PriceRule 엔진
- 미결제 동적 상품 만료 정리 cron
- 관리자 인증
- Cafe24 앱스토어 등록용 OAuth install 플로우
