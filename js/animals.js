// 동물 캐릭터 24종 — 둥근 로우폴리, 종마다 덩치·걸음 속도·생김새 특징이 다름
// (특정 작품의 캐릭터가 아니라 동물 종의 특징만 살린 디자인)
import * as THREE from '../vendor/three.module.min.js';
import { bakeDeep, bakeShallow, mergeInto } from './bake.js';
import { COLORS, parseOutfit } from './outfit.js';

const M = {};
const mat = (c, extra) => (extra ? new THREE.MeshLambertMaterial({ color: c, ...extra }) : (M[c] ||= new THREE.MeshLambertMaterial({ color: c })));
// 어지러울 때 눈 (뺑글뺑글 소용돌이)
let spiralTex = null;
function spiralMat() {
  if (!spiralTex) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#FFFFFF'; g.beginPath(); g.arc(32, 32, 30, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#2A2222'; g.lineWidth = 4.5; g.lineCap = 'round'; g.beginPath();
    for (let k = 0; k <= 120; k++) { const a = k * 0.16, r = 2 + k * 0.23; const x = 32 + Math.cos(a) * r, y = 32 + Math.sin(a) * r; k ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    spiralTex = new THREE.CanvasTexture(c);
  }
  return new THREE.MeshBasicMaterial({ map: spiralTex, transparent: true });
}
// 하치와레 무늬 무늬결 (구 위쪽을 펼친 그림: 가로 = 한 바퀴, 세로 = 정수리→눈썹)
const splitMats = {};
function splitMat(color) {
  if (splitMats[color]) return splitMats[color];
  const W = 512, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, W, H);
  // 앞(+z)은 가로 1/4 지점. 정수리 쪽은 좁고 아래로 갈수록 둥글게 벌어지는 하얀 아치를 투명하게 비움
  const fx = W * 0.25;
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  g.moveTo(fx, H * 0.18);
  g.bezierCurveTo(fx + W * 0.02, H * 0.45, fx + W * 0.085, H * 0.8, fx + W * 0.13, H + 2);
  g.lineTo(fx - W * 0.13, H + 2);
  g.bezierCurveTo(fx - W * 0.085, H * 0.8, fx - W * 0.02, H * 0.45, fx, H * 0.18);
  g.fill();
  // 아래 가장자리도 살짝 물결지게
  for (let i = 0; i < 10; i++) { g.beginPath(); g.ellipse((i + 0.5) * (W / 10), H + 4, W / 22, 10, 0, 0, Math.PI * 2); g.fill(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return (splitMats[color] = new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5 }));
}
function dizzyEye(size, x, y, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), spiralMat());
  m.position.set(x, y, z); m.rotation.y = ry; m.visible = false;   // (Euler XYZ라 rotation.z는 제자리 돌기)
  return m;
}
function mesh(geo, material, { x = 0, y = 0, z = 0, cast = true } = {}) {
  const o = new THREE.Mesh(geo, typeof material === 'string' ? mat(material) : material);
  o.position.set(x, y, z);
  o.castShadow = cast;
  return o;
}
const S = (r, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);

/**
 * scale: 전체 크기 · bodyW: 몸 너비 · speed: 걷는 속도 배수 · neck: 목 길이
 * ear: round | long | point | frog | mouse | flap | tiny | side | none
 */
export const LOOKS = {
  bear: { fur: '#B98552', muzzle: '#EBCFA6', ear: 'round', tail: 'puff' },
  rabbit: { fur: '#F5EEE6', muzzle: '#FFFFFF', ear: 'long', inner: '#F6B8C4', tail: 'puff', hop: true },
  cat: { fur: '#F2B46A', muzzle: '#FCE6C6', ear: 'point', inner: '#F7A9A0', tail: 'long', whiskers: true },
  fox: { fur: '#EC8A3C', muzzle: '#FFF4E6', ear: 'point', inner: '#3B2A22', tail: 'bushy', tailTip: '#FFF4E6' },
  panda: { fur: '#F7F6F1', muzzle: '#FFFFFF', ear: 'round', earColor: '#2E2E33', patch: '#2E2E33', tail: 'puff', limbs: '#2E2E33' },
  frog: { fur: '#8CCB6B', muzzle: '#B9E59B', ear: 'frog', tail: 'none', hop: true },
  mouse: { fur: '#B8B4AE', muzzle: '#EFE9E1', ear: 'mouse', inner: '#F6B8C4', tail: 'thin', scale: 0.5, speed: 1.15, whiskers: true, cushion: true },
  hamster: { fur: '#F0B866', muzzle: '#FFF3DD', ear: 'tiny', tail: 'none', scale: 0.55, cheeks: true, cushion: true, bodyW: 1.15 },
  elephant: { fur: '#A9AEB8', muzzle: '#A9AEB8', ear: 'flap', inner: '#E9B9C0', tail: 'thin', scale: 1.35, bodyW: 1.45, bigBottom: true, trunk: true, speed: 0.85 },
  giraffe: { fur: '#F3C66B', muzzle: '#F7E1B0', ear: 'side', tail: 'thin', neck: 0.5, spots: '#B9772F', horns: true, scale: 1.05 },
  lion: { fur: '#E9B562', muzzle: '#F8E3BC', ear: 'round', mane: '#B5652B', tail: 'tuft', scale: 1.1 },
  tiger: { fur: '#F09A3E', muzzle: '#FFF4E6', ear: 'round', stripes: '#3A2A22', tail: 'long', scale: 1.1, whiskers: true },
  cheetah: { fur: '#EFC77F', muzzle: '#FFF4E6', ear: 'tiny', spots: '#3A2A22', tears: true, tail: 'long', bodyW: 0.85, speed: 1.6 },
  sheep: { fur: '#5A4A42', muzzle: '#6E5D54', ear: 'side', wool: '#FBF6EC', tail: 'puff', tailColor: '#FBF6EC' },
  sloth: { fur: '#B39B7E', muzzle: '#E4D5BE', ear: 'none', patch: '#6B5641', patchLong: true, tail: 'none', speed: 0.45, slow: true },
  hippo: { fur: '#A79BC0', muzzle: '#C3B8D6', ear: 'tiny', tail: 'thin', scale: 1.25, bodyW: 1.35, bigMuzzle: true, bigBottom: true, speed: 0.8 },
  raccoon: { fur: '#9A9AA0', muzzle: '#F1EFEA', ear: 'point', inner: '#3A3A40', mask: '#3A3A40', tail: 'ringed', tailRing: '#3A3A40' },
  otter: { fur: '#8A5F3F', muzzle: '#E8D2B8', ear: 'tiny', tail: 'long', whiskers: true, scale: 0.85, speed: 1.1 },
  penguin: { fur: '#2F3542', muzzle: '#FFFFFF', ear: 'none', beak: '#F5A23C', face: '#FFFFFF', tail: 'none', waddle: true, limbs: '#F5A23C', speed: 0.8 },
  capybara: { fur: '#9C7B5B', muzzle: '#8F6F51', ear: 'tiny', earColor: '#7E6047', tail: 'none', capy: true, bodyW: 1.2, scale: 1.05, speed: 0.8, yuzu: true },
  graycat: { fur: '#FBFAF7', muzzle: '#FFFFFF', ear: 'point', earColor: '#8E949E', inner: '#F7B3B8', split: '#8E949E', tail: 'long', tailColor: '#8E949E', whiskers: true },
  cheesecat: { fur: '#FBFAF7', muzzle: '#FFFFFF', ear: 'point', earColor: '#E9A04F', inner: '#F7B3B8', split: '#E9A04F', tail: 'long', tailColor: '#E9A04F', whiskers: true },
  bun: { fur: '#FFF8EE', muzzle: '#FFFDF8', ear: 'none', tail: 'none', bun: true, limbs: '#F6EBDD', cheekColor: '#FFC2CF' },
  deer: { fur: '#C98F57', muzzle: '#F6E5CF', ear: 'side', antlers: '#8A5A33', tail: 'puff', tailColor: '#FFFFFF', speed: 1.25 },
};

