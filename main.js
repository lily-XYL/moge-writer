/* ============ 墨阁 · Electron 主进程（无边框窗口 / 单实例 / 导出另存为） ============ */
const { app, BrowserWindow, Menu, dialog, session, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

let win = null;

app.setAppUserModelId('com.moge.writer.plus');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.on('window-all-closed', () => { app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null); /* 去掉默认菜单，保持无边框纯净 */

    /* 导出 TXT/MD/JSON 时弹出「另存为」对话框 */
    session.defaultSession.on('will-download', (event, item, webContents) => {
      const w = BrowserWindow.fromWebContents(webContents);
      const opts = {
        title: '导出文件',
        defaultPath: path.join(app.getPath('downloads'), item.getFilename()),
        filters: [{ name: '文件', extensions: ['*'] }]
      };
      const onChosen = ({ canceled, filePath }) => {
        if (canceled || !filePath) { item.cancel(); return; }
        item.setSavePath(filePath);
      };
      const onErr = () => item.cancel();
      if (w && !w.isDestroyed()) {
        dialog.showSaveDialog(w, opts).then(onChosen).catch(onErr);
      } else {
        dialog.showSaveDialog(opts).then(onChosen).catch(onErr);
      }
    });

    createWindow();

    if (process.argv.includes('--smoke-test')) runSmokeTest();
    if (process.argv.includes('--ai-ui-test')) runAiUiTest();
    if (process.argv.includes('--backup-test')) runBackupTest();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    frame: false,                 /* 无原生边框 */
    backgroundColor: '#f5f6f9',
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.once('ready-to-show', () => {
    if (!process.argv.includes('--smoke-test') && !process.argv.includes('--ai-ui-test') && !process.argv.includes('--backup-test')) win.show();
  });
  let closePrepared = false;
  win.on('close', event => {
    if (closePrepared || win.isDestroyed()) return;
    event.preventDefault();
    closePrepared = true;
    const prepare = win.webContents && !win.webContents.isDestroyed()
      ? win.webContents.executeJavaScript('window.App && typeof App.prepareForClose === "function" ? App.prepareForClose() : null')
      : Promise.resolve();
    Promise.race([
      prepare.catch(() => null),
      new Promise(resolve => setTimeout(resolve, 2500))
    ]).finally(() => {
      if (win && !win.isDestroyed()) win.close();
    });
  });
  win.on('closed', () => { win = null; });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/* 窗口控制（渲染进程 → 主进程） */
ipcMain.on('window-minimize', () => { if (win) win.minimize(); });
ipcMain.on('window-maximize-toggle', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('window-close', () => { if (win) win.close(); });

/* ============ 外部备份文件夹：仅桌面版允许用户选择后写入 JSON ============ */
ipcMain.handle('backup-select-folder', async () => {
  const target = win && !win.isDestroyed() ? win : undefined;
  const result = await dialog.showOpenDialog(target, {
    title: '选择自动导出备份文件夹',
    properties: ['openDirectory', 'createDirectory']
  });
  return { canceled: !!result.canceled, folderPath: result.canceled ? '' : String((result.filePaths || [])[0] || '') };
});
ipcMain.handle('backup-write-external', (event, payload) => {
  const folderPath = String(payload && payload.folderPath || '').trim();
  const content = String(payload && payload.content || '');
  const requested = String(payload && payload.fileName || '墨阁自动备份.json');
  if (!folderPath || !path.isAbsolute(folderPath)) throw new Error('外部备份文件夹无效。');
  if (!content) throw new Error('没有可导出的备份数据。');
  const dir = path.resolve(folderPath);
  const fileName = path.basename(requested).replace(/[\\/:*?"<>|]/g, '_').slice(0, 120) || '墨阁自动备份.json';
  const target = path.join(dir, fileName);
  if (path.dirname(target) !== dir) throw new Error('导出文件路径无效。');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(target, content, { encoding: 'utf8', mode: 0o600 });
  return { filePath: target, bytes: Buffer.byteLength(content, 'utf8') };
});

/* ============ AI 写作助手：主进程代理调用，密钥仅保存在本机 ============ */
function aiKeyPath() { return path.join(app.getPath('userData'), 'ai-writing-key.bin'); }
function aiReadKeyRecord() {
  try {
    const file = aiKeyPath();
    if (!fs.existsSync(file)) return { keys: {}, legacy: '' };
    const raw = fs.readFileSync(file);
    const text = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(raw) : raw.toString('utf8');
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && parsed.version === 2 && parsed.keys && typeof parsed.keys === 'object') {
        const keys = {};
        Object.keys(parsed.keys).forEach(id => { const key = String(parsed.keys[id] || '').trim(); if (key) keys[id] = key; });
        return { keys: keys, legacy: '' };
      }
      /* 兼容 v1.5.0 的按服务 JSON 和 v1.5.4 的单密钥文本。 */
      if (parsed && typeof parsed === 'object') {
        return { keys: {}, legacy: String(parsed.custom || parsed.deepseek || Object.values(parsed)[0] || '').trim() };
      }
    } catch (e) { /* 单密钥文本格式，见下方返回。 */ }
    return { keys: {}, legacy: String(text || '').trim() };
  } catch (e) { return { keys: {}, legacy: '' }; }
}
function aiReadKey(profileId) {
  const record = aiReadKeyRecord();
  const id = String(profileId || 'legacy').trim() || 'legacy';
  if (record.keys[id]) return record.keys[id];
  /* 旧版唯一密钥只对旧版/默认 DeepSeek 档案做兼容读取，保存新档案后即迁移。 */
  return (id === 'legacy' || id === 'deepseek') ? record.legacy : '';
}
function aiMigrateLegacyKey(profileId) {
  const id = String(profileId || 'legacy').trim() || 'legacy';
  const record = aiReadKeyRecord();
  if (!record.legacy || record.keys[id]) return !!record.keys[id];
  const keys = Object.assign({}, record.keys, { [id]: record.legacy });
  const text = JSON.stringify({ version: 2, keys: keys });
  const raw = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8');
  fs.writeFileSync(aiKeyPath(), raw, { mode: 0o600 });
  return true;
}
function aiWriteKey(profileId, key) {
  const id = String(profileId || 'legacy').trim() || 'legacy';
  const trimmed = String(key || '').trim();
  const file = aiKeyPath();
  const record = aiReadKeyRecord();
  const keys = Object.assign({}, record.keys);
  if (trimmed) keys[id] = trimmed; else delete keys[id];
  if (!Object.keys(keys).length) { try { fs.unlinkSync(file); } catch (e) {} return false; }
  const text = JSON.stringify({ version: 2, keys: keys });
  const raw = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8');
  fs.writeFileSync(file, raw, { mode: 0o600 });
  return !!trimmed;
}
function aiEndpoint(baseUrl) {
  const raw = String(baseUrl || '').trim().replace(/\/+$/, '');
  const parsed = new URL(raw);
  const localHttp = parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
  if (parsed.protocol !== 'https:' && !localHttp) throw new Error('仅允许 HTTPS API 地址；本地服务可使用 localhost HTTP 地址。');
  return /\/chat\/completions$/i.test(parsed.pathname) ? raw : raw + '/chat/completions';
}
ipcMain.handle('ai-key-status', (event, profileId) => ({ configured: !!aiReadKey(profileId), encrypted: safeStorage.isEncryptionAvailable() }));
ipcMain.handle('ai-migrate-legacy-key', (event, profileId) => ({ configured: aiMigrateLegacyKey(profileId), encrypted: safeStorage.isEncryptionAvailable() }));
ipcMain.handle('ai-save-key', (event, profileId, key) => ({ configured: aiWriteKey(profileId, key), encrypted: safeStorage.isEncryptionAvailable() }));
ipcMain.handle('ai-chat', async (event, config, messages) => {
  const key = aiReadKey(config && config.profileId);
  if (!key) throw new Error('请先在 AI 配置中保存 API Key。');
  const model = String(config && config.model || '').trim();
  if (!model) throw new Error('请填写模型名称。');
  const endpoint = aiEndpoint(config && config.baseUrl);
  if (!Array.isArray(messages) || !messages.length) throw new Error('AI 请求内容为空。');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: model, messages: messages, temperature: Math.max(0, Math.min(1.5, Number(config.temperature) || 0.8)), stream: false })
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch (e) { throw new Error('服务返回了无法解析的响应。'); }
    if (!response.ok) throw new Error((data && data.error && (data.error.message || data.error.code)) || ('API 请求失败（HTTP ' + response.status + '）'));
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) throw new Error('服务未返回可用的文本内容。');
    return { content: String(content), model: data.model || model, usage: data.usage || null };
  } finally { clearTimeout(timer); }
});

