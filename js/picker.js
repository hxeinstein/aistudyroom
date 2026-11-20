// 🐾 캐릭터 고르기 화면: 위에는 빙글빙글 도는 큰 미리보기, 가운데 분류 탭, 아래 실제 얼굴 그림 목록
// (학생 설정 · 선생님 캐릭터 고르기에서 같이 씀)
import * as THREE from '../vendor/three.module.min.js';
import { makeAnimal, animateAnimal } from './animals.js';
import { ANIMALS, ANIMAL_GROUPS, animalById } from './store.js';
import { COLORS, SLOTS, ITEMS, parseOutfit, stringifyOutfit } from './outfit.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
let renderer = null;            // 미리보기 · 얼굴 그림에 같이 쓰는 그림판 하나 (화면마다 새로 만들지 않음)
const faces = {};               // 얼굴 그림 (동물 id → 그림 주소)

function getRenderer() {
  if (renderer) return renderer;
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  return renderer;
}
function lightScene() {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#FFFFFF', '#E8D9C0', 1.6));
  const d = new THREE.DirectionalLight('#FFFFFF', 1.4); d.position.set(1.5, 3, 4); scene.add(d);
  return scene;
}
/** 얼굴 그림 만들기 (처음 한 번만, 그 뒤엔 저장해 둔 그림 사용) */
function faceOf(id) {
  if (faces[id]) return faces[id];
  try {
    const r = getRenderer();
    r.setPixelRatio(1); r.setSize(96, 96, false);
    const scene = lightScene(), obj = makeAnimal(id, '#7FB3E8');
    scene.add(obj);
    const u = obj.userData, s = u.scale || 1, hy = (u.headY + 0.02) * s;
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0.35 * s, hy + 0.12 * s, 2.0 * s); cam.lookAt(0, hy, 0);
    r.render(scene, cam);
    faces[id] = r.domElement.toDataURL('image/png');
  } catch (e) { faces[id] = ''; }
  return faces[id];
}

export function pickerHTML(cur, { outfit = false } = {}) {
  const a = animalById(cur);
  return `
    <div class="pk">
      <div class="pk-stage" id="pkStage"><div class="pk-name" id="pkName"><b>${esc(a.name)}</b><small>${esc(a.trait)}</small></div></div>
      ${outfit ? `<div class="pk-mode"><button type="button" class="on" data-m="ani">🐾 캐릭터</button><button type="button" data-m="fit">👕 옷 입기</button></div>
      <div class="pk-fit hidden" id="pkFit"><div class="pk-slots" id="pkSlots"></div><div class="pk-items" id="pkItems"></div><div class="pk-colors" id="pkColors"></div></div>` : ''}
      <div class="pk-ani" id="pkAni"><div class="pk-tabs" id="pkTabs">${ANIMAL_GROUPS.map((g) => `<button type="button" class="pk-tab ${g.id === a.group ? 'on' : ''}" data-g="${g.id}"><span>${g.emoji}</span>${esc(g.name)}</button>`).join('')}</div>
      <div class="pk-grid" id="pkGrid"></div></div>
    </div>`;
}

/**
 * root: 화면 · cur: 지금 캐릭터 · onPick(id) · look(): { clothes, glasses, teacher } (선생님 옷 색 · 안경)
 * 돌려주는 것: { refresh() } — 옷 색·안경이 바뀌면 미리보기를 다시 그림
 */
