// 뭉치 박사 질문 챗봇 창 — 선생님의 Apps Script(힌트 코치)를 불러서 사용
// 대화는 이 화면(메모리)에만 있고, 새로고침하거나 '새 문제'를 누르면 사라짐.
import { CONFIG } from './config.js';
import { schoolCode } from './school.js';

const DEFAULT_GREETING = '어떤 문제를 풀어 볼까? 문제를 글로 쓰거나 사진으로 올려 줘!';
const $ = (id) => document.getElementById(id);

let history = [];
let pendingImage = null;
let busy = false;
let started = false;
let subjects = [];      // 선생님이 '과목' 탭에서 사용 체크한 교과들 [{ name, room, greeting, needCode }]
let current = null;     // 지금 고른 교과
let bot = null;         // 지금 말하고 있는 챗봇 (CONFIG.BOTS 중 하나)
let onAskTeacher = null;

/** 교과를 맡은 챗봇 ('과목' 탭 H칸, 비어 있으면 첫 번째 챗봇) */
const botOf = (x) => CONFIG.BOTS.find((b) => b.name === (x && x.bot)) || CONFIG.BOTS[0];
const subjectsOf = (b) => subjects.filter((x) => botOf(x).id === b.id);
/** 공부 중인 과목에 맞는 챗봇 id (없으면 null) */
export async function botFor(roomName) {
  try { await loadConfig(); } catch (e) { return null; }
  const x = subjects.find((y) => matches(y, roomName));
  return x ? botOf(x).id : null;
}
let configPromise = null;

