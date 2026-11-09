// 교무실 — 학생 ↔ 선생님, 선생님 ↔ 선생님 1:1 대화 (Apps Script Office.gs)
// 대화는 서버의 임시 저장소에만 있고, 어느 한쪽이 '끝내기'를 누르면 바로 지워짐.
import { CONFIG } from './config.js';
import { animalById, ANIMALS } from './store.js';

const TEACHER_COLORS = ['#B79CE8', '#7FB3E8', '#9ED28C', '#F59FB4', '#F7C96B', '#5E6B7D'];
const lookOf = (me) => ({ animal: me.animal || 'bear', color: me.color || '#B79CE8', glasses: !!me.glasses, name: me.name });

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let ctx = null;            // { world, toast, openModal, closeModal, getProfile, renderBar }
let teacher = null;        // { token, me: { id, name, seat, animal } }
let seats = [];            // 교무실 자리 현황
let conv = null;           // 지금 대화 { conv, key, with: { name, animal, online }, since, ended }
let sheetOpen = false;
let pollTimer = null;
let seatTimer = null;
let inbox = [];
let lastUnread = 0;
let sending = false;
let allClosed = false;     // 모든 선생님이 문을 닫음 → 교무실에 들어갈 수 없음

function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function deviceId() {
  let id = '';
  try { id = localStorage.getItem('aistudyroom.device') || ''; } catch (e) {}
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem('aistudyroom.device', id); } catch (e) {}
  }
  return id;
}

async function api(body) {
  if (!CONFIG.CHATBOT_URL) throw new Error('no url');
  const res = await fetch(CONFIG.CHATBOT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const out = await res.json();
  if (out && out.relogin && teacher) { logout(true); ctx.toast('선생님 로그인이 끝났어요. 다시 로그인해 주세요.'); }
  return out;
}

export const isTeacher = () => !!teacher;
/** 선생님이 아무도 없을 때 문을 누르면 */
export function confirmClosed() {
  // 교무실에는 질문 챗봇이 있어서 언제나 들어갈 수 있음 (선생님 자리만 '시험 출제 중')
  if (!teacher) ctx.toast(allClosed ? '📝 선생님들은 시험 출제 중이에요. 질문 코너의 챗봇에게 물어봐요 🐾' : '선생님은 자리에 안 계시지만, 챗봇에게 먼저 물어볼 수 있어요 🐾');
  return true;
}

/**
 * 챗봇 대화창의 [선생님께 물어보기] → 선생님 고르기 → 교무실 대화 (이때 선생님께 알림)
 * prefill: 방금 챗봇에게 한 질문 (입력칸에 미리 넣어 둠)
 */
export async function askTeacher({ text, subject } = {}) {
  if (!CONFIG.CHATBOT_URL) return ctx.toast('아직 교무실이 연결되지 않았어요');
  await refreshSeats();
  const list = seats.filter((x) => !(teacher && x.id === teacher.me.id));
  const m = ctx.openModal(`
    <h2>👩‍🏫 어느 선생님께 물어볼까요?</h2>
    <p class="desc">고른 선생님께 알림이 가요. 방금 챗봇에게 한 질문을 그대로 보낼 수 있어요.</p>
    <div class="todo-pick" id="askList">${list.length ? list.map((x) => `
      <button type="button" class="todo-opt" data-seat="${x.seat}" ${x.closed ? 'disabled' : ''}>
        <span class="o-ava big">${animalById(x.animal).emoji}</span>
        <span style="flex:1"><div class="t">${esc(x.name)} 선생님</div><div class="m">${x.closed ? '📝 시험 출제 중 · 지금은 질문을 받지 않아요' : x.online ? '🟢 상담 가능 · 바로 답해 주실 수 있어요' : '⚪ 부재중 · 메시지를 남기면 알림이 가요'}</div></span>
      </button>`).join('') : '<span class="hint">아직 등록한 선생님이 없어요</span>'}</div>
    <div class="foot"><button class="btn ghost" id="askCancel" type="button">닫기</button></div>`);
  m.querySelector('#askCancel').onclick = ctx.closeModal;
  m.querySelectorAll('[data-seat]').forEach((b) => (b.onclick = async () => {
    ctx.closeModal();
    const pre = text ? (subject ? `[${subject}] ` : '') + text : '';
    await tapSeat(Number(b.dataset.seat), null, { prefill: pre, viaBot: true });
  }));
}
export const teacherName = () => (teacher ? teacher.me.name : '');
/** 내(선생님) 문이 닫혀 있는지 */
export const myDoorClosed = () => {
  if (!teacher) return false;
  const mine = seats.find((x) => x.id === teacher.me.id);
  return mine ? !!mine.closed : !!teacher.me.closed;
};
/** 선생님: 내 문 열기/닫기 */
export async function toggleDoor() {
  if (!teacher) return;
  const closed = !myDoorClosed();
  let r;
  try { r = await api({ action: 'office.door', token: teacher.token, closed }); } catch (e) { return ctx.toast('바꾸지 못했어요. 다시 해 주세요'); }
  if (r.error) return ctx.toast(r.error);
  teacher.me.closed = closed;
  lsSet('aistudyroom.teacher', teacher);
  await refreshSeats();
  ctx.toast(closed ? '🔒 문을 닫았어요. 학생에게 “시험 출제 중”으로 보여요' : '🔓 문을 열었어요. 학생 질문을 받을 수 있어요');
  if ($('ibDoor')) $('ibDoor').textContent = closed ? '🔓 문 열기 (질문 받기)' : '🔒 문 닫기 (시험 출제 중)';
}
export const unreadCount = () => inbox.reduce((a, x) => a + (x.unread || 0), 0);

export function initOffice(c) {
  ctx = c;
  teacher = lsGet('aistudyroom.teacher');
  if (teacher) {
    ctx.world.setTeacher(teacher.me.id);
    ctx.world.setTeacherLook(lookOf(teacher.me)); // 로그인한 기기는 선생님 캐릭터로
  }
  $('oClose').onclick = minimize;
  $('oEnd').onclick = endConv;
  $('oSend').onclick = send;
  $('oBlock').onclick = blockStudent;
  $('officePill').onclick = () => (conv ? openSheet() : openInbox());
  const input = $('oInput');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 110) + 'px'; });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) { e.preventDefault(); send(); }
  });
  if (teacher) startTeacherSync();
  if (CONFIG.CHATBOT_URL) onArea('main');
  updatePill();
}

