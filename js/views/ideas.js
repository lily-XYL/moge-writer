/* ============ 墨阁 · 灵感库 ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;

  Views.ideas = {
    async render(el, workId) {
      App.state.ideasWorkId = workId || null;
      App._allWorks = await DB.getAll('works');
      App._ideasCache = await DB.getAll('ideas');
      el.innerHTML =
        '<div class="page-head" style="margin-bottom:14px">' +
        (workId ? '' : '<button class="btn small" data-action="goBookshelf">← 返回书架</button>') +
        '<div style="font-size:15px;font-weight:700">' + (workId ? '本作品灵感' : '全局灵感库') + '</div>' +
        '<span class="sub">随时记下闪过的点子</span>' +
        '<span class="topbar-spacer"></span>' +
        '<input class="input" style="max-width:220px" placeholder="搜索灵感…" value="' + U.escapeHtml(App.state.ideaFilter || '') + '" data-action="ideaFilter">' +
        '<button class="btn primary" data-action="ideaNew">＋ 记灵感</button>' +
        '</div>' +
        '<div id="idea-grid-wrap"></div>';
      this.renderGrid();
    },

    renderGrid() {
      const wrap = U.$('#idea-grid-wrap');
      if (!wrap) return;
      const workId = App.state.ideasWorkId;
      const wmap = {};
      (App._allWorks || []).forEach(w => { wmap[w.id] = w; });
      const list = (App._ideasCache || []).filter(i => workId ? i.workId === workId : !i.workId);
      const filter = (App.state.ideaFilter || '').toLowerCase();
      const filtered = list.filter(i =>
        !filter ||
        (i.title || '').toLowerCase().includes(filter) ||
        (i.content || '').toLowerCase().includes(filter) ||
        (i.tags || '').toLowerCase().includes(filter)
      ).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      wrap.innerHTML = filtered.length ? '<div class="char-grid">' + filtered.map(i =>
        '<div class="char-card" data-action="ideaOpen" data-id="' + i.id + '">' +
        '<div class="cc-name">' + U.escapeHtml(i.title || '无标题灵感') + '</div>' +
        (i.workId && wmap[i.workId] ? '<div class="hint">📖 ' + U.escapeHtml(wmap[i.workId].title) + '</div>' : '') +
        '<div class="cc-role" style="white-space:pre-wrap">' + U.escapeHtml(U.short(i.content, 120)) + '</div>' +
        '<div class="cc-tags">' + (i.tags || '').split(/[,，]/).filter(Boolean).slice(0, 5).map(x => '<span class="tag">' + U.escapeHtml(x.trim()) + '</span>').join('') + '</div>' +
        '<div class="hint" style="margin-top:6px">' + U.fmtDate(i.createdAt) + '</div>' +
        '</div>'
      ).join('') + '</div>'
        : '<div class="card"><div class="empty"><div class="big">💡</div>暂无灵感，点击「记灵感」随手记录</div></div>';
    }
  };

  function ideaFormHtml(i) {
    i = i || {};
    const workOpts = '<option value="">（全局灵感）</option>' + (App._allWorks || []).map(w =>
      '<option value="' + w.id + '"' + (i.workId === w.id ? ' selected' : '') + '>' + U.escapeHtml(w.title) + '</option>'
    ).join('');
    return '<h3 style="margin:0 0 4px">' + (i.id ? '编辑灵感' : '记灵感') + '</h3>' +
      '<label class="label">标题</label><input class="input" name="title" value="' + U.escapeHtml(i.title || '') + '" placeholder="一句话概括">' +
      '<label class="label">内容</label><textarea class="textarea" name="content" rows="5" placeholder="把灵感写下来…">' + U.escapeHtml(i.content || '') + '</textarea>' +
      '<label class="label">标签（逗号分隔）</label><input class="input" name="tags" value="' + U.escapeHtml(i.tags || '') + '">' +
      '<label class="label">归属作品</label><select class="select" name="workId">' + workOpts + '</select>' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      (i.id ? '<button class="btn danger" style="margin-right:auto" data-action="ideaDel" data-id="' + i.id + '">删除</button>' : '') +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="ideaSave" data-id="' + (i.id || '') + '">保存</button></div>';
  }

  function ideaTarget() {
    return U.$('#work-tab-content') || U.$('#main');
  }
  function rerenderIdeas() {
    return Views.ideas.render(ideaTarget(), App.state.ideasWorkId || null);
  }

  Actions['ideaFilter'] = t => {
    App.state.ideaFilter = t.value;
    Views.ideas.renderGrid();
  };
  Actions['ideaNew'] = () => UI.openModal(ideaFormHtml());
  Actions['ideaOpen'] = async t => {
    const i = (App._ideasCache || []).find(x => x.id === t.dataset.id);
    if (i) UI.openModal(ideaFormHtml(i));
  };
  Actions['ideaSave'] = async t => {
    const f = UI.readForm(U.$('#modal-root .modal'));
    if (!f.title.trim() && !f.content.trim()) { UI.toast('请填写标题或内容', 'err'); return; }
    const now = Date.now();
    if (t.dataset.id) {
      const rec = (App._ideasCache || []).find(x => x.id === t.dataset.id);
      if (!rec) return;
      Object.assign(rec, f);
      rec.updatedAt = now;
      await DB.put('ideas', rec);
    } else {
      const rec = { id: U.uid(), workId: f.workId || null, title: f.title.trim(), content: f.content, tags: f.tags, createdAt: now, updatedAt: now };
      await DB.put('ideas', rec);
    }
    UI.closeModal();
    UI.toast('已保存');
    await rerenderIdeas();
  };
  Actions['ideaDel'] = t => {
    UI.confirmDialog('删除灵感', '确定删除这条灵感吗？', async () => {
      await DB.del('ideas', t.dataset.id);
      UI.closeModal();
      UI.toast('已删除');
      await rerenderIdeas();
    });
  };
})();
