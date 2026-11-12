// 🪶 가볍게 그리기: 움직이지 않는 물체 합치기 (world.js · animals.js에서 씀)
import * as THREE from '../vendor/three.module.min.js';
/* ---------- 가볍게 그리기: 움직이지 않는 물체 합치기 ----------
 * 같은 재질(색)의 작은 물체 여러 개를 큰 물체 하나로 합쳐서 한 번에 그려요 (휴대폰·태블릿에서 그리기 호출 수를 크게 줄임).
 * 누를 수 있는 물체의 표시(userData)는 그대로 옮겨서 눌러도 똑같이 동작해요. */
const _inv = new THREE.Matrix4(), _mm = new THREE.Matrix4();
const udKey = (ud) => JSON.stringify(ud, (k, v) => (k === '__src' ? undefined : v));
export function mergeInto(parent, meshes) {
  parent.updateWorldMatrix(true, false);
  _inv.copy(parent.matrixWorld).invert();
  const groups = new Map();
  for (const m of meshes) {
    if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || Array.isArray(m.material) || m.morphTargetInfluences) continue;
    const k = m.material.uuid + '|' + m.castShadow + m.receiveShadow + '|' + m.renderOrder + '|' + udKey(m.userData);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(m);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const parts = [];
    let withUv = true;
    for (const m of list) {
      m.updateWorldMatrix(true, false);
      _mm.multiplyMatrices(_inv, m.matrixWorld);
      let g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
      if (!g.attributes.normal) g.computeVertexNormals();
      g.applyMatrix4(_mm);
      if (!g.attributes.uv) withUv = false;
      parts.push(g);
    }
    const names = ['position', 'normal'].concat(withUv ? ['uv'] : []);
    const merged = new THREE.BufferGeometry();
    for (const n of names) {
      const size = parts[0].attributes[n].itemSize;
      const arr = new Float32Array(parts.reduce((a, g) => a + g.attributes[n].count * size, 0));
      let off = 0;
      for (const g of parts) { const src = g.attributes[n]; for (let i = 0; i < src.count; i++) for (let c = 0; c < size; c++) arr[off++] = src.getComponent(i, c); }
      merged.setAttribute(n, new THREE.BufferAttribute(arr, size));
    }
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    parts.forEach((g) => g.dispose());
    const first = list[0];
    const out = new THREE.Mesh(merged, first.material);
    out.castShadow = first.castShadow; out.receiveShadow = first.receiveShadow; out.renderOrder = first.renderOrder;
    out.userData = { ...first.userData };
    for (const m of list) m.parent && m.parent.remove(m);
    parent.add(out);
  }
}
/** 그룹 바로 아래 물체만 합치기 (그룹은 계속 움직여도 됨) */
export function bakeShallow(g) { mergeInto(g, g.children.filter((c) => c.isMesh)); }
/** 그룹 안의 모든 물체를 합치기 (그룹 전체가 움직이지 않을 때) */
export function bakeDeep(g) {
  const list = []; g.traverse((o) => { if (o.isMesh && o !== g) list.push(o); });
  mergeInto(g, list);
  // 비어 버린 하위 그룹 정리
  const empty = []; g.traverse((o) => { if (o !== g && !o.isMesh && o.children.length === 0 && o.type === 'Group') empty.push(o); });
  empty.forEach((o) => o.parent && o.parent.remove(o));
}
