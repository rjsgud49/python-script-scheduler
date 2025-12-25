const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { 
  runPythonScript, 
  scheduleScriptExecution, 
  scheduledJobs,
  getPythonScripts,
  readScriptContent,
  setScriptsDirectory,
  loadSchedules,
  setUserDataPath
} = require('./scripts/python-runner');

let mainWindow;
let tray = null;

function createWindow() {
  const { nativeImage } = require('electron');
  
  // 테스트/개발 모드 확인
  const isTestMode = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  
  // 아이콘 경로 설정 (asset/icon.JPG 우선)
  let iconPath = path.join(__dirname, 'asset', 'icon.JPG');
  let windowIcon = null;
  
  if (fs.existsSync(iconPath)) {
    windowIcon = nativeImage.createFromPath(iconPath);
  } else {
    // 대체 경로들 확인
    const alternativePaths = [
      path.join(__dirname, 'build', 'icon.ico'),
      path.join(__dirname, 'build', 'icon.png'),
      path.join(__dirname, 'resources', 'icon.ico')
    ];
    
    for (const altPath of alternativePaths) {
      if (fs.existsSync(altPath)) {
        windowIcon = nativeImage.createFromPath(altPath);
        break;
      }
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // 테스트 모드에서 디버깅 활성화
      devTools: isTestMode
    },
    backgroundColor: '#1e1e1e',
    icon: windowIcon || undefined
  });

  mainWindow.loadFile('renderer/index.html');
  
  // 창을 닫을 때 실제로 닫지 않고 숨기기
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      
      // 트레이가 없으면 생성
      if (!tray) {
        createTray();
      }
    }
  });
  
  // 테스트/개발 모드에서 개발자 도구 자동 열기
  if (isTestMode) {
    mainWindow.webContents.openDevTools();
    console.log('🧪 테스트 모드로 실행 중...');
    console.log('📊 개발자 도구가 자동으로 열렸습니다.');
  }
}

