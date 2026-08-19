/* ============ 墨阁 · 书架视图 ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const D = window.Data;

  Views.bookshelf = {
    async render(el) {
      el.innerHTML = '<div class="empty">加载中…</div>';
      const [works, chapters, daily] = await Promise.all([DB.getAll('works'), DB.getAll('chapters'), DB.getAll('dailyStats')]);
      const today = U.todayStr();
      const byWork = {};
      chapters.forEach(c => {
        byWork[c.workId] = byWork[c.workId] || { words: 0, count: 0 };
        byWork[c.workId].words += c.wordCount || 0;
        byWork[c.workId].count++;
      });
      const todayByWork = {};
      daily.forEach(d => { if (d.date === today) todayByWork[d.workId] = (todayByWork[d.workId] || 0) + (d.words || 0); });

      const sorted = works.slice().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const last = App.settings.lastWorkId && App.settings.lastChapterId ? App.settings : null;

      let html = '';
      html += '<div class="page-head"><h1>我的书架</h1><span class="sub">共 ' + works.length + ' 部作品</span><div class="topbar-spacer"></div>' +
        '<button class="btn" data-action="openSearch">🔍 全局搜索</button>' +
        '<button class="btn" data-action="openGlobalIdeas">💡 灵感库</button>' +
        '<button class="btn" data-action="openSettings">⚙ 设置</button>' +
        '<button class="btn primary" data-action="newWork">＋ 新建作品</button></div>';

      if (last) {
        const w = works.find(x => x.id === last.lastWorkId);
        if (w) {
          html += '<div class="card" style="display:flex;align-items:center;gap:14px;margin-bottom:16px">' +
            '<div style="font-size:22px">✍️</div>' +
            '<div style="flex:1"><b>' + U.escapeHtml(w.title) + '</b><div class="hint">上次写到这里，点击继续写作</div></div>' +
            '<button class="btn primary" data-action="continueWriting">继续写作</button></div>';
        }
      }

      html += '<div class="works-grid">';
      sorted.forEach(w => {
        const st = D.WORK_STATUS.find(x => x.v === w.status) || D.WORK_STATUS[0];
        const info = byWork[w.id] || { words: 0, count: 0 };
        html += '<div class="work-card" data-action="openWork" data-id="' + w.id + '">' +
          '<div class="work-cover" style="background:linear-gradient(135deg,' + (w.coverColor || '#6366f1') + ',' + (w.coverColor || '#6366f1') + 'cc)">' +
          U.escapeHtml(w.title || '未命名作品') + '</div>' +
          '<div class="work-body">' +
          '<div class="work-meta"><span class="badge draft">' + U.escapeHtml(w.genre || '未分类') + '</span>' +
          '<span class="badge ' + (w.status || 'draft') + '">' + st.l + '</span></div>' +
          '<div style="color:var(--text-2);font-size:12px;min-height:34px">' + U.escapeHtml(U.short(w.synopsis, 46)) + '</div>' +
          '<div class="work-stats"><span>总字数 <b>' + U.wcText(info.words) + '</b></span><span>章节 <b>' + info.count + '</b></span>' +
          '<span>今日 <b>' + U.wcText(todayByWork[w.id] || 0) + '</b></span></div>' +
          '<div class="hint">更新于 ' + U.fmtDateShort(w.updatedAt) + '</div>' +
          '</div>' +
          '<div class="work-actions">' +
          '<button class="btn small" data-action="editWork" data-id="' + w.id + '">编辑</button>' +
          '<button class="btn small danger" data-action="delWork" data-id="' + w.id + '">删除</button>' +
          '</div></div>';
      });
      html += '<div class="new-work-card" data-action="newWork">＋ 新建作品</div>';
      html += '</div>';
      el.innerHTML = html;
    }
  };

  function workFormHtml(w) {
    w = w || {};
    const colorChips = D.COVER_COLORS.map(c =>
      '<span class="chip' + (c === (w.coverColor || '#6366f1') ? ' active' : '') + '" data-action="pickCover" data-id="' + c + '" style="background:' + c + ';border-color:' + c + ';color:#fff;width:26px;height:26px;border-radius:50%;padding:0;display:inline-flex;align-items:center;justify-content:center">' +
      (c === (w.coverColor || '#6366f1') ? '✓' : '') + '</span>'
    ).join(' ');
    return '<div class="form-grid">' +
      '<div><label class="label">书名 *</label><input class="input" name="title" value="' + U.escapeHtml(w.title || '') + '" placeholder="作品名称"></div>' +
      '<div><label class="label">作者/笔名</label><input class="input" name="author" value="' + U.escapeHtml(w.author || '') + '"></div>' +
      '<div><label class="label">类型</label><select class="select" name="genre">' + D.GENRES.map(g => '<option' + (g === w.genre ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></div>' +
      '<div><label class="label">状态</label><select class="select" name="status">' + D.WORK_STATUS.map(s => '<option value="' + s.v + '"' + (s.v === (w.status || 'serial') ? ' selected' : '') + '>' + s.l + '</option>').join('') + '</select></div>' +
      '<div><label class="label">每日目标字数</label><input class="input" name="dailyGoal" type="number" min="0" value="' + (w.dailyGoal || '') + '" placeholder="如 3000"></div>' +
      '<div><label class="label">封面色</label><div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:6px">' + colorChips + '</div></div>' +
      '<div class="full"><label class="label">简介</label><textarea class="textarea" name="synopsis" rows="3">' + U.escapeHtml(w.synopsis || '') + '</textarea></div>' +
      '</div>' +
      '<input type="hidden" name="coverColor" value="' + (w.coverColor || '#6366f1') + '">' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="saveWork" data-id="' + (w.id || '') + '">保存</button></div>';
  }

  Actions['pickCover'] = t => {
    U.$$('#modal-root .chip').forEach(c => c.classList.remove('active'));
    t.classList.add('active');
    const input = U.$('#modal-root input[name="coverColor"]');
    if (input) input.value = t.dataset.id;
  };

  Actions['newWork'] = () => UI.openModal('<h3 style="margin:0 0 4px">新建作品</h3>' + workFormHtml());

  Actions['editWork'] = async t => {
    const w = await DB.get('works', t.dataset.id);
    UI.openModal('<h3 style="margin:0 0 4px">编辑作品</h3>' + workFormHtml(w));
  };

  Actions['saveWork'] = async t => {
    const modal = U.$('#modal-root .modal');
    const f = UI.readForm(modal);
    if (!f.title.trim()) { UI.toast('请填写书名', 'err'); return; }
    const id = t.dataset.id;
    const now = Date.now();
    if (id) {
      const w = await DB.get('works', id);
      Object.assign(w, f);
      w.coverColor = f.coverColor || w.coverColor;
      w.dailyGoal = parseInt(f.dailyGoal, 10) || 0;
      w.updatedAt = now;
      await DB.put('works', w);
    } else {
      const w = {
        id: U.uid(), title: f.title.trim(), author: f.author.trim(), genre: f.genre,
        status: f.status, synopsis: f.synopsis.trim(), coverColor: f.coverColor || '#6366f1',
        dailyGoal: parseInt(f.dailyGoal, 10) || 0, sort: 0, createdAt: now, updatedAt: now
      };
      await DB.put('works', w);
      App.settings.lastWorkId = w.id;
      await DB.put('settings', { key: 'lastWorkId', value: w.id });
    }
    UI.closeModal();
    UI.toast('已保存');
    Views.bookshelf.render(U.$('#main'));
  };

  Actions['delWork'] = t => {
    const id = t.dataset.id;
    UI.confirmDialog('删除作品', '将删除该作品的全部章节、设定、大纲、伏笔等数据，且无法恢复。确定删除吗？', async () => {
      await App.deleteWork(id);
      UI.toast('已删除');
      Views.bookshelf.render(U.$('#main'));
    });
  };

  Actions['openWork'] = t => {
    location.hash = '#/w/' + t.dataset.id + '/overview';
  };

  Actions['continueWriting'] = () => {
    if (App.settings.lastWorkId && App.settings.lastChapterId) {
      location.hash = '#/e/' + App.settings.lastWorkId + '/' + App.settings.lastChapterId;
    }
  };

  Actions['openGlobalIdeas'] = () => { location.hash = '#/ideas'; };
  Actions['openSettings'] = () => { location.hash = '#/settings'; };
})();
