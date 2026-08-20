/* ============ 墨阁 · 作品导出 ============ */
(function () {
  const U = window.Util;
  const DB = window.DB;
  const Ex = window.Export;

  Views.exporttab = {
    render(el) {
      const w = App.data.work;
      const chs = App.getOrderedChapters();
      el.innerHTML =
        '<div class="two-col">' +
        '<div class="card"><div class="card-title">全文导出</div>' +
        '<div class="hint" style="margin-bottom:12px">TXT 适合直接投稿；Word/RTF 可用 Office 打开；PDF 通过打印另存；EPUB 可导入手机阅读器。</div>' +
        '<div class="btn-row">' +
        '<button class="btn primary" data-action="exportBookTxt">TXT 全文</button>' +
        '<button class="btn" data-action="exportBookWord">Word (DOCX)</button>' +
        '<button class="btn" data-action="exportBookPdf">PDF</button>' +
        '<button class="btn" data-action="exportBookEpub">EPUB 电子书</button>' +
        '<button class="btn" data-action="exportBookHtml">HTML 网页</button>' +
        '<button class="btn" data-action="exportBookRtf">RTF 文档</button>' +
        '<button class="btn" data-action="exportBookMd">Markdown</button>' +
        '<button class="btn" data-action="exportWorkJson">JSON 备份</button>' +
        '</div></div>' +
        '<div class="card"><div class="card-title">单章导出</div>' +
        '<label class="label">选择章节</label>' +
        '<select class="select" id="export-chapter">' +
        chs.map(c => '<option value="' + c.id + '">' + U.escapeHtml(c.title || '无题') + '（' + (c.wordCount || 0) + '字）</option>').join('') +
        '</select>' +
        '<div class="btn-row" style="margin-top:12px">' +
        '<button class="btn" data-action="exportSelChapter">导出所选章节 TXT</button>' +
        '</div></div>' +
        '</div>' +
        '<div class="card" style="margin-top:16px"><div class="card-title">导出说明</div>' +
        '<div class="hint">' +
        '· TXT 全文：包含目录、简介、分卷与章节标题，UTF-8 编码（带 BOM），可直接粘贴到起点/番茄等后台。<br>' +
        '· Word (DOCX)：标准 Office 格式，Word/WPS 直接打开。<br>' +
        '· PDF：点击后弹出打印对话框，在“目标打印机”中选择「另存为 PDF」或 Microsoft Print to PDF 即可生成（离线、中文完美）。<br>' +
        '· EPUB：标准电子书格式（含目录、样式），可导入微信读书/掌阅/Calibre 等。<br>' +
        '· RTF：Word/WPS 可直接打开；HTML：单文件网页，浏览器打开即可阅读/打印。<br>' +
        '· 字数统计口径为「去空白字符数」，与常见网文平台基本一致。<br>' +
        '· 完整备份与恢复请在「设置 → 数据备份」中操作。' +
        '</div></div>';
    }
  };

  Actions['exportBookTxt'] = async () => {
    const txt = Ex.buildBookTxt(App.data.work, App.data.volumes, App.data.chapters);
    Ex.download(Ex.sanitizeFilename(App.data.work.title || '作品') + '-全文.txt', txt);
    UI.toast('已导出全文 TXT');
  };
  Actions['exportBookMd'] = async () => {
    const md = Ex.buildBookMd(App.data.work, App.data.volumes, App.data.chapters);
    Ex.download(Ex.sanitizeFilename(App.data.work.title || '作品') + '.md', md);
    UI.toast('已导出 Markdown');
  };
  Actions['exportBookHtml'] = async () => {
    const html = Ex.buildBookHtml(App.data.work, App.data.volumes, App.data.chapters);
    Ex.download(Ex.sanitizeFilename(App.data.work.title || '作品') + '.html', html, 'text/html;charset=utf-8');
    UI.toast('已导出 HTML');
  };
  Actions['exportBookRtf'] = async () => {
    const rtf = Ex.buildBookRtf(App.data.work, App.data.volumes, App.data.chapters);
    Ex.download(Ex.sanitizeFilename(App.data.work.title || '作品') + '.rtf', rtf, 'application/rtf');
    UI.toast('已导出 RTF');
  };
  Actions['exportBookEpub'] = async () => {
    const epub = Ex.buildBookEpub(App.data.work, App.data.volumes, App.data.chapters);
    Ex.download(Ex.sanitizeFilename(App.data.work.title || '作品') + '.epub', epub, 'application/epub+zip');
    UI.toast('已导出 EPUB 电子书');
  };
  Actions['exportBookWord'] = async () => {
    const docx = Ex.buildBookDocx(App.data.work, App.data.volumes, App.data.chapters);
    Ex.download(Ex.sanitizeFilename(App.data.work.title || '作品') + '.docx', docx, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    UI.toast('已导出 Word 文档');
  };
  Actions['exportBookPdf'] = () => {
    const html = Ex.buildBookHtml(App.data.work, App.data.volumes, App.data.chapters);
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) { UI.toast('无法打开打印窗口', 'err'); }
      setTimeout(() => iframe.remove(), 2000);
    }, 400);
    UI.toast('请在弹出的打印窗口中选择「另存为 PDF」');
  };
  Actions['exportWorkJson'] = async () => {
    const data = await workDump();
    Ex.download(Ex.sanitizeFilename(App.data.work.title || '作品') + '-墨阁备份.json', JSON.stringify(data, null, 2));
    UI.toast('已导出本作 JSON 备份');
  };
  Actions['exportSelChapter'] = async () => {
    const sel = U.$('#export-chapter');
    if (!sel || !sel.value) { UI.toast('请先选择章节', 'warn'); return; }
    const c = App.data.chapters.find(x => x.id === sel.value);
    if (!c) return;
    const txt = Ex.buildChapterTxt(App.data.work, c);
    Ex.download(Ex.sanitizeFilename((App.data.work.title || 'work') + '_' + (c.title || 'chapter')) + '.txt', txt);
    UI.toast('已导出');
  };

  async function workDump() {
    const workId = App.state.workId;
    const w = await DB.get('works', workId);
    const stores = ['volumes', 'chapters', 'characters', 'entries', 'outlines', 'foreshadows', 'timeline', 'ideas', 'dailyStats', 'relationGraphs'];
    const data = { app: 'moge-studio', version: 2, scope: 'work', exportedAt: new Date().toISOString(), workId: workId };
    data.works = w ? [w] : [];
    for (const s of stores) {
      data[s] = await DB.getByIndex(s, 'workId', workId);
    }
    return data;
  }
})();
