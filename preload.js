const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Python 스크립트 관련
  getPythonScripts: () => ipcRenderer.invoke('get-python-scripts'),
  readScriptContent: (scriptPath) => ipcRenderer.invoke('read-script-content', scriptPath),
  runPythonScript: (scriptPath) => ipcRenderer.invoke('run-python-script', scriptPath),
  
  // 경로 설정 관련
  getScriptsDirectory: () => ipcRenderer.invoke('get-scripts-directory'),
  setScriptsDirectory: (directory) => ipcRenderer.invoke('set-scripts-directory', directory),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  
  // 파일 열기 관련
  openInExplorer: (filePath) => ipcRenderer.invoke('open-in-explorer', filePath),
  openInVSCode: (filePath) => ipcRenderer.invoke('open-in-vscode', filePath),
  
  // 예약 관련
  scheduleScriptExecution: (scheduleData) => ipcRenderer.invoke('schedule-script-execution', scheduleData),
  cancelSchedule: (jobId) => ipcRenderer.invoke('cancel-schedule', jobId),
  getScheduledJobs: () => ipcRenderer.invoke('get-scheduled-jobs'),
  
  // 로그 관련
  readLog: () => ipcRenderer.invoke('read-log'),
  clearLog: () => ipcRenderer.invoke('clear-log'),
  
  // 아이콘 경로 가져오기
  getIconPath: () => ipcRenderer.invoke('get-icon-path'),
  
  // 라이브러리 관련
  extractRequiredLibraries: (scriptContent) => ipcRenderer.invoke('extract-required-libraries', scriptContent),
  installLibraries: (libraries) => ipcRenderer.invoke('install-libraries', libraries)
});
