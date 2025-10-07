/* ---------- CONFIG ---------- */
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const TTL = 10 * 60 * 1000;

/* ---------- INDEXEDDB ---------- */
const DB_NAME = 'AniFoxDB';
const DB_VERSION = 1;
const STORE_SEARCH_HISTORY = 'search_history';
const STORE_FAVORITES = 'favorites';
const STORE_SEARCH_RESULTS = 'search_results';

let db = null;
async function initDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => { db = req.result; resolve(db); };
    req.onupgradeneeded = e => {
      const d = e.target.result;
      [STORE_SEARCH_HISTORY, STORE_FAVORITES, STORE_SEARCH_RESULTS].forEach(n => {
        if (!d.objectStoreNames.contains(n)) {
          const s = d.createObjectStore(n, { keyPath: n === STORE_SEARCH_RESULTS ? 'query' : 'id' });
          s.createIndex('timestamp', 't', { unique: false });
          if (n === STORE_FAVORITES) s.createIndex('title', 'title', { unique: false });
        }
      });
    };
  });
}
async function dbAdd(s, d)   { await initDB(); return db.transaction([s], 'readwrite').objectStore(s).add(d); }
async function dbPut(s, d)   { await initDB(); return db.transaction([s], 'readwrite').objectStore(s).put(d); }
async function dbGet(s, k)   { await initDB(); return db.transaction([s], 'readonly').objectStore(s).get(k); }
async function dbGetAll(s, i){ await initDB(); return (i ? db.transaction([s], 'readonly').objectStore(s).index(i) : db.transaction([s], 'readonly').objectStore(s)).getAll(); }
async function dbDel(s, k)   { await initDB(); return db.transaction([s], 'readwrite').objectStore(s).delete(k); }
async function dbClear(s)    { await initDB(); return db.transaction([s], 'readwrite').objectStore(s).clear(); }

/* ---------- FETCH ---------- */
async function fetchKodik(url, attempt = 1) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(url, { signal: ctrl.signal });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  } catch (e) {
    clearTimeout(t);
    if (attempt >= 3) throw e;
    await new Promise(r => setTimeout(r, attempt * 500));
    return fetchKodik(url, attempt + 1);
  }
}

/* ---------- API ---------- */
async function apiSearch(q) {
  q = q.trim().toLowerCase();
  if (!q) return { results: [] };
  const key = `${q}_all`;
  try {
    const cached = await dbGet(STORE_SEARCH_RESULTS, key);
    if (cached && Date.now() - cached.t < TTL) return cached.data;
  } catch {}
  const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(q)}&types=anime,anime-serial&with_material_data=true`;
  const data = await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS, { query: key, data, t: Date.now() }).catch(() => {});
  return data;
}
async function apiWeekly() {
  const key = `weekly_all`;
  try {
    const cached = await dbGet(STORE_SEARCH_RESULTS, key);
    if (cached && Date.now() - cached.t < TTL) return cached.data;
  } catch {}
  const url = `${BASE.replace('/search', '/list')}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&with_material_data=true`;
  const data = await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS, { query: key, data, t: Date.now() }).catch(() => {});
  return data;
}

/* ---------- UTILS ---------- */
const $ = id => document.getElementById(id);
function showNote(msg, type = 'info') {
  const n = document.createElement('div');
  n.className = `notification notification-${type}`;
  n.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i><span>${msg}</span><button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

/* ---------- CARD ---------- */
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
        <button class="action-btn favorite-btn" onclick='toggleFavorite(${JSON.stringify(t)}, ${JSON.stringify(item.link)})' title="Добавить в избранное"><i class="far fa-heart"></i></button>
        <button class="action-btn" onclick='shareAnime(${JSON.stringify(t)}, ${JSON.stringify(item.link)})' title="Поделиться"><i class="fas fa-share"></i></button>
      </div>
    </div>`;
}

/* ---------- FAVORITES ---------- */
window.toggleFavorite = async (title, link) => {
  try {
    const db = await initDB(); // Ждем инициализации БД
    const favs = await dbGetAll(STORE_FAVORITES);
    const old = favs.find(f => f.link === link);
    if (old) {
      await dbDel(STORE_FAVORITES, old.id);
      showNote(`«${title}» удалено из избранного`, 'info');
      updateFavBtn(link, false);
    } else {
      await dbAdd(STORE_FAVORITES, { id: Date.now(), title, link, t: Date.now() });
      showNote(`«${title}» добавлено в избранное`, 'success');
      updateFavBtn(link, true);
    }
  } catch (e) { 
    console.error('Ошибка toggleFavorite:', e);
    showNote('Ошибка при работе с избранным', 'error'); 
  }
};