/* ---------- 교무실 들어가고 나오기 ---------- */
export function onArea(name) {
  clearInterval(seatTimer);
  if (name !== 'office') {
    // 공부방에서는 가끔 확인해서 교무실 문(열림 / 시험 출제 중)만 바꿈
    refreshSeats();
    seatTimer = setInterval(refreshSeats, 30000);
    return;
  }
  if (name === 'office') {
    refreshSeats();
    seatTimer = setInterval(refreshSeats, 8000);
    if (teacher) refreshSeats().then(() => ctx.world.sitAtMyDesk());
    if (!CONFIG.CHATBOT_URL) ctx.toast('아직 교무실이 연결되지 않았어요');
    else ctx.toast(teacher ? `${teacher.me.name} 선생님, 어서 오세요! 내 자리를 눌러 앉아요` : '선생님 자리를 누르면 질문할 수 있어요 🙋');
  }
}

async function refreshSeats() {
  try {
    const r = await api({ action: 'office.list' });
    if (r && r.seats) {
      seats = r.seats;
      ctx.world.setOfficeSeats(seats);
      ctx.world.setOfficeOpen(seats.some((x) => x.online && !x.closed));
      allClosed = seats.length > 0 && seats.every((x) => x.closed);
      ctx.renderBar && ctx.renderBar();
    }
  } catch (e) { /* 다음에 다시 */ }
}

