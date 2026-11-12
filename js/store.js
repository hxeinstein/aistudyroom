// 기기(브라우저 localStorage)에만 저장되는 공부 기록 저장소.
// 하루는 새벽 06:00에 바뀝니다 (플래너 타임테이블이 06시~다음날 05시).

const KEY = 'aistudyroom.v1';
export const DAY_START_HOUR = 6;

// 과목은 학생이 직접 만들고 이 기기에 저장됨 (학교마다 과목이 다르니까)
export const SUBJECT_COLORS = ['#B4F5D0', '#FFE98A', '#D9B8FF', '#BBDDFF', '#FFCBA8', '#F9BCD0', '#C8F0F0', '#E3D5C4', '#D5F5A8', '#FFD6E7', '#CFD8FF', '#D7DEE7'];

// 예전 버전의 고정 과목 (이미 남아 있는 기록을 읽기 위해서만 사용)
const LEGACY_SUBJECTS = [
  { id: 'kor', name: '국어', color: '#D9B8FF' },
  { id: 'math', name: '수학', color: '#B4F5D0' },
  { id: 'eng', name: '영어', color: '#FFE98A' },
  { id: 'sci', name: '과학', color: '#BBDDFF' },
  { id: 'soc', name: '사회', color: '#FFCBA8' },
  { id: 'hist', name: '한국사', color: '#F9BCD0' },
  { id: 'etc', name: '기타', color: '#D7DEE7' },
];
const UNKNOWN_SUBJECT = { id: '?', name: '기타', color: '#D7DEE7' };

/** 지금 쓰는 과목 (숨긴 과목 제외) */
export const getSubjects = () => state.subjects.filter((x) => !x.hidden);
/** 숨긴 과목 포함 전체 (지난 기록 표시용) */
export const allSubjects = () => state.subjects;
export const subjectById = (id) => state.subjects.find((x) => x.id === id) || LEGACY_SUBJECTS.find((x) => x.id === id) || UNKNOWN_SUBJECT;

export function addSubject(name, color) {
  name = String(name || '').trim().slice(0, 12);
  if (!name) return null;
  const same = state.subjects.find((x) => x.name === name);
  if (same) { same.hidden = false; if (color) same.color = color; save(); return same; }
  const used = new Set(getSubjects().map((x) => x.color));
  const sub = { id: 's_' + uid(), name, color: color || SUBJECT_COLORS.find((c) => !used.has(c)) || SUBJECT_COLORS[state.subjects.length % SUBJECT_COLORS.length] };
  state.subjects.push(sub);
  save();
  return sub;
}
/** 과목 빼기: 지난 기록에 이름·색이 남도록 지우지 않고 숨김 */
export function hideSubject(id) {
  const x = state.subjects.find((s) => s.id === id);
  if (x) x.hidden = true;
  save();
}
export function setLastSubject(id) { state.lastSubject = id; save(); }

