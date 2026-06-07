/**
 * FnXpert - Telegram 웹훅 봇 (Google Apps Script) - 안정화 버전
 *
 * 이 파일은 "텔레그램에 입력한 말에 맞는 답이 안 온다" 문제를 해결한 버전입니다.
 *
 * 무엇이 달라졌나요? (비개발자 요약)
 *  1) [핵심] 더 이상 OpenAI(GPT)에만 의존하지 않습니다.
 *     - 먼저 우리가 직접 만든 "키워드 규칙"으로 명령을 알아챕니다. (인터넷/요금/장애와 무관하게 항상 동작)
 *     - 규칙으로 못 알아들었을 때만 GPT를 보조로 사용합니다.
 *     => 그래서 "리스크 점검해줘", "시장 브리핑", "뉴스 점검" 같은 말은 GPT가 없어도 정확히 응답합니다.
 *
 *  2) [핵심] 메시지를 "조용히 버리는" 동작을 없앴습니다.
 *     - 기존 코드는 잠금(Lock)을 못 잡으면 메시지를 '중복'으로 보고 그냥 무시했습니다(=무응답).
 *       이게 "입력했는데 답이 안 오는" 가장 흔한 원인입니다.
 *     - 이제는 잠금 실패 시에도 메시지를 정상 처리합니다(=절대 침묵하지 않음).
 *
 *  3) 무슨 일이 있어도 사용자에게는 한 번은 답을 보냅니다(에러여도 안내 메시지 전송).
 *
 *  4) 같은 질문 1분 차단은 유지하되, "공백 차이"는 같은 질문으로 보고 너무 길게 막지 않습니다.
 *
 * 최초 1회 설정 (코드에 토큰을 적지 마세요)
 *  - 프로젝트 설정 > 스크립트 속성에 아래 3개를 등록하거나, setupCredentials_() 를 한 번 실행하세요.
 *      TELEGRAM_BOT_TOKEN
 *      OPENAI_API_KEY   (없어도 기본 명령은 동작합니다. 비워둬도 됩니다.)
 *      SPREADSHEET_ID
 *
 * 배포 주의 (아주 중요)
 *  - 코드를 고친 뒤에는 반드시 [배포] > [배포 관리] 에서 기존 배포의 "버전"을 "새 버전"으로 바꾼 뒤 저장하세요.
 *    그래야 텔레그램 웹훅이 가리키는 같은 URL로 "새 코드"가 실행됩니다.
 *  - 새로 [새 배포]를 만들면 URL이 바뀌므로, 그 경우엔 setWebhook URL도 새 URL로 다시 등록해야 합니다.
 */

const PROPS = PropertiesService.getScriptProperties();
const TELEGRAM_BOT_TOKEN = PROPS.getProperty('TELEGRAM_BOT_TOKEN');
const OPENAI_API_KEY = PROPS.getProperty('OPENAI_API_KEY'); // 없어도 됨(보조용)
const SPREADSHEET_ID = PROPS.getProperty('SPREADSHEET_ID');

const LOG_SHEET_NAME = 'CommandLog';
const LOG_HEADER = ['시간', '채팅ID', '사용자메시지', 'ACTION', '분류방법', '파라미터', '처리결과'];

// ★ 여기에 "지금 READY가 뜨는" 웹앱 /exec 주소를 붙여넣고 registerWebhook() 를 한 번 실행하세요.
const WEBAPP_URL = '여기에_지금_READY가_뜨는_exec_주소_붙여넣기';

function doGet() {
  return ContentService.createTextOutput('READY');
}

