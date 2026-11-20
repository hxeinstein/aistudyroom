// ✏️ 내가 그린 친구: 동그란 얼굴 틀에 손가락으로 그리기 (하루 한 번 저장)
// 저장하는 그림은 투명 배경 PNG (얼굴 살구색은 3D 머리 색이라 그림엔 넣지 않음)
// 🧵 얼굴 밖으로 나간 선은 그림이 아니라 '머리카락 선'(좌표)으로 저장 → 3D에서 굵기 있는 머리카락이 돼요
import { HAIR_COLORS } from './animals.js';

const SIZE = 256;           // 저장하는 그림 크기 (작게 → 친구 화면에 빨리 뜸)
const SKIN = '#F6D7B8';
const PENS = ['#2B2420', '#E2574C', '#F28C28', '#F5C451', '#81C784', '#4D8FD1', '#B39DDB', '#FFFFFF'];
const WIDTHS = [4, 8, 16];
const BIG = 384, OFF = (BIG - SIZE) / 2, R = SIZE / 2;   // 그리기 판: 가운데 얼굴(지름 256) + 둘레 여백 64
const MAX_STRANDS = 30, MAX_PTS = 40;
export const PEN_COLORS = PENS;
const LS_FACE = 'aistudyroom.face';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 이 기기에 저장한 내 얼굴 { img, hair, day, strands: [{ c: 색 번호, w: 굵기 번호, p: [x, y, …] }] } */
export function myFace() { try { return JSON.parse(localStorage.getItem(LS_FACE)) || null; } catch (e) { return null; } }
function saveFace(f) { try { localStorage.setItem(LS_FACE, JSON.stringify(f)); } catch (e) {} }
const today = () => { const d = new Date(Date.now() - 6 * 3600000); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
export const canDrawToday = () => { const f = myFace(); return !f || f.day !== today(); };

// 스티커: 그림판 좌표(0~256)에 펜 색으로 그려 넣기
const STAMPS = {
  eyes1: { name: '동그란 눈', draw: (g) => { for (const x of [92, 164]) { g.beginPath(); g.arc(x, 112, 13, 0, Math.PI * 2); g.fill(); } } },
  eyes2: { name: '웃는 눈', draw: (g) => { g.lineWidth = 7; for (const x of [92, 164]) { g.beginPath(); g.arc(x, 118, 15, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } } },
  eyes3: { name: '반짝 눈', draw: (g) => { for (const x of [92, 164]) { g.beginPath(); g.ellipse(x, 112, 13, 17, 0, 0, Math.PI * 2); g.fill(); g.save(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x + 4, 106, 5, 0, Math.PI * 2); g.fill(); g.restore(); } } },
  mouth1: { name: '웃는 입', draw: (g) => { g.lineWidth = 6; g.beginPath(); g.arc(128, 150, 26, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); } },
  mouth2: { name: '동그란 입', draw: (g) => { g.lineWidth = 5; g.beginPath(); g.ellipse(128, 172, 12, 15, 0, 0, Math.PI * 2); g.stroke(); } },
  mouth3: { name: '헤 입', draw: (g) => { g.beginPath(); g.arc(128, 160, 22, 0, Math.PI); g.closePath(); g.fill(); } },
  brows: { name: '눈썹', draw: (g) => { g.lineWidth = 6; for (const [x, d] of [[92, -1], [164, 1]]) { g.beginPath(); g.moveTo(x - 16, 84 + d * 3); g.lineTo(x + 16, 84 - d * 3); g.stroke(); } } },
  hairShort: { name: '짧은 머리', draw: (g) => { g.beginPath(); g.arc(128, 128, 126, Math.PI * 1.08, Math.PI * 1.92); g.quadraticCurveTo(180, 40, 128, 52); g.quadraticCurveTo(76, 40, 12, 98); g.closePath(); g.fill(); } },
  hairLong: { name: '긴 머리', draw: (g) => { g.beginPath(); g.moveTo(8, 240); g.lineTo(8, 110); g.arc(128, 128, 122, Math.PI * 1.05, Math.PI * 1.95); g.lineTo(248, 240); g.lineTo(214, 240); g.quadraticCurveTo(222, 90, 128, 62); g.quadraticCurveTo(34, 90, 42, 240); g.closePath(); g.fill(); } },
  // (아래 세 가지는 얼굴 밖으로 나가는 3D 머리카락 선 스티커: strands = 그리기 판 좌표 0~384)
  longStr: { name: '긴 생머리', strands: () => [-1, 1].flatMap((sd) => [0, 1, 2, 3].map((k) => { const x0 = 192 + sd * (96 + k * 9), x1 = 192 + sd * (132 + k * 10); return [x0, 104 + k * 6, 192 + sd * (128 + k * 6), 160, x1, 230, x1 + sd * 6, 300 + k * 10, x1 + sd * 4, 352]; })) },
  twin: { name: '양갈래', strands: () => [-1, 1].flatMap((sd) => [0, 1, 2].map((k) => [192 + sd * 108, 110, 192 + sd * (150 + k * 6), 118 + k * 8, 192 + sd * (172 + k * 4), 170 + k * 6, 192 + sd * (168 + k * 6), 240 + k * 12, 192 + sd * (176 + k * 4), 300 + k * 10])) },
  pony: { name: '포니테일', strands: () => [0, 1, 2, 3].map((k) => [190 + k * 6, 66, 236 + k * 4, 48, 290 + k * 6, 64 + k * 4, 318 + k * 4, 120 + k * 10, 326 + k * 2, 190 + k * 12]) },
  hairBangs: { name: '앞머리', draw: (g) => { g.beginPath(); g.arc(128, 128, 124, Math.PI * 1.06, Math.PI * 1.94); for (let i = 0; i <= 6; i++) { const x = 240 - i * 37; g.lineTo(x, i % 2 ? 88 : 76); } g.closePath(); g.fill(); } },
};

/** 그리기 화면 열기 · onSave({ img, hair, strands, day }) */
export function openDrawer({ openModal, closeModal, toast, onSave, onCancel }) {
  if (!canDrawToday()) { toast('오늘은 이미 그렸어요. 내일 다시 그릴 수 있어요 ✏️'); return; }
  const prev = myFace();
  let pen = 0, width = 1, erase = false, hair = prev ? prev.hair : 0;
  let strands = prev && Array.isArray(prev.strands) ? prev.strands.map((x) => ({ ...x, p: x.p.slice() })) : [];
  const m = openModal(`
    <h2>✏️ 내 얼굴 그리기</h2>
    <p class="desc">동그란 얼굴 안은 그림으로, <b>얼굴 밖으로 그은 선은 3D 머리카락</b>이 돼요. <b>하루에 한 번</b> 저장할 수 있어요.</p>
    <div class="dw-wrap"><canvas id="dwCanvas" width="${BIG}" height="${BIG}"></canvas></div>
    <div class="dw-row dw-pens">${PENS.map((c, i) => `<button type="button" data-p="${i}" class="${i === pen ? 'on' : ''}" style="background:${c}" aria-label="색"></button>`).join('')}</div>
    <div class="dw-row dw-tools">
      ${WIDTHS.map((w, i) => `<button type="button" data-w="${i}" class="${i === width ? 'on' : ''}"><i style="width:${4 + w}px;height:${4 + w}px"></i></button>`).join('')}
      <button type="button" id="dwErase">🧽 지우개</button><button type="button" id="dwUndo">↩ 되돌리기</button><button type="button" id="dwClear">🗑️</button>
    </div>
    <div class="dw-label">스티커 (지금 고른 색으로 찍혀요 · 🧵는 3D 머리카락)</div>
    <div class="dw-row dw-stamps">${Object.entries(STAMPS).map(([k, s]) => `<button type="button" data-s="${k}">${s.strands ? '🧵 ' : ''}${esc(s.name)}</button>`).join('')}</div>
    <div class="dw-label">뒷머리 색</div>
    <div class="dw-row dw-hair"><button type="button" data-h="-1" class="${hair < 0 ? 'on' : ''}" style="background:${SKIN}" aria-label="없음">✕</button>${HAIR_COLORS.map((c, i) => `<button type="button" data-h="${i}" class="${i === hair ? 'on' : ''}" style="background:${c}" aria-label="색"></button>`).join('')}</div>
    <p class="hint" id="dwCount"></p>
    <p class="hint">⚠️ 친구 얼굴 · 실명 · 나쁜 그림은 그리지 마세요. 친구들이 신고하면 그림이 숨겨져요.</p>
    <div class="foot"><button class="btn ghost" id="dwCancel" type="button">취소</button><button class="btn primary" id="dwSave" type="button">💾 저장</button></div>`, { dismiss: false });

  const cv = m.querySelector('#dwCanvas'), out = cv.getContext('2d');
  // 얼굴 그림 (256, 투명 배경) — 화면에는 큰 판 가운데에 얹어서 보여 줌
  const fc = document.createElement('canvas'); fc.width = fc.height = SIZE;
  const g = fc.getContext('2d');
  const undo = [];
  const snap = () => { undo.push({ img: g.getImageData(0, 0, SIZE, SIZE), strands: strands.map((x) => ({ ...x, p: x.p.slice() })) }); if (undo.length > 25) undo.shift(); };
  const count = () => { m.querySelector('#dwCount').textContent = `🧵 3D 머리카락 ${strands.length} / ${MAX_STRANDS}개`; };
  const strandPath = (c2, st) => { c2.beginPath(); for (let i = 0; i < st.p.length; i += 2) (i ? c2.lineTo : c2.moveTo).call(c2, st.p[i], st.p[i + 1]); };
  const render = (live) => {
    out.clearRect(0, 0, BIG, BIG);
    // 머리카락 선 (얼굴 뒤에 깔리듯)
    out.lineCap = out.lineJoin = 'round';
    for (const st of strands) { out.strokeStyle = PENS[st.c]; out.lineWidth = WIDTHS[st.w] + 4; strandPath(out, st); out.stroke(); }
    // 얼굴
    out.fillStyle = SKIN; out.beginPath(); out.arc(BIG / 2, BIG / 2, R, 0, Math.PI * 2); out.fill();
    out.drawImage(fc, OFF, OFF);
    out.save(); out.setLineDash([6, 6]); out.strokeStyle = '#D9B28C'; out.lineWidth = 2; out.beginPath(); out.arc(BIG / 2, BIG / 2, R, 0, Math.PI * 2); out.stroke(); out.restore();
    if (live && live.length > 2) { out.strokeStyle = erase ? 'rgba(0,0,0,.25)' : PENS[pen]; out.lineWidth = WIDTHS[width] + (erase ? 0 : 4); strandPath(out, { p: live }); out.stroke(); }
    count();
  };
  if (prev && prev.img) { const im = new Image(); im.onload = () => { g.drawImage(im, 0, 0, SIZE, SIZE); render(); }; im.src = prev.img; }
  const style = () => { g.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; g.strokeStyle = g.fillStyle = PENS[pen]; g.lineWidth = WIDTHS[width]; g.lineCap = g.lineJoin = 'round'; };
  const clip = () => { g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, Math.PI * 2); g.clip(); };
  const outside = (x, y) => Math.hypot(x - BIG / 2, y - BIG / 2) > R + 6;
  let pts = null, wentOut = false;
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * BIG, ((e.clientY - r.top) / r.height) * BIG]; };
  const paintSeg = (a, b) => { clip(); style(); g.beginPath(); g.moveTo(a[0] - OFF, a[1] - OFF); g.lineTo(b[0] - OFF, b[1] - OFF); g.stroke(); g.restore(); };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId); snap();
    const p = pt(e); pts = [p[0], p[1]]; wentOut = outside(p[0], p[1]);
    if (!wentOut) { clip(); style(); g.beginPath(); g.arc(p[0] - OFF, p[1] - OFF, g.lineWidth / 2, 0, Math.PI * 2); g.fill(); g.restore(); }
    render(wentOut ? pts : null);
  });
  cv.addEventListener('pointermove', (e) => {
    if (!pts) return;
    const p = pt(e), lx = pts[pts.length - 2], ly = pts[pts.length - 1];
    if (Math.hypot(p[0] - lx, p[1] - ly) < 5) return;
    if (!wentOut && outside(p[0], p[1])) wentOut = true;   // 얼굴 밖으로 나가면 이 선은 머리카락이 됨
    if (!wentOut || erase) paintSeg([lx, ly], p);
    pts.push(Math.round(p[0]), Math.round(p[1]));
    render(wentOut ? pts : null);
  });
  const up = () => {
    if (!pts) return;
    if (erase && wentOut) {   // 지우개로 머리카락 선을 쓸면 그 선을 뺌
      strands = strands.filter((st) => { for (let i = 0; i < st.p.length; i += 2) for (let j = 0; j < pts.length; j += 2) if (Math.hypot(st.p[i] - pts[j], st.p[i + 1] - pts[j + 1]) < 14) return false; return true; });
    } else if (wentOut && pts.length >= 4) {
      if (strands.length >= MAX_STRANDS) toast(`3D 머리카락은 ${MAX_STRANDS}개까지예요`);
      else strands.push({ c: pen, w: width, p: simplify(pts) });
    }
    pts = null; g.globalCompositeOperation = 'source-over'; render();
  };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  render();

  const pick = (sel, attr, fn) => m.querySelectorAll(sel).forEach((b) => (b.onclick = () => { m.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b)); fn(Number(b.dataset[attr])); }));
  pick('.dw-pens button', 'p', (i) => { pen = i; erase = false; m.querySelector('#dwErase').classList.remove('on'); });
  pick('.dw-tools button[data-w]', 'w', (i) => { width = i; });
  pick('.dw-hair button', 'h', (i) => { hair = i; });
  m.querySelector('#dwErase').onclick = (e) => { erase = !erase; e.currentTarget.classList.toggle('on', erase); };
  m.querySelector('#dwUndo').onclick = () => { const d = undo.pop(); if (d) { g.putImageData(d.img, 0, 0); strands = d.strands; render(); } };
  m.querySelector('#dwClear').onclick = () => { snap(); g.clearRect(0, 0, SIZE, SIZE); strands = []; render(); };
  m.querySelectorAll('.dw-stamps button').forEach((b) => (b.onclick = () => {
    const st = STAMPS[b.dataset.s];
    snap(); erase = false; m.querySelector('#dwErase').classList.remove('on');
    if (st.strands) {
      const add = st.strands().map((p) => ({ c: pen, w: Math.max(width, 1), p: simplify(smooth(p)) }));
      if (strands.length + add.length > MAX_STRANDS) { toast(`3D 머리카락은 ${MAX_STRANDS}개까지예요`); undo.pop(); return; }
      strands = strands.concat(add);
    } else { clip(); style(); st.draw(g); g.restore(); }
    render();
  }));
  m.querySelector('#dwCancel').onclick = () => { closeModal(); onCancel && onCancel(); };
  m.querySelector('#dwSave').onclick = () => {
    const img = fc.toDataURL('image/png');
    if (img.length > 90000) { toast('그림이 너무 복잡해요. 조금만 덜 칠해 주세요'); return; }
    const f = { img, hair, strands, day: today() };
    saveFace(f);
    closeModal();
    onSave && onSave(f);
  };
}
/** 점이 너무 많으면 줄이기 (최대 MAX_PTS개) */
function simplify(p) {
  const out = [];
  const step = Math.max(1, Math.ceil(p.length / 2 / MAX_PTS));
  for (let i = 0; i < p.length; i += 2 * step) out.push(Math.round(p[i]), Math.round(p[i + 1]));
  const n = p.length;
  if (out[out.length - 2] !== Math.round(p[n - 2])) out.push(Math.round(p[n - 2]), Math.round(p[n - 1]));
  return out;
}
/** 스티커의 굵은 꺾은선을 부드럽게 (점 사이를 채움) */
function smooth(p) {
  const out = [];
  for (let i = 0; i < p.length - 2; i += 2) for (let t = 0; t < 1; t += 0.25) out.push(p[i] + (p[i + 2] - p[i]) * t, p[i + 1] + (p[i + 3] - p[i + 1]) * t);
  out.push(p[p.length - 2], p[p.length - 1]);
  return out;
}
