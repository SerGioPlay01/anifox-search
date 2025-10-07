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

// Увеличиваем лимиты для загрузки всех результатов
const SEARCH_LIMIT = 100; // Увеличили лимит для поиска
const WEEKLY_LIMIT = 100; // Увеличили лимит для новинок

// Глобальные переменные (убраны пагинационные переменные)
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
  if (preloader) {
    preloader.remove();
  }
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
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      if (!database.objectStoreNames.contains(STORE_SEARCH_HISTORY)) {
        const store = database.createObjectStore(STORE_SEARCH_HISTORY, { keyPath: 'id' });
        store.createIndex('timestamp', 't', { unique: false });
      }
      
      if (!database.objectStoreNames.contains(STORE_FAVORITES)) {
        const store = database.createObjectStore(STORE_FAVORITES, { keyPath: 'id' });
        store.createIndex('timestamp', 't', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
      
      if (!database.objectStoreNames.contains(STORE_SEARCH_RESULTS)) {
        const store = database.createObjectStore(STORE_SEARCH_RESULTS, { keyPath: 'query' });
        store.createIndex('timestamp', 't', { unique: false });
      }
      
      if (!database.objectStoreNames.contains(STORE_ANIME_INFO)) {
        const store = database.createObjectStore(STORE_ANIME_INFO, { keyPath: 'id' });
        store.createIndex('timestamp', 't', { unique: false });
      }
    };
  });
}

async function dbAdd(storeName, data) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function dbPut(storeName, data) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.put(data);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function dbGetAll(storeName, indexName = null) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = indexName ? store.index(indexName).getAll() : store.getAll();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function dbGet(storeName, key) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.get(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function dbDelete(storeName, key) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(key);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function dbClear(storeName) {
  if (!db) await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.clear();
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

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
    if (cached && Date.now() - cached.t < TTL) {
      return cached.data;
    }
  } catch (e) {
    console.log('Cache miss:', e);
  }

  // Загружаем все результаты сразу с увеличенным лимитом
  const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(
    q
  )}&types=anime,anime-serial&limit=${SEARCH_LIMIT}&with_material_data=true`;
  
  const data = await fetchKodik(url);
  
  try {
    await dbPut(STORE_SEARCH_RESULTS, {
      query: cacheKey,
      data: data,
      t: Date.now()
    });
  } catch (e) {
    console.log('Failed to cache results:', e);
  }

  return data;
}

async function apiWeekly() {
  const cacheKey = `weekly_all_results`;
  
  try {
    const cached = await dbGet(STORE_SEARCH_RESULTS, cacheKey);
    if (cached && Date.now() - cached.t < TTL) {
      return cached.data;
    }
  } catch (e) {
    console.log('Weekly cache miss:', e);
  }

  // Загружаем все новинки сразу с увеличенным лимитом
  const url = `${BASE.replace(
    "/search",
    "/list"
  )}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&limit=${WEEKLY_LIMIT}&with_material_data=true`;
  
  const data = await fetchKodik(url);
  
  try {
    await dbPut(STORE_SEARCH_RESULTS, {
      query: cacheKey,
      data: data,
      t: Date.now()
    });
  } catch (e) {
    console.log('Failed to cache weekly:', e);
  }

  return data;
}

/* ---------- ФУНКЦИИ ДЛЯ УДАЛЕНИЯ ДУБЛИКАТОВ ---------- */
function removeDuplicatePlayers(results) {
  const seen = new Set();
  const uniqueResults = [];
  
  for (const item of results) {
    // Создаем уникальный ключ на основе заголовка и ссылки
    const key = `${item.title}_${item.link}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      uniqueResults.push(item);
    }
  }
  
  return uniqueResults;
}

function filterLowQualityTitles(results) {
  return results.filter(item => {
    const title = item.title.toLowerCase();
    
    // Фильтруем низкокачественные названия
    const badPatterns = [
      /трейлер/i,
      /тизер/i,
      /teaser/i,
      /trailer/i,
      /опенинг/i,
      /ending/i,
      /opening/i,
      /превью/i,
      /preview/i,
      /реклама/i,
      /advertisement/i,
      /promo/i,
      /промо/i,
      /сборник/i,
      /compilation/i,
      /короткометражка/i,
      /short film/i,
      /ova\s*[\d\-]/i,
      /special\s*[\d\-]/i
    ];
    
    // Пропускаем элементы, которые содержат плохие паттерны
    return !badPatterns.some(pattern => pattern.test(title));
  });
}

