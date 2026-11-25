'use strict';

const path = require('node:path');
const { app, BrowserWindow, dialog, shell } = require('electron');

app.setName('PCPilot');

const projectRoot = () => (app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..'));
let backendStartup;
let backendHandle;
let mainWindow;
let localOrigin;
let healthTimer;
let shuttingDown = false;
let fatalErrorShown = false;

function loadLocalConfiguration() {
  const configPath = app.isPackaged
    ? path.join(app.getPath('userData'), '.env')
    : path.join(projectRoot(), '.env');
  process.env.PCPILOT_ENV_FILE = configPath;
  require('dotenv').config({ path: configPath });
  if (app.isPackaged && !process.env.GROQ_API_KEY) {
    console.info(`Groq is not configured. Add GROQ_API_KEY to ${configPath} to enable AI chat.`);
  }
}

async function startBackend() {
  const backend = require(path.join(projectRoot(), 'backend', 'server.js'));
  return backend.start({ host: '127.0.0.1', port: 0 });
}

async function waitForBackend(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) return;
      lastError = new Error(`Backend health check returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error(`The local backend did not become ready: ${lastError?.message || 'timed out'}`);
}

function openValidatedExternalUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname) {
      return;
    }
    shell.openExternal(url.toString()).catch((error) => {
      console.error(`Could not open external link: ${error.message}`);
    });
  } catch (_error) {
    // Ignore malformed navigation requests.
  }
}

function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: 'PCPilot',
    icon: path.join(projectRoot(), 'build', 'icon.svg'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openValidatedExternalUrl(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (new URL(url).origin === localOrigin) return;
    event.preventDefault();
    openValidatedExternalUrl(url);
  });
  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.webContents.once('did-finish-load', () => {
    console.info('PCPilot frontend loaded successfully.');
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, description, _url, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      void reportBackendFailure(new Error(`The PCPilot window could not load: ${description}`));
    }
  });

  void mainWindow.loadURL(`${localOrigin}/`).catch((error) => {
    void reportBackendFailure(new Error(`The PCPilot window could not load: ${error.message}`));
  });
  return mainWindow;
}

async function closeBackend() {
  if (!backendHandle && backendStartup) {
    try {
      backendHandle = await backendStartup;
    } catch (_error) {
      return;
    }
  }
  if (backendHandle) {
    const handle = backendHandle;
    backendHandle = null;
    await handle.close();
  }
}

async function reportBackendFailure(error) {
  if (fatalErrorShown || shuttingDown) return;
  fatalErrorShown = true;
  console.error(error);
  if (healthTimer) clearInterval(healthTimer);
  try {
    await closeBackend();
  } catch (closeError) {
    console.error(`Backend cleanup failed: ${closeError.message}`);
  }
  dialog.showErrorBox('PCPilot backend stopped', `${error.message}\n\nPCPilot will now close.`);
  app.quit();
}

function monitorBackend() {
  healthTimer = setInterval(async () => {
    if (shuttingDown) return;
    try {
      const response = await fetch(`${localOrigin}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      if (!response.ok) throw new Error(`Health check returned HTTP ${response.status}`);
    } catch (error) {
      await reportBackendFailure(new Error(`The local backend is no longer available: ${error.message}`));
    }
  }, 4000);
  healthTimer.unref();
}

app.whenReady().then(async () => {
  loadLocalConfiguration();
  backendStartup = startBackend();
  backendHandle = await backendStartup;
  localOrigin = `http://${backendHandle.host}:${backendHandle.port}`;
  await waitForBackend(localOrigin);
  createWindow();
  monitorBackend();
}).catch((error) => {
  console.error(`PCPilot startup failed: ${error.stack || error.message}`);
  dialog.showErrorBox(
    'PCPilot could not start',
    `${error.message}\n\nCheck the application logs and your local configuration, then try again.`,
  );
  void closeBackend().finally(() => app.quit());
});

app.on('activate', () => {
  if (localOrigin && BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', (event) => {
  if (shuttingDown) return;
  event.preventDefault();
  shuttingDown = true;
  if (healthTimer) clearInterval(healthTimer);
  void closeBackend()
    .catch((error) => console.error(`PCPilot shutdown failed: ${error.message}`))
    .finally(() => app.quit());
});