async function renderFavoritesPage() {
  const box = $('resultsBox');
  if (!box) return;
  
  box.innerHTML = '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка избранного...</p></div>';
  
  try {
    // Ждем полной инициализации БД
    const db = await initDB();
    
    const favs = (await dbGetAll(STORE_FAVORITES, 'timestamp')).sort((a, b) => b.t - a.t);
    
    if (!favs.length) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>В избранном пока ничего нет</h2><p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p><button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div>`;
      return;
    }
    
    let html = `<section class="favorites-section"><div class="section-header"><h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Всего: <span class="stats-highlight">${favs.length} аниме</span></span></div></div><div class="results-grid">`;
    html += favs.map(f => createAnimeCard({ title: f.title, link: f.link })).join('');
    html += `</div><div class="favorites-actions"><button onclick="clearFavorites()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить избранное</button><button onclick="navigateToHome()" class="clear-history-btn secondary"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div></section>`;
    box.innerHTML = html;
    
  } catch (e) { 
    console.error('Ошибка renderFavoritesPage:', e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки избранного</h2><p>Попробуйте перезагрузить страницу</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}

window.clearFavorites = async () => {
  if (confirm('Очистить всё избранное?')) {
    try {
      const db = await initDB(); // Ждем инициализации
      await dbClear(STORE_FAVORITES);
      renderFavoritesPage();
      showNote('Избранное очищено', 'success');
    } catch (e) {
      console.error('Ошибка clearFavorites:', e);
      showNote('Ошибка при очистке избранного', 'error');
    }
  }
};

// Также обновим функцию initDB для лучшей обработки ошибок
async function initDB() {
  if (db) return db;
  
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    
    req.onerror = () => {
      console.error('Ошибка открытия БД:', req.error);
      reject(req.error);
    };
    
    req.onsuccess = () => { 
      db = req.result; 
      
      // Обработка ошибок при закрытии БД
      db.onerror = (e) => {
        console.error('Ошибка БД:', e.target.error);
      };
      
      resolve(db); 
    };
    
    req.onupgradeneeded = e => {
      const d = e.target.result;
      [STORE_SEARCH_HISTORY, STORE_FAVORITES, STORE_SEARCH_RESULTS].forEach(n => {
        if (!d.objectStoreNames.contains(n)) {
          const s = d.createObjectStore(n, { keyPath: n === STORE_SEARCH_RESULTS ? 'query' : 'id' });
          s.createIndex('timestamp', 't', { unique: false });
          if (n === STORE_FAVORITES) s.createIndex('title', 'title', { unique: false });
        }
      });
    };
    
    // Таймаут на случай если БД не открывается
    setTimeout(() => {
      if (!db) {
        reject(new Error('Таймаут инициализации БД'));
      }
    }, 5000);
  });
}

/* ---------- SHARE ---------- */
window.shareAnime = (title, link) => {
  const url = `${location.origin}?q=${encodeURIComponent(title)}`;
  if (navigator.share) navigator.share({ title, text: `Смотри «${title}» на AniFox`, url });
  else { navigator.clipboard.writeText(url); showNote('Ссылка скопирована в буфер обмена', 'success'); }
};

/* ---------- HISTORY ---------- */
async function addHistory(q) {
  if (!q.trim()) return;
  try {
    const hist = await dbGetAll(STORE_SEARCH_HISTORY, 'timestamp');
    const old = hist.find(i => i.query === q);
    if (old) await dbDel(STORE_SEARCH_HISTORY, old.id);
    await dbAdd(STORE_SEARCH_HISTORY, { id: Date.now(), query: q, t: Date.now() });
  } catch {}
}
window.searchFromHistory = q => { $('searchInput').value = q; search(); };
window.removeFromHistory = async (e, id) => { e.stopPropagation(); await dbDel(STORE_SEARCH_HISTORY, id); renderWeekly(); };
window.clearSearchHistory = async () => { if (confirm('Очистить историю?')) { await dbClear(STORE_SEARCH_HISTORY); renderWeekly(); } };

