"""Gentle music-box soundtrack + soft sound effects for the short (69 s).

python3 music.py out/music.wav
"""
import sys
import wave
import numpy as np

SR = 44100
DUR = 69.0
N = int(SR * DUR)
out = np.zeros(N)
rng = np.random.default_rng(3)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def add(sig, t0):
    i = int(t0 * SR)
    if i >= N:
        return
    j = min(N, i + len(sig))
    out[i:j] += sig[: j - i]


def tt(dur):
    return np.arange(int(dur * SR)) / SR


def musicbox(midi, t0, amp=0.18, dur=1.6):
    t = tt(dur)
    f = hz(midi)
    env = np.minimum(1, t / 0.004) * np.exp(-t * 3.2)
    s = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(2 * np.pi * 2.003 * f * t) * np.exp(-t * 3) \
        + 0.1 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 6)
    add(amp * env * s, t0)


def pad(midis, t0, dur, amp=0.05):
    t = tt(dur + 0.8)
    env = np.minimum(1, t / 0.6) * np.clip((dur + 0.8 - t) / 0.8, 0, 1)
    s = sum(np.sin(2 * np.pi * hz(m) * t + k) * (1 + 0.15 * np.sin(2 * np.pi * 0.25 * t)) for k, m in enumerate(midis))
    add(amp * env * s / len(midis), t0)


def bass(midi, t0, amp=0.12):
    t = tt(1.4)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 2.2)
    add(amp * env * (np.sin(2 * np.pi * hz(midi) * t) + 0.2 * np.sin(4 * np.pi * hz(midi) * t)), t0)


CH = {  # chord tones (midi, around C4)
    'C': [60, 64, 67], 'G': [55, 59, 62], 'Am': [57, 60, 64], 'F': [53, 57, 60], 'Dm': [50, 53, 57], 'Em': [52, 55, 59],
}
BEAT = 0.6
BAR = BEAT * 4


def section(t0, t1, prog, density, mel_amp, octave=12, pad_amp=0.05):
    bars = int(round((t1 - t0) / BAR))
    for b in range(bars):
        name = prog[b % len(prog)]
        tones = CH[name]
        tb = t0 + b * BAR
        pad([m + 12 for m in tones], tb, BAR, pad_amp)
        bass(tones[0] - 12, tb)
        bass(tones[0] - 12 + 7, tb + 2 * BEAT, 0.07)
        steps = 8
        prev = None
        for k in range(steps):
            if rng.random() > density[k % len(density)]:
                continue
            choices = [m + octave for m in tones] + [tones[0] + octave + 12]
            note = choices[rng.integers(len(choices))]
            if prev is not None and abs(note - prev) > 7:
                note = choices[0]
            prev = note
            musicbox(note, tb + k * BEAT / 2, mel_amp)


# happy walk through the market
section(0.0, 9.6, ['C', 'G', 'Am', 'F'], [1, 0.5, 0.9, 0.5], 0.16)
musicbox(72, 9.6, 0.14); musicbox(76, 9.9, 0.14); musicbox(79, 10.2, 0.14)
# ouch -> tender and a little sad, then caring
section(11.4, 30.6, ['Am', 'F', 'C', 'G'], [1, 0.0, 0.6, 0.0], 0.13, pad_amp=0.06)
section(30.6, 42.6, ['F', 'C', 'Dm', 'G'], [1, 0.2, 0.7, 0.2], 0.13, pad_amp=0.06)
# later: healing, warm
section(42.6, 52.2, ['C', 'Am', 'F', 'G'], [1, 0.35, 0.8, 0.35], 0.14)
# joyful finale
section(52.2, 66.6, ['C', 'F', 'G', 'C'], [1, 0.8, 1, 0.8], 0.15)
for i, m in enumerate([72, 76, 79, 84]):
    musicbox(m, 66.6 + i * 0.3, 0.15, 2.5)
pad([60, 64, 67, 72], 66.6, 2.0, 0.06)

# ---- sound effects ----
def knock(t0, amp=0.35):
    t = tt(0.25)
    add(amp * np.exp(-t * 28) * np.sin(2 * np.pi * (180 - 60 * t) * t), t0)


def clink(t0, amp=0.1):
    t = tt(0.5)
    f = 2400 + rng.random() * 600
    add(amp * np.exp(-t * 14) * (np.sin(2 * np.pi * f * t) + 0.5 * np.sin(2 * np.pi * 1.51 * f * t)), t0)


def puff(t0, amp=0.12):
    t = tt(0.4)
    noise = rng.standard_normal(len(t))
    noise = np.convolve(noise, np.ones(40) / 40, mode='same')
    add(amp * np.minimum(1, t / 0.03) * np.exp(-t * 9) * noise * 3, t0)


def boing(t0, amp=0.16):
    t = tt(0.6)
    f = 220 + 260 * t + 40 * np.sin(2 * np.pi * 9 * t)
    add(amp * np.exp(-t * 5) * np.sin(2 * np.pi * np.cumsum(f) / SR), t0)


knock(11.0)
musicbox(64, 11.35, 0.1); musicbox(63, 11.7, 0.1)  # little "aww"
for i in range(5):
    clink(22.0 + i * 0.7 + 0.33)
puff(31.65)
puff(35.5, 0.06)
for i in range(9):
    musicbox(84 + [0, 4, 7, 12, 7, 4, 12, 16, 19][i], 47.9 + i * 0.28, 0.07, 1.2)
boing(53.4)

# master: gentle fade in/out + normalize
fade = np.ones(N)
fi, fo = int(1.2 * SR), int(3.0 * SR)
fade[:fi] = np.linspace(0, 1, fi)
fade[-fo:] = np.linspace(1, 0, fo)
out *= fade
out /= np.max(np.abs(out)) / 0.8
stereo = np.stack([out, np.roll(out, 300) * 0.96], axis=1)
pcm = (stereo * 32767).astype(np.int16)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else 'music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', len(out) / SR, 's')