export function animalScale(type) { return (LOOKS[type] || LOOKS.bear).scale || 1; }
export function animalSpeed(type) { return (LOOKS[type] || LOOKS.bear).speed || 1; }

/**
 * extra: { glasses: true|false, teacher: true|false }
 *   glasses — 동그란 안경, teacher — 교사증 목걸이 (선생님 캐릭터 표시)
 */
export function makeAnimal(type, clothes = '#7FB3E8', extra = {}) {
  const L = LOOKS[type] || LOOKS.bear;
  const g = new THREE.Group();
  const fur = mat(L.fur);
  const limb = mat(L.limbs || L.fur);
  const cloth = mat(clothes);
  const bw = L.bodyW || 1;
  const neck = L.neck || 0;

  // 다리
  const legGeo = new THREE.CapsuleGeometry(0.075 * Math.sqrt(bw), 0.12, 4, 8);
  const legL = mesh(legGeo, limb, { x: -0.1 * bw, y: 0.13 });
  const legR = mesh(legGeo, limb, { x: 0.1 * bw, y: 0.13 });
  // 몸 (옷)
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.2, 6, 14), cloth, { y: 0.45 });
  body.scale.set(bw, 1, bw > 1 ? 1 + (bw - 1) * 0.8 : 1);
  const collar = mesh(new THREE.TorusGeometry(0.13 * bw, 0.035, 6, 16), '#FFFFFF', { y: 0.66 });
  collar.rotation.x = Math.PI / 2;
  g.add(legL, legR, body, collar);
  if (L.bigBottom) {
    // 큰 엉덩이 — 의자 밖으로 튀어나옴
    const bottom = mesh(S(0.21 * bw, 14, 12), cloth, { y: 0.36, z: -0.17 });
    bottom.scale.set(1, 0.85, 0.9);
    g.add(bottom);
  }
  // 팔
  const armGeo = new THREE.CapsuleGeometry(0.06, 0.16, 4, 8);
  const armL = new THREE.Group();
  armL.position.set(-0.23 * bw, 0.56, 0);
  armL.add(mesh(armGeo, L.waddle ? fur : cloth, { y: -0.1 }));
  armL.add(mesh(S(0.065, 8, 8), L.waddle ? fur : limb, { y: -0.21 }));
  const armR = armL.clone();
  armR.position.x = 0.23 * bw;
  g.add(armL, armR);

  // 목 (기린)
  if (neck) {
    const n = mesh(new THREE.CylinderGeometry(0.1, 0.13, neck + 0.2, 12), fur, { y: 0.66 + neck / 2 });
    g.add(n);
    if (L.spots) for (let i = 0; i < 3; i++) g.add(spot(L.spots, 0.05, (i % 2 ? 0.08 : -0.07), 0.72 + i * 0.15, 0.1));
  }

  // 머리
  const head = new THREE.Group();
  head.position.y = 0.95 + neck;
  const skull = mesh(S(0.33, 20, 16), fur);
  skull.scale.set(L.cheeks ? 1.15 : L.capy ? 0.98 : 1.05, L.capy ? 0.9 : 0.95, L.capy ? 1.08 : 0.98);
  head.add(skull);
  if (L.face) { // 펭귄 흰 얼굴
    const f = mesh(S(0.27, 16, 12), L.face, { y: -0.04, z: 0.1 });
    f.scale.set(1.05, 0.9, 0.9);
    head.add(f);
  }
  if (L.wool) { // 양털 머리
    for (const [x, y, z] of [[0, 0.26, 0], [-0.17, 0.2, 0.05], [0.17, 0.2, 0.05], [-0.1, 0.27, -0.12], [0.1, 0.27, -0.12], [0, 0.18, 0.18]]) head.add(mesh(S(0.13), L.wool, { x, y, z }));
  }
  if (L.mane) { // 사자 갈기
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      head.add(mesh(S(0.13, 10, 8), L.mane, { x: Math.cos(a) * 0.32, y: Math.sin(a) * 0.3 + 0.02, z: -0.06 }));
    }
  }
  // 주둥이
  const mz = L.bigMuzzle ? 0.2 : L.capy ? 0.22 : 0.14;
  const muzzle = mesh(S(mz, 16, 12), mat(L.muzzle), { y: L.bigMuzzle ? -0.12 : L.capy ? -0.05 : -0.09, z: L.bigMuzzle ? 0.24 : L.capy ? 0.3 : 0.25 });
  // 카피바라: 털색과 같은 길고 뭉툭한 콧등 (앞으로 쭉, 위아래는 납작)
  muzzle.scale.set(L.bigMuzzle ? 1.35 : L.capy ? 0.9 : 1.2, L.capy ? 0.8 : 0.8, L.capy ? 1.35 : 0.7);
  head.add(muzzle);
  if (L.capy) {   // 콧등 끝의 까만 코 (위쪽에 콧구멍 둘)
    const tip = mesh(S(0.1, 12, 10), '#5A4636', { y: 0.0, z: 0.58 }); tip.scale.set(1.05, 0.55, 0.35); head.add(tip);
    for (const sx of [-1, 1]) { const n = mesh(S(0.022, 6, 6), '#2A2018', { x: sx * 0.045, y: 0.02, z: 0.615 }); n.scale.set(1, 0.6, 0.6); head.add(n); }
  }
  if (L.beak) {
    const b = mesh(new THREE.ConeGeometry(0.07, 0.16, 10), L.beak, { y: -0.06, z: 0.38 });
    b.rotation.x = Math.PI / 2;
    head.add(b);
  } else if (L.trunk) { // 코끼리 코
    const t1 = mesh(new THREE.CapsuleGeometry(0.065, 0.16, 4, 8), fur, { y: -0.17, z: 0.34 });
    t1.rotation.x = 0.5;
    const t2 = mesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 8), fur, { y: -0.33, z: 0.42 });
    t2.rotation.x = -0.2;
    head.add(t1, t2);
  } else if (L.capy) { // (코는 위에서 만듦)
  } else if (L.bigMuzzle) { // 하마 콧구멍
    for (const sx of [-1, 1]) head.add(mesh(S(0.03, 8, 6), L.nostril || '#5E5470', { x: sx * 0.08, y: -0.06, z: 0.39 }));
  } else {
    head.add(mesh(S(0.035, 8, 8), '#3A2A2A', { y: -0.04, z: 0.34 }));
  }
  if (L.mask) { // 너구리 가면
    const m = mesh(new THREE.TorusGeometry(0.15, 0.05, 6, 20), L.mask, { y: 0.04, z: 0.24 });
    m.scale.set(1.25, 0.45, 0.8);
    head.add(m);
  }
  if (L.stripes) { // 호랑이 줄무늬
    for (const [x, rz] of [[0, 0], [-0.1, 0.3], [0.1, -0.3]]) {
      const st = mesh(new THREE.BoxGeometry(0.03, 0.14, 0.04), L.stripes, { x, y: 0.27, z: 0.13 });
      st.rotation.set(-0.5, 0, rz);
      head.add(st);
    }
    for (const sx of [-1, 1]) {
      const st = mesh(new THREE.BoxGeometry(0.12, 0.025, 0.04), L.stripes, { x: sx * 0.31, y: 0.0, z: 0.08 });
      st.rotation.y = sx * 0.9;
      head.add(st);
    }
  }
  if (L.spots && !neck) {
    for (const [x, y, z] of [[-0.18, 0.2, 0.18], [0.2, 0.18, 0.16], [0, 0.28, 0.05], [-0.25, 0.02, 0.15], [0.26, 0.04, 0.12]]) head.add(spot(L.spots, 0.03, x, y, z));
  }
  if (L.spots && neck) for (const [x, y, z] of [[-0.15, 0.2, 0.2], [0.18, 0.22, 0.15]]) head.add(spot(L.spots, 0.06, x, y, z));

  const eyeGeo = S(0.038, 10, 10);
  const dizzyEyes = [];
  for (const sx of [-1, 1]) {
    if (L.ear !== 'frog') { const d = dizzyEye(0.14, sx * 0.12, 0.04, 0.335, sx * 0.3); head.add(d); dizzyEyes.push(d); }
    if (L.patch) {
      const p = mesh(S(0.075, 10, 10), L.patch, { x: sx * 0.12, y: L.patchLong ? 0.0 : 0.03, z: 0.27 });
      p.scale.set(L.patchLong ? 1.3 : 1, 1.2, 0.5);
      if (L.patchLong) p.rotation.z = sx * 0.6;
      head.add(p);
    }
    if (L.capy) { const e = mesh(eyeGeo, '#2A2222', { x: sx * 0.15, y: 0.1, z: 0.27 }); e.scale.set(1.2, 0.45, 1); head.add(e); }   // 졸린 듯 가느다란 눈
    else if (L.ear !== 'frog') head.add(mesh(eyeGeo, L.patch && !L.patchLong ? '#FFFFFF' : '#2A2222', { x: sx * 0.12, y: 0.04, z: 0.3 }));
    if (L.tears) { // 치타 눈물 무늬
      const tl = mesh(new THREE.BoxGeometry(0.02, 0.12, 0.02), '#3A2A22', { x: sx * 0.1, y: -0.05, z: 0.3 });
      tl.rotation.z = sx * 0.2;
      head.add(tl);
    }
    const cheek = mesh(S(L.cheeks ? 0.11 : 0.05, 8, 8), L.cheeks ? mat('#FFF3DD') : mat(L.cheekColor || '#FF9AA8', { transparent: true, opacity: 0.7 }), { x: sx * (L.cheeks ? 0.24 : 0.21), y: -0.08, z: L.cheeks ? 0.17 : 0.24 });
    if (!L.cheeks) cheek.scale.z = 0.3;
    if (!L.capy) head.add(cheek);
    if (L.cheeks) head.add(mesh(S(0.04, 8, 8), mat('#FF9AA8', { transparent: true, opacity: 0.7 }), { x: sx * 0.22, y: -0.06, z: 0.27 }));
    if (L.whiskers) for (const dy of [-0.08, -0.12]) {
      const w = mesh(new THREE.BoxGeometry(0.16, 0.008, 0.008), '#5A4A42', { x: sx * 0.22, y: dy, z: 0.28, cast: false });
      w.rotation.z = sx * (dy + 0.1) * 2;
      head.add(w);
    }
    head.add(makeEar(L, sx, fur));
    if (L.horns) { // 기린 뿔
      const h = new THREE.Group();
      h.position.set(sx * 0.1, 0.3, -0.02);
      h.add(mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.16, 8), L.fur, { y: 0.08 }));
      h.add(mesh(S(0.045, 8, 8), '#8A5A33', { y: 0.17 }));
      head.add(h);
    }
    if (L.antlers) { // 사슴뿔
      const a = new THREE.Group();
      a.position.set(sx * 0.13, 0.28, -0.02);
      a.rotation.z = -sx * 0.35;
      a.add(mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.26, 6), L.antlers, { y: 0.13 }));
      const b1 = mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.12, 6), L.antlers, { x: -sx * 0.04, y: 0.17 });
      b1.rotation.z = sx * 0.8;
      const b2 = mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.1, 6), L.antlers, { x: sx * 0.04, y: 0.22 });
      b2.rotation.z = -sx * 0.8;
      a.add(b1, b2);
      head.add(a);
    }
  }
  if (L.ear === 'frog') for (const sx of [-1, 1]) {
    head.add(mesh(S(0.1), fur, { x: sx * 0.15, y: 0.25, z: 0.08 }));
    head.add(mesh(S(0.06, 10, 10), '#FFFFFF', { x: sx * 0.15, y: 0.25, z: 0.14 }));
    head.add(mesh(S(0.032, 8, 8), '#2A2222', { x: sx * 0.15, y: 0.25, z: 0.19 }));
    const d = dizzyEye(0.12, sx * 0.15, 0.25, 0.205, 0); head.add(d); dizzyEyes.push(d);
  }
  if (L.split) { // 하치와레 무늬: 머리 위를 덮고, 이마 가운데는 둥근 아치 모양으로 하얗게 갈림
    const cap = mesh(new THREE.SphereGeometry(0.336, 48, 20, 0, Math.PI * 2, 0, 1.25), splitMat(L.split));
    cap.scale.copy(skull.scale); head.add(cap);
  }
  if (L.yuzu) { // 카피바라: 머리 위에 귤 하나 (온천 카피바라처럼 느긋하게)
    head.add(mesh(S(0.1, 12, 10), '#F5A23C', { y: 0.38, z: -0.02 }));
    const lf = mesh(new THREE.BoxGeometry(0.07, 0.015, 0.04), '#5DAE55', { x: 0.03, y: 0.48, z: -0.02 }); lf.rotation.z = -0.4; head.add(lf);
  }
  let steam = null;
  if (L.bun) { // 찐빵이: 머리 위 주름 꼭지 + 모락모락 김
    head.add(mesh(new THREE.ConeGeometry(0.09, 0.09, 10), L.fur, { y: 0.34 }));
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const pl = mesh(new THREE.BoxGeometry(0.012, 0.012, 0.09), '#EADBC6', { x: Math.sin(a) * 0.05, y: 0.33, z: Math.cos(a) * 0.05, cast: false }); pl.rotation.y = a; pl.rotation.x = -0.6; head.add(pl); }
    steam = new THREE.Group(); steam.position.y = 0.45;
    // 김 방울마다 재질을 따로 (따로 흐려지고, 몸과 합쳐지지 않게)
    [[0, 0.05, 0.06], [0.06, 0.15, 0.05], [-0.04, 0.24, 0.045]].forEach(([x, y, r]) => {
      const p2 = new THREE.Mesh(S(r, 8, 6), new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.55, depthWrite: false }));
      p2.position.set(x, y, 0); steam.add(p2);
    });
    head.add(steam);
  }
  g.add(head);

  // 꼬리
  const tc = L.tailColor || L.fur;
  let tail = null;
  // 꼬리 뿌리: 엉덩이 겉면보다 살짝 안쪽 (떠 보이지 않게)
  const zs = bw > 1 ? 1 + (bw - 1) * 0.8 : 1;
  const backZ = L.bigBottom ? -0.17 - 0.21 * bw * 0.9 : -0.19 * zs * bw;
  const tz = backZ + 0.05;
  if (L.tail === 'puff') tail = mesh(S(0.08, 8, 8), tc, { y: 0.32, z: backZ + 0.02 });
  else if (L.tail === 'bushy' || L.tail === 'ringed') {
    tail = new THREE.Group();
    tail.position.set(0, 0.31, tz);
    tail.rotation.x = 0.9;   // 뒤쪽(-z)으로 뻗게 (예전엔 몸을 뚫고 앞으로 나왔어요)
    for (let i = 0; i < 4; i++) {
      const c = L.tail === 'ringed' ? (i % 2 ? L.tailRing : L.fur) : (i === 3 && L.tailTip ? L.tailTip : L.fur);
      tail.add(mesh(S(0.09 + (L.tail === 'bushy' ? 0.02 * Math.min(i, 2) : 0), 10, 8), c, { y: -i * 0.09 }));
    }
  } else if (L.tail === 'long' || L.tail === 'thin' || L.tail === 'tuft') {
    tail = new THREE.Group();
    tail.position.set(0, 0.31, tz);
    tail.rotation.x = 1.0;   // 뒤쪽(-z)으로
    const r = L.tail === 'long' ? 0.045 : 0.022;
    const len = L.tail === 'thin' && L.scale < 1 ? 0.5 : 0.3;
    // 뿌리 끝이 몸 안쪽에서 시작하게 (캡슐 위쪽 끝 = 꼬리 뿌리)
    tail.add(mesh(new THREE.CapsuleGeometry(r, len, 4, 8), tc, { y: -(len / 2 + r) + 0.04 }));
    if (L.tail === 'tuft') tail.add(mesh(S(0.06, 8, 8), L.mane || tc, { y: -(len + 2 * r) + 0.02 }));
  }
  if (tail) { g.add(tail); }

  // 선생님 꾸미기
  if (extra.glasses) {
    const rim = mat('#2B2B2B');
    for (const sx of [-1, 1]) head.add(mesh(new THREE.TorusGeometry(0.085, 0.013, 6, 20), rim, { x: sx * 0.12, y: 0.04, z: 0.33, cast: false }));
    head.add(mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), rim, { y: 0.05, z: 0.34, cast: false }));
  }
  if (extra.teacher) {
    // 교사증 목걸이: 끈 + 카드
    const strap = mesh(new THREE.TorusGeometry(0.15 * bw, 0.012, 6, 20, Math.PI), '#3B6FD8', { y: 0.64, z: 0.04, cast: false });
    strap.rotation.set(Math.PI / 2 + 0.5, 0, Math.PI);
    g.add(strap);
    g.add(mesh(new THREE.BoxGeometry(0.13, 0.17, 0.02), '#FFFFFF', { y: 0.47, z: 0.2 * Math.max(1, bw * 0.95) + 0.01 }));
    g.add(mesh(new THREE.BoxGeometry(0.13, 0.04, 0.022), '#3B6FD8', { y: 0.54, z: 0.2 * Math.max(1, bw * 0.95) + 0.012, cast: false }));
  }

  // 👕 옷 입히기 (extra.outfit: "t=hood:3;b=skirt:1;..." · 선생님은 쓰지 않음)
  if (extra.outfit) dressUp({ g, L, bw, body, collar, legL, legR, armL, armR, head, neck, cloth }, parseOutfit(extra.outfit));

  // 같은 색 조각 합치기: 움직이는 단위(머리, 팔, 꼬리)는 그대로 두고 그 안에서만 합침
  bakeDeep(head);
  mergeInto(body, body.children.filter((c) => c.isMesh));
  [armL, armR].forEach(bakeShallow);
  if (tail && tail.isGroup) bakeShallow(tail);

  // 크기와 이름표 높이
  const box = new THREE.Box3().setFromObject(g);
  g.scale.setScalar(L.scale || 1);
  g.userData = {
    legL, legR, armL, armR, head, body, tail, phase: Math.random() * 10,
    headY: head.position.y, bodyY: 0.45, height: box.max.y,
    dizzyEyes, dizzy: false, steam,
    scale: L.scale || 1, waddle: !!L.waddle, slow: !!L.slow, hop: !!L.hop, cushion: !!L.cushion, big: !!L.bigBottom,
  };
  return g;
}


