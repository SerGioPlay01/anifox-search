/* ---------- CONFIG ---------- */
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const LIST_BASE = "https://kodikapi.com/list";
const CACHE = new Map();
const TTL = 10 * 60 * 1000;

// IndexedDB
const DB_NAME = "AniFoxDB";
const DB_VERSION = 1;
const STORE_SEARCH_HISTORY = "search_history";
const STORE_FAVORITES = "favorites";
const STORE_SEARCH_RESULTS = "search_results";
const STORE_ANIME_INFO = "anime_info";

// Пагинация
const SEARCH_LIMIT = 50;
const WEEKLY_LIMIT = 30;
const INITIAL_LOAD_COUNT = 6;

// Глобальные переменные
let currentSearchPage = 1;
let currentWeeklyPage = 1;
let currentFavoritesOffset = 0;
const FAVORITES_PAGE_SIZE = 20;

let isLoadingMore = false;
let hasMoreSearch = true;
let hasMoreWeekly = true;
let hasMoreFavorites = true;

/* ---------- UTILS ---------- */
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- ПРЕЛОАДЕРЫ ---------- */
function showMainPreloader() {
  const preloader = document.createElement("div");
  preloader.id = "mainPreloader";
  preloader.className = "preloader-overlay";
  preloader.innerHTML = `
    <div class="preloader-content">
      <div class="preloader-spinner"></div>
      <p class="preloader-text">Загрузка AniFox...</p>
    </div>
  `;
  document.body.appendChild(preloader);
}

