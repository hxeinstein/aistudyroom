// 🤼 쉼터 씨름장: 둘이서 샅바 잡고 겨루기 (연타 + 기술 타이밍)
// - 화면을 빠르게 누를수록(💪 힘!) 힘 게이지가 상대 쪽으로 밀려요. 1초에 9번까지만 셈 (자동 누르기 방지)
// - 게이지에 ⚡ 반짝 신호가 뜨는 순간 '기술!'을 누르면 크게 밀고, 엉뚱할 때 누르면 살짝 밀려요
// - 실시간 정보는 이미 쓰는 '내 정보'(players/내 uid)에 sr 칸으로 실어 보내요 → Firebase 규칙을 바꿀 필요 없음
// - 두 사람 중 uid가 앞선 쪽(방장)이 게이지를 계산해서 알려 주고, 다른 쪽은 받아서 보여 줘요
import * as Room from './room.js';

let ctx = null;   // { world, toast, openModal, closeModal, getProfile, sfx }
const FIGHT_MS = 30000, COUNT_MS = 3500, TAP_GAP = 110, TECH_WIN = 700;
const PUSH = 0.05, TECH = 0.2, MISS = 0.05;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- 주고받기 (실시간 · 시험용 탭 사이) ---------- */
// ?ssrmock 이면 같은 브라우저의 다른 탭끼리 BroadcastChannel로 주고받음 (Firebase 없이 둘이 겨루기 시험)
const MOCK = new URLSearchParams(location.search).has('ssrmock');
const mock = MOCK ? { id: 'm' + Math.random().toString(36).slice(2, 8), peers: new Map(), ch: new BroadcastChannel('ssr') } : null;
if (mock) mock.ch.onmessage = (e) => { const v = e.data; if (v && v.uid !== mock.id) mock.peers.set(v.uid, { ...v, at: Date.now() }); };
const myId = () => (mock ? mock.id : Room.myUid());
const now = () => (mock ? Date.now() : Room.serverNow());
const peers = () => (mock ? [...mock.peers.values()].filter((p) => Date.now() - p.at < 3000) : Room.onlinePlayers());
const peer = (id) => peers().find((p) => p.uid === id);

let mine = null;     // 내 sr (남에게 보이는 씨름 정보)
let game = null;     // 진행 중인 경기
let asked = {};      // 이미 물어본 도전 (도전자 uid → 시각)

/** Room이 '내 정보'에 붙여 보내는 씨름 칸 */
export const presence = () => mine;

export function initSsireum(c) {
  ctx = c;
  setInterval(watch, 250);
  if (mock) setInterval(() => mock.ch.postMessage({ uid: mock.id, n: ctx.getProfile().name, a: ctx.getProfile().animal, ar: ctx.world.area, sr: mine }), 150);
  window.addEventListener('keydown', (e) => {
    if (!game || game.phase !== 'fight' || e.repeat) return;
    if (e.key === ' ' || e.key === 'f') { e.preventDefault(); tap(); }
    if (e.key === 'Enter' || e.key === 'j') { e.preventDefault(); tech(); }
  });
}

/* ---------- 씨름장 화면 (도전 · 연습) ---------- */
export function openSsireum() {
  if (game) return;
  const near = peers().filter((p) => p.ar === 'park' && p.uid !== myId());
  const m = ctx.openModal(`
    <h2>🤼 씨름장</h2>
    <p class="desc"><b>💪 힘!</b>을 빠르게 눌러 상대를 밀고, 게이지에 <b>⚡</b>가 반짝일 때 <b>기술!</b>을 누르면 한 번에 크게 밀어요. 끝까지 밀어내거나 30초 뒤 더 밀고 있는 쪽이 이겨요.</p>
    <button class="btn primary block" id="srNpc" type="button">🤖 연습 상대와 겨루기</button>
    <h3 class="sg-h">쉼터에 있는 친구에게 도전</h3>
    <div class="sr-list">${near.length ? near.map((p) => `<button type="button" class="sr-peer" data-u="${esc(p.uid)}"><b>${esc(p.n || '친구')}</b><span>도전하기 🤼</span></button>`).join('') : '<p class="hint">지금 쉼터에 다른 친구가 없어요. 연습 상대와 겨뤄 봐요!</p>'}</div>
    <div class="foot"><button class="btn ghost" id="srClose" type="button">닫기</button></div>`);
  m.querySelector('#srClose').onclick = ctx.closeModal;
  m.querySelector('#srNpc').onclick = () => { ctx.closeModal(); startGame({ vs: 'npc', host: true, side: -1, sd: (Math.random() * 1e6) | 0, t0: now() + COUNT_MS }); };
  m.querySelectorAll('.sr-peer').forEach((b) => (b.onclick = () => { ctx.closeModal(); challenge(b.dataset.u); }));
}
function challenge(uid) {
  mine = { ch: uid, at: now() };
  const p = peer(uid);
  ctx.toast(`🤼 ${p ? p.n : '친구'}에게 도전장을 보냈어요. 받으면 바로 시작해요!`, 4000);
  setTimeout(() => { if (mine && mine.ch === uid && !game) { mine = null; ctx.toast('도전이 받아지지 않았어요'); } }, 20000);
}

