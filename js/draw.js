// ✏️ 내가 그린 친구: 3D 머리를 돌려 가며 직접 칠하기 (하루 한 번 저장)
// - 한 손가락: 칠하기 · 두 손가락: 돌리기 / 크게·작게 · 버튼으로도 돌리기
// - 틀 없이 동그란 머리에 칠한 그대로 보여요 (머리카락도 직접 칠하기)
// - 머리 둘레에 투명한 머리카락 공간(어깨 아래까지): 칠한 곳만 보여요 → 긴 머리도 칠한 대로
// - 저장: 머리 그림(512×256) + 머리카락 공간 그림(256×256) PNG (색을 정리해 작게)
import * as THREE from '../vendor/three.module.min.js';
import { makeAnimal, FRONT_RECT, HEAD_TEX, HAIR_TEX, HAIR_FREE_SCALE } from './animals.js';

const SKIN = '#F6D7B8';
const PENS = ['#2B2420', '#E2574C', '#F28C28', '#F5C451', '#81C784', '#4D8FD1', '#B39DDB', '#FFFFFF', SKIN];
const WIDTHS = [3, 7, 14];
const LS_FACE = 'aistudyroom.face';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** 이 기기에 저장한 내 얼굴 { v: 2, img, hr, st, day } (예전: { img, hair, day }) */
export function myFace() { try { return JSON.parse(localStorage.getItem(LS_FACE)) || null; } catch (e) { return null; } }
function saveFace(f) { try { localStorage.setItem(LS_FACE, JSON.stringify(f)); } catch (e) {} }
const today = () => { const d = new Date(Date.now() - 6 * 3600000); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
export const canDrawToday = () => { const f = myFace(); return !f || f.day !== today(); };
/** 친구에게 알리는 그림 버전 (바뀌면 친구 화면이 다시 받아요) */
export const faceVersion = (f) => (f ? f.day + ':' + (f.img || '').length + ':' + (f.hr || '').length + ':' + (f.st || f.hair || '') : '');

// 얼굴 스티커: 256×256 앞모습 판에 그린 뒤 머리 그림의 얼굴 자리에 얹어요
const STAMPS = {
  eyes1: { name: '동그란 눈', draw: (g) => { for (const x of [92, 164]) { g.beginPath(); g.arc(x, 112, 13, 0, Math.PI * 2); g.fill(); } } },
  eyes2: { name: '웃는 눈', draw: (g) => { g.lineWidth = 7; for (const x of [92, 164]) { g.beginPath(); g.arc(x, 118, 15, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } } },
  eyes3: { name: '반짝 눈', draw: (g) => { for (const x of [92, 164]) { g.beginPath(); g.ellipse(x, 112, 13, 17, 0, 0, Math.PI * 2); g.fill(); g.save(); g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(x + 4, 106, 5, 0, Math.PI * 2); g.fill(); g.restore(); } } },
  mouth1: { name: '웃는 입', draw: (g) => { g.lineWidth = 6; g.beginPath(); g.arc(128, 150, 26, Math.PI * 0.15, Math.PI * 0.85); g.stroke(); } },
  mouth2: { name: '동그란 입', draw: (g) => { g.lineWidth = 5; g.beginPath(); g.ellipse(128, 172, 12, 15, 0, 0, Math.PI * 2); g.stroke(); } },
  mouth3: { name: '헤 입', draw: (g) => { g.beginPath(); g.arc(128, 160, 22, 0, Math.PI); g.closePath(); g.fill(); } },
  brows: { name: '눈썹', draw: (g) => { g.lineWidth = 6; for (const [x, d] of [[92, -1], [164, 1]]) { g.beginPath(); g.moveTo(x - 16, 84 + d * 3); g.lineTo(x + 16, 84 - d * 3); g.stroke(); } } },
  blush: { name: '볼터치', draw: (g) => { g.save(); g.globalAlpha = 0.6; for (const x of [70, 186]) { g.beginPath(); g.ellipse(x, 150, 18, 10, 0, 0, Math.PI * 2); g.fill(); } g.restore(); } },
};

/** 그리기 화면 열기 · onSave(face) */
export function openDrawer({ openModal, closeModal, toast, onSave, onCancel, outfit }) {
  if (!canDrawToday()) { toast('오늘은 이미 그렸어요. 내일 다시 그릴 수 있어요 ✏️'); return; }
  const prev = myFace();
  let pen = 0, width = 1, erase = false;
  const style = 'free';   // 머리 모양 틀 없이 직접 칠한 그대로
  const m = openModal(`
    <h2>✏️ 내 얼굴 그리기</h2>
    <p class="desc"><b>한 손가락</b>으로 칠하고, <b>두 손가락</b>으로 돌려 보세요 (PC는 오른쪽 버튼 끌기). 머리카락은 뒤통수까지, 긴 머리는 머리 둘레의 <b>연한 칸</b>에 어깨 아래까지 칠해요. <b>하루에 한 번</b> 저장할 수 있어요.</p>
    <div class="dw3-stage" id="dw3Stage">
      <div class="dw3-turn"><button type="button" data-turn="-1">⟲</button><button type="button" data-view="front">앞</button><button type="button" data-view="side">옆</button><button type="button" data-view="back">뒤</button><button type="button" data-turn="1">⟳</button></div>
    </div>
    <div class="dw-label">펜</div>
    <div class="dw-row dw-pens">${PENS.map((c, i) => `<button type="button" data-p="${i}" class="${i === pen ? 'on' : ''}" style="background:${c}" aria-label="${i === PENS.length - 1 ? '살색' : '색'}"></button>`).join('')}</div>
    <div class="dw-row dw-tools">
      ${WIDTHS.map((w, i) => `<button type="button" data-w="${i}" class="${i === width ? 'on' : ''}"><i style="width:${5 + w}px;height:${5 + w}px"></i></button>`).join('')}
      <button type="button" id="dwErase">🧽 지우개</button><button type="button" id="dwUndo">↩ 되돌리기</button><button type="button" id="dwClear">🗑️</button>
    </div>
    <div class="dw-label">얼굴 스티커 (얼굴 앞에 찍혀요)</div>
    <div class="dw-row dw-stamps">${Object.entries(STAMPS).map(([k, s]) => `<button type="button" data-s="${k}">${esc(s.name)}</button>`).join('')}</div>
    <p class="hint">⚠️ 친구 얼굴 · 실명 · 나쁜 그림은 그리지 마세요. 친구들이 신고하면 그림이 숨겨져요.</p>
    <div class="foot"><button class="btn ghost" id="dwCancel" type="button">취소</button><button class="btn primary" id="dwSave" type="button">💾 저장</button></div>`, { dismiss: false });

  // 그림판 두 장 (칠하는 대로 3D에 바로 보임)
  const [W, H] = HEAD_TEX, [HW, HH] = HAIR_TEX;
  const headCv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const hairCv = Object.assign(document.createElement('canvas'), { width: HW, height: HH });
  const hg = headCv.getContext('2d'), rg = hairCv.getContext('2d');
  hg.fillStyle = SKIN; hg.fillRect(0, 0, W, H);
  let refs = null;
  const touchTex = () => { if (refs) { refs.headTex.needsUpdate = true; refs.hairTex.needsUpdate = true; } };
  // 예전 그림 불러오기 (예전 방식 얼굴은 얼굴 앞자리에 얹음)
  if (prev && prev.img) {
    const im = new Image();
    im.onload = () => {
      if (prev.v === 2) hg.drawImage(im, 0, 0, W, H);
      else { const R = FRONT_RECT; hg.drawImage(im, R.u0 * W, R.v0 * H, (R.u1 - R.u0) * W, (R.v1 - R.v0) * H); }
      touchTex();
    };
    im.src = prev.img;
  }
  if (prev && prev.v === 2 && prev.hr && prev.st === 'free') { const im = new Image(); im.onload = () => { rg.drawImage(im, 0, 0, HW, HH); touchTex(); }; im.src = prev.hr; }

  // 3D 장면 (그리기 화면 전용 그림판, 닫으면 정리)
  const stage = m.querySelector('#dw3Stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'dw3-canvas';
  stage.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#E8D9C0', 1.7));
  const dl = new THREE.DirectionalLight('#FFFFFF', 1.1); dl.position.set(1, 2, 3); scene.add(dl);
  const cam = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
  let obj = null, yaw = 0, pitch = 0.08, dist = 2.05;
  const build = () => {
    if (obj) scene.remove(obj);
    obj = makeAnimal('drawn', '#7FB3E8', { outfit: outfit || '', face: { v: 2, img: headCv, hr: hairCv, st: style } });
    refs = obj.userData.drawn;
    if (refs.hair) {   // 그리기 화면에서만: 칠할 수 있는 머리카락 공간을 연하게
      const guide = new THREE.Mesh(refs.hair.geometry, new THREE.MeshBasicMaterial({ color: '#C9B48F', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide }));
      guide.renderOrder = -1; refs.hair.parent.add(guide);
    }
    scene.add(obj);
  };
  build();
  const size = () => { const w = stage.clientWidth || 300, h = stage.clientHeight || 300; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  size();
  const clock = new THREE.Clock();
  const loop = () => {
    if (!stage.isConnected) { renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    obj.rotation.y += (yaw - obj.rotation.y) * Math.min(1, dt * 10);
    const hy = 0.95 * (obj.userData.scale || 1);
    cam.position.set(0, hy - 0.15 + Math.sin(pitch) * dist, Math.cos(pitch) * dist); cam.lookAt(0, hy - 0.2, 0);
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // 칠하기: 머리 공 · 머리카락 조각에 닿은 곳의 그림 좌표에 동그라미
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hitAt = (x, y) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    obj.updateMatrixWorld(true);
    // 몸 · 귀가 앞에 있으면 그 뒤는 안 칠해요
    const h = ray.intersectObject(obj, true).find((x) => x.object.visible && x.object.material && !(x.object.material.opacity < 0.5));
    if (!h || !h.uv || (h.object !== refs.skull && h.object !== refs.hair)) return null;
    return { onHair: h.object === refs.hair, u: h.uv.x, v: h.uv.y };
  };
  const dab = (pt, prevPt) => {
    const cw = pt.onHair ? HW : W, ch = pt.onHair ? HH : H, g = pt.onHair ? rg : hg;
    const rad = WIDTHS[width] * (erase ? 1.6 : 1);
    g.fillStyle = erase && !pt.onHair ? SKIN : PENS[pen];
    g.globalCompositeOperation = erase && pt.onHair ? 'destination-out' : 'source-over';   // 머리카락 공간은 지우면 다시 투명
    const near = prevPt && prevPt.onHair === pt.onHair && Math.abs(prevPt.u - pt.u) < 0.25 && Math.abs(prevPt.v - pt.v) < 0.25;
    const steps = near ? Math.max(1, Math.ceil(Math.hypot((pt.u - prevPt.u) * cw, (pt.v - prevPt.v) * ch) / Math.max(1, rad * 0.5))) : 1;
    for (let k = 1; k <= steps; k++) {
      const t = near ? k / steps : 1;
      const u = near ? prevPt.u + (pt.u - prevPt.u) * t : pt.u, v = near ? prevPt.v + (pt.v - prevPt.v) * t : pt.v;
      const px = u * cw, py = (1 - v) * ch;
      // 머리 공은 구를 펼친 그림이라 위 · 아래로 갈수록 가로로 넓게 칠해야 동그랗게 보여요
      const stretch = pt.onHair ? HAIR_FREE_SCALE.x : 1 / Math.max(0.25, Math.sin((1 - v) * Math.PI));
      const rx = rad * stretch, ry = rad * (pt.onHair ? HAIR_FREE_SCALE.y : 1);
      g.beginPath(); g.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2); g.fill();
      if (!pt.onHair && px - rx < 0) { g.beginPath(); g.ellipse(px + cw, py, rx, rad, 0, 0, Math.PI * 2); g.fill(); }   // 이음매 너머도
      if (!pt.onHair && px + rx > cw) { g.beginPath(); g.ellipse(px - cw, py, rx, rad, 0, 0, Math.PI * 2); g.fill(); }
    }
    g.globalCompositeOperation = 'source-over';
    touchTex();
  };
  const undo = [];
  const snap = () => { undo.push([hg.getImageData(0, 0, W, H), rg.getImageData(0, 0, HW, HH)]); if (undo.length > 15) undo.shift(); };
  const cv = renderer.domElement;
  const ptrs = new Map();
  let painting = null, turn = null;
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 2 || e.button === 2) {   // 두 손가락(또는 오른쪽 버튼): 돌리기 · 크게/작게
      if (painting && painting.dabbed) undo.length && (() => { const d = undo.pop(); hg.putImageData(d[0], 0, 0); rg.putImageData(d[1], 0, 0); touchTex(); })();   // 첫 손가락에 묻은 점은 지움
      painting = null;
      const ps = [...ptrs.values()];
      const mid = ps.length === 2 ? { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } : { x: e.clientX, y: e.clientY };
      turn = { mid, yaw, pitch, dist, d: ps.length === 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0 };
      return;
    }
    if (ptrs.size === 1) { snap(); const h = hitAt(e.clientX, e.clientY); painting = { last: h, dabbed: !!h }; if (h) dab(h, null); }
  });
  cv.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (turn) {
      const ps = [...ptrs.values()];
      const mid = ps.length === 2 ? { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } : ps[0];
      yaw = turn.yaw + (mid.x - turn.mid.x) * 0.012;
      pitch = Math.max(-0.6, Math.min(1.1, turn.pitch + (mid.y - turn.mid.y) * 0.008));
      if (ps.length === 2 && turn.d) dist = Math.max(1.0, Math.min(2.6, turn.dist * turn.d / Math.max(20, Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y))));
      return;
    }
    if (painting) { const h = hitAt(e.clientX, e.clientY); if (h) { dab(h, painting.last); painting.dabbed = true; } painting.last = h; }
  });
  const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size === 0) { turn = null; painting = null; } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); dist = Math.max(1.0, Math.min(2.6, dist * (1 + Math.sign(e.deltaY) * 0.1))); }, { passive: false });
  m.querySelectorAll('[data-turn]').forEach((b) => (b.onclick = () => { yaw += Number(b.dataset.turn) * Math.PI / 4; }));
  const face = (v) => { const base = Math.round(yaw / (Math.PI * 2)) * Math.PI * 2; yaw = base + (v === 'side' ? -Math.PI / 2 : v === 'back' ? Math.PI : 0); pitch = 0.08; };
  m.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => face(b.dataset.view)));

  const pick = (sel, attr, fn) => m.querySelectorAll(sel).forEach((b) => (b.onclick = () => { m.querySelectorAll(sel).forEach((x) => x.classList.toggle('on', x === b)); fn(b.dataset[attr]); }));
  pick('.dw-pens button', 'p', (i) => { pen = Number(i); erase = false; m.querySelector('#dwErase').classList.remove('on'); });
  pick('.dw-tools button[data-w]', 'w', (i) => { width = Number(i); });
  m.querySelector('#dwErase').onclick = (e) => { erase = !erase; e.currentTarget.classList.toggle('on', erase); };
  m.querySelector('#dwUndo').onclick = () => {
    const d = undo.pop(); if (!d) return;
    hg.putImageData(d[0], 0, 0); rg.putImageData(d[1], 0, 0);
    touchTex();
  };
  m.querySelector('#dwClear').onclick = () => { snap(); hg.fillStyle = SKIN; hg.fillRect(0, 0, W, H); rg.clearRect(0, 0, HW, HH); touchTex(); };
  m.querySelectorAll('.dw-stamps button').forEach((b) => (b.onclick = () => {
    snap();
    const sc = Object.assign(document.createElement('canvas'), { width: 256, height: 256 }), sg = sc.getContext('2d');
    sg.strokeStyle = sg.fillStyle = PENS[pen === PENS.length - 1 ? 0 : pen]; sg.lineCap = sg.lineJoin = 'round';
    STAMPS[b.dataset.s].draw(sg);
    const R = FRONT_RECT; hg.drawImage(sc, R.u0 * W, R.v0 * H, (R.u1 - R.u0) * W, (R.v1 - R.v0) * H);
    touchTex();
    face('front');   // 얼굴이 보이게 앞으로
  }));
  m.querySelector('#dwCancel').onclick = () => { closeModal(); onCancel && onCancel(); };
  m.querySelector('#dwSave').onclick = () => {
    const img = packPng(headCv, 95000, false), hr = isBlank(hairCv) ? '' : packPng(hairCv, 60000, true);
    if (!img || hr === null) { toast('그림을 저장하지 못했어요. 다시 해 주세요'); return; }
    const f = { v: 2, img, hr, st: style, day: today() };
    saveFace(f);
    closeModal();
    onSave && onSave(f);
  };
}

