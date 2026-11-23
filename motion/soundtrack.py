"""Synthesised 15 s soundtrack for motion/viralgrow-15s.html (120 BPM, A minor).

Every sound is generated here — no samples — and every hit is placed on the same
timeline as the visuals (word slams, scene cuts, the drop at 10 s, logo stamp at 14 s).

    python3 motion/soundtrack.py motion/out/soundtrack.wav
"""
import sys
import wave

import numpy as np

SR = 48000
DUR = 15.0
N = int(SR * DUR)
BEAT = 0.5  # 120 BPM
rng = np.random.default_rng(7)

L = np.zeros(N)
R = np.zeros(N)


def t_axis(sec):
    return np.arange(int(sec * SR)) / SR


def place(sig, at, gain=1.0, pan=0.0):
    """Mix a mono signal in at time `at` (s) with equal-power pan (-1..1)."""
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    a = (pan + 1) * np.pi / 4
    L[i : i + len(sig)] += sig * np.cos(a)
    R[i : i + len(sig)] += sig * np.sin(a)


def lowpass(x, cutoff):
    """One-pole low-pass."""
    k = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for n, v in enumerate(x):
        acc = (1 - k) * v + k * acc
        y[n] = acc
    return y


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


# ── Instruments ──────────────────────────────────────────────────────
def kick(punch=1.0):
    t = t_axis(0.45)
    f = 48 + 110 * np.exp(-t * 32)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.35
    return np.tanh((body + click) * 1.6 * punch) * 0.9


def clap():
    t = t_axis(0.3)
    n = highpass(rng.standard_normal(len(t)), 900)
    env = np.zeros_like(t)
    for d in (0, 0.011, 0.022):
        env += np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d)
    env += np.exp(-t * 14) * 0.6
    tone = np.sin(2 * np.pi * 210 * t) * np.exp(-t * 30) * 0.3
    return (n * env * 0.45 + tone) * 0.8


def hat(open_=False):
    t = t_axis(0.18 if open_ else 0.06)
    n = highpass(highpass(rng.standard_normal(len(t)), 6000), 6000)
    return n * np.exp(-t * (16 if open_ else 70)) * 0.35


def impact(size=1.0):
    t = t_axis(1.6)
    f = 32 + 70 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    crack = lowpass(rng.standard_normal(len(t)), 3500) * np.exp(-t * 9) * 0.6
    return np.tanh((boom * 1.2 + crack) * size) * 0.95


def whoosh(length=0.6, rise=True):
    t = t_axis(length)
    n = rng.standard_normal(len(t))
    x = t / length
    env = (x ** 2.2) if rise else np.sin(np.pi * x) ** 2
    cut = 400 + 5000 * (x if rise else np.sin(np.pi * x))
    # time-varying low-pass by blending two fixed filters
    lo, hi = lowpass(n, 500), lowpass(n, 6000)
    w = (cut - 400) / 5000
    return (lo * (1 - w) + hi * w) * env * 0.5


def riser(length):
    t = t_axis(length)
    x = t / length
    f = 180 * (2 ** (x * 4))
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.18 + np.sin(2 * np.pi * np.cumsum(f * 1.5) / SR) * 0.08
    noise = highpass(rng.standard_normal(len(t)), 1500) * 0.22
    return (tone + noise) * x ** 2.5


def pluck(freq, length=0.22, bright=1.0):
    t = t_axis(length)
    saw = 2 * ((freq * t) % 1) - 1
    sq = np.sign(np.sin(2 * np.pi * freq * 1.005 * t))
    return lowpass((saw * 0.6 + sq * 0.25) * np.exp(-t * 16), 2500 * bright) * 0.5


def bass_note(freq, length):
    t = t_axis(length)
    s = np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2 * t) + 0.12 * np.sign(np.sin(2 * np.pi * freq * t))
    env = np.minimum(1, t * 60) * np.exp(-t * 1.2)
    return lowpass(s * env, 700) * 0.55


def pad(freqs, length):
    t = t_axis(length)
    s = sum(np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * f * 1.004 * t + 1.3) for f in freqs)
    env = np.minimum(1, t / 0.25) * np.minimum(1, (length - t) / 0.4)
    return lowpass(s, 1800) * env * 0.05


def stamp():
    """Logo stamp: tight kick + bright bell."""
    t = t_axis(1.2)
    bell = sum(np.sin(2 * np.pi * f * t) * a for f, a in ((880, 0.5), (1320, 0.25), (1760, 0.12)))
    out = bell * np.exp(-t * 4) * 0.35
    k = kick(1.3)
    out[: len(k)] += k * 0.8
    return out


