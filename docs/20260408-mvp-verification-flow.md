# 20260408 — 검증용 MVP 설계

본 문서는 `test-estimator` 프로젝트의 **최초 검증용 MVP** 범위를 정의한다.
목표는 "가변 옵션 상품 → 동적 Cafe24 상품 생성 → 장바구니 유입"의 전 과정을
end-to-end 로 한 번 돌려보는 것이다. 실제 운영 수준의 디테일(인증, 권한, 에러
복구, 재고 동기화 등)은 이 단계에서 다루지 않는다.

## 1. 용어

| 용어 | 정의 |
|---|---|
| **겉보기 상품 (Facade Product)** | Cafe24 몰에 실제로 등록되어 있고, 쇼핑객이 상세 페이지로 진입하는 "간판" 상품. 이 상품의 원래 옵션은 사용하지 않거나 최소한으로 유지. |
| **자체 옵션 (Custom Options)** | 겉보기 상품에는 존재하지 않고, test-estimator가 관리하는 책자·굿즈용 세부 옵션들. |
| **동적 주문 상품 (Dynamic Product)** | 고객이 "구매하기"를 누른 시점에 계산된 최종 가격으로 Cafe24에 즉시 등록되는 **미진열 일회용 상품**. 해당 고객만 장바구니에 담는 용도. |
| **연결 (Binding)** | 겉보기 상품 ↔ test-estimator Product 레코드의 1:1 매핑. |

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
   - `GET  /api/shop/products/:cafe24ProductNo` — 해당 겉보기 상품에 바인딩된 자체 옵션 스키마 JSON 반환
   - `POST /api/shop/products/:cafe24ProductNo/quote` — 선택된 옵션 조합을 받아 최종 가격 계산 결과 반환
   - `POST /api/shop/products/:cafe24ProductNo/checkout` — 최종 선택으로 동적 Cafe24 상품 등록 후 장바구니 URL 반환
3. **쇼핑몰 삽입형 옵션 Form (JS 스크립트 임베드)**
   - MVP부터 JS 스크립트 주입 방식으로 구현 (iframe 사용하지 않음)
   - 쇼핑몰 측에 `<script src="https://<app>/embed.js" data-product-no="..."></script>` 한 줄 삽입
   - `embed.js` 는 지정 엘리먼트(기본 `#test-estimator-root`, 없으면 script 바로 뒤)에 Shadow DOM 컨테이너 생성 후 폼 렌더
   - 현재는 모든 옵션을 `<select>` / `<input type="number">` 로만 렌더
   - 향후: 이미지 스와치, 경고 배너, 수량 제한 안내 등 다양한 컴포넌트 타입 지원 (`OptionGroup.displayType` 확장)
4. **겉보기 상품 정책**
   - 겉보기 상품은 상품 카드/상세의 **기본가·최저가 노출용**으로만 사용
   - 겉보기 상품에 붙어 있는 Cafe24 자체 옵션/입력 옵션은 **무시** (고객이 건드려도 동적 상품 생성 시 참조하지 않음)
   - 겉보기 상품 상세 페이지의 기본 "구매하기/장바구니" 버튼은 숨기거나 비활성화 (쇼핑몰 측 CSS 또는 embed.js가 대체 버튼 제공)
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
│  (겉보기 상품 페이지)  │     │  (Next.js on Vercel)  │     │                    │
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
- [ ] 테스트몰 겉보기 상품 상세페이지에 `<script src=".../embed.js" data-product-no="...">` 삽입 후 옵션 폼 렌더 확인
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
