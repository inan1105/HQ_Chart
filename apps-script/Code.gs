/**
 * FnXpert - Telegram 웹훅 봇 (Google Apps Script)
 *
 * 동작 요약
 *  - 텔레그램에서 메시지를 입력하면 doPost 웹훅이 받아 GPT로 명령을 분류하고 응답한다.
 *  - 동일한 질문은 1분 이내에는 다시 응답하지 않는다. (isDuplicateQuestion_)
 *  - 텔레그램이 같은 update 를 재전송해도 한 번만 처리한다. (isDuplicateUpdate_)
 *  - 모든 명령은 CommandLog 시트에 기록한다. (logCommand_ : 시트가 없으면 자동 생성)
 *
 * 최초 1회 설정
 *  - 프로젝트 설정 > 스크립트 속성에 아래 키를 등록하거나, setupCredentials_() 를 한 번 실행한다.
 *      TELEGRAM_BOT_TOKEN
 *      OPENAI_API_KEY
 *      SPREADSHEET_ID
 *  - 보안을 위해 토큰/키는 코드에 하드코딩하지 않는다.
 */

const PROPS = PropertiesService.getScriptProperties();
const TELEGRAM_BOT_TOKEN = PROPS.getProperty('TELEGRAM_BOT_TOKEN');
const OPENAI_API_KEY = PROPS.getProperty('OPENAI_API_KEY');
const SPREADSHEET_ID = PROPS.getProperty('SPREADSHEET_ID');

const LOG_SHEET_NAME = 'CommandLog';
const LOG_HEADER = ['시간', '사용자메시지', 'GPT_ACTION', '파라미터', '처리결과'];

function doGet() {
  return ContentService.createTextOutput('READY');
}

function doPost(e) {
  // 1) 가장 먼저 update 파싱 (실패해도 OK 반환)
  let update;
  try {
    update = JSON.parse(e.postData.contents);
  } catch (err) {
    return ok_();
  }

  // 2) 메시지가 아닌 update(my_chat_member 등)는 즉시 종료
  if (!update.message || !update.message.text) {
    return ok_();
  }

  // 3) 중복 update 차단: 텔레그램이 같은 update_id 를 재전송하면 무시
  if (isDuplicateUpdate_(update.update_id)) {
    return ok_();
  }

  try {
    const chatId = update.message.chat.id;
    const userText = update.message.text.trim();

    // 4) 동일 질문 1분 내 재응답 차단: 같은 채팅에서 같은 질문을 1분 안에 다시 보내면 무시
    if (isDuplicateQuestion_(chatId, userText)) {
      return ok_();
    }

    // 5) GPT 분류 + 명령 실행 (실패해도 사용자에게는 반드시 응답을 보낸다)
    let action = 'unknown';
    let params = {};
    let resultMessage;

    try {
      const gptResult = analyzeCommandWithGPT_(userText);
      action = gptResult.action;
      params = gptResult.params || {};
      resultMessage = routeAction_(action, params);
    } catch (gptErr) {
      action = 'error';
      params = { error: String(gptErr && gptErr.message ? gptErr.message : gptErr) };
      resultMessage = '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }

    // 6) 로깅(비치명적) 후 응답 전송
    logCommand_(userText, action, JSON.stringify(params), resultMessage);
    sendTelegramMessage_(chatId, resultMessage);

    return ok_();

  } catch (err) {
    logCommand_('ERROR', 'error', '', String(err && err.message ? err.message : err));
    return ok_();
  }
}

// action 을 실제 핸들러로 라우팅한다.
function routeAction_(action, params) {
  switch (action) {
    case 'market_briefing':
      return runMorningPatrol_(params);
    case 'news_summary':
      return runNewsSummary_(params);
    case 'risk_check':
      return runRiskWatch_(params);
    case 'macro_report':
      return runMacroReport_(params);
    case 'chart_analysis':
      return runChartAnalysis_(params);
    case 'data_update':
      return runDataUpdate_(params);
    case 'help':
      return getHelpMessage_();
    default:
      return '명령을 인식하지 못했습니다. 예: 오늘 시장 브리핑 보여줘, 리스크 점검해줘, 뉴스 요약해줘';
  }
}

// === 중복 update 차단 (LockService + 캐시) ===
// 텔레그램이 응답 지연 등으로 같은 update 를 재전송하는 경우를 막는다.
function isDuplicateUpdate_(updateId) {
  if (updateId === undefined || updateId === null) return false;

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (e) {
    // 락 못 잡으면 안전하게 중복으로 간주 (재전송 방지 우선)
    return true;
  }

  try {
    const cache = CacheService.getScriptCache();
    const key = 'update_' + updateId;
    if (cache.get(key)) {
      return true; // 이미 처리함
    }
    cache.put(key, '1', 600); // 10분간 기억
    return false;
  } finally {
    lock.releaseLock();
  }
}

// === 동일 질문 차단 (1분) ===
// 같은 채팅에서 같은 내용의 질문이 1분 이내에 다시 들어오면 응답하지 않는다.
// 공백 차이(예: "리스크 점검해줘" vs "리스크 점검해 줘")는 같은 질문으로 본다.
function isDuplicateQuestion_(chatId, userText) {
  const normalized = String(userText).replace(/\s+/g, '').toLowerCase();
  if (!normalized) return false;

  const key = 'q_' + chatId + '_' + hashText_(normalized);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
  } catch (e) {
    // 락 못 잡으면 안전하게 중복으로 간주 (재응답 방지 우선)
    return true;
  }

  try {
    const cache = CacheService.getScriptCache();
    if (cache.get(key)) {
      return true; // 1분 이내 이미 응답한 동일 질문
    }
    cache.put(key, '1', 60); // 1분간 기억
    return false;
  } finally {
    lock.releaseLock();
  }
}