function hideMainPreloader() {
  const preloader = document.getElementById("mainPreloader");
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
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_SEARCH_HISTORY)) {
        const sh = db.createObjectStore(STORE_SEARCH_HISTORY, {
          keyPath: "id",
        });
        sh.createIndex("timestamp", "t", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
        const fv = db.createObjectStore(STORE_FAVORITES, { keyPath: "id" });
        fv.createIndex("timestamp", "t", { unique: false });
        fv.createIndex("title", "title", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_SEARCH_RESULTS)) {
        const sr = db.createObjectStore(STORE_SEARCH_RESULTS, {
          keyPath: "query",
        });
        sr.createIndex("timestamp", "t", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_ANIME_INFO)) {
        const ai = db.createObjectStore(STORE_ANIME_INFO, { keyPath: "id" });
        ai.createIndex("timestamp", "t", { unique: false });
      }
    };
  });
}
async function dbAdd(store, data) {
  if (!db) await initDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readwrite");
    const req = tx.objectStore(store).add(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbPut(store, data) {
  if (!db) await initDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readwrite");
    const req = tx.objectStore(store).put(data);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbGet(store, key) {
  if (!db) await initDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbGetAll(store, idx) {
  if (!db) await initDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readonly");
    const storeObj = tx.objectStore(store);
    const req = idx ? storeObj.index(idx).getAll() : storeObj.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbDelete(store, key) {
  if (!db) await initDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readwrite");
    const req = tx.objectStore(store).delete(key);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbClear(store) {
  if (!db) await initDB();
  return new Promise((res, rej) => {
    const tx = db.transaction([store], "readwrite");
    const req = tx.objectStore(store).clear();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
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

/* ---------- API + КЭШ ---------- */
async function apiSearch(q, page = 1) {
  q = q.trim().toLowerCase();
  if (!q) return { results: [] };
  const cacheKey = `${q}_page_${page}`;
  const cached = await dbGet(STORE_SEARCH_RESULTS, cacheKey);
  if (cached && Date.now() - cached.t < TTL) return cached.data;

  const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(
    q
  )}&types=anime,anime-serial&limit=${SEARCH_LIMIT}&with_material_data=true`;
  const data = await fetchKodik(url);
  await dbPut(STORE_SEARCH_RESULTS, { query: cacheKey, data, t: Date.now() });
  return data;
}

async function apiWeekly(page = 1) {
  const cacheKey = `weekly_page_${page}`;
  const cached = await dbGet(STORE_SEARCH_RESULTS, cacheKey);
  if (cached && Date.now() - cached.t < TTL) return cached.data;

  const url = `${LIST_BASE}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&limit=${WEEKLY_LIMIT}&with_material_data=true`;
  const data = await fetchKodik(url);
  await dbPut(STORE_SEARCH_RESULTS, { query: cacheKey, data, t: Date.now() });
  return data;
}

/* ---------- UI ---------- */
async function addToSearchHistory(q) {
  if (!q.trim()) return;
  const history = await dbGetAll(STORE_SEARCH_HISTORY, "timestamp");
  const existing = history.find((i) => i.query === q);
  if (existing) await dbDelete(STORE_SEARCH_HISTORY, existing.id);
  await dbAdd(STORE_SEARCH_HISTORY, {
    id: Date.now(),
    query: q,
    t: Date.now(),
  });
}

async function renderSearchHistory() {
  const box = $("resultsBox");
  if (!box) return false;
  const history = await dbGetAll(STORE_SEARCH_HISTORY, "timestamp");
  const sorted = history.sort((a, b) => b.t - a.t).slice(0, 10);
  if (!sorted.length) return false;
  let html = `
    <section class="history-section">
      <h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2>
      <div class="search-history-buttons">
  `;
  sorted.forEach((i) => {
    html += `
      <button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(
        /'/g,
        "\\'"
      )}')">
        <i class="fas fa-search"></i> ${i.query}
        <span class="remove-history" onclick="removeFromHistory(event, ${
          i.id
        })"><i class="fas fa-times"></i></span>
      </button>
    `;
  });
  html += `
      </div>
      <div class="history-actions">
        <button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button>
      </div>
    </section>
  `;
  box.innerHTML = html;
  return true;
}
window.searchFromHistory = (q) => {
  const input = $("searchInput");
  if (input) {
    input.value = q;
    search();
  }
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

/* ---------- КАРТОЧКА ---------- */
function createAnimeCard(item) {
  const title = item.title || "Без названия";
  return `
    <div class="card fade-in">
      <div class="card-header">
        <h3 class="h2_name">${title}</h3>
        <div class="info-links">
          <a href="https://shikimori.one/animes?search=${encodeURIComponent(
            title
          )}" target="_blank" class="info-link" title="Shikimori"><i class="fas fa-external-link-alt"></i></a>
          <a href="https://anilist.co/search/anime?search=${encodeURIComponent(
            title
          )}" target="_blank" class="info-link" title="AniList"><i class="fas fa-external-link-alt"></i></a>
          <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(
            title
          )}" target="_blank" class="info-link" title="MyAnimeList"><i class="fas fa-external-link-alt"></i></a>
        </div>
      </div>
      <iframe class="single-player" src="${
        item.link
      }" allowfullscreen loading="lazy" title="Плеер: ${title}"></iframe>
      <div class="card-actions">
        <button class="action-btn favorite-btn" onclick="toggleFavorite('${title.replace(
          /'/g,
          "\\'"
        )}', '${item.link}')" title="Добавить в избранное"><i class="far fa-heart"></i></button>
        <button class="action-btn" onclick="shareAnime('${title.replace(
          /'/g,
          "\\'"
        )}', '${item.link}')" title="Поделиться"><i class="fas fa-share"></i></button>
      </div>
    </div>
  `;
}

/* ---------- ИЗБРАННОЕ ---------- */
window.toggleFavorite = async (title, link) => {
  const favs = await dbGetAll(STORE_FAVORITES);
  const ex = favs.find((f) => f.link === link);
  if (ex) {
    await dbDelete(STORE_FAVORITES, ex.id);
    showNotification(`"${title}" удалено из избранного`, "info");
  } else {
    await dbAdd(STORE_FAVORITES, {
      id: Date.now(),
      title,
      link,
      t: Date.now(),
    });
    showNotification(`"${title}" добавлено в избранное`, "success");
  }
  updateFavoriteButtons(link, !ex);
};
function updateFavoriteButtons(link, isFav) {
  document.querySelectorAll(".favorite-btn").forEach((btn) => {
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
  n.innerHTML = `<i class="fas fa-${
    type === "success"
      ? "check"
      : type === "error"
      ? "exclamation-triangle"
      : "info"
  }"></i><span>${msg}</span><button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3000);
}