/* ---------- UI FUNCTIONS ---------- */
function showLoading() {
  const box = $("resultsBox");
  if (!box) return;
  box.innerHTML = `
    <div class="loading-container">
      <div class="loading"></div>
      <p class="loading-text">Поиск аниме...</p>
    </div>
  `;
}

async function addToSearchHistory(query) {
  if (!query.trim()) return;
  
  try {
    const history = await dbGetAll(STORE_SEARCH_HISTORY, 'timestamp');
    const existing = history.find(item => item.query === query);
    
    if (existing) {
      await dbDelete(STORE_SEARCH_HISTORY, existing.id);
    }
    
    await dbAdd(STORE_SEARCH_HISTORY, {
      id: Date.now(),
      query: query,
      t: Date.now()
    });
  } catch (e) {
    console.log('Failed to save search history:', e);
  }
}

async function renderSearchHistory() {
  const box = $("resultsBox");
  if (!box) return false;

  try {
    const history = await dbGetAll(STORE_SEARCH_HISTORY, 'timestamp');
    const sortedHistory = history.sort((a, b) => b.t - a.t).slice(0, 10);
    
    if (!sortedHistory.length) return false;

    let html = `
      <section class="history-section">
        <h2 class="section-title fade-in">
          <i class="fas fa-history"></i> История поиска
        </h2>
        <div class="search-history-buttons">
    `;
    
    sortedHistory.forEach((item) => {
      html += `
        <button class="history-query-btn" onclick="searchFromHistory('${item.query.replace(/'/g, "\\'")}')">
          <i class="fas fa-search"></i> ${item.query}
          <span class="remove-history" onclick="removeFromHistory(event, ${item.id})">
            <i class="fas fa-times"></i>
          </span>
        </button>
      `;
    });
    
    html += `
        </div>
        <div class="history-actions">
          <button onclick="clearSearchHistory()" class="clear-history-btn">
            <i class="fas fa-trash"></i> Очистить историю
          </button>
        </div>
      </section>
    `;
    
    box.innerHTML = html;
    return true;
  } catch (e) {
    console.log('Failed to load search history:', e);
    return false;
  }
}

function searchFromHistory(query) {
  const input = $("searchInput");
  if (input) {
    input.value = query;
    search();
  }
}

async function removeFromHistory(event, id) {
  event.stopPropagation();
  try {
    await dbDelete(STORE_SEARCH_HISTORY, id);
    renderSearchHistory();
  } catch (e) {
    console.log('Failed to remove from history:', e);
  }
}

async function clearSearchHistory() {
  if (confirm('Вы уверены, что хотите очистить историю поиска?')) {
    try {
      await dbClear(STORE_SEARCH_HISTORY);
      renderWeekly();
    } catch (e) {
      console.log('Failed to clear history:', e);
    }
  }
}

function createAnimeCard(item) {
  const animeTitle = item.title;
  const materialData = item.material_data || {};
  
  // Формируем meta-теги для SEO
  updateMetaTags(animeTitle, materialData);
  
  return `
    <div class="card fade-in">
      <div class="card-header">
        <h3 class="h2_name">${animeTitle}</h3>
        <div class="info-links">
          <a href="https://shikimori.one/animes?search=${encodeURIComponent(animeTitle)}" target="_blank" class="info-link" title="Shikimori">
            <i class="fas fa-external-link-alt"></i>
          </a>
          <a href="https://anilist.co/search/anime?search=${encodeURIComponent(animeTitle)}" target="_blank" class="info-link" title="AniList">
            <i class="fas fa-external-link-alt"></i>
          </a>
          <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(animeTitle)}" target="_blank" class="info-link" title="MyAnimeList">
            <i class="fas fa-external-link-alt"></i>
          </a>
        </div>
      </div>
      
      <iframe class="single-player" src="${item.link}" allowfullscreen loading="lazy"
              title="Плеер: ${animeTitle}"></iframe>
              
      <div class="card-actions">
        <button class="action-btn favorite-btn" onclick="toggleFavorite('${item.title.replace(/'/g, "\\'")}', '${item.link}')" title="Добавить в избранное">
          <i class="far fa-heart"></i>
        </button>
        <button class="action-btn" onclick="shareAnime('${item.title.replace(/'/g, "\\'")}', '${item.link}')" title="Поделиться">
          <i class="fas fa-share"></i>
        </button>
      </div>
    </div>
  `;
}