// 시스템 트레이 생성
function createTray() {
  const { nativeImage } = require('electron');
  
  // 트레이 아이콘 경로 찾기 (asset/icon.JPG 우선)
  let iconPath = null;
  let trayIcon = null;
  
  // asset/icon.JPG 우선 확인
  const assetIconPath = path.join(__dirname, 'asset', 'icon.JPG');
  if (fs.existsSync(assetIconPath)) {
    try {
      trayIcon = nativeImage.createFromPath(assetIconPath);
      // Windows 트레이 아이콘은 16x16 또는 32x32 크기가 권장됨
      if (process.platform === 'win32') {
        trayIcon = trayIcon.resize({ width: 16, height: 16 });
      }
    } catch (e) {
      console.warn('asset/icon.JPG 로드 실패:', e);
    }
  }
  
  // asset/icon.JPG가 없거나 로드 실패 시 다른 경로 탐색
  if (!trayIcon || trayIcon.isEmpty()) {
    if (process.platform === 'win32') {
      // Windows: .ico 파일 우선 탐색 (여러 경로 확인)
      const possiblePaths = [
        path.join(__dirname, 'build', 'icon.ico'),
        path.join(__dirname, 'resources', 'icon.ico'),
        path.join(process.resourcesPath, 'build', 'icon.ico'),
        path.join(process.resourcesPath, 'icon.ico')
      ];
      
      for (const possiblePath of possiblePaths) {
        if (fs.existsSync(possiblePath)) {
          iconPath = possiblePath;
          break;
        }
      }
    } else {
      // macOS/Linux: .png 파일
      iconPath = path.join(__dirname, 'build', 'icon.png');
      if (!fs.existsSync(iconPath)) {
        iconPath = null;
      }
    }
  }
  
  // 아이콘 생성
  try {
    if (trayIcon && !trayIcon.isEmpty()) {
      // asset/icon.JPG가 성공적으로 로드된 경우 사용
      tray = new Tray(trayIcon);
    } else if (iconPath && fs.existsSync(iconPath)) {
      // .ico 파일이 있으면 사용
      tray = new Tray(iconPath);
    } else {
      // 아이콘이 없으면 기본 아이콘 생성 (16x16 크기)
      // Windows 권장 크기: 16x16, 32x32
      const iconSvg = '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" fill="#0078d4"/><text x="8" y="12" font-family="Arial" font-size="10" fill="white" text-anchor="middle">P</text></svg>';
      const svgBase64 = Buffer.from(iconSvg).toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      
      let defaultIcon = nativeImage.createFromDataURL(dataUrl);
      
      // SVG가 작동하지 않으면 빈 이미지로 16x16 PNG 생성
      if (!defaultIcon || defaultIcon.isEmpty()) {
        // 16x16 크기의 파란색 아이콘을 Buffer로 직접 생성
        // PNG 형식: 간단한 16x16 파란색 사각형
        const size = 16;
        const buffer = Buffer.alloc(size * size * 4); // RGBA
        
        for (let i = 0; i < size * size; i++) {
          const offset = i * 4;
          // 파란색 (#0078d4 = RGB(0, 120, 212))
          buffer[offset] = 0;     // R
          buffer[offset + 1] = 120; // G
          buffer[offset + 2] = 212; // B
          buffer[offset + 3] = 255; // A (불투명)
        }
        
        defaultIcon = nativeImage.createFromBuffer(buffer, { width: size, height: size });
      }
      
      // 16x16 크기로 리사이즈 (Windows 권장 크기)
      if (defaultIcon && !defaultIcon.isEmpty()) {
        defaultIcon = defaultIcon.resize({ width: 16, height: 16 });
        tray = new Tray(defaultIcon);
      } else {
        // 최후의 수단: 빈 아이콘
        console.warn('트레이 아이콘을 생성할 수 없습니다. 빈 아이콘을 사용합니다.');
        const emptyIcon = nativeImage.createEmpty();
        tray = new Tray(emptyIcon);
      }
    }
  } catch (e) {
    console.error('트레이 아이콘 생성 실패:', e);
    // 에러 발생 시 기본 아이콘 재시도
    try {
      const iconSvg = '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><rect width="16" height="16" fill="#0078d4"/></svg>';
      const svgBase64 = Buffer.from(iconSvg).toString('base64');
      const dataUrl = `data:image/svg+xml;base64,${svgBase64}`;
      const fallbackIcon = nativeImage.createFromDataURL(dataUrl);
      if (fallbackIcon && !fallbackIcon.isEmpty()) {
        tray = new Tray(fallbackIcon.resize({ width: 16, height: 16 }));
      } else {
        const emptyIcon = nativeImage.createEmpty();
        tray = new Tray(emptyIcon);
      }
    } catch (fallbackError) {
      console.error('폴백 아이콘 생성도 실패:', fallbackError);
      const emptyIcon = nativeImage.createEmpty();
      tray = new Tray(emptyIcon);
    }
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '애플리케이션 열기',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: '종료',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setToolTip('Python Script Runner - 백그라운드에서 실행 중');
  tray.setContextMenu(contextMenu);
  
  // 트레이 아이콘 클릭 시 창 표시
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });
}

app.whenReady().then(() => {
  // 메뉴 바 제거 (파일, 편집, 보기, 윈도우, 도움말)
  Menu.setApplicationMenu(null);
  
  // 사용자 데이터 디렉토리 설정 (app.asar 밖에 저장)
  const userDataDir = app.getPath('userData');
  const dataDir = path.join(userDataDir, 'data');
  
  // data 디렉토리 생성
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // python-runner에 데이터 경로 설정
  setUserDataPath(dataDir);
  
  // 저장된 예약 불러오기
  loadSchedules();
  
  // 트레이 생성
  createTray();
  
  // 창 생성
  createWindow();
});

// 모든 창이 닫혀도 앱을 종료하지 않음 (백그라운드 실행)
app.on('window-all-closed', (event) => {
  // macOS가 아니면 창을 숨기기만 함 (종료하지 않음)
  if (process.platform !== 'darwin') {
    // app.quit()을 호출하지 않음 - 백그라운드에서 계속 실행
    if (mainWindow) {
      mainWindow.hide();
    }
    if (!tray) {
      createTray();
    }
  }
});

app.on('activate', () => {
  // macOS에서 독 아이콘 클릭 시
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    // 창이 있으면 표시
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  }
});

// 앱 종료 전 처리
app.on('before-quit', () => {
  app.isQuitting = true;
});

// Python 스크립트 목록 가져오기
ipcMain.handle('get-python-scripts', async () => {
  try {
    // 설정에서 경로 가져오기
    const configPath = path.join(__dirname, 'data', 'config.json');
    let scriptsDir = 'C:\\python';
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      scriptsDir = config.scriptsDirectory || 'C:\\python';
    }
    setScriptsDirectory(scriptsDir);
    return getPythonScripts();
  } catch (error) {
    return [];
  }
});

