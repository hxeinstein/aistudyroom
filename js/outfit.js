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
    { id: 'track', name: '체육복 바지', c: 7 },
  ],
  d: [
    { id: 'onepiece', name: '원피스', c: 9 },
    { id: 'jumper', name: '멜빵바지', c: 6 },   // 흰 티 + 멜빵바지 한 벌
    { id: 'gymset', name: '체육복 세트', c: 7 },
    { id: 'pajama', name: '잠옷', c: 8 },
    { id: 'raincoat', name: '우비', c: 4, hidden: true },   // 고르는 목록엔 없음: 비·눈 오는 날 쉼터에서 자동으로
  ],
  s: [
    { id: 'sneakers', name: '운동화', c: 0 },
    { id: 'boots', name: '장화', c: 4, hidden: true },   // 고르는 목록엔 없음: 우비 입을 때 자동으로
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
  return out.join(';') || 'n';   // 'n' = 아무것도 안 고름 (흰색 기본 티)
}
/** ☔ 비·눈 오는 날 쉼터: 노란 우비 + 노란 장화 (모자 종류만 벗고 다른 악세서리는 그대로) */
export function rainOutfit(str) {
  const o = parseOutfit(str);
  const a = (o.a || []).filter((x) => (itemOf('a', x.id) || {}).spot !== 'top');
  return stringifyOutfit({ d: { id: 'raincoat', c: 4 }, s: { id: 'boots', c: 4 }, a });
}

