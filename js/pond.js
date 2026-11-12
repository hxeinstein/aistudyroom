// 🌿 쉼터 연못: 🎣 과학 퀴즈 낚시 · 📖 물고기 도감 · 🪙 소원 동전
import * as S from './store.js';
import { QUIZ, FISH } from './quiz.js';
import { badWord } from './words.js';

let ctx = null;   // { world, toast, openModal, closeModal }
const LS_FISH = 'aistudyroom.fish', LS_WISH = 'aistudyroom.wish';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

export function initPond(c) {
  ctx = c;
  setInterval(checkWish, 20000);
}

/* ---------- 🎣 낚시 퀴즈 ---------- */
let recent = [];
function pickQuestion() {
  const pool = QUIZ.map((q, i) => i).filter((i) => !recent.includes(i));
  const i = pool[(Math.random() * pool.length) | 0];
  recent.push(i); if (recent.length > Math.min(30, QUIZ.length - 5)) recent.shift();
  return { ...QUIZ[i], i };
}
function rollFish() {
  const sum = FISH.reduce((a, f) => a + f.w, 0);
  let r = Math.random() * sum;
  for (const f of FISH) { if ((r -= f.w) <= 0) return f; }
  return FISH[0];
}
/** 찌가 흔들리면 (world.js onFishBite) */
export function openFishQuiz() {
  const q = pickQuestion();
  let answered = false;
  const m = ctx.openModal(`
    <h2>🎣 입질이 왔어요!</h2>
    <p class="desc">정답을 맞히면 물고기를 낚아요</p>
    <p class="qz-q">${esc(q.q)}</p>
    <div class="qz-opts">${q.c.map((c, k) => `<button type="button" class="qz-opt" data-k="${k}"><b>${'①②③④'[k]}</b> ${esc(c)}</button>`).join('')}</div>
    <div id="qzResult"></div>
    <div class="foot" id="qzFoot"><button class="btn ghost" id="qzLet" type="button">놓아주기</button></div>`, { dismiss: false });
  const finish = (fish) => { ctx.world.fishResult(fish); };
  m.querySelector('#qzLet').onclick = () => { if (!answered) finish(null); ctx.closeModal(); };
  m.querySelectorAll('.qz-opt').forEach((b) => (b.onclick = () => {
    if (answered) return;
    answered = true;
    const k = Number(b.dataset.k), ok = k === q.a;
    m.querySelectorAll('.qz-opt').forEach((x) => { x.disabled = true; const xk = Number(x.dataset.k); if (xk === q.a) x.classList.add('right'); else if (xk === k) x.classList.add('wrong'); });
    let fish = null, html;
    if (ok) {
      fish = rollFish();
      const bag = lsGet(LS_FISH, {}); const first = !bag[fish.id]; bag[fish.id] = (bag[fish.id] || 0) + 1; lsSet(LS_FISH, bag);
      const kinds = FISH.filter((f) => bag[f.id]).length;
      html = `<div class="qz-res ok"><div class="qz-fish">${fish.icon}</div><b>정답! ${esc(fish.name)}를 낚았어요${first ? ' · 새 물고기!' : ''}</b><small>도감 ${kinds} / ${FISH.length}종</small></div>`;
    } else {
      html = `<div class="qz-res no"><div class="qz-fish">💨</div><b>아쉬워요, 물고기가 도망갔어요</b></div>`;
    }
    m.querySelector('#qzResult').innerHTML = html + `<p class="qz-exp">💡 ${esc(q.e)}</p>`;
    m.querySelector('#qzFoot').innerHTML = `<button class="btn ghost" id="qzBook" type="button">📖 도감</button><button class="btn primary" id="qzGo" type="button">🎣 계속 낚시</button>`;
    m.querySelector('#qzGo').onclick = ctx.closeModal;
    m.querySelector('#qzBook').onclick = openFishBook;
    finish(fish);
  }));
}
export function openFishBook() {
  const bag = lsGet(LS_FISH, {});
  const total = Object.values(bag).reduce((a, n) => a + n, 0);
  const kinds = FISH.filter((f) => bag[f.id]).length;
  const m = ctx.openModal(`
    <h2>📖 내 물고기 도감</h2>
    <p class="desc">${kinds} / ${FISH.length}종 · 모두 ${total}마리 낚았어요</p>
    <div class="fish-grid">${FISH.map((f) => `<div class="fish-card ${bag[f.id] ? '' : 'none'}"><span>${bag[f.id] ? f.icon : '❔'}</span><b>${bag[f.id] ? esc(f.name) : '???'}</b><small>${bag[f.id] ? bag[f.id] + '마리' : '아직 못 낚음'}</small></div>`).join('')}</div>
    <div class="foot"><button class="btn primary" id="fbClose" type="button">닫기</button></div>`);
  m.querySelector('#fbClose').onclick = ctx.closeModal;
}

/* ---------- 🪙 소원 동전 ---------- */
const todayWish = () => { const w = lsGet(LS_WISH, null); return w && w.day === S.dayKey() ? w : null; };
export function openWish() {
  const w = todayWish();
  const m = ctx.openModal(`
    <h2>🪙 소원 동전</h2>
    <p class="desc">${w ? `오늘 빈 소원: <b>${esc(w.text)}</b><br>다시 던지면 소원을 바꿀 수 있어요.` : '연못에 동전을 던지며 오늘의 공부 목표를 빌어 보세요.'}<br>오늘 플래너의 할 일을 모두 끝내면 연못이 반짝반짝 빛나요 ✨</p>
    <input class="field" id="wsText" maxlength="30" placeholder="예: 통합과학 2단원 끝내기" value="${esc(w ? w.text : S.getGoal() || '')}">
    <p class="c-gate-msg" id="wsMsg"></p>
    <div class="foot"><button class="btn ghost" id="wsCancel" type="button">닫기</button><button class="btn primary" id="wsGo" type="button">🪙 퐁당!</button></div>`);
  m.querySelector('#wsCancel').onclick = ctx.closeModal;
  m.querySelector('#wsGo').onclick = () => {
    const text = m.querySelector('#wsText').value.trim();
    if (!text) { m.querySelector('#wsMsg').textContent = '소원을 적어 주세요'; return; }
    if (badWord(text)) { m.querySelector('#wsMsg').textContent = '쓸 수 없는 말이 있어요'; return; }
    lsSet(LS_WISH, { day: S.dayKey(), text, told: false });
    ctx.closeModal();
    ctx.world.throwCoin();
    setTimeout(() => ctx.toast('🪙 퐁당! 소원을 빌었어요. 할 일을 다 끝내면 연못이 반짝여요'), 900);
    setTimeout(checkWish, 1500);
  };
  setTimeout(() => m.querySelector('#wsText').focus(), 50);
}
/** 오늘 소원을 빌었고, 플래너 할 일을 모두 끝냈으면 연못 반짝 */
export function checkWish() {
  if (!ctx) return;
  const w = todayWish();
  ctx.world.setWishCoin(!!w);
  if (!w) { ctx.world.setWishDone(false); return; }
  const day = S.getDay();
  const done = (day.todos.length > 0 && day.todos.every((t) => t.done)) || !!day.finishedAt;
  ctx.world.setWishDone(done);
  if (done && !w.told && ctx.world.area === 'park') {
    w.told = true; lsSet(LS_WISH, w);
    ctx.toast('🌟 소원이 이루어졌어요! 연못이 반짝반짝 빛나요', 6000);
  }
}
