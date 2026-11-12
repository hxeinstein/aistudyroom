// 🐾 캐릭터 고르기 화면: 위에는 빙글빙글 도는 큰 미리보기, 가운데 분류 탭, 아래 실제 얼굴 그림 목록
// (학생 설정 · 선생님 캐릭터 고르기에서 같이 씀)
import * as THREE from '../vendor/three.module.min.js';
import { makeAnimal, animateAnimal } from './animals.js';
import { ANIMALS, ANIMAL_GROUPS, animalById } from './store.js';

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

export function pickerHTML(cur) {
  const a = animalById(cur);
  return `
    <div class="pk">
      <div class="pk-stage" id="pkStage"><div class="pk-name" id="pkName"><b>${esc(a.name)}</b><small>${esc(a.trait)}</small></div></div>
      <div class="pk-tabs" id="pkTabs">${ANIMAL_GROUPS.map((g) => `<button type="button" class="pk-tab ${g.id === a.group ? 'on' : ''}" data-g="${g.id}">${g.emoji} ${esc(g.name)}</button>`).join('')}</div>
      <div class="pk-grid" id="pkGrid"></div>
    </div>`;
}

/**
 * root: 화면 · cur: 지금 캐릭터 · onPick(id) · look(): { clothes, glasses, teacher } (선생님 옷 색 · 안경)
 * 돌려주는 것: { refresh() } — 옷 색·안경이 바뀌면 미리보기를 다시 그림
 */
export function bindPicker(root, { cur, onPick, look } = {}) {
  let id = cur, group = animalById(cur).group;
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
    obj = makeAnimal(id, lk.clothes || '#7FB3E8', { glasses: !!lk.glasses, teacher: !!lk.teacher });
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
  return { refresh: build };
}
