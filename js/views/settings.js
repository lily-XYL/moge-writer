/* ============ 墨阁 · 全局设置（外观 / 词表 / 备份 / 数据管理） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const Ex = window.Export;

  Views.settings = {
    async render(el) {
      const s = App.settings;
      const backups = (await DB.getAll('backups')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const counts = {};
      for (const n of DB.STORES) {
        counts[n] = (await DB.getAll(n)).length;
      }
      const builtinSens = (window.Data.SENSITIVE_DEFAULT || []).length;
      const builtinTypo = (window.Data.TYPO_PAIRS || []).length;

      el.innerHTML =
        '<div class="page-head"><button class="btn small" data-action="goBookshelf">← 返回</button>' +
        '<h1 style="font-size:20px">设置</h1></div>' +

        '<div class="two-col">' +
        '<div>' +
        '<div class="card"><div class="card-title">外观</div>' +
        '<label class="label">主题</label><select class="select" data-action="saveSetting" data-key="theme">' +
        '<option value="light"' + (s.theme === 'light' ? ' selected' : '') + '>浅色</option>' +
        '<option value="dark"' + (s.theme === 'dark' ? ' selected' : '') + '>深色</option>' +
        '<option value="system"' + (s.theme === 'system' ? ' selected' : '') + '>跟随系统</option></select>' +
        '<label class="label">正文字体</label><select class="select" data-action="saveSetting" data-key="fontFamily">' +
        fontOpt('serif', '宋体/思源宋体（默认）', s) +
        fontOpt('song', '宋体', s) +
        fontOpt('kai', '楷体', s) +
        fontOpt('hei', '黑体', s) +
        fontOpt('dengxian', '等线', s) +
        fontOpt('fangsong', '仿宋', s) +
        '</select>' +
        '<label class="label">正文字号：<b id="fs-label">' + (s.fontSize || 18) + 'px</b></label>' +
        '<input type="range" min="14" max="26" step="1" style="width:100%" value="' + (s.fontSize || 18) + '" data-action="saveSetting" data-key="fontSize">' +
        '<label class="label">行距：<b id="lh-label">' + (s.lineHeight || 2) + '</b></label>' +
        '<input type="range" min="1.5" max="2.8" step="0.1" style="width:100%" value="' + (s.lineHeight || 2) + '" data-action="saveSetting" data-key="lineHeight">' +
        '</div>' +

        '<div class="card"><div class="card-title">编辑</div>' +
        '<label class="label">自动保存间隔（秒，可输入自定义值）</label>' +
        '<input class="input" type="number" min="0.5" step="0.5" data-action="saveSetting" data-key="autosave" value="' + ((s.autosave || 1000) / 1000) + '">' +
        '<label class="label">默认每日目标字数</label>' +
        '<input class="input" type="number" min="0" data-action="saveSetting" data-key="defaultGoal" value="' + (s.defaultGoal || 3000) + '">' +
        '</div>' +

        '<div class="card"><div class="card-title">违禁词词表</div>' +
        '<div class="hint" style="margin-bottom:8px">内置示例词 ' + builtinSens + ' 个；下方为自定义词表（每行一个），与内置词表共同生效。请在投稿前按平台要求补充。</div>' +
        '<textarea class="textarea" rows="8" data-action="saveSetting" data-key="sensitiveCustom" placeholder="每行一个违禁词…">' + U.escapeHtml((s.sensitiveCustom || []).join('\n')) + '</textarea>' +
        '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn small" data-action="wordsImport" data-kind="sensitive">导入词表</button>' +
        '<button class="btn small" data-action="wordsExport" data-kind="sensitive">导出词表</button>' +
        '</div></div>' +

        '<div class="card"><div class="card-title">错别字词对</div>' +
        '<div class="hint" style="margin-bottom:8px">内置常用词对 ' + builtinTypo + ' 对；下方为自定义词对（每行：错字,正字）。</div>' +
        '<textarea class="textarea" rows="8" data-action="saveSetting" data-key="typoCustom" placeholder="例：做为,作为&#10;即然,既然">' + U.escapeHtml((s.typoCustom || []).map(p => p.w + ',' + p.r).join('\n')) + '</textarea>' +
        '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn small" data-action="wordsImport" data-kind="typo">导入词对</button>' +
        '<button class="btn small" data-action="wordsExport" data-kind="typo">导出词对</button>' +
        '</div></div>' +
        '</div>' +

        '<div>' +
        '<div class="card"><div class="card-title">数据备份</div>' +
        '<div class="hint" style="margin-bottom:10px">数据保存在本机浏览器中。每天首次打开会自动备份一次（保留最近 15 份），建议重要时刻手动备份并定期导出。</div>' +
        '<div class="btn-row" style="margin-bottom:14px">' +
        '<button class="btn primary" data-action="backupNow">立即备份</button>' +
        '<button class="btn" data-action="exportAllData">导出全部数据(JSON)</button>' +
        '<button class="btn" data-action="importData">导入数据</button>' +
        '</div>' +
        (backups.length ?
          '<table class="table"><thead><tr><th>备份</th><th>时间</th><th style="width:150px">操作</th></tr></thead><tbody>' +
          backups.map(b =>
            '<tr><td>' + U.escapeHtml(b.label || '备份') + '</td><td>' + U.fmtDate(b.createdAt) + '</td>' +
            '<td><div class="btn-row"><button class="btn small" data-action="restoreBackup" data-id="' + b.id + '">恢复</button>' +
            '<button class="btn small danger" data-action="delBackup" data-id="' + b.id + '">删除</button></div></td></tr>'
          ).join('') + '</tbody></table>'
          : '<div class="empty" style="padding:14px">暂无备份</div>') +
        '</div>' +

        '<div class="card"><div class="card-title">数据概览</div>' +
        '<table class="table"><tbody>' +
        Object.keys(counts).filter(n => n !== 'backups' && n !== 'settings').map(n =>
          '<tr><td>' + storeName(n) + '</td><td style="text-align:right">' + counts[n] + ' 条</td></tr>'
        ).join('') +
        '</tbody></table></div>' +

        '<div class="card"><div class="card-title" style="color:var(--danger)">危险区</div>' +
        '<div class="hint" style="margin-bottom:10px">清空将删除本机全部作品与数据，无法恢复！请先导出备份。</div>' +
        '<button class="btn danger" data-action="wipeAll">清空所有数据</button></div>' +
        '</div></div>';
    }
  };

  function fontOpt(v, label, s) {
    return '<option value="' + v + '"' + ((s.fontFamily || 'serif') === v ? ' selected' : '') + '>' + label + '</option>';
  }
  function storeName(n) {
    return { works: '作品', volumes: '卷', chapters: '章节', characters: '人物', entries: '设定', outlines: '大纲',
      foreshadows: '伏笔', timeline: '时间线', ideas: '灵感', dailyStats: '写作记录', settings: '设置' }[n] || n;
  }

  /* ---------- 设置保存 ---------- */
  Actions['saveSetting'] = async t => {
    const key = t.dataset.key;
    let val = t.value;
    if (key === 'fontSize') val = parseInt(val, 10) || 18;
    if (key === 'lineHeight') val = parseFloat(val) || 2;
    if (key === 'autosave') val = Math.max(0.5, parseFloat(val) || 1) * 1000; /* 秒 → 毫秒 */
    if (key === 'defaultGoal') val = parseInt(val, 10) || 0;
    if (key === 'sensitiveCustom') val = val.split('\n').map(x => x.trim()).filter(Boolean);
    if (key === 'typoCustom') val = val.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,，]/);
      return { w: parts[0].trim(), r: (parts[1] || '').trim() };
    }).filter(p => p.w);
    App.settings[key] = val;
    await DB.put('settings', { key: key, value: val });
    if (key === 'theme') { App.applyTheme(); refreshTopbar(); }
    if (key === 'fontFamily' || key === 'fontSize' || key === 'lineHeight') applyFontVars();
    if (key === 'fontSize') { const el = U.$('#fs-label'); if (el) el.textContent = val + 'px'; }
    if (key === 'lineHeight') { const el = U.$('#lh-label'); if (el) el.textContent = val; }
    UI.toast('已保存');
  };

  /* ---------- 词表导入导出 ---------- */
  Actions['wordsImport'] = t => {
    const kind = t.dataset.kind;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const text = await U.fileToText(file);
      if (kind === 'sensitive') {
        const add = text.split('\n').map(x => x.trim()).filter(Boolean);
        App.settings.sensitiveCustom = App.settings.sensitiveCustom.concat(add);
        await DB.put('settings', { key: 'sensitiveCustom', value: App.settings.sensitiveCustom });
        UI.toast('已导入 ' + add.length + ' 个违禁词');
      } else {
        const add = text.split('\n').map(x => x.trim()).filter(Boolean).map(line => {
          const parts = line.split(/[,，]/);
          return { w: parts[0].trim(), r: (parts[1] || '').trim() };
        }).filter(p => p.w);
        App.settings.typoCustom = App.settings.typoCustom.concat(add);
        await DB.put('settings', { key: 'typoCustom', value: App.settings.typoCustom });
        UI.toast('已导入 ' + add.length + ' 个词对');
      }
      Views.settings.render(U.$('#main'));
    };
    input.click();
  };
  Actions['wordsExport'] = t => {
    const kind = t.dataset.kind;
    const lines = kind === 'sensitive'
      ? App.settings.sensitiveCustom
      : App.settings.typoCustom.map(p => p.w + ',' + p.r);
    Ex.download(kind === 'sensitive' ? '违禁词表.txt' : '错别字词对.txt', lines.join('\n'));
    UI.toast('已导出');
  };

  /* ---------- 备份 ---------- */
  Actions['backupNow'] = async () => {
    const data = await Ex.dumpAll();
    const rec = { id: U.uid(), label: '手动备份 ' + U.todayStr() + ' ' + new Date().toTimeString().slice(0, 5), createdAt: Date.now(), data: data };
    await DB.put('backups', rec);
    UI.toast('备份完成');
    Views.settings.render(U.$('#main'));
  };
  Actions['restoreBackup'] = t => {
    UI.confirmDialog('恢复备份', '将用该备份覆盖当前全部数据（作品/章节/设定等），无法撤销。确定恢复吗？', async () => {
      const b = await DB.get('backups', t.dataset.id);
      if (!b || !b.data) { UI.toast('备份数据无效', 'err'); return; }
      await Ex.restoreAll(b.data, 'replace');
      UI.closeModal();
      UI.toast('已恢复，正在刷新…');
      location.hash = '#/';
      setTimeout(() => location.reload(), 300);
    }, '确认恢复');
  };
  Actions['delBackup'] = t => {
    UI.confirmDialog('删除备份', '确定删除该备份吗？', async () => {
      await DB.del('backups', t.dataset.id);
      UI.toast('已删除');
      Views.settings.render(U.$('#main'));
    });
  };

  /* ---------- 全量导入导出 ---------- */
  Actions['exportAllData'] = async () => {
    const data = await Ex.dumpAll();
    Ex.download('墨阁全量备份-' + U.todayStr() + '.json', JSON.stringify(data, null, 2));
    UI.toast('已导出');
  };
  Actions['importData'] = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      let data;
      try {
        data = JSON.parse(await U.fileToText(file));
      } catch (e) { UI.toast('文件解析失败：不是有效的 JSON', 'err'); return; }
      if (!data || data.app !== 'moge-studio' || (data.version !== 1 && data.version !== 2)) {
        UI.toast('文件不是受支持的墨阁备份', 'err'); return;
      }
      const workCount = Array.isArray(data.works) ? data.works.length : 0;
      const chapterCount = Array.isArray(data.chapters) ? data.chapters.length : 0;
      UI.openModal('<h3 style="margin:0 0 4px">导入数据</h3>' +
        '<p style="font-size:13px;color:var(--text-2)">文件包含：作品 ' + workCount + ' 部、章节 ' + chapterCount + ' 章等。</p>' +
        '<label style="display:flex;gap:10px;align-items:center;padding:6px 0"><input type="radio" name="importMode" value="merge" checked> 合并导入（不覆盖已有记录）</label>' +
        '<label style="display:flex;gap:10px;align-items:center;padding:6px 0"><input type="radio" name="importMode" value="replace"> 覆盖导入（清空后导入，谨慎！）</label>' +
        '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
        '<button class="btn" data-action="modal-close">取消</button>' +
        '<button class="btn primary" data-action="doImport">开始导入</button></div>');
      App._importData = data;
    };
    input.click();
  };
  Actions['doImport'] = async () => {
    const f = UI.readForm(U.$('#modal-root .modal'));
    const mode = f.importMode || 'merge';
    try {
      const res = await Ex.restoreAll(App._importData, mode);
      UI.closeModal();
      UI.toast(mode === 'replace'
        ? '已覆盖导入 ' + res.written + ' 条记录'
        : '已合并导入（新增 ' + res.written + ' 条，跳过 ' + res.skipped + ' 条）');
      setTimeout(() => location.reload(), 400);
    } catch (e) {
      UI.toast('导入失败：' + (e && e.message ? e.message : '请检查备份文件'), 'err');
    }
  };

  Actions['wipeAll'] = () => {
    UI.confirmDialog('清空所有数据', '将删除本机全部作品、章节、设定、备份，且无法恢复！确定继续吗？', async () => {
      await DB.wipe();
      UI.closeModal();
      UI.toast('已清空');
      setTimeout(() => location.reload(), 400);
    });
  };

  function refreshTopbar() {
    const fn = window.App._renderTopbar;
    if (fn) fn();
  }
  function applyFontVars() {
    const s = App.settings;
    const fs = s.fontSize || 18, lh = s.lineHeight || 2;
    document.documentElement.style.setProperty('--fs', fs + 'px');
    document.documentElement.style.setProperty('--lh', lh);
    const fonts = {
      serif: '"Noto Serif SC","Source Han Serif SC","SimSun","Songti SC",serif',
      song: '"SimSun","Songti SC",serif',
      kai: '"KaiTi","STKaiti","楷体",serif',
      hei: '"SimHei","Microsoft YaHei",sans-serif',
      dengxian: '"DengXian","Microsoft YaHei",sans-serif',
      fangsong: '"FangSong","STFangsong",serif'
    };
    document.documentElement.style.setProperty('--font-serif', fonts[s.fontFamily] || fonts.serif);
  }
  Views.settings.applyFontVars = applyFontVars;
})();