function doPost(e) {
  // 1) update 파싱 (실패해도 텔레그램에는 OK 반환)
  let update;
  try {
    update = JSON.parse(e.postData.contents);
  } catch (err) {
    return ok_();
  }

  // 2) 텍스트 메시지가 아닌 update(my_chat_member 등)는 종료
  if (!update.message || !update.message.text) {
    return ok_();
  }

  // 3) 텔레그램이 같은 update_id 를 재전송하면 1회만 처리 (단, 실패 시에는 '처리'쪽으로 안전하게)
  if (isDuplicateUpdate_(update.update_id)) {
    return ok_();
  }

  const chatId = update.message.chat.id;
  const userText = String(update.message.text || '').trim();
  if (!userText) {
    return ok_();
  }

  try {
    // 4) 같은 질문 1분 내 재응답 차단 (잠금 실패 시에는 막지 않음 = 응답 보장)
    if (isDuplicateQuestion_(chatId, userText)) {
      return ok_();
    }

    // 5) 명령 분류: (A) 우리가 만든 키워드 규칙 우선 → (B) 못 알아들으면 GPT 보조
    let action = 'unknown';
    let params = {};
    let method = 'rule';
    let resultMessage;

    try {
      const local = classifyLocally_(userText);
      action = local.action;
      params = local.params || {};

      if (action === 'unknown' && OPENAI_API_KEY) {
        const gpt = analyzeCommandWithGPT_(userText);
        if (gpt && gpt.action) {
          action = gpt.action;
          params = gpt.params || {};
          method = 'gpt';
        }
      }

      resultMessage = routeAction_(action, params);
    } catch (innerErr) {
      action = 'error';
      method = 'error';
      params = { error: String(innerErr && innerErr.message ? innerErr.message : innerErr) };
      // 사용자에게는 절대 침묵하지 않고 안내를 보냅니다.
      resultMessage = '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.\n예: 리스크 점검해줘 / 시장 브리핑 / 뉴스 요약해줘';
    }

    // 6) 로깅(실패해도 무시) 후 반드시 응답 전송
    logCommand_(chatId, userText, action, method, JSON.stringify(params), resultMessage);
    sendTelegramMessage_(chatId, resultMessage);
    return ok_();

  } catch (err) {
    // 최후의 안전망: 어떤 오류가 나도 사용자에게 한 번은 답을 보냅니다.
    try {
      sendTelegramMessage_(chatId, '일시적인 오류가 발생했습니다. 다시 한 번 입력해 주세요.');
    } catch (sendErr) {
      // 전송까지 실패하면 더는 할 수 있는 게 없습니다.
    }
    logCommand_(chatId, userText || 'ERROR', 'error', 'fatal', '', String(err && err.message ? err.message : err));
    return ok_();
  }
}

/**
 * (A) 키워드 규칙 분류기 - GPT 없이도 동작하는 1차 분류
 * 한국어 명령을 공백/조사에 관계없이 폭넓게 인식합니다.
 */
function classifyLocally_(userText) {
  const t = String(userText).toLowerCase();
  const has = function (arr) {
    for (let i = 0; i < arr.length; i++) {
      if (t.indexOf(arr[i]) !== -1) return true;
    }
    return false;
  };

  // 도움말
  if (has(['도움말', '사용법', 'help', '명령어', '뭐 할 수', '뭐할수'])) {
    return { action: 'help', params: { raw_text: userText } };
  }

  // 데이터 업데이트
  if (has(['데이터 업데이트', '데이터업데이트', '데이터 갱신', '업데이트', '갱신'])) {
    return { action: 'data_update', params: { raw_text: userText } };
  }

  // 시장 브리핑 / 모닝패트롤
  if (has(['시장 브리핑', '시장브리핑', '브리핑', '모닝', '패트롤', '장 시작', '오늘 시장', '시황'])) {
    return { action: 'market_briefing', params: { keyword: userText, raw_text: userText } };
  }

  // 뉴스
  if (has(['뉴스', 'news'])) {
    return { action: 'news_summary', params: { keyword: userText, raw_text: userText } };
  }

  // 리스크 / 위험
  if (has(['리스크', '위험', 'risk', '점검'])) {
    return { action: 'risk_check', params: { keyword: userText, raw_text: userText } };
  }

  // 매크로 (금리/환율/물가/고용 등)
  if (has(['금리', '환율', '물가', '고용', '매크로', '거시', 'cpi', 'fomc', '연준'])) {
    return { action: 'macro_report', params: { keyword: userText, raw_text: userText } };
  }

  // 차트 / 기술적 분석
  if (has(['차트', '기술적', '기술 분석', '캔들', '이평', '추세'])) {
    return { action: 'chart_analysis', params: { keyword: userText, raw_text: userText } };
  }

  return { action: 'unknown', params: { raw_text: userText } };
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
      return [
        '명령을 인식하지 못했습니다. 아래처럼 입력해 보세요.',
        '',
        '· 오늘 시장 브리핑 보여줘',
        '· 리스크 점검해줘',
        '· 뉴스 요약해줘',
        '· 환율과 금리 분석해줘',
        '· 삼성전자 차트 분석해줘',
        '· 데이터 업데이트해줘'
      ].join('\n');
  }
}

// === 중복 update 차단 (캐시만 사용: 잠금 충돌로 메시지를 버리는 일을 없앰) ===
// [변경점] LockService 제거. 잠금 경합(메시지 몰림)으로 메시지가 사라지던 문제 해결.
// [중요] 텔레그램이 같은 메시지(update_id)를 약 11분 뒤 재전송해도 무시하도록
//        기억 시간을 6시간(21600초, 캐시 최대)으로 둡니다.
//        기존 600초(10분)는 재전송 간격(~11분)보다 짧아, 막 만료된 뒤 재전송이 와서
//        "처음 보는 메시지"로 착각 → 11분마다 같은 응답을 반복하던 원인이었습니다.
//        update_id 는 메시지마다 고유하므로 길게 기억해도 정상 입력을 막지 않습니다.
function isDuplicateUpdate_(updateId) {
  if (updateId === undefined || updateId === null) return false;
  const cache = CacheService.getScriptCache();
  const key = 'update_' + updateId;
  if (cache.get(key)) return true;   // 이미 처리한 update
  cache.put(key, '1', 21600);        // 6시간 기억 (재전송 반복 방지)
  return false;
}

