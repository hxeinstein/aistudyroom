// 배경 소리 (Web Audio로 직접 합성 — 음원 파일 없음)
//  'white' : 부드러운 백색소음 (고음을 살짝 깎아 귀가 편한 소리)
//  'rain'  : 잔잔한 빗소리
export const SOUNDS = [
  { id: 'off', icon: '🔇', name: '소리 끄기' },
  { id: 'white', icon: '🌫️', name: '백색소음' },
  { id: 'rain', icon: '🌧️', name: '빗소리' },
];

let ctx = null;
const tracks = {};

function noiseBuffer(kind) {
  const len = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'white') {
        d[i] = white * 0.5;
      } else {
        last = (last + 0.02 * white) / 1.02; // 브라운 노이즈
        d[i] = last * 3.2 + (Math.random() < 0.0009 ? (Math.random() - 0.5) * 0.6 : 0); // 가끔 톡톡
      }
    }
  }
  return buf;
}

function track(kind) {
  if (tracks[kind]) return tracks[kind];
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(kind);
  src.loop = true;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = kind === 'white' ? 5200 : 1400;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start();
  return (tracks[kind] = g);
}

/** mode: 'off' | 'white' | 'rain' */
export function setSound(mode) {
  try {
    if (!ctx) {
      if (mode === 'off') return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    for (const k of ['white', 'rain']) {
      if (k !== mode && !tracks[k]) continue;
      const vol = k === 'white' ? 0.22 : 0.35;
      track(k).gain.setTargetAtTime(k === mode ? vol : 0, ctx.currentTime, 0.4);
    }
  } catch (e) { /* 오디오 미지원 */ }
}