function loadConfig() {
  if (!CONFIG.CHATBOT_URL) return Promise.resolve(null);
  configPromise ||= call({ action: 'config' }).then((cfg) => {
    subjects = Array.isArray(cfg.subjects) ? cfg.subjects : [{ name: '', room: '과학, 물리, 역학', greeting: '' }];
    // 예전 서버(교과별 코드 없음)는 전체 수업 코드 하나만 씀
    subjects.forEach((x) => { if (x.needCode === undefined) x.needCode = !!cfg.needCode; });
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
  const list = bot ? subjectsOf(bot) : subjects;
  $('cSub').textContent = `${current && current.name ? current.name + ' · ' : ''}정답 대신 힌트를 줘요`;
  box.classList.toggle('hidden', list.length < 2);
  box.innerHTML = '';
  for (const x of list) {
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
  enterSubject(x);
}

/** 교과로 들어가기: 누구나 질문할 수 있고, 수업 코드를 넣은 학생만 교과서 쪽수까지 안내 */
function enterSubject(x) {
  current = x;
  history = [];
  $('cLog').innerHTML = '';
  clearImage();
  renderSubjects();
  $('cGate').classList.add('hidden');
  setComposer(true);
  addBubble('model', greeting());
  if (x.needCode && !codes()[x.name]) addCodeHint();
}

// 코드 안내: 우리 학교 학생이면 수업 코드를 넣어 교과서 연동
function addCodeHint(text) {
  const div = document.createElement('div');
  div.className = 'c-note c-code-hint';
  div.innerHTML = `${escapeHtml(text || '우리 학교 학생이면 수업 코드를 넣어 줘. 우리 교과서 몇 쪽을 보면 되는지까지 알려 줄게 📖')} <button type="button" class="c-ghost">🔑 수업 코드 넣기</button>`;
  div.querySelector('button').onclick = () => showGate();
  $('cLog').appendChild(div);
  scrollDown();
}

function showGate(msg) {
  $('cGateText').innerHTML = `<b>${escapeHtml(current.name || '이 교과')}</b> 수업 코드 (선생님이 알려 준 코드). 넣으면 교과서 쪽수까지 안내해 줘.`;
  $('cGateMsg').textContent = msg || '';
  $('cCodeInput').value = '';
  $('cGate').classList.remove('hidden');
  $('cCodeInput').focus();
}

function store(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
// 교과별로 통과한 수업 코드 (이 기기에 기억)
function codes() { try { return JSON.parse(load('aistudyroom.chatCodes') || '{}'); } catch (e) { return {}; } }
function setCode(name, code) {
  const c = codes();
  if (code) c[name] = code; else delete c[name];
  store('aistudyroom.chatCodes', JSON.stringify(c));
}

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
    body: JSON.stringify({ school: schoolCode(), ...body }),
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---------- 말풍선 ----------
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
// 수식: 챗봇이 쓴 LaTeX($Q_H$, $\frac{1}{2}mv^2$ 등)를 수학책처럼 보이게 (KaTeX, 수식이 있을 때만 불러옴)
const MATH_RE = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$([^\$\n]+?)\$/g;
let katexP = null;
function loadKatex() {
  if (!katexP) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'vendor/katex/katex.min.css';
    document.head.appendChild(link);
    katexP = import('../vendor/katex/katex.mjs').then((m) => m.default || m);
  }
  return katexP;
}
async function typesetMath(root) {
  const els = root.querySelectorAll('.math[data-tex]');
  if (!els.length) return;
  try {
    const katex = await loadKatex();
    els.forEach((el) => {
      try {
        el.innerHTML = katex.renderToString(el.dataset.tex, { throwOnError: false, displayMode: el.dataset.display === '1', strict: false });
        el.removeAttribute('data-tex');
      } catch (e) { /* 그대로 둠 */ }
    });
    scrollDown();
  } catch (e) { /* 불러오기 실패 시 글자 그대로 */ }
}
function render(text) {
  // 수식 부분은 먼저 떼어 두고, 나머지만 강조·쪽수 표시
  const parts = [];
  let last = 0;
  text.replace(MATH_RE, (m, d1, d2, i1, i2, off) => {
    parts.push({ t: text.slice(last, off) });
    const tex = (d1 || d2 || i1 || i2 || '').trim();
    parts.push({ math: tex, display: !!(d1 || d2) });
    last = off + m.length;
    return m;
  });
  parts.push({ t: text.slice(last) });
  return parts.map((p) => {
    if (p.math !== undefined) return `<span class="math${p.display ? ' display' : ''}" data-tex="${escapeHtml(p.math)}" data-display="${p.display ? 1 : 0}">${escapeHtml(p.math)}</span>`;
    let h = escapeHtml(p.t);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/교과서\s*(\d+)(\s*[~\-–]\s*\d+)?\s*쪽/g, (m) => '<span class="page">' + m + '</span>');
    return h.replace(/\n/g, '<br>');
  }).join('');
}
function addBubble(role, text, imgUrl) {
  const row = document.createElement('div');
  row.className = 'c-row ' + (role === 'user' ? 'me' : 'bot');
  if (role !== 'user') row.innerHTML = `<img class="c-ava" src="${(bot || CONFIG.BOTS[0]).img}" alt="" />`;
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
    if (role !== 'user') typesetMath(s);
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
export function initChat(o = {}) {
  onAskTeacher = o.onAskTeacher || null;
  $('cName').textContent = CONFIG.BOTS[0].name;
  $('cAskTeacher').onclick = () => {
    // 챗봇으로 해결이 안 될 때만 선생님께 (이때 선생님께 알림이 감)
    const last = [...history].reverse().find((m) => m.role === 'user' && m.text);
    closeChat();
    onAskTeacher && onAskTeacher({ text: last ? last.text : '', subject: current && current.name, bot: bot && bot.name, teacherName: current && current.teacher });
  };
  $('cClose').onclick = closeChat;
  $('cReset').onclick = reset;
  $('cSend').onclick = send;
  $('cPhoto').onclick = () => $('cFile').click();
  $('cFile').onchange = onFile;
  $('cRemoveImg').onclick = clearImage;
  $('cCodeBtn').onclick = tryCode;
  $('cCodeLater').onclick = () => $('cGate').classList.add('hidden');
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

/**
 * 챗봇 대화창 열기
 * - botId: 교무실에서 누른 챗봇 / roomName: 공부 중인 과목(맞는 교과·챗봇을 먼저 고름)
 */
export async function openChat(roomName, botId) {
  $('chatSheet').classList.remove('hidden');
  if (!CONFIG.CHATBOT_URL) {
    setBot(CONFIG.BOTS.find((b) => b.id === botId) || CONFIG.BOTS[0]);
    addBubble('model', `안녕! 나는 ${bot.name}야 🐾\n아직 선생님이 질문 챗봇을 연결하지 않았어. 조금만 기다려 줘!`);
    setComposer(false);
    return;
  }
  setComposer(false);
  try {
    await loadConfig();
  } catch (e) {
    addNote('챗봇에 연결하지 못했어요. 인터넷 연결을 확인하고 다시 열어 주세요.');
    return;
  }
  const match = roomName && subjects.find((x) => matches(x, roomName));
  const target = CONFIG.BOTS.find((b) => b.id === botId) || (match && botOf(match)) || bot || CONFIG.BOTS[0];
  if (target !== bot) {
    setBot(target);
    const list = subjectsOf(bot);
    if (!list.length) {
      renderSubjects();
      addBubble('model', `안녕! 나는 ${bot.name}야 🐾\n아직 선생님이 나랑 연결한 교과가 없어. 조금만 기다려 줘!`);
      return;
    }
    enterSubject(list.find((x) => matches(x, roomName)) || list[0]);
    return;
  }
  // 같은 챗봇: 공부 중인 과목과 맞는 교과가 있고 아직 대화를 안 했으면 그 교과로
  if (match && botOf(match) === bot && match !== current && !history.length) enterSubject(match);
  else if (!current && subjectsOf(bot).length) enterSubject(subjectsOf(bot)[0]);
  else setComposer(!!current);
}

function setBot(b) {
  bot = b;
  current = null;
  history = [];
  $('cLog').innerHTML = '';
  clearImage();
  $('cName').textContent = b.name;
  $('cAvaImg').src = b.img;
  $('cGate').classList.add('hidden');
}

function closeChat() { $('chatSheet').classList.add('hidden'); }

async function tryCode() {
  const code = $('cCodeInput').value.trim();
  if (!code) return;
  $('cGateMsg').textContent = '';
  const ok = await call({ action: 'checkCode', subject: current.name, code }).then((r) => r.ok).catch(() => false);
  if (ok) {
    setCode(current.name, code);
    $('cGate').classList.add('hidden');
    $('cLog').querySelectorAll('.c-code-hint').forEach((d) => d.remove());
    addNote('🔑 수업 코드 확인! 이제 우리 교과서 쪽수까지 알려 줄게.');
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
  if (busy || !current) return;
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
    const res = await call({ action: 'chat', subject: current.name, code: codes()[current.name] || '', device: deviceId(), history });
    thinking.parentElement.remove();
    if (res && res.text) {
      history.push({ role: 'model', text: res.text });
      addBubble('model', res.text);
      if (res.codeWrong) {
        // 선생님이 수업 코드를 바꿈 → 교과서 안내 없이 답하고, 새 코드 안내
        setCode(current.name, null);
        addCodeHint('수업 코드가 바뀌어서 이번엔 교과서 쪽수 없이 답했어. 새 코드를 넣으면 다시 교과서까지 안내할게.');
      }
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