/* ---------- БЕСКОНЕЧНЫЙ СКРОЛЛ ---------- */
let scrollObserver = null;
function enableInfiniteScroll(loadFn) {
  if (scrollObserver) scrollObserver.disconnect();
  scrollObserver = new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting && !isLoadingMore) loadFn();
    },
    { rootMargin: "400px" }
  );
  const sentinel = document.createElement("div");
  sentinel.id = "scroll-sentinel";
  document.getElementById("resultsBox").appendChild(sentinel);
  scrollObserver.observe(sentinel);
}
function disableInfiniteScroll() {
  if (scrollObserver) {
    scrollObserver.disconnect();
    scrollObserver = null;
  }
  const s = document.getElementById("scroll-sentinel");
  if (s) s.remove();
}

/* ---------- ПАГИНАЦИЯ (без кнопок) ---------- */
async function loadMoreSearch() {
  if (isLoadingMore || !hasMoreSearch) return;
  isLoadingMore = true;
  try {
    currentSearchPage++;
    const input = $("searchInput");
    const q = input?.value.trim() || "";
    const data = await apiSearch(q, currentSearchPage);
    if (data.results?.length) {
      const grid = document.querySelector("#searchResultsGrid");
      if (grid) {
        const existingLinks = new Set(
          [...grid.querySelectorAll("iframe")].map((f) => f.src)
        );
        const unique = data.results.filter((r) => !existingLinks.has(r.link));
        const cards = unique.map(createAnimeCard);
        grid.insertAdjacentHTML("beforeend", cards.join(""));
        updateSearchCounter(q, grid.children.length);
        hasMoreSearch = unique.length >= SEARCH_LIMIT;
      }
    } else {
      hasMoreSearch = false;
    }
  } catch (e) {
    console.error(e);
    hasMoreSearch = false;
  } finally {
    isLoadingMore = false;
  }
}
async function loadMoreWeekly() {
  if (isLoadingMore || !hasMoreWeekly) return;
  isLoadingMore = true;
  try {
    currentWeeklyPage++;
    const data = await apiWeekly(currentWeeklyPage);
    if (data.results?.length) {
      const grid = document.querySelector("#weeklyGrid");
      if (grid) {
        const existingLinks = new Set(
          [...grid.querySelectorAll("iframe")].map((f) => f.src)
        );
        const unique = data.results.filter((r) => !existingLinks.has(r.link));
        const cards = unique.map(createAnimeCard);
        grid.insertAdjacentHTML("beforeend", cards.join(""));
        hasMoreWeekly = unique.length >= WEEKLY_LIMIT;
      }
    } else {
      hasMoreWeekly = false;
    }
  } catch (e) {
    console.error(e);
    hasMoreWeekly = false;
  } finally {
    isLoadingMore = false;
  }
}
async function loadMoreFavorites() {
  if (isLoadingMore || !hasMoreFavorites) return;
  isLoadingMore = true;
  try {
    currentFavoritesOffset += FAVORITES_PAGE_SIZE;
    const all = await dbGetAll(STORE_FAVORITES, "timestamp");
    const sorted = all.sort((a, b) => b.t - a.t);
    const pageFav = sorted.slice(
      currentFavoritesOffset,
      currentFavoritesOffset + FAVORITES_PAGE_SIZE
    );
    hasMoreFavorites =
      currentFavoritesOffset + FAVORITES_PAGE_SIZE < sorted.length;
    const cards = pageFav.map((f) =>
      createAnimeCard({ title: f.title, link: f.link })
    );
    const grid = document.querySelector("#favoritesGrid");
    if (grid) grid.insertAdjacentHTML("beforeend", cards.join(""));
  } finally {
    isLoadingMore = false;
  }
}

function updateSearchCounter(q, count) {
  const el = document.querySelector(".search-header .stats-info .stats-text");
  if (el)
    el.innerHTML = `<i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${count}+ аниме</span> по запросу "${q}"`;
}

