/**
 * 역학과 에너지 힌트 코치 (Apps Script + Gemini API)
 * - 학생은 로그인 없이 링크로 접속
 * - '교과서' 시트에서 관련 쪽을 찾아 근거와 쪽수를 함께 안내
 * - '프롬프트' 시트 A1 칸을 고치면 다시 배포하지 않아도 바로 반영
 *
 * [스크립트 속성] (프로젝트 설정 > 스크립트 속성)
 *   GEMINI_API_KEY : 필수. Google AI Studio에서 받은 키
 *   ACCESS_CODE    : 선택. 넣으면 학생이 처음에 이 수업 코드를 입력해야 사용 가능
 *
 * [교과 추가하기] — '과목' 탭 (처음 한 번 편집기에서 setupSubjects 실행하면 자동으로 만들어짐)
 *   한 줄 = 교과 하나.  A 사용(체크) | B 교과 이름 | C 독서실 과목 | D 교과서 탭 이름 | E 프롬프트 | F 첫 인사
 *   - 새 교과서 탭은 기존 '교과서' 탭과 같은 열(쪽, 대단원, 소단원, 내용)로 만들어 주세요.
 *   - '사용'에 체크하고, D칸에 적은 탭이 실제로 있어야만 독서실·웹앱에서 쓸 수 있어요.
 *   - E칸(프롬프트)이 비어 있으면 '프롬프트' 탭 A1을 씁니다. F칸이 비어 있으면 기본 첫 인사를 씁니다.
 *   - 고친 내용은 다시 배포하지 않아도 바로 반영돼요.
 *
 * [숲속 독서실 연결]
 *   독서실(웹페이지)은 이 스크립트의 웹앱 주소로 POST 요청을 보내 챗봇을 씁니다(doPost).
 *   배포 > 배포 관리 > 수정(연필) > 새 버전 으로 다시 배포해야 doPost가 반영됩니다.
 *   웹앱 액세스 권한은 '모든 사용자'여야 독서실에서 부를 수 있어요.
 */

const MODEL = 'gemini-flash-latest';  // 필요하면 'gemini-2.5-flash' 등으로 바꾸기
const EXCERPT_PAGES = 4;              // 한 번에 챗봇에게 보여줄 교과서 쪽 수
const MAX_TURNS = 30;                 // 서버로 보내는 최근 대화 수
const MAX_IMAGES = 2;                 // 서버로 보내는 최근 사진 수
const SAVE_LOG = true;                // '기록' 시트에 질문·답변 남기기(사진은 저장 안 함)

// 독서실은 공개라서 사용량을 제한함 (무료 사용량·비용 보호)
const DEVICE_LIMIT = 30;              // 기기 하나당 약 6시간 동안 보낼 수 있는 질문 수
const DAILY_LIMIT = 1500;             // 하루 전체 질문 수 상한 (모든 학생 합계)
const STUDYROOM_SAVE_LOG = false;     // 독서실에서 온 질문은 '기록' 시트에 남기지 않음 (기존 웹앱은 SAVE_LOG 따름)
const MASCOT_NAME = '뭉치 박사';        // 독서실 마스코트 이름 (바꾸면 아래 말투 안내에도 반영됨)
const DEFAULT_GREETING = '어떤 문제를 풀어 볼까? 문제를 글로 쓰거나 사진으로 올려 줘!';
const ROOM_SUBJECTS = ['국어', '수학', '영어', '과학', '사회', '한국사', '기타'];

function studyroomPersona_() {
  return [
    '',
    '[독서실 캐릭터]',
    '- 너는 "숲속 독서실"의 공부 도우미 "' + MASCOT_NAME + '"야. 동그란 안경을 쓰고 태블릿을 든 하얀 강아지 캐릭터이고, 과학을 아주 좋아해.',
    '- 말투는 다정한 반말로 짧게 해.',
    '- 과학 말장난을 섞어서 말해. 학생을 칭찬할 때는 "저항~!", 웃을 때는 "과하하학"이라고 해.',
    '  예: "저항~! 힘의 방향을 정확하게 잡았어!", "과하하학, 단위만 붙이면 완벽하겠다!"',
    '- 말장난은 한 답변에 한 번 정도만 쓰고, 위의 규칙(정답 대신 힌트, 교과서 쪽수 안내)이 언제나 먼저야.',
    '- 학생이 혼자 해결하기 어려워 보이거나 수업·평가 관련 질문이면 "교무실 선생님께 물어보는 것도 좋아"라고 안내해도 돼.'
  ].join('\n');
}

