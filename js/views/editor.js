/* ============ 墨阁 · 写作编辑器（自动保存 / 码字模式 / 细纲 / 检查 / 预览） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;

  let ctx = null; /* 当前编辑上下文 {ch, ta, titleEl, outlineEl, prevEl, dirty} */
  let timerInt = null; /* 写作计时器 */
  const VERSION_LIMIT = 30;
  const VERSION_INTERVAL = 90 * 1000;

  function versionPayload(ch) {
    return {
      title: ch.title || '', content: ch.content || '', outline: ch.outline || '', notes: ch.notes || '',
      wordCount: ch.wordCount || 0, status: ch.status || 'draft', volumeId: ch.volumeId || ''
    };
  }
  function versionFingerprint(data) {
    return [data.title, data.content, data.outline, data.notes, data.status, data.volumeId].join('\u0001');
  }
  function changedVersion(before, after) {
    return versionFingerprint(before) !== versionFingerprint(after);
  }
  async function saveChapterVersion(ch, before, opts) {
    opts = opts || {};
    if (!before || (!opts.forceSnapshot && !changedVersion(before, versionPayload(ch)))) return false;
    const versions = (await DB.getByIndex('chapterVersions', 'chapterId', ch.id)).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    const fingerprint = versionFingerprint(before);
    if (versions[0] && versions[0].fingerprint === fingerprint) return false;
    if (!opts.force && versions[0] && Date.now() - (versions[0].savedAt || 0) < VERSION_INTERVAL) return false;
    const version = Object.assign({
      id: U.uid(), chapterId: ch.id, workId: ch.workId, savedAt: Date.now(),
      reason: opts.reason || '自动保存', fingerprint: fingerprint
    }, before);
    await DB.put('chapterVersions', version);
    const stale = versions.slice(VERSION_LIMIT - 1);
    if (stale.length) await Promise.all(stale.map(v => DB.del('chapterVersions', v.id)));
    return true;
  }

  /* ---------- 码字时长 / 速率 / 暂停计时 ---------- */
  function ensureSession() {
    if (!App.state.writeSession) {
      App.state.writeSession = { elapsedSec: 0, paused: false, wordsAtStart: App.workTotalWords() };
    }
    return App.state.writeSession;
  }
  function fmtDur(sec) {
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    const p = n => (n < 10 ? '0' + n : '' + n);
    return (h ? h + ':' : '') + p(m) + ':' + p(s);
  }
  function updateSessionUI() {
    const s = App.state.writeSession;
    if (!s) return;
    const tEl = U.$('#ed-timer'); if (tEl) tEl.textContent = fmtDur(s.elapsedSec);
    const rEl = U.$('#ed-rate');
    if (rEl) {
      const mins = s.elapsedSec / 60;
      const gained = App.workTotalWords() - s.wordsAtStart;
      rEl.textContent = mins >= 0.1 ? '⚡ ' + Math.round(gained / mins) + ' 字/分' : '⚡ -- 字/分';
    }
    const pEl = U.$('#ed-pause');
    if (pEl) pEl.textContent = s.paused ? '▶ 继续' : '⏸ 暂停';
  }
  function startTimer() {
    stopTimer();
    ensureSession();
    timerInt = setInterval(() => {
      const s = App.state.writeSession;
      if (s && !s.paused) { s.elapsedSec++; updateSessionUI(); }
    }, 1000);
    updateSessionUI();
  }
  function stopTimer() {
    if (timerInt) { clearInterval(timerInt); timerInt = null; }
  }
  function resumeTimer() {
    if (App.state.inEditor) startTimer();
  }
  Actions['edTogglePause'] = () => {
    const s = ensureSession();
    s.paused = !s.paused;
    updateSessionUI();
    UI.toast(s.paused ? '已暂停计时' : '已继续计时');
  };

  function goalOf() {
    return (App.data.work && (App.data.work.dailyGoal || App.settings.defaultGoal)) || App.settings.defaultGoal || 3000;
  }
  function goalPct() {
    const g = goalOf();
    return g ? Math.min(100, Math.round(App.todayWords() / g * 100)) : 0;
  }

  function setState(st) {
    const el = U.$('#ed-save-state');
    if (!el) return;
    if (st === 'saving') { el.textContent = '⏳ 保存中…'; el.className = 'save-state saving'; }
    else if (st === 'saved') { el.textContent = '✓ 已保存 ' + U.fmtDate(Date.now()).slice(11); el.className = 'save-state saved'; }
    else { el.textContent = '—'; el.className = 'save-state'; }
  }

  function updateLive(c) {
    if (!c) return;
    const words = U.countWords(c.ta ? c.ta.value : (c.ch.content || ''));
    const today = App.todayWords();
    const g = goalOf();
    const pct = g ? Math.min(100, Math.round(today / g * 100)) : 0;
    const wEl = U.$('#ed-words'); if (wEl) wEl.textContent = U.wcText(words);
    const tEl = U.$('#ed-today'); if (tEl) tEl.textContent = U.wcText(today);
    const gEl = U.$('#ed-goal-fill'); if (gEl) gEl.style.width = pct + '%';
    const nEl = U.$('#ed-goal-note'); if (nEl) nEl.textContent = today + '/' + g;
    const fw = U.$('#f-words'); if (fw) fw.textContent = U.wcText(words);
    const ft = U.$('#f-today'); if (ft) ft.textContent = U.wcText(today);
    const fg = U.$('#f-goal'); if (fg) fg.style.width = pct + '%';
  }

  function updateTreeWords(c) {
    if (!c) return;
    const el = U.$('#tree-chap-' + c.ch.id + ' .c-words');
    if (el) el.textContent = U.wcText(c.ch.wordCount || 0);
  }

  function doSave(c, flush) {
    if (!c) return Promise.resolve();
    const before = versionPayload(c.ch);
    const content = c.ta ? c.ta.value : (c.ch.content || '');
    const title = c.titleEl ? c.titleEl.value : (c.ch.title || '');
    const newWords = U.countWords(content);
    const delta = newWords - (c.ch.wordCount || 0);
    c.ch.title = title;
    c.ch.content = content;
    c.ch.wordCount = newWords;
    c.ch.updatedAt = Date.now();
    c.dirty = false;
    const tasks = [DB.put('chapters', c.ch), saveChapterVersion(c.ch, before, { force: !!flush, reason: flush ? '手动保存' : '自动保存' })];
    if (delta) tasks.push(App.recordWordsDelta(App.state.workId, delta));
    if (App.data.work) {
      App.data.work.updatedAt = Date.now();
      tasks.push(DB.put('works', App.data.work));
    }
    return Promise.all(tasks).then(() => {
      if (c === ctx) { setState('saved'); updateLive(c); updateTreeWords(c); updateSessionUI(); }
    });
  }

  function saveMeta(c) {
    if (!c) return;
    const before = versionPayload(c.ch);
    if (c.outlineEl) c.ch.outline = c.outlineEl.value;
    if (c.notesEl) c.ch.notes = c.notesEl.value;
    c.ch.updatedAt = Date.now();
    return Promise.all([DB.put('chapters', c.ch), saveChapterVersion(c.ch, before, { reason: '自动保存' })]);
  }

  Views.editor = {
    async render(el, workId, chapterId) {
      if (!App.data.work || App.data.work.id !== workId) {
        await App.loadWorkData(workId);
      }
      if (!App.data.work) { el.innerHTML = '<div class="empty">作品不存在或已删除</div>'; return; }
      let ch = App.data.chapters.find(c => c.id === chapterId);
      if (!ch) {
        if (!App.data.chapters.length) {
          ch = {
            id: U.uid(), workId: workId,
            volumeId: App.data.volumes[0] ? App.data.volumes[0].id : '',
            title: '', content: '', outline: '', notes: '', status: 'draft', wordCount: 0,
            sort: 10, createdAt: Date.now(), updatedAt: Date.now(), publishedAt: null
          };
          await DB.put('chapters', ch);
          App.data.chapters.push(ch);
          UI.toast('已创建第一个章节');
        } else {
          ch = App.data.chapters[0];
        }
        location.replace('#/e/' + workId + '/' + ch.id);
      }
      App.state.chapterId = ch.id;
      App.settings.lastWorkId = workId;
      App.settings.lastChapterId = ch.id;
      DB.put('settings', { key: 'lastWorkId', value: workId });
      DB.put('settings', { key: 'lastChapterId', value: ch.id });

      buildUI(el, ch);
      if (App.state.autoCheck) { App.state.autoCheck = false; openCheck(); }
    },

    flush() {
      if (ctx && ctx.dirty) return doSave(ctx, true);
      return Promise.resolve();
    },
    stopTimer: stopTimer,
    resumeTimer: resumeTimer
  };

  function buildUI(el, ch) {
    const w = App.data.work;
    const total = App.workTotalWords();
    App.state.edOutline = App.state.edOutline !== false; /* 默认展开细纲 */
    el.innerHTML =
      '<div class="editor-wrap">' +
      '<aside class="editor-side">' +
      '<div class="side-head">' +
      '<button class="btn small" data-action="goWorkFromEditor" title="返回作品">←</button>' +
      '<b style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + U.escapeHtml(w.title || '') + '</b>' +
      '</div>' +
      '<div class="tree-tools">' +
      '<button class="btn small" data-action="newChapterInVol" data-vol="' + (App.data.volumes[0] ? App.data.volumes[0].id : '') + '">＋ 新章节</button>' +
      '<button class="btn small" data-action="goChapters">章节管理</button>' +
      '</div>' +
      '<div class="tree-wrap" id="editor-tree-wrap"></div>' +
      '</aside>' +
      '<div class="editor-main">' +
      '<div class="editor-toolbar">' +
      '<button class="btn small" data-action="edPrev" title="上一章">←</button>' +
      '<button class="btn small" data-action="edNext" title="下一章">→</button>' +
      '<button class="btn small' + (App.state.edOutline ? ' active' : '') + '" data-action="edToggleOutline">细纲</button>' +
      '<button class="btn small" data-action="edToggleCheck">检查</button>' +
      '<button class="btn small" data-action="edHistory">历史</button>' +
      '<button class="btn small" data-action="edTogglePreview">预览</button>' +
      '<span class="topbar-spacer"></span>' +
      '<span class="save-state" id="ed-save-state">—</span>' +
      '<button class="btn small primary" data-action="edFocusMode">⛶ 码字模式</button>' +
      '</div>' +
      '<input class="editor-title-input" id="editor-title-input" value="' + U.escapeHtml(ch.title || '') + '" placeholder="章节标题（可留空）">' +
      (App.state.edOutline
        ? '<div class="outline-panel"><div class="op-grid">' +
          '<div><div class="label">📋 本章细纲</div><textarea id="editor-outline" rows="3" placeholder="本章写什么：剧情推进、冲突爆发、伏笔埋设、结尾钩子…">' + U.escapeHtml(ch.outline || '') + '</textarea></div>' +
          '<div><div class="label">📝 写作备注</div><textarea id="editor-notes" rows="3" placeholder="给自己看的备注：待修改事项、数据对照、灵感补充…">' + U.escapeHtml(ch.notes || '') + '</textarea></div>' +
          '</div></div>'
        : '') +
      '<div class="editor-content-wrap"><div class="editor-paper">' +
      '<textarea id="editor-textarea" placeholder="开始写作吧…">' + U.escapeHtml(ch.content || '') + '</textarea>' +
      '<div id="editor-preview" class="editor-preview" style="display:none"></div>' +
      '</div></div>' +
      '<div class="editor-statusbar">' +
      '<span>本章 <b id="ed-words">' + U.wcText(ch.wordCount || 0) + '</b></span>' +
      '<span>今日 <b id="ed-today">' + U.wcText(App.todayWords()) + '</b></span>' +
      '<span class="goal-bar"><span class="fill" id="ed-goal-fill" style="width:' + goalPct() + '%"></span></span>' +
      '<span class="progress-note" id="ed-goal-note">' + App.todayWords() + '/' + goalOf() + '</span>' +
      '<span class="timer-chip" title="本作品本次写作时长（在编辑器内且未暂停时累计）">⏱ <b id="ed-timer">00:00</b></span>' +
      '<span id="ed-rate">⚡ -- 字/分</span>' +
      '<button class="btn small" id="ed-pause" data-action="edTogglePause">⏸ 暂停</button>' +
      '<span class="topbar-spacer"></span>' +
      '<span>全书 <b>' + U.wcText(total) + '</b> 字</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="check-drawer" id="check-drawer"><div class="cd-head"><b>🔍 检查</b><span class="topbar-spacer"></span>' +
      '<button class="btn small" data-action="edCheckRun">重新检查</button>' +
      '<button class="modal-close" data-action="edCloseCheck">✕</button></div>' +
      '<div class="cd-body" id="check-body"></div></div>';

    const ta = U.$('#editor-textarea');
    const titleEl = U.$('#editor-title-input');
    const outlineEl = U.$('#editor-outline');
    const notesEl = U.$('#editor-notes');
    const prevEl = U.$('#editor-preview');
    ctx = { ch: ch, ta: ta, titleEl: titleEl, outlineEl: outlineEl, notesEl: notesEl, prevEl: prevEl, dirty: false };
    const myCtx = ctx; /* 闭包固定本渲染的上下文，防止切换章节后误存 */

    App.state.selChapterId = ch.id; /* 树高亮当前编辑章节（而非陈旧选中） */
    Views.chapters.renderTreeInto(U.$('#editor-tree-wrap'));
    setState('saved');
    startTimer();

    const debouncedSave = U.debounce(() => doSave(myCtx, false), App.settings.autosave || 1000);
    ta.addEventListener('input', () => {
      myCtx.dirty = true;
      setState('saving');
      updateLive(myCtx);
      debouncedSave();
    });
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave(myCtx, true); UI.toast('已保存'); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); doSave(myCtx, true); goAdjacent(1); }
    });
    titleEl.addEventListener('input', () => {
      myCtx.dirty = true;
      setState('saving');
      debouncedSave();
    });
    const metaDebounce = U.debounce(() => saveMeta(myCtx), 800);
    if (outlineEl) {
      outlineEl.addEventListener('input', () => metaDebounce());
    }
    if (notesEl) {
      notesEl.addEventListener('input', () => metaDebounce());
    }

    if (App.state.checkPanelOpen) { App.state.checkPanelOpen = false; openCheck(); }
  }

  /* ---------- 章节切换 ---------- */
  function goAdjacent(dir) {
    if (!ctx) return;
    doSave(ctx, true);
    const chs = App.getOrderedChapters();
    const i = chs.findIndex(c => c.id === ctx.ch.id);
    const j = Math.max(0, Math.min(chs.length - 1, i + dir));
    if (j === i) { UI.toast(dir > 0 ? '已经是最后一章' : '已经是第一章', 'warn'); return; }
    location.hash = '#/e/' + App.state.workId + '/' + chs[j].id;
  }

  Actions['edPrev'] = () => goAdjacent(-1);
  Actions['edNext'] = () => goAdjacent(1);

  Actions['goWorkFromEditor'] = () => { Views.editor.flush(); location.hash = '#/w/' + App.state.workId + '/overview'; };
  Actions['goChapters'] = () => { Views.editor.flush(); location.hash = '#/w/' + App.state.workId + '/chapters'; };

  /* 编辑器内点击章节树 → 跳转编辑 */
  {
    const origSelect = Actions['selectChapter'];
    Actions['selectChapter'] = function (t) {
      if (location.hash.indexOf('#/e/') === 0) {
        Views.editor.flush();
        location.hash = '#/e/' + App.state.workId + '/' + t.dataset.id;
      } else if (origSelect) {
        origSelect(t);
      }
    };
  }

  /* ---------- 细纲 / 预览 ---------- */
  Actions['edToggleOutline'] = () => {
    App.state.edOutline = !App.state.edOutline;
    if (ctx) { Views.editor.flush(); Views.editor.render(U.$('#main'), App.state.workId, ctx.ch.id); }
  };
  Actions['edTogglePreview'] = () => {
    if (!ctx) return;
    if (ctx.prevEl.style.display === 'none') {
      ctx.prevEl.innerHTML = U.nl2p(ctx.ta.value);
      ctx.prevEl.style.display = 'block';
      ctx.ta.style.display = 'none';
      UI.toast('预览模式（点击「预览」返回编辑）');
    } else {
      ctx.prevEl.style.display = 'none';
      ctx.ta.style.display = '';
      ctx.ta.focus();
    }
  };

  /* ---------- 检查面板 ---------- */
  function openCheck() {
    const d = U.$('#check-drawer');
    if (d) { d.classList.add('open'); runCheck(); }
  }
  Actions['edToggleCheck'] = () => {
    const d = U.$('#check-drawer');
    if (!d) return;
    if (d.classList.contains('open')) d.classList.remove('open');
    else openCheck();
  };
  Actions['edCloseCheck'] = () => {
    const d = U.$('#check-drawer');
    if (d) d.classList.remove('open');
  };
  Actions['edCheckRun'] = () => runCheck();

  function customWordLists() {
    const globalW = App.settings.sensitiveCustom || [];
    const workW = (App.data.work && App.data.work.customWords) || [];
    return globalW.concat(workW);
  }

  function runCheck() {
    const body = U.$('#check-body');
    if (!body) return;
    const text = ctx ? (ctx.ta ? ctx.ta.value : ctx.ch.content || '') : '';
    const sens = window.Check.checkSensitive(text, customWordLists());
    const typos = window.Check.checkTypos(text, App.settings.typoCustom || []);
    const sTotal = sens.reduce((a, x) => a + x.count, 0);
    const tTotal = typos.reduce((a, x) => a + x.count, 0);
    let html = '<div class="hint" style="margin-bottom:12px">本章 ' + U.wcText(U.countWords(text)) + ' 字 · 违禁词 ' + sTotal + ' 处 · 疑似错别字 ' + tTotal + ' 处</div>';
    if (!sTotal && !tTotal) html += '<div class="empty" style="padding:30px">🎉 本章未发现问题</div>';
    if (sens.length) {
      html += '<div class="sr-group">⚠ 违禁词 / 敏感词</div>';
      html += sens.map(x =>
        '<div class="check-item"><div class="ci-word">' + U.escapeHtml(x.word) + '</div>' +
        '<div class="ci-meta">出现 ' + x.count + ' 次' + (x.category ? ' · ' + U.escapeHtml(x.category) : '') + '</div>' +
        '<div class="ci-acts"><button class="btn small" data-action="edCheckJump" data-idx="' + x.positions[0] + '" data-len="' + x.word.length + '">定位</button></div></div>'
      ).join('');
    }
    if (typos.length) {
      html += '<div class="sr-group">✎ 疑似错别字</div>';
      html += typos.map(x =>
        '<div class="check-item"><div class="ci-word" style="color:var(--warn)">' + U.escapeHtml(x.wrong) + '</div>' +
        '<div class="ci-meta">建议改为：' + U.escapeHtml(x.right || '？') + ' · 出现 ' + x.count + ' 次</div>' +
        '<div class="ci-acts">' +
        '<button class="btn small" data-action="edCheckJump" data-idx="' + x.positions[0] + '" data-len="' + x.wrong.length + '">定位</button>' +
        (x.right ? '<button class="btn small primary" data-action="edCheckReplace" data-w="' + U.escapeHtml(x.wrong) + '" data-r="' + U.escapeHtml(x.right) + '">全部替换</button>' : '') +
        '</div></div>'
      ).join('');
    }
    body.innerHTML = html;
  }

  Actions['edCheckJump'] = t => {
    if (!ctx || !ctx.ta) return;
    const idx = parseInt(t.dataset.idx, 10) || 0;
    const len = parseInt(t.dataset.len, 10) || 0;
    if (ctx.ta.style.display === 'none') {
      ctx.prevEl.style.display = 'none';
      ctx.ta.style.display = '';
    }
    ctx.ta.focus();
    ctx.ta.setSelectionRange(idx, idx + len);
  };
  Actions['edCheckReplace'] = t => {
    if (!ctx || !ctx.ta) return;
    const w = t.dataset.w, r = t.dataset.r;
    ctx.ta.value = ctx.ta.value.split(w).join(r);
    ctx.dirty = true;
    setState('saving');
    updateLive(ctx);
    doSave(ctx, true);
    runCheck();
    UI.toast('已替换');
  };

  /* ---------- 章节版本历史 ---------- */
  function versionTime(version) {
    return U.fmtDate(version.savedAt || Date.now());
  }
  function versionReason(version) {
    return version.reason === '回滚前备份' ? '回滚前备份' : (version.reason || '自动保存');
  }
  function versionExcerpt(version) {
    const text = (version.content || '').replace(/\s+/g, ' ').trim();
    return text ? U.short(text, 96) : '（当时正文为空）';
  }
  async function openChapterHistory() {
    if (!ctx) return;
    const versions = (await DB.getByIndex('chapterVersions', 'chapterId', ctx.ch.id)).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
    App._chapterVersions = versions;
    const currentWords = U.countWords(ctx.ta ? ctx.ta.value : ctx.ch.content || '');
    const rows = versions.length ? versions.map(v =>
      '<div class="version-row">' +
      '<div class="version-main"><b>' + U.escapeHtml(versionTime(v)) + '</b><span class="version-badge">' + U.escapeHtml(versionReason(v)) + '</span>' +
      '<div class="hint">' + U.wcText(v.wordCount || 0) + ' 字 · ' + U.escapeHtml(v.title || '无题章节') + '</div>' +
      '<div class="version-excerpt">' + U.escapeHtml(versionExcerpt(v)) + '</div></div>' +
      '<div class="version-actions"><button class="btn small" data-action="edHistoryCompare" data-id="' + v.id + '">对比</button>' +
      '<button class="btn small danger" data-action="edHistoryRollback" data-id="' + v.id + '">回滚</button></div>' +
      '</div>'
    ).join('') : '<div class="empty" style="padding:28px 10px">还没有历史版本。正文、标题、细纲或备注发生保存后会自动创建快照。</div>';
    UI.openModal('<h3 style="margin:0 0 4px">章节版本历史</h3>' +
      '<div class="hint" style="margin-bottom:12px">当前版本：' + U.wcText(currentWords) + ' 字 · 最多保留最近 ' + VERSION_LIMIT + ' 个快照。回滚前会自动再备份当前内容。</div>' +
      '<div class="version-list">' + rows + '</div>', { wide: true });
  }
  Actions['edHistory'] = async () => {
    if (!ctx) return;
    await doSave(ctx, true);
    await openChapterHistory();
  };
  Actions['edHistoryCompare'] = t => {
    if (!ctx) return;
    const version = (App._chapterVersions || []).find(v => v.id === t.dataset.id);
    if (!version) return;
    const current = versionPayload(ctx.ch);
    UI.openModal('<h3 style="margin:0 0 4px">版本内容对比</h3>' +
      '<div class="hint" style="margin-bottom:12px">左侧为选定历史版本，右侧为当前版本。</div>' +
      '<div class="version-compare">' +
      '<section><b>历史 · ' + U.escapeHtml(versionTime(version)) + '</b><span class="hint"> · ' + U.wcText(version.wordCount || 0) + ' 字</span>' +
      '<pre>' + U.escapeHtml(version.content || '（空）') + '</pre></section>' +
      '<section><b>当前</b><span class="hint"> · ' + U.wcText(current.wordCount || 0) + ' 字</span>' +
      '<pre>' + U.escapeHtml(current.content || '（空）') + '</pre></section>' +
      '</div><div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">关闭</button></div>', { wide: true });
  };
  Actions['edHistoryRollback'] = t => {
    if (!ctx) return;
    const version = (App._chapterVersions || []).find(v => v.id === t.dataset.id);
    if (!version) return;
    UI.confirmDialog('回滚章节', '将恢复到 ' + versionTime(version) + ' 的版本。当前内容会先自动保存为一个历史快照。', async () => {
      if (!ctx) return;
      const before = versionPayload(ctx.ch);
      await saveChapterVersion(ctx.ch, before, { force: true, forceSnapshot: true, reason: '回滚前备份' });
      const oldWords = ctx.ch.wordCount || 0;
      Object.assign(ctx.ch, {
        title: version.title || '', content: version.content || '', outline: version.outline || '', notes: version.notes || '',
        wordCount: version.wordCount || 0, status: version.status || 'draft', volumeId: version.volumeId || '', updatedAt: Date.now()
      });
      const delta = (ctx.ch.wordCount || 0) - oldWords;
      const tasks = [DB.put('chapters', ctx.ch)];
      if (delta) tasks.push(App.recordWordsDelta(ctx.ch.workId, delta));
      if (App.data.work) { App.data.work.updatedAt = Date.now(); tasks.push(DB.put('works', App.data.work)); }
      await Promise.all(tasks);
      UI.toast('已回滚章节，并保存回滚前版本');
      Views.editor.render(U.$('#main'), ctx.ch.workId, ctx.ch.id);
    }, '确认回滚');
  };

  /* ---------- 码字模式 ---------- */
  Actions['edFocusMode'] = () => {
    if (!ctx) return;
    const myCtx = ctx;
    doSave(myCtx, true);
    if (U.$('#focus-overlay')) return;
    const ov = document.createElement('div');
    ov.className = 'focus-mode';
    ov.id = 'focus-overlay';
    ov.innerHTML =
      '<div class="focus-bar">' +
      '<span>本章 <b id="f-words">' + U.wcText(myCtx.ch.wordCount || 0) + '</b> 字</span>' +
      '<span>今日 <b id="f-today">' + U.wcText(App.todayWords()) + '</b></span>' +
      '<span class="goal-bar"><span class="fill" id="f-goal" style="width:' + goalPct() + '%"></span></span>' +
      '<span class="progress-note">' + App.todayWords() + '/' + goalOf() + '</span>' +
      '<span class="topbar-spacer"></span>' +
      '<span class="hint">Ctrl+S 保存 · Esc 退出</span>' +
      '</div>' +
      '<div class="focus-paper"><textarea id="focus-textarea" placeholder="进入心流，码字吧…">' + U.escapeHtml(myCtx.ta.value) + '</textarea></div>';
    document.body.appendChild(ov);
    const fta = U.$('#focus-textarea');
    App.state.focusMode = true;
    const debouncedFocusSave = U.debounce(() => doSave(myCtx, true), App.settings.autosave || 1000);
    fta.addEventListener('input', () => {
      myCtx.ta.value = fta.value;
      myCtx.dirty = true;
      setState('saving');
      updateLive(myCtx);
      updateTreeWords(myCtx);
      debouncedFocusSave();
    });
    fta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.preventDefault(); exitFocus(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave(myCtx, true); }
    });
    fta.focus();
    fta.setSelectionRange(fta.value.length, fta.value.length);
  };

  function exitFocus() {
    const ov = U.$('#focus-overlay');
    if (!ov) return;
    const myCtx = ctx;
    doSave(myCtx, true);
    ov.remove();
    App.state.focusMode = false;
    if (myCtx && myCtx.ta) { myCtx.ta.focus(); }
  }
  Actions['edExitFocus'] = () => exitFocus();
})();
