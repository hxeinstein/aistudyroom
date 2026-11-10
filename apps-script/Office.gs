/**
 * 숲속 독서실 — 교무실 (선생님과의 1:1 채팅)
 * 같은 Apps Script 프로젝트에 이 파일을 추가하세요. (Code.gs의 doPost가 'office.'로 시작하는 요청을 여기로 보냄)
 *
 * [처음 한 번]
 *   편집기에서 setupOffice 를 실행 → '교사' 탭과 '차단' 탭이 생기고 초대코드 3개가 만들어져요.
 *   (메일 알림 권한 승인 창이 뜨면 허용) 그 뒤 '배포 → 배포 관리 → 새 버전'으로 다시 배포하세요.
 *   초대코드가 더 필요하면 makeTeacherInvite 를 실행하거나, 시트 위쪽 메뉴 [🐾 독서실 → 교사 초대코드 만들기]
 *
 * [교사 탭]  A 사용 | B 초대코드 | C 닉네임 | D 비밀번호(암호화) | E 알림 이메일 | F 자리(1~10) | G 캐릭터 | H 등록일 | I 문 닫음 | J 로그인 기기
 *   - 처음 등록: 초대코드 + 닉네임 + 비밀번호. 그다음 로그인은 닉네임 + 비밀번호만.
 *   - 초대코드 칸(B)은 바꾸지 마세요 (비밀번호 암호화와 관리자 확인에 쓰여요). 바꾸려면 관리자 메뉴의 '비밀번호 초기화' 뒤 새 코드로 등록. 한 번 로그인한 기기는 로그아웃할 때까지 계속 로그인돼 있어요 (J칸에 암호화된 기기 열쇠, 최대 5대)
 *   - 모든 기기에서 로그아웃시키려면 J칸을 지우세요
 *   - I칸 '문 닫음': 선생님이 독서실에서 [문 닫기]를 누르면 체크돼요. 체크되면 '시험 출제 중'으로 보이고 학생의 새 질문을 받지 않아요.
 *   - 초대코드는 한 번 등록하면 그 선생님 것이 됨(다른 사람이 다시 쓸 수 없음)
 *   - '사용' 체크를 풀면 그 선생님은 바로 로그인할 수 없어요 (권한 빼기)
 *   - 비밀번호를 잊으면: 그 줄의 C~J칸을 지우면 같은 초대코드로 다시 등록할 수 있어요
 *
 * [규칙]
 *   - 학생 ↔ 교사, 교사 ↔ 교사만 대화 가능 (학생끼리는 대화를 열 수 없음)
 *   - 대화는 시트에 저장하지 않음. 임시 저장소(캐시)에만 있고, 어느 한쪽이 대화를 끝내면 바로 지워짐 (늦어도 6시간 뒤 자동 삭제)
 *   - 신고: 선생님이 대화창에서 [관리자에게 알리기]를 누르면 '신고' 탭에 그 학생의 최근 메시지(5개까지)가 남고 관리자에게 메일이 가요
 *   - 관리자 메뉴(독서실 안): 신고 처리 · 차단 풀기 · 선생님 초대코드 만들기/끄기/비밀번호 초기화
 *   - 차단: 관리자가 차단하면 그 기기는 교무실 대화를 열 수 없음 ('차단' 탭에 기기 번호만 남음, 대화 내용은 안 남음)
 */

const OFFICE_SEATS = 10;
const OFFICE_TTL = 6 * 60 * 60;          // 대화 최대 보관 6시간 (캐시 최대치)
const ONLINE_MS = 70 * 1000;             // 70초 안에 신호가 있으면 '상담 가능'
const MAIL_GAP = 10 * 60;                // 같은 대화 메일 알림은 10분에 한 번
const MAX_MSGS = 60;                     // 대화당 최근 메시지 수
const STUDYROOM_URL = 'https://hxeinstein.github.io/aistudyroom/';

/* ---------- 설치 ---------- */

function setupOffice() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('교사');
  const header = [['사용', '초대코드', '닉네임', '비밀번호(암호화)', '알림 이메일', '자리', '캐릭터', '등록일', '문 닫음', '로그인 기기', '학교 코드 (비우면 기본 학교)']];
  if (!sh) {
    sh = ss.insertSheet('교사');
    sh.getRange(1, 1, 1, 11).setValues(header);
    sh.setFrozenRows(1);
    sh.getRange('A2:A30').insertCheckboxes();
    sh.getRange('I2:I30').insertCheckboxes();
    for (let i = 0; i < 3; i++) makeTeacherInvite();
  } else {
    sh.getRange(1, 1, 1, 11).setValues(header);   // 예전 탭이면 머리글만 최신으로
    sh.getRange('I2:I30').insertCheckboxes();
  }
  if (!ss.getSheetByName('차단')) {
    const b = ss.insertSheet('차단');
    b.getRange(1, 1, 1, 4).setValues([['기기 번호', '닉네임', '차단한 선생님', '날짜']]);
    b.setFrozenRows(1);
  }
  // 메일 알림 권한을 미리 받아 두기 위한 확인 (메일은 보내지 않음)
  console.log('남은 메일 알림 가능 횟수(오늘): ' + MailApp.getRemainingDailyQuota());
  console.log("'교사' 탭의 초대코드를 선생님들께 한 명에 하나씩 알려 주세요.");
}

/** 초대코드 한 개 추가 */
function makeTeacherInvite(school) {
  const sh = SpreadsheetApp.getActive().getSheetByName('교사');
  if (!sh) return setupOffice();
  const code = 'T-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  const rows = sh.getDataRange().getValues();
  let r = rows.findIndex((row, i) => i > 0 && !row[1]);
  r = r < 0 ? rows.length + 1 : r + 1;
  sh.getRange(r, 1, 1, 2).setValues([[true, code]]);
  const sc = schoolCode_(school);
  sh.getRange(r, 11).setValue(sc === DEFAULT_SCHOOL ? '' : sc);
  sh.getRange(r, 1).insertCheckboxes().check();
  console.log('새 초대코드: ' + code);
  return code;
}

/** 시트 위쪽에 메뉴 추가 */
function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('🐾 독서실')
      .addItem('교사 초대코드 만들기', 'makeTeacherInvite')
      .addItem('교무실 설정(처음 한 번)', 'setupOffice')
      .addItem('과목 탭 만들기/머리글 갱신', 'setupSubjects')
      .addItem('빈 학교 칸을 기본 학교 코드로 채우기', 'fillSchoolCodes')
      .addToUi();
  } catch (e) { /* 편집기에서 실행 시 무시 */ }
}

/* ---------- 요청 처리 ---------- */

function officeHandle_(body) {
  const a = String(body.action || '').replace('office.', '');
  try {
    switch (a) {
      case 'list': return officeList_(body);
      case 'register': return officeRegister_(body);
      case 'login': return officeLogin_(body);
      case 'logout': return officeLogout_(body);
      case 'profile': return officeProfile_(body);
      case 'open': return officeOpen_(body);
      case 'send': return officeSend_(body);
      case 'sync': return officeSync_(body);
      case 'close': return officeClose_(body);
      case 'block': return officeBlock_(body);
      case 'door': return officeDoor_(body);
      case 'call': return officeCall_(body);
      case 'report': return officeReport_(body);
      case 'admin': return officeAdmin_(body);
      default: return { error: '알 수 없는 요청이에요.' };
    }
  } catch (e) {
    console.error(e);
    return { error: '교무실에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' };
  }
}

/* ---------- 선생님 ---------- */

