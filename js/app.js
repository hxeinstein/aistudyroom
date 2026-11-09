import * as S from './store.js';
import { createWorld, seatName } from './world.js';
import { drawPlanner, ensureFonts, savePlannerImage } from './planner.js';
import { setSound, SOUNDS } from './sound.js';
import { initChat, openChat, hasSubjectFor } from './chat.js';
import { CONFIG } from './config.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const st = S.getState();
let world;
let wakeLock = null;

// ---------------- 시작 ----------------
function boot() {
  const profile = st.profile || { name: '', animal: 'bear' };
  world = createWorld($('world'), {
    animal: profile.animal,
    name: profile.name,
    onSit: (idx) => { $('seatLabel').textContent = `${seatName(idx)} 자리에 앉음`; renderBar(); if (!S.activeSession()) openStart(); },
    onStand: () => { $('seatLabel').textContent = '자리를 골라 앉아보세요'; renderBar(); },
    onToast: toast,
    mascotName: CONFIG.MASCOT_NAME,
    onMascot: () => openChat(currentRoomSubject()),
    onNearMascot: () => renderBar(),
  });

  // 진행 중이던 공부 복원 (새로고침/앱 전환)
  const a = st.active;
  if (a) {
    if (a.day !== S.dayKey()) {
      S.stopSession(false);
    } else if (world.restoreSeat(a.seat ?? 0)) {
      showStudy();
    } else {
      S.stopSession(false);
    }
  }

  if (!st.profile) openOnboarding();
  renderBar();
  refreshHud();
  setInterval(refreshHud, 1000);
  $('btnPlanner').onclick = () => openPlanner(S.dayKey());
  $('btnSettings').onclick = openSettings;
  $('btnSound').onclick = () => {
    const i = SOUNDS.findIndex((x) => x.id === soundMode());
    const next = SOUNDS[(i + 1) % SOUNDS.length];
    S.setSound(next.id);
    applySound();
    toast(`${next.icon} ${next.name}`);
  };
  $('btnPause').onclick = togglePause;
  $('btnStop').onclick = openStop;
  $('btnAsk').onclick = () => openChat(currentRoomSubject());
  initChat();
  // 다른 앱/화면을 보다 돌아와도 타이머는 계속 흐름 (태블릿으로 PDF·인강 보는 경우 등).
  // 막거나 감지하지 않고, 돌아왔을 때 안내만 한 번 보여줌.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    const studying = S.activeSession() && !S.isPaused();
    if (document.visibilityState === 'hidden') {
      hiddenAt = studying ? Date.now() : 0;
      return;
    }
    if (studying) keepAwake(true);
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    if (studying && away >= 60 * 1000) {
      toast(`다른 화면에 있던 ${S.fmtHM(away)}도 공부 시간에 포함됐어요 📚 (쉬었다면 ☕ 휴식을 눌러주세요)`, 5000);
    }
  });
  applySound(false);
}

// 예전 저장값(true/false) 호환
const soundMode = () => (st.sound === true ? 'rain' : st.sound || 'off');
function applySound(play = true) {
  const mode = soundMode();
  $('btnSound').textContent = SOUNDS.find((x) => x.id === mode).icon;
  $('btnSound').title = SOUNDS.find((x) => x.id === mode).name;
  if (play || mode === 'off') setSound(mode);
}
// 브라우저 정책상 소리는 첫 터치 후에 켤 수 있음
window.addEventListener('pointerdown', function once() {
  if (soundMode() !== 'off') setSound(soundMode());
  window.removeEventListener('pointerdown', once);
});

// 지금 공부 중인 과목 이름 (챗봇 교과 자동 선택용)
function currentRoomSubject() {
  const s = S.activeSession();
  return s ? S.subjectById(s.subject).name : null;
}

