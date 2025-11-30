const DEFAULT_COVER = 'assets/default-cover.svg';
const state = {
  library: { movies: [], shows: [] },
  data: { theme: 'dark', movies: {} },
  overlay: null,
  videoEl: null,
  currentMedia: null,
  saveTimeout: null
};

function applyTheme(theme) {
  const body = document.body;
  if (theme === 'light') {
    body.classList.add('light');
  } else {
    body.classList.remove('light');
  }
  const toggle = document.getElementById('themeToggle');
  if (toggle) {
    toggle.textContent = theme === 'light' ? '☀️ Light' : '🌙 Dark';
  }
}

async function init() {
  state.data = await window.sisterStreamAPI.loadData();
  state.library = await window.sisterStreamAPI.getLibrary();
  if (!state.data.theme) {
    state.data.theme = 'dark';
  }
  if (!state.data.movies) {
    state.data.movies = {};
  }
  applyTheme(state.data.theme);
  bindThemeToggle();
  routePage();
}

function bindThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    state.data.theme = state.data.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.data.theme);
    window.sisterStreamAPI.saveData(state.data);
  });
}

function routePage() {
  const page = document.body.dataset.page;
  if (page === 'home') {
    renderHome();
  } else if (page === 'show') {
    renderShowPage();
  } else if (page === 'season') {
    renderSeasonPage();
  }
}

function mapMedia() {
  const map = new Map();
  state.library.movies.forEach((movie) => {
    map.set(movie.filePath, { ...movie });
  });
  state.library.shows.forEach((show) => {
    show.seasons.forEach((season) => {
      season.episodes.forEach((ep) => {
        map.set(ep.filePath, { ...ep });
      });
    });
  });
  return map;
}

function renderHome() {
  const mediaIndex = mapMedia();
  renderMovies();
  renderShows();
  renderContinue(mediaIndex);
  renderRecent(mediaIndex);
  bindSearch(mediaIndex);
}

function renderMovies() {
  const grid = document.getElementById('moviesGrid');
  if (!grid) return;
  grid.innerHTML = '';
  state.library.movies.forEach((movie) => {
    grid.appendChild(createCard(movie, () => openVideo(movie)));
  });
  if (!state.library.movies.length) {
    grid.innerHTML = '<p class="empty-state">Drop movies into the movies folder to get started.</p>';
  }
}

function renderShows() {
  const grid = document.getElementById('showsGrid');
  if (!grid) return;
  grid.innerHTML = '';
  state.library.shows.forEach((show) => {
    const card = createCard(show, () => {
      window.location.href = `show.html?show=${encodeURIComponent(show.name)}`;
    });
    grid.appendChild(card);
  });
  if (!state.library.shows.length) {
    grid.innerHTML = '<p class="empty-state">Place your shows in their own folders inside movies.</p>';
  }
}

function createCard(media, onClick) {
  const card = document.createElement('div');
  card.className = 'card';
  card.addEventListener('click', onClick);
  const img = document.createElement('img');
  img.src = window.sisterStreamAPI.toFileUrl(media.cover);
  img.alt = media.title || media.name;
  card.appendChild(img);
  const body = document.createElement('div');
  body.className = 'card-body';
  const title = document.createElement('h3');
  title.className = 'title';
  title.textContent = media.title || media.name;
  const subtitle = document.createElement('p');
  subtitle.className = 'subtitle';
  subtitle.textContent = media.type === 'movie' ? 'Movie' : media.seasons ? `${media.seasons.length} Seasons` : '';
  body.appendChild(title);
  body.appendChild(subtitle);
  card.appendChild(body);
  return card;
}

