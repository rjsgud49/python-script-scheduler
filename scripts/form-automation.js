const puppeteer = require('puppeteer-core');
const schedule = require('node-schedule');
const path = require('path');
const fs = require('fs');

let browser = null;
const scheduledJobs = {};

// Chrome 실행 파일 경로 찾기
function findChromePath() {
  const possiblePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env['PROGRAMFILES(X86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  
  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      return chromePath;
    }
  }
  
  throw new Error('Chrome을 찾을 수 없습니다. Chrome을 설치해주세요.');
}

// 로그 기록
function logMessage(message) {
  const logPath = path.join(__dirname, '..', 'data', 'submission_log.txt');
  const logDir = path.dirname(logPath);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logEntry = `[${timestamp}] ${message}\n`;
  
  fs.appendFileSync(logPath, logEntry, 'utf-8');
  console.log(message);
}

// 폼 자동 제출
async function submitForm(formData) {
  const { formUrl, fields, options = {} } = formData;
  
  try {
    logMessage('🚀 자동 제출 시작');
    
    if (!browser) {
      const chromePath = findChromePath();
      browser = await puppeteer.launch({
        executablePath: chromePath,
        headless: options.headless !== false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    }
    
    const page = await browser.newPage();
    await page.goto(formUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    logMessage('📄 폼 페이지 로드 완료');
    
    // 각 필드 처리
    for (const field of fields) {
      try {
        await handleField(page, field);
        logMessage(`✅ ${field.label || field.type} 처리 완료`);
      } catch (error) {
        logMessage(`⚠️ ${field.label || field.type} 처리 실패: ${error.message}`);
      }
    }
    
    // 제출 버튼 클릭
    try {
      // 여러 방법으로 제출 버튼 찾기
      const submitSelectors = [
        'span:has-text("제출")',
        'button[type="submit"]',
        'div[role="button"]:has-text("제출")',
        '//span[contains(text(),"제출")]',
        '//button[contains(text(),"제출")]'
      ];
      
      let submitted = false;
      for (const selector of submitSelectors) {
        try {
          if (selector.startsWith('//')) {
            // XPath
            await page.waitForXPath(selector, { timeout: 3000 });
            const [button] = await page.$x(selector);
            if (button) {
              await button.click();
              submitted = true;
              break;
            }
          } else {
            // CSS 선택자
            await page.waitForSelector(selector, { timeout: 3000 });
            await page.click(selector);
            submitted = true;
            break;
          }
        } catch (e) {
          continue;
        }
      }
      
      if (submitted) {
        logMessage('🎯 제출 완료!');
        await page.waitForTimeout(2000);
      } else {
        logMessage('⚠️ 제출 버튼을 찾을 수 없습니다.');
      }
    } catch (error) {
      logMessage('⚠️ 제출 버튼 찾기 실패: ' + error.message);
    }
    
    await page.close();
    logMessage('✅ 완료!');
    
    return { success: true };
  } catch (error) {
    logMessage(`❌ 오류: ${error.message}`);
    throw error;
  }
}

// 필드 처리
async function handleField(page, field) {
  const { type, selector, value, action } = field;
  
  switch (type) {
    case 'radio':
      if (selector.startsWith('//')) {
        // XPath
        await page.waitForXPath(selector, { timeout: 10000 });
        const [element] = await page.$x(selector);
        if (element) {
          await element.click();
        }
      } else {
        // CSS 선택자
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.click(selector);
      }
      break;
      
    case 'checkbox':
      const checkboxes = Array.isArray(value) ? value : [value];
      for (const checkboxValue of checkboxes) {
        let checkboxSelector = selector;
        
        // {value} 플레이스홀더 교체
        if (selector.includes('{value}')) {
          checkboxSelector = selector.replace('{value}', checkboxValue);
        }
        
        try {
          if (checkboxSelector.startsWith('//')) {
            // XPath
            await page.waitForXPath(checkboxSelector, { timeout: 5000 });
            const [element] = await page.$x(checkboxSelector);
            if (element) {
              await element.click();
            }
          } else {
            // CSS 선택자
            await page.waitForSelector(checkboxSelector, { timeout: 5000 });
            await page.click(checkboxSelector);
          }
        } catch (e) {
          // 체크박스를 찾지 못한 경우 계속 진행
          logMessage(`⚠️ 체크박스 '${checkboxValue}' 찾기 실패`);
        }
      }
      break;
      
    case 'text':
    case 'textarea':
      if (selector.startsWith('//')) {
        await page.waitForXPath(selector, { timeout: 10000 });
        const [element] = await page.$x(selector);
        if (element) {
          await element.type(value, { delay: 50 });
        }
      } else {
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.type(selector, value, { delay: 50 });
      }
      break;
      
    case 'date':
      if (selector.startsWith('//')) {
        await page.waitForXPath(selector, { timeout: 10000 });
        const [element] = await page.$x(selector);
        if (element) {
          await element.type(value);
        }
      } else {
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.type(selector, value);
      }
      break;
      
    case 'select':
      await page.waitForSelector(selector, { timeout: 10000 });
      await page.select(selector, value);
      break;
      
    case 'click':
      if (selector.startsWith('//')) {
        await page.waitForXPath(selector, { timeout: 10000 });
        const [element] = await page.$x(selector);
        if (element) {
          await element.click();
        }
      } else {
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.click(selector);
      }
      break;
      
    default:
      throw new Error(`지원하지 않는 필드 타입: ${type}`);
  }
}

// 예약 제출
async function scheduleFormSubmission(scheduleData) {
  const { formData, scheduleTime, repeat } = scheduleData;
  
  const jobId = `job_${Date.now()}`;
  
  let scheduleRule;
  
  if (repeat === 'daily') {
    // 매일 특정 시간
    const timeParts = scheduleTime.split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    scheduleRule = `${minutes} ${hours} * * *`;
  } else if (repeat === 'weekly') {
    // 매주 특정 요일, 특정 시간
    const timeParts = scheduleTime.split(':');
    const hours = parseInt(timeParts[0]) || 0;
    const minutes = parseInt(timeParts[1]) || 0;
    const dayOfWeek = scheduleData.dayOfWeek !== undefined ? scheduleData.dayOfWeek : 0;
    scheduleRule = `${minutes} ${hours} * * ${dayOfWeek}`;
  } else {
    // 일회성 예약
    const scheduleDate = new Date(scheduleTime);
    if (isNaN(scheduleDate.getTime())) {
      throw new Error('잘못된 날짜 형식입니다.');
    }
    scheduleRule = scheduleDate;
  }
  
  const job = schedule.scheduleJob(jobId, scheduleRule, async () => {
    logMessage(`⏰ 예약된 제출 시작: ${jobId}`);
    try {
      await submitForm(formData);
    } catch (error) {
      logMessage(`❌ 예약된 제출 실패: ${error.message}`);
    }
    
    // 일회성 예약이면 제거
    if (!repeat) {
      delete scheduledJobs[jobId];
    }
  });
  
  if (!job) {
    throw new Error('예약 설정에 실패했습니다.');
  }
  
  scheduledJobs[jobId] = job;
  logMessage(`📅 예약 설정 완료: ${jobId} - ${scheduleTime} (반복: ${repeat || '없음'})`);
  
  return jobId;
}

module.exports = {
  submitForm,
  scheduleFormSubmission,
  scheduledJobs
};

