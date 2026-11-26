# Goha and the Little Donkey

A 69-second animated short for toddlers, built entirely in code with three.js.
There is no on-screen text.

Goha (white beard, white turban, purple robe) and his small gray donkey walk through a
sunny desert market. The donkey bumps its right front leg on a stone and gets a
little bruise. Goha wraps ice cubes in a blue towel, rests the leg on a soft white
pillow and puts the ice pack on the bruise. Later he applies a little gel cream, and
the donkey trots off happily beside him with hearts floating up.

Output: `out/goha-donkey.mp4` (1280×720, 24 fps, H.264 + AAC).

## Scenes

| Time | Scene |
|------|-------|
| 0–11 s | Crane down into the market; Goha and the donkey walk happily |
| 11–21 s | The bump, bruise and tear; Goha turns, smiles kindly, pats the donkey |
| 21–29 s | Ice cubes onto a blue towel; the towel folds into an ice pack |
| 29–37 s | The donkey lies down; the leg rests on a white pillow; ice pack placed |
| 37–42 s | The donkey relaxes and smiles |
| 42–51 s | "Later" (soft white dip): gel cream, the bruise fades with sparkles |
| 51–69 s | Healed: the donkey hops, then trots beside Goha with floating hearts |

## Files

- `index.html`, `app.css`, `scene.js`: the scene. Every frame is a pure function of time.
- `render.mjs`: renders frames in headless Chromium and encodes them with ffmpeg.
- `music.py`: music-box soundtrack and soft sound effects (numpy).

## Rebuild

```bash
npm install
node render.mjs video 4                 # -> out/video_only.mp4
python3 music.py out/music.wav
ffmpeg -i out/video_only.mp4 -i out/music.wav -c:v copy -c:a aac -b:a 160k -shortest out/goha-donkey.mp4
```

Live preview: serve the folder, for example with `npx http-server`, and open
`index.html`. Add `?t=30` to start at 30 s.
