// 공부방 자리 공유 — 누가 어느 자리에서 무엇을 공부 중인지 서로 보이게 (Apps Script Office.gs의 room.sync)
// 앉기·일어나기·공부 시작/끝/휴식 때와 30초마다 알려 줌. 걸어다니는 모습은 나누지 않음.
import { CONFIG } from './config.js';

let ctx = null;        // { world, toast, getMe(): { seat, nick, animal, subj, studying, paused, elapsed }, isTeacher(), onCalls(calls) }
let timer = null;
let busy = false;
let again = false;

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
  const res = await fetch(CONFIG.CHATBOT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export function initRoom(c) {
  ctx = c;
  if (!CONFIG.CHATBOT_URL) return;
  syncNow();
  timer = setInterval(syncNow, 30000);
  // 화면을 다시 켜면 바로 한 번
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') syncNow(); });
}

/** 지금 상태를 알리고 다른 사람들 자리를 받아 옴 (여러 번 불려도 한 번에 하나씩) */
export async function syncNow() {
  if (!ctx || !CONFIG.CHATBOT_URL) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    let r;
    if (ctx.isTeacher()) {
      // 선생님: 자리에 앉지 않고 구경만
      r = await api({ action: 'room.peek' });
      ctx.world.setRemoteSeats(r.seats || []);
    } else {
      const me = ctx.getMe();
      r = await api({ action: 'room.sync', device: deviceId(), ...me });
      if (r.taken && me.seat >= 0) {
        ctx.toast('앗, 그 자리는 방금 다른 친구가 앉았어요. 다른 자리를 골라 주세요');
        ctx.onTaken && ctx.onTaken();
      }
      ctx.world.setRemoteSeats(r.seats || []);
      if (r.calls && r.calls.length) ctx.onCalls && ctx.onCalls(r.calls);
    }
  } catch (e) {
    /* 연결이 안 되면 다음 번에 다시 */
  }
  busy = false;
  if (again) { again = false; syncNow(); }
}
