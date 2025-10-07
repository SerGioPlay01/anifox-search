/* ---------- CONFIG ---------- */
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const CACHE = new Map();
const TTL = 10 * 60 * 1000;

// IndexedDB конфигурация
const DB_NAME = 'AniFoxDB';
const DB_VERSION = 1;
const STORE_SEARCH_HISTORY = 'search_history';
const STORE_FAVORITES = 'favorites';
const STORE_SEARCH_RESULTS = 'search_results';
const STORE_ANIME_INFO = 'anime_info';

// Глобальные переменные
let currentSearchResults = [];
let currentWeeklyResults = [];

/* ---------- UTILS ---------- */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- ПРЕЛОАДЕРЫ ---------- */
function showMainPreloader() {
  const preloader = document.createElement('div');
  preloader.id = 'mainPreloader';
  preloader.className = 'preloader-overlay';
  preloader.innerHTML = `
    <div class="preloader-content">
      <div class="preloader-spinner"></div>
      <p class="preloader-text">Загрузка AniFox...</p>
    </div>
  `;
  document.body.appendChild(preloader);
}

function hideMainPreloader() {
  const preloader = document.getElementById('mainPreloader');
  if (preloader) preloader.remove();
}

function showSectionPreloader(section) {
  const box = $("resultsBox");
  if (!box) return;
  box.innerHTML = `
    <div class="section-preloader">
      <div class="preloader-spinner small"></div>
      <p class="preloader-text">Загрузка ${section}...</p>
    </div>
  `;
}

/* ---------- INDEXEDDB ---------- */
let db = null;
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      [STORE_SEARCH_HISTORY, STORE_FAVORITES, STORE_SEARCH_RESULTS, STORE_ANIME_INFO]
        .forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            const s = db.createObjectStore(name, { keyPath: name === 'search_results' ? 'query' : 'id' });
            s.createIndex('timestamp', 't', { unique: false });
            if (name === STORE_FAVORITES) s.createIndex('title', 'title', { unique: false });
          }
        });
    };
  });
}
async function dbAdd(store, data)   { if (!db) await initDB(); const tx = db.transaction([store], 'readwrite'); return tx.objectStore(store).add(data); }
async function dbPut(store, data)   { if (!db) await initDB(); const tx = db.transaction([store], 'readwrite'); return tx.objectStore(store).put(data); }
async function dbGet(store, key)    { if (!db) await initDB(); const tx = db.transaction([store], 'readonly');  return tx.objectStore(store).get(key); }
async function dbGetAll(store, idx) { if (!db) await initDB(); const tx = db.transaction([store], 'readonly');  return (idx ? tx.objectStore(store).index(idx) : tx.objectStore(store)).getAll(); }
async function dbDelete(store, key) { if (!db) await initDB(); const tx = db.transaction([store], 'readwrite'); return tx.objectStore(store).delete(key); }
async function dbClear(store)       { if (!db) await initDB(); const tx = db.transaction([store], 'readwrite'); return tx.objectStore(store).clear(); }

/* ---------- FETCH + RETRY ---------- */
async function fetchKodik(url, attempt = 1) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  } catch (e) {
    clearTimeout(t);
    if (attempt >= 3) throw e;
    await sleep(attempt * 500);
    return fetchKodik(url, attempt + 1);
  }
}

