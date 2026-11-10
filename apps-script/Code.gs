/**
 * 역학과 에너지 힌트 코치 (Apps Script + Gemini API)
 * - 학생은 로그인 없이 링크로 접속
 * - '교과서' 시트에서 관련 쪽을 찾아 근거와 쪽수를 함께 안내
 * - '프롬프트' 시트 A1 칸을 고치면 다시 배포하지 않아도 바로 반영
 *
 * [스크립트 속성] (프로젝트 설정 > 스크립트 속성)
 *   GEMINI_API_KEY : 필수. Google AI Studio에서 받은 키
 *   ACCESS_CODE    : 선택. 넣으면 학생이 처음에 이 수업 코드를 입력해야 사용 가능
 *   GEMINI_MODEL   : 선택. 쓸 제미나이 모델 이름 (예: gemini-2.5-flash). 비우면 아래 MODEL
 *   GEMINI_FALLBACKS : 선택. 하루 한도가 차면 차례로 쓸 예비 모델 (쉼표로, 비우면 gemini-2.5-flash-lite, gemma-3-27b-it)
 *
 * [교과 추가하기] — '과목' 탭 (처음 한 번 편집기에서 setupSubjects 실행하면 자동으로 만들어짐)
 *   한 줄 = 교과 하나.  A 사용(체크) | B 교과 이름 | C 연결 낱말 | D 교과서 탭 이름 | E 프롬프트 | F 첫 인사
 *   - C칸 연결 낱말: 학생이 독서실에서 직접 만든 과목 이름에 이 낱말이 들어가면, 공부 중에 그 교과가 먼저 선택돼요.
 *     쉼표로 여러 개 (예: 과학, 물리, 역학 → '물리학Ⅰ', '통합과학' 모두 연결)
 *   - H칸 챗봇: 이 교과를 맡을 교무실 챗봇 이름 (예: 뭉치 박사, 도덕후). 비우면 뭉치 박사
 *   - I칸 담당 선생님: 챗봇 대화창의 [선생님 부르기]를 누르면 바로 연결될 선생님 닉네임. 비우면 목록에서 고르기
 *   - 새 교과서 탭은 기존 '교과서' 탭과 같은 열(쪽, 대단원, 소단원, 내용)로 만들어 주세요.
 *   - '사용'에 체크하고, D칸에 적은 탭이 실제로 있어야만 독서실·웹앱에서 쓸 수 있어요.
 *   - D칸을 비우면 '교과서 없는 교과': 쪽수 안내 없이 개념으로만 힌트 (출판사가 달라도 괜찮음)
 *   - G칸(수업 코드)을 적으면 그 코드를 아는 학생만 사용. 비우면 누구나. 시험 기간마다 바꿔도 돼요.
 *     (G칸이 생기면서 스크립트 속성 ACCESS_CODE는 '과목' 탭이 없을 때만 쓰여요)
 *   - E칸(프롬프트)이 비어 있으면 '프롬프트' 탭 A1을 씁니다. F칸이 비어 있으면 기본 첫 인사를 씁니다.
 *   - 고친 내용은 다시 배포하지 않아도 바로 반영돼요.
 *
 * [숲속 독서실 연결]
 *   독서실(웹페이지)은 이 스크립트의 웹앱 주소로 POST 요청을 보내 챗봇을 씁니다(doPost).
 *   배포 > 배포 관리 > 수정(연필) > 새 버전 으로 다시 배포해야 doPost가 반영됩니다.
 *   웹앱 액세스 권한은 '모든 사용자'여야 독서실에서 부를 수 있어요.
 */

const MODEL = 'gemini-2.5-flash';     // 기본 모델. 스크립트 속성 GEMINI_MODEL에 적으면 그 모델을 먼저 씀 (코드를 덮어써도 유지)
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

/**
 * 챗봇 캐릭터 (교무실 '질문 코너'). '과목' 탭 H칸에 이 이름을 적으면 그 챗봇이 교과를 맡아요.
 * 새 챗봇은 여기와 독서실 js/config.js의 BOTS에 함께 추가해요.
 */