function renderContinue(mediaIndex) {
  const grid = document.getElementById('continueGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const entries = Object.entries(state.data.movies || {})
    .filter(([, meta]) => meta.lastPosition && meta.duration)
    .sort(([, a], [, b]) => (b.lastWatched || 0) - (a.lastWatched || 0));
  entries.forEach(([filePath, meta]) => {
    const media = mediaIndex.get(filePath);
    if (!media) return;
    const progress = Math.min(100, Math.max(0, (meta.lastPosition / (meta.duration || 1)) * 100));
    const card = createCard(media, () => openVideo(media));
    const progressEl = document.createElement('div');
    progressEl.className = 'progress';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = `${progress}%`;
    progressEl.appendChild(bar);
    card.appendChild(progressEl);
    grid.appendChild(card);
  });
  if (!grid.children.length) {
    grid.innerHTML = '<p class="empty-state">You have nothing to continue right now.</p>';
  }
}

function renderRecent(mediaIndex) {
  const grid = document.getElementById('recentGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const entries = Object.entries(state.data.movies || {})
    .filter(([, meta]) => meta.lastWatched)
    .sort(([, a], [, b]) => (b.lastWatched || 0) - (a.lastWatched || 0))
    .slice(0, 10);
  entries.forEach(([filePath, meta]) => {
    const media = mediaIndex.get(filePath);
    if (!media) return;
    const card = createCard(media, () => openVideo(media));
    const tag = document.createElement('div');
    tag.className = 'badge';
    tag.textContent = meta.type === 'movie' ? 'Movie' : 'Episode';
    card.querySelector('.card-body').appendChild(tag);
    grid.appendChild(card);
  });
  if (!grid.children.length) {
    grid.innerHTML = '<p class="empty-state">Watch something to fill this list.</p>';
  }
}

function bindSearch(mediaIndex) {
  const input = document.getElementById('searchInput');
  const results = document.getElementById('searchResults');
  if (!input || !results) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    results.innerHTML = '';
    results.classList.remove('active');
    if (!q) return;

    const showMatches = state.library.shows.filter((show) => show.name.toLowerCase().includes(q));
    const movieMatches = state.library.movies.filter((movie) => movie.title.toLowerCase().includes(q));
    const episodeMatches = [];
    state.library.shows.forEach((show) => {
      show.seasons.forEach((season) => {
        if (season.name.toLowerCase().includes(q)) {
          episodeMatches.push({ ...season, type: 'season', show: show.name });
        }
        season.episodes.forEach((ep) => {
          if (ep.title.toLowerCase().includes(q)) {
            episodeMatches.push({ ...ep });
          }
        });
      });
    });

    const groups = [
      { label: 'Shows', items: showMatches, handler: (item) => (window.location.href = `show.html?show=${encodeURIComponent(item.name)}`) },
      { label: 'Movies', items: movieMatches, handler: (item) => openVideo(item) },
      { label: 'Episodes & Seasons', items: episodeMatches, handler: (item) => {
        if (item.type === 'season') {
          window.location.href = `season.html?show=${encodeURIComponent(item.show)}&season=${encodeURIComponent(item.name)}`;
        } else {
          openVideo(item);
        }
      } }
    ];

    groups.forEach((group) => {
      if (!group.items.length) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'search-group';
      const title = document.createElement('h4');
      title.textContent = group.label;
      wrapper.appendChild(title);
      group.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'search-item';
        row.addEventListener('click', () => group.handler(item));
        const thumb = document.createElement('img');
        const coverPath = item.cover || item.banner;
        thumb.src = coverPath ? window.sisterStreamAPI.toFileUrl(coverPath) : DEFAULT_COVER;
        thumb.alt = item.title || item.name;
        thumb.width = 40;
        thumb.height = 40;
        const text = document.createElement('div');
        text.innerHTML = `<strong>${item.title || item.name}</strong><br><span style="color: var(--muted); font-size: 12px;">${item.show ? `${item.show} · ` : ''}${item.season || item.type || ''}</span>`;
        row.appendChild(thumb);
        row.appendChild(text);
        wrapper.appendChild(row);
      });
      results.appendChild(wrapper);
    });

    if (results.children.length) {
      results.classList.add('active');
    }
  });
}