/* ---------- RENDER ---------- */
async function renderFavoritesPage() {
  const box = $('resultsBox');
  if (!box) return;
  await initDB(); // ← обязательно!
  box.innerHTML = '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка избранного...</p></div>';
  try {
    const favs = (await dbGetAll(STORE_FAVORITES, 'timestamp')).sort((a, b) => b.t - a.t);
    if (!favs.length) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>В избранном пока ничего нет</h2><p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p><button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div>`;
      return;
    }
    let html = `<section class="favorites-section"><div class="section-header"><h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Всего: <span class="stats-highlight">${favs.length} аниме</span></span></div></div><div class="results-grid">`;
    html += favs.map(f => createAnimeCard({ title: f.title, link: f.link })).join('');
    html += `</div><div class="favorites-actions"><button onclick="clearFavorites()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить избранное</button><button onclick="navigateToHome()" class="clear-history-btn secondary"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div></section>`;
    box.innerHTML = html;
  } catch { box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки избранного</h2><p>Попробуйте перезагрузить страницу</p></div>`; }
}
window.clearFavorites = async () => {
  if (confirm('Очистить всё избранное?')) {
    await dbClear(STORE_FAVORITES);
    renderFavoritesPage();
    showNote('Избранное очищено', 'success');
  }
};

async function renderWeekly() {
  const box = $('resultsBox');
  if (!box) return;
  box.innerHTML = '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка новинок...</p></div>';
  const hasHist = await (async () => {
    try {
      const hist = (await dbGetAll(STORE_SEARCH_HISTORY, 'timestamp')).sort((a, b) => b.t - a.t).slice(0, 10);
      if (!hist.length) return false;
      let h = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
      hist.forEach(i => h += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g, "\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event, ${i.id})"><i class="fas fa-times"></i></span></button>`);
      h += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
      box.innerHTML = h;
      return true;
    } catch { return false; }
  })();
  try {
    const data = await apiWeekly();
    const seen = new Set();
    const list = (data.results || []).filter(i => { const k = i.title.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
    if (list.length) {
      let html = (hasHist ? box.innerHTML : '') + `<section class="weekly-section"><h2 class="section-title fade-in"><i class="fas fa-bolt"></i> Свежее за неделю</h2><div class="results-grid">`;
      html += list.map(createAnimeCard).join('');
      html += `</div></section>`;
      box.innerHTML = html;
    } else if (!hasHist) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Добро пожаловать в AniFox!</h2><p>Начните с поиска аниме</p><ul><li><i class="fas fa-search"></i> Используйте поиск для нахождения аниме</li><li><i class="fas fa-history"></i> Просматривайте историю поиска</li><li><i class="fas fa-bolt"></i> Смотрите свежие обновления</li><li><i class="fas fa-heart"></i> Добавляйте аниме в избранное</li></ul></div>`;
    }
  } catch { if (!hasHist) box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте перезагрузить страницу</p></div>`; }
}

async function search() {
  const input = $('searchInput');
  const q = input?.value.trim() || '';
  const box = $('resultsBox');
  if (!box) return;
  if (!q) { renderWeekly(); return; }
  box.innerHTML = '<div class="loading-container"><div class="loading"></div><p class="loading-text">Поиск аниме...</p></div>';
  await addHistory(q);
  try {
    const data = await apiSearch(q);
    const seen = new Set();
    currentSearchResults = (data.results || []).filter(item => {
      const key = item.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!currentSearchResults.length) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>По запросу «${q}» ничего не найдено</h2><p>Попробуйте изменить запрос:</p><ul><li><i class="fas fa-spell-check"></i> Проверить правильность написания</li><li><i class="fas fa-language"></i> Использовать английское название</li><li><i class="fas fa-filter"></i> Искать по жанру или году</li><li><i class="fas fa-simplify"></i> Упростить запрос</li></ul></div>`;
      setTimeout(async () => { const h = await (async () => { const hist = (await dbGetAll(STORE_SEARCH_HISTORY, 'timestamp')).sort((a, b) => b.t - a.t).slice(0, 10); if (!hist.length) return false; let html = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`; hist.forEach(i => html += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g, "\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event, ${i.id})"><i class="fas fa-times"></i></span></button>`); html += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`; box.innerHTML += '<div class="content-separator"></div>' + html; return true; })(); if (h) box.innerHTML += '<div class="content-separator"></div>' + box.innerHTML; }, 100);
      return;
    }
    let html = `<section class="search-results-section"><div class="search-header"><h2 class="section-title fade-in"><i class="fas fa-search"></i> Результаты поиска: «${q}»</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${currentSearchResults.length} аниме</span> по запросу «${q}»</span></div></div><div class="results-grid">`;
    html += currentSearchResults.map(createAnimeCard).join('');
    html += `</div></section>`;
    box.innerHTML = html;
    history.replaceState(null, null, '?q=' + encodeURIComponent(q));
    input.value = '';
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте повторить поиск позже</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}

/* ---------- HEADER ---------- */
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
  const url = location.search ? `${location.pathname}${location.search}${location.search.includes('?') ? '&' : '?'}page=favorites` : `${location.pathname}?page=favorites`;
  history.replaceState(null, null, url);
  updateHeader();
  renderFavoritesPage();
};

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  document.body.insertAdjacentHTML('afterbegin', '<div id="mainPreloader" class="preloader-overlay"><div class="preloader-content"><div class="preloader-spinner"></div><p class="preloader-text">Загрузка AniFox...</p></div></div>');
  await initDB();
  const fa = document.createElement('link'); fa.rel = 'stylesheet'; fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'; document.head.appendChild(fa);
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
  document.getElementById('mainPreloader').remove();
});