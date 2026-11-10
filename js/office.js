// 교무실 — 학생 ↔ 선생님, 선생님 ↔ 선생님 1:1 대화 (Apps Script Office.gs)
// 대화는 서버의 임시 저장소에만 있고, 어느 한쪽이 '끝내기'를 누르면 바로 지워짐.
import { CONFIG } from './config.js';
import { schoolCode, setSchool } from './school.js';
import * as Room from './room.js';
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
  const res = await fetch(CONFIG.CHATBOT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ school: schoolCode(), ...body }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const out = await res.json();
  if (out && out.relogin && teacher) { logout(true); ctx.toast('선생님 로그인이 끝났어요. 다시 로그인해 주세요.'); }
  return out;
}

export const isTeacher = () => !!teacher;
/** 교무실 선생님 현황 (접속 여부 포함) */
export const teacherSeats = () => seats;
export const teacherToken = () => (teacher ? teacher.token : '');
/** 관리자 선생님 (초대코드가 Office.gs ADMIN_CODES에 있는 선생님) */
export const isAdmin = () => !!(teacher && teacher.me && teacher.me.admin);
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
export async function askTeacher({ text, subject, teacherName } = {}) {
  if (!CONFIG.CHATBOT_URL) return ctx.toast('아직 교무실이 연결되지 않았어요');
  await refreshSeats();
  const pre = text ? (subject ? `[${subject}] ` : '') + text : '';
  // 과목 담당 선생님이 정해져 있으면 바로 연결 (시험 출제 중이면 다른 선생님 목록)
  let note = '';
  if (teacherName) {
    const t = seats.find((x) => x.name === teacherName);
    if (t && !t.closed && !(teacher && t.id === teacher.me.id)) return tapSeat(t.seat, null, { prefill: pre, viaBot: true });
    note = t ? `담당 ${esc(teacherName)} 선생님은 지금 시험 출제 중이에요. 다른 선생님께 물어볼까요?` : '';
  }
  const list = seats.filter((x) => !(teacher && x.id === teacher.me.id));
  const m = ctx.openModal(`
    <h2>👩‍🏫 어느 선생님께 물어볼까요?</h2>
    <p class="desc">${note || '고른 선생님께 알림이 가요. 방금 챗봇에게 한 질문을 그대로 보낼 수 있어요.'}</p>
    <div class="todo-pick" id="askList">${list.length ? list.map((x) => `
      <button type="button" class="todo-opt" data-seat="${x.seat}" ${x.closed ? 'disabled' : ''}>
        <span class="o-ava big">${animalById(x.animal).emoji}</span>
        <span style="flex:1"><div class="t">${esc(x.name)} 선생님</div><div class="m">${x.closed ? '📝 시험 출제 중 · 지금은 질문을 받지 않아요' : x.online ? '🟢 상담 가능 · 바로 답해 주실 수 있어요' : '⚪ 부재중 · 메시지를 남기면 알림이 가요'}</div></span>
      </button>`).join('') : '<span class="hint">아직 등록한 선생님이 없어요</span>'}</div>
    <div class="foot"><button class="btn ghost" id="askCancel" type="button">닫기</button></div>`);
  m.querySelector('#askCancel').onclick = ctx.closeModal;
  m.querySelectorAll('[data-seat]').forEach((b) => (b.onclick = async () => {
    ctx.closeModal();
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
    ctx.world.setObserver(true); // 선생님은 캐릭터 없이 구경
  }
  $('oClose').onclick = minimize;
  $('oEnd').onclick = endConv;
  $('oSend').onclick = send;
  $('oBlock').onclick = blockStudent;
  $('oReport').onclick = reportStudent;
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
    if (!CONFIG.CHATBOT_URL) ctx.toast('아직 교무실이 연결되지 않았어요');
    else ctx.toast(teacher ? '챗봇 선생님들이 있는 교무실이에요. 눌러서 직접 시험해 볼 수 있어요' : '과목에 맞는 챗봇 선생님 책상을 눌러 질문해요 🙋');
  }
}

async function refreshSeats() {
  try {
    const r = await api({ action: 'office.list' });
    if (r && r.seats) {
      seats = r.seats;
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
  $('oAva').textContent = w ? (conv.student ? animalById(w.animal).emoji : '👩‍🏫') : '🏫';
  $('oName').textContent = w ? w.name + (w.student ? '' : (w.name.endsWith('학생') ? '' : ' 선생님')) : '교무실';
  $('oStatus').textContent = conv && conv.ended ? '대화가 끝났어요' : w && w.online === false ? '⚪ 부재중 · 메시지를 남겨 두세요' : '🟢 대화 중';
  $('oBlock').classList.toggle('hidden', !(isAdmin() && conv && conv.student)); // 차단은 관리자만
  $('oReport').classList.toggle('hidden', !(teacher && !isAdmin() && conv && conv.student && !conv.ended)); // 일반 선생님은 관리자에게 알리기
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
  if (!m.mine) row.innerHTML = `<span class="o-ava">${conv.student ? animalById(conv.with.animal).emoji : '👩‍🏫'}</span>`;
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
  setTimeout(takeCall, 500);
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

async function reportStudent() {
  if (!teacher || !conv || !conv.student) return;
  const reason = prompt('관리자 선생님께 알릴 이유를 적어 주세요. (예: 욕설, 장난 메시지 반복)\n이 학생의 최근 메시지 5개까지가 관리자에게 전달되고, 관리자가 차단할지 정해요.');
  if (reason === null) return;
  const r = await api({ action: 'office.report', token: teacher.token, conv: conv.conv, reason }).catch(() => ({ error: '연결하지 못했어요' }));
  if (r.error) return ctx.toast(r.error);
  ctx.toast('관리자 선생님께 알렸어요. 대화를 끝내도 괜찮아요.');
}

/* ---------- 관리자 메뉴: 신고 · 차단 · 선생님 ---------- */
let adminTab = 'reports';
export async function openAdminMenu() {
  if (!isAdmin()) return;
  const m = ctx.openModal(`
    <h2>🛠️ 관리자 메뉴</h2>
    <div class="tabs">
      <button type="button" class="tab" data-t="reports">🚨 신고</button>
      <button type="button" class="tab" data-t="blocks">🚫 차단</button>
      <button type="button" class="tab" data-t="teachers">👩‍🏫 선생님</button>
    </div>
    <div id="admBody" class="adm-body"><p class="hint">불러오는 중…</p></div>
    <div class="foot"><button class="btn primary" id="admClose" type="button">닫기</button></div>`, { wide: true });
  m.querySelector('#admClose').onclick = ctx.closeModal;
  let data = null;
  const call = async (body, okMsg) => {
    const r = await api({ action: 'office.admin', token: teacher.token, ...body }).catch(() => ({ error: '연결하지 못했어요' }));
    if (r.error) { ctx.toast(r.error); return null; }
    if (okMsg) ctx.toast(okMsg);
    return r;
  };
  const load = async () => { data = await call({ op: 'overview' }); render(); };
  const fmt = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
  const render = () => {
    m.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === adminTab));
    const box = m.querySelector('#admBody');
    if (!box || !data) return;
    if (adminTab === 'reports') {
      box.innerHTML = data.reports.length ? data.reports.map((x) => `
        <div class="adm-card ${x.status === '새 신고' ? 'new' : ''}">
          <div class="adm-top"><b>${esc(x.nick)}</b> 학생 <span class="hint">· ${esc(x.teacher)} 선생님이 알림 · ${fmt(x.t)}</span><span class="adm-st">${esc(x.status)}</span></div>
          <div class="adm-reason">이유: ${esc(x.reason)}</div>
          ${x.msgs ? `<div class="adm-msgs">${esc(x.msgs)}</div>` : ''}
          ${x.status === '새 신고' ? `<div class="adm-act"><button class="btn soft" data-dismiss="${x.row}" type="button">넘어가기</button><button class="btn primary" data-block="${x.row}" type="button">🚫 차단하기</button></div>` : ''}
        </div>`).join('') : '<p class="hint">들어온 신고가 없어요 🌿</p>';
      box.querySelectorAll('[data-block]').forEach((b) => (b.onclick = async () => {
        if (!confirm('이 학생 기기를 차단할까요? 그 기기에서는 교무실 대화를 열 수 없어요.')) return;
        if (await call({ op: 'blockReport', row: Number(b.dataset.block) }, '차단했어요')) load();
      }));
      box.querySelectorAll('[data-dismiss]').forEach((b) => (b.onclick = async () => { if (await call({ op: 'dismissReport', row: Number(b.dataset.dismiss) })) load(); }));
    } else if (adminTab === 'blocks') {
      box.innerHTML = '<p class="hint">차단된 기기는 교무실 대화를 열 수 없어요. 풀면 다시 열 수 있어요.</p>' + (data.blocks.length ? data.blocks.map((x) => `
        <div class="adm-card"><div class="adm-top"><b>${esc(x.nick || '(닉네임 없음)')}</b><span class="hint">· ${esc(x.by)} · ${fmt(x.t)}</span>
          <button class="btn soft adm-mini" data-unblock="${x.row}" data-nick="${esc(x.nick)}" type="button">풀기</button></div></div>`).join('') : '<p class="hint">차단된 학생이 없어요</p>');
      box.querySelectorAll('[data-unblock]').forEach((b) => (b.onclick = async () => {
        if (!confirm(`'${b.dataset.nick}' 차단을 풀까요?`)) return;
        if (await call({ op: 'unblock', row: Number(b.dataset.unblock), nick: b.dataset.nick }, '차단을 풀었어요')) load();
      }));
    } else {
      box.innerHTML = `<button class="btn soft block" id="admInvite" type="button">➕ 새 초대코드 만들기</button>
        <p class="hint">초대코드를 선생님께 한 명에 하나씩 알려 주세요. 선생님은 독서실 ⚙️ 설정 → 선생님 로그인 → 처음 등록에서 써요.</p>` +
        data.teachers.map((x) => `
        <div class="adm-card ${x.on ? '' : 'off'}">
          <div class="adm-top"><b>${x.registered ? esc(x.name) : '(아직 등록 전)'}</b> ${x.admin ? '<span class="adm-st">관리자</span>' : ''}
            <span class="hint">· <code>${esc(x.code)}</code>${x.registered ? ` · 기기 ${x.devices}대 ${x.online ? '· 🟢 접속 중' : ''}` : ''}${x.on ? '' : ' · 꺼짐'}</span></div>
          ${x.admin ? '' : `<div class="adm-act">
            <button class="btn soft adm-mini" data-tog="${x.row}" data-code="${esc(x.code)}" data-on="${x.on ? 0 : 1}" type="button">${x.on ? '끄기 (권한 빼기)' : '다시 켜기'}</button>
            ${x.registered ? `<button class="btn soft adm-mini" data-out="${x.row}" data-code="${esc(x.code)}" type="button">모든 기기 로그아웃</button>
            <button class="btn soft adm-mini" data-reset="${x.row}" data-code="${esc(x.code)}" data-name="${esc(x.name)}" type="button">비밀번호 초기화</button>` : ''}
          </div>`}
        </div>`).join('');
      box.querySelector('#admInvite').onclick = async () => {
        const r = await call({ op: 'newInvite' });
        if (!r) return;
        try { await navigator.clipboard.writeText(r.code); } catch (e) {}
        alert('새 초대코드: ' + r.code + '\n(복사해 두었어요. 선생님께 알려 주세요)');
        load();
      };
      box.querySelectorAll('[data-tog]').forEach((b) => (b.onclick = async () => {
        const on = b.dataset.on === '1';
        if (!on && !confirm('이 선생님 권한을 뺄까요? 바로 로그인할 수 없게 돼요.')) return;
        if (await call({ op: 'toggleTeacher', row: Number(b.dataset.tog), code: b.dataset.code, on }, on ? '다시 켰어요' : '권한을 뺐어요')) load();
      }));
      box.querySelectorAll('[data-out]').forEach((b) => (b.onclick = async () => {
        if (await call({ op: 'logoutTeacher', row: Number(b.dataset.out), code: b.dataset.code }, '모든 기기에서 로그아웃시켰어요')) load();
      }));
      box.querySelectorAll('[data-reset]').forEach((b) => (b.onclick = async () => {
        if (!confirm(`'${b.dataset.name}' 선생님 비밀번호를 초기화할까요?\n닉네임·비밀번호가 지워지고, 같은 초대코드(${b.dataset.code})로 '처음 등록'을 다시 하면 돼요.`)) return;
        if (await call({ op: 'resetTeacher', row: Number(b.dataset.reset), code: b.dataset.code }, '초기화했어요. 같은 초대코드로 다시 등록하면 돼요')) load();
      }));
    }
  };
  m.querySelectorAll('.tab').forEach((b) => (b.onclick = () => { adminTab = b.dataset.t; render(); }));
  render();
  load();
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
  if (c.fromCall && r.called === false) {
    // 선생님이 건 대화가 아니면(장난 등) 받지 않음
    conv = null; sheetOpen = false; $('officeSheet').classList.add('hidden'); updatePill();
    return;
  }
  if (c.fromCall && r.otherName && c.with.name !== r.otherName) { c.with.name = r.otherName; renderHead(); }
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
    <div id="tCodeBox" class="hidden">
      <label class="lbl">초대코드 <span style="font-weight:400">(처음 등록할 때 한 번만)</span></label>
      <input class="field" id="tCode" maxlength="12" placeholder="예: T-7K2Q9A" autocapitalize="characters" autocomplete="off" />
    </div>
    <label class="lbl">닉네임 (학생에게 보여요)</label>
    <input class="field" id="tName" maxlength="12" placeholder="예: 김민지" />
    <label class="lbl">비밀번호</label>
    <input class="field" id="tPw" type="password" maxlength="40" placeholder="4자 이상" />
    <div id="tReg" class="hidden">
      <label class="lbl">알림 받을 이메일 <span style="font-weight:400">(선택)</span></label>
      <input class="field" id="tEmail" type="email" maxlength="80" placeholder="교무실에 없을 때 질문이 오면 메일로 알려 드려요" />
    </div>
    <p class="hint" id="tKeep">선생님은 캐릭터 없이 독서실을 구경하다가 공부 중인 학생을 눌러 말을 걸 수 있어요. 한 번 로그인하면 이 기기에서는 로그아웃할 때까지 계속 로그인돼 있어요.</p>
    <p class="c-gate-msg" id="tMsg"></p>
    <div class="foot">
      <button class="btn ghost" id="tCancel" type="button">닫기</button>
      <button class="btn primary" id="tGo" type="button">로그인</button>
    </div>`, { wide: true });
  const setTab = (t) => {
    tab = t;
    m.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.t === t));
    m.querySelector('#tReg').classList.toggle('hidden', t !== 'reg');
    m.querySelector('#tCodeBox').classList.toggle('hidden', t !== 'reg');
    m.querySelector('#tGo').textContent = t === 'reg' ? '등록하기' : '로그인';
    m.querySelector('#tMsg').textContent = '';
  };
  m.querySelectorAll('.tab').forEach((b) => (b.onclick = () => setTab(b.dataset.t)));
  m.querySelector('#tCancel').onclick = ctx.closeModal;
  m.querySelector('#tGo').onclick = async () => {
    const msg = m.querySelector('#tMsg');
    const base = { code: tab === 'reg' ? m.querySelector('#tCode').value : '', name: m.querySelector('#tName').value, password: m.querySelector('#tPw').value };
    const body = tab === 'reg'
      ? { action: 'office.register', ...base, email: m.querySelector('#tEmail').value, look }
      : { action: 'office.login', ...base };
    msg.textContent = '확인 중…';
    let r;
    try { r = await api(body); } catch (e) { msg.textContent = '연결하지 못했어요. 인터넷을 확인해 주세요.'; return; }
    if (r.error) { msg.textContent = r.error; return; }
    teacher = { token: r.token, me: r.me };
    lsSet('aistudyroom.teacher', teacher);
    // 선생님 학교로 이 기기를 맞춤 (관리자는 지금 보던 학교 그대로)
    if (r.me.school && (!r.me.admin || !schoolCode()) && r.me.school !== schoolCode()) { setSchool({ code: r.me.school, name: r.me.schoolName, def: r.me.schoolDef }); location.reload(); return; }
    ctx.world.setTeacher(r.me.id);
    ctx.world.setObserver(true);
    ctx.closeModal();
    ctx.toast(`${r.me.name} 선생님, 로그인했어요. 공부 중인 학생을 누르면 말을 걸 수 있어요`);
    ctx.onTeacherChange && ctx.onTeacherChange();
    if (ctx.world.area === 'office' && $('seatLabel')) $('seatLabel').textContent = `${r.me.name} 선생님`;
    try { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); } catch (e) {}
    startTeacherSync();
    await refreshSeats();
  };
  setTimeout(() => m.querySelector('#tName').focus(), 50);
}

/** 선생님 캐릭터·닉네임 바꾸기 */
export function openTeacherProfile() {
  if (!teacher) return;
  const look = lookOf(teacher.me);
  const m = ctx.openModal(`
    <h2>✏️ 닉네임 바꾸기</h2>
    <label class="lbl">닉네임 (학생에게 보여요)</label>
    <input class="field" id="tpName" maxlength="12" value="${esc(teacher.me.name)}" />
    <p class="c-gate-msg" id="tpMsg"></p>
    <div class="foot">
      <button class="btn ghost" id="tpCancel" type="button">닫기</button>
      <button class="btn primary" id="tpSave" type="button">저장</button>
    </div>`, { wide: true });
  m.querySelector('#tpCancel').onclick = ctx.closeModal;
  m.querySelector('#tpSave').onclick = async () => {
    let r;
    try { r = await api({ action: 'office.profile', token: teacher.token, name: m.querySelector('#tpName').value }); } catch (e) { m.querySelector('#tpMsg').textContent = '연결하지 못했어요.'; return; }
    if (r.error) { m.querySelector('#tpMsg').textContent = r.error; return; }
    teacher.me = { ...teacher.me, ...r.me };
    lsSet('aistudyroom.teacher', teacher);
    ctx.closeModal();
    ctx.toast('닉네임을 바꿨어요');
    refreshSeats();
  };
}

export function logout(silent) {
  if (teacher && !silent) api({ action: 'office.logout', token: teacher.token }).catch(() => {});
  teacher = null;
  inbox = [];
  lsSet('aistudyroom.teacher', null);
  ctx.world.setTeacher(null);
  ctx.world.setObserver(false); // 이 기기의 원래(학생) 캐릭터로
  ctx.onTeacherChange && ctx.onTeacherChange();
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
    <p class="desc">${esc(teacher.me.name)} 선생님 · 대화는 끝내면 바로 지워져요</p>
    <button class="btn soft block" id="ibDoor" type="button">${myDoorClosed() ? '🔓 문 열기 (질문 받기)' : '🔒 문 닫기 (시험 출제 중)'}</button>
    <p class="hint">문을 닫으면 학생에게 “시험 출제 중”으로 보이고 새 질문을 받지 않아요. 하던 대화는 그대로예요.</p>
    <button class="btn soft block" id="ibLook" type="button">✏️ 닉네임 바꾸기</button>
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

/* ---------- 선생님 → 학생 말 걸기 ---------- */
export async function callStudent(uid, nick, animal) {
  if (!teacher) return;
  if (!confirm(`${nick} 학생에게 말을 걸까요?\n학생 화면에 "선생님이 말을 걸었어요" 알림이 떠요.`)) return;
  let r;
  try { r = await api({ action: 'office.call', token: teacher.token, nick, animal }); } catch (e) { return ctx.toast('연결하지 못했어요'); }
  if (r.error) return ctx.toast(r.error);
  // 대화 열쇠를 실시간 연결로 학생에게 바로 전달
  try { await Room.sendCall(uid, { conv: r.conv, key: r.key, name: r.name, id: r.id }); } catch (e) { return ctx.toast('학생에게 전달하지 못했어요. 잠시 후 다시 해 주세요'); }
  if (conv && !conv.ended) await endConv(true);
  conv = { conv: r.conv, key: null, with: { ...r.with }, toId: null, since: 0, ended: false, student: true };
  $('oLog').innerHTML = '';
  note(`${nick} 학생에게 말을 걸었어요. 학생 화면에 바로 알림이 떠요.`);
  openSheet();
  startPoll();
}

/** 학생: 선생님이 건 대화 받기 */
const pendingCalls = [];
export async function receiveCalls(calls) {
  for (const c of calls) {
    // 서버에서 '선생님이 건 대화'가 맞는지 먼저 확인 (친구가 장난으로 보낸 가짜는 무시)
    let r = null;
    try { r = await api({ action: 'office.sync', conv: c.conv, key: c.key, since: 0 }); } catch (e) { continue; }
    if (!r || r.error || r.ended || r.called !== true) continue;
    pendingCalls.push({ ...c, name: r.otherName || c.name });
  }
  takeCall();
}
function takeCall() {
  if (conv && !conv.ended) return; // 지금 대화가 끝나면 이어서
  const c = pendingCalls.shift();
  if (!c) return;
  conv = { conv: c.conv, key: c.key, with: { name: c.name, animal: 'bear', online: true }, toId: c.id, since: 0, ended: false, student: false, fromCall: true };
  $('oLog').innerHTML = '';
  note(`${c.name} 선생님이 말을 걸었어요 🙋`);
  ctx.toast(`💬 ${c.name} 선생님이 말을 걸었어요`);
  notify(`${c.name} 선생님`, '숲속 독서실에서 선생님이 말을 걸었어요');
  conv.unread = 1;
  sheetOpen = false;
  updatePill();
  startPoll();
}