function renderShowPage() {
  const params = new URLSearchParams(window.location.search);
  const targetShow = params.get('show');
  const show = state.library.shows.find((s) => s.name === targetShow);
  if (!show) return;

  const banner = document.getElementById('showBanner');
  const title = document.getElementById('showTitle');
  if (banner && title) {
    banner.style.backgroundImage = `url(${window.sisterStreamAPI.toFileUrl(show.cover)})`;
    title.textContent = show.name;
  }

  const grid = document.getElementById('seasonGrid');
  if (grid) {
    grid.innerHTML = '';
    show.seasons.forEach((season) => {
      const card = createCard({ ...season, title: season.name }, () => {
        window.location.href = `season.html?show=${encodeURIComponent(show.name)}&season=${encodeURIComponent(season.name)}`;
      });
      grid.appendChild(card);
    });
  }

  const homeLink = document.getElementById('homeLink');
  if (homeLink) {
    homeLink.addEventListener('click', () => (window.location.href = 'index.html'));
  }
}

function renderSeasonPage() {
  const params = new URLSearchParams(window.location.search);
  const targetShow = params.get('show');
  const targetSeason = params.get('season');
  const show = state.library.shows.find((s) => s.name === targetShow);
  if (!show) return;
  const season = show.seasons.find((s) => s.name === targetSeason);
  if (!season) return;

  const breadcrumb = document.getElementById('seasonBreadcrumb');
  const title = document.getElementById('seasonTitle');
  if (breadcrumb) breadcrumb.textContent = `${show.name}`;
  if (title) title.textContent = `${season.name}`;

  const list = document.getElementById('episodeList');
  if (list) {
    list.innerHTML = '';
    season.episodes.forEach((episode) => {
      const card = document.createElement('div');
      card.className = 'episode-card';
      card.addEventListener('click', () => openVideo(episode));
      const img = document.createElement('img');
      img.src = window.sisterStreamAPI.toFileUrl(episode.cover);
      img.alt = episode.title;
      const details = document.createElement('div');
      details.className = 'episode-details';
      const heading = document.createElement('h4');
      heading.textContent = `E${episode.episodeNumber}: ${episode.title}`;
      const sub = document.createElement('p');
      const meta = state.data.movies[episode.filePath] || {};
      const pct = meta.duration ? Math.round((meta.lastPosition || 0) / meta.duration * 100) : 0;
      sub.textContent = pct ? `Progress: ${pct}%` : 'Not started';
      details.appendChild(heading);
      details.appendChild(sub);
      card.appendChild(img);
      card.appendChild(details);
      if (pct) {
        const progress = document.createElement('div');
        progress.className = 'progress';
        const bar = document.createElement('div');
        bar.className = 'bar';
        bar.style.width = `${pct}%`;
        progress.appendChild(bar);
        card.appendChild(progress);
      }
      list.appendChild(card);
    });
  }

  const homeLink = document.getElementById('homeLink');
  if (homeLink) {
    homeLink.addEventListener('click', () => (window.location.href = 'index.html'));
  }
}

