// 교과서 넣기 (관리자) — PDF를 이 브라우저 안에서만 읽어 쪽마다 글자를 뽑고, 몇 쪽씩 나눠 시트에 넣어요.
import { CONFIG } from './config.js';
import * as pdfjs from '../vendor/pdfjs/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
const CMAP_URL = new URL('../vendor/pdfjs/cmaps/', import.meta.url).href;
const CHUNK = 12;          // 한 번에 보내는 쪽 수
const MAX_TEXT = 8000;     // 한 쪽에서 남길 최대 글자 수

const $ = (id) => document.getElementById(id);
const el = {
  pdf: $('pdf'), pdfInfo: $('pdfInfo'), subject: $('subject'), tab: $('tab'), room: $('room'), bot: $('bot'),
  register: $('register'), pdfPage: $('pdfPage'), bookPage: $('bookPage'), offsetInfo: $('offsetInfo'),
  preview: $('pagePreview'), toc: $('toc'), extract: $('extract'), upload: $('upload'), bar: $('bar'),
  status: $('status'), warn: $('warn'), done: $('done'), loginWarn: $('loginWarn'), loginBox: $('loginBox'),
};

let doc = null;       // pdf.js 문서
let rows = null;      // 뽑은 결과 [[쪽, 대단원, 소단원, 내용], ...]
let busy = false;

/* ---------- 관리자 확인 ---------- */
function teacher() { try { return JSON.parse(localStorage.getItem('aistudyroom.teacher') || 'null'); } catch (e) { return null; } }
let me = teacher();
let isAdmin = !!(me && me.token && me.me && me.me.admin);
if (!isAdmin) {
  el.loginBox.hidden = false;
  if (me) el.loginWarn.textContent = '지금 로그인한 선생님은 관리자가 아니에요. 관리자 초대코드로 로그인해 주세요.';
}
// 이 페이지에서 바로 로그인 (컴퓨터·휴대폰 어디서든)
$('lgBtn').addEventListener('click', async () => {
  const body = { action: 'office.login', code: $('lgCode').value, name: $('lgName').value, password: $('lgPw').value };
  el.loginWarn.textContent = '확인 중…';
  let r;
  try { r = await api(body); } catch (e) { el.loginWarn.textContent = '연결하지 못했어요. 인터넷을 확인해 주세요.'; return; }
  if (r.error) { el.loginWarn.textContent = r.error; return; }
  if (!r.me || !r.me.admin) { el.loginWarn.textContent = '관리자 초대코드로 가입한 선생님만 쓸 수 있어요.'; return; }
  me = { token: r.token, me: r.me };
  try { localStorage.setItem('aistudyroom.teacher', JSON.stringify(me)); } catch (e) {}
  isAdmin = true;
  el.loginBox.hidden = true;
  refreshButtons();
});

CONFIG.BOTS.forEach((b) => {
  const o = document.createElement('option');
  o.value = b.name; o.textContent = `${b.name} (${b.desc})`;
  el.bot.appendChild(o);
});

/* ---------- 도우미 ---------- */
function setProgress(done, total) { el.bar.style.width = total ? Math.round((done / total) * 100) + '%' : '0'; }
function status(t) { el.status.textContent = t || ''; }
function warn(t) { el.warn.textContent = t || ''; }
function offset() { return (Number(el.bookPage.value) || 0) - (Number(el.pdfPage.value) || 0); }
function refreshButtons() {
  el.extract.disabled = busy || !doc;
  el.upload.disabled = busy || !rows || !rows.length || !isAdmin;
}

async function pageText(n) {
  const page = await doc.getPage(n);
  const tc = await page.getTextContent();
  let out = '';
  for (const it of tc.items) {
    if (typeof it.str !== 'string') continue;
    out += it.str;
    out += it.hasEOL ? '\n' : (it.str && !/\s$/.test(it.str) ? ' ' : '');
  }
  page.cleanup();
  // 줄바꿈을 이어 붙여 문단처럼 (역학과 에너지 탭과 같은 모양)
  // 세로로 쓴 글자("포/트/폴/리 오")처럼 한두 글자짜리 줄이 이어지면 띄어쓰기 없이 붙임
  const lines = out.split('\n').map((l) => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean);
  let text = '';
  let prevShort = false;
  for (const l of lines) {
    const short = l.replace(/ /g, '').length <= 2 && /[가-힣]/.test(l);
    text += text && !(short && prevShort) ? ' ' : '';
    text += short ? l.replace(/ /g, '') : l;
    prevShort = short;
  }
  return text.replace(/ {2,}/g, ' ').trim().slice(0, MAX_TEXT);
}

