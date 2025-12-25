const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

const scheduledJobs = {};
let scriptsDirectory = 'C:\\python';
let userDataPath = null;

// 사용자 데이터 경로 설정
function setUserDataPath(dataPath) {
  userDataPath = dataPath;
}

// 데이터 디렉토리 경로 가져오기
function getDataDir() {
  if (userDataPath) {
    return userDataPath;
  }
  // 폴백: 개발 환경
  return path.join(__dirname, '..', 'data');
}

// 예약 저장 파일 경로
function getSchedulesFilePath() {
  return path.join(getDataDir(), 'schedules.json');
}

// 예약 저장
function saveSchedules() {
  try {
    const schedulesPath = getSchedulesFilePath();
    const schedulesDir = path.dirname(schedulesPath);
    
    if (!fs.existsSync(schedulesDir)) {
      fs.mkdirSync(schedulesDir, { recursive: true });
    }
    
    const schedules = [];
    for (const [jobId, jobData] of Object.entries(scheduledJobs)) {
      // job이 유효한지 확인
      const schedule = require('node-schedule');
      if (schedule.scheduledJobs[jobId]) {
        schedules.push({
          jobId,
          scriptPath: jobData.scriptPath,
          scheduleData: jobData.scheduleData
        });
      }
    }
    
    fs.writeFileSync(schedulesPath, JSON.stringify(schedules, null, 2), 'utf-8');
  } catch (error) {
    console.error('예약 저장 실패:', error);
    // 에러를 throw하지 않고 로그만 남김 (예약 생성 자체는 성공할 수 있음)
  }
}

// 예약 불러오기
function loadSchedules() {
  try {
    const schedulesPath = getSchedulesFilePath();
    
    if (!fs.existsSync(schedulesPath)) {
      return;
    }
    
    const schedules = JSON.parse(fs.readFileSync(schedulesPath, 'utf-8'));
    const scheduleModule = require('node-schedule');
    
    for (const scheduleItem of schedules) {
      try {
        // 일회성 예약이면 과거 시간인지 확인
        if (!scheduleItem.scheduleData.repeat) {
          const scheduleDate = new Date(scheduleItem.scheduleData.scheduleTime);
          if (scheduleDate < new Date()) {
            // 이미 지난 일회성 예약은 건너뛰기
            continue;
          }
        }
        
        // 예약 재생성 (내부적으로 scheduleScriptExecution 호출)
        const { scheduleTime, repeat, daysOfWeek } = scheduleItem.scheduleData;
        const scriptPath = scheduleItem.scriptPath;
        
        let scheduleRule;
        
        if (repeat === 'daily') {
          const timeParts = scheduleTime.split(':');
          const hours = parseInt(timeParts[0]) || 0;
          const minutes = parseInt(timeParts[1]) || 0;
          scheduleRule = `${minutes} ${hours} * * *`;
        } else if (repeat === 'weekly') {
          const timeParts = scheduleTime.split(':');
          const hours = parseInt(timeParts[0]) || 0;
          const minutes = parseInt(timeParts[1]) || 0;
          
          if (daysOfWeek && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
            const daysStr = daysOfWeek.sort((a, b) => a - b).join(',');
            scheduleRule = `${minutes} ${hours} * * ${daysStr}`;
          } else {
            continue; // 요일이 없으면 건너뛰기
          }
        } else {
          const scheduleDate = new Date(scheduleTime);
          if (isNaN(scheduleDate.getTime())) {
            continue;
          }
          scheduleRule = scheduleDate;
        }
        
        // 원래 jobId 사용
        const jobId = scheduleItem.jobId;
        
        const job = scheduleModule.scheduleJob(jobId, scheduleRule, async () => {
          const logPath = path.join(getDataDir(), 'script_logs.txt');
          const logDir = path.dirname(logPath);
          if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
          }
          const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
          const logEntry = `\n[${timestamp}] ⏰ 예약된 스크립트 실행: ${path.basename(scriptPath)}\n`;
          fs.appendFileSync(logPath, logEntry, 'utf-8');
          
          try {
            await runPythonScript(scriptPath);
          } catch (error) {
            const errorLog = `[${timestamp}] ❌ 예약된 스크립트 실행 실패: ${error.message}\n`;
            fs.appendFileSync(logPath, errorLog, 'utf-8');
          }
          
          if (!repeat) {
            delete scheduledJobs[jobId];
            saveSchedules();
          }
        });
        
        if (job) {
          scheduledJobs[jobId] = { job, scriptPath, scheduleData: scheduleItem.scheduleData };
        }
      } catch (error) {
        console.error(`예약 불러오기 실패 (${scheduleItem.jobId}):`, error);
      }
    }
  } catch (error) {
    console.error('예약 파일 읽기 실패:', error);
  }
}

