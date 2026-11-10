// 주간 · 월간 리포트 (학생, 이 기기 기록으로) — 사진으로 저장할 수 있는 한 장짜리 그림
import * as S from './store.js';

const FONT = '"Sunflower", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "WenQuanYi Zen Hei", sans-serif';
const C = { bg: '#FFF8E9', card: '#FFFFFF', ink: '#3B2F25', sub: '#7A6A5A', muted: '#A8998A', grid: '#EFE4D2', bar: '#5FA55A', today: '#3F7F3B', brown: '#6B4A2E' };
const pad = (n) => String(n).padStart(2, '0');
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d); };
const WD = ['일', '월', '화', '수', '목', '금', '토'];

/** mode: 'week' | 'month', anchor: 그 기간 안의 아무 날짜 키 */
export function periodDays(mode, anchor) {
  const a = dateOf(anchor);
  let start, n;
  if (mode === 'week') { start = new Date(a); start.setDate(a.getDate() - ((a.getDay() + 6) % 7)); n = 7; }   // 월요일부터
  else { start = new Date(a.getFullYear(), a.getMonth(), 1); n = new Date(a.getFullYear(), a.getMonth() + 1, 0).getDate(); }
  return Array.from({ length: n }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return keyOf(d); });
}
export function shiftAnchor(mode, anchor, dir) {
  const a = dateOf(anchor);
  if (mode === 'week') a.setDate(a.getDate() + 7 * dir); else a.setMonth(a.getMonth() + dir, 1);
  return keyOf(a);
}
function fmt(ms) { const m = Math.round(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; }
function short(ms) { const m = Math.round(ms / 60000); return m >= 60 ? `${(m / 60).toFixed(m >= 600 ? 0 : 1)}h` : `${m}m`; }

export function drawReport(canvas, mode, anchor, scale = 2) {
  const today = S.dayKey();
  const days = periodDays(mode, anchor);
  const vals = days.map((k) => (k > today ? null : S.totalMs(k)));
  const subj = {};
  days.forEach((k) => { if (k <= today) Object.entries(S.subjectTotals(k)).forEach(([id, ms]) => (subj[id] = (subj[id] || 0) + ms)); });
  const total = vals.reduce((a, v) => a + (v || 0), 0);
  const studied = vals.filter((v) => v >= 60000).length;
  const past = vals.filter((v) => v !== null).length;
  let best = -1; vals.forEach((v, i) => { if (v && (best < 0 || v > vals[best])) best = i; });
  const subjects = Object.entries(subj).filter(([, ms]) => ms >= 60000).sort((a, b) => b[1] - a[1]);

  const W = 720, H = 300 + 330 + Math.max(1, Math.min(subjects.length, 8)) * 46 + 110;
  canvas.width = W * scale; canvas.height = H * scale;
  const g = canvas.getContext('2d');
  g.scale(scale, scale);
  g.fillStyle = C.bg; g.fillRect(0, 0, W, H);
  const card = (x, y, w, h) => { g.fillStyle = C.card; g.beginPath(); g.roundRect(x, y, w, h, 22); g.fill(); };
  const text = (t, x, y, size, color = C.ink, weight = 700, align = 'left') => { g.font = `${weight} ${size}px ${FONT}`; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(t, x, y); };

  // 제목
  const first = dateOf(days[0]), last = dateOf(days[days.length - 1]);
  const title = mode === 'week' ? `${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일` : `${first.getFullYear()}년 ${first.getMonth() + 1}월`;
  text(mode === 'week' ? '📊 주간 리포트' : '📊 월간 리포트', 36, 58, 30, C.brown, 900);
  text(title, 36, 92, 18, C.sub, 700);
  text(`${(S.getState().profile || {}).name || ''}`, W - 36, 58, 18, C.sub, 700, 'right');

  // 숫자 카드 4개
  const tiles = [
    ['총 공부', fmt(total)],
    ['공부한 날', `${studied}일 / ${past}일`],
    ['하루 평균', fmt(past ? total / Math.max(1, studied) : 0)],
    ['가장 많이 한 날', best >= 0 ? `${dateOf(days[best]).getMonth() + 1}/${dateOf(days[best]).getDate()} · ${fmt(vals[best])}` : '-'],
  ];
  const tw = (W - 72 - 36) / 4;
  tiles.forEach(([k, v], i) => {
    const x = 36 + i * (tw + 12);
    card(x, 118, tw, 96);
    text(k, x + 16, 148, 14, C.sub, 700);
    let fs = 22;
    g.font = `900 ${fs}px ${FONT}`;
    while (fs > 12 && g.measureText(v).width > tw - 28) { fs -= 1; g.font = `900 ${fs}px ${FONT}`; }
    text(v, x + 16, 186, fs, C.ink, 900);
  });
  text(`🔥 ${S.streak()}일 연속 공부 중`, 36, 252, 18, C.brown, 800);

  // 날마다 막대 (한 가지 색, 오늘은 진하게)
  const cy = 280, ch = 300;
  card(36, cy, W - 72, ch);
  text('날마다 공부 시간', 56, cy + 36, 16, C.ink, 800);
  const px = 70, py = cy + 64, pw = W - 72 - 68, ph = ch - 120;
  const max = Math.max(3600000, ...vals.map((v) => v || 0));
  const stepH = max > 6 * 3600000 ? 2 : 1;                       // 눈금: 1시간(또는 2시간)마다
  const ticks = Math.ceil(max / 3600000 / stepH) * stepH;
  g.strokeStyle = C.grid; g.lineWidth = 1;
  for (let h = 0; h <= ticks; h += stepH) {
    const y = py + ph - (h / ticks) * ph;
    g.beginPath(); g.moveTo(px, y); g.lineTo(px + pw, y); g.stroke();
    text(`${h}h`, px - 10, y + 5, 12, C.muted, 700, 'right');
  }
  const n = days.length, slot = pw / n, bw = Math.max(4, Math.min(44, slot - 4));
  days.forEach((k, i) => {
    const d = dateOf(k), x = px + i * slot + (slot - bw) / 2, v = vals[i];
    if (v) {
      const h = Math.max(3, (v / (ticks * 3600000)) * ph);
      g.fillStyle = k === today ? C.today : C.bar;
      g.beginPath(); g.roundRect(x, py + ph - h, bw, h, [4, 4, 0, 0]); g.fill();
      if (mode === 'week' || i === best) text(short(v), x + bw / 2, py + ph - h - 6, 12, C.sub, 800, 'center');
    }
    const lab = mode === 'week' ? `${WD[d.getDay()]} ${d.getDate()}` : d.getDate() === 1 || d.getDate() % 5 === 0 ? `${d.getDate()}` : '';
    if (lab) text(lab, x + bw / 2, py + ph + 22, 12, k === today ? C.today : C.sub, k === today ? 900 : 700, 'center');
  });

  // 과목별 (과목 색 + 이름 + 시간을 함께 적어서 색만으로 구분하지 않음)
  const sy = cy + ch + 20, rows = Math.max(1, Math.min(subjects.length, 8));
  card(36, sy, W - 72, 60 + rows * 46);
  text('과목별 공부 시간', 56, sy + 36, 16, C.ink, 800);
  if (!subjects.length) text('아직 이 기간에 기록이 없어요', 56, sy + 82, 15, C.muted, 700);
  const smax = subjects.length ? subjects[0][1] : 1;
  subjects.slice(0, 8).forEach(([id, ms], i) => {
    const s = S.subjectById(id), y = sy + 58 + i * 46;
    text(s.name, 56, y + 20, 15, C.ink, 800);
    const bx = 200, bwid = W - 72 - 200 - 150;
    g.fillStyle = '#F4EBDD'; g.beginPath(); g.roundRect(bx, y + 4, bwid, 22, 6); g.fill();
    g.fillStyle = s.color || C.bar; g.beginPath(); g.roundRect(bx, y + 4, Math.max(8, (ms / smax) * bwid), 22, 6); g.fill();
    g.strokeStyle = 'rgba(107,74,46,0.25)'; g.lineWidth = 1; g.stroke();
    text(`${fmt(ms)} · ${Math.round((ms / Math.max(1, total)) * 100)}%`, W - 56, y + 21, 14, C.sub, 700, 'right');
  });
  if (subjects.length > 8) text(`그 밖에 ${subjects.length - 8}과목`, 56, sy + 58 + 8 * 46, 13, C.muted, 700);

  text('🌳 숲속 독서실', W / 2, H - 30, 14, C.muted, 700, 'center');
  return canvas;
}

export async function saveReportImage(mode, anchor) {
  const canvas = drawReport(document.createElement('canvas'), mode, anchor, 2);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const name = `study-report-${mode}-${periodDays(mode, anchor)[0]}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: '공부 리포트' }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