/** 칠한 게 하나도 없는지 (머리카락 공간) */
function isBlank(cv) {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  for (let i = 3; i < d.length; i += 4) if (d[i] > 127) return false;
  return true;
}
/** 저장용 PNG: 붓 가장자리의 흐릿한 색을 많이 쓴 색으로 맞춰 작게 → 그래도 크면 크기를 줄여서 */
function packPng(src, limit, alpha) {
  for (const k of [1, 0.75, 0.5, 0.35]) {
    const w = Math.round(src.width * k), h = Math.round(src.height * k);
    const c = Object.assign(document.createElement('canvas'), { width: w, height: h }), g = c.getContext('2d');
    g.drawImage(src, 0, 0, w, h);
    const id = g.getImageData(0, 0, w, h), d = id.data;
    const count = new Map();   // 많이 쓴 색 (4단계로 묶어서 셈)
    for (let i = 0; i < d.length; i += 4) { if (alpha && d[i + 3] < 128) continue; const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3); count.set(key, (count.get(key) || 0) + 1); }
    const pal = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 24).map(([key]) => [((key >> 10) & 31) * 8 + 4, ((key >> 5) & 31) * 8 + 4, (key & 31) * 8 + 4]);
    const memo = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (alpha && d[i + 3] < 128) { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; continue; }
      const key = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      let best = memo.get(key);
      if (!best) { let bd = 1e9; for (const p of pal) { const e = (p[0] - d[i]) ** 2 + (p[1] - d[i + 1]) ** 2 + (p[2] - d[i + 2]) ** 2; if (e < bd) { bd = e; best = p; } } memo.set(key, best); }
      d[i] = best[0]; d[i + 1] = best[1]; d[i + 2] = best[2]; d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0);
    const url = c.toDataURL('image/png');
    if (url.length <= limit) return url;
  }
  return null;
}