function teachers_() {
  const sh = SpreadsheetApp.getActive().getSheetByName('교사');
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1).map((r, i) => ({
    row: i + 2, on: r[0] === true, code: String(r[1] || '').trim(), name: String(r[2] || '').trim(),
    hash: String(r[3] || ''), email: String(r[4] || '').trim(), seat: Number(r[5]) || 0,
    ...parseLook_(r[6]),
    closed: r[8] === true,
    keys: parseKeys_(r[9]),
    school: String(r[10] || '').trim().toUpperCase() || DEFAULT_SCHOOL,
  })).filter((t) => t.code);
}
/** 캐릭터: {"a":"deer","c":"#B79CE8","g":1} (예전 값은 동물 이름만) */
function parseLook_(v) {
  const sv = String(v || '').trim();
  try {
    const o = JSON.parse(sv);
    return { animal: String(o.a || 'bear'), color: String(o.c || '#B79CE8'), glasses: !!o.g };
  } catch (e) {
    return { animal: sv || 'bear', color: '#B79CE8', glasses: false };
  }
}
function lookCell_(look) {
  look = look || {};
  const color = /^#[0-9a-fA-F]{6}$/.test(String(look.color || '')) ? look.color : '#B79CE8';
  return JSON.stringify({ a: String(look.animal || 'bear').replace(/[^a-z]/g, '').slice(0, 12) || 'bear', c: color, g: look.glasses ? 1 : 0 });
}
function parseKeys_(v) { try { const a = JSON.parse(String(v || '[]')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
const tid_ = (code) => sha_('tid:' + code).slice(0, 12);
function sha_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)
    .map((b) => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}
const pwHash_ = (code, pw) => sha_('pw:' + code + ':' + pw);

/** 기기 열쇠 만들기: 로그아웃할 때까지 그 기기에서 계속 로그인 (시트에는 열쇠의 암호화 값만, 최대 5대) */
function newSession_(t) {
  const token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  CacheService.getScriptCache().put('tsess_' + token, t.code, OFFICE_TTL);
  const keys = t.keys.concat([sha_('key:' + token).slice(0, 24)]).slice(-5);
  SpreadsheetApp.getActive().getSheetByName('교사').getRange(t.row, 10).setValue(JSON.stringify(keys));
  return token;
}
/** 토큰으로 선생님 찾기 (권한이 빠졌거나 로그아웃했으면 null) */
function teacherByToken_(token) {
  if (!token) return null;
  const cache = CacheService.getScriptCache();
  const code = cache.get('tsess_' + token);
  const list = teachers_().filter((x) => x.on && x.hash);
  let t = code ? list.filter((x) => x.code === code)[0] : null;
  const h = sha_('key:' + token).slice(0, 24);
  if (t && t.keys.indexOf(h) < 0) t = null;              // 다른 곳에서 로그아웃됨
  if (!t && !code) t = list.filter((x) => x.keys.indexOf(h) >= 0)[0] || null; // 캐시가 비었으면 시트에서 찾기
  if (!t) { cache.remove('tsess_' + token); return null; }
  cache.put('tsess_' + token, t.code, OFFICE_TTL);
  return t;
}
function officeLogout_(b) {
  const t = teacherByToken_(b.token);
  CacheService.getScriptCache().remove('tsess_' + b.token);
  if (t) {
    const h = sha_('key:' + b.token).slice(0, 24);
    SpreadsheetApp.getActive().getSheetByName('교사').getRange(t.row, 10).setValue(JSON.stringify(t.keys.filter((k) => k !== h)));
  }
  return { ok: true };
}
function me_(t) { const s = schoolInfo_(t.school); return { id: tid_(t.code), name: t.name, seat: t.seat, animal: t.animal, color: t.color, glasses: t.glasses, closed: t.closed, admin: isAdmin_(t), school: t.school, schoolName: s ? s.name : '' }; }

function officeRegister_(b) {
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim().slice(0, 12);
  const pw = String(b.password || '');
  if (!code || !name || pw.length < 4) return { error: '초대코드, 이름, 비밀번호(4자 이상)를 모두 넣어 주세요.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const list = teachers_();
    const t = list.filter((x) => x.code === code)[0];
    if (!t || !t.on) return { error: '초대코드가 맞지 않아요.' };
    if (t.hash) return { error: '이미 등록에 쓰인 초대코드예요. 등록하셨다면 로그인해 주세요.' };
    if (list.some((x) => x.hash && x.name === name)) return { error: '같은 이름의 선생님이 있어요. 이름을 조금 다르게 적어 주세요. (예: 김민지 과학)' };
    const used = list.filter((x) => x.hash).map((x) => x.seat);
    let seat = 1;
    while (used.indexOf(seat) >= 0 && seat <= OFFICE_SEATS) seat++;
    if (seat > OFFICE_SEATS) return { error: '교무실 자리 ' + OFFICE_SEATS + '개가 모두 찼어요.' };
    const sh = SpreadsheetApp.getActive().getSheetByName('교사');
    const look = lookCell_(b.look || { animal: b.animal });
    sh.getRange(t.row, 3, 1, 6).setValues([[name, pwHash_(code, pw), String(b.email || '').trim(), seat, look, new Date()]]);
    Object.assign(t, { name: name, hash: 'x', seat: seat, keys: [] }, parseLook_(look));
    return { token: newSession_(t), me: me_(t) };
  } finally {
    lock.releaseLock();
  }
}

/** 로그인: 초대코드 + 닉네임 + 비밀번호 */
function officeLogin_(b) {
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  const cache = CacheService.getScriptCache();
  // 로그인은 닉네임 + 비밀번호면 돼요 (초대코드는 처음 등록할 때만. 닉네임은 선생님마다 달라요)
  const failKey = 'tfail_' + sha_('n|' + name).slice(0, 16);
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) return { error: '여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요.' };
  const t = teachers_().filter((x) => x.on && x.hash && x.name === name && (!code || x.code === code))[0];
  if (!t || t.hash !== pwHash_(t.code, String(b.password || ''))) {
    cache.put(failKey, String(fails + 1), 600);
    return { error: '닉네임이나 비밀번호가 맞지 않아요.' };
  }
  cache.remove(failKey);
  return { token: newSession_(t), me: me_(t) };
}

/** 교무실 자리 현황 (누구나 볼 수 있음: 이름·동물·상담 가능 여부만) */
function officeList_(b) {
  const cache = CacheService.getScriptCache();
  const now = Date.now();
  const sc = schoolCode_(b && b.school);
  return {
    seats: teachers_().filter((t) => t.on && t.hash && t.school === sc).map((t) => {
      const id = tid_(t.code);
      const last = Number(cache.get('tpres_' + id) || 0);
      return { id: id, name: t.name, seat: t.seat, animal: t.animal, color: t.color, glasses: t.glasses, online: now - last < ONLINE_MS, closed: t.closed };
    }),
  };
}

/** 도배 방지: key별로 기간(초) 안에 max번까지 */
function countOk_(key, max, sec) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get(key) || 0);
  if (n >= max) return false;
  cache.put(key, String(n + 1), sec);
  return true;
}

/* ---------- 대화 ---------- */
// 대화 정보: conv_<id> = { a: 참여자, b: 참여자(항상 교사), msgs: [...], seen: {a, b}, n }
// 참여자 = { type: 'student', device, nick, animal, key } 또는 { type: 'teacher', id, name, animal }

function getConv_(id) {
  const raw = CacheService.getScriptCache().get('conv_' + id);
  return raw ? JSON.parse(raw) : null;
}
function putConv_(id, c) {
  // 캐시 한 칸은 100KB까지라 오래된 메시지부터 덜어냄
  while (c.msgs.length > MAX_MSGS || (JSON.stringify(c).length > 90000 && c.msgs.length > 1)) c.msgs.shift();
  CacheService.getScriptCache().put('conv_' + id, JSON.stringify(c), OFFICE_TTL);
}
function inbox_(tid) {
  const raw = CacheService.getScriptCache().get('inbox_' + tid);
  return raw ? JSON.parse(raw) : [];
}
function setInbox_(tid, list) { CacheService.getScriptCache().put('inbox_' + tid, JSON.stringify(list.slice(-30)), OFFICE_TTL); }