/* ============ AI 界面回归测试：仅在命令行 --ai-ui-test 时运行 ============ */
async function runAiUiTest() {
  const receivedPrompts = [];
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        receivedPrompts.push(String(payload && payload.messages && payload.messages[1] && payload.messages[1].content || ''));
      } catch (e) { receivedPrompts.push(''); }
      const valid = req.method === 'POST' && /\/v1\/chat\/completions$/.test(req.url || '') && req.headers.authorization === 'Bearer ai-ui-test-key';
      res.writeHead(valid ? 200 : 401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(valid ? { model: 'mock-writer', usage: { total_tokens: 12 }, choices: [{ message: { content: '模拟 AI 建议：钟声骤停，城门阴影里有人低声唤他的名字。' } }] } : { error: { message: 'mock authorization failed' } }));
    });
  });
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;
    const wc = win.webContents;
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('load timeout')), 20000);
      wc.once('did-finish-load', () => { clearTimeout(t); resolve(); });
    });
    await new Promise(resolve => setTimeout(resolve, 1300));
    const result = await wc.executeJavaScript(`(async () => {
      let stage = 'initialization';
      try {
      const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
      stage = 'database';
      await DB.wipe();
      const work = { id: 'ai-work', title: 'AI 测试作品', sort: 0, createdAt: Date.now(), updatedAt: Date.now() };
      const previous = { id: 'ai-prev', workId: 'ai-work', title: '前章暗号', content: '上一章特征文本：旧桥下藏着一枚铜铃。', outline: '前章细纲：主角获得铜铃。', notes: '前章备注。', wordCount: 18, sort: 10, createdAt: Date.now(), updatedAt: Date.now() };
      const chapter = { id: 'ai-chapter', workId: 'ai-work', title: '第一章 风起', content: '夜色沉入城墙，远处传来钟声。', outline: '主角夜归，发现城门异动。', notes: '氛围克制，第三人称。', wordCount: 16, sort: 20, createdAt: Date.now(), updatedAt: Date.now() };
      const next = { id: 'ai-next', workId: 'ai-work', title: '后章密信', content: '下一章特征文本：密信藏在书架夹层。', outline: '后章细纲：发现密信。', notes: '后章备注。', wordCount: 18, sort: 30, createdAt: Date.now(), updatedAt: Date.now() };
      await DB.put('works', work); await DB.putMany('chapters', [previous, chapter, next]);
      await DB.put('outlines', { id: 'ai-outline', workId: 'ai-work', title: '总体大纲', content: '大纲特征文本：铜铃指向失落王城。', sort: 0, createdAt: Date.now(), updatedAt: Date.now() });
      await DB.put('characters', { id: 'ai-char', workId: 'ai-work', name: '沈舟', role: '主角', background: '设定特征文本：沈舟惧怕钟声。', createdAt: Date.now(), updatedAt: Date.now() });
      await DB.put('entries', { id: 'ai-entry', workId: 'ai-work', name: '失落王城', type: 'location', content: '地点设定特征文本：王城位于北境。', createdAt: Date.now(), updatedAt: Date.now() });
      stage = 'settings';
      delete App.settings.aiConfig; delete App.settings.aiProfiles; delete App.settings.aiActiveProfileId;
      const defaultConfig = window.AIWriter.currentConfig();
      App.settings.aiProfiles = [{ id: 'mock', name: '模拟 API', baseUrl: 'http://127.0.0.1:${port}/v1', model: 'mock-writer', temperature: 0.7 }];
      App.settings.aiActiveProfileId = 'mock';
      App.settings.aiConfig = Object.assign({ provider: 'custom' }, App.settings.aiProfiles[0]);
      App.settings.aiSidebarOpen = true;
      await DB.put('settings', { key: 'aiProfiles', value: App.settings.aiProfiles });
      await DB.put('settings', { key: 'aiActiveProfileId', value: 'mock' });
      await DB.put('settings', { key: 'aiConfig', value: App.settings.aiConfig });
      await DB.put('settings', { key: 'aiSidebarOpen', value: true });
      stage = 'save-key';
      await window.mogeAI.saveKey('mock', 'ai-ui-test-key');
      stage = 'editor-render';
      location.hash = '#/e/ai-work/ai-chapter';
      await delay(900);
      const grid = document.querySelector('.op-grid');
      const sidebar = document.querySelector('#ai-sidebar');
      const wrap = document.querySelector('.editor-wrap');
      const panel = document.querySelector('#ai-assist-panel');
      const contextInputs = Array.from(document.querySelectorAll('.ai-context-check input'));
      const initial = { outlineColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length, shellColumns: getComputedStyle(wrap).gridTemplateColumns.split(' ').filter(Boolean).length, sidebar: !!sidebar, panel: !!panel, tasks: document.querySelectorAll('.ai-task-grid [data-action="aiTask"]').length, contextControls: contextInputs.length, rangeButton: !!document.querySelector('[data-action="aiOpenChapterRange"]'), contextDefaultOff: contextInputs.every(input => !input.checked) };
      await Actions.aiHideSidebar();
      const hidden = wrap.classList.contains('ai-hidden') && getComputedStyle(sidebar).display === 'none';
      await Actions.aiToggleSidebar();
      const shownAgain = !wrap.classList.contains('ai-hidden') && getComputedStyle(sidebar).display !== 'none';
      stage = 'configuration-modal';
      await Actions.aiOpenConfig();
      const hasProviderSelector = !!document.querySelector('#ai-provider');
      const hasProfileSelector = !!document.querySelector('#ai-profile-select');
      const hasBaseUrl = !!document.querySelector('#ai-base-url');
      UI.closeModal();
      const text = document.querySelector('#editor-textarea'); text.focus(); text.setSelectionRange(0, 5);
      const polish = document.querySelector('[data-action="aiTask"][data-task="polish"]'); Actions.aiTask(polish);
      stage = 'generation-default';
      await Actions.aiGenerate(document.querySelector('.ai-generate'));
      const resultText = document.querySelector('#ai-result').textContent || '';
      Actions.aiInsertResult();
      const body = document.querySelector('#editor-textarea').value;
      const selectedTask = document.querySelector('.ai-generate').dataset.task;
      stage = 'context-selection';
      Actions.aiOpenChapterRange(); await delay(80);
      for (const input of document.querySelectorAll('input[data-ai-range-id]')) { input.checked = true; }
      await Actions.aiRangeSave();
      for (const input of document.querySelectorAll('.ai-context-check input')) { input.checked = true; await Actions.aiContextToggle(input); }
      Actions.aiTask(document.querySelector('[data-action="aiTask"][data-task="continue"]'));
      stage = 'generation-context';
      await Actions.aiGenerate(document.querySelector('.ai-generate'));
      stage = 'profile-isolation';
      await Actions.aiOpenConfig(); await Actions.aiProfileNew(); await delay(80);
      const secondaryId = document.querySelector('#ai-profile-id').value;
      document.querySelector('#ai-profile-name').value = '备用 API';
      document.querySelector('#ai-base-url').value = 'http://127.0.0.1:${port}/v1';
      document.querySelector('#ai-model').value = 'mock-writer';
      await window.mogeAI.saveKey(secondaryId, 'ai-ui-second-key');
      await Actions.aiSaveConfig();
      const keyIsolation = (await window.mogeAI.keyStatus('mock')).configured && (await window.mogeAI.keyStatus(secondaryId)).configured;
      return { initial, hidden, shownAgain, hasProviderSelector, hasProfileSelector, hasBaseUrl, defaultConfig: defaultConfig, profiles: window.AIWriter.allProfiles(), keyIsolation: keyIsolation, resultText, inserted: body.includes('模拟 AI 建议'), selectedTask: selectedTask, enabledContext: Array.from(document.querySelectorAll('.ai-context-check input')).every(input => input.checked), contextSummary: (document.querySelector('#ai-context-summary') || {}).textContent || '' };
      } catch (e) { return { failure: true, stage: stage, message: String((e && e.message) || e), stack: String((e && e.stack) || '') }; }
    })()`);
    if (result.failure) throw new Error(JSON.stringify(result));
    const defaultPrompt = receivedPrompts[0] || '';
    const contextPrompt = receivedPrompts[1] || '';
    const ok = result.initial.outlineColumns === 2 && result.initial.shellColumns === 3 && result.initial.sidebar && result.initial.panel && result.initial.tasks === 4 && result.initial.contextControls === 2 && result.initial.rangeButton && result.initial.contextDefaultOff && result.hidden && result.shownAgain && !result.hasProviderSelector && result.hasProfileSelector && result.hasBaseUrl && result.defaultConfig.baseUrl === 'https://api.deepseek.com' && result.defaultConfig.model === 'deepseek-chat' && result.profiles.length === 2 && result.profiles.some(p => p.id === 'mock') && result.profiles.some(p => p.name === '备用 API') && result.keyIsolation && result.resultText.includes('模拟 AI 建议') && result.inserted && result.selectedTask === 'polish' && result.enabledContext && result.contextSummary.includes('前章暗号') && !defaultPrompt.includes('上一章特征文本') && !defaultPrompt.includes('大纲特征文本') && contextPrompt.includes('上一章特征文本') && contextPrompt.includes('下一章特征文本') && contextPrompt.includes('大纲特征文本') && contextPrompt.includes('设定特征文本');
    console.log('AI_UI_RESULT ' + JSON.stringify({ ok, result }));
    app.exit(ok ? 0 : 1);
  } catch (e) {
    console.error('AI_UI_ERROR ' + (e && e.stack || e));
    app.exit(1);
  } finally { server.close(); }
}