// === 동일 질문 1분 차단 (캐시만 사용) ===
function isDuplicateQuestion_(chatId, userText) {
  const normalized = String(userText).replace(/\s+/g, '').toLowerCase();
  if (!normalized) return false;
  const cache = CacheService.getScriptCache();
  const key = 'q_' + chatId + '_' + hashText_(normalized);
  if (cache.get(key)) return true;   // 1분 내 동일 질문
  cache.put(key, '1', 60);           // 1분 기억
  return false;
}

// 캐시 키 길이 제한을 위해 MD5 해시 사용
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

/**
 * (B) GPT 보조 분류 - 규칙으로 못 알아들었을 때만 사용
 * 실패하더라도 throw 하지 않고 null 을 반환하여 전체 흐름을 막지 않습니다.
 */
function analyzeCommandWithGPT_(userText) {
  if (!OPENAI_API_KEY) return null;

  const url = 'https://api.openai.com/v1/responses';
  const payload = {
    model: 'gpt-4.1-mini',
    input: [
      {
        role: 'system',
        content:
          '너는 텔레그램 메시지를 실행 명령으로 변환하는 분류기다. 반드시 JSON만 출력한다.\n' +
          '허용 action: market_briefing(시장 브리핑/모닝패트롤), news_summary(뉴스 요약), ' +
          'risk_check(리스크 점검/위험), macro_report(금리/환율/물가/고용 등 매크로), ' +
          'chart_analysis(차트/기술적 분석), data_update(데이터 업데이트), help(도움말), unknown(실패).\n' +
          '출력 형식: {"action":"...", "params":{"keyword":"핵심 키워드","raw_text":"원문"}}'
      },
      { role: 'user', content: userText }
    ],
    text: { format: { type: 'json_object' } }
  };

  try {
    const res = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + OPENAI_API_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code < 200 || code >= 300) {
      console.error('OpenAI API 오류(' + code + '): ' + body);
      return null; // GPT 실패는 전체를 막지 않습니다.
    }

    const data = JSON.parse(body);
    const jsonText = extractOutputText_(data);
    return JSON.parse(jsonText);
  } catch (err) {
    console.error('analyzeCommandWithGPT_ 실패: ' + (err && err.message ? err.message : err));
    return null;
  }
}

// OpenAI Responses API 응답에서 출력 텍스트를 안전하게 추출한다.
function extractOutputText_(data) {
  if (data && data.output_text) return data.output_text;
  if (data && Array.isArray(data.output)) {
    for (let i = 0; i < data.output.length; i++) {
      const item = data.output[i];
      if (item && Array.isArray(item.content)) {
        for (let j = 0; j < item.content.length; j++) {
          const c = item.content[j];
          if (c && typeof c.text === 'string') return c.text;
        }
      }
    }
  }
  throw new Error('OpenAI 응답에서 텍스트를 찾지 못했습니다.');
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
    '· 오늘 시장 브리핑 보여줘',
    '· 뉴스 요약해줘',
    '· 리스크 점검해줘',
    '· 환율과 금리 분석해줘',
    '· 삼성전자 차트 분석해줘',
    '· 데이터 업데이트해줘'
  ].join('\n');
}

function sendTelegramMessage_(chatId, text) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.error('TELEGRAM_BOT_TOKEN 이 설정되지 않았습니다.');
    return;
  }
  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';
  const payload = { chat_id: chatId, text: text };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    console.error('텔레그램 전송 실패(' + code + '): ' + res.getContentText());
  }
}

