import { NextRequest } from "next/server";

// 쇼핑몰 상품 상세 페이지에 삽입되는 부트스트랩 JS.
// <script src="https://<app>/embed.js" data-product-no="..."></script>
// - script 태그 바로 뒤에 #test-estimator-root 생성 (이미 있으면 재사용)
// - Shadow DOM 내부에 옵션 폼 렌더
// - quote / checkout API 호출
//
// MVP 수준이라 빌드 파이프라인 없이 단일 문자열로 서빙한다.

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
  if (!script) return;
  var productNo = script.getAttribute('data-product-no');
  if (!productNo) { console.warn('[test-estimator] data-product-no missing'); return; }

  var host = document.getElementById('test-estimator-root');
  if (!host) {
    host = document.createElement('div');
    host.id = 'test-estimator-root';
    script.parentNode.insertBefore(host, script.nextSibling);
  }
  var root = host.attachShadow ? host.attachShadow({mode:'open'}) : host;

  var style = document.createElement('style');
  style.textContent = [
    ':host,*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,sans-serif;}',
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

  var state = { schema: null, selections: {}, quote: null, busy: false };

  function fmtPrice(n){ return (n||0).toLocaleString('ko-KR') + '원'; }

  function render(){
    if (!state.schema) return;
    var html = '<div class="te-title">옵션 선택</div>';
    state.schema.optionGroups.forEach(function(g){
      html += '<div class="te-row">'
        + '<label class="te-label">' + escapeHtml(g.name) + (g.required?' *':'') + '</label>'
        + '<select class="te-select" data-group="' + g.id + '">'
        + '<option value="">선택해 주세요</option>'
        + g.items.map(function(it){
            var sel = state.selections[g.id] === it.id ? ' selected' : '';
            var add = it.addPrice ? ' (+' + fmtPrice(it.addPrice) + ')' : '';
            return '<option value="' + it.id + '"' + sel + '>' + escapeHtml(it.label) + add + '</option>';
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

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
    });
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
    fetch(API + '/api/shop/products/' + productNo + '/quote', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({selections: sel})
    }).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}});})
      .then(function(res){
        if (!res.ok) { state.error = (res.d.errors||[]).join(', ') || res.d.error || '계산 실패'; state.quote = null; }
        else { state.quote = res.d; state.error = null; }
        render();
      }).catch(function(e){ state.error = '네트워크 오류'; render(); });
  }

  function checkout(){
    var sel = selectionPayload();
    if (sel.length === 0) { state.error = '옵션을 선택해 주세요'; render(); return; }
    state.busy = true; state.error = null; render();
    fetch(API + '/api/shop/products/' + productNo + '/checkout', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({selections: sel})
    }).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}});})
      .then(function(res){
        state.busy = false;
        if (!res.ok) { state.error = res.d.error || '주문 생성 실패'; render(); return; }
        window.location.href = res.d.cartUrl;
      }).catch(function(){ state.busy = false; state.error = '네트워크 오류'; render(); });
  }

  fetch(API + '/api/shop/products/' + productNo)
    .then(function(r){return r.ok ? r.json() : Promise.reject(r);})
    .then(function(data){ state.schema = data; render(); })
    .catch(function(){ container.innerHTML = '<div class="te-error">옵션 정보를 불러올 수 없습니다.</div>'; });
})();
`;
}
