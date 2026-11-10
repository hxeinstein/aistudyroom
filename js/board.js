// 📌 응원 게시판 · 📮 건의함 (Apps Script Office.gs의 board.* / suggest.*)
import { CONFIG } from './config.js';
import { schoolCode } from './school.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const COLORS = ['#FFF3A3', '#FFD3E0', '#CDEFD0', '#CFE3FF', '#FFE0B8', '#E6D7FF'];

let ctx = null; // { world, toast, openModal, closeModal, getProfile(), teacherToken(), isAdmin() }
let notes = [];

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
  const res = await fetch(CONFIG.CHATBOT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ school: schoolCode(), ...body }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.floor(h / 24)}일 전`;
}

export function initBoard(c) {
  ctx = c;
  if (!CONFIG.CHATBOT_URL) return;
  refresh();
  setInterval(refresh, 90000);
}
async function refresh() {
  try {
    const r = await api({ action: 'board.list', device: deviceId() });
    if (r && Array.isArray(r.notes)) {
      notes = r.notes;
      ctx.world.setBoardNotes(notes);
      if ($('boardGrid')) renderGrid();
    }
  } catch (e) { /* 다음에 다시 */ }
}

/* ---------- 응원 게시판 ---------- */
export function openBoard() {
  if (!CONFIG.CHATBOT_URL) return ctx.toast('아직 게시판이 연결되지 않았어요');
  const m = ctx.openModal(`
    <h2>📌 응원 게시판</h2>
    <p class="desc">친구에게 응원 한마디를 붙여 주세요. 친구가 기분 좋아지는 말만! (30일 동안 보여요)</p>
    <button class="btn primary block" id="bdWrite" type="button">✏️ 포스트잇 붙이기</button>
    <div class="note-grid" id="boardGrid"></div>
    <div class="foot"><button class="btn ghost" id="bdClose" type="button">닫기</button></div>`, { wide: true });
  m.querySelector('#bdClose').onclick = ctx.closeModal;
  m.querySelector('#bdWrite').onclick = openNoteForm;
  renderGrid();
  refresh();
}
function renderGrid() {
  const box = $('boardGrid');
  if (!box) return;
  const admin = ctx.isAdmin();   // 남의 포스트잇 떼기는 관리자만
  box.innerHTML = notes.length ? notes.map((n, i) => `
    <div class="note" style="background:${n.color};transform:rotate(${((i * 37) % 7) - 3}deg)">
      ${n.to ? `<div class="note-to">To. ${esc(n.to)}</div>` : ''}
      <div class="note-text">${esc(n.text)}</div>
      <div class="note-from">— ${esc(n.from)} · ${ago(n.t)}</div>
      <div class="note-act">${n.mine || admin ? `<button type="button" data-del="${n.id}">떼기</button>` : `<button type="button" data-rep="${n.id}">신고</button>`}</div>
    </div>`).join('') : '<p class="hint center">아직 포스트잇이 없어요. 첫 응원을 붙여 주세요!</p>';
  box.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => {
    if (!confirm('이 포스트잇을 뗄까요?')) return;
    const r = await api({ action: 'board.delete', id: b.dataset.del, device: deviceId(), token: ctx.teacherToken() }).catch(() => ({ error: '연결하지 못했어요' }));
    if (r.error) return ctx.toast(r.error);
    ctx.toast('포스트잇을 뗐어요');
    refresh();
  }));
  box.querySelectorAll('[data-rep]').forEach((b) => (b.onclick = async () => {
    if (!confirm('이 포스트잇이 불편한가요? 신고가 모이면 숨겨지고 선생님이 확인해요.')) return;
    await api({ action: 'board.report', id: b.dataset.rep, device: deviceId() }).catch(() => {});
    ctx.toast('신고했어요. 고마워요');
    refresh();
  }));
}
function openNoteForm() {
  let color = COLORS[(Math.random() * COLORS.length) | 0];
  const m = ctx.openModal(`
    <h2>✏️ 응원 포스트잇</h2>
    <label class="lbl">받는 친구 <span style="font-weight:400">(선택, 닉네임)</span></label>
    <input class="field" id="ntTo" maxlength="12" placeholder="비우면 모두에게" />
    <label class="lbl">응원 한마디</label>
    <textarea class="field" id="ntText" maxlength="80" placeholder="예: 시험 화이팅! 같이 끝까지 가자 💪"></textarea>
    <label class="lbl">색</label>
    <div class="swatches">${COLORS.map((c) => `<button type="button" class="sw-btn ${c === color ? 'on' : ''}" data-c="${c}" style="background:${c}" aria-label="포스트잇 색"></button>`).join('')}</div>
    <p class="c-gate-msg" id="ntMsg"></p>
    <div class="foot">
      <button class="btn ghost" id="ntCancel" type="button">취소</button>
      <button class="btn primary" id="ntGo" type="button">📌 붙이기</button>
    </div>`);
  m.querySelectorAll('.sw-btn').forEach((b) => (b.onclick = () => {
    color = b.dataset.c;
    m.querySelectorAll('.sw-btn').forEach((x) => x.classList.toggle('on', x === b));
  }));
  m.querySelector('#ntCancel').onclick = openBoard;
  m.querySelector('#ntGo').onclick = async () => {
    const p = ctx.getProfile();
    const r = await api({ action: 'board.post', device: deviceId(), nick: p.name, to: m.querySelector('#ntTo').value, text: m.querySelector('#ntText').value, color })
      .catch(() => ({ error: '연결하지 못했어요. 인터넷을 확인해 주세요.' }));
    if (r.error) { m.querySelector('#ntMsg').textContent = r.error; return; }
    ctx.toast('📌 응원을 붙였어요!');
    await refresh();
    openBoard();
  };
  setTimeout(() => m.querySelector('#ntText').focus(), 50);
}

/* ---------- 건의함 ---------- */
export function openSuggest() {
  if (!CONFIG.CHATBOT_URL) return ctx.toast('아직 건의함이 연결되지 않았어요');
  const m = ctx.openModal(`
    <h2>📮 건의함</h2>
    <p class="desc">독서실에 있었으면 좋겠는 것, 고쳤으면 좋겠는 것을 알려 주세요. 관리자 선생님께 전달돼요.</p>
    <textarea class="field" id="sgText" maxlength="500" placeholder="예: 공부방 배경 소리에 카페 소리도 있었으면 좋겠어요"></textarea>
    <p class="hint">⚠️ 이름·전화번호 같은 개인정보는 쓰지 마세요.</p>
    <p class="c-gate-msg" id="sgMsg"></p>
    <div class="foot">
      <button class="btn ghost" id="sgCancel" type="button">닫기</button>
      <button class="btn primary" id="sgGo" type="button">📮 넣기</button>
    </div>
    ${ctx.isAdmin() ? '<button class="btn soft block" id="sgAdmin" type="button" style="margin-top:10px">🗂️ 관리자: 건의함 열어 보기</button>' : ''}`);
  m.querySelector('#sgCancel').onclick = ctx.closeModal;
  if (m.querySelector('#sgAdmin')) m.querySelector('#sgAdmin').onclick = openSuggestAdmin;
  m.querySelector('#sgGo').onclick = async () => {
    const r = await api({ action: 'suggest.post', device: deviceId(), nick: ctx.getProfile().name, text: m.querySelector('#sgText').value })
      .catch(() => ({ error: '연결하지 못했어요. 인터넷을 확인해 주세요.' }));
    if (r.error) { m.querySelector('#sgMsg').textContent = r.error; return; }
    ctx.closeModal();
    ctx.toast('📮 건의를 넣었어요. 고마워요!');
  };
  setTimeout(() => m.querySelector('#sgText').focus(), 50);
}

/** 관리자: 건의 목록과 상태 바꾸기 */
export async function openSuggestAdmin() {
  const m = ctx.openModal(`
    <h2>🗂️ 건의함 (관리자)</h2>
    <p class="desc">시트의 '건의함' 탭에서도 볼 수 있어요.</p>
    <div class="todo-pick" id="sgList"><p class="hint">불러오는 중…</p></div>
    <div class="foot"><button class="btn ghost" id="saClose" type="button">닫기</button></div>`, { wide: true });
  m.querySelector('#saClose').onclick = ctx.closeModal;
  const load = async () => {
    const r = await api({ action: 'suggest.list', token: ctx.teacherToken() }).catch(() => ({ error: '연결하지 못했어요' }));
    const box = m.querySelector('#sgList');
    if (!box) return;
    if (r.error) { box.innerHTML = `<p class="hint">${esc(r.error)}</p>`; return; }
    box.innerHTML = r.items.length ? r.items.map((x) => `
      <div class="sg-item ${x.status === '새 건의' ? 'new' : ''}">
        <div class="sg-head"><b>${esc(x.from)}</b> · ${ago(x.t)} <span class="sg-status">${esc(x.status)}</span></div>
        <div class="sg-text">${esc(x.text)}</div>
        <div class="sg-btns">${['확인함', '반영함', '보류'].map((st) => `<button type="button" data-row="${x.row}" data-st="${st}" class="${x.status === st ? 'on' : ''}">${st}</button>`).join('')}</div>
      </div>`).join('') : '<p class="hint">아직 들어온 건의가 없어요</p>';
    box.querySelectorAll('[data-row]').forEach((b) => (b.onclick = async () => {
      await api({ action: 'suggest.mark', token: ctx.teacherToken(), row: Number(b.dataset.row), status: b.dataset.st }).catch(() => {});
      load();
    }));
  };
  load();
}
