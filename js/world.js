// 3D 숲속 독서실 — 둥글고 아기자기한 로우폴리 스타일 (외부 그림 파일 없이 코드로 생성)
import * as THREE from '../vendor/three.module.min.js';
import { makeAnimal, animateAnimal, animalSpeed } from './animals.js';
export { makeAnimal };

const FONT = '"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "WenQuanYi Zen Hei", sans-serif';
const DECK_Y = 0.3;
const BOUNDS = { x0: -9.2, x1: 9.2, z0: -6.4, z1: 7.4 };
// 교무실 실내는 같은 장면의 먼 곳(x=60)에 만들고, 들어가면 그곳으로 이동
const OX = 60;
const OFFICE_BOUNDS = { x0: OX - 5.7, x1: OX + 5.7, z0: -3.3, z1: 4.0 };
const OFFICE_DESKS = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) OFFICE_DESKS.push({ x: OX - 5 + c * 2.5, z: r === 0 ? -2.0 : 1.0 });
const OFFICE_ENTRY = { x: OX, z: 3.5 };
const OFFICE_PORTAL = { x: 9.0, z: -0.2 }; // 공부방 쪽 교무실 문 앞
const COLS = [-6, -2, 2, 6];
const ROWS = [-3.6, -0.4, 2.8];

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
  pot(-9, -5.6); pot(9, -5.6); pot(-9, 6.8, 0.9); pot(9, 6.8, 0.9); pot(-9, 0.6, 0.8); pot(9, 0.6, 0.8);

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
  COLS.forEach((x) => ROWS.forEach((z) => {
    const g = new THREE.Group();
    g.position.set(x, DECK_Y, z);
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
    const tagTex = canvasTex(128, 64, (c, w, h) => {
      c.fillStyle = '#FFF8E3'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 18); c.fill();
      c.fillStyle = '#7A4E28'; c.font = `800 38px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(seatName(seats.length), w / 2, h / 2 + 2);
    });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), new THREE.MeshBasicMaterial({ map: tagTex, transparent: true }));
    tag.position.set(0, 1.0, -0.42);
    g.add(tag);

    const idx = seats.length;
    g.traverse((o) => { o.userData.seat = idx; });
    scene.add(g);
    seats.push({ idx, group: g, bulb, chairPos: new THREE.Vector3(x, DECK_Y, z + 0.82), approach: new THREE.Vector3(x, DECK_Y, z + 1.45), occupant: null });
    addObs(x, z, 1.9, 1.05);
    addObs(x, z + 0.82, 0.6, 0.55);
  }));

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
    tree(x, z, 0.9 + rnd() * 0.6, rnd() < 0.35);
  }
  const flowerColors = ['#FFFFFF', '#FF9EB5', '#FFE066', '#B39DFF'];
  const fGeo = new THREE.SphereGeometry(0.09, 6, 6);
  for (let i = 0; i < 160; i++) {
    const x = (rnd() - 0.5) * 50, z = (rnd() - 0.5) * 44;
    if (Math.abs(x) < 10.5 && z > -7.5 && z < 9) continue;
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
  function setLabel(a, { name, status }) {
    a.el.innerHTML = (a.me ? '<b class="me-dot">나</b>' : '') + `<span>${esc(name)}</span>` + (status ? `<small>${esc(status)}</small>` : '');
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

  function sitActor(a, seat) {
    seat.occupant = a;
    a.seat = seat;
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
    a.obj.position.z += -0.05 + Math.max(0, sc - 1) * 0.3;
    a.obj.rotation.y = Math.PI;
    a.mode = 'sit';
  }
  function clearCushions(seat) {
    if (seat.cushions) { seat.group.remove(seat.cushions); seat.cushions = null; }
  }

  const player = addActor(opts.animal || 'bear', CLOTHES[0], { name: opts.name || '' }, true);
  player.animal = opts.animal || 'bear';
  player.lookKey = 's:' + player.animal;
  let teacherLook = null;
  let baseAnimal = player.animal, baseName = opts.name || '', baseStatus = '';
  const playerSpeed = () => animalSpeed(player.animal);
  player.obj.position.set(0, DECK_Y, 6.2);
  player.obj.rotation.y = Math.PI;
  let path = [];
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
  post.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), '#8A5A33', { y: 0.6 }));
  const arrow = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.38), new THREE.MeshLambertMaterial({ map: signTexture('교무실 →'), transparent: true }));
  arrow.position.y = 1.1;
  post.add(arrow);
  const arrowClosed = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.6), closedSign.material);
  arrowClosed.position.y = 1.15;
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

  // ---------------- 길찾기 (격자 A*) ----------------
  const GS = 0.25;
  const R = 0.28;
  const blocked = (x, z, ignore) => area.obs.some((o) => o !== ignore && x > o.x0 - R && x < o.x1 + R && z > o.z0 - R && z < o.z1 + R);
  function findPath(from, to) {
    const B = area.bounds;
    const GW = Math.round((B.x1 - B.x0) / GS) + 1;
    const GH = Math.round((B.z1 - B.z0) / GS) + 1;
    const ci = (x, z) => [Math.round((x - B.x0) / GS), Math.round((z - B.z0) / GS)];
    const [sx, sz] = ci(from.x, from.z);
    const [tx, tz] = ci(to.x, to.z);
    const key = (x, z) => z * GW + x;
    const free = (x, z) => x >= 0 && z >= 0 && x < GW && z < GH && !blocked(B.x0 + x * GS, B.z0 + z * GS);
    if (!free(tx, tz)) return [to.clone()];
    const open = [[sx, sz]];
    const g = new Map([[key(sx, sz), 0]]);
    const came = new Map();
    const fsc = new Map([[key(sx, sz), Math.hypot(tx - sx, tz - sz)]]);
    let guard = 0;
    while (open.length && guard++ < 6000) {
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
        pts.push(to.clone());
        return smooth(from, pts);
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
    return [to.clone()];
  }
  function lineFree(a, b) {
    const n = Math.ceil(a.distanceTo(b) / 0.1);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
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
    if (studying) return;
    if (player.seat || player.officeDesk) standUp();
    path = findPath(player.obj.position, target);
  }
  // ---------------- 다른 학생들 (자리 공유) ----------------
  const remotes = new Map();   // 자리 번호 → { sid, animal, a, info, at }
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
  function removeRemote(k) {
    const r = remotes.get(k);
    if (!r) return;
    if (r.a.seat && r.a.seat.occupant === r.a) freeSeat(r.a.seat);
    removeActor(r.a);
    remotes.delete(k);
  }
  const fmtMin = (ms) => { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
  function remoteLabel(r) {
    const x = r.info;
    const live = x.studying && !x.paused;
    const ms = x.elapsed + (live ? Date.now() - r.at : 0);
    const status = live ? `📚 ${x.subj || '공부'} 열공 중 · ${fmtMin(ms)}` : x.studying ? '☕ 쉬는 중' : '🪑 자리에 앉음';
    setLabel(r.a, { name: x.nick, status });
  }
  setInterval(() => remotes.forEach(remoteLabel), 5000);
  /** 서버에서 받은 다른 학생들 자리: [{ seat, sid, nick, animal, subj, studying, paused, elapsed }] */
  function setRemoteSeats(list) {
    const now = Date.now();
    const seen = new Set();
    for (const x of list || []) {
      const seat = seats[x.seat];
      if (!seat || seat.occupant === player) continue;
      seen.add(x.seat);
      let r = remotes.get(x.seat);
      if (r && (r.sid !== x.sid || r.animal !== x.animal)) { removeRemote(x.seat); r = null; }
      if (!r) {
        if (seat.occupant && seat.occupant.npc) hideNpc(seat.occupant);
        const a = addActor(x.animal || 'bear', CLOTHES[hashN(x.sid) % CLOTHES.length], { name: x.nick });
        a.remote = true;
        a.obj.traverse((o) => { o.userData.remoteSid = x.sid; o.userData.remoteNick = x.nick; });
        sitActor(a, seat);
        r = { sid: x.sid, animal: x.animal, a };
        remotes.set(x.seat, r);
      }
      r.info = x;
      r.at = now;
      const live = x.studying && !x.paused;
      r.a.mode = live ? 'study' : 'sit';
      seat.bulb.material.emissiveIntensity = live ? 1.4 : 0;
      remoteLabel(r);
    }
    for (const k of [...remotes.keys()]) if (!seen.has(k)) removeRemote(k);
    // 분위기용 친구들: 진짜 친구가 3명 이상이면 쉬고, 진짜 친구가 그 자리에 앉으면 비켜 줌
    const many = remotes.size >= 3;
    for (const n of actors.filter((a) => a.npc)) {
      if (many || remotes.has(n.homeSeat)) hideNpc(n);
      else showNpc(n);
    }
  }
  /** 선생님: 캐릭터 없이 구경 (화면은 보이지 않는 시점을 따라 움직임) */
  function setObserver(on) {
    observer = !!on;
    if (observer && (player.seat || player.officeDesk)) standUp();
    player.obj.visible = !observer;
    player.el.classList.toggle('hidden', observer);
  }

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
    player.obj.position.copy(s.approach);
    player.mode = 'idle';
    deskLight.intensity = 0;
    opts.onStand && opts.onStand();
  }
  function sitDown(seat) {
    sitActor(player, seat);
    opts.onSit && opts.onSit(seat.idx);
  }
  function setStudying(on) {
    studying = on;
    if (!player.seat) return;
    player.mode = on ? 'study' : 'sit';
    player.seat.bulb.material.emissiveIntensity = on ? 1.6 : 0;
    deskLight.position.set(player.seat.chairPos.x + 0.3, DECK_Y + 1.2, player.seat.chairPos.z - 0.9);
    deskLight.intensity = on ? 2.2 : 0;
  }

  // ---------------- 교무실 오가기 ----------------
  const PORTAL = new THREE.Vector3(OFFICE_PORTAL.x, DECK_Y, OFFICE_PORTAL.z);
  const EXIT_SPOT = new THREE.Vector3(OX, DECK_Y, 4.0);
  function switchArea(name, pos, rotY) {
    if (player.seat || player.officeDesk) standUp();
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
      // 두 손가락: 확대·축소
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomTarget };
      down = null;
      return;
    }
    down = { x: e.clientX, y: e.clientY, yaw: yawTarget, pitch: pitchTarget, drag: false };
  });
  window.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d > 10) setZoom(pinch.zoom * (pinch.d / d));
      return;
    }
    if (!down) return;
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) down.drag = true;
    if (down.drag && !studying) {
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
    if (wasDrag || e.target !== el || studying) return;
    const r = el.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(scene.children, true);
    for (const h of hits) {
      const ud = h.object.userData;
      if (ud.officeDoor) { goToOffice(); return; }
      if (ud.officeExit) { goOutOfOffice(); return; }
      if (ud.officeSeat) { tapDesk(ud.officeSeat); return; }
      if (ud.botId) { tapBot(ud.botId); return; }  // 챗봇: 가까우면 바로, 멀면 걸어가서 말 걸기
      if (ud.remoteSid) {
        // 진짜 친구: 선생님은 말 걸기, 학생은 조용히
        if (observer) { opts.onRemoteStudent && opts.onRemoteStudent(ud.remoteSid, ud.remoteNick); return; }
        opts.onToast && opts.onToast(`${ud.remoteNick} 친구가 공부 중이에요 🤫`);
        return;
      }
      const s = h.object.userData.seat;
      if (s != null) {
        const occ = seats[s].occupant;
        if (occ && occ !== player) {
          if (observer && occ.remote) { const r = [...remotes.values()].find((x) => x.a === occ); if (r) { opts.onRemoteStudent && opts.onRemoteStudent(r.sid, r.info.nick); return; } }
          opts.onToast && opts.onToast('다른 친구가 공부 중인 자리예요 🤫');
          return;
        }
        walkToSeat(s);
        return;
      }
      if (h.object === deck || h.object === grass || h.object === rug || h.object === rug2 || h.object === officeFloor) {
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
  function applyMood(name) {
    if (name === moodName) return;
    moodName = name;
    const md = MOODS[name];
    scene.background = skyTexture(md.top, md.bottom);
    scene.fog = new THREE.Fog(md.fog, 28, 70);
    sun.color.set(md.sun);
    sun.intensity = md.sunI;
    hemi.intensity = md.hemi;
    hemi.groundColor.set(md.ground);
    bulbMat.emissiveIntensity = md.bulbs;
    stars.visible = name === 'night';
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

    // 키보드 이동
    let kx = 0, kz = 0;
    if (keys.has('w') || keys.has('arrowup')) kz -= 1;
    if (keys.has('s') || keys.has('arrowdown')) kz += 1;
    if (keys.has('a') || keys.has('arrowleft')) kx -= 1;
    if (keys.has('d') || keys.has('arrowright')) kx += 1;
    const p = player.obj.position;
    let moving = false;
    if ((kx || kz) && !studying) {
      if (player.seat || player.officeDesk) standUp();
      path = [];
      pendingSeat = null;
      pendingBot = null;
      pendingOffice = null;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      const dx = kx * c + kz * s, dz = -kx * s + kz * c;
      const len = Math.hypot(dx, dz);
      moveStep(dx / len, dz / len, dt);
      moving = true;
    } else if (path.length) {
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
        p.x += (v.x / d) * step;
        p.z += (v.z / d) * step;
        faceDir(v.x, v.z, dt);
        moving = true;
      }
    }
    if (!player.seat && !player.officeDesk) {
      player.mode = moving ? 'walk' : 'idle';
      p.y = DECK_Y;
    }
    // 뭉치 박사 근처인지 (하단 '질문' 버튼 표시용)
    let nb = null;
    if (area.name === 'office' && !player.officeDesk) for (const bt of bots) if (Math.hypot(p.x - bt.obj.position.x, p.z - bt.obj.position.z) < 1.7) nb = bt.id;
    if (nb !== nearBot) { nearBot = nb; opts.onNearBot && opts.onNearBot(nb); }
    // 교무실 문 근처인지
    const door = area.name === 'main'
      ? (!player.seat && Math.hypot(p.x - PORTAL.x, p.z - PORTAL.z) < 1.4 ? 'enter' : null)
      : (Math.hypot(p.x - EXIT_SPOT.x, p.z - EXIT_SPOT.z) < 1.3 ? 'exit' : null);
    if (door !== nearDoor) { nearDoor = door; opts.onNearDoor && opts.onNearDoor(door); }

    for (const a of actors) if (!a.fixed) animateAnimal(a.obj, a.mode, t + a.obj.userData.phase, dt);
    for (const av of officeSitters.values()) animateAnimal(av, 'study', t + av.userData.phase, dt);
    clouds.forEach((c, i) => { c.position.x += dt * (0.3 + i * 0.05); if (c.position.x > 40) c.position.x = -40; });

    // 카메라
    yaw += (yawTarget - yaw) * Math.min(1, dt * 6);
    pitch += (pitchTarget - pitch) * Math.min(1, dt * 6);
    zoom += (zoomTarget - zoom) * Math.min(1, dt * 6);
    const close = studying && player.seat;
    const sc = player.obj.userData.scale || 1;
    // 가까이 볼수록 캐릭터 얼굴 높이를 바라봄 (작은 동물도 잘 보이게)
    const zt = clamp((zoom - ZOOM_MIN) / (6 - ZOOM_MIN), 0, 1);
    const lookY = (0.15 + 0.55 * sc) * (1 - zt) + 0.8 * zt;
    const focus = close ? v.set(player.seat.chairPos.x, DECK_Y + 0.8, player.seat.chairPos.z - 0.5) : v.set(p.x, p.y + lookY, p.z);
    const cy = close ? 0 : yaw;
    const dist = close ? 2.2 : Math.cos(pitch) * zoom;
    const hgt = close ? 2.9 : Math.sin(pitch) * zoom;
    const desired = new THREE.Vector3(focus.x + Math.sin(cy) * dist, focus.y + hgt, focus.z + Math.cos(cy) * dist);
    camPos.lerp(desired, Math.min(1, dt * 3));
    camLook.lerp(focus, Math.min(1, dt * 4));
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
      const here = a.me || (a.area || 'main') === area.name;
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
    if (!blocked(nx, p.z)) p.x = nx;
    const nz = clamp(p.z + dz * sp, B.z0, B.z1);
    if (!blocked(p.x, nz)) p.z = nz;
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
      camPos.set(seat.chairPos.x, 3, seat.chairPos.z + 3);
      return true;
    },
    /** 선생님 로그인: { animal, color, glasses, name } / 로그아웃: null */
    setTeacherLook(look) {
      teacherLook = look || null;
      this.setPlayer({ animal: baseAnimal, name: baseName, status: baseStatus, force: true });
    },
    zoomBy(f) { setZoom(zoomTarget * f); },
    resetView() { yawTarget = 0; pitchTarget = 0.65; setZoom(11.9); },
    setPlayer({ animal, name, status, force }) {
      if (animal) baseAnimal = animal;
      if (name !== undefined) { baseName = name; baseStatus = status; }
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
      setLabel(player, { name: look ? `${look.name} 선생님` : baseName, status: baseStatus });
    },
    walkToBot: tapBot,
    // 교무실
    goToOffice,
    goOutOfOffice,
    enterOffice,
    setOfficeSeats,
    setOfficeOpen,
    setRemoteSeats,
    setObserver,
    get observer() { return observer; },
    setTeacher(id) { myTeacherId = id || null; officeDesks.forEach((d) => { d.teacher = { ...(d.teacher || {}), _force: Math.random() }; }); },
    sitAtMyDesk() {
      const desk = officeDesks.find((d) => d.teacher && d.teacher.id === myTeacherId);
      if (desk && area.name === 'office') tapDesk(desk.n);
    },
    get area() { return area.name; },
    get nearDoor() { return nearDoor; },
    get nearBot() { return nearBot; },
    get seated() { return player.seat ? player.seat.idx : -1; },
  };
}

export function seatName(i) {
  const row = 'ABC'[i % 3];
  return `${row}-${String(Math.floor(i / 3) + 1).padStart(2, '0')}`;
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
