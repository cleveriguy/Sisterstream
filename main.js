const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.webm']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.svg']);

const getBaseDir = () => (app.isPackaged ? path.join(process.resourcesPath, '..') : __dirname);
const moviesDir = path.join(getBaseDir(), 'movies');
const dataPath = path.join(getBaseDir(), 'sisterstream-data.json');

function ensureMoviesDir() {
  if (!fs.existsSync(moviesDir)) {
    fs.mkdirSync(moviesDir, { recursive: true });
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  ensureMoviesDir();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function isVideo(fileName) {
  return VIDEO_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function isImage(fileName) {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

function readSafe(dirPath) {
  try {
    return fs.readdirSync(dirPath, { withFileTypes: true });
  } catch (error) {
    return [];
  }
}

function isSeasonFolder(dirPath) {
  const entries = readSafe(dirPath);
  let hasVideo = false;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      return false;
    }
    if (entry.isFile()) {
      if (isVideo(entry.name)) {
        hasVideo = true;
        continue;
      }
      if (isImage(entry.name)) {
        continue;
      }
      return false;
    }
  }

  return hasVideo;
}

function detectMovieFolder(dirPath) {
  const entries = readSafe(dirPath);
  let hasVideo = false;
  for (const entry of entries) {
    if (entry.isDirectory()) {
      return false;
    }
    if (entry.isFile()) {
      if (isVideo(entry.name)) {
        hasVideo = true;
      }
    }
  }
  return hasVideo;
}

function isShowFolder(dirPath) {
  const entries = readSafe(dirPath);
  let hasSeason = false;
  let hasVideo = false;
  let hasSubdir = false;

  for (const entry of entries) {
    if (entry.isDirectory()) {
      hasSubdir = true;
      if (isSeasonFolder(path.join(dirPath, entry.name))) {
        hasSeason = true;
      }
    } else if (entry.isFile() && isVideo(entry.name)) {
      hasVideo = true;
    }
  }

  return hasSeason || (hasVideo && hasSubdir);
}

function findCover(baseDir, name) {
  const candidates = ['jpg', 'jpeg', 'png', 'svg'].map((ext) => path.join(baseDir, `${name}.${ext}`));
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function getDefaultCover() {
  return path.join(__dirname, 'src', 'assets', 'default-cover.svg');
}

function buildEpisodeCover(episodePath, seasonPath, showPath) {
  const baseName = path.basename(episodePath, path.extname(episodePath));
  const episodeCover = findCover(seasonPath, baseName);
  if (episodeCover) return episodeCover;

  const seasonCover = findCover(seasonPath, path.basename(seasonPath));
  if (seasonCover) return seasonCover;

  const showCover = findCover(showPath, path.basename(showPath));
  if (showCover) return showCover;

  return getDefaultCover();
}

function parseSeason(seasonPath, showMeta) {
  const seasonName = path.basename(seasonPath);
  const episodes = [];
  const entries = readSafe(seasonPath).filter((entry) => entry.isFile() && isVideo(entry.name));
  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  entries.forEach((entry, index) => {
    const episodePath = path.join(seasonPath, entry.name);
    episodes.push({
      title: path.parse(entry.name).name,
      episodeNumber: index + 1,
      filePath: episodePath,
      cover: buildEpisodeCover(episodePath, seasonPath, showMeta.path),
      show: showMeta.name,
      season: seasonName,
      type: 'episode'
    });
  });

  return {
    name: seasonName,
    cover: findCover(seasonPath, seasonName) || showMeta.cover || getDefaultCover(),
    episodes
  };
}

function parseShow(showPath) {
  const showName = path.basename(showPath);
  const showCover = findCover(showPath, showName) || getDefaultCover();
  const showMeta = { name: showName, cover: showCover, path: showPath };

  const entries = readSafe(showPath);
  const seasons = [];
  const videosInRoot = entries.filter((entry) => entry.isFile() && isVideo(entry.name));
  const seasonDirs = entries.filter((entry) => entry.isDirectory() && isSeasonFolder(path.join(showPath, entry.name)));

  seasonDirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  for (const dir of seasonDirs) {
    seasons.push(parseSeason(path.join(showPath, dir.name), showMeta));
  }

  if (!seasonDirs.length && videosInRoot.length) {
    const tempSeasonPath = showPath;
    videosInRoot.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    const episodes = videosInRoot.map((entry, index) => {
      const episodePath = path.join(tempSeasonPath, entry.name);
      return {
        title: path.parse(entry.name).name,
        episodeNumber: index + 1,
        filePath: episodePath,
        cover: buildEpisodeCover(episodePath, tempSeasonPath, showPath),
        show: showName,
        season: 'Season 1',
        type: 'episode'
      };
    });
    seasons.push({
      name: 'Season 1',
      cover: showCover,
      episodes
    });
  }

  return {
    name: showName,
    cover: showCover,
    seasons
  };
}

function parseMovieFile(filePath) {
  const title = path.parse(filePath).name;
  return {
    title,
    cover: findCover(path.dirname(filePath), title) || getDefaultCover(),
    filePath,
    type: 'movie'
  };
}

function parseMovieFromFolder(folderPath) {
  const files = readSafe(folderPath).filter((entry) => entry.isFile() && isVideo(entry.name));
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  if (!files.length) return null;
  const primaryFile = path.join(folderPath, files[0].name);
  return {
    title: path.basename(folderPath),
    cover: findCover(folderPath, path.basename(folderPath)) || getDefaultCover(),
    filePath: primaryFile,
    type: 'movie'
  };
}

function scanLibrary() {
  ensureMoviesDir();
  const entries = readSafe(moviesDir);
  const movies = [];
  const shows = [];

  for (const entry of entries) {
    const fullPath = path.join(moviesDir, entry.name);

    if (entry.isFile() && isVideo(entry.name)) {
      movies.push(parseMovieFile(fullPath));
      continue;
    }

    if (entry.isDirectory()) {
      if (isShowFolder(fullPath) || isSeasonFolder(fullPath)) {
        shows.push(parseShow(fullPath));
        continue;
      }
      if (detectMovieFolder(fullPath)) {
        const movie = parseMovieFromFolder(fullPath);
        if (movie) movies.push(movie);
      }
    }
  }

  return { movies, shows };
}

function loadData() {
  try {
    const raw = fs.readFileSync(dataPath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    const defaultData = { theme: 'dark', movies: {} };
    fs.writeFileSync(dataPath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
}

function saveData(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  return data;
}

ipcMain.handle('get-library', () => scanLibrary());
ipcMain.handle('load-data', () => loadData());
ipcMain.handle('save-data', (_event, payload) => saveData(payload));

