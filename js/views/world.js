/* ============ 墨阁 · 设定管理（人物卡 / 势力 / 地点 / 物品 / 功法等） ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const D = window.Data;

  function colorOf(str) {
    const colors = D.COVER_COLORS;
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 997;
    return colors[h % colors.length];
  }

  Views.world = {
    render(el) {
      const seg = App.state.worldSeg || 'setting';
      el.innerHTML =
        '<div class="page-head" style="margin-bottom:14px">' +
        '<div class="segment">' +
        '<button class="' + (seg === 'setting' ? 'active' : '') + '" data-action="worldSeg" data-id="setting">设定</button>' +
        '<button class="' + (seg === 'graph' ? 'active' : '') + '" data-action="worldSeg" data-id="graph">关系图</button>' +
        '</div>' +
        '<span class="topbar-spacer"></span>' +
        (seg === 'graph'
          ? '<button class="btn primary" data-action="graphAddChar">＋ 添加人物</button>'
          : '<button class="btn primary" data-action="worldNew">＋ 新建设定</button>') +
        '</div>' +
        '<div id="world-body"></div>';
      const body = U.$('#world-body');
      if (seg === 'graph') this.renderGraph(body);
      else this.renderSetting(body);
    },

    /* 设定：人物与势力/地点/物品等统一列表，按类型过滤 */
    renderSetting(el) {
      const typeFilter = App.state.worldType || 'all';
      const chipsHtml = '<span class="chip' + (typeFilter === 'all' ? ' active' : '') + '" data-action="worldTypeFilter" data-id="all">全部</span>' +
        '<span class="chip' + (typeFilter === 'char' ? ' active' : '') + '" data-action="worldTypeFilter" data-id="char">人物</span>' +
        D.ENTRY_TYPES.map(t =>
          '<span class="chip' + (typeFilter === t.v ? ' active' : '') + '" data-action="worldTypeFilter" data-id="' + t.v + '">' + t.l + '</span>'
        ).join(' ');
      el.innerHTML =
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' + chipsHtml + '</div>' +
        '<div style="max-width:340px;margin-bottom:14px"><input class="input" placeholder="搜索名称/内容/标签…" value="' + U.escapeHtml(App.state.worldSearch || '') + '" data-action="worldSearch"></div>' +
        '<div id="world-grid-wrap"></div>';
      this.renderSettingGrid();
    },

    renderSettingGrid() {
      const wrap = U.$('#world-grid-wrap');
      if (!wrap) return;
      const typeFilter = App.state.worldType || 'all';
      const filter = (App.state.worldSearch || '').toLowerCase();
      const inType = e => typeFilter === 'all' || e.type === typeFilter;
      const inSearch = e =>
        !filter ||
        (e.name || '').toLowerCase().includes(filter) ||
        (e.role || '').toLowerCase().includes(filter) ||
        (e.content || '').toLowerCase().includes(filter) ||
        (e.tags || '').toLowerCase().includes(filter);
      const chars = App.data.characters.map(c => ({ id: c.id, type: 'char', c: c, name: c.name || '未命名', role: c.role || '', content: c.background || c.appearance || '', tags: c.tags || '', gender: c.gender, age: c.age, alias: c.alias }))
        .filter(e => inType(e) && inSearch(e));
      const entries = App.data.entries.map(e => ({ id: e.id, type: e.type, e: e, name: e.name || '未命名', role: '', content: e.content || '', tags: '' }))
        .filter(e => inType(e) && inSearch(e));
      const list = chars.concat(entries);
      if (!list.length) {
        wrap.innerHTML = '<div class="card"><div class="empty"><div class="big">🗂</div>' +
          (typeFilter === 'char' ? '还没有人物，点击「新建设定」创建角色吧' : '暂无该类型设定，点击「新建设定」添加') + '</div></div>';
        return;
      }
      wrap.innerHTML = '<div class="char-grid">' + list.map(item => {
        if (item.type === 'char') {
          const c = item.c;
          return '<div class="char-card" data-action="charOpen" data-id="' + c.id + '">' +
            '<div class="char-avatar" style="background:' + colorOf(c.name || c.id) + '">' + U.escapeHtml((c.name || '?').charAt(0)) + '</div>' +
            '<div class="cc-name">' + U.escapeHtml(c.name || '未命名') + (c.alias ? ' <span style="color:var(--text-3);font-weight:400">(' + U.escapeHtml(c.alias) + ')</span>' : '') + '</div>' +
            '<div class="cc-role">' + U.escapeHtml(c.role || '未设定身份') + (c.gender ? ' · ' + U.escapeHtml(c.gender) : '') + (c.age ? ' · ' + U.escapeHtml(c.age) + '岁' : '') + '</div>' +
            '<div class="cc-tags">' + (c.tags || '').split(/[,，]/).filter(Boolean).slice(0, 4).map(x => '<span class="tag">' + U.escapeHtml(x.trim()) + '</span>').join('') + '</div>' +
            '</div>';
        }
        const e = item.e;
        return '<div class="char-card" data-action="entryOpen" data-id="' + e.id + '">' +
          '<div class="char-avatar" style="background:' + colorOf(e.name || e.id) + ';font-size:15px">' + U.escapeHtml((D.ENTRY_TYPES.find(t => t.v === e.type) || {}).l || '设') + '</div>' +
          '<div class="cc-name">' + U.escapeHtml(e.name || '未命名') + '</div>' +
          '<div class="cc-role">' + U.escapeHtml(U.short(e.content, 60)) + '</div>' +
          '</div>';
      }).join('') + '</div>';
    }
  };

  /* 新建设定：先选类型（人物或势力/地点/物品/功法等） */
  Actions['worldNew'] = () => {
    UI.openModal(
      '<h3 style="margin:0 0 4px">新建设定</h3>' +
      '<label class="label">类型</label><select class="select" id="world-new-type">' +
      '<option value="char">人物</option>' +
      D.ENTRY_TYPES.map(t => '<option value="' + t.v + '">' + t.l + '</option>').join('') +
      '</select>' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="worldNewGo">下一步</button></div>');
  };
  Actions['worldNewGo'] = () => {
    const sel = U.$('#world-new-type');
    if (!sel) return;
    UI.closeModal();
    if (sel.value === 'char') Actions['charNew']();
    else Actions['entryNew']();
  };
  Actions['worldTypeFilter'] = t => {
    App.state.worldType = t.dataset.id;
    Views.world.renderSetting(U.$('#world-body'));
  };
  Actions['worldSearch'] = t => {
    App.state.worldSearch = t.value;
    Views.world.renderSettingGrid();
  };

  /* ================= 人物关系图 ================= */
  const RELATION_PRESETS = ['家人', '父母', '子女', '师徒', '情侣', '夫妻', '挚友', '宿敌', '仇人', '上下级', '盟友', '合作', '暗恋', '背叛', '同伴', '其他'];
  const Graph = window.GraphData;

  let gPanX = 0, gPanY = 0, gZoom = 1;
  let gDrag = null;     /* 节点拖拽 {charId, gx, gy, ox, oy} */
  let gPan = null;      /* 画布平移 {sx, sy, opx, opy} */
  let gMoved = false;
  let gPending = null;  /* {kind:'edge'|'blank', id?} */

  function graphSvg() { return U.$('#relation-svg'); }
  function graphWrap() { return U.$('#graph-wrap'); }
  function svgPt(e) {
    const rect = graphSvg().getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }
  function toGraph(p) { return { x: (p.x - gPanX) / gZoom, y: (p.y - gPanY) / gZoom }; }

  function fitGraphView() {
    const nodes = App.getGraph().nodes;
    const wrap = graphWrap();
    const w = wrap ? wrap.clientWidth : 800, h = wrap ? wrap.clientHeight : 500;
    if (!nodes.length) { gPanX = w / 2; gPanY = h / 2; return; }
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const cx = (Math.min.apply(null, xs) + Math.max.apply(null, xs)) / 2;
    const cy = (Math.min.apply(null, ys) + Math.max.apply(null, ys)) / 2;
    gPanX = w / 2 - cx;
    gPanY = h / 2 - cy;
  }

  Views.world.renderGraph = function (el) {
    const chars = App.data.characters;
    el.innerHTML =
      '<div class="btn-row" style="margin-bottom:10px;flex-wrap:wrap">' +
      '<button class="btn small primary" data-action="graphAddChar">＋ 添加人物</button>' +
      '<button class="btn small" data-action="graphAddEdge">＋ 添加关系</button>' +
      '<button class="btn small" data-action="graphAutoLayout">◎ 自动布局</button>' +
      '<span class="hint">拖拽节点移动 · 滚轮缩放 · 空白拖拽平移 · 双击空白添加人物 · 点击节点/连线编辑</span>' +
      '</div>' +
      '<div class="graph-wrap" id="graph-wrap">' +
      '<svg id="relation-svg" width="100%" height="100%">' +
      '<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L7,3 L0,6 z" fill="#8b93a5"/></marker></defs>' +
      '<g id="graph-g"><g id="graph-edges"></g><g id="graph-nodes"></g></g>' +
      '</svg>' +
      (chars.length ? '' : '<div class="graph-empty-hint">还没有人物，先去「设定」页创建角色，再回到这里搭建关系网</div>') +
      '</div>';
    if (!chars.length) return;
    fitGraphView();
    renderGraphSVG();
    bindGraphEvents();
  };

  function renderGraphSVG() {
    const svg = graphSvg();
    if (!svg) return;
    U.$('#graph-g').setAttribute('transform', 'translate(' + gPanX + ',' + gPanY + ') scale(' + gZoom + ')');
    const graph = App.getGraph();
    const cmap = {};
    App.data.characters.forEach(c => { cmap[c.id] = c; });
    const edgesEl = U.$('#graph-edges');
    const nodesEl = U.$('#graph-nodes');
    edgesEl.innerHTML = graph.edges.map(e => {
      const a = Graph.nodePos(graph, e.from), b = Graph.nodePos(graph, e.to);
      if (!a || !b) return '';
      const kind = e.kind || 'one';
      const label = e.label || '';
      const labelBA = e.labelBA || '';
      const twoWay = kind === 'mutual' || kind === 'two';
      const markerStart = twoWay ? ' marker-start="url(#arrow)"' : '';
      const markerEnd = ' marker-end="url(#arrow)"';
      const at = t => ({ x: Math.round(a.x + (b.x - a.x) * t), y: Math.round(a.y + (b.y - a.y) * t) });
      const mid = at(0.5);
      let labelHtml = '';
      if (kind === 'two') {
        if (label) labelHtml += '<text class="edge-label-b" x="' + at(0.74).x + '" y="' + (at(0.74).y - 6) + '">' + U.escapeHtml(label) + '</text>';
        if (labelBA) labelHtml += '<text class="edge-label-a" x="' + at(0.26).x + '" y="' + (at(0.26).y - 6) + '">' + U.escapeHtml(labelBA) + '</text>';
      } else if (label) {
        labelHtml = '<text x="' + mid.x + '" y="' + (mid.y - 8) + '">' + U.escapeHtml(label) + '</text>';
      }
      return '<g class="edge" data-edge="' + e.id + '">' +
        '<line x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"' + markerStart + markerEnd + '/>' +
        labelHtml +
        '</g>';
    }).join('');
    nodesEl.innerHTML = graph.nodes.map(n => {
      const c = cmap[n.charId];
      if (!c) return '';
      const color = colorOf(c.name || c.id);
      const name = U.short(c.name || '未命名', 5);
      const role = U.short(c.role || '', 6);
      return '<g class="node" data-char="' + n.charId + '" transform="translate(' + n.x + ',' + n.y + ')">' +
        '<circle r="27" fill="' + color + '"/>' +
        '<text class="node-name" y="-2">' + U.escapeHtml(name) + '</text>' +
        (role ? '<text class="node-role" y="14">' + U.escapeHtml(role) + '</text>' : '') +
        '</g>';
    }).join('');
  }

  function bindGraphEvents() {
    const svg = graphSvg();
    if (!svg) return;
    svg.addEventListener('pointerdown', e => {
      const nodeEl = e.target.closest('[data-char]');
      const edgeEl = e.target.closest('[data-edge]');
      const p = svgPt(e);
      if (nodeEl) {
        const n = Graph.nodePos(App.getGraph(), nodeEl.dataset.char);
        const gp = toGraph(p);
        gDrag = { charId: nodeEl.dataset.char, gx: gp.x, gy: gp.y, ox: n.x, oy: n.y };
        gMoved = false;
        gPending = null;
        svg.setPointerCapture(e.pointerId);
        svg.classList.add('grabbing');
      } else if (edgeEl) {
        gPending = { kind: 'edge', id: edgeEl.dataset.edge };
        gMoved = false;
        gDrag = null;
        gPan = null;
      } else {
        gPan = { sx: p.x, sy: p.y, opx: gPanX, opy: gPanY };
        gPending = { kind: 'blank' };
        gMoved = false;
        gDrag = null;
        svg.classList.add('panning');
      }
    });
    svg.addEventListener('pointermove', e => {
      const p = svgPt(e);
      if (gDrag) {
        const gp = toGraph(p);
        const n = Graph.nodePos(App.getGraph(), gDrag.charId);
        if (n) {
          if (Math.abs(gp.x - gDrag.gx) > 1 || Math.abs(gp.y - gDrag.gy) > 1) gMoved = true;
          n.x = Math.round(gDrag.ox + (gp.x - gDrag.gx));
          n.y = Math.round(gDrag.oy + (gp.y - gDrag.gy));
          renderGraphSVG();
        }
      } else if (gPan) {
        if (Math.abs(p.x - gPan.sx) > 2 || Math.abs(p.y - gPan.sy) > 2) gMoved = true;
        gPanX = gPan.opx + (p.x - gPan.sx);
        gPanY = gPan.opy + (p.y - gPan.sy);
        renderGraphSVG();
      }
    });
    const endDrag = e => {
      if (gDrag) {
        if (!gMoved) openNodeMenu(gDrag.charId);
        else App.graphSave();
        gDrag = null;
        svg.classList.remove('grabbing');
      } else if (gPan) {
        gPan = null;
        svg.classList.remove('panning');
      } else if (gPending && gPending.kind === 'edge' && !gMoved) {
        openEdgeMenu(gPending.id);
      }
      gPending = null;
    };
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const p = svgPt(e);
      const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const nz = Math.max(0.3, Math.min(3, gZoom * f));
      gPanX = p.x - (p.x - gPanX) * (nz / gZoom);
      gPanY = p.y - (p.y - gPanY) * (nz / gZoom);
      gZoom = nz;
      renderGraphSVG();
    }, { passive: false });
    svg.addEventListener('dblclick', e => {
      if (!e.target.closest('[data-char],[data-edge]')) openAddCharModal();
    });
  }

  function kindLabel(k) {
    return k === 'mutual' ? 'A⇋B 互为' : k === 'two' ? 'A⇋B 各自关系' : 'A→B 单向';
  }

  function openNodeMenu(charId) {
    const c = App.data.characters.find(x => x.id === charId);
    if (!c) return;
    UI.openModal(
      '<h3 style="margin:0 0 4px">' + U.escapeHtml(c.name || '未命名') + '</h3>' +
      '<div class="hint" style="margin-bottom:12px">' + U.escapeHtml(c.role || '未设定身份') + '</div>' +
      '<div class="btn-row" style="justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn danger" data-action="graphNodeRemove" data-id="' + charId + '">从图中移除</button>' +
      '<button class="btn primary" data-action="graphNodeEdit" data-id="' + charId + '">编辑人物卡</button>' +
      '</div>');
  }

  function openEdgeMenu(edgeId) {
    const e = App.getGraph().edges.find(x => x.id === edgeId);
    if (!e) return;
    const cmap = {};
    App.data.characters.forEach(c => { cmap[c.id] = c; });
    const na = (cmap[e.from] || {}).name || '?', nb = (cmap[e.to] || {}).name || '?';
    const desc = e.kind === 'two'
      ? (e.label ? na + '是' + nb + '的' + e.label + '；' : '') + (e.labelBA ? nb + '是' + na + '的' + e.labelBA : '')
      : (e.label || '（无标签）');
    UI.openModal(
      '<h3 style="margin:0 0 4px">关系：' + U.escapeHtml(na) + ' — ' + U.escapeHtml(nb) + '</h3>' +
      '<div class="hint" style="margin-bottom:12px">' + kindLabel(e.kind || 'one') + ' · ' + U.escapeHtml(desc) + '</div>' +
      '<div class="btn-row" style="justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn danger" data-action="graphEdgeDel" data-id="' + e.id + '">删除关系</button>' +
      '<button class="btn primary" data-action="graphEdgeEdit" data-id="' + e.id + '">编辑</button>' +
      '</div>');
  }

  function openAddCharModal() {
    const graph = App.getGraph();
    const inGraph = new Set(graph.nodes.map(n => n.charId));
    const avail = App.data.characters.filter(c => !inGraph.has(c.id));
    if (!avail.length) {
      UI.openModal('<h3 style="margin:0 0 4px">添加人物</h3>' +
        '<p class="hint">所有人物都已加入图中，或还没有人物。请先到「人物」页创建角色。</p>' +
        '<div class="btn-row" style="justify-content:flex-end"><button class="btn" data-action="modal-close">知道了</button></div>');
      return;
    }
    UI.openModal('<h3 style="margin:0 0 4px">添加人物到关系图</h3>' +
      '<select class="select" id="graph-char-select">' + avail.map(c =>
        '<option value="' + c.id + '">' + U.escapeHtml(c.name || '未命名') + (c.role ? '（' + U.escapeHtml(c.role) + '）' : '') + '</option>'
      ).join('') + '</select>' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="graphAddCharConfirm">添加到图</button></div>');
  }

  function openAddEdgeModal(edge) {
    const graph = App.getGraph();
    const chars = App.data.characters;
    const cmap = {};
    chars.forEach(c => { cmap[c.id] = c; });
    const inGraph = graph.nodes.map(n => cmap[n.charId]).filter(Boolean);
    if (inGraph.length < 2) {
      UI.openModal('<h3 style="margin:0 0 4px">添加关系</h3>' +
        '<p class="hint">关系图里至少需要 2 个人物才能连线，请先添加人物。</p>' +
        '<div class="btn-row" style="justify-content:flex-end"><button class="btn" data-action="modal-close">知道了</button></div>');
      return;
    }
    const opt = c => '<option value="' + c.id + '">' + U.escapeHtml(c.name || '未命名') + '</option>';
    const aVal = edge ? edge.from : inGraph[0].id;
    const bVal = edge ? edge.to : (inGraph[1] || inGraph[0]).id;
    const kind = edge ? (edge.kind || 'one') : 'one';
    App.state.geKind = kind;
    const kindChips = [
      { v: 'one', l: 'A → B 单向（A 是 B 的什么）' },
      { v: 'mutual', l: 'A ⇋ B 互为（A 和 B 互为什么）' },
      { v: 'two', l: 'A ⇋ B 各自关系（两个标签）' }
    ].map(k => '<span class="chip' + (kind === k.v ? ' active' : '') + '" data-action="geKind" data-id="' + k.v + '">' + k.l + '</span>').join(' ');
    const presets = RELATION_PRESETS.map(p =>
      '<span class="chip" data-action="gePreset" data-id="' + p + '">' + p + '</span>'
    ).join(' ');
    UI.openModal(
      '<h3 style="margin:0 0 4px">' + (edge ? '编辑关系' : '添加关系') + '</h3>' +
      '<div class="form-grid">' +
      '<div><label class="label">人物 A</label><select class="select" id="ge-a">' + inGraph.map(opt).join('') + '</select></div>' +
      '<div><label class="label">人物 B</label><select class="select" id="ge-b">' + inGraph.map(opt).join('') + '</select></div>' +
      '</div>' +
      '<label class="label">关系类型</label><div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:2px">' + kindChips + '</div>' +
      '<label class="label" id="ge-label-label">' + (kind === 'mutual' ? 'A 和 B 互为什么' : 'A 是 B 的什么') + '</label>' +
      '<input class="input" id="ge-label" value="' + U.escapeHtml(edge ? edge.label : '') + '" placeholder="如：师徒、情侣、宿敌…">' +
      '<div id="ge-labelba-box"' + (kind === 'two' ? '' : ' style="display:none"') + '>' +
      '<label class="label">B 是 A 的什么</label>' +
      '<input class="input" id="ge-labelba" value="' + U.escapeHtml(edge ? edge.labelBA : '') + '" placeholder="如：徒弟、恋人…">' +
      '</div>' +
      '<label class="label">常用预设（点击填入第一个标签）</label><div style="display:flex;gap:6px;flex-wrap:wrap">' + presets + '</div>' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="graphEdgeSave" data-id="' + (edge ? edge.id : '') + '">保存</button></div>'
    );
    const aSel = U.$('#ge-a'); if (aSel) aSel.value = aVal;
    const bSel = U.$('#ge-b'); if (bSel) bSel.value = bVal;
  }

  Actions['geKind'] = t => {
    const kind = t.dataset.id;
    App.state.geKind = kind;
    U.$$('#modal-root [data-action="geKind"]').forEach(c => c.classList.toggle('active', c.dataset.id === kind));
    const l1 = U.$('#ge-label-label');
    if (l1) l1.textContent = kind === 'mutual' ? 'A 和 B 互为什么' : 'A 是 B 的什么';
    const l2 = U.$('#ge-labelba-box');
    if (l2) l2.style.display = kind === 'two' ? '' : 'none';
  };

  /* ---------- 关系图 Actions ---------- */
  Actions['graphAddChar'] = () => openAddCharModal();
  Actions['graphAddCharConfirm'] = async () => {
    const sel = U.$('#graph-char-select');
    if (!sel || !sel.value) return;
    const wrap = graphWrap();
    const center = toGraph({ x: (wrap ? wrap.clientWidth : 800) / 2, y: (wrap ? wrap.clientHeight : 500) / 2 });
    Graph.addNode(App.getGraph(), sel.value, Math.round(center.x), Math.round(center.y));
    await App.graphSave();
    UI.closeModal();
    UI.toast('已添加到关系图');
    Views.world.renderGraph(U.$('#world-body'));
  };
  Actions['graphAddEdge'] = () => openAddEdgeModal(null);
  Actions['graphNodeEdit'] = t => {
    const c = App.data.characters.find(x => x.id === t.dataset.id);
    if (c) { UI.closeModal(); UI.openModal(charFormHtml(c)); }
  };
  Actions['graphNodeRemove'] = async t => {
    const graph = App.getGraph();
    Graph.removeNode(graph, t.dataset.id);
    await App.graphSave();
    UI.closeModal();
    UI.toast('已从图中移除');
    Views.world.renderGraph(U.$('#world-body'));
  };
  Actions['graphEdgeEdit'] = t => {
    const e = App.getGraph().edges.find(x => x.id === t.dataset.id);
    UI.closeModal();
    if (e) openAddEdgeModal(e);
  };
  Actions['graphEdgeDel'] = async t => {
    const graph = App.getGraph();
    Graph.removeEdge(graph, t.dataset.id);
    await App.graphSave();
    UI.closeModal();
    UI.toast('已删除关系');
    Views.world.renderGraph(U.$('#world-body'));
  };
  Actions['gePreset'] = t => {
    const inp = U.$('#ge-label');
    if (inp) inp.value = t.dataset.id;
  };
  Actions['graphEdgeSave'] = async t => {
    const a = U.$('#ge-a'), b = U.$('#ge-b');
    const label = U.$('#ge-label');
    const labelBA = U.$('#ge-labelba');
    if (!a || !b || a.value === b.value) { UI.toast('请选择两个不同的人物', 'err'); return; }
    const graph = App.getGraph();
    const kind = App.state.geKind || 'one';
    const existsReverse = graph.edges.some(e => e.from === b.value && e.to === a.value && e.id !== t.dataset.id);
    if (existsReverse && kind === 'one') UI.toast('已存在反向关系，建议改用「互为」或「各自关系」', 'warn');
    Graph.addEdge(graph, a.value, b.value, kind, label ? label.value.trim() : '', labelBA ? labelBA.value.trim() : '');
    await App.graphSave();
    UI.closeModal();
    UI.toast('已保存');
    Views.world.renderGraph(U.$('#world-body'));
  };
  Actions['graphAutoLayout'] = async () => {
    const graph = App.getGraph();
    Graph.circularLayout(graph, 0, 0, 80 + graph.nodes.length * 26);
    await App.graphSave();
    fitGraphView();
    renderGraphSVG();
    UI.toast('已自动布局');
  };

  Actions['worldSeg'] = t => {
    App.state.worldSeg = t.dataset.id;
    Views.world.render(U.$('#work-tab-content'));
  };

  /* ---------- 人物表单 ---------- */
  function charFormHtml(c) {
    c = c || {};
    return '<h3 style="margin:0 0 4px">' + (c.id ? '编辑人物' : '新建人物') + '</h3>' +
      '<div class="form-grid">' +
      '<div><label class="label">姓名 *</label><input class="input" name="name" value="' + U.escapeHtml(c.name || '') + '"></div>' +
      '<div><label class="label">别名/称号</label><input class="input" name="alias" value="' + U.escapeHtml(c.alias || '') + '"></div>' +
      '<div><label class="label">身份/角色定位</label><input class="input" name="role" value="' + U.escapeHtml(c.role || '') + '" placeholder="如：主角、反派、师父"></div>' +
      '<div><label class="label">性别</label><select class="select" name="gender">' +
      ['', '男', '女', '未知', '其他'].map(g => '<option' + (g === (c.gender || '') ? ' selected' : '') + '>' + g + '</option>').join('') + '</select></div>' +
      '<div><label class="label">年龄</label><input class="input" name="age" value="' + U.escapeHtml(c.age || '') + '"></div>' +
      '<div><label class="label">标签（逗号分隔）</label><input class="input" name="tags" value="' + U.escapeHtml(c.tags || '') + '" placeholder="如：主角, 天才, 重生"></div>' +
      '<div class="full"><label class="label">外貌</label><textarea class="textarea" name="appearance" rows="2">' + U.escapeHtml(c.appearance || '') + '</textarea></div>' +
      '<div class="full"><label class="label">性格</label><textarea class="textarea" name="personality" rows="2">' + U.escapeHtml(c.personality || '') + '</textarea></div>' +
      '<div class="full"><label class="label">背景故事</label><textarea class="textarea" name="background" rows="3">' + U.escapeHtml(c.background || '') + '</textarea></div>' +
      '<div class="full"><label class="label">人物关系</label><textarea class="textarea" name="relationships" rows="3" placeholder="如：与主角是青梅竹马…">' + U.escapeHtml(c.relationships || '') + '</textarea></div>' +
      '</div>' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      (c.id ? '<button class="btn danger" style="margin-right:auto" data-action="charDel" data-id="' + c.id + '">删除</button>' : '') +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="charSave" data-id="' + (c.id || '') + '">保存</button></div>';
  }

  Actions['charNew'] = () => UI.openModal(charFormHtml());
  Actions['charOpen'] = async t => {
    const c = App.data.characters.find(x => x.id === t.dataset.id);
    if (c) UI.openModal(charFormHtml(c));
  };
  Actions['charSave'] = async t => {
    const f = UI.readForm(U.$('#modal-root .modal'));
    if (!f.name.trim()) { UI.toast('请填写姓名', 'err'); return; }
    const now = Date.now();
    if (t.dataset.id) {
      const c = App.data.characters.find(x => x.id === t.dataset.id);
      if (!c) return;
      Object.assign(c, f);
      c.updatedAt = now;
      await DB.put('characters', c);
    } else {
      const c = Object.assign({
        id: U.uid(), workId: App.state.workId, sort: App.nextSort(App.data.characters),
        createdAt: now, updatedAt: now
      }, f);
      await DB.put('characters', c);
      App.data.characters.push(c);
    }
    UI.closeModal();
    UI.toast('已保存');
    if (App.state.worldSeg === 'graph') Views.world.renderGraph(U.$('#world-body'));
    else Views.world.renderSettingGrid();
  };
  Actions['charDel'] = t => {
    UI.confirmDialog('删除人物', '确定删除该人物卡吗？', async () => {
      await DB.del('characters', t.dataset.id);
      App.data.characters = App.data.characters.filter(x => x.id !== t.dataset.id);
      Graph.removeNode(App.getGraph(), t.dataset.id); /* 关系图同步清理 */
      await App.graphSave();
      UI.closeModal();
      UI.toast('已删除');
      if (App.state.worldSeg === 'graph') Views.world.renderGraph(U.$('#world-body'));
      else Views.world.renderSettingGrid();
    });
  };

  /* ---------- 其他设定表单 ---------- */
  function entryFormHtml(e) {
    e = e || {};
    return '<h3 style="margin:0 0 4px">' + (e.id ? '编辑设定' : '新建设定') + '</h3>' +
      '<label class="label">类型</label><select class="select" name="type">' +
      D.ENTRY_TYPES.map(t => '<option value="' + t.v + '"' + (t.v === (e.type || 'faction') ? ' selected' : '') + '>' + t.l + '</option>').join('') + '</select>' +
      '<label class="label">名称 *</label><input class="input" name="name" value="' + U.escapeHtml(e.name || '') + '">' +
      '<label class="label">详细设定</label><textarea class="textarea" name="content" rows="6">' + U.escapeHtml(e.content || '') + '</textarea>' +
      '<div class="modal-foot" style="padding:16px 0 0;justify-content:flex-end">' +
      (e.id ? '<button class="btn danger" style="margin-right:auto" data-action="entryDel" data-id="' + e.id + '">删除</button>' : '') +
      '<button class="btn" data-action="modal-close">取消</button>' +
      '<button class="btn primary" data-action="entrySave" data-id="' + (e.id || '') + '">保存</button></div>';
  }

  Actions['entryNew'] = () => UI.openModal(entryFormHtml());
  Actions['entryOpen'] = async t => {
    const e = App.data.entries.find(x => x.id === t.dataset.id);
    if (e) UI.openModal(entryFormHtml(e));
  };
  Actions['entrySave'] = async t => {
    const f = UI.readForm(U.$('#modal-root .modal'));
    if (!f.name.trim()) { UI.toast('请填写名称', 'err'); return; }
    const now = Date.now();
    if (t.dataset.id) {
      const e = App.data.entries.find(x => x.id === t.dataset.id);
      if (!e) return;
      Object.assign(e, f);
      e.updatedAt = now;
      await DB.put('entries', e);
    } else {
      const e = Object.assign({
        id: U.uid(), workId: App.state.workId, sort: App.nextSort(App.data.entries),
        createdAt: now, updatedAt: now
      }, f);
      await DB.put('entries', e);
      App.data.entries.push(e);
    }
    UI.closeModal();
    UI.toast('已保存');
    Views.world.renderSettingGrid();
  };
  Actions['entryDel'] = t => {
    UI.confirmDialog('删除设定', '确定删除该设定吗？', async () => {
      await DB.del('entries', t.dataset.id);
      App.data.entries = App.data.entries.filter(x => x.id !== t.dataset.id);
      UI.closeModal();
      UI.toast('已删除');
      Views.world.renderSettingGrid();
    });
  };
})();