/* ---------- РЕНДЕРЫ ---------- */
async function renderFavoritesPage(loadMore = false) {
  const box = $("resultsBox");
  if (!box) return;
  if (!loadMore) showSectionPreloader("избранного");
  try {
    const all = await dbGetAll(STORE_FAVORITES, "timestamp");
    const sorted = all.sort((a, b) => b.t - a.t);
    if (!sorted.length && !loadMore) {
      box.innerHTML = `
        <div class="no-results fade-in">
          <i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
          <h2>В избранном пока ничего нет</h2>
          <p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p>
          <button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button>
        </div>
      `;
      return;
    }
    if (!loadMore) {
      currentFavoritesOffset = 0;
      hasMoreFavorites = true;
    }
    const pageFav = sorted.slice(
      currentFavoritesOffset,
      currentFavoritesOffset + FAVORITES_PAGE_SIZE
    );
    hasMoreFavorites =
      currentFavoritesOffset + FAVORITES_PAGE_SIZE < sorted.length;
    const cards = pageFav.map((f) =>
      createAnimeCard({ title: f.title, link: f.link })
    );
    if (loadMore) {
      document
        .querySelector("#favoritesGrid")
        .insertAdjacentHTML("beforeend", cards.join(""));
    } else {
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
          <div class="results-grid" id="favoritesGrid">${cards.join("")}</div>
        </section>
      `;
      if (hasMoreFavorites) enableInfiniteScroll(loadMoreFavorites);
    }
  } catch (e) {
    console.error(e);
    if (!loadMore)
      box.innerHTML = `
      <div class="no-results fade-in">
        <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
        <h2>Ошибка загрузки избранного</h2>
        <p>Попробуйте перезагрузить страницу</p>
      </div>
    `;
  }
}
window.clearFavorites = async () => {
  if (confirm("Очистить все избранное?")) {
    await dbClear(STORE_FAVORITES);
    renderFavoritesPage();
    showNotification("Избранное очищено", "success");
  }
};

async function renderWeekly(loadMore = false) {
  const box = $("resultsBox");
  if (!box) return;
  if (!loadMore) showSectionPreloader("новинок");
  try {
    if (!loadMore) {
      currentWeeklyPage = 1;
      hasMoreWeekly = true;
      const hasHistory = await renderSearchHistory();
      if (hasHistory) {
        const data = await apiWeekly(currentWeeklyPage);
        if (data.results?.length) {
          const limited = data.results.slice(0, INITIAL_LOAD_COUNT);
          const cards = limited.map(createAnimeCard);
          box.insertAdjacentHTML(
            "beforeend",
            `
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
              <div class="results-grid" id="weeklyGrid">${cards.join("")}</div>
            </section>
          `
          );
          hasMoreWeekly = data.results.length >= WEEKLY_LIMIT;
          if (hasMoreWeekly) enableInfiniteScroll(loadMoreWeekly);
        }
        return;
      }
    } else {
      const data = await apiWeekly(currentWeeklyPage);
      if (data.results?.length) {
        const grid = document.querySelector("#weeklyGrid");
        if (grid) {
          const existingLinks = new Set(
            [...grid.querySelectorAll("iframe")].map((f) => f.src)
          );
          const unique = data.results.filter((r) => !existingLinks.has(r.link));
          const cards = unique.map(createAnimeCard);
          grid.insertAdjacentHTML("beforeend", cards.join(""));
          hasMoreWeekly = unique.length >= WEEKLY_LIMIT;
        }
      } else {
        hasMoreWeekly = false;
      }
      return;
    }

    const data = await apiWeekly(currentWeeklyPage);
    if (data.results?.length) {
      const limited = data.results.slice(0, INITIAL_LOAD_COUNT);
      const cards = limited.map(createAnimeCard);
      box.innerHTML = `
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
          <div class="results-grid" id="weeklyGrid">${cards.join("")}</div>
        </section>
      `;
      hasMoreWeekly = data.results.length >= WEEKLY_LIMIT;
      if (hasMoreWeekly) enableInfiniteScroll(loadMoreWeekly);
    } else {
      hasMoreWeekly = false;
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
        </div>
      `;
    }
  } catch (e) {
    console.error(e);
    hasMoreWeekly = false;
    box.innerHTML = `
      <div class="no-results fade-in">
        <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
        <h2>Ошибка загрузки</h2>
        <p>Попробуйте перезагрузить страницу</p>
      </div>
    `;
  }
}