/** 요청한 사람이 이 대화의 어느 쪽인지 ('a' | 'b' | null) */
function side_(c, b, teacher) {
  if (teacher) {
    const id = tid_(teacher.code);
    if (c.b.type === 'teacher' && c.b.id === id) return 'b';
    if (c.a.type === 'teacher' && c.a.id === id) return 'a';
    return null;
  }
  return c.a.type === 'student' && b.key && c.a.key === b.key ? 'a' : null;
}

function isBlocked_(device) {
  if (!device) return false;
  const sh = SpreadsheetApp.getActive().getSheetByName('차단');
  if (!sh) return false;
  return sh.getDataRange().getValues().slice(1).some((r) => String(r[0]) === device);
}

/** 대화 열기: 학생 → 교사, 또는 교사 → 교사. 학생 → 학생은 불가 */
function officeOpen_(b) {
  const target = officeList_(b).seats.filter((s) => s.id === b.to)[0];
  if (!target) return { error: '그 선생님을 찾을 수 없어요.' };
  const teacher = teacherByToken_(b.token);
  if (b.token && !teacher) return { error: '다시 로그인해 주세요.', relogin: true };
  if (target.closed && !teacher) return { error: target.name + ' 선생님은 지금 시험 출제 중이라 질문을 받지 않아요. 다음에 다시 와 줘!', closed: true };
  let a;
  if (teacher) {
    if (tid_(teacher.code) === target.id) return { error: '자기 자신과는 대화할 수 없어요.' };
    a = { type: 'teacher', id: tid_(teacher.code), name: teacher.name, animal: teacher.animal };
    // (대화 상대에게는 동물만 표시)
  } else {
    const device = String(b.device || '').slice(0, 64);
    if (!device) return { error: '기기 정보를 확인할 수 없어요.' };
    if (isBlocked_(device)) return { error: '교무실 대화를 열 수 없어요.' };
    if (!countOk_('oopen_' + device, 10, 3600)) return { error: '대화를 너무 자주 열었어요. 잠시 후에 다시 해 주세요.' };
    a = { type: 'student', device: device, nick: String(b.nick || '학생').slice(0, 12), animal: String(b.animal || 'bear'), key: Utilities.getUuid() };
  }
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  const c = { a: a, b: { type: 'teacher', id: target.id, name: target.name, animal: target.animal }, msgs: [], seen: { a: 0, b: 0 }, n: 0, t: Date.now() };
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    putConv_(id, c);
    const box = inbox_(target.id); box.push(id); setInbox_(target.id, box);
    if (a.type === 'teacher') { const mine = inbox_(a.id); mine.push(id); setInbox_(a.id, mine); }
  } finally { lock.releaseLock(); }
  return { conv: id, key: a.key || null, with: { name: target.name, animal: target.animal, online: target.online } };
}

