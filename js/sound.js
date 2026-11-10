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
let curMode = 'off';
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
  curMode = mode;
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

/* ---------- 쉼터 효과음 · 자연 소리 (소리 끄기면 같이 꺼짐) ---------- */
export function currentSound() { return curMode; }
function ready() { return ctx && curMode !== 'off'; }
function env(g, t0, a, d, peak) { g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(peak, t0 + a); g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d); }
function noise(sec) {
  const b = ctx.createBuffer(1, Math.max(1, ctx.sampleRate * sec) | 0, ctx.sampleRate);
  const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; return s;
}
/** kind: creak(그네·뺑뺑이) | whoosh(미끄럼틀) | thunk(시소) | vend(자판기) | shutter(사진) | sit | step */
export function sfx(kind) {
  if (!ready()) return;
  try {
    const t0 = ctx.currentTime, out = ctx.destination;
    if (kind === 'creak') {
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(320, t0); o.frequency.exponentialRampToValueAtTime(190, t0 + 0.28);
      f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 6;
      env(g, t0, 0.03, 0.3, 0.025); o.connect(f).connect(g).connect(out); o.start(t0); o.stop(t0 + 0.4);
    } else if (kind === 'whoosh') {
      const n = noise(1), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(500, t0); f.frequency.exponentialRampToValueAtTime(2200, t0 + 0.8);
      env(g, t0, 0.15, 0.75, 0.06); n.connect(f).connect(g).connect(out); n.start(t0);
    } else if (kind === 'thunk') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(70, t0 + 0.15);
      env(g, t0, 0.005, 0.18, 0.08); o.connect(g).connect(out); o.start(t0); o.stop(t0 + 0.25);
    } else if (kind === 'vend') {
      [880, 1320].forEach((fr, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = fr; env(g, t0 + i * 0.12, 0.01, 0.12, 0.04); o.connect(g).connect(out); o.start(t0 + i * 0.12); o.stop(t0 + i * 0.12 + 0.2); });
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = 90; env(g, t0 + 0.35, 0.005, 0.12, 0.03); o.connect(g).connect(out); o.start(t0 + 0.35); o.stop(t0 + 0.5);
    } else if (kind === 'shutter') {
      const n = noise(0.08), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'highpass'; f.frequency.value = 2500; env(g, t0, 0.002, 0.06, 0.08); n.connect(f).connect(g).connect(out); n.start(t0);
    } else if (kind === 'sit' || kind === 'step') {
      const n = noise(0.1), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 700; env(g, t0, 0.005, 0.08, 0.04); n.connect(f).connect(g).connect(out); n.start(t0);
    }
  } catch (e) { /* 오디오 미지원 */ }
}
// 쉼터 자연 소리: 낮엔 새소리, 밤엔 풀벌레 (아주 작게, 띄엄띄엄)
let ambTimer = null, ambKind = null;
export function setAmbience(kind) {
  ambKind = kind;
  clearTimeout(ambTimer);
  if (!kind) return;
  const tickAmb = () => {
    if (!ambKind) return;
    if (ready()) {
      try {
        const t0 = ctx.currentTime, out = ctx.destination;
        if (ambKind === 'day') {
          const n = 2 + ((Math.random() * 3) | 0), base = 2400 + Math.random() * 1400;
          for (let i = 0; i < n; i++) {
            const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + i * 0.13;
            o.frequency.setValueAtTime(base, s); o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), s + 0.08);
            env(g, s, 0.01, 0.08, 0.012); o.connect(g).connect(out); o.start(s); o.stop(s + 0.12);
          }
        } else {
          for (let i = 0; i < 6; i++) {
            const o = ctx.createOscillator(), g = ctx.createGain(), s = t0 + i * 0.07;
            o.frequency.value = 4300 + Math.random() * 200; env(g, s, 0.005, 0.035, 0.006); o.connect(g).connect(out); o.start(s); o.stop(s + 0.05);
          }
        }
      } catch (e) {}
    }
    ambTimer = setTimeout(tickAmb, (ambKind === 'day' ? 2500 : 1400) + Math.random() * 3500);
  };
  ambTimer = setTimeout(tickAmb, 800);
}