/* ---------- ПОИСК ---------- */
async function search(loadMore = false) {
  const input = $("searchInput");
  const q = input?.value.trim() || "";
  const box = $("resultsBox");
  if (!box) return;

  if (!q && !loadMore) {
    await renderWeekly();
    return;
  }

  if (!loadMore) {
    showSectionPreloader("результатов поиска");
    currentSearchPage = 1;
    hasMoreSearch = true;
    await addToSearchHistory(q);
  }

  try {
    const data = await apiSearch(q, currentSearchPage);
    if (!data.results?.length) {
      if (!loadMore) {
        box.innerHTML = `
          <div class="no-results fade-in">
            <i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
            <h2>По запросу "${q}" ничего не найдено</h2>
            <p>Попробуйте изменить запрос:</p>
            <ul>
              <li><i class="fas fa-spell-check"></i> Проверить правильность написания</li>
              <li><i class="fas fa-language"></i> Использовать английское название</li>
              <li><i class="fas fa-filter"></i> Искать по жанру или году</li>
              <li><i class="fas fa-simplify"></i> Упростить запрос</li>
            </ul>
          </div>
        `;
        setTimeout(async () => {
          const existing = box.innerHTML;
          const hasHistory = await renderSearchHistory();
          if (hasHistory)
            box.innerHTML =
              existing +
              '<div class="content-separator"></div>' +
              box.innerHTML;
        }, 100);
      }
      return;
    }

    let html = "";
    const limited = loadMore
      ? data.results
      : data.results.slice(0, INITIAL_LOAD_COUNT);

    if (!loadMore) {
      html = `
        <section class="search-results-section">
          <div class="search-header">
            <h2 class="section-title fade-in"><i class="fas fa-search"></i> Результаты поиска: "${q}"</h2>
            <div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${limited.length}+ аниме</span> по запросу "${q}"</span></div>
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
          <div class="results-grid" id="searchResultsGrid">
      `;
    }

    const cards = limited.map(createAnimeCard);
    if (loadMore) {
      html = cards.join("");
    } else {
      html += cards.join("") + `</div></section>`;
    }

    if (loadMore) {
      const grid = document.querySelector("#searchResultsGrid");
      if (grid) {
        const existingLinks = new Set(
          [...grid.querySelectorAll("iframe")].map((f) => f.src)
        );
        const unique = limited.filter((r) => !existingLinks.has(r.link));
        const cards = unique.map(createAnimeCard);
        grid.insertAdjacentHTML("beforeend", cards.join(""));
        updateSearchCounter(q, grid.children.length);
        hasMoreSearch = unique.length >= SEARCH_LIMIT;
      }
    } else {
      box.innerHTML = html;
    }

    hasMoreSearch = data.results.length >= SEARCH_LIMIT;
    if (!loadMore) {
      history.replaceState(null, null, "?q=" + encodeURIComponent(q));
      input.value = "";
      if (hasMoreSearch) enableInfiniteScroll(loadMoreSearch);
    }
  } catch (e) {
    console.error(e);
    hasMoreSearch = false;
    if (!loadMore) {
      box.innerHTML = `
        <div class="no-results fade-in">
          <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
          <h2>Ошибка загрузки</h2>
          <p>Попробуйте повторить поиск позже</p>
          <p style="color:var(--gray);font-size:.9rem">${e.message}</p>
        </div>
      `;
    }
  }
}