const BOT_PERSONAS = {
  '뭉치 박사': {
    who: '동그란 안경을 쓰고 태블릿을 든 하얀 강아지 캐릭터이고, 과학을 아주 좋아해',
    style: [
      '- 과학 말장난을 섞어서 말해. 학생을 칭찬할 때는 "저항~!", 웃을 때는 "과하하학"이라고 해.',
      '  예: "저항~! 힘의 방향을 정확하게 잡았어!", "과하하학, 단위만 붙이면 완벽하겠다!"',
    ],
  },
  '도덕후': {
    who: '물결치는 주황 갈기와 유니콘 뿔이 있는 크림색 사자 캐릭터이고, 도덕과 윤리 이야기를 아주 좋아해',
    style: [
      '- 따뜻하고 차분하게 말해. 학생을 칭찬할 때는 "덕스럽다~!", 웃을 때는 "후후후"라고 해.',
      '  예: "덕스럽다~! 두 입장을 모두 생각해 봤구나!", "후후후, 근거를 하나만 더 들어 볼까?"',
      '- 도덕·윤리 질문은 한 가지 답을 강요하지 말고, 여러 관점과 근거를 비교해 보며 학생이 스스로 판단하게 도와줘.',
    ],
    // '과목' 탭 E칸(프롬프트)이 비어 있는 도덕후 교과에 쓰는 기본 지시문 ({교과}는 교과 이름으로 바뀜)
    prompt: [
      '너는 고등학생의 {교과} 공부를 돕는 힌트 코치야.',
      '- 정답이나 서술형 모범답안을 통째로 써 주지 말고, 학생이 스스로 생각을 정리하도록 질문과 단계별 힌트를 줘.',
      '- 사상가·이론의 핵심 개념은 정확하게 설명하되, 학생이 그 개념을 자기 말로 다시 설명해 보게 이끌어 줘.',
      '- 서로 다른 윤리적 관점(예: 의무론과 공리주의, 동양 윤리와 서양 윤리)을 비교하는 질문에는 각 관점의 근거를 짚어 주고 학생이 판단하게 해.',
      '- 사회적 쟁점은 한쪽 입장을 정답처럼 말하지 말고, 여러 입장과 그 근거를 균형 있게 다뤄.',
      '- 과학이나 다른 교과 질문이 오면, 이 교과({교과}) 질문을 하도록 부드럽게 안내해.',
    ].join('\n'),
  },
};

function studyroomPersona_(botName) {
  const name = BOT_PERSONAS[botName] ? botName : MASCOT_NAME;
  const p = BOT_PERSONAS[name] || BOT_PERSONAS[MASCOT_NAME];
  return [
    '',
    '[독서실 캐릭터]',
    '- 너는 "숲속 독서실" 교무실 질문 코너의 공부 도우미 "' + name + '"야. ' + p.who + '.',
    '- 말투는 다정한 반말로 짧게 해.',
  ].concat(p.style, [
    '- 말장난은 한 답변에 한 번 정도만 쓰고, 위의 규칙(정답 대신 힌트, 교과서 쪽수 안내)이 언제나 먼저야.',
    '- 힌트를 여러 번 줘도 학생이 해결하기 어려워 보이거나, 수업·수행평가·시험 범위처럼 선생님만 답할 수 있는 질문이면',
    '  "아래 [선생님께 물어보기]를 누르면 선생님께 여쭤볼 수 있어"라고 안내해.'
  ]).join('\n');
}

/* ---------- 교과('과목' 탭) ---------- */

/**
 * 사용 체크된 교과만 돌려줌. '과목' 탭이 없으면 null(예전 방식)
 * - D칸(교과서 탭)이 비어 있으면 '교과서 없는 교과' (쪽수 안내 없이 개념으로 힌트)
 * - D칸에 적은 탭이 없으면 그 교과는 쓸 수 없음
 * - G칸(수업 코드)이 있으면 그 코드를 넣은 학생만 사용
 */