/* ---------- 👕 옷 ---------- */
const col = (c) => COLORS[c] || COLORS[0];
const WHITE = '#F7F5EF';
const starMats = {};
function starMat(color) {   // 잠옷: 별무늬
  if (starMats[color]) return starMats[color];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.fillStyle = color; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#FFF3A3';
  for (const [x, y] of [[12, 14], [44, 10], [28, 34], [10, 50], [50, 46]]) { g.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 2.6 : 6, a = (k / 10) * Math.PI * 2 - Math.PI / 2; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace;
  return (starMats[color] = new THREE.MeshLambertMaterial({ map: t }));
}
const box = (w, h, d, m, o = {}) => { const x = mesh(new THREE.BoxGeometry(w, h, d), m, o); return x; };
const cyl = (r1, r2, h, m, o = {}) => mesh(new THREE.CylinderGeometry(r1, r2, h, 18), m, o);

function dressUp(P, o) {
  const { L, bw, body, collar, legL, legR, armL, armR, head, g } = P;
  const sleeves = (m) => { if (!L.waddle) for (const a of [armL, armR]) a.children[0].material = m; };
  const torso = (m) => { body.material = m; };
  const legs = (m) => { legL.material = m; legR.material = m; };
  const onBody = (o2) => body.add(o2);   // 몸에 붙이면 몸 너비(bw)를 따라 같이 커져요
  const hip = (m, flare = 0, h = 0.09, y = -0.17) => onBody(cyl(0.205, 0.205 + flare, h, m, { y }));
  const legBand = (m, len = 0.09) => { for (const l of [legL, legR]) l.add(cyl(0.085, 0.09, len, m, { y: 0.07 - len / 2 + 0.04 })); };
  const bib = (m) => { onBody(box(0.2, 0.15, 0.04, m, { y: -0.05, z: 0.19 })); for (const sx of [-0.075, 0.075]) { onBody(box(0.035, 0.24, 0.03, m, { x: sx, y: 0.07, z: 0.19 })); onBody(box(0.035, 0.26, 0.03, m, { x: sx, y: 0.04, z: -0.2 })); } };
  const hood = (m) => { const h = mesh(new THREE.SphereGeometry(0.17, 14, 10), m, { y: 0.23, z: -0.15 }); h.scale.set(1.05, 0.7, 0.6); onBody(h); for (const sx of [-0.05, 0.05]) onBody(cyl(0.008, 0.008, 0.12, WHITE, { x: sx, y: 0.1, z: 0.205 })); };
  const stripes = (m, ys = [-0.03, 0.06]) => ys.forEach((y) => { const t = mesh(new THREE.TorusGeometry(0.203, 0.022, 6, 22), m, { y }); t.rotation.x = Math.PI / 2; onBody(t); });

  // 상의 · 한 벌을 안 입으면 흰색 기본 티
  if (!o.t && !o.d) { torso(mat(WHITE)); sleeves(mat(WHITE)); collar.material = mat(WHITE); }
  // 한 벌
  if (o.d) {
    const c = col(o.d.c), m = o.d.id === 'pajama' ? starMat(c) : mat(c);
    if (o.d.id === 'onepiece') { torso(m); sleeves(m); hip(m, 0.13, 0.24, -0.22); }
    else if (o.d.id === 'jumper') { torso(mat(WHITE)); sleeves(mat(WHITE)); hip(m, 0.12, 0.22, -0.21); bib(m); }
    else if (o.d.id === 'gymset') { torso(m); sleeves(m); legs(m); hip(m); for (const l of [legL, legR]) for (const sx of [-1, 1]) l.add(box(0.012, 0.2, 0.02, WHITE, { x: sx * 0.07, cast: false })); onBody(box(0.012, 0.3, 0.012, WHITE, { y: 0.02, z: 0.205, cast: false })); }
    else if (o.d.id === 'pajama') { torso(m); sleeves(m); legs(m); hip(m); for (const y of [0.1, 0.02, -0.06]) onBody(mesh(new THREE.SphereGeometry(0.018, 8, 6), WHITE, { y, z: 0.205, cast: false })); }
    else if (o.d.id === 'raincoat') {   // 오버핏: 어깨부터 무릎까지 일자로 똑 떨어지게
      torso(m); sleeves(m);
      onBody(cyl(0.24, 0.25, 0.46, m, { y: -0.12 }));
      for (const a of [armL, armR]) a.add(cyl(0.085, 0.095, 0.2, m, { y: -0.1 }));   // 넉넉한 소매
      hood(m);
      for (const y of [0.06, -0.06, -0.18]) onBody(mesh(new THREE.SphereGeometry(0.022, 8, 6), '#FFFFFF', { y, z: 0.252, cast: false }));
    }
  }
  // 상의
  if (o.t) {
    const m = mat(col(o.t.c));
    torso(m); sleeves(m);
    if (o.t.id === 'hood') hood(m);
    if (o.t.id === 'stripe') stripes(mat(WHITE));
    if (o.t.id === 'shirt') { onBody(box(0.05, 0.17, 0.02, '#C0392B', { y: 0.05, z: 0.205 })); for (const sx of [-1, 1]) { const c2 = box(0.08, 0.04, 0.02, WHITE, { x: sx * 0.05, y: 0.17, z: 0.17 }); c2.rotation.z = sx * 0.5; onBody(c2); } }
    if (o.t.id === 'vest') { sleeves(mat(WHITE)); onBody(box(0.09, 0.09, 0.02, WHITE, { y: 0.15, z: 0.19 })); stripes(m, [-0.15]); }
    if (o.t.id === 'jacket') { onBody(box(0.04, 0.12, 0.02, '#C0392B', { y: 0.11, z: 0.205 })); for (const sx of [-1, 1]) { const c2 = box(0.09, 0.05, 0.02, WHITE, { x: sx * 0.06, y: 0.16, z: 0.18 }); c2.rotation.z = sx * 0.55; onBody(c2); } for (const y of [-0.02, -0.1]) onBody(mesh(new THREE.SphereGeometry(0.016, 8, 6), '#E0B23A', { y, z: 0.205, cast: false })); }
  }
  // 하의
  if (o.b) {
    const m = mat(col(o.b.c));
    if (o.b.id === 'shorts') { hip(m, 0.01, 0.12, -0.17); legBand(m, 0.08); }
    if (o.b.id === 'pants' || o.b.id === 'overalls' || o.b.id === 'track') { legs(m); hip(m); }
    if (o.b.id === 'skirt') hip(m, 0.1, 0.17, -0.19);
    if (o.b.id === 'overalls') bib(m);
    if (o.b.id === 'track') for (const l of [legL, legR]) for (const sx of [-1, 1]) l.add(box(0.012, 0.2, 0.02, WHITE, { x: sx * 0.07, cast: false }));
  }
  if (o.t || o.d) collar.material = mat(o.t && o.t.id === 'stripe' ? WHITE : (o.t && o.t.id === 'tee') || (o.d && o.d.id !== 'jumper') ? col((o.t || o.d).c) : WHITE);
  // 신발 (다리 끝에 붙여서 걸을 때 같이 움직임)
  if (o.s) {
    const m = mat(col(o.s.c));
    for (const l of [legL, legR]) {
      if (o.s.id === 'sneakers') { l.add(box(0.13, 0.06, 0.2, m, { y: -0.1, z: 0.03 })); l.add(box(0.135, 0.022, 0.21, WHITE, { y: -0.135, z: 0.03, cast: false })); }
      if (o.s.id === 'boots') { l.add(cyl(0.088, 0.09, 0.15, m, { y: -0.07 })); l.add(box(0.13, 0.05, 0.08, m, { y: -0.12, z: 0.07 })); }
      if (o.s.id === 'slippers') { l.add(box(0.12, 0.022, 0.2, m, { y: -0.135, z: 0.03 })); l.add(box(0.125, 0.04, 0.05, m, { y: -0.11, z: 0.07 })); }
      if (o.s.id === 'loafers') l.add(box(0.12, 0.05, 0.18, m, { y: -0.115, z: 0.03 }));
    }
  }
  // 악세서리
  // 개구리는 눈이 머리 위에 있어서 모자를 조금 뒤 · 위로 (눈을 가리지 않게)
  const hatHolder = new THREE.Group();
  if (L.ear === 'frog') { hatHolder.position.set(0, 0.1, -0.12); hatHolder.rotation.x = -0.45; hatHolder.scale.setScalar(0.9); }
  head.add(hatHolder);
  for (const a of o.a || []) {
    const m = mat(col(a.c));
    const head = /^(cap|beanie|straw|crown|headphones)$/.test(a.id) ? hatHolder : P.head;
    const dome = (r, sy, y) => { const d = mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m, { y }); d.scale.y = sy; head.add(d); return d; };
    if (a.id === 'cap') { dome(0.335, 0.72, 0.06); head.add(box(0.27, 0.022, 0.2, m, { y: 0.08, z: 0.33 })); }
    if (a.id === 'beanie') { dome(0.345, 0.85, 0.04); const t = mesh(new THREE.TorusGeometry(0.335, 0.035, 6, 24), m, { y: 0.05 }); t.rotation.x = Math.PI / 2; head.add(t); head.add(mesh(new THREE.SphereGeometry(0.075, 10, 8), WHITE, { y: 0.35 })); }
    if (a.id === 'straw') { head.add(cyl(0.55, 0.55, 0.02, m, { y: 0.22 })); head.add(cyl(0.24, 0.27, 0.15, m, { y: 0.29 })); head.add(cyl(0.272, 0.272, 0.04, '#C0392B', { y: 0.24 })); }
    if (a.id === 'crown') { head.add(cyl(0.17, 0.17, 0.08, m, { y: 0.33 })); for (let k = 0; k < 5; k++) { const ang = (k / 5) * Math.PI * 2; head.add(mesh(new THREE.ConeGeometry(0.04, 0.09, 6), m, { x: Math.sin(ang) * 0.16, y: 0.41, z: Math.cos(ang) * 0.16 })); } head.add(mesh(new THREE.SphereGeometry(0.03, 8, 6), '#E2574C', { y: 0.34, z: 0.17 })); }
    if (a.id === 'headphones') { const band = mesh(new THREE.TorusGeometry(0.34, 0.025, 6, 20, Math.PI), m, { y: 0.02 }); head.add(band); for (const sx of [-1, 1]) { const cup = cyl(0.08, 0.08, 0.06, m, { x: sx * 0.34, y: 0.02 }); cup.rotation.z = Math.PI / 2; head.add(cup); } }
    if (a.id === 'glasses' || a.id === 'sunglasses') {
      const sun = a.id === 'sunglasses';
      for (const sx of [-1, 1]) {
        head.add(mesh(new THREE.TorusGeometry(0.085, 0.013, 6, 20), m, { x: sx * 0.12, y: 0.04, z: 0.335, cast: false }));
        if (sun) head.add(mesh(new THREE.CircleGeometry(0.082, 18), '#1E1E24', { x: sx * 0.12, y: 0.04, z: 0.338, cast: false }));
      }
      head.add(box(0.06, 0.012, 0.012, m, { y: 0.05, z: 0.34, cast: false }));
    }
    if (a.id === 'ribbon') { for (const sx of [-1, 1]) { const w = mesh(new THREE.ConeGeometry(0.06, 0.13, 8), m, { x: 0.2 + sx * 0.065, y: 0.25, z: 0.08 }); w.rotation.z = -sx * Math.PI / 2; head.add(w); } head.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), m, { x: 0.2, y: 0.25, z: 0.08 })); }
    if (a.id === 'scarf') { const t = mesh(new THREE.TorusGeometry(0.14 * bw, 0.05, 8, 20), m, { y: 0.67 + (P.neck || 0) * 0.2 }); t.rotation.x = Math.PI / 2; g.add(t); g.add(box(0.07, 0.17, 0.03, m, { x: 0.06, y: 0.56, z: 0.17 * Math.max(1, bw) })); }
    if (a.id === 'bag') { onBody(box(0.26, 0.26, 0.1, m, { y: 0.0, z: -0.24 })); onBody(box(0.2, 0.08, 0.04, m, { y: -0.08, z: -0.3 })); for (const sx of [-0.08, 0.08]) onBody(box(0.03, 0.26, 0.03, '#3B3B44', { x: sx, y: 0.03, z: 0.19 })); }
  }
}