// ---------------- HUD / 행동 바 ----------------
function refreshHud() {
  $('todayTotal').textContent = S.fmtHM(S.totalMs());
  const s = S.activeSession();
  if (s) {
    $('studyTimer').textContent = S.fmtClock(S.activeElapsed());
    world.setPlayer({ name: st.profile?.name || '', status: S.isPaused() ? `☕ 쉬는 중` : `📚 ${S.subjectById(s.subject).name} 열공 중 · ${S.fmtHM(S.activeElapsed())}` });
  }
}

function renderBar() {
  const bar = $('actionbar');
  const seated = world.seated >= 0;
  const studying = !!S.activeSession();
  bar.classList.toggle('hidden', studying);
  const btns = seated
    ? [
        { e: '▶️', t: '공부 시작', main: true, fn: openStart },
        { e: '🚶', t: '일어나기', fn: () => world.standUp() },
        { e: '📒', t: '플래너', fn: () => openPlanner(S.dayKey()) },
        { e: '🌙', t: '오늘 공부끝', fn: openFinish },
      ]
    : [
        ...(world.nearMascot ? [{ e: '🐾', t: '뭉치에게 질문', main: true, fn: () => openChat(currentRoomSubject()) }] : []),
        { e: '🪑', t: '빈자리 앉기', main: !world.nearMascot, fn: sitNearest },
        { e: '📒', t: '플래너', fn: () => openPlanner(S.dayKey()) },
        { e: '🌙', t: '오늘 공부끝', fn: openFinish },
      ];
  bar.innerHTML = '';
  for (const b of btns) {
    const el = document.createElement('button');
    el.className = 'act' + (b.main ? ' main' : '');
    el.innerHTML = `<span class="e">${b.e}</span>${b.t}`;
    el.onclick = b.fn;
    bar.appendChild(el);
  }
}

function sitNearest() {
  const idx = world.nearestFreeSeat();
  if (idx < 0) return toast('빈자리가 없어요');
  world.walkToSeat(idx);
  toast(`${seatName(idx)} 자리로 가는 중… 🐾`);
}

let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), ms);
}

// ---------------- 모달 ----------------
function openModal(html, { wide = false, dismiss = true } = {}) {
  $('modal').className = 'modal' + (wide ? ' wide' : '');
  $('modal').innerHTML = html;
  $('modalWrap').classList.remove('hidden');
  $('modalWrap').onclick = (e) => { if (dismiss && e.target === $('modalWrap')) closeModal(); };
  return $('modal');
}
function closeModal() { $('modalWrap').classList.add('hidden'); }

function animalPicker(cur) {
  const a = S.animalById(cur);
  return `<div class="animals">${S.ANIMALS.map((x) => `<button type="button" class="animal-btn ${x.id === cur ? 'on' : ''}" data-a="${x.id}">${x.emoji}<small>${x.name}</small></button>`).join('')}</div>
    <div class="animal-trait" id="animalTrait">${a.emoji} <b>${a.name}</b> · ${a.trait}</div>`;
}
function bindAnimalPicker(root, onPick) {
  root.querySelectorAll('.animal-btn').forEach((b) => (b.onclick = () => {
    root.querySelectorAll('.animal-btn').forEach((x) => x.classList.toggle('on', x === b));
    const a = S.animalById(b.dataset.a);
    root.querySelector('#animalTrait').innerHTML = `${a.emoji} <b>${a.name}</b> · ${a.trait}`;
    onPick(b.dataset.a);
  }));
}

const RANDOM_NAMES = ['졸린 연필', '반짝 지우개', '열공 도토리', '느긋한 구름', '새벽 형광펜', '부지런 다람쥐', '조용한 책갈피', '말랑 노트'];