export function bindPicker(root, { cur, onPick, look, outfit, onOutfit } = {}) {
  let id = cur, group = animalById(cur).group;
  let fit = parseOutfit(outfit || '');
  const stage = root.querySelector('#pkStage'), grid = root.querySelector('#pkGrid');
  const drawGrid = () => {
    grid.innerHTML = ANIMALS.filter((x) => x.group === group).map((x) => {
      const src = faceOf(x.id);
      return `<button type="button" class="pk-item ${x.id === id ? 'on' : ''}" data-a="${x.id}">${src ? `<img src="${src}" alt="">` : `<span>${x.emoji}</span>`}<small>${esc(x.name)}</small></button>`;
    }).join('');
    grid.querySelectorAll('.pk-item').forEach((b) => (b.onclick = () => select(b.dataset.a)));
  };
  root.querySelectorAll('.pk-tab').forEach((b) => (b.onclick = () => {
    group = b.dataset.g;
    root.querySelectorAll('.pk-tab').forEach((x) => x.classList.toggle('on', x === b));
    drawGrid();
  }));
  ANIMALS.forEach((x) => faceOf(x.id));   // 얼굴 그림은 처음 한 번에 모두 (그 뒤엔 저장해 둔 것)
  drawGrid();

  // 큰 미리보기 (빙글빙글)
  const r = getRenderer();
  const scene = lightScene();
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.04, 40), new THREE.MeshLambertMaterial({ color: '#E8F3DC' })));
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  let obj = null;
  const build = () => {
    if (obj) scene.remove(obj);
    const lk = look ? look() : {};
    obj = makeAnimal(id, lk.clothes || '#7FB3E8', { glasses: !!lk.glasses, teacher: !!lk.teacher, outfit: onOutfit ? stringifyOutfit(fit) : '' });
    obj.position.y = 0.02;
    scene.add(obj);
    const h = (obj.userData.height || 1.4) * (obj.userData.scale || 1);
    cam.position.set(0, h * 0.62 + 0.15, h * 2.3 + 1.0); cam.lookAt(0, h * 0.48, 0);
  };
  const select = (nid) => {
    id = nid;
    grid.querySelectorAll('.pk-item').forEach((x) => x.classList.toggle('on', x.dataset.a === id));
    const a = animalById(id);
    root.querySelector('#pkName').innerHTML = `<b>${esc(a.name)}</b><small>${esc(a.trait)}</small>`;
    build();
    onPick && onPick(id);
  };
  build();
  const sizeIt = () => { const w = stage.clientWidth || 280, h = stage.clientHeight || 190; r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  r.domElement.className = 'pk-canvas';
  stage.prepend(r.domElement);
  sizeIt();
  const clock = new THREE.Clock();
  const loop = () => {
    if (!stage.isConnected || r.domElement.parentNode !== stage) return;   // 화면이 닫히면 멈춤
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    obj.rotation.y = t * 0.8;
    animateAnimal(obj, 'idle', t, dt);
    r.render(scene, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  // 👕 옷 입기 탭
  if (onOutfit) {
    let slot = 't';
    const mode = (m) => { root.querySelectorAll('.pk-mode button').forEach((b) => b.classList.toggle('on', b.dataset.m === m)); root.querySelector('#pkAni').classList.toggle('hidden', m !== 'ani'); root.querySelector('#pkFit').classList.toggle('hidden', m !== 'fit'); };
    root.querySelectorAll('.pk-mode button').forEach((b) => (b.onclick = () => mode(b.dataset.m)));
    const chosen = (sl) => (sl === 'a' ? fit.a || [] : fit[sl] ? [fit[sl]] : []);
    const changed = () => { build(); onOutfit(stringifyOutfit(fit)); drawFit(); };
    const drawFit = () => {
      root.querySelector('#pkSlots').innerHTML = SLOTS.map((x) => `<button type="button" data-s="${x.id}" class="${x.id === slot ? 'on' : ''}"><span>${x.emoji}</span>${x.name}${chosen(x.id).length ? '<i></i>' : ''}</button>`).join('');
      root.querySelectorAll('#pkSlots button').forEach((b) => (b.onclick = () => { slot = b.dataset.s; drawFit(); }));
      const sel = chosen(slot);
      root.querySelector('#pkItems').innerHTML = `<button type="button" data-i="" class="${sel.length ? '' : 'on'}">없음</button>` + ITEMS[slot].map((it) => `<button type="button" data-i="${it.id}" class="${sel.some((x) => x.id === it.id) ? 'on' : ''}">${it.name}</button>`).join('')
        + (slot === 'a' ? '<small class="pk-hint">두 개까지 (모자끼리 · 안경끼리는 하나만)</small>' : slot === 'd' ? '<small class="pk-hint">한 벌을 입으면 상의 · 하의는 벗어요</small>' : '');
      root.querySelectorAll('#pkItems button').forEach((b) => (b.onclick = () => {
        const iid = b.dataset.i;
        if (!iid) { if (slot === 'a') fit.a = []; else delete fit[slot]; return changed(); }
        const it = ITEMS[slot].find((x) => x.id === iid);
        if (slot === 'a') {
          const has = fit.a.findIndex((x) => x.id === iid);
          if (has >= 0) fit.a.splice(has, 1);
          else { fit.a = fit.a.filter((x) => (ITEMS.a.find((y) => y.id === x.id) || {}).spot !== it.spot); fit.a.push({ id: iid, c: it.c }); if (fit.a.length > 2) fit.a.shift(); }
        } else {
          fit[slot] = { id: iid, c: fit[slot] && fit[slot].id === iid ? fit[slot].c : it.c };
          if (slot === 'd') { delete fit.t; delete fit.b; }
          if (slot === 't' || slot === 'b') delete fit.d;
        }
        changed();
      }));
      const target = slot === 'a' ? fit.a[fit.a.length - 1] : fit[slot];
      root.querySelector('#pkColors').innerHTML = target ? COLORS.map((c, i) => `<button type="button" data-c="${i}" class="${target.c === i ? 'on' : ''}" style="background:${c}" aria-label="색"></button>`).join('') : '';
      root.querySelectorAll('#pkColors button').forEach((b) => (b.onclick = () => { target.c = Number(b.dataset.c); changed(); }));
    };
    drawFit();
  }
  return { refresh: build };
}