/* ---------- 학생: 선생님 자리 누르기 ---------- */
export async function tapSeat(n, t, opt = {}) {
  const fresh = seats.find((x) => x.seat === n) || t;
  if (!fresh) return ctx.toast('비어 있는 자리예요');
  if (teacher && fresh.id === teacher.me.id) return;
  if (fresh.closed && !teacher) return ctx.toast(`📝 ${fresh.name} 선생님은 시험 출제 중이에요. 질문 코너의 챗봇에게 물어봐요 🐾`);
  // 학생이 선생님 자리를 바로 누르면: 챗봇에게 먼저 물어보길 권함
  if (!teacher && !opt.viaBot && !(conv && !conv.ended && conv.toId === fresh.id)
    && !confirm(`${fresh.name} 선생님께 바로 물어볼까요?\n질문 코너의 챗봇에게 먼저 물어보면 더 빨리 답을 받을 수 있어요.\n(확인을 누르면 선생님께 알림이 가요)`)) return;
  if (conv && !conv.ended && conv.toId === fresh.id) return openSheet();
  if (conv && !conv.ended && !confirm(`지금 ${conv.with.name} 선생님과의 대화를 끝내고 ${fresh.name} 선생님께 질문할까요?\n(끝낸 대화는 바로 지워져요)`)) return;
  if (conv && !conv.ended) await endConv(true);
  if (!fresh.online && !opt.viaBot && !confirm(`${fresh.name} 선생님은 지금 부재중이에요.\n메시지를 남기면 선생님께 알림이 가요. 남길까요?`)) return;
  const p = ctx.getProfile();
  try {
    const r = await api(teacher
      ? { action: 'office.open', token: teacher.token, to: fresh.id }
      : { action: 'office.open', device: deviceId(), nick: p.name || '학생', animal: p.animal, to: fresh.id });
    if (r.error) return ctx.toast(r.error);
    conv = { conv: r.conv, key: r.key, with: r.with, toId: fresh.id, since: 0, ended: false, student: false };
    $('oLog').innerHTML = '';
    note(teacher ? `${fresh.name} 선생님과 대화를 시작했어요.` : `${fresh.name} 선생님께 궁금한 걸 물어보세요. 선생님이 ${fresh.online ? '곧 답해 주실 거예요' : '확인하시면 답해 주실 거예요'}.`);
    openSheet();
    if (opt.prefill) { $('oInput').value = opt.prefill; $('oInput').dispatchEvent(new Event('input')); }
    startPoll();
  } catch (e) {
    ctx.toast('교무실에 연결하지 못했어요');
  }
}

/* ---------- 대화창 ---------- */
function renderHead() {
  const w = conv ? conv.with : null;
  $('oAva').textContent = w ? animalById(w.animal).emoji : '🏫';
  $('oName').textContent = w ? w.name + (w.student ? '' : (w.name.endsWith('학생') ? '' : ' 선생님')) : '교무실';
  $('oStatus').textContent = conv && conv.ended ? '대화가 끝났어요' : w && w.online === false ? '⚪ 부재중 · 메시지를 남겨 두세요' : '🟢 대화 중';
  $('oBlock').classList.toggle('hidden', !(teacher && conv && conv.student));
  const off = !conv || conv.ended;
  $('oInput').disabled = off;
  $('oSend').disabled = off || sending;
}
function openSheet() {
  if (!conv) return;
  sheetOpen = true;
  $('officeSheet').classList.remove('hidden');
  renderHead();
  updatePill();
  startPoll();
  setTimeout(() => $('oInput').focus(), 50);
}
function minimize() {
  sheetOpen = false;
  $('officeSheet').classList.add('hidden');
  updatePill();
  if (conv && conv.ended) { conv = null; updatePill(); }
  startPoll();
}
function bubble(m) {
  const row = document.createElement('div');
  row.className = 'c-row ' + (m.mine ? 'me' : 'bot');
  if (!m.mine) row.innerHTML = `<span class="o-ava">${animalById(conv.with.animal).emoji}</span>`;
  const div = document.createElement('div');
  div.className = 'c-msg';
  div.innerHTML = esc(m.text).replace(/\n/g, '<br>');
  row.appendChild(div);
  $('oLog').appendChild(row);
  $('oLog').scrollTop = $('oLog').scrollHeight;
}
function note(t) {
  const d = document.createElement('div');
  d.className = 'c-note o-note';
  d.textContent = t;
  $('oLog').appendChild(d);
  $('oLog').scrollTop = $('oLog').scrollHeight;
}