# ── Arrangement ──────────────────────────────────────────────────────
A1, C2, D2, E2, F1, G1 = 55.0, 65.41, 73.42, 82.41, 43.65, 49.0
PROG = [A1, F1, C2, G1]  # Am – F – C – G, one chord per bar (2 s)
CHORDS = [(220, 261.6, 329.6), (174.6, 220, 261.6), (261.6, 329.6, 392), (196, 246.9, 293.7)]

# 0–2 s: four word slams
for i, at in enumerate((0, 0.5, 1.0, 1.5)):
    place(kick(1.2), at, 0.9)
    place(clap(), at, 0.55)
    place(impact(0.6), at, 0.35)
    place(pluck(440 * (2 ** ([0, 3, 7, 10][i] / 12)), 0.4, 1.3), at, 0.35, pan=[-0.4, 0.4, -0.2, 0.2][i])
place(whoosh(0.45, rise=True), 1.55, 0.8)

# Groove 2–12.5 s
t = 2.0
while t < 12.5 - 1e-6:
    beat_in_bar = int(round((t - 2.0) / BEAT)) % 4
    if not (9.0 <= t < 10.0) or beat_in_bar in (0, 2):  # thin the groove under the riser
        place(kick(), t, 0.85)
    if beat_in_bar in (1, 3):
        place(clap(), t, 0.5)
    place(hat(), t + BEAT / 2, 0.5, pan=0.35)
    if t >= 4.0:
        place(hat(), t + BEAT / 4, 0.22, pan=-0.35)
        place(hat(), t + 3 * BEAT / 4, 0.22, pan=-0.35)
    t += BEAT

for bar in range(5):  # 2.0 … 12.0
    at = 2.0 + bar * 2
    root = PROG[bar % 4]
    for step in range(8):
        place(bass_note(root * (2 if step % 4 == 3 else 1), 0.24), at + step * 0.25, 0.8)
    if at >= 4.0:
        place(pad(CHORDS[bar % 4], 2.0), at, 1.0)

# Arp lead over the drop (10–12.5)
ARP = [0, 3, 7, 12, 7, 3, 10, 7]
for k in range(20):
    at = 10.0 + k * 0.125
    place(pluck(440 * 2 ** (ARP[k % 8] / 12), 0.18), at, 0.28, pan=0.3 if k % 2 else -0.3)

# Transitions & hits
place(whoosh(0.35, rise=True), 3.7, 0.8)
place(impact(0.7), 4.0, 0.5)
place(whoosh(0.3, rise=False), 6.8, 0.9)
for k, at in enumerate((7.0, 7.5, 8.0, 8.5, 9.0, 9.5)):  # feature cuts
    place(impact(0.45), at, 0.35)
    place(hat(open_=True), at, 0.4, pan=(-0.5 if k % 2 else 0.5))
place(riser(1.0), 9.0, 1.0)
place(impact(1.4), 10.0, 1.0)
place(kick(1.5), 10.0, 0.9)
place(riser(0.5), 12.0, 0.7)
place(whoosh(0.4, rise=True), 12.1, 0.7)
place(impact(1.0), 12.5, 0.8)

# End card: soft pad + logo stamp
place(pad((220, 261.6, 329.6, 440), 2.5), 12.5, 1.6)
for at in (12.5, 13.0, 13.5):
    place(kick(0.9), at, 0.45)
place(stamp(), 14.0, 1.0)
place(pad((329.6, 440, 523.3), 1.0), 14.0, 1.2)

# ── Master: sidechain-ish duck, soft clip, fades, normalise ─────────
beats = np.arange(2.0, 12.5, BEAT)
duck = np.ones(N)
tt = np.arange(N) / SR
for b in beats:
    m = (tt >= b) & (tt < b + 0.3)
    duck[m] *= 1 - 0.35 * np.exp(-(tt[m] - b) * 12)
L *= duck
R *= duck
mix = np.stack([L, R])
mix = np.tanh(mix * 1.15)
fade_out = np.ones(N)
fo = int(0.6 * SR)
fade_out[-fo:] = np.linspace(1, 0, fo) ** 2
mix *= fade_out
mix /= np.max(np.abs(mix)) / 0.89

out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
pcm = (mix.T * 32767).astype('<i2')
with wave.open(out, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, f'{DUR}s @ {SR} Hz')
