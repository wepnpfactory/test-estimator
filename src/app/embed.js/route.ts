import { NextRequest } from "next/server";

// 쇼핑몰 상품 상세 페이지에 삽입되는 부트스트랩 JS.
//
// 사용:
//   <script
//     src="https://<app>/embed.js"
//     data-mall-id="hitedin"
//     data-product-no="123"
//     async></script>
//
// data-* 미지정 시 Cafe24 표준 전역(window.iProductNo, aLogData.mid)을 폴백으로 사용한다.
//
// MVP 구조:
//   - script 다음 노드에 #test-estimator-root 컨테이너를 생성하고 Shadow DOM 부착
//   - schema → quote → checkout → 자동 form POST 로 장바구니 진입
//   - cartForm.fields 에 wepnpSeqno / fileUpload 추가옵션 값이 있으면 함께 전송

export async function GET(req: NextRequest) {
  const origin = `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  const js = buildEmbedScript(origin);
  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function buildEmbedScript(apiOrigin: string): string {
  return `(function(){
  var API = ${JSON.stringify(apiOrigin)};
  var script = document.currentScript;
  if (!script) { console.warn('[test-estimator] document.currentScript not available (async/defer?)'); return; }

  var mallId = script.getAttribute('data-mall-id') || (window.aLogData && window.aLogData.mid) || '';
  var productNo = script.getAttribute('data-product-no') || window.iProductNo || '';
  if (!mallId || !productNo) {
    console.warn('[test-estimator] missing mallId/productNo');
    return;
  }

  if (!window.HTMLElement || !document.body || !document.body.attachShadow) {
    console.warn('[test-estimator] Shadow DOM 미지원 환경 — 폼을 렌더하지 않습니다.');
    return;
  }

  var host = document.getElementById('test-estimator-root');
  if (!host) {
    host = document.createElement('div');
    host.id = 'test-estimator-root';
    script.parentNode.insertBefore(host, script.nextSibling);
  }
  var root = host.attachShadow({mode:'open'});

  var style = document.createElement('style');
  style.textContent = [
    ':host{all:initial}',
    '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}',
    '.te-wrap{padding:16px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;}',
    '.te-title{font-size:14px;font-weight:600;margin:0 0 12px;color:#111}',
    '.te-row{margin-bottom:10px}',
    '.te-label{display:block;font-size:12px;color:#555;margin-bottom:4px}',
    '.te-select{width:100%;padding:8px;border:1px solid #d4d4d8;border-radius:6px;font-size:14px;background:#fff}',
    '.te-price{margin-top:14px;padding:12px;background:#f4f4f5;border-radius:6px;font-size:14px;display:flex;justify-content:space-between;align-items:center}',
    '.te-price b{font-size:18px;color:#111}',
    '.te-btn{margin-top:12px;width:100%;padding:12px;border:0;border-radius:6px;background:#111;color:#fff;font-size:14px;font-weight:600;cursor:pointer}',
    '.te-btn:disabled{background:#a1a1aa;cursor:not-allowed}',
    '.te-error{margin-top:8px;color:#dc2626;font-size:12px}',
    '.te-loading{padding:16px;color:#888;font-size:13px;text-align:center}'
  ].join('');
  root.appendChild(style);

  var container = document.createElement('div');
  container.className = 'te-wrap';
  container.innerHTML = '<div class="te-loading">옵션을 불러오는 중...</div>';
  root.appendChild(container);

  var BASE_PATH = '/api/shop/' + encodeURIComponent(mallId) + '/products/' + encodeURIComponent(productNo);
  var state = { schema: null, selections: {}, quote: null, busy: false, error: null };

  function fmtPrice(n){ return (n||0).toLocaleString('ko-KR') + '원'; }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
  }

  function render(){
    if (!state.schema) return;
    var html = '<div class="te-title">옵션 선택</div>';
    state.schema.optionGroups.forEach(function(g){
      html += '<div class="te-row">'
        + '<label class="te-label">' + escapeHtml(g.name) + (g.required?' *':'') + '</label>'
        + '<select class="te-select" data-group="' + escapeHtml(g.id) + '">'
        + '<option value="">선택해 주세요</option>'
        + g.items.map(function(it){
            var sel = state.selections[g.id] === it.id ? ' selected' : '';
            var add = it.addPrice ? ' (+' + fmtPrice(it.addPrice) + ')' : '';
            return '<option value="' + escapeHtml(it.id) + '"' + sel + '>' + escapeHtml(it.label) + add + '</option>';
          }).join('')
        + '</select></div>';
    });
    var price = state.quote ? state.quote.finalPrice : state.schema.basePrice;
    html += '<div class="te-price"><span>예상 결제금액</span><b>' + fmtPrice(price) + '</b></div>';
    html += '<button class="te-btn"' + (state.busy?' disabled':'') + '>구매하기</button>';
    if (state.error) html += '<div class="te-error">' + escapeHtml(state.error) + '</div>';
    container.innerHTML = html;

    container.querySelectorAll('select').forEach(function(sel){
      sel.addEventListener('change', function(){
        var gid = sel.getAttribute('data-group');
        if (sel.value) state.selections[gid] = sel.value;
        else delete state.selections[gid];
        requestQuote();
      });
    });
    container.querySelector('button').addEventListener('click', checkout);
  }

  function selectionPayload(){
    return Object.keys(state.selections).map(function(gid){
      return { groupId: gid, itemId: state.selections[gid] };
    });
  }

  function requestQuote(){
    var sel = selectionPayload();
    var requiredCount = state.schema.optionGroups.filter(function(g){return g.required}).length;
    if (sel.length < requiredCount) { state.quote = null; state.error = null; render(); return; }
    fetch(API + BASE_PATH + '/quote', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({selections: sel})
    }).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}});})
      .then(function(res){
        if (!res.ok) { state.error = (res.d.errors||[]).join(', ') || res.d.error || '계산 실패'; state.quote = null; }
        else { state.quote = res.d; state.error = null; }
        render();
      }).catch(function(){ state.error = '네트워크 오류'; render(); });
  }

  function submitCartForm(spec){
    // spec: { action, method, fields }
    var form = document.createElement('form');
    form.method = (spec.method || 'POST').toLowerCase() === 'post' ? 'POST' : 'GET';
    form.action = spec.action;
    form.style.display = 'none';
    Object.keys(spec.fields || {}).forEach(function(k){
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = spec.fields[k];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  }

  function checkout(){
    var sel = selectionPayload();
    if (sel.length === 0) { state.error = '옵션을 선택해 주세요'; render(); return; }
    state.busy = true; state.error = null; render();
    var payload = { selections: sel };
    // 향후: window.CAFE24API.getMemberID() 결과를 customer.id 로 전달
    // 향후: 디자인 에디터/파일 업로드 결과를 designNo / file 로 전달
    fetch(API + BASE_PATH + '/checkout', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    }).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}});})
      .then(function(res){
        state.busy = false;
        if (!res.ok) { state.error = res.d.error || '주문 생성 실패'; render(); return; }
        // 우선순위: cartForm POST → cartUrl GET 폴백
        if (res.d.cartForm && res.d.cartForm.fields) {
          submitCartForm(res.d.cartForm);
        } else if (res.d.cartUrl) {
          window.location.href = res.d.cartUrl;
        } else {
          state.error = '장바구니 진입 정보가 없습니다';
          render();
        }
      }).catch(function(){ state.busy = false; state.error = '네트워크 오류'; render(); });
  }

  fetch(API + BASE_PATH)
    .then(function(r){return r.ok ? r.json() : Promise.reject(r);})
    .then(function(data){ state.schema = data; render(); })
    .catch(function(){ container.innerHTML = '<div class="te-error">옵션 정보를 불러올 수 없습니다.</div>'; });
})();
`;
}