// 스크립트 내용 읽기
ipcMain.handle('read-script-content', async (event, scriptPath) => {
  try {
    return readScriptContent(scriptPath);
  } catch (error) {
    throw new Error(error.message);
  }
});

// Python 스크립트 실행
ipcMain.handle('run-python-script', async (event, scriptPath) => {
  try {
    const result = await runPythonScript(scriptPath, {
      onOutput: (output) => {
        // 실시간 출력은 로그 파일에 기록됨
      },
      onError: (error) => {
        // 실시간 에러는 로그 파일에 기록됨
      }
    });
    return result;
  } catch (error) {
    throw error;
  }
});

// 스크립트 예약 실행
ipcMain.handle('schedule-script-execution', async (event, scheduleData) => {
  try {
    // 필수 필드 검증
    if (!scheduleData.scriptPath) {
      return { success: false, error: '스크립트 경로가 필요합니다.' };
    }
    if (!scheduleData.scheduleTime) {
      return { success: false, error: '예약 시간이 필요합니다.' };
    }
    
    const jobId = await scheduleScriptExecution(scheduleData.scriptPath, scheduleData);
    return { success: true, jobId };
  } catch (error) {
    console.error('예약 설정 오류:', error);
    return { success: false, error: error.message || '예약 설정에 실패했습니다.' };
  }
});

