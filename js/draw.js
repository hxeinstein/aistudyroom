// ✏️ 내가 그린 친구: 동그란 얼굴 틀에 손가락으로 그리기 (하루 한 번 저장)
// 저장하는 그림은 투명 배경 PNG (얼굴 살구색은 3D 머리 색이라 그림엔 넣지 않음)
import { HAIR_COLORS } from './animals.js';

const SIZE = 256;           // 저장하는 그림 크기 (작게 → 친구 화면에 빨리 뜸)
const SKIN = '#F6D7B8';
const PENS = ['#2B2420', '#E2574C', '#F28C28', '#F5C451', '#81C784', '#4D8FD1', '#B39DDB', '#FFFFFF'];
const WIDTHS = [4, 8, 16];
const LS_FACE = 'aistudyroom.face';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 이 기기에 저장한 내 얼굴 { img, hair, day } */
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
  hairBangs: { name: '앞머리', draw: (g) => { g.beginPath(); g.arc(128, 128, 124, Math.PI * 1.06, Math.PI * 1.94); for (let i = 0; i <= 6; i++) { const x = 240 - i * 37; g.lineTo(x, i % 2 ? 88 : 76); } g.closePath(); g.fill(); } },
};

/** 그리기 화면 열기 · onSave({ img, hair }) */
export function openDrawer({ openModal, closeModal, toast, onSave, onCancel }) {
  if (!canDrawToday()) { toast('오늘은 이미 그렸어요. 내일 다시 그릴 수 있어요 ✏️'); return; }
  const prev = myFace();
  let pen = 0, width = 1, erase = false, hair = prev ? prev.hair : 0;
  const m = openModal(`
    <h2>✏️ 내 얼굴 그리기</h2>
    <p class="desc">손가락으로 동그란 얼굴에 그려 보세요. 스티커를 찍고 덧그려도 돼요. <b>하루에 한 번</b> 저장할 수 있어요.</p>
    <div class="dw-wrap"><canvas id="dwCanvas" width="${SIZE}" height="${SIZE}"></canvas></div>
    <div class="dw-row dw-pens">${PENS.map((c, i) => `<button type="button" data-p="${i}" class="${i === pen ? 'on' : ''}" style="background:${c}" aria-label="색"></button>`).join('')}</div>
    <div class="dw-row dw-tools">
      ${WIDTHS.map((w, i) => `<button type="button" data-w="${i}" class="${i === width ? 'on' : ''}"><i style="width:${4 + w}px;height:${4 + w}px"></i></button>`).join('')}
      <button type="button" id="dwErase">🧽 지우개</button><button type="button" id="dwUndo">↩ 되돌리기</button><button type="button" id="dwClear">🗑️</button>
    </div>
    <div class="dw-label">스티커 (지금 고른 색으로 찍혀요)</div>
    <div class="dw-row dw-stamps">${Object.entries(STAMPS).map(([k, s]) => `<button type="button" data-s="${k}">${esc(s.name)}</button>`).join('')}</div>
    <div class="dw-label">뒷머리 색</div>
    <div class="dw-row dw-hair"><button type="button" data-h="-1" class="${hair < 0 ? 'on' : ''}" style="background:${SKIN}" aria-label="없음">✕</button>${HAIR_COLORS.map((c, i) => `<button type="button" data-h="${i}" class="${i === hair ? 'on' : ''}" style="background:${c}" aria-label="색"></button>`).join('')}</div>
    <p class="hint">⚠️ 친구 얼굴 · 실명 · 나쁜 그림은 그리지 마세요. 친구들이 신고하면 그림이 숨겨져요.</p>
    <div class="foot"><button class="btn ghost" id="dwCancel" type="button">취소</button><button class="btn primary" id="dwSave" type="button">💾 저장</button></div>`, { dismiss: false });

  const cv = m.querySelector('#dwCanvas'), g = cv.getContext('2d');
  // 그림판: 투명 배경 (화면에는 CSS로 살구색 동그라미가 깔려 보임)
  const undo = [];
  const snap = () => { undo.push(g.getImageData(0, 0, SIZE, SIZE)); if (undo.length > 25) undo.shift(); };
  if (prev && prev.img) { const im = new Image(); im.onload = () => g.drawImage(im, 0, 0, SIZE, SIZE); im.src = prev.img; }
  const style = () => { g.globalCompositeOperation = erase ? 'destination-out' : 'source-over'; g.strokeStyle = g.fillStyle = PENS[pen]; g.lineWidth = WIDTHS[width]; g.lineCap = g.lineJoin = 'round'; };
  const clip = () => { g.save(); g.beginPath(); g.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2); g.clip(); };
  let last = null;
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE]; };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); cv.setPointerCapture(e.pointerId); snap(); last = pt(e); clip(); style(); g.beginPath(); g.arc(last[0], last[1], g.lineWidth / 2, 0, Math.PI * 2); g.fill(); g.restore(); });
  cv.addEventListener('pointermove', (e) => { if (!last) return; const p = pt(e); clip(); style(); g.beginPath(); g.moveTo(last[0], last[1]); g.lineTo(p[0], p[1]); g.stroke(); g.restore(); last = p; });
  const up = () => { last = null; g.globalCompositeOperation = 'source-over'; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);

  const pick = (sel, attr, fn) => m.querySelectorAll(sel).forEach((b) => (b.onclick = () => { m.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b)); fn(Number(b.dataset[attr])); }));
  pick('.dw-pens button', 'p', (i) => { pen = i; erase = false; m.querySelector('#dwErase').classList.remove('on'); });
  pick('.dw-tools button[data-w]', 'w', (i) => { width = i; });
  pick('.dw-hair button', 'h', (i) => { hair = i; });
  m.querySelector('#dwErase').onclick = (e) => { erase = !erase; e.currentTarget.classList.toggle('on', erase); };
  m.querySelector('#dwUndo').onclick = () => { const d = undo.pop(); if (d) g.putImageData(d, 0, 0); };
  m.querySelector('#dwClear').onclick = () => { snap(); g.clearRect(0, 0, SIZE, SIZE); };
  m.querySelectorAll('.dw-stamps button').forEach((b) => (b.onclick = () => { snap(); clip(); erase = false; m.querySelector('#dwErase').classList.remove('on'); style(); STAMPS[b.dataset.s].draw(g); g.restore(); }));
  m.querySelector('#dwCancel').onclick = () => { closeModal(); onCancel && onCancel(); };
  m.querySelector('#dwSave').onclick = () => {
    const img = cv.toDataURL('image/png');
    if (img.length > 90000) { toast('그림이 너무 복잡해요. 조금만 덜 칠해 주세요'); return; }
    const f = { img, hair, day: today() };
    saveFace(f);
    closeModal();
    onSave && onSave(f);
  };
}
