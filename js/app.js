import * as S from './store.js';
import { createWorld, seatName } from './world.js';
import { drawPlanner, ensureFonts, savePlannerImage } from './planner.js';
import { setSound, SOUNDS } from './sound.js';
import { initChat, openChat, hasSubjectFor } from './chat.js';
import { CONFIG } from './config.js';
import * as Office from './office.js';
import * as Room from './room.js';
import * as Board from './board.js';
import { initJoystick } from './joystick.js';
import { badWord } from './words.js';
import { initWeather } from './weather.js';

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
    onSit: async (idx) => {
      $('seatLabel').textContent = `${seatName(idx)} 자리에 앉음`;
      renderBar();
      // 실시간: 먼저 앉은 친구가 있으면 일어나기
      if (!(await Room.claimSeat(idx))) { if (!S.activeSession()) world.standUp(); return; }
      if (!S.activeSession()) openStart();
    },
    onStand: () => { $('seatLabel').textContent = '자리를 골라 앉아보세요'; renderBar(); Room.releaseSeat(); },
    onSpot: (spot) => (spot === 'board' ? Board.openBoard() : Board.openSuggest()),
    onRemoteTap: (uid, info) => (Office.isTeacher() ? Office.callStudent(uid, info.n, info.a) : openCheer(uid, info)),
    onToast: toast,
    bots: CONFIG.BOTS,
    onBot: (id) => openChat(currentRoomSubject(), id),
    onNearBot: () => renderBar(),
    onNearDoor: () => renderBar(),
    onArea: (name) => {
      $('roomName').textContent = name === 'office' ? '교무실' : '숲속 독서실';
      $('seatLabel').textContent = name === 'office' ? (Office.isTeacher() ? `${Office.teacherName()} 선생님` : '질문 코너의 챗봇에게 먼저 물어봐요') : '자리를 골라 앉아보세요';
      Office.onArea(name);
      renderBar();
    },
    onOfficeSeat: (n, t) => Office.tapSeat(n, t),
    confirmClosedOffice: () => Office.confirmClosed(),
  });
  initJoystick(world);
  initWeather(world);

  // 진행 중이던 공부 복원 (새로고침/앱 전환)
  const a = st.active;
  if (a) {
    if (a.day !== S.dayKey()) {
      S.stopSession(false, a.alive);   // 날이 바뀌었으면 마지막으로 켜져 있던 때까지만
    } else if (world.restoreSeat(a.seat ?? 0)) {
      showStudy();
      const gone = S.awayAfterClose();
      if (gone) setTimeout(() => askAway(gone.from, gone.ms, true), 600);
    } else {
      S.stopSession(false);
    }
  }

  if (!st.profile) openOnboarding();
  renderBar();
  refreshHud();
  setInterval(refreshHud, 1000);
  setInterval(() => { if (document.visibilityState === 'visible') S.touchAlive(); }, 15000);
  window.addEventListener('pagehide', () => { if (document.visibilityState === 'visible') S.touchAlive(); });
  $('btnPlanner').onclick = () => openPlanner(S.dayKey());
  $('btnSettings').onclick = openSettings;
  $('btnPeople').onclick = (e) => { e.stopPropagation(); togglePeople(); };
  setInterval(updatePeopleCount, 3000);
  $('btnSound').onclick = (e) => { e.stopPropagation(); toggleSoundMenu(); };
  $('btnPause').onclick = togglePause;
  $('btnStop').onclick = openStop;
  $('btnAsk').onclick = () => openChat(currentRoomSubject());
  $('zIn').onclick = () => world.zoomBy(0.75);
  $('zOut').onclick = () => world.zoomBy(1.33);
  $('zReset').onclick = () => world.resetView();
  initChat({ onAskTeacher: (q) => Office.askTeacher(q) });
  Office.initOffice({ world, toast, openModal, closeModal, renderBar: () => renderBar(), getProfile: () => st.profile || { name: '', animal: 'bear' }, onTeacherChange: () => { renderBar(); Room.syncNow(); }, onOpenSuggestAdmin: () => Board.openSuggestAdmin() });
  Board.initBoard({ world, toast, openModal, closeModal, getProfile: () => st.profile || { name: '익명', animal: 'bear' }, teacherToken: () => Office.teacherToken(), isAdmin: () => Office.isAdmin() });
  Room.initRoom({
    world, toast,
    isTeacher: () => Office.isTeacher(),
    onCall: (call) => Office.receiveCalls([call]),
    // 다른 사람에게 보이는 내 정보: 닉네임, 동물, 공부 중인 과목과 시간 (위치·자리는 world가 채움)
    getMe: () => {
      const s = S.activeSession();
      const el = s ? S.activeElapsed() : 0;
      return {
        n: st.profile?.name || '학생', a: st.profile?.animal || 'bear',
        sj: s ? S.subjectById(s.subject).name : '', st: !!s, ps: S.isPaused(), el: Math.floor(el / 60000) * 60000, // 1분 단위
        td: Math.floor(S.totalMs() / 60000) * 60000,   // 오늘 공부 시간 (순위용)
        rk: S.showInRank(), gl: S.getGoal(), sk: S.streak(),
      };
    },
  });
  Office.maybeEnterFromLink();
  if (new URLSearchParams(location.search).has('debug')) window.__room = { world, Office, Room }; // 시험용
  // 다른 앱/화면을 보다 돌아와도 타이머는 계속 흐름 (태블릿으로 PDF·인강 보는 경우 등).
  // 막거나 감지하지 않고, 돌아왔을 때 안내만 한 번 보여줌.
  let hiddenAt = 0;
  document.addEventListener('visibilitychange', () => {
    const studying = S.activeSession() && !S.isPaused();
    if (document.visibilityState === 'hidden') {
      hiddenAt = studying ? Date.now() : 0;
      if (studying) S.touchAlive();
      return;
    }
    if (studying) keepAwake(true);
    const away = hiddenAt ? Date.now() - hiddenAt : 0;
    hiddenAt = 0;
    if (studying && away >= 60 * 1000) askAway(Date.now() - away, away, false);
    else S.touchAlive();
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
// 소리 고르기: 아이콘 목록
function toggleSoundMenu() {
  let menu = $('soundMenu');
  if (menu) { menu.remove(); return; }
  menu = document.createElement('div');
  menu.id = 'soundMenu';
  menu.className = 'sound-menu';
  const cur = soundMode();
  menu.innerHTML = SOUNDS.map((x) => `<button type="button" class="${x.id === cur ? 'on' : ''}" data-s="${x.id}" title="${x.name}"><span>${x.icon}</span><small>${x.name.replace('소리 끄기', '끄기')}</small></button>`).join('');
  const r = $('btnSound').getBoundingClientRect();
  menu.style.top = r.bottom + 8 + 'px';
  menu.style.right = Math.min(Math.max(8, window.innerWidth - r.right - 60), Math.max(8, window.innerWidth - 336)) + 'px';
  document.body.appendChild(menu);
  menu.querySelectorAll('button').forEach((b) => (b.onclick = (e) => {
    e.stopPropagation();
    S.setSound(b.dataset.s);
    applySound();
    menu.remove();
  }));
  const close = (e) => { if (!menu.contains(e.target)) { menu.remove(); window.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => window.addEventListener('pointerdown', close, true), 0);
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
    world.setPlayer({ name: st.profile?.name || '', goal: S.getGoal(), status: S.isPaused() ? `☕ 쉬는 중` : `📚 ${S.subjectById(s.subject).name} 열공 중 · ${S.fmtHM(S.activeElapsed())}` });
  }
}

function renderBar() {
  const bar = $('actionbar');
  if (Office.isTeacher() && world.area === 'main') $('seatLabel').textContent = '👀 구경 중 · 공부 중인 학생을 누르면 말 걸기';
  else if (!Office.isTeacher() && world.area === 'main' && world.seated < 0) $('seatLabel').textContent = '자리를 골라 앉아보세요';
  const seated = world.seated >= 0;
  const studying = !!S.activeSession();
  bar.classList.toggle('hidden', studying);
  const inOffice = world.area === 'office';
  const unread = Office.isTeacher() ? Office.unreadCount() : 0;
  const nearBot = inOffice && world.nearBot ? CONFIG.BOTS.find((b) => b.id === world.nearBot) : null;
  const teacherBar = [
    { e: '📥', t: unread ? `받은 대화 ${unread}` : '받은 대화', main: true, fn: () => Office.openInbox() },
    Office.myDoorClosed()
      ? { e: '🔓', t: '문 열기', fn: () => Office.toggleDoor() }
      : { e: '🔒', t: '문 닫기', fn: () => Office.toggleDoor() },
    inOffice
      ? { e: '🚪', t: '나가기', fn: () => world.goOutOfOffice() }
      : { e: '🏫', t: '교무실 가기', fn: () => world.goToOffice() },
  ];
  const btns = Office.isTeacher() && !nearBot
    ? teacherBar
    : inOffice
    ? [
        ...(nearBot ? [{ e: '🐾', t: `${nearBot.name}에게 질문`, main: true, fn: () => openChat(currentRoomSubject(), nearBot.id) }] : []),
        ...(Office.isTeacher()
          ? [
              { e: '📥', t: unread ? `받은 대화 ${unread}` : '받은 대화', main: true, fn: () => Office.openInbox() },
              Office.myDoorClosed()
                ? { e: '🔓', t: '문 열기', fn: () => Office.toggleDoor() }
                : { e: '🔒', t: '문 닫기', fn: () => Office.toggleDoor() },
            ]
          : []),   // 선생님 로그인은 ⚙️ 설정에만
        { e: '🚪', t: '나가기', main: !Office.isTeacher() && world.nearDoor === 'exit', fn: () => world.goOutOfOffice() },
      ]
    : seated
    ? [
        { e: '▶️', t: '공부 시작', main: true, fn: openStart },
        { e: '🚶', t: '일어나기', fn: () => world.standUp() },
        { e: '📒', t: '플래너', fn: () => openPlanner(S.dayKey()) },
        { e: '🌙', t: '오늘 공부끝', fn: openFinish },
      ]
    : [
        ...(world.nearDoor === 'enter' ? [{ e: '🏫', t: '교무실 들어가기', main: true, fn: () => world.goToOffice() }] : []),
        ...(world.nearDoor === 'board' ? [{ e: '📌', t: '응원 게시판', main: true, fn: () => Board.openBoard() }] : []),
        ...(world.nearDoor === 'suggest' ? [{ e: '📮', t: '건의함', main: true, fn: () => Board.openSuggest() }] : []),
        { e: '🪑', t: '빈자리 앉기', main: !world.nearDoor, fn: sitNearest },
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

// 처음 들어오면 닉네임·캐릭터를 무작위로 (닉네임은 바꿀 수 없고, 캐릭터는 설정에서 바꿔요)
const NAME_A = ['졸린', '반짝', '열공', '느긋한', '새벽', '부지런', '조용한', '말랑', '씩씩한', '꼼꼼', '포근한', '용감한', '차분한', '든든한', '상큼한', '집중'];
const NAME_B = ['연필', '지우개', '도토리', '구름', '형광펜', '다람쥐', '책갈피', '노트', '솔방울', '단풍잎', '별똥별', '나뭇잎', '샤프', '포스트잇', '모과', '버섯'];
const pick = (a) => a[(Math.random() * a.length) | 0];
function randomName() { return `${pick(NAME_A)} ${pick(NAME_B)}`; }

function openOnboarding() {
  const animal = pick(S.ANIMALS).id;
  const name = randomName();
  const a = S.animalById(animal);
  S.setProfile({ name, animal });
  world.setPlayer({ animal, name });
  const m = openModal(`
    <div class="big-emoji">🌳📚</div>
    <h2 class="center">숲속 독서실에 오신 걸 환영해요</h2>
    <p class="desc center">자리에 앉아 공부를 시작하면<br/>오늘의 스터디플래너가 자동으로 채워져요.</p>
    <div class="ob-me">
      <div class="ob-emoji">${a.emoji}</div>
      <div><small>오늘부터 나는</small><strong>${esc(name)}</strong><span>${a.name} · ${a.trait}</span></div>
    </div>
    <div class="foot"><button class="btn primary" id="obGo">입장하기 🚪</button></div>
    <p class="hint center">닉네임은 자동으로 정해지고 바꿀 수 없어요. 캐릭터는 ⚙️ 설정에서 바꿀 수 있어요.<br/>기록은 이 기기에만 저장돼요.</p>`, { dismiss: false });
  m.querySelector('#obGo').onclick = () => {
    closeModal();
    toast('빈 책상을 눌러 앉거나 🪑 버튼을 눌러보세요');
  };
}


// ---------------- 지금 접속 중 (오른쪽 위 👥) ----------------
function fmtMin(ms) { const m = Math.floor(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; }
function studentStatus(x) {
  if (x.ar === 'office') return '🏫 교무실';
  if (x.st && !x.ps) return `📚 ${x.sj || '공부'} 열공 중 · ${fmtMin(x.el || 0)}`;
  if (x.st) return `☕ 쉬는 중${x.sj ? ' (' + x.sj + ')' : ''}`;
  return x.s >= 0 ? '🪑 자리에 앉음' : '🚶 둘러보는 중';
}
function updatePeopleCount() {
  const teachers = Office.teacherSeats().filter((t) => t.online).length;
  const students = Room.onlinePlayers().length + (Office.isTeacher() ? 0 : 1);
  $('peopleCount').textContent = students + teachers;
  if ($('peoplePanel')) renderPeople();
}
let peopleTab = 'now';
function showFollowBar(name) {
  $('followBar')?.remove();
  const bar = document.createElement('div');
  bar.id = 'followBar';
  bar.className = 'follow-bar';
  bar.innerHTML = `👀 <b>${esc(name)}</b> 따라가는 중 <button type="button">그만</button>`;
  bar.querySelector('button').onclick = () => world.stopFollow();
  document.body.appendChild(bar);
}
function togglePeople() {
  let panel = $('peoplePanel');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('div');
  panel.id = 'peoplePanel';
  panel.className = 'people-panel';
  document.body.appendChild(panel);
  renderPeople();
  const close = (e) => { if (!panel.contains(e.target) && e.target !== $('btnPeople')) { panel.remove(); window.removeEventListener('pointerdown', close, true); } };
  setTimeout(() => window.addEventListener('pointerdown', close, true), 0);
}
function renderPeople() {
  const panel = $('peoplePanel');
  if (!panel) return;
  const me = Office.isTeacher() ? null : { n: st.profile?.name || '나', a: st.profile?.animal || 'bear', ...world.getPlayerState(), sj: S.activeSession() ? S.subjectById(S.activeSession().subject).name : '', st: !!S.activeSession(), ps: S.isPaused(), el: S.activeSession() ? Math.floor(S.activeElapsed() / 60000) * 60000 : 0,
    td: Math.floor(S.totalMs() / 60000) * 60000, rk: S.showInRank(), gl: S.getGoal(), sk: S.streak() };
  const list = Room.onlinePlayers().map((x) => (x.gl && badWord(x.gl) ? { ...x, gl: '' } : x)).sort((x, y) => (y.st && !y.ps) - (x.st && !x.ps) || String(x.n).localeCompare(String(y.n)));
  const teachers = Office.teacherSeats().filter((t) => t.online);
  const row = (x, mine) => `
    <div class="pp-row">
      <span class="pp-ava">${S.animalById(x.a).emoji}</span>
      <span class="pp-main"><b>${esc(x.n)}${x.sk >= 2 ? ` <i class="pp-fire">🔥${x.sk}일</i>` : ''}${mine ? ' <i class="pp-me">나</i>' : ''}</b><small>${studentStatus(x)}${x.s >= 0 && x.ar !== 'office' ? ' · ' + seatName(x.s) : ''}</small>${x.gl ? `<small class="pp-goal">🎯 ${esc(x.gl)}</small>` : ''}</span>
      ${mine ? '' : `<button type="button" class="pp-btn" data-go="${esc(x.uid)}" title="찾아가기">📍</button>
      ${Office.isTeacher() ? `<button type="button" class="pp-btn ${world.following === x.uid ? 'on' : ''}" data-follow="${esc(x.uid)}" title="따라가기">👀</button>` : ''}
      <button type="button" class="pp-btn" data-act="${esc(x.uid)}" title="${Office.isTeacher() ? '말 걸기' : '응원 보내기'}">${Office.isTeacher() ? '💬' : '📣'}</button>`}
    </div>`;
  const tabs = `<div class="pp-tabs"><button type="button" class="${peopleTab === 'now' ? 'on' : ''}" data-pt="now">👥 접속 중</button><button type="button" class="${peopleTab === 'rank' ? 'on' : ''}" data-pt="rank">🏆 오늘 순위</button></div>`;
  let html;
  if (peopleTab === 'rank') {
    const ranked = (me ? [{ ...me, mine: true }] : []).concat(list).filter((x) => x.rk !== false && (x.td || 0) >= 60000).sort((x, y) => (y.td || 0) - (x.td || 0));
    html = tabs + `<div class="pp-sec">지금 접속한 친구들의 오늘 공부 시간</div>` + (ranked.length ? ranked.map((x, i) => `
      <div class="pp-row ${x.mine ? 'mine' : ''}"><span class="pp-rank">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="pp-ava">${S.animalById(x.a).emoji}</span>
        <span class="pp-main"><b>${esc(x.n)}${x.sk >= 2 ? ` <i class="pp-fire">🔥${x.sk}일</i>` : ''}${x.mine ? ' <i class="pp-me">나</i>' : ''}</b><small>${fmtMin(x.td || 0)}${x.gl ? ' · 🎯 ' + esc(x.gl) : ''}</small></span></div>`).join('')
      : '<p class="hint">아직 오늘 공부를 시작한 친구가 없어요</p>') +
      `<p class="hint">순위는 지금 접속한 친구만 보여요. ${me ? (S.showInRank() ? '내 이름을 순위에서 빼려면 ⚙️ 설정에서 끌 수 있어요.' : '나는 순위에서 빠져 있어요 (⚙️ 설정).') : ''}</p>`;
  } else html = tabs + `
    <div class="pp-head">👥 지금 접속 중 <span>학생 ${list.length + (me ? 1 : 0)} · 선생님 ${teachers.length}</span></div>
    ${teachers.length ? `<div class="pp-sec">선생님</div>` + teachers.map((t) => `
      <div class="pp-row"><span class="pp-ava">👩‍🏫</span><span class="pp-main"><b>${esc(t.name)} 선생님</b><small>${t.closed ? '🔒 시험 출제 중' : '🟢 상담 가능 · 교무실'}</small></span></div>`).join('') : ''}
    <div class="pp-sec">학생</div>
    ${me ? row(me, true) : ''}
    ${list.map((x) => row(x, false)).join('') || (me ? '' : '<p class="hint">지금 접속한 학생이 없어요</p>')}
    ${Room.ready() ? '' : '<p class="hint">실시간 연결이 안 돼서 나만 보여요</p>'}`;
  if (panel.dataset.html === html) return;   // 바뀐 게 없으면 그대로 (누르는 중에 버튼이 바뀌지 않게)
  panel.dataset.html = html;
  panel.innerHTML = html;
  panel.querySelectorAll('[data-pt]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); peopleTab = b.dataset.pt; renderPeople(); }));
  panel.querySelectorAll('[data-follow]').forEach((b) => (b.onclick = () => {
    const uid = b.dataset.follow;
    if (world.following === uid) { world.stopFollow(); panel.remove(); return; }
    const x = Room.onlinePlayers().find((y) => y.uid === uid);
    if (!world.startFollow(uid, (why) => {
      $('followBar')?.remove();
      if (why === 'office') toast('교무실로 가서 따라가기를 멈췄어요');
      else if (why === 'gone') toast('학생이 나가서 따라가기를 멈췄어요');
    })) return toast('지금은 따라갈 수 없어요');
    panel.remove();
    showFollowBar(x ? x.n : '학생');
  }));
  panel.querySelectorAll('[data-go]').forEach((b) => (b.onclick = () => {
    const r = world.goToRemote(b.dataset.go);
    if (r === 'office') toast('지금 교무실에 있어요');
    else if (r === 'main') toast('지금 공부방에 있어요');
    else if (r === 'gone') toast('방금 나갔어요');
    panel.remove();
  }));
  panel.querySelectorAll('[data-act]').forEach((b) => (b.onclick = () => {
    const x = Room.onlinePlayers().find((y) => y.uid === b.dataset.act);
    panel.remove();
    if (!x) return toast('방금 나갔어요');
    if (Office.isTeacher()) Office.callStudent(x.uid, x.n, x.a); else openCheer(x.uid, x);
  }));
}

// 선생님 설정: 캐릭터·과목 대신 선생님 일만
function openTeacherSettings() {
  const admin = Office.isAdmin();
  const m = openModal(`
    <h2>⚙️ ${esc(Office.teacherName())} 선생님${admin ? ' <small style="font-size:14px;color:var(--muted)">(관리자)</small>' : ''}</h2>
    <button class="btn primary block" id="tsInbox" type="button">📥 받은 대화</button>
    ${admin ? `
    <label class="lbl">관리자</label>
    <button class="btn soft block" id="tsAdmin" type="button">🛠️ 관리자 메뉴 (신고 · 차단 · 선생님)</button>
    <button class="btn soft block" id="tsSuggest" type="button" style="margin-top:8px">📮 건의함 보기</button>
    <button class="btn soft block" id="tsBook" type="button" style="margin-top:8px">📚 교과서 넣기 (컴퓨터 추천)</button>` : ''}
    <div class="foot">
      <button class="btn ghost" id="tsLogout" type="button">로그아웃</button>
      <button class="btn primary" id="tsClose" type="button">닫기</button>
    </div>
    <p class="hint">조작: 끌기 = 화면 옮기기 · 두 손가락 비틀기(PC는 오른쪽 버튼 끌기) = 돌리기 · 공부 중인 학생을 누르면 말 걸기</p>`);
  m.querySelector('#tsClose').onclick = closeModal;
  m.querySelector('#tsInbox').onclick = () => Office.openInbox();
  if (admin) {
    m.querySelector('#tsAdmin').onclick = () => Office.openAdminMenu();
    m.querySelector('#tsSuggest').onclick = () => Board.openSuggestAdmin();
    m.querySelector('#tsBook').onclick = () => window.open('book.html', '_blank', 'noopener');
  }
  m.querySelector('#tsLogout').onclick = () => { Office.logout(); closeModal(); toast('로그아웃했어요'); };
}

function openSettings() {
  if (Office.isTeacher()) return openTeacherSettings();
  const p = st.profile || { name: '', animal: 'bear' };
  let animal = p.animal;
  const m = openModal(`
    <h2>⚙️ 설정</h2>
    <label class="lbl">닉네임 <small style="color:var(--muted)">(바꿀 수 없어요)</small></label>
    <div class="field" style="background:var(--cream-2)">${esc(p.name)}</div>
    <label class="lbl">내 캐릭터</label>
    ${animalPicker(animal)}
    <label class="lbl">D-day (시험 이름 · 날짜)</label>
    <div class="row">
      <input class="field" id="sExam" maxlength="8" placeholder="수능 시험" value="${esc(st.exam?.name || '')}" />
      <input class="field" id="sDate" type="date" value="${esc(st.exam?.date || '')}" />
    </div>
    <label class="lbl">🎯 오늘의 목표 <small style="color:var(--muted)">(접속 중 목록에 보여요, 24자)</small></label>
    <input class="field" id="sGoal" maxlength="24" placeholder="예: 수학 3시간, 영단어 100개" value="${esc(S.getGoal())}" />
    <label class="glasses-tg" style="margin:10px 0 0"><input type="checkbox" id="sRank" ${S.showInRank() ? 'checked' : ''} /> 🏆 오늘 순위에 내 이름 보이기</label>
    <button class="btn soft block" id="sSubjects" type="button" style="margin-top:14px">📚 내 과목 관리</button>
    <button class="btn soft block" id="sTeacher" type="button" style="margin-top:8px">${Office.isTeacher() ? `📥 ${esc(Office.teacherName())} 선생님 · 받은 대화` : '👩‍🏫 선생님 로그인'}</button>
    <div class="foot">
      <button class="btn ghost" id="sClose">닫기</button>
      <button class="btn primary" id="sSave">저장</button>
    </div>
    <p class="hint">조작: 바닥을 눌러 이동 · 책상을 눌러 앉기 · 좌우로 끌어 시점 회전 · PC는 WASD/방향키</p>
    <button class="btn ghost block" id="sLeave" type="button" style="margin-top:6px">🚪 이 기기에서 나가기 <small>(공용 태블릿이면)</small></button>`);
  bindAnimalPicker(m, (a) => (animal = a));
  m.querySelector('#sClose').onclick = closeModal;
  m.querySelector('#sSubjects').onclick = () => openSubjects();
  m.querySelector('#sLeave').onclick = openLeave;
  m.querySelector('#sTeacher').onclick = () => (Office.isTeacher() ? Office.openInbox() : Office.openTeacherLogin());
  m.querySelector('#sSave').onclick = () => {
    const name = p.name || randomName();
    S.setProfile({ name, animal });
    S.setExam({ name: m.querySelector('#sExam').value.trim() || '시험', date: m.querySelector('#sDate').value });
    const goal = m.querySelector('#sGoal').value.trim();
    if (badWord(goal)) return toast('목표에 쓸 수 없는 말이 있어요');
    S.setGoal(goal);
    world.setPlayer({ name, goal });
    S.setShowInRank(m.querySelector('#sRank').checked);
    Room.syncNow();
    world.setPlayer({ animal, name });
    closeModal();
    refreshHud();
    toast('저장했어요');
  };
}

// ---------------- 이 기기에서 나가기 (공용 태블릿) ----------------
// 누르지 않으면 지금처럼 계속 이 기기에 남아 있어요.
function openLeave() {
  const m = openModal(`
    <h2>🚪 이 기기에서 나가기</h2>
    <p class="desc">닉네임·캐릭터·과목·공부 기록·플래너가 <b>이 기기에서 지워지고</b> 처음 화면으로 돌아가요.<br/>
      다음 친구가 새로 시작할 수 있어요. 지운 기록은 되돌릴 수 없으니, 오늘 플래너를 먼저 사진으로 저장해 두세요.</p>
    <button class="btn soft block" id="lvSave" type="button">📸 오늘 플래너 먼저 저장하기</button>
    <div class="foot">
      <button class="btn ghost" id="lvCancel">그냥 둘래요</button>
      <button class="btn primary" id="lvGo" style="background:#D9785B;box-shadow:0 4px 0 #A9553B">나가기</button>
    </div>`);
  m.querySelector('#lvCancel').onclick = closeModal;
  m.querySelector('#lvSave').onclick = () => doSave(S.dayKey());
  m.querySelector('#lvGo').onclick = async () => {
    m.querySelector('#lvGo').disabled = true;
    try { await Room.releaseSeat(); } catch (e) {}
    if (Office.isTeacher()) Office.logout(true);
    ['aistudyroom.v1', 'aistudyroom.chatCodes', 'aistudyroom.device', 'aistudyroom.teacher'].forEach((k) => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    location.replace(location.pathname);
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
    Room.syncNow();
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
  document.body.classList.add('studying');
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
  Room.syncNow();
}

// 독서실을 떠나 있다 돌아오면: 그동안 공부했는지 쉬었는지 고르기
function askAway(from, ms, closed) {
  if (!S.activeSession() || S.isPaused()) return;
  const m = openModal(`
    <div class="big-emoji">👀</div>
    <h2 class="center">그동안 뭐 했어?</h2>
    <p class="desc center">${closed ? '독서실 화면을 닫았다가' : '다른 화면에 갔다가'} <b>${S.fmtHM(ms)}</b> 만에 돌아왔어요.</p>
    <div class="foot" style="flex-direction:column">
      <button class="btn primary block" id="awStudy">📚 공부했어요 <small>(공부 시간에 넣기)</small></button>
      <button class="btn soft block" id="awRest">☕ 쉬었어요 <small>(공부 시간에서 빼기)</small></button>
    </div>`, { dismiss: false });
  m.querySelector('#awStudy').onclick = () => { S.touchAlive(); closeModal(); toast('공부 시간에 넣었어요 📚'); };
  m.querySelector('#awRest').onclick = () => {
    S.excludeAway(from, Date.now());
    closeModal(); refreshHud();
    toast(`${S.fmtHM(ms)}은 공부 시간에서 뺐어요 ☕`);
  };
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
  setTimeout(() => Room.syncNow(), 0);
  $('studyPanel').classList.add('hidden');
  document.body.classList.remove('studying');
  world.setStudying(false);
  world.setPlayer({ name: st.profile?.name || '' });
  keepAwake(false);
  renderBar();
  refreshHud();
}

// ---------------- 친구에게 응원 ----------------
const CHEERS = ['👏', '💪', '🔥', '😊', '🍀', '⭐'];
function openCheer(uid, info) {
  const m = openModal(`
    <div class="big-emoji">${S.animalById(info.a).emoji}</div>
    <h2 class="center">${esc(info.n)}</h2>
    <p class="desc center">${info.st && !info.ps ? `📚 ${esc(info.sj || '공부')} 열공 중` : info.st ? '☕ 쉬는 중' : '독서실에 함께 있어요'}<br/>응원을 보내 볼까요? (채팅은 할 수 없어요)</p>
    <div class="cheers">${CHEERS.map((e) => `<button type="button" class="cheer-btn" data-e="${e}">${e}</button>`).join('')}</div>
    <div class="foot"><button class="btn ghost" id="chClose" type="button">닫기</button></div>`);
  m.querySelector('#chClose').onclick = closeModal;
  m.querySelectorAll('.cheer-btn').forEach((b) => (b.onclick = () => {
    Room.sendCheer(uid, b.dataset.e, st.profile?.name);
    closeModal();
    toast(`${info.n}에게 ${b.dataset.e} 응원을 보냈어요`);
  }));
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