function openVideo(media) {
  closeOverlay();
  state.currentMedia = media;
  const overlay = document.getElementById('overlay');
  const backdrop = document.createElement('div');
  backdrop.className = 'overlay-backdrop';

  const panel = document.createElement('div');
  panel.className = 'overlay-panel';

  const header = document.createElement('div');
  header.className = 'overlay-header';
  const title = document.createElement('div');
  title.textContent = media.type === 'episode' ? `${media.show} · ${media.season} · ${media.title}` : media.title;
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeOverlay);
  header.appendChild(title);
  header.appendChild(closeBtn);

  const videoWrapper = document.createElement('div');
  videoWrapper.className = 'overlay-video';
  const video = document.createElement('video');
  video.controls = true;
  video.src = window.sisterStreamAPI.toFileUrl(media.filePath);
  videoWrapper.appendChild(video);

  panel.appendChild(header);
  panel.appendChild(videoWrapper);
  backdrop.appendChild(panel);
  overlay.innerHTML = '';
  overlay.appendChild(backdrop);

  state.overlay = backdrop;
  state.videoEl = video;

  const record = state.data.movies[media.filePath] || { lastPosition: 0, duration: 0 };
  state.data.movies[media.filePath] = {
    ...record,
    type: media.type,
    show: media.show,
    season: media.season,
    episodeTitle: media.title,
    lastWatched: Date.now()
  };
  persistData();

  let lastSaved = 0;
  let resumePopup;
  let nextPopup;

  const showResume = () => {
    if (!record.lastPosition || !video.duration) return;
    if (record.lastPosition < 60 || record.lastPosition > video.duration - 60) return;
    resumePopup = document.createElement('div');
    resumePopup.className = 'resume-popup';
    resumePopup.innerHTML = `<strong>Resume?</strong><button id="resumeBtn">Resume</button><button id="restartBtn">Start Over</button>`;
    panel.appendChild(resumePopup);
    resumePopup.querySelector('#resumeBtn').addEventListener('click', () => {
      video.currentTime = record.lastPosition;
      resumePopup.remove();
    });
    resumePopup.querySelector('#restartBtn').addEventListener('click', () => {
      video.currentTime = 0;
      resumePopup.remove();
    });
  };

  const saveProgress = () => {
    if (!video.duration) return;
    state.data.movies[media.filePath] = {
      ...state.data.movies[media.filePath],
      duration: video.duration,
      lastPosition: video.currentTime,
      lastWatched: Date.now(),
      type: media.type,
      show: media.show,
      season: media.season,
      episodeTitle: media.title
    };
    persistData();
  };

  const handleNext = () => {
    const next = getNextEpisode(media);
    if (!next) return;
    nextPopup = document.createElement('div');
    nextPopup.className = 'next-popup';
    nextPopup.innerHTML = `<div>Up next: <strong>${next.title}</strong></div><button>Play Next</button>`;
    nextPopup.querySelector('button').addEventListener('click', () => {
      openVideo(next);
    });
    panel.appendChild(nextPopup);
  };

  video.addEventListener('loadedmetadata', () => {
    showResume();
  });

  video.addEventListener('timeupdate', () => {
    if (video.currentTime - lastSaved >= 3) {
      lastSaved = video.currentTime;
      saveProgress();
    }
  });

  video.addEventListener('ended', () => {
    state.data.movies[media.filePath] = {
      ...state.data.movies[media.filePath],
      lastPosition: 0,
      duration: video.duration,
      lastWatched: Date.now()
    };
    persistData();
    handleNext();
  });

  const handleKey = (event) => {
    if (!state.videoEl) return;
    switch (event.key.toLowerCase()) {
      case ' ':
        event.preventDefault();
        if (video.paused) video.play(); else video.pause();
        break;
      case 'arrowleft':
        video.currentTime = Math.max(0, video.currentTime - 10);
        break;
      case 'arrowright':
        video.currentTime = Math.min(video.duration, video.currentTime + 10);
        break;
      case 'm':
        video.muted = !video.muted;
        break;
      case 'f':
        toggleFullscreen(videoWrapper);
        break;
      case 'escape':
        if (document.fullscreenElement) {
          document.exitFullscreen();
        } else {
          closeOverlay();
        }
        break;
      default:
        break;
    }
  };

  document.addEventListener('keydown', handleKey);

  state.overlayCleanup = () => {
    document.removeEventListener('keydown', handleKey);
    if (resumePopup) resumePopup.remove();
    if (nextPopup) nextPopup.remove();
  };
}

function toggleFullscreen(element) {
  if (!document.fullscreenElement) {
    element.requestFullscreen?.();
  } else {
    document.exitFullscreen();
  }
}

function closeOverlay() {
  if (state.overlay) {
    if (state.overlayCleanup) state.overlayCleanup();
    state.overlay.remove();
    state.overlay = null;
  }
  state.videoEl = null;
  state.currentMedia = null;
}

function getNextEpisode(media) {
  if (media.type !== 'episode') return null;
  const show = state.library.shows.find((s) => s.name === media.show);
  if (!show) return null;
  const season = show.seasons.find((s) => s.name === media.season);
  if (!season) return null;
  const currentIdx = season.episodes.findIndex((ep) => ep.filePath === media.filePath);
  if (currentIdx === -1) return null;
  if (currentIdx < season.episodes.length - 1) {
    return season.episodes[currentIdx + 1];
  }
  return null;
}

function persistData() {
  window.sisterStreamAPI.saveData(state.data);
}

document.addEventListener('DOMContentLoaded', init);
