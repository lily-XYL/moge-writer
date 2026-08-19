/* ============ 墨阁 · 人物关系图数据层（纯函数，可离线测试） ============ */
window.GraphData = (() => {
  const U = window.Util;

  /* 每部作品一张关系图：{ id: workId, workId, nodes: [{charId,x,y}], edges: [{id,from,to,kind,label,labelBA}] }
     kind: 'one'    A—>B（A 是 B 的什么），label 即 A 对 B 的关系
           'mutual' A<—>B（A 和 B 互为什么），label 为共同关系
           'two'    A⇋B（A 是 B 的什么，B 是 A 的什么），label = A→B，labelBA = B→A */
  function createGraph(workId) {
    return { id: workId, workId: workId, nodes: [], edges: [], updatedAt: Date.now() };
  }

  function addNode(graph, charId, x, y) {
    if (!graph) return;
    const n = graph.nodes.find(n => n.charId === charId);
    if (n) { n.x = x; n.y = y; } else { graph.nodes.push({ charId: charId, x: x, y: y }); }
  }

  function removeNode(graph, charId) {
    if (!graph) return;
    graph.nodes = graph.nodes.filter(n => n.charId !== charId);
    graph.edges = graph.edges.filter(e => e.from !== charId && e.to !== charId);
  }

  /* kind: 'one' | 'mutual' | 'two'（兼容旧值 a2b→one / b2a→one 并交换方向 / both→mutual） */
  function addEdge(graph, from, to, kind, label, labelBA) {
    if (!graph || from === to) return null;
    let k = kind || 'one';
    if (k === 'a2b') k = 'one';
    else if (k === 'b2a') { k = 'one'; const tmp = from; from = to; to = tmp; }
    else if (k === 'both') k = 'mutual';
    const ex = graph.edges.find(e => (e.from === from && e.to === to) || (e.from === to && e.to === from));
    if (ex) {
      ex.kind = k; ex.label = label || ''; ex.labelBA = labelBA || '';
      delete ex.dir;
      return ex;
    }
    const e = { id: U.uid(), from: from, to: to, kind: k, label: label || '', labelBA: labelBA || '' };
    graph.edges.push(e);
    return e;
  }

  function removeEdge(graph, edgeId) {
    if (!graph) return;
    graph.edges = graph.edges.filter(e => e.id !== edgeId);
  }

  /* 旧版数据（dir 字段）迁移为新版 kind 字段；返回是否发生过迁移 */
  function migrate(graph) {
    if (!graph || !graph.edges || !graph.edges.length) return false;
    let changed = false;
    graph.edges.forEach(e => {
      if (e.kind) return;
      changed = true;
      if (e.dir === 'both') {
        e.kind = 'mutual';
      } else if (e.dir === 'b2a') {
        e.kind = 'one';
        const tmp = e.from; e.from = e.to; e.to = tmp;
        e.label = e.label || '';
      } else {
        e.kind = 'one';
      }
      e.labelBA = e.labelBA || '';
      delete e.dir;
    });
    return changed;
  }

  /* 清理已删除人物对应的节点与连线，返回被移除的节点数 */
  function cleanup(graph, validCharIds) {
    if (!graph) return 0;
    const set = new Set(validCharIds);
    const before = graph.nodes.length;
    graph.nodes = graph.nodes.filter(n => set.has(n.charId));
    graph.edges = graph.edges.filter(e => set.has(e.from) && set.has(e.to));
    return before - graph.nodes.length;
  }

  function circularLayout(graph, cx, cy, r) {
    if (!graph || !graph.nodes.length) return;
    const n = graph.nodes.length;
    const start = -Math.PI / 2;
    graph.nodes.forEach((node, i) => {
      const a = start + (i / n) * Math.PI * 2;
      node.x = Math.round(cx + r * Math.cos(a));
      node.y = Math.round(cy + r * Math.sin(a));
    });
  }

  function nodePos(graph, charId) {
    if (!graph) return null;
    return graph.nodes.find(n => n.charId === charId) || null;
  }

  return { createGraph, addNode, removeNode, addEdge, removeEdge, migrate, cleanup, circularLayout, nodePos };
})();
