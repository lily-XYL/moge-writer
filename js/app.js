/* ============ 墨阁 · 主入口（启动 / 路由 / 事件委托 / 全局搜索 / 主题） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const Ex = window.Export;

  const DEFAULT_SETTINGS = {
    theme: 'system',
    fontFamily: 'serif',
    fontSize: 18,
    lineHeight: 2,
    autosave: 1000,
    defaultGoal: 3000,
    sensitiveCustom: [],
    typoCustom: [],
    lastWorkId: null,
    lastChapterId: null,
    lastBackupDate: null
  };

  /* ---------- 主题与字体 ---------- */
  App.applyTheme = function () {
    let t = App.settings.theme || 'system';
    if (t === 'system') {
      t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', t);
  };

  const FONT_MAP = {
    serif: '"Noto Serif SC","Source Han Serif SC","SimSun","Songti SC",serif',
    song: '"SimSun","Songti SC",serif',
    kai: '"KaiTi","STKaiti","楷体",serif',
    hei: '"SimHei","Microsoft YaHei",sans-serif',
    dengxian: '"DengXian","Microsoft YaHei",sans-serif',
    fangsong: '"FangSong","STFangsong",serif'
  };
  function applyFontVars() {
    const s = App.settings;
    document.documentElement.style.setProperty('--fs', (s.fontSize || 18) + 'px');
    document.documentElement.style.setProperty('--lh', s.lineHeight || 2);
    document.documentElement.style.setProperty('--font-serif', FONT_MAP[s.fontFamily] || FONT_MAP.serif);
  }

  /* ---------- 顶栏 ---------- */
  function winControlsHtml() {
    if (!window.mogeWindow) return '';
    return '<span class="win-controls">' +
      '<button class="win-btn" data-action="winMin" title="最小化">─</button>' +
      '<button class="win-btn" data-action="winMax" title="最大化/还原">□</button>' +
      '<button class="win-btn win-close" data-action="winClose" title="关闭">✕</button></span>';
  }
  function renderTopbar(workId, isEditor) {
    App._renderTopbar = renderTopbar;
    const bar = U.$('#topbar');
    if (!bar) return;
    const themeBtn = '<button class="topbar-btn" data-action="toggleTheme" title="切换主题">' +
      (document.documentElement.getAttribute('data-theme') === 'dark' ? '☀️' : '🌙') + '</button>';
    if (isEditor) {
      const w = App.data.work;
      bar.innerHTML =
        '<button class="topbar-btn" data-action="goWorkFromEditor">← 返回</button>' +
        '<div class="topbar-work">' + U.escapeHtml(w ? w.title : '') + '</div>' +
        '<div class="topbar-spacer"></div>' +
        '<button class="topbar-btn" data-action="openSearch">🔍 搜索</button>' +
        themeBtn + winControlsHtml();
    } else if (workId) {
      bar.innerHTML =
        '<div class="topbar-title"><span class="logo">墨</span><span>墨阁</span></div>' +
        '<div class="topbar-spacer"></div>' +
        '<button class="topbar-btn" data-action="openSearch">🔍 搜索</button>' +
        themeBtn + winControlsHtml();
    } else {
      bar.innerHTML =
        '<div class="topbar-title"><span class="logo">墨</span><span>墨阁</span></div>' +
        '<div class="topbar-spacer"></div>' +
        themeBtn + winControlsHtml();
    }
  }
  Actions['toggleTheme'] = () => {
    const cur = document.documentElement.getAttribute('data-theme');
    App.settings.theme = cur === 'dark' ? 'light' : 'dark';
    App.applyTheme();
    DB.put('settings', { key: 'theme', value: App.settings.theme });
    renderTopbar(App.state.workId, App.state.inEditor);
  };
  Actions['winMin'] = () => { if (window.mogeWindow) window.mogeWindow.minimize(); };
  Actions['winMax'] = () => { if (window.mogeWindow) window.mogeWindow.toggleMaximize(); };
  Actions['winClose'] = () => { if (window.mogeWindow) window.mogeWindow.close(); };

  /* ---------- 路由 ---------- */
  async function route() {
    const main = U.$('#main');
    if (!main) return;
    const hash = location.hash || '#/';
    const isEditor = hash.indexOf('#/e/') === 0;
    App.state.inEditor = isEditor;
    document.body.classList.toggle('editor-mode', isEditor); /* 编辑器占满视口，外层不滚动 */
    if (!isEditor && Views.editor && Views.editor.stopTimer) Views.editor.stopTimer();
    let m;
    if (hash === '#/' || hash === '' || hash === '#') {
      App.state.inEditor = false;
      renderTopbar();
      Views.bookshelf.render(main);
    } else if ((m = hash.match(/^#\/w\/([^/]+)(?:\/([^/]+))?/))) {
      App.state.inEditor = false;
      renderTopbar(m[1]);
      Views.work.render(main, m[1], m[2]);
    } else if ((m = hash.match(/^#\/e\/([^/]+)(?:\/([^/]+))?/))) {
      App.state.inEditor = true;
      if (!App.data.work || App.data.work.id !== m[1]) await App.loadWorkData(m[1]);
      renderTopbar(m[1], true);
      Views.editor.render(main, m[1], m[2]);
    } else if (hash === '#/settings') {
      App.state.inEditor = false;
      renderTopbar();
      Views.settings.render(main);
    } else if (hash === '#/ideas') {
      App.state.inEditor = false;
      renderTopbar();
      Views.ideas.render(main, null);
    } else {
      location.replace('#/');
    }
  }

  /* ---------- 事件委托 ---------- */
  function onClick(e) {
    const t = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!t) return;
    /* 可编辑控件（下拉/输入框/文本域）由 change/input 委托处理，click 不触发，避免展开下拉即被当作“选择” */
    const tag = t.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    const a = t.dataset.action;
    if (typeof Actions[a] === 'function') Actions[a](t, e);
  }
  function onChange(e) {
    const t = e.target;
    if (t && t.dataset && t.dataset.action && typeof Actions[t.dataset.action] === 'function') {
      Actions[t.dataset.action](t, e);
    }
  }
  function onInput(e) {
    const t = e.target;
    if (t && t.dataset && t.dataset.action && typeof Actions[t.dataset.action] === 'function') {
      Actions[t.dataset.action](t, e);
    }
  }

  /* ---------- 全局搜索 ---------- */
  Actions['openSearch'] = async () => {
    const [works, chapters, characters, entries, outlines, foreshadows, timeline, ideas] = await Promise.all([
      DB.getAll('works'), DB.getAll('chapters'), DB.getAll('characters'), DB.getAll('entries'),
      DB.getAll('outlines'), DB.getAll('foreshadows'), DB.getAll('timeline'), DB.getAll('ideas')
    ]);
    const wmap = {};
    works.forEach(w => { wmap[w.id] = w; });
    App._searchData = { works, chapters, characters, entries, outlines, foreshadows, timeline, ideas, wmap };
    UI.openModal(
      '<h3 style="margin:0 0 10px">全局搜索</h3>' +
      '<input class="input" id="search-input" placeholder="搜索章节、人物、设定、伏笔、灵感…" autocomplete="off">' +
      '<div id="search-results" style="margin-top:10px;max-height:58vh;overflow:auto"></div>'
    );
    const input = U.$('#search-input');
    input.addEventListener('input', U.debounce(() => runSearch(input.value), 200));
    setTimeout(() => input.focus(), 30);
  };

  function snippet(text, q, len) {
    text = text || '';
    len = len || 46;
    const i = text.toLowerCase().indexOf(q);
    if (i === -1) return U.short(text.replace(/\s+/g, ' '), len);
    const s = Math.max(0, i - Math.floor(len / 3));
    return (s > 0 ? '…' : '') + text.slice(s, s + len).replace(/\s+/g, ' ') + '…';
  }

  function runSearch(q) {
    const box = U.$('#search-results');
    if (!box) return;
    q = (q || '').toLowerCase().trim();
    if (!q) { box.innerHTML = '<div class="empty">输入关键词开始搜索</div>'; return; }
    const D = App._searchData;
    let html = '';
    const push = (label, items) => {
      if (!items.length) return;
      html += '<div class="sr-group">' + label + '</div>';
      html += items.slice(0, 8).map(it => it).join('');
    };
    push('章节', D.chapters.filter(c =>
      (c.title || '').toLowerCase().includes(q) || (c.content || '').toLowerCase().includes(q) || (c.outline || '').toLowerCase().includes(q)
    ).slice(0, 12).map(c =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/e/' + c.workId + '/' + c.id + '">' +
      '<div class="sr-title">📄 ' + U.escapeHtml(c.title || '无题') + '<span class="hint"> · ' + U.escapeHtml((D.wmap[c.workId] || {}).title || '') + '</span></div>' +
      '<div class="sr-snippet">' + U.escapeHtml(snippet(c.content, q)) + '</div></div>'
    ).join(''));
    push('作品', D.works.filter(w =>
      (w.title || '').toLowerCase().includes(q) || (w.author || '').toLowerCase().includes(q) || (w.synopsis || '').toLowerCase().includes(q)
    ).map(w =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + w.id + '/overview">' +
      '<div class="sr-title">📚 ' + U.escapeHtml(w.title) + '</div>' +
      '<div class="sr-snippet">' + U.escapeHtml(snippet(w.synopsis, q)) + '</div></div>'
    ).join(''));
    push('人物', D.characters.filter(c =>
      (c.name || '').toLowerCase().includes(q) || (c.role || '').toLowerCase().includes(q) || (c.tags || '').toLowerCase().includes(q)
    ).map(c =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + c.workId + '/world">' +
      '<div class="sr-title">👤 ' + U.escapeHtml(c.name) + '<span class="hint"> · ' + U.escapeHtml(c.role || '') + '</span></div>' +
      '<div class="sr-snippet">' + U.escapeHtml(U.short(c.background || c.appearance || '', 60)) + '</div></div>'
    ).join(''));
    push('设定', D.entries.filter(e =>
      (e.name || '').toLowerCase().includes(q) || (e.content || '').toLowerCase().includes(q)
    ).map(e =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + e.workId + '/world">' +
      '<div class="sr-title">🗺 ' + U.escapeHtml(e.name) + '</div>' +
      '<div class="sr-snippet">' + U.escapeHtml(snippet(e.content, q)) + '</div></div>'
    ).join(''));
    push('大纲', D.outlines.filter(o =>
      (o.title || '').toLowerCase().includes(q) || (o.content || '').toLowerCase().includes(q)
    ).map(o =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + o.workId + '/outline">' +
      '<div class="sr-title">📝 ' + U.escapeHtml(o.title) + '</div>' +
      '<div class="sr-snippet">' + U.escapeHtml(snippet(o.content, q)) + '</div></div>'
    ).join(''));
    push('伏笔', D.foreshadows.filter(f =>
      (f.content || '').toLowerCase().includes(q) || (f.setupAt || '').toLowerCase().includes(q) || (f.payoffAt || '').toLowerCase().includes(q)
    ).map(f =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + f.workId + '/foreshadow">' +
      '<div class="sr-title">🪝 ' + U.escapeHtml(U.short(f.content, 40)) + (f.status === 'paid' ? '<span class="badge paid">已回收</span>' : '<span class="badge open">未回收</span>') + '</div>' +
      '<div class="sr-snippet">' + U.escapeHtml('埋设：' + (f.setupAt || '—') + ' · 回收：' + (f.payoffAt || '—')) + '</div></div>'
    ).join(''));
    push('时间线', D.timeline.filter(t =>
      (t.time || '').toLowerCase().includes(q) || (t.event || '').toLowerCase().includes(q)
    ).map(t =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + t.workId + '/timeline">' +
      '<div class="sr-title">🕰 ' + U.escapeHtml(t.time) + '</div>' +
      '<div class="sr-snippet">' + U.escapeHtml(snippet(t.event, q)) + '</div></div>'
    ).join(''));
    push('灵感', D.ideas.filter(i =>
      (i.title || '').toLowerCase().includes(q) || (i.content || '').toLowerCase().includes(q) || (i.tags || '').toLowerCase().includes(q)
    ).map(i =>
      '<div class="search-result" data-action="openSearchJump" data-to="' + (i.workId ? '#/w/' + i.workId + '/ideas' : '#/ideas') + '">' +
      '<div class="sr-title">💡 ' + U.escapeHtml(i.title || '灵感') + '</div>' +
      '<div class="sr-snippet">' + U.escapeHtml(snippet(i.content, q)) + '</div></div>'
    ).join(''));
    box.innerHTML = html || '<div class="empty">没有找到「' + U.escapeHtml(q) + '」相关内容</div>';
  }
  Actions['openSearchJump'] = t => {
    UI.closeModal();
    location.hash = t.dataset.to;
  };

  /* ---------- 自动备份（每天首次打开备份一次） ---------- */
  async function autoBackup() {
    const today = U.todayStr();
    if (App.settings.lastBackupDate === today) return;
    try {
      const data = await Ex.dumpAll();
      await DB.put('backups', { id: U.uid(), label: '自动备份 ' + today, createdAt: Date.now(), data: data });
      const all = (await DB.getAll('backups')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const excess = all.slice(15);
      await Promise.all(excess.map(b => DB.del('backups', b.id)));
      App.settings.lastBackupDate = today;
      await DB.put('settings', { key: 'lastBackupDate', value: today });
    } catch (e) { /* 静默失败，下次再试 */ }
  }

  /* ---------- 启动 ---------- */
  async function boot() {
    try {
      const rows = await DB.getAll('settings');
      const s = Object.assign({}, DEFAULT_SETTINGS);
      rows.forEach(r => { s[r.key] = r.value; });
      App.settings = s;
      App.applyTheme();
      applyFontVars();

      window.addEventListener('hashchange', route);
      document.addEventListener('click', onClick);
      document.addEventListener('change', onChange);
      document.addEventListener('input', onInput);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (Views.editor) { Views.editor.flush(); if (Views.editor.stopTimer) Views.editor.stopTimer(); }
        } else {
          if (Views.editor && Views.editor.resumeTimer) Views.editor.resumeTimer();
        }
      });
      window.addEventListener('beforeunload', () => {
        if (Views.editor) Views.editor.flush();
      });
      document.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
          e.preventDefault();
          Actions['openSearch']();
        }
      });

      route();
      autoBackup();

      /* 无边框窗口：顶栏作为拖拽区，双击最大化 */
      if (window.mogeWindow) {
        document.body.classList.add('in-electron');
        const bar = U.$('#topbar');
        if (bar) {
          bar.addEventListener('dblclick', e => {
            if (!e.target.closest('button, input, select, textarea, a')) window.mogeWindow.toggleMaximize();
          });
        }
      }
    } catch (err) {
      document.getElementById('main').innerHTML =
        '<div class="card" style="max-width:520px;margin:60px auto">' +
        '<div class="card-title">⚠ 无法启动本地存储</div>' +
        '<div class="hint">墨阁需要浏览器支持 IndexedDB（本地数据库）。如果是从 file:// 直接打开仍报错，请尝试用本地服务器方式运行：' +
        '在 novel-studio 目录执行 <code>python -m http.server 8080</code>，然后访问 http://localhost:8080 。</div>' +
        '<div class="hint" style="color:var(--danger)">错误详情：' + U.escapeHtml(String(err && err.message || err)) + '</div>' +
        '</div>';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