// 캐시 키 길이를 제한하기 위해 질문 텍스트를 MD5 해시로 변환한다.
function hashText_(text) {
  const bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5,
    text,
    Utilities.Charset.UTF_8
  );
  return bytes
    .map(function (b) {
      return ('0' + (b & 0xff).toString(16)).slice(-2);
    })
    .join('');
}

function analyzeCommandWithGPT_(userText) {
  const url = 'https://api.openai.com/v1/responses';

  const payload = {
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content: `
너는 텔레그램 메시지를 Apps Script 실행 명령으로 변환하는 분류기다.
반드시 JSON만 출력한다.

허용 action:
market_briefing: 시장 브리핑, 모닝패트롤
news_summary: 뉴스 요약
risk_check: 리스크 점검, 위험 알림
macro_report: 금리, 환율, 물가, 고용 등 매크로 분석
chart_analysis: 차트 분석, 기술적 분석
data_update: 데이터 업데이트
help: 도움말
unknown: 인식 실패

출력 형식:
{
  "action": "허용 action 중 하나",
  "params": {
    "keyword": "핵심 키워드 또는 종목명",
    "raw_text": "원문"
  }
}
`
      },
      {
        role: 'user',
        content: userText
      }
    ],
    text: {
      format: {
        type: 'json_object'
      }
    }
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + OPENAI_API_KEY
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('OpenAI API 오류(' + code + '): ' + body);
  }

  const data = JSON.parse(body);
  const jsonText = extractOutputText_(data);
  return JSON.parse(jsonText);
}

// OpenAI Responses API 응답에서 출력 텍스트를 안전하게 추출한다.
function extractOutputText_(data) {
  // 신형: output_text 헬퍼가 있으면 우선 사용
  if (data.output_text) {
    return data.output_text;
  }
  // 표준: output[].content[].text 탐색
  if (Array.isArray(data.output)) {
    for (let i = 0; i < data.output.length; i++) {
      const item = data.output[i];
      if (item && Array.isArray(item.content)) {
        for (let j = 0; j < item.content.length; j++) {
          const c = item.content[j];
          if (c && typeof c.text === 'string') {
            return c.text;
          }
        }
      }
    }
  }
  throw new Error('OpenAI 응답에서 텍스트를 찾지 못했습니다: ' + JSON.stringify(data));
}

function runMorningPatrol_(params) {
  return '시장 브리핑을 실행했습니다.\n키워드: ' + (params.keyword || '전체 시장');
}

function runNewsSummary_(params) {
  return '뉴스 요약을 실행했습니다.\n키워드: ' + (params.keyword || '주요 뉴스');
}

function runRiskWatch_(params) {
  return '리스크 점검을 실행했습니다.\n대상: ' + (params.keyword || '전체 리스크');
}

function runMacroReport_(params) {
  return '매크로 리포트를 실행했습니다.\n대상: ' + (params.keyword || '금리·환율·물가');
}

function runChartAnalysis_(params) {
  return '차트 분석을 실행했습니다.\n대상: ' + (params.keyword || '지정 없음');
}

function runDataUpdate_(params) {
  return '데이터 업데이트를 실행했습니다.';
}

function getHelpMessage_() {
  return [
    '사용 가능한 예시입니다.',
    '',
    '오늘 시장 브리핑 보여줘',
    '뉴스 요약해줘',
    '리스크 점검해줘',
    '환율과 금리 분석해줘',
    '삼성전자 차트 분석해줘',
    '데이터 업데이트해줘'
  ].join('\n');
}

function sendTelegramMessage_(chatId, text) {
  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  const payload = {
    chat_id: chatId,
    text: text
  };
  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
}

// CommandLog 시트에 기록한다.
//  - 시트(탭)가 없으면 자동 생성한다.
//  - 비어 있으면 헤더를 먼저 넣는다.
//  - 로깅 실패가 텔레그램 응답을 막지 않도록 예외를 삼킨다.
function logCommand_(userText, action, params, result) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(LOG_SHEET_NAME);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(LOG_HEADER);
    }
    sheet.appendRow([new Date(), userText, action, params, result]);
  } catch (err) {
    // 로깅 실패는 응답을 막지 않는다. 실행 로그에만 남긴다.
    console.error('logCommand_ 실패: ' + (err && err.message ? err.message : err));
  }
}

function ok_() {
  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}

// 최초 1회만 수동 실행한 뒤, 값을 지우고 저장하는 것을 권장한다.
// (또는 프로젝트 설정 > 스크립트 속성에서 직접 등록)
function setupCredentials_() {
  PropertiesService.getScriptProperties().setProperties({
    TELEGRAM_BOT_TOKEN: '여기에_텔레그램_봇_토큰',
    OPENAI_API_KEY: '여기에_OPENAI_API_KEY',
    SPREADSHEET_ID: '여기에_스프레드시트_ID'
  });
}

// 시트 로깅이 정상 동작하는지 단독으로 확인한다.
function testLogging() {
  logCommand_('테스트 메시지', 'help', '{}', '로깅 테스트 성공');
}

function testWebhook() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        update_id: 999999,
        message: {
          chat: { id: 123456789 },
          text: '오늘 시장 브리핑 보여줘'
        }
      })
    }
  };
  doPost(mockEvent);
}