/* ============ 自动备份回归测试：仅在命令行 --backup-test 时运行 ============ */
async function runBackupTest() {
  let externalDir = '';
  try {
    externalDir = fs.mkdtempSync(path.join(app.getPath('temp'), 'moge-external-export-'));
    const wc = win.webContents;
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('load timeout')), 20000);
      wc.once('did-finish-load', () => { clearTimeout(t); resolve(); });
    });
    await new Promise(resolve => setTimeout(resolve, 1200));
    const result = await wc.executeJavaScript(`(async () => {
      let stage = 'initialization';
      try {
        const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
        stage = 'database';
        await DB.wipe();
        Object.assign(App.settings, { backupIntervalMinutes: 5, backupKeepCount: 5, lastBackupDate: null, lastAutoBackupAt: 0, lastAutoBackupCheckAt: 0, externalExportEnabled: true, externalExportFolder: ${JSON.stringify(externalDir)}, externalExportIntervalDays: 1, lastExternalExportAt: 0, lastExternalExportCheckAt: 0 });
        const work = { id: 'backup-work', title: '备份测试作品', sort: 0, createdAt: Date.now(), updatedAt: Date.now() };
        const chapter = { id: 'backup-chapter', workId: 'backup-work', title: '第一章', content: '初始内容', outline: '', notes: '', wordCount: 4, sort: 0, createdAt: Date.now(), updatedAt: Date.now() };
        await DB.put('works', work); await DB.put('chapters', chapter);
        stage = 'deduplication';
        const first = await App.createBackup('timed');
        const duplicate = await App.createBackup('timed');
        chapter.content = '内容已变更'; chapter.updatedAt = Date.now(); await DB.put('chapters', chapter);
        const changed = await App.createBackup('timed');
        stage = 'exit';
        App.settings.lastAutoBackupAt = Date.now() - 11 * 60 * 1000;
        chapter.content = '关闭前的新内容'; chapter.updatedAt = Date.now(); await DB.put('chapters', chapter);
        const exit = await App.prepareForClose();
        stage = 'restore';
        const protection = await App.createBackup('safety', { force: true, detail: '恢复测试前' });
        chapter.content = '将被恢复覆盖的内容'; chapter.updatedAt = Date.now(); await DB.put('chapters', chapter);
        await Export.restoreAll(protection.record.data, 'replace');
        const restoredChapter = await DB.get('chapters', chapter.id);
        const restored = !!restoredChapter && restoredChapter.content === '关闭前的新内容';
        stage = 'retention';
        for (let i = 0; i < 8; i++) await App.createBackup('daily', { force: true, detail: '测试 ' + i });
        for (let i = 0; i < 7; i++) await App.createBackup('safety', { force: true, detail: '测试 ' + i });
        const backups = await DB.getAll('backups');
        const kinds = backups.reduce((map, b) => { map[b.kind] = (map[b.kind] || 0) + 1; return map; }, {});
        stage = 'external-export';
        const externalFirst = await App.writeExternalExport(false);
        const externalNotDue = await App.writeExternalExport(false);
        App.settings.lastExternalExportAt = Date.now() - 2 * 24 * 60 * 60 * 1000;
        const externalDue = await App.writeExternalExport(false);
        stage = 'chapter-tags';
        App.state.selChapterId = 'backup-chapter'; App.state.chapterTagFilter = '';
        location.hash = '#/w/backup-work/chapters'; await delay(500);
        const tagInput = document.querySelector('[data-action="chSaveTags"]');
        if (!tagInput) throw new Error('chapter tag input missing');
        tagInput.value = '主线，待修'; await Actions.chSaveTags(tagInput); await delay(120);
        const tagChip = Array.from(document.querySelectorAll('[data-action="chapterTagFilter"]')).find(el => el.dataset.tag === '主线');
        if (!tagChip) throw new Error('chapter tag filter missing');
        Actions.chapterTagFilter(tagChip); await delay(120);
        const tagged = await DB.get('chapters', 'backup-chapter');
        const tagSaved = Array.isArray(tagged.tags) && tagged.tags.includes('主线') && tagged.tags.includes('待修');
        const tagFiltered = (document.querySelector('#chapter-tree-wrap') || {}).textContent.includes('第一章');
        stage = 'settings-ui';
        location.hash = '#/settings'; await delay(450);
        const configInputs = !!document.querySelector('[data-key="backupIntervalMinutes"]') && !!document.querySelector('[data-key="backupKeepCount"]') && !!document.querySelector('[data-action="externalExportToggle"]') && !!document.querySelector('[data-action="externalExportInterval"]');
        return { first: !!first.created, duplicate: duplicate.reason === 'unchanged', changed: !!changed.created, exit: !!exit.created, restored: restored, daily: kinds.daily || 0, rolling: (kinds.timed || 0) + (kinds.exit || 0) + (kinds.safety || 0), configInputs: configInputs, labels: backups.every(b => !!b.label && !!b.kind), externalFirst: !!externalFirst.exported, externalNotDue: externalNotDue.reason === 'not-due', externalDue: !!externalDue.exported, externalPath: externalDue.filePath || externalFirst.filePath || '', tagSaved: tagSaved, tagFiltered: tagFiltered };
      } catch (e) { return { failure: true, stage: stage, message: String((e && e.message) || e), stack: String((e && e.stack) || '') }; }
    })()`);
    if (result.failure) throw new Error(JSON.stringify(result));
    let externalValid = false;
    try {
      const data = result.externalPath && fs.existsSync(result.externalPath) ? JSON.parse(fs.readFileSync(result.externalPath, 'utf8')) : null;
      externalValid = !!data && data.app === 'moge-studio' && data.version === 2 && Array.isArray(data.chapters) && data.chapters.length === 1;
    } catch (e) { externalValid = false; }
    const ok = result.first && result.duplicate && result.changed && result.exit && result.restored && result.daily === 7 && result.rolling === 5 && result.configInputs && result.labels && result.externalFirst && result.externalNotDue && result.externalDue && externalValid && result.tagSaved && result.tagFiltered;
    console.log('BACKUP_RESULT ' + JSON.stringify({ ok, result, externalValid }));
    app.exit(ok ? 0 : 1);
  } catch (e) {
    console.error('BACKUP_ERROR ' + (e && e.stack || e));
    app.exit(1);
  } finally {
    if (externalDir) { try { fs.rmSync(externalDir, { recursive: true, force: true }); } catch (e) {} }
  }
}