/** 목차: "시작 쪽 | 대단원 | 소단원" — 시작 쪽을 ?로 두면 PDF에서 제목을 찾아 채움 (적은 순서대로) */
function parseToc() {
  const list = [];
  el.toc.value.split('\n').forEach((line) => {
    if (!line.includes('|')) return;
    const p = line.split('|').map((s) => s.trim());
    const start = parseInt(p[0], 10) || null;
    if (!p[1] && !p[2]) return;
    list.push({ start, unit: p[1] || '', section: p[2] || '' });
  });
  return list;
}
const norm = (t) => String(t).replace(/[^가-힣A-Za-z0-9]/g, '');
// 찾을 제목: 소단원의 마지막 부분(번호 빼고), 소단원이 '단원 도입'이거나 비면 대단원 이름
function tocKey(t) {
  const sec = t.section.split('›').pop().replace(/^\s*[\dⅠ-Ⅻ]+[.)]?\s*/, '');
  const useUnit = !sec || /단원\s*도입/.test(sec);
  return norm(useUnit ? t.unit.replace(/^\s*[Ⅰ-Ⅻ\d]+[.)]?\s*/, '') : sec);
}
/** 시작 쪽이 빈 줄을 찾아 채우기: pages = [{ page, text }] */
function resolveToc(toc, pages) {
  const keys = toc.map(tocKey).filter((k) => k.length >= 2);
  const normed = pages.map((p) => norm(p.text));
  // 여러 제목이 한꺼번에 나오는 쪽(성취기준 표·차례)은 소단원 시작으로 보지 않음
  const overview = normed.map((t) => keys.filter((k) => t.includes(k)).length >= 3);
  let prev = 0;
  const missing = [];
  toc.forEach((t) => {
    if (t.start) { prev = t.start; return; }
    const k = tocKey(t);
    const intro = !t.section || /단원\s*도입/.test(t.section);
    const ok = (i) => pages[i].page >= prev && (intro || !overview[i]);
    let i = k.length >= 2 ? pages.findIndex((p, j) => ok(j) && normed[j].slice(0, 160).includes(k)) : -1;
    if (i < 0 && k.length >= 2) i = pages.findIndex((p, j) => ok(j) && normed[j].includes(k));
    if (i >= 0) { t.start = pages[i].page; prev = t.start; t.found = true; } else missing.push(t);
  });
  return missing;
}
function tocFor(toc, page) {
  let hit = { unit: '', section: '' };
  for (const t of toc) { if (t.start && t.start <= page) hit = t; }
  return hit;
}

/* ---------- PDF 고르기 ---------- */
el.pdf.addEventListener('change', async () => {
  const f = el.pdf.files && el.pdf.files[0];
  doc = null; rows = null; warn(''); el.done.textContent = ''; setProgress(0, 0); refreshButtons();
  if (!f) return;
  el.pdfInfo.textContent = 'PDF를 여는 중이에요…';
  try {
    const data = new Uint8Array(await f.arrayBuffer());
    doc = await pdfjs.getDocument({ data, cMapUrl: CMAP_URL, cMapPacked: true }).promise;
  } catch (e) {
    el.pdfInfo.textContent = '';
    warn('PDF를 열지 못했어요. 암호가 걸렸거나 망가진 파일일 수 있어요.');
    return;
  }
  el.pdfInfo.textContent = `${f.name} · ${doc.numPages}장 · ${(f.size / 1048576).toFixed(1)}MB`;
  const base = f.name.replace(/\.pdf$/i, '').replace(/[^가-힣A-Za-z0-9 _()\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 20);
  if (!el.subject.value) el.subject.value = base;
  if (!el.tab.value) el.tab.value = ('교과서_' + base.replace(/ /g, '')).slice(0, 30);
  el.pdfPage.max = doc.numPages;
  // 표지·차례를 건너뛰어 글자가 넉넉한 장을 미리보기로
  for (let n = 1; n <= Math.min(doc.numPages, 15); n++) {
    const t = await pageText(n);
    if (t.length > 300) { el.pdfPage.value = n; break; }
  }
  refreshButtons();
  showPreview();
});

let previewSeq = 0;
async function showPreview() {
  const off = offset();
  el.offsetInfo.textContent = `PDF 1장 = 교과서 ${1 + off}쪽 으로 맞춰요. (${off >= 0 ? '+' : ''}${off})`;
  rows = null; refreshButtons();
  if (!doc) return;
  const n = Math.min(Math.max(1, Number(el.pdfPage.value) || 1), doc.numPages);
  const seq = ++previewSeq;
  const t = await pageText(n);
  if (seq !== previewSeq) return;
  el.preview.textContent = `[PDF ${n}장 → 교과서 ${n + off}쪽]\n` + (t || '(이 장에는 글자가 없어요. 그림이나 스캔한 쪽일 수 있어요.)');
}
el.pdfPage.addEventListener('input', showPreview);
el.bookPage.addEventListener('input', showPreview);
el.toc.addEventListener('input', () => { rows = null; refreshButtons(); });

/* ---------- ① 글자 뽑기 ---------- */
el.extract.addEventListener('click', async () => {
  if (!doc || busy) return;
  busy = true; rows = null; refreshButtons(); warn(''); el.done.textContent = '';
  const off = offset();
  const toc = parseToc();
  const pages = [];
  let empty = 0;
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      const page = n + off;
      if (page >= 1) {
        const text = await pageText(n);
        if (text.length < 20) empty++;
        else pages.push({ page, text });
      }
      if (n % 5 === 0 || n === doc.numPages) { setProgress(n, doc.numPages); status(`글자 뽑는 중… ${n} / ${doc.numPages}장`); }
    }
  } catch (e) {
    warn('글자를 뽑다가 멈췄어요: ' + (e && e.message));
  }
  // 시작 쪽이 비어 있는 목차는 PDF에서 제목을 찾아 채우고, 찾은 쪽을 목차 칸에 다시 적어 줌 (틀리면 고쳐서 다시 ①)
  const missing = resolveToc(toc, pages);
  if (toc.some((t) => t.found)) el.toc.value = toc.map((t) => `${t.start || '?'} | ${t.unit} | ${t.section}`).join('\n');
  const sorted = toc.filter((t) => t.start).sort((x, y) => x.start - y.start);
  const out = pages.map((p) => { const t = tocFor(sorted, p.page); return [p.page, t.unit, t.section, p.text]; });
  busy = false;
  rows = out;
  const chars = out.reduce((s, r) => s + r[3].length, 0);
  status(`${out.length}쪽을 뽑았어요 (글자 ${chars.toLocaleString()}자). 목차의 시작 쪽을 확인하고 ② 시트에 넣기를 눌러 주세요.`);
  const w = [];
  if (!out.length) w.push('글자가 하나도 없어요. 스캔한(사진으로 된) PDF라서 글자를 뽑을 수 없어요. 글자가 들어 있는 PDF를 골라 주세요.');
  else if (empty > doc.numPages * 0.4) w.push(`글자가 없는 장이 ${empty}장이나 돼요. 일부가 스캔본이면 그 쪽은 챗봇이 찾지 못해요.`);
  if (missing.length) w.push(`목차에서 시작 쪽을 못 찾은 줄이 ${missing.length}개 있어요 (?로 남음): ${missing.map((t) => (t.unit + " " + t.section).trim()).join(', ')} — 쪽 번호를 직접 적고 ①을 다시 눌러 주세요.`);
  warn(w.join(' '));
  if (sorted.length && out.length) {
    el.preview.textContent = sorted.map((t) => `${t.start}쪽 ${t.found ? '(찾음) ' : ''}· ${t.unit} · ${t.section}`).join('\n');
  }
  refreshButtons();
});