function officeSend_(b) {
  const text = String(b.text || '').trim().slice(0, 1000);
  if (!text) return { error: '보낼 내용이 없어요.' };
  const teacher = teacherByToken_(b.token);
  if (!teacher && !countOk_('osend_' + String(b.key || '').slice(0, 40), 40, 3600)) {
    return { error: '메시지를 너무 많이 보냈어요. 잠시 쉬었다가 보내 주세요.' };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  let c, who;
  try {
    c = getConv_(b.conv);
    if (!c) return { error: '대화가 끝났어요.', ended: true };
    who = side_(c, b, teacher);
    if (!who) return { error: '이 대화에 참여할 수 없어요.' };
    c.n += 1;
    c.msgs.push({ i: c.n, from: who, text: text, t: Date.now() });
    c.seen[who] = c.n;
    putConv_(b.conv, c);
  } finally { lock.releaseLock(); }
  notifyByMail_(b.conv, c, who);
  return { ok: true, i: c.n };
}

/** 받는 선생님이 교무실에 없으면 메일로 알림 (내용은 넣지 않음, 같은 대화 10분에 한 번) */
function notifyByMail_(convId, c, who) {
  const other = who === 'a' ? c.b : c.a;
  if (other.type !== 'teacher') return;
  const cache = CacheService.getScriptCache();
  if (Date.now() - Number(cache.get('tpres_' + other.id) || 0) < ONLINE_MS) return; // 접속 중이면 화면 알림으로 충분
  if (cache.get('mail_' + convId + '_' + other.id)) return;
  const t = teachers_().filter((x) => tid_(x.code) === other.id)[0];
  if (!t || !t.email) return;
  const from = who === 'a' ? (c.a.type === 'student' ? c.a.nick + ' 학생' : c.a.name + ' 선생님') : c.b.name + ' 선생님';
  try {
    MailApp.sendEmail(t.email, '🐾 숲속 독서실 교무실: ' + from + '이(가) 메시지를 보냈어요',
      from + '이(가) 교무실에서 메시지를 보냈어요.\n\n교무실에서 확인해 주세요: ' + STUDYROOM_URL + '#office\n\n' +
      '(대화 내용은 메일에 넣지 않아요. 대화는 어느 한쪽이 끝내거나 6시간이 지나면 지워져요.)');
    cache.put('mail_' + convId + '_' + other.id, '1', MAIL_GAP);
  } catch (e) { console.error(e); }
}

/**
 * 새 소식 가져오기 (몇 초마다 호출)
 * - 학생: { conv, key, since } → 메시지 + 상대 선생님 접속 여부
 * - 선생님: { token, conv?, since? } → 접속 신호 + 받은 대화 목록 + (열어 둔 대화의) 메시지
 */
function officeSync_(b) {
  const cache = CacheService.getScriptCache();
  const teacher = teacherByToken_(b.token);
  if (b.token && !teacher) return { error: '다시 로그인해 주세요.', relogin: true };
  const out = {};
  if (teacher) {
    const me = tid_(teacher.code);
    cache.put('tpres_' + me, String(Date.now()), OFFICE_TTL);
    const ids = inbox_(me);
    const alive = [];
    out.inbox = [];
    ids.forEach((id) => {
      const c = getConv_(id);
      if (!c) return;
      alive.push(id);
      const mine = c.a.type === 'teacher' && c.a.id === me ? 'a' : 'b';
      const other = mine === 'a' ? c.b : c.a;
      const last = c.msgs[c.msgs.length - 1];
      out.inbox.push({
        conv: id,
        who: other.type === 'student' ? other.nick + ' 학생' : other.name + ' 선생님',
        animal: other.animal, student: other.type === 'student',
        last: last ? last.text.slice(0, 40) : '', t: last ? last.t : c.t,
        unread: c.msgs.filter((m) => m.from !== mine && m.i > (c.seen[mine] || 0)).length,
      });
    });
    if (alive.length !== ids.length) setInbox_(me, alive);
    out.inbox.sort((x, y) => y.t - x.t);
  }
  if (b.conv) {
    const c = getConv_(b.conv);
    if (!c) { out.ended = true; return out; }
    const who = side_(c, b, teacher);
    if (!who) return { error: '이 대화에 참여할 수 없어요.' };
    const since = Number(b.since || 0);
    out.msgs = c.msgs.filter((m) => m.i > since).map((m) => ({ i: m.i, mine: m.from === who, text: m.text, t: m.t }));
    const other = who === 'a' ? c.b : c.a;
    out.otherOnline = other.type === 'teacher' ? Date.now() - Number(cache.get('tpres_' + other.id) || 0) < ONLINE_MS : true;
    out.called = !!c.called;   // 선생님이 먼저 건 대화인지 (학생 화면에서 확인용)
    if (other.type === 'teacher') out.otherName = other.name;
    if (c.seen[who] !== c.n) {
      const lock = LockService.getScriptLock();
      if (lock.tryLock(2000)) {
        try { const c2 = getConv_(b.conv); if (c2) { c2.seen[who] = c2.n; putConv_(b.conv, c2); } } finally { lock.releaseLock(); }
      }
    }
  }
  return out;
}

/** 대화 끝내기 → 바로 지움 */
function officeClose_(b) {
  const teacher = teacherByToken_(b.token);
  const c = getConv_(b.conv);
  if (!c) return { ok: true };
  if (!side_(c, b, teacher)) return { error: '이 대화에 참여할 수 없어요.' };
  CacheService.getScriptCache().remove('conv_' + b.conv);
  return { ok: true };
}

/** 선생님이 학생 차단 (기기 번호만 남김) */
function officeBlock_(b) {
  const teacher = teacherByToken_(b.token);
  if (!teacher) return { error: '다시 로그인해 주세요.', relogin: true };
  if (!isAdmin_(teacher)) return { error: '차단은 관리자만 할 수 있어요.' };
  const c = getConv_(b.conv);
  if (!c || side_(c, b, teacher) !== 'b' || c.a.type !== 'student') return { error: '차단할 수 없어요.' };
  const sh = SpreadsheetApp.getActive().getSheetByName('차단');
  if (sh) sh.appendRow([c.a.device, c.a.nick, teacher.name, new Date()]);
  CacheService.getScriptCache().remove('conv_' + b.conv);
  return { ok: true };
}

/** 선생님이 내 문 열기/닫기 (닫으면 '시험 출제 중', 학생의 새 질문을 받지 않음) */
function officeDoor_(b) {
  const teacher = teacherByToken_(b.token);
  if (!teacher) return { error: '다시 로그인해 주세요.', relogin: true };
  const sh = SpreadsheetApp.getActive().getSheetByName('교사');
  sh.getRange(teacher.row, 9).insertCheckboxes().setValue(!!b.closed);
  return { ok: true, closed: !!b.closed };
}

/** 선생님 캐릭터·닉네임 바꾸기 */
function officeProfile_(b) {
  const teacher = teacherByToken_(b.token);
  if (!teacher) return { error: '다시 로그인해 주세요.', relogin: true };
  const sh = SpreadsheetApp.getActive().getSheetByName('교사');
  const name = String(b.name || '').trim().slice(0, 12);
  if (name && name !== teacher.name) {
    if (teachers_().some((x) => x.hash && x.name === name && x.code !== teacher.code)) return { error: '같은 닉네임의 선생님이 있어요.' };
    sh.getRange(teacher.row, 3).setValue(name);
    teacher.name = name;
  }
  if (b.look) {
    const look = lookCell_(b.look);
    sh.getRange(teacher.row, 7).setValue(look);
    Object.assign(teacher, parseLook_(look));
  }
  return { me: me_(teacher) };
}

/* ---------- 공부방 자리 공유 ----------
 * 학생이 자리에 앉기·일어나기·공부 시작/끝, 그리고 30초마다 알려 주면
 * 다른 사람 화면에 '누가 어느 자리에서 무엇을 공부 중인지'가 보여요. (걸어다니는 모습은 나누지 않음)
 * 시트에는 아무것도 남기지 않고 임시 저장소(캐시)에만 둬요. 2분 넘게 신호가 없으면 자리에서 사라져요.
 */
const ROOM_SEATS = 20;
const ROOM_GONE_MS = 2 * 60 * 1000;

function roomState_() {
  const raw = CacheService.getScriptCache().get('room_1');
  const st = raw ? JSON.parse(raw) : {};
  const now = Date.now();
  Object.keys(st).forEach((k) => { if (now - st[k].t > ROOM_GONE_MS) delete st[k]; });
  return st;
}
function saveRoom_(st) { CacheService.getScriptCache().put('room_1', JSON.stringify(st), OFFICE_TTL); }
const sid_ = (device) => sha_('sid:' + device).slice(0, 12);

/** 공개해도 되는 정보만 (기기 번호는 숨기고 학생 번호(sid)만) */
function roomPublic_(st) {
  return Object.keys(st).map((k) => {
    const x = st[k];
    return { seat: Number(k), sid: x.sid, nick: x.nick, animal: x.animal, subj: x.subj, studying: x.studying, paused: x.paused, elapsed: x.elapsed, t: x.t };
  });
}

/**
 * body = { device, seat(-1이면 안 앉음), nick, animal, subj, studying, paused, elapsed }
 * → { seats: [...다른 사람들], taken: true(그 자리에 이미 누가 있음), calls: [선생님이 건 대화] }
 */
function roomSync_(b) {
  const device = String(b.device || '').slice(0, 64);
  if (!device) return { error: '기기 정보를 확인할 수 없어요.' };
  const sid = sid_(device);
  const cache = CacheService.getScriptCache();
  cache.put('sid_' + sid, device, OFFICE_TTL);   // 선생님이 말 걸 때 쓰려고 (학생 번호 → 기기)
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  let st, taken = false;
  try {
    st = roomState_();
    Object.keys(st).forEach((k) => { if (st[k].d === device) delete st[k]; });
    const seat = Number(b.seat);
    if (seat >= 0 && seat < ROOM_SEATS) {
      if (st[seat]) taken = true;
      else st[seat] = {
        d: device, sid: sid, t: Date.now(),
        nick: String(b.nick || '학생').slice(0, 12), animal: String(b.animal || 'bear').slice(0, 12),
        subj: String(b.subj || '').slice(0, 12), studying: !!b.studying, paused: !!b.paused,
        elapsed: Math.max(0, Math.min(Number(b.elapsed) || 0, 24 * 3600 * 1000)),
      };
    }
    saveRoom_(st);
  } finally { lock.releaseLock(); }
  // 선생님이 건 대화가 있으면 전달 (한 번 전달하면 지움)
  const callsRaw = cache.get('calls_' + device);
  if (callsRaw) cache.remove('calls_' + device);
  return { seats: roomPublic_(st).filter((x) => x.sid !== sid), taken: taken, calls: callsRaw ? JSON.parse(callsRaw) : [] };
}

/** 선생님: 공부방 자리 현황 보기 (구경용) */
function roomPeek_() { return { seats: roomPublic_(roomState_()) }; }

/**
 * 선생님 → 학생에게 말 걸기
 * 독서실(Firebase)에서 보이는 학생에게 걸 때: { token, nick, animal } → 대화를 만들고 열쇠(key)를 돌려줌.
 * 선생님 화면이 그 열쇠를 실시간 연결(Firebase)로 학생에게 전달해요. (예전 방식: { token, sid })
 */
function officeCall_(b) {
  const teacher = teacherByToken_(b.token);
  if (!teacher) return { error: '다시 로그인해 주세요.', relogin: true };
  const cache = CacheService.getScriptCache();
  let device = '';
  let nick = String(b.nick || '학생').slice(0, 12), animal = String(b.animal || 'bear').slice(0, 12);
  if (b.sid) {
    device = cache.get('sid_' + String(b.sid)) || '';
    if (!device) return { error: '그 학생은 지금 독서실에 없어요.' };
    const seatInfo = roomPublic_(roomState_()).filter((x) => x.sid === b.sid)[0];
    if (seatInfo) { nick = seatInfo.nick; animal = seatInfo.animal; }
  }
  const me = tid_(teacher.code);
  const key = Utilities.getUuid();
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  const c = {
    a: { type: 'student', device: device || ('call:' + id), nick: nick, animal: animal, key: key },
    b: { type: 'teacher', id: me, name: teacher.name, animal: teacher.animal },
    msgs: [], seen: { a: 0, b: 0 }, n: 0, t: Date.now(), called: true,
  };
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    putConv_(id, c);
    const box = inbox_(me); box.push(id); setInbox_(me, box);
    if (device) {
      const calls = JSON.parse(cache.get('calls_' + device) || '[]');
      calls.push({ conv: id, key: key, name: teacher.name, id: me });
      cache.put('calls_' + device, JSON.stringify(calls.slice(-5)), OFFICE_TTL);
    }
  } finally { lock.releaseLock(); }
  return { conv: id, key: key, name: teacher.name, id: me, with: { name: nick + ' 학생', animal: animal, student: true } };
}

/* ---------- 응원 게시판 · 건의함 ----------
 * '게시판' 탭: A 번호 | B 시각 | C 쓴 사람 | D 받는 친구 | E 내용 | F 색 | G 기기(암호화) | H 신고 수 | I 숨김
 * '건의함' 탭: A 시각 | B 쓴 사람 | C 내용 | D 기기(암호화) | E 상태(새 건의/확인함/반영함)
 * 관리자(ADMIN_CODES의 초대코드로 등록한 선생님)만 독서실 안에서 건의함을 볼 수 있어요. 시트에서도 바로 볼 수 있어요.
 */
