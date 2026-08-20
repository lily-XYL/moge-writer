/* ============ 墨阁 · 通用 UI（弹窗/提示/确认/表单）+ 共享数据加载 ============ */
window.Views = window.Views || {};

window.UI = (() => {
  const U = window.Util;

  function modalRoot() { return document.getElementById('modal-root'); }
  function toastRoot() { return document.getElementById('toast-root'); }

  function openModal(html, opts) {
    opts = opts || {};
    const r = modalRoot();
    r.innerHTML = '<div class="modal-mask"><div class="modal' + (opts.wide ? ' modal-wide' : '') + '">' +
      '<div class="modal-head"><span></span><button class="modal-close" data-action="modal-close" title="关闭">✕</button></div>' +
      '<div class="modal-body">' + html + '</div></div></div>';
    const mask = r.querySelector('.modal-mask');
    mask.addEventListener('mousedown', e => {
      if (e.target === mask && !opts.lock) closeModal();
    });
  }

  function closeModal() { modalRoot().innerHTML = ''; }

  function readForm(rootEl) {
    const o = {};
    U.$$('[name]', rootEl).forEach(el => {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value;
    });
    return o;
  }

  let toastTimer = null;
  function toast(msg, type) {
    const root = toastRoot();
    const t = document.createElement('div');
    t.className = 'toast' + (type ? ' ' + type : '');
    t.textContent = msg;
    root.appendChild(t);
    setTimeout(() => {
      t.style.transition = 'opacity .3s';
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 320);
    }, 2200);
  }

  function confirmDialog(title, msg, onOk, okLabel) {
    window.UI._confirmCb = onOk;
    openModal(
      '<p style="font-size:14px;margin:4px 0 10px"><b>' + U.escapeHtml(title) + '</b></p>' +
      '<p style="color:var(--text-2);font-size:13px;margin:0 0 16px">' + U.escapeHtml(msg) + '</p>' +
      '<div class="btn-row" style="justify-content:flex-end">' +
      '<button class="btn" data-action="confirm-cancel">取消</button>' +
      '<button class="btn danger" data-action="confirm-ok">' + U.escapeHtml(okLabel || '确认删除') + '</button>' +
      '</div>'
    );
  }

  function chips(selected, options, action) {
    return (options || []).map(o =>
      '<span class="chip' + (o.v === selected ? ' active' : '') + '" data-action="' + action + '" data-id="' + o.v + '">' + U.escapeHtml(o.l) + '</span>'
    ).join(' ');
  }

  return { openModal, closeModal, readForm, toast, confirmDialog, chips };
})();

