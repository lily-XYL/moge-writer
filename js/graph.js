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

  /* 力导向自动布局：优先缩短已有关系，同时通过节点排斥和组件分区尽量减少交叉。 */
  function autoLayout(graph, options) {
    if (!graph || !graph.nodes || !graph.nodes.length) return;
    const opts = Object.assign({ idealDistance: 150, iterations: 180, nodeGap: 64, componentGap: 220 }, options || {});
    const ids = graph.nodes.map(n => n.charId);
    const nodeById = new Map(graph.nodes.map(n => [n.charId, n]));
    const adj = new Map(ids.map(id => [id, new Set()]));
    (graph.edges || []).forEach(e => {
      if (!adj.has(e.from) || !adj.has(e.to) || e.from === e.to) return;
      adj.get(e.from).add(e.to);
      adj.get(e.to).add(e.from);
    });

    const components = [];
    const visited = new Set();
    ids.forEach(seed => {
      if (visited.has(seed)) return;
      const queue = [seed], component = [];
      visited.add(seed);
      while (queue.length) {
        const id = queue.shift();
        component.push(id);
        adj.get(id).forEach(next => {
          if (!visited.has(next)) { visited.add(next); queue.push(next); }
        });
      }
      components.push(component);
    });
    components.sort((a, b) => b.length - a.length || String(a[0]).localeCompare(String(b[0])));

    const laidOut = components.map(component => {
      const ordered = component.slice().sort((a, b) => {
        const d = adj.get(b).size - adj.get(a).size;
        return d || String(a).localeCompare(String(b));
      });
      const pos = new Map();
      if (ordered.length === 1) {
        pos.set(ordered[0], { x: 0, y: 0 });
      } else {
        const radius = Math.max(opts.idealDistance * 0.7, ordered.length * 24);
        ordered.forEach((id, i) => {
          const angle = -Math.PI / 2 + i / ordered.length * Math.PI * 2;
          pos.set(id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        });
        const componentSet = new Set(component);
        for (let step = 0; step < opts.iterations; step++) {
          const disp = new Map(ordered.map(id => [id, { x: 0, y: 0 }]));
          for (let i = 0; i < ordered.length; i++) {
            for (let j = i + 1; j < ordered.length; j++) {
              const a = pos.get(ordered[i]), b = pos.get(ordered[j]);
              let dx = a.x - b.x, dy = a.y - b.y;
              let dist2 = dx * dx + dy * dy;
              if (dist2 < 0.01) { dx = (i + 1) * 0.01; dy = (j + 1) * 0.01; dist2 = dx * dx + dy * dy; }
              const dist = Math.sqrt(dist2);
              const push = Math.min(9000 / dist2, 16);
              const ux = dx / dist, uy = dy / dist;
              disp.get(ordered[i]).x += ux * push;
              disp.get(ordered[i]).y += uy * push;
              disp.get(ordered[j]).x -= ux * push;
              disp.get(ordered[j]).y -= uy * push;
            }
          }
          (graph.edges || []).forEach(edge => {
            if (!componentSet.has(edge.from) || !componentSet.has(edge.to)) return;
            const a = pos.get(edge.from), b = pos.get(edge.to);
            const dx = b.x - a.x, dy = b.y - a.y;
            const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
            const pull = (dist - opts.idealDistance) * 0.025;
            const ux = dx / dist, uy = dy / dist;
            disp.get(edge.from).x += ux * pull;
            disp.get(edge.from).y += uy * pull;
            disp.get(edge.to).x -= ux * pull;
            disp.get(edge.to).y -= uy * pull;
          });
          const cooling = 1 - step / opts.iterations;
          const maxMove = 9 * cooling + 1.5;
          ordered.forEach(id => {
            const p = pos.get(id), d = disp.get(id);
            const mag = Math.max(1, Math.sqrt(d.x * d.x + d.y * d.y));
            p.x += d.x / mag * Math.min(mag, maxMove);
            p.y += d.y / mag * Math.min(mag, maxMove);
          });
        }
      }
      const componentSet = new Set(component);
      const componentEdges = (graph.edges || []).filter(e => componentSet.has(e.from) && componentSet.has(e.to));
      const cross = (p1, p2, p3, p4) => {
        const orient = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        const a1 = orient(p1, p2, p3), a2 = orient(p1, p2, p4), a3 = orient(p3, p4, p1), a4 = orient(p3, p4, p2);
        return (a1 * a2 < 0) && (a3 * a4 < 0);
      };
      const layoutScore = () => {
        let length = 0, crossings = 0;
        componentEdges.forEach(e => {
          const a = pos.get(e.from), b = pos.get(e.to);
          length += Math.hypot(a.x - b.x, a.y - b.y);
        });
        for (let i = 0; i < componentEdges.length; i++) {
          for (let j = i + 1; j < componentEdges.length; j++) {
            const e1 = componentEdges[i], e2 = componentEdges[j];
            if (e1.from === e2.from || e1.from === e2.to || e1.to === e2.from || e1.to === e2.to) continue;
            if (cross(pos.get(e1.from), pos.get(e1.to), pos.get(e2.from), pos.get(e2.to))) crossings++;
          }
        }
        return length + crossings * opts.idealDistance * 3;
      };
      let bestScore = layoutScore();
      const swaps = Math.min(120, ordered.length * ordered.length * 2);
      for (let step = 0; step < swaps; step++) {
        const i = step % ordered.length;
        const j = (step * 7 + 3) % ordered.length;
        if (i === j) continue;
        const left = ordered[i], right = ordered[j], leftPos = pos.get(left), rightPos = pos.get(right);
        pos.set(left, rightPos); pos.set(right, leftPos);
        const candidate = layoutScore();
        if (candidate < bestScore) bestScore = candidate;
        else { pos.set(left, leftPos); pos.set(right, rightPos); }
      }
      const points = ordered.map(id => pos.get(id));
      const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
      const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
      points.forEach(p => { p.x -= cx; p.y -= cy; });
      const span = Math.max(1, Math.max(...points.map(p => Math.max(Math.abs(p.x), Math.abs(p.y)))));
      return { ordered, pos, span };
    });

    const columns = Math.max(1, Math.ceil(Math.sqrt(laidOut.length)));
    const maxSpan = Math.max(...laidOut.map(item => item.span));
    const cell = maxSpan * 2 + opts.componentGap;
    laidOut.forEach((item, index) => {
      const col = index % columns;
      const row = Math.floor(index / columns);
      const offsetX = (col - (columns - 1) / 2) * cell;
      const offsetY = (row - (Math.ceil(laidOut.length / columns) - 1) / 2) * cell;
      item.ordered.forEach(id => {
        const p = item.pos.get(id), node = nodeById.get(id);
        node.x = Math.round(p.x + offsetX);
        node.y = Math.round(p.y + offsetY);
      });
    });
  }

  function nodePos(graph, charId) {
    if (!graph) return null;
    return graph.nodes.find(n => n.charId === charId) || null;
  }

  return { createGraph, addNode, removeNode, addEdge, removeEdge, migrate, cleanup, circularLayout, autoLayout, nodePos };
})();