function openOnboarding() {
  let animal = 'bear';
  const name = RANDOM_NAMES[(Math.random() * RANDOM_NAMES.length) | 0];
  const m = openModal(`
    <div class="big-emoji">🌳📚</div>
    <h2 class="center">숲속 독서실에 오신 걸 환영해요</h2>
    <p class="desc center">자리에 앉아 공부를 시작하면<br/>오늘의 스터디플래너가 자동으로 채워져요.</p>
    <label class="lbl">닉네임</label>
    <input class="field" id="obName" maxlength="12" value="${esc(name)}" />
    <label class="lbl">내 캐릭터</label>
    ${animalPicker(animal)}
    <div class="foot"><button class="btn primary" id="obGo">입장하기 🚪</button></div>
    <p class="hint center">기록은 이 기기에만 저장돼요.</p>`, { dismiss: false });
  bindAnimalPicker(m, (a) => { animal = a; world.setPlayer({ animal: a }); });
  m.querySelector('#obGo').onclick = () => {
    const n = m.querySelector('#obName').value.trim() || name;
    S.setProfile({ name: n, animal });
    world.setPlayer({ animal, name: n });
    closeModal();
    toast('빈 책상을 눌러 앉거나 🪑 버튼을 눌러보세요');
  };
}

function openSettings() {
  const p = st.profile || { name: '', animal: 'bear' };
  let animal = p.animal;
  const m = openModal(`
    <h2>⚙️ 설정</h2>
    <label class="lbl">닉네임</label>
    <input class="field" id="sName" maxlength="12" value="${esc(p.name)}" />
    <label class="lbl">내 캐릭터</label>
    ${animalPicker(animal)}
    <label class="lbl">D-day (시험 이름 · 날짜)</label>
    <div class="row">
      <input class="field" id="sExam" maxlength="8" placeholder="수능 시험" value="${esc(st.exam?.name || '')}" />
      <input class="field" id="sDate" type="date" value="${esc(st.exam?.date || '')}" />
    </div>
    <button class="btn soft block" id="sSubjects" type="button" style="margin-top:14px">📚 내 과목 관리</button>
    <div class="foot">
      <button class="btn ghost" id="sClose">닫기</button>
      <button class="btn primary" id="sSave">저장</button>
    </div>
    <p class="hint">조작: 바닥을 눌러 이동 · 책상을 눌러 앉기 · 좌우로 끌어 시점 회전 · PC는 WASD/방향키</p>`);
  bindAnimalPicker(m, (a) => (animal = a));
  m.querySelector('#sClose').onclick = closeModal;
  m.querySelector('#sSubjects').onclick = () => openSubjects();
  m.querySelector('#sSave').onclick = () => {
    const name = m.querySelector('#sName').value.trim() || p.name || '익명';
    S.setProfile({ name, animal });
    S.setExam({ name: m.querySelector('#sExam').value.trim() || '시험', date: m.querySelector('#sDate').value });
    world.setPlayer({ animal, name });
    closeModal();
    refreshHud();
    toast('저장했어요');
  };
}

// ---------------- 내 과목 (이 기기에 저장) ----------------
function openSubjects(onDone) {
  let color = null;
  const m = openModal(`
    <h2>📚 내 과목</h2>
    <p class="desc">우리 학교 시간표의 과목을 추가해 주세요.<br/>이 기기에 저장돼서 다음에도 그대로 써요.</p>
    <div class="row">
      <input class="field" id="sbName" maxlength="12" placeholder="예: 물리학Ⅰ, 고급수학, 영어독해" />
      <button class="btn primary" id="sbAdd" type="button" style="flex:none">추가</button>
    </div>
    <div class="swatches" id="sbColors">${S.SUBJECT_COLORS.map((c) => `<button type="button" class="sw-btn" data-c="${c}" style="background:${c}" aria-label="색"></button>`).join('')}</div>
    <label class="lbl">추가한 과목</label>
    <div class="chips" id="sbList"></div>
    <div class="foot"><button class="btn primary" id="sbDone">완료</button></div>`);
  const input = m.querySelector('#sbName');
  const list = () => {
    const subs = S.getSubjects();
    m.querySelector('#sbList').innerHTML = subs.length
      ? subs.map((x) => `<span class="chip-btn on sub-chip" style="background:${x.color}">${esc(x.name)}<button type="button" class="sub-x" data-id="${x.id}" aria-label="${esc(x.name)} 빼기">✕</button></span>`).join('')
      : '<span class="hint">아직 없어요. 위에서 과목 이름을 적고 추가를 눌러 주세요.</span>';
    m.querySelectorAll('.sub-x').forEach((b) => (b.onclick = () => { S.hideSubject(b.dataset.id); list(); }));
  };
  const add = () => {
    if (!S.addSubject(input.value, color)) return input.focus();
    input.value = '';
    color = null;
    m.querySelectorAll('.sw-btn').forEach((x) => x.classList.remove('on'));
    list();
    input.focus();
  };
  m.querySelectorAll('.sw-btn').forEach((b) => (b.onclick = () => {
    color = b.dataset.c;
    m.querySelectorAll('.sw-btn').forEach((x) => x.classList.toggle('on', x === b));
  }));
  m.querySelector('#sbAdd').onclick = add;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) add(); });
  m.querySelector('#sbDone').onclick = () => {
    if (input.value.trim()) add();
    if (!S.getSubjects().length) return toast('과목을 하나 이상 추가해 주세요');
    closeModal();
    onDone && onDone();
  };
  list();
  setTimeout(() => input.focus(), 50);
}