function spot(color, r, x, y, z) {
  const s = mesh(S(r, 8, 6), color, { x, y, z, cast: false });
  s.scale.z = 0.4;
  return s;
}

function makeEar(L, sx, fur) {
  const ec = L.earColor ? mat(L.earColor) : fur;
  switch (L.ear) {
    case 'round': {
      const e = mesh(S(0.1, 12, 10), ec, { x: sx * 0.24, y: 0.25 });
      e.scale.z = 0.6;
      return e;
    }
    case 'long': {
      const e = new THREE.Group();
      e.position.set(sx * 0.12, 0.36, -0.02);
      e.rotation.z = -sx * 0.12;
      e.add(mesh(new THREE.CapsuleGeometry(0.065, 0.3, 4, 10), ec, { y: 0.12 }));
      e.add(mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 8), L.inner, { y: 0.12, z: 0.04 }));
      return e;
    }
    case 'point': {
      const e = mesh(new THREE.ConeGeometry(0.11, 0.2, 4), ec, { x: sx * 0.2, y: 0.3 });
      e.rotation.set(0, Math.PI / 4, -sx * 0.25);
      return e;
    }
    case 'mouse': { // 크고 동그란 귀
      const e = new THREE.Group();
      e.position.set(sx * 0.25, 0.25, -0.02);
      const o = mesh(S(0.17, 14, 10), ec);
      o.scale.z = 0.35;
      const i = mesh(S(0.11, 12, 8), L.inner, { z: 0.04 });
      i.scale.z = 0.3;
      e.add(o, i);
      return e;
    }
    case 'flap': { // 코끼리 큰 귀
      const e = new THREE.Group();
      e.position.set(sx * 0.33, 0.02, -0.02);
      e.rotation.y = sx * 0.5;
      const o = mesh(S(0.24, 14, 10), ec);
      o.scale.set(0.3, 1, 0.9);
      const i = mesh(S(0.17, 12, 8), L.inner, { x: sx * 0.03 });
      i.scale.set(0.25, 0.9, 0.8);
      e.add(o, i);
      return e;
    }
    case 'tiny': {
      const e = mesh(S(0.06, 8, 8), ec, { x: sx * 0.22, y: 0.24 });
      e.scale.z = 0.6;
      return e;
    }
    case 'side': { // 옆으로 뻗은 귀 (기린·양·사슴)
      const e = mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 8), ec, { x: sx * 0.33, y: 0.12 });
      e.rotation.z = sx * 1.2;
      return e;
    }
    default:
      return new THREE.Group();
  }
}

