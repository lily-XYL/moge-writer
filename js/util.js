/* ============ 墨阁 · 通用工具 ============ */
window.Util = (() => {
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function padN(n) { return n < 10 ? '0' + n : '' + n; }
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function fmtDate(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
  function fmtDateShort(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  /* 网文字数：去空白后的字符数 */
  function countWords(text) {
    if (!text) return 0;
    return text.replace(/\s/g, '').length;
  }
  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(ctx, args), ms);
    };
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function nl2p(text) {
    if (!text) return '<p class="empty" style="padding:10px 0">（空）</p>';
    return text.split(/\n+/).map(line => {
      const s = line.trim();
      if (!s) return '';
      if (s.startsWith('### ')) return '<h6>' + escapeHtml(s.slice(4)) + '</h6>';
      if (s.startsWith('## ')) return '<h5>' + escapeHtml(s.slice(3)) + '</h5>';
      return '<p>' + escapeHtml(s) + '</p>';
    }).join('');
  }
  function short(s, n) {
    if (!s) return '';
    n = n || 60;
    return s.length > n ? s.slice(0, n) + '…' : s;
  }
  function wcText(n) {
    if (n == null) return '0';
    if (n >= 10000) return (n / 10000).toFixed(2).replace(/\.?0+$/, '').replace(/\.$/, '') + '万';
    return String(n);
  }
  function fmtSeconds(sec) {
    if (!sec || sec < 0) return '--';
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = Math.floor(sec % 60);
    return (h ? h + '小时' : '') + (m ? m + '分' : '') + (h ? '' : (s ? s + '秒' : ''));
  }
  function numOr(s) {
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  function fileToText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsText(file, 'utf-8');
    });
  }
  return { $, $$, uid, todayStr, fmtDate, fmtDateShort, countWords, debounce, escapeHtml, nl2p, short, wcText, fmtSeconds, numOr, padN, fileToText };
})();

window.Actions = window.Actions || {};
window.App = window.App || { state: {}, settings: {}, data: {} };