/* ---------- НАВИГАЦИЯ ---------- */
function updateHeader() {
  const header = document.querySelector(".top");
  if (header) {
    header.innerHTML = `
      <a class="logo-link" href="/" onclick="navigateToHome(event)">
        <i class="fas fa-fox" style="font-size:1.5rem"></i>
        <span class="logo-text">AniFox</span>
      </a>
      <nav class="header-nav">
        <button class="nav-btn ${
          !window.location.search.includes("page=favorites") ? "active" : ""
        }" onclick="navigateToHome()"><i class="fas fa-search"></i> Поиск</button>
        <button class="nav-btn ${
          window.location.search.includes("page=favorites") ? "active" : ""
        }" onclick="navigateToFavorites()"><i class="fas fa-heart"></i> Избранное</button>
      </nav>
    `;
  }
}
window.navigateToHome = (e) => {
  if (e) e.preventDefault();
  const url =
    window.location.pathname +
    (window.location.search.includes("q=")
      ? window.location.search.replace(/[?&]page=favorites/g, "")
      : "");
  history.replaceState(null, null, url);
  updateHeader();
  renderWeekly();
};
window.navigateToFavorites = () => {
  const url = window.location.search
    ? `${window.location.pathname}${window.location.search}${
        window.location.search.includes("?") ? "&" : "?"
      }page=favorites`
    : `${window.location.pathname}?page=favorites`;
  history.replaceState(null, null, url);
  updateHeader();
  renderFavoritesPage();
};

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  showMainPreloader();
  try {
    await initDB();
    const fa = document.createElement("link");
    fa.rel = "stylesheet";
    fa.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(fa);
    updateHeader();
    const form = $("searchForm");
    const input = $("searchInput");
    const btn = $("scrollToTop");
    if (form)
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        search();
      });
    if (input) {
      const p = new URLSearchParams(window.location.search);
      const q = p.get("q");
      const page = p.get("page");
      if (page === "favorites") renderFavoritesPage();
      else if (q) {
        input.value = q;
        search();
      } else renderWeekly();
    }
    if (btn) {
      window.addEventListener("scroll", () =>
        btn.classList.toggle("show", window.scrollY > 300)
      );
      btn.addEventListener("click", () =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
    }
  } finally {
    setTimeout(hideMainPreloader, 1000);
  }
});

/* ---------- SEO ---------- */
function updateSEOMeta(query, count = 0) {
  const title = query
    ? `${query} — смотреть аниме онлайн бесплатно | AniFox`
    : "AniFox — смотреть аниме онлайн бесплатно в хорошем качестве";

  const description = query
    ? `✅ Найдено ${count} аниме по запросу «${query}». Смотрите онлайн без регистрации и в хорошем качестве на AniFox!`
    : "Смотрите аниме онлайн бесплатно без регистрации. Тысячи сериалов и фильмов в хорошем качестве на AniFox.";

  const keywords = query
    ? `${query}, аниме, смотреть онлайн, бесплатно, AniFox`
    : "аниме, смотреть аниме онлайн, аниме бесплатно, AniFox, anime online";

  setOrCreate("title", title);
  setOrCreate('meta[name="description"]', "", {
    name: "description",
    content: description,
  });
  setOrCreate('meta[name="keywords"]', "", {
    name: "keywords",
    content: keywords,
  });

  setOrCreate('meta[property="og:title"]', "", {
    property: "og:title",
    content: title,
  });
  setOrCreate('meta[property="og:description"]', "", {
    property: "og:description",
    content: description,
  });
  setOrCreate('meta[property="og:url"]', "", {
    property: "og:url",
    content: window.location.href,
  });
  setOrCreate('meta[property="og:type"]', "", {
    property: "og:type",
    content: "website",
  });

  setOrCreate('meta[name="twitter:title"]', "", {
    name: "twitter:title",
    content: title,
  });
  setOrCreate('meta[name="twitter:description"]', "", {
    name: "twitter:description",
    content: description,
  });

  const canon = `${window.location.origin}${
    window.location.pathname
  }?q=${encodeURIComponent(query)}`;
  setOrCreate('link[rel="canonical"]', "", { rel: "canonical", href: canon });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AniFox",
    url: window.location.origin,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${window.location.origin}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
  let script = document.querySelector('script[type="application/ld+json"]');
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(jsonLd);

  document.title = title;
}

function setOrCreate(selector, textContent, attrs = {}) {
  let el = document.querySelector(selector);
  if (!el) {
    const tag = selector.includes("meta")
      ? "meta"
      : selector.includes("link")
      ? "link"
      : "title";
    el = document.createElement(tag);
    document.head.appendChild(el);
  }
  if (textContent) el.textContent = textContent;
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
}