// 예약 취소
ipcMain.handle('cancel-schedule', async (event, jobId) => {
  try {
    const schedule = require('node-schedule');
    const job = schedule.scheduledJobs[jobId];
    if (job) {
      job.cancel();
      if (scheduledJobs[jobId]) {
        delete scheduledJobs[jobId];
      }
      // 예약 저장
      const { saveSchedules } = require('./scripts/python-runner');
      saveSchedules();
      return { success: true };
    }
    return { success: false, error: '예약을 찾을 수 없습니다.' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 예약 목록 가져오기
ipcMain.handle('get-scheduled-jobs', async () => {
  try {
    const schedule = require('node-schedule');
    const jobs = [];
    
    for (const [jobId, jobData] of Object.entries(scheduledJobs)) {
      const job = schedule.scheduledJobs[jobId];
      if (job) {
        jobs.push({
          id: jobId,
          scriptPath: jobData.scriptPath,
          scheduleData: jobData.scheduleData,
          nextInvocation: job.nextInvocation() ? job.nextInvocation().toISOString() : null
        });
      }
    }
    
    return { success: true, jobs };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 로그 파일 읽기
ipcMain.handle('read-log', async () => {
  try {
    const userDataDir = app.getPath('userData');
    const logPath = path.join(userDataDir, 'data', 'script_logs.txt');
    
    if (fs.existsSync(logPath)) {
      const data = fs.readFileSync(logPath, 'utf-8');
      return { success: true, log: data };
    }
    
    return { success: true, log: '' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 로그 지우기
ipcMain.handle('clear-log', async () => {
  try {
    const userDataDir = app.getPath('userData');
    const logPath = path.join(userDataDir, 'data', 'script_logs.txt');
    
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(logPath, '', 'utf-8');
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 스크립트 디렉토리 설정 가져오기
ipcMain.handle('get-scripts-directory', async () => {
  try {
    const userDataDir = app.getPath('userData');
    const configPath = path.join(userDataDir, 'data', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return config.scriptsDirectory || 'C:\\python';
    }
    return 'C:\\python';
  } catch (error) {
    return 'C:\\python';
  }
});

// 스크립트 디렉토리 설정 저장
ipcMain.handle('set-scripts-directory', async (event, directory) => {
  try {
    const userDataDir = app.getPath('userData');
    const configPath = path.join(userDataDir, 'data', 'config.json');
    const configDir = path.dirname(configPath);
    
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    let config = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    
    config.scriptsDirectory = directory;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    // python-runner에 경로 설정
    setScriptsDirectory(directory);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 폴더 선택 다이얼로그
ipcMain.handle('select-directory', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '스크립트 폴더 선택'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, path: result.filePaths[0] };
    }
    
    return { success: false, canceled: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 파일 탐색기에서 열기
ipcMain.handle('open-in-explorer', async (event, filePath) => {
  try {
    // Electron의 shell.showItemInFolder 사용 (가장 안정적)
    await shell.showItemInFolder(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// VSCode로 열기
ipcMain.handle('open-in-vscode', async (event, filePath) => {
  return new Promise((resolve) => {
    try {
      // 파일 경로를 따옴표로 감싸서 공백이나 특수문자 처리
      const command = `code "${filePath}"`;
      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.error('VSCode 열기 실패:', error);
          resolve({ 
            success: false, 
            error: 'VSCode를 찾을 수 없습니다. VSCode가 설치되어 있고 PATH에 추가되어 있는지 확인하세요.' 
          });
        } else {
          resolve({ success: true });
        }
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});

// 아이콘 경로 가져오기
ipcMain.handle('get-icon-path', async () => {
  try {
    const iconPath = path.join(__dirname, 'asset', 'icon.JPG');
    if (fs.existsSync(iconPath)) {
      // file:// 프로토콜로 변환하여 반환
      return `file://${iconPath.replace(/\\/g, '/')}`;
    }
    return null;
  } catch (error) {
    return null;
  }
});

// Python 스크립트에서 필요한 라이브러리 추출
ipcMain.handle('extract-required-libraries', async (event, scriptContent) => {
  try {
    const libraries = [];
    const lines = scriptContent.split('\n');
    
    // 표준 라이브러리는 제외할 목록
    const standardLibrary = new Set([
      'os', 'sys', 'json', 'datetime', 'time', 'random', 'math', 're', 'collections',
      'itertools', 'functools', 'operator', 'string', 'array', 'copy', 'pickle',
      'sqlite3', 'hashlib', 'hmac', 'base64', 'uuid', 'urllib', 'http', 'email',
      'html', 'xml', 'csv', 'configparser', 'logging', 'argparse', 'getopt',
      'shutil', 'glob', 'fnmatch', 'linecache', 'tempfile', 'gzip', 'zipfile',
      'tarfile', 'pathlib', 'io', 'codecs', 'locale', 'gettext', 'unicodedata',
      'stringprep', 'readline', 'rlcompleter', 'struct', 'codecs', 'types',
      'copyreg', 'pprint', 'reprlib', 'enum', 'numbers', 'statistics', 'decimal',
      'fractions', 'cmath', 'array', 'memoryview', 'weakref', 'gc', 'inspect',
      'site', 'fpectl', 'atexit', 'traceback', 'future_builtins', 'warnings',
      'contextlib', 'abc', 'atexit', 'trace', 'tracemalloc', 'dis', 'pdb',
      'profile', 'pstats', 'timeit', 'doctest', 'unittest', '2to3', 'test',
      'lib2to3', 'distutils', 'ensurepip', 'venv', 'zipapp', 'faulthandler',
      'pdb', 'cProfile', 'profile', 'pstats', 'timeit', 'doctest', 'unittest',
      'test', 'lib2to3', 'distutils', 'ensurepip', 'venv', 'zipapp', 'faulthandler'
    ]);
    
    for (const line of lines) {
      // import 문 파싱
      const importMatch = line.match(/^import\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)/);
      if (importMatch) {
        const module = importMatch[1].split('.')[0]; // 첫 번째 부분만 (예: selenium.webdriver -> selenium)
        if (!standardLibrary.has(module)) {
          libraries.push(module);
        }
        continue;
      }
      
      // from ... import 문 파싱
      const fromMatch = line.match(/^from\s+([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\s+import/);
      if (fromMatch) {
        const module = fromMatch[1].split('.')[0];
        if (!standardLibrary.has(module)) {
          libraries.push(module);
        }
        continue;
      }
    }
    
    // 중복 제거 및 정렬
    const uniqueLibraries = [...new Set(libraries)].sort();
    
    return { success: true, libraries: uniqueLibraries };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 라이브러리 설치
ipcMain.handle('install-libraries', async (event, libraries) => {
  return new Promise((resolve) => {
    try {
      if (!libraries || libraries.length === 0) {
        resolve({ success: false, error: '설치할 라이브러리가 없습니다.' });
        return;
      }
      
      // pip install 명령어 생성
      const librariesStr = libraries.join(' ');
      const command = `pip install ${librariesStr}`;
      
      console.log('라이브러리 설치 명령어:', command);
      
      exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
        if (error) {
          console.error('라이브러리 설치 실패:', error);
          resolve({ 
            success: false, 
            error: `라이브러리 설치에 실패했습니다: ${error.message}`,
            stderr: stderr
          });
        } else {
          console.log('라이브러리 설치 성공:', stdout);
          resolve({ 
            success: true, 
            message: '라이브러리가 성공적으로 설치되었습니다.',
            output: stdout
          });
        }
      });
    } catch (error) {
      resolve({ success: false, error: error.message });
    }
  });
});
