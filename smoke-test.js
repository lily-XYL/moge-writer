/* 墨阁 · Node 冒烟测试（纯逻辑模块） */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const files = ['js/util.js', 'js/data.js', 'js/namegen.js', 'js/check.js', 'js/export.js', 'js/graph.js'];
let code = '';
for (const f of files) {
  code += '\n' + fs.readFileSync(path.join(__dirname, f), 'utf8');
}
const sandbox = { window: {}, console, setTimeout, clearTimeout, Blob: function () {}, URL: { createObjectURL: () => '', revokeObjectURL: () => {} }, document: { createElement: () => ({ click() {}, setAttribute() {}, appendChild() {}, remove() {} }), body: { appendChild() {} } }, navigator: {}, location: {}, TextEncoder: require('util').TextEncoder, TextDecoder: require('util').TextDecoder };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

const { Util, Data, NameGen, Check, Export, GraphData } = sandbox.window;

let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ FAIL: ' + name); }
}

console.log('[1] 工具函数');
t('countWords 去空白', Util.countWords('你好 世界\n第二行') === 7);
t('todayStr 格式', /^\d{4}-\d{2}-\d{2}$/.test(Util.todayStr()));
t('escapeHtml', Util.escapeHtml('<a b="c">') === '&lt;a b=&quot;c&quot;&gt;');
t('wcText 万转换', Util.wcText(15000) === '1.5万');
t('nl2p 分段', Util.nl2p('a\n\nb').includes('<p>a</p>'));
t('debounce 只触发一次', (() => { let n = 0; const f = Util.debounce(() => n++, 10); f(); f(); f(); return new Promise(r => setTimeout(() => { t('debounce 执行一次', n === 1); r(); }, 40)); })());

console.log('[2] 起名引擎');
const names = NameGen.generateNames({ gender: 'male', style: 'classic', count: 15 });
t('生成 15 个男名', names.length === 15);
t('名字不重复', new Set(names).size === names.length);
t('名字至少 2 字', names.every(n => n.length >= 2));
const fnames = NameGen.generateNames({ gender: 'female', style: 'fresh', count: 10 });
t('生成 10 个女名', fnames.length === 10);
const pens = NameGen.penNames(8);
t('生成 8 个笔名', pens.length === 8);

console.log('[3] 违禁词检查');
const sens = Check.checkSensitive('他在赌博，还搞博彩。', ['敏感词命中']);
t('内置词命中', sens.some(x => x.word === '赌博' && x.count === 1));
t('自定义词命中', Check.checkSensitive('测试敏感词命中', ['敏感词命中']).some(x => x.word === '敏感词命中' && x.category === '自定义' && x.count === 1));
t('无命中为空', Check.checkSensitive('干净的文本').length === 0);
t('多词多位置', Check.checkSensitive('赌博赌博').some(x => x.word === '赌博' && x.count === 2));
t('位置正确', Check.checkSensitive('aa赌博')[0].positions[0] === 2);

console.log('[4] 错别字检查');
const typos = Check.checkTypos('他做为班长，帐号丢了。', [{ w: '测试错对', r: '测试正确' }]);
t('内置词对命中', typos.some(x => x.wrong === '做为' && x.right === '作为'));
t('自定义词对命中', Check.checkTypos('测试错对', [{ w: '测试错对', r: '测试正确' }]).some(x => x.wrong === '测试错对' && x.right === '测试正确'));

console.log('[5] 导出');
const work = { title: '测试之书', author: '墨客', synopsis: '简介内容' };
const vols = [{ id: 'v1', title: '第一卷 开端', sort: 0 }];
const chs = [
  { id: 'c1', workId: 'w1', volumeId: 'v1', title: '第一章 启程', content: '第一章内容', wordCount: 5, sort: 0 },
  { id: 'c2', workId: 'w1', volumeId: '', title: '番外', content: '番外内容', wordCount: 4, sort: 10 }
];
const txt = Export.buildBookTxt(work, vols, chs);
t('TXT 含书名', txt.includes('测试之书'));
t('TXT 含目录', txt.includes('【目录】'));
t('TXT 含卷标题', txt.includes('【第一卷 开端】'));
t('TXT 含章节编号', txt.includes('第1章 第一章 启程'));
t('TXT 含正文', txt.includes('第一章内容'));
const md = Export.buildBookMd(work, vols, chs);
t('MD 含标题', md.includes('# 测试之书'));
t('MD 含卷', md.includes('## 第一卷 开端'));
t('单章导出', Export.buildChapterTxt(work, chs[0]).includes('第一章 启程'));

console.log('[6] 数据词库');
t('百家姓非空', Data.SURNAMES.length > 300);
t('违禁词非空', Data.SENSITIVE_DEFAULT.length > 10);
t('错别字词对非空', Data.TYPO_PAIRS.length > 50);

