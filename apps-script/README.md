# FnXpert Telegram 웹훅 봇 (Google Apps Script)

텔레그램 메시지를 받아 GPT로 명령을 분류하고 응답하는 Apps Script 웹훅 봇입니다.

## 동작

1. 텔레그램에서 메시지를 입력하면 `doPost` 웹훅이 받습니다.
2. GPT(`gpt-4.1-mini`)가 메시지를 action 으로 분류합니다.
3. 해당 action 핸들러의 결과를 텔레그램으로 다시 보냅니다.
4. 처리 내용을 `CommandLog` 시트에 기록합니다.

## 중복 응답 방지 (2단계)

| 함수 | 기준 | 기간 | 목적 |
| --- | --- | --- | --- |
| `isDuplicateUpdate_` | `update_id` | 10분 | 텔레그램이 같은 update 를 재전송하는 경우 차단 |
| `isDuplicateQuestion_` | 질문 텍스트 + chatId | **1분** | 사용자가 같은 질문을 다시 보내면 재응답 차단 |

> 동일 질문 판정 시 공백 차이는 무시합니다. 예) `리스크 점검해줘` 와 `리스크 점검해 줘` 는 같은 질문으로 봅니다.

## 최초 설정 (필수)

토큰/키는 코드에 하드코딩하지 않고 **스크립트 속성**에서 읽습니다.

1. Apps Script 편집기 → 프로젝트 설정(⚙️) → 스크립트 속성에 아래 항목 추가
   - `TELEGRAM_BOT_TOKEN`
   - `OPENAI_API_KEY`
   - `SPREADSHEET_ID`
2. 또는 `setupCredentials_()` 의 값을 채워 한 번 실행한 뒤, 코드의 값은 다시 지웁니다.

## 배포 / 웹훅 등록

1. 배포 → 새 배포 → 웹 앱 (액세스: 모든 사용자)으로 배포하여 `/exec` URL 을 받습니다.
2. 아래 주소로 웹훅을 등록합니다.

```
https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<APPS_SCRIPT_EXEC_URL>
```

## 보안 주의

이전 코드에는 텔레그램 봇 토큰과 OpenAI API 키가 평문으로 들어 있었습니다.
**이미 노출된 키이므로 반드시 재발급(rotate)** 하세요.

- OpenAI: 플랫폼에서 해당 키 폐기 후 새 키 발급
- Telegram: `@BotFather` 에서 `/revoke` 후 새 토큰 발급
