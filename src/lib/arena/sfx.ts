/**
 * Âm thanh đấu trường — tổng hợp bằng WebAudio (không tải file, không tốn băng thông),
 * có định vị không gian (trái/phải/độ sâu) để trận đấu sống động hơn.
 *
 * Quy tắc: chỉ khởi tạo khi người chơi đã tương tác; tôn trọng chế độ tắt tiếng
 * lưu trong localStorage và chế độ giảm chuyển động của hệ điều hành.
 */

const MUTE_KEY = "arena:muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (isMuted()) return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function isMuted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(MUTE_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (muted && master) master.gain.value = 0;
  else if (master) master.gain.value = 0.35;
}

/** Mở khoá âm thanh sau cú chạm đầu tiên (chính sách autoplay của trình duyệt). */
export function primeAudio() {
  ensure();
}

type ToneOptions = {
  freq: number;
  /** Thời lượng (giây). */
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** Vị trí ngang: -1 trái … 1 phải. */
  pan?: number;
  /** Độ xa: 0 gần … 1 xa (giảm âm + tối tiếng). */
  depth?: number;
  delay?: number;
  /** Trượt cao độ tới tần số này. */
  slideTo?: number;
};

function tone(o: ToneOptions) {
  const audio = ensure();
  if (!audio || !master) return;
  const t0 = audio.currentTime + (o.delay ?? 0);
  const dur = o.dur ?? 0.16;
  const depth = Math.min(1, Math.max(0, o.depth ?? 0));

  const osc = audio.createOscillator();
  osc.type = o.type ?? "triangle";
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, o.slideTo), t0 + dur);

  const gain = audio.createGain();
  const peak = (o.gain ?? 0.5) * (1 - depth * 0.6);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  // Càng xa càng tối tiếng.
  const filter = audio.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 16_000 - depth * 12_000;

  let out: AudioNode = filter;
  if (typeof audio.createStereoPanner === "function") {
    const panner = audio.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, o.pan ?? 0));
    filter.connect(panner);
    out = panner;
  }

  osc.connect(gain).connect(filter);
  out.connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noise({ dur = 0.18, gain = 0.35, pan = 0, delay = 0 }: { dur?: number; gain?: number; pan?: number; delay?: number }) {
  const audio = ensure();
  if (!audio || !master) return;
  const t0 = audio.currentTime + delay;
  const frames = Math.floor(audio.sampleRate * dur);
  const buffer = audio.createBuffer(1, frames, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  const g = audio.createGain();
  g.gain.value = gain;
  let out: AudioNode = g;
  src.connect(g);
  if (typeof audio.createStereoPanner === "function") {
    const panner = audio.createStereoPanner();
    panner.pan.value = pan;
    g.connect(panner);
    out = panner;
  }
  out.connect(master);
  src.start(t0);
}

/* ------------------------- Bộ âm thanh trận đấu ------------------------- */

/** Xúc xắc nảy trên bàn: nhiều cú va chạm nhỏ, lệch dần từ xa về gần. */
export function sfxDiceRoll(index: number, durationMs: number) {
  const pan = index === 0 ? -0.45 : 0.45;
  const bounces = 5;
  for (let i = 0; i < bounces; i += 1) {
    const p = i / bounces;
    noise({ dur: 0.05, gain: 0.18 + p * 0.12, pan: pan * (1 - p * 0.4), delay: (durationMs / 1000) * p * 0.9 });
    tone({
      freq: 320 + Math.random() * 220,
      dur: 0.05,
      type: "square",
      gain: 0.12,
      pan,
      depth: 0.7 - p * 0.6,
      delay: (durationMs / 1000) * p * 0.9,
    });
  }
}

/** Xúc xắc dừng lại — tiếng "cạch" gần tai. */
export function sfxDiceSettle(total: number) {
  tone({ freq: 180 + total * 12, dur: 0.22, type: "sawtooth", gain: 0.35, depth: 0 });
  noise({ dur: 0.1, gain: 0.25 });
}

/** Đếm ngược 3-2-1 rồi "GO!". */
export function sfxCountdownTick(n: number) {
  tone({ freq: 440 + (3 - n) * 60, dur: 0.12, type: "square", gain: 0.3, pan: 0, depth: 0.2 });
}

export function sfxGo() {
  tone({ freq: 520, slideTo: 980, dur: 0.45, type: "sawtooth", gain: 0.45, pan: -0.3 });
  tone({ freq: 780, slideTo: 1240, dur: 0.4, type: "triangle", gain: 0.35, pan: 0.3, delay: 0.05 });
  noise({ dur: 0.3, gain: 0.2 });
}

/** Chuỗi combo — cao độ tăng dần theo bậc combo. */
export function sfxCombo(step: number) {
  const s = Math.max(1, Math.min(8, step));
  tone({ freq: 420 * Math.pow(1.14, s), dur: 0.14, type: "triangle", gain: 0.4, pan: -0.2 });
  tone({ freq: 630 * Math.pow(1.14, s), dur: 0.18, type: "sine", gain: 0.3, pan: 0.2, delay: 0.06 });
}

/** Trúng đòn — nặng nhẹ theo sát thương, định vị theo bên nhận đòn. */
export function sfxHit(damage: number, mine: boolean) {
  const pan = mine ? -0.5 : 0.5;
  noise({ dur: 0.16, gain: Math.min(0.5, 0.18 + damage / 60), pan });
  tone({ freq: 220, slideTo: 90, dur: 0.22, type: "sawtooth", gain: 0.35, pan });
}

/** Cảnh báo sắp gục (≤20% máu) — hồi chuông trầm, lặp nhịp tim. */
export function sfxLowHp(mine: boolean) {
  const pan = mine ? -0.4 : 0.4;
  tone({ freq: 150, dur: 0.2, type: "sine", gain: 0.4, pan, depth: 0.1 });
  tone({ freq: 120, dur: 0.26, type: "sine", gain: 0.35, pan, depth: 0.1, delay: 0.22 });
}

/** Bị thương (≤40% máu) — tiếng thở dốc ngắn. */
export function sfxWounded(mine: boolean) {
  noise({ dur: 0.24, gain: 0.16, pan: mine ? -0.4 : 0.4 });
}

/** Gục hẳn. */
export function sfxKo() {
  tone({ freq: 300, slideTo: 60, dur: 0.7, type: "sawtooth", gain: 0.45 });
  noise({ dur: 0.5, gain: 0.25 });
}
