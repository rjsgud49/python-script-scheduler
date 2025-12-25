# Python 스크립트 실행 관리 도구

C:\python 폴더에 있는 Python 스크립트를 실행하고 관리하는 일렉트론 애플리케이션입니다.

## 주요 기능

- ✅ **Python 스크립트 실행**: C:\python 폴더의 스크립트를 선택하여 실행
- ⏰ **예약 실행**: 원하는 시간에 자동 실행 (일회성, 매일, 매주 반복)
- 📋 **실행 로그**: 모든 스크립트 실행 로그를 실시간으로 확인
- 📖 **사용 가이드**: 스크립트 작성 방법 및 사용법 안내
- 🎨 **VSCode 스타일 UI**: 직관적이고 현대적인 다크 테마 인터페이스

## 설치 방법

### 1. 필수 요구사항

- Node.js (v16 이상)
- Python 3.x
- Google Chrome 브라우저 (Selenium 스크립트의 경우)

### 2. 프로젝트 설치

```bash
# 의존성 설치
npm install
```

### 3. Python 라이브러리 설치

C:\python의 스크립트가 Selenium을 사용하는 경우:

```bash
pip install selenium
```

### 4. 애플리케이션 실행

```bash
npm start
```

## 사용 방법

### 1. 스크립트 실행

1. 왼쪽 사이드바에서 **"스크립트 목록"**을 클릭합니다.
2. C:\python 폴더에 있는 Python 스크립트 목록이 표시됩니다.
3. 실행할 스크립트를 클릭하여 선택합니다.
4. **"▶ 실행"** 버튼을 클릭하여 즉시 실행합니다.
5. 실행 로그는 **"실행 로그"** 탭에서 확인할 수 있습니다.

### 2. 예약 설정

1. **"예약 관리"** 탭으로 이동합니다.
2. 스크립트를 선택합니다.
3. 반복 설정을 선택합니다:
   - **일회성**: 특정 날짜와 시간에 한 번만 실행
   - **매일**: 매일 특정 시간에 실행
   - **매주**: 매주 특정 요일, 특정 시간에 실행
4. 실행 시간을 설정합니다.
5. **"예약 생성"** 버튼을 클릭합니다.
6. 예약된 작업은 목록에서 확인하고 취소할 수 있습니다.

### 3. 로그 확인

- **"실행 로그"** 탭에서 모든 스크립트 실행 로그를 확인할 수 있습니다.
- 로그 파일 위치: `data/script_logs.txt`
- 로그는 자동으로 저장되며, 실시간으로 확인할 수 있습니다.

### 4. 사용 가이드

**"사용 가이드"** 탭에서 다음 정보를 확인할 수 있습니다:
- Python 스크립트 작성 방법
- 스크립트 실행 방법
- 예약 설정 방법
- 주의사항

## Python 스크립트 작성 예시

C:\python 폴더에 다음과 같은 스크립트를 작성할 수 있습니다:

```python
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
import time

# 구글 폼 URL
FORM_URL = "https://docs.google.com/forms/..."

# 자동 입력 데이터
FORM_DATA = {
    "people": "21박건형 21송주영
    "purpose": "캡스톤 진행",
    "lab": "상관 없음",
    "times": ["야자"],
}

# 브라우저 실행
driver = webdriver.Chrome()
wait = WebDriverWait(driver, 15)

try:
    driver.get(FORM_URL)
    # ... 폼 필드 입력 및 제출 로직 ...
    print("✅ 제출 완료!")
except Exception as e:
    print(f"❌ 오류: {e}")
finally:
    driver.quit()
```

## 프로젝트 구조

```
auto-form/
├── main.js                    # 일렉트론 메인 프로세스
├── preload.js                 # 보안을 위한 preload 스크립트
├── package.json               # 프로젝트 설정
├── scripts/
│   └── python-runner.js       # Python 스크립트 실행 로직
├── renderer/
│   ├── index.html             # UI HTML
│   ├── renderer.js            # 렌더러 프로세스
│   └── styles.css            # VSCode 스타일 다크 테마
└── data/
    └── script_logs.txt        # 실행 로그 파일
```

## 빌드

Windows 실행 파일로 빌드하려면:

```bash
npm run build:win
```

빌드된 파일은 `dist` 폴더에 생성됩니다.

## 문제 해결

### Python을 찾을 수 없습니다

- Python이 설치되어 있는지 확인하세요.
- Python이 PATH 환경 변수에 추가되어 있는지 확인하세요.
- `python --version` 명령어로 Python 설치를 확인하세요.

### 스크립트 실행 실패

- Python 스크립트에 필요한 라이브러리가 설치되어 있는지 확인하세요.
- 스크립트의 문법 오류를 확인하세요.
- 실행 로그에서 자세한 오류 메시지를 확인하세요.

### 예약이 작동하지 않습니다

- 애플리케이션이 실행 중이어야 예약이 작동합니다.
- 시스템 시간이 올바른지 확인하세요.
- 예약 목록에서 예약이 제대로 설정되었는지 확인하세요.

## 라이선스

MIT