function loadSubjects_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('과목');
  if (!sh) return null;
  return sh.getDataRange().getValues().slice(1)
    .filter(r => r[0] === true && String(r[1]).trim())
    .map(r => ({
      name: String(r[1]).trim(),
      room: String(r[2] || '').trim(),
      tab: String(r[3] || '').trim(),
      prompt: String(r[4] || '').trim(),
      greeting: String(r[5] || '').trim() || DEFAULT_GREETING,
      code: String(r[6] || '').trim(),
      bot: String(r[7] || '').trim(),
      teacher: String(r[8] || '').trim()
    }))
    .filter(x => !x.tab || !!ss.getSheetByName(x.tab));
}

const NO_BOOK_NOTE = [
  '',
  '[교과서 없음]',
  '- 이 교과는 교과서 자료가 연결되어 있지 않아. 학생마다 쓰는 교과서(출판사)가 다를 수 있어.',
  '- 교과서 쪽수는 절대 말하지 마. 위 지시문에 쪽수 안내 규칙이 있어도 이 교과에서는 따르지 마.',
  '- 대신 개념·법칙의 이름과 교육과정 수준의 설명으로 힌트를 주고, "네 교과서에서 ○○ 부분을 찾아봐"처럼 안내해.'
].join('\n');

/** 교과 이름으로 찾기. 이름이 없으면(기존 웹앱) 첫 번째 교과 */
function findSubject_(name) {
  const list = loadSubjects_();
  if (list === null) return { name: '', room: '과학, 물리, 역학', tab: '교과서', prompt: '', greeting: DEFAULT_GREETING, code: getProp_('ACCESS_CODE') };
  if (!name) return list[0] || null;
  return list.filter(x => x.name === name)[0] || null;
}

const SUBJECT_HEADER = ['사용', '교과 이름', '연결 낱말 (학생 과목 이름에 들어가면 연결, 쉼표로 여러 개)', '교과서 탭 이름 (비우면 교과서 없이)', '프롬프트 (비우면 프롬프트 탭 A1)', '첫 인사 (비우면 기본)', '수업 코드 (비우면 누구나)', '챗봇 (비우면 뭉치 박사)', '담당 선생님 (닉네임, 비우면 목록에서 고르기)'];

/** 처음 한 번 편집기에서 실행: '과목' 탭을 만들고 지금의 역학과 에너지를 첫 줄로 등록 (이미 있으면 머리글만 최신으로) */
function setupSubjects() {
  const ss = SpreadsheetApp.getActive();
  const old = ss.getSheetByName('과목');
  if (old) {
    old.getRange(1, 1, 1, SUBJECT_HEADER.length).setValues([SUBJECT_HEADER]);
    console.log("'과목' 탭이 이미 있어서 머리글만 최신으로 바꿨어요. (G칸: 수업 코드)");
    return;
  }
  const sh = ss.insertSheet('과목', 0);
  sh.getRange(1, 1, 1, SUBJECT_HEADER.length).setValues([SUBJECT_HEADER]);
  sh.getRange(2, 1, 1, 8).setValues([[true, '역학과 에너지', '과학, 물리, 역학', '교과서', '', DEFAULT_GREETING, '', '뭉치 박사']]);
  sh.getRange('A3:A50').insertCheckboxes();
  sh.getRange('A2').insertCheckboxes().check();
  sh.setFrozenRows(1);
  sh.setColumnWidth(3, 220);
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
  const sub = findSubject_('');
  return { needCode: !!(sub && sub.code) };
}

/** 교과의 수업 코드 확인 (교과 이름이 없으면 기존 웹앱: 첫 번째 교과) */
function checkCode(code, subjectName) {
  const sub = findSubject_(subjectName || '');
  const saved = sub ? sub.code : '';
  return !saved || String(code || '').trim() === saved;
}

/**
 * payload = { code, history: [{ role:'user'|'model', text, image?:{mimeType, data} }] }
 */