/* ---------- API + КЭШ ---------- */
async function apiSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) return { results: [] };
  const cacheKey = `${q}_all_results`;
  try {
    const cached = await dbGet(STORE_SEARCH_RESULTS, cacheKey);
    if (cached && Date.now() - cached.t < TTL) return cached.data;
  } catch {}
  const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(q)}&types=anime,anime-serial&with_material_data=true`;
  const data = await fetchKodik(url);
  try { await dbPut(STORE_SEARCH_RESULTS, { query: cacheKey, data, t: Date.now() }); } catch {}
  return data;
}
async function apiWeekly() {
  const cacheKey = `weekly_all_results`;
  try {
    const cached = await dbGet(STORE_SEARCH_RESULTS, cacheKey);
    if (cached && Date.now() - cached.t < TTL) return cached.data;
  } catch {}
  const url = `${BASE.replace("/search", "/list")}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&with_material_data=true`;
  const data = await fetchKodik(url);
  try { await dbPut(STORE_SEARCH_RESULTS, { query: cacheKey, data, t: Date.now() }); } catch {}
  return data;
}

/* ---------- UI ---------- */
function showLoading() {
  const box = $("resultsBox");
  if (box) box.innerHTML = `
    <div class="loading-container">
      <div class="loading"></div>
      <p class="loading-text">Поиск аниме...</p>
    </div>`;
}
async function addToSearchHistory(query) {
  if (!query.trim()) return;
  try {
    const hist = await dbGetAll(STORE_SEARCH_HISTORY, 'timestamp');
    const old = hist.find(i => i.query === query);
    if (old) await dbDelete(STORE_SEARCH_HISTORY, old.id);
    await dbAdd(STORE_SEARCH_HISTORY, { id: Date.now(), query, t: Date.now() });
  } catch {}
}
async function renderSearchHistory() {
  const box = $("resultsBox");
  if (!box) return false;
  try {
    const hist = (await dbGetAll(STORE_SEARCH_HISTORY, 'timestamp')).sort((a, b) => b.t - a.t).slice(0, 10);
    if (!hist.length) return false;
    let html = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
    hist.forEach(i => html += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g, "\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event, ${i.id})"><i class="fas fa-times"></i></span></button>`);
    html += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
    box.innerHTML = html;
    return true;
  } catch { return false; }
}
window.searchFromHistory = q => { $("searchInput").value = q; search(); };
window.removeFromHistory = async (e, id) => { e.stopPropagation(); await dbDelete(STORE_SEARCH_HISTORY, id); renderSearchHistory(); };
window.clearSearchHistory = async () => { if (confirm('Очистить историю?')) { await dbClear(STORE_SEARCH_HISTORY); renderWeekly(); } };

function createAnimeCard(item) {
  const t = item.title;
  return `
    <div class="card fade-in">
      <div class="card-header">
        <h3 class="h2_name">${t}</h3>
        <div class="info-links">
          <a href="https://shikimori.one/animes?search=${encodeURIComponent(t)}" target="_blank" class="info-link" title="Shikimori"><i class="fas fa-external-link-alt"></i></a>
          <a href="https://anilist.co/search/anime?search=${encodeURIComponent(t)}" target="_blank" class="info-link" title="AniList"><i class="fas fa-external-link-alt"></i></a>
          <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(t)}" target="_blank" class="info-link" title="MyAnimeList"><i class="fas fa-external-link-alt"></i></a>
        </div>
      </div>
      <iframe class="single-player" src="${item.link}" allowfullscreen loading="lazy" title="Плеер: ${t}"></iframe>
      <div class="card-actions">
        <button class="action-btn favorite-btn" onclick="toggleFavorite('${t.replace(/'/g, "\\'")}', '${item.link}')" title="Добавить в избранное"><i class="far fa-heart"></i></button>
        <button class="action-btn" onclick="shareAnime('${t.replace(/'/g, "\\'")}', '${item.link}')" title="Поделиться"><i class="fas fa-share"></i></button>
      </div>
    </div>`;
}
window.toggleFavorite = async (title, link) => {
  try {
    const favs = await dbGetAll(STORE_FAVORITES);
    const old = favs.find(f => f.link === link);
    if (old) {
      await dbDelete(STORE_FAVORITES, old.id);
      showNotification(`"${title}" удалено из избранного`, 'info');
      updateFavoriteButton(link, false);
    } else {
      await dbAdd(STORE_FAVORITES, { id: Date.now(), title, link, t: Date.now() });
      showNotification(`"${title}" добавлено в избранное`, 'success');
      updateFavoriteButton(link, true);
    }
  } catch { showNotification('Ошибка при работе с избранным', 'error'); }
};
function updateFavoriteButton(link, is) {
  document.querySelectorAll('.favorite-btn').forEach(b => {
    if (b.onclick && b.onclick.toString().includes(link)) {
      b.querySelector('i').className = is ? 'fas fa-heart' : 'far fa-heart';
      b.title = is ? 'Удалить из избранного' : 'Добавить в избранное';
    }
  });
}
window.shareAnime = (title, link) => {
  const url = `${location.origin}?q=${encodeURIComponent(title)}`;
  if (navigator.share) navigator.share({ title, text: `Смотри «${title}» на AniFox`, url });
  else { navigator.clipboard.writeText(url); showNotification('Ссылка скопирована', 'success'); }
};
function showNotification(msg, type = 'info') {
  const n = document.createElement('div');
  n.className = `notification notification-${type}`;
  n.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i><span>${msg}</span><button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}
