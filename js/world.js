// 3D 숲속 독서실 — 둥글고 아기자기한 로우폴리 스타일 (외부 그림 파일 없이 코드로 생성)
import { badWord } from './words.js';
import { wrapLines } from './wrap.js';
import * as THREE from '../vendor/three.module.min.js';
import { makeAnimal, animateAnimal, animalSpeed } from './animals.js';
export { makeAnimal };

const FONT = '"Gowun Dodum", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "WenQuanYi Zen Hei", sans-serif';
const BANNER_FONT = '"Do Hyeon", "Sunflower", "Noto Sans KR", sans-serif';   // 학교 이름 가랜드
const DECK_Y = 0.3;
const BOUNDS = { x0: -9.2, x1: 9.2, z0: -6.4, z1: 7.4 };
// 교무실 실내는 같은 장면의 먼 곳(x=60)에 만들고, 들어가면 그곳으로 이동
const OX = 60;
const OFFICE_BOUNDS = { x0: OX - 5.7, x1: OX + 5.7, z0: -3.3, z1: 4.0 };
const OFFICE_DESKS = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) OFFICE_DESKS.push({ x: OX - 5 + c * 2.5, z: r === 0 ? -2.0 : 1.0 });
const OFFICE_ENTRY = { x: OX, z: 3.5 };
const OFFICE_PORTAL = { x: 9.0, z: -0.2 }; // 공부방 쪽 교무실 문 앞
// 공부방 자리 20개: 5칸 × 4줄 (한 줄 사이 통로, 오른쪽 끝은 교무실 가는 길)
// 독서실 책상: 한 줄에 5자리씩 길게 이어진 4줄. 두 줄씩 칸막이를 사이에 두고 마주봄
// f: 앉은 사람이 보는 방향 (-1 = 책장 쪽(-z)을 봄, +1 = 입구 쪽(+z)을 봄)
const COLS = [-4, -2, 0, 2, 4];
const PAIR_Z = [-2.3, 2.8];
const ROWS = [
  { z: PAIR_Z[0] - 0.48, f: 1 }, { z: PAIR_Z[0] + 0.48, f: -1 },
  { z: PAIR_Z[1] - 0.48, f: 1 }, { z: PAIR_Z[1] + 0.48, f: -1 },
];

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, ...extra });
const M = {}; // 공용 재질 캐시
const m = (c) => (M[c] ||= mat(c));

function mesh(geo, material, { x = 0, y = 0, z = 0, cast = true, receive = false } = {}) {
  const o = new THREE.Mesh(geo, typeof material === 'string' ? m(material) : material);
  o.position.set(x, y, z);
  o.castShadow = cast;
  o.receiveShadow = receive;
  return o;
}

// ---------------- 동물 캐릭터 (js/animals.js) ----------------
const CLOTHES = ['#7FB3E8', '#F59FB4', '#9ED28C', '#F7C96B', '#B79CE8', '#7FD0C7'];

// 과학 질문 도우미 마스코트: 하얀 복슬 강아지 + 동그란 안경 + 주황 반다나 + 태블릿
export function makeMascot() {
  const g = new THREE.Group();
  const fur = mat('#FBFBF8');
  const furShade = mat('#E9EEF3');
  const line = mat('#2B2B2B');
  const legGeo = new THREE.CapsuleGeometry(0.085, 0.14, 4, 8);
  const legL = mesh(legGeo, fur, { x: -0.11, y: 0.14 });
  const legR = mesh(legGeo, fur, { x: 0.11, y: 0.14 });
  const body = mesh(new THREE.CapsuleGeometry(0.22, 0.2, 6, 14), fur, { y: 0.46 });
  const belly = mesh(new THREE.SphereGeometry(0.17, 12, 10), furShade, { y: 0.44, z: 0.1 });
  belly.scale.z = 0.6;
  // 반다나
  const scarf = mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 20), '#F08A3C', { y: 0.67 });
  scarf.rotation.x = Math.PI / 2;
  const knot = mesh(new THREE.ConeGeometry(0.08, 0.16, 4), '#F08A3C', { x: 0.14, y: 0.62, z: -0.1 });
  knot.rotation.z = -1.1;
  // 팔 + 태블릿
  const armGeo = new THREE.CapsuleGeometry(0.065, 0.14, 4, 8);
  const armL = new THREE.Group();
  armL.position.set(-0.22, 0.58, 0.04);
  armL.add(mesh(armGeo, fur, { y: -0.09 }));
  const armR = armL.clone();
  armR.position.x = 0.22;
  armL.rotation.x = armR.rotation.x = -0.9;
  armL.rotation.z = 0.35;
  armR.rotation.z = -0.35;
  const tablet = new THREE.Group();
  tablet.position.set(0, 0.5, 0.26);
  tablet.rotation.x = -0.35;
  tablet.add(mesh(new THREE.BoxGeometry(0.3, 0.38, 0.03), '#8E99A6'));
  const screen = mesh(new THREE.BoxGeometry(0.25, 0.32, 0.01), new THREE.MeshStandardMaterial({ color: '#BFE3FF', emissive: '#6FB6F0', emissiveIntensity: 0.6 }), { z: 0.017, cast: false });
  tablet.add(screen);
  // 머리
  const head = new THREE.Group();
  head.position.y = 0.98;
  const skull = mesh(new THREE.SphereGeometry(0.34, 20, 16), fur);
  skull.scale.set(1.08, 0.95, 1);
  head.add(skull);
  for (const sx of [-1, 1]) {
    const tuft = mesh(new THREE.SphereGeometry(0.12, 10, 8), fur, { x: sx * 0.3, y: -0.12, z: 0.05 }); // 볼 털
    head.add(tuft);
    const ear = new THREE.Group();
    ear.position.set(sx * 0.2, 0.3, 0);
    ear.rotation.z = -sx * 0.18;
    ear.add(mesh(new THREE.ConeGeometry(0.12, 0.26, 12), fur));
    ear.add(mesh(new THREE.ConeGeometry(0.065, 0.16, 10), '#F5A9B0', { z: 0.05, y: -0.02 }));
    head.add(ear);
    head.add(mesh(new THREE.SphereGeometry(0.045, 10, 10), '#3A2A22', { x: sx * 0.12, y: 0.03, z: 0.31 })); // 눈
    const rim = mesh(new THREE.TorusGeometry(0.085, 0.012, 6, 20), line, { x: sx * 0.12, y: 0.03, z: 0.33, cast: false }); // 안경
    head.add(rim);
  }
  head.add(mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), line, { y: 0.04, z: 0.34, cast: false })); // 안경 다리
  const muzzle = mesh(new THREE.SphereGeometry(0.12, 12, 10), fur, { y: -0.1, z: 0.27 });
  muzzle.scale.set(1.2, 0.8, 0.8);
  head.add(muzzle);
  head.add(mesh(new THREE.SphereGeometry(0.04, 8, 8), '#1E1E1E', { y: -0.06, z: 0.37 })); // 코
  // 꼬리
  const tail = mesh(new THREE.SphereGeometry(0.15, 12, 10), fur, { x: 0.18, y: 0.4, z: -0.24 });
  tail.scale.set(0.8, 1.2, 0.8);
  g.add(legL, legR, body, belly, scarf, knot, armL, armR, tablet, head, tail);
  g.userData = { legL, legR, armL, armR, head, body, tail, tablet, phase: 0, mascot: true };
  return g;
}

// 도덕 챗봇 '도덕후': 크림색 사자 + 길게 물결치는 주황 갈기 + 유니콘 뿔 + 동그란 귀 + 갈기 꼬리
export function makeDodeokhu() {
  const g = new THREE.Group();
  const fur = mat('#F8E7B4');
  const mane = mat('#F1A35C');
  const maneD = mat('#E58A45');
  const legGeo = new THREE.CapsuleGeometry(0.09, 0.14, 4, 8);
  const legL = mesh(legGeo, fur, { x: -0.11, y: 0.14 });
  const legR = mesh(legGeo, fur, { x: 0.11, y: 0.14 });
  const body = mesh(new THREE.CapsuleGeometry(0.23, 0.2, 6, 14), fur, { y: 0.47 });
  // 가슴 털
  for (const [x, y] of [[-0.07, 0.6], [0, 0.57], [0.07, 0.6]]) {
    const f = mesh(new THREE.ConeGeometry(0.05, 0.1, 6), '#FFF6DA', { x, y, z: 0.2 });
    f.rotation.x = Math.PI;
    g.add(f);
  }
  const armGeo = new THREE.CapsuleGeometry(0.07, 0.15, 4, 8);
  const armL = new THREE.Group();
  armL.position.set(-0.25, 0.58, 0);
  armL.add(mesh(armGeo, fur, { y: -0.1 }));
  const armR = armL.clone();
  armR.position.x = 0.25;
  // 머리
  const head = new THREE.Group();
  head.position.y = 0.99;
  const skull = mesh(new THREE.SphereGeometry(0.34, 20, 16), fur);
  skull.scale.set(1.05, 0.96, 1);
  head.add(skull);
  // 물결치는 긴 갈기: 머리 위·옆 + 어깨 아래까지 흘러내림
  for (let i = 0; i < 11; i++) {
    const a = -Math.PI * 0.95 + (i / 10) * Math.PI * 0.9 - Math.PI * 0.03;
    head.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), i % 2 ? mane : maneD, { x: Math.cos(a) * 0.33, y: Math.sin(-a) * 0.27 + 0.02, z: -0.05 }));
  }
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const m = mesh(new THREE.SphereGeometry(0.13 - k * 0.012, 10, 8), k % 2 ? mane : maneD, { x: sx * (0.34 + Math.sin(k * 1.3) * 0.04), y: -0.12 - k * 0.17, z: -0.08 });
      m.scale.set(0.9, 1.15, 0.9);
      head.add(m);
    }
  }
  const back = mesh(new THREE.SphereGeometry(0.3, 12, 10), mane, { y: -0.18, z: -0.22 });
  back.scale.set(1.15, 1.35, 0.6);
  head.add(back);
  head.add(mesh(new THREE.SphereGeometry(0.12, 10, 8), maneD, { y: 0.3, z: 0.12 })); // 앞머리
  // 유니콘 뿔
  const horn = mesh(new THREE.ConeGeometry(0.075, 0.32, 12), '#F6E7A8', { y: 0.5, z: 0.12 });
  horn.rotation.x = 0.25;
  head.add(horn);
  for (let k = 0; k < 3; k++) head.add(mesh(new THREE.TorusGeometry(0.058 - k * 0.015, 0.008, 4, 12), '#D9C27A', { y: 0.41 + k * 0.065, z: 0.1 + k * 0.016, cast: false }).rotateX(Math.PI / 2 + 0.25));
  // 귀
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.1, 12, 10), fur, { x: sx * 0.25, y: 0.27, z: 0.02 });
    ear.scale.z = 0.6;
    head.add(ear);
    const inner = mesh(new THREE.SphereGeometry(0.06, 10, 8), '#F4A9B4', { x: sx * 0.25, y: 0.27, z: 0.07 });
    inner.scale.z = 0.4;
    head.add(inner);
    head.add(mesh(new THREE.SphereGeometry(0.045, 10, 10), '#3A2A22', { x: sx * 0.12, y: 0.04, z: 0.3 }));           // 눈
    head.add(mesh(new THREE.SphereGeometry(0.014, 6, 6), '#FFFFFF', { x: sx * 0.12 + 0.015, y: 0.06, z: 0.34, cast: false }));
    const dot = mesh(new THREE.SphereGeometry(0.04, 8, 8), '#F2A25E', { x: sx * 0.1, y: 0.16, z: 0.29, cast: false }); // 이마 점
    dot.scale.set(1.3, 0.6, 0.3);
    head.add(dot);
  }
  const muzzle = mesh(new THREE.SphereGeometry(0.13, 14, 10), '#FFF4D6', { y: -0.09, z: 0.26 });
  muzzle.scale.set(1.25, 0.8, 0.7);
  head.add(muzzle);
  head.add(mesh(new THREE.SphereGeometry(0.04, 8, 8), '#1E1E1E', { y: -0.05, z: 0.36 }));
  const smile = mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 12, Math.PI), '#3A2A22', { y: -0.11, z: 0.35, cast: false });
  smile.rotation.z = Math.PI;
  head.add(smile);
  // 꼬리 + 주황 술
  const tail = new THREE.Group();
  tail.position.set(0.15, 0.32, -0.22);
  tail.rotation.set(-1.0, 0, -0.6);
  tail.add(mesh(new THREE.CapsuleGeometry(0.03, 0.32, 4, 8), fur, { y: -0.2 }));
  tail.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), maneD, { y: -0.42 }));
  g.add(legL, legR, body, armL, armR, head, tail);
  g.userData = { legL, legR, armL, armR, head, body, tail, tablet: null, phase: 0, mascot: true };
  return g;
}

const BOT_MODELS = { mungchi: makeMascot, dodeokhu: makeDodeokhu };

