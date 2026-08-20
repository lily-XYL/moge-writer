/* ============ 墨阁 · 导出 / 导入 / 备份 ============ */
window.Export = (() => {
  const U = window.Util;
  const DB = window.DB;

  function download(filename, content, mime) {
    let blob;
    if (content instanceof Uint8Array) {
      blob = new Blob([content], { type: mime || 'application/octet-stream' });
    } else {
      blob = new Blob(['\ufeff' + content], { type: mime || 'text/plain;charset=utf-8' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 600);
  }

  /* ---------- 分组工具（卷 + 章节） ---------- */
  function groupedChapters(volumes, chapters) {
    const byVol = {};
    (volumes || []).forEach(v => { byVol[v.id] = v; });
    const orphans = chapters.filter(c => !c.volumeId || !byVol[c.volumeId]);
    const grouped = [];
    (volumes || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(v => {
      grouped.push({ vol: v, chs: chapters.filter(c => c.volumeId === v.id).sort((a, b) => (a.sort || 0) - (b.sort || 0)) });
    });
    if (orphans.length) grouped.push({ vol: null, chs: orphans.sort((a, b) => (a.sort || 0) - (b.sort || 0)) });
    return grouped;
  }

  function volTitle(vol) {
    return vol ? (vol.title || '未命名卷') : '未分卷';
  }

  /* 生成全文目录行 */
  function tocLines(volumes, chapters) {
    const lines = [];
    const byVol = {};
    (volumes || []).forEach(v => { byVol[v.id] = v; });
    const orphans = chapters.filter(c => !c.volumeId || !byVol[c.volumeId]);
    const grouped = [];
    (volumes || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(v => {
      grouped.push({ vol: v, chs: chapters.filter(c => c.volumeId === v.id).sort((a, b) => (a.sort || 0) - (b.sort || 0)) });
    });
    if (orphans.length) grouped.push({ vol: null, chs: orphans.sort((a, b) => (a.sort || 0) - (b.sort || 0)) });
    let n = 0;
    grouped.forEach(g => {
      if (g.vol) lines.push(volTitle(g.vol));
      g.chs.forEach(c => {
        n++;
        lines.push('第' + n + '章 ' + (c.title || '无题') + '（' + U.countWords(c.content) + '字）');
      });
    });
    return lines;
  }

  /* 全本 TXT */
  function buildBookTxt(work, volumes, chapters) {
    const lines = [];
    lines.push(work.title || '未命名作品');
    if (work.author) lines.push('作者：' + work.author);
    lines.push('');
    if (work.synopsis) { lines.push('【简介】'); lines.push(work.synopsis); lines.push(''); }
    lines.push('【目录】');
    tocLines(volumes, chapters).forEach(l => lines.push('  ' + l));
    lines.push('');

    const byVol = {};
    (volumes || []).forEach(v => { byVol[v.id] = v; });
    const orphans = chapters.filter(c => !c.volumeId || !byVol[c.volumeId]);
    const grouped = [];
    (volumes || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(v => {
      grouped.push({ vol: v, chs: chapters.filter(c => c.volumeId === v.id).sort((a, b) => (a.sort || 0) - (b.sort || 0)) });
    });
    if (orphans.length) grouped.push({ vol: null, chs: orphans.sort((a, b) => (a.sort || 0) - (b.sort || 0)) });

    let n = 0;
    grouped.forEach(g => {
      if (g.vol) { lines.push(''); lines.push('【' + volTitle(g.vol) + '】'); lines.push(''); }
      g.chs.forEach(c => {
        n++;
        lines.push('第' + n + '章 ' + (c.title || '无题'));
        lines.push('');
        lines.push(c.content || '');
        lines.push('');
      });
    });
    return lines.join('\n');
  }

  /* 全本 Markdown */
  function buildBookMd(work, volumes, chapters) {
    const lines = [];
    lines.push('# ' + (work.title || '未命名作品'));
    if (work.author) lines.push('> 作者：' + work.author);
    if (work.synopsis) { lines.push(''); lines.push('## 简介'); lines.push(''); lines.push(work.synopsis); }
    lines.push('');

    const byVol = {};
    (volumes || []).forEach(v => { byVol[v.id] = v; });
    const orphans = chapters.filter(c => !c.volumeId || !byVol[c.volumeId]);
    const grouped = [];
    (volumes || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0)).forEach(v => {
      grouped.push({ vol: v, chs: chapters.filter(c => c.volumeId === v.id).sort((a, b) => (a.sort || 0) - (b.sort || 0)) });
    });
    if (orphans.length) grouped.push({ vol: null, chs: orphans.sort((a, b) => (a.sort || 0) - (b.sort || 0)) });

    let n = 0;
    grouped.forEach(g => {
      if (g.vol) { lines.push(''); lines.push('## ' + volTitle(g.vol)); lines.push(''); }
      g.chs.forEach(c => {
        n++;
        lines.push('### 第' + n + '章 ' + (c.title || '无题'));
        lines.push('');
        lines.push(c.content || '');
        lines.push('');
      });
    });
    return lines.join('\n');
  }

  /* 单章 TXT */
  function buildChapterTxt(work, chapter) {
    return [work.title + ' · ' + (chapter.title || '无题'), '', chapter.content || ''].join('\n');
  }

  /* ---------- HTML 单文件（适合阅读/打印） ---------- */
  function buildBookHtml(work, volumes, chapters) {
    const esc = U.escapeHtml;
    const paras = text => (text || '').split(/\n+/).map(p => p.trim()).filter(Boolean).map(p => '<p>' + esc(p) + '</p>').join('');
    let n = 0;
    let toc = '<nav class="toc"><h2>目录</h2><ol>';
    let body = '';
    groupedChapters(volumes, chapters).forEach(g => {
      if (g.vol) {
        toc += '<li class="toc-vol">' + esc(volTitle(g.vol)) + '</li>';
        body += '<h2 class="vol-title">' + esc(volTitle(g.vol)) + '</h2>';
      }
      g.chs.forEach(c => {
        n++;
        const title = '第' + n + '章 ' + (c.title || '无题');
        toc += '<li><a href="#ch' + n + '">' + esc(title) + '</a></li>';
        body += '<h3 class="ch-title" id="ch' + n + '">' + esc(title) + '</h3>' + paras(c.content);
      });
    });
    toc += '</ol></nav>';
    const intro = '<header><h1>' + esc(work.title || '未命名作品') + '</h1>' +
      (work.author ? '<p class="author">作者：' + esc(work.author) + '</p>' : '') +
      (work.synopsis ? '<blockquote>' + esc(work.synopsis).replace(/\n/g, '<br>') + '</blockquote>' : '') + '</header>';
    return '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + esc(work.title || '未命名作品') + '</title><style>' +
      'body{max-width:760px;margin:0 auto;padding:32px 24px;font-family:"Noto Serif SC","Source Han Serif SC",SimSun,serif;color:#222;line-height:1.9;background:#fff}' +
      'h1{text-align:center;font-size:28px;margin:0 0 6px}h2.vol-title{margin-top:36px;border-left:4px solid #6366f1;padding-left:10px}' +
      'h3.ch-title{margin-top:28px}p{text-indent:2em;margin:0 0 .6em}' +
      '.author{text-align:center;color:#888;font-size:14px}blockquote{color:#666;border-left:3px solid #ddd;padding:6px 14px;margin:16px 0}' +
      '.toc{background:#f7f7fa;border-radius:10px;padding:16px 22px;margin:24px 0}.toc ol{padding-left:22px}.toc .toc-vol{font-weight:700;margin-top:8px;color:#6366f1}' +
      'a{color:#6366f1;text-decoration:none}' +
      '</style></head><body>' + intro + toc + body + '</body></html>';
  }

  /* ---------- RTF（Word/WPS 兼容） ---------- */
  function rtfEsc(text) {
    let out = '';
    for (const ch of String(text || '')) {
      const c = ch.codePointAt(0);
      if (c < 128) {
        if (ch === '\\') out += '\\\\';
        else if (ch === '{') out += '\\{';
        else if (ch === '}') out += '\\}';
        else out += ch;
      } else if (c <= 0xFFFF) {
        out += '\\u' + (c >= 0x8000 ? c - 0x10000 : c) + '?';
      } else {
        const s = String.fromCodePoint(c);
        const hi = s.charCodeAt(0), lo = s.charCodeAt(1);
        out += '\\u' + (hi >= 0x8000 ? hi - 0x10000 : hi) + '?\\u' + (lo >= 0x8000 ? lo - 0x10000 : lo) + '?';
      }
    }
    return out;
  }

  function buildBookRtf(work, volumes, chapters) {
    const L = [];
    L.push('{\\rtf1\\ansi\\ansicpg936\\deff0\\uc1');
    L.push('{\\fonttbl{\\f0 SimSun;}{\\f1 Microsoft YaHei;}}');
    L.push('\\f1\\fs24');
    L.push('{\\b\\fs40\\qc ' + rtfEsc(work.title || '未命名作品') + '}\\par');
    if (work.author) L.push('{\\b\\fs24\\qc 作者：' + rtfEsc(work.author) + '}\\par');
    L.push('\\par');
    if (work.synopsis) {
      L.push('{\\b\\fs28 简介}\\par');
      L.push(rtfEsc(work.synopsis).replace(/\n/g, '\\par ') + '\\par');
      L.push('\\par');
    }
    let n = 0;
    groupedChapters(volumes, chapters).forEach(g => {
      if (g.vol) {
        L.push('{\\b\\fs32 ' + rtfEsc(volTitle(g.vol)) + '}\\par');
        L.push('\\par');
      }
      g.chs.forEach(c => {
        n++;
        L.push('{\\b\\fs28 第' + n + '章 ' + rtfEsc(c.title || '无题') + '}\\par');
        L.push('\\par');
        (c.content || '').split(/\n+/).map(p => p.trim()).filter(Boolean).forEach(p => {
          L.push(rtfEsc(p) + '\\par');
        });
        L.push('\\par');
      });
    });
    L.push('}');
    return L.join('\n');
  }

  /* ---------- EPUB 电子书（纯离线 zip 写入，无压缩存储） ---------- */
  function crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1));
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function zipStore(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    files.forEach(f => {
      const name = enc.encode(f.name);
      const data = f.data;
      const crc = crc32(data);
      const lh = new Uint8Array(30);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true); /* UTF-8 文件名 */
      dv.setUint16(8, 0, true);      /* store */
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, name.length, true);
      parts.push(lh, name, data);
      const ch = new Uint8Array(46);
      const cd = new DataView(ch.buffer);
      cd.setUint32(0, 0x02014b50, true);
      cd.setUint16(4, 20, true);
      cd.setUint16(6, 20, true);
      cd.setUint16(8, 0x0800, true);
      cd.setUint16(10, 0, true);
      cd.setUint32(16, crc, true);
      cd.setUint32(20, data.length, true);
      cd.setUint32(24, data.length, true);
      cd.setUint16(28, name.length, true);
      cd.setUint32(42, offset, true);
      central.push(ch, name);
      offset += 30 + name.length + data.length;
    });
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const cdOffset = offset;
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, cdOffset, true);
    const out = new Uint8Array(cdOffset + cdSize + 22);
    let pos = 0;
    [].concat(parts, central, [eocd]).forEach(p => { out.set(p, pos); pos += p.length; });
    return out;
  }

  function buildBookEpub(work, volumes, chapters) {
    const enc = s => new TextEncoder().encode(s);
    const esc = U.escapeHtml;
    const escXml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    const bookId = 'moge-' + (work.id || Date.now().toString(36));
    const files = [{ name: 'mimetype', data: enc('application/epub+zip') }];
    const manifest = [];
    const spine = [];
    let n = 0;

    groupedChapters(volumes, chapters).forEach(g => {
      g.chs.forEach(c => {
        n++;
        const fn = 'chapter-' + String(n).padStart(3, '0') + '.xhtml';
        const title = '第' + n + '章 ' + (c.title || '无题');
        const paras = (c.content || '').split(/\n+/).map(p => p.trim()).filter(Boolean).map(p => '<p>' + escXml(p) + '</p>').join('');
        const volName = g.vol ? escXml(volTitle(g.vol)) : '';
        files.push({
          name: 'OEBPS/' + fn,
          data: enc('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN">\n<head>\n<meta charset="UTF-8"/>\n<title>' + title + '</title>\n<link rel="stylesheet" type="text/css" href="style.css"/>\n</head>\n<body>\n' +
            (volName ? '<h2 class="vol">' + volName + '</h2>\n' : '') +
            '<h1>' + title + '</h1>\n' + paras + '\n</body>\n</html>')
        });
        manifest.push('<item id="ch' + n + '" href="' + fn + '" media-type="application/xhtml+xml"/>');
        spine.push('<itemref idref="ch' + n + '"/>');
      });
    });

    /* 目录（EPUB3 nav） */
    n = 0;
    let navItems = '';
    groupedChapters(volumes, chapters).forEach(g => {
      g.chs.forEach(c => {
        n++;
        navItems += '<li><a href="chapter-' + String(n).padStart(3, '0') + '.xhtml">第' + n + '章 ' + escXml(c.title || '无题') + '</a></li>';
      });
    });
    files.push({
      name: 'OEBPS/toc.xhtml',
      data: enc('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE html>\n<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="zh-CN">\n<head><meta charset="UTF-8"/><title>目录</title></head>\n<body>\n<nav epub:type="toc"><h1>目录</h1><ol>' + navItems + '</ol></nav>\n</body>\n</html>')
    });
    files.push({
      name: 'OEBPS/style.css',
      data: enc('body{font-family:"Noto Serif SC","Source Han Serif SC",SimSun,serif;line-height:1.9;margin:5% 6%}\nh1{font-size:1.3em;text-align:center}\nh2.vol{margin-top:2em;color:#666}\np{text-indent:2em;margin:0 0 .5em}')
    });

    manifest.unshift('<item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
    manifest.unshift('<item id="style" href="style.css" media-type="text/css"/>');

    const opf =
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="zh-CN">\n' +
      '<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">\n' +
      '<dc:identifier id="uid">' + bookId + '</dc:identifier>\n' +
      '<dc:title>' + escXml(work.title || '未命名作品') + '</dc:title>\n' +
      (work.author ? '<dc:creator>' + escXml(work.author) + '</dc:creator>\n' : '') +
      '<dc:language>zh-CN</dc:language>\n' +
      '<meta property="dcterms:modified">' + new Date().toISOString().replace(/\.\d+Z$/, 'Z') + '</meta>\n' +
      '</metadata>\n' +
      '<manifest>\n' + manifest.join('\n') + '\n</manifest>\n' +
      '<spine>\n' + spine.join('\n') + '\n</spine>\n' +
      '</package>\n';
    files.push({ name: 'OEBPS/content.opf', data: enc(opf) });
    files.push({
      name: 'META-INF/container.xml',
      data: enc('<?xml version="1.0" encoding="UTF-8"?>\n<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">\n<rootfiles>\n<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>\n</rootfiles>\n</container>')
    });

    return zipStore(files);
  }

  /* ---------- Word（DOCX，OpenXML 格式，纯离线 zip 写入） ---------- */
  function buildBookDocx(work, volumes, chapters) {
    const enc = s => new TextEncoder().encode(s);
    const escXml = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    /* 段落：style = Normal | Title | VolTitle | ChapTitle | TOC */
    const para = (text, style, indent) =>
      '<w:p><w:pPr>' + (style ? '<w:pStyle w:val="' + style + '"/>' : '') +
      (indent ? '<w:ind w:firstLineChars="200" w:firstLine="480"/>' : '') + '</w:pPr>' +
      '<w:r><w:t xml:space="preserve">' + escXml(text) + '</w:t></w:r></w:p>';

    const body = [];
    body.push(para(work.title || '未命名作品', 'Title'));
    if (work.author) body.push(para('作者：' + work.author, 'Normal'));
    body.push(para(''));
    if (work.synopsis) {
      body.push(para('简介', 'VolTitle'));
      work.synopsis.split(/\n+/).map(p => p.trim()).filter(Boolean).forEach(p => body.push(para(p, 'Normal')));
      body.push(para(''));
    }
    let n = 0;
    groupedChapters(volumes, chapters).forEach(g => {
      if (g.vol) { body.push(para(volTitle(g.vol), 'VolTitle')); body.push(para('')); }
      g.chs.forEach(c => {
        n++;
        body.push(para('第' + n + '章 ' + (c.title || '无题'), 'ChapTitle'));
        (c.content || '').split(/\n+/).map(p => p.trim()).filter(Boolean).forEach(p => body.push(para(p, 'Normal', true)));
        body.push(para(''));
      });
    });

    const documentXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
      '<w:body>\n' + body.join('\n') +
      '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>\n' +
      '</w:body>\n</w:document>';

    const stylesXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
      '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="SimSun" w:eastAsia="宋体" w:hAnsi="SimSun"/><w:sz w:val="24"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:jc w:val="center"/><w:spacing w:after="240"/></w:pPr><w:rPr><w:rFonts w:ascii="SimHei" w:eastAsia="黑体"/><w:b/><w:sz w:val="44"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="VolTitle"><w:name w:val="VolTitle"/><w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="SimHei" w:eastAsia="黑体"/><w:b/><w:sz w:val="32"/></w:rPr></w:style>' +
      '<w:style w:type="paragraph" w:styleId="ChapTitle"><w:name w:val="ChapTitle"/><w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:rFonts w:ascii="SimHei" w:eastAsia="黑体"/><w:b/><w:sz w:val="28"/></w:rPr></w:style>' +
      '</w:styles>';

    const contentTypeXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '</Types>';

    const relsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '</Relationships>';

    const docRelsXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>';

    return zipStore([
      { name: '[Content_Types].xml', data: enc(contentTypeXml) },
      { name: '_rels/.rels', data: enc(relsXml) },
      { name: 'word/document.xml', data: enc(documentXml) },
      { name: 'word/styles.xml', data: enc(stylesXml) },
      { name: 'word/_rels/document.xml.rels', data: enc(docRelsXml) }
    ]);
  }
  function dumpAll() {
    const stores = DB.STORES.filter(s => s !== 'backups');
    return Promise.all(stores.map(s => DB.getAll(s))).then(arrs => {
      const data = { app: 'moge-studio', version: 2, scope: 'all', exportedAt: new Date().toISOString() };
      stores.forEach((s, i) => { data[s] = arrs[i]; });
      return data;
    });
  }

  const STORE_KEYS = { settings: 'key' };
  function primaryKey(store, record) {
    return record && record[STORE_KEYS[store] || 'id'];
  }
  function validateBackup(data, stores, mode) {
    if (!data || typeof data !== 'object' || data.app !== 'moge-studio') {
      throw new Error('该文件不是墨阁写作工坊备份');
    }
    if (data.version !== 1 && data.version !== 2) {
      throw new Error('不支持的备份版本');
    }
    const records = {};
    stores.forEach(store => {
      const hasStore = Object.prototype.hasOwnProperty.call(data, store);
      if (!hasStore) {
        if (mode === 'replace') throw new Error('覆盖导入需要完整备份，缺少 ' + store + ' 数据');
        return;
      }
      const arr = data[store];
      if (!Array.isArray(arr)) throw new Error(store + ' 数据格式无效');
      arr.forEach((record, index) => {
        const key = primaryKey(store, record);
        if (!record || typeof record !== 'object' || key == null || key === '') {
          throw new Error(store + ' 第 ' + (index + 1) + ' 条记录缺少主键');
        }
      });
      records[store] = arr;
    });
    return records;
  }

  /* 导入：mode = 'replace'（完整覆盖） | 'merge'（合并，冲突跳过）。 */
  function restoreAll(data, mode) {
    const stores = DB.STORES.filter(s => s !== 'backups');
    mode = mode === 'replace' ? 'replace' : 'merge';
    let records;
    try { records = validateBackup(data, stores, mode); } catch (e) { return Promise.reject(e); }
    const total = Object.values(records).reduce((sum, arr) => sum + arr.length, 0);

    if (mode === 'replace') {
      return DB.applyBatch(records, stores).then(written => ({ total, written, skipped: 0 }));
    }

    const checks = Object.entries(records).flatMap(([store, arr]) =>
      arr.map(record => DB.get(store, primaryKey(store, record)).then(exists => ({ store, record, exists: !!exists })))
    );
    return Promise.all(checks).then(outcomes => {
      const writes = {};
      let skipped = 0;
      outcomes.forEach(item => {
        if (item.exists) { skipped++; return; }
        if (!writes[item.store]) writes[item.store] = [];
        writes[item.store].push(item.record);
      });
      return DB.applyBatch(writes).then(written => ({ total, written, skipped }));
    });
  }

  function sanitizeFilename(name) {
    return String(name || '未命名').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
  }

  return {
    download, buildBookTxt, buildBookMd, buildChapterTxt,
    buildBookHtml, buildBookRtf, buildBookEpub, buildBookDocx, zipStore,
    dumpAll, restoreAll, sanitizeFilename
  };
})();