// 스크립트 디렉토리 설정
function setScriptsDirectory(dir) {
  scriptsDirectory = dir;
}

// Python 스크립트 실행
function runPythonScript(scriptPath, options = {}) {
  return new Promise((resolve, reject) => {
    const pythonPath = findPythonPath();
    if (!pythonPath) {
      reject(new Error('Python을 찾을 수 없습니다. Python을 설치해주세요.'));
      return;
    }

    const logPath = path.join(getDataDir(), 'script_logs.txt');
    const logDir = path.dirname(logPath);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logEntry = `\n[${timestamp}] ====== 스크립트 실행 시작: ${path.basename(scriptPath)} ======\n`;
    fs.appendFileSync(logPath, logEntry, 'utf-8');

    // Windows에서 UTF-8 인코딩을 위한 환경 변수 설정
    const env = { ...process.env };
    if (process.platform === 'win32') {
      env.PYTHONIOENCODING = 'utf-8';
      env.PYTHONUTF8 = '1';
    }
    
    const pythonProcess = spawn(pythonPath, [scriptPath], {
      cwd: path.dirname(scriptPath),
      shell: true,
      env: env
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      fs.appendFileSync(logPath, output, 'utf-8');
      
      if (options.onOutput) {
        options.onOutput(output);
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      fs.appendFileSync(logPath, error, 'utf-8');
      
      if (options.onError) {
        options.onError(error);
      }
    });

    pythonProcess.on('close', (code) => {
      const endLog = `\n[${timestamp}] ====== 스크립트 실행 종료 (코드: ${code}) ======\n\n`;
      fs.appendFileSync(logPath, endLog, 'utf-8');

      if (code === 0) {
        resolve({ success: true, stdout, code });
      } else {
        reject({ success: false, stderr, code });
      }
    });

    pythonProcess.on('error', (error) => {
      const errorLog = `\n[${timestamp}] 오류: ${error.message}\n\n`;
      fs.appendFileSync(logPath, errorLog, 'utf-8');
      reject(error);
    });
  });
}

// Python 경로 찾기
function findPythonPath() {
  const { execSync } = require('child_process');
  
  // Windows py launcher 사용 (가장 안정적)
  try {
    execSync('py --version', { stdio: 'ignore' });
    return 'py';
  } catch (e) {
    // py launcher가 없으면 계속
  }

  // PATH에서 python 찾기
  const pythonCommands = ['python', 'python3'];
  for (const pythonCmd of pythonCommands) {
    try {
      execSync(`${pythonCmd} --version`, { stdio: 'ignore' });
      return pythonCmd;
    } catch (e) {
      // 계속 시도
    }
  }

  // 직접 경로 확인
  const possiblePaths = [
    'C:\\Python\\python.exe',
    'C:\\Python3\\python.exe',
    'C:\\Python39\\python.exe',
    'C:\\Python310\\python.exe',
    'C:\\Python311\\python.exe',
    'C:\\Python312\\python.exe',
    process.env.LOCALAPPDATA + '\\Programs\\Python\\Python39\\python.exe',
    process.env.LOCALAPPDATA + '\\Programs\\Python\\Python310\\python.exe',
    process.env.LOCALAPPDATA + '\\Programs\\Python\\Python311\\python.exe',
    process.env.LOCALAPPDATA + '\\Programs\\Python\\Python312\\python.exe',
  ];

  for (const pythonPath of possiblePaths) {
    if (pythonPath && fs.existsSync(pythonPath)) {
      return pythonPath;
    }
  }

  // Program Files 확인
  const programFilesPaths = [
    process.env.PROGRAMFILES + '\\Python*\\python.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Python*\\python.exe',
  ];

  for (const pythonPath of programFilesPaths) {
    if (!pythonPath || !pythonPath.includes('*')) continue;
    const basePath = pythonPath.substring(0, pythonPath.indexOf('*'));
    try {
      if (fs.existsSync(basePath)) {
        const dirs = fs.readdirSync(basePath);
        for (const dir of dirs) {
          if (dir.startsWith('Python')) {
            const fullPath = path.join(basePath, dir, 'python.exe');
            if (fs.existsSync(fullPath)) {
              return fullPath;
            }
          }
        }
      }
    } catch (e) {
      // 무시
    }
  }

  return null;
}

// 스크립트 예약 실행
function scheduleScriptExecution(scriptPath, scheduleData) {
  const { scheduleTime, repeat, daysOfWeek } = scheduleData;
  const jobId = `job_${Date.now()}`;

  let scheduleRule;
  let job;

  try {
    if (repeat === 'daily') {
      const timeParts = scheduleTime.split(':');
      const hours = parseInt(timeParts[0]) || 0;
      const minutes = parseInt(timeParts[1]) || 0;
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('유효하지 않은 시간입니다. (00:00 ~ 23:59)');
      }
      
      scheduleRule = `${minutes} ${hours} * * *`;
    } else if (repeat === 'weekly') {
      const timeParts = scheduleTime.split(':');
      const hours = parseInt(timeParts[0]) || 0;
      const minutes = parseInt(timeParts[1]) || 0;
      
      if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new Error('유효하지 않은 시간입니다. (00:00 ~ 23:59)');
      }
      
      // 여러 요일 선택 시 쉼표로 구분된 cron 표현식 사용
      if (daysOfWeek && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
        const daysStr = daysOfWeek.sort((a, b) => a - b).join(',');
        scheduleRule = `${minutes} ${hours} * * ${daysStr}`;
      } else {
        throw new Error('요일을 선택해주세요.');
      }
    } else {
      // 일회성 예약
      const scheduleDate = new Date(scheduleTime);
      if (isNaN(scheduleDate.getTime())) {
        throw new Error('잘못된 날짜 형식입니다.');
      }
      
      // 과거 날짜인지 확인
      if (scheduleDate < new Date()) {
        throw new Error('과거 날짜는 설정할 수 없습니다.');
      }
      
      scheduleRule = scheduleDate;
    }

    // node-schedule 모듈 명시적으로 가져오기
    const scheduleModule = require('node-schedule');
    
    job = scheduleModule.scheduleJob(jobId, scheduleRule, async () => {
      const logPath = path.join(getDataDir(), 'script_logs.txt');
      const logDir = path.dirname(logPath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const logEntry = `\n[${timestamp}] ⏰ 예약된 스크립트 실행: ${path.basename(scriptPath)}\n`;
      fs.appendFileSync(logPath, logEntry, 'utf-8');

      try {
        await runPythonScript(scriptPath);
      } catch (error) {
        const errorLog = `[${timestamp}] ❌ 예약된 스크립트 실행 실패: ${error.message}\n`;
        fs.appendFileSync(logPath, errorLog, 'utf-8');
      }

      if (!repeat) {
        delete scheduledJobs[jobId];
        saveSchedules(); // 일회성 예약 완료 후 저장
      }
    });

    if (!job) {
      throw new Error(`예약 설정에 실패했습니다. (규칙: ${scheduleRule})`);
    }
  } catch (error) {
    // 에러를 다시 throw하여 상세한 메시지 전달
    throw error;
  }

  scheduledJobs[jobId] = { job, scriptPath, scheduleData };
  
  // 예약 저장
  saveSchedules();
  
  const logPath = path.join(getDataDir(), 'script_logs.txt');
  const logDir = path.dirname(logPath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  // 로그 메시지 생성
  let logMessage = `[${timestamp}] 📅 예약 설정 완료: ${path.basename(scriptPath)} - ${scheduleTime}`;
  if (repeat === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayNamesText = daysOfWeek.map(d => dayNames[d]).join(', ');
    logMessage += ` (매주 ${dayNamesText})`;
  } else if (repeat === 'daily') {
    logMessage += ' (매일)';
  } else {
    logMessage += ' (일회성)';
  }
  logMessage += '\n';
  
  fs.appendFileSync(logPath, logMessage, 'utf-8');

  return jobId;
}

// 스크립트 디렉토리의 스크립트 목록 가져오기
function getPythonScripts() {
  const scripts = [];

  if (!fs.existsSync(scriptsDirectory)) {
    return scripts;
  }

  try {
    const files = fs.readdirSync(scriptsDirectory);
    for (const file of files) {
      if (file.endsWith('.py')) {
        const filePath = path.join(scriptsDirectory, file);
        const stats = fs.statSync(filePath);
        scripts.push({
          name: file,
          path: filePath,
          size: stats.size,
          modified: stats.mtime
        });
      }
    }
  } catch (error) {
    console.error('스크립트 목록 가져오기 실패:', error);
  }

  return scripts;
}

// 스크립트 내용 읽기
function readScriptContent(scriptPath) {
  try {
    return fs.readFileSync(scriptPath, 'utf-8');
  } catch (error) {
    throw new Error(`스크립트 읽기 실패: ${error.message}`);
  }
}

module.exports = {
  runPythonScript,
  scheduleScriptExecution,
  scheduledJobs,
  getPythonScripts,
  readScriptContent,
  findPythonPath,
  setScriptsDirectory,
  saveSchedules,
  loadSchedules,
  setUserDataPath
};