// Функция для обновления meta-тегов
function updateMetaTags(title, materialData = {}) {
  const description = materialData.description || `Смотрите аниме "${title}" онлайн в высоком качестве на AniFox`;
  const year = materialData.year || '';
  const genres = materialData.anime_genres ? materialData.anime_genres.join(', ') : 'аниме';
  
  let metaDescription = document.querySelector('meta[name="description"]');
  if (!metaDescription) {
    metaDescription = document.createElement('meta');
    metaDescription.name = 'description';
    document.head.appendChild(metaDescription);
  }
  metaDescription.content = description;
  
  let metaKeywords = document.querySelector('meta[name="keywords"]');
  if (!metaKeywords) {
    metaKeywords = document.createElement('meta');
    metaKeywords.name = 'keywords';
    document.head.appendChild(metaKeywords);
  }
  metaKeywords.content = `${title}, аниме, смотреть онлайн, ${genres}${year ? ', ' + year : ''}`;
  
  // Open Graph теги
  const ogTags = [
    { property: 'og:title', content: `${title} - AniFox` },
    { property: 'og:description', content: description },
    { property: 'og:type', content: 'video.tv_show' },
    { property: 'og:site_name', content: 'AniFox' }
  ];
  
  ogTags.forEach(tag => {
    let metaTag = document.querySelector(`meta[property="${tag.property}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('property', tag.property);
      document.head.appendChild(metaTag);
    }
    metaTag.content = tag.content;
  });
  
  // Twitter Card теги
  const twitterTags = [
    { name: 'twitter:card', content: 'summary' },
    { name: 'twitter:title', content: `${title} - AniFox` },
    { name: 'twitter:description', content: description }
  ];
  
  twitterTags.forEach(tag => {
    let metaTag = document.querySelector(`meta[name="${tag.name}"]`);
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.name = tag.name;
      document.head.appendChild(metaTag);
    }
    metaTag.content = tag.content;
  });
}

async function toggleFavorite(title, link) {
  try {
    const favorites = await dbGetAll(STORE_FAVORITES);
    const existing = favorites.find(fav => fav.link === link);
    
    if (existing) {
      await dbDelete(STORE_FAVORITES, existing.id);
      showNotification(`"${title}" удалено из избранного`, 'info');
      updateFavoriteButton(link, false);
    } else {
      await dbAdd(STORE_FAVORITES, {
        id: Date.now(),
        title: title,
        link: link,
        t: Date.now()
      });
      showNotification(`"${title}" добавлено в избранное`, 'success');
      updateFavoriteButton(link, true);
    }
  } catch (e) {
    console.log('Failed to toggle favorite:', e);
    showNotification('Ошибка при работе с избранным', 'error');
  }
}

function updateFavoriteButton(link, isFavorite) {
  const buttons = document.querySelectorAll(`.favorite-btn`);
  buttons.forEach(btn => {
    if (btn.onclick && btn.onclick.toString().includes(link)) {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = isFavorite ? 'fas fa-heart' : 'far fa-heart';
        btn.title = isFavorite ? 'Удалить из избранного' : 'Добавить в избранное';
      }
    }
  });
}

function shareAnime(title, link) {
  if (navigator.share) {
    navigator.share({
      title: title,
      text: `Смотри "${title}" на AniFox`,
      url: window.location.origin + '?q=' + encodeURIComponent(title)
    });
  } else {
    navigator.clipboard.writeText(window.location.origin + '?q=' + encodeURIComponent(title));
    showNotification('Ссылка скопирована в буфер обмена', 'success');
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
    <span>${message}</span>
    <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 3000);
}

// Функция для обновления счетчика найденных аниме
function updateSearchCounter(query, count) {
  const statsElement = document.querySelector('.search-header .stats-info .stats-text');
  if (statsElement) {
    statsElement.innerHTML = `
      <i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${count} аниме</span> по запросу "${query}"
    `;
  }
}

// Страница избранного (все элементы сразу)
async function renderFavoritesPage() {
  const box = $("resultsBox");
  if (!box) return;

  showSectionPreloader('избранного');

  try {
    const allFavorites = await dbGetAll(STORE_FAVORITES, 'timestamp');
    const sortedFavorites = allFavorites.sort((a, b) => b.t - a.t);
    
    if (!sortedFavorites.length) {
      box.innerHTML = `
        <div class="no-results fade-in">
          <i class="fas fa-heart fa-3x" style="margin-bottom: 1rem; opacity: 0.5;"></i>
          <h2>В избранном пока ничего нет</h2>
          <p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p>
          <button onclick="navigateToHome()" class="clear-history-btn" style="margin-top: 1rem;">
            <i class="fas fa-arrow-left"></i> Вернуться к поиску
          </button>
        </div>
      `;
      return;
    }

    let html = `
      <section class="favorites-section">
        <div class="section-header">
          <h2 class="section-title">
            <i class="fas fa-heart"></i> Избранное
          </h2>
          <div class="stats-info">
            <span class="stats-text">
              <i class="fas fa-film"></i> Всего: <span class="stats-highlight">${sortedFavorites.length} аниме</span>
            </span>
          </div>
        </div>
        <div class="databases-info">
          <h3><i class="fas fa-database"></i> Базы данных аниме</h3>
          <div class="database-links">
            <a href="https://shikimori.one" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> Shikimori
            </a>
            <a href="https://anilist.co" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> AniList
            </a>
            <a href="https://myanimelist.net" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> MyAnimeList
            </a>
            <a href="https://anidb.net" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> AniDB
            </a>
            <a href="https://kitsu.io" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> Kitsu
            </a>
          </div>
        </div>
        <div class="results-grid" id="favoritesGrid">
    `;

    const cards = sortedFavorites.map(fav => 
      createAnimeCard({
        title: fav.title,
        link: fav.link
      })
    );
    
    html += cards.join('') + `
        </div>
        <div class="favorites-actions">
          <button onclick="clearFavorites()" class="clear-history-btn">
            <i class="fas fa-trash"></i> Очистить избранное
          </button>
          <button onclick="navigateToHome()" class="clear-history-btn secondary">
            <i class="fas fa-arrow-left"></i> Вернуться к поиску
          </button>
        </div>
      </section>
    `;

    box.innerHTML = html;
  } catch (e) {
    console.log('Failed to load favorites:', e);
    box.innerHTML = `
      <div class="no-results fade-in">
        <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 1rem; opacity: 0.5;"></i>
        <h2>Ошибка загрузки избранного</h2>
        <p>Попробуйте перезагрузить страницу</p>
      </div>
    `;
  }
}

async function clearFavorites() {
  if (confirm('Вы уверены, что хотите очистить все избранное?')) {
    try {
      await dbClear(STORE_FAVORITES);
      renderFavoritesPage();
      showNotification('Избранное очищено', 'success');
    } catch (e) {
      console.log('Failed to clear favorites:', e);
      showNotification('Ошибка при очистке избранного', 'error');
    }
  }
}

async function renderWeekly() {
  const box = $("resultsBox");
  if (!box) return;

  showSectionPreloader('новинок');

  let html = '';
  let hasContent = false;

  // Показываем историю поиска как отдельный блок
  const hasHistory = await renderSearchHistory();
  
  if (hasHistory) {
    hasContent = true;
    html = box.innerHTML;
  }

  // Затем загружаем новинки
  try {
    const data = await apiWeekly();
    let results = data.results || [];
    
    // Удаляем дубликаты и фильтруем низкокачественные названия
    results = removeDuplicatePlayers(results);
    results = filterLowQualityTitles(results);
    
    currentWeeklyResults = results;
    
    if (currentWeeklyResults.length) {
      if (hasContent) {
        html += `
          <section class="weekly-section">
            <h2 class="section-title fade-in">
              <i class="fas fa-bolt"></i> Свежее за неделю
            </h2>
            <div class="stats-info">
              <span class="stats-text">
                <i class="fas fa-film"></i> Показано: <span class="stats-highlight">${currentWeeklyResults.length} аниме</span> (после фильтрации дублей)
              </span>
            </div>
            <div class="databases-info">
              <h3><i class="fas fa-database"></i> Базы данных аниме</h3>
              <div class="database-links">
                <a href="https://shikimori.one" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> Shikimori
                </a>
                <a href="https://anilist.co" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> AniList
                </a>
                <a href="https://myanimelist.net" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> MyAnimeList
                </a>
                <a href="https://anidb.net" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> AniDB
                </a>
                <a href="https://kitsu.io" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> Kitsu
                </a>
              </div>
            </div>
            <div class="results-grid" id="weeklyGrid">
        `;
      } else {
        html = `
          <section class="weekly-section">
            <h2 class="section-title fade-in">
              <i class="fas fa-bolt"></i> Свежее за неделю
            </h2>
            <div class="stats-info">
              <span class="stats-text">
                <i class="fas fa-film"></i> Показано: <span class="stats-highlight">${currentWeeklyResults.length} аниме</span> (после фильтрации дублей)
              </span>
            </div>
            <div class="databases-info">
              <h3><i class="fas fa-database"></i> Базы данных аниме</h3>
              <div class="database-links">
                <a href="https://shikimori.one" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> Shikimori
                </a>
                <a href="https://anilist.co" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> AniList
                </a>
                <a href="https://myanimelist.net" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> MyAnimeList
                </a>
                <a href="https://anidb.net" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> AniDB
                </a>
                <a href="https://kitsu.io" target="_blank" class="database-link">
                  <i class="fas fa-external-link-alt"></i> Kitsu
                </a>
              </div>
            </div>
            <div class="results-grid" id="weeklyGrid">
        `;
      }

      const cards = currentWeeklyResults.map(item => createAnimeCard(item));
      
      html += cards.join('') + `
          </div>
        </section>
      `;

      box.innerHTML = html;
      hasContent = true;
    } else {
      if (!hasContent) {
        html = `
          <div class="no-results fade-in">
            <i class="fas fa-search fa-3x" style="margin-bottom: 1rem; opacity: 0.5;"></i>
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
        box.innerHTML = html;
      }
    }
  } catch (e) {
    console.error("Ошибка загрузки новинок:", e);
    if (!hasContent) {
      html = `
        <div class="no-results fade-in">
          <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 1rem; opacity: 0.5;"></i>
          <h2>Ошибка загрузки</h2>
          <p>Попробуйте перезагрузить страницу</p>
        </div>
      `;
      box.innerHTML = html;
    }
  }
}