// CommandLog 시트에 기록 (실패해도 응답을 막지 않음)
function logCommand_(chatId, userText, action, method, params, result) {
  try {
    if (!SPREADSHEET_ID) return;
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(LOG_SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(LOG_HEADER);
    sheet.appendRow([new Date(), String(chatId), userText, action, method, params, result]);
  } catch (err) {
    console.error('logCommand_ 실패: ' + (err && err.message ? err.message : err));
  }
}

function ok_() {
  return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
}

// 최초 1회만 수동 실행 후 값은 지우는 것을 권장 (또는 스크립트 속성에서 직접 등록)
function setupCredentials_() {
  PropertiesService.getScriptProperties().setProperties({
    TELEGRAM_BOT_TOKEN: '여기에_텔레그램_봇_토큰',
    OPENAI_API_KEY: '여기에_OPENAI_API_KEY_또는_빈값',
    SPREADSHEET_ID: '여기에_스프레드시트_ID'
  });
}

// 시트 로깅 단독 점검
function testLogging() {
  logCommand_(123456789, '테스트 메시지', 'help', 'rule', '{}', '로깅 테스트 성공');
}

// =============================================================
// 운영 도우미 함수들 (편집기에서 '실행'으로 한 번씩 누르세요)
// =============================================================

// ★★★ 가장 중요: 텔레그램 웹훅을 "지금 작동하는 이 배포"로 다시 연결합니다.
//  - 사용법: 위쪽 WEBAPP_URL 에 지금 READY가 뜨는 /exec 주소를 붙여넣고 이 함수를 실행.
//  - drop_pending_updates=true 로 밀려 있던 메시지도 비웁니다.
function registerWebhook() {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN 스크립트 속성이 없습니다.');
  const cleanUrl = String(WEBAPP_URL || '').trim(); // 앞뒤 공백 제거 (실수 방지)
  if (cleanUrl.indexOf('http') !== 0 || cleanUrl.indexOf('/exec') === -1) {
    throw new Error('WEBAPP_URL 에 /exec 로 끝나는 실제 웹앱 주소를 붙여넣으세요.');
  }
  const api = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/setWebhook';
  const res = UrlFetchApp.fetch(api, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ url: cleanUrl, drop_pending_updates: true }),
    muteHttpExceptions: true
  });
  console.log('setWebhook 결과: ' + res.getContentText());
  checkWebhook();
}

// 웹훅 현재 상태 확인 (url / 오류 / 밀린 개수)
function checkWebhook() {
  if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN 스크립트 속성이 없습니다.');
  const api = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/getWebhookInfo';
  const res = UrlFetchApp.fetch(api, { muteHttpExceptions: true });
  console.log('getWebhookInfo: ' + res.getContentText());
}

// 이 프로젝트에 설치된 트리거 목록을 보여줍니다.
//  - '데이터 업데이트해줘'를 10분마다 보내는 시간 트리거의 정체를 여기서 확인하세요.
//  - 지우려면 Apps Script 왼쪽 [트리거(시계 아이콘)] 메뉴에서 해당 트리거를 삭제하면 됩니다.
function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) {
    console.log('설치된 트리거가 없습니다.');
    return;
  }
  triggers.forEach(function (t, i) {
    console.log(
      (i + 1) + '. 함수=' + t.getHandlerFunction() +
      ' / 종류=' + t.getEventType() +
      ' / 소스=' + t.getTriggerSource()
    );
  });
}

// CommandLog 헤더가 옛 버전이라 열이 어긋날 때, 헤더만 새로 맞춥니다.
//  (기존 데이터는 보존됩니다. 1행 헤더만 새 형식으로 교체)
function fixLogHeader() {
  if (!SPREADSHEET_ID) throw new Error('SPREADSHEET_ID 가 없습니다.');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) { ss.insertSheet(LOG_SHEET_NAME); return; }
  sheet.getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]);
  console.log('CommandLog 헤더를 새 형식으로 맞췄습니다.');
}

// 웹훅 동작 단독 점검 (실제 채팅 ID로 바꾸면 텔레그램에 실제로 전송됨)
function testWebhook() {
  const mockEvent = {
    postData: {
      contents: JSON.stringify({
        update_id: Date.now(),
        message: { chat: { id: 123456789 }, text: '리스크 점검해줘' }
      })
    }
  };
  doPost(mockEvent);
}

// 키워드 규칙 분류만 콘솔로 빠르게 점검 (텔레그램 전송 없음)
function testClassify() {
  ['시장 브리핑', '리스크 점검해줘', '뉴스 점검', '환율 금리 분석', '삼성전자 차트', '데이터 업데이트', '안녕']
    .forEach(function (s) {
      console.log(s + ' => ' + JSON.stringify(classifyLocally_(s)));
    });
}

// 중복 차단(재전송 무시)이 작동하는지 확인합니다. (텔레그램/시트 영향 없음)
//  - 같은 update_id 로 두 번 검사 → 첫 번째 false(처리), 두 번째 true(무시) 가 정상입니다.
function testDuplicateGuard() {
  const fakeId = 'TEST_' + Date.now(); // 매번 새 값이라 깨끗하게 테스트됨
  const first = isDuplicateUpdate_(fakeId);
  const second = isDuplicateUpdate_(fakeId);
  console.log('1번째 검사(처음 보는 메시지): ' + first + '  ← false 여야 정상');
  console.log('2번째 검사(같은 메시지 재전송): ' + second + '  ← true(무시) 여야 정상');
  console.log(
    (first === false && second === true)
      ? '✅ 중복 차단 정상 작동: 같은 메시지는 한 번만 처리됩니다.'
      : '❌ 중복 차단 이상: 코드/배포 상태를 확인하세요.'
  );
}