// ---------------- 공부 시작 ----------------
function openStart() {
  if (world.seated < 0) return sitNearest();
  const subs = S.getSubjects();
  if (!subs.length) return openSubjects(openStart); // 처음 한 번: 과목부터 추가
  const open = S.openTodos();
  let pick = open.length ? open[open.length - 1].id : null;
  let subject = subs.some((x) => x.id === st.lastSubject) ? st.lastSubject : subs[0].id;
  const m = openModal(`
    <h2>✏️ 무엇을 공부할까요?</h2>
    <p class="desc">${seatName(world.seated)} 자리 · 시작을 누르면 시간이 자동으로 기록돼요</p>
    ${open.length ? `<label class="lbl">오늘 할 일에서 고르기</label>
      <div class="todo-pick">${open.map((t) => {
        const sub = S.subjectById(t.subject);
        return `<button class="todo-opt ${t.id === pick ? 'on' : ''}" data-id="${t.id}"><span class="sw" style="background:${sub.color}"></span><span><div class="t">${sub.name} · ${esc(t.title)}</div>${t.memo ? `<div class="m">└ ${esc(t.memo)}</div>` : ''}</span></button>`;
      }).join('')}</div>
      <div class="divider">또는 새로 추가</div>` : ''}
    <label class="lbl">과목</label>
    <div class="chips">${subs.map((s) => `<button type="button" class="chip-btn ${s.id === subject ? 'on' : ''}" data-s="${s.id}" style="background:${s.color}">${esc(s.name)}</button>`).join('')}<button type="button" class="chip-btn add-chip" id="stAddSub">＋ 과목</button></div>
    <label class="lbl">할 일</label>
    <input class="field" id="stTitle" maxlength="30" placeholder="예: 쎈 C단계 풀기" />
    <label class="lbl">세부 내용 <span style="font-weight:400">(선택)</span></label>
    <input class="field" id="stMemo" maxlength="40" placeholder="예: 30p ~ 35p 고난도 집중 해결" />
    <div class="foot">
      <button class="btn ghost" id="stCancel">나중에</button>
      <button class="btn primary" id="stGo">▶ 공부 시작</button>
    </div>`);
  const title = m.querySelector('#stTitle');
  const setPick = (id) => {
    pick = id;
    m.querySelectorAll('.todo-opt').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
  };
  m.querySelectorAll('.todo-opt').forEach((b) => (b.onclick = () => { setPick(b.dataset.id); title.value = ''; m.querySelector('#stMemo').value = ''; }));
  m.querySelector('#stAddSub').onclick = () => openSubjects(openStart);
  m.querySelectorAll('.chip-btn[data-s]').forEach((b) => (b.onclick = () => {
    subject = b.dataset.s;
    m.querySelectorAll('.chip-btn[data-s]').forEach((x) => x.classList.toggle('on', x === b));
    if (!title.value) setPick(null);
    title.focus();
  }));
  title.oninput = () => { if (title.value) setPick(null); };
  m.querySelector('#stCancel').onclick = closeModal;
  m.querySelector('#stGo').onclick = () => {
    let id = pick;
    if (title.value.trim()) {
      id = S.addTodo({ subject, title: title.value, memo: m.querySelector('#stMemo').value }).id;
    }
    if (!id) { title.focus(); return toast('할 일을 적거나 골라주세요'); }
    S.setLastSubject(S.getDay().todos.find((t) => t.id === id).subject);
    S.startSession(id, world.seated);
    closeModal();
    showStudy();
    toast('공부 시작! 스탠드를 켰어요 💡');
  };
}

