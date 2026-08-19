/* ============ 墨阁 · 伏笔管理 / 时间线 ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;

  /* ---------- 伏笔 ---------- */
  Views.plot = {
    renderForeshadow(el) {
      const filter = App.state.fsFilter || 'all';
      const list = App.data.foreshadows.filter(f =>
        filter === 'all' || (filter === 'open' ? f.status !== 'paid' : f.status === 'paid')
      );
      el.innerHTML =
        '<div class="page-head" style="margin-bottom:14px">' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<span class="chip' + (filter === 'all' ? ' active' : '') + '" data-action="fsFilter" data-id="all">全部</span>' +
        '<span class="chip' + (filter === 'open' ? ' active' : '') + '" data-action="fsFilter" data-id="open">未回收</span>' +
        '<span class="chip' + (filter === 'paid' ? ' active' : '') + '" data-action="fsFilter" data-id="paid">已回收</span>' +
        '</div><span class="topbar-spacer"></span>' +
        '<button class="btn primary" data-action="fsNew">＋ 新伏笔</button></div>' +
        (list.length ?
          '<div class="card" style="padding:8px 14px"><table class="table">' +
          '<thead><tr><th style="width:34%">伏笔内容</th><th>埋设章节</th><th>回收章节</th><th>状态</th><th style="width:200px">操作</th></tr></thead><tbody>' +
          list.map(f =>
            '<tr><td><b>' + U.escapeHtml(U.short(f.content, 40)) + '</b>' + (f.note ? '<div class="hint">' + U.escapeHtml(U.short(f.note, 30)) + '</div>' : '') + '</td>' +
            '<td>' + U.escapeHtml(f.setupAt || '—') + '</td>' +
            '<td>' + (f.status === 'paid' ? U.escapeHtml(f.payoffAt || '已回收') : '<span style="color:var(--text-3)">未回收</span>') + '</td>' +
            '<td><span class="badge ' + (f.status === 'paid' ? 'paid' : 'open') + '">' + (f.status === 'paid' ? '已回收' : '未回收') + '</span></td>' +
            '<td><div class="btn-row">' +
            '<button class="btn small" data-action="fsEdit" data-id="' + f.id + '">编辑</button>' +
            (f.status === 'paid'
              ? '<button class="btn small" data-action="fsToggle" data-id="' + f.id + '">撤销回收</button>'
              : '<button class="btn small" data-action="fsToggle" data-id="' + f.id + '">标记回收</button>') +
            '<button class="btn small danger" data-action="fsDel" data-id="' + f.id + '">删除</button>' +
            '</div></td></tr>'
          ).join('') + '</tbody></table></div>'
          : '<div class="card"><div class="empty"><div class="big">🪝</div>暂无伏笔记录。好故事离不开埋下与回收！</div></div>');
    }
  };

  function fsFormHtml(f) {
    f = f || {};
    return '<h3 style="margin:0 0 4px">' + (f.id ? '编辑伏笔' : '新伏笔') + '</h3>' +
      '<label class="label">伏笔内容 *</label>' +
      '<textarea class="textarea" name="content" rows="3" placeholder="要埋下什么线索/悬念？">' + U.escapeHtml(f.content || '') + '</textarea>' +
      '<div class="form-grid">' +
      '<div><label class="label">埋设章节</label><input class="input" name="setupAt" value="' + U.escapeHtml(f.setupAt || '') + '" placeholder="如：第12章 / 第一卷"></div>' +
      '<div><label class="label">回收章节</label><input class="input" name="payoffAt" value="' + U.escapeHtml(f.payoffAt || '') + '" placeholder="如：第58章"></div>' +
      '</div>' +
      '<label class="label">状态</label><select class="select" name="status">' +
      '<option value="open"' + ((f.status || 'open') === 'open' ? ' selected' : '') + '>未回收</option>' +
      '<option value="paid"' + (f.status === 'paid' ? ' selected' : '') + '>已回收</option></select>' +
      '<label class="label">备注</label><input class="input" name="note" value="' + U.escapeHtml(f.note || '') + '" placeholder="如：要如何回收">' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="fsSave" data-id="' + (f.id || '') + '">保存</button></div>';
  }

  Actions['fsFilter'] = t => { App.state.fsFilter = t.dataset.id; Views.plot.renderForeshadow(U.$('#work-tab-content')); };
  Actions['fsNew'] = () => UI.openModal(fsFormHtml());
  Actions['fsEdit'] = t => {
    const f = App.data.foreshadows.find(x => x.id === t.dataset.id);
    if (f) UI.openModal(fsFormHtml(f));
  };
  Actions['fsSave'] = async t => {
    const f = UI.readForm(U.$('#modal-root .modal'));
    if (!f.content.trim()) { UI.toast('请填写伏笔内容', 'err'); return; }
    const now = Date.now();
    if (t.dataset.id) {
      const rec = App.data.foreshadows.find(x => x.id === t.dataset.id);
      if (!rec) return;
      Object.assign(rec, f);
      rec.updatedAt = now;
      await DB.put('foreshadows', rec);
    } else {
      const rec = Object.assign({ id: U.uid(), workId: App.state.workId, sort: App.nextSort(App.data.foreshadows), createdAt: now, updatedAt: now }, f);
      await DB.put('foreshadows', rec);
      App.data.foreshadows.push(rec);
    }
    UI.closeModal();
    UI.toast('已保存');
    Views.plot.renderForeshadow(U.$('#work-tab-content'));
  };
  Actions['fsToggle'] = async t => {
    const f = App.data.foreshadows.find(x => x.id === t.dataset.id);
    if (!f) return;
    f.status = f.status === 'paid' ? 'open' : 'paid';
    f.updatedAt = Date.now();
    await DB.put('foreshadows', f);
    UI.toast(f.status === 'paid' ? '已标记回收 🎉' : '已恢复为未回收');
    Views.plot.renderForeshadow(U.$('#work-tab-content'));
  };
  Actions['fsDel'] = t => {
    UI.confirmDialog('删除伏笔', '确定删除该伏笔记录吗？', async () => {
      await DB.del('foreshadows', t.dataset.id);
      App.data.foreshadows = App.data.foreshadows.filter(x => x.id !== t.dataset.id);
      UI.toast('已删除');
      Views.plot.renderForeshadow(U.$('#work-tab-content'));
    });
  };

  /* ---------- 时间线 ---------- */
  function tlSort(a, b) {
    const an = U.numOr(a.time), bn = U.numOr(b.time);
    if (an != null && bn != null) return an - bn || (a.sort || 0) - (b.sort || 0);
    if (an != null) return -1;
    if (bn != null) return 1;
    return String(a.time || '').localeCompare(String(b.time || ''), 'zh') || (a.sort || 0) - (b.sort || 0);
  }

  Views.plot.renderTimeline = function (el) {
    const list = App.data.timeline.slice().sort(tlSort);
    el.innerHTML =
      '<div class="page-head" style="margin-bottom:14px"><div style="font-size:15px;font-weight:700">故事时间线</div>' +
      '<span class="sub">按故事内时间排列的重要事件</span><span class="topbar-spacer"></span>' +
      '<button class="btn primary" data-action="tlNew">＋ 新事件</button></div>' +
      (list.length ?
        '<div style="border-left:2px solid var(--line);margin-left:10px;padding-left:20px">' +
        list.map(e =>
          '<div style="padding:8px 0 16px;position:relative">' +
          '<span style="position:absolute;left:-27px;top:14px;width:10px;height:10px;border-radius:99px;background:var(--accent);border:2px solid var(--card)"></span>' +
          '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
          '<b style="color:var(--accent)">' + U.escapeHtml(e.time || '（时间未填）') + '</b>' +
          '<span class="topbar-spacer"></span>' +
          '<button class="btn small" data-action="tlEdit" data-id="' + e.id + '">编辑</button>' +
          '<button class="btn small danger" data-action="tlDel" data-id="' + e.id + '">删除</button>' +
          '</div>' +
          '<div style="font-size:13px;margin-top:4px">' + U.escapeHtml(e.event || '') + '</div>' +
          (e.chapters ? '<div class="hint">相关章节：' + U.escapeHtml(e.chapters) + '</div>' : '') +
          (e.note ? '<div class="hint">' + U.escapeHtml(e.note) + '</div>' : '') +
          '</div>'
        ).join('') + '</div>'
        : '<div class="card"><div class="empty"><div class="big">🕰</div>暂无时间线事件</div></div>');
  };

  function tlFormHtml(e) {
    e = e || {};
    return '<h3 style="margin:0 0 4px">' + (e.id ? '编辑事件' : '新事件') + '</h3>' +
      '<label class="label">故事内时间 *</label>' +
      '<input class="input" name="time" value="' + U.escapeHtml(e.time || '') + '" placeholder="如：第一纪元 100年 / 第50章 / 2000.1.1">' +
      '<label class="label">事件内容 *</label>' +
      '<textarea class="textarea" name="event" rows="3">' + U.escapeHtml(e.event || '') + '</textarea>' +
      '<label class="label">相关章节</label>' +
      '<input class="input" name="chapters" value="' + U.escapeHtml(e.chapters || '') + '" placeholder="如：第12-15章">' +
      '<label class="label">备注</label>' +
      '<input class="input" name="note" value="' + U.escapeHtml(e.note || '') + '">' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="tlSave" data-id="' + (e.id || '') + '">保存</button></div>';
  }

  Actions['tlNew'] = () => UI.openModal(tlFormHtml());
  Actions['tlEdit'] = t => {
    const e = App.data.timeline.find(x => x.id === t.dataset.id);
    if (e) UI.openModal(tlFormHtml(e));
  };
  Actions['tlSave'] = async t => {
    const f = UI.readForm(U.$('#modal-root .modal'));
    if (!f.time.trim() || !f.event.trim()) { UI.toast('请填写时间和事件', 'err'); return; }
    const now = Date.now();
    if (t.dataset.id) {
      const rec = App.data.timeline.find(x => x.id === t.dataset.id);
      if (!rec) return;
      Object.assign(rec, f);
      rec.updatedAt = now;
      await DB.put('timeline', rec);
    } else {
      const rec = Object.assign({ id: U.uid(), workId: App.state.workId, sort: App.nextSort(App.data.timeline), createdAt: now, updatedAt: now }, f);
      await DB.put('timeline', rec);
      App.data.timeline.push(rec);
    }
    UI.closeModal();
    UI.toast('已保存');
    Views.plot.renderTimeline(U.$('#work-tab-content'));
  };
  Actions['tlDel'] = t => {
    UI.confirmDialog('删除事件', '确定删除该时间线事件吗？', async () => {
      await DB.del('timeline', t.dataset.id);
      App.data.timeline = App.data.timeline.filter(x => x.id !== t.dataset.id);
      UI.toast('已删除');
      Views.plot.renderTimeline(U.$('#work-tab-content'));
    });
  };
})();