/* ---------- ФУНКЦИЯ ДЛЯ ОЧИСТКИ ПОЛЯ ПОИСКА ПОСЛЕ УСПЕШНОГО ПОИСКА ---------- */
function clearSearchInputAfterSuccess() {
  const input = $("searchInput");
  if (input) {
    input.value = "";
  }
}

/* ---------- ОБНОВЛЕННАЯ ФУНКЦИЯ search ---------- */
async function search() {
  const input = $("searchInput");
  const q = input?.value.trim() || "";
  const box = $("resultsBox");

  if (!box) return;

  if (!q) {
    await renderWeekly();
    return;
  }

  showSectionPreloader('результатов поиска');
  await addToSearchHistory(q);

  try {
    const data = await apiSearch(q);
    let results = data.results || [];
    
    // Удаляем дубликаты и фильтруем низкокачественные названия
    results = removeDuplicatePlayers(results);
    results = filterLowQualityTitles(results);
    
    currentSearchResults = results;
    
    if (!currentSearchResults.length) {
      box.innerHTML = `
        <div class="no-results fade-in">
          <i class="fas fa-search fa-3x" style="margin-bottom: 1rem; opacity: 0.5;"></i>
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
        const existingContent = box.innerHTML;
        const hasHistory = await renderSearchHistory();
        if (hasHistory) {
          box.innerHTML = existingContent + '<div class="content-separator"></div>' + box.innerHTML;
        }
      }, 100);
      return;
    }

    let html = `
      <section class="search-results-section">
        <div class="search-header">
          <h2 class="section-title fade-in">
            <i class="fas fa-search"></i> Результаты поиска: "${q}"
          </h2>
          <div class="stats-info">
            <span class="stats-text">
              <i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${currentSearchResults.length} аниме</span> по запросу "${q}" (после фильтрации дублей)
            </span>
          </div>
        </div>
        <div class="databases-info">
          <h3><i class="fas fa-database"></i> Базы данных аниме</h3>
          <div class="database-links">
            <a href="https://shikimori.one" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> Shikimori
            </a>
            <a href="https://anilist.co" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> AniList
            </a>
            <a href="https://myanimelist.net" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> MyAnimeList
            </a>
            <a href="https://anidb.net" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> AniDB
            </a>
            <a href="https://kitsu.io" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> Kitsu
            </a>
          </div>
        </div>
        <div class="results-grid" id="searchResultsGrid">
    `;

    const cards = currentSearchResults.map(item => createAnimeCard(item));
    
    html += cards.join('') + `
        </div>
      </section>
    `;

    box.innerHTML = html;

    history.replaceState(null, null, "?q=" + encodeURIComponent(q));
    
    // ОЧИСТКА ПОЛЯ ПОИСКА ПОСЛЕ УСПЕШНОГО ВЫПОЛНЕНИЯ ПОИСКА
    clearSearchInputAfterSuccess();
  } catch (e) {
    console.error("Search error:", e);
    box.innerHTML = `
      <div class="no-results fade-in">
        <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom: 1rem; opacity: 0.5;"></i>
        <h2>Ошибка загрузки</h2>
        <p>Попробуйте повторить поиск позже</p>
        <p style="color: var(--gray); font-size: 0.9rem;">${e.message}</p>
      </div>
    `;
  }
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  // Показываем главный прелоадер
  showMainPreloader();

  try {
    // Инициализируем базу данных
    await initDB();

    // Добавляем Font Awesome
    const faLink = document.createElement('link');
    faLink.rel = 'stylesheet';
    faLink.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
    document.head.appendChild(faLink);

    // Обновляем хедер с навигацией
    updateHeader();

    // Form handling
    const form = $("searchForm");
    const input = $("searchInput");
    const btn = $("scrollToTop");

    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        search();
      });
    }

    if (input) {
      const urlParams = new URLSearchParams(window.location.search);
      const searchQuery = urlParams.get("q");
      const page = urlParams.get('page');
      
      if (page === 'favorites') {
        renderFavoritesPage();
      } else if (searchQuery) {
        input.value = searchQuery;
        search();
      } else {
        renderWeekly();
      }
    }

    if (btn) {
      window.addEventListener("scroll", () => {
        btn.classList.toggle("show", window.scrollY > 300);
      });
      btn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    }
  } finally {
    // Скрываем главный прелоадер после загрузки
    setTimeout(hideMainPreloader, 1000);
  }
});

function updateHeader() {
  const header = document.querySelector('.top');
  if (header) {
    header.innerHTML = `
      <a class="logo-link" href="/" onclick="navigateToHome(event)">
        <i class="fas fa-fox" style="font-size: 1.5rem;"></i>
        <span class="logo-text">AniFox</span>
      </a>
      <nav class="header-nav">
        <button class="nav-btn ${!window.location.search.includes('page=favorites') ? 'active' : ''}" onclick="navigateToHome()">
          <i class="fas fa-search"></i> Поиск
        </button>
        <button class="nav-btn ${window.location.search.includes('page=favorites') ? 'active' : ''}" onclick="navigateToFavorites()">
          <i class="fas fa-heart"></i> Избранное
        </button>
      </nav>
    `;
  }
}

function navigateToHome(event) {
  if (event) event.preventDefault();
  const newUrl = window.location.pathname + (window.location.search.includes('q=') ? window.location.search.replace(/[?&]page=favorites/g, '') : '');
  history.replaceState(null, null, newUrl);
  updateHeader();
  renderWeekly();
}

function navigateToFavorites() {
  const currentSearch = window.location.search;
  const newUrl = currentSearch 
    ? `${window.location.pathname}${currentSearch}${currentSearch.includes('?') ? '&' : '?'}page=favorites`
    : `${window.location.pathname}?page=favorites`;
  history.replaceState(null, null, newUrl);
  updateHeader();
  renderFavoritesPage();
}

// Делаем функции доступными глобально
window.searchFromHistory = searchFromHistory;
window.removeFromHistory = removeFromHistory;
window.clearSearchHistory = clearSearchHistory;
window.toggleFavorite = toggleFavorite;
window.shareAnime = shareAnime;
window.renderFavoritesPage = renderFavoritesPage;
window.renderWeekly = renderWeekly;
window.navigateToHome = navigateToHome;
window.navigateToFavorites = navigateToFavorites;