/* ============ 共享数据操作 ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;

  function bySortThenId(a, b) {
    const sortDiff = (a.sort || 0) - (b.sort || 0);
    if (sortDiff) return sortDiff;
    const createdDiff = (a.createdAt || 0) - (b.createdAt || 0);
    if (createdDiff) return createdDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  }

  /* 统一书稿顺序：卷顺序 → 卷内章节顺序 → 未分卷/残留章节。 */
  App.orderChapters = function (volumes, chapters) {
    const orderedVolumes = (volumes || []).slice().sort(bySortThenId);
    const allChapters = chapters || [];
    const knownVolumeIds = new Set(orderedVolumes.map(v => v.id));
    const ordered = [];
    orderedVolumes.forEach(v => {
      ordered.push(...allChapters.filter(c => c.volumeId === v.id).sort(bySortThenId));
    });
    ordered.push(...allChapters.filter(c => !c.volumeId || !knownVolumeIds.has(c.volumeId)).sort(bySortThenId));
    return ordered;
  };
  App.getOrderedChapters = function () {
    return App.orderChapters(App.data.volumes || [], App.data.chapters || []);
  };

  App.loadWorkData = async function (workId) {
    const [work, volumes, chapters, characters, entries, outlines, foreshadows, timeline, ideas, daily, graphs] = await Promise.all([
      DB.get('works', workId),
      DB.getByIndex('volumes', 'workId', workId),
      DB.getByIndex('chapters', 'workId', workId),
      DB.getByIndex('characters', 'workId', workId),
      DB.getByIndex('entries', 'workId', workId),
      DB.getByIndex('outlines', 'workId', workId),
      DB.getByIndex('foreshadows', 'workId', workId),
      DB.getByIndex('timeline', 'workId', workId),
      DB.getByIndex('ideas', 'workId', workId),
      DB.getByIndex('dailyStats', 'workId', workId),
      DB.getByIndex('relationGraphs', 'workId', workId)
    ]);
    const bySort = (a, b) => bySortThenId(a, b);
    App.data = {
      work: work || null,
      volumes: volumes.sort(bySort),
      chapters: App.orderChapters(volumes, chapters),
      characters: characters.sort(bySort),
      entries: entries.sort(bySort),
      outlines: outlines.sort(bySort),
      foreshadows: foreshadows.sort(bySort),
      timeline: timeline.sort(bySort),
      ideas: ideas.sort(bySort),
      daily: daily,
      relationGraph: (graphs && graphs[0]) || window.GraphData.createGraph(workId)
    };
    /* 旧版关系数据（dir 字段）自动迁移为新版三模式 */
    if (graphs && graphs[0] && window.GraphData.migrate(graphs[0])) {
      DB.put('relationGraphs', graphs[0]);
    }
    App.state.workId = workId;
    App.sessionTotal = App.data.chapters.reduce((s, c) => s + (c.wordCount || 0), 0);
    return App.data;
  };

  /* 当前作品的关系图（不存在则创建空图，首次修改时才写入数据库） */
  App.getGraph = function () {
    if (!App.data.relationGraph) {
      App.data.relationGraph = window.GraphData.createGraph(App.state.workId);
    }
    return App.data.relationGraph;
  };
  App.graphSave = function () {
    const g = App.getGraph();
    g.updatedAt = Date.now();
    return DB.put('relationGraphs', g);
  };

  App.workTotalWords = function () {
    return App.data.chapters.reduce((s, c) => s + (c.wordCount || 0), 0);
  };

  App.dailyMap = function () {
    const m = {};
    (App.data.daily || []).forEach(d => { m[d.date] = (m[d.date] || 0) + (d.words || 0); });
    return m;
  };

  App.todayWords = function () {
    const m = App.dailyMap();
    return m[U.todayStr()] || 0;
  };

  App.nextSort = function (arr) {
    return (arr.reduce((m, x) => Math.max(m, x.sort || 0), 0)) + 10;
  };

  App.deleteWork = async function (workId) {
    const stores = ['volumes', 'chapters', 'characters', 'entries', 'outlines', 'foreshadows', 'timeline', 'ideas', 'dailyStats', 'relationGraphs'];
    for (const s of stores) {
      const arr = await DB.getByIndex(s, 'workId', workId);
      await Promise.all(arr.map(o => DB.del(s, o.id)));
    }
    await DB.del('works', workId);
  };

  /* 记录今日码字增量 */
  App.recordWordsDelta = async function (workId, delta) {
    if (!delta) return;
    const date = U.todayStr();
    const key = workId + '_' + date;
    const existing = (App.data.daily || []).find(d => d.id === key);
    const words = Math.max(0, (existing ? existing.words : 0) + delta);
    const rec = { id: key, workId: workId, date: date, words: words };
    if (existing) {
      existing.words = words;
    } else {
      App.data.daily.push(rec);
    }
    await DB.put('dailyStats', rec);
  };
})();

/* ============ 通用 Actions ============ */
Actions['modal-close'] = () => UI.closeModal();
Actions['confirm-close'] = () => UI.closeModal();
Actions['confirm-cancel'] = () => UI.closeModal();
Actions['confirm-ok'] = () => {
  const cb = UI._confirmCb;
  UI.closeModal();
  if (cb) cb();
};