async function send() {
  const input = $('oInput');
  const text = input.value.trim();
  if (!conv || conv.ended || !text || sending) return;
  sending = true;
  renderHead();
  try {
    const r = await api({ action: 'office.send', conv: conv.conv, key: conv.key, token: teacher && teacher.token, text });
    if (r.error) {
      if (r.ended) { conv.ended = true; note('대화가 끝났어요.'); }
      else ctx.toast(r.error);
    } else {
      input.value = '';
      input.style.height = 'auto';
      await poll();
    }
  } catch (e) {
    ctx.toast('보내지 못했어요. 다시 보내 주세요');
  }
  sending = false;
  renderHead();
}

async function endConv(silent) {
  if (!conv) return;
  if (!conv.ended && silent !== true && !confirm('대화를 끝낼까요? 끝내면 대화 내용이 바로 지워져요.')) return;
  const c = conv;
  conv = null;
  clearTimeout(pollTimer);
  $('officeSheet').classList.add('hidden');
  sheetOpen = false;
  updatePill();
  if (!c.ended) try { await api({ action: 'office.close', conv: c.conv, key: c.key, token: teacher && teacher.token }); } catch (e) {}
  if (silent !== true) ctx.toast('대화를 끝냈어요. 내용은 지워졌어요 🧹');
  if (teacher) syncTeacher();
}

async function blockStudent() {
  if (!teacher || !conv || !conv.student) return;
  if (!confirm('이 학생을 차단할까요? 대화가 끝나고, 이 기기에서는 교무실 대화를 열 수 없어요.')) return;
  const r = await api({ action: 'office.block', token: teacher.token, conv: conv.conv }).catch(() => ({ error: '연결 실패' }));
  if (r.error) return ctx.toast(r.error);
  conv.ended = true;
  await endConv(true);
  ctx.toast('차단했어요');
}

/* ---------- 새 메시지 가져오기 ---------- */
function startPoll() {
  clearTimeout(pollTimer);
  if (!conv || conv.ended) return;
  pollTimer = setTimeout(async () => { await poll(); startPoll(); }, sheetOpen ? 3000 : 8000);
}
async function poll() {
  if (!conv || conv.ended) return;
  const c = conv;
  let r;
  try { r = await api({ action: 'office.sync', conv: c.conv, key: c.key, token: teacher && teacher.token, since: c.since }); } catch (e) { return; }
  if (conv !== c) return;
  if (r.ended) {
    c.ended = true;
    note('상대가 대화를 끝냈어요. 대화 내용은 지워졌어요.');
    renderHead();
    updatePill();
    return;
  }
  if (r.error) return;
  if (typeof r.otherOnline === 'boolean' && c.with) c.with.online = r.otherOnline;
  let fresh = 0;
  for (const m of r.msgs || []) {
    if (m.i <= c.since) continue;
    c.since = m.i;
    bubble(m);
    if (!m.mine) fresh++;
  }
  if (fresh && !sheetOpen) {
    c.unread = (c.unread || 0) + fresh;
    ctx.toast(`💬 ${c.with.name}${teacher ? '' : ' 선생님'}의 답장이 왔어요`);
    notify(`${c.with.name}${teacher ? '' : ' 선생님'}의 메시지`, '숲속 독서실 교무실에서 확인해 주세요');
  }
  if (sheetOpen) c.unread = 0;
  renderHead();
  updatePill();
}

function updatePill() {
  const pill = $('officePill');
  const tUnread = teacher ? unreadCount() : 0;
  if (conv && !sheetOpen) {
    pill.classList.remove('hidden');
    pill.innerHTML = `💬 ${esc(conv.with.name)}${teacher || conv.student ? '' : ' 선생님'}${conv.unread ? ` <b class="dot">${conv.unread}</b>` : ''}`;
  } else if (teacher && tUnread && !sheetOpen) {
    pill.classList.remove('hidden');
    pill.innerHTML = `📥 새 메시지 <b class="dot">${tUnread}</b>`;
  } else {
    pill.classList.add('hidden');
  }
  ctx.renderBar && ctx.renderBar();
}