/** 걷기·앉기·공부·가만히 애니메이션 */
export function animateAnimal(a, mode, t, dt) {
  const u = a.userData;
  const slow = u.slow ? 0.45 : 1;
  u.phase += dt * (mode === 'walk' ? 11 : 2) * slow;
  const p = u.phase;
  const hy = u.headY, by = u.bodyY;
  if (u.mascot) {
    u.body.position.y = 0.46 + Math.sin(p) * 0.01;
    u.head.position.y = 0.98 + Math.sin(p) * 0.015;
    u.head.rotation.z = Math.sin(p * 0.5) * 0.08;
    u.head.rotation.x = 0.1 + Math.sin(p * 0.35) * 0.06;
    u.tail.rotation.z = Math.sin(t * 6) * 0.3;
    return;
  }
  if (u.tail) u.tail.rotation.z = Math.sin(t * (mode === 'walk' ? 8 : 3) * slow) * 0.25;
  // 물에서 나오면 강아지처럼 부르르 털기 (머리 도리도리 + 몸 비틀기)
  if (u.shakeT > 0) {
    u.shakeT = Math.max(0, u.shakeT - dt);
    const k = Math.sin(u.shakeT * 38) * Math.min(1, u.shakeT * 2.2);
    u.body.rotation.y = k * 0.45; u.head.rotation.y = k * 0.9;
  } else if (u.body.rotation.y || u.head.rotation.y) { u.body.rotation.y = 0; u.head.rotation.y = 0; }
  if (u.steam) u.steam.children.forEach((p2, i) => { const k = (t * 0.6 + i / 3) % 1; p2.position.x = Math.sin(t * 1.5 + i * 2) * 0.04; p2.position.y = 0.05 + k * 0.3; p2.material.opacity = 0.6 * (1 - k); p2.scale.setScalar(0.7 + k * 0.8); });
  if (u.dizzyEyes) for (const e of u.dizzyEyes) { e.visible = !!u.dizzy; if (u.dizzy) e.rotation.z -= dt * 9; }
  if (mode === 'hang') {
    // 매달리기 (철봉 · 짚라인 · 정글짐 오르기): 두 팔은 위로, 다리는 살짝 흔들
    u.legL.rotation.z = u.legR.rotation.z = 0;
    u.armL.rotation.x = u.armR.rotation.x = -3.0;
    u.armL.rotation.z = 0.12; u.armR.rotation.z = -0.12;
    u.legL.rotation.x = Math.sin(t * 3) * 0.25; u.legR.rotation.x = -Math.sin(t * 3) * 0.25;
    u.body.position.y = by; u.body.rotation.z = 0;
    u.head.position.y = hy; u.head.rotation.x = -0.1; u.head.rotation.z = 0;
    return;
  }
  if (mode === 'wrestle') {
    // 씨름: 두 팔을 앞으로 뻗어 상대 샅바를 잡고, 다리는 벌려 버팀
    u.armL.rotation.x = u.armR.rotation.x = -1.35 + Math.sin(t * 7) * 0.08;
    u.armL.rotation.z = -0.35; u.armR.rotation.z = 0.35;
    u.legL.rotation.x = 0.25 + Math.sin(t * 7) * 0.12; u.legR.rotation.x = -0.35 - Math.sin(t * 7) * 0.12;
    u.legL.rotation.z = 0.2; u.legR.rotation.z = -0.2;
    u.body.position.y = by - 0.02; u.body.rotation.z = Math.sin(t * 3.5) * 0.06;
    u.head.position.y = hy - 0.03; u.head.rotation.x = 0.25; u.head.rotation.z = 0;
    return;
  }
  if (mode === 'jump') {
    // 트램펄린: 만세 + 다리 모으기
    u.legL.rotation.z = u.legR.rotation.z = 0;
    u.armL.rotation.x = u.armR.rotation.x = -2.6;
    u.armL.rotation.z = 0.5; u.armR.rotation.z = -0.5;
    u.legL.rotation.x = u.legR.rotation.x = 0.15;
    u.body.position.y = by; u.body.rotation.z = 0;
    u.head.position.y = hy; u.head.rotation.x = -0.15; u.head.rotation.z = 0;
    return;
  }
  if (mode === 'swim') {
    // 수영: (몸 전체는 world.js에서 앞으로 눕힘) 고개는 들고, 팔은 번갈아 젓고, 다리는 파닥파닥
    const sp = u.swimFast ? 7 : 3.2;
    u.armL.rotation.x = -1.6 + Math.sin(t * sp) * 1.3;
    u.armR.rotation.x = -1.6 - Math.sin(t * sp) * 1.3;
    u.armL.rotation.z = 0.25; u.armR.rotation.z = -0.25;
    u.legL.rotation.x = 0.3 + Math.sin(t * sp * 1.6) * 0.45;
    u.legR.rotation.x = 0.3 - Math.sin(t * sp * 1.6) * 0.45;
    u.body.position.y = by + Math.sin(t * 2) * 0.015;
    u.body.rotation.z = Math.sin(t * sp * 0.5) * 0.08;
    u.head.position.y = hy;
    u.head.rotation.x = -1.3;   // 몸은 눕고 머리는 앞을 봄
    u.head.rotation.z = Math.sin(t * sp * 0.5) * 0.08;
    return;
  }
  if (mode === 'slump') {
    // 어지러워서 털썩 주저앉음: 다리는 앞으로, 팔은 축, 머리는 빙글빙글
    u.legL.rotation.x = u.legR.rotation.x = -1.45;
    u.legL.rotation.z = 0.25; u.legR.rotation.z = -0.25;
    u.armL.rotation.x = u.armR.rotation.x = -0.15;
    u.armL.rotation.z = 0.7; u.armR.rotation.z = -0.7;
    u.body.position.y = by;
    u.body.rotation.z = Math.sin(t * 2.6) * 0.12;
    u.head.position.y = hy - 0.02;
    u.head.rotation.z = Math.sin(t * 2.6) * 0.3;
    u.head.rotation.x = 0.12 + Math.cos(t * 2.6) * 0.18;
    return;
  }
  u.legL.rotation.z = u.legR.rotation.z = 0;
  if (mode === 'walk') {
    const swing = u.waddle ? 0.25 : 0.6;
    u.legL.rotation.x = Math.sin(p) * swing;
    u.legR.rotation.x = -Math.sin(p) * swing;
    u.armL.rotation.x = -Math.sin(p) * (u.waddle ? 0.1 : 0.5);
    u.armR.rotation.x = Math.sin(p) * (u.waddle ? 0.1 : 0.5);
    u.armL.rotation.z = u.waddle ? 0.5 : 0;
    u.armR.rotation.z = u.waddle ? -0.5 : 0;
    const bob = u.hop ? Math.abs(Math.sin(p)) * 0.09 : Math.abs(Math.sin(p)) * 0.03;
    u.body.position.y = by + bob;
    u.head.position.y = hy + bob * 1.3;
    u.head.rotation.x = 0;
    u.body.rotation.z = u.head.rotation.z = u.waddle ? Math.sin(p) * 0.18 : 0; // 펭귄 뒤뚱
  } else if (mode === 'stretch') {
    // 앉아서 기지개: 두 팔을 위로 쭉, 목을 좌우로 천천히
    u.legL.rotation.x = u.legR.rotation.x = -1.4;
    u.armL.rotation.x = u.armR.rotation.x = -2.9 + Math.sin(t * 1.1) * 0.12;
    u.armL.rotation.z = 0.25 + Math.sin(t * 0.8) * 0.1;
    u.armR.rotation.z = -0.25 - Math.sin(t * 0.8) * 0.1;
    u.body.position.y = by + 0.01;
    u.body.rotation.z = Math.sin(t * 0.8) * 0.08;
    u.head.position.y = hy;
    u.head.rotation.x = -0.15;
    u.head.rotation.z = Math.sin(t * 0.8) * 0.28;
    } else if (mode === 'sit' || mode === 'study') {
    u.legL.rotation.x = u.legR.rotation.x = -1.4;
    const write = mode === 'study';
    u.armL.rotation.x = write ? -1.1 : -0.3;
    u.armR.rotation.x = write ? -1.15 + Math.sin(t * 9 * slow) * 0.06 : -0.3;
    u.armR.rotation.z = write ? Math.sin(t * 4.5 * slow) * 0.08 : 0;
    u.armL.rotation.z = 0;
    u.body.position.y = by;
    u.body.rotation.z = 0;
    u.head.position.y = hy + Math.sin(t * 1.6) * 0.008;
    u.head.rotation.x = write ? 0.32 + Math.sin(t * 0.9 * slow) * 0.05 : 0.05;
    u.head.rotation.z = write ? Math.sin(t * 0.5) * 0.06 : 0;
  } else {
    u.legL.rotation.x = u.legR.rotation.x = 0;
    u.armL.rotation.x = u.armR.rotation.x = Math.sin(p) * 0.04;
    u.armL.rotation.z = u.armR.rotation.z = 0;
    u.body.position.y = by + Math.sin(p) * 0.008;
    u.body.rotation.z = 0;
    u.head.position.y = hy + Math.sin(p) * 0.012;
    u.head.rotation.x = 0;
    u.head.rotation.z = Math.sin(p * 0.5) * 0.05;
  }
}