/* ---------- ② 시트에 넣기 ---------- */
async function api(body) {
  const res = await fetch(CONFIG.CHATBOT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

el.upload.addEventListener('click', async () => {
  if (!rows || !rows.length || busy || !isAdmin) return;
  const tab = el.tab.value.trim();
  const name = el.subject.value.trim();
  if (!/^[가-힣A-Za-z0-9 _()\-]{1,30}$/.test(tab)) return warn('탭 이름은 한글·영어·숫자로 30자 안에서 정해 주세요.');
  if (el.register.checked && !name) return warn('교과 이름을 적어 주세요.');
  if (!confirm(`시트에 '${tab}' 탭을 만들어 ${rows.length}쪽을 넣어요.\n같은 이름의 탭이 있으면 내용을 지우고 새로 넣어요. 할까요?`)) return;
  busy = true; refreshButtons(); warn(''); el.done.textContent = '';
  const total = Math.ceil(rows.length / CHUNK);
  let last = null;
  try {
    for (let i = 0; i < total; i++) {
      const isLast = i === total - 1;
      const body = { action: 'book.import', token: me.token, tab, start: i === 0, rows: rows.slice(i * CHUNK, (i + 1) * CHUNK) };
      if (isLast && el.register.checked) body.register = { name, room: el.room.value.trim(), bot: el.bot.value };
      let r = null;
      for (let tries = 0; tries < 3 && !r; tries++) {
        try { r = await api(body); } catch (e) { if (tries === 2) throw e; await new Promise((ok) => setTimeout(ok, 2000 * (tries + 1))); }
      }
      if (r && r.relogin) { el.loginBox.hidden = false; isAdmin = false; }
      if (!r || r.error) throw new Error((r && r.error) || '응답이 없어요');
      last = r;
      setProgress(i + 1, total);
      status(`시트에 넣는 중… ${Math.min((i + 1) * CHUNK, rows.length)} / ${rows.length}쪽`);
    }
    el.done.textContent = `다 넣었어요! '${tab}' 탭에 ${last.total}쪽` + (last.registered ? `, '과목' 탭에 '${name}' 등록 완료.` : '.');
    status('학생 화면에서 과목 이름에 연결 낱말이 들어가면 이 교과서로 안내해요.');
  } catch (e) {
    warn('넣다가 멈췄어요: ' + (e && e.message) + ' — 다시 ② 를 누르면 처음부터 다시 넣어요.');
  }
  busy = false;
  refreshButtons();
});

refreshButtons();
