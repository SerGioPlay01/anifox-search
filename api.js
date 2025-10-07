/* ---------- CONFIG ---------- */
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const LIST_BASE = "https://kodikapi.com/list";
const TTL = 10 * 60 * 1000;

// IndexedDB
const DB_NAME = "AniFoxDB";
const DB_VERSION = 1;
const STORE_SEARCH_HISTORY = "search_history";
const STORE_FAVORITES = "favorites";
const STORE_SEARCH_RESULTS = "search_results";

/* ---------- UTILS ---------- */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- PRELOADERS ---------- */
function showMainPreloader() {
  document.body.insertAdjacentHTML("beforeend", `
    <div id="mainPreloader" class="preloader-overlay">
      <div class="preloader-content"><div class="preloader-spinner"></div><p>Загрузка AniFox...</p></div>
    </div>`);
}
function hideMainPreloader() {
  $("#mainPreloader")?.remove();
}
function showSectionPreloader(section) {
  const box = $("resultsBox");
  if (box) box.innerHTML = `<div class="section-preloader"><div class="small"></div><p>Загрузка ${section}...</p></div>`;
}

/* ---------- INDEXEDDB ---------- */
let db = null;
async function initDB() {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, DB_VERSION);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => { db = open.result; resolve(db); };
    open.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SEARCH_HISTORY)) {
        const sh = db.createObjectStore(STORE_SEARCH_HISTORY, { keyPath: "id" });
        sh.createIndex("timestamp", "t", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        const fv = db.createObjectStore(STORE_FAVORITES, { keyPath: "id" });
        fv.createIndex("timestamp", "t", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SEARCH_RESULTS)) {
        const sr = db.createObjectStore(STORE_SEARCH_RESULTS, { keyPath: "query" });
        sr.createIndex("timestamp", "t", { unique: false });
      }
    };
  });
}
async function dbAdd(store, data) {
  if (!db) await initDB();
  const tx = db.transaction([store], "readwrite");
  return tx.objectStore(store).add(data).then(r => r.result);
}
async function dbPut(store, data) {
  if (!db) await initDB();
  const tx = db.transaction([store], "readwrite");
  return tx.objectStore(store).put(data).then(r => r.result);
}
async function dbGet(store, key) {
  if (!db) await initDB();
  const tx = db.transaction([store], "readonly");
  return tx.objectStore(store).get(key).then(r => r.result);
}
async function dbGetAll(store, idx) {
  if (!db) await initDB();
  const tx = db.transaction([store], "readonly");
  const storeObj = tx.objectStore(store);
  return (idx ? storeObj.index(idx).getAll() : storeObj.getAll()).then(r => r.result);
}
async function dbDelete(store, key) {
  if (!db) await initDB();
  const tx = db.transaction([store], "readwrite");
  return tx.objectStore(store).delete(key).then(r => r.result);
}
async function dbClear(store) {
  if (!db) await initDB();
  const tx = db.transaction([store], "readwrite");
  return tx.objectStore(store).clear().then(r => r.result);
}

/* ---------- FETCH ---------- */
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