const ADMIN_CODES = ['T-ADMIN0'];
const BOARD_KEEP_DAYS = 30;      // 게시판에 보여 줄 기간
const BOARD_MAX = 60;            // 한 번에 보여 줄 포스트잇 수
const BAD_WORDS = ['시발', '씨발', 'ㅅㅂ', 'ㅆㅂ', '병신', 'ㅂㅅ', '개새', '좆', '존나', 'ㅈㄴ', '꺼져', '죽어', '닥쳐', '미친놈', '미친년', '애미', '느금', 'fuck', 'shit', 'bitch'];
const NOTE_COLORS = ['#FFF3A3', '#FFD3E0', '#CDEFD0', '#CFE3FF', '#FFE0B8', '#E6D7FF'];

const isAdmin_ = (t) => !!t && ADMIN_CODES.indexOf(t.code) >= 0;
const devHash_ = (device) => sha_('dev:' + String(device || '')).slice(0, 16);
function hasBadWord_(s) {
  const t = String(s || '').toLowerCase().replace(/[\s.\-_~!?,·]/g, '');
  return BAD_WORDS.some((w) => t.indexOf(w) >= 0);
}
function sheet_(name, header) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
    sh.setFrozenRows(1);
  }
  return sh;
}
const boardSheet_ = () => sheet_('게시판', ['번호', '시각', '쓴 사람', '받는 친구', '내용', '색', '기기(암호화)', '신고 수', '숨김', '학교']);
const suggestSheet_ = () => sheet_('건의함', ['시각', '쓴 사람', '내용', '기기(암호화)', '상태', '학교']);

function boardHandle_(body) {
  const a = String(body.action || '');
  try {
    if (a === 'board.list') return boardList_(body);
    if (a === 'board.post') return boardPost_(body);
    if (a === 'board.report') return boardReport_(body);
    if (a === 'board.delete') return boardDelete_(body);
    if (a === 'suggest.post') return suggestPost_(body);
    if (a === 'suggest.list') return suggestList_(body);
    if (a === 'suggest.mark') return suggestMark_(body);
    if (a === 'book.import') return bookImport_(body);
    if (a === 'stat.day') return statDay_(body);
    if (a === 'notice.get') return noticeGet_(body);
    if (a === 'school.check') { const s = schoolInfo_(String(body.code || '').trim().toUpperCase()); return s && s.on ? { ok: true, code: s.code, name: s.name } : { error: '학교 코드가 맞지 않아요. 선생님께 다시 물어봐 줘.' }; }
  } catch (e) {
    console.error(e);
    return { error: '잠시 문제가 생겼어요. 조금 뒤에 다시 해 주세요.' };
  }
  return { error: '알 수 없는 요청이에요.' };
}

function boardList_(b) {
  const me = devHash_(b && b.device);
  const rows = boardSheet_().getDataRange().getValues().slice(1);
  const since = Date.now() - BOARD_KEEP_DAYS * 86400000;
  const notes = rows
    .filter((r) => r[0] && r[8] !== true && new Date(r[1]).getTime() >= since && scOf_(r[9]) === b.school)
    .map((r) => ({ id: String(r[0]), t: new Date(r[1]).getTime(), from: String(r[2]), to: String(r[3] || ''), text: String(r[4]), color: String(r[5] || NOTE_COLORS[0]), mine: !!(b && b.device) && String(r[6]) === me }))
    .slice(-BOARD_MAX)
    .reverse();
  return { notes: notes };
}

function boardPost_(b) {
  const text = String(b.text || '').trim().slice(0, 80);
  const to = String(b.to || '').trim().slice(0, 12);
  const from = String(b.nick || '익명').trim().slice(0, 12);
  if (!text) return { error: '응원 내용을 적어 주세요.' };
  if (hasBadWord_(text) || hasBadWord_(to) || hasBadWord_(from)) return { error: '친구가 기분 좋아지는 말로 써 줘 🙂' };
  const dh = devHash_(b.device);
  if (!countOk_('bpost_' + dh, 5, 3600)) return { error: '포스트잇을 너무 많이 붙였어요. 조금 뒤에 다시 붙여 줘.' };
  const color = NOTE_COLORS.indexOf(b.color) >= 0 ? b.color : NOTE_COLORS[0];
  const id = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  boardSheet_().appendRow([id, new Date(), from, to, text, color, dh, 0, false, b.school]);
  return { ok: true, id: id };
}

function findRow_(sh, id) {
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 1;
  return 0;
}

/** 신고: 2번 들어오면 바로 숨김 (관리자가 시트에서 I칸 체크를 풀면 다시 보임) */
function boardReport_(b) {
  const dh = devHash_(b.device);
  if (!countOk_('brep_' + dh + '_' + b.id, 1, 30 * 86400)) return { ok: true }; // 같은 사람이 여러 번 신고해도 한 번
  const sh = boardSheet_();
  const row = findRow_(sh, b.id);
  if (!row) return { ok: true };
  const n = Number(sh.getRange(row, 8).getValue() || 0) + 1;
  sh.getRange(row, 8).setValue(n);
  if (n >= 2) sh.getRange(row, 9).setValue(true);
  return { ok: true, hidden: n >= 2 };
}

/** 지우기: 쓴 사람(같은 기기) 또는 선생님 */
function boardDelete_(b) {
  const sh = boardSheet_();
  const row = findRow_(sh, b.id);
  if (!row) return { ok: true };
  const teacher = b.token ? teacherByToken_(b.token) : null;
  const mine = String(sh.getRange(row, 7).getValue()) === devHash_(b.device);
  if (!(teacher && isAdmin_(teacher)) && !mine) return { error: '내가 붙인 포스트잇만 뗄 수 있어요. (다른 사람 것은 관리자만)' };
  sh.getRange(row, 9).setValue(true);   // 시트에는 숨김으로 남겨 둠 (기록용)
  return { ok: true };
}

/** 건의함에 넣기 (누구나) → 관리자에게 메일 알림 (1시간에 한 번) */
function suggestPost_(b) {
  const text = String(b.text || '').trim().slice(0, 500);
  const from = String(b.nick || '익명').trim().slice(0, 12);
  if (text.length < 2) return { error: '건의 내용을 적어 주세요.' };
  const dh = devHash_(b.device);
  if (!countOk_('sug_' + dh, 5, 3600)) return { error: '건의를 너무 많이 보냈어요. 조금 뒤에 다시 보내 줘.' };
  suggestSheet_().appendRow([new Date(), from, text, dh, '새 건의', b.school]);
  const cache = CacheService.getScriptCache();
  if (!cache.get('sug_mail')) {
    const admins = teachers_().filter((t) => isAdmin_(t) && t.email);
    admins.forEach((t) => {
      try {
        MailApp.sendEmail(t.email, '📮 숲속 독서실 건의함에 새 의견이 들어왔어요',
          '건의함에 새 의견이 들어왔어요.\n\n독서실에서 선생님으로 로그인한 뒤 [📥 받은 대화 → 📮 건의함 보기]에서 확인하거나, 구글 시트 \'건의함\' 탭에서 볼 수 있어요.\n' + STUDYROOM_URL);
      } catch (e) { console.error(e); }
    });
    cache.put('sug_mail', '1', 3600);
  }
  return { ok: true };
}

function suggestList_(b) {
  const t = teacherByToken_(b.token);
  if (!t) return { error: '다시 로그인해 주세요.', relogin: true };
  if (!isAdmin_(t)) return { error: '관리자만 볼 수 있어요.' };
  const rows = suggestSheet_().getDataRange().getValues();
  const items = [];
  for (let i = rows.length - 1; i >= 1 && items.length < 80; i--) {
    const r = rows[i];
    if (!r[2] || scOf_(r[5]) !== b.school) continue;
    items.push({ row: i + 1, t: new Date(r[0]).getTime(), from: String(r[1]), text: String(r[2]), status: String(r[4] || '새 건의') });
  }
  return { items: items, fresh: items.filter((x) => x.status === '새 건의').length };
}