console.log('[7] 人物关系图数据层（三模式 + 迁移）');
const g = GraphData.createGraph('w1');
t('空图结构', g.nodes.length === 0 && g.edges.length === 0 && g.workId === 'w1');
GraphData.addNode(g, 'a', 10, 20);
GraphData.addNode(g, 'b', 30, 40);
GraphData.addNode(g, 'a', 50, 60);
t('添加节点且去重', g.nodes.length === 2 && g.nodes.find(n => n.charId === 'a').x === 50 && g.nodes.find(n => n.charId === 'a').y === 60);
GraphData.addEdge(g, 'a', 'b', 'mutual', '互为挚友');
t('mutual 关系', g.edges.length === 1 && g.edges[0].label === '互为挚友' && g.edges[0].kind === 'mutual');
GraphData.addEdge(g, 'b', 'a', 'one', '单向更新');
t('反向边合并为一条', g.edges.length === 1 && g.edges[0].label === '单向更新' && g.edges[0].kind === 'one');
GraphData.addEdge(g, 'a', 'a', 'one', '');
t('自身关系被拒绝', g.edges.length === 1);
GraphData.addNode(g, 'c', 0, 0);
GraphData.addEdge(g, 'a', 'c', 'two', '师徒', '徒弟');
t('two 双标签', g.edges.length === 2 && g.edges[1].label === '师徒' && g.edges[1].labelBA === '徒弟' && g.edges[1].kind === 'two');
GraphData.addEdge(g, 'c', 'a', 'b2a', '反向兼容');
t('旧 b2a 自动交换方向', g.edges[1].from === 'a' && g.edges[1].to === 'c' && g.edges[1].label === '反向兼容');
GraphData.removeEdge(g, g.edges[0].id);
t('删除关系', g.edges.length === 1);
GraphData.removeNode(g, 'a');
t('删节点连带清边', g.nodes.length === 2 && g.edges.length === 0);
GraphData.addNode(g, 'x', 1, 1);
GraphData.addEdge(g, 'b', 'x', 'one', '盟友');
const removed = GraphData.cleanup(g, ['b']);
t('清理已删人物', removed === 2 && g.nodes.length === 1 && g.edges.length === 0);
GraphData.circularLayout(g, 0, 0, 100);
t('圆形布局', g.nodes[0].x === 0 && g.nodes[0].y === -100);
t('nodePos 查找', GraphData.nodePos(g, 'b').charId === 'b');

const g3 = GraphData.createGraph('w3');
g3.edges.push({ id: 'e1', from: 'a', to: 'b', dir: 'both', label: '互为' });
g3.edges.push({ id: 'e2', from: 'a', to: 'c', dir: 'a2b', label: '单向' });
g3.edges.push({ id: 'e3', from: 'd', to: 'a', dir: 'b2a', label: '反向' });
t('迁移返回 true', GraphData.migrate(g3) === true);
t('both→mutual', g3.edges[0].kind === 'mutual' && g3.edges[0].label === '互为' && !g3.edges[0].dir);
t('a2b→one', g3.edges[1].kind === 'one' && g3.edges[1].from === 'a' && g3.edges[1].to === 'c');
t('b2a→one 交换方向', g3.edges[2].kind === 'one' && g3.edges[2].from === 'a' && g3.edges[2].to === 'd');
t('迁移幂等', GraphData.migrate(g3) === false);

console.log('[8] 新导出格式（HTML / RTF / EPUB）');
const html = Export.buildBookHtml(work, vols, chs);
t('HTML 含书名', html.includes('<h1>测试之书</h1>'));
t('HTML 含目录锚点', html.includes('href="#ch1"'));
t('HTML 含正文段落', html.includes('<p>第一章内容</p>'));
const rtf = Export.buildBookRtf(work, vols, chs);
t('RTF 头部正确', rtf.startsWith('{\\rtf1'));
t('RTF 含章节标题', rtf.includes('第1章'));
t('RTF 含换行符', rtf.includes('\\par'));
const epub = Export.buildBookEpub(work, vols, chs);
t('EPUB 是 zip（PK 签名）', epub[0] === 0x50 && epub[1] === 0x4b && epub[2] === 0x03 && epub[3] === 0x04);
const mt = new TextDecoder().decode(epub.subarray(38, 58));
t('EPUB 首文件为 mimetype', mt === 'application/epub+zip');
const epubTxt = new TextDecoder().decode(epub);
t('EPUB 含 container.xml', epubTxt.includes('META-INF/container.xml'));
t('EPUB 含 content.opf', epubTxt.includes('OEBPS/content.opf'));
t('EPUB 含章节文件', epubTxt.includes('chapter-001.xhtml'));
const docx = Export.buildBookDocx(work, vols, chs);
t('DOCX 是 zip（PK 签名）', docx[0] === 0x50 && docx[1] === 0x4b);
const docxTxt = new TextDecoder().decode(docx);
t('DOCX 含 document.xml', docxTxt.includes('word/document.xml'));
t('DOCX 含 Content_Types', docxTxt.includes('[Content_Types].xml'));
t('DOCX 含书名', docxTxt.includes('测试之书'));
t('DOCX 含章节标题', docxTxt.includes('第一章 启程'));

setTimeout(() => {
  console.log('\n结果：' + pass + ' 通过, ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
}, 100);
