// 배경 소리 (Web Audio로 직접 합성 — 음원 파일 없음)
//  'white' : 부드러운 백색소음 (고음을 살짝 깎아 귀가 편한 소리)
//  'rain'  : 잔잔한 빗소리
//  'fire'  : 타닥타닥 모닥불
//  'stream': 졸졸 시냇물 + 가끔 똑 물방울
export const SOUNDS = [
  { id: 'off', icon: '🔇', name: '소리 끄기' },
  { id: 'white', icon: '🌫️', name: '백색소음' },
  { id: 'rain', icon: '🌧️', name: '빗소리' },
  { id: 'fire', icon: '🔥', name: '모닥불' },
  { id: 'stream', icon: '🏞️', name: '시냇물' },
];
const KINDS = ['white', 'rain', 'fire', 'stream'];
const VOL = { white: 0.22, rain: 0.35, fire: 0.5, stream: 0.45 };

// 시냇물: 잔잔한 물살 + 작은 물방울(올라가는 짧은 음)이 잔뜩 = 졸졸, 가끔 크고 맑은 '똑'
function streamBuffer() {
  const sr = ctx.sampleRate;
  const len = sr * 16;
  const buf = ctx.createBuffer(2, len, sr);
  const bubble = (d, at, f0, rise, dur, amp) => {
    let ph = 0;
    for (let k = 0; k < dur && at + k < len; k++) {
      const t = k / dur;
      ph += (2 * Math.PI * f0 * (1 + rise * t)) / sr;
      const env = Math.min(1, k / (sr * 0.002)) * Math.exp(-t * 5);
      d[at + k] += Math.sin(ph) * amp * env;
    }
  };
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    // 물살: 핑크 비슷한 소음, 천천히 출렁
    let b0 = 0, b1 = 0, b2 = 0, wob = 0, wv = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + w * 0.029; b1 = 0.985 * b1 + w * 0.032; b2 = 0.95 * b2 + w * 0.048;
      wv += (Math.random() - 0.5) * 0.002; wv *= 0.999; wob += wv; wob *= 0.9995;
      d[i] = (b0 + b1 + b2 + w * 0.02) * 0.35 * (1 + Math.max(-0.6, Math.min(0.6, wob * 0.05)));
    }
    // 졸졸: 작은 물방울 소리를 무리 지어
    let t = 0;
    while (t < len) {
      const n = 1 + ((Math.random() * 4) | 0);
      for (let b = 0; b < n; b++) {
        const at = t + ((Math.random() * sr * 0.05) | 0);
        bubble(d, at, 500 + Math.random() * 1300, 0.3 + Math.random() * 0.6, ((0.012 + Math.random() * 0.03) * sr) | 0, 0.03 + Math.random() * 0.05);
      }
      t += ((0.02 + Math.random() * 0.09) * sr) | 0;
    }
    // 가끔 '똑' (두 귀에 조금 다르게)
    let drop = (sr * (1 + Math.random() * 2)) | 0;
    const seed = ch ? 0.6 : 1;
    while (drop < len) {
      bubble(d, drop, 900 + Math.random() * 700, 1.2 + Math.random() * 0.8, ((0.05 + Math.random() * 0.04) * sr) | 0, 0.22 * seed);
      drop += ((2.5 + Math.random() * 5) * sr) | 0;
    }
  }
  return buf;
}

let ctx = null;
const tracks = {};

// 모닥불: 낮게 웅웅거리는 불꽃 + 불규칙한 '타닥' (짧은 소리 묶음) + 가끔 큰 '탁'
function fireBuffer() {
  const sr = ctx.sampleRate;
  const len = sr * 14; // 길게 만들어 반복이 티 나지 않게
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let last = 0, slow = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      slow += (Math.random() - 0.5) * 0.0004; slow *= 0.9995; // 불꽃 크기가 천천히 출렁
      d[i] = last * (1.6 + slow * 40);
    }
    // 타닥타닥
    let t = 0;
    while (t < len) {
      const burst = Math.random() < 0.25 ? 2 + ((Math.random() * 4) | 0) : 1; // 가끔 몇 번 연달아
      for (let b = 0; b < burst; b++) {
        const at = t + ((Math.random() * sr * 0.06) | 0);
        const big = Math.random() < 0.07;
        const amp = (big ? 0.7 : 0.12 + Math.random() * 0.3) * (ch ? 0.8 + Math.random() * 0.4 : 1);
        const dur = ((big ? 0.02 : 0.002 + Math.random() * 0.006) * sr) | 0;
        let prev = 0;
        for (let k = 0; k < dur && at + k < len; k++) {
          const n = Math.random() * 2 - 1;
          const env = Math.exp(-k / (dur * 0.25));
          d[at + k] += (n - prev) * amp * env; // 차분 → 또렷하고 마른 소리
          prev = n;
        }
      }
      t += ((0.05 + Math.random() * Math.random() * 0.5) * sr) | 0;
    }
  }
  return buf;
}

function noiseBuffer(kind) {
  if (kind === 'fire') return fireBuffer();
  if (kind === 'stream') return streamBuffer();
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
  lp.frequency.value = kind === 'white' ? 5200 : kind === 'fire' ? 6000 : kind === 'stream' ? 4500 : 1400;
  const g = ctx.createGain();
  g.gain.value = 0;
  src.connect(lp).connect(g).connect(ctx.destination);
  src.start();
  return (tracks[kind] = g);
}

/** mode: 'off' | 'white' | 'rain' | 'fire' | 'stream' */
export function setSound(mode) {
  try {
    if (!ctx) {
      if (mode === 'off') return;
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
    for (const k of KINDS) {
      if (k !== mode && !tracks[k]) continue;
      track(k).gain.setTargetAtTime(k === mode ? VOL[k] : 0, ctx.currentTime, 0.4);
    }
  } catch (e) { /* 오디오 미지원 */ }
}
