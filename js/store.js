// 기기(브라우저 localStorage)에만 저장되는 공부 기록 저장소.
// 하루는 새벽 06:00에 바뀝니다 (플래너 타임테이블이 06시~다음날 05시).

const KEY = 'aistudyroom.v1';
export const DAY_START_HOUR = 6;

export const SUBJECTS = [
  { id: 'kor', name: '국어', color: '#D9B8FF', icon: '📖' },
  { id: 'math', name: '수학', color: '#B4F5D0', icon: '📐' },
  { id: 'eng', name: '영어', color: '#FFE98A', icon: '🔤' },
  { id: 'sci', name: '과학', color: '#BBDDFF', icon: '🧪' },
  { id: 'soc', name: '사회', color: '#FFCBA8', icon: '🌏' },
  { id: 'hist', name: '한국사', color: '#F9BCD0', icon: '🏯' },
  { id: 'etc', name: '기타', color: '#D7DEE7', icon: '✏️' },
];
export const subjectById = (id) => SUBJECTS.find((s) => s.id === id) || SUBJECTS[SUBJECTS.length - 1];

export const ANIMALS = [
  { id: 'bear', name: '곰', emoji: '🐻' },
  { id: 'rabbit', name: '토끼', emoji: '🐰' },
  { id: 'cat', name: '고양이', emoji: '🐱' },
  { id: 'fox', name: '여우', emoji: '🦊' },
  { id: 'panda', name: '판다', emoji: '🐼' },
  { id: 'frog', name: '개구리', emoji: '🐸' },
];
export const animalById = (id) => ANIMALS.find((a) => a.id === id) || ANIMALS[0];

const pad = (n) => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** 공부 날짜 키 (06시 이전은 전날로 침) */
export function dayKey(ts = Date.now()) {
  const d = new Date(ts - DAY_START_HOUR * 3600 * 1000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** 해당 공부 날짜의 시작(06:00) 타임스탬프 */
export function dayStartTs(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, DAY_START_HOUR, 0, 0, 0).getTime();
}

function blank() {
  return { v: 1, profile: null, exam: { name: '시험', date: '' }, sound: 'off', days: {}, active: null };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch (e) {
    return blank();
  }
}
export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    /* 저장 불가(사생활 보호 모드 등) — 이번 접속 동안만 유지 */
  }
}

export const getState = () => state;

export function setProfile(profile) {
  state.profile = profile;
  save();
}
export function setExam(exam) {
  state.exam = exam;
  save();
}
export function setSound(mode) {
  state.sound = mode;
  save();
}

export function getDay(key = dayKey()) {
  if (!state.days[key]) state.days[key] = { todos: [], sessions: [], note: '', finishedAt: null };
  return state.days[key];
}

/** 아직 안 끝낸 할 일 (오늘 것) */
export function openTodos(key = dayKey()) {
  return getDay(key).todos.filter((t) => !t.done);
}

export function addTodo({ subject, title, memo }) {
  const t = { id: uid(), subject, title: title.trim(), memo: (memo || '').trim(), done: false };
  getDay().todos.push(t);
  save();
  return t;
}
export function toggleTodo(key, id) {
  const t = getDay(key).todos.find((x) => x.id === id);
  if (t) t.done = !t.done;
  save();
}
export function removeTodo(key, id) {
  const day = getDay(key);
  const used = day.sessions.some((s) => s.todoId === id);
  if (used) return false;
  day.todos = day.todos.filter((t) => t.id !== id);
  save();
  return true;
}

// ---------- 공부 세션 ----------
export function startSession(todoId, seat) {
  if (state.active) stopSession(false);
  const key = dayKey();
  const day = getDay(key);
  const todo = day.todos.find((t) => t.id === todoId);
  const s = { id: uid(), todoId, subject: todo.subject, title: todo.title, seat, segs: [] };
  day.sessions.push(s);
  state.active = { day: key, sessionId: s.id, segStart: Date.now(), seat };
  save();
  return s;
}

export function activeSession() {
  const a = state.active;
  if (!a) return null;
  const day = state.days[a.day];
  const s = day && day.sessions.find((x) => x.id === a.sessionId);
  if (!s) {
    state.active = null;
    save();
    return null;
  }
  return s;
}
export const isPaused = () => !!state.active && state.active.segStart == null;

export function pauseSession() {
  const a = state.active;
  const s = activeSession();
  if (!s || a.segStart == null) return;
  pushSeg(s, a.segStart, Date.now());
  a.segStart = null;
  save();
}
export function resumeSession() {
  const a = state.active;
  if (!a || a.segStart != null) return;
  a.segStart = Date.now();
  save();
}
/** 세션 종료. done=true면 연결된 할 일 체크 */
export function stopSession(done) {
  const a = state.active;
  const s = activeSession();
  if (!s) return null;
  if (a.segStart != null) pushSeg(s, a.segStart, Date.now());
  const day = state.days[a.day];
  if (done) {
    const t = day.todos.find((x) => x.id === s.todoId);
    if (t) t.done = true;
  }
  // 1분도 안 한 빈 세션은 지움
  if (sessionMs(s) < 60 * 1000) day.sessions = day.sessions.filter((x) => x !== s);
  state.active = null;
  save();
  return s;
}

function pushSeg(s, start, end) {
  if (end - start < 1000) return;
  // 공부 날짜(다음날 06시)를 넘어가면 잘라냄
  const limit = dayStartTs(state.active.day) + 24 * 3600 * 1000;
  s.segs.push([start, Math.min(end, limit)]);
}

export const sessionMs = (s) => s.segs.reduce((a, [b, e]) => a + (e - b), 0);

/** 지금 진행 중인 세션 경과(ms), 진행 중 구간 포함 */
export function activeElapsed() {
  const s = activeSession();
  if (!s) return 0;
  const run = state.active.segStart != null ? Date.now() - state.active.segStart : 0;
  return sessionMs(s) + run;
}

/** 하루 세션 목록 (진행 중인 구간을 포함한 사본) */
export function sessionsWithLive(key = dayKey()) {
  const day = getDay(key);
  const a = state.active;
  return day.sessions.map((s) => {
    if (a && a.day === key && a.sessionId === s.id && a.segStart != null) {
      return { ...s, segs: [...s.segs, [a.segStart, Date.now()]] };
    }
    return s;
  });
}

export function totalMs(key = dayKey()) {
  return sessionsWithLive(key).reduce((a, s) => a + sessionMs(s), 0);
}

export function subjectTotals(key = dayKey()) {
  const m = {};
  for (const s of sessionsWithLive(key)) m[s.subject] = (m[s.subject] || 0) + sessionMs(s);
  return m;
}

export function finishDay(note) {
  const day = getDay();
  day.note = (note || '').trim();
  day.finishedAt = Date.now();
  save();
}

export function fmtHM(ms) {
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}분`;
  return `${h}시간 ${m}분`;
}
export function fmtClock(ms) {
  const sec = Math.floor(ms / 1000);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function dDay(dateStr, key = dayKey()) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const [ky, km, kd] = key.split('-').map(Number);
  const diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ky, km - 1, kd)) / 86400000);
  if (diff > 0) return `D-${diff}`;
  if (diff === 0) return 'D-DAY';
  return `D+${-diff}`;
}
