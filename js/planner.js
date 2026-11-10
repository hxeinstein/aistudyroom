// 스터디플래너 이미지(캔버스) 렌더링 + 사진 저장
import {
  getState, getDay, sessionsWithLive, totalMs, subjectTotals, subjectById, animalById,
  dayStartTs, fmtHM, dDay, allSubjects,
} from './store.js';

export const W = 800;
export const H = 1130;
const FONT = '"Poor Story", "Sunflower", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "WenQuanYi Zen Hei", sans-serif';   // 플래너: 일기장 느낌 손글씨
const NAVY = '#1E3A8A';
const SLOT = 10 * 60 * 1000;

const f = (weight, size, style = '') => `${style} ${weight} ${size}px ${FONT}`.trim();

export async function ensureFonts() {
  if (!document.fonts || !document.fonts.load) return;
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(f(400, 16), '가나다ABC'),
        document.fonts.load(f(700, 16), '가나다ABC'),
        document.fonts.load(f(900, 16), 'ABC'),
        document.fonts.load('700 16px "Sunflower"', '가나다'),   // 주간·월간 리포트
      ]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* 폰트 로딩 실패시 기본 글꼴 */ }
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];

/** key(YYYY-MM-DD) 날의 플래너를 canvas에 그림 */
export function drawPlanner(canvas, key, scale = 2) {
  canvas.width = W * scale;
  canvas.height = H * scale;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.textBaseline = 'alphabetic';

  const st = getState();
  const day = getDay(key);
  const sessions = sessionsWithLive(key);
  const totals = subjectTotals(key);
  const animal = animalById(st.profile && st.profile.animal);

  // 배경 & 테두리
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#EFF6FF';
  ctx.fillRect(16, 16, W - 32, 124);
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, W - 24, H - 24);

  // 헤더
  ctx.fillStyle = '#1E40AF';
  ctx.font = f(900, 33);
  ctx.fillText('STUDY PLANNER', 50, 76);
  const [y, m, d] = key.split('-').map(Number);
  const wd = WEEK[new Date(y, m - 1, d).getDay()];
  ctx.fillStyle = '#475569';
  ctx.font = f(400, 16);
  ctx.fillText(`DATE: ${key} (${wd})`, 50, 110);

  ctx.font = `44px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(animal.emoji, 437, 96);
  ctx.textAlign = 'left';

  const exam = st.exam || {};
  const dd = dDay(exam.date, key);
  box(ctx, 480, 40, 122, 80, '#1D4ED8', (exam.name || '시험').slice(0, 8), dd || '—');
  box(ctx, 612, 40, 140, 80, '#10B981', 'TOTAL TIME', fmtHM(totalMs(key)));

  // 가운데 구분선
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 2;
  line(ctx, 397, 140, 397, H - 22);

  // ---- 왼쪽: 과목 ----
  let cy = 182;
  heading(ctx, 'SUBJECTS & HIGH-LIGHTS', 40, cy);
  cy += 28;
  // 오늘 쓴 과목 (예전 기록의 과목 id도 포함)
  const ids = [...new Set([...day.todos.map((t) => t.subject), ...Object.keys(totals)])];
  const order = allSubjects().map((x) => x.id);
  ids.sort((a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999));
  const used = ids.map((id) => subjectById(id));
  if (used.length === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = f(400, 14);
    ctx.fillText('아직 오늘 기록이 없어요', 40, cy + 18);
    cy += 40;
  }
  for (const s of used) {
    ctx.fillStyle = s.color;
    ctx.fillRect(40, cy, 100, 24);
    ctx.fillStyle = '#1F2937';
    ctx.font = f(700, 14);
    ctx.fillText(s.name, 152, cy + 17);
    ctx.fillStyle = '#64748B';
    ctx.font = f(400, 13);
    ctx.textAlign = 'right';
    ctx.fillText(totals[s.id] ? fmtHM(totals[s.id]) : '-', 370, cy + 17);
    ctx.textAlign = 'left';
    cy += 35;
  }

  // ---- 왼쪽: 할 일 ----
  cy += 30;
  heading(ctx, 'TO-DO LIST', 40, cy);
  cy += 30;
  const noteTop = 930;
  const todos = day.todos;
  if (todos.length === 0) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = f(400, 14);
    ctx.fillText('자리에 앉아 공부를 시작하면 자동으로 채워져요', 40, cy + 16);
  }
  let hidden = 0;
  for (const t of todos) {
    if (cy + 50 > noteTop - 10) { hidden++; continue; }
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = 2;
    ctx.strokeRect(41, cy, 20, 20);
    ctx.fillStyle = '#1F2937';
    ctx.font = f(400, 14);
    const sub = subjectById(t.subject);
    const label = clipText(ctx, `${sub.name} ${t.title}`, 290);
    ctx.fillText(label, 75, cy + 16);
    if (t.done) {
      ctx.fillStyle = '#3B82F6';
      ctx.fillRect(45, cy + 4, 12, 12);
      const w = ctx.measureText(label).width;
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      line(ctx, 70, cy + 11, Math.min(75 + w + 8, 380), cy + 11);
    }
    if (t.memo) {
      ctx.fillStyle = '#64748B';
      ctx.font = f(400, 11, 'italic');
      ctx.fillText(clipText(ctx, `└ ${t.memo}`, 285), 80, cy + 34);
    }
    cy += t.memo ? 55 : 40;
  }
  if (hidden) {
    ctx.fillStyle = '#94A3B8';
    ctx.font = f(400, 12);
    ctx.fillText(`+ ${hidden}개 더`, 75, noteTop - 14);
  }

  // ---- 왼쪽 아래: 한 줄 회고 ----
  heading(ctx, 'TODAY\'S NOTE', 40, noteTop + 6);
  roundRect(ctx, 40, noteTop + 22, 330, 140, 12);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.font = f(400, 14);
  if (day.note) {
    ctx.fillStyle = '#334155';
    wrap(ctx, day.note, 56, noteTop + 52, 300, 22, 5);
  } else {
    ctx.fillStyle = '#CBD5E1';
    ctx.fillText('오늘 하루 한 줄 회고', 56, noteTop + 52);
  }

  // ---- 오른쪽: 타임테이블 ----
  heading(ctx, 'TIME TABLE (10 Min Grid)', 420, 182);
  const gx = 428, gy = 210, cw = 52, ch = 34;
  const start = dayStartTs(key);
  const owner = slotOwners(sessions, start);

  for (let r = 0; r < 24; r++) {
    ctx.fillStyle = '#475569';
    ctx.font = f(700, 11);
    ctx.textAlign = 'right';
    ctx.fillText(String((r + 6) % 24).padStart(2, '0'), gx - 8, gy + r * ch + 21);
    ctx.textAlign = 'left';
    for (let c = 0; c < 6; c++) {
      const s = owner[r * 6 + c];
      if (s) {
        ctx.fillStyle = subjectById(s.subject).color;
        ctx.fillRect(gx + c * cw, gy + r * ch, cw, ch);
      }
    }
  }
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  for (let r = 0; r <= 24; r++) line(ctx, gx, gy + r * ch, gx + 6 * cw, gy + r * ch);
  for (let c = 0; c <= 6; c++) line(ctx, gx + c * cw, gy, gx + c * cw, gy + 24 * ch);

  // 칸 위 라벨 (세션이 시작되는 칸)
  const labeled = new Set();
  for (let i = 0; i < owner.length; i++) {
    const s = owner[i];
    if (!s || labeled.has(s.id)) continue; // 세션마다 첫 칸에만
    labeled.add(s.id);
    const r = Math.floor(i / 6), c = i % 6;
    const x = gx + c * cw + 5, yy = gy + r * ch + 21;
    ctx.save();
    ctx.beginPath();
    ctx.rect(gx + c * cw, gy + r * ch, (6 - c) * cw, ch);
    ctx.clip();
    const sub = subjectById(s.subject);
    ctx.font = f(700, 11);
    ctx.fillStyle = '#111827';
    ctx.fillText(sub.name, x, yy);
    const w = ctx.measureText(sub.name + ' ').width;
    ctx.font = f(400, 11);
    ctx.fillStyle = 'rgba(17,24,39,0.6)';
    ctx.fillText(s.title, x + w, yy);
    ctx.restore();
  }

  // 푸터
  ctx.fillStyle = '#94A3B8';
  ctx.font = f(400, 12);
  ctx.textAlign = 'right';
  const name = (st.profile && st.profile.name) || '';
  ctx.fillText(`AI STUDY ROOM · ${animal.emoji} ${name}`, gx + 6 * cw, gy + 24 * ch + 40);
  ctx.textAlign = 'left';
  return canvas;
}

/** 10분 칸마다 어떤 세션이 차지했는지 */
function slotOwners(sessions, start) {
  const n = 24 * 6;
  const best = new Array(n).fill(null);
  const amt = new Array(n).fill(0);
  for (const s of sessions) {
    const per = new Map();
    for (const [b, e] of s.segs) {
      const i0 = Math.max(0, Math.floor((b - start) / SLOT));
      const i1 = Math.min(n - 1, Math.floor((e - 1 - start) / SLOT));
      for (let i = i0; i <= i1; i++) {
        const ov = Math.min(e, start + (i + 1) * SLOT) - Math.max(b, start + i * SLOT);
        if (ov > 0) per.set(i, (per.get(i) || 0) + ov);
      }
    }
    // 3분 이상 공부한 칸을 칠하고, 너무 짧은 세션도 최소 한 칸은 표시
    let maxI = -1, maxV = 0;
    for (const [i, v] of per) {
      if (v > maxV) { maxV = v; maxI = i; }
      if (v >= 3 * 60000 && v > amt[i]) { amt[i] = v; best[i] = s; }
    }
    if (maxI >= 0 && !best[maxI]) { best[maxI] = s; amt[maxI] = maxV; }
  }
  return best;
}

function box(ctx, x, y, w, h, color, label, value) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = f(700, 12);
  ctx.fillText(label, x + 11, y + 21);
  let size = 22;
  ctx.font = f(800, size);
  while (ctx.measureText(value).width > w - 20 && size > 12) ctx.font = f(800, --size);
  ctx.fillText(value, x + 11, y + 62);
}

function heading(ctx, text, x, y) {
  ctx.fillStyle = NAVY;
  ctx.font = f(800, 18);
  ctx.fillText('♥ ' + text, x, y);
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function clipText(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > max) t = t.slice(0, -1);
  return t + '…';
}

function wrap(ctx, text, x, y, max, lh, maxLines) {
  const lines = [];
  for (const para of text.split('\n')) {
    let cur = '';
    for (const ch of para) {
      if (ctx.measureText(cur + ch).width > max) { lines.push(cur); cur = ch; } else cur += ch;
    }
    lines.push(cur);
  }
  lines.slice(0, maxLines).forEach((l, i) => ctx.fillText(l, x, y + i * lh));
}

/** 이미지로 저장 (가능하면 공유 시트 → 사진 앱에 저장, 아니면 다운로드) */
export async function savePlannerImage(key) {
  await ensureFonts();
  const canvas = drawPlanner(document.createElement('canvas'), key, 2);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const name = `study-planner-${key}.png`;
  const file = new File([blob], name, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: `스터디플래너 ${key}` });
      return 'shared';
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return 'downloaded';
}