export const ANIMALS = [
  { id: 'bear', name: '곰', emoji: '🐻', trait: '든든하고 포근한 기본 체형' , group: 'cozy' },
  { id: 'rabbit', name: '토끼', emoji: '🐰', trait: '긴 귀 · 걸을 때 깡총깡총' , group: 'cozy' },
  { id: 'cat', name: '고양이', emoji: '🐱', trait: '뾰족 귀와 수염, 살랑이는 꼬리' , group: 'cat' },
  { id: 'fox', name: '여우', emoji: '🦊', trait: '끝이 하얀 복슬 꼬리' , group: 'unique' },
  { id: 'panda', name: '판다', emoji: '🐼', trait: '까만 눈 무늬와 까만 팔다리' , group: 'cozy' },
  { id: 'frog', name: '개구리', emoji: '🐸', trait: '머리 위 동그란 눈 · 폴짝폴짝' , group: 'unique' },
  { id: 'mouse', name: '생쥐', emoji: '🐭', trait: '아주 작아서 방석을 쌓고 겨우 앉아요' , group: 'small' },
  { id: 'hamster', name: '햄스터', emoji: '🐹', trait: '작고 볼이 빵빵 · 방석 필요' , group: 'small' },
  { id: 'elephant', name: '코끼리', emoji: '🐘', trait: '덩치가 커서 엉덩이가 의자 밖으로!' , group: 'big' },
  { id: 'giraffe', name: '기린', emoji: '🦒', trait: '긴 목 · 칸막이 너머까지 보여요' , group: 'big' },
  { id: 'lion', name: '사자', emoji: '🦁', trait: '풍성한 갈기와 끝이 둥근 꼬리' , group: 'cat' },
  { id: 'tiger', name: '호랑이', emoji: '🐯', trait: '이마의 줄무늬' , group: 'cat' },
  { id: 'cheetah', name: '치타', emoji: '🐆', trait: '날씬하고 제일 빨리 걸어요' , group: 'cat' },
  { id: 'sheep', name: '양', emoji: '🐑', trait: '복슬복슬 양털 머리' , group: 'cozy' },
  { id: 'sloth', name: '나무늘보', emoji: '🦥', trait: '모든 게 느릿느릿 (걸음도 느려요)' , group: 'unique' },
  { id: 'hippo', name: '하마', emoji: '🦛', trait: '큰 주둥이 · 엉덩이가 튀어나와요' , group: 'big' },
  { id: 'raccoon', name: '너구리', emoji: '🦝', trait: '눈가 가면과 줄무늬 꼬리' , group: 'unique' },
  { id: 'otter', name: '수달', emoji: '🦦', trait: '조금 작고 날렵 · 긴 꼬리' , group: 'small' },
  { id: 'penguin', name: '펭귄', emoji: '🐧', trait: '부리와 날개 · 뒤뚱뒤뚱 걸어요' , group: 'unique' },
  { id: 'deer', name: '사슴', emoji: '🦌', trait: '사슴뿔 · 가볍고 빠른 걸음' , group: 'big' },
  { id: 'capybara', name: '카피바라', emoji: '🍊', trait: '느긋한 표정 · 머리 위에 귤 하나' , group: 'big' },
  { id: 'bun', name: '찐빵이', emoji: '🥟', trait: '말랑한 하얀 찐빵 얼굴 · 머리 위 김이 모락모락' , group: 'cozy' },
  { id: 'graycat', name: '회색냥', emoji: '🐱', trait: '이마가 둥글게 갈린 은회색 무늬 고양이' , group: 'cat' },
  { id: 'cheesecat', name: '치즈냥', emoji: '🐱', trait: '이마가 둥글게 갈린 치즈색 무늬 고양이' , group: 'cat' },
];
// 캐릭터 고르기 화면의 분류 탭
export const ANIMAL_GROUPS = [
  { id: 'cozy', name: '포근 친구', emoji: '🐻' },
  { id: 'small', name: '작은 친구', emoji: '🐭' },
  { id: 'cat', name: '고양이과', emoji: '🐱' },
  { id: 'big', name: '큰 친구', emoji: '🦒' },
  { id: 'unique', name: '개성파', emoji: '🐸' },
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
  return { v: 1, profile: null, exam: { name: '시험', date: '' }, sound: 'off', subjects: [], lastSubject: null, days: {}, active: null };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const saved = JSON.parse(raw);
    const st = { ...blank(), ...saved };
    if (!saved.subjects) {
      // 예전 버전(고정 과목)에서 쓰던 과목은 내 과목으로 옮겨 둠
      const used = new Set();
      for (const d of Object.values(st.days || {})) {
        (d.todos || []).forEach((t) => used.add(t.subject));
        (d.sessions || []).forEach((x) => used.add(x.subject));
      }
      st.subjects = LEGACY_SUBJECTS.filter((x) => used.has(x.id)).map((x) => ({ ...x }));
    }
    return st;
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
/** 독서실 화면이 켜져 있다는 신호 (탭을 닫았다 다시 열었을 때 얼마나 떠나 있었는지 알려고) */
export function touchAlive() {
  const a = state.active;
  if (!a || a.segStart == null) return;
  a.alive = Date.now();
  save();
}
/** 탭을 닫았다가 다시 열었을 때: 마지막으로 켜져 있던 때부터 지금까지 (공부 중이었을 때만) */
export function awayAfterClose() {
  const a = state.active;
  if (!a || a.segStart == null || !a.alive) return null;
  const ms = Date.now() - a.alive;
  return ms >= 60 * 1000 ? { from: a.alive, ms } : null;
}
/** 떠나 있던 시간(from ~ to)을 공부 시간에서 빼기 */
export function excludeAway(from, to) {
  const a = state.active;
  const s = activeSession();
  if (!s || a.segStart == null) return;
  if (from > a.segStart) pushSeg(s, a.segStart, from);
  a.segStart = Math.max(to, from);
  a.alive = Date.now();
  save();
}
/** 세션 종료. done=true면 연결된 할 일 체크 (end: 끝난 시각, 기본은 지금) */
export function stopSession(done, end) {
  const a = state.active;
  const s = activeSession();
  if (!s) return null;
  if (a.segStart != null) pushSeg(s, a.segStart, Math.max(a.segStart, end || Date.now()));
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

/** 연속 공부 일수: 오늘(아직 안 했으면 어제)부터 거꾸로 1분 이상 공부한 날 수 */
export function streak() {
  let key = dayKey();
  let n = 0;
  if (totalMs(key) < 60000) key = dayKey(dayStartTs(key) - 3600 * 1000);   // 오늘 아직 안 했으면 어제부터
  for (let i = 0; i < 400; i++) {
    if (!state.days[key] || totalMs(key) < 60000) break;
    n++;
    key = dayKey(dayStartTs(key) - 3600 * 1000);
  }
  return n;
}

/** 오늘의 목표 한 줄 (날마다 새로) */
export function getGoal() { return state.goal && state.goal.day === dayKey() ? state.goal.text : ''; }
export function setGoal(text) { state.goal = { day: dayKey(), text: String(text || '').trim().slice(0, 24) }; save(); }
/** 오늘 순위에 내 이름 보이기 (기본: 보임) */
export const showInRank = () => state.rank !== false;
export function setShowInRank(on) { state.rank = !!on; save(); }

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