/* ---------- API (все страницы сразу) ---------- */
async function apiSearchAll(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const cacheKey = `search_all_${q}`;
  const cached = await dbGet(STORE_SEARCH_RESULTS, cacheKey);
  if (cached && Date.now() - cached.t < TTL) return cached.data;

  let all = [];
  let page = 1;
  while (true) {
    const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(q)}&types=anime,anime-serial&limit=50&with_material_data=true&page=${page}`;
    const data = await fetchKodik(url);
    if (!data.results || !data.results.length) break;
    all = all.concat(data.results);
    if (data.results.length < 50) break;
    page++;
  }
  await dbPut(STORE_SEARCH_RESULTS, { query: cacheKey, data: all, t: Date.now() });
  return all;
}

async function apiWeeklyAll() {
  const cacheKey = `weekly_all`;
  const cached = await dbGet(STORE_SEARCH_RESULTS, cacheKey);
  if (cached && Date.now() - cached.t < TTL) return cached.data;

  let all = [];
  let page = 1;
  while (true) {
    const url = `${LIST_BASE}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&limit=50&with_material_data=true&page=${page}`;
    const data = await fetchKodik(url);
    if (!data.results || !data.results.length) break;
    all = all.concat(data.results);
    if (data.results.length < 50) break;
    page++;
  }
  await dbPut(STORE_SEARCH_RESULTS, { query: cacheKey, data: all, t: Date.now() });
  return all;
}

/* ---------- КАРТОЧКА ---------- */
function createAnimeCard(item) {
  const title = item.title || "Без названия";
  return `
    <div class="card fade-in">
      <div class="card-header">
        <h3 class="h2_name">${title}</h3>
        <div class="info-links">
          <a href="https://shikimori.one/animes?search=${encodeURIComponent(title)}" target="_blank" class="info-link" title="Shikimori"><i class="fas fa-external-link-alt"></i></a>
          <a href="https://anilist.co/search/anime?search=${encodeURIComponent(title)}" target="_blank" class="info-link" title="AniList"><i class="fas fa-external-link-alt"></i></a>
          <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(title)}" target="_blank" class="info-link" title="MyAnimeList"><i class="fas fa-external-link-alt"></i></a>
        </div>
      </div>
      <iframe class="single-player" src="${item.link}" allowfullscreen loading="lazy" title="Плеер: ${title}"></iframe>
      <div class="card-actions">
        <button class="action-btn favorite-btn" onclick="toggleFavorite('${title.replace(/'/g, "\\'")}', '${item.link}')" title="Добавить в избранное"><i class="far fa-heart"></i></button>
        <button class="action-btn" onclick="shareAnime('${title.replace(/'/g, "\\'")}', '${item.link}')" title="Поделиться"><i class="fas fa-share"></i></button>
      </div>
    </div>
  `;
}

/* ---------- ИЗБРАННОЕ ---------- */
window.toggleFavorite = async (title, link) => {
  const favs = await dbGetAll(STORE_FAVORITES);
  const ex = favs.find(f => f.link === link);
  if (ex) {
    await dbDelete(STORE_FAVORITES, ex.id);
    showNotification(`"${title}" удалено из избранного`, "info");
  } else {
    await dbAdd(STORE_FAVORITES, { id: Date.now(), title, link, t: Date.now() });
    showNotification(`"${title}" добавлено в избранное`, "success");
  }
  updateFavoriteButtons(link, !ex);
};
function updateFavoriteButtons(link, isFav) {
  document.querySelectorAll(".favorite-btn").forEach(btn => {
    if (btn.onclick && btn.onclick.toString().includes(link)) {
      const icon = btn.querySelector("i");
      if (icon) icon.className = isFav ? "fas fa-heart" : "far fa-heart";
      btn.title = isFav ? "Удалить из избранного" : "Добавить в избранное";
    }
  });
}
window.shareAnime = (title, link) => {
  const url = `${window.location.origin}?q=${encodeURIComponent(title)}`;
  if (navigator.share) {
    navigator.share({ title, text: `Смотри "${title}" на AniFox`, url });
  } else {
    navigator.clipboard.writeText(url);
    showNotification("Ссылка скопирована", "success");
  }
};
function showNotification(msg, type = "info") {
  const n = document.createElement("div");
  n.className = `notification notification-${type}`;
  n.innerHTML = `<i class="fas fa-${type === "success" ? "check" : type === "error" ? "exclamation-triangle" : "info"}"></i><span>${msg}</span><button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