function showStudy() {
  const s = S.activeSession();
  if (!s) return;
  const sub = S.subjectById(s.subject);
  $('studySubject').textContent = sub.name;
  $('studySubject').style.background = sub.color;
  $('studyTitle').textContent = s.title;
  // 이 과목이 챗봇 교과로 연결돼 있을 때만 '질문' 버튼 표시
  $('btnAsk').classList.add('hidden');
  hasSubjectFor(sub.name).then((ok) => { if (S.activeSession()?.id === s.id) $('btnAsk').classList.toggle('hidden', !ok); });
  $('studyPanel').classList.remove('hidden');
  updatePauseUI();
  renderBar();
  refreshHud();
}

function updatePauseUI() {
  const paused = S.isPaused();
  $('studyPanel').classList.toggle('paused', paused);
  $('btnPause').textContent = paused ? '▶ 다시 시작' : '☕ 잠깐 휴식';
  $('studySub').textContent = paused ? '휴식 중이에요 · 휴식 시간은 기록에서 빠져요' : '집중 중… 스탠드가 켜졌어요 💡';
  world.setStudying(!paused);
  keepAwake(!paused);
}

function togglePause() {
  if (S.isPaused()) S.resumeSession(); else S.pauseSession();
  updatePauseUI();
}

function openStop() {
  const s = S.activeSession();
  if (!s) return;
  const sub = S.subjectById(s.subject);
  const m = openModal(`
    <div class="big-emoji">${S.animalById(st.profile?.animal).emoji}</div>
    <h2 class="center">수고했어요!</h2>
    <div class="stat">${S.fmtHM(S.activeElapsed())}</div>
    <p class="desc center">「${sub.name} · ${esc(s.title)}」<br/>이 할 일을 다 끝냈나요?</p>
    <div class="foot" style="flex-direction:column">
      <button class="btn primary block" id="spDone">✔ 다 끝냈어요</button>
      <button class="btn soft block" id="spLater">다음에 이어서 할게요</button>
      <button class="btn ghost block" id="spBack">계속 공부하기</button>
    </div>`);
  const end = (done) => {
    S.stopSession(done);
    endStudyUI();
    closeModal();
    toast(done ? '할 일 완료! 플래너에 체크했어요 ✅' : '기록했어요. 다음에 이어서 해요');
  };
  m.querySelector('#spDone').onclick = () => end(true);
  m.querySelector('#spLater').onclick = () => end(false);
  m.querySelector('#spBack').onclick = closeModal;
}

function endStudyUI() {
  $('studyPanel').classList.add('hidden');
  world.setStudying(false);
  world.setPlayer({ name: st.profile?.name || '' });
  keepAwake(false);
  renderBar();
  refreshHud();
}

