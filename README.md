# Air Canvas

[![Live Demo](https://img.shields.io/badge/Live%20Demo-vercel.app-facc15)](https://air-canvas-pied.vercel.app)
[![React](https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=white)](https://react.dev)
[![Vite](https://img.shields.io/badge/Vite-646cff?logo=vite&logoColor=white)](https://vite.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-06b6d4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-0097a7?logo=google&logoColor=white)](https://ai.google.dev/edge/mediapipe)

Draw in the air with your finger. Hand-tracked painting that runs
**entirely in the browser** — no backend, no uploads, video never leaves
your device.

## How it works

1. [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker)
   tracks 21 hand keypoints per frame through a GPU-delegated WASM runtime.
2. Finger poses control the pen — all derived from landmark geometry:
   - **Index finger up** → draw
   - **Index + middle up** → move without drawing (pen up)
3. Fingertip positions are smoothed with an exponential moving average so
   strokes stay steady despite tracking jitter.
4. Toolbar: 5 colors, 3 brush sizes, eraser, clear, and **Save PNG**
   (exported un-mirrored so your writing reads correctly).

The WASM runtime and `.task` model are self-hosted in `public/`, so the
deployed demo has no runtime CDN dependency. Front/back camera switching
works on phones; the front-camera view is mirrored like a real mirror so
drawing feels natural.

## Stack

React 19 · Vite · Tailwind CSS v4 · @mediapipe/tasks-vision

## Run locally

```bash
npm install
npm run dev
```

Requires a camera and a modern browser (WebGL/WASM).