/** 옷 그림 (가벼운 SVG 아이콘, 고른 색으로) */
export function itemIcon(slot, id, c) {
  const f = COLORS[c] || COLORS[0], k = '#5A4636', w = '#FFFFFF';
  const S = (body) => `<svg viewBox="0 0 48 48" width="40" height="40" stroke="${k}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">${body}</svg>`;
  const tee = `<path d="M17 9 L9 14 L12 21 L16 19 L16 39 L32 39 L32 19 L36 21 L39 14 L31 9 Q24 14 17 9 Z" fill="${f}"/>`;
  const legs = (h) => `<path d="M14 8 L34 8 L35 ${h} L26 ${h} L24 18 L22 ${h} L13 ${h} Z" fill="${f}"/>`;
  const dress = `<path d="M18 8 L30 8 L31 18 L38 40 L10 40 L17 18 Z" fill="${f}"/>`;
  const shoe = (h) => `<path d="M8 ${38 - h} L22 ${38 - h} L22 30 Q36 30 40 36 L40 40 L8 40 Z" fill="${f}"/>`;
  const I = {
    tee: tee,
    hood: tee + `<path d="M17 9 Q24 1 31 9 Q24 14 17 9 Z" fill="${f}"/><path d="M22 14 L22 20 M26 14 L26 20"/>`,
    stripe: tee + `<path d="M16 25 L32 25 M16 31 L32 31" stroke="${w}" stroke-width="3"/>`,
    shirt: tee + `<path d="M24 13 L22 16 L24 28 L26 16 Z" fill="#C0392B"/>`,
    vest: `<path d="M17 9 L16 39 L32 39 L31 9 L24 22 Z" fill="${f}"/>`,
    jacket: tee + `<path d="M19 10 L24 20 L29 10" fill="${w}"/><circle cx="24" cy="27" r="1.2" fill="#E0B23A"/><circle cx="24" cy="33" r="1.2" fill="#E0B23A"/>`,
    shorts: legs(28), pants: legs(42), track: legs(42) + `<path d="M15 12 L14 40 M33 12 L34 40" stroke="${w}" stroke-width="2"/>`,
    skirt: `<path d="M17 10 L31 10 L38 36 L10 36 Z" fill="${f}"/>`,
    overalls: legs(42) + `<path d="M16 2 L18 9 M32 2 L30 9" stroke="${f}" stroke-width="3"/>`,
    onepiece: dress, jumper: legs(42) + `<path d="M16 2 L18 9 M32 2 L30 9" stroke="${f}" stroke-width="3"/>`,
    gymset: tee + `<path d="M24 13 L24 39" stroke="${w}" stroke-width="2"/>`,
    pajama: tee + `<path d="M21 22 l1 2 2 0 -1.5 1.5 0.5 2 -2 -1 -2 1 0.5 -2 -1.5 -1.5 2 0Z" fill="#FFF3A3" stroke="none"/><path d="M28 30 l1 2 2 0 -1.5 1.5 0.5 2 -2 -1 -2 1 0.5 -2 -1.5 -1.5 2 0Z" fill="#FFF3A3" stroke="none"/>`,
    raincoat: dress,
    sneakers: shoe(8) + `<path d="M8 40 L40 40" stroke="${w}" stroke-width="3"/>`, boots: shoe(22), slippers: `<path d="M6 38 Q24 34 42 38 L42 41 L6 41 Z" fill="${f}"/><path d="M14 37 Q20 29 28 36" fill="none" stroke="${f}" stroke-width="4"/>`, loafers: shoe(6),
    cap: `<path d="M10 28 Q10 10 26 10 Q38 12 38 28 Z" fill="${f}"/><path d="M30 28 L46 30 L44 32 L30 31 Z" fill="${f}"/>`,
    beanie: `<path d="M10 32 Q10 12 24 12 Q38 12 38 32 Z" fill="${f}"/><rect x="9" y="30" width="30" height="6" rx="2" fill="${f}"/><circle cx="24" cy="9" r="4" fill="${w}"/>`,
    straw: `<ellipse cx="24" cy="32" rx="21" ry="6" fill="${f}"/><path d="M14 31 Q14 14 24 14 Q34 14 34 31 Z" fill="${f}"/><path d="M14 27 L34 27" stroke="#C0392B" stroke-width="3"/>`,
    crown: `<path d="M8 36 L8 16 L16 26 L24 12 L32 26 L40 16 L40 36 Z" fill="${f}"/><circle cx="24" cy="30" r="2.5" fill="#E2574C"/>`,
    headphones: `<path d="M10 30 Q10 8 24 8 Q38 8 38 30" fill="none" stroke="${f}" stroke-width="4"/><rect x="5" y="26" width="9" height="14" rx="3" fill="${f}"/><rect x="34" y="26" width="9" height="14" rx="3" fill="${f}"/>`,
    glasses: `<circle cx="15" cy="25" r="8" fill="none" stroke="${f}" stroke-width="2.5"/><circle cx="33" cy="25" r="8" fill="none" stroke="${f}" stroke-width="2.5"/><path d="M23 24 L25 24" stroke="${f}" stroke-width="2.5"/>`,
    sunglasses: `<circle cx="15" cy="25" r="8" fill="#1E1E24" stroke="${f}" stroke-width="2.5"/><circle cx="33" cy="25" r="8" fill="#1E1E24" stroke="${f}" stroke-width="2.5"/><path d="M23 24 L25 24" stroke="${f}" stroke-width="2.5"/>`,
    ribbon: `<path d="M24 24 L8 14 L8 34 Z M24 24 L40 14 L40 34 Z" fill="${f}"/><circle cx="24" cy="24" r="4" fill="${f}"/>`,
    scarf: `<path d="M8 18 Q24 26 40 18 L40 25 Q24 33 8 25 Z" fill="${f}"/><path d="M28 27 L34 27 L33 42 L27 42 Z" fill="${f}"/>`,
    bag: `<rect x="12" y="14" width="24" height="26" rx="6" fill="${f}"/><path d="M18 14 Q24 4 30 14" fill="none"/><rect x="16" y="28" width="16" height="8" rx="2" fill="${f}"/>`,
  };
  return S(I[id] || tee);
}

/** 처음 옷 (예전 모습과 비슷하게: 하늘색 반팔 티) */
export const DEFAULT_OUTFIT = 'n';   // 아무것도 안 고르면 하늘색 반팔 티 (예전 기본 모습)
