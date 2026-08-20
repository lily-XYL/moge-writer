/* ============ 墨阁 · Electron 主进程（无边框窗口 / 单实例 / 导出另存为） ============ */
const { app, BrowserWindow, Menu, dialog, session, ipcMain } = require('electron');
const path = require('path');

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
  win.once('ready-to-show', () => { if (!process.argv.includes('--smoke-test')) win.show(); });
  win.on('closed', () => { win = null; });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

/* 窗口控制（渲染进程 → 主进程） */
ipcMain.on('window-minimize', () => { if (win) win.minimize(); });
ipcMain.on('window-maximize-toggle', () => { if (!win) return; win.isMaximized() ? win.unmaximize() : win.maximize(); });
ipcMain.on('window-close', () => { if (win) win.close(); });

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
