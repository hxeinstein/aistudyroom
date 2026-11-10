// 휴대폰·태블릿용 화면 조이스틱 (왼쪽 아래). 학생 캐릭터를 손가락으로 움직여요.
export function initJoystick(world) {
  const base = document.createElement('div');
  base.className = 'joy';
  base.innerHTML = '<div class="joy-knob"></div>';
  document.body.appendChild(base);
  const knob = base.firstChild;
  let id = null, cx = 0, cy = 0;
  const R = 44; // 손잡이가 움직이는 반지름(px)
  const move = (e) => {
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx *= R / d; dy *= R / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.hypot(dx, dy) / R;
    if (m < 0.15) world.setStick(0, 0);
    else world.setStick(dx / R, dy / R);
  };
  const end = () => {
    id = null;
    base.classList.remove('on');
    knob.style.transform = '';
    world.setStick(0, 0);
  };
  base.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const r = base.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    id = e.pointerId;
    base.setPointerCapture(id);
    base.classList.add('on');
    move(e);
  });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === id) { e.preventDefault(); move(e); } });
  base.addEventListener('pointerup', (e) => { if (e.pointerId === id) end(); });
  base.addEventListener('pointercancel', (e) => { if (e.pointerId === id) end(); });
  base.addEventListener('lostpointercapture', () => { if (id !== null) end(); });
}
