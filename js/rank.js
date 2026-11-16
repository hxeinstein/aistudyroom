// 🏆 공부 랭킹: 같은 학교 코드로 들어온 학생 전체의 오늘 · 이번 주 · 이번 달 공부 시간 (Apps Script stat.rank)
// 공부방 뒷벽 전광판에 10등까지 번갈아 보여 주고, 누르면 자세히 + 내 순위
import { CONFIG } from './config.js';
import { schoolCode } from './school.js';
import { animalById } from './store.js';

let ctx = null;   // { world, openModal, closeModal, deviceId(), isTeacher() }
let data = null;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const hmShort = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
const hm = (min) => (min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`);
const TABS = [['today', '오늘'], ['week', '이번 주'], ['month', '이번 달']];

async function api(body) {
  const res = await fetch(CONFIG.CHATBOT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ school: schoolCode(), ...body }) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
async function refresh() {
  if (!CONFIG.CHATBOT_URL) return;
  try {
    const r = await api({ action: 'stat.rank', device: ctx.isTeacher() ? '' : ctx.deviceId() });
    if (r && r.today) { data = r; ctx.world.setRank(r); }
  } catch (e) { /* 다음에 다시 */ }
}
export function initRank(c) {
  ctx = c;
  setTimeout(refresh, 4000);
  setInterval(refresh, 3 * 60 * 1000);
}

export async function openRank() {
  let tab = 'today';
  const m = ctx.openModal(`
    <h2>🏆 공부 랭킹</h2>
    <p class="desc">우리 학교 코드로 들어온 친구들의 공부 시간이에요. (지금 접속하지 않은 친구도 포함)</p>
    <div class="pp-tabs rk-tabs">${TABS.map(([k, n]) => `<button type="button" data-t="${k}" class="${k === tab ? 'on' : ''}">${n}</button>`).join('')}</div>
    <div id="rkBody"><p class="hint">불러오는 중…</p></div>
    <p class="hint">⚙️ 설정에서 '순위에 내 이름 보이기'를 끄면 랭킹에 나오지 않아요. 공부 시간은 10분마다 모여요.</p>
    <div class="foot"><button class="btn primary" id="rkClose" type="button">닫기</button></div>`, { wide: true });
  m.querySelector('#rkClose').onclick = ctx.closeModal;
  const draw = () => {
    const box = m.querySelector('#rkBody');
    if (!box) return;
    if (!data) { box.innerHTML = '<p class="hint">랭킹을 불러오지 못했어요. 잠시 후 다시 열어 주세요.</p>'; return; }
    const d = data[tab];
    const head = tab === 'today' ? `<div class="rk-total">오늘 우리 독서실에 쌓인 공부 시간 <b>${hm(data.total || 0)}</b></div>` : `<div class="rk-total"><b>${d.count}명</b>이 함께 공부했어요</div>`;
    const row = (x, i) => `
      <div class="rk-row ${x.me ? 'me' : ''}"><span class="rk-no">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="rk-name">${animalById(x.a || 'bear').emoji} ${esc(x.n)}</span><span class="rk-time">${hmShort(x.m)}</span></div>`;
    const top = d.top.slice(0, 10);   // 10등까지만 · 왼쪽 1~5등, 오른쪽 6~10등
    const rows = top.length ? `<div class="rk-col">${top.slice(0, 5).map((x, i) => row(x, i)).join('')}</div><div class="rk-col">${top.slice(5, 10).map((x, i) => row(x, i + 5)).join('')}</div>`
      : '<p class="hint">아직 기록이 없어요. 첫 1등이 되어 보세요!</p>';
    const mine = ctx.isTeacher() ? '' : d.me ? `<div class="rk-mine">나는 <b>${d.me.rank}등</b> · ${hm(d.me.m)}${d.me.rank > 10 ? ` <small>(10등까지 ${hm(Math.max(0, (d.top[9]?.m || 0) - d.me.m + 1))} 남았어요)</small>` : ''}</div>` : '<div class="rk-mine">아직 순위에 없어요. 공부를 시작하면 10분 안에 올라가요!</div>';
    box.innerHTML = head + `<div class="rk-list">${rows}</div>` + mine;
  };
  m.querySelectorAll('.rk-tabs button').forEach((b) => (b.onclick = () => { tab = b.dataset.t; m.querySelectorAll('.rk-tabs button').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
  if (data) draw();
  await refresh();
  draw();
}