/* ---------- 도전 받기 · 짝 맞추기 (0.25초마다) ---------- */
function watch() {
  if (!ctx || !myId()) return;
  // 누가 나에게 도전했나?
  if (!game && !(mine && mine.ch)) {
    const c = peers().find((p) => p.sr && p.sr.ch === myId() && !p.sr.on && now() - (p.sr.at || 0) < 20000);
    if (c && !asked[c.uid] && ctx.world.area === 'park') {
      asked[c.uid] = Date.now();
      setTimeout(() => { delete asked[c.uid]; }, 25000);
      const m = ctx.openModal(`
        <h2>🤼 씨름 도전!</h2>
        <p class="desc"><b>${esc(c.n || '친구')}</b>이(가) 씨름을 하자고 해요. 받을까요?</p>
        <div class="foot"><button class="btn ghost" id="srNo" type="button">다음에</button><button class="btn primary" id="srYes" type="button">받기 💪</button></div>`);
      m.querySelector('#srNo').onclick = ctx.closeModal;
      m.querySelector('#srYes').onclick = () => { ctx.closeModal(); mine = { ch: c.uid, at: now() }; };
    }
  }
  // 서로 도전 → 경기 시작 (uid가 앞선 쪽이 방장: 시작 시각과 반짝 순서를 정함)
  if (!game && mine && mine.ch) {
    const p = peer(mine.ch);
    if (p && p.sr && p.sr.ch === myId()) {
      const host = myId() < p.uid;
      if (host) startGame({ vs: p.uid, host: true, side: -1, sd: (Math.random() * 1e6) | 0, t0: now() + COUNT_MS });
      else if (p.sr.t0) startGame({ vs: p.uid, host: false, side: 1, sd: p.sr.sd, t0: p.sr.t0 });
    }
  }
}

/* ---------- 경기 ---------- */
const rnd = (seed, i) => { let x = (seed + i * 7919) | 0; x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) | 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d); x ^= x >>> 15; return ((x >>> 0) % 10000) / 10000; };
/** 반짝 신호 시각 (경기 시작부터 ms) — 두 사람이 같은 순서를 봄 */
function flashes(sd) { const out = []; let t = 2200; for (let i = 0; t < FIGHT_MS - 800; i++) { t += 2200 + rnd(sd, i) * 1800; out.push(t); } return out; }

function startGame(o) {
  game = { ...o, phase: 'count', g: 0, taps: [], n: 0, k: 0, mi: 0, oppHist: [], lastOK: 0, lastOM: 0, lastMyK: 0, lastMyM: 0, fl: flashes(o.sd), usedFl: -1, npc: { n: 0, k: 0, acc: 0 } };
  // 남에게 보이는 씨름 칸: on(경기 중) · side(-1 빨강/1 파랑) · n(힘 누른 수) · k(기술 성공) · mi(헛손질)
  // 방장만: t0(시작 시각) · sd(반짝 순서 씨앗) · g(게이지, 방장 쪽 +) · w(이긴 사람)
  mine = { ch: o.vs === 'npc' ? '' : o.vs, at: now(), on: 1, side: o.side, n: 0, k: 0, mi: 0 };
  if (o.host) { mine.t0 = o.t0; mine.sd = o.sd; }
  ctx.closeModal && ctx.closeModal();
  ctx.world.setWrestle({ side: o.side, g: 0, fight: false, end: null, npc: o.vs === 'npc' });
  showHud();
  document.body.classList.add('in-wrestle');
  requestAnimationFrame(loop);
}