/* ---------- РЕНДЕРЫ (всё сразу) ---------- */
async function renderSearchHistory() {
  const box = $("resultsBox");
  if (!box) return false;
  const history = await dbGetAll(STORE_SEARCH_HISTORY, "timestamp");
  const sorted = history.sort((a, b) => b.t - a.t).slice(0, 10);
  if (!sorted.length) return false;
  box.innerHTML = `
    <section class="history-section">
      <h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2>
      <div class="search-history-buttons">
        ${sorted.map(i => `
          <button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g, "\\'")}')">
            <i class="fas fa-search"></i> ${i.query}
            <span class="remove-history" onclick="removeFromHistory(event, ${i.id})"><i class="fas fa-times"></i></span>
          </button>`).join("")}
      </div>
      <button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button>
    </section>`;
  return true;
}
window.searchFromHistory = q => {
  const input = $("searchInput");
  if (input) { input.value = q; search(); }
};
window.removeFromHistory = async (e, id) => {
  e.stopPropagation();
  await dbDelete(STORE_SEARCH_HISTORY, id);
  renderSearchHistory();
};
window.clearSearchHistory = async () => {
  if (confirm("Очистить историю поиска?")) {
    await dbClear(STORE_SEARCH_HISTORY);
    renderWeekly();
  }
};

async function renderFavoritesPage() {
  const box = $("resultsBox");
  if (!box) return;
  showSectionPreloader("избранного");
  try {
    const all = await dbGetAll(STORE_FAVORITES, "timestamp");
    const sorted = all.sort((a, b) => b.t - a.t);
    if (!sorted.length) {
      box.innerHTML = `
        <div class="no-results fade-in">
          <i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
          <h2>В избранном пока ничего нет</h2>
          <p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p>
          <button onclick="navigateToHome()" class="clear-history-btn"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button>
        </div>`;
      return;
    }
    const cards = sorted.map(f => createAnimeCard({ title: f.title, link: f.link })).join("");
    box.innerHTML = `
      <section class="favorites-section">
        <div class="section-header">
          <h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2>
          <div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Всего: <span class="stats-highlight">${sorted.length} аниме</span></span></div>
        </div>
        <div class="databases-info">
          <h3><i class="fas fa-database"></i> Базы данных аниме</h3>
          <div class="database-links">
            <a href="https://shikimori.one" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Shikimori</a>
            <a href="https://anilist.co" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniList</a>
            <a href="https://myanimelist.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> MyAnimeList</a>
            <a href="https://anidb.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniDB</a>
            <a href="https://kitsu.io" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Kitsu</a>
          </div>
        </div>
        <div class="results-grid">${cards}</div>
        <button onclick="clearFavorites()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить избранное</button>
      </section>`;
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x"></i><h2>Ошибка загрузки избранного</h2></div>`;
  }
}
window.clearFavorites = async () => {
  if (confirm("Очистить все избранное?")) {
    await dbClear(STORE_FAVORITES);
    renderFavoritesPage();
    showNotification("Избранное очищено", "success");
  }
};

async function renderWeekly() {
  const box = $("resultsBox");
  if (!box) return;
  showSectionPreloader("новинок");
  try {
    const hasHistory = await renderSearchHistory();
    const data = await apiWeeklyAll();
    if (!data.length) {
      box.innerHTML = `
        <div class="no-results fade-in">
          <i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
          <h2>Добро пожаловать в AniFox!</h2>
          <p>Начните с поиска аниме</p>
          <ul>
            <li><i class="fas fa-search"></i> Используйте поиск для нахождения аниме</li>
            <li><i class="fas fa-history"></i> Просматривайте историю поиска</li>
            <li><i class="fas fa-bolt"></i> Смотрите свежие обновления</li>
            <li><i class="fas fa-heart"></i> Добавляйте аниме в избранное</li>
          </ul>
        </div>`;
      return;
    }
    const cards = data.map(createAnimeCard).join("");
    const insert = hasHistory ? "beforeend" : "innerHTML";
    box[insert] = `
      <section class="weekly-section">
        <h2 class="section-title fade-in"><i class="fas fa-bolt"></i> Свежее за неделю</h2>
        <div class="databases-info">
          <h3><i class="fas fa-database"></i> Базы данных аниме</h3>
          <div class="database-links">
            <a href="https://shikimori.one" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Shikimori</a>
            <a href="https://anilist.co" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniList</a>
            <a href="https://myanimelist.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> MyAnimeList</a>
            <a href="https://anidb.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniDB</a>
            <a href="https://kitsu.io" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Kitsu</a>
          </div>
        </div>
        <div class="results-grid">${cards}</div>
      </section>`;
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x"></i><h2>Ошибка загрузки</h2></div>`;
  }
}

