// 잔잔한 빗소리 (Web Audio로 직접 합성 — 음원 파일 없음)
let ctx = null;
let gain = null;

function build() {
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // 브라운 노이즈
      d[i] = last * 3.2 + (Math.random() < 0.0009 ? (Math.random() - 0.5) * 0.6 : 0); // 가끔 톡톡
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1400;
  gain = ctx.createGain();
  gain.gain.value = 0;
  src.connect(lp).connect(gain).connect(ctx.destination);
  src.start();
}

export function setRain(on) {
  try {
    if (!ctx) { if (!on) return; build(); }
    if (ctx.state === 'suspended') ctx.resume();
    gain.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.4);
  } catch (e) { /* 오디오 미지원 */ }
}
