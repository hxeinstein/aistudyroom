// 같이 공부하기 — Firebase 실시간 데이터베이스로 다른 학생들의 모습(위치·자리·공부 과목)을 바로바로 나눔
// 나누는 것: 닉네임, 동물, 위치, 앉은 자리, 공부 중인 과목·시간. (채팅은 나누지 않음)
// 앱을 닫으면 내 정보는 자동으로 지워져요 (onDisconnect).
import {
  initializeApp, getAuth, signInAnonymously,
  getDatabase, ref, update, remove, onValue, onDisconnect, runTransaction, serverTimestamp, push, onChildAdded, query, limitToLast,
} from '../vendor/firebase.js';
import { FIREBASE } from './config.js';

const ROOM = 'room1';
const GONE_MS = 90 * 1000;       // 이만큼 신호가 없으면 화면에서 뺌 (앱이 갑자기 꺼진 경우 대비)
const SEND_MS = 200;             // 움직일 때 최대 초당 5번 보냄

let ctx = null;  // { world, toast, getMe(), isTeacher(), onCall(call), onRemote(list) }
let db = null;
let uid = null;
let offset = 0;  // 서버 시계와의 차이
let last = null;
let lastSent = 0;
let mySeat = -1;
let started = false;

export const myUid = () => uid;
let players = [];
/** 지금 접속 중인 다른 학생들 */
export const onlinePlayers = () => players;
/** 시험용(?debug): 실시간 연결 없이 친구 목록 흉내 */
export function debugPlayers(list) { players = list; ctx && ctx.world.setRemotePlayers(list); }
export const ready = () => !!uid;

export async function initRoom(c) {
  ctx = c;
  if (!FIREBASE || !FIREBASE.apiKey) return;
  try {
    const app = initializeApp(FIREBASE);
    const cred = await signInAnonymously(getAuth(app));
    uid = cred.user.uid;
    db = getDatabase(app);
  } catch (e) {
    console.warn('실시간 연결 실패', e);
    return; // 연결이 안 되면 혼자 공부 모드 그대로
  }
  onValue(ref(db, '.info/serverTimeOffset'), (snap) => { offset = snap.val() || 0; });
  // 연결이 끊기면(앱 닫기·인터넷 끊김) 내 정보와 내 자리를 서버가 지움
  onValue(ref(db, '.info/connected'), (snap) => {
    if (snap.val() !== true) return;
    onDisconnect(ref(db, `rooms/${ROOM}/players/${uid}`)).remove();
    last = null;          // 다시 연결되면 내 상태를 다시 보냄
    if (mySeat >= 0) claimSeat(mySeat, true);
  });
  // 다른 학생들
  onValue(ref(db, `rooms/${ROOM}/players`), (snap) => {
    const all = snap.val() || {};
    const now = Date.now() + offset;
    const list = Object.entries(all)
      .filter(([k, v]) => k !== uid && v && v.n && (!v.t || now - v.t < GONE_MS))
      .map(([k, v]) => ({ uid: k, ...v }));
    players = list;
    ctx.world.setRemotePlayers(list);
    ctx.onRemote && ctx.onRemote(list);
  });
  // 선생님이 건 대화
  onChildAdded(ref(db, `rooms/${ROOM}/calls/${uid}`), (snap) => {
    const v = snap.val();
    remove(snap.ref).catch(() => {});
    if (v && v.conv && v.key) ctx.onCall && ctx.onCall(v);
  });
  // 응원 이모지
  const since = Date.now();
  onChildAdded(query(ref(db, `rooms/${ROOM}/fx`), limitToLast(10)), (snap) => {
    const v = snap.val();
    if (!v || !v.to || (v.t && v.t + 0 < since + offset - 2000)) return; // 접속 전 것은 무시
    ctx.world.showFx(v.to === uid ? null : v.to, v.e);
    if (v.to === uid) ctx.toast(`${v.e} ${v.from || '친구'}가 응원을 보냈어요!`);
  });
  started = true;
  setInterval(tick, SEND_MS);
  setInterval(() => { last = null; }, 25000);   // 25초마다 '아직 있어요' 신호
}

/** 내 상태를 바뀔 때만 보냄 */
function tick() {
  if (!started) return;
  const ref1 = ref(db, `rooms/${ROOM}/players/${uid}`);
  if (ctx.isTeacher()) {
    // 선생님은 캐릭터 없이 구경 → 내 정보는 올리지 않음
    if (last !== 'teacher') { remove(ref1).catch(() => {}); last = 'teacher'; if (mySeat >= 0) releaseSeat(); }
    return;
  }
  const me = { ...ctx.world.getPlayerState(), ...ctx.getMe() };
  const key = JSON.stringify(me);
  if (key === last || Date.now() - lastSent < SEND_MS - 20) return;
  last = key;
  lastSent = Date.now();
  update(ref1, { ...me, t: serverTimestamp() }).catch(() => {});
}

/** 자리 차지 (먼저 앉은 사람만 성공) */
export async function claimSeat(idx, silent) {
  if (!db || ctx.isTeacher()) return true;
  if (mySeat >= 0 && mySeat !== idx) await releaseSeat();
  const seatRef = ref(db, `rooms/${ROOM}/seats/${idx}`);
  try {
    const r = await runTransaction(seatRef, (cur) => (cur && cur !== uid ? undefined : uid));
    if (r.committed) {
      mySeat = idx;
      onDisconnect(seatRef).remove();
      last = null;
      return true;
    }
  } catch (e) {
    // 규칙상 남의 자리(아직 있는 친구)는 가질 수 없음
  }
  if (!silent) ctx.toast('앗, 그 자리는 방금 다른 친구가 앉았어요. 다른 자리를 골라 주세요');
  return false;
}
export async function releaseSeat() {
  if (!db || mySeat < 0) return;
  const idx = mySeat;
  mySeat = -1;
  last = null;
  try { await remove(ref(db, `rooms/${ROOM}/seats/${idx}`)); } catch (e) {}
}

/** 응원 보내기 */
export async function sendCheer(toUid, emoji, fromNick) {
  if (!db) return;
  try {
    const r = await push(ref(db, `rooms/${ROOM}/fx`), { to: toUid, e: emoji, from: String(fromNick || '').slice(0, 12), t: serverTimestamp() });
    setTimeout(() => remove(r).catch(() => {}), 15000);
  } catch (e) {
    ctx.toast('응원을 보내지 못했어요');
  }
}

/** 선생님: 학생에게 대화 열쇠 전달 */
export async function sendCall(toUid, call) {
  if (!db) throw new Error('no db');
  await push(ref(db, `rooms/${ROOM}/calls/${toUid}`), call);
}

/** 예전 버전 호환: 바로 한 번 보내기 */
export function syncNow() { last = null; }