// ---------------- 텍스처 ----------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function woodTexture() {
  const t = canvasTex(512, 512, (g, w, h) => {
    const cols = ['#D9A86C', '#D1A065', '#DDAF74', '#CF9C5F'];
    const n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = cols[i % cols.length];
      g.fillRect(0, (i * h) / n, w, h / n);
      g.fillStyle = 'rgba(120,70,30,0.35)';
      g.fillRect(0, (i * h) / n, w, 3);
      const off = (i * 137) % w;
      g.fillRect(off, (i * h) / n, 3, h / n);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 3);
  return t;
}
function signTexture(text) {
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#5B8C51';
    g.beginPath();
    g.roundRect(6, 6, w - 12, h - 12, 40);
    g.fill();
    g.strokeStyle = '#F4E7C5';
    g.lineWidth = 8;
    g.stroke();
    g.fillStyle = '#FFF8E3';
    g.font = `800 64px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}
function skyTexture(top, bottom) {
  return canvasTex(4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bottom);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

// ---------------- 시간대 ----------------
const MOODS = {
  day: { top: '#7EC8F2', bottom: '#DDF3FF', fog: '#CFEFFF', sun: '#FFF4DC', sunI: 2.2, hemi: 1.25, ground: '#8BC77A', bulbs: 0.6 },
  evening: { top: '#F59E7A', bottom: '#FFE1B8', fog: '#FBD9B8', sun: '#FFC58F', sunI: 1.6, hemi: 1.0, ground: '#C9A77A', bulbs: 1.4 },
  night: { top: '#1B2550', bottom: '#4A4E86', fog: '#343A6E', sun: '#AFC3FF', sunI: 0.55, hemi: 0.55, ground: '#3C4A5E', bulbs: 2.6 },
};
export function moodFor(hour) {
  if (hour >= 7 && hour < 16) return 'day';
  if ((hour >= 16 && hour < 19) || (hour >= 5 && hour < 7)) return 'evening';
  return 'night';
}

// ---------------- 세계 ----------------
export function createWorld(container, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

  const hemi = new THREE.HemisphereLight('#ffffff', '#8BC77A', 1.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF4DC', 2);
  sun.position.set(-10, 18, 12);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const deskLight = new THREE.PointLight('#FFD58A', 0, 3.2, 1.6);
  scene.add(deskLight);

  // 땅 & 데크
  const grass = mesh(new THREE.CircleGeometry(45, 48), mat('#9BD67A'), { cast: false, receive: true });
  grass.rotation.x = -Math.PI / 2;
  scene.add(grass);
  const deck = mesh(new THREE.BoxGeometry(19.6, DECK_Y, 15), new THREE.MeshLambertMaterial({ map: woodTexture() }), { y: DECK_Y / 2, z: 0.5, receive: true });
  scene.add(deck);
  const deckEdge = mesh(new THREE.BoxGeometry(20, 0.12, 15.4), '#A9733F', { y: 0.06, z: 0.5, cast: false, receive: true });
  scene.add(deckEdge);
  // 계단
  scene.add(mesh(new THREE.BoxGeometry(3, 0.15, 0.5), '#C48D52', { y: 0.075, z: 8.25, receive: true }));
  // 러그
  const rug = mesh(new THREE.CylinderGeometry(1.6, 1.6, 0.03, 32), '#F3C7A6', { y: DECK_Y + 0.02, z: 6, cast: false, receive: true });
  rug.scale.z = 0.6;
  scene.add(rug);
  const rug2 = mesh(new THREE.CylinderGeometry(1.25, 1.25, 0.035, 32), '#FBE3CF', { y: DECK_Y + 0.025, z: 6, cast: false, receive: true });
  rug2.scale.z = 0.6;
  scene.add(rug2);

  // 공간별 걸을 수 있는 범위와 장애물 {x0,x1,z0,z1}
  const areas = { main: { name: 'main', bounds: BOUNDS, obs: [] }, office: { name: 'office', bounds: OFFICE_BOUNDS, obs: [] } };
  let area = areas.main;
  const obstacles = areas.main.obs;
  const addObs = (x, z, w, d) => obstacles.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });

  // 책장 (뒤쪽)
  const bookColors = ['#E57373', '#64B5F6', '#81C784', '#FFD54F', '#BA68C8', '#4DB6AC', '#FF8A65', '#F06292'];
  for (let i = 0; i < 6; i++) {
    if (i === 2 || i === 3) continue;   // 가운데 두 칸은 비워서 응원 게시판 · 건의함 자리
    const x = -7.5 + i * 3;
    const shelf = new THREE.Group();
    shelf.position.set(x, DECK_Y, -6.6);
    shelf.add(mesh(new THREE.BoxGeometry(2.6, 2, 0.55), '#B07A45', { y: 1, receive: true }));
    for (let r = 0; r < 3; r++) {
      shelf.add(mesh(new THREE.BoxGeometry(2.4, 0.5, 0.1), '#7A4E28', { y: 0.35 + r * 0.6, z: 0.2, cast: false }));
      let bx = -1.1;
      while (bx < 1.05) {
        const bw = 0.12 + Math.random() * 0.1;
        const bh = 0.32 + Math.random() * 0.14;
        shelf.add(mesh(new THREE.BoxGeometry(bw, bh, 0.3), bookColors[(Math.random() * bookColors.length) | 0], { x: bx + bw / 2, y: 0.12 + r * 0.6 + bh / 2, z: 0.18, cast: false }));
        bx += bw + 0.02;
      }
    }
    scene.add(shelf);
    addObs(x, -6.6, 2.6, 0.6);
  }

  // 화분
  const pot = (x, z, s = 1) => {
    const g = new THREE.Group();
    g.position.set(x, DECK_Y, z);
    g.scale.setScalar(s);
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.4, 12), '#D9785B', { y: 0.2 }));
    g.add(mesh(new THREE.SphereGeometry(0.42, 12, 10), '#5FB55A', { y: 0.72 }));
    g.add(mesh(new THREE.SphereGeometry(0.3, 12, 10), '#78C866', { x: 0.2, y: 0.95, z: 0.1 }));
    scene.add(g);
    addObs(x, z, 0.6 * s, 0.6 * s);
  };
  pot(-9, -5.6); pot(9, -5.6); pot(-9, 6.8, 0.9); pot(9, 6.8, 0.9);

  // 기둥 + 전구줄
  const bulbs = [];
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#FFE9A8', emissive: '#FFCF6B', emissiveIntensity: 1 });
  const posts = [[-9.6, -6.9], [9.6, -6.9], [9.6, 7.9], [-9.6, 7.9]];
  for (const [x, z] of posts) scene.add(mesh(new THREE.CylinderGeometry(0.12, 0.14, 4.2, 8), '#8A5A33', { x, y: 2.1 + DECK_Y, z }));
  const stringLine = (a, b, n = 18) => {
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const y = 4.3 - Math.sin(Math.PI * t) * 0.9;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), bulbMat);
      bulb.position.set(x, y, z);
      scene.add(bulb);
      bulbs.push(bulb);
    }
  };
  stringLine(posts[0], posts[1]); stringLine(posts[1], posts[2], 22); stringLine(posts[2], posts[3]); stringLine(posts[3], posts[0], 22);

  // 간판
  const sign = new THREE.Group();
  sign.position.set(5.2, 0, 9.3);
  sign.rotation.y = -0.35;
  sign.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), '#8A5A33', { x: -1.1, y: 0.8 }));
  sign.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.6, 8), '#8A5A33', { x: 1.1, y: 0.8 }));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 0.88), new THREE.MeshLambertMaterial({ map: signTexture(opts.roomName || '숲속 독서실'), transparent: true }));
  board.position.set(0, 1.45, 0.02);
  sign.add(board);
  sign.add(mesh(new THREE.BoxGeometry(2.8, 0.88, 0.03), '#5B8C51', { y: 1.45, z: -0.01 }));
  scene.add(sign);

  // 책상들
  const seats = [];
  const deskWood = m('#E6B77E');
  COLS.forEach((x) => ROWS.forEach(({ z, f }) => {
    const g = new THREE.Group();
    g.position.set(x, DECK_Y, z);
    if (f > 0) g.rotation.y = Math.PI;   // 입구 쪽을 보는 줄은 책상을 돌려 놓음
    const b = -f;                        // 의자가 있는 쪽 (z 방향)
    const top = mesh(new THREE.BoxGeometry(1.8, 0.08, 0.95), deskWood, { y: 0.62, receive: true });
    g.add(top);
    for (const [lx, lz] of [[-0.8, -0.4], [0.8, -0.4], [-0.8, 0.4], [0.8, 0.4]]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.6, 0.08), '#B07A45', { x: lx, y: 0.3, z: lz }));
    g.add(mesh(new THREE.BoxGeometry(1.8, 0.55, 0.06), '#F5E6C8', { y: 0.92, z: -0.46 }));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.55, 0.9), '#F5E6C8', { x: -0.88, y: 0.92 }));
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.55, 0.9), '#F5E6C8', { x: 0.88, y: 0.92 }));
    // 책 & 노트
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.03, 0.36), '#FFFFFF', { x: 0.05, y: 0.675, z: 0.1, cast: false }));
    g.add(mesh(new THREE.BoxGeometry(0.4, 0.12, 0.3), bookColors[(seats.length * 3) % bookColors.length], { x: -0.6, y: 0.72, z: -0.25 }));
    // 스탠드
    const lamp = new THREE.Group();
    lamp.position.set(0.62, 0.66, -0.28);
    lamp.add(mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.04, 12), '#5E8C6A'));
    lamp.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), '#5E8C6A', { y: 0.21 }));
    const shade = mesh(new THREE.ConeGeometry(0.14, 0.16, 12, 1, true), mat('#7FB89A', { side: THREE.DoubleSide }), { y: 0.42, x: -0.06 });
    shade.rotation.z = 0.5;
    lamp.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshStandardMaterial({ color: '#FFF3C4', emissive: '#FFD26B', emissiveIntensity: 0 }));
    bulb.position.set(-0.08, 0.38, 0);
    lamp.add(bulb);
    g.add(lamp);
    // 의자
    const chair = new THREE.Group();
    chair.position.set(0, 0, 0.82);
    chair.add(mesh(new THREE.BoxGeometry(0.6, 0.07, 0.55), '#7DB6D8', { y: 0.36 }));
    chair.add(mesh(new THREE.BoxGeometry(0.6, 0.45, 0.07), '#7DB6D8', { y: 0.62, z: 0.27 }));
    for (const [lx, lz] of [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]]) chair.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6), '#5A7F96', { x: lx, y: 0.18, z: lz }));
    g.add(chair);
    // 좌석 번호
    // 책상 이름표: 평소엔 자리 번호, D-day를 정한 학생이 앉으면 '수능 D-9'
    const tagCanvas = document.createElement('canvas'); tagCanvas.width = 256; tagCanvas.height = 72;
    const tagTex = new THREE.CanvasTexture(tagCanvas); tagTex.colorSpace = THREE.SRGBColorSpace; tagTex.anisotropy = 4;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.18), new THREE.MeshBasicMaterial({ map: tagTex, transparent: true }));
    tag.position.set(0, 1.0, -0.42);
    g.add(tag);

    const idx = seats.length;
    g.traverse((o) => { o.userData.seat = idx; });
    scene.add(g);
    seats.push({ idx, group: g, bulb, f, tagCanvas, tagTex, chairPos: new THREE.Vector3(x, DECK_Y, z + b * 0.82), approach: new THREE.Vector3(x, DECK_Y, z + b * 1.45), occupant: null });
    addObs(x, z, 1.9, 1.05);
    addObs(x, z + b * 0.82, 0.6, 0.55);
  }));
  seats.forEach((st) => drawSeatTag(st, ''));

  // 나무, 꽃, 구름
  const treeGreens = ['#6CBF5A', '#7FCF63', '#5DAE55', '#93D46F'];
  const treeAutumn = ['#F2A54A', '#F5C451', '#E9785A'];
  const tree = (x, z, s, autumn) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    g.add(mesh(new THREE.CylinderGeometry(0.18, 0.26, 1.6, 8), '#8A5A33', { y: 0.8 }));
    const c = autumn ? treeAutumn : treeGreens;
    g.add(mesh(new THREE.SphereGeometry(1.05, 14, 12), c[(Math.random() * c.length) | 0], { y: 2.2 }));
    g.add(mesh(new THREE.SphereGeometry(0.75, 12, 10), c[(Math.random() * c.length) | 0], { x: 0.55, y: 2.75, z: 0.2 }));
    g.add(mesh(new THREE.SphereGeometry(0.7, 12, 10), c[(Math.random() * c.length) | 0], { x: -0.55, y: 2.6, z: -0.1 }));
    scene.add(g);
  };
  const rnd = mulberry(7);
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 14 + rnd() * 12;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.9;
    if (z > 9 && Math.abs(x) < 6) continue; // 앞쪽 시야 확보
    if (x < -12) continue;                   // 왼쪽은 쉼터 숲
    tree(x, z, 0.9 + rnd() * 0.6, rnd() < 0.35);
  }
  const flowerColors = ['#FFFFFF', '#FF9EB5', '#FFE066', '#B39DFF'];
  const fGeo = new THREE.SphereGeometry(0.09, 6, 6);
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * 50, z = (rnd() - 0.5) * 44;
    if (Math.abs(x) < 10.5 && z > -7.5 && z < 9) continue;
    if (x < -12) continue;
    scene.add(mesh(fGeo, flowerColors[i % 4], { x, y: 0.08, z, cast: false }));
  }
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group();
    const cm = mat('#FFFFFF', { transparent: true, opacity: 0.95 });
    for (let k = 0; k < 4; k++) g.add(mesh(new THREE.SphereGeometry(1 + rnd(), 10, 8), cm, { x: k * 1.3 - 2, y: rnd() * 0.5, z: rnd(), cast: false }));
    g.position.set((rnd() - 0.5) * 70, 13 + rnd() * 6, -30 - rnd() * 15);
    scene.add(g);
    clouds.push(g);
  }
  const starGeo = new THREE.BufferGeometry();
  const sp = [];
  for (let i = 0; i < 300; i++) sp.push((rnd() - 0.5) * 160, 18 + rnd() * 40, -40 - rnd() * 40);
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.35 }));
  scene.add(stars);

  // ---------------- 캐릭터 ----------------
  const labelsEl = document.createElement('div');
  labelsEl.className = 'labels';
  container.appendChild(labelsEl);
  const actors = [];
  function addActor(animal, clothes, label, me = false) {
    const obj = makeAnimal(animal, clothes);
    scene.add(obj);
    const el = document.createElement('div');
    el.className = 'name-tag' + (me ? ' me' : '');
    labelsEl.appendChild(el);
    const a = { obj, el, mode: 'idle', me };
    setLabel(a, label);
    actors.push(a);
    return a;
  }
  // 이름표: 닉네임 / 🎯 목표(앉아 있을 때) / 상태(열공 중) 를 세 줄로 쌓아서 옆으로 넘치지 않게
  function setLabel(a, { name, status, goal }) {
    const g = goal && a.seat && !badWord(goal) ? goal : '';
    const stack = !!(g || status);
    a.el.classList.toggle('has-goal', stack);
    const nameRow = (a.me ? '<b class="me-dot">나</b>' : '') + `<span>${esc(name)}</span>`;
    a.el.innerHTML = stack
      ? `<div class="nt-row">${nameRow}</div>${g ? `<div class="nt-goal">🎯 ${esc(g)}</div>` : ''}${status ? `<small class="nt-status">${esc(status)}</small>` : ''}`
      : nameRow;
  }

  const cushionMat = [m('#F7C6D0'), m('#FFE9A8')];
  // 같이 공부하는 분위기를 위한 NPC (1단계: 혼자 쓰는 버전)
  const npcDefs = [
    { animal: 'elephant', name: '든든한 코끼리', status: '📚 열공 중', seat: 1 },
    { animal: 'mouse', name: '꼼꼼 생쥐', status: '📚 열공 중', seat: 6 },
    { animal: 'giraffe', name: '높이 기린', status: '📚 열공 중', seat: 11 },
    { animal: 'sloth', name: '느긋 나무늘보', status: '📚 열공 중', seat: 8 },
    { animal: 'penguin', name: '뒤뚱 펭귄', status: '📚 열공 중', seat: 3 },
  ];
  npcDefs.forEach((d, i) => {
    const a = addActor(d.animal, CLOTHES[(i + 2) % CLOTHES.length], d);
    a.npc = true;
    a.homeSeat = d.seat;
    sitActor(a, seats[d.seat]);
    a.mode = 'study';
    seats[d.seat].bulb.material.emissiveIntensity = 1.4;
  });

  // 질문 챗봇들은 교무실 앞쪽 '질문 코너'에 (아래 교무실 만들 때 배치)
  const bots = [];

  function drawSeatTag(seat, text) {
    const t = text || seatName(seat.idx);
    if (seat.tagText === t) return;
    seat.tagText = t;
    const c = seat.tagCanvas.getContext('2d'), W = 256, H = 72;
    c.clearRect(0, 0, W, H);
    const dday = !!text;
    c.font = `800 ${dday ? 34 : 40}px ${FONT}`;
    const tw = Math.min(W - 8, c.measureText(t).width + 34);
    c.fillStyle = dday ? '#FFE9EE' : '#FFF8E3';
    c.beginPath(); c.roundRect((W - tw) / 2, 4, tw, H - 8, 20); c.fill();
    c.fillStyle = dday ? '#B83F5A' : '#7A4E28'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(t, W / 2, H / 2 + 2, W - 20);
    seat.tagTex.needsUpdate = true;
  }
  function sitActor(a, seat) {
    seat.occupant = a;
    a.seat = seat;
    drawSeatTag(seat, a.me ? player.dday : a.dday);
    const u = a.obj.userData;
    const sc = u.scale || 1;
    // 쥐·햄스터처럼 작은 동물은 방석을 쌓아야 책상에 겨우 닿음
    let lift = 0;
    if (u.cushion) {
      seat.cushions = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const c = mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.14, 16), cushionMat[i], { y: 0.465 + i * 0.14, z: 0.82 });
        seat.cushions.add(c);
      }
      seat.group.add(seat.cushions);
      lift = 0.28;
    }
    a.obj.position.copy(seat.chairPos);
    a.obj.position.y = DECK_Y + 0.395 + lift - 0.2 * sc;
    // 덩치가 크면 뒤로 물러앉아서 엉덩이가 의자 밖으로 튀어나옴
    a.obj.position.z += -seat.f * (-0.05 + Math.max(0, sc - 1) * 0.3);
    a.obj.rotation.y = seat.f > 0 ? 0 : Math.PI;
    a.mode = 'sit';
  }
  function clearCushions(seat) {
    if (seat.cushions) { seat.group.remove(seat.cushions); seat.cushions = null; }
  }

  const player = addActor(opts.animal || 'bear', CLOTHES[0], { name: opts.name || '' }, true);
  player.animal = opts.animal || 'bear';
  player.lookKey = 's:' + player.animal;
  let teacherLook = null;
  let baseAnimal = player.animal, baseName = opts.name || '', baseStatus = '', baseGoal = '';
  const playerSpeed = () => animalSpeed(player.animal) * (area.name === 'park' && pondDepth(player.obj.position.x, player.obj.position.z) > 0.05 ? 0.55 : 1);
  player.obj.position.set(0, DECK_Y, 6.2);
  player.obj.rotation.y = Math.PI;
  let path = [];
  let waitT = 0;
  let pendingSeat = null;
  let pendingBot = null;   // 걸어간 뒤 말 걸 챗봇 id
  let nearBot = null;      // 가까이 있는 챗봇 id
  let pendingOffice = null;   // { type: 'enter' | 'exit' | 'desk' | 'sit', desk }
  let nearDoor = null;        // 'enter' (교무실 문 앞) | 'exit' (교무실 나가는 문 앞) | null
  function tapBot(id) {
    const bot = bots.find((x) => x.id === id);
    if (!bot) return;
    if (nearBot === id && !player.seat && !player.officeDesk) { opts.onBot && opts.onBot(id); return; }
    pendingSeat = null; pendingOffice = null;
    walkTo(bot.front);
    pendingBot = id;
  }
  let studying = false;


  // ---------------- 학교 이름 가랜드 (안쪽 벽 위, 글자 하나에 깃발 하나) ----------------
  let banner = null;
  const FLAG_COLORS = ['#F7A8B8', '#FFD670', '#9ED8A8', '#9CC8F2', '#D7B8F5', '#FFB98A'];
  function setBanner(text, again) {
    // 가랜드 폰트를 아직 못 받았으면 받은 뒤에 한 번 더 그림
    if (!again && document.fonts && document.fonts.load) document.fonts.load(`66px ${BANNER_FONT}`, '가나다').then(() => setBanner(text, true)).catch(() => {});
    if (banner) { scene.remove(banner.group); banner = null; }
    const chars = [...String(text || '').trim()].slice(0, 20);
    if (!chars.length) return;
    const group = new THREE.Group();
    // 안쪽 벽 책장 바로 앞, 양쪽 모서리 기둥에 걸어요 (지나다닐 때 걸리지 않게)
    const Z = -6.25, HALF = 9.6;
    const sagY = (x) => DECK_Y + 2.3 - 0.2 * (1 - (x / HALF) ** 2);   // 책장 윗부분에 살짝 처지게
    // 글자 깃발 간격: 글자가 많으면 좁게
    const gap = Math.min(0.9, 15.5 / chars.length);
    const w = gap * 0.86;
    const xs = [];
    const start = -((chars.length - 1) * gap) / 2;
    chars.forEach((_, i) => xs.push({ x: start + i * gap, ch: chars[i] }));
    // 양옆은 글자 없는 작은 깃발로 채움
    for (let x = start - gap; x > -HALF + 0.3; x -= gap) xs.unshift({ x, ch: '' });
    for (let x = start + chars.length * gap; x < HALF - 0.3; x += gap) xs.push({ x, ch: '' });
    const flags = [];
    xs.forEach((f, i) => {
      const tex = canvasTex(128, 140, (c, cw, ch) => {
        c.fillStyle = FLAG_COLORS[i % FLAG_COLORS.length];
        c.beginPath(); c.moveTo(4, 4); c.lineTo(cw - 4, 4); c.lineTo(cw / 2, ch - 4); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(107,74,46,0.25)'; c.lineWidth = 4; c.stroke();
        if (f.ch) { c.fillStyle = '#5A3E26'; c.font = `400 66px ${BANNER_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(f.ch, cw / 2, 50); }
      });
      const size = f.ch ? w : w * 0.72;
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(size, size * 1.09), new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide }));
      const pivot = new THREE.Group();
      pivot.position.set(f.x, sagY(f.x), Z);
      flag.position.y = -size * 0.545;
      pivot.add(flag);
      group.add(pivot);
      flags.push({ pivot, p: i * 0.7 });
    });
    const pts = [];
    for (let k = 0; k <= 40; k++) { const x = -HALF + (2 * HALF * k) / 40; pts.push(new THREE.Vector3(x, sagY(x) + 0.02, Z)); }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#8A5A33' })));

    scene.add(group);
    banner = { group, flags };
  }
  function stepBanner(t) {
    if (banner) for (const f of banner.flags) f.pivot.rotation.x = Math.sin(t * 1.6 + f.p) * 0.08;   // 살랑살랑
  }

  // ---------------- 응원 게시판 · 건의함 (안쪽 벽, 책장 사이) ----------------
  const BOARD_POS = { x: -0.7, z: -6.55 };
  const BOX_POS = { x: 1.75, z: -6.5 };
  const boardCanvas = document.createElement('canvas');
  boardCanvas.width = 640; boardCanvas.height = 400;
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.SRGBColorSpace;
  boardTex.anisotropy = 4;
  const boardGroup = new THREE.Group();
  boardGroup.position.set(BOARD_POS.x, DECK_Y, BOARD_POS.z);
  boardGroup.add(mesh(new THREE.BoxGeometry(2.5, 1.62, 0.1), '#8A5A33', { y: 1.35 }));                 // 나무 틀
  const boardFace = new THREE.Mesh(new THREE.PlaneGeometry(2.36, 1.48), new THREE.MeshLambertMaterial({ map: boardTex }));
  boardFace.position.set(0, 1.35, 0.055);
  boardGroup.add(boardFace);
  for (const lx of [-1.05, 1.05]) boardGroup.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.6, 8), '#6B4A2E', { x: lx, y: 0.3 }));
  boardGroup.traverse((o) => { o.userData.spot = 'board'; });
  scene.add(boardGroup);
  addObs(BOARD_POS.x, BOARD_POS.z, 2.6, 0.4);
  const boxGroup = new THREE.Group();
  boxGroup.position.set(BOX_POS.x, DECK_Y, BOX_POS.z);
  boxGroup.add(mesh(new THREE.BoxGeometry(0.12, 0.7, 0.12), '#6B4A2E', { y: 0.35 }));                    // 기둥
  boxGroup.add(mesh(new THREE.BoxGeometry(0.62, 0.5, 0.46), '#E2574C', { y: 0.95 }));                   // 빨간 함
  boxGroup.add(mesh(new THREE.BoxGeometry(0.7, 0.06, 0.52), '#B83F36', { y: 1.22 }));                   // 뚜껑
  boxGroup.add(mesh(new THREE.BoxGeometry(0.36, 0.03, 0.02), '#2B2B2B', { y: 1.08, z: 0.235, cast: false })); // 투입구
  const boxSign = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.2), new THREE.MeshBasicMaterial({ map: canvasTex(256, 92, (g, w, h) => {
    g.fillStyle = '#FFF8E3'; g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, 14); g.fill();
    g.fillStyle = '#B83F36'; g.font = `900 46px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('건의함', w / 2, h / 2 + 2);
  }), transparent: true }));
  boxSign.position.set(0, 0.88, 0.235);
  boxGroup.add(boxSign);
  boxGroup.traverse((o) => { o.userData.spot = 'suggest'; });
  scene.add(boxGroup);
  addObs(BOX_POS.x, BOX_POS.z, 0.8, 0.6);

  function wrapText(g, text, x, y, maxW, lh, maxLines) {
    wrapLines(g, text, maxW).slice(0, maxLines).forEach((l, i) => g.fillText(l, x, y + i * lh));
  }
  /** 게시판에 포스트잇 그리기 (최근 8장) */
  function setBoardNotes(notes) {
    const g = boardCanvas.getContext('2d');
    const W = boardCanvas.width, H = boardCanvas.height;
    g.fillStyle = '#C8955B'; g.fillRect(0, 0, W, H);                 // 코르크
    for (let i = 0; i < 260; i++) { g.fillStyle = i % 2 ? 'rgba(120,70,30,0.12)' : 'rgba(255,230,190,0.12)'; g.fillRect((i * 97) % W, (i * 57) % H, 3, 3); }
    g.fillStyle = '#FFF8E3'; g.beginPath(); g.roundRect(W / 2 - 150, 10, 300, 52, 16); g.fill();
    g.fillStyle = '#6B4A2E'; g.font = `900 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('📌 응원 게시판', W / 2, 37);
    const list = (notes || []).slice(0, 8);
    if (!list.length) {
      g.fillStyle = 'rgba(255,248,227,0.9)'; g.font = `700 26px ${FONT}`;
      g.fillText('첫 응원을 붙여 주세요!', W / 2, H / 2 + 20);
    }
    list.forEach((n, i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 22 + col * 152, y = 80 + row * 156;
      g.save();
      g.translate(x + 66, y + 66);
      g.rotate(((i * 37) % 9 - 4) * 0.02);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-62, -58, 132, 132);
      g.fillStyle = n.color || '#FFF3A3'; g.fillRect(-66, -66, 132, 132);
      g.fillStyle = '#E2574C'; g.beginPath(); g.arc(0, -58, 7, 0, Math.PI * 2); g.fill(); // 압정
      g.fillStyle = '#3B2F26'; g.textAlign = 'left'; g.textBaseline = 'top';
      g.font = `800 17px ${FONT}`;
      if (n.to) g.fillText(('To. ' + n.to).slice(0, 10), -56, -44);
      g.font = `500 17px ${FONT}`;
      wrapText(g, n.text, -56, n.to ? -20 : -44, 112, 22, n.to ? 4 : 5);
      g.restore();
    });
    boardTex.needsUpdate = true;
  }
  setBoardNotes([]);

  // ---------------- 교무실 ----------------
  // 밖: 공부방 오른쪽 잔디 위의 작은 건물 (문 앞에 서거나 건물을 누르면 들어감)
  const officeHouse = new THREE.Group();
  officeHouse.position.set(12.4, 0, 0.6);
  officeHouse.rotation.y = -0.45;
  officeHouse.scale.setScalar(0.8);
  officeHouse.add(mesh(new THREE.BoxGeometry(4.6, 2.5, 4.2), '#FFF1D6', { y: 1.25, receive: true }));
  const roof = mesh(new THREE.ConeGeometry(3.7, 1.5, 4), '#5E9BD6', { y: 3.2 });
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.92);
  officeHouse.add(roof);
  // 문 (경첩을 축으로 열리고 닫힘)
  const doorHinge = new THREE.Group();
  doorHinge.position.set(-2.32, 0, -0.55);
  doorHinge.add(mesh(new THREE.BoxGeometry(0.08, 1.7, 1.1), '#8A5A33', { y: 0.85, z: 0.55 }));
  // 닫혀 있을 때 붙는 팻말
  const closedSign = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 16); g.fill();
    g.strokeStyle = '#E0574F'; g.lineWidth = 8; g.stroke();
    g.fillStyle = '#C0392B'; g.font = `900 42px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('시험 출제 중', w / 2, h / 2 + 2);
  }), transparent: true }));
  closedSign.position.set(-0.06, 1.05, 0.55);
  closedSign.rotation.y = -Math.PI / 2;
  doorHinge.add(closedSign);
  officeHouse.add(doorHinge);
  officeHouse.add(mesh(new THREE.BoxGeometry(0.1, 0.06, 1.3), '#6B4A2E', { x: -2.33, y: 1.72 }));          // 문틀 위
  officeHouse.add(mesh(new THREE.SphereGeometry(0.05, 8, 8), '#F5C451', { x: -2.38, y: 0.85, z: 0.35 }));  // 손잡이
  for (const wz of [-1.3, 1.3]) officeHouse.add(mesh(new THREE.BoxGeometry(0.06, 0.8, 0.8), mat('#BFE3FF', { emissive: '#6FB6F0', emissiveIntensity: 0.25 }), { x: -2.32, y: 1.4, z: wz })); // 창문
  for (const wx of [-1.2, 1.2]) officeHouse.add(mesh(new THREE.BoxGeometry(0.8, 0.8, 0.06), mat('#BFE3FF', { emissive: '#6FB6F0', emissiveIntensity: 0.25 }), { x: wx, y: 1.4, z: 2.12 }));
  const houseSign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.6), new THREE.MeshLambertMaterial({ map: signTexture('교무실'), transparent: true }));
  houseSign.position.set(0, 2.15, 2.14);
  officeHouse.add(houseSign);
  officeHouse.traverse((o) => { o.userData.officeDoor = true; });
  scene.add(officeHouse);
  // 데크 끝 표지판 + 징검돌
  const post = new THREE.Group();
  post.position.set(9.55, DECK_Y, 1.0);
  // 기둥은 팻말 양옆에 (가운데 기둥이 글씨를 가리지 않게)
  for (const sx of [-0.56, 0.56]) post.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.35, 6), '#8A5A33', { x: sx, y: 0.67, z: -0.03 }));
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38), new THREE.MeshLambertMaterial({ map: signTexture('교무실 →'), transparent: true }));
  arrow.position.set(0, 1.1, 0.03);
  post.add(arrow);
  const arrowClosed = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), closedSign.material);
  arrowClosed.position.set(0, 1.15, 0.035);
  post.add(arrowClosed);
  post.traverse((o) => { o.userData.officeDoor = true; });
  scene.add(post);
  for (let i = 0; i < 2; i++) scene.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 12), '#D8D2C4', { x: 10.05 + i * 0.5, y: 0.03, z: -0.25 + i * 0.05, cast: false, receive: true }));

  // 접속한 선생님이 없으면 문을 닫고 '시험 출제 중' 팻말
  let officeOpen = false;
  function setOfficeOpen(open) {
    officeOpen = !!open;
    doorHinge.rotation.y = officeOpen ? 1.25 : 0;
    closedSign.visible = !officeOpen;
    arrow.visible = officeOpen;
    arrowClosed.visible = !officeOpen;
  }
  setOfficeOpen(true); // 교무실은 챗봇 선생님이 있어서 언제나 열려 있음

  // 안: x=60 근처의 방
  const officeRoom = new THREE.Group();
  const officeFloor = mesh(new THREE.BoxGeometry(12.6, DECK_Y, 9.2), new THREE.MeshLambertMaterial({ color: '#E9D3AE', map: woodTexture() }), { x: OX, y: DECK_Y / 2, z: 0.4, receive: true });
  officeRoom.add(officeFloor);
  const wallMat = m('#F7EBDD');
  officeRoom.add(mesh(new THREE.BoxGeometry(12.6, 2.6, 0.2), wallMat, { x: OX, y: DECK_Y + 1.3, z: -4.1, receive: true }));
  officeRoom.add(mesh(new THREE.BoxGeometry(0.2, 2.6, 9.2), wallMat, { x: OX - 6.3, y: DECK_Y + 1.3, z: 0.4, receive: true }));
  officeRoom.add(mesh(new THREE.BoxGeometry(0.2, 2.6, 9.2), wallMat, { x: OX + 6.3, y: DECK_Y + 1.3, z: 0.4, receive: true }));
  for (const sx of [-1, 1]) officeRoom.add(mesh(new THREE.BoxGeometry(5.2, 0.7, 0.2), wallMat, { x: OX + sx * 3.7, y: DECK_Y + 0.35, z: 5.0 })); // 앞쪽 낮은 벽
  // 칠판, 시계, 화분
  officeRoom.add(mesh(new THREE.BoxGeometry(4.2, 1.3, 0.08), '#3F6B4F', { x: OX, y: DECK_Y + 1.5, z: -3.96 }));
  const boardText = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), new THREE.MeshBasicMaterial({ map: canvasTex(640, 160, (g, w, h) => {
    g.fillStyle = '#FFFFFF'; g.font = `700 40px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('궁금한 건 언제든 물어보세요', w / 2, h / 2);
  }), transparent: true }));
  boardText.position.set(OX, DECK_Y + 1.5, -3.91);
  officeRoom.add(boardText);
  officeRoom.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 20), '#FFFFFF', { x: OX + 3.6, y: DECK_Y + 2.0, z: -3.97 }).rotateX(Math.PI / 2));
  for (const px of [-5.6, 5.6]) {
    officeRoom.add(mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.36, 12), '#D9785B', { x: OX + px, y: DECK_Y + 0.18, z: -3.6 }));
    officeRoom.add(mesh(new THREE.SphereGeometry(0.4, 12, 10), '#5FB55A', { x: OX + px, y: DECK_Y + 0.68, z: -3.6 }));
    areas.office.obs.push({ x0: OX + px - 0.3, x1: OX + px + 0.3, z0: -3.9, z1: -3.3 });
  }
  // 나가는 문 (발판)
  const exitMat = mesh(new THREE.BoxGeometry(1.6, 0.04, 0.8), '#C96F4A', { x: OX, y: DECK_Y + 0.02, z: 4.45, cast: false, receive: true });
  exitMat.userData.officeExit = true;
  officeRoom.add(exitMat);
  const exitSign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.42), new THREE.MeshLambertMaterial({ map: signTexture('나가기'), transparent: true }));
  exitSign.position.set(OX, DECK_Y + 0.95, 5.12);
  exitSign.userData.officeExit = true;
  officeRoom.add(exitSign);
  // 챗봇 선생님 책상 (CONFIG.BOTS 순서대로, 한 줄에 5개까지)
  const botList = (opts.bots || []).slice(0, 10);
  const perRow = Math.min(5, Math.max(1, botList.length));
  const rows = Math.ceil(botList.length / 5) || 1;
  botList.forEach((b, i) => {
    const r = Math.floor(i / 5);
    const inRow = r < rows - 1 ? 5 : botList.length - r * 5;
    const c = i % 5;
    const x = OX + (c - (inRow - 1) / 2) * 2.6;
    const z = rows === 1 ? -0.8 : (r === 0 ? -1.9 : 0.8);
    const g = new THREE.Group();
    g.position.set(x, DECK_Y, z);
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.08, 0.85), '#D9AE78', { y: 0.62, receive: true }));
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.55, 0.06), '#C99A66', { y: 0.33, z: 0.4 }));
    g.add(mesh(new THREE.BoxGeometry(0.5, 0.06, 0.36), '#FFFFFF', { x: -0.35, y: 0.68, z: 0.05, cast: false })); // 펼친 책
    g.add(mesh(new THREE.BoxGeometry(0.36, 0.14, 0.26), ['#E57373', '#64B5F6', '#81C784', '#FFD54F', '#BA68C8'][i % 5], { x: 0.5, y: 0.73, z: -0.15 }));
    g.add(mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.12, 10), '#F7C6D0', { x: 0.2, y: 0.72, z: 0.15 })); // 컵
    const tag = canvasTex(320, 80, (cg, w, h) => {
      cg.fillStyle = '#FFF8E3'; cg.beginPath(); cg.roundRect(2, 2, w - 4, h - 4, 16); cg.fill();
      cg.fillStyle = '#6B4A2E'; cg.font = `800 32px ${FONT}`; cg.textAlign = 'center'; cg.textBaseline = 'middle';
      cg.fillText(`${b.name}${b.desc ? ' · ' + b.desc.replace(/ 질문$/, '') : ''}`, w / 2, h / 2 + 2);
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.275), new THREE.MeshBasicMaterial({ map: tag, transparent: true }));
    plate.position.set(0, 0.42, 0.44);
    g.add(plate);
    officeRoom.add(g);
    // 책상 뒤에 서 있는 챗봇 선생님
    const make = BOT_MODELS[b.model || b.id] || makeMascot;
    const obj = make();
    obj.position.set(x, DECK_Y, z - 0.75);
    scene.add(obj);
    g.traverse((o) => { o.userData.botId = b.id; });
    obj.traverse((o) => { o.userData.botId = b.id; });
    const el = document.createElement('div');
    el.className = 'name-tag mascot-tag';
    el.innerHTML = `<span>🐾 ${esc(b.name)}</span><small>${esc(b.desc || '질문 도우미')}</small>`;
    labelsEl.appendChild(el);
    actors.push({ obj, el, mode: 'idle', me: false, area: 'office' });
    areas.office.obs.push({ x0: x - 0.9, x1: x + 0.9, z0: z - 1.1, z1: z + 0.45 });
    bots.push({ id: b.id, name: b.name, obj, front: new THREE.Vector3(x, DECK_Y, z + 0.95) });
  });
  scene.add(officeRoom);
  const officeDesks = [];          // (예전 선생님 책상 — 이제 선생님은 캐릭터 없이 대화창으로만)
  function setOfficeSeats() {}     // 선생님 자리 표시는 하지 않음
  const officeSitters = new Map();
  let myTeacherId = null;

  // ---------------- 🌿 쉼터: 산책로 + 놀이터 (x = PX 근처의 다른 구역) ----------------
  const PX = -36;   // 공부방 왼쪽 숲속 (교무실 반대쪽), 오솔길로 이어짐
  areas.park = { name: 'park', bounds: { x0: PX - 16.5, x1: PX + 16.5, z0: -13, z1: 13 }, obs: [] };
  const pObs = (x, z, w, d) => areas.park.obs.push({ x0: PX + x - w / 2, x1: PX + x + w / 2, z0: z - d / 2, z1: z + d / 2 });
  const P = (x, y, z) => new THREE.Vector3(PX + x, y, z);
  const PARK_ENTRY = P(0, DECK_Y, 10.6);
  const PARK_EXIT = P(0, DECK_Y, 12.3);
  // 쉼터 크기: 산책로(타원) 반지름 · 꼬마 기차 선로
  const RING = { r0: 11.55, r1: 12.85, sz: 0.78 }, TRACK = { rx: 14.3, rz: 11.45 };
  const MAIN_PARK_PORTAL = new THREE.Vector3(-9.0, DECK_Y, -0.2);   // 공부방 왼쪽 끝 (교무실 문과 반대쪽)
  // 땅 · 산책로
  const parkGround = mesh(new THREE.CylinderGeometry(23, 23.5, 0.3, 64), '#9BD67A', { x: PX, y: DECK_Y - 0.15, cast: false, receive: true });
  scene.add(parkGround);
  // 산책로: 오솔길과 같은 갈색 흙길 + 진한 테두리 + 자갈
  for (const [r0, r1] of [[RING.r0 - 0.15, RING.r0 + 0.03], [RING.r1 - 0.03, RING.r1 + 0.15]]) {
    const edge = new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), mat('#9C7046'));
    edge.rotation.x = -Math.PI / 2; edge.scale.y = RING.sz; edge.position.set(PX, DECK_Y + 0.011, 0); scene.add(edge);
  }
  const pathRing = new THREE.Mesh(new THREE.RingGeometry(RING.r0, RING.r1, 96), mat('#C69A68'));
  pathRing.rotation.x = -Math.PI / 2; pathRing.scale.y = RING.sz; pathRing.position.set(PX, DECK_Y + 0.012, 0); pathRing.receiveShadow = true;
  scene.add(pathRing);
  scene.add(mesh(new THREE.BoxGeometry(1.64, 0.018, 3.4), '#9C7046', { x: PX, y: DECK_Y + 0.009, z: 11.6, cast: false, receive: true }));
  const entryPath = mesh(new THREE.BoxGeometry(1.32, 0.02, 3.4), '#C69A68', { x: PX, y: DECK_Y + 0.011, z: 11.6, cast: false, receive: true });
  { const prd2 = mulberry(77);
    for (let i = 0; i < 140; i++) {
      const a = prd2() * Math.PI * 2, r = RING.r0 + 0.1 + prd2() * 1.1;
      scene.add(mesh(new THREE.CylinderGeometry(0.05 + prd2() * 0.05, 0.06, 0.02, 6), prd2() < 0.5 ? '#B08658' : '#D8B98C', { x: PX + Math.cos(a) * r, y: DECK_Y + 0.025, z: Math.sin(a) * r * RING.sz, cast: false }));
    } }
  scene.add(entryPath);
  // 나무 · 꽃
  const prnd = mulberry(21);
  for (let i = 0; i < 64; i++) {
    const a = prnd() * Math.PI * 2, r = 17 + prnd() * 6;
    const x = Math.cos(a) * r, z = Math.sin(a) * r * 0.82;
    if (z > 2.5 && x > -18) continue;   // 화면 앞쪽과 오솔길 쪽은 비워서 시야 확보
    const g = new THREE.Group();
    tree(PX + x, z, 0.9 + prnd() * 0.7, prnd() < 0.4);
  }
  for (let i = 0; i < 220; i++) {
    const a = prnd() * Math.PI * 2, r = 15.4 + prnd() * 1.6;
    scene.add(mesh(fGeo, flowerColors[i % 4], { x: PX + Math.cos(a) * r, y: DECK_Y + 0.08, z: Math.sin(a) * r * 0.8, cast: false }));
  }
  // 가로등 (밤에 켜짐: 공부방 전구와 같은 빛)
  // 놀이터 쪽(10°, 320°) 가로등은 산책로 바깥으로 빼서 그네·시소를 가리지 않게
  for (const [deg, k] of [[20, 1], [150, 1], [210, 1], [250, 1], [285, 1], [350, 1]]) {
    const t = (deg * Math.PI) / 180, x = Math.cos(t) * 10.9 * k, z = Math.sin(t) * 8.4 * k;
    const g = new THREE.Group(); g.position.set(PX + x, DECK_Y, z);
    g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 8), '#5E4630', { y: 1.1 }));
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.18, 10), '#5E4630', { y: 2.3 }));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), bulbMat); bulb.position.y = 2.15; g.add(bulb);
    scene.add(g); pObs(x, z, 0.3, 0.3);
  }
  // 연못
  const PO = { x: -3.6, z: 0.2, r: 3.25, sy: 0.72 };   // 연못 (쉼터 기준 좌표)
  const pond = mesh(new THREE.CircleGeometry(PO.r, 56), new THREE.MeshLambertMaterial({ color: '#7CC4E8', emissive: '#2E6E99', emissiveIntensity: 0.15 }), { x: PX + PO.x, y: DECK_Y + 0.02, z: PO.z, cast: false });
  pond.rotation.x = -Math.PI / 2; pond.scale.y = PO.sy; scene.add(pond);
  const pondEdge = mesh(new THREE.TorusGeometry(PO.r, 0.13, 6, 56), '#B8AE9C', { x: PX + PO.x, y: DECK_Y + 0.04, z: PO.z });
  pondEdge.rotation.x = -Math.PI / 2; pondEdge.scale.y = PO.sy; scene.add(pondEdge);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 32), new THREE.MeshBasicMaterial({ color: '#E8F7FF', transparent: true, opacity: 0.6 }));
  ripple.rotation.x = -Math.PI / 2; ripple.position.set(PX - 4.8, DECK_Y + 0.03, -0.9); scene.add(ripple);
  for (const [x, z, r] of [[-1.8, -1.0, 0.3], [-5.9, 1.0, 0.28], [-3.2, -1.5, 0.24]]) {
    const pad = mesh(new THREE.CylinderGeometry(r, r, 0.02, 14), '#6CBF5A', { x: PX + x, y: DECK_Y + 0.035, z, cast: false }); scene.add(pad);
  }
  // 낚시터 (연못 왼쪽 옆에서 물 쪽으로 나온 나무 데크)
  const PIER = { x0: -8.1, x1: -5.85, z0: -0.3, z1: 0.7 };
  const pier = new THREE.Group(); pier.position.set(PX + (PIER.x0 + PIER.x1) / 2, DECK_Y, (PIER.z0 + PIER.z1) / 2);
  const pierLen = PIER.x1 - PIER.x0;
  pier.add(mesh(new THREE.BoxGeometry(pierLen, 0.06, 1.0), '#B98A57', { y: 0.05 }));
  for (let k = 0; k < 7; k++) pier.add(mesh(new THREE.BoxGeometry(0.03, 0.015, 1.02), '#8A6238', { y: 0.085, x: -pierLen / 2 + 0.15 + k * (pierLen - 0.3) / 6, cast: false }));
  for (const sz of [-0.45, 0.45]) for (const sx of [pierLen / 2 - 0.1, 0]) pier.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6), '#7A5530', { x: sx, y: 0.02, z: sz }));
  scene.add(pier);
  const FISH_SPOT = P(-6.15, DECK_Y, 0.2);
  const fishSign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.22), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (c, w, h) => {
    c.fillStyle = '#FFF8E3'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill();
    c.fillStyle = '#6B4A2E'; c.font = `800 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🎣 과학 낚시터', w / 2, h / 2 + 2);
  }), transparent: true }));
  fishSign.position.set(PX - 8.4, DECK_Y + 0.75, 1.15); scene.add(fishSign);
  scene.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 6), '#7A5530', { x: PX - 8.4, y: DECK_Y + 0.35, z: 1.12 }));
  pier.traverse((o) => { o.userData.fishSpot = true; });
  fishSign.userData.fishSpot = true;
  // 연못에는 들어갈 수 있어요: 들어가면 몸이 물에 잠기고, 천천히 걷고, 물결이 퍼짐
  const POND = { x: PX + PO.x, z: PO.z, rx: PO.r - 0.18, rz: PO.r * PO.sy - 0.15 };
  const onPier = (x, z) => x > PX + PIER.x0 && x < PX + PIER.x1 && z > PIER.z0 && z < PIER.z1;
  const pondQ = (x, z) => ((x - POND.x) / POND.rx) ** 2 + ((z - POND.z) / POND.rz) ** 2;
  const pondDepth = (x, z) => {   // 0(물가) ~ 1(한가운데)
    if (onPier(x, z)) return 0;
    const q = pondQ(x, z);
    return q < 1 ? 1 - q : 0;
  };
  const sinkAt = (a) => {
    if (a.area !== undefined && a.area !== 'park') return 0;
    if (onPier(a.obj.position.x, a.obj.position.z)) return -0.07;   // 데크 위
    const d = pondDepth(a.obj.position.x, a.obj.position.z);
    return d ? Math.min(0.26, 0.05 + d * 0.32) * (a.obj.userData.scale || 1) : 0;
  };
  const SWIM_DEPTH = 0.3;   // 이보다 깊으면 수영
  /** 수영 자세: 몸을 앞으로 눕혀 물 위에 뜨게 (y는 바닥 기준 높이 조정값을 돌려줌) */
  function swimPose(a, on, moving, dt) {
    const o = a.obj;
    if (o.rotation.order !== 'YXZ') o.rotation.order = 'YXZ';   // 바라보는 방향 기준으로 눕기
    const want = on ? 1.3 : 0;
    o.rotation.x += (want - o.rotation.x) * Math.min(1, dt * 6);
    o.userData.swimFast = !!moving;
    const s = o.userData.scale || 1;
    return on ? -0.16 * s : 0;
  }
  const wakeGeo = new THREE.RingGeometry(0.22, 0.3, 28);
  const wakes = [];
  function addWake(x, z, big) {
    let w = wakes.find((k) => !k.on);
    if (!w) { if (wakes.length > 24) return; w = { m: new THREE.Mesh(wakeGeo, new THREE.MeshBasicMaterial({ color: '#F2FBFF', transparent: true, opacity: 0.7, depthWrite: false })) }; w.m.rotation.x = -Math.PI / 2; scene.add(w.m); wakes.push(w); }
    w.on = true; w.t = 0; w.big = !!big; w.m.visible = true; w.m.position.set(x, DECK_Y + 0.035, z);
  }
  // ---------- 🎣 과학 낚시 ----------
  const _v = new THREE.Vector3();
  const lineMat = new THREE.LineBasicMaterial({ color: '#F5F5F5' });
  function makeRig(a) {
    const s = a.obj.userData.scale || 1;
    const rod = new THREE.Group(); rod.position.set(0.3, 0.45 * s + 0.08, 0.12); rod.rotation.x = 0.85;
    rod.add(mesh(new THREE.CylinderGeometry(0.014, 0.026, 1.4, 6), '#7A5530', { y: 0.7, cast: false }));
    rod.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 8), '#3A3A3A', { y: 0.25, z: 0.04, cast: false }));   // 릴
    const tip = new THREE.Object3D(); tip.position.y = 1.4; rod.add(tip);
    a.obj.add(rod);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), lineMat);
    line.frustumCulled = false; scene.add(line);
    const bob = new THREE.Group();
    bob.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), '#E2574C', { cast: false }));
    bob.add(mesh(new THREE.SphereGeometry(0.045, 10, 8), '#FFFFFF', { y: 0.05, cast: false }));
    scene.add(bob);
    a.rig = { rod, tip, line, bob };
  }
  function dropRig(a) {
    if (!a.rig) return;
    a.obj.remove(a.rig.rod); scene.remove(a.rig.line); scene.remove(a.rig.bob); a.rig.line.geometry.dispose();
    a.rig = null;
  }
  function stepRig(a, t, dip = 0, pull = 0) {
    const r = a.rig, o = a.obj, ry = o.rotation.y, d = 0.5 + 2.0 * (1 - pull);
    r.bob.position.set(o.position.x + Math.sin(ry) * d, DECK_Y + 0.03 - dip + Math.sin(t * 2.2) * 0.01 + pull * 0.5, o.position.z + Math.cos(ry) * d);
    r.tip.getWorldPosition(_v);
    const pos = r.line.geometry.attributes.position;
    pos.setXYZ(0, _v.x, _v.y, _v.z); pos.setXYZ(1, r.bob.position.x, r.bob.position.y + 0.04, r.bob.position.z); pos.needsUpdate = true;
  }
  let fishing = null, fishTold = false;
  function startFishing() {
    if (player.ride) leaveRide(true);
    player.obj.position.set(FISH_SPOT.x, DECK_Y, FISH_SPOT.z);
    player.obj.rotation.y = Math.PI / 2;   // 연못 쪽(+x)을 봄
    if (!player.rig) makeRig(player);
    fishing = { t: 0, biteAt: 2.5 + Math.random() * 3.5, phase: 'wait', pull: 0, catch: null };
    opts.onSfx && opts.onSfx('whoosh');
    setTimeout(() => opts.onSfx && opts.onSfx('slosh'), 450);
    if (!fishTold) { fishTold = true; opts.onToast && opts.onToast('🎣 찌가 흔들리면 과학 퀴즈! 맞히면 물고기를 낚아요'); }
  }
  function stopFishing() {
    if (!fishing) return;
    fishing = null; dropRig(player);
  }
  function fishResult(f) {
    if (!fishing || fishing.phase !== 'bite') return;
    fishing.phase = 'reel'; fishing.pull = 0; fishing.catch = f || null;
    opts.onSfx && opts.onSfx(f ? 'splash' : 'slosh');
  }
  function stepFishing(dt, t) {
    if (!fishing) return;
    if (area.name !== 'park' || Math.hypot(player.obj.position.x - FISH_SPOT.x, player.obj.position.z - FISH_SPOT.z) > 0.6) { stopFishing(); return; }
    const f = fishing;
    f.t += dt;
    let dip = 0;
    if (f.phase === 'wait') {
      if (f.t > f.biteAt - 0.8) dip = Math.max(0, Math.sin(f.t * 14)) * 0.015;   // 톡톡 건드림
      if (f.t > f.biteAt) {
        f.phase = 'bite';
        showFx(null, '❗');
        opts.onSfx && opts.onSfx('splash');
        addWake(player.obj.position.x + Math.sin(player.obj.rotation.y) * 2.5, player.obj.position.z + Math.cos(player.obj.rotation.y) * 2.5);
        if (opts.onFishBite) opts.onFishBite(); else fishResult(null);
      }
    } else if (f.phase === 'bite') {
      dip = 0.05 + Math.sin(f.t * 16) * 0.035;
    } else if (f.phase === 'reel') {
      f.pull = Math.min(1, f.pull + dt / 0.7);
      if (f.pull >= 1) {
        showFx(null, f.catch ? f.catch.icon : '💨');
        f.phase = 'wait'; f.t = 0; f.biteAt = 3 + Math.random() * 5; f.pull = 0; f.catch = null;
        opts.onSfx && opts.onSfx('whoosh');
      }
    }
    stepRig(player, t, dip, f.pull);
  }

  // ---------- 🪙 소원 동전 ----------
  const coinGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.015, 16), coinMat = new THREE.MeshLambertMaterial({ color: '#F2C14E', emissive: '#7A5A10', emissiveIntensity: 0.35 });
  const wishCoin = new THREE.Mesh(coinGeo, coinMat); wishCoin.visible = false; scene.add(wishCoin);
  wishCoin.position.set(PX + PO.x + 0.6, DECK_Y + 0.028, PO.z - 0.3);
  let flyCoin = null;
  function throwCoin() {
    const o = player.obj.position;
    const tx = POND.x + (o.x - POND.x) * 0.35, tz = POND.z + (o.z - POND.z) * 0.35;   // 연못 안쪽으로
    if (!flyCoin) { flyCoin = new THREE.Mesh(coinGeo, coinMat); scene.add(flyCoin); }
    flyCoin.visible = true;
    flyCoin.userData = { t: 0, from: new THREE.Vector3(o.x, DECK_Y + 0.8, o.z), to: new THREE.Vector3(tx, DECK_Y + 0.028, tz) };
    faceDir(tx - o.x, tz - o.z, 1);
    opts.onSfx && opts.onSfx('vend');
  }
  function stepCoin(dt, t) {
    if (flyCoin && flyCoin.visible) {
      const u = flyCoin.userData; u.t = Math.min(1, u.t + dt / 0.9);
      flyCoin.position.lerpVectors(u.from, u.to, u.t); flyCoin.position.y += Math.sin(u.t * Math.PI) * 1.4;
      flyCoin.rotation.x += dt * 14;
      if (u.t >= 1) {
        flyCoin.visible = false;
        addWake(u.to.x, u.to.z, true); opts.onSfx && opts.onSfx('splash');
        wishCoin.position.copy(u.to); wishCoin.rotation.set(0, 0, 0); wishCoin.visible = true;
      }
    }
    if (wishCoin.visible) coinMat.emissiveIntensity = 0.35 + Math.max(0, Math.sin(t * 2.5)) * (wishDone ? 0.6 : 0.25);
    sparkles.visible = wishDone && area.name === 'park';
    if (sparkles.visible) sparkles.children.forEach((sp, i) => { const k = (Math.sin(t * 3 + i * 1.7) + 1) / 2; sp.scale.setScalar(0.3 + k); sp.rotation.y = t + i; });
  }
  // 소원이 이루어지면 연못 위에 반짝이
  let wishDone = false;
  const sparkles = new THREE.Group(); sparkles.visible = false; scene.add(sparkles);
  { const sm = new THREE.MeshBasicMaterial({ color: '#FFE680' }), sg = new THREE.OctahedronGeometry(0.06);
    const r2 = mulberry(9);
    for (let i = 0; i < 26; i++) {
      const a = r2() * Math.PI * 2, rr = Math.sqrt(r2()) * 0.9;
      const sp = new THREE.Mesh(sg, sm); sp.position.set(POND.x + Math.cos(a) * POND.rx * rr, DECK_Y + 0.12 + r2() * 0.45, POND.z + Math.sin(a) * POND.rz * rr); sparkles.add(sp);
    } }

  // 털 때 튀는 물방울
  const dropGeo = new THREE.SphereGeometry(0.035, 6, 5), dropMat = new THREE.MeshBasicMaterial({ color: '#BFE6FF' });
  const drops = [];
  function shakeOff(a) {
    a.obj.userData.shakeT = 1.4;
    const s = a.obj.userData.scale || 1, o = a.obj.position;
    for (let i = 0; i < 16; i++) {
      let d = drops.find((k) => !k.on);
      if (!d) { if (drops.length > 64) break; d = { m: new THREE.Mesh(dropGeo, dropMat), v: new THREE.Vector3() }; scene.add(d.m); drops.push(d); }
      const ang = Math.random() * Math.PI * 2;
      d.on = true; d.t = 0; d.delay = Math.random() * 0.9; d.m.visible = false;
      d.m.position.set(o.x, o.y + (0.55 + Math.random() * 0.5) * s, o.z);
      d.v.set(Math.cos(ang) * (1.4 + Math.random()), 1.2 + Math.random() * 1.4, Math.sin(ang) * (1.4 + Math.random()));
    }
  }
  function stepDrops(dt) {
    for (const d of drops) {
      if (!d.on) continue;
      if (d.delay > 0) { d.delay -= dt; continue; }
      d.m.visible = true; d.t += dt;
      d.v.y -= 7 * dt; d.m.position.addScaledVector(d.v, dt);
      if (d.m.position.y < DECK_Y || d.t > 1) { d.on = false; d.m.visible = false; }
    }
  }
  function stepWakes(dt) {
    for (const w of wakes) {
      if (!w.on) continue;
      w.t += dt / (w.big ? 1.3 : 0.9);
      if (w.t >= 1) { w.on = false; w.m.visible = false; continue; }
      w.m.scale.setScalar(1 + w.t * (w.big ? 4.2 : 3));
      w.m.material.opacity = (w.big ? 0.85 : 0.6) * (1 - w.t);
    }
  }

  // 탈 것 (벤치 · 그네 · 시소 · 뺑뺑이): occ = 앉은 캐릭터, approach = 걸어갈 곳
  const rides = [];
  const addRide = (r) => { rides.push(r); return r; };
  // 벤치: 숲 쪽을 바라봄. 하나는 스트레칭 벤치
  const benches = [[-9.7, -2.9], [-9.7, 2.9], [-5.2, -7.4], [10.3, 0.6, true], [9.0, 4.6]];
  benches.forEach(([x, z, stretch], i) => {
    const g = new THREE.Group(); g.position.set(PX + x, DECK_Y, z);
    const rot = Math.atan2(x, z); g.rotation.y = rot;   // 숲 쪽을 바라봄 (나무 너머 하늘)
    const wood = stretch ? '#C98A5A' : '#B07A45';
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.08, 0.5), wood, { y: 0.45 }));
    g.add(mesh(new THREE.BoxGeometry(1.7, 0.38, 0.07), wood, { y: 0.78, z: -0.24 }));
    for (const lx of [-0.72, 0.72]) g.add(mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), '#5E4630', { x: lx, y: 0.22 }));
    if (stretch) {
      const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (c, w, h) => {
        c.fillStyle = '#FFF8E3'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill();
        c.fillStyle = '#6B4A2E'; c.font = `800 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🧘 스트레칭', w / 2, h / 2 + 2);
      }), transparent: true }));
      tag.position.set(0, 1.1, -0.2); g.add(tag);
    }
    scene.add(g);
    const dir = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    pObs(x, z, 1.9, 1.9);
    [-0.4, 0.4].forEach((sx, k) => {
      const side = new THREE.Vector3(Math.cos(rot), 0, -Math.sin(rot)).multiplyScalar(sx);
      const seat = P(x, DECK_Y + 0.43, z).add(side).addScaledVector(dir, 0.04);
      const r = addRide({ id: `bench${i}${'ab'[k]}`, type: 'bench', group: 'bench' + i, stretch: !!stretch, rot, dir, seat, approach: P(x, DECK_Y, z).add(side).addScaledVector(dir, 1.25), occ: null });
      g.traverse((o) => { o.userData.ride = 'bench' + i; });
      return r;
    });
  });
  // 놀이터 바닥 (모래)
  const sand = mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.03, 40), '#EAD9B0', { x: PX + 3.6, y: DECK_Y + 0.015, z: -1, cast: false, receive: true });
  scene.add(sand);
  // 그네
  const swingG = new THREE.Group(); swingG.position.set(PX + 5.0, DECK_Y, -3.3);
  for (const sx of [-1.35, 1.35]) for (const sz of [-0.5, 0.5]) {
    const post = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.3, 8), '#E2574C', { x: sx, y: 1.1, z: sz * 0.6 });
    post.rotation.x = sz * 0.45; swingG.add(post);
  }
  const topBar = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.9, 8), '#E2574C', { y: 2.15 }); topBar.rotation.z = Math.PI / 2; swingG.add(topBar);
  const swingPivots = [-0.6, 0.6].map((sx, k) => {
    const pv = new THREE.Group(); pv.position.set(sx, 2.12, 0);
    for (const cx of [-0.22, 0.22]) pv.add(mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4), '#9A9A9A', { x: cx, y: -0.8 }));
    pv.add(mesh(new THREE.BoxGeometry(0.55, 0.05, 0.28), '#4D8FD1', { y: -1.6 }));
    swingG.add(pv);
    addRide({ id: 'swing' + k, type: 'swing', group: 'swing', pivot: pv, angle: 0, approach: P(5.0 + sx, DECK_Y, -3.3 + 1.3), occ: null });
    return pv;
  });
  swingG.traverse((o) => { o.userData.ride = 'swing'; });
  scene.add(swingG); pObs(5.0, -3.3, 3.0, 1.4);
  // 미끄럼틀 (+z 쪽으로 내려옴)
  const SL = { x: 2.0, z: -3.6 };
  const slideG = new THREE.Group(); slideG.position.set(PX + SL.x, DECK_Y, SL.z);
  for (const sx of [-0.35, 0.35]) slideG.add(mesh(new THREE.BoxGeometry(0.07, 1.45, 0.07), '#F5C451', { x: sx, y: 0.72, z: -1.0 }));
  for (let k = 0; k < 4; k++) slideG.add(mesh(new THREE.BoxGeometry(0.7, 0.05, 0.08), '#F5C451', { y: 0.3 + k * 0.32, z: -1.0 }));
  slideG.add(mesh(new THREE.BoxGeometry(0.9, 0.1, 0.7), '#F5C451', { y: 1.35, z: -0.6 }));
  for (const sx of [-0.4, 0.4]) for (const sz of [-0.9, -0.3]) slideG.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.35, 6), '#E2574C', { x: sx, y: 0.67, z: sz }));
  const chute = mesh(new THREE.BoxGeometry(0.7, 0.06, 2.5), '#4D8FD1', { y: 0.82, z: 0.65 }); chute.rotation.x = 0.42; slideG.add(chute);
  for (const sx of [-0.36, 0.36]) { const rail = mesh(new THREE.BoxGeometry(0.05, 0.14, 2.5), '#3B79B8', { x: sx, y: 0.9, z: 0.65 }); rail.rotation.x = 0.42; slideG.add(rail); }
  slideG.traverse((o) => { o.userData.ride = 'slide'; });
  scene.add(slideG); pObs(SL.x, SL.z + 0.3, 1.0, 2.9);
  const slideRide = addRide({ id: 'slide', type: 'slide', group: 'slide', approach: P(SL.x, DECK_Y, SL.z - 1.6), occ: null });
  // 시소
  const seesawG = new THREE.Group(); seesawG.position.set(PX + 5.4, DECK_Y, 0.9);
  seesawG.add(mesh(new THREE.CylinderGeometry(0.16, 0.25, 0.4, 10), '#8A5A33', { y: 0.2 }));
  const beam = new THREE.Group(); beam.position.y = 0.4; seesawG.add(beam);
  beam.add(mesh(new THREE.BoxGeometry(3.2, 0.08, 0.32), '#81C784'));
  for (const sx of [-1.4, 1.4]) beam.add(mesh(new THREE.BoxGeometry(0.06, 0.32, 0.06), '#E2574C', { x: sx * 0.85, y: 0.18 }));
  seesawG.traverse((o) => { o.userData.ride = 'seesaw'; });
  scene.add(seesawG); pObs(5.4, 0.9, 3.4, 0.6);
  const seesaw = { beam, tilt: 0 };
  [-1, 1].forEach((sd, k) => addRide({ id: 'seesaw' + 'LR'[k], type: 'seesaw', group: 'seesaw', side: sd, approach: P(5.4 + sd * 1.4, DECK_Y, 0.9 + 0.85), occ: null }));
  // 뺑뺑이
  const merryG = new THREE.Group(); merryG.position.set(PX + 2.0, DECK_Y, 1.5);
  const disc = new THREE.Group(); merryG.add(disc);
  disc.add(mesh(new THREE.CylinderGeometry(1.15, 1.15, 0.12, 28), '#FF8A65', { y: 0.16 }));
  disc.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 8), '#9A9A9A', { y: 0.65 }));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    const bar = mesh(new THREE.BoxGeometry(0.05, 0.05, 1.0), '#9A9A9A', { x: Math.sin(a) * 0.5, y: 1.05, z: Math.cos(a) * 0.5 }); bar.rotation.y = a; disc.add(bar);
  }
  merryG.traverse((o) => { o.userData.ride = 'merry'; });
  scene.add(merryG); pObs(2.0, 1.5, 2.4, 2.4);
  // 뺑뺑이 속도: 탄 학생이 화면을 꾹 누르면(또는 톡톡) 점점 빨라짐. 최고 속도로 5초 넘게 돌면 어질어질
  const MERRY_BASE = 1.3, MERRY_MAX = 6.5;
  const merry = { disc, w: 0, boost: 0, maxT: 0 };
  const SLUMP_SEC = 10;
  let wasWet = false, pondTold = false, wakeT = 0;
  [0, 1, 2].forEach((k) => {
    const a = (k / 3) * Math.PI * 2 + Math.PI / 3;
    addRide({ id: 'merry' + k, type: 'merry', group: 'merry', a, approach: P(2.0 + Math.sin(a) * 1.75, DECK_Y, 1.5 + Math.cos(a) * 1.75), occ: null });
  });
  // 큰 연잎: 올라앉아 쉬기 (물 위에서 살랑살랑)
  [[-5.2, -0.5, 0.62, 0.4], [-4.4, 1.2, 0.55, -0.5]].forEach(([x, z, r, face], k) => {
    const g = new THREE.Group(); g.position.set(PX + x, DECK_Y + 0.04, z);
    const leaf = mesh(new THREE.CylinderGeometry(r, r * 0.95, 0.05, 22, 1, false, 0.35, Math.PI * 2 - 0.35), '#5DB04B', { cast: false });
    g.add(leaf);
    g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 6), '#4A9A3A', { y: 0.03, cast: false }));
    for (const [px, pz, c] of [[r * 0.55, -r * 0.35, '#FFB3C7'], [-r * 0.6, r * 0.3, '#FFFFFF']]) g.add(mesh(new THREE.SphereGeometry(0.07, 8, 6), c, { x: px, y: 0.06, z: pz, cast: false }));
    g.traverse((o) => { o.userData.ride = 'pad' + k; });
    scene.add(g);
    addRide({ id: 'pad' + k, type: 'pad', group: 'pad' + k, pad: g, face, approach: P(x + r + 0.4, DECK_Y, z + 0.15), occ: null });
  });

  // ================= 새 놀이기구 =================
  const rotd = (m, ax, v) => { m.rotation[ax] = v; return m; };
  // 🤸 트램펄린: 꾹 누르면 점점 높이, 높이 뛰면 가끔 공중제비
  const TR = { x: -5.6, z: 5.4, r: 1.15 };
  { const g = new THREE.Group(); g.position.set(PX + TR.x, DECK_Y, TR.z);
    const rim = mesh(new THREE.TorusGeometry(TR.r, 0.1, 8, 36), '#4D8FD1', { y: 0.42 }); rim.rotation.x = -Math.PI / 2; g.add(rim);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.42, 6), '#3A3A3A', { x: Math.cos(a) * TR.r, y: 0.21, z: Math.sin(a) * TR.r })); }
    g.traverse((o) => { o.userData.ride = 'tramp'; });
    scene.add(g); }
  const trampMat = mesh(new THREE.CylinderGeometry(TR.r - 0.04, TR.r - 0.04, 0.02, 36), '#2F3A44', { x: PX + TR.x, y: DECK_Y + 0.42, z: TR.z, cast: false });
  trampMat.userData.ride = 'tramp'; scene.add(trampMat);
  pObs(TR.x, TR.z, 2.4, 2.4);
  addRide({ id: 'tramp', type: 'tramp', group: 'tramp', approach: P(TR.x, DECK_Y, TR.z + 1.7), occ: null });
  const tramp = { boost: 0, ph: 0, flip: false, dip: 0 };

  // 💪 철봉 (낮은 것 · 중간 · 높은 것)
  const BAR = { x: -2.1, z: 6.0, hs: [1.15, 1.4, 1.65] };
  { const g = new THREE.Group(); g.position.set(PX + BAR.x, DECK_Y, BAR.z);
    const xs = [-1.5, -0.5, 0.5, 1.5];
    xs.forEach((x, k) => { const h = Math.max(BAR.hs[Math.max(0, k - 1)], BAR.hs[Math.min(2, k)]); g.add(mesh(new THREE.CylinderGeometry(0.06, 0.07, h + 0.05, 8), '#F5C451', { x, y: (h + 0.05) / 2 })); });
    BAR.hs.forEach((h, k) => { const b = mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 8), '#C9CED4', { x: -1 + k, y: h }); b.rotation.z = Math.PI / 2; g.add(b); });
    g.traverse((o) => { o.userData.ride = 'bar'; });
    scene.add(g); }
  pObs(BAR.x, BAR.z, 3.2, 0.5);
  BAR.hs.forEach((h, k) => addRide({ id: 'bar' + k, type: 'bar', group: 'bar', h, bx: BAR.x - 1 + k, approach: P(BAR.x - 1 + k, DECK_Y, BAR.z + 0.9), occ: null }));
  const bar = { boost: 0 };

  // 🧗 정글짐 (꼭대기 네 귀퉁이에 올라앉기)
  const JG = { x: 1.3, z: 5.2, s: 0.8, H: 1.6 };
  { const g = new THREE.Group(); g.position.set(PX + JG.x, DECK_Y, JG.z);
    const cols = ['#E2574C', '#F5C451', '#4D8FD1', '#81C784'];
    const n = [-1, 0, 1].map((i) => i * JG.s), ys = [0, JG.s, JG.H];
    for (const x of n) for (const z of n) g.add(mesh(new THREE.CylinderGeometry(0.035, 0.035, JG.H, 6), cols[(Math.abs(x) + Math.abs(z)) % 4 | 0], { x, y: JG.H / 2, z }));
    ys.slice(1).forEach((y, yi) => {
      for (const z of n) { const b = mesh(new THREE.CylinderGeometry(0.03, 0.03, JG.s * 2, 6), cols[(yi + 1) % 4], { y, z }); b.rotation.z = Math.PI / 2; g.add(b); }
      for (const x of n) { const b = mesh(new THREE.CylinderGeometry(0.03, 0.03, JG.s * 2, 6), cols[(yi + 2) % 4], { x, y }); b.rotation.x = Math.PI / 2; g.add(b); }
    });
    g.traverse((o) => { o.userData.ride = 'jungle'; });
    scene.add(g); }
  pObs(JG.x, JG.z, 1.9, 1.9);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], k) => addRide({
    id: 'jg' + k, type: 'jungle', group: 'jungle', climb: 0,
    top: P(JG.x + sx * JG.s, DECK_Y + JG.H + 0.2, JG.z + sz * JG.s), face: Math.atan2(sx, sz),
    approach: P(JG.x + sx * (JG.s + 0.75), DECK_Y, JG.z + sz * (JG.s + 0.75)), occ: null }));

  // 🐴 스프링 흔들말 (말 · 오리 · 돌고래)
  const SPRINGS = [{ x: 4.7, z: 5.9, c: '#C98A5A', k: 'horse' }, { x: 6.1, z: 6.3, c: '#F5C451', k: 'duck' }, { x: 7.5, z: 5.7, c: '#6EC1E4', k: 'dolphin' }];
  SPRINGS.forEach((sp, k) => {
    const base = new THREE.Group(); base.position.set(PX + sp.x, DECK_Y, sp.z);
    base.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.06, 14), '#8A8F96', { y: 0.03 }));
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 14), '#C9CED4', { y: 0.1 + i * 0.07 }); c.rotation.x = Math.PI / 2; base.add(c); }
    const rock = new THREE.Group(); rock.position.y = 0.36; base.add(rock);
    const body = mesh(new THREE.SphereGeometry(0.26, 14, 10), sp.c, { y: 0.14 }); body.scale.set(0.8, 0.75, 1.35); rock.add(body);
    const head = mesh(new THREE.SphereGeometry(0.17, 12, 10), sp.c, { y: sp.k === 'dolphin' ? 0.22 : 0.42, z: 0.32 }); rock.add(head);
    if (sp.k === 'horse') { for (const sx of [-0.07, 0.07]) rock.add(mesh(new THREE.ConeGeometry(0.04, 0.1, 6), sp.c, { x: sx, y: 0.6, z: 0.3 })); rock.add(mesh(new THREE.BoxGeometry(0.05, 0.2, 0.2), '#6B4A2E', { y: 0.5, z: 0.18 })); }
    if (sp.k === 'duck') rock.add(rotd(mesh(new THREE.ConeGeometry(0.06, 0.16, 8), '#F28C28', { y: 0.4, z: 0.5 }), 'x', Math.PI / 2));
    if (sp.k === 'dolphin') { const f = mesh(new THREE.ConeGeometry(0.08, 0.2, 6), sp.c, { y: 0.36, z: -0.05 }); rock.add(f); }
    for (const sx of [-0.12, 0.12]) rock.add(mesh(new THREE.SphereGeometry(0.03, 6, 6), '#2A2222', { x: sx, y: (sp.k === 'dolphin' ? 0.26 : 0.46), z: 0.46 }));
    for (const sx of [-0.2, 0.2]) rock.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 6), '#E2574C', { x: sx, y: 0.48, z: 0.2 }));   // 손잡이
    base.traverse((o) => { o.userData.ride = 'spring' + k; });
    scene.add(base); pObs(sp.x, sp.z, 0.7, 0.9);
    addRide({ id: 'spring' + k, type: 'spring', group: 'spring' + k, rock, ph: k * 1.3, approach: P(sp.x + 0.75, DECK_Y, sp.z + 0.3), occ: null });
  });

  // 🪂 짚라인: 높은 망대에서 줄에 매달려 슝
  const ZIP = { a: P(4.7, DECK_Y + 3.1, -7.6), b: P(10.4, DECK_Y + 1.75, -2.9), tower: P(4.7, DECK_Y, -7.6) };
  { const g = new THREE.Group(); g.position.copy(ZIP.tower);
    for (const sx of [-0.55, 0.55]) for (const sz of [-0.55, 0.55]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 3.4, 8), '#8A5A33', { x: sx, y: 1.7, z: sz }));
    g.add(mesh(new THREE.BoxGeometry(1.3, 0.1, 1.3), '#B98A57', { y: 2.55 }));
    for (const sx of [-0.6, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.5, 1.3), '#8A5A33', { x: sx, y: 2.85 }));
    g.add(mesh(new THREE.BoxGeometry(1.3, 0.5, 0.05), '#8A5A33', { y: 2.85, z: -0.62 }));
    g.add(rotd(mesh(new THREE.ConeGeometry(1.05, 0.6, 4), '#E2574C', { y: 3.75 }), 'y', Math.PI / 4));
    for (let i = 0; i < 8; i++) g.add(mesh(new THREE.BoxGeometry(0.5, 0.04, 0.05), '#6B4A2E', { y: 0.3 + i * 0.3, z: 0.68 }));   // 사다리
    for (const sx of [-0.25, 0.25]) g.add(mesh(new THREE.BoxGeometry(0.05, 2.6, 0.05), '#6B4A2E', { x: sx, y: 1.3, z: 0.68 }));
    g.traverse((o) => { o.userData.zip = true; });
    scene.add(g); }
  { const pole = mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.0, 8), '#8A5A33', { x: ZIP.b.x + 0.35, y: DECK_Y + 1.0, z: ZIP.b.z + 0.25 }); pole.userData.zip = true; scene.add(pole);
    const pad = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.03, 20), '#EAD9B0', { x: ZIP.b.x - 0.6, y: DECK_Y + 0.015, z: ZIP.b.z - 0.5, cast: false, receive: true }); scene.add(pad);
    const d = ZIP.b.clone().sub(ZIP.a), len = d.length();
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 5), mat('#4A4A4A'));
    cable.position.copy(ZIP.a).addScaledVector(d, 0.5); cable.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); scene.add(cable); }
  const trolley = mesh(new THREE.BoxGeometry(0.12, 0.08, 0.16), '#E2574C', { cast: false }); trolley.visible = false; scene.add(trolley);
  pObs(4.7, -7.6, 1.4, 1.3); pObs(ZIP.b.x - PX + 0.35, ZIP.b.z + 0.25, 0.3, 0.3);
  const zipRide = addRide({ id: 'zip', type: 'zip', group: 'zip', approach: P(4.7, DECK_Y, -6.5), occ: null });

  // 🎡 관람차 (시각으로 돌아서 누가 봐도 같은 모습)
  const FW = { x: -1.4, z: -7.9, r: 3.2, hub: 4.0, n: 6, period: 56 };
  const fwAngle = () => ((Date.now() / 1000) % FW.period) / FW.period * Math.PI * 2;
  const fwWheel = new THREE.Group(); fwWheel.position.set(PX + FW.x, DECK_Y + FW.hub, FW.z); scene.add(fwWheel);
  { for (const zz of [-0.35, 0.35]) {
      const rim = mesh(new THREE.TorusGeometry(FW.r, 0.06, 8, 48), '#F5F0E6', { z: zz }); fwWheel.add(rim);
      for (let k = 0; k < 12; k++) { const sp = mesh(new THREE.CylinderGeometry(0.025, 0.025, FW.r, 5), '#E8D9C0', { z: zz }); sp.rotation.z = (k / 12) * Math.PI * 2; sp.position.set(Math.sin(-sp.rotation.z) * FW.r / 2, Math.cos(sp.rotation.z) * FW.r / 2, zz); fwWheel.add(sp); }
    }
    const axle = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.0, 12), '#9AA4AE'); axle.rotation.x = Math.PI / 2; fwWheel.add(axle);
    const legs = new THREE.Group(); legs.position.set(PX + FW.x, DECK_Y, FW.z);
    for (const zz of [-0.55, 0.55]) for (const sx of [-1, 1]) {
      const l = mesh(new THREE.CylinderGeometry(0.1, 0.12, Math.hypot(1.7, FW.hub), 8), '#E2574C', { x: sx * 0.85, y: FW.hub / 2, z: zz }); l.rotation.z = sx * Math.atan2(1.7, FW.hub); legs.add(l);
    }
    legs.add(mesh(new THREE.BoxGeometry(1.9, 0.25, 0.9), '#B98A57', { y: 0.12, z: 1.1 }));   // 타는 곳
    legs.traverse((o) => { o.userData.ride = 'wheel'; }); scene.add(legs);
    fwWheel.traverse((o) => { o.userData.ride = 'wheel'; }); }
  const GONDOLA_COLORS = ['#E2574C', '#F5C451', '#81C784', '#4D8FD1', '#B39DDB', '#FF8A65'];
  const gondolas = GONDOLA_COLORS.map((c, k) => {
    const g = new THREE.Group();
    g.add(mesh(new THREE.BoxGeometry(0.95, 0.08, 0.8), c, { y: -0.45 }));
    for (const sx of [-0.45, 0.45]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.42, 0.8), c, { x: sx, y: -0.22 }));
    g.add(mesh(new THREE.BoxGeometry(0.95, 0.42, 0.05), c, { y: -0.22, z: -0.38 }));
    g.add(rotd(mesh(new THREE.ConeGeometry(0.62, 0.3, 4), c, { y: 0.38 }), 'y', Math.PI / 4));
    for (const sx of [-0.4, 0.4]) g.add(mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), '#9AA4AE', { x: sx, y: 0.05 }));
    g.traverse((o) => { o.userData.ride = 'wheel'; });
    scene.add(g);
    addRide({ id: 'wheel' + k, type: 'wheel', group: 'wheel', k, gondola: g, approach: P(FW.x, DECK_Y, FW.z + 1.9), occ: null });
    return g;
  });
  pObs(FW.x, FW.z, 3.6, 1.6);
  const gondolaAngle = (k) => fwAngle() + (k / FW.n) * Math.PI * 2;
  const gondolaPos = (k, out = new THREE.Vector3()) => { const a = gondolaAngle(k); return out.set(PX + FW.x + Math.sin(a) * FW.r, DECK_Y + FW.hub - Math.cos(a) * FW.r, FW.z + 0.0); };
  const nearBottom = (k) => { const a = ((gondolaAngle(k) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); return Math.min(a, Math.PI * 2 - a) < 0.22; };

  // 🚂 꼬마 기차 (선로를 따라 70초에 한 바퀴, 역에서 7초 쉼 · 시각으로 움직여서 누가 봐도 같은 자리)
  const TRAIN = { lap: 70, stop: 7, st: Math.PI * 0.3, cars: 4, gap: 0.15 };
  const trackPt = (th, f = 1, out = new THREE.Vector3()) => out.set(PX + Math.cos(th) * TRACK.rx * f, DECK_Y, Math.sin(th) * TRACK.rz * f);
  { // 선로: 침목 + 레일 두 줄
    const N = 260, sleeper = new THREE.BoxGeometry(0.85, 0.04, 0.12), sm = mat('#7A5530');
    for (let i = 0; i < N; i++) {
      const th = (i / N) * Math.PI * 2, p = trackPt(th), dx = -Math.sin(th) * TRACK.rx, dz = Math.cos(th) * TRACK.rz;
      const m = new THREE.Mesh(sleeper, sm); m.position.set(p.x, DECK_Y + 0.02, p.z); m.rotation.y = Math.atan2(dx, dz) + Math.PI / 2; scene.add(m);
    }
    for (const off of [-0.28, 0.28]) {
      const pts = []; for (let i = 0; i <= 200; i++) { const th = (i / 200) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(th) * (TRACK.rx + off), DECK_Y + 0.06, Math.sin(th) * (TRACK.rz + off))); }
      const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 200, 0.025, 4, true), mat('#8A8F96'));
      rail.position.x = PX; scene.add(rail);
    }
    // 역 (지붕 + 팻말)
    const sp = trackPt(TRAIN.st, 0.89), g = new THREE.Group(); g.position.copy(sp);
    const tang = Math.atan2(-Math.sin(TRAIN.st) * TRACK.rx, Math.cos(TRAIN.st) * TRACK.rz); g.rotation.y = tang;
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.18, 2.6), '#D9C7A6', { y: 0.09 }));
    for (const sz of [-1.1, 1.1]) g.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.7, 6), '#8A5A33', { x: -0.3, y: 0.95, z: sz }));
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.08, 2.9), '#E2574C', { x: -0.15, y: 1.8 }));
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (c, w, h) => {
      c.fillStyle = '#FFF8E3'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 14); c.fill();
      c.fillStyle = '#6B4A2E'; c.font = `800 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🚂 꼬마 기차역', w / 2, h / 2 + 2);
    }), transparent: true, side: THREE.DoubleSide }));
    tag.position.set(-0.3, 1.5, 0); tag.rotation.y = -Math.PI / 2; g.add(tag);
    g.traverse((o) => { o.userData.ride = 'train'; });
    scene.add(g); }
  const STATION = trackPt(TRAIN.st, 0.89);
  const trainCars = [];
  for (let i = 0; i < TRAIN.cars; i++) {
    const g = new THREE.Group();
    if (i === 0) {   // 기관차
      g.add(mesh(new THREE.BoxGeometry(0.75, 0.45, 1.2), '#E2574C', { y: 0.38 }));
      g.add(rotd(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.7, 14), '#3A3A3A', { y: 0.72, z: 0.15 }), 'x', Math.PI / 2));
      g.add(mesh(new THREE.CylinderGeometry(0.08, 0.11, 0.35, 8), '#3A3A3A', { y: 1.1, z: 0.38 }));
      g.add(mesh(new THREE.BoxGeometry(0.75, 0.6, 0.45), '#4D8FD1', { y: 0.9, z: -0.38 }));
    } else {
      const c = ['#F5C451', '#81C784', '#B39DDB'][(i - 1) % 3];
      g.add(mesh(new THREE.BoxGeometry(0.75, 0.2, 1.2), c, { y: 0.28 }));
      for (const sx of [-0.36, 0.36]) g.add(mesh(new THREE.BoxGeometry(0.04, 0.22, 1.2), c, { x: sx, y: 0.48 }));
      for (const sz of [-0.58, 0.58]) g.add(mesh(new THREE.BoxGeometry(0.75, 0.22, 0.04), c, { y: 0.48, z: sz }));
      for (const sz of [-0.28, 0.28]) g.add(mesh(new THREE.BoxGeometry(0.6, 0.12, 0.25), '#8A5A33', { y: 0.44, z: sz }));
      for (let s2 = 0; s2 < 2; s2++) addRide({ id: 'train' + ((i - 1) * 2 + s2), type: 'train', group: 'train', car: i, seatZ: s2 ? -0.28 : 0.28, approach: STATION.clone(), occ: null });
    }
    for (const sx of [-0.38, 0.38]) for (const sz of [-0.4, 0.4]) g.add(rotd(mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 12), '#2F3A44', { x: sx, y: 0.13, z: sz }), 'z', Math.PI / 2));
    g.traverse((o) => { o.userData.ride = 'train'; });
    scene.add(g); trainCars.push(g);
  }
  function trainTheta() {
    const cyc = TRAIN.lap + TRAIN.stop, tau = (Date.now() / 1000) % cyc;
    if (tau < TRAIN.stop) return { th: TRAIN.st, stopped: true, left: TRAIN.stop - tau };
    const u = (tau - TRAIN.stop) / TRAIN.lap, e = u - Math.sin(u * Math.PI * 2) / (Math.PI * 2);   // 출발·도착은 천천히
    return { th: TRAIN.st + e * Math.PI * 2, stopped: false, left: 0 };
  }
  const carPose = (th, i) => {
    const t2 = th - i * TRAIN.gap, p = trackPt(t2);
    return { p, ry: Math.atan2(-Math.sin(t2) * TRACK.rx, Math.cos(t2) * TRACK.rz) };
  };
  let trainWasStopped = true;

  // 자판기
  const vend = new THREE.Group(); vend.position.set(PX + 3.4, DECK_Y, 7.2);
  vend.add(mesh(new THREE.BoxGeometry(1.0, 1.8, 0.7), '#E2574C', { y: 0.9 }));
  vend.add(mesh(new THREE.BoxGeometry(0.75, 0.9, 0.04), mat('#CFEFFF', { emissive: '#7FC8F0', emissiveIntensity: 0.35 }), { y: 1.2, z: 0.36 }));
  ['🥤', '☕', '🧃', '🍵', '🍦', '🍪'].forEach((e, k) => {
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: emojiTex(e), transparent: true }));
    sp.position.set(-0.24 + (k % 3) * 0.24, 1.42 - Math.floor(k / 3) * 0.34, 0.385); vend.add(sp);
  });
  vend.add(mesh(new THREE.BoxGeometry(0.5, 0.15, 0.06), '#2B2B2B', { y: 0.42, z: 0.36 }));
  vend.traverse((o) => { o.userData.vend = true; });
  scene.add(vend); pObs(3.4, 7.2, 1.1, 0.8);
  const VEND_SPOT = P(3.4, DECK_Y, 8.0);
  // 나가는 길 표지판
  const parkExitSign = new THREE.Group(); parkExitSign.position.set(PX - 1.3, DECK_Y, 12.6);
  parkExitSign.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.4, 8), '#8A5A33', { y: 0.7 }));
  const pes = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), new THREE.MeshBasicMaterial({ map: canvasTex(320, 96, (c, w, h) => {
    c.fillStyle = '#FFF8E3'; c.beginPath(); c.roundRect(3, 3, w - 6, h - 6, 18); c.fill();
    c.fillStyle = '#6B4A2E'; c.font = `900 40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🏠 독서실로', w / 2, h / 2 + 2);
  }), transparent: true }));
  pes.position.set(0, 1.35, 0.05); parkExitSign.add(pes);
  parkExitSign.traverse((o) => { o.userData.parkExit = true; });
  scene.add(parkExitSign);
  // 공부방 입구의 '쉼터' 표지판
  const toPark = new THREE.Group(); toPark.position.set(-9.55, DECK_Y, 1.0);
  for (const sx of [-0.47, 0.47]) toPark.add(mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.3, 8), '#8A5A33', { x: sx, y: 0.65, z: -0.03 }));
  const tp = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.3), new THREE.MeshBasicMaterial({ map: canvasTex(320, 96, (c, w, h) => {
    c.fillStyle = '#E8F5E1'; c.beginPath(); c.roundRect(3, 3, w - 6, h - 6, 18); c.fill();
    c.fillStyle = '#3F7F3B'; c.font = `900 40px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🌿 쉼터', w / 2, h / 2 + 2);
  }), transparent: true }));
  tp.position.set(0, 1.15, 0.04); toPark.add(tp);
  toPark.traverse((o) => { o.userData.toPark = true; });
  scene.add(toPark);
  // 오솔길: 공부방 왼쪽 끝에서 숲을 지나 쉼터 입구까지 (구불구불, 길가에 돌·꽃·작은 등)
  scene.add(mesh(new THREE.BoxGeometry(0.5, 0.15, 1.6), '#C48D52', { x: -10.05, y: 0.075, z: -0.2, receive: true }));   // 계단
  // 오솔길 높이: 풀밭(0)에서 쉼터 땅(DECK_Y) 위로 자연스럽게
  const trailY = (p) => { const d = Math.hypot(p.x - PX, p.z); return 0.015 + (DECK_Y + 0.005 - 0.015) * Math.min(1, Math.max(0, (24.2 - d) / 1.6)); };
  const trail = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-10.2, 0, -0.2), new THREE.Vector3(-13, 0, 0.6), new THREE.Vector3(-16, 0, 2.6),
    new THREE.Vector3(-19.5, 0, 5.4), new THREE.Vector3(-24, 0, 9.0), new THREE.Vector3(-29, 0, 12.6),
    new THREE.Vector3(-33.5, 0, 13.8), new THREE.Vector3(PX, 0, 13.4), new THREE.Vector3(PX, 0, 12.4),
  ]);
  {
    // 흙길: 갈색 길 + 양옆 조금 더 진한 테두리 (쉼터 땅 위로 올라가는 부분은 그 높이에 맞춤)
    const ribbon = (w, color, lift) => {
      const N = 120, pos = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N, p = trail.getPointAt(t), tg = trail.getTangentAt(t);
        const side = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(w + Math.sin(i * 0.9) * 0.05);
        const y = trailY(p) + lift;
        pos.push(p.x + side.x, y, p.z + side.z, p.x - side.x, y, p.z - side.z);
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, mat(color, { side: THREE.DoubleSide })); m.receiveShadow = true;
      scene.add(m);
    };
    ribbon(0.82, '#9C7046', 0.004);   // 테두리
    ribbon(0.66, '#C69A68', 0.01);    // 길
    // 길 위 작은 자갈
    const prd = mulberry(55);
    for (let i = 0; i < 70; i++) {
      const t = prd(), p = trail.getPointAt(t), tg = trail.getTangentAt(t), o = (prd() - 0.5) * 1.0;
      scene.add(mesh(new THREE.CylinderGeometry(0.05 + prd() * 0.05, 0.06, 0.02, 6), prd() < 0.5 ? '#B08658' : '#D8B98C', { x: p.x - tg.z * o, y: trailY(p) + 0.02, z: p.z + tg.x * o, cast: false }));
    }
    const trnd = mulberry(33);
    for (let i = 0; i < 46; i++) {
      const t = 0.03 + trnd() * 0.8, p = trail.getPointAt(t), tg = trail.getTangentAt(t);
      const sd = (trnd() < 0.5 ? -1 : 1) * (0.95 + trnd() * 0.9);
      const x = p.x - tg.z * sd, z = p.z + tg.x * sd;
      if (i % 3 === 0) scene.add(mesh(new THREE.DodecahedronGeometry(0.12 + trnd() * 0.1, 0), '#B8AE9C', { x, y: 0.08, z }));
      else scene.add(mesh(fGeo, flowerColors[i % 4], { x, y: 0.1, z, cast: false }));
    }
    // 길가 나무 (양옆으로 숲 느낌) · 작은 등
    for (let i = 0; i < 14; i++) {
      const t = 0.08 + (i / 14) * 0.72, p = trail.getPointAt(t), tg = trail.getTangentAt(t);
      // 화면(카메라) 쪽인 앞쪽(+z)에는 나무를 두지 않아 걸어가는 모습이 가려지지 않게
      const d = 2.6 + trnd() * 1.8;
      const a1 = [p.x - tg.z * d, p.z + tg.x * d], a2 = [p.x + tg.z * d, p.z - tg.x * d];
      const [tx, tz] = a1[1] < a2[1] ? a1 : a2;
      if (Math.hypot(tx - PX, tz - 0.8) < 25) continue;   // 쉼터 땅 위(기차역·흔들말 앞)는 비움
      tree(tx, tz - 0.8, 0.8 + trnd() * 0.5, trnd() < 0.4);
    }
    for (const t of [0.15, 0.4, 0.65]) {
      const p = trail.getPointAt(t), tg = trail.getTangentAt(t);
      const g = new THREE.Group(); g.position.set(p.x - tg.z * 0.95, 0, p.z + tg.x * 0.95);
      g.add(mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6), '#5E4630', { y: 0.55 }));
      const lb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), bulbMat); lb.position.y = 1.12; g.add(lb);
      scene.add(g);
    }
  }

  // 흩날리는 나뭇잎 (계절 색) · 반딧불 · 별 · 별똥별
  const month = new Date().getMonth() + 1;
  const leafColor = month >= 3 && month <= 5 ? '#FFC2D6' : month >= 9 && month <= 11 ? '#F2994A' : month >= 6 ? '#7FCF63' : null;
  const LEAVES = 100;
  const leaves = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.18, 0.11), new THREE.MeshLambertMaterial({ color: leafColor || '#FFFFFF', side: THREE.DoubleSide }), LEAVES);
  const leafData = Array.from({ length: LEAVES }, () => ({ x: (Math.random() - 0.5) * 30, y: Math.random() * 7, z: (Math.random() - 0.5) * 22, s: 0.4 + Math.random() * 0.6, p: Math.random() * 10 }));
  leaves.frustumCulled = false; scene.add(leaves);
  const FLIES = 64;
  const flyPos = new Float32Array(FLIES * 3);
  const flyData = Array.from({ length: FLIES }, () => ({ x: (Math.random() - 0.5) * 28, y: 0.4 + Math.random() * 1.8, z: (Math.random() - 0.5) * 20, p: Math.random() * 10 }));
  const flyGeo = new THREE.BufferGeometry(); flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
  const flies = new THREE.Points(flyGeo, new THREE.PointsMaterial({ color: '#FFF59A', size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flies.frustumCulled = false; scene.add(flies);
  const pstarGeo = new THREE.BufferGeometry();
  const psp = [];
  for (let i = 0; i < 320; i++) psp.push(PX + (rnd() - 0.5) * 120, 16 + rnd() * 36, -20 - rnd() * 50);
  pstarGeo.setAttribute('position', new THREE.Float32BufferAttribute(psp, 3));
  const parkStars = new THREE.Points(pstarGeo, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.32 }));
  scene.add(parkStars);
  const meteorGeo = new THREE.BufferGeometry(); meteorGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const meteor = new THREE.Line(meteorGeo, new THREE.LineBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0 }));
  meteor.frustumCulled = false; scene.add(meteor);
  let meteorT = -1, meteorWait = 4, meteorFrom = new THREE.Vector3(), meteorDir = new THREE.Vector3();
  let meteorRate = 1;   // 수능 날 밤처럼 특별한 날엔 더 자주
  const dummy = new THREE.Object3D();

  function emojiTex(e) {
    return canvasTex(96, 96, (c, w, h) => { c.font = `72px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, w / 2, h / 2 + 4); });
  }
  // 손에 든 간식 (머리 옆에 작은 그림)
  function setHeldFor(a, e) {
    if (a.heldSprite) { a.obj.remove(a.heldSprite); a.heldSprite = null; }
    a.held = e || '';
    if (!e) return;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(e), transparent: true, depthWrite: false }));
    const sc = a.obj.userData.scale || 1;
    s.scale.set(0.34, 0.34, 0.34); s.position.set(0.38, 0.62 * sc + 0.1, 0.18);
    a.obj.add(s); a.heldSprite = s;
  }

  // 탈 것에 앉기 / 내리기
  let pendingRideGroup = null;
  // 누른 곳에서 가장 가까운 빈자리 (그네 오른쪽을 누르면 오른쪽 그네)
  function freeRide(group, at) {
    const list = rides.filter((r) => r.group === group && !r.occ);
    if (!at) return list[0] || null;
    const pos = (r) => (r.pivot ? new THREE.Vector3().setFromMatrixPosition(r.pivot.matrixWorld) : r.seat || r.approach);
    list.sort((a, b) => pos(a).distanceTo(at) - pos(b).distanceTo(at));
    return list[0] || null;
  }
  function tapRide(group, at) {
    if (studying || observer) return;
    if (group === 'slide') { walkTo(slideRide.approach); pendingOffice = { type: 'slide' }; return; }
    if (group === 'zip') { walkTo(zipRide.approach); pendingOffice = { type: 'zip' }; return; }
    if (player.ride && player.ride.group === group) return;
    const r = freeRide(group, at);
    if (!r) { opts.onToast && opts.onToast('친구들이 다 타고 있어요. 조금 기다려 줘!'); return; }
    walkTo(r.approach);
    pendingOffice = { type: 'ride', ride: r };
  }
  let waitRide = null;   // 기차·관람차를 기다리는 중 ('train' | 'wheel')
  function readySeat(group) {
    if (group === 'train') { const tt = trainTheta(); return tt.stopped && tt.left > 1.2 ? rides.find((x) => x.group === 'train' && !x.occ) : null; }
    if (group === 'wheel') return rides.find((x) => x.group === 'wheel' && !x.occ && nearBottom(x.k)) || null;
    return null;
  }
  function mountRide(r) {
    if (r.type === 'train' || r.type === 'wheel') {
      const seat = readySeat(r.group);
      if (!seat) {
        if (waitRide !== r.group) opts.onToast && opts.onToast(r.type === 'train' ? '🚂 기차가 역에 올 때까지 기다려요…' : '🎡 빈 칸이 내려올 때까지 기다려요…');
        waitRide = r.group; return;
      }
      r = seat;
    }
    waitRide = null;
    if (r.occ && r.occ !== player) { opts.onToast && opts.onToast('방금 친구가 탔어요'); return; }
    if (player.ride) leaveRide(true);
    r.occ = player; player.ride = r; player.mode = 'sit';
    if (r.type === 'merry') opts.onToast && opts.onToast('화면을 꾹 누르고 있으면 점점 빨라져요 🎡 · 내릴 땐 일어나기');
    if (r.type === 'tramp') { tramp.boost = 0; tramp.ph = 0; opts.onToast && opts.onToast('화면을 꾹 누르면 점점 높이 뛰어요 🤸'); }
    if (r.type === 'bar') { bar.boost = 0; opts.onToast && opts.onToast('꾹 누르면 크게 흔들흔들 💪'); }
    if (r.type === 'jungle') r.climb = 0;
    if (r.type === 'bench') { yaw = yawTarget = 0; pitchTarget = moodName === 'night' ? 0.6 : 0.3; setZoom(ZOOM_MIN); opts.onToast && opts.onToast('화면을 끌면 하늘을 둘러봐요 · 내 쪽으로 돌리면 내 모습도 보여요 📸'); }
    opts.onSfx && opts.onSfx(r.type === 'bench' ? 'sit' : 'creak');
    opts.onRide && opts.onRide(r);
  }
  function leaveRide(silent) {
    const r = player.ride;
    if (!r) return;
    if (r.occ === player) r.occ = null;
    if (r.type === 'bench') { yawTarget = 0; pitchTarget = 0.65; setZoom(11.9); }
    player.ride = null; player.stretching = false;
    if (r.type === 'train') player.obj.position.copy(player.obj.position).lerp(new THREE.Vector3(PX, DECK_Y, 0), 0.1);   // 달리는 기차에서 내리면 선로 안쪽으로
    else player.obj.position.copy(r.approach);
    player.obj.position.y = DECK_Y;
    player.obj.rotation.z = 0; player.obj.rotation.x = 0;
    player.mode = 'idle';
    if (player.dizzy) { player.slumpT = SLUMP_SEC; path = []; opts.onToast && opts.onToast('너무 어지러워서 털썩… 잠깐만 쉬었다 가요 💫'); }
    if (!silent) opts.onRide && opts.onRide(null);
  }

  // ---------- 새 놀이기구 움직임 ----------
  const _p = new THREE.Vector3();
  function stepNewRides(dt, t) {
    const holding = !!player.ride && down && !down.drag && !pinch && pointers.size === 1;
    // 기다리던 기차·관람차가 오면 타기
    if (waitRide && !player.ride) {
      const ap = waitRide === 'train' ? STATION : rides.find((x) => x.group === 'wheel').approach;
      if (Math.hypot(player.obj.position.x - ap.x, player.obj.position.z - ap.z) > 1.2) waitRide = null;
      else { const seat = readySeat(waitRide); if (seat) mountRide(seat); }
    }
    // 🤸 트램펄린
    const tr = rides.find((x) => x.type === 'tramp');
    tramp.dip = Math.max(0, tramp.dip - dt * 3);
    if (tr.occ) {
      const mine = tr.occ === player;
      if (mine) tramp.boost = holding ? Math.min(2.2, tramp.boost + dt * 0.9) : Math.max(0, tramp.boost - dt * 0.25);
      const h = mine ? 0.35 + tramp.boost : 0.7;
      const prev = tramp.ph;
      tramp.ph += dt / (0.42 + 0.42 * Math.sqrt(h));
      if (Math.floor(tramp.ph) !== Math.floor(prev)) {   // 착지
        tramp.dip = 0.12;
        tramp.flip = h > 1.5 && Math.random() < 0.45;
        if (mine) opts.onSfx && opts.onSfx('boing');
      }
      const u = tramp.ph % 1, y = h * (1 - (2 * u - 1) ** 2);
      const o = tr.occ.obj;
      if (o.rotation.order !== 'YXZ') o.rotation.order = 'YXZ';
      o.position.set(PX + TR.x, DECK_Y + 0.43 + y - tramp.dip, TR.z);
      o.rotation.y = 0;
      o.rotation.x = tramp.flip ? -u * Math.PI * 2 : 0;
      tr.occ.mode = 'jump';
    }
    trampMat.position.y = DECK_Y + 0.42 - tramp.dip * 0.6;
    // 💪 철봉: 매달려서 흔들흔들
    for (const r of rides.filter((x) => x.type === 'bar' && x.occ)) {
      const mine = r.occ === player;
      if (mine) bar.boost = holding ? Math.min(0.85, bar.boost + dt * 0.5) : Math.max(0, bar.boost - dt * 0.2);
      const amp = 0.08 + (mine ? bar.boost : 0.15);
      const a = Math.sin(t * 2.6) * amp;
      const o = r.occ.obj, L = 1.02 * (o.userData.scale || 1);
      if (o.rotation.order !== 'YXZ') o.rotation.order = 'YXZ';
      o.rotation.y = 0; o.rotation.x = a;
      o.position.set(PX + r.bx, DECK_Y + r.h - L * Math.cos(a), BAR.z - L * Math.sin(a));
      r.occ.mode = 'hang';
    }
    // 🧗 정글짐: 올라가서 꼭대기에 앉기
    for (const r of rides.filter((x) => x.type === 'jungle')) {
      if (r.occ !== r.lastOcc) { r.lastOcc = r.occ; r.climb = 0; }
      if (!r.occ) continue;
      r.climb = Math.min(1, r.climb + dt / 1.6);
      const k = r.climb, o = r.occ.obj;
      if (k < 1) {
        _p.copy(r.approach).lerp(r.top, k); _p.y = DECK_Y + (JG.H + 0.0) * Math.min(1, k * 1.15);
        o.position.copy(_p); o.rotation.y = r.face + Math.PI; r.occ.mode = 'hang';
      } else placeRider(r.occ, r.top, r.face, 'sit');
    }
    // 🐴 흔들말
    for (const r of rides.filter((x) => x.type === 'spring')) {
      const rk = r.occ ? Math.sin(t * 3.4 + r.ph) * 0.3 : r.rock.rotation.x * 0.9;
      r.rock.rotation.x = rk;
      if (r.occ) {
        r.rock.updateMatrixWorld(); _p.set(0, 0.42, -0.05).applyMatrix4(r.rock.matrixWorld);
        placeRider(r.occ, _p, 0, 'sit');
        const o = r.occ.obj; if (o.rotation.order !== 'YXZ') o.rotation.order = 'YXZ'; o.rotation.x = rk;
      }
    }
    // 🎡 관람차
    fwWheel.rotation.z = -fwAngle();
    gondolas.forEach((g, k) => { gondolaPos(k, g.position); g.position.y += 0.0; g.rotation.z = Math.sin(t * 1.3 + k) * 0.03; });
    for (const r of rides.filter((x) => x.type === 'wheel' && x.occ)) {
      gondolaPos(r.k, _p); _p.y += -0.42 + 0.2; _p.z += 0.05;
      placeRider(r.occ, _p, 0, 'sit');
    }
    // 🚂 꼬마 기차
    const tt = trainTheta();
    trainCars.forEach((g, i) => { const c = carPose(tt.th, i); g.position.copy(c.p); g.rotation.y = c.ry; });
    if (trainWasStopped && !tt.stopped && area.name === 'park') opts.onSfx && opts.onSfx('toot');
    trainWasStopped = tt.stopped;
    for (const r of rides.filter((x) => x.type === 'train' && x.occ)) {
      const g = trainCars[r.car];
      g.updateMatrixWorld(); _p.set(0, 0.62, r.seatZ).applyMatrix4(g.matrixWorld);
      placeRider(r.occ, _p, g.rotation.y, 'sit');
    }
  }
  function startZip() {
    if (player.ride) leaveRide(true);
    player.slide = { t: 0, sfx: false, zip: true };
  }
  function stepZip(dt) {
    const s = player.slide, p = player.obj.position, sc = player.obj.userData.scale || 1;
    s.t += dt;
    const L = 1.02 * sc;
    if (s.t < 1.3) {   // 사다리 올라가기
      const k = s.t / 1.3;
      p.set(ZIP.tower.x, DECK_Y + 2.6 * k, ZIP.tower.z + 0.9 - 0.9 * Math.min(1, k * 1.4));
      player.obj.rotation.y = Math.PI; player.mode = 'hang';
      return;
    }
    const RIDE = 3.0, k = Math.min(1, (s.t - 1.5) / RIDE);
    if (s.t < 1.5) { p.set(ZIP.tower.x, DECK_Y + 2.6, ZIP.tower.z); player.mode = 'idle'; faceDir(ZIP.b.x - ZIP.a.x, ZIP.b.z - ZIP.a.z, 1); return; }
    if (k < 1) {
      if (!s.sfx) { s.sfx = true; opts.onSfx && opts.onSfx('whoosh'); }
      const e = k * k * (1.6 - 0.6 * k);   // 점점 빨라짐
      _p.copy(ZIP.a).lerp(ZIP.b, e);
      trolley.visible = true; trolley.position.copy(_p); trolley.position.y += 0.03;
      p.set(_p.x, _p.y - L - 0.05, _p.z);
      faceDir(ZIP.b.x - ZIP.a.x, ZIP.b.z - ZIP.a.z, 1);
      player.obj.rotation.z = Math.sin(s.t * 9) * 0.05;
      player.mode = 'hang';
      return;
    }
    // 내려오기
    const d = Math.min(1, (s.t - 1.5 - RIDE) / 0.35);
    trolley.visible = false;
    p.set(ZIP.b.x - 0.6, (ZIP.b.y - L - 0.05) * (1 - d) + DECK_Y * d, ZIP.b.z - 0.5);
    player.obj.rotation.z = 0;
    player.mode = d < 1 ? 'hang' : 'idle';
    if (d >= 1) { if (!s.land) { s.land = true; opts.onSfx && opts.onSfx('thunk'); } if (s.t > 1.5 + RIDE + 0.6) { player.slide = null; player.mode = 'idle'; opts.onRide && opts.onRide(null); } }
  }
  function startSlide() {
    if (player.ride) leaveRide(true);
    player.slide = { t: 0, sfx: false };
    opts.onRide && opts.onRide(slideRide);
  }
  const slidePt = (lz, y) => P(SL.x, DECK_Y + y, SL.z + lz);
  function stepSlide(dt) {
    const s = player.slide;
    if (!s) return;
    if (s.zip) return stepZip(dt);
    s.t += dt;
    const p = player.obj.position;
    player.obj.rotation.y = 0;
    const lerp = (a, b, k) => a.clone().lerp(b, Math.min(1, Math.max(0, k)));
    if (s.t < 0.9) { p.copy(lerp(slidePt(-1.6, 0), slidePt(-0.6, 1.4), s.t / 0.9)); player.mode = 'walk'; }
    else if (s.t < 1.2) { p.copy(slidePt(-0.6, 1.4)); player.mode = 'sit'; }
    else if (s.t < 2.1) {
      if (!s.sfx) { s.sfx = true; opts.onSfx && opts.onSfx('whoosh'); }
      const k = (s.t - 1.2) / 0.9; p.copy(lerp(slidePt(-0.5, 1.3), slidePt(1.8, 0.32), k * k)); player.mode = 'sit';
    } else if (s.t < 2.4) { p.copy(lerp(slidePt(1.8, 0.32), slidePt(2.3, 0), (s.t - 2.1) / 0.3)); player.mode = 'idle'; }
    else { p.copy(slidePt(2.3, 0)); player.slide = null; player.mode = 'idle'; opts.onRide && opts.onRide(null); }
  }
  // 탈 것 움직이기 + 앉은 캐릭터 붙이기 (나와 친구 모두)
  let creakT = 0, thunkSide = 0;
  function placeRider(a, pos, rotY, mode) {
    a.obj.position.copy(pos);
    a.obj.position.y = pos.y - 0.2 * (a.obj.userData.scale || 1);
    a.obj.rotation.y = rotY;
    a.mode = mode;
  }
  function stepPark(dt, t) {
    // 친구가 탄 것
    for (const r of rides) if (r.occ && r.occ !== player && !(r.occ.remoteRef && r.occ.remoteRef.rd === r.id && remotes.has(r.occ.remoteRef.uid))) r.occ = null;
    for (const r of remotes.values()) {
      const want = r.a.area === 'park' && r.rd ? rides.find((x) => x.id === r.rd && x.type !== 'slide' && x.type !== 'zip') : null;
      if (r.onRide && r.onRide !== want) { if (r.onRide.occ === r.a) r.onRide.occ = null; r.onRide = null; }
      if (want && (!want.occ || want.occ === r.a)) { want.occ = r.a; r.a.remoteRef = r; r.onRide = want; }
    }
    // 그네
    for (const r of rides.filter((x) => x.type === 'swing')) {
      const target = r.occ ? Math.sin(t * 2.3 + (r.id === 'swing1' ? 1.4 : 0)) * 0.55 : 0;
      r.angle += (target - r.angle) * Math.min(1, dt * (r.occ ? 3 : 1.5));
      r.pivot.rotation.x = r.angle;
      if (r.occ) {
        const w = new THREE.Vector3(0, -1.6, 0.02).applyAxisAngle(new THREE.Vector3(1, 0, 0), r.angle);
        const base = new THREE.Vector3(); r.pivot.getWorldPosition(base);
        placeRider(r.occ, base.add(w).add(new THREE.Vector3(0, 0.03, 0)), 0, 'sit');
        r.occ.obj.rotation.x = r.angle * 0.6;
      }
    }
    // 시소
    const L = rides.find((x) => x.id === 'seesawL').occ, R = rides.find((x) => x.id === 'seesawR').occ;
    const tilt = L && R ? Math.sin(t * 1.7) * 0.26 : L ? 0.26 : R ? -0.26 : 0;
    seesaw.tilt += (tilt - seesaw.tilt) * Math.min(1, dt * 3);
    seesaw.beam.rotation.z = seesaw.tilt;
    if (L && R) { const side = Math.sign(Math.sin(t * 1.7)); if (side !== thunkSide && Math.abs(Math.sin(t * 1.7)) > 0.95) { thunkSide = side; if (L === player || R === player) opts.onSfx && opts.onSfx('thunk'); } }
    for (const r of rides.filter((x) => x.type === 'seesaw' && x.occ)) {
      const end = new THREE.Vector3(r.side * 1.32, 0.1, 0).applyAxisAngle(new THREE.Vector3(0, 0, 1), seesaw.tilt);
      placeRider(r.occ, P(5.4 + end.x, DECK_Y + 0.4 + end.y, 0.9), r.side > 0 ? -Math.PI / 2 : Math.PI / 2, 'sit');
    }
    // 뺑뺑이
    const riders = rides.filter((x) => x.type === 'merry' && x.occ);
    const onMerry = player.ride && player.ride.type === 'merry';
    const pushing = onMerry && down && !down.drag && !pinch && pointers.size === 1;
    if (!riders.length) merry.boost = 0;
    else if (pushing) merry.boost = Math.min(MERRY_MAX - MERRY_BASE, merry.boost + dt * 1.7);
    else merry.boost = Math.max(0, merry.boost - dt * 0.45);
    const want = riders.length ? MERRY_BASE + merry.boost : 0;
    merry.w += (want - merry.w) * Math.min(1, dt * (want > merry.w ? 1.6 : 0.8));
    merry.disc.rotation.y += merry.w * dt;
    if (onMerry && merry.w > MERRY_MAX * 0.93) {
      merry.maxT += dt;
      if (merry.maxT >= 5 && !player.dizzy) { player.dizzy = true; opts.onToast && opts.onToast('어질어질… 눈이 뺑글뺑글 💫'); }
    } else merry.maxT = 0;
    for (const r of riders) {
      const a = r.a + merry.disc.rotation.y;
      placeRider(r.occ, P(2.0 + Math.sin(a) * 0.75, DECK_Y + 0.22, 1.5 + Math.cos(a) * 0.75), a + Math.PI / 2, 'sit');
      r.occ.obj.rotation.z = Math.min(0.22, merry.w * 0.03);   // 빨리 돌면 바깥으로 살짝 기울어짐
    }
    // 벤치
    for (const r of rides.filter((x) => x.type === 'pad')) {
      const bob = Math.sin(t * 1.3 + (r.id === 'pad1' ? 1.7 : 0)) * 0.012 - (r.occ ? 0.02 : 0);
      r.pad.position.y = DECK_Y + 0.04 + bob;
      r.pad.rotation.y = Math.sin(t * 0.4 + (r.id === 'pad1' ? 2 : 0)) * 0.15;
      if (r.occ) placeRider(r.occ, new THREE.Vector3(r.pad.position.x, DECK_Y + 0.27 + bob, r.pad.position.z), r.face, 'sit');
    }
    stepNewRides(dt, t);
    for (const r of rides.filter((x) => x.type === 'bench' && x.occ)) placeRider(r.occ, r.seat, r.rot, r.occ === player && player.stretching ? 'stretch' : 'sit');
    // 삐걱 소리 (내가 탔을 때만, 작게)
    creakT -= dt;
    if (player.ride && (player.ride.type === 'swing' || player.ride.type === 'merry') && creakT <= 0) { creakT = player.ride.type === 'swing' ? 1.37 : Math.max(0.6, 2.2 * MERRY_BASE / Math.max(MERRY_BASE, merry.w)); opts.onSfx && opts.onSfx('creak'); }
    stepSlide(dt);
    if (area.name !== 'park') { if (fishing) stopFishing(); return; }
    // 연못: 들어갈 때 첨벙, 물속에서 움직이면 물결
    stepWakes(dt);
    stepFishing(dt, t);
    stepCoin(dt, t);
    for (const r of remotes.values()) {   // 친구 낚싯대
      const want = r.a.area === 'park' && r.fi && !r.onRide;
      if (want && !r.a.rig) makeRig(r.a); else if (!want && r.a.rig) dropRig(r.a);
      if (r.a.rig) stepRig(r.a, t);
    }
    const wet = pondDepth(player.obj.position.x, player.obj.position.z) > 0;
    if (wet && !wasWet) { addWake(player.obj.position.x, player.obj.position.z, true); opts.onSfx && opts.onSfx('splash'); if (!pondTold) { pondTold = true; opts.onToast && opts.onToast('첨벙! 연못에 들어왔어요 💦 물속에선 천천히 걸어요'); } }
    if (!wet && wasWet) { shakeOff(player); opts.onSfx && opts.onSfx('slosh'); }
    wasWet = wet;
    for (const r of remotes.values()) {   // 친구도 물에서 나오면 털기
      const w = r.a.area === 'park' && pondDepth(r.a.obj.position.x, r.a.obj.position.z) > 0;
      if (r.wet && !w) shakeOff(r.a);
      r.wet = w;
    }
    stepDrops(dt);
    wakeT -= dt;
    if (wakeT <= 0) {
      wakeT = 0.32;
      for (const a of [player, ...[...remotes.values()].map((r) => r.a)]) {
        if ((a.mode !== 'walk' && a.mode !== 'swim') || (a.area && a.area !== 'park' && a !== player)) continue;
        if (pondDepth(a.obj.position.x, a.obj.position.z) > 0) { addWake(a.obj.position.x, a.obj.position.z); if (a === player) opts.onSfx && opts.onSfx('slosh'); }
      }
    }
    // 연못 물결
    const rk = (t * 0.5) % 1;
    ripple.scale.setScalar(1 + rk * 5); ripple.material.opacity = 0.55 * (1 - rk);
    // 나뭇잎 (낮·노을, 비·눈이 아닐 때)
    leaves.visible = !!leafColor && moodName !== 'night' && weather !== 'rain' && weather !== 'snow';
    if (leaves.visible) {
      leafData.forEach((d, i) => {
        d.y -= dt * d.s * 0.6; d.x += Math.sin(t * 0.9 + d.p) * dt * 0.6 + dt * 0.25;
        if (d.y < 0.05) { d.y = 5 + Math.random() * 3; d.x = (Math.random() - 0.5) * 30; d.z = (Math.random() - 0.5) * 22; }
        dummy.position.set(PX + d.x, DECK_Y + d.y, d.z);
        dummy.rotation.set(t * d.s * 2 + d.p, t * 1.3 + d.p, Math.sin(t + d.p));
        dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
      });
      leaves.instanceMatrix.needsUpdate = true;
    }
    // 반딧불 (밤)
    flies.visible = moodName === 'night' && weather !== 'rain' && weather !== 'snow';
    if (flies.visible) {
      flyData.forEach((d, i) => {
        d.x += Math.sin(t * 0.6 + d.p) * dt * 0.4; d.z += Math.cos(t * 0.5 + d.p * 1.3) * dt * 0.4; d.y = 0.4 + (Math.sin(t * 0.7 + d.p) + 1) * 0.9;
        flyPos.set([PX + d.x, DECK_Y + d.y, d.z], i * 3);
      });
      flyGeo.attributes.position.needsUpdate = true;
      flies.material.opacity = 0.55 + Math.sin(t * 3) * 0.35;
    }
    // 별똥별 (맑은 밤)
    if (moodName === 'night' && weather === 'clear') {
      if (meteorT < 0) {
        meteorWait -= dt * meteorRate;
        if (meteorWait <= 0) {
          meteorT = 0; meteorWait = 5 + Math.random() * 9;
          meteorFrom.set(PX + (Math.random() - 0.5) * 50, 22 + Math.random() * 14, -25 - Math.random() * 20);
          meteorDir.set(-0.8 - Math.random() * 0.4, -0.45, 0.1).normalize();
        }
      } else {
        meteorT += dt;
        const k = meteorT / 0.9;
        const head = meteorFrom.clone().addScaledVector(meteorDir, k * 16);
        const tail = head.clone().addScaledVector(meteorDir, -3.2);
        meteorGeo.attributes.position.array.set([tail.x, tail.y, tail.z, head.x, head.y, head.z]);
        meteorGeo.attributes.position.needsUpdate = true;
        meteor.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.95;
        if (k >= 1) { meteorT = -1; meteor.material.opacity = 0; }
      }
    } else meteor.material.opacity = 0;
  }
  // 오솔길을 따라 걸어가는 모습 (몇 초) → 도착하면 쉼터 / 공부방으로
  let trailWalk = null;   // { t, back }
  const TRAIL_SEC = 4.2;
  function startTrailWalk(back) {
    path = []; pendingSeat = null; pendingBot = null; pendingOffice = null;
    trailWalk = { t: 0, back: !!back };
    opts.onTrail && opts.onTrail(true);
  }
  function stepTrailWalk(dt) {
    if (!trailWalk) return false;
    trailWalk.t += dt;
    const k = Math.min(1, trailWalk.t / TRAIL_SEC);
    const u = trailWalk.back ? 1 - k : k;
    const pt = trail.getPointAt(u), tg = trail.getTangentAt(u);
    const p = player.obj.position;
    p.set(pt.x, trailY(pt) + 0.01, pt.z);
    const dir = trailWalk.back ? -1 : 1;
    faceDir(tg.x * dir, tg.z * dir, dt * 2);
    player.mode = 'walk';
    if (k >= 1) {
      const back = trailWalk.back;
      trailWalk = null;
      opts.onTrail && opts.onTrail(false);
      if (back) { p.set(-8.4, DECK_Y, -0.2); player.mode = 'idle'; }
      else { switchArea('park', PARK_ENTRY.clone(), Math.PI); opts.onSfx && opts.onSfx('step'); }
    }
    return true;
  }
  function enterPark() {
    if (observer) { switchArea('park', PARK_ENTRY.clone(), Math.PI); return; }
    startTrailWalk(false);
  }
  function exitPark() {
    if (player.ride) leaveRide(true); player.slide = null;
    if (observer) { switchArea('main', new THREE.Vector3(-8.4, DECK_Y, -0.2), Math.PI / 2); return; }
    const end = trail.getPointAt(1);
    switchArea('main', new THREE.Vector3(end.x, DECK_Y, end.z), 0);
    startTrailWalk(true);
  }
  function goToPark() {
    if (area.name === 'park') return;
    if (area.name === 'office') { exitOffice(); }
    if (player.seat) standUp();
    if (observer || Math.hypot(player.obj.position.x - MAIN_PARK_PORTAL.x, player.obj.position.z - MAIN_PARK_PORTAL.z) < 0.6) return enterPark();
    walkTo(MAIN_PARK_PORTAL);
    pendingOffice = { type: 'park' };
  }
  function goOutOfPark() {
    if (area.name !== 'park') return;
    if (observer) return exitPark();
    if (player.ride) leaveRide(true);
    walkTo(PARK_EXIT);
    pendingOffice = { type: 'park-exit' };
  }

  // ---------------- 상호작용 (오른쪽 단추 · E/스페이스 키) ----------------
  let interaction = null, interactKey = '', interactT = 0;
  const RIDE_NAME = { swing: ['🎠', '그네 타기'], seesaw: ['⚖️', '시소 타기'], merry: ['🎡', '뺑뺑이 타기'], slide: ['🛝', '미끄럼틀 타기'], pad: ['🍃', '연잎에 앉기'], tramp: ['🤸', '트램펄린'], bar: ['💪', '철봉 매달리기'], jungle: ['🧗', '정글짐 오르기'], spring: ['🐴', '흔들말 타기'], zip: ['🪂', '짚라인 타기'], wheel: ['🎡', '관람차 타기'], train: ['🚂', '꼬마 기차 타기'] };
  function findInteraction() {
    if (studying || trailWalk || player.slide || observer) return null;
    const p = player.obj.position;
    const near = (v, r) => Math.hypot(p.x - v.x, p.z - v.z) < r;
    if (player.ride) return { key: 'stand', icon: '🚶', label: '일어나기', run: () => leaveRide() };
    if (area.name === 'main') {
      if (player.seat) return null;
      if (nearDoor === 'enter') return { key: 'office', icon: '🏫', label: '교무실 들어가기', run: () => goToOffice() };
      if (nearDoor === 'park') return { key: 'park', icon: '🌿', label: '쉼터 가기', run: () => goToPark() };
      if (nearDoor === 'board') return { key: 'board', icon: '📌', label: '응원 게시판', run: () => opts.onSpot && opts.onSpot('board') };
      if (nearDoor === 'suggest') return { key: 'suggest', icon: '📮', label: '건의함', run: () => opts.onSpot && opts.onSpot('suggest') };
      let best = null, bd = 1.5;
      for (const st of seats) { const d = Math.hypot(p.x - st.approach.x, p.z - st.approach.z); if (!st.occupant && d < bd) { bd = d; best = st; } }
      if (best) return { key: 'seat' + best.idx, icon: '🪑', label: `${seatName(best.idx)} 앉기`, run: () => walkToSeat(best.idx) };
      return null;
    }
    if (area.name === 'office') {
      if (nearBot) { const b = bots.find((x) => x.id === nearBot); return { key: 'bot' + nearBot, icon: '🐾', label: `${b ? b.name : ''}에게 질문`, run: () => opts.onBot && opts.onBot(nearBot) }; }
      if (nearDoor === 'exit') return { key: 'exit', icon: '🚪', label: '나가기', run: () => goOutOfOffice() };
      return null;
    }
    if (area.name === 'park') {
      if (nearDoor === 'vend') return { key: 'vend', icon: '🥤', label: '간식 고르기', run: () => opts.onVend && opts.onVend() };
      if (nearDoor === 'park-exit') return { key: 'pexit', icon: '🏠', label: '독서실로', run: () => goOutOfPark() };
      if (fishing) return { key: 'fishstop', icon: '🎣', label: '낚시 그만하기', run: () => stopFishing() };
      if (near(FISH_SPOT, 1.4)) return { key: 'fish', icon: '🎣', label: '과학 낚시', run: () => { walkTo(FISH_SPOT); pendingOffice = { type: 'fish' }; } };
      { const q = pondQ(p.x, p.z);
        if (q > 1 && q < 1.7 && !onPier(p.x, p.z)) return { key: 'wish', icon: '🪙', label: '소원 동전', run: () => opts.onWish && opts.onWish() }; }
      let best = null, bd = 1.9;
      for (const r of rides) {
        if (r.occ) continue;
        const d = Math.hypot(p.x - r.approach.x, p.z - r.approach.z);
        if (d < bd) { bd = d; best = r; }
      }
      if (!best) return null;
      const [icon, label] = best.type === 'bench' ? [best.stretch ? '🧘' : '🪑', best.stretch ? '스트레칭 벤치' : '벤치에 앉기'] : RIDE_NAME[best.type];
      return { key: 'ride' + best.id, icon, label, run: () => (best.type === 'slide' || best.type === 'zip' ? (walkTo(best.approach), (pendingOffice = { type: best.type })) : (walkTo(best.approach), (pendingOffice = { type: 'ride', ride: best }))) };
    }
    return null;
  }
  function interact() {
    const it = interaction || findInteraction();
    if (it) { it.run(); interactT = 0; }
  }

  // ---------------- 길찾기 (격자 A*) ----------------
  const GS = 0.25;
  const R = 0.28;
  const blocked = (x, z, ignore) => area.obs.some((o) => o !== ignore && x > o.x0 - R && x < o.x1 + R && z > o.z0 - R && z < o.z1 + R);
  // 서 있는 다른 친구들: 몸이 겹치지 않을 만큼만 (너무 넓으면 책상 사이 지나가기 불편)
  const FR = 0.5;
  const standingOthers = () => actors.filter((a) => a !== player && !a.seat && a.obj.visible && !(a.el && a.el.classList.contains('hidden'))
    && (a.area || 'main') === area.name);
  const nearFriend = (x, z, list) => (list || standingOthers()).some((a) => Math.hypot(a.obj.position.x - x, a.obj.position.z - z) < FR);
  // 친구에게 더 가까워지는 걸음만 막음 (이미 겹쳐 있으면 빠져나올 수 있게)
  const friendStops = (x0, z0, x1, z1) => standingOthers().some((a) => {
    const ax = a.obj.position.x, az = a.obj.position.z;
    const d1 = Math.hypot(ax - x1, az - z1);
    return d1 < FR && d1 < Math.hypot(ax - x0, az - z0);
  });
  function findPath(from, to) {
    const B = area.bounds;
    const GW = Math.round((B.x1 - B.x0) / GS) + 1;
    const GH = Math.round((B.z1 - B.z0) / GS) + 1;
    const ci = (x, z) => [Math.round((x - B.x0) / GS), Math.round((z - B.z0) / GS)];
    let [sx, sz] = ci(from.x, from.z);
    let [tx, tz] = ci(to.x, to.z);
    const key = (x, z) => z * GW + x;
    const others = standingOthers();
    const free = (x, z) => x >= 0 && z >= 0 && x < GW && z < GH && !blocked(B.x0 + x * GS, B.z0 + z * GS) && !nearFriend(B.x0 + x * GS, B.z0 + z * GS, others);
    // 책상·책장 위를 눌렀으면 그 옆 빈 곳까지만 걸어감 (물건을 뚫고 가지 않음)
    const nearestFree = (cx, cz) => {
      for (let r = 1; r <= 10; r++) {
        let best = null, bd = Infinity;
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r || !free(cx + dx, cz + dz)) continue;
          const d = Math.hypot(dx, dz);
          if (d < bd) { bd = d; best = [cx + dx, cz + dz]; }
        }
        if (best) return best;
      }
      return null;
    };
    let goal = to.clone();
    if (!free(tx, tz)) {
      const nf = nearestFree(tx, tz);
      if (!nf) return [];
      [tx, tz] = nf;
      goal = new THREE.Vector3(B.x0 + tx * GS, DECK_Y, B.z0 + tz * GS);
    }
    // 물건에 끼어 있는 곳에서 출발하면 가장 가까운 빈 곳부터
    let lead = null;
    if (!free(sx, sz)) {
      const nf = nearestFree(sx, sz);
      if (!nf) return [];
      [sx, sz] = nf;
      lead = new THREE.Vector3(B.x0 + sx * GS, DECK_Y, B.z0 + sz * GS);
    }
    const open = [[sx, sz]];
    const g = new Map([[key(sx, sz), 0]]);
    const came = new Map();
    const fsc = new Map([[key(sx, sz), Math.hypot(tx - sx, tz - sz)]]);
    let guard = 0;
    while (open.length && guard++ < 30000) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fsc.get(key(...open[i])) < fsc.get(key(...open[bi]))) bi = i;
      const [cx, cz] = open.splice(bi, 1)[0];
      if (cx === tx && cz === tz) {
        const pts = [];
        let k = key(cx, cz);
        while (came.has(k)) {
          pts.unshift(new THREE.Vector3(B.x0 + (k % GW) * GS, DECK_Y, B.z0 + Math.floor(k / GW) * GS));
          k = came.get(k);
        }
        pts.push(goal);
        return lead ? [lead].concat(smooth(lead, pts)) : smooth(from, pts);
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = cx + dx, nz = cz + dz;
        if (!free(nx, nz)) continue;
        if (dx && dz && (!free(cx + dx, cz) || !free(cx, cz + dz))) continue;
        const ng = g.get(key(cx, cz)) + Math.hypot(dx, dz);
        const nk = key(nx, nz);
        if (ng < (g.get(nk) ?? Infinity)) {
          g.set(nk, ng);
          came.set(nk, key(cx, cz));
          fsc.set(nk, ng + Math.hypot(tx - nx, tz - nz));
          if (!open.some(([ox, oz]) => ox === nx && oz === nz)) open.push([nx, nz]);
        }
      }
    }
    return [];
  }
  function lineFree(a, b) {
    const n = Math.ceil(a.distanceTo(b) / 0.1);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t;
      if (blocked(x, z) || nearFriend(x, z)) return false;
    }
    return true;
  }
  function smooth(from, pts) {
    const out = [];
    let cur = from.clone();
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !lineFree(cur, pts[j])) j--;
      out.push(pts[j]);
      cur = pts[j];
      i = j + 1;
    }
    return out;
  }

  function walkTo(target) {
    if (studying || trailWalk) return;
    if (player.slumpT > 0) { opts.onToast && opts.onToast('아직 어지러워요… 💫 조금만 기다려 줘'); return; }
    if (fishing) stopFishing();
    waitRide = null;
    if (player.seat || player.officeDesk || player.ride) standUp();
    path = findPath(player.obj.position, target);
  }
  // ---------------- 다른 학생들 (실시간, Firebase) ----------------
  const remotes = new Map();   // uid → { a, info, target, seatIdx }
  let observer = false;        // 선생님: 캐릭터 없이 구경하는 시점
  const hashN = (str) => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); };
  function removeActor(a) {
    scene.remove(a.obj);
    a.el.remove();
    const i = actors.indexOf(a);
    if (i >= 0) actors.splice(i, 1);
  }
  function freeSeat(seat) {
    seat.occupant = null;
    drawSeatTag(seat, '');
    clearCushions(seat);
    seat.bulb.material.emissiveIntensity = 0;
  }
  function hideNpc(n) {
    if (n.hidden) return;
    n.hidden = true;
    n.obj.visible = false;
    n.el.classList.add('hidden');
    if (n.seat && n.seat.occupant === n) freeSeat(n.seat);
    n.seat = null;
  }
  function showNpc(n) {
    const seat = seats[n.homeSeat];
    if (!n.hidden || seat.occupant) return;
    n.hidden = false;
    n.obj.visible = true;
    n.el.classList.remove('hidden');
    sitActor(n, seat);
    n.mode = 'study';
    seat.bulb.material.emissiveIntensity = 1.4;
  }
  function unseatRemote(r) {
    if (r.seatIdx >= 0) {
      const seat = seats[r.seatIdx];
      if (seat && seat.occupant === r.a) freeSeat(seat);
      r.a.seat = null;
      r.seatIdx = -1;
    }
  }
  function removeRemote(uid) {
    const r = remotes.get(uid);
    if (!r) return;
    unseatRemote(r);
    removeActor(r.a);
    remotes.delete(uid);
  }
  const fmtMin = (ms) => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
  function remoteLabel(r) {
    const x = r.info;
    const live = x.st && !x.ps;
    const ms = (x.el || 0) + (live ? Date.now() - r.at : 0);
    const status = live ? `📚 ${x.sj || '공부'} 열공 중 · ${fmtMin(ms)}` : x.st ? '☕ 쉬는 중' : '';
    setLabel(r.a, { name: x.n, status, goal: x.gl });
  }
  setInterval(() => remotes.forEach(remoteLabel), 5000);
  /**
   * 다른 학생들: [{ uid, n(닉네임), a(동물), x, z, ry, s(자리, -1), ar('main'|'office'), sj(과목), st(공부 중), ps(쉬는 중), el(공부 ms) }]
   */
  function setRemotePlayers(list) {
    const now = Date.now();
    const seen = new Set();
    for (const x of list || []) {
      seen.add(x.uid);
      let r = remotes.get(x.uid);
      if (r && r.info.a !== x.a) { removeRemote(x.uid); r = null; }
      if (!r) {
        const a = addActor(x.a || 'bear', CLOTHES[hashN(x.uid) % CLOTHES.length], { name: x.n });
        a.remote = true;
        a.obj.traverse((o) => { o.userData.remoteUid = x.uid; o.userData.remoteNick = x.n; });
        a.obj.position.set(Number(x.x) || 0, DECK_Y, Number(x.z) || 6);
        r = { a, info: x, target: new THREE.Vector3(), ry: 0, seatIdx: -1 };
        remotes.set(x.uid, r);
      }
      r.info = x;
      r.at = now;
      r.a.area = x.ar === 'office' || x.ar === 'park' ? x.ar : 'main';
      r.rd = typeof x.rd === 'string' ? x.rd.slice(0, 12) : '';
      r.a.dizzy = x.dz === 1;
      r.fi = x.fi === 1;
      r.uid = x.uid;
      if ((x.it || '') !== (r.a.held || '')) setHeldFor(r.a, typeof x.it === 'string' ? x.it.slice(0, 4) : '');
      r.a.obj.traverse((o) => { o.userData.remoteNick = x.n; });
      const wantSeat = r.a.area === 'main' && x.s >= 0 && seats[x.s] ? x.s : -1;
      if (wantSeat !== r.seatIdx) {
        unseatRemote(r);
        if (wantSeat >= 0) {
          const seat = seats[wantSeat];
          if (seat.occupant && seat.occupant.npc) hideNpc(seat.occupant);
          r.a.dday = typeof x.dd === 'string' ? x.dd.slice(0, 16) : '';
          if (!seat.occupant) { sitActor(r.a, seat); r.seatIdx = wantSeat; }
        }
      }
      if (r.seatIdx >= 0) {
        const dd = typeof x.dd === 'string' ? x.dd.slice(0, 16) : '';
        if (dd !== (r.a.dday || '')) { r.a.dday = dd; drawSeatTag(seats[r.seatIdx], dd); }
        const live = x.st && !x.ps;
        r.a.mode = live ? 'study' : 'sit';
        seats[r.seatIdx].bulb.material.emissiveIntensity = live ? 1.4 : 0;
      } else {
        r.target.set(Number(x.x) || 0, DECK_Y, Number(x.z) || 0);
        r.ry = Number(x.ry) || 0;
        // 다른 공간에서 넘어왔으면 바로 그 자리로
        if (r.a.obj.position.distanceTo(r.target) > 6) r.a.obj.position.copy(r.target);
      }
      remoteLabel(r);
    }
    for (const uid of [...remotes.keys()]) if (!seen.has(uid)) removeRemote(uid);
    // 분위기용 친구들: 진짜 친구가 3명 이상이면 쉬고, 진짜 친구가 그 자리에 앉으면 비켜 줌
    const many = [...remotes.values()].filter((r) => r.a.area === 'main').length >= 3;
    const taken = new Set([...remotes.values()].map((r) => r.seatIdx));
    for (const n of actors.filter((a) => a.npc)) {
      if (many || taken.has(n.homeSeat)) hideNpc(n);
      else showNpc(n);
    }
  }
  /** 다른 학생들 걸음 (받은 위치로 부드럽게) */
  function stepRemotes(dt) {
    for (const r of remotes.values()) {
      r.a.obj.visible = r.a.area === area.name;
      if (r.seatIdx >= 0 || r.onRide) { r.a.obj.rotation.x = 0; continue; }
      r.a.obj.rotation.z = 0;
      const p = r.a.obj.position;
      const d = Math.hypot(r.target.x - p.x, r.target.z - p.z);
      if (d > 0.04) {
        const step = Math.min(d, Math.max(3 * animalSpeed(r.info.a) * dt, d * dt * 4));
        p.x += ((r.target.x - p.x) / d) * step;
        p.z += ((r.target.z - p.z) / d) * step;
        r.a.mode = 'walk';
        const want = Math.atan2(r.target.x - p.x, r.target.z - p.z);
        let diff = Math.atan2(Math.sin(want - r.a.obj.rotation.y), Math.cos(want - r.a.obj.rotation.y));
        r.a.obj.rotation.y += diff * Math.min(1, dt * 10);
      } else {
        r.a.mode = r.a.dizzy && r.a.area === 'park' ? 'slump' : 'idle';
        let diff = Math.atan2(Math.sin(r.ry - r.a.obj.rotation.y), Math.cos(r.ry - r.a.obj.rotation.y));
        r.a.obj.rotation.y += diff * Math.min(1, dt * 6);
      }
      const swim = r.a.area === 'park' && r.a.mode !== 'slump' && pondDepth(p.x, p.z) > SWIM_DEPTH;
      const rMoving = r.a.mode === 'walk';
      if (swim) r.a.mode = 'swim';
      const lift = swimPose(r.a, swim, rMoving, dt);
      p.y = swim ? DECK_Y + lift : (r.a.mode === 'slump' ? DECK_Y - 0.2 * (r.a.obj.userData.scale || 1) : DECK_Y) - sinkAt(r.a);
    }
  }
  /** 응원 이모지: 머리 위에 잠깐 떠오름 (uid가 null이면 나) */
  function showFx(uid, emoji) {
    const a = uid ? remotes.get(uid)?.a : player;
    if (!a) return;
    const el = document.createElement('div');
    el.className = 'fx-pop';
    el.textContent = emoji;
    a.el.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }
  /** 실시간으로 나눌 내 상태 */
  function getPlayerState() {
    const p = player.obj.position;
    return { x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, ry: Math.round(player.obj.rotation.y * 100) / 100, ar: area.name, s: area.name === 'main' && player.seat ? player.seat.idx : -1,
      rd: player.ride ? player.ride.id : player.slide ? (player.slide.zip ? 'zip' : 'slide') : '', it: player.held || '', dz: player.dizzy ? 1 : 0, fi: fishing ? 1 : 0 };
  }
  /** 선생님: 캐릭터 없이 구경 (화면은 보이지 않는 시점을 따라 움직임) */
  function setObserver(on) {
    observer = !!on;
    if (observer && (player.seat || player.officeDesk || player.ride)) standUp();
    player.obj.visible = !observer;
    player.el.classList.toggle('hidden', observer);
    document.body.classList.toggle('observer', observer);
  }
  // 선생님(구경): 학생 따라가기 — 화면을 끌면 멈춤
  let follow = null;   // { uid, onStop }
  function startFollow(uid, onStop) { if (!observer || !remotes.has(uid)) return false; follow = { uid, onStop }; return true; }
  function stopFollow(why) { const f = follow; follow = null; if (f && f.onStop) f.onStop(why || 'stop'); }
  function stepFollow(dt) {
    if (!follow) return;
    const r = remotes.get(follow.uid);
    if (!observer || !r) return stopFollow('gone');
    if ((r.a.area || 'main') !== area.name) return stopFollow(r.a.area === 'office' ? 'office' : 'main');
    const seat = r.seatIdx >= 0 ? seats[r.seatIdx] : null;
    const t = seat ? seat.approach : r.a.obj.position;
    const p = player.obj.position;
    const k = Math.min(1, dt * 4);
    p.x += (t.x - p.x) * k;
    p.z += (t.z - p.z) * k;
  }
  // 화면 조이스틱 (x: 오른쪽 +, y: 아래 +, 길이 0~1)
  const stick = { x: 0, y: 0 };
  function setStick(x, y) { stick.x = x || 0; stick.y = y || 0; }

  function walkToSeat(idx) {
    pendingBot = null;
    const seat = seats[idx];
    if (!seat || (seat.occupant && seat.occupant !== player)) return false;
    if (player.seat === seat) return true;
    if (observer) { walkTo(seat.approach); return true; } // 구경 중에는 앉지 않고 가까이 가서 보기
    walkTo(seat.approach);
    pendingSeat = seat;
    return true;
  }
  function nearestFreeSeat() {
    let best = null, bd = Infinity;
    for (const s of seats) {
      if (s.occupant) continue;
      const d = s.approach.distanceTo(player.obj.position);
      if (d < bd) { bd = d; best = s; }
    }
    return best ? best.idx : -1;
  }
  function standUp() {
    if (player.ride) { leaveRide(); return; }
    if (player.officeDesk) {
      const d = player.officeDesk;
      player.officeDesk = null;
      player.obj.position.set(d.chairPos.x + 1.15, DECK_Y, d.chairPos.z);
      player.mode = 'idle';
      return;
    }
    if (!player.seat) return;
    const s = player.seat;
    s.occupant = null;
    clearCushions(s);
    s.bulb.material.emissiveIntensity = 0;
    player.seat = null;
    drawSeatTag(s, '');
    player.obj.position.copy(s.approach);
    player.mode = 'idle';
    myLabel();
    deskLight.intensity = 0;
    opts.onStand && opts.onStand();
  }
  function myLabel() { setLabel(player, { name: teacherLook ? `${teacherLook.name} 선생님` : baseName, status: baseStatus, goal: teacherLook ? '' : baseGoal }); }
  function sitDown(seat) {
    sitActor(player, seat);
    myLabel();
    opts.onSit && opts.onSit(seat.idx);
  }
  function setStudying(on) {
    studying = on;
    if (!player.seat) return;
    player.mode = on ? 'study' : 'sit';
    player.seat.bulb.material.emissiveIntensity = on ? 1.6 : 0;
    deskLight.position.set(player.seat.chairPos.x + 0.3, DECK_Y + 1.2, player.seat.chairPos.z + player.seat.f * 0.9);
    deskLight.intensity = on ? 2.2 : 0;
  }

  // ---------------- 교무실 오가기 ----------------
  const PORTAL = new THREE.Vector3(OFFICE_PORTAL.x, DECK_Y, OFFICE_PORTAL.z);
  const EXIT_SPOT = new THREE.Vector3(OX, DECK_Y, 4.0);
  function switchArea(name, pos, rotY) {
    if (player.seat || player.officeDesk || player.ride) standUp();
    area = areas[name];
    path = [];
    pendingSeat = null; pendingBot = null; pendingOffice = null;
    player.obj.position.copy(pos);
    player.obj.rotation.y = rotY;
    yaw = yawTarget = 0;
    camPos.set(pos.x, pos.y + Math.sin(pitch) * zoom, pos.z + Math.cos(pitch) * zoom);
    camLook.set(pos.x, pos.y + 0.8, pos.z);
    opts.onArea && opts.onArea(name);
  }
  const enterOffice = () => switchArea('office', new THREE.Vector3(OFFICE_ENTRY.x, DECK_Y, OFFICE_ENTRY.z), Math.PI);
  const exitOffice = () => switchArea('main', new THREE.Vector3(OFFICE_PORTAL.x - 0.6, DECK_Y, OFFICE_PORTAL.z), -Math.PI / 2);
  function goToOffice() {
    if (studying) return;
    if (area.name === 'office') return;
    if (!officeOpen && opts.confirmClosedOffice && !opts.confirmClosedOffice()) return;
    if (Math.hypot(player.obj.position.x - PORTAL.x, player.obj.position.z - PORTAL.z) < 0.5) return enterOffice();
    walkTo(PORTAL);
    pendingOffice = { type: 'enter' };
  }
  function goOutOfOffice() {
    if (area.name !== 'office') return;
    walkTo(EXIT_SPOT);
    pendingOffice = { type: 'exit' };
  }
  function sitAtDesk(desk) {
    player.officeDesk = desk;
    player.obj.position.set(desk.chairPos.x, DECK_Y + 0.195, desk.chairPos.z + 0.05);
    player.obj.rotation.y = 0;
    player.mode = 'sit';
  }
  function tapDesk(n) {
    const desk = officeDesks[n - 1];
    if (!desk) return;
    const mine = desk.teacher && myTeacherId && desk.teacher.id === myTeacherId;
    pendingSeat = null; pendingBot = null;
    if (mine) {
      walkTo(new THREE.Vector3(desk.chairPos.x + 1.15, DECK_Y, desk.chairPos.z));
      pendingOffice = { type: 'sit', desk };
    } else {
      walkTo(desk.visit);
      pendingOffice = { type: 'desk', desk };
    }
  }

  // ---------------- 입력 ----------------
  let yaw = 0, yawTarget = 0;
  // 카메라: 캐릭터를 중심으로 돌기(yaw), 내려다보는 각도(pitch), 거리(zoom)
  let pitch = 0.65, pitchTarget = 0.65;
  let zoom = 11.9, zoomTarget = 11.9;
  const ZOOM_MIN = 2.6, ZOOM_MAX = 20;
  const setZoom = (z) => { zoomTarget = clamp(z, ZOOM_MIN, ZOOM_MAX); };
  const pointers = new Map();
  let pinch = null;
  const keys = new Set();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      // 두 손가락: 확대·축소 (선생님은 비틀어서 돌리기도)
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomTarget, ang: Math.atan2(b.y - a.y, b.x - a.x), yaw: yawTarget };
      down = null;
      return;
    }
    // 선생님(구경 시점)은 지도 앱처럼: 왼쪽 끌기 = 화면 옮기기, 오른쪽 끌기(또는 Ctrl+끌기) = 돌리기
    const pan = observer && e.button !== 2 && !e.ctrlKey && !e.metaKey;
    const p0 = player.obj.position;
    down = { x: e.clientX, y: e.clientY, yaw: yawTarget, pitch: pitchTarget, drag: false, pan, fx: p0.x, fz: p0.z };
  });
  // 선생님 화면에서는 오른쪽 클릭 메뉴 대신 돌리기
  el.addEventListener('contextmenu', (e) => { if (observer) e.preventDefault(); });
  window.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 10) setZoom(pinch.zoom * (pinch.d / d));
      if (observer) {
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        yawTarget = pinch.yaw - (ang - pinch.ang);
      }
      return;
    }
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { if (!down.drag && down.pan && follow) stopFollow(); down.drag = true; }
    if (down.drag && down.pan) {
      // 손바닥으로 끌듯이 화면 옮기기: 끈 방향으로 바닥이 따라옴
      // 화면 1픽셀이 바닥에서 몇 칸인지 (끈 손가락에 바닥이 붙어 움직이게)
      const k = (2 * zoom * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, container.clientHeight);
      const ky = k / Math.max(0.35, Math.sin(pitch));   // 위아래는 비스듬히 보이는 만큼 더
      const c = Math.cos(yaw), sn = Math.sin(yaw);
      const B = area.bounds;
      path = []; pendingSeat = null; pendingBot = null; pendingOffice = null;
      player.obj.position.x = clamp(down.fx - dx * c * k - dy * sn * ky, B.x0 - 2, B.x1 + 2);
      player.obj.position.z = clamp(down.fz + dx * sn * k - dy * c * ky, B.z0 - 2, B.z1 + 2);
    } else if (down.drag && !studying) {
      // 끌면 캐릭터를 중심으로 360° 돌아보기 (가로: 빙글, 세로: 높낮이)
      yawTarget = down.yaw - dx * 0.008;
      pitchTarget = clamp(down.pitch + dy * 0.005, 0.12, 1.35);
    }
  });
  const endPointer = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  };
  window.addEventListener('pointercancel', endPointer);
  el.addEventListener('wheel', (e) => { e.preventDefault(); setZoom(zoomTarget * (1 + Math.sign(e.deltaY) * 0.12)); }, { passive: false });
  window.addEventListener('pointerup', (e) => {
    const wasPinch = !!pinch || pointers.size > 1;
    endPointer(e);
    if (wasPinch) { down = null; return; }
    if (!down) return;
    const wasDrag = down.drag;
    down = null;
    if (wasDrag || e.target !== el || studying || trailWalk) return;
    if (player.ride && player.ride.type === 'merry') { merry.boost = Math.min(MERRY_MAX - MERRY_BASE, merry.boost + 0.35); return; }   // 톡톡 = 밀기
    if (player.ride && player.ride.type === 'tramp') { tramp.boost = Math.min(2.2, tramp.boost + 0.3); return; }
    if (player.ride && player.ride.type === 'bar') { bar.boost = Math.min(0.85, bar.boost + 0.15); return; }
    if (player.ride && (player.ride.type === 'wheel' || player.ride.type === 'train')) return;   // 타는 중엔 화면을 눌러도 안 내림 (일어나기 단추로)
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(scene.children, true);
    for (const h of hits) {
      const ud = h.object.userData;
      if (ud.officeDoor) { goToOffice(); return; }
      if (ud.spot) { opts.onSpot && opts.onSpot(ud.spot); return; }   // 응원 게시판 · 건의함
      if (ud.ride) { tapRide(ud.ride, h.point); return; }                       // 쉼터: 벤치 · 그네 · 시소 · 뺑뺑이 · 미끄럼틀
      if (ud.vend) { if (Math.hypot(player.obj.position.x - VEND_SPOT.x, player.obj.position.z - VEND_SPOT.z) < 0.6) { opts.onVend && opts.onVend(); } else { walkTo(VEND_SPOT); pendingOffice = { type: 'vend' }; } return; }
      if (ud.parkExit) { goOutOfPark(); return; }
      if (ud.zip) { tapRide('zip'); return; }
      if (ud.fishSpot) { if (!fishing) { walkTo(FISH_SPOT); pendingOffice = { type: 'fish' }; } return; }
      if (ud.toPark) { goToPark(); return; }
      if (ud.officeExit) { goOutOfOffice(); return; }
      if (ud.officeSeat) { tapDesk(ud.officeSeat); return; }
      if (ud.botId) { tapBot(ud.botId); return; }  // 챗봇: 가까우면 바로, 멀면 걸어가서 말 걸기
      if (ud.remoteUid) {
        // 진짜 친구: 선생님은 말 걸기, 학생은 응원 보내기
        const r = remotes.get(ud.remoteUid);
        if (r && r.a.obj.visible) { opts.onRemoteTap && opts.onRemoteTap(ud.remoteUid, r.info); return; }
      }
      const s = h.object.userData.seat;
      if (s != null) {
        const occ = seats[s].occupant;
        if (occ && occ !== player) {
          if (occ.remote) { const e = [...remotes.entries()].find(([, x]) => x.a === occ); if (e) { opts.onRemoteTap && opts.onRemoteTap(e[0], e[1].info); return; } }
          opts.onToast && opts.onToast('다른 친구가 공부 중인 자리예요 🤫');
          return;
        }
        walkToSeat(s);
        return;
      }
      if (h.object === deck || h.object === grass || h.object === rug || h.object === rug2 || h.object === officeFloor || h.object === parkGround || h.object === pond || h.object === pathRing || h.object === sand || h.object === entryPath) {
        const p = h.point;
        const B = area.bounds;
        const t = new THREE.Vector3(clamp(p.x, B.x0, B.x1), DECK_Y, clamp(p.z, B.z0, B.z1));
        pendingSeat = null;
        pendingBot = null;
        pendingOffice = null;
        walkTo(t);
        return;
      }
    }
  });
  window.addEventListener('keydown', (e) => { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());

  // ---------------- 크기 & 루프 ----------------
  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + 'px';
    renderer.domElement.style.height = h + 'px';
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 52 : 40;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let moodName = '';
  // ---------------- 날씨 (실제 날씨에 맞춰: clear | cloudy | rain | snow) ----------------
  let weather = 'clear';
  const grey = (hex, k) => '#' + new THREE.Color(hex).lerp(new THREE.Color('#8E99A6'), k).getHexString();
  const PRECIP_N = 1400;
  const precipPos = new Float32Array(PRECIP_N * 6);   // 빗줄기는 선 두 점, 눈은 첫 점만 씀
  const precipSeed = new Float32Array(PRECIP_N);
  for (let i = 0; i < PRECIP_N; i++) {
    precipSeed[i] = Math.random();
    const x = (Math.random() - 0.5) * 34, y = Math.random() * 14, z = (Math.random() - 0.5) * 28 + 1;
    precipPos.set([x, y, z, x, y + 0.45, z], i * 6);
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(precipPos, 3));
  const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: '#BFD8F2', transparent: true, opacity: 0.55 }));
  rain.frustumCulled = false; rain.visible = false;
  scene.add(rain);
  const snowPos = new Float32Array(PRECIP_N * 3);
  for (let i = 0; i < PRECIP_N; i++) snowPos.set([precipPos[i * 6], precipPos[i * 6 + 1], precipPos[i * 6 + 2]], i * 3);
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ color: '#FFFFFF', size: 0.13, transparent: true, opacity: 0.95, depthWrite: false }));
  snow.frustumCulled = false; snow.visible = false;
  scene.add(snow);
  let wTime = 0;
  function stepWeather(dt) {
    wTime += dt;
    if (rain.visible) {
      const a = rainGeo.attributes.position.array;
      for (let i = 0; i < PRECIP_N; i++) {
        const o = i * 6;
        let y = a[o + 1] - dt * (14 + precipSeed[i] * 6);
        if (y < 0) y += 14;
        a[o + 1] = y; a[o + 4] = y + 0.45;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }
    if (snow.visible) {
      const a = snowGeo.attributes.position.array;
      for (let i = 0; i < PRECIP_N; i++) {
        const o = i * 3;
        let y = a[o + 1] - dt * (0.7 + precipSeed[i] * 0.6);
        if (y < 0) y += 14;
        a[o + 1] = y;
        a[o] += Math.sin(wTime * 0.8 + precipSeed[i] * 20) * dt * 0.25;   // 살랑살랑
      }
      snowGeo.attributes.position.needsUpdate = true;
    }
  }
  function setWeather(kind) {
    kind = ['clear', 'cloudy', 'rain', 'snow'].includes(kind) ? kind : 'clear';
    if (kind === weather) return;
    weather = kind;
    const m0 = moodName; moodName = null; applyMood(m0);   // 하늘·빛을 날씨에 맞게 다시
  }

  function applyMood(name) {
    if (name === moodName) return;
    moodName = name;
    const md = MOODS[name];
    const k = weather === 'clear' ? 0 : weather === 'cloudy' ? 0.55 : 0.7;   // 흐릴수록 하늘이 회색으로
    scene.background = skyTexture(grey(md.top, k), grey(md.bottom, k * 0.8));
    scene.fog = new THREE.Fog(grey(md.fog, k), weather === 'clear' ? 28 : 20, 70);
    sun.color.set(md.sun);
    sun.intensity = md.sunI * (weather === 'clear' ? 1 : weather === 'cloudy' ? 0.55 : 0.45);
    hemi.intensity = md.hemi * (weather === 'clear' ? 1 : 0.9);
    rain.visible = weather === 'rain';
    snow.visible = weather === 'snow';
    hemi.groundColor.set(md.ground);
    bulbMat.emissiveIntensity = md.bulbs;
    stars.visible = parkStars.visible = name === 'night' && weather === 'clear';
    clouds.forEach((c) => (c.visible = name !== 'night'));
    grass.material.color.set(name === 'night' ? '#5E8A6A' : '#9BD67A');
  }
  applyMood(moodFor(new Date().getHours()));

  const camPos = new THREE.Vector3(0, 9, 16);
  const camLook = new THREE.Vector3();
  const v = new THREE.Vector3();
  const clock = new THREE.Clock();
  let moodCheck = 0;

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    moodCheck += dt;
    if (moodCheck > 30) { moodCheck = 0; applyMood(moodFor(new Date().getHours())); }

    stepFollow(dt);
    stepWeather(dt);
    // 키보드 이동
    let kx = 0, kz = 0;
    if (keys.has('w') || keys.has('arrowup')) kz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) kz += 1;
    if (keys.has('a') || keys.has('arrowleft')) kx -= 1;
    if (keys.has('d') || keys.has('arrowright')) kx += 1;
    let mag = 1;
    if (!kx && !kz && (stick.x || stick.y)) { kx = stick.x; kz = stick.y; mag = Math.min(1, Math.hypot(kx, kz)); }
    const p = player.obj.position;
    let moving = false;
    const walkingTrail = stepTrailWalk(dt);
    if (walkingTrail) { kx = kz = 0; }
    if (player.slumpT > 0) {
      player.slumpT -= dt;
      kx = kz = 0;
      if (player.slumpT <= 0) { player.slumpT = 0; player.dizzy = false; }
    }
    if ((kx || kz) && !studying && !player.slide) {
      if (follow) stopFollow();
      if (player.seat || player.officeDesk || player.ride) standUp();
      path = [];
      pendingSeat = null;
      pendingBot = null;
      pendingOffice = null;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const dx = kx * c + kz * s, dz = -kx * s + kz * c;
      const len = Math.hypot(dx, dz);
      moveStep(dx / len, dz / len, dt * (mag < 0.35 ? 0.45 : mag));
      moving = true;
    } else if (path.length && !player.slide && !walkingTrail) {
      const target = path[0];
      v.subVectors(target, p);
      v.y = 0;
      const d = v.length();
      if (d < 0.08) {
        path.shift();
        if (!path.length && pendingBot) {
          const bot = bots.find((x) => x.id === pendingBot);
          pendingBot = null;
          if (bot) {
            faceDir(bot.obj.position.x - p.x, bot.obj.position.z - p.z, 1);
            opts.onBot && opts.onBot(bot.id);
          }
        }
        if (!path.length && pendingOffice) {
          const po = pendingOffice;
          pendingOffice = null;
          if (po.type === 'enter') enterOffice();
          else if (po.type === 'exit') exitOffice();
          else if (po.type === 'park') enterPark();
          else if (po.type === 'park-exit') exitPark();
          else if (po.type === 'ride') mountRide(po.ride);
          else if (po.type === 'slide') startSlide();
          else if (po.type === 'zip') startZip();
          else if (po.type === 'vend') { faceDir(0, -1, 1); opts.onVend && opts.onVend(); }
          else if (po.type === 'fish') startFishing();
          else if (po.type === 'sit') sitAtDesk(po.desk);
          else if (po.type === 'desk') {
            faceDir(0, -1, 1);
            opts.onOfficeSeat && opts.onOfficeSeat(po.desk.n, po.desk.teacher);
          }
        }
        if (!path.length && pendingSeat) {
          const sTarget = pendingSeat;
          pendingSeat = null;
          if (!sTarget.occupant) sitDown(sTarget);
        }
      } else {
        const step = Math.min(d, 3 * playerSpeed() * dt);
        const nx = p.x + (v.x / d) * step, nz = p.z + (v.z / d) * step;
        if (friendStops(p.x, p.z, nx, nz)) {
          // 친구가 길을 막으면 잠깐 기다렸다가 돌아가는 길을 다시 찾음
          waitT += dt;
          if (waitT > 0.6) {
            waitT = 0;
            const goal = path[path.length - 1];
            const np = findPath(p, goal);
            if (np.length) path = np; else { path = []; pendingSeat = null; pendingBot = null; pendingOffice = null; }
          }
        } else {
          waitT = 0;
          p.x = nx;
          p.z = nz;
          moving = true;
        }
        faceDir(v.x, v.z, dt);
      }
    }
    if (!player.seat && !player.officeDesk && !player.ride && !player.slide && !walkingTrail) {
      const swim = area.name === 'park' && !(player.slumpT > 0) && pondDepth(p.x, p.z) > SWIM_DEPTH;
      player.mode = player.slumpT > 0 ? 'slump' : swim ? 'swim' : moving ? 'walk' : 'idle';
      const lift = swimPose(player, swim, moving, dt);
      p.y = swim ? DECK_Y + lift : (player.slumpT > 0 ? DECK_Y - 0.2 * (player.obj.userData.scale || 1) : DECK_Y) - sinkAt(player);
    } else if (player.obj.rotation.x) {
      player.obj.rotation.x = 0;
    }
    // 뭉치 박사 근처인지 (하단 '질문' 버튼 표시용)
    let nb = null;
    if (area.name === 'office' && !player.officeDesk) for (const bt of bots) if (Math.hypot(p.x - bt.obj.position.x, p.z - bt.obj.position.z) < 2.1 && (!nb || Math.abs(p.x - bt.obj.position.x) < 1.3)) nb = bt.id;
    if (nb !== nearBot) { nearBot = nb; opts.onNearBot && opts.onNearBot(nb); }
    // 교무실 문 근처인지
    const door = area.name === 'main'
      ? (player.seat ? null
        : Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < 1.4 ? 'enter'
        : Math.hypot(p.x - BOARD_POS.x, p.z - (BOARD_POS.z + 0.7)) < 1.7 ? 'board'
        : Math.hypot(p.x - BOX_POS.x, p.z - (BOX_POS.z + 0.7)) < 1.2 ? 'suggest'
        : Math.hypot(p.x - MAIN_PARK_PORTAL.x, p.z - MAIN_PARK_PORTAL.z) < 1.2 ? 'park' : null)
      : area.name === 'park'
      ? (player.ride || player.slide ? null
        : Math.hypot(p.x - PARK_EXIT.x, p.z - PARK_EXIT.z) < 1.4 ? 'park-exit'
        : Math.hypot(p.x - VEND_SPOT.x, p.z - VEND_SPOT.z) < 1.2 ? 'vend' : null)
      : (Math.hypot(p.x - EXIT_SPOT.x, p.z - EXIT_SPOT.z) < 1.3 ? 'exit' : null);
    if (door !== nearDoor) { nearDoor = door; opts.onNearDoor && opts.onNearDoor(door); }
    // 상호작용 단추: 가까이 있는 것 하나 (0.2초마다)
    interactT -= dt;
    if (interactT <= 0) {
      interactT = 0.2;
      const it = findInteraction();
      const key = it ? it.key : '';
      if (key !== interactKey) { interactKey = key; interaction = it; opts.onInteract && opts.onInteract(it ? { icon: it.icon, label: it.label } : null); }
      else interaction = it;
    }

    stepRemotes(dt);
    stepPark(dt, t);
    stepBanner(t);
    for (const a of actors) if (!a.fixed) { a.obj.userData.dizzy = !!a.dizzy; animateAnimal(a.obj, a.mode, t + a.obj.userData.phase, dt); }
    for (const av of officeSitters.values()) animateAnimal(av, 'study', t + av.userData.phase, dt);
    clouds.forEach((c, i) => { c.position.x += dt * (0.3 + i * 0.05); if (c.position.x > 40) c.position.x = -40; });

    // 카메라
    yaw += (yawTarget - yaw) * Math.min(1, dt * 6);
    pitch += (pitchTarget - pitch) * Math.min(1, dt * 6);
    zoom += (zoomTarget - zoom) * Math.min(1, dt * 6);
    // 벤치에 앉으면 하늘을 올려다보는 '멍 때리기' 시점
    const bench = player.ride && player.ride.type === 'bench' && !observer ? player.ride : null;
    const close = studying && player.seat;
    if (bench) {
      // 벤치: 끌면 좌우로 둘러보고 위아래로 하늘을 올려다봐요, 확대·축소는 거리
      const h = bench.rot + yaw;
      const e = clamp(pitch - 0.05, 0.05, 1.3);            // 올려다보는 각도 (아래로 끌면 하늘 쪽으로)
      const look = new THREE.Vector3(Math.sin(h) * Math.cos(e), Math.sin(e), Math.cos(h) * Math.cos(e));
      // 내 캐릭터를 가운데 두고 빙 도는 3인칭 시점: 앞쪽을 보면 하늘·숲, 내 쪽으로 돌리면 앉은 내 모습 (사진 찍기 좋게)
      const ud = player.obj.userData, headY = (ud.height || 1.4) * (ud.scale || 1) * 0.8;
      const target = bench.seat.clone().add(new THREE.Vector3(0, headY, 0));
      const d = clamp((zoom - ZOOM_MIN) * 0.7 + 2.0, 2.0, 9);
      const eye = target.clone().addScaledVector(look, -d);
      eye.y = Math.max(eye.y, DECK_Y + 0.35);
      camPos.lerp(eye, Math.min(1, dt * 4));
      // 앞을 볼 땐 먼 하늘을, 내 쪽으로 돌리면 내 캐릭터를 화면 가운데에
      const ahead = 0.6 + 5.4 * Math.max(0, Math.cos(yaw));
      camLook.lerp(target.clone().addScaledVector(look, ahead), Math.min(1, dt * 4));
    } else {
      const sc = player.obj.userData.scale || 1;
      // 가까이 볼수록 캐릭터 얼굴 높이를 바라봄 (작은 동물도 잘 보이게)
      const zt = clamp((zoom - ZOOM_MIN) / (6 - ZOOM_MIN), 0, 1);
      const lookY = (0.15 + 0.55 * sc) * (1 - zt) + 0.8 * zt;
      const focus = close ? v.set(player.seat.chairPos.x, DECK_Y + 0.8, player.seat.chairPos.z + player.seat.f * 0.5) : v.set(p.x, p.y + lookY, p.z);
      const cy = close ? (player.seat.f > 0 ? Math.PI : 0) : yaw;
      const dist = close ? 2.2 : Math.cos(pitch) * zoom;
      const hgt = close ? 2.9 : Math.sin(pitch) * zoom;
      const desired = new THREE.Vector3(focus.x + Math.sin(cy) * dist, focus.y + hgt, focus.z + Math.cos(cy) * dist);
      camPos.lerp(desired, Math.min(1, dt * (observer ? 9 : 3)));
      camLook.lerp(focus, Math.min(1, dt * (observer ? 10 : 4)));
    }
    camera.position.copy(camPos);
    camera.lookAt(camLook);

    renderer.render(scene, camera);

    // 이름표
    const w = container.clientWidth, h = container.clientHeight;
    for (const a of actors) {
      v.copy(a.obj.position);
      const ud = a.obj.userData;
      v.y += (ud.height || 1.4) * (ud.scale || 1) * (a.mode === 'sit' || a.mode === 'study' ? 0.92 : 1) + 0.12;
      v.project(camera);
      const here = (a.me && !observer) || (!a.me && (a.area || 'main') === area.name);
      const vis = here && !a.el.classList.contains('hidden') && v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && !close;
      a.el.style.display = vis ? '' : 'none';
      if (vis) {
        // 화면 가장자리에서 이름표가 잘리지 않게 안쪽으로 붙임
        const half = (a.el.offsetWidth || 0) / 2;
        const px = Math.max(half + 6, Math.min(w - half - 6, ((v.x + 1) / 2) * w));
        a.el.style.transform = `translate(-50%, -100%) translate(${px}px, ${((1 - v.y) / 2) * h}px)`;
      }
    }
    requestAnimationFrame(tick);
  }

  function moveStep(dx, dz, dt) {
    const p = player.obj.position;
    const sp = 3 * playerSpeed() * dt;
    const B = area.bounds;
    const nx = clamp(p.x + dx * sp, B.x0, B.x1);
    if (!blocked(nx, p.z) && !friendStops(p.x, p.z, nx, p.z)) p.x = nx;
    const nz = clamp(p.z + dz * sp, B.z0, B.z1);
    if (!blocked(p.x, nz) && !friendStops(p.x, p.z, p.x, nz)) p.z = nz;
    faceDir(dx, dz, dt);
  }
  function faceDir(dx, dz, dt) {
    const target = Math.atan2(dx, dz);
    let diff = target - player.obj.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    player.obj.rotation.y += diff * Math.min(1, dt * 12);
  }

  requestAnimationFrame(tick);

  return {
    seats,
    walkToSeat,
    nearestFreeSeat,
    standUp,
    setStudying,
    seatName,
    restoreSeat(idx) {
      const seat = seats[idx];
      if (!seat || seat.occupant) return false;
      sitDown(seat);
      camPos.set(seat.chairPos.x, 3, seat.chairPos.z - seat.f * 3);
      return true;
    },
    /** 선생님 로그인: { animal, color, glasses, name } / 로그아웃: null */
    setTeacherLook(look) {
      teacherLook = look || null;
      this.setPlayer({ animal: baseAnimal, name: baseName, status: baseStatus, force: true });
    },
    zoomBy(f) { setZoom(zoomTarget * f); },
    resetView() { yawTarget = 0; pitchTarget = 0.65; setZoom(11.9); },
    setPlayer({ animal, name, status, goal, force }) {
      if (animal) baseAnimal = animal;
      if (name !== undefined) { baseName = name; baseStatus = status; }
      if (goal !== undefined) baseGoal = goal;
      const look = teacherLook;
      const want = look ? look.animal || 'bear' : baseAnimal;
      const key = look ? `t:${want}:${look.color}:${look.glasses ? 1 : 0}` : `s:${want}`;
      if (force || key !== player.lookKey) {
        player.lookKey = key;
        animal = want;
        const old = player.obj;
        const fresh = look ? makeAnimal(want, look.color || '#B79CE8', { glasses: !!look.glasses, teacher: true }) : makeAnimal(want, CLOTHES[0]);
        fresh.position.copy(old.position);
        fresh.rotation.copy(old.rotation);
        scene.remove(old);
        scene.add(fresh);
        player.obj = fresh;
        player.animal = animal;
        if (player.seat) {
          const seat = player.seat;
          const mode = player.mode;
          clearCushions(seat);
          sitActor(player, seat);
          player.mode = mode;
        }
        if (player.officeDesk) sitAtDesk(player.officeDesk);
        player.obj.visible = !observer;
      }
      setLabel(player, { name: look ? `${look.name} 선생님` : baseName, status: baseStatus, goal: look ? '' : baseGoal });
    },
    walkToBot: tapBot,
    /** 내 D-day 문구 (앉은 책상 이름표에 보여요) */
    setMyDday(t) { player.dday = t || ''; if (player.seat) drawSeatTag(player.seat, player.dday); },
    setBanner,
    // 쉼터
    goToPark,
    interact,
    tapRide,
    goOutOfPark,
    fishResult,
    stopFishing,
    get fishing() { return !!fishing; },
    throwCoin,
    setWishCoin(on) { wishCoin.visible = !!on; },
    setWishDone(on) { wishDone = !!on; if (on) wishCoin.visible = true; },
    get onRide() { return player.ride ? player.ride.type : player.slide ? 'slide' : null; },
    get rideIsStretch() { return !!(player.ride && player.ride.stretch); },
    setStretch(on) { player.stretching = !!on; },
    setHeld(e) { player.held = e || ''; setHeldFor(player, player.held); },
    get held() { return player.held || ''; },
    /** 냠냠: 손에 든 간식이 입 쪽으로 오며 작아지다가 사라짐 */
    eatHeld(done) {
      const sp = player.heldSprite;
      if (!sp) { done && done(); return; }
      const t0 = performance.now(), s0 = sp.scale.x, p0 = sp.position.clone();
      const ud = player.obj.userData, mouth = new THREE.Vector3(0, (ud.height || 1.4) * 0.62, 0.35);
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / 1800);
        sp.position.lerpVectors(p0, mouth, Math.min(1, k * 2));
        const bite = 1 - Math.floor(k * 4) / 4;           // 네 입에 나눠 먹기
        sp.scale.setScalar(s0 * Math.max(0.05, bite) * (1 + Math.sin(k * 40) * 0.04));
        if (k < 1) requestAnimationFrame(step);
        else { player.held = ''; setHeldFor(player, ''); done && done(); }
      };
      step();
    },
    setMeteorRate(k) { meteorRate = k || 1; },
    /** 사진 찍기: 지금 화면을 그린 캔버스 (이름표는 따로 그림) */
    capture() { renderer.render(scene, camera); return renderer.domElement; },
    setWeather,
    get weather() { return weather; },
    startFollow,
    stopFollow: () => stopFollow(),
    get following() { return follow ? follow.uid : null; },
    /** 접속 중 목록에서 '찾아가기': 학생은 걸어가고, 선생님(구경)은 그곳으로 시점을 옮김 */
    goToRemote(uid) {
      const r = remotes.get(uid);
      if (!r) return 'gone';
      if ((r.a.area || 'main') !== area.name) return r.a.area === 'office' ? 'office' : 'main';
      const seat = r.seatIdx >= 0 ? seats[r.seatIdx] : null;
      const p = seat ? seat.approach : r.a.obj.position;
      if (observer) { player.obj.position.set(p.x, DECK_Y, p.z); return 'ok'; }
      walkTo(seat ? seat.approach.clone() : new THREE.Vector3(p.x, DECK_Y, p.z + 0.7));
      return 'ok';
    },
    setStick,
    walkTo: (x, z) => walkTo(new THREE.Vector3(x, DECK_Y, z)),
    // 교무실
    goToOffice,
    goOutOfOffice,
    enterOffice,
    setOfficeSeats,
    setOfficeOpen,
    setRemotePlayers,
    showFx,
    getPlayerState,
    setObserver,
    get observer() { return observer; },
    get view() { return { yaw: yawTarget, pitch: pitchTarget, zoom: zoomTarget, x: player.obj.position.x, z: player.obj.position.z }; },
    setTeacher(id) { myTeacherId = id || null; officeDesks.forEach((d) => { d.teacher = { ...(d.teacher || {}), _force: Math.random() }; }); },
    sitAtMyDesk() {
      const desk = officeDesks.find((d) => d.teacher && d.teacher.id === myTeacherId);
      if (desk && area.name === 'office') tapDesk(desk.n);
    },
    get area() { return area.name; },
    get nearDoor() { return nearDoor; },
    setBoardNotes,
    get nearBot() { return nearBot; },
    get seated() { return player.seat ? player.seat.idx : -1; },
  };
}

export function seatName(i) {
  const row = 'ABCD'[i % ROWS.length];
  return `${row}-${String(Math.floor(i / ROWS.length) + 1).padStart(2, '0')}`;
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