function updateSearchCounter(q, c) {
  const el = document.querySelector('.search-header .stats-info .stats-text');
  if (el) el.innerHTML = `<i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${c} аниме</span> по запросу «${q}»`;
}

/* ---------- РЕНДЕРИНГ ---------- */
window.renderFavoritesPage = async () => {
  const box = $("resultsBox");
  if (!box) return;
  showSectionPreloader('избранного');
  try {
    const favs = (await dbGetAll(STORE_FAVORITES, 'timestamp')).sort((a, b) => b.t - a.t);
    if (!favs.length) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>В избранном пока ничего нет</h2><p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p><button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div>`;
      return;
    }
    let html = `<section class="favorites-section"><div class="section-header"><h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Всего: <span class="stats-highlight">${favs.length} аниме</span></span></div></div><div class="databases-info"><h3><i class="fas fa-database"></i> Базы данных аниме</h3><div class="database-links"><a href="https://shikimori.one" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Shikimori</a><a href="https://anilist.co" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniList</a><a href="https://myanimelist.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> MyAnimeList</a><a href="https://anidb.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniDB</a><a href="https://kitsu.io" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Kitsu</a></div></div><div class="results-grid" id="favoritesGrid">`;
    html += favs.map(f => createAnimeCard({ title: f.title, link: f.link })).join('');
    html += `</div><div class="favorites-actions"><button onclick="clearFavorites()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить избранное</button><button onclick="navigateToHome()" class="clear-history-btn secondary"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div></section>`;
    box.innerHTML = html;
  } catch { box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки избранного</h2><p>Попробуйте перезагрузить страницу</p></div>`; }
};
window.clearFavorites = async () => {
  if (confirm('Очистить всё избранное?')) {
    await dbClear(STORE_FAVORITES);
    renderFavoritesPage();
    showNotification('Избранное очищено', 'success');
  }
};
async function renderWeekly() {
  const box = $("resultsBox");
  if (!box) return;
  showSectionPreloader('новинок');
  let html = '';
  const hasHist = await renderSearchHistory();
  if (hasHist) html = box.innerHTML;
  try {
    const data = await apiWeekly();
    currentWeeklyResults = (data.results || []);
    if (currentWeeklyResults.length) {
      if (hasHist) html += `<section class="weekly-section">`; else html = `<section class="weekly-section">`;
      html += `<h2 class="section-title fade-in"><i class="fas fa-bolt"></i> Свежее за неделю</h2><div class="databases-info"><h3><i class="fas fa-database"></i> Базы данных аниме</h3><div class="database-links"><a href="https://shikimori.one" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Shikimori</a><a href="https://anilist.co" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniList</a><a href="https://myanimelist.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> MyAnimeList</a><a href="https://anidb.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniDB</a><a href="https://kitsu.io" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Kitsu</a></div></div><div class="results-grid" id="weeklyGrid">`;
      html += currentWeeklyResults.map(createAnimeCard).join('');
      html += `</div></section>`;
      box.innerHTML = html;
    } else if (!hasHist) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Добро пожаловать в AniFox!</h2><p>Начните с поиска аниме</p><ul><li><i class="fas fa-search"></i> Используйте поиск для нахождения аниме</li><li><i class="fas fa-history"></i> Просматривайте историю поиска</li><li><i class="fas fa-bolt"></i> Смотрите свежие обновления</li><li><i class="fas fa-heart"></i> Добавляйте аниме в избранное</li></ul></div>`;
    }
  } catch {
    if (!hasHist) box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте перезагрузить страницу</p></div>`;
  }
}
function clearSearchInputAfterSuccess() { $("searchInput").value = ""; }