function tap() {
  if (!game || game.phase !== 'fight') return;
  const t = performance.now();
  const last = game.taps[game.taps.length - 1] || 0;
  if (t - last < TAP_GAP) return;   // 1초에 9번까지만
  game.taps.push(t); if (game.taps.length > 30) game.taps.shift();
  game.n++; mine.n = game.n;
  pulse('srPow');
}
function tech() {
  if (!game || game.phase !== 'fight') return;
  const el = now() - game.t0;
  const i = game.fl.findIndex((f) => el >= f && el <= f + TECH_WIN);
  if (i >= 0 && i !== game.usedFl) { game.usedFl = i; game.k++; mine.k = game.k; ctx.toast('⚡ 기술 성공! 영차!', 900); ctx.sfx && ctx.sfx('thunk'); }
  else { game.mi++; mine.mi = game.mi; ctx.toast('앗, 헛손질!', 700); }
  pulse('srTech');
}
const rate = (taps, t) => taps.filter((x) => t - x < 1000).length;

function loop() {
  if (!game) return;
  const g = game, t = now(), el = t - g.t0;
  const opp = g.vs === 'npc' ? null : peer(g.vs);
  // 상대가 사라짐
  if (g.vs !== 'npc' && g.phase !== 'end') {
    if (opp) g.seenAt = Date.now();
    else if (Date.now() - (g.seenAt || Date.now()) > 5000) return finish(null, '상대가 나갔어요');
    if (!g.seenAt) g.seenAt = Date.now();
  }
  if (g.phase === 'count') {
    const left = Math.ceil(-el / 1000);
    setHud(left > 0 ? `${left}` : '시작!', 0, false);
    if (el >= 0) { g.phase = 'fight'; ctx.world.setWrestle({ fight: true }); ctx.sfx && ctx.sfx('toot'); }
  } else if (g.phase === 'fight') {
    const dt = Math.min(0.1, (performance.now() - (g.lastFrame || performance.now())) / 1000);
    if (g.host) {
      // 방장: 게이지 계산 (내 쪽이 +)
      let myRate = rate(g.taps, performance.now());
      let opRate = 0, opK = 0, opM = 0;
      if (g.vs === 'npc') {
        g.npc.acc += dt * (4.2 + Math.sin(el / 1300) * 1.2);
        while (g.npc.acc >= 1) { g.npc.acc -= 1; g.npc.n++; }
        g.oppHist.push([performance.now(), g.npc.n]);
        const fi = g.fl.findIndex((f) => el >= f + 250 && el <= f + TECH_WIN);
        if (fi >= 0 && g.npc.lastFl !== fi) { g.npc.lastFl = fi; if (rnd(g.sd, fi + 99) < 0.55) g.npc.k++; }
        opK = g.npc.k;
      } else if (opp && opp.sr) {
        g.oppHist.push([performance.now(), opp.sr.n || 0]);
        opK = opp.sr.k || 0; opM = opp.sr.mi || 0;
      }
      g.oppHist = g.oppHist.filter(([tt]) => performance.now() - tt < 1500);
      if (g.oppHist.length > 1) { const a = g.oppHist[0], b = g.oppHist[g.oppHist.length - 1]; opRate = Math.min(9, ((b[1] - a[1]) * 1000) / Math.max(400, b[0] - a[0])); }
      g.g += (Math.min(9, myRate) - opRate) * PUSH * dt;
      if (g.k > g.lastMyK) { g.g += TECH * (g.k - g.lastMyK); g.lastMyK = g.k; }
      if (g.mi > g.lastMyM) { g.g -= MISS * (g.mi - g.lastMyM); g.lastMyM = g.mi; }
      if (opK > g.lastOK) { g.g -= TECH * (opK - g.lastOK); g.lastOK = opK; }
      if (opM > g.lastOM) { g.g += MISS * (opM - g.lastOM); g.lastOM = opM; }
      g.g = Math.max(-1, Math.min(1, g.g));
      mine.g = Math.round(g.g * 100) / 100;
      if (Math.abs(g.g) >= 1 || el >= FIGHT_MS) {
        const w = Math.abs(g.g) < 0.05 ? 'draw' : g.g > 0 ? myId() : (g.vs === 'npc' ? 'npc' : g.vs);
        mine.w = w;
        return finish(w);
      }
      showGauge(g.g, el);
    } else {
      // 상대(방장)가 계산한 게이지를 받아서 내 쪽 기준으로 뒤집어 보여 줌
      if (opp && opp.sr) {
        if (typeof opp.sr.g === 'number') g.g = -opp.sr.g;
        if (opp.sr.w) return finish(opp.sr.w);
      }
      showGauge(g.g, el);
      if (el > FIGHT_MS + 6000) return finish(null, '연결이 끊겼어요');
    }
    ctx.world.setWrestle({ g: g.g });
  }
  g.lastFrame = performance.now();
  requestAnimationFrame(loop);
}

