/* ---------- CONFIG ---------- */
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const TTL = 10 * 60 * 1000;

/* ---------- INDEXEDDB ---------- */
const DB_NAME = "AniFoxDB";
const DB_VERSION = 1;
const STORE_SEARCH_HISTORY = "search_history";
const STORE_FAVORITES = "favorites";
const STORE_SEARCH_RESULTS = "search_results";

let db = null;
async function initDB() {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      db = req.result;
      resolve(db);
    };
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      [STORE_SEARCH_HISTORY, STORE_FAVORITES, STORE_SEARCH_RESULTS].forEach(
        (n) => {
          if (!d.objectStoreNames.contains(n)) {
            const s = d.createObjectStore(n, {
              keyPath: n === STORE_SEARCH_RESULTS ? "query" : "id",
            });
            s.createIndex("timestamp", "t", { unique: false });
            if (n === STORE_FAVORITES)
              s.createIndex("title", "title", { unique: false });
          }
        }
      );
    };
  });
}
async function dbAdd(s, d) {
  const db = await initDB();
  return new Promise((res, rej) => {
    const t = db.transaction([s], "readwrite");
    t.objectStore(s).add(d);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function dbPut(s, d) {
  const db = await initDB();
  return new Promise((res, rej) => {
    const t = db.transaction([s], "readwrite");
    t.objectStore(s).put(d);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function dbGet(s, k) {
  const db = await initDB();
  return new Promise((res, rej) => {
    const t = db.transaction([s], "readonly");
    const req = t.objectStore(s).get(k);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbGetAll(s, i) {
  const db = await initDB();
  return new Promise((res, rej) => {
    const t = db.transaction([s], "readonly");
    const store = i ? t.objectStore(s).index(i) : t.objectStore(s);
    const req = store.getAll();
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function dbDel(s, k) {
  const db = await initDB();
  return new Promise((res, rej) => {
    const t = db.transaction([s], "readwrite");
    t.objectStore(s).delete(k);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function dbClear(s) {
  const db = await initDB();
  return new Promise((res, rej) => {
    const t = db.transaction([s], "readwrite");
    t.objectStore(s).clear();
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}

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
    await new Promise((r) => setTimeout(r, attempt * 500));
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
  const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(
    q
  )}&types=anime,anime-serial&with_material_data=true`;
  const data = await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS, { query: key, data, t: Date.now() }).catch(
    () => {}
  );
  return data;
}
async function apiWeekly() {
  const key = `weekly_all`;
  try {
    const cached = await dbGet(STORE_SEARCH_RESULTS, key);
    if (cached && Date.now() - cached.t < TTL) return cached.data;
  } catch {}
  const url = `${BASE.replace(
    "/search",
    "/list"
  )}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&with_material_data=true`;
  const data = await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS, { query: key, data, t: Date.now() }).catch(
    () => {}
  );
  return data;
}

/* ---------- UTILS ---------- */
const $ = (id) => document.getElementById(id);
function showNote(msg, type = "info") {
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

/* ---------- SEO ---------- */
function toSlug(str) {
  const map = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
    " ": "-",
    _: "-",
  };
  return str
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] || ch)
    .join("")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
function clearOldDynamicMeta() {
  document.querySelectorAll("head [data-dynamic]").forEach((el) => el.remove());
}
function setAttr(sel, attr, val) {
  const el = document.head.querySelector(sel);
  if (el) el.setAttribute(attr, val);
}
function buildKeywords(title, genres, year) {
  const base = [
    "аниме",
    "смотреть аниме онлайн",
    "русская озвучка",
    "anime hd",
  ];
  const words = `${title} ${genres} ${year}`
    .toLowerCase()
    .replace(/[«»"']/g, "")
    .split(/[\s,]+/)
    .filter(Boolean);
  return Array.from(new Set([...base, ...words]))
    .slice(0, 15)
    .join(", ");
}
function updateSEOMeta(apiData) {
  clearOldDynamicMeta();
  const results = (apiData && apiData.results) || [];
  const query =
    new URLSearchParams(location.search).get("q") ||
    (location.pathname.startsWith("/search/")
      ? location.pathname.replace("/search/", "").replace(/-/g, " ")
      : "");
  if (!query) return;
  const top = results[0];
  let title, description, keywords, ogTitle, ogDesc, twTitle, twDesc, ogImage;
  if (top) {
    const { title: t, year, genres = "", material_data } = top;
    const cleanTitle = t.replace(/\[.*?\]/g, "").trim();
    title = `Смотреть аниме «${cleanTitle}» (${year}) онлайн бесплатно в HD — AniFox`;
    description = `Аниме «${cleanTitle}» (${year}) уже на AniFox: русская озвучка, HD 1080p, без регистрации. Жанры: ${genres}. Смотри новые серии первым!`;
    keywords = buildKeywords(cleanTitle, genres, year);
    ogTitle = twTitle = `«${cleanTitle}» — смотреть онлайн`;
    ogDesc = twDesc = description;
    ogImage = material_data?.poster_url || "/resources/obl_web.jpg";
  } else {
    title = `Поиск «${query}» — AniFox`;
    description = `По запросу «${query}» ничего не найдено, но вы можете посмотреть другие аниме на AniFox.`;
    keywords = `аниме, ${query}, смотреть онлайн`;
    ogTitle = twTitle = title;
    ogDesc = twDesc = description;
    ogImage = "/resources/obl_web.jpg";
  }
  document.title = title;
  setAttr('meta[name="description"]', "content", description);
  setAttr('meta[name="keywords"]', "content", keywords);
  setAttr('meta[property="og:title"]', "content", ogTitle);
  setAttr('meta[property="og:description"]', "content", ogDesc);
  setAttr('meta[property="og:image"]', "content", ogImage);
  setAttr('meta[name="twitter:title"]', "content", twTitle);
  setAttr('meta[name="twitter:description"]', "content", twDesc);
  setAttr('meta[name="twitter:image"]', "content", ogImage);
  let canonical =
    location.origin +
    location.pathname +
    (query ? "?q=" + encodeURIComponent(query) : "");
  let linkCanon = document.head.querySelector('link[rel="canonical"]');
  if (!linkCanon) {
    linkCanon = document.createElement("link");
    linkCanon.rel = "canonical";
    linkCanon.setAttribute("data-dynamic", "");
    document.head.appendChild(linkCanon);
  }
  linkCanon.href = canonical;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "AniFox",
    url: location.origin,
    potentialAction: {
      "@type": "SearchAction",
      target: `${location.origin}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  if (results.length)
    jsonLd.mainEntity = results
      .slice(0, 10)
      .map((r) => ({
        "@type": "TVSeries",
        name: r.title,
        datePublished: r.year,
        genre: r.genres,
        image: r.material_data?.poster_url || ogImage,
        url: `${location.origin}/?q=${encodeURIComponent(r.title)}`,
      }));
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.textContent = JSON.stringify(jsonLd);
  script.setAttribute("data-dynamic", "");
  document.head.appendChild(script);
}

/* ---------- CARD ---------- */
async function createAnimeCard(item) {
  const t = item.title;
  const db = await initDB();
  const favs = await dbGetAll(STORE_FAVORITES);
  const isFav = favs.some((f) => f.link === item.link);
  
  return `
    <div class="card fade-in">
      <div class="card-header">
        <h3 class="h2_name">${t}</h3>
        <div class="info-links">
          <button class="info-link" onclick="showAnimeInfoModal(${JSON.stringify(item).replace(/'/g, "&#39;")})" title="Подробная информация">
            <i class="fas fa-info-circle"></i>
          </button>
          <a href="https://shikimori.one/animes?search=${encodeURIComponent(t)}" target="_blank" class="info-link" title="Shikimori">
            <i class="fas fa-external-link-alt"></i>
          </a>
          <a href="https://anilist.co/search/anime?search=${encodeURIComponent(t)}" target="_blank" class="info-link" title="AniList">
            <i class="fas fa-external-link-alt"></i>
          </a>
          <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(t)}" target="_blank" class="info-link" title="MyAnimeList">
            <i class="fas fa-external-link-alt"></i>
          </a>
        </div>
      </div>
      
      ${item.material_data?.poster_url ? `
        <div class="anime-poster" style="text-align: center; margin-bottom: 1rem;">
          <img src="${item.material_data.poster_url}" alt="${t}" style="max-width: 200px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        </div>
      ` : ''}
      
      ${item.material_data ? `
        <div class="anime-meta">
          ${item.material_data.year ? `<span class="anime-year"><i class="fas fa-calendar-alt"></i> ${item.material_data.year}</span>` : ''}
          ${item.material_data.kinopoisk_rating ? `<span class="anime-rating"><i class="fas fa-star"></i> ${item.material_data.kinopoisk_rating}</span>` : ''}
          ${item.episodes_count ? `<span class="anime-episodes"><i class="fas fa-play-circle"></i> ${item.episodes_count} эп.</span>` : ''}
        </div>
      ` : ''}
      
      <iframe class="single-player" src="${item.link}" allowfullscreen loading="lazy" title="Плеер: ${t}"></iframe>
      
      <div class="card-actions">
        <button class="action-btn favorite-btn" data-link="${item.link}" onclick="toggleFavorite('${t.replace(/'/g, "\\'")}', '${item.link}')" title="${isFav ? "Удалить из избранного" : "Добавить в избранное"}">
          <i class="${isFav ? "fas" : "far"} fa-heart"></i>
        </button>
        <button class="action-btn" onclick="shareAnime('${t.replace(/'/g, "\\'")}', '${item.link}')" title="Поделиться">
          <i class="fas fa-share"></i>
        </button>
        <button class="action-btn" onclick="showAnimeInfoModal(${JSON.stringify(item).replace(/'/g, "&#39;")})" title="Подробная информация">
          <i class="fas fa-info-circle"></i>
        </button>
      </div>
    </div>`;
}

// Функция для показа модального окна с информацией
function showAnimeInfoModal(item) {
  const material = item.material_data || {};
  
  const modalHTML = `
    <div class="modal-overlay" id="animeInfoModal">
      <div class="modal-content">
        <div class="modal-header">
          <h2><i class="fas fa-info-circle"></i> ${item.title}</h2>
          <button onclick="closeAnimeInfoModal()" class="modal-close-btn">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="modal-body">
          <div class="anime-info">
            ${material.poster_url ? `
              <div class="anime-poster">
                <img src="${material.poster_url}" alt="${item.title}">
              </div>
            ` : ''}
            
            <div class="anime-details">
              ${material.title_en ? `
                <div class="detail-item">
                  <i class="fas fa-language"></i>
                  <strong>Оригинальное название:</strong> 
                  <span>${material.title_en}</span>
                </div>
              ` : ''}
              
              ${material.year ? `
                <div class="detail-item">
                  <i class="fas fa-calendar-alt"></i>
                  <strong>Год:</strong> 
                  <span>${material.year}</span>
                </div>
              ` : ''}
              
              ${material.genres?.length ? `
                <div class="detail-item">
                  <i class="fas fa-tags"></i>
                  <strong>Жанры:</strong> 
                  <span>${material.genres.join(', ')}</span>
                </div>
              ` : ''}
              
              ${material.countries?.length ? `
                <div class="detail-item">
                  <i class="fas fa-globe"></i>
                  <strong>Страны:</strong> 
                  <span>${material.countries.join(', ')}</span>
                </div>
              ` : ''}
              
              ${material.duration ? `
                <div class="detail-item">
                  <i class="fas fa-clock"></i>
                  <strong>Продолжительность:</strong> 
                  <span>${material.duration} мин.</span>
                </div>
              ` : ''}
              
              ${item.episodes_count ? `
                <div class="detail-item">
                  <i class="fas fa-play-circle"></i>
                  <strong>Эпизоды:</strong> 
                  <span>${item.episodes_count}</span>
                </div>
              ` : ''}
              
              ${material.kinopoisk_rating ? `
                <div class="detail-item">
                  <i class="fas fa-star"></i>
                  <strong>Рейтинг КиноПоиск:</strong> 
                  <span>${material.kinopoisk_rating}</span>
                </div>
              ` : ''}
              
              ${material.imdb_rating ? `
                <div class="detail-item">
                  <i class="fas fa-star"></i>
                  <strong>Рейтинг IMDB:</strong> 
                  <span>${material.imdb_rating}</span>
                </div>
              ` : ''}
              
              ${material.description ? `
                <div class="detail-section">
                  <h3><i class="fas fa-file-alt"></i> Описание</h3>
                  <p class="description">${material.description}</p>
                </div>
              ` : ''}
              
              ${material.actors?.length ? `
                <div class="detail-section">
                  <h3><i class="fas fa-users"></i> Актеры</h3>
                  <p class="actors">${material.actors.slice(0, 6).join(', ')}${material.actors.length > 6 ? '...' : ''}</p>
                </div>
              ` : ''}
            </div>
          </div>
          
          ${item.screenshots?.length ? `
            <div class="screenshots-section">
              <h3><i class="fas fa-images"></i> Скриншоты</h3>
              <div class="screenshots-grid">
                ${item.screenshots.slice(0, 4).map(screenshot => `
                  <div class="screenshot-item">
                    <img src="${screenshot}" alt="Скриншот" onclick="openImageModal('${screenshot}')">
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        
        <div class="modal-footer">
          <div class="database-links">
            <a href="https://shikimori.one/animes?search=${encodeURIComponent(item.title)}" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> Shikimori
            </a>
            <a href="https://anilist.co/search/anime?search=${encodeURIComponent(item.title)}" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> AniList
            </a>
            <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(item.title)}" target="_blank" class="database-link">
              <i class="fas fa-external-link-alt"></i> MyAnimeList
            </a>
          </div>
          <button onclick="closeAnimeInfoModal()" class="modal-close-button">
            <i class="fas fa-times"></i> Закрыть
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Закрытие по ESC
  document.addEventListener('keydown', function closeOnEsc(e) {
    if (e.key === 'Escape') {
      closeAnimeInfoModal();
      document.removeEventListener('keydown', closeOnEsc);
    }
  });
  
  // Закрытие по клику вне модалки
  document.getElementById('animeInfoModal').addEventListener('click', function(e) {
    if (e.target === this) {
      closeAnimeInfoModal();
    }
  });
}

function closeAnimeInfoModal() {
  const modal = document.getElementById('animeInfoModal');
  if (modal) {
    modal.remove();
  }
}

function openImageModal(src) {
  const imageModal = `
    <div class="image-modal-overlay" onclick="closeImageModal()">
      <img src="${src}" alt="Увеличенное изображение" onclick="event.stopPropagation()">
      <button class="image-modal-close" onclick="closeImageModal()">
        <i class="fas fa-times"></i>
      </button>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', imageModal);
}

function closeImageModal() {
  const imageModal = document.querySelector('.image-modal-overlay');
  if (imageModal) {
    imageModal.remove();
  }
}

/* ---------- FAVORITES ---------- */
window.toggleFavorite = async (title, link) => {
  try {
    const db = await initDB();
    const favs = await dbGetAll(STORE_FAVORITES);
    const old = favs.find((f) => f.link === link);
    if (old) {
      await dbDel(STORE_FAVORITES, old.id);
      showNote(`«${title}» удалено из избранного`, "info");
    } else {
      await dbAdd(STORE_FAVORITES, {
        id: Date.now(),
        title,
        link,
        t: Date.now(),
      });
      showNote(`«${title}» добавлено в избранное`, "success");
    }
    await refreshFavoriteIcons();
    if (
      location.hash === "#favorites" ||
      location.search.includes("page=favorites")
    )
      await renderFavoritesPage();
  } catch (e) {
    console.error("Ошибка toggleFavorite:", e);
    showNote("Ошибка при работе с избранным", "error");
  }
};
window.refreshFavoriteIcons = async () => {
  const db = await initDB();
  const favs = await dbGetAll(STORE_FAVORITES);
  const favLinks = new Set(favs.map((f) => f.link));
  document.querySelectorAll(".favorite-btn").forEach((btn) => {
    const link = btn.dataset.link;
    const is = favLinks.has(link);
    btn.querySelector("i").className = is ? "fas fa-heart" : "far fa-heart";
    btn.title = is ? "Удалить из избранного" : "Добавить в избранное";
  });
};

/* ---------- SHARE ---------- */
window.shareAnime = (title, title_orig, link, year, genres) => {
  const url = `${location.origin}/search/${encodeURIComponent(title_orig)}`; // Используем оригинальное название в URL
  const shareText = `Смотри «${title} (${year})» на AniFox. Жанры: ${genres.join(', ')}. ${url}`;

  if (navigator.share) {
    navigator.share({ title: title, text: shareText, url });
  } else {
    navigator.clipboard.writeText(url);
    showNote("Ссылка скопирована в буфер обмена", "success");
  }
};

/* ---------- HISTORY ---------- */
async function addHistory(q) {
  if (!q.trim()) return;
  try {
    const hist = await dbGetAll(STORE_SEARCH_HISTORY, "timestamp");
    const old = hist.find((i) => i.query === q);
    if (old) await dbDel(STORE_SEARCH_HISTORY, old.id);
    await dbAdd(STORE_SEARCH_HISTORY, {
      id: Date.now(),
      query: q,
      t: Date.now(),
    });
  } catch {}
}
window.searchFromHistory = (q) => {
  $("searchInput").value = q;
  search();
};
window.removeFromHistory = async (e, id) => {
  e.stopPropagation();
  try {
    await dbDel(STORE_SEARCH_HISTORY, id);
    renderWeekly();
  } catch (e) {
    console.error("Ошибка удаления из истории:", e);
  }
};
window.clearSearchHistory = async () => {
  if (confirm("Очистить историю?")) {
    try {
      await dbClear(STORE_SEARCH_HISTORY);
      renderWeekly();
    } catch (e) {
      console.error("Ошибка очистки истории:", e);
      showNote("Ошибка при очистке истории", "error");
    }
  }
};

/* ---------- RENDER ---------- */
async function renderFavoritesPage() {
  const box = $("resultsBox");
  if (!box) return;
  box.innerHTML =
    '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка избранного...</p></div>';
  try {
    const db = await initDB();
    const favs = (await dbGetAll(STORE_FAVORITES, "timestamp")).sort(
      (a, b) => b.t - a.t
    );
    if (!favs.length) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>В избранном пока ничего нет</h2><p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p><button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div>`;
      return;
    }
    let html = `<section class="favorites-section"><div class="section-header"><h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Всего: <span class="stats-highlight">${favs.length} аниме</span></span></div></div><div class="results-grid">`;
    html += (
      await Promise.all(
        favs.map((f) => createAnimeCard({ title: f.title, link: f.link }))
      )
    ).join("");
    html += `</div><div class="favorites-actions"><button onclick="clearFavorites()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить избранное</button><button onclick="navigateToHome()" class="clear-history-btn secondary"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div></section>`;
    box.innerHTML = html;
  } catch (e) {
    console.error("Ошибка renderFavoritesPage:", e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки избранного</h2><p>Попробуйте перезагрузить страницу</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}
window.clearFavorites = async () => {
  if (confirm("Очистить всё избранное?")) {
    try {
      await dbClear(STORE_FAVORITES);
      renderFavoritesPage();
      showNote("Избранное очищено", "success");
    } catch (e) {
      console.error("Ошибка clearFavorites:", e);
      showNote("Ошибка при очистке избранного", "error");
    }
  }
};

async function renderWeekly() {
  const box = $("resultsBox");
  if (!box) return;
  box.innerHTML =
    '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка новинок...</p></div>';
  const hasHist = await (async () => {
    try {
      const hist = (await dbGetAll(STORE_SEARCH_HISTORY, "timestamp"))
        .sort((a, b) => b.t - a.t)
        .slice(0, 10);
      if (!hist.length) return false;
      let h = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
      hist.forEach(
        (i) =>
          (h += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(
            /'/g,
            "\\'"
          )}')"><i class="fas fa-search"></i> ${
            i.query
          }<span class="remove-history" onclick="removeFromHistory(event, ${
            i.id
          })"><i class="fas fa-times"></i></span></button>`)
      );
      h += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
      box.innerHTML = h;
      return true;
    } catch {
      return false;
    }
  })();
  try {
    const data = await apiWeekly();
    updateSEOMeta(data);
    const seen = new Set();
    const list = (data.results || []).filter((i) => {
      const k = i.title.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (list.length) {
      let html =
        (hasHist ? box.innerHTML : "") +
        `<section class="weekly-section"><h2 class="section-title fade-in"><i class="fas fa-bolt"></i> Свежее за неделю</h2><div class="results-grid">`;
      html += (await Promise.all(list.map(createAnimeCard))).join("");
      html += `</div></section>`;
      box.innerHTML = html;
    } else if (!hasHist) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Добро пожаловать в AniFox!</h2><p>Начните с поиска аниме</p><ul><li><i class="fas fa-search"></i> Используйте поиск для нахождения аниме</li><li><i class="fas fa-history"></i> Просматривайте историю поиска</li><li><i class="fas fa-bolt"></i> Смотрите свежие обновления</li><li><i class="fas fa-heart"></i> Добавляйте аниме в избранное</li></ul></div>`;
    }
  } catch (e) {
    console.error("Ошибка renderWeekly:", e);
    if (!hasHist)
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте перезагрузить страницу</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}

async function search() {
  const input = $("searchInput");
  const q = input?.value.trim() || "";
  const box = $("resultsBox");
  if (!box) return;
  if (!q) {
    renderWeekly();
    return;
  }
  box.innerHTML =
    '<div class="loading-container"><div class="loading"></div><p class="loading-text">Поиск аниме...</p></div>';
  await addHistory(q);
  try {
    const data = await apiSearch(q);
    const seen = new Set();
    const currentSearchResults = (data.results || []).filter((item) => {
      const key = item.title.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (!currentSearchResults.length) {
      box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>По запросу «${q}» ничего не найдено</h2><p>Попробуйте изменить запрос:</p><ul><li><i class="fas fa-spell-check"></i> Проверить правильность написания</li><li><i class="fas fa-language"></i> Использовать английское название</li><li><i class="fas fa-filter"></i> Искать по жанру или году</li><li><i class="fas fa-simplify"></i> Упростить запрос</li></ul></div>`;
      setTimeout(async () => {
        try {
          const hist = (await dbGetAll(STORE_SEARCH_HISTORY, "timestamp"))
            .sort((a, b) => b.t - a.t)
            .slice(0, 10);
          if (hist.length) {
            let html = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
            hist.forEach(
              (i) =>
                (html += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(
                  /'/g,
                  "\\'"
                )}')"><i class="fas fa-search"></i> ${
                  i.query
                }<span class="remove-history" onclick="removeFromHistory(event, ${
                  i.id
                })"><i class="fas fa-times"></i></span></button>`)
            );
            html += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
            box.innerHTML += '<div class="content-separator"></div>' + html;
          }
        } catch (e) {
          console.error("Ошибка загрузки истории:", e);
        }
      }, 100);
      return;
    }
    let html = `<section class="search-results-section"><div class="search-header"><h2 class="section-title fade-in"><i class="fas fa-search"></i> Результаты поиска: «${q}»</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${currentSearchResults.length} аниме</span> по запросу «${q}»</span></div></div><div class="results-grid">`;
    html += (await Promise.all(currentSearchResults.map(createAnimeCard))).join(
      ""
    );
    html += `</div></section>`;
    box.innerHTML = html;
    const slug = toSlug(q);
    const newUrl = `/search/${slug}`;
    history.replaceState(null, null, newUrl);
    if (input) input.value = "";
    updateSEOMeta(data);
  } catch (e) {
    console.error("Ошибка search:", e);
    box.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте повторить поиск позже</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}

/* ---------- HEADER ---------- */
function updateHeader() {
  const h = document.querySelector(".top");
  if (h)
    h.innerHTML = `
    <a class="logo-link" href="/" onclick="navigateToHome(event)">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 265 275" fill="none">
<rect width="40.4804" height="283.038" rx="15" transform="matrix(0.906596 -0.421999 0.423238 0.906018 103.258 17.0827)" fill="url(#paint0_linear_2_15)"/>
<foreignObject x="-94.4697" y="2.52924" width="453.939" height="366.952"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(50px);clip-path:url(#bgblur_0_2_15_clip_path);height:100%;width:100%"></div></foreignObject><rect data-figma-bg-blur-radius="100" width="40.4396" height="283.324" rx="15" transform="matrix(-0.506493 -0.862244 -0.863032 0.505149 265 131.879)" fill="url(#paint1_linear_2_15)"/>
<rect width="40.4804" height="283.038" rx="15" transform="matrix(-0.906596 -0.421999 -0.423238 0.906018 156.62 17.5398)" fill="url(#paint2_linear_2_15)"/>
<defs>
<clipPath id="bgblur_0_2_15_clip_path" transform="translate(94.4697 -2.52924)"><rect width="40.4396" height="283.324" rx="15" transform="matrix(-0.506493 -0.862244 -0.863032 0.505149 265 131.879)"/>
</clipPath><linearGradient id="paint0_linear_2_15" x1="20.2402" y1="3.11131e-08" x2="27.5397" y2="495.888" gradientUnits="userSpaceOnUse">
<stop stop-color="white"/>
<stop offset="1" stop-color="white" stop-opacity="0.7"/>
</linearGradient>
<linearGradient id="paint1_linear_2_15" x1="25.1242" y1="411.958" x2="33.2642" y2="-4.77633" gradientUnits="userSpaceOnUse">
<stop stop-color="#22083F" stop-opacity="0.7"/>
<stop offset="1" stop-color="#6C16C9"/>
</linearGradient>
<linearGradient id="paint2_linear_2_15" x1="20.2402" y1="0" x2="20.2402" y2="283.038" gradientUnits="userSpaceOnUse">
<stop stop-color="white"/>
<stop offset="1" stop-color="white"/>
</linearGradient>
</defs>
</svg>
      <span class="logo-text">AniFox</span>
    </a>
    <nav class="header-nav">
      <button class="nav-btn ${
        !location.search.includes("page=favorites") ? "active" : ""
      }" onclick="navigateToHome()"><i class="fas fa-search"></i> Поиск</button>
      <button class="nav-btn ${
        location.search.includes("page=favorites") ? "active" : ""
      }" onclick="navigateToFavorites()"><i class="fas fa-heart"></i> Избранное</button>
    </nav>`;
}
window.navigateToHome = (e) => {
  if (e) e.preventDefault();
  history.replaceState(null, null, "/");
  updateHeader();
  renderWeekly();
};
window.navigateToFavorites = () => {
  const url = location.search
    ? `${location.pathname}${location.search}${
        location.search.includes("?") ? "&" : "?"
      }page=favorites`
    : `${location.pathname}?page=favorites`;
  history.replaceState(null, null, url);
  updateHeader();
  renderFavoritesPage();
};

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div id="mainPreloader" class="preloader-overlay"><div class="preloader-content"><div class="preloader-spinner"></div><p class="preloader-text">Загрузка AniFox...</p></div></div>'
  );
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
      const path = location.pathname;
      if (path.startsWith("/search/")) {
        const slug = path.replace("/search/", "");
        const query = slug.replace(/-/g, " ");
        input.value = query;
        search();
      } else if (location.search.includes("page=favorites")) {
        renderFavoritesPage();
      } else {
        renderWeekly();
      }
    }
    if (btn) {
      window.addEventListener("scroll", () =>
        btn.classList.toggle("show", window.scrollY > 300)
      );
      btn.addEventListener("click", () =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
    }
  } catch (e) {
    console.error("Ошибка инициализации:", e);
    showNote("Ошибка загрузки приложения", "error");
  } finally {
    const preloader = document.getElementById("mainPreloader");
    if (preloader) preloader.remove();
  }
});
