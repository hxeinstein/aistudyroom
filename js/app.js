import * as S from './store.js';
import { createWorld, seatName } from './world.js';
import { drawPlanner, ensureFonts, savePlannerImage } from './planner.js';
import { setSound, SOUNDS, sfx, setAmbience } from './sound.js';
import { initChat, openChat, hasSubjectFor } from './chat.js';
import { CONFIG } from './config.js';
import * as Office from './office.js';
import * as Room from './room.js';
import * as Board from './board.js';
import { initJoystick } from './joystick.js';
import { badWord } from './words.js';
import * as Sch from './school.js';
import { initWeather } from './weather.js';
import { drawReport, saveReportImage, shiftAnchor, periodDays } from './report.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const st = S.getState();
let world;
let wakeLock = null;

// ---------------- 시작 ----------------
function boot(skipOnboarding = false) {
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
      $('roomName').textContent = name === 'office' ? '교무실' : name === 'park' ? '🌿 쉼터' : '숲속 독서실';
      $('seatLabel').textContent = name === 'office' ? (Office.isTeacher() ? `${Office.teacherName()} 선생님` : '질문 코너의 챗봇에게 먼저 물어봐요') : name === 'park' ? '벤치에 앉거나 놀이기구를 눌러 봐요' : '자리를 골라 앉아보세요';
      Office.onArea(name);
      onParkArea(name);
      renderBar();
    },
    onOfficeSeat: (n, t) => Office.tapSeat(n, t),
    onRide: (r) => { renderBar(); if (r && r.stretch) startStretch(); else if (!r) stopStretch(); },
    onVend: () => openVend(),
    onSfx: (k) => sfx(k),
    confirmClosedOffice: () => Office.confirmClosed(),
  });
  initJoystick(world);
  initWeather(world, () => toast('❄️ 첫눈이에요! 쉼터에 나가 볼까?', 6000));
  startStats();
  startNotice();

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

  if (!st.profile && !skipOnboarding) openOnboarding();
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
  $('btnPark').onclick = () => {
    if (!S.isPaused()) togglePause();
    world.goToPark();
  };
  setInterval(checkParkTime, 30000);
  checkEvents();
  $('btnStop').onclick = openStop;
  $('btnAsk').onclick = () => openChat(currentRoomSubject());
  $('zIn').onclick = () => world.zoomBy(0.75);
  $('zOut').onclick = () => world.zoomBy(1.33);
  $('zReset').onclick = () => world.resetView();
  initChat({ onAskTeacher: (q) => Office.askTeacher(q), onNeedSchool: () => openSchoolGate(true) });
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
  bar.classList.toggle('hidden', studying && world.area === 'main');
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
  const inPark = world.area === 'park';
  const parkBar = world.onRide
    ? [
        { e: '🚶', t: world.onRide === 'slide' ? '미끄럼틀 타는 중' : '일어나기', main: true, fn: () => world.standUp() },
        { e: '📸', t: '사진', fn: takePhoto },
        { e: '🏠', t: '독서실로', fn: () => world.goOutOfPark() },
      ]
    : [
        ...(world.nearDoor === 'vend' ? [{ e: '🥤', t: '간식 고르기', main: true, fn: openVend }] : []),

        { e: '📸', t: '사진', fn: takePhoto },
        { e: '🏠', t: '독서실로', main: world.nearDoor === 'park-exit', fn: () => world.goOutOfPark() },
      ];
  if (inPark && Office.isTeacher()) parkBar.splice(0, parkBar.length, { e: '📥', t: unread ? `받은 대화 ${unread}` : '받은 대화', main: true, fn: () => Office.openInbox() }, { e: '🏠', t: '독서실로', fn: () => world.goOutOfPark() });
  if (!inPark && !inOffice && Office.isTeacher()) teacherBar.push({ e: '🌿', t: '쉼터 보기', fn: () => world.goToPark() });
  const btns = inPark
    ? parkBar
    : Office.isTeacher() && !nearBot
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
        ...(world.nearDoor === 'park' ? [{ e: '🌿', t: '쉼터 가기', main: true, fn: () => world.goToPark() }] : []),
        { e: '🪑', t: '빈자리 앉기', main: !world.nearDoor, fn: sitNearest },
        ...(world.nearDoor === 'park' ? [] : [{ e: '🌿', t: '쉼터', fn: () => world.goToPark() }]),
        { e: '📒', t: '플래너', fn: () => openPlanner(S.dayKey()) },
        { e: '🌙', t: '오늘 공부끝', fn: openFinish },
      ];
  // 손에 간식이 있으면 어디서든 먹기 · 내려놓기
  if (world.held && !studying && !Office.isTeacher()) btns.push(
    { e: '😋', t: '먹기', fn: eatSnack },
    { e: '🫳', t: '내려놓기', fn: () => { world.setHeld(''); renderBar(); Room.syncNow(); } },
  );
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
  if (x.ar === 'park') return `🌿 쉼터에서 쉬는 중${x.st && x.sj ? ' (' + x.sj + ')' : ''}`;
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