function suggestMark_(b) {
  const t = teacherByToken_(b.token);
  if (!t) return { error: '다시 로그인해 주세요.', relogin: true };
  if (!isAdmin_(t)) return { error: '관리자만 바꿀 수 있어요.' };
  const status = ['새 건의', '확인함', '반영함', '보류'].indexOf(b.status) >= 0 ? b.status : '확인함';
  const row = Number(b.row);
  if (!(row >= 2)) return { error: '잘못된 요청이에요.' };
  suggestSheet_().getRange(row, 5).setValue(status);
  return { ok: true };
}

/* ---------- 교과서 넣기 (관리자) ----------
 * 독서실 사이트의 '교과서 넣기' 페이지(book.html)가 PDF에서 뽑은 쪽별 글자를 몇 쪽씩 보내 줘요.
 * body = { token, tab, start(첫 묶음이면 true → 탭을 새로 만들거나 비움), rows: [[쪽, 대단원, 소단원, 내용], ...],
 *          register?: { name, room, bot } (마지막 묶음에서 '과목' 탭에 교과 등록) }
 */
const RESERVED_TABS = ['과목', '교사', '차단', '신고', '게시판', '건의함', '프롬프트', '기록', '공부통계', '질문통계'];
function bookImport_(b) {
  const t = teacherByToken_(b.token);
  if (!t) return { error: '다시 로그인해 주세요.', relogin: true };
  if (!isAdmin_(t)) return { error: '관리자만 교과서를 넣을 수 있어요.' };
  const tab = String(b.tab || '').trim();
  if (!/^[가-힣A-Za-z0-9 _()\-]{1,30}$/.test(tab) || RESERVED_TABS.indexOf(tab) >= 0) return { error: '탭 이름을 다시 정해 주세요. (한글·영어·숫자, 30자 이내, 과목·교사 같은 이름은 안 돼요)' };
  const ss = SpreadsheetApp.getActive();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    let sh = ss.getSheetByName(tab);
    if (b.start) {
      if (!sh) sh = ss.insertSheet(tab);
      sh.clearContents();
      sh.getRange(1, 1, 1, 4).setValues([['쪽', '대단원', '소단원', '내용']]);
      sh.setFrozenRows(1);
    }
    if (!sh) return { error: '먼저 처음부터 다시 넣어 주세요.' };
    const rows = (b.rows || []).filter((r) => Array.isArray(r) && r.length >= 4)
      .map((r) => [Number(r[0]) || '', String(r[1] || '').slice(0, 60), String(r[2] || '').slice(0, 60), String(r[3] || '').slice(0, 20000)]);
    if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 4).setValues(rows);
    let registered = false;
    if (b.register && b.register.name) {
      const sub = ss.getSheetByName('과목') || (setupSubjects(), ss.getSheetByName('과목'));
      const name = String(b.register.name).trim().slice(0, 30);
      const data = sub.getDataRange().getValues();
      let row = 0;
      for (let i = 1; i < data.length; i++) if (String(data[i][1]).trim() === name) { row = i + 1; break; }
      if (row) {
        sub.getRange(row, 4).setValue(tab);
      } else {
        // 맨 아래(체크박스만 있는 빈 줄 뒤)가 아니라 B칸이 빈 첫 줄에 넣기
        let empty = 0;
        for (let i = 1; i < data.length; i++) if (!String(data[i][1]).trim()) { empty = i + 1; break; }
        if (!empty) empty = data.length + 1;
        sub.getRange(empty, 1, 1, 10).setValues([[true, name, String(b.register.room || '').slice(0, 80), tab, '', DEFAULT_GREETING, '', String(b.register.bot || '').slice(0, 20), '', b.school === DEFAULT_SCHOOL ? '' : b.school]]);
        sub.getRange(empty, 1).insertCheckboxes().check();
      }
      registered = true;
    }
    return { ok: true, total: sh.getLastRow() - 1, registered: registered };
  } finally {
    lock.releaseLock();
  }
}