// ---------------- 오늘 공부끝 ----------------
function openFinish() {
  const key = S.dayKey();
  const day = S.getDay(key);
  const m = openModal(`
    <div class="big-emoji">🌙</div>
    <h2 class="center">오늘 공부 끝!</h2>
    <div class="stat">${S.fmtHM(S.totalMs(key))}</div>
    <p class="desc center">할 일 ${day.todos.filter((t) => t.done).length} / ${day.todos.length}개 완료</p>
    <label class="lbl">오늘 한 줄 회고 <span style="font-weight:400">(선택)</span></label>
    <textarea class="field" id="fnNote" maxlength="120" placeholder="예: 수학 오답 4개, 내일은 영어 단어부터!">${esc(day.note || '')}</textarea>
    <div class="foot">
      <button class="btn ghost" id="fnCancel">취소</button>
      <button class="btn blue" id="fnGo">📸 플래너 사진 저장</button>
    </div>`);
  m.querySelector('#fnCancel').onclick = closeModal;
  m.querySelector('#fnGo').onclick = async () => {
    S.finishDay(m.querySelector('#fnNote').value);
    world.standUp();
    renderBar();
    await openPlanner(key, true);
  };
}

// ---------------- 플래너 ----------------
async function openPlanner(key, autoSave = false) {
  const m = openModal(`
    <div class="planner-nav">
      <button class="icon-btn" id="pPrev">◀</button>
      <strong>📒 ${key} 스터디플래너</strong>
      <button class="icon-btn" id="pNext">▶</button>
    </div>
    <img class="planner-img" id="pImg" alt="스터디플래너" />
    <div class="todo-edit" id="pTodos"></div>
    <div class="foot">
      <button class="btn ghost" id="pClose">닫기</button>
      <button class="btn blue" id="pSave">📸 사진으로 저장</button>
    </div>
    ${st.exam && st.exam.date ? '' : '<p class="hint center">⚙️ 설정에서 시험 이름과 날짜를 넣으면 D-day가 나와요.</p>'}
    <p class="hint center" id="pHint">휴대폰에서는 공유 창의 '이미지 저장'을 누르거나, 플래너 이미지를 길게 눌러 사진첩에 저장할 수 있어요.</p>`, { wide: true });
  const shift = (d) => {
    const [y, mo, da] = key.split('-').map(Number);
    const dt = new Date(y, mo - 1, da + d);
    const nk = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    if (nk > S.dayKey()) return;
    openPlanner(nk);
  };
  m.querySelector('#pPrev').onclick = () => shift(-1);
  m.querySelector('#pNext').onclick = () => shift(1);
  m.querySelector('#pClose').onclick = closeModal;
  m.querySelector('#pSave').onclick = () => doSave(key);

  const img = m.querySelector('#pImg');
  const canvas = document.createElement('canvas');
  const redraw = () => { img.src = drawPlanner(canvas, key, 2).toDataURL('image/png'); };
  const renderTodos = () => {
    const day = S.getDay(key);
    const box = m.querySelector('#pTodos');
    box.innerHTML = day.todos.length ? day.todos.map((t) => `
      <label class="todo-row ${t.done ? 'done' : ''}">
        <input type="checkbox" data-id="${t.id}" ${t.done ? 'checked' : ''} />
        <span class="grow">${S.subjectById(t.subject).name} · ${esc(t.title)}</span>
        <button class="x" data-del="${t.id}" title="삭제">✕</button>
      </label>`).join('') : '';
    box.querySelectorAll('input').forEach((i) => (i.onchange = () => { S.toggleTodo(key, i.dataset.id); renderTodos(); redraw(); }));
    box.querySelectorAll('[data-del]').forEach((b) => (b.onclick = (e) => {
      e.preventDefault();
      if (!S.removeTodo(key, b.dataset.del)) toast('공부 기록이 있는 할 일은 지울 수 없어요');
      renderTodos(); redraw();
    }));
  };
  redraw();
  renderTodos();
  await ensureFonts();
  redraw();
  if (autoSave) doSave(key);
}

async function doSave(key) {
  try {
    const r = await savePlannerImage(key);
    if (r === 'downloaded') toast('플래너 사진을 저장했어요 📸');
    else if (r === 'shared') toast('공유 창에서 저장해 주세요 📸');
  } catch (e) {
    toast('저장에 실패했어요. 이미지를 길게 눌러 저장해 보세요');
    console.error(e);
  }
}

// ---------------- 화면 꺼짐 방지 ----------------
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* 지원 안 함 */ }
}

boot();
