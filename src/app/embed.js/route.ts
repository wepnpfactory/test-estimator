import { NextRequest } from "next/server";

// 쇼핑몰 상품 상세 페이지에 삽입되는 부트스트랩 JS.
//
// 사용법 (간단):
//   <script src="https://<app>/embed.js" async></script>
//
// 명시적 지정도 가능:
//   <script
//     src="https://<app>/embed.js"
//     data-mall-id="hitedin"
//     data-product-no="123"
//     data-anchor="#totalPrice"></script>
//
// 자동 컨텍스트 감지 (jarvis dps/product-detail.js 패턴):
//   - mallId    = data-mall-id || window.aLogData.mid
//   - productNo = data-product-no || window.iProductNo
//   - anchor    = data-anchor || #totalPrice || .totalPrice || script.nextSibling
//   - memberId  = window.CAFE24API.getMemberID() (있으면 customer.id 로 전달)

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
  return /* js */ `(function(){
  var API = ${JSON.stringify(apiOrigin)};
  var script = document.currentScript;
  if (!script) { console.warn('[test-estimator] document.currentScript not available'); return; }

  function ready(fn){
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      setTimeout(fn, 0);
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  function pickContext(){
    var mallId = script.getAttribute('data-mall-id')
      || (window.aLogData && window.aLogData.mid)
      || '';
    var productNo = script.getAttribute('data-product-no') || window.iProductNo || '';
    return { mallId: String(mallId), productNo: String(productNo) };
  }

  function findAnchor(){
    var custom = script.getAttribute('data-anchor');
    if (custom) {
      var el = document.querySelector(custom);
      if (el) return el;
    }
    return document.querySelector('#totalPrice')
      || document.querySelector('.totalPrice')
      || document.querySelector('#span_product_price_text')
      || null;
  }

  function getMemberId(){
    try {
      if (window.CAFE24API && typeof window.CAFE24API.getMemberID === 'function') {
        return new Promise(function(resolve){
          var done = false;
          var timer = setTimeout(function(){ if (!done) { done = true; resolve(''); } }, 1500);
          window.CAFE24API.getMemberID(function(id){
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve(id || '');
          });
        });
      }
    } catch (e) {}
    return Promise.resolve('');
  }

  function init(){
    var ctx = pickContext();
    if (!ctx.mallId || !ctx.productNo) {
      console.warn('[test-estimator] missing mallId/productNo (set data-* or rely on window.iProductNo/aLogData.mid)');
      return;
    }
    if (!document.body || !document.body.attachShadow) {
      console.warn('[test-estimator] Shadow DOM 미지원 환경 — 렌더 생략');
      return;
    }

    var host = document.getElementById('test-estimator-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'test-estimator-root';
      var anchor = findAnchor();
      if (anchor && anchor.parentNode) {
        anchor.parentNode.insertBefore(host, anchor);
      } else {
        script.parentNode.insertBefore(host, script.nextSibling);
      }
    }
    var root = host.attachShadow({mode:'open'});

    var style = document.createElement('style');
    style.textContent = [
      ':host{all:initial;display:block;margin:12px 0}',
      '*{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}',
      '.te-wrap{padding:16px;border:1px solid #e5e7eb;border-radius:10px;background:#fff;color:#111}',
      '.te-title{font-size:14px;font-weight:600;margin:0 0 12px}',
      '.te-row{margin-bottom:10px}',
      '.te-label{display:block;font-size:12px;color:#555;margin-bottom:4px}',
      '.te-select{width:100%;padding:9px 10px;border:1px solid #d4d4d8;border-radius:7px;font-size:14px;background:#fff}',
      '.te-price{margin-top:14px;padding:12px 14px;background:#f4f4f5;border-radius:8px;font-size:14px;display:flex;justify-content:space-between;align-items:center}',
      '.te-price b{font-size:18px}',
      '.te-btn{margin-top:12px;width:100%;padding:13px;border:0;border-radius:8px;background:#111;color:#fff;font-size:14px;font-weight:600;cursor:pointer}',
      '.te-btn:disabled{background:#a1a1aa;cursor:not-allowed}',
      '.te-error{margin-top:8px;color:#dc2626;font-size:12px}',
      '.te-loading{padding:18px;color:#888;font-size:13px;text-align:center}',
      '.te-dim-row{display:flex;align-items:center;gap:6px}',
      '.te-dim-input{width:80px;padding:8px;border:1px solid #d4d4d8;border-radius:6px;font-size:14px;background:#fff}',
      '.te-dim-x{color:#888;font-size:14px}',
      '.te-dim-unit{color:#888;font-size:12px}',
      '.te-dim-resolved{margin-top:6px;font-size:11px;color:#666}',
      '.te-dim-error{color:#dc2626}',
      '.te-dim-input-error{border-color:#dc2626;background:#fef2f2}',
      '.te-dim-hint{margin-top:4px;font-size:10px;color:#999}'
    ].join('');
    root.appendChild(style);

    var container = document.createElement('div');
    container.className = 'te-wrap';
    container.innerHTML = '<div class="te-loading">옵션을 불러오는 중...</div>';
    root.appendChild(container);

    var BASE_PATH = '/api/shop/' + encodeURIComponent(ctx.mallId)
      + '/products/' + encodeURIComponent(ctx.productNo);
    var state = {
      schema: null,
      selections: {},   // groupId → itemId (NORMAL/select 그룹)
      directValues: {}, // groupId → number (SHEET_COUNT/QUANTITY allowDirectInput)
      dims: {},         // groupId → {w, h} (DIMENSIONS)
      quote: null,
      busy: false, error: null, memberId: ''
    };

    function findFittingItem(g, w, h){
      // widthMm/heightMm 가 null 이면 무제한 박스 (fallback)
      var candidates = g.items.filter(function(it){
        var fitW = it.widthMm == null || it.widthMm >= w;
        var fitH = it.heightMm == null || it.heightMm >= h;
        return fitW && fitH;
      });
      if (candidates.length === 0) return null;
      // 가장 작은 fit (면적 작은 순). null 박스는 가장 큰 것으로 취급.
      candidates.sort(function(a, b){
        var aw = a.widthMm == null ? Infinity : a.widthMm;
        var ah = a.heightMm == null ? Infinity : a.heightMm;
        var bw = b.widthMm == null ? Infinity : b.widthMm;
        var bh = b.heightMm == null ? Infinity : b.heightMm;
        return (aw * ah) - (bw * bh);
      });
      return candidates[0];
    }

    function resolveDimensionsSelection(g){
      var d = state.dims[g.id];
      if (!d || !d.w || !d.h) return;
      var item = findFittingItem(g, d.w, d.h);
      if (item) state.selections[g.id] = item.id;
      else delete state.selections[g.id];
    }

    function fmtPrice(n){ return (Number(n)||0).toLocaleString('ko-KR') + '원'; }

    function escapeHtml(s){
      return String(s).replace(/[&<>"']/g, function(c){
        return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c];
      });
    }

    function isVisibleByShowWhen(sw){
      if (!sw || !sw.length) return true;
      return sw.every(function(c){
        return state.selections[c.groupId] === c.itemId;
      });
    }
    function isGroupVisible(g){ return isVisibleByShowWhen(g.showWhen); }
    function isItemVisible(it){ return isVisibleByShowWhen(it.showWhen); }

    function render(){
      if (!state.schema) return;
      // 가시 그룹만 노출. 숨겨진 그룹의 selection 은 정리.
      var visibleGroups = state.schema.optionGroups.filter(isGroupVisible);
      var visibleIds = {};
      visibleGroups.forEach(function(g){ visibleIds[g.id] = true; });
      Object.keys(state.selections).forEach(function(gid){
        if (!visibleIds[gid]) delete state.selections[gid];
      });

      var html = '<div class="te-title">옵션 선택</div>';
      visibleGroups.forEach(function(g){
        // SHEET_COUNT / QUANTITY 가 직접 입력 모드면 number input
        if ((g.kind === 'SHEET_COUNT' || g.kind === 'QUANTITY') && g.allowDirectInput) {
          var v = state.directValues[g.id] != null ? state.directValues[g.id] : '';
          var unit = g.kind === 'SHEET_COUNT' ? '장' : '부';
          var minA = g.minDirectInput != null ? ' min="' + g.minDirectInput + '"' : '';
          var maxA = g.maxDirectInput != null ? ' max="' + g.maxDirectInput + '"' : '';
          var rangeHint = '';
          if (g.minDirectInput != null || g.maxDirectInput != null) {
            rangeHint = '<div class="te-dim-hint">'
              + (g.minDirectInput != null ? '최소 ' + g.minDirectInput : '')
              + (g.minDirectInput != null && g.maxDirectInput != null ? ' · ' : '')
              + (g.maxDirectInput != null ? '최대 ' + g.maxDirectInput : '')
              + ' ' + unit + '</div>';
          }
          html += '<div class="te-row">'
            + '<label class="te-label">' + escapeHtml(g.name) + (g.required ? ' *' : '') + '</label>'
            + '<div class="te-dim-row">'
              + '<input type="number"' + minA + maxA + ' placeholder="' + unit + ' 수" data-direct="' + escapeHtml(g.id) + '" value="' + escapeHtml(String(v)) + '" class="te-dim-input" style="width:140px" />'
              + '<span class="te-dim-unit">' + unit + '</span>'
            + '</div>'
            + rangeHint
            + '</div>';
          return;
        }
        if (g.kind === 'DIMENSIONS') {
          var d = state.dims[g.id] || { w: '', h: '' };
          // 그룹 max 와 옵션들의 max 중 큰 값을 절대 최대로 사용
          var maxItemW = 0, maxItemH = 0;
          g.items.forEach(function(it){
            if (it.widthMm  != null && it.widthMm  > maxItemW) maxItemW = it.widthMm;
            if (it.heightMm != null && it.heightMm > maxItemH) maxItemH = it.heightMm;
          });
          var maxW = g.maxWidthMm  || maxItemW || null;
          var maxH = g.maxHeightMm || maxItemH || null;

          var wNum = Number(d.w), hNum = Number(d.h);
          var overW = maxW && wNum > maxW;
          var overH = maxH && hNum > maxH;
          var resolved = (wNum && hNum && !overW && !overH)
            ? findFittingItem(g, wNum, hNum)
            : null;

          var resolvedLabel = '';
          if (overW || overH) {
            resolvedLabel = '<div class="te-dim-resolved te-dim-error">최대 ' + (maxW || '?') + '×' + (maxH || '?') + 'mm 까지 입력 가능합니다</div>';
          } else if (resolved) {
            resolvedLabel = '<div class="te-dim-resolved">→ ' + escapeHtml(resolved.label)
              + (resolved.addPrice ? ' (' + (resolved.addPrice >= 0 ? '+' : '') + fmtPrice(resolved.addPrice) + ')' : '')
              + '</div>';
          } else if (wNum && hNum) {
            resolvedLabel = '<div class="te-dim-resolved te-dim-error">맞는 사이즈가 없습니다</div>';
          }

          var maxAttrW = maxW ? ' max="' + maxW + '"' : '';
          var maxAttrH = maxH ? ' max="' + maxH + '"' : '';
          var hint = (maxW && maxH)
            ? '<div class="te-dim-hint">최대 ' + maxW + ' × ' + maxH + ' mm</div>'
            : '';

          html += '<div class="te-row">'
            + '<label class="te-label">' + escapeHtml(g.name) + (g.required ? ' *' : '') + '</label>'
            + '<div class="te-dim-row">'
              + '<input type="number" min="1"' + maxAttrW + ' placeholder="가로" data-dim="w" data-group="' + escapeHtml(g.id) + '" value="' + escapeHtml(String(d.w)) + '" class="te-dim-input' + (overW ? ' te-dim-input-error' : '') + '" />'
              + '<span class="te-dim-x">×</span>'
              + '<input type="number" min="1"' + maxAttrH + ' placeholder="세로" data-dim="h" data-group="' + escapeHtml(g.id) + '" value="' + escapeHtml(String(d.h)) + '" class="te-dim-input' + (overH ? ' te-dim-input-error' : '') + '" />'
              + '<span class="te-dim-unit">mm</span>'
            + '</div>'
            + hint
            + resolvedLabel
            + '</div>';
          return;
        }
        html += '<div class="te-row">'
          + '<label class="te-label">' + escapeHtml(g.name) + (g.required ? ' *' : '') + '</label>'
          + '<select class="te-select" data-group="' + escapeHtml(g.id) + '">'
          + '<option value="">선택해 주세요</option>'
          + g.items.filter(isItemVisible).map(function(it){
              var sel = state.selections[g.id] === it.id ? ' selected' : '';
              var add = '';
              var per = '';
              if (g.perSheet) per += '×장';
              if (g.perQuantity) per += '×부';
              if (g.perArea) per += '×면적';
              if (it.addPrice > 0) add = ' (+' + fmtPrice(it.addPrice) + (per ? ' ' + per : '') + ')';
              else if (it.addPrice < 0) add = ' (' + fmtPrice(it.addPrice) + (per ? ' ' + per : '') + ')';
              else if (per) add = ' (' + per + ')';
              return '<option value="' + escapeHtml(it.id) + '"' + sel + '>' + escapeHtml(it.label) + add + '</option>';
            }).join('')
          + '</select></div>';
      });
      var price = state.quote ? state.quote.finalPrice : state.schema.basePrice;
      var negative = price < 0;
      var priceColor = negative ? 'color:#dc2626;' : '';
      html += '<div class="te-price"><span>예상 결제금액</span><b style="' + priceColor + '">' + fmtPrice(price) + '</b></div>';
      var disable = state.busy || negative;
      html += '<button class="te-btn"' + (disable ? ' disabled' : '') + '>구매하기</button>';
      if (negative) html += '<div class="te-error">옵션 합계가 음수입니다. 옵션 가격 설정을 확인하세요.</div>';
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
      container.querySelectorAll('.te-dim-input[data-group]').forEach(function(inp){
        inp.addEventListener('input', function(){
          var gid = inp.getAttribute('data-group');
          var dim = inp.getAttribute('data-dim');
          var v = Number(inp.value);
          if (!state.dims[gid]) state.dims[gid] = { w: '', h: '' };
          state.dims[gid][dim] = Number.isFinite(v) && v > 0 ? v : '';
          var g = (state.schema.optionGroups || []).find(function(x){ return x.id === gid; });
          if (g) resolveDimensionsSelection(g);
          render();
          requestQuote();
        });
      });
      container.querySelectorAll('input[data-direct]').forEach(function(inp){
        inp.addEventListener('input', function(){
          var gid = inp.getAttribute('data-direct');
          var v = Number(inp.value);
          if (Number.isFinite(v) && v > 0) state.directValues[gid] = v;
          else delete state.directValues[gid];
          requestQuote();
        });
      });
      container.querySelector('button').addEventListener('click', checkout);
    }

    function selectionPayload(){
      var visibleGroups = (state.schema.optionGroups || []).filter(isGroupVisible);
      var out = [];
      visibleGroups.forEach(function(g){
        if ((g.kind === 'SHEET_COUNT' || g.kind === 'QUANTITY') && g.allowDirectInput) {
          var v = state.directValues[g.id];
          if (Number.isFinite(v) && v > 0) out.push({ groupId: g.id, directValue: v });
        } else if (g.kind === 'DIMENSIONS') {
          var d = state.dims[g.id];
          if (d && d.w && d.h) out.push({ groupId: g.id, widthMm: Number(d.w), heightMm: Number(d.h) });
        } else if (state.selections[g.id]) {
          out.push({ groupId: g.id, itemId: state.selections[g.id] });
        }
      });
      return out;
    }

    function isSelectionComplete(){
      var visibleGroups = (state.schema.optionGroups || []).filter(isGroupVisible);
      for (var i = 0; i < visibleGroups.length; i++) {
        var g = visibleGroups[i];
        if (!g.required) continue;
        if ((g.kind === 'SHEET_COUNT' || g.kind === 'QUANTITY') && g.allowDirectInput) {
          var v = state.directValues[g.id];
          if (!Number.isFinite(v) || v <= 0) return false;
        } else if (g.kind === 'DIMENSIONS') {
          var d = state.dims[g.id];
          if (!d || !d.w || !d.h) return false;
        } else {
          if (!state.selections[g.id]) return false;
        }
      }
      return true;
    }

    function requestQuote(){
      if (!isSelectionComplete()) { state.quote = null; state.error = null; render(); return; }
      var sel = selectionPayload();
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

    function isAllowedCartUrl(u){
      try {
        var url = new URL(u);
        if (url.protocol !== 'https:') return false;
        // 안전: cafe24.com 또는 현재 storefront 도메인만 허용
        return /\\.cafe24\\.com$/.test(url.hostname) || url.hostname === location.hostname;
      } catch(e) { return false; }
    }

    function checkout(){
      var sel = selectionPayload();
      if (sel.length === 0) { state.error = '옵션을 선택해 주세요'; render(); return; }
      state.busy = true; state.error = null; render();
      var payload = { selections: sel };
      if (state.memberId) payload.customer = { id: state.memberId };
      // TODO: window.testEstimatorDesignNo / window.testEstimatorFile 같은 전역에서
      // 디자인 편집번호·파일 정보를 받아 payload 에 합친다 (jarvis 에디터 통합 단계)

      fetch(API + BASE_PATH + '/checkout', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      }).then(function(r){return r.json().then(function(d){return {ok:r.ok,d:d}});})
        .then(function(res){
          state.busy = false;
          if (!res.ok) { state.error = res.d.error || '주문 생성 실패'; render(); return; }
          if (res.d.cartForm && res.d.cartForm.fields && isAllowedCartUrl(res.d.cartForm.action)) {
            submitCartForm(res.d.cartForm);
          } else if (res.d.cartUrl && isAllowedCartUrl(res.d.cartUrl)) {
            window.location.href = res.d.cartUrl;
          } else {
            state.error = '장바구니 진입 정보가 없습니다';
            render();
          }
        }).catch(function(){ state.busy = false; state.error = '네트워크 오류'; render(); });
    }

    // 1) 회원 ID 조회 (Cafe24 SDK 있으면) → 2) 스키마 fetch
    getMemberId().then(function(memberId){
      state.memberId = memberId;
      return fetch(API + BASE_PATH);
    }).then(function(r){
      if (!r.ok) throw r;
      return r.json();
    }).then(function(data){
      state.schema = data;
      render();
    }).catch(function(){
      container.innerHTML = '<div class="te-error">옵션 정보를 불러올 수 없습니다.</div>';
    });
  }

  ready(init);
})();
`;
}