function chat(payload, extraSystem, saveLog) {
  const subject = findSubject_(payload && payload.subject);
  if (!subject) return { error: '이 교과는 아직 연결되지 않았어요. 선생님께 알려 주세요.' };
  if (subject.code && String((payload && payload.code) || '').trim() !== subject.code) {
    return { error: '수업 코드가 맞지 않아요. 선생님께 코드를 다시 확인해 주세요.', codeError: true };
  }
  const key = getProp_('GEMINI_API_KEY');
  if (!key) return { error: '선생님이 아직 API 키를 설정하지 않았어요.' };

  let history = (payload.history || []).slice(-MAX_TURNS);
  while (history.length && history[0].role !== 'user') history.shift();
  if (!history.length) return { error: '보낼 메시지가 없어요.' };

  // 교과서에서 관련 쪽 찾기: 학생의 최근 질문 2개 + 챗봇의 직전 답변을 기준으로
  const pages = subject.tab ? loadPages_(subject.tab) : [];
  const query = buildQuery_(history);
  const hits = rankPages_(pages, query).slice(0, EXCERPT_PAGES)
    .sort((a, b) => a.page - b.page);

  const extra = typeof extraSystem === 'function' ? extraSystem(subject) : (extraSystem || '');
  const system = !subject.tab ? promptFor_(subject) + extra + '\n' + NO_BOOK_NOTE : [
    promptFor_(subject) + extra,
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
  if (result.dayLimit) return { error: dayLimitMsg_(subject.bot || MASCOT_NAME) };
  if (result.error) return result;

  if (saveLog === undefined ? SAVE_LOG : saveLog) {
    try {
      const last = history[history.length - 1];
      SpreadsheetApp.getActive().getSheetByName('기록').appendRow([
        new Date(),
        subject.code ? 'O' : '',
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
  if (/^(board|suggest|book)\./.test(String(body.action || ''))) {
    out = boardHandle_(body);    // 응원 게시판 · 건의함 (Office.gs)
  } else if (body.action === 'room.sync') {
    out = roomSync_(body);       // 공부방 자리 공유 (Office.gs)
  } else if (body.action === 'room.peek') {
    out = roomPeek_();
  } else if (String(body.action || '').indexOf('office.') === 0) {
    out = officeHandle_(body);   // 교무실 (Office.gs)
  } else if (body.action === 'config') {
    const list = loadSubjects_() || [findSubject_('')];
    out = {
      name: MASCOT_NAME,
      subjects: list.map(x => ({ name: x.name, room: x.room, greeting: x.greeting, needCode: !!x.code, book: !!x.tab, bot: x.bot || MASCOT_NAME, teacher: x.teacher }))
    };
  } else if (body.action === 'checkCode') {
    out = { ok: checkCode(body.code, body.subject) };
  } else if (body.action === 'chat') {
    const limited = checkLimit_(String(body.device || '').slice(0, 64));
    out = limited || chat({ subject: body.subject, code: body.code, history: body.history }, (sub) => studyroomPersona_(sub.bot), STUDYROOM_SAVE_LOG);
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

/** 하루 한도 안내 (질문한 챗봇 이름으로) */
function dayLimitMsg_(botName) {
  return '오늘은 ' + (botName || MASCOT_NAME) + '가 질문을 너무 많이 받아서 쉬는 중이야 🐾 내일 다시 물어봐 줘! (급하면 [선생님 부르기]를 눌러 봐)';
}

/**
 * 쓸 모델 순서: GEMINI_MODEL(또는 MODEL) → 예비 모델들.
 * 무료 하루 한도는 모델마다 따로라서, 한 모델이 다 차면 다음 모델로 넘어가요 (결제 없이 무료 그대로).
 * 예비 모델은 스크립트 속성 GEMINI_FALLBACKS에 쉼표로 적어 바꿀 수 있어요.
 */
const DEFAULT_FALLBACKS = ['gemini-2.5-flash-lite', 'gemma-3-27b-it'];
function modelChain_() {
  const first = getProp_('GEMINI_MODEL') || MODEL;
  const extra = getProp_('GEMINI_FALLBACKS');
  const rest = extra ? extra.split(',').map((x) => x.trim()).filter(Boolean) : DEFAULT_FALLBACKS;
  return [first].concat(rest).filter((m, i, arr) => arr.indexOf(m) === i);
}

function callGemini_(key, system, contents) {
  const cache = CacheService.getScriptCache();
  let busy = false;
  for (const model of modelChain_()) {
    // 이 모델의 하루 한도를 이미 다 쓴 걸 알면 건너뜀 (1시간마다 다시 확인)
    if (cache.get('GEMINI_DAY_LIMIT_' + model)) continue;
    const r = callModel_(key, model, system, contents);
    if (r.text) return r;
    if (r.dayLimit) { cache.put('GEMINI_DAY_LIMIT_' + model, '1', 60 * 60); continue; }
    if (r.skip) { cache.put('GEMINI_DAY_LIMIT_' + model, '1', 6 * 60 * 60); continue; } // 이 계정에서 못 쓰는 모델 → 다음 모델
    if (r.busy) { busy = true; continue; }
    return r;
  }
  if (busy) return { error: '지금 사용하는 학생이 많아요. 30초쯤 뒤에 다시 보내 줘.' };
  return { error: dayLimitMsg_(), dayLimit: true };
}

function callModel_(key, model, system, contents) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  // Gemma 모델은 시스템 지시문을 따로 받지 않아서 첫 질문 앞에 붙여서 보냄
  const gemma = /^gemma/i.test(model);
  let body;
  if (gemma) {
    const c = JSON.parse(JSON.stringify(contents));
    if (c.length && c[0].role === 'user') c[0].parts.unshift({ text: '[지시문]\n' + system + '\n\n[학생 질문]' });
    body = { contents: c, generationConfig: { temperature: 0.4 } };
  } else {
    body = { system_instruction: { parts: [{ text: system }] }, contents: contents, generationConfig: { temperature: 0.4 } };
  }
  const options = { method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key }, muteHttpExceptions: true, payload: JSON.stringify(body) };

  for (let attempt = 0; attempt < 2; attempt++) {
    const res = UrlFetchApp.fetch(url, options);
    const code = res.getResponseCode();
    const txt = res.getContentText();
    if (code === 200) {
      const data = JSON.parse(txt);
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && cand.content.parts
        ? cand.content.parts.map(p => p.text || '').join('').trim()
        : '';
      if (!text) return { error: '답을 만들지 못했어요. 질문을 조금 바꿔서 다시 보내 줄래?' };
      return { text: text, model: model };
    }
    // 무료 하루 요청 수를 다 씀 (결제 정보가 없으면 요금은 나가지 않고 이렇게 막히기만 함)
    if (code === 429 && /PerDay/i.test(txt)) return { dayLimit: true };
    if (code === 404 || (code === 400 && /not found|not supported|is not enabled/i.test(txt))) {
      console.warn('모델을 쓸 수 없어 건너뜀: ' + model + ' ' + code);
      return { skip: true };
    }
    if (code === 429 || code >= 500) {        // 분당 한도·서버 혼잡이면 잠시 기다렸다 다시
      Utilities.sleep(2000 * (attempt + 1));
      continue;
    }
    console.error(model, code, txt);
    return { error: '챗봇 연결에 문제가 생겼어요. (오류 ' + code + ') 선생님께 알려 주세요.' };
  }
  return { busy: true };
}

/* ---------- 도우미 ---------- */

/** 교과의 지시문: E칸 → (그 챗봇의 기본 지시문) → 프롬프트 탭 A1 */
function promptFor_(subject) {
  if (subject && subject.prompt) return subject.prompt;
  const p = BOT_PERSONAS[subject && subject.bot];
  if (p && p.prompt) return p.prompt.split('{교과}').join(subject.name || '이 교과');
  return getPrompt_();
}

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
  console.log(r.error || ('Gemini 응답(' + r.model + '): ' + r.text));
}