/* ---------- ОБНОВЛЁННАЯ ФУНКЦИЯ ПОИСКА (без дублей) ---------- */
async function search() {
  const input = $("searchInput");
  const q = input?.value.trim() || "";
  const box = $("resultsBox");
  if (!box) return;
  if (!q) { await renderWeekly(); return; }
  showSectionPreloader('результатов поиска');
  await addToSearchHistory(q);
  try {
    const data = await apiSearch(q);
    // ----- убираем дубли -----
    const seen = new Set();
    currentSearchResults = (data.results || []).filter(item => {
      const key = item.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    // -------------------------
    if (!currentSearchResults.length) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>По запросу «${q}» ничего не найдено</h2><p>Попробуйте изменить запрос:</p><ul><li><i class="fas fa-spell-check"></i> Проверить правильность написания</li><li><i class="fas fa-language"></i> Использовать английское название</li><li><i class="fas fa-filter"></i> Искать по жанру или году</li><li><i class="fas fa-simplify"></i> Упростить запрос</li></ul></div>`;
      setTimeout(async () => { const h = await renderSearchHistory(); if (h) box.innerHTML += '<div class="content-separator"></div>' + box.innerHTML; }, 100);
      return;
    }
    let html = `<section class="search-results-section"><div class="search-header"><h2 class="section-title fade-in"><i class="fas fa-search"></i> Результаты поиска: «${q}»</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${currentSearchResults.length} аниме</span> по запросу «${q}»</span></div></div><div class="databases-info"><h3><i class="fas fa-database"></i> Базы данных аниме</h3><div class="database-links"><a href="https://shikimori.one" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Shikimori</a><a href="https://anilist.co" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniList</a><a href="https://myanimelist.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> MyAnimeList</a><a href="https://anidb.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniDB</a><a href="https://kitsu.io" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Kitsu</a></div></div><div class="results-grid" id="searchResultsGrid">`;
    html += currentSearchResults.map(createAnimeCard).join('');
    html += `</div></section>`;
    box.innerHTML = html;
    history.replaceState(null, null, '?q=' + encodeURIComponent(q));
    clearSearchInputAfterSuccess();
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте повторить поиск позже</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  showMainPreloader();
  try {
    await initDB();
    const fa = document.createElement('link');
    fa.rel = 'stylesheet'; fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(fa);
    updateHeader();
    const form = $('searchForm');
    const input = $('searchInput');
    const btn = $('scrollToTop');
    if (form) form.addEventListener('submit', e => { e.preventDefault(); search(); });
    if (input) {
      const p = new URLSearchParams(location.search);
      const q = p.get('q'), page = p.get('page');
      if (page === 'favorites') renderFavoritesPage();
      else if (q) { input.value = q; search(); }
      else renderWeekly();
    }
    if (btn) {
      window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 300));
      btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }
  } finally { setTimeout(hideMainPreloader, 1000); }
});
function updateHeader() {
  const h = document.querySelector('.top');
  if (h) h.innerHTML = `
    <a class="logo-link" href="/" onclick="navigateToHome(event)">
      <i class="fas fa-fox" style="font-size:1.5rem"></i>
      <span class="logo-text">AniFox</span>
    </a>
    <nav class="header-nav">
      <button class="nav-btn ${!location.search.includes('page=favorites') ? 'active' : ''}" onclick="navigateToHome()"><i class="fas fa-search"></i> Поиск</button>
      <button class="nav-btn ${location.search.includes('page=favorites') ? 'active' : ''}" onclick="navigateToFavorites()"><i class="fas fa-heart"></i> Избранное</button>
    </nav>`;
}
window.navigateToHome = (e) => {
  if (e) e.preventDefault();
  const url = location.pathname + (location.search.includes('q=') ? location.search.replace(/[?&]page=favorites/g, '') : '');
  history.replaceState(null, null, url);
  updateHeader();
  renderWeekly();
};
window.navigateToFavorites = () => {
  const url = (location.search ? `${location.pathname}${location.search}${location.search.includes('?') ? '&' : '?'}page=favorites` : `${location.pathname}?page=favorites`);
  history.replaceState(null, null, url);
  updateHeader();
  renderFavoritesPage();
};