// ---------------- 공부 통계 보내기 (관리자 요약용, 이름 없이 기기 번호만) ----------------
async function post(body) {
  const res = await fetch(CONFIG.CHATBOT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ school: Sch.schoolCode(), ...body }) });
  return res.json();
}
function deviceId() {
  let id = '';
  try { id = localStorage.getItem('aistudyroom.device') || ''; } catch (e) {}
  if (!id) { id = Math.random().toString(36).slice(2) + Date.now().toString(36); try { localStorage.setItem('aistudyroom.device', id); } catch (e) {} }
  return id;
}
let lastStat = '';
function sendStat() {
  if (!CONFIG.CHATBOT_URL || Office.isTeacher()) return;
  const ms = Math.floor(S.totalMs() / 60000) * 60000;
  if (ms < 60000) return;
  const day = S.dayKey();
  if (lastStat === day + ':' + ms) return;
  lastStat = day + ':' + ms;
  const subjects = {};
  Object.entries(S.subjectTotals(day)).forEach(([id, v]) => { const n = S.subjectById(id).name; subjects[n] = (subjects[n] || 0) + v; });
  post({ action: 'stat.day', device: deviceId(), day, ms, subjects }).catch(() => { lastStat = ''; });
}
function startStats() {
  setTimeout(sendStat, 20000);
  setInterval(sendStat, 10 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') sendStat(); });
}

// ---------------- 공지 (관리자가 쓰면 모두의 화면 위에) ----------------
function startNotice() {
  if (!CONFIG.CHATBOT_URL) return;
  const load = async () => {
    let r;
    try { r = await post({ action: 'notice.get' }); } catch (e) { return; }
    showNotice(r && r.notice, r && r.id);
  };
  load();
  setInterval(load, 5 * 60 * 1000);
}
function showNotice(text, id) {
  let seen = '';
  try { seen = localStorage.getItem('aistudyroom.noticeSeen') || ''; } catch (e) {}
  $('noticeBar')?.remove();
  if (!text || seen === id) return;
  const bar = document.createElement('div');
  bar.id = 'noticeBar';
  bar.className = 'notice-bar';
  bar.innerHTML = `<span>📢 ${esc(text)}</span><button type="button" aria-label="닫기">✕</button>`;
  bar.querySelector('button').onclick = () => { try { localStorage.setItem('aistudyroom.noticeSeen', id); } catch (e) {} bar.remove(); };
  document.body.appendChild(bar);
}

// ---------------- 관리자: 독서실 요약 · 질문 통계 · 공지 ----------------
async function openSummary() {
  const m = openModal(`<h2>📈 독서실 요약</h2><div id="smBody"><p class="hint">불러오는 중…</p></div>
    <div class="foot"><button class="btn primary" id="smClose" type="button">닫기</button></div>`, { wide: true });
  m.querySelector('#smClose').onclick = closeModal;
  let r;
  try { r = await post({ action: 'office.admin', op: 'summary', token: Office.teacherToken() }); } catch (e) { r = { error: '연결하지 못했어요' }; }
  const box = m.querySelector('#smBody');
  if (!box) return;
  if (r.error) { box.innerHTML = `<p class="warn">${esc(r.error)}</p>`; return; }
  const h = (min) => (min >= 60 ? `${Math.floor(min / 60)}시간 ${min % 60}분` : `${min}분`);
  const online = Room.onlinePlayers().length;
  const maxW = Math.max(60, ...r.week.map((x) => x.min));
  const maxS = Math.max(1, ...r.subjects.map((x) => x.min));
  const maxQ = Math.max(1, ...r.questions.week.map((x) => x.n));
  const wd = ['일', '월', '화', '수', '목', '금', '토'];
  box.innerHTML = `
    <div class="sm-tiles">
      <div><small>지금 접속</small><b>${online}명</b></div>
      <div><small>오늘 공부한 학생</small><b>${r.today.students}명</b></div>
      <div><small>오늘 총 공부</small><b>${h(r.today.min)}</b></div>
      <div><small>오늘 챗봇 질문</small><b>${r.questions.today}개</b></div>
    </div>
    ${r.freshReports || r.freshSuggests ? `<p class="sm-alert">${r.freshReports ? `🚨 새 신고 ${r.freshReports}건 ` : ''}${r.freshSuggests ? `📮 새 건의 ${r.freshSuggests}건` : ''} — ⚙️ 설정에서 확인해 주세요</p>` : ''}
    <label class="lbl">최근 7일 독서실 전체 공부 시간</label>
    <div class="sm-week">${r.week.map((x) => { const d = new Date(x.day + 'T12:00:00'); return `<div class="sm-col" title="${x.day} · ${x.students}명 · ${h(x.min)}"><span class="sm-v">${x.min ? Math.round(x.min / 60) + 'h' : ''}</span><i style="height:${Math.max(x.min ? 4 : 0, (x.min / maxW) * 100)}%"></i><small>${wd[d.getDay()]}<br>${x.students}명</small></div>`; }).join('')}</div>
    <label class="lbl">오늘 많이 공부한 과목 (학생이 정한 과목 이름)</label>
    ${r.subjects.length ? r.subjects.map((x) => `<div class="sm-bar"><span>${esc(x.name)}</span><i><b style="width:${(x.min / maxS) * 100}%"></b></i><em>${h(x.min)}</em></div>`).join('') : '<p class="hint">아직 오늘 기록이 없어요</p>'}
    <label class="lbl">챗봇 질문 (최근 7일 · 교과별)</label>
    ${r.questions.week.length ? r.questions.week.map((x) => `<div class="sm-bar"><span>${esc(x.subject)}</span><i><b style="width:${(x.n / maxQ) * 100}%"></b></i><em>${x.n}개 <small>(오늘 ${x.today})</small></em></div>`).join('') : '<p class="hint">아직 질문이 없어요</p>'}
    <label class="lbl">많이 물어본 교과서 쪽 (최근 7일)</label>
    ${r.topPages.length ? `<ol class="sm-pages">${r.topPages.map((x) => `<li><b>${esc(x.subject)} ${x.page}쪽</b> <span>${esc(x.unit)}</span> <em>${x.n}번</em></li>`).join('')}</ol>` : '<p class="hint">교과서가 연결된 질문이 아직 없어요</p>'}
    <p class="hint">학생 이름과 질문 내용은 모으지 않아요. 기기마다 오늘 공부 시간과 과목별 시간, 챗봇이 찾은 교과서 쪽만 세요. (시트 '공부통계' · '질문통계' 탭)</p>`;
}
async function openNoticeEditor() {
  let cur = '';
  try { cur = (await post({ action: 'notice.get' })).notice || ''; } catch (e) {}
  const m = openModal(`<h2>📢 공지 띄우기</h2>
    <p class="desc">모든 학생 화면 위에 한 줄로 떠요. 학생이 ✕를 누르면 그 공지는 다시 안 떠요. 비우고 저장하면 공지를 내려요.</p>
    <input class="field" id="ntText" maxlength="120" placeholder="예: 오늘 밤 10시부터 교무실 상담을 쉬어요" value="${esc(cur)}" />
    <p class="hint">학생 화면에는 5분 안에 나타나요.</p>
    <div class="foot"><button class="btn ghost" id="ntOff" type="button">공지 내리기</button><button class="btn primary" id="ntGo" type="button">띄우기</button></div>`);
  const save = async (text) => {
    let r;
    try { r = await post({ action: 'office.admin', op: 'notice', token: Office.teacherToken(), text }); } catch (e) { r = { error: '연결하지 못했어요' }; }
    if (r.error) return toast(r.error);
    closeModal();
    toast(text ? '공지를 띄웠어요 📢' : '공지를 내렸어요');
    startNoticeOnce();
  };
  m.querySelector('#ntGo').onclick = () => save(m.querySelector('#ntText').value.trim());
  m.querySelector('#ntOff').onclick = () => save('');
}
async function startNoticeOnce() { try { const r = await post({ action: 'notice.get' }); showNotice(r.notice, r.id); } catch (e) {} }

// 선생님 설정: 캐릭터·과목 대신 선생님 일만
function openTeacherSettings() {
  const admin = Office.isAdmin();
  const m = openModal(`
    <h2>⚙️ ${esc(Office.teacherName())} 선생님${admin ? ' <small style="font-size:14px;color:var(--muted)">(관리자)</small>' : ''}</h2>
    <button class="btn primary block" id="tsInbox" type="button">📥 받은 대화</button>
    ${admin ? `
    <label class="lbl">관리자</label>
    <button class="btn soft block" id="tsSchools" type="button">🏫 학교 관리 <small>(지금: ${esc(Sch.schoolName() || '공개 방')})</small></button>
    <button class="btn soft block" id="tsSummary" type="button" style="margin-top:8px">📈 독서실 요약 · 질문 통계</button>
    <button class="btn soft block" id="tsNotice" type="button" style="margin-top:8px">📢 공지 띄우기</button>
    <button class="btn soft block" id="tsAdmin" type="button" style="margin-top:8px">🛠️ 관리자 메뉴 (신고 · 차단 · 선생님)</button>
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
    m.querySelector('#tsSummary').onclick = () => openSummary();
    m.querySelector('#tsSchools').onclick = () => openSchools();
    m.querySelector('#tsNotice').onclick = () => openNoticeEditor();
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
    ${CONFIG.CHATBOT_URL ? `<button class="btn ghost block" id="sSchool" type="button" style="margin-top:6px">${Sch.isGuest() || !Sch.school() ? '🏫 학교 코드 넣기 <small>(챗봇 · 교무실)</small>' : `🏫 ${esc(Sch.schoolName())} · 학교 바꾸기`}</button>` : ''}
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
  if (m.querySelector('#sSchool')) m.querySelector('#sSchool').onclick = () => openSchoolGate(true);
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
    ['aistudyroom.v1', 'aistudyroom.chatCodes', 'aistudyroom.device', 'aistudyroom.teacher', 'aistudyroom.school'].forEach((k) => {
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
    setTimeout(sendStat, 500);
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
      <button class="btn soft" id="pReport">📊 주간·월간</button>
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
  m.querySelector('#pReport').onclick = () => openReport('week', key);

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

// ---------------- 🌿 쉼터 ----------------
let parkSince = 0;
function onParkArea(name) {
  const inPark = name === 'park';
  document.body.classList.toggle('in-park', inPark);
  if (inPark) {
    parkSince = Date.now();
    const h = new Date().getHours();
    setAmbience(h >= 19 || h < 6 ? 'night' : 'day');
    if (S.activeSession() && !S.isPaused()) { S.pauseSession(); updatePauseUI(); Room.syncNow(); }
    if (S.activeSession()) toast('쉼터에 오면 휴식으로 바뀌어요 ☕ 쉬는 시간은 공부 시간에서 빠져요');
    return;
  }
  if (!parkSince) return;
  parkSince = 0;
  setAmbience(null);
  stopStretch();
  // 공부하던 중이면 내 자리로 돌아가기
  const a = S.getState().active;
  if (name === 'main' && a && !Office.isTeacher()) {
    setTimeout(() => {
      if (!world.walkToSeat(a.seat ?? -1)) sitNearest();
      toast('자리로 돌아가요. ▶ 다시 시작을 누르면 이어서 공부해요');
    }, 300);
  }
}
function checkParkTime() {
  if (world.area !== 'park' || !parkSince || Office.isTeacher()) return;
  if (Date.now() - parkSince < 30 * 60 * 1000 || $('modalWrap') && !$('modalWrap').classList.contains('hidden')) return;
  const m = openModal(`
    <div class="big-emoji">🌿</div>
    <h2 class="center">${S.fmtHM(Date.now() - parkSince)} 동안 쉬었어요</h2>
    <p class="desc center">충분히 쉬었다면 다시 공부하러 가 볼까?</p>
    <div class="foot" style="flex-direction:column">
      <button class="btn primary block" id="pkGo" type="button">📚 공부하러 가기</button>
      <button class="btn ghost block" id="pkMore" type="button">조금만 더 쉴래요 (15분)</button>
    </div>`, { dismiss: false });
  m.querySelector('#pkGo').onclick = () => { closeModal(); world.goOutOfPark(); };
  m.querySelector('#pkMore').onclick = () => { parkSince = Date.now() - 15 * 60 * 1000; closeModal(); };
}
const SNACKS = [['🥤', '탄산음료'], ['☕', '커피'], ['🧃', '주스'], ['🍵', '녹차'], ['🍦', '아이스크림'], ['🍪', '쿠키'], ['🍫', '초콜릿'], ['🍙', '주먹밥']];
function eatSnack() {
  const e = world.held;
  if (!e) return;
  sfx('sit');
  world.eatHeld(() => { renderBar(); Room.syncNow(); toast(`${e} 냠냠, 맛있었다! 😋`); });
}
function openVend() {
  const m = openModal(`
    <h2>🥤 간식 자판기</h2>
    <p class="desc">하나 고르면 손에 들고 다녀요. 친구들에게도 보여요.</p>
    <div class="vend-grid">${SNACKS.map(([e, n]) => `<button type="button" data-e="${e}"><span>${e}</span><small>${n}</small></button>`).join('')}</div>
    <div class="foot"><button class="btn ghost" id="vdNone" type="button">빈손으로</button><button class="btn primary" id="vdClose" type="button">닫기</button></div>`);
  m.querySelectorAll('[data-e]').forEach((b) => (b.onclick = () => {
    world.setHeld(b.dataset.e); sfx('vend'); closeModal(); renderBar(); Room.syncNow();
    toast(`${b.dataset.e} 맛있게 먹어요!`);
  }));
  m.querySelector('#vdNone').onclick = () => { world.setHeld(''); closeModal(); renderBar(); Room.syncNow(); };
  m.querySelector('#vdClose').onclick = closeModal;
}
// 스트레칭 벤치: 30초 안내
let stretchTimer = null;
const STRETCH = ['🙆 두 팔을 위로 쭉~ 기지개를 켜요', '🙂 목을 천천히 오른쪽으로… 왼쪽으로…', '🤷 어깨를 으쓱 올렸다가 툭 내려요', '✋ 손목을 빙글빙글 돌려요', '😮‍💨 숨을 크게 들이쉬고… 후~'];
function startStretch() {
  stopStretch();
  world.setStretch(true);
  const box = document.createElement('div');
  box.id = 'stretchBox'; box.className = 'stretch-box';
  document.body.appendChild(box);
  let i = 0;
  const show = () => {
    if (i >= STRETCH.length) { stopStretch(); toast('개운해졌어요! ✨'); return; }
    box.innerHTML = `<b>${STRETCH[i]}</b><small>${i + 1} / ${STRETCH.length}</small>`;
    i++;
    stretchTimer = setTimeout(show, 6500);
  };
  show();
}
function stopStretch() {
  clearTimeout(stretchTimer); stretchTimer = null;
  $('stretchBox')?.remove();
  world.setStretch(false);
}
// 사진 찍기: 화면 + 이름표 + 예쁜 틀
async function takePhoto() {
  try {
    sfx('shutter');
    const src = world.capture();
    const W = src.width, H = src.height, k = W / $('world').clientWidth;
    const padP = Math.round(28 * k), cap = Math.round(64 * k);
    const c = document.createElement('canvas');
    c.width = W + padP * 2; c.height = H + padP * 2 + cap;
    const g = c.getContext('2d');
    g.fillStyle = '#FFF8E9'; g.fillRect(0, 0, c.width, c.height);
    g.save(); g.beginPath(); g.roundRect(padP, padP, W, H, 18 * k); g.clip(); g.drawImage(src, padP, padP); g.restore();
    const box = $('world').getBoundingClientRect();
    g.font = `700 ${Math.round(13 * k)}px "Noto Sans KR", sans-serif`; g.textBaseline = 'middle';
    document.querySelectorAll('.name-tag').forEach((el) => {
      if (el.style.display === 'none' || el.classList.contains('hidden')) return;
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < box.top || r.top > box.bottom) return;
      const x = padP + (r.left - box.left) * k, y = padP + (r.top - box.top) * k, w = r.width * k, h = r.height * k;
      g.fillStyle = 'rgba(255,248,233,0.94)'; g.beginPath(); g.roundRect(x, y, w, h, h / 2); g.fill();
      g.fillStyle = '#3B2F25'; g.textAlign = 'center'; g.fillText(el.textContent.replace(/^나/, '나 ').slice(0, 40), x + w / 2, y + h / 2 + 1);
    });
    const d = new Date();
    g.fillStyle = '#6B4A2E'; g.textAlign = 'left'; g.font = `900 ${Math.round(22 * k)}px "Noto Sans KR", sans-serif`;
    g.fillText(`🌳 숲속 독서실 ${world.area === 'park' ? '쉼터' : ''}`, padP, H + padP + cap / 2 + padP / 2);
    g.textAlign = 'right'; g.fillStyle = '#7A6A5A'; g.font = `700 ${Math.round(16 * k)}px "Noto Sans KR", sans-serif`;
    g.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, c.width - padP, H + padP + cap / 2 + padP / 2);
    const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
    const name = `forest-photo-${d.getTime()}.png`;
    const file = new File([blob], name, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file], title: '숲속 독서실 사진' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('사진을 저장했어요 📸');
  } catch (e) { console.error(e); toast('사진을 찍지 못했어요'); }
}
// 특별한 날: 수능 날엔 별똥별이 많이
function checkEvents() {
  const today = S.dayKey();
  const ev = (CONFIG.EVENTS && CONFIG.EVENTS.suneung) || [];
  if (ev.includes(today)) {
    world.setMeteorRate(4);
    let seen = '';
    try { seen = localStorage.getItem('aistudyroom.event') || ''; } catch (e) {}
    if (seen !== 'suneung:' + today) {
      try { localStorage.setItem('aistudyroom.event', 'suneung:' + today); } catch (e) {}
      setTimeout(() => toast('🌠 수능 대박! 오늘 밤 쉼터에는 별똥별이 많이 떨어져요', 6000), 2500);
    }
  }
}

// ---------------- 주간 · 월간 리포트 ----------------
async function openReport(mode = 'week', anchor = S.dayKey()) {
  const m = openModal(`
    <div class="tabs"><button type="button" class="tab ${mode === 'week' ? 'on' : ''}" data-m="week">주간</button><button type="button" class="tab ${mode === 'month' ? 'on' : ''}" data-m="month">월간</button></div>
    <div class="planner-nav">
      <button class="icon-btn" id="rPrev" aria-label="이전">◀</button>
      <strong id="rTitle"></strong>
      <button class="icon-btn" id="rNext" aria-label="다음">▶</button>
    </div>
    <img class="planner-img" id="rImg" alt="공부 리포트" />
    <div class="foot">
      <button class="btn ghost" id="rBack">📒 플래너</button>
      <button class="btn blue" id="rSave">📸 사진으로 저장</button>
    </div>
    <p class="hint center">이 기기에 저장된 기록으로 만들어요.</p>`, { wide: true });
  const days = periodDays(mode, anchor);
  m.querySelector('#rTitle').textContent = mode === 'week' ? `${days[0].slice(5).replace('-', '/')} ~ ${days[6].slice(5).replace('-', '/')}` : `${days[0].slice(0, 7).replace('-', '년 ')}월`;
  m.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => openReport(b.dataset.m, anchor)));
  m.querySelector('#rPrev').onclick = () => openReport(mode, shiftAnchor(mode, anchor, -1));
  const next = shiftAnchor(mode, anchor, 1);
  m.querySelector('#rNext').disabled = periodDays(mode, next)[0] > S.dayKey();
  m.querySelector('#rNext').onclick = () => openReport(mode, next);
  m.querySelector('#rBack').onclick = () => openPlanner(S.dayKey());
  m.querySelector('#rSave').onclick = async () => {
    try { const r = await saveReportImage(mode, anchor); if (r === 'downloaded') toast('리포트 사진을 저장했어요 📸'); } catch (e) { toast('저장에 실패했어요. 이미지를 길게 눌러 저장해 보세요'); }
  };
  await ensureFonts();
  m.querySelector('#rImg').src = drawReport(document.createElement('canvas'), mode, anchor, 2).toDataURL('image/png');
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

// ---------------- 학교 정하기 (처음 한 번, 또는 ?school=코드 링크) ----------------
async function start() {
  if (!CONFIG.CHATBOT_URL) return boot();
  const want = (new URLSearchParams(location.search).get('school') || '').trim().toUpperCase();
  const cur = Sch.school();
  if (want && want !== (cur && cur.code)) {
    let r = null;
    try { r = await post({ action: 'school.check', code: want }); } catch (e) {}
    if (r && r.ok) {
      if (cur && cur.code && cur.code !== r.code) resetStudent();   // 다른 학교로 바꾸면 이 기기 기록은 새로
      Sch.setSchool(r);
      location.replace(location.pathname + location.hash);
      return;
    }
  }
  if (!cur) { boot(!st.profile); openSchoolGate(false); return; }
  if (cur.code) {
    // 학교 코드가 바뀌었거나 꺼졌는지 확인 (이름·기본 학교 여부도 새로)
    post({ action: 'school.check', code: cur.code }).then((r) => {
      if (r && r.ok) { if (r.code !== cur.code || r.def !== cur.def || r.name !== cur.name || JSON.stringify(r.weather || null) !== JSON.stringify(cur.weather || null)) { Sch.setSchool(r); if (r.def !== cur.def || !cur.weather !== !r.weather) location.reload(); } }
      else if (r && r.error) { Sch.setSchool(null); toast('학교 코드가 바뀌었어요. 새 학교 코드를 넣어 주세요', 5000); openSchoolGate(false); }
    }).catch(() => {});
  }
  boot();
}
function resetStudent() {
  ['aistudyroom.v1', 'aistudyroom.chatCodes', 'aistudyroom.goal'].forEach((k) => { try { localStorage.removeItem(k); } catch (e) {} });
}
/** 학교 코드 넣기 (canCancel: 설정에서 바꿀 때) */
function openSchoolGate(canCancel) {
  const m = openModal(`
    <div class="big-emoji">🏫</div>
    <h2 class="center">학교 코드를 넣어 주세요</h2>
    <p class="desc center">선생님이 알려 준 학교 코드예요.<br/>같은 학교 친구들끼리만 공부방에서 만나요.</p>
    <input class="field" id="scCode" maxlength="12" autocapitalize="characters" autocomplete="off" placeholder="학교 코드" style="text-align:center;font-size:20px;letter-spacing:2px" />
    <p class="c-gate-msg" id="scMsg"></p>
    <div class="foot">${canCancel ? '<button class="btn ghost" id="scCancel" type="button">그대로 둘래요</button>' : '<button class="btn ghost" id="scGuest" type="button">코드 없이 들어가기</button>'}<button class="btn primary" id="scGo" type="button">들어가기</button></div>
    ${canCancel ? '' : '<p class="hint center">코드 없이 들어가면 공개 공부방에서 타이머·플래너·쉼터를 쓸 수 있어요. 챗봇 선생님과 교무실은 학교 코드를 넣어야 써요. ⚙️ 설정에서 나중에 넣어도 돼요.</p>'}
    ${canCancel ? '<p class="hint center">다른 학교로 바꾸면 이 기기의 공부 기록은 새로 시작해요.</p>' : ''}`, { dismiss: !!canCancel });
  const go = async () => {
    const code = m.querySelector('#scCode').value.trim().toUpperCase();
    if (!code) return;
    m.querySelector('#scMsg').textContent = '확인 중…';
    let r = null;
    try { r = await post({ action: 'school.check', code }); } catch (e) { m.querySelector('#scMsg').textContent = '연결하지 못했어요. 인터넷을 확인해 주세요.'; return; }
    if (!r || !r.ok) { m.querySelector('#scMsg').textContent = (r && r.error) || '학교 코드가 맞지 않아요.'; return; }
    if (Sch.school() && Sch.school().code && Sch.school().code !== r.code) resetStudent();
    Sch.setSchool(r);
    location.reload();
  };
  m.querySelector('#scGo').onclick = go;
  if (m.querySelector('#scGuest')) m.querySelector('#scGuest').onclick = () => { Sch.setSchool({ guest: true }); location.reload(); };
  m.querySelector('#scCode').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) go(); });
  if (canCancel) m.querySelector('#scCancel').onclick = closeModal;
  setTimeout(() => m.querySelector('#scCode').focus(), 50);
}
// 관리자: 학교 관리
async function openSchools() {
  const m = openModal(`<h2>🏫 학교 관리</h2><div id="schBody"><p class="hint">불러오는 중…</p></div>
    <label class="lbl">새 학교 추가</label>
    <div class="row"><input class="field" id="schName" maxlength="30" placeholder="학교 이름 (예: 한빛고)" /><input class="field" id="schCode" maxlength="8" placeholder="코드 (비우면 자동)" style="max-width:130px" autocapitalize="characters" /></div>
    <button class="btn soft block" id="schAdd" type="button" style="margin-top:8px">➕ 학교 만들기</button>
    <p class="hint">학교마다 공부방·게시판·건의함·공지·통계·교무실 선생님·챗봇 교과가 따로예요. 챗봇 교과는 시트 '과목' 탭 J칸에 학교 코드를 적으면 그 학교에 보여요 (비우면 기본 학교(맨 위 학교) · 코드 없이 들어온 학생도 쪽수 없이 사용, *는 모든 학교). 그 학교 선생님 초대코드는 그 학교로 바꾼 뒤 🛠️ 관리자 메뉴 → 선생님에서 만들어요.</p>
    <div class="foot"><button class="btn primary" id="schClose" type="button">닫기</button></div>`, { wide: true });
  m.querySelector('#schClose').onclick = closeModal;
  const base = location.origin + location.pathname;
  const load = async () => {
    let r;
    try { r = await post({ action: 'office.admin', op: 'schools', token: Office.teacherToken() }); } catch (e) { r = { error: '연결하지 못했어요' }; }
    const box = m.querySelector('#schBody');
    if (!box) return;
    if (r.error) { box.innerHTML = `<p class="warn">${esc(r.error)}</p>`; return; }
    box.innerHTML = r.schools.map((s) => `
      <div class="adm-card ${s.on ? '' : 'off'} ${s.code === Sch.schoolCode() ? 'new' : ''}">
        <div class="adm-top"><b>${esc(s.name)}</b> <code>${esc(s.code)}</code>${s.def ? ' <small class="hint">기본 학교</small>' : ''}${s.code === Sch.schoolCode() ? '<span class="adm-st">지금 보는 학교</span>' : ''}</div>
        <div class="hint" style="margin:4px 0;word-break:break-all">${esc(base)}?school=${esc(s.code)}</div>
        <div class="adm-act">
          <button class="btn soft adm-mini" data-copy="${esc(s.code)}" type="button">🔗 링크 복사</button>
          ${s.code === Sch.schoolCode() ? '' : `<button class="btn soft adm-mini" data-view="${esc(s.code)}" data-name="${esc(s.name)}" type="button">👀 이 학교로 보기</button>`}
          ${s.def ? '' : `<button class="btn soft adm-mini" data-tog="${esc(s.code)}" data-on="${s.on ? 0 : 1}" type="button">${s.on ? '끄기' : '다시 켜기'}</button>`}
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-copy]').forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(`${base}?school=${b.dataset.copy}`); toast('링크를 복사했어요'); } catch (e) { toast('복사하지 못했어요. 위 주소를 길게 눌러 복사해 주세요'); } }));
    box.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => { const x = r.schools.find((y) => y.code === b.dataset.view); Sch.setSchool(x); location.reload(); }));
    box.querySelectorAll('[data-tog]').forEach((b) => (b.onclick = async () => {
      const on = b.dataset.on === '1';
      if (!on && !confirm('이 학교를 끌까요? 그 학교 코드로는 들어올 수 없게 돼요.')) return;
      const r2 = await post({ action: 'office.admin', op: 'toggleSchool', token: Office.teacherToken(), code: b.dataset.tog, on }).catch(() => ({ error: '연결하지 못했어요' }));
      if (r2.error) return toast(r2.error);
      load();
    }));
  };
  m.querySelector('#schAdd').onclick = async () => {
    const name = m.querySelector('#schName').value.trim();
    if (!name) return toast('학교 이름을 적어 주세요');
    const r = await post({ action: 'office.admin', op: 'addSchool', token: Office.teacherToken(), name, code: m.querySelector('#schCode').value.trim() }).catch(() => ({ error: '연결하지 못했어요' }));
    if (r.error) return toast(r.error);
    toast(`'${r.name}' 학교를 만들었어요 · 코드 ${r.code}`);
    m.querySelector('#schName').value = ''; m.querySelector('#schCode').value = '';
    load();
  };
  load();
}

start();
