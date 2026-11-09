// 과학 질문 챗봇 창 — 선생님의 Apps Script(역학과 에너지 힌트 코치)를 불러서 사용
// 대화는 이 화면(메모리)에만 있고, 새로고침하거나 '새 문제'를 누르면 사라짐.
import { CONFIG } from './config.js';

const DEFAULT_GREETING = '어떤 문제를 풀어 볼까? 문제를 글로 쓰거나 사진으로 올려 줘!';
const $ = (id) => document.getElementById(id);

let history = [];
let pendingImage = null;
let busy = false;
let started = false;
let accessCode = '';
let needCode = null;
let subjects = [];      // 선생님이 '과목' 탭에서 사용 체크한 교과들 [{ name, room, greeting }]
let current = null;     // 지금 고른 교과
let configPromise = null;

function loadConfig() {
  if (!CONFIG.CHATBOT_URL) return Promise.resolve(null);
  configPromise ||= call({ action: 'config' }).then((cfg) => {
    needCode = !!cfg.needCode;
    subjects = Array.isArray(cfg.subjects) ? cfg.subjects : [{ name: '', room: '과학, 물리, 역학', greeting: '' }];
    return cfg;
  }).catch((e) => { configPromise = null; throw e; });
  return configPromise;
}

/** 독서실 과목(예: '과학')에 연결된 교과가 있는지 */
export async function hasSubjectFor(roomName) {
  try {
    await loadConfig();
    return subjects.some((x) => matches(x, roomName));
  } catch (e) {
    return false;
  }
}

/**
 * 학생이 정한 과목 이름(예: '물리학Ⅰ')이 교과의 연결 낱말(예: '과학, 물리, 역학')과 맞는지.
 * 낱말이 과목 이름 안에 들어 있거나, 과목 이름이 낱말 안에 들어 있으면 연결된 것으로 봄.
 */
function matches(subject, roomName) {
  if (!roomName) return false;
  const norm = (t) => String(t).toLowerCase().replace(/\s/g, '');
  const name = norm(roomName);
  return String(subject.room || '').split(/[,，、/]+/).map(norm).filter((k) => k.length >= 1)
    .some((k) => name.includes(k) || (name.length >= 2 && k.includes(name)));
}

const greeting = () => (current && current.greeting) || DEFAULT_GREETING;

function renderSubjects() {
  const box = $('cSubjects');
  $('cSub').textContent = `${current && current.name ? current.name + ' · ' : ''}정답 대신 힌트를 줘요`;
  box.classList.toggle('hidden', subjects.length < 2);
  box.innerHTML = '';
  for (const x of subjects) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'c-chip' + (x === current ? ' on' : '');
    b.textContent = x.name;
    b.onclick = () => switchSubject(x);
    box.appendChild(b);
  }
}

function switchSubject(x, ask = true) {
  if (x === current || busy) return;
  if (ask && history.length && !confirm(`'${x.name}'(으)로 바꾸면 지금 대화가 지워져. 바꿀까?`)) return;
  current = x;
  history = [];
  $('cLog').innerHTML = '';
  clearImage();
  renderSubjects();
  addBubble('model', greeting());
}

function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }

function deviceId() {
  let id = load('aistudyroom.device');
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    store('aistudyroom.device', id);
  }
  return id;
}

async function call(body) {
  const res = await fetch(CONFIG.CHATBOT_URL, {
    method: 'POST',
    // text/plain → 브라우저의 미리 확인 요청(CORS preflight) 없이 Apps Script로 보낼 수 있음
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---------- 말풍선 ----------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function render(text) {
  let h = escapeHtml(text);
  h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  h = h.replace(/교과서\s*(\d+)(\s*[~\-–]\s*\d+)?\s*쪽/g, (m) => '<span class="page">' + m + '</span>');
  return h.replace(/\n/g, '<br>');
}
function addBubble(role, text, imgUrl) {
  const row = document.createElement('div');
  row.className = 'c-row ' + (role === 'user' ? 'me' : 'bot');
  if (role !== 'user') row.innerHTML = '<img class="c-ava" src="assets/mascot.png" alt="" />';
  const div = document.createElement('div');
  div.className = 'c-msg';
  if (imgUrl) {
    const im = document.createElement('img');
    im.src = imgUrl;
    im.alt = '올린 문제 사진';
    div.appendChild(im);
  }
  if (text) {
    const s = document.createElement('div');
    s.innerHTML = role === 'user' ? escapeHtml(text).replace(/\n/g, '<br>') : render(text);
    div.appendChild(s);
  }
  row.appendChild(div);
  $('cLog').appendChild(row);
  scrollDown();
  return div;
}
function addNote(text) {
  const div = document.createElement('div');
  div.className = 'c-note';
  div.textContent = text;
  $('cLog').appendChild(div);
  scrollDown();
}
function scrollDown() { const l = $('cLog'); l.scrollTop = l.scrollHeight; }

// ---------- 열기/닫기 ----------
export function initChat() {
  $('cName').textContent = CONFIG.MASCOT_NAME;
  $('cClose').onclick = closeChat;
  $('cReset').onclick = reset;
  $('cSend').onclick = send;
  $('cPhoto').onclick = () => $('cFile').click();
  $('cFile').onchange = onFile;
  $('cRemoveImg').onclick = clearImage;
  $('cCodeBtn').onclick = tryCode;
  $('cCodeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) tryCode(); });
  const input = $('cInput');
  input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 120) + 'px'; });
  input.addEventListener('keydown', (e) => {
    // 한글 입력 중(isComposing)에는 Enter로 보내지 않음 → 두 번 전송 방지
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && window.matchMedia('(pointer: fine)').matches) {
      e.preventDefault();
      send();
    }
  });
}

