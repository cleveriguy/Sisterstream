# SisterStream

SisterStream is a portable, offline-first Electron application that turns a local `movies/` directory into a Netflix-style library with movies, TV shows, seasons, and episodes. It auto-scans the folder beside the executable, builds a dark Netflix-inspired UI, and remembers your playback progress for movies and episodes.

## Features
- Automatic scanning of the `movies/` folder for `.mp4`, `.mkv`, and `.webm` files
- Detection of shows, seasons, and episodes (supports multiple nesting styles)
- Cover art lookup for episodes, seasons, and shows with graceful fallbacks
- Continue Watching, Recently Watched, and resume prompts
- Keyboard shortcuts (Space/Pause, ←/→ seek, M mute, F fullscreen, Esc exit overlay/fullscreen)
- Next-episode suggestions and episode progress indicators
- Light/Dark theme toggle with persistence
- Search across movies, shows, seasons, and episodes with grouped results
- Portable Windows build via `electron-builder` (creates `SisterStream.exe`)

## Project Structure
```
sisterstream/
  package.json
  electron-builder.yml
  main.js
  preload.js
  src/
    index.html
    show.html
    season.html
    renderer.js
    style.css
    assets/
      logo.svg
      default-cover.svg
  icons/
    sisterstream.svg
  movies/
  sisterstream-data.json (created at runtime)
```

## Getting Started

### Install dependencies
```bash
npm install
```

### Run in development
```bash
npm run dev
```

### Build portable Windows executable
```bash
npm run build
```
The build step outputs `dist/SisterStream.exe`, which includes the `movies/` folder as an extra resource. Place your video library inside that folder before or after building. The build script auto-materializes a temporary `icons/icon.ico` from the text-based `icons/icon.b64` so the repo can stay binary-free while still producing a Windows-friendly icon.

## Using the library
- Drop movies directly in `movies/` as files (`Movie.mp4`) or inside a single folder.
- Create show folders inside `movies/` and add season subfolders that hold episode files (e.g., `movies/Show/Season 1/E01.mkv`).
- Optional cover art files:
  - Episode: same base name as the video (e.g., `E01.jpg`)
  - Season: `Season Name.jpg|png`
  - Show: `Show Name.jpg|png`
- Playback data and theme preferences persist in `sisterstream-data.json` next to the executable.

## Keyboard shortcuts in the player
- Space: Play/Pause
- Left Arrow: Seek -10s
- Right Arrow: Seek +10s
- M: Mute/Unmute
- F: Toggle fullscreen
- Esc: Exit fullscreen or close the overlay