/* ---------- ПОИСК (всё сразу) ---------- */
async function search() {
  const input = $("searchInput");
  const q = input?.value.trim() || "";
  const box = $("resultsBox");
  if (!box) return;

  if (!q) {
    await renderWeekly();
    return;
  }

  showSectionPreloader("результатов поиска");
  await addToSearchHistory(q);

  try {
    const data = await apiSearchAll(q);
    if (!data.length) {
      box.innerHTML = `
        <div class="no-results fade-in">
          <i class="fas fa-search fa-3x"></i>
          <h2>По запросу "${q}" ничего не найдено</h2>
          <p>Попробуйте изменить запрос</p>
        </div>`;
      setTimeout(() => renderSearchHistory(), 100);
      return;
    }
    const cards = data.map(createAnimeCard).join("");
    box.innerHTML = `
      <section class="search-results-section">
        <div class="search-header">
          <h2 class="section-title"><i class="fas fa-search"></i> Результаты поиска: "${q}"</h2>
          <div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${data.length} аниме</span></span></div>
        </div>
        <div class="databases-info">
          <h3><i class="fas fa-database"></i> Базы данных аниме</h3>
          <div class="database-links">
            <a href="https://shikimori.one" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Shikimori</a>
            <a href="https://anilist.co" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniList</a>
            <a href="https://myanimelist.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> MyAnimeList</a>
            <a href="https://anidb.net" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> AniDB</a>
            <a href="https://kitsu.io" target="_blank" class="database-link"><i class="fas fa-external-link-alt"></i> Kitsu</a>
          </div>
        </div>
        <div class="results-grid">${cards}</div>
      </section>`;
    history.replaceState(null, null, "?q=" + encodeURIComponent(q));
    input.value = "";
  } catch (e) {
    console.error(e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x"></i><h2>Ошибка загрузки</h2></div>`;
  }
}

/* ---------- НАВИГАЦИЯ ---------- */
function updateHeader() {
  const header = document.querySelector(".top");
  if (header) header.innerHTML = `
    <a class="logo-link" href="/" onclick="navigateToHome(event)">
      <i class="fas fa-fox"></i><span class="logo-text">AniFox</span>
    </a>
    <nav class="header-nav">
      <button class="nav-btn ${!window.location.search.includes("page=favorites") ? "active" : ""}" onclick="navigateToHome()"><i class="fas fa-search"></i> Поиск</button>
      <button class="nav-btn ${window.location.search.includes("page=favorites") ? "active" : ""}" onclick="navigateToFavorites()"><i class="fas fa-heart"></i> Избранное</button>
    </nav>`;
}
window.navigateToHome = (e) => {
  if (e) e.preventDefault();
  const url = window.location.pathname + (window.location.search.includes("q=") ? window.location.search.replace(/[?&]page=favorites/g, "") : "");
  history.replaceState(null, null, url);
  updateHeader();
  renderWeekly();
};
window.navigateToFavorites = () => {
  const url = window.location.search ? `${window.location.pathname}${window.location.search}${window.location.search.includes("?") ? "&" : "?"}page=favorites` : `${window.location.pathname}?page=favorites`;
  history.replaceState(null, null, url);
  updateHeader();
  renderFavoritesPage();
};

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  showMainPreloader();
  try {
    await initDB();
    document.head.insertAdjacentHTML("beforeend", `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">`);
    updateHeader();
    const form = $("searchForm");
    const input = $("searchInput");
    if (form) form.addEventListener("submit", e => { e.preventDefault(); search(); });
    if (input) {
      const p = new URLSearchParams(window.location.search);
      const q = p.get("q"), page = p.get("page");
      if (page === "favorites") renderFavoritesPage();
      else if (q) { input.value = q; search(); }
      else renderWeekly();
    }
    const btn = $("scrollToTop");
    if (btn) {
      window.addEventListener("scroll", () => btn.classList.toggle("show", window.scrollY > 300));
      btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }
  } finally { setTimeout(hideMainPreloader, 1000); }
});