function notify(title, body) {
  try {
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification(title, { body, icon: 'assets/mascot.png' });
  } catch (e) {}
}

/* ---------- 선생님 ---------- */
/** 선생님 캐릭터 고르기 (동물 · 옷 색 · 안경) */
function lookPicker(look) {
  return `
    <div class="animals small">${ANIMALS.map((x) => `<button type="button" class="animal-btn ${x.id === look.animal ? 'on' : ''}" data-a="${x.id}">${x.emoji}<small>${x.name}</small></button>`).join('')}</div>
    <label class="lbl">옷 색</label>
    <div class="swatches">${TEACHER_COLORS.map((c) => `<button type="button" class="sw-btn ${c === look.color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="옷 색"></button>`).join('')}
      <label class="glasses-tg"><input type="checkbox" id="lkGlasses" ${look.glasses ? 'checked' : ''}/> 👓 안경</label></div>
    <p class="hint">선생님 캐릭터는 <b>교사증 목걸이</b>를 걸고 있어서 학생과 구분돼요.</p>`;
}
function bindLookPicker(root, look) {
  root.querySelectorAll('.animal-btn').forEach((b) => (b.onclick = () => {
    look.animal = b.dataset.a;
    root.querySelectorAll('.animal-btn').forEach((x) => x.classList.toggle('on', x === b));
  }));
  root.querySelectorAll('.sw-btn').forEach((b) => (b.onclick = () => {
    look.color = b.dataset.c;
    root.querySelectorAll('.sw-btn').forEach((x) => x.classList.toggle('on', x === b));
  }));
  root.querySelector('#lkGlasses').onchange = (e) => { look.glasses = e.target.checked; };
}

export function openTeacherLogin() {
  let tab = 'login';
  const look = { animal: 'deer', color: TEACHER_COLORS[0], glasses: true };
  const m = ctx.openModal(`
    <h2>👩‍🏫 선생님 로그인</h2>
    <div class="tabs"><button type="button" class="tab on" data-t="login">로그인</button><button type="button" class="tab" data-t="reg">처음 등록</button></div>
    <label class="lbl">초대코드</label>
    <input class="field" id="tCode" maxlength="12" placeholder="예: T-7K2Q9A" autocapitalize="characters" autocomplete="off" />
    <label class="lbl">닉네임 (학생에게 보여요)</label>
    <input class="field" id="tName" maxlength="12" placeholder="예: 김민지" />
    <label class="lbl">비밀번호</label>
    <input class="field" id="tPw" type="password" maxlength="40" placeholder="4자 이상" />
    <div id="tReg" class="hidden">
      <label class="lbl">알림 받을 이메일 <span style="font-weight:400">(선택)</span></label>
      <input class="field" id="tEmail" type="email" maxlength="80" placeholder="교무실에 없을 때 질문이 오면 메일로 알려 드려요" />
      <label class="lbl">선생님 캐릭터</label>
      ${lookPicker(look)}
    </div>
    <p class="hint" id="tKeep">한 번 로그인하면 이 기기에서는 로그아웃할 때까지 계속 로그인돼 있어요.</p>
    <p class="c-gate-msg" id="tMsg"></p>
    <div class="foot">
      <button class="btn ghost" id="tCancel" type="button">닫기</button>
      <button class="btn primary" id="tGo" type="button">로그인</button>
    </div>`, { wide: true });
  bindLookPicker(m, look);
  const setTab = (t) => {
    tab = t;
    m.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    m.querySelector('#tReg').classList.toggle('hidden', t !== 'reg');
    m.querySelector('#tGo').textContent = t === 'reg' ? '등록하기' : '로그인';
    m.querySelector('#tMsg').textContent = '';
  };
  m.querySelectorAll('.tab').forEach((b) => (b.onclick = () => setTab(b.dataset.t)));
  m.querySelector('#tCancel').onclick = ctx.closeModal;
  m.querySelector('#tGo').onclick = async () => {
    const msg = m.querySelector('#tMsg');
    const base = { code: m.querySelector('#tCode').value, name: m.querySelector('#tName').value, password: m.querySelector('#tPw').value };
    const body = tab === 'reg'
      ? { action: 'office.register', ...base, email: m.querySelector('#tEmail').value, look }
      : { action: 'office.login', ...base };
    msg.textContent = '확인 중…';
    let r;
    try { r = await api(body); } catch (e) { msg.textContent = '연결하지 못했어요. 인터넷을 확인해 주세요.'; return; }
    if (r.error) { msg.textContent = r.error; return; }
    teacher = { token: r.token, me: r.me };
    lsSet('aistudyroom.teacher', teacher);
    ctx.world.setTeacher(r.me.id);
    ctx.world.setTeacherLook(lookOf(r.me));
    ctx.closeModal();
    ctx.toast(`${r.me.name} 선생님, 로그인했어요. ${r.me.seat}번 자리예요`);
    if (ctx.world.area === 'office' && $('seatLabel')) $('seatLabel').textContent = `${r.me.name} 선생님`;
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
    startTeacherSync();
    await refreshSeats();
    if (ctx.world.area === 'office') ctx.world.sitAtMyDesk();
  };
  setTimeout(() => m.querySelector('#tCode').focus(), 50);
}

/** 선생님 캐릭터·닉네임 바꾸기 */
export function openTeacherProfile() {
  if (!teacher) return;
  const look = lookOf(teacher.me);
  const m = ctx.openModal(`
    <h2>🎨 선생님 캐릭터</h2>
    <label class="lbl">닉네임</label>
    <input class="field" id="tpName" maxlength="12" value="${esc(teacher.me.name)}" />
    <label class="lbl">캐릭터</label>
    ${lookPicker(look)}
    <p class="c-gate-msg" id="tpMsg"></p>
    <div class="foot">
      <button class="btn ghost" id="tpCancel" type="button">닫기</button>
      <button class="btn primary" id="tpSave" type="button">저장</button>
    </div>`, { wide: true });
  bindLookPicker(m, look);
  m.querySelector('#tpCancel').onclick = ctx.closeModal;
  m.querySelector('#tpSave').onclick = async () => {
    let r;
    try { r = await api({ action: 'office.profile', token: teacher.token, name: m.querySelector('#tpName').value, look }); } catch (e) { m.querySelector('#tpMsg').textContent = '연결하지 못했어요.'; return; }
    if (r.error) { m.querySelector('#tpMsg').textContent = r.error; return; }
    teacher.me = { ...teacher.me, ...r.me };
    lsSet('aistudyroom.teacher', teacher);
    ctx.world.setTeacherLook(lookOf(teacher.me));
    ctx.closeModal();
    ctx.toast('캐릭터를 바꿨어요');
    refreshSeats();
  };
}

export function logout(silent) {
  if (teacher && !silent) api({ action: 'office.logout', token: teacher.token }).catch(() => {});
  teacher = null;
  inbox = [];
  lsSet('aistudyroom.teacher', null);
  ctx.world.setTeacher(null);
  ctx.world.setTeacherLook(null); // 이 기기의 원래(학생) 캐릭터로
  refreshSeats();
  updatePill();
}

let teacherTimer = null;
function startTeacherSync() {
  clearInterval(teacherTimer);
  syncTeacher();
  teacherTimer = setInterval(syncTeacher, 10000); // 접속 신호 + 받은 대화
}
async function syncTeacher() {
  if (!teacher) return;
  let r;
  try { r = await api({ action: 'office.sync', token: teacher.token }); } catch (e) { return; }
  if (!r || !r.inbox) return;
  inbox = r.inbox;
  const u = unreadCount();
  if (u > lastUnread) {
    const top = inbox.find((x) => x.unread);
    if (top && !(conv && conv.conv === top.conv && sheetOpen)) {
      ctx.toast(`📥 ${top.who}이(가) 메시지를 보냈어요`);
      notify('교무실 새 메시지', `${top.who}이(가) 메시지를 보냈어요`);
    }
  }
  lastUnread = u;
  updatePill();
  if ($('inboxList')) renderInbox();
}

export function openInbox() {
  if (!teacher) return openTeacherLogin();
  const m = ctx.openModal(`
    <h2>📥 받은 대화</h2>
    <p class="desc">${esc(teacher.me.name)} 선생님 · ${teacher.me.seat}번 자리 · 대화는 끝내면 바로 지워져요</p>
    <button class="btn soft block" id="ibDoor" type="button">${myDoorClosed() ? '🔓 문 열기 (질문 받기)' : '🔒 문 닫기 (시험 출제 중)'}</button>
    <p class="hint">문을 닫으면 학생에게 “시험 출제 중”으로 보이고 새 질문을 받지 않아요. 하던 대화는 그대로예요.</p>
    <button class="btn soft block" id="ibLook" type="button">🎨 내 캐릭터·닉네임 바꾸기</button>
    <div class="todo-pick" id="inboxList"></div>
    <label class="lbl">다른 선생님께 메시지</label>
    <div class="chips" id="teacherList"></div>
    <div class="foot">
      <button class="btn ghost" id="ibLogout" type="button">로그아웃</button>
      <button class="btn primary" id="ibClose" type="button">닫기</button>
    </div>`);
  m.querySelector('#ibClose').onclick = ctx.closeModal;
  m.querySelector('#ibDoor').onclick = () => toggleDoor();
  m.querySelector('#ibLook').onclick = () => openTeacherProfile();
  m.querySelector('#ibLogout').onclick = () => { logout(); ctx.closeModal(); ctx.toast('로그아웃했어요'); };
  renderInbox();
  refreshSeats().then(() => {
    const box = m.querySelector('#teacherList');
    if (!box) return;
    const others = seats.filter((x) => x.id !== teacher.me.id);
    box.innerHTML = others.length ? others.map((x) => `<button type="button" class="chip-btn on" data-seat="${x.seat}" style="background:#fff">${animalById(x.animal).emoji} ${esc(x.name)} ${x.online ? '🟢' : '⚪'}</button>`).join('') : '<span class="hint">아직 등록한 다른 선생님이 없어요</span>';
    box.querySelectorAll('[data-seat]').forEach((b) => (b.onclick = () => { ctx.closeModal(); tapSeat(Number(b.dataset.seat)); }));
  });
}
function renderInbox() {
  const box = $('inboxList');
  if (!box) return;
  box.innerHTML = inbox.length ? inbox.map((x) => `
    <button type="button" class="todo-opt" data-conv="${x.conv}">
      <span class="o-ava big">${animalById(x.animal).emoji}</span>
      <span style="flex:1;min-width:0"><div class="t">${esc(x.who)} ${x.unread ? `<b class="dot">${x.unread}</b>` : ''}</div><div class="m">${esc(x.last || '(아직 메시지 없음)')}</div></span>
    </button>`).join('') : '<span class="hint">아직 받은 대화가 없어요</span>';
  box.querySelectorAll('[data-conv]').forEach((b) => (b.onclick = () => openFromInbox(inbox.find((x) => x.conv === b.dataset.conv))));
}
function openFromInbox(x) {
  if (!x) return;
  ctx.closeModal();
  if (!conv || conv.conv !== x.conv) {
    conv = { conv: x.conv, key: null, with: { name: x.who.replace(/ (학생|선생님)$/, ''), animal: x.animal, online: true, student: x.student }, toId: null, since: 0, ended: false, student: x.student };
    if (x.student) conv.with.name = x.who;
    $('oLog').innerHTML = '';
    note(x.student ? `${x.who}의 질문이에요. 대화를 끝내면 내용이 바로 지워져요.` : `${x.who}과의 대화예요.`);
  }
  openSheet();
  poll();
}

/** 이메일 링크(#office)로 들어오면 바로 교무실로 */
export function maybeEnterFromLink() {
  if (location.hash === '#office') {
    setTimeout(() => ctx.world.enterOffice(), 300);
  }
}