/* ---------- 교과('과목' 탭) ---------- */

/** 사용 체크 + 교과서 탭이 실제로 있는 교과만 돌려줌. '과목' 탭이 없으면 null(예전 방식) */
function loadSubjects_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('과목');
  if (!sh) return null;
  return sh.getDataRange().getValues().slice(1)
    .filter(r => r[0] === true && String(r[1]).trim() && String(r[3]).trim())
    .map(r => ({
      name: String(r[1]).trim(),
      room: String(r[2]).trim() || '기타',
      tab: String(r[3]).trim(),
      prompt: String(r[4] || '').trim(),
      greeting: String(r[5] || '').trim() || DEFAULT_GREETING
    }))
    .filter(x => !!ss.getSheetByName(x.tab));
}

/** 교과 이름으로 찾기. 이름이 없으면(기존 웹앱) 첫 번째 교과 */
function findSubject_(name) {
  const list = loadSubjects_();
  if (list === null) return { name: '', room: '과학', tab: '교과서', prompt: '', greeting: DEFAULT_GREETING };
  if (!name) return list[0] || null;
  return list.filter(x => x.name === name)[0] || null;
}

/** 처음 한 번 편집기에서 실행: '과목' 탭을 만들고 지금의 역학과 에너지를 첫 줄로 등록 */
function setupSubjects() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName('과목')) { console.log("'과목' 탭이 이미 있어요."); return; }
  const sh = ss.insertSheet('과목', 0);
  sh.getRange(1, 1, 1, 6).setValues([['사용', '교과 이름', '독서실 과목', '교과서 탭 이름', '프롬프트 (비우면 프롬프트 탭 A1)', '첫 인사 (비우면 기본)']]);
  sh.getRange(2, 1, 1, 6).setValues([[true, '역학과 에너지', '과학', '교과서', '', DEFAULT_GREETING]]);
  sh.getRange('A3:A50').insertCheckboxes();
  sh.getRange('A2').insertCheckboxes().check();
  sh.getRange('C2:C50').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(ROOM_SUBJECTS, true).build());
  sh.setFrozenRows(1);
  sh.setColumnWidth(5, 420);
  console.log("'과목' 탭을 만들었어요. 새 교과는 아래 줄에 추가하세요.");
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('역학과 에너지 힌트 코치')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

/* ---------- 화면에서 호출하는 함수 ---------- */

function getConfig() {
  return { needCode: !!getProp_('ACCESS_CODE') };
}

function checkCode(code) {
  const saved = getProp_('ACCESS_CODE');
  return !saved || String(code || '').trim() === saved;
}

/**
 * payload = { code, history: [{ role:'user'|'model', text, image?:{mimeType, data} }] }
 */
function chat(payload, extraSystem, saveLog) {
  const subject = findSubject_(payload && payload.subject);
  if (!subject) return { error: '이 교과는 아직 연결되지 않았어요. 선생님께 알려 주세요.' };
  if (!checkCode(payload && payload.code)) {
    return { error: '수업 코드가 맞지 않아요. 선생님께 코드를 다시 확인해 주세요.' };
  }
  const key = getProp_('GEMINI_API_KEY');
  if (!key) return { error: '선생님이 아직 API 키를 설정하지 않았어요.' };

  let history = (payload.history || []).slice(-MAX_TURNS);
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length) return { error: '보낼 메시지가 없어요.' };

  // 교과서에서 관련 쪽 찾기: 학생의 최근 질문 2개 + 챗봇의 직전 답변을 기준으로
  const pages = loadPages_(subject.tab);
  const query = buildQuery_(history);
  const hits = rankPages_(pages, query).slice(0, EXCERPT_PAGES)
    .sort((a, b) => a.page - b.page);

  const system = [
    (subject.prompt || getPrompt_()) + (extraSystem || ''),
    '',
    '[목차] (쪽 범위)',
    buildToc_(pages),
    '',
    '[교과서 발췌] 이번 대화와 관련 있어 보이는 쪽 (자동 검색 결과라 관련이 없을 수도 있음)',
    hits.length
      ? hits.map(p => `--- 교과서 ${p.page}쪽 | ${p.unit} ${p.section} ---\n${p.text}`).join('\n\n')
      : '(이번에는 찾은 쪽이 없음. 목차의 쪽 범위로만 안내할 것)'
  ].join('\n');

  const contents = toContents_(history);
  const result = callGemini_(key, system, contents);
  if (result.error) return result;

  if (saveLog === undefined ? SAVE_LOG : saveLog) {
    try {
      const last = history[history.length - 1];
      SpreadsheetApp.getActive().getSheetByName('기록').appendRow([
        new Date(),
        getProp_('ACCESS_CODE') ? 'O' : '',
        (last.text || '') + (last.image ? ' [사진]' : ''),
        result.text.slice(0, 5000),
        hits.map(p => p.page).join(', ')
      ]);
    } catch (e) { /* 기록 실패는 무시 */ }
  }
  return { text: result.text };
}