/* ============ 冒烟测试：隐藏窗口加载页面，验证渲染与本地存储后退出 ============ */
async function runSmokeTest() {
  try {
    const wc = win.webContents;
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('load timeout')), 20000);
      wc.once('did-finish-load', () => { clearTimeout(t); resolve(); });
    });
    await new Promise(r => setTimeout(r, 1500)); /* 等异步渲染完成 */
    const result = await wc.executeJavaScript(`(async () => {
      const h1 = document.querySelector('.page-head h1');
      const bootOk = !!h1 && h1.textContent.indexOf('我的书架') !== -1;
      let dbOk = false;
      try {
        await window.DB.put('works', { id: '__smoke__', title: '冒烟测试', sort: 0, createdAt: Date.now(), updatedAt: Date.now() });
        const w = await window.DB.get('works', '__smoke__');
        await window.DB.del('works', '__smoke__');
        dbOk = !!w;
      } catch (e) { dbOk = false; }
      return { bootOk: bootOk, dbOk: dbOk, title: h1 ? h1.textContent : '' };
    })()`);
    console.log('SMOKE_RESULT ' + JSON.stringify(result));
    const ok = result && result.bootOk && result.dbOk;
    console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
    try {
      const fs = require('fs');
      fs.writeFileSync(
        path.join(app.getPath('userData'), 'smoke-result.json'),
        JSON.stringify({ ok: ok, result: result, at: new Date().toISOString() })
      );
    } catch (e) { /* 忽略结果文件写入失败 */ }
    app.exit(ok ? 0 : 1);
  } catch (e) {
    console.error('SMOKE ERROR ' + e.message);
    try {
      const fs = require('fs');
      fs.writeFileSync(
        path.join(app.getPath('userData'), 'smoke-result.json'),
        JSON.stringify({ ok: false, error: String(e.message || e), at: new Date().toISOString() })
      );
    } catch (e2) { /* ignore */ }
    app.exit(1);
  }
}
