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

  /* ---------- 全局搜索（全部作品 / 全书 / 卷 / 章节） ---------- */
  Actions['openSearch'] = async () => {
    const [works, volumes, chapters, characters, entries, outlines, foreshadows, timeline, ideas] = await Promise.all([
      DB.getAll('works'), DB.getAll('volumes'), DB.getAll('chapters'), DB.getAll('characters'), DB.getAll('entries'),
      DB.getAll('outlines'), DB.getAll('foreshadows'), DB.getAll('timeline'), DB.getAll('ideas')
    ]);
    const wmap = {}, vmap = {};
    works.forEach(w => { wmap[w.id] = w; });
    volumes.forEach(v => { vmap[v.id] = v; });
    App._searchData = { works, volumes, chapters, characters, entries, outlines, foreshadows, timeline, ideas, wmap, vmap };
    const currentWork = App.state.workId && wmap[App.state.workId] ? App.state.workId : (works[0] || {}).id || '';
    App.state.searchScope = { mode: 'global', workId: currentWork, volumeId: '', chapterId: '' };
    UI.openModal(
      '<h3 style="margin:0 0 10px">全局搜索</h3>' +
      '<input class="input" id="search-input" placeholder="搜索章节、人物、设定、伏笔、灵感…" autocomplete="off">' +
      '<div id="search-scope-controls"></div>' +
      '<div id="search-results" style="margin-top:10px;max-height:52vh;overflow:auto"></div>'
    );
    renderSearchScopeControls();
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

  function rerunSearch() {
    const input = U.$('#search-input');
    if (input && input.value.trim()) runSearch(input.value);
  }
  function searchVolumes(workId) {
    return App._searchData.volumes.filter(v => v.workId === workId).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  function searchChapters(workId, volumeId) {
    return App._searchData.chapters.filter(c => c.workId === workId && (!volumeId || (volumeId === '__orphan__' ? !c.volumeId : c.volumeId === volumeId)))
      .sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }
  function normalizeSearchScope() {
    const D = App._searchData, s = App.state.searchScope;
    if (!D.wmap[s.workId]) s.workId = (D.works[0] || {}).id || '';
    const vols = searchVolumes(s.workId);
    const candidates = vols.map(v => v.id);
    if (D.chapters.some(c => c.workId === s.workId && !c.volumeId)) candidates.push('__orphan__');
    if ((s.mode === 'volume' || s.mode === 'chapter') && candidates.indexOf(s.volumeId) === -1) s.volumeId = candidates[0] || '';
    const chs = searchChapters(s.workId, s.volumeId);
    if (s.mode === 'chapter' && !chs.some(c => c.id === s.chapterId)) s.chapterId = (chs[0] || {}).id || '';
  }
  function renderSearchScopeControls() {
    const host = U.$('#search-scope-controls');
    if (!host) return;
    const D = App._searchData, s = App.state.searchScope;
    normalizeSearchScope();
    const chips = [
      { id: 'global', label: '全部作品' }, { id: 'book', label: '全书' },
      { id: 'volume', label: '卷' }, { id: 'chapter', label: '章节' }
    ].map(item => '<span class="chip' + (s.mode === item.id ? ' active' : '') + '" data-action="searchScopeMode" data-id="' + item.id + '">' + item.label + '</span>').join('');
    const workSelect = '<select class="select search-scope-select" data-action="searchScopeWork">' + D.works.map(w => '<option value="' + w.id + '"' + (w.id === s.workId ? ' selected' : '') + '>' + U.escapeHtml(w.title || '未命名作品') + '</option>').join('') + '</select>';
    const volumes = searchVolumes(s.workId);
    const volumeRows = volumes.map(v => ({ id: v.id, title: v.title || '未命名卷' }));
    if (D.chapters.some(c => c.workId === s.workId && !c.volumeId)) volumeRows.push({ id: '__orphan__', title: '未分卷' });
    const volumeSelect = '<select class="select search-scope-select" data-action="searchScopeVolume">' + volumeRows.map(v => '<option value="' + v.id + '"' + (v.id === s.volumeId ? ' selected' : '') + '>' + U.escapeHtml(v.title) + '</option>').join('') + '</select>';
    const chapters = searchChapters(s.workId, s.volumeId);
    const chapterSelect = '<select class="select search-scope-select" data-action="searchScopeChapter">' + chapters.map(c => '<option value="' + c.id + '"' + (c.id === s.chapterId ? ' selected' : '') + '>' + U.escapeHtml(c.title || '无题') + '</option>').join('') + '</select>';
    let selectors = '';
    if (s.mode === 'book') selectors = workSelect;
    if (s.mode === 'volume') selectors = workSelect + volumeSelect;
    if (s.mode === 'chapter') selectors = workSelect + volumeSelect + chapterSelect;
    const defaultFind = (U.$('#search-input') || {}).value || '';
    const replacePanel = '<div class="search-replace-panel">' +
      '<div class="search-replace-title">批量替换正文</div>' +
      '<input class="input" id="search-replace-from" value="' + U.escapeHtml(defaultFind) + '" placeholder="查找内容（区分大小写）">' +
      '<input class="input" id="search-replace-to" placeholder="替换为（留空即删除）">' +
      '<button class="btn small danger" data-action="searchReplacePreview">在当前范围替换</button>' +
      '</div>';
    host.innerHTML = '<div class="search-scope-row"><span class="search-scope-label">范围</span><div class="search-scope-chips">' + chips + '</div></div>' +
      (selectors ? '<div class="search-scope-selects">' + selectors + '</div>' : '') + replacePanel;
  }
  Actions['searchScopeMode'] = t => {
    App.state.searchScope.mode = t.dataset.id;
    renderSearchScopeControls(); rerunSearch();
  };
  Actions['searchScopeWork'] = t => {
    App.state.searchScope.workId = t.value;
    App.state.searchScope.volumeId = ''; App.state.searchScope.chapterId = '';
    renderSearchScopeControls(); rerunSearch();
  };
  Actions['searchScopeVolume'] = t => {
    App.state.searchScope.volumeId = t.value;
    App.state.searchScope.chapterId = '';
    renderSearchScopeControls(); rerunSearch();
  };
  Actions['searchScopeChapter'] = t => { App.state.searchScope.chapterId = t.value; rerunSearch(); };

  function replacementScopeLabel() {
    const D = App._searchData, s = App.state.searchScope;
    if (s.mode === 'global') return '全部作品';
    const work = (D.wmap[s.workId] || {}).title || '当前作品';
    if (s.mode === 'book') return '《' + work + '》全书';
    const volume = s.volumeId === '__orphan__' ? '未分卷' : ((D.vmap[s.volumeId] || {}).title || '当前卷');
    if (s.mode === 'volume') return '《' + work + '》/' + volume;
    const chapter = (D.chapters.find(c => c.id === s.chapterId) || {}).title || '当前章节';
    return '《' + work + '》/' + volume + '/' + chapter;
  }
  function countOccurrences(text, needle) {
    if (!needle) return 0;
    let count = 0, at = 0;
    while ((at = text.indexOf(needle, at)) !== -1) { count++; at += needle.length; }
    return count;
  }
  Actions['searchReplacePreview'] = () => {
    const findEl = U.$('#search-replace-from');
    const toEl = U.$('#search-replace-to');
    const find = findEl ? findEl.value : '';
    const replacement = toEl ? toEl.value : '';
    if (!find) { UI.toast('请填写要查找的内容', 'warn'); return; }
    if (find === replacement) { UI.toast('查找内容与替换内容相同', 'warn'); return; }
    const chapters = App._searchData.chapters.filter(chapterMatchesScope).filter(c => (c.content || '').includes(find));
    const occurrences = chapters.reduce((sum, c) => sum + countOccurrences(c.content || '', find), 0);
    if (!occurrences) { UI.toast('当前范围内没有可替换的正文内容', 'warn'); return; }
    const plan = { find, replacement, chapters, occurrences };
    UI.confirmDialog('确认批量替换', '将在“' + replacementScopeLabel() + '”中替换 ' + chapters.length + ' 章、共 ' + occurrences + ' 处正文内容。此操作会立即保存。', async () => {
      const now = Date.now();
      const changed = plan.chapters.map(c => Object.assign({}, c, {
        content: (c.content || '').split(plan.find).join(plan.replacement),
        wordCount: U.countWords((c.content || '').split(plan.find).join(plan.replacement)),
        updatedAt: now
      }));
      await DB.putMany('chapters', changed);
      const changedById = new Map(changed.map(c => [c.id, c]));
      if (App.data && App.data.chapters) {
        App.data.chapters.forEach(c => { const updated = changedById.get(c.id); if (updated) Object.assign(c, updated); });
      }
      const workIds = Array.from(new Set(changed.map(c => c.workId)));
      await Promise.all(workIds.map(async workId => {
        const work = await DB.get('works', workId);
        if (work) { work.updatedAt = now; await DB.put('works', work); }
      }));
      UI.toast('已替换 ' + plan.occurrences + ' 处内容');
      setTimeout(() => location.reload(), 450);
    }, '确认替换');
  };

  function chapterMatchesScope(chapter) {
    const s = App.state.searchScope;
    if (s.mode === 'global') return true;
    if (chapter.workId !== s.workId) return false;
    if (s.mode === 'book') return true;
    const inVolume = s.volumeId === '__orphan__' ? !chapter.volumeId : chapter.volumeId === s.volumeId;
    if (!inVolume) return false;
    return s.mode !== 'chapter' || chapter.id === s.chapterId;
  }
  function ancillaryMatchesScope(item) {
    const s = App.state.searchScope;
    return s.mode === 'global' || (s.mode === 'book' && item.workId === s.workId);
  }
  function volumeCaption(chapter) {
    const v = App._searchData.vmap[chapter.volumeId];
    return v ? (v.title || '未命名卷') : '未分卷';
  }

  function runSearch(q) {
    const box = U.$('#search-results');
    if (!box) return;
    q = (q || '').toLowerCase().trim();
    if (!q) { box.innerHTML = '<div class="empty">输入关键词开始搜索</div>'; return; }
    const D = App._searchData, s = App.state.searchScope;
    let html = '';
    const push = (label, items) => {
      if (!items.length) return;
      html += '<div class="sr-group">' + label + '</div>';
      html += items.slice(0, 12).join('');
    };
    const matchText = value => (value || '').toLowerCase().includes(q);
    push('章节', D.chapters.filter(c => chapterMatchesScope(c) && (matchText(c.title) || matchText(c.content) || matchText(c.outline) || matchText(c.notes))).map(c =>
      '<div class="search-result" data-action="openSearchJump" data-to="#/e/' + c.workId + '/' + c.id + '">' +
      '<div class="sr-title">📄 ' + U.escapeHtml(c.title || '无题') + '<span class="hint"> · ' + U.escapeHtml((D.wmap[c.workId] || {}).title || '') + ' / ' + U.escapeHtml(volumeCaption(c)) + '</span></div>' +
      '<div class="sr-snippet">' + U.escapeHtml(snippet(c.content || c.outline || c.notes, q)) + '</div></div>'
    ));
    if (s.mode === 'global' || s.mode === 'book') {
      push('作品', D.works.filter(w => (s.mode === 'global' || w.id === s.workId) && (matchText(w.title) || matchText(w.author) || matchText(w.synopsis))).map(w =>
        '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + w.id + '/overview"><div class="sr-title">📚 ' + U.escapeHtml(w.title) + '</div><div class="sr-snippet">' + U.escapeHtml(snippet(w.synopsis, q)) + '</div></div>'
      ));
      push('人物', D.characters.filter(c => ancillaryMatchesScope(c) && (matchText(c.name) || matchText(c.role) || matchText(c.tags))).map(c =>
        '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + c.workId + '/world"><div class="sr-title">👤 ' + U.escapeHtml(c.name) + '<span class="hint"> · ' + U.escapeHtml(c.role || '') + '</span></div><div class="sr-snippet">' + U.escapeHtml(U.short(c.background || c.appearance || '', 60)) + '</div></div>'
      ));
      push('设定', D.entries.filter(e => ancillaryMatchesScope(e) && (matchText(e.name) || matchText(e.content))).map(e =>
        '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + e.workId + '/world"><div class="sr-title">🗺 ' + U.escapeHtml(e.name) + '</div><div class="sr-snippet">' + U.escapeHtml(snippet(e.content, q)) + '</div></div>'
      ));
      push('大纲', D.outlines.filter(o => ancillaryMatchesScope(o) && (matchText(o.title) || matchText(o.content))).map(o =>
        '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + o.workId + '/outline"><div class="sr-title">📝 ' + U.escapeHtml(o.title) + '</div><div class="sr-snippet">' + U.escapeHtml(snippet(o.content, q)) + '</div></div>'
      ));
      push('伏笔', D.foreshadows.filter(f => ancillaryMatchesScope(f) && (matchText(f.content) || matchText(f.setupAt) || matchText(f.payoffAt))).map(f =>
        '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + f.workId + '/foreshadow"><div class="sr-title">🪝 ' + U.escapeHtml(U.short(f.content, 40)) + '</div><div class="sr-snippet">' + U.escapeHtml('埋设：' + (f.setupAt || '—') + ' · 回收：' + (f.payoffAt || '—')) + '</div></div>'
      ));
      push('时间线', D.timeline.filter(t => ancillaryMatchesScope(t) && (matchText(t.time) || matchText(t.event))).map(t =>
        '<div class="search-result" data-action="openSearchJump" data-to="#/w/' + t.workId + '/timeline"><div class="sr-title">🕰 ' + U.escapeHtml(t.time) + '</div><div class="sr-snippet">' + U.escapeHtml(snippet(t.event, q)) + '</div></div>'
      ));
      push('灵感', D.ideas.filter(i => ancillaryMatchesScope(i) && (matchText(i.title) || matchText(i.content) || matchText(i.tags))).map(i =>
        '<div class="search-result" data-action="openSearchJump" data-to="' + (i.workId ? '#/w/' + i.workId + '/ideas' : '#/ideas') + '"><div class="sr-title">💡 ' + U.escapeHtml(i.title || '灵感') + '</div><div class="sr-snippet">' + U.escapeHtml(snippet(i.content, q)) + '</div></div>'
      ));
    }
    box.innerHTML = html || '<div class="empty">在当前范围内没有找到「' + U.escapeHtml(q) + '」相关内容</div>';
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
