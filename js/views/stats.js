/* ============ 墨阁 · 统计（热力图 / 连续天数 / 卷字数） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;

  function keyOf(d) {
    return d.getFullYear() + '-' + U.padN(d.getMonth() + 1) + '-' + U.padN(d.getDate());
  }

  Views.stats = {
    render(el) {
      const w = App.data.work;
      const map = App.dailyMap();
      const today = U.todayStr();
      const todayW = map[today] || 0;
      const total = App.workTotalWords();
      const goal = w.dailyGoal || App.settings.defaultGoal || 3000;
      const weekW = sumDays(map, 7);
      const monthW = monthSum(map);
      const last30 = sumDays(map, 30);
      const avg30 = Math.round(last30 / 30);
      const maxStreak = maxRun(map);

      el.innerHTML =
        '<div class="stat-grid" style="margin-bottom:16px">' +
        '<div class="stat-card"><div class="num">' + U.wcText(total) + '</div><div class="lbl">全书总字数</div></div>' +
        '<div class="stat-card"><div class="num">' + todayW + '</div><div class="lbl">今日码字</div></div>' +
        '<div class="stat-card"><div class="num">' + weekW + '</div><div class="lbl">近7天</div></div>' +
        '<div class="stat-card"><div class="num">' + monthW + '</div><div class="lbl">本月</div></div>' +
        '<div class="stat-card"><div class="num">' + avg30 + '</div><div class="lbl">近30天日均</div></div>' +
        '<div class="stat-card"><div class="num">' + maxStreak + ' 天</div><div class="lbl">历史最长连更</div></div>' +
        '</div>' +
        '<div class="card" style="margin-bottom:16px">' +
        '<div class="card-title">写作日历（近一年）</div>' +
        '<div class="heatmap-wrap">' +
        '<div class="hm-months">' + monthsStrip() + '</div>' +
        '<div class="heatmap">' + heatCells(map) + '</div>' +
        '<div class="hm-legend">少 <span class="hm-cell l1" style="display:inline-block"></span><span class="hm-cell l2" style="display:inline-block"></span><span class="hm-cell l3" style="display:inline-block"></span><span class="hm-cell l4" style="display:inline-block"></span> 多</div>' +
        '</div></div>' +
        '<div class="two-col">' +
        '<div class="card"><div class="card-title">近30天每日码字</div>' + dayBars(map) + '</div>' +
        '<div class="card"><div class="card-title">各卷字数</div>' + volTable() + '</div>' +
        '</div>' +
        '<div class="card" style="margin-top:16px;max-width:420px">' +
        '<div class="card-title">每日目标</div>' +
        '<input class="input" type="number" min="0" data-action="statGoal" value="' + (w.dailyGoal || '') + '" placeholder="当前全局默认 ' + (App.settings.defaultGoal || 3000) + ' 字">' +
        '<div class="hint">留空则使用全局默认目标</div></div>';
    }
  };

  Actions['statGoal'] = async t => {
    const w = App.data.work;
    w.dailyGoal = parseInt(t.value, 10) || 0;
    await DB.put('works', w);
    UI.toast('已保存目标');
  };

  function sumDays(map, n) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      sum += map[keyOf(d)] || 0;
    }
    return sum;
  }
  function monthSum(map) {
    const now = new Date();
    let sum = 0;
    for (let d = 1; d <= now.getDate(); d++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), d);
      sum += map[keyOf(dt)] || 0;
    }
    return sum;
  }
  function maxRun(map) {
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

  function heatCells(map) {
    const start = new Date(); start.setDate(start.getDate() - 363);
    const offset = start.getDay();
    const first = new Date(start); first.setDate(first.getDate() - offset);
    const weeks = Math.ceil((363 + offset) / 7);
    const now = new Date();
    let html = '';
    for (let wk = 0; wk < weeks; wk++) {
      for (let d = 0; d < 7; d++) {
        const dt = new Date(first);
        dt.setDate(first.getDate() + wk * 7 + d);
        if (dt > now) { html += '<div class="hm-cell" style="visibility:hidden"></div>'; continue; }
        const k = keyOf(dt);
        const words = map[k] || 0;
        let lv = 0;
        if (words > 0) lv = words < 500 ? 1 : words < 1500 ? 2 : words < 3000 ? 3 : 4;
        html += '<div class="hm-cell l' + lv + '" title="' + k + '：' + words + ' 字"></div>';
      }
    }
    return html;
  }

  function monthsStrip() {
    const start = new Date(); start.setDate(start.getDate() - 363);
    const offset = start.getDay();
    const first = new Date(start); first.setDate(first.getDate() - offset);
    const weeks = Math.ceil((363 + offset) / 7);
    let html = '';
    for (let wk = 0; wk < weeks; wk++) {
      const dt = new Date(first);
      dt.setDate(first.getDate() + wk * 7);
      let label = '';
      if (dt.getDate() <= 7 && dt.getMonth() !== start.getMonth() || (wk === 0 && dt.getMonth() === start.getMonth())) {
        label = (dt.getMonth() + 1) + '月';
      }
      html += '<span>' + label + '</span>';
    }
    return html;
  }

  function dayBars(map) {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = keyOf(d);
      days.push({ k: k, words: map[k] || 0 });
    }
    const max = Math.max(1, ...days.map(x => x.words));
    return days.map(x =>
      '<div class="day-row"><span class="d-date">' + x.k.slice(5) + '</span>' +
      '<span class="d-bar"><span class="fill" style="width:' + Math.round(x.words / max * 100) + '%"></span></span>' +
      '<span class="d-words">' + x.words + '</span></div>'
    ).join('');
  }

  function volTable() {
    const vols = App.data.volumes;
    const chs = App.data.chapters;
    const byVol = {};
    vols.forEach(v => { byVol[v.id] = v; });
    const rows = [];
    vols.forEach(v => {
      const list = chs.filter(c => c.volumeId === v.id);
      rows.push({ name: v.title || '未命名卷', count: list.length, words: list.reduce((s, c) => s + (c.wordCount || 0), 0) });
    });
    const orphans = chs.filter(c => !c.volumeId || !byVol[c.volumeId]);
    if (orphans.length || !vols.length) rows.push({ name: '未分卷', count: orphans.length, words: orphans.reduce((s, c) => s + (c.wordCount || 0), 0) });
    const totalW = rows.reduce((s, r) => s + r.words, 0);
    const totalC = rows.reduce((s, r) => s + r.count, 0);
    return '<table class="table"><thead><tr><th>卷</th><th>章节</th><th>字数</th><th>占比</th></tr></thead><tbody>' +
      rows.map(r =>
        '<tr><td>' + U.escapeHtml(r.name) + '</td><td>' + r.count + '</td><td>' + r.words + '</td>' +
        '<td><span class="goal-bar" style="display:inline-block;width:80px;vertical-align:middle"><span class="fill" style="width:' + (totalW ? Math.round(r.words / totalW * 100) : 0) + '%"></span></span></td></tr>'
      ).join('') +
      '<tr style="font-weight:700"><td>合计</td><td>' + totalC + '</td><td>' + totalW + '</td><td></td></tr>' +
      '</tbody></table>';
  }
})();
