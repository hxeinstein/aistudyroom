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
 *   - 로그인: 초대코드 + 닉네임 + 비밀번호. 한 번 로그인한 기기는 로그아웃할 때까지 계속 로그인돼 있어요 (J칸에 암호화된 기기 열쇠, 최대 5대)
 *   - 모든 기기에서 로그아웃시키려면 J칸을 지우세요
 *   - I칸 '문 닫음': 선생님이 독서실에서 [문 닫기]를 누르면 체크돼요. 체크되면 '시험 출제 중'으로 보이고 학생의 새 질문을 받지 않아요.
 *   - 초대코드는 한 번 등록하면 그 선생님 것이 됨(다른 사람이 다시 쓸 수 없음)
 *   - '사용' 체크를 풀면 그 선생님은 바로 로그인할 수 없어요 (권한 빼기)
 *   - 비밀번호를 잊으면: 그 줄의 C~J칸을 지우면 같은 초대코드로 다시 등록할 수 있어요
 *
 * [규칙]
 *   - 학생 ↔ 교사, 교사 ↔ 교사만 대화 가능 (학생끼리는 대화를 열 수 없음)
 *   - 대화는 시트에 저장하지 않음. 임시 저장소(캐시)에만 있고, 어느 한쪽이 대화를 끝내면 바로 지워짐 (늦어도 6시간 뒤 자동 삭제)
 *   - 차단: 선생님이 차단하면 그 기기는 교무실 대화를 열 수 없음 ('차단' 탭에 기기 번호만 남음, 대화 내용은 안 남음)
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
  const header = [['사용', '초대코드', '닉네임', '비밀번호(암호화)', '알림 이메일', '자리', '캐릭터', '등록일', '문 닫음', '로그인 기기']];
  if (!sh) {
    sh = ss.insertSheet('교사');
    sh.getRange(1, 1, 1, 10).setValues(header);
    sh.setFrozenRows(1);
    sh.getRange('A2:A30').insertCheckboxes();
    sh.getRange('I2:I30').insertCheckboxes();
    for (let i = 0; i < 3; i++) makeTeacherInvite();
  } else {
    sh.getRange(1, 1, 1, 10).setValues(header);   // 예전 탭이면 머리글만 최신으로
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
function makeTeacherInvite() {
  const sh = SpreadsheetApp.getActive().getSheetByName('교사');
  if (!sh) return setupOffice();
  const code = 'T-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase();
  const rows = sh.getDataRange().getValues();
  let r = rows.findIndex((row, i) => i > 0 && !row[1]);
  r = r < 0 ? rows.length + 1 : r + 1;
  sh.getRange(r, 1, 1, 2).setValues([[true, code]]);
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
      .addToUi();
  } catch (e) { /* 편집기에서 실행 시 무시 */ }
}

/* ---------- 요청 처리 ---------- */

function officeHandle_(body) {
  const a = String(body.action || '').replace('office.', '');
  try {
    switch (a) {
      case 'list': return officeList_();
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
function me_(t) { return { id: tid_(t.code), name: t.name, seat: t.seat, animal: t.animal, color: t.color, glasses: t.glasses, closed: t.closed }; }

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
  const failKey = 'tfail_' + sha_(code + '|' + name).slice(0, 16);
  const fails = Number(cache.get(failKey) || 0);
  if (fails >= 5) return { error: '여러 번 틀렸어요. 10분 뒤에 다시 시도해 주세요.' };
  const t = teachers_().filter((x) => x.on && x.hash && x.code === code && x.name === name)[0];
  if (!t || t.hash !== pwHash_(t.code, String(b.password || ''))) {
    cache.put(failKey, String(fails + 1), 600);
    return { error: '초대코드, 닉네임, 비밀번호 중에 맞지 않는 게 있어요.' };
  }
  cache.remove(failKey);
  return { token: newSession_(t), me: me_(t) };
}

/** 교무실 자리 현황 (누구나 볼 수 있음: 이름·동물·상담 가능 여부만) */
function officeList_() {
  const cache = CacheService.getScriptCache();
  const now = Date.now();
  return {
    seats: teachers_().filter((t) => t.on && t.hash).map((t) => {
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
  const target = officeList_().seats.filter((s) => s.id === b.to)[0];
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
