"""Mix recorded Arabic narration into the short, lowering the music under the voice.

Put one recording per line in narration/ named by its id (01.m4a, 02.wav, 03.mp3, ...),
or a single full-length recording narration/full.<ext> that starts at 0:00.

    python3 mix_narration.py            -> out/goha-donkey-ar.mp4
"""
import glob
import json
import os
import subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
NAR = os.path.join(ROOT, 'narration')
VIDEO = os.path.join(ROOT, 'out', 'video_only.mp4')
MUSIC = os.path.join(ROOT, 'out', 'music.wav')
OUT = os.path.join(ROOT, 'out', 'goha-donkey-ar.mp4')


def duration(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def find(stem):
    hits = [p for p in glob.glob(os.path.join(NAR, stem + '.*')) if not p.endswith('.json')]
    return hits[0] if hits else None


lines = json.load(open(os.path.join(NAR, 'lines.json'), encoding='utf-8'))
clips = []
full = find('full')
if full:
    clips.append((full, 0.0))
else:
    for ln in lines:
        p = find(ln['id'])
        if not p:
            print(f"missing narration/{ln['id']}.*  ({ln['text']})")
            continue
        room = ln['end'] - ln['start']
        d = duration(p)
        if d > room + 0.3:
            print(f"warning: {os.path.basename(p)} is {d:.1f}s, the scene window is {room:.1f}s")
        clips.append((p, ln['start']))
if not clips:
    raise SystemExit('no narration recordings found in narration/')

inputs = ['-i', VIDEO, '-i', MUSIC]
parts = []
for i, (p, start) in enumerate(clips):
    inputs += ['-i', p]
    ms = int(start * 1000)
    parts.append(f'[{i + 2}:a]aformat=sample_rates=44100:channel_layouts=stereo,'
                 f'loudnorm=I=-16:TP=-2,adelay={ms}|{ms}[v{i}]')
vlabels = ''.join(f'[v{i}]' for i in range(len(clips)))
graph = ';'.join(parts) + (
    f';{vlabels}amix=inputs={len(clips)}:normalize=0,apad[voice]'
    ';[voice]asplit[vk][vm]'
    ';[1:a]volume=0.8[mus]'
    ';[mus][vk]sidechaincompress=threshold=0.02:ratio=8:attack=30:release=600[duck]'
    ';[duck][vm]amix=inputs=2:normalize=0:duration=first,alimiter=limit=0.95[aout]')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', graph,
                '-map', '0:v', '-map', '[aout]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k',
                '-shortest', '-movflags', '+faststart', OUT], check=True)
print('wrote', OUT)