/* ---------- 신고 (선생님 → 관리자) ---------- */
function reportSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('신고');
  if (!sh) {
    sh = ss.insertSheet('신고');
    sh.getRange(1, 1, 1, 8).setValues([['날짜', '알린 선생님', '학생 닉네임', '이유', '학생의 최근 메시지', '처리', '기기 번호', '학교']]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** 선생님이 대화 중인 학생을 관리자에게 알리기 (학생 메시지 최근 5개만 남김) */
function officeReport_(b) {
  const teacher = teacherByToken_(b.token);
  if (!teacher) return { error: '다시 로그인해 주세요.', relogin: true };
  const c = getConv_(b.conv);
  if (!c || side_(c, b, teacher) !== 'b' || c.a.type !== 'student') return { error: '알릴 수 없는 대화예요.' };
  if (!countOk_('rep_' + tid_(teacher.code), 10, 3600)) return { error: '잠시 뒤에 다시 해 주세요.' };
  const reason = String(b.reason || '').trim().slice(0, 200) || '(이유 없음)';
  const msgs = c.msgs.filter((m) => m.from === 'a').slice(-5).map((m) => m.text.slice(0, 200)).join('\n');
  reportSheet_().appendRow([new Date(), teacher.name, c.a.nick, reason, msgs, '새 신고', c.a.device, teacher.school]);
  const cache = CacheService.getScriptCache();
  if (!cache.get('rep_mail')) {
    teachers_().filter((t) => isAdmin_(t) && t.email).forEach((t) => {
      try {
        MailApp.sendEmail(t.email, '🚨 숲속 독서실: ' + teacher.name + ' 선생님이 학생을 알렸어요',
          teacher.name + ' 선생님이 교무실 대화 중인 학생(' + c.a.nick + ')을 관리자에게 알렸어요.\n이유: ' + reason +
          '\n\n독서실에서 관리자로 로그인한 뒤 [📥 받은 대화 → 🛠️ 관리자 메뉴 → 신고]에서 차단할지 정해 주세요.\n' + STUDYROOM_URL);
      } catch (e) { console.error(e); }
    });
    cache.put('rep_mail', '1', 600);
  }
  return { ok: true };
}

/* ---------- 관리자 메뉴 ---------- */
function officeAdmin_(b) {
  const me = teacherByToken_(b.token);
  if (!me) return { error: '다시 로그인해 주세요.', relogin: true };
  if (!isAdmin_(me)) return { error: '관리자만 쓸 수 있어요.' };
  const ss = SpreadsheetApp.getActive();
  const row = Number(b.row);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    switch (String(b.op || '')) {
      case 'overview': return adminOverview_(b.school);
      case 'blockReport': {
        const sh = reportSheet_();
        if (!(row >= 2) || row > sh.getLastRow()) return { error: '잘못된 요청이에요.' };
        const r = sh.getRange(row, 1, 1, 7).getValues()[0];
        if (r[6] && !isBlocked_(String(r[6]))) ss.getSheetByName('차단').appendRow([String(r[6]), String(r[2]), me.name + ' (신고: ' + r[1] + ')', new Date()]);
        sh.getRange(row, 6).setValue('차단함');
        return { ok: true };
      }
      case 'dismissReport': {
        const sh = reportSheet_();
        if (!(row >= 2) || row > sh.getLastRow()) return { error: '잘못된 요청이에요.' };
        sh.getRange(row, 6).setValue('넘어감');
        return { ok: true };
      }
      case 'unblock': {
        const sh = ss.getSheetByName('차단');
        if (!sh || !(row >= 2) || row > sh.getLastRow()) return { error: '잘못된 요청이에요.' };
        if (String(sh.getRange(row, 2).getValue()) !== String(b.nick || '')) return { error: '목록이 바뀌었어요. 다시 열어 주세요.' };
        sh.deleteRow(row);
        return { ok: true };
      }
      case 'newInvite': return { ok: true, code: makeTeacherInvite(b.school) };
      case 'schools': return { schools: schools_(), current: b.school };
      case 'addSchool': return addSchool_(b);
      case 'toggleSchool': {
        const sh = schoolSheet_(), list = schools_();
        const s = list.filter((x) => x.code === String(b.code || '').toUpperCase())[0];
        if (!s || s.code === DEFAULT_SCHOOL) return { error: '이 학교는 끌 수 없어요.' };
        sh.getRange(s.row, 3).insertCheckboxes().setValue(!!b.on);
        CacheService.getScriptCache().remove('schools');
        return { ok: true };
      }
      case 'summary': return adminSummary_(b.school);
      case 'notice': return noticeSet_(b, me);
      case 'toggleTeacher':
      case 'resetTeacher':
      case 'logoutTeacher': {
        const t = teachers_().filter((x) => x.row === row && x.code === String(b.code || ''))[0];
        if (!t) return { error: '목록이 바뀌었어요. 다시 열어 주세요.' };
        if (isAdmin_(t)) return { error: '관리자 선생님은 여기서 바꿀 수 없어요.' };
        const sh = ss.getSheetByName('교사');
        if (b.op === 'toggleTeacher') {
          sh.getRange(row, 1).insertCheckboxes().setValue(!!b.on);
          if (!b.on) sh.getRange(row, 10).setValue('');
        } else if (b.op === 'logoutTeacher') {
          sh.getRange(row, 10).setValue('');
        } else {
          // 비밀번호 초기화: 같은 초대코드로 다시 등록할 수 있게 (닉네임·비밀번호·이메일·캐릭터·로그인 기기 지움)
          sh.getRange(row, 3, 1, 6).setValues([['', '', '', '', '', '']]);
          sh.getRange(row, 10).setValue('');
        }
        return { ok: true };
      }
      default: return { error: '알 수 없는 요청이에요.' };
    }
  } finally {
    lock.releaseLock();
  }
}

function adminOverview_(sc) {
  const ss = SpreadsheetApp.getActive();
  const cache = CacheService.getScriptCache();
  const reports = [];
  const rv = reportSheet_().getDataRange().getValues();
  for (let i = rv.length - 1; i >= 1 && reports.length < 40; i--) {
    const r = rv[i];
    if (!r[2] || scOf_(r[7]) !== sc) continue;
    reports.push({ row: i + 1, t: new Date(r[0]).getTime(), teacher: String(r[1]), nick: String(r[2]), reason: String(r[3]), msgs: String(r[4]), status: String(r[5] || '새 신고') });
  }
  const blocks = [];
  const bs = ss.getSheetByName('차단');
  if (bs) bs.getDataRange().getValues().forEach((r, i) => {
    if (i === 0 || !r[0]) return;
    blocks.push({ row: i + 1, nick: String(r[1]), by: String(r[2]), t: new Date(r[3]).getTime() || 0 });
  });
  blocks.reverse();
  const teachers = teachers_().filter((t) => t.school === sc || isAdmin_(t)).map((t) => ({
    row: t.row, code: t.code, name: t.name, on: t.on, registered: !!t.hash, admin: isAdmin_(t), school: t.school,
    devices: t.keys.length, online: Date.now() - Number(cache.get('tpres_' + tid_(t.code)) || 0) < ONLINE_MS,
  }));
  return { reports: reports, blocks: blocks, teachers: teachers, freshReports: reports.filter((x) => x.status === '새 신고').length, school: sc };
}


/* ---------- 공부 통계 · 질문 통계 · 공지 (관리자 화면) ----------
 * '공부통계' 탭: 날짜 | 기기(암호화) | 공부 분 | 과목별(JSON) | 갱신 — 학생 이름은 남기지 않아요
 * '질문통계' 탭: 날짜 | 교과 | 쪽 | 단원 | 횟수 — 질문 내용은 남기지 않아요
 */
const statSheet_ = () => sheet_('공부통계', ['날짜', '기기(암호화)', '공부 분', '과목별 분', '갱신', '학교']);
const qSheet_ = () => sheet_('질문통계', ['날짜', '교과', '쪽', '단원', '횟수', '학교']);
const cellDay_ = (v) => (v instanceof Date ? Utilities.formatDate(v, 'Asia/Seoul', 'yyyy-MM-dd') : String(v).replace(/^'/, ''));
const today_ = () => Utilities.formatDate(new Date(Date.now() - 6 * 3600000), 'Asia/Seoul', 'yyyy-MM-dd');   // 독서실 하루는 아침 6시부터

/** 학생 기기가 오늘 공부 시간을 10분마다 알려 줌 */
function statDay_(b) {
  const day = String(b.day || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { error: '잘못된 요청이에요.' };
  if (!b.device) return { error: '기기 정보가 없어요.' };
  const dh = devHash_(b.device);
  const min = Math.max(0, Math.min(24 * 60, Math.round(Number(b.ms || 0) / 60000)));
  const subj = {};
  Object.keys(b.subjects || {}).slice(0, 20).forEach((k) => { subj[String(k).slice(0, 12)] = Math.max(0, Math.min(24 * 60, Math.round(Number(b.subjects[k]) / 60000))); });
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const sh = statSheet_();
    const cache = CacheService.getScriptCache();
    const ck = 'strow_' + day + '_' + dh;
    let row = Number(cache.get(ck) || 0);
    if (row && String(sh.getRange(row, 2).getValue()) !== dh) row = 0;
    if (!row) {
      const vals = sh.getDataRange().getValues();
      for (let i = vals.length - 1; i >= 1; i--) {
        const d = cellDay_(vals[i][0]);
        if (d === day && String(vals[i][1]) === dh) { row = i + 1; break; }
        if (d < day && i < vals.length - 300) break;   // 오래된 줄까지는 보지 않음
      }
    }
    const data = [["'" + day, dh, min, JSON.stringify(subj), new Date(), b.school]];
    if (row) sh.getRange(row, 1, 1, 6).setValues(data);
    else { sh.appendRow(data[0]); row = sh.getLastRow(); }
    cache.put(ck, String(row), 21600);
  } finally { lock.releaseLock(); }
  return { ok: true };
}

/** 챗봇 질문 하나 세기: 교과 + 가장 관련 있는 교과서 쪽 */
function recordQuestion_(subject, top, school) {
  const day = today_();
  const sc = schoolCode_(school);
  const page = top ? Number(top.page) || '' : '';
  const unit = top ? String(top.section || top.unit || '').slice(0, 40) : '';
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return;
  try {
    const sh = qSheet_();
    const cache = CacheService.getScriptCache();
    const ck = 'qrow_' + sha_(day + '|' + sc + '|' + subject + '|' + page).slice(0, 20);
    let row = Number(cache.get(ck) || 0);
    if (row) {
      const r = sh.getRange(row, 1, 1, 5).getValues()[0];
      const d = cellDay_(r[0]);
      if (d !== day || String(r[1]) !== subject || String(r[2]) !== String(page) || scOf_(sh.getRange(row, 6).getValue()) !== sc) row = 0;
    }
    if (!row) {
      const vals = sh.getDataRange().getValues();
      for (let i = vals.length - 1; i >= 1 && i > vals.length - 400; i--) {
        const d = cellDay_(vals[i][0]);
        if (d === day && String(vals[i][1]) === subject && String(vals[i][2]) === String(page) && scOf_(vals[i][5]) === sc) { row = i + 1; break; }
      }
    }
    if (row) sh.getRange(row, 5).setValue(Number(sh.getRange(row, 5).getValue() || 0) + 1);
    else { sh.appendRow(["'" + day, subject, page, unit, 1, sc]); row = sh.getLastRow(); }
    cache.put(ck, String(row), 21600);
  } finally { lock.releaseLock(); }
}

/** 관리자: 오늘 독서실 요약 + 최근 7일 + 질문 통계 */
function adminSummary_(sc) {
  const day = today_();
  const dayOf = cellDay_;
  const days = [];
  for (let i = 6; i >= 0; i--) days.push(Utilities.formatDate(new Date(Date.now() - 6 * 3600000 - i * 86400000), 'Asia/Seoul', 'yyyy-MM-dd'));
  const week = {}; days.forEach((d) => (week[d] = { students: 0, min: 0 }));
  const subj = {};
  statSheet_().getDataRange().getValues().slice(1).forEach((r) => {
    const d = dayOf(r[0]);
    if (!week[d] || scOf_(r[5]) !== sc) return;
    const m = Number(r[2]) || 0;
    if (m < 1) return;
    week[d].students++; week[d].min += m;
    if (d === day) { try { const o = JSON.parse(r[3] || '{}'); Object.keys(o).forEach((k) => (subj[k] = (subj[k] || 0) + Number(o[k] || 0))); } catch (e) {} }
  });
  const qBySubj = {}, qToday = {}, pages = {};
  qSheet_().getDataRange().getValues().slice(1).forEach((r) => {
    const d = dayOf(r[0]);
    if (days.indexOf(d) < 0 || scOf_(r[5]) !== sc) return;
    const n = Number(r[4]) || 0, s = String(r[1]);
    qBySubj[s] = (qBySubj[s] || 0) + n;
    if (d === day) qToday[s] = (qToday[s] || 0) + n;
    if (r[2] !== '' && r[2] !== null) {
      const k = s + '|' + r[2];
      pages[k] = pages[k] || { subject: s, page: Number(r[2]), unit: String(r[3] || ''), n: 0 };
      pages[k].n += n;
    }
  });
  const fresh = (rows, col, val) => rows.filter((r) => String(r[col] || val) === val).length;
  return {
    day: day,
    today: week[day],
    week: days.map((d) => ({ day: d, students: week[d].students, min: week[d].min })),
    subjects: Object.keys(subj).map((k) => ({ name: k, min: subj[k] })).sort((a, b) => b.min - a.min).slice(0, 8),
    questions: { today: Object.keys(qToday).reduce((a, k) => a + qToday[k], 0), week: Object.keys(qBySubj).map((k) => ({ subject: k, n: qBySubj[k], today: qToday[k] || 0 })).sort((a, b) => b.n - a.n) },
    topPages: Object.keys(pages).map((k) => pages[k]).sort((a, b) => b.n - a.n).slice(0, 10),
    freshReports: fresh(reportSheet_().getDataRange().getValues().slice(1).filter((r) => r[2] && scOf_(r[7]) === sc), 5, '새 신고'),
    freshSuggests: fresh(suggestSheet_().getDataRange().getValues().slice(1).filter((r) => r[2] && scOf_(r[5]) === sc), 4, '새 건의'),
    school: sc,
  };
}

/** 공지: 관리자가 쓰면 모든 학생 화면 위에 한 줄로 */
const noticeKey_ = (sc) => (sc === DEFAULT_SCHOOL ? 'NOTICE' : 'NOTICE_' + sc);
function noticeGet_(b) {
  const p = PropertiesService.getScriptProperties(), k = noticeKey_(schoolCode_(b && b.school));
  return { notice: p.getProperty(k) || '', id: p.getProperty(k + '_ID') || '' };
}
function noticeSet_(b, me) {
  const text = String(b.text || '').trim().slice(0, 120);
  const p = PropertiesService.getScriptProperties(), k = noticeKey_(schoolCode_(b.school));
  if (!text) { p.deleteProperty(k); p.deleteProperty(k + '_ID'); return { ok: true, notice: '' }; }
  p.setProperty(k, text);
  p.setProperty(k + '_ID', String(Date.now()));
  return { ok: true, notice: text };
}


/* ---------- 학교 (같은 독서실을 여러 학교가 나눠 쓰기) ----------
 * '학교' 탭: A 학교 코드 | B 학교 이름 | C 사용 | D 만든 날
 * - 학생은 처음 들어올 때 학교 코드를 넣거나, 주소 뒤 ?school=코드 링크로 들어와요
 * - 공부방(실시간)·게시판·건의함·공지·통계·교무실 선생님·챗봇 교과가 학교별로 나뉘어요
 * - 기본 학교(DEFAULT_SCHOOL)는 예전부터 쓰던 기록 (학교 칸이 빈 줄)
 */
const DEFAULT_SCHOOL = 'SCHOOL';
const DEFAULT_SCHOOL_NAME = '우리 학교';
const scOf_ = (v) => String(v || '').trim().toUpperCase() || DEFAULT_SCHOOL;
function schoolSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName('학교');
  if (!sh) {
    sh = ss.insertSheet('학교');
    sh.getRange(1, 1, 1, 4).setValues([['학교 코드', '학교 이름', '사용', '만든 날']]);
    sh.getRange(2, 1, 1, 4).setValues([[DEFAULT_SCHOOL, DEFAULT_SCHOOL_NAME, true, new Date()]]);
    sh.getRange(2, 3).insertCheckboxes().check();
    sh.setFrozenRows(1);
  }
  return sh;
}
function schools_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('schools');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  const list = schoolSheet_().getDataRange().getValues().slice(1)
    .map((r, i) => ({ row: i + 2, code: String(r[0] || '').trim().toUpperCase(), name: String(r[1] || '').trim(), on: r[2] === true }))
    .filter((x) => x.code);
  cache.put('schools', JSON.stringify(list), 300);
  return list;
}
function schoolInfo_(code) { return schools_().filter((x) => x.code === code)[0] || null; }
/** 요청의 학교 코드 → 쓸 수 있는 학교 코드 (없거나 꺼졌으면 기본 학교) */
function schoolCode_(v) {
  const c = String(v || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  if (!c || c === DEFAULT_SCHOOL) return DEFAULT_SCHOOL;
  const s = schoolInfo_(c);
  return s && s.on ? c : DEFAULT_SCHOOL;
}
function addSchool_(b) {
  const name = String(b.name || '').trim().slice(0, 30);
  if (!name) return { error: '학교 이름을 적어 주세요.' };
  const want = String(b.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const list = schools_();
  if (list.some((x) => x.name === name)) return { error: '같은 이름의 학교가 있어요.' };
  let code = want;
  if (code && list.some((x) => x.code === code)) return { error: '이미 쓰는 학교 코드예요.' };
  if (!code) do { code = Utilities.getUuid().replace(/[^A-Z0-9]/gi, '').slice(0, 5).toUpperCase(); } while (list.some((x) => x.code === code) || !/^[A-Z]/.test(code));
  const sh = schoolSheet_();
  sh.appendRow([code, name, true, new Date()]);
  sh.getRange(sh.getLastRow(), 3).insertCheckboxes().check();
  CacheService.getScriptCache().remove('schools');
  return { ok: true, code: code, name: name };
}


/** 예전 기록의 빈 '학교' 칸을 기본 학교 코드로 채우기 (필터로 학교별 보기 편하게). 시트 메뉴 [🐾 독서실]에서 실행 */
function fillSchoolCodes() {
  const ss = SpreadsheetApp.getActive();
  [['게시판', 10, 1], ['건의함', 6, 3], ['신고', 8, 3], ['공부통계', 6, 1], ['질문통계', 6, 1]].forEach(([name, col, need]) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    const n = sh.getLastRow() - 1;
    const vals = sh.getRange(2, 1, n, col).getValues();
    const out = vals.map((r) => [r[need - 1] !== '' && r[need - 1] !== null && !String(r[col - 1]).trim() ? DEFAULT_SCHOOL : r[col - 1]]);
    sh.getRange(2, col, n, 1).setValues(out);
  });
  try { SpreadsheetApp.getUi().alert('빈 학교 칸을 ' + DEFAULT_SCHOOL + '로 채웠어요. 각 탭에서 [데이터 → 필터 만들기]로 학교별로 볼 수 있어요.'); } catch (e) {}
}
