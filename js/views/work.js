/* ============ 墨阁 · 作品工作区（总览 / 大纲 / 作品设置 / 起名助手 / 全本检查） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const D = window.Data;

  const TABS = [
    { id: 'overview', l: '总览' },
    { id: 'chapters', l: '章节' },
    { id: 'outline', l: '大纲' },
    { id: 'world', l: '设定' },
    { id: 'foreshadow', l: '伏笔' },
    { id: 'timeline', l: '时间线' },
    { id: 'ideas', l: '灵感' },
    { id: 'stats', l: '统计' },
    { id: 'export', l: '导出' },
    { id: 'wsettings', l: '作品设置' }
  ];

  Views.work = {
    async render(el, workId, tab) {
      if (!App.data.work || App.data.work.id !== workId) {
        await App.loadWorkData(workId);
      }
      if (!App.data.work) { el.innerHTML = '<div class="empty">作品不存在或已删除</div>'; return; }
      const valid = TABS.some(t => t.id === tab);
      App.state.workTab = valid ? tab : 'overview';
      App.state.workId = workId;
      const w = App.data.work;
      const total = App.workTotalWords();
      const st = D.WORK_STATUS.find(x => x.v === w.status) || D.WORK_STATUS[0];
      el.innerHTML =
        '<div class="page-head">' +
        '<button class="btn small" data-action="goBookshelf">← 书架</button>' +
        '<h1 style="font-size:20px">' + U.escapeHtml(w.title || '未命名作品') + '</h1>' +
        '<span class="badge draft">' + U.escapeHtml(w.genre || '未分类') + '</span>' +
        '<span class="badge ' + (w.status || 'draft') + '">' + st.l + '</span>' +
        '<span style="color:var(--text-2);font-size:13px">全书 ' + U.wcText(total) + ' 字 · ' + App.data.chapters.length + ' 章</span>' +
        '<span class="topbar-spacer"></span>' +
        '<button class="btn" data-action="editWork" data-id="' + w.id + '">编辑信息</button>' +
        '</div>' +
        '<div class="tabbar">' + TABS.map(t =>
          '<button class="tab' + (t.id === App.state.workTab ? ' active' : '') + '" data-action="workTab" data-id="' + t.id + '">' + t.l + '</button>'
        ).join('') + '</div>' +
        '<div id="work-tab-content"></div>';
      const content = U.$('#work-tab-content');
      await Views.work.renderTab(content, App.state.workTab);
    },
    async renderTab(el, tab) {
      switch (tab) {
        case 'overview': await Views.overview.render(el); break;
        case 'chapters': Views.chapters.renderTab(el); break;
        case 'outline': Views.outline.render(el); break;
        case 'world': Views.world.render(el); break;
        case 'foreshadow': Views.plot.renderForeshadow(el); break;
        case 'timeline': Views.plot.renderTimeline(el); break;
        case 'ideas': Views.ideas.render(el, App.state.workId); break;
        case 'stats': Views.stats.render(el); break;
        case 'export': Views.exporttab.render(el); break;
        case 'wsettings': Views.worksettings.render(el); break;
      }
    }
  };

  Actions['workTab'] = t => {
    location.hash = '#/w/' + App.state.workId + '/' + t.dataset.id;
  };
  Actions['goBookshelf'] = () => { location.hash = '#/'; };

  /* ================= 总览 ================= */
  Views.overview = {
    async render(el) {
      const w = App.data.work;
      const chs = App.data.chapters;
      const map = App.dailyMap();
      const today = U.todayStr();
      const todayW = map[today] || 0;
      const goal = w.dailyGoal || App.settings.defaultGoal || 3000;
      const goalPct = goal ? Math.min(100, Math.round(todayW / goal * 100)) : 0;
      const last30 = sumRange(map, 30);
      const avg30 = Math.round(last30 / 30);
      const streak = calcStreak(map);
      const maxStreak = calcMaxStreak(map);
      const recent = chs.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 5);
      const last = App.settings.lastChapterId && chs.find(c => c.id === App.settings.lastChapterId);
      const firstVol = App.data.volumes[0] ? App.data.volumes[0].id : '';

      el.innerHTML =
        '<div class="stat-grid" style="margin-bottom:16px">' +
        statCard('全书总字数', U.wcText(App.workTotalWords())) +
        statCard('章节数', chs.length) +
        statCard('今日码字', todayW + ' 字') +
        statCard('近30日均值', avg30 + ' 字/天') +
        statCard('连续写作', streak + ' 天') +
        statCard('历史最长连更', maxStreak + ' 天') +
        '</div>' +
        '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-title">今日目标</div>' +
        '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">' +
        '<div class="goal-bar" style="width:60%;min-width:200px"><div class="fill" style="width:' + goalPct + '%"></div></div>' +
        '<span style="font-size:13px;color:var(--text-2)">' + todayW + ' / ' + goal + ' 字（' + goalPct + '%）</span>' +
        '</div></div>' +
        '<div class="two-col" style="margin-bottom:16px">' +
        '<div class="card">' +
        '<div class="card-title">快捷操作</div>' +
        '<div class="btn-row">' +
        '<button class="btn primary" data-action="continueWriting">✍ 继续写作</button>' +
        '<button class="btn" data-action="newChapterInVol" data-vol="' + firstVol + '">＋ 新章节</button>' +
        '<button class="btn" data-action="openNameGen">起名助手</button>' +
        '<button class="btn" data-action="fullCheck">全本检查</button>' +
        '</div>' +
        (last ? '<div class="hint" style="margin-top:10px">最近写作：《' + U.escapeHtml(last.title || '无题') + '》 ' + U.fmtDate(last.updatedAt) + '</div>' : '') +
        '</div>' +
        '<div class="card">' +
        '<div class="card-title">作品简介</div>' +
        (w.synopsis ? '<div style="font-size:13px;color:var(--text-2);white-space:pre-wrap">' + U.escapeHtml(w.synopsis) + '</div>'
          : '<div class="hint">暂无简介，可在「编辑信息」中填写。</div>') +
        '</div></div>' +
        '<div class="card">' +
        '<div class="card-title">最近更新的章节</div>' +
        (recent.length ? recent.map(c =>
          '<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid var(--line)">' +
          '<span class="c-dot ' + (c.status || 'draft') + '" style="width:7px;height:7px;border-radius:99px;background:' + dotColor(c.status) + '"></span>' +
          '<span style="flex:1;font-size:13px">' + U.escapeHtml(c.title || '无题') + '</span>' +
          '<span style="color:var(--text-3);font-size:12px">' + U.wcText(c.wordCount || 0) + '字</span>' +
          '<span style="color:var(--text-3);font-size:12px">' + U.fmtDate(c.updatedAt) + '</span>' +
          '<button class="btn small" data-action="openChapterEditor" data-id="' + c.id + '">写作</button></div>'
        ).join('') : '<div class="empty">还没有章节，点击「新章节」开始写作吧！</div>') +
        '</div>';
    }
  };

  function statCard(label, num) {
    return '<div class="stat-card"><div class="num">' + num + '</div><div class="lbl">' + label + '</div></div>';
  }
  function dotColor(status) {
    return status === 'published' ? 'var(--ok)' : status === 'final' ? 'var(--warn)' : 'var(--text-3)';
  }
  function sumRange(map, days) {
    let sum = 0;
    for (let i = 0; i < days; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      sum += map[fmtKey(d)] || 0;
    }
    return sum;
  }
  function fmtKey(d) {
    return d.getFullYear() + '-' + U.padN(d.getMonth() + 1) + '-' + U.padN(d.getDate());
  }
  function calcStreak(map) {
    let streak = 0;
    const d = new Date();
    if (!(map[fmtKey(d)] > 0)) d.setDate(d.getDate() - 1);
    while (map[fmtKey(d)] > 0) { streak++; d.setDate(d.getDate() - 1); }
    return streak;
  }
  function calcMaxStreak(map) {
    const keys = Object.keys(map).sort();
    let max = 0, cur = 0, prev = null;
    keys.forEach(k => {
      if (!(map[k] > 0)) { cur = 0; prev = null; return; }
      const dt = new Date(k + 'T00:00:00');
      if (prev && dt - prev === 86400000) cur++; else cur = 1;
      prev = dt;
      max = Math.max(max, cur);
    });
    return max;
  }

  /* ================= 大纲 ================= */
  Views.outline = {
    render(el) {
      const docs = App.data.outlines;
      el.innerHTML =
        '<div class="page-head" style="margin-bottom:14px"><div style="font-size:15px;font-weight:700">大纲文档</div>' +
        '<span class="sub">总体大纲、分卷细纲、人物弧光等，均可写在这里</span>' +
        '<span class="topbar-spacer"></span>' +
        '<button class="btn primary" data-action="outlineAdd">＋ 新建大纲</button></div>' +
        (docs.length ? docs.map((d, i) =>
          '<div class="outline-doc" id="od-' + d.id + '">' +
          '<div class="od-head">' +
          '<input class="od-title" data-action="outlineSaveTitle" data-id="' + d.id + '" value="' + U.escapeHtml(d.title || '未命名大纲') + '">' +
          '<span class="od-saved" data-od="' + d.id + '">✓ 已保存</span>' +
          '<span class="topbar-spacer"></span>' +
          '<button class="btn small" data-action="outlineUp" data-id="' + d.id + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button class="btn small" data-action="outlineDown" data-id="' + d.id + '"' + (i === docs.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button class="btn small danger" data-action="outlineDel" data-id="' + d.id + '">删除</button>' +
          '</div>' +
          '<textarea class="od-content" data-action="outlineSaveContent" data-id="' + d.id + '" placeholder="在这里写大纲…">' + U.escapeHtml(d.content || '') + '</textarea>' +
          '</div>'
        ).join('') : '<div class="card"><div class="empty">暂无大纲文档。建议先写「总体大纲」，再为每一卷写细纲。</div></div>');
    }
  };

  Actions['outlineAdd'] = async () => {
    const d = { id: U.uid(), workId: App.state.workId, title: '新大纲', content: '', sort: App.nextSort(App.data.outlines), createdAt: Date.now(), updatedAt: Date.now() };
    await DB.put('outlines', d);
    App.data.outlines.push(d);
    UI.toast('已新建大纲');
    Views.outline.render(U.$('#work-tab-content'));
  };
  Actions['outlineSaveTitle'] = async t => {
    const d = App.data.outlines.find(x => x.id === t.dataset.id);
    if (!d) return;
    d.title = t.value || '未命名大纲';
    d.updatedAt = Date.now();
    await DB.put('outlines', d);
    odFlash(d.id);
  };
  Actions['outlineSaveContent'] = async t => {
    const d = App.data.outlines.find(x => x.id === t.dataset.id);
    if (!d) return;
    d.content = t.value;
    d.updatedAt = Date.now();
    await DB.put('outlines', d);
    odFlash(d.id);
  };
  function odFlash(id) {
    const el = U.$('[data-od="' + id + '"]');
    if (el) { el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 1200); }
  }
  Actions['outlineUp'] = async t => { await outlineMove(t.dataset.id, -1); };
  Actions['outlineDown'] = async t => { await outlineMove(t.dataset.id, 1); };
  async function outlineMove(id, dir) {
    const arr = App.data.outlines;
    const i = arr.findIndex(x => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    const a = arr[i], b = arr[j];
    const tmp = a.sort; a.sort = b.sort; b.sort = tmp;
    await DB.putMany('outlines', [a, b]);
    arr.sort((x, y) => (x.sort || 0) - (y.sort || 0));
    Views.outline.render(U.$('#work-tab-content'));
  }
  Actions['outlineDel'] = t => {
    const d = App.data.outlines.find(x => x.id === t.dataset.id);
    if (!d) return;
    UI.confirmDialog('删除大纲', '确定删除《' + d.title + '》吗？', async () => {
      await DB.del('outlines', d.id);
      App.data.outlines = App.data.outlines.filter(x => x.id !== d.id);
      UI.toast('已删除');
      Views.outline.render(U.$('#work-tab-content'));
    });
  };

  /* ================= 作品设置 ================= */
  Views.worksettings = {
    render(el) {
      const w = App.data.work;
      const words = (w.customWords || []).join('\n');
      el.innerHTML =
        '<div class="card" style="max-width:640px">' +
        '<div class="card-title">作品设置</div>' +
        '<label class="label">每日目标字数（0 = 使用全局默认）</label>' +
        '<input class="input" type="number" min="0" data-action="wsGoal" value="' + (w.dailyGoal || '') + '" placeholder="如 3000">' +
        '<label class="label">本作品自定义违禁词（每行一个，与全局词表共同生效）</label>' +
        '<textarea class="textarea" rows="6" data-action="wsWords" placeholder="输入平台专用违禁词，每行一个">' + U.escapeHtml(words) + '</textarea>' +
        '<div class="hint" style="margin-top:6px">保存时机：输入框失焦时自动保存。</div>' +
        '<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--line)">' +
        '<button class="btn danger" data-action="wsDeleteWork">删除本作品</button>' +
        '<span class="hint" style="margin-left:10px">删除后全部数据无法恢复</span>' +
        '</div></div>';
    }
  };
  Actions['wsGoal'] = async t => {
    const w = App.data.work;
    w.dailyGoal = parseInt(t.value, 10) || 0;
    await DB.put('works', w);
    UI.toast('已保存目标');
  };
  Actions['wsWords'] = async t => {
    const w = App.data.work;
    w.customWords = t.value.split('\n').map(s => s.trim()).filter(Boolean);
    await DB.put('works', w);
    UI.toast('已保存违禁词');
  };
  Actions['wsDeleteWork'] = () => {
    const w = App.data.work;
    UI.confirmDialog('删除作品', '将删除《' + w.title + '》及其全部数据，无法恢复。确定删除吗？', async () => {
      await App.deleteWork(w.id);
      UI.toast('已删除');
      location.hash = '#/';
    });
  };

  /* ================= 起名助手 ================= */
  function nameGenHTML() {
    return '<h3 style="margin:0 0 4px">起名助手</h3>' +
      '<div class="form-grid">' +
      '<div><label class="label">性别</label><select class="select" id="ng-gender"><option value="male">男</option><option value="female">女</option><option value="neutral" selected>通用</option></select></div>' +
      '<div><label class="label">风格</label><select class="select" id="ng-style"><option value="classic">古典</option><option value="fresh">清新</option><option value="powerful">霸气</option><option value="cute">可爱</option></select></div>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:12px">' +
      '<button class="btn primary" data-action="ngGenerate">生成角色名</button>' +
      '<button class="btn" data-action="ngPen">生成笔名</button>' +
      '</div>' +
      '<div id="ng-results" style="margin-top:12px;max-height:320px;overflow:auto;display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start"></div>';
  }
  function ngShow(names) {
    const box = U.$('#ng-results');
    if (!box) return;
    box.innerHTML = names.map(n =>
      '<span class="chip" style="font-size:14px;padding:6px 14px" data-action="copyName" data-id="' + U.escapeHtml(n) + '">' + U.escapeHtml(n) + '</span>'
    ).join('') || '<div class="empty">生成失败，请重试</div>';
  }
  Actions['openNameGen'] = () => {
    UI.openModal(nameGenHTML());
    ngShow(window.NameGen.generateNames({ gender: 'neutral', style: 'classic', count: 12 }));
  };
  Actions['ngGenerate'] = () => {
    const g = U.$('#ng-gender'), s = U.$('#ng-style');
    ngShow(window.NameGen.generateNames({ gender: g ? g.value : 'neutral', style: s ? s.value : 'classic', count: 12 }));
  };
  Actions['ngPen'] = () => {
    ngShow(window.NameGen.penNames(10));
  };
  Actions['copyName'] = t => {
    copyText(t.dataset.id);
    UI.toast('已复制「' + t.dataset.id + '」');
  };
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => legacyCopy(text));
    } else legacyCopy(text);
  }
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }

  /* ================= 全本检查 ================= */
  Actions['fullCheck'] = async () => {
    const custom = (App.settings.sensitiveCustom || []).concat(App.data.work.customWords || []);
    const typoCustom = App.settings.typoCustom || [];
    const rows = [];
    let sT = 0, tT = 0;
    for (const c of App.data.chapters) {
      const s = window.Check.checkSensitive(c.content || '', custom);
      const t = window.Check.checkTypos(c.content || '', typoCustom);
      if (s.length || t.length) {
        rows.push({ c: c, s: s, t: t });
        sT += s.reduce((a, x) => a + x.count, 0);
        tT += t.reduce((a, x) => a + x.count, 0);
      }
    }
    const body = '<h3 style="margin:0 0 4px">全本检查</h3>' +
      '<div class="hint" style="margin-bottom:10px">共检查 ' + App.data.chapters.length + ' 章，发现问题：违禁词 ' + sT + ' 处，错别字 ' + tT + ' 处</div>' +
      (rows.length ? rows.map(r =>
        '<div style="border:1px solid var(--line);border-radius:8px;padding:10px 14px;margin-bottom:10px">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px"><b style="font-size:13px">' + U.escapeHtml(r.c.title || '无题') + '</b>' +
        '<span class="hint">' + U.wcText(r.c.wordCount) + '字</span><span class="topbar-spacer"></span>' +
        '<button class="btn small" data-action="fullCheckJump" data-id="' + r.c.id + '">去修改</button></div>' +
        (r.s.length ? r.s.map(x => '<div style="font-size:12px;color:var(--danger)">⚠ 违禁词「' + U.escapeHtml(x.word) + '」×' + x.count + (x.category ? '（' + U.escapeHtml(x.category) + '）' : '') + '</div>').join('') : '') +
        (r.t.length ? r.t.map(x => '<div style="font-size:12px;color:var(--warn)">✎ 疑似错别字「' + U.escapeHtml(x.wrong) + '」→「' + U.escapeHtml(x.right || '?') + '」×' + x.count + '</div>').join('') : '') +
        '</div>'
      ).join('') : '<div class="empty" style="padding:20px">🎉 全部章节未发现问题</div>');
    UI.openModal(body, { wide: true });
  };
  Actions['fullCheckJump'] = t => {
    UI.closeModal();
    location.hash = '#/e/' + App.state.workId + '/' + t.dataset.id;
  };
})();