/* ---------- 숲속 독서실에서 부르는 입구 ---------- */

/**
 * body(JSON 문자열) = { action: 'config' }
 *                   | { action: 'chat', code, device, history: [...] }
 * 독서실은 미리 확인 요청(CORS preflight)이 생기지 않도록 Content-Type을 text/plain으로 보냄.
 */
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) {}
  let out;
  if (body.action === 'config') {
    const list = loadSubjects_() || [findSubject_('')];
    out = {
      needCode: !!getProp_('ACCESS_CODE'),
      name: MASCOT_NAME,
      subjects: list.map(x => ({ name: x.name, room: x.room, greeting: x.greeting }))
    };
  } else if (body.action === 'checkCode') {
    out = { ok: checkCode(body.code) };
  } else if (body.action === 'chat') {
    const limited = checkLimit_(String(body.device || '').slice(0, 64));
    out = limited || chat({ subject: body.subject, code: body.code, history: body.history }, studyroomPersona_(), STUDYROOM_SAVE_LOG);
  } else {
    out = { error: '알 수 없는 요청이에요.' };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function checkLimit_(device) {
  const cache = CacheService.getScriptCache();
  if (device) {
    const k = 'dev_' + device;
    const n = Number(cache.get(k) || 0);
    if (n >= DEVICE_LIMIT) return { error: '오늘은 질문을 많이 했어! 조금 쉬었다가 다시 물어봐 줘. (또는 교무실 선생님께 질문해 봐)' };
    cache.put(k, String(n + 1), 6 * 60 * 60);
  }
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(5000);
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyyMMdd');
    const key = 'COUNT_' + today;
    const n = Number(props.getProperty(key) || 0);
    if (n >= DAILY_LIMIT) return { error: '오늘 독서실 전체 질문 수가 다 찼어요. 내일 다시 만나!' };
    props.setProperty(key, String(n + 1));
    // 지난 날짜 카운터 정리
    Object.keys(props.getProperties()).forEach(k => { if (k.indexOf('COUNT_') === 0 && k !== key) props.deleteProperty(k); });
  } catch (err) {
    // 잠금 실패 시에는 제한 없이 진행
  } finally {
    try { lock.releaseLock(); } catch (err) {}
  }
  return null;
}

/* ---------- 교과서 검색 ---------- */

function loadPages_(tab) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tab || '교과서');
  if (!sh) return [];
  const values = sh.getDataRange().getValues().slice(1);
  return values
    .filter(r => r[0] && r[3])
    .map(r => ({ page: Number(r[0]), unit: String(r[1]), section: String(r[2]), text: String(r[3]) }));
}

function buildQuery_(history) {
  const users = history.filter(m => m.role === 'user').slice(-2).map(m => m.text || '');
  const lastModel = history.filter(m => m.role === 'model').slice(-1).map(m => m.text || '');
  return users.concat(lastModel).join(' ');
}

// 한글은 띄어쓰기·조사 때문에 단어 검색이 잘 안 맞아서, 두 글자씩 잘라 비교(바이그램)
function bigrams_(s) {
  const clean = String(s).toLowerCase().replace(/[^0-9a-z가-힣]/g, '');
  const set = {};
  for (let i = 0; i < clean.length - 1; i++) set[clean.substr(i, 2)] = true;
  return Object.keys(set);
}

