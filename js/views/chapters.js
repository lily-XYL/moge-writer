/* ============ 墨阁 · 章节管理（卷/章节树 + 详情 + 细纲） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const D = window.Data;
  const V = Views;

  /* ---------- 章节标签与章节树 ---------- */
  function chapterTags(c) {
    const raw = Array.isArray(c && c.tags) ? c.tags : String(c && c.tags || '').split(/[,，\n]/);
    return Array.from(new Set(raw.map(x => String(x || '').trim()).filter(Boolean))).slice(0, 12);
  }
  function allChapterTags() {
    return Array.from(new Set((App.data.chapters || []).flatMap(chapterTags))).sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }
  function chapterMatchesTag(c) {
    const filter = App.state.chapterTagFilter || '';
    return !filter || chapterTags(c).indexOf(filter) !== -1;
  }
  function tagFilterHtml() {
    const active = App.state.chapterTagFilter || '';
    const chips = [''].concat(allChapterTags()).map(tag => '<button class="chip' + (tag === active ? ' active' : '') + '" data-action="chapterTagFilter" data-tag="' + U.escapeHtml(tag) + '">' + U.escapeHtml(tag || '全部标签') + '</button>').join('');
    return '<div class="chapter-tag-filter"><span class="hint">筛选标签</span><div class="chapter-tag-chips">' + chips + '</div></div>';
  }
  function treeHTML(withFilter) {
    const filtering = !!withFilter && !!(App.state.chapterTagFilter || '');
    const vols = App.data.volumes;
    const chs = filtering ? App.data.chapters.filter(chapterMatchesTag) : App.data.chapters;
    const collapsed = App.state.collapsedVols || [];
    const byVol = {};
    vols.forEach(v => { byVol[v.id] = v; });
    const orphans = chs.filter(c => !c.volumeId || !byVol[c.volumeId]);
    const selected = App.state.selChapterId;
    let html = '<div class="tree">';
    vols.forEach(v => {
      const list = chs.filter(c => c.volumeId === v.id).sort((a, b) => (a.sort || 0) - (b.sort || 0));
      if (filtering && !list.length) return;
      const isCollapsed = collapsed.indexOf(v.id) !== -1;
      html += '<div class="vol' + (isCollapsed ? ' collapsed' : '') + '" data-action="toggleVol" data-id="' + v.id + '" draggable="true" data-drag="vol" title="拖动可排序卷">' +
        '<span class="arrow">▼</span><span style="flex:1">' + U.escapeHtml(v.title || '未命名卷') + '</span>' +
        '<span class="count">' + list.length + '章</span>' +
        '<span class="btn small icon" draggable="false" data-action="newChapterInVol" data-vol="' + v.id + '" title="在此卷新建章节">＋</span>' +
        '<span class="btn small icon" draggable="false" data-action="editVol" data-id="' + v.id + '" title="重命名卷">✎</span></div>';
      html += '<div class="vol-children" id="vol-' + v.id + '"' + (isCollapsed ? ' style="display:none"' : '') + '>';
      list.forEach(c => {
        html += chapRow(c, selected);
      });
      if (!list.length) html += '<div class="chap" style="color:var(--text-3);font-size:12px;padding-left:42px">（空卷）</div>';
      html += '</div>';
    });
    if (orphans.length || (!vols.length && !filtering)) {
      const isCollapsed = collapsed.indexOf('__orphan__') !== -1;
      html += '<div class="vol' + (isCollapsed ? ' collapsed' : '') + '" data-action="toggleVol" data-id="__orphan__" draggable="false">' +
        '<span class="arrow">▼</span><span style="flex:1">未分卷</span><span class="count">' + orphans.length + '章</span></div>';
      html += '<div class="vol-children" id="vol-__orphan__"' + (isCollapsed ? ' style="display:none"' : '') + '>';
      orphans.forEach(c => { html += chapRow(c, selected); });
      if (!orphans.length) html += '<div class="chap" style="color:var(--text-3);font-size:12px;padding-left:42px">（无）</div>';
      html += '</div>';
    }
    html += '</div>';
    if (filtering && !chs.length) html += '<div class="empty" style="padding:18px">没有带“' + U.escapeHtml(App.state.chapterTagFilter) + '”标签的章节</div>';
    return html;
  }

  function chapRow(c, selected) {
    const tags = chapterTags(c).slice(0, 2).map(tag => '<span class="chapter-mini-tag">' + U.escapeHtml(tag) + '</span>').join('');
    return '<div class="chap' + (c.id === selected ? ' active' : '') + '" id="tree-chap-' + c.id + '" data-action="selectChapter" data-id="' + c.id + '" draggable="true" data-drag="chap" title="拖动可排序/移动到其他卷">' +
      '<span class="c-dot ' + (c.status || 'draft') + '"></span>' +
      '<span class="c-title">' + U.escapeHtml(c.title || '无题') + '</span>' +
      (tags ? '<span class="chapter-mini-tags">' + tags + '</span>' : '') +
      '<span class="c-words">' + U.wcText(c.wordCount || 0) + '</span></div>';
  }

  V.chapters = {
    renderTreeInto(container) {
      if (container) container.innerHTML = treeHTML(false);
      bindDragSort(container);
    },
    renderTab(el) {
      App.state.selChapterId = App.state.selChapterId || (App.data.chapters[0] ? App.data.chapters[0].id : null);
      const sel = App.data.chapters.find(c => c.id === App.state.selChapterId) || null;
      const firstVol = App.data.volumes[0] ? App.data.volumes[0].id : '';
      el.innerHTML =
        '<div class="chapters-layout">' +
        '<div class="chapters-left">' +
        '<div class="tree-tools">' +
        '<button class="btn small" data-action="newChapterInVol" data-vol="' + firstVol + '">＋ 新章节</button>' +
        '<button class="btn small" data-action="newVolume">＋ 新卷</button>' +
        '</div>' +
        tagFilterHtml() +
        '<div class="tree-wrap" id="chapter-tree-wrap">' + treeHTML(true) + '</div>' +
        '</div>' +
        '<div class="chapter-detail" id="chapter-detail">' + (sel ? detailHTML(sel) : '<div class="empty">选择左侧章节查看详情</div>') + '</div>' +
        '</div>';
      bindDragSort(U.$('#chapter-tree-wrap'));
      V.chapters._tabEl = el;
    }
  };

  /* ---------- 拖拽排序（章节同卷/跨卷、卷排序） ---------- */
  let dragState = null;

  function bindDragSort(container) {
    if (!container || container._dragBound) return;
    container._dragBound = true;

    container.addEventListener('dragstart', e => {
      const row = e.target.closest('[data-drag]');
      if (!row || row.dataset.drag === 'false') return;
      dragState = { type: row.dataset.drag, id: row.dataset.id };
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragState.type + ':' + dragState.id);
      row.classList.add('dragging');
    });
    container.addEventListener('dragend', () => {
      clearDragHints(container);
      dragState = null;
    });
    container.addEventListener('dragover', e => {
      if (!dragState) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      clearDragHints(container);
      const target = e.target.closest('[data-drag]');
      if (!target || !target.dataset || target.dataset.drag === 'false') return;
      const r = target.getBoundingClientRect();
      if (dragState.type === 'chap' && target.dataset.drag === 'chap' && target.dataset.id !== dragState.id) {
        target.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
      } else if (dragState.type === 'chap' && target.dataset.drag === 'vol') {
        target.classList.add('drop-into');
      } else if (dragState.type === 'vol' && target.dataset.drag === 'vol' && target.dataset.id !== dragState.id) {
        target.classList.add(e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after');
      }
    });
    container.addEventListener('drop', e => {
      if (!dragState) return;
      e.preventDefault();
      const st = dragState;
      const target = e.target.closest('[data-drag]');
      clearDragHints(container);
      dragState = null;
      if (!target || !target.dataset || target.dataset.drag === 'false') return;
      const r = target.getBoundingClientRect();
      if (st.type === 'chap' && target.dataset.drag === 'chap' && target.dataset.id !== st.id) {
        moveChapterRelative(st.id, target.dataset.id, e.clientY < r.top + r.height / 2 ? 'before' : 'after');
      } else if (st.type === 'chap' && target.dataset.drag === 'vol') {
        moveChapterIntoVol(st.id, target.dataset.id);
      } else if (st.type === 'vol' && target.dataset.drag === 'vol' && target.dataset.id !== st.id) {
        moveVolRelative(st.id, target.dataset.id, e.clientY < r.top + r.height / 2 ? 'before' : 'after');
      }
    });
  }

  function clearDragHints(container) {
    U.$$('.drop-before, .drop-after, .drop-into, .dragging', container).forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-into', 'dragging'));
  }

  function reindex(arr) {
    arr.forEach((x, i) => { x.sort = (i + 1) * 10; });
  }

  async function moveChapterRelative(chapId, targetId, pos) {
    const c = App.data.chapters.find(x => x.id === chapId);
    const tc = App.data.chapters.find(x => x.id === targetId);
    if (!c || !tc) return;
    c.volumeId = tc.volumeId;
    const list = App.data.chapters.filter(x => x.volumeId === c.volumeId).sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const j = list.indexOf(c);
    if (j !== -1) list.splice(j, 1);
    const i = list.indexOf(tc);
    list.splice(pos === 'before' ? i : i + 1, 0, c);
    reindex(list);
    await DB.putMany('chapters', list);
    App.data.chapters.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    await touchWork();
    UI.toast(c.volumeId === tc.volumeId ? '已调整顺序' : '已移动到其他卷');
    rerenderTree();
    rerenderDetail();
  }

  async function moveChapterIntoVol(chapId, volId) {
    const c = App.data.chapters.find(x => x.id === chapId);
    if (!c) return;
    const realVol = volId === '__orphan__' ? '' : volId; /* 未分卷 = 空卷号 */
    if (c.volumeId === realVol) return;
    c.volumeId = realVol;
    const volChs = App.data.chapters.filter(x => x.volumeId === realVol);
    c.sort = App.nextSort(volChs);
    await DB.put('chapters', c);
    App.data.chapters.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    await touchWork();
    UI.toast(realVol ? '已移动到该卷末尾' : '已移动到未分卷');
    rerenderTree();
    rerenderDetail();
  }

  async function moveVolRelative(volId, targetId, pos) {
    const v = App.data.volumes.find(x => x.id === volId);
    const tv = App.data.volumes.find(x => x.id === targetId);
    if (!v || !tv) return;
    const list = App.data.volumes.slice().sort((a, b) => (a.sort || 0) - (b.sort || 0));
    const j = list.indexOf(v);
    if (j !== -1) list.splice(j, 1);
    const i = list.indexOf(tv);
    list.splice(pos === 'before' ? i : i + 1, 0, v);
    reindex(list);
    await DB.putMany('volumes', list);
    App.data.volumes = list;
    await touchWork();
    UI.toast('已调整卷顺序');
    rerenderTree();
  }

  function detailHTML(c) {
    const w = App.data.work;
    const stOpts = D.CH_STATUS.map(s => '<option value="' + s.v + '"' + (s.v === (c.status || 'draft') ? ' selected' : '') + '>' + s.l + '</option>').join('');
    return '<div class="card">' +
      '<div class="card-title">章节详情' +
      '<span class="save-state" id="ch-detail-saved" style="font-size:12px;color:var(--text-3)"></span></div>' +
      '<div class="detail-field"><label class="label">章节标题</label>' +
      '<input class="input" data-action="chSaveTitle" data-id="' + c.id + '" value="' + U.escapeHtml(c.title || '') + '" placeholder="无题"></div>' +
      '<div class="form-grid">' +
      '<div class="detail-field"><label class="label">状态</label><select class="select" data-action="chSaveStatus" data-id="' + c.id + '">' + stOpts + '</select></div>' +
      '<div class="detail-field"><label class="label">字数</label><div style="padding-top:8px;font-weight:700;color:var(--accent)">' + (c.wordCount || 0) + ' 字</div></div>' +
      '<div class="detail-field"><label class="label">创建于</label><div style="padding-top:8px;color:var(--text-2)">' + U.fmtDate(c.createdAt) + '</div></div>' +
      '<div class="detail-field"><label class="label">更新于</label><div style="padding-top:8px;color:var(--text-2)">' + U.fmtDate(c.updatedAt) + '</div></div>' +
      '</div>' +
      (c.status === 'published' ? '<div class="hint">发布于 ' + U.fmtDate(c.publishedAt) + '</div>' : '') +
      '<div class="detail-field"><label class="label">细纲（本章写作要点）</label>' +
      '<textarea class="textarea" data-action="chSaveOutline" data-id="' + c.id + '" rows="4" placeholder="本章要写什么：剧情要点、冲突、伏笔、结尾钩子…">' + U.escapeHtml(c.outline || '') + '</textarea></div>' +
      '<div class="detail-field"><label class="label">写作备注</label>' +
      '<textarea class="textarea" data-action="chSaveNotes" data-id="' + c.id + '" rows="2" placeholder="给自己看的备注（数据、灵感、待修改事项）">' + U.escapeHtml(c.notes || '') + '</textarea></div>' +
      '<div class="detail-field"><label class="label">章节标签</label><input class="input" data-action="chSaveTags" data-id="' + c.id + '" value="' + U.escapeHtml(chapterTags(c).join('，')) + '" placeholder="例如：主线，待修，战斗；以逗号分隔"></div>' +
      '<div class="detail-field"><label class="label">正文预览</label>' +
      '<div class="editor-preview" style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:8px;padding:10px 16px;background:var(--bg-soft)">' +
      U.nl2p(c.content) + '</div></div>' +
      '<div class="btn-row" style="margin-top:14px">' +
      '<button class="btn primary" data-action="openChapterEditor" data-id="' + c.id + '">✍ 开始写作</button>' +
      '<button class="btn" data-action="checkChapter" data-id="' + c.id + '">检查</button>' +
      '<button class="btn" data-action="exportChapter" data-id="' + c.id + '">导出单章</button>' +
      '<span class="topbar-spacer"></span>' +
      '<button class="btn small" data-action="chUp" data-id="' + c.id + '">↑ 上移</button>' +
      '<button class="btn small" data-action="chDown" data-id="' + c.id + '">↓ 下移</button>' +
      '<button class="btn small" data-action="chMoveVol" data-id="' + c.id + '">移动卷</button>' +
      '<button class="btn small danger" data-action="delChapter" data-id="' + c.id + '">删除</button>' +
      '</div></div>';
  }

  function rerenderTab() {
    const el = U.$('#work-tab-content') || U.$('#main');
    if (el) V.chapters.renderTab(el);
  }
  function rerenderTree() {
    const wrap = U.$('#chapter-tree-wrap') || U.$('#editor-tree-wrap');
    if (wrap) V.chapters.renderTreeInto(wrap);
  }
  function rerenderDetail() {
    const c = App.data.chapters.find(x => x.id === App.state.selChapterId);
    const box = U.$('#chapter-detail');
    if (box) box.innerHTML = c ? detailHTML(c) : '<div class="empty">选择左侧章节查看详情</div>';
  }

  function touchWork() {
    if (!App.data.work) return;
    App.data.work.updatedAt = Date.now();
    return DB.put('works', App.data.work);
  }

  /* ---------- Actions ---------- */
  Actions['toggleVol'] = t => {
    App.state.collapsedVols = App.state.collapsedVols || [];
    const id = t.dataset.id;
    const i = App.state.collapsedVols.indexOf(id);
    if (i === -1) App.state.collapsedVols.push(id); else App.state.collapsedVols.splice(i, 1);
    rerenderTree();
  };

  Actions['selectChapter'] = t => {
    App.state.selChapterId = t.dataset.id;
    rerenderTree();
    rerenderDetail();
  };

  Actions['newVolume'] = () => {
    UI.openModal('<h3 style="margin:0 0 4px">新建卷</h3><input class="input" id="new-vol-title" placeholder="卷名，如：第一卷 风起之地">' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="saveNewVolume">创建</button></div>');
  };

  Actions['saveNewVolume'] = async () => {
    const input = U.$('#new-vol-title');
    if (!input || !input.value.trim()) { UI.toast('请填写卷名', 'err'); return; }
    const v = {
      id: U.uid(), workId: App.state.workId, title: input.value.trim(), desc: '',
      sort: App.nextSort(App.data.volumes), createdAt: Date.now()
    };
    await DB.put('volumes', v);
    App.data.volumes.push(v);
    App.data.volumes.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    UI.closeModal();
    UI.toast('已创建卷');
    rerenderTab();
  };

  Actions['editVol'] = t => {
    const v = App.data.volumes.find(x => x.id === t.dataset.id);
    if (!v) return;
    UI.openModal('<h3 style="margin:0 0 4px">重命名卷</h3><input class="input" id="vol-title" value="' + U.escapeHtml(v.title || '') + '">' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="saveVol" data-id="' + v.id + '">保存</button></div>');
  };

  Actions['saveVol'] = async t => {
    const v = App.data.volumes.find(x => x.id === t.dataset.id);
    const input = U.$('#vol-title');
    if (!v || !input) return;
    v.title = input.value.trim() || v.title;
    await DB.put('volumes', v);
    UI.closeModal();
    rerenderTree();
  };

  Actions['newChapterInVol'] = async t => {
    const vol = t.dataset.vol || (App.data.volumes[0] ? App.data.volumes[0].id : '');
    const volChs = App.data.chapters.filter(c => c.volumeId === vol);
    const c = {
      id: U.uid(), workId: App.state.workId, volumeId: vol, title: '', content: '', outline: '',
      notes: '', tags: [], status: 'draft', wordCount: 0, sort: App.nextSort(volChs),
      createdAt: Date.now(), updatedAt: Date.now(), publishedAt: null
    };
    await DB.put('chapters', c);
    App.data.chapters.push(c);
    await touchWork();
    UI.toast('已创建章节');
    App.state.selChapterId = c.id;
    location.hash = '#/e/' + App.state.workId + '/' + c.id;
  };

  Actions['openChapterEditor'] = t => {
    location.hash = '#/e/' + App.state.workId + '/' + t.dataset.id;
  };

  Actions['checkChapter'] = t => {
    App.state.autoCheck = true;
    location.hash = '#/e/' + App.state.workId + '/' + t.dataset.id;
  };

  Actions['chSaveTitle'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    c.title = t.value;
    c.updatedAt = Date.now();
    await DB.put('chapters', c);
    await touchWork();
    rerenderTree();
    flashSaved();
  };

  Actions['chSaveStatus'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    c.status = t.value;
    if (t.value === 'published' && !c.publishedAt) c.publishedAt = Date.now();
    c.updatedAt = Date.now();
    await DB.put('chapters', c);
    await touchWork();
    rerenderTree();
    rerenderDetail();
    flashSaved();
  };

  Actions['chSaveOutline'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    c.outline = t.value;
    c.updatedAt = Date.now();
    await DB.put('chapters', c);
    await touchWork();
    flashSaved();
  };

  Actions['chSaveNotes'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    c.notes = t.value;
    c.updatedAt = Date.now();
    await DB.put('chapters', c);
    await touchWork();
    flashSaved();
  };
  Actions['chSaveTags'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    c.tags = Array.from(new Set(String(t.value || '').split(/[,，\n]/).map(x => x.trim()).filter(Boolean))).slice(0, 12);
    c.updatedAt = Date.now();
    await DB.put('chapters', c);
    await touchWork();
    if (U.$('.chapter-tag-filter')) rerenderTab(); else rerenderTree();
    flashSaved();
  };
  Actions['chapterTagFilter'] = t => {
    App.state.chapterTagFilter = t.dataset.tag || '';
    rerenderTab();
  };

  function flashSaved() {
    const el = U.$('#ch-detail-saved');
    if (el) { el.textContent = '✓ 已保存 ' + U.fmtDate(Date.now()).slice(11); }
  }

  function siblingsOf(c) {
    return App.data.chapters.filter(x => x.volumeId === c.volumeId).sort((a, b) => (a.sort || 0) - (b.sort || 0));
  }

  Actions['chUp'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    const list = siblingsOf(c);
    const i = list.indexOf(c);
    if (i <= 0) { UI.toast('已经是第一章节', 'warn'); return; }
    const prev = list[i - 1];
    const tmp = c.sort; c.sort = prev.sort; prev.sort = tmp;
    await DB.putMany('chapters', [c, prev]);
    App.data.chapters.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    rerenderTree();
  };

  Actions['chDown'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    const list = siblingsOf(c);
    const i = list.indexOf(c);
    if (i === -1 || i >= list.length - 1) { UI.toast('已经是最后一章节', 'warn'); return; }
    const next = list[i + 1];
    const tmp = c.sort; c.sort = next.sort; next.sort = tmp;
    await DB.putMany('chapters', [c, next]);
    App.data.chapters.sort((a, b) => (a.sort || 0) - (b.sort || 0));
    rerenderTree();
  };

  Actions['chMoveVol'] = t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    const opts = App.data.volumes.map(v =>
      '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer"><input type="radio" name="mvol" value="' + v.id + '"' + (c.volumeId === v.id ? ' checked' : '') + '> ' + U.escapeHtml(v.title) + '</label>'
    ).join('');
    UI.openModal('<h3 style="margin:0 0 4px">移动到卷</h3>' +
      '<label style="display:flex;align-items:center;gap:8px;padding:6px 0;cursor:pointer"><input type="radio" name="mvol" value=""' + (!c.volumeId ? ' checked' : '') + '> 未分卷</label>' +
      opts +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="saveMoveVol" data-id="' + c.id + '">移动</button></div>');
  };

  Actions['saveMoveVol'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    const modal = U.$('#modal-root .modal');
    const f = UI.readForm(modal);
    if (!c) return;
    c.volumeId = f.mvol || '';
    c.updatedAt = Date.now();
    await DB.put('chapters', c);
    UI.closeModal();
    UI.toast('已移动');
    rerenderTab();
  };

  Actions['delChapter'] = t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    UI.confirmDialog('删除章节', '确定删除《' + (c.title || '无题') + '》吗？此操作无法恢复。', async () => {
      await DB.del('chapters', c.id);
      App.data.chapters = App.data.chapters.filter(x => x.id !== c.id);
      if (App.state.selChapterId === c.id) App.state.selChapterId = null;
      await touchWork();
      UI.toast('已删除');
      rerenderTab();
    });
  };

  Actions['exportChapter'] = async t => {
    const c = App.data.chapters.find(x => x.id === t.dataset.id);
    if (!c) return;
    const txt = window.Export.buildChapterTxt(App.data.work, c);
    window.Export.download(Export.sanitizeFilename((App.data.work.title || 'work') + '_' + (c.title || 'chapter')) + '.txt', txt);
    UI.toast('已导出');
  };

  /* 编辑器侧边栏也复用此树 */
  V.chapters.rerenderTree = rerenderTree;
})();