export async function openChat(roomName) {
  $('chatSheet').classList.remove('hidden');
  if (started) {
    // 공부 중인 과목과 맞는 교과가 있고 아직 대화를 안 했으면 그 교과로 바꿔 줌
    const match = roomName && subjects.find((x) => matches(x, roomName));
    if (match && !history.length && current && (!needCode || accessCode)) switchSubject(match, false);
    return;
  }
  started = true;
  if (!CONFIG.CHATBOT_URL) {
    addBubble('model', `안녕! 나는 ${CONFIG.MASCOT_NAME}야 🐾\n아직 선생님이 질문 챗봇을 연결하지 않았어. 조금만 기다려 줘!`);
    setComposer(false);
    return;
  }
  setComposer(false);
  try {
    await loadConfig();
  } catch (e) {
    started = false;
    addNote('챗봇에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.');
    return;
  }
  if (!subjects.length) {
    addBubble('model', '아직 선생님이 연결한 교과가 없어. 조금만 기다려 줘!');
    return;
  }
  current = subjects.find((x) => matches(x, roomName)) || subjects[0];
  renderSubjects();
  if (needCode) {
    const saved = load('aistudyroom.chatCode');
    if (saved && (await call({ action: 'checkCode', code: saved }).then((r) => r.ok).catch(() => false))) {
      accessCode = saved;
      return startChat();
    }
    store('aistudyroom.chatCode', null);
    $('cGate').classList.remove('hidden');
    $('cCodeInput').focus();
    return;
  }
  startChat();
}

function closeChat() { $('chatSheet').classList.add('hidden'); }

function startChat() {
  $('cGate').classList.add('hidden');
  setComposer(true);
  addBubble('model', greeting());
}

async function tryCode() {
  const code = $('cCodeInput').value.trim();
  if (!code) return;
  $('cGateMsg').textContent = '';
  const ok = await call({ action: 'checkCode', code }).then((r) => r.ok).catch(() => false);
  if (ok) {
    accessCode = code;
    store('aistudyroom.chatCode', code);
    startChat();
  } else {
    $('cGateMsg').textContent = '코드가 맞지 않아요. 다시 확인해 줘.';
  }
}

function setComposer(on) {
  $('cInput').disabled = !on;
  $('cSend').disabled = !on || busy;
  $('cPhoto').disabled = !on;
}

function reset() {
  if (busy || !current || (needCode && !accessCode)) return;
  if (history.length && !confirm('지금 대화를 지우고 새 문제를 시작할까?')) return;
  history = [];
  $('cLog').innerHTML = '';
  clearImage();
  addBubble('model', greeting());
  $('cInput').focus();
}

// ---------- 사진: 1280px로 줄여서 전송 ----------
function onFile(e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL('image/jpeg', 0.85);
      pendingImage = { mimeType: 'image/jpeg', data: url.split(',')[1], url };
      $('cPreviewImg').src = url;
      $('cPreview').classList.remove('hidden');
    };
    img.onerror = () => addNote('이 사진은 열 수 없어요. 다른 사진으로 올려 줘.');
    img.src = reader.result;
  };
  reader.readAsDataURL(f);
}
function clearImage() {
  pendingImage = null;
  $('cPreview').classList.add('hidden');
}

// ---------- 보내기 ----------
async function send() {
  const input = $('cInput');
  const text = input.value.trim();
  if (busy || (!text && !pendingImage)) return;
  const msg = { role: 'user', text };
  if (pendingImage) msg.image = { mimeType: pendingImage.mimeType, data: pendingImage.data };
  addBubble('user', text, pendingImage && pendingImage.url);
  history.push(msg);
  input.value = '';
  input.style.height = 'auto';
  clearImage();
  setBusy(true);
  const thinking = addBubble('model', '');
  thinking.classList.add('thinking');
  thinking.innerHTML = '<span></span><span></span><span></span>';
  try {
    const res = await call({ action: 'chat', subject: current.name, code: accessCode, device: deviceId(), history });
    thinking.parentElement.remove();
    if (res && res.text) {
      history.push({ role: 'model', text: res.text });
      addBubble('model', res.text);
    } else {
      fail(res && res.error, msg);
    }
  } catch (e) {
    thinking.parentElement.remove();
    fail('연결이 끊겼어요. 다시 보내 줘.', msg);
  }
  setBusy(false);
}
function fail(text, msg) {
  history.pop(); // 실패한 질문은 기록에서 빼고 입력칸에 돌려놓기
  if (msg.text) $('cInput').value = msg.text;
  addNote(text || '답을 받지 못했어요. 다시 보내 줘.');
}
function setBusy(b) {
  busy = b;
  $('cSend').disabled = b;
  $('cSend').textContent = b ? '생각 중' : '보내기';
}