function finish(w, why) {
  const g = game;
  if (!g || g.phase === 'end') return;
  g.phase = 'end';
  const res = why ? 'none' : w === 'draw' ? 'draw' : w === myId() ? 'win' : 'lose';
  ctx.world.setWrestle({ fight: false, g: res === 'win' ? 0.6 : res === 'lose' ? -0.6 : 0, end: res === 'win' ? 'win' : res === 'lose' ? 'lose' : null });
  const oppName = g.vs === 'npc' ? '연습 상대' : (peer(g.vs) || {}).n || '친구';
  const title = why ? `😮 ${why}` : res === 'win' ? '🏆 이겼어요!' : res === 'lose' ? '😵 아쉽게 졌어요' : '🤝 비겼어요';
  ctx.sfx && ctx.sfx(res === 'win' ? 'vend' : 'thunk');
  setHud(title, 0, true, `${esc(oppName)}와(과)의 씨름`);
  if (res === 'win') ctx.world.showFx(null, '🏆');
  setTimeout(() => { mine = mine ? { ...mine, on: 0 } : null; }, 2500);
  setTimeout(() => endGame(), 3500);
}
function endGame() {
  game = null; mine = null;
  ctx.world.setWrestle(null);
  const h = document.getElementById('srHud'); if (h) h.remove();
  document.body.classList.remove('in-wrestle');
}

/* ---------- 화면 (게이지 · 힘 · 기술 단추) ---------- */
function showHud() {
  let h = document.getElementById('srHud'); if (h) h.remove();
  h = document.createElement('div'); h.id = 'srHud'; h.className = 'sr-hud' + (game && game.side > 0 ? ' blue' : '');
  h.innerHTML = `
    <div class="sr-top"><span class="sr-red">나</span><div class="sr-bar"><i id="srFill"></i><b id="srMark"></b><em id="srFlash">⚡</em></div><span class="sr-blue">상대</span></div>
    <div class="sr-msg" id="srMsg">3</div><div class="sr-sub" id="srSub"></div>
    <div class="sr-btns"><button type="button" id="srPow">💪<b>힘!</b><small>빠르게 톡톡</small></button><button type="button" id="srTech">⚡<b>기술!</b><small>반짝일 때</small></button></div>
    <button type="button" class="sr-quit" id="srQuit">그만하기</button>`;
  document.body.appendChild(h);
  const pow = h.querySelector('#srPow'), te = h.querySelector('#srTech');
  pow.addEventListener('pointerdown', (e) => { e.preventDefault(); tap(); });
  te.addEventListener('pointerdown', (e) => { e.preventDefault(); tech(); });
  h.querySelector('#srQuit').onclick = () => { if (game && game.phase !== 'end') finish(game.vs === 'npc' ? 'npc' : game.vs); else endGame(); };
}
function setHud(msg, g, done, sub = '') {
  const m = document.getElementById('srMsg'); if (m) m.textContent = msg;
  const s = document.getElementById('srSub'); if (s) s.innerHTML = sub;
  const h = document.getElementById('srHud'); if (h) h.classList.toggle('done', !!done);
  if (done) { const q = document.getElementById('srQuit'); if (q) q.textContent = '닫기'; }
}
function showGauge(g, el) {
  const f = document.getElementById('srFill'), mk = document.getElementById('srMark'), fl = document.getElementById('srFlash');
  if (!f) return;
  const pct = 50 + g * 50;   // 내 쪽(+)이 오른쪽으로 밀어붙임
  f.style.width = pct + '%'; mk.style.left = pct + '%';
  const on = game.fl.some((x) => el >= x && el <= x + TECH_WIN);
  fl.classList.toggle('on', on);
  document.getElementById('srTech')?.classList.toggle('on', on);
  const left = Math.max(0, Math.ceil((FIGHT_MS - el) / 1000));
  const m = document.getElementById('srMsg'); if (m) m.textContent = `${left}초`;
}
function pulse(id) { const b = document.getElementById(id); if (!b) return; b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); }
