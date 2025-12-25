let currentScript = null;
let scripts = [];

// 파비콘 설정
async function setFavicon() {
  try {
    const iconPath = await window.electronAPI.getIconPath();
    if (iconPath) {
      const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
      link.type = 'image/jpeg';
      link.rel = 'shortcut icon';
      link.href = iconPath;
      document.getElementsByTagName('head')[0].appendChild(link);
    }
  } catch (error) {
    console.error('파비콘 설정 실패:', error);
  }
}

// 페이지 로드 시 파비콘 설정
setFavicon();

// 사이드바 네비게이션
document.querySelectorAll('.sidebar-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    
    // 사이드바 활성화
    document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    // 뷰 전환
    document.querySelectorAll('.editor-content').forEach(v => v.style.display = 'none');
    document.getElementById(`${view}-view`).style.display = 'block';
    
    // 뷰별 초기화
    if (view === 'scripts') {
      loadScripts();
    } else if (view === 'schedule') {
      loadSchedules();
    } else if (view === 'logs') {
      loadLogs();
    }
  });
});

// 스크립트 목록 불러오기
async function loadScripts() {
  try {
    // 현재 경로 표시
    const currentPath = await window.electronAPI.getScriptsDirectory();
    document.getElementById('current-directory-path').textContent = currentPath;
    
    scripts = await window.electronAPI.getPythonScripts();
    displayScripts();
    updateScheduleScriptSelect();
  } catch (error) {
    console.error('스크립트 목록 불러오기 실패:', error);
  }
}

