// 👕 옷 꾸미기: 상의 · 하의 · 한 벌 · 신발 · 악세서리(2개까지) — 모든 캐릭터 공통
// 짧은 글자로 저장하고 실시간으로 나눠요: "t=hood:3;b=skirt:1;s=boots:5;a=cap:2,scarf:4"
export const COLORS = ['#F2F2EE', '#3B3B44', '#E2574C', '#F28C28', '#F5C451', '#81C784', '#4D8FD1', '#2F4B7C', '#B39DDB', '#F48FB1', '#A1887F', '#8FD3E8'];

export const SLOTS = [
  { id: 't', name: '상의', emoji: '👕' },
  { id: 'b', name: '하의', emoji: '👖' },
  { id: 'd', name: '한 벌', emoji: '👗' },
  { id: 's', name: '신발', emoji: '👟' },
  { id: 'a', name: '악세서리', emoji: '🎀', max: 2 },
];

// spot: 같은 자리 악세서리는 하나만 (머리 위 · 얼굴 · 목 · 등 · 머리 옆)
export const ITEMS = {
  t: [
    { id: 'tee', name: '반팔 티', c: 6 },
    { id: 'hood', name: '후드티', c: 9 },
    { id: 'stripe', name: '줄무늬 티', c: 7 },
    { id: 'shirt', name: '셔츠+넥타이', c: 0 },
    { id: 'vest', name: '니트 조끼', c: 10 },
    { id: 'jacket', name: '교복 재킷', c: 7 },
  ],
  b: [
    { id: 'shorts', name: '반바지', c: 6 },
    { id: 'pants', name: '긴 바지', c: 7 },
    { id: 'skirt', name: '치마', c: 2 },
    { id: 'overalls', name: '멜빵바지', c: 6 },
    { id: 'track', name: '체육복 바지', c: 7 },
  ],
  d: [
    { id: 'onepiece', name: '원피스', c: 9 },
    { id: 'jumper', name: '멜빵 원피스', c: 5 },
    { id: 'gymset', name: '체육복 세트', c: 7 },
    { id: 'pajama', name: '잠옷', c: 8 },
    { id: 'raincoat', name: '우비', c: 4 },
  ],
  s: [
    { id: 'sneakers', name: '운동화', c: 0 },
    { id: 'boots', name: '장화', c: 4 },
    { id: 'slippers', name: '슬리퍼', c: 9 },
    { id: 'loafers', name: '구두', c: 10 },
  ],
  a: [
    { id: 'cap', name: '야구모자', c: 2, spot: 'top' },
    { id: 'beanie', name: '털모자', c: 5, spot: 'top' },
    { id: 'straw', name: '밀짚모자', c: 4, spot: 'top' },
    { id: 'crown', name: '왕관', c: 4, spot: 'top' },
    { id: 'headphones', name: '헤드폰', c: 1, spot: 'top' },
    { id: 'glasses', name: '동그란 안경', c: 1, spot: 'face' },
    { id: 'sunglasses', name: '선글라스', c: 1, spot: 'face' },
    { id: 'ribbon', name: '리본', c: 9, spot: 'side' },
    { id: 'scarf', name: '목도리', c: 2, spot: 'neck' },
    { id: 'bag', name: '가방', c: 3, spot: 'back' },
  ],
};
export const itemOf = (slot, id) => (ITEMS[slot] || []).find((x) => x.id === id) || null;

/** 글자 → { t: {id, c}, b, d, s, a: [{id, c}] } (모르는 옷은 버림) */
export function parseOutfit(str) {
  const o = { a: [] };
  String(str || '').split(';').forEach((part) => {
    const [k, v] = part.split('=');
    if (!k || !v || !ITEMS[k]) return;
    const list = v.split(',').map((x) => { const [id, c] = x.split(':'); return itemOf(k, id) ? { id, c: Math.max(0, Math.min(COLORS.length - 1, Number(c) || 0)) } : null; }).filter(Boolean);
    if (k === 'a') o.a = list.slice(0, 2);
    else if (list[0]) o[k] = list[0];
  });
  if (o.d) { delete o.t; delete o.b; }
  return o;
}
export function stringifyOutfit(o) {
  const out = [];
  ['t', 'b', 'd', 's'].forEach((k) => { if (o[k]) out.push(`${k}=${o[k].id}:${o[k].c}`); });
  if (o.a && o.a.length) out.push('a=' + o.a.slice(0, 2).map((x) => `${x.id}:${x.c}`).join(','));
  return out.join(';');
}
/** 처음 옷 (예전 모습과 비슷하게: 하늘색 반팔 티) */
export const DEFAULT_OUTFIT = 't=tee:6';