function rankPages_(pages, query) {
  const grams = bigrams_(query);
  if (!grams.length) return [];
  const docs = pages.map(p => (p.section + p.section + p.text).toLowerCase().replace(/[^0-9a-z가-힣]/g, ''));
  const N = pages.length;
  const weight = {};
  grams.forEach(g => {
    let df = 0;
    docs.forEach(d => { if (d.indexOf(g) >= 0) df++; });
    // 너무 흔하거나 아예 없는 두 글자는 버림
    weight[g] = (df === 0 || df > N * 0.5) ? 0 : Math.log(N / df);
  });
  const lowSections = ['단원 도입', '프로젝트', '대단원 마무리', '자료실'];
  return pages
    .map((p, i) => {
      let score = 0;
      grams.forEach(g => { if (weight[g] && docs[i].indexOf(g) >= 0) score += weight[g]; });
      if (lowSections.indexOf(p.section) >= 0) score *= 0.5;  // 개념 설명 쪽을 우선
      return { p: p, score: score };
    })
    .filter(x => x.score > 3)
    .sort((a, b) => b.score - a.score)
    .map(x => x.p);   // 점수 높은 순
}

function buildToc_(pages) {
  const order = [];
  const map = {};
  pages.forEach(p => {
    const k = p.unit + ' ' + p.section;
    if (!map[k]) { map[k] = { min: p.page, max: p.page }; order.push(k); }
    map[k].min = Math.min(map[k].min, p.page);
    map[k].max = Math.max(map[k].max, p.page);
  });
  return order.map(k => `${k}: ${map[k].min}~${map[k].max}쪽`).join('\n');
}

/* ---------- Gemini 호출 ---------- */

function toContents_(history) {
  // 오래된 사진은 빼고 최근 MAX_IMAGES장만 보냄 (속도·비용 절약)
  let imagesLeft = MAX_IMAGES;
  const out = [];
  for (let i = history.length - 1; i >= 0; i--) {
    const m = history[i];
    const parts = [];
    if (m.image && m.image.data) {
      if (imagesLeft > 0) {
        parts.push({ inline_data: { mime_type: m.image.mimeType || 'image/jpeg', data: m.image.data } });
        imagesLeft--;
      } else {
        parts.push({ text: '(앞에서 올린 사진)' });
      }
    }
    if (m.text) parts.push({ text: m.text });
    if (!parts.length) parts.push({ text: '(빈 메시지)' });
    out.unshift({ role: m.role === 'model' ? 'model' : 'user', parts: parts });
  }
  return out;
}

function callGemini_(key, system, contents) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-goog-api-key': key },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: contents,
      generationConfig: { temperature: 0.4 }
    })
  };

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    if (code === 200) {
      const data = JSON.parse(res.getContentText());
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && cand.content.parts
        ? cand.content.parts.map(p => p.text || '').join('').trim()
        : '';
      if (!text) return { error: '답을 만들지 못했어요. 질문을 조금 바꿔서 다시 보내 줄래?' };
      return { text: text };
    }
    if (code === 429 || code >= 500) {        // 사용량 초과·서버 혼잡이면 잠시 기다렸다 다시
      Utilities.sleep(2000 * (attempt + 1));
      continue;
    }
    console.error(code, res.getContentText());
    return { error: '챗봇 연결에 문제가 생겼어요. (오류 ' + code + ') 선생님께 알려 주세요.' };
  }
  return { error: '지금 사용하는 학생이 많아요. 30초쯤 뒤에 다시 보내 줘.' };
}

/* ---------- 도우미 ---------- */

function getPrompt_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('프롬프트');
  const p = sh ? String(sh.getRange('A1').getValue()).trim() : '';
  return p || '너는 고등학생의 역학과 에너지 공부를 돕는 힌트 코치야. 정답을 대신 알려주지 말고 단계별 힌트를 줘.';
}

function getProp_(name) {
  return PropertiesService.getScriptProperties().getProperty(name) || '';
}

/** 설정 확인용: 편집기에서 이 함수를 한 번 실행해 보세요. */
function testSetup() {
  const pages = loadPages_();
  console.log('교과서 쪽 수: ' + pages.length);
  console.log('바이메탈 검색 결과: ' + rankPages_(pages, '바이메탈 열팽창 휘어').map(p => p.page).join(', '));
  const r = callGemini_(getProp_('GEMINI_API_KEY'), '한 문장으로 짧게 대답해.', [{ role: 'user', parts: [{ text: '안녕?' }] }]);
  console.log(r.error || ('Gemini 응답: ' + r.text));
}