// 스크립트 목록 표시
function displayScripts() {
  const list = document.getElementById('scripts-list');
  
  if (scripts.length === 0) {
    const currentPath = document.getElementById('current-directory-path').textContent;
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-text">${currentPath} 폴더에 Python 스크립트가 없습니다.</div></div>`;
    return;
  }
  
  list.innerHTML = scripts.map((script, index) => {
    const modified = new Date(script.modified).toLocaleString('ko-KR');
    // 경로를 이스케이프하여 안전하게 처리
    const escapedPath = script.path.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    return `
      <div class="script-item" data-path="${escapedPath}" data-index="${index}">
        <div style="flex: 1;">
          <div class="script-name">${script.name}</div>
          <div class="script-info">수정: ${modified} | 크기: ${(script.size / 1024).toFixed(2)} KB</div>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-secondary script-explorer-btn" style="font-size: 11px; padding: 4px 8px;" data-path="${escapedPath}" title="파일 탐색기에서 열기">
            📂
          </button>
          <button class="btn btn-secondary script-vscode-btn" style="font-size: 11px; padding: 4px 8px;" data-path="${escapedPath}" title="VSCode로 열기">
            💻
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  // 스크립트 클릭 이벤트 (파일명 부분만 클릭 가능하도록)
  document.querySelectorAll('.script-item').forEach(item => {
    const nameDiv = item.querySelector('.script-name').parentElement;
    nameDiv.style.cursor = 'pointer';
    nameDiv.addEventListener('click', async (e) => {
      e.stopPropagation();
      document.querySelectorAll('.script-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const scriptPath = item.dataset.path;
      await loadScriptDetail(scriptPath);
    });
  });
  
  // 파일 탐색기 버튼 이벤트
  document.querySelectorAll('.script-explorer-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const filePath = btn.dataset.path;
      await window.openInExplorer(filePath);
    });
  });
  
  // VSCode 버튼 이벤트
  document.querySelectorAll('.script-vscode-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const filePath = btn.dataset.path;
      await window.openInVSCode(filePath);
    });
  });
}

// 스크립트 상세 정보 불러오기
async function loadScriptDetail(scriptPath) {
  try {
    const content = await window.electronAPI.readScriptContent(scriptPath);
    const script = scripts.find(s => s.path === scriptPath);
    
    document.getElementById('script-name-display').textContent = script.name;
    document.getElementById('script-content-display').textContent = content;
    document.getElementById('script-detail-section').style.display = 'block';
    
    // 스크립트 내용 기본적으로 접기
    const contentWrapper = document.getElementById('script-content-wrapper');
    const contentToggle = document.getElementById('script-content-toggle');
    contentWrapper.style.display = 'none';
    contentToggle.textContent = '▼ 펼치기';
    
    currentScript = scriptPath;
    
    // 필요한 라이브러리 추출 및 표시
    await displayRequiredLibraries(content);
    
    // 스크롤 맨 위로
    document.getElementById('scripts-view').scrollTop = 0;
  } catch (error) {
    alert('스크립트 읽기 실패: ' + error.message);
  }
}

// 스크립트 내용 접기/펼치기 토글
document.getElementById('script-content-label').addEventListener('click', () => {
  const contentWrapper = document.getElementById('script-content-wrapper');
  const contentToggle = document.getElementById('script-content-toggle');
  
  if (contentWrapper.style.display === 'none') {
    contentWrapper.style.display = 'block';
    contentToggle.textContent = '▲ 접기';
  } else {
    contentWrapper.style.display = 'none';
    contentToggle.textContent = '▼ 펼치기';
  }
});

// 필요한 라이브러리 표시
async function displayRequiredLibraries(scriptContent) {
  try {
    const result = await window.electronAPI.extractRequiredLibraries(scriptContent);
    const librariesSection = document.getElementById('required-libraries-section');
    const librariesList = document.getElementById('required-libraries-list');
    
    if (result.success && result.libraries && result.libraries.length > 0) {
      librariesList.innerHTML = result.libraries.map(lib => 
        `<span style="display: inline-block; background: var(--bg-tertiary); padding: 4px 8px; border-radius: 3px; margin: 4px 4px 4px 0; font-size: 12px; color: var(--text-primary);">${lib}</span>`
      ).join('');
      librariesSection.style.display = 'block';
      
      // 라이브러리 목록 저장 (설치 버튼에서 사용)
      librariesList.dataset.libraries = JSON.stringify(result.libraries);
    } else {
      librariesSection.style.display = 'none';
    }
  } catch (error) {
    console.error('라이브러리 추출 실패:', error);
    document.getElementById('required-libraries-section').style.display = 'none';
  }
}

// 스크립트 실행
document.getElementById('run-script-btn').addEventListener('click', async () => {
  if (!currentScript) {
    alert('스크립트를 선택해주세요.');
    return;
  }
  
  if (!confirm('스크립트를 실행하시겠습니까?')) {
    return;
  }
  
  addLog(`🚀 스크립트 실행 시작: ${currentScript.split('\\').pop()}`);
  
  try {
    const result = await window.electronAPI.runPythonScript(currentScript);
    if (result.success) {
      addLog('✅ 스크립트 실행 완료');
      setTimeout(() => {
        loadLogs();
        // 로그 뷰로 전환
        document.querySelector('[data-view="logs"]').click();
      }, 500);
    }
  } catch (error) {
    addLog('❌ 스크립트 실행 실패: ' + (error.message || error));
    alert('스크립트 실행 실패: ' + (error.message || error));
  }
});

// 예약 설정 버튼
document.getElementById('schedule-script-btn').addEventListener('click', () => {
  if (!currentScript) {
    alert('스크립트를 선택해주세요.');
    return;
  }
  
  // 예약 관리 뷰로 전환
  document.querySelector('[data-view="schedule"]').click();
  
  // 스크립트 선택
  const select = document.getElementById('schedule-script-select');
  select.value = currentScript;
});

// 예약 스크립트 선택 업데이트
function updateScheduleScriptSelect() {
  const select = document.getElementById('schedule-script-select');
  select.innerHTML = '<option value="">스크립트를 선택하세요</option>' +
    scripts.map(s => `<option value="${s.path}">${s.name}</option>`).join('');
}

// 반복 옵션 변경
document.getElementById('repeat-option').addEventListener('change', (e) => {
  const weeklyOptions = document.getElementById('weekly-options');
  const dailyOptions = document.getElementById('daily-options');
  const onceOptions = document.getElementById('once-options');
  
  // 모든 옵션 숨기기
  if (weeklyOptions) weeklyOptions.style.display = 'none';
  if (dailyOptions) dailyOptions.style.display = 'none';
  if (onceOptions) onceOptions.style.display = 'none';
  
  // 선택된 옵션에 따라 표시
  if (e.target.value === 'weekly') {
    if (weeklyOptions) weeklyOptions.style.display = 'block';
  } else if (e.target.value === 'daily') {
    if (dailyOptions) dailyOptions.style.display = 'block';
  } else {
    // 일회성
    if (onceOptions) onceOptions.style.display = 'block';
  }
});

// 예약 생성
document.getElementById('create-schedule-btn').addEventListener('click', async () => {
  const scriptPath = document.getElementById('schedule-script-select').value;
  if (!scriptPath) {
    alert('스크립트를 선택해주세요.');
    return;
  }
  
  const repeat = document.getElementById('repeat-option').value;
  let scheduleTime;
  
  if (repeat === 'daily') {
    scheduleTime = document.getElementById('daily-time').value;
    if (!scheduleTime) {
      alert('매일 실행할 시간을 선택해주세요.');
      return;
    }
  } else if (repeat === 'weekly') {
    scheduleTime = document.getElementById('weekly-time').value;
    if (!scheduleTime) {
      alert('매주 실행할 시간을 선택해주세요.');
      return;
    }
    
    // 선택된 요일들 가져오기
    const selectedDays = Array.from(document.querySelectorAll('.day-checkbox:checked')).map(cb => parseInt(cb.value));
    if (selectedDays.length === 0) {
      alert('최소 하나의 요일을 선택해주세요.');
      return;
    }
  } else {
    scheduleTime = document.getElementById('schedule-time').value;
    if (!scheduleTime) {
      alert('실행할 날짜와 시간을 선택해주세요.');
      return;
    }
  }
  
  const scheduleData = {
    scriptPath,
    scheduleTime,
    repeat,
    daysOfWeek: repeat === 'weekly' ? Array.from(document.querySelectorAll('.day-checkbox:checked')).map(cb => parseInt(cb.value)) : undefined
  };
  
  try {
    const result = await window.electronAPI.scheduleScriptExecution(scheduleData);
    if (result.success) {
      let scheduleText = '';
      if (repeat === 'daily') {
        scheduleText = `매일 ${scheduleTime}에 실행`;
      } else if (repeat === 'weekly') {
        const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const selectedDays = Array.from(document.querySelectorAll('.day-checkbox:checked')).map(cb => parseInt(cb.value));
        const dayNamesText = selectedDays.map(d => dayNames[d]).join(', ');
        scheduleText = `매주 ${dayNamesText} ${scheduleTime}에 실행`;
      } else {
        scheduleText = `${new Date(scheduleTime).toLocaleString('ko-KR')}에 실행`;
      }
      
      alert(`예약이 설정되었습니다!\n${scheduleText}`);
      
      // 폼 초기화
      document.getElementById('schedule-script-select').value = '';
      document.getElementById('repeat-option').value = '';
      document.getElementById('schedule-time').value = '';
      document.getElementById('daily-time').value = '';
      document.getElementById('weekly-time').value = '';
      document.querySelectorAll('.day-checkbox').forEach(cb => cb.checked = false);
      
      // 반복 옵션 UI 초기화
      document.getElementById('once-options').style.display = 'none';
      document.getElementById('daily-options').style.display = 'none';
      document.getElementById('weekly-options').style.display = 'none';
      
      // 예약 목록 새로고침 (약간의 지연을 주어 서버에서 저장 완료 후 불러오기)
      setTimeout(() => {
        loadSchedules();
      }, 300);
    } else {
      alert('예약 설정 실패: ' + (result.error || '알 수 없는 오류'));
    }
  } catch (error) {
    console.error('예약 설정 오류:', error);
    alert('예약 설정 실패: ' + error.message);
  }
});

// 예약 목록 불러오기
async function loadSchedules() {
  try {
    const result = await window.electronAPI.getScheduledJobs();
    const list = document.getElementById('schedules-list');
    
    if (result.success && result.jobs && result.jobs.length > 0) {
      list.innerHTML = result.jobs.map(job => {
        const scriptName = job.scriptPath ? job.scriptPath.split('\\').pop() : '알 수 없음';
        const nextDate = job.nextInvocation ? new Date(job.nextInvocation).toLocaleString('ko-KR') : '알 수 없음';
        
        // 예약 정보 표시
        let scheduleInfo = '';
        if (job.scheduleData) {
          if (job.scheduleData.repeat === 'daily') {
            scheduleInfo = `매일 ${job.scheduleData.scheduleTime}`;
          } else if (job.scheduleData.repeat === 'weekly' && job.scheduleData.daysOfWeek) {
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const dayNamesText = job.scheduleData.daysOfWeek.map(d => dayNames[d]).join(', ');
            scheduleInfo = `매주 ${dayNamesText} ${job.scheduleData.scheduleTime}`;
          } else if (job.scheduleData.repeat === 'weekly') {
            scheduleInfo = `매주 ${job.scheduleData.scheduleTime}`;
          } else {
            scheduleInfo = new Date(job.scheduleData.scheduleTime).toLocaleString('ko-KR');
          }
        }
        
        return `
          <div class="schedule-item">
            <div class="schedule-info">
              <div class="schedule-name">${scriptName}</div>
              <div class="schedule-time">${scheduleInfo ? `예약: ${scheduleInfo}` : ''}<br>다음 실행: ${nextDate}</div>
            </div>
            <button class="btn btn-danger" onclick="cancelSchedule('${job.id}')">취소</button>
          </div>
        `;
      }).join('');
    } else {
      list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏰</div><div class="empty-state-text">예약된 작업이 없습니다.</div></div>';
    }
  } catch (error) {
    console.error('예약 목록 불러오기 실패:', error);
  }
}

window.cancelSchedule = async function(jobId) {
  if (confirm('이 예약을 취소하시겠습니까?')) {
    const result = await window.electronAPI.cancelSchedule(jobId);
    if (result.success) {
      loadSchedules();
    } else {
      alert('예약 취소 실패: ' + result.error);
    }
  }
};

// 파일 탐색기에서 열기 (전역 함수)
window.openInExplorer = async function(filePath) {
  try {
    const result = await window.electronAPI.openInExplorer(filePath);
    if (!result.success) {
      alert('파일 탐색기 열기 실패: ' + result.error);
    }
  } catch (error) {
    alert('파일 탐색기 열기 실패: ' + error.message);
  }
};

// VSCode로 열기 (전역 함수)
window.openInVSCode = async function(filePath) {
  try {
    const result = await window.electronAPI.openInVSCode(filePath);
    if (!result.success) {
      alert('VSCode 열기 실패: ' + result.error);
    }
  } catch (error) {
    alert('VSCode 열기 실패: ' + error.message);
  }
};

// 로그 불러오기
async function loadLogs() {
  try {
    const result = await window.electronAPI.readLog();
    const content = document.getElementById('logs-content');
    
    if (result.success) {
      if (result.log) {
        const lines = result.log.split('\n');
        content.innerHTML = lines.map(line => {
          let className = 'log-line';
          if (line.includes('오류') || line.includes('실패') || line.includes('❌')) {
            className += ' error';
          } else if (line.includes('완료') || line.includes('성공') || line.includes('✅')) {
            className += ' success';
          } else if (line.includes('⚠') || line.includes('경고')) {
            className += ' warning';
          } else {
            className += ' info';
          }
          return `<div class="${className}">${escapeHtml(line)}</div>`;
        }).join('');
      } else {
        content.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📋</div><div class="empty-state-text">로그가 없습니다.</div></div>';
      }
      
      // 스크롤 맨 아래로
      content.scrollTop = content.scrollHeight;
    }
  } catch (error) {
    console.error('로그 불러오기 실패:', error);
  }
}

// HTML 이스케이프
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 로그 새로고침
document.getElementById('refresh-logs-btn').addEventListener('click', () => {
  loadLogs();
});

// 로그 지우기
document.getElementById('clear-logs-btn').addEventListener('click', async () => {
  if (confirm('로그를 모두 지우시겠습니까?')) {
    const result = await window.electronAPI.clearLog();
    if (result.success) {
      loadLogs();
    }
  }
});

// 스크립트 목록 새로고침
document.getElementById('refresh-scripts-btn').addEventListener('click', () => {
  loadScripts();
});

// 폴더 변경
document.getElementById('change-directory-btn').addEventListener('click', async () => {
  try {
    const result = await window.electronAPI.selectDirectory();
    if (result.success && result.path) {
      const setResult = await window.electronAPI.setScriptsDirectory(result.path);
      if (setResult.success) {
        await loadScripts();
        addLog(`📁 스크립트 폴더 변경: ${result.path}`);
      } else {
        alert('폴더 설정 실패: ' + setResult.error);
      }
    }
  } catch (error) {
    alert('폴더 선택 실패: ' + error.message);
  }
});

// 파일 탐색기에서 열기 (상세 화면)
document.getElementById('open-explorer-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!currentScript) {
    alert('스크립트를 선택해주세요.');
    return;
  }
  
  try {
    console.log('파일 탐색기 열기:', currentScript);
    const result = await window.electronAPI.openInExplorer(currentScript);
    if (!result.success) {
      alert('파일 탐색기 열기 실패: ' + result.error);
    }
  } catch (error) {
    console.error('파일 탐색기 열기 오류:', error);
    alert('파일 탐색기 열기 실패: ' + error.message);
  }
});

// VSCode로 열기 (상세 화면)
document.getElementById('open-vscode-btn').addEventListener('click', async (e) => {
  e.stopPropagation();
  if (!currentScript) {
    alert('스크립트를 선택해주세요.');
    return;
  }
  
  try {
    console.log('VSCode 열기:', currentScript);
    const result = await window.electronAPI.openInVSCode(currentScript);
    if (!result.success) {
      alert('VSCode 열기 실패: ' + result.error);
    }
  } catch (error) {
    console.error('VSCode 열기 오류:', error);
    alert('VSCode 열기 실패: ' + error.message);
  }
});

// 라이브러리 설치 버튼
document.getElementById('install-libraries-btn').addEventListener('click', async () => {
  const librariesList = document.getElementById('required-libraries-list');
  const librariesJson = librariesList.dataset.libraries;
  
  if (!librariesJson) {
    alert('설치할 라이브러리가 없습니다.');
    return;
  }
  
  try {
    const libraries = JSON.parse(librariesJson);
    if (!libraries || libraries.length === 0) {
      alert('설치할 라이브러리가 없습니다.');
      return;
    }
    
    const librariesStr = libraries.join(', ');
    if (!confirm(`다음 라이브러리를 설치하시겠습니까?\n\n${librariesStr}\n\npip install 명령어가 실행됩니다.`)) {
      return;
    }
    
    // 버튼 비활성화 및 로딩 표시
    const installBtn = document.getElementById('install-libraries-btn');
    const originalText = installBtn.textContent;
    installBtn.disabled = true;
    installBtn.textContent = '⏳ 설치 중...';
    
    try {
      const result = await window.electronAPI.installLibraries(libraries);
      
      if (result.success) {
        alert(`✅ 라이브러리 설치가 완료되었습니다!\n\n설치된 라이브러리:\n${librariesStr}`);
        addLog(`📦 라이브러리 설치 완료: ${librariesStr}`);
      } else {
        alert(`❌ 라이브러리 설치에 실패했습니다.\n\n오류: ${result.error || '알 수 없는 오류'}\n\n${result.stderr ? `상세 정보:\n${result.stderr}` : ''}`);
        addLog(`❌ 라이브러리 설치 실패: ${result.error || '알 수 없는 오류'}`);
      }
    } catch (error) {
      alert(`❌ 라이브러리 설치 중 오류가 발생했습니다.\n\n${error.message}`);
      addLog(`❌ 라이브러리 설치 오류: ${error.message}`);
    } finally {
      // 버튼 복원
      installBtn.disabled = false;
      installBtn.textContent = originalText;
    }
  } catch (error) {
    console.error('라이브러리 설치 오류:', error);
    alert('라이브러리 설치 중 오류가 발생했습니다: ' + error.message);
  }
});

// 로그 추가 (실시간)
function addLog(message) {
  const timestamp = new Date().toLocaleTimeString('ko-KR');
  console.log(`[${timestamp}] ${message}`);
}

// 초기화
window.addEventListener('DOMContentLoaded', async () => {
  // 스크립트 목록 불러오기
  await loadScripts();
  
  // 예약 목록 불러오기
  await loadSchedules();
  
  // 로그 불러오기
  await loadLogs();
  
  addLog('✅ 애플리케이션 시작');
});
