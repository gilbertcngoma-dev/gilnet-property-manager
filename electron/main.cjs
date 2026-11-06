const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const APP_URL = 'https://lodgeflow-stay-and-revenue.lovable.app/';

// Avoid graphics-driver startup failures on older office computers.
app.disableHardwareAcceleration();
app.setName('Chaniche Lodge');
let window;

function log(error) {
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'startup.log'),
      `${new Date().toISOString()} ${error?.stack || error}\n`);
  } catch { /* The error dialog remains available if disk writes fail. */ }
}

process.on('uncaughtException', (error) => {
  log(error);
  dialog.showErrorBox('Chaniche Lodge could not start',
    'Please send a photo of this message.\n\n' + error.message);
  app.quit();
});
process.on('unhandledRejection', log);

function createWindow() {
  window = new BrowserWindow({
    width: 1280, height: 860, minWidth: 800, minHeight: 600,
    title: 'Chaniche Lodge', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url).catch(log);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin !== new URL(APP_URL).origin) {
      event.preventDefault();
      if (url.startsWith('https://')) shell.openExternal(url).catch(log);
    }
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    log(`Window stopped: ${details.reason}`);
    dialog.showErrorBox('Chaniche Lodge window stopped',
      'Close the program and open it again. Reason: ' + details.reason);
  });
  window.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;
    log(`Page failed to open: ${code} ${description}`);
  });
  window.loadURL(APP_URL).catch((error) => {
    log(error);
    dialog.showMessageBox(window, {
      type: 'warning', title: 'Unable to connect',
      message: 'Chaniche Lodge could not connect. Check your internet connection.',
      buttons: ['Try again', 'Close'], defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) window.loadURL(APP_URL).catch(log);
      else app.quit();
    }).catch(log);
  });
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Chaniche Lodge',
          click: () => {
            dialog.showMessageBox({
              type: 'info',
              title: 'About Chaniche Lodge',
              message: 'Chaniche Lodge - GILNET Property Manager',
              detail: 'Version 1.0.0\nCompany: GILNET\nSupport: support.gilnet.property.manager@gmail.com',
              buttons: ['OK', 'Email Support'],
              defaultId: 0,
            }).then(({ response }) => {
              if (response === 1) {
                shell.openExternal('mailto:support.gilnet.property.manager@gmail.com?subject=' +
                  encodeURIComponent('[GILNET SUPPORT] Desktop app help')).catch(log);
              }
            }).catch(log);
          },
        },
        {
          label: 'Email Support',
          click: () => {
            shell.openExternal('mailto:support.gilnet.property.manager@gmail.com?subject=' +
              encodeURIComponent('[GILNET SUPPORT] Desktop app help')).catch(log);
          },
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => { buildMenu(); createWindow(); }).catch((error) => {
  log(error);
  dialog.showErrorBox('Chaniche Lodge could not start', error.message);
  app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => app.quit());