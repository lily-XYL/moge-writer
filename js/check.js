/* ============ 墨阁 · 违禁词 / 错别字检查引擎（纯函数，离线） ============ */
window.Check = (() => {
  /* list: [{w, c}] 或字符串数组；返回 [{word, category, count, positions}] */
  function findWords(text, list) {
    const out = [];
    const seen = new Set();
    (list || []).forEach(item => {
      const w = typeof item === 'string' ? item : item.w;
      if (!w || seen.has(w)) return;
      seen.add(w);
      const positions = [];
      let idx = 0;
      while (idx < text.length) {
        idx = text.indexOf(w, idx);
        if (idx === -1) break;
        positions.push(idx);
        idx += w.length;
      }
      if (positions.length) {
        out.push({ word: w, category: item.c || '', count: positions.length, positions });
      }
    });
    return out;
  }

  function checkSensitive(text, customWords) {
    const list = (window.Data.SENSITIVE_DEFAULT || []).concat(
      (customWords || []).map(w => (typeof w === 'string' ? { w: w, c: '自定义' } : w))
    );
    return findWords(text, list);
  }

  /* customPairs: [{w, r}] */
  function checkTypos(text, customPairs) {
    const pairs = (window.Data.TYPO_PAIRS || []).concat(customPairs || []);
    const out = [];
    const seen = new Set();
    pairs.forEach(p => {
      if (!p || !p.w || seen.has(p.w)) return;
      seen.add(p.w);
      const positions = [];
      let idx = 0;
      while (idx < text.length) {
        idx = text.indexOf(p.w, idx);
        if (idx === -1) break;
        positions.push(idx);
        idx += p.w.length;
      }
      if (positions.length) out.push({ wrong: p.w, right: p.r || '', count: positions.length, positions });
    });
    return out;
  }

  return { findWords, checkSensitive, checkTypos };
})();
