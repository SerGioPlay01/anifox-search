/* =========================================================
   AniFox 2.4 (optimized)
   Улучшения: кнопки загрузки вместо прогрессивной загрузки + исправление JSON ошибок
   ========================================================= */

/* ---------- CONFIG ---------- */
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const TTL = 10 * 60 * 1000; // 10-мин кэш
const SHIKIMORI_API_BASE = "https://shikimori.one/api";
const CACHE_VERSION = '2.4';

/* ---------- GLOBAL STATE ---------- */
let currentSearchResults = [];
let currentFavorites = [];
let currentWeeklyResults = [];
let currentSearchQuery = '';

/* ---------- FONT AWESOME FIX ---------- */
function loadFontAwesome() {
    return new Promise((resolve, reject) => {
        if (document.querySelector('link[href*="font-awesome"]') || 
            document.querySelector('style[data-font-awesome]')) {
            resolve();
            return;
        }
        
        // Сначала загрузим шрифты, потом CSS
        preloadFonts()
            .then(() => {
                const faLink = document.createElement('link');
                faLink.rel = 'stylesheet';
                faLink.href = '/css/all.min.css';
                faLink.setAttribute('data-font-awesome', 'true');
                
                faLink.onload = () => {
                    console.log('Font Awesome загружен успешно');
                    resolve();
                };
                faLink.onerror = () => {
                    console.error('Ошибка загрузки CSS');
                    reject(new Error('CSS не загружен'));
                };
                
                document.head.appendChild(faLink);
            })
            .catch(reject);
    });
}

// Функция предзагрузки шрифтов
function preloadFonts() {
    return new Promise((resolve) => {
        const fonts = [
            '/webfonts/fa-brands-400.woff2',
            '/webfonts/fa-regular-400.woff2', 
            '/webfonts/fa-solid-900.woff2'
        ];
        
        let loaded = 0;
        
        fonts.forEach(fontPath => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = fontPath;
            link.as = 'font';
            link.type = 'font/woff2';
            link.crossOrigin = 'anonymous';
            
            link.onload = () => {
                loaded++;
                if (loaded === fonts.length) resolve();
            };
            
            link.onerror = () => {
                loaded++;
                if (loaded === fonts.length) resolve();
            };
            
            document.head.appendChild(link);
        });
    });
}

// Альтернативная версия с исправлением путей в CSS
function loadFontAwesomeWithFix() {
    return new Promise((resolve, reject) => {
        if (document.querySelector('style[data-font-awesome-fixed]')) {
            resolve();
            return;
        }
        
        // Загружаем CSS файл и исправляем пути
        fetch('/css/all.min.css')
            .then(response => response.text())
            .then(cssText => {
                // Исправляем пути к шрифтам
                const fixedCSS = cssText.replace(/url\(\.\.\/webfonts\//g, 'url(/webfonts/');
                
                const style = document.createElement('style');
                style.textContent = fixedCSS;
                style.setAttribute('data-font-awesome-fixed', 'true');
                document.head.appendChild(style);
                
                console.log('Font Awesome загружен с исправленными путями');
                resolve();
            })
            .catch(error => {
                console.error('Ошибка загрузки Font Awesome:', error);
                reject(error);
            });
    });
}

loadFontAwesomeWithFix()
    .then(() => console.log('✅ Font Awesome готов (пути исправлены)'))
    .catch(error => console.error('❌ Ошибка:', error));

    
/* ---------- CACHE MANAGEMENT ---------- */
class CacheManager {
    constructor() {
        this.styleSheets = new Set();
        this.scripts = new Set();
    }

    clearOldAssets() {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
            if (link.href && !this.styleSheets.has(link.href) && 
                link.getAttribute('data-dynamic') && 
                !link.href.includes('font-awesome')) {
                link.remove();
            }
        });

        document.querySelectorAll('script[src]').forEach(script => {
            if (script.src && !this.scripts.has(script.src) && script.getAttribute('data-dynamic')) {
                script.remove();
            }
        });

        document.querySelectorAll('[data-dynamic]').forEach(el => {
            if (!el.isConnected) return;
            const timestamp = parseInt(el.getAttribute('data-timestamp') || '0');
            if (Date.now() - timestamp > 300000) {
                el.remove();
            }
        });
    }

    addStyle(href) {
        if (this.styleSheets.has(href)) return;
        
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href + '?v=' + CACHE_VERSION;
        link.setAttribute('data-dynamic', '');
        link.setAttribute('data-timestamp', Date.now());
        document.head.appendChild(link);
        this.styleSheets.add(href);
    }

    addScript(src, options = {}) {
        if (this.scripts.has(src)) return Promise.resolve();

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src + '?v=' + CACHE_VERSION;
            script.setAttribute('data-dynamic', '');
            script.setAttribute('data-timestamp', Date.now());
            
            if (options.async) script.async = true;
            if (options.defer) script.defer = true;
            
            script.onload = resolve;
            script.onerror = reject;
            
            document.head.appendChild(script);
            this.scripts.add(src);
        });
    }

    startCleanupInterval() {
        setInterval(() => this.clearOldAssets(), 60000);
    }
}

const cacheManager = new CacheManager();

/* ---------- INDEXEDDB ---------- */
const DB_NAME = "AniFoxDB";
const DB_VERSION = 4;
const STORE_SEARCH_HISTORY = "search_history";
const STORE_FAVORITES = "favorites";
const STORE_SEARCH_RESULTS = "search_results";
const STORE_ANIME_INFO = "anime_info";
const STORE_SHIKIMORI_CACHE = "shikimori_cache";

let db = null;
async function initDB() {
    if (db) return db;
    
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(DB_NAME, DB_VERSION);
        r.onerror = () => reject(r.error);
        r.onsuccess = () => {
            db = r.result;
            setTimeout(() => clearOldCacheData(), 1000);
            resolve(db);
        };
        r.onupgradeneeded = (e) => {
            const d = e.target.result;
            const stores = [
                STORE_SEARCH_HISTORY,
                STORE_FAVORITES,
                STORE_SEARCH_RESULTS,
                STORE_ANIME_INFO,
                STORE_SHIKIMORI_CACHE,
            ];
            
            stores.forEach((n) => {
                if (!d.objectStoreNames.contains(n)) {
                    const s = d.createObjectStore(n, {
                        keyPath:
                            n === STORE_SEARCH_RESULTS
                                ? "query"
                                : n === STORE_ANIME_INFO
                                ? "title"
                                : n === STORE_SHIKIMORI_CACHE
                                ? "query"
                                : "id",
                    });
                    s.createIndex("timestamp", "t", { unique: false });
                    if (n === STORE_FAVORITES) {
                        s.createIndex("title", "title", { unique: false });
                        s.createIndex("link", "link", { unique: true });
                    }
                    if (n === STORE_SHIKIMORI_CACHE) {
                        s.createIndex("cachedAt", "cachedAt", { unique: false });
                    }
                }
            });
        };
    });
}

async function clearOldCacheData() {
    try {
        const db = await initDB();
        const stores = [STORE_SEARCH_RESULTS, STORE_ANIME_INFO, STORE_SHIKIMORI_CACHE];
        const now = Date.now();
        
        for (const storeName of stores) {
            const tx = db.transaction([storeName], "readwrite");
            const store = tx.objectStore(storeName);
            const index = store.index('timestamp') || store.index('cachedAt') || store.index('t');
            
            const allData = await new Promise((resolve) => {
                const request = index ? index.openCursor() : store.openCursor();
                const results = [];
                request.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        results.push(cursor.value);
                        cursor.continue();
                    } else {
                        resolve(results);
                    }
                };
                request.onerror = () => resolve([]);
            });
            
            for (const data of allData) {
                const timestamp = data.t || data.cachedAt || data.timestamp;
                if (now - timestamp > TTL * 2) {
                    store.delete(data.query || data.title || data.id);
                }
            }
            
            await promisifyTX(tx);
        }
    } catch (error) {
        console.warn('Cache cleanup error:', error);
    }
}

const dbOperations = {
    async add(s, data) {
        try {
            const db = await initDB();
            const tx = db.transaction([s], "readwrite");
            const store = tx.objectStore(s);
            store.add(data);
            return promisifyTX(tx);
        } catch (error) {
            console.error("dbAdd error:", error);
            throw error;
        }
    },

    async put(s, data) {
        try {
            const db = await initDB();
            const tx = db.transaction([s], "readwrite");
            const store = tx.objectStore(s);
            store.put(data);
            return promisifyTX(tx);
        } catch (error) {
            console.error("dbPut error:", error);
            throw error;
        }
    },

    async get(s, key) {
        try {
            const db = await initDB();
            const tx = db.transaction([s], "readonly");
            const store = tx.objectStore(s);
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error("dbGet error:", error);
            throw error;
        }
    },

    async getAll(s, index) {
        try {
            const db = await initDB();
            const tx = db.transaction([s], "readonly");
            const store = index ? tx.objectStore(s).index(index) : tx.objectStore(s);
            return new Promise((resolve, reject) => {
                const request = store.getAll();
                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.error("dbGetAll error:", error);
            return [];
        }
    },

    async delete(s, key) {
        try {
            const db = await initDB();
            const tx = db.transaction([s], "readwrite");
            const store = tx.objectStore(s);
            store.delete(key);
            return promisifyTX(tx);
        } catch (error) {
            console.error("dbDel error:", error);
            throw error;
        }
    },

    async clear(s) {
        try {
            const db = await initDB();
            const tx = db.transaction([s], "readwrite");
            const store = tx.objectStore(s);
            store.clear();
            return promisifyTX(tx);
        } catch (error) {
            console.error("dbClear error:", error);
            throw error;
        }
    }
};

const dbAdd = dbOperations.add;
const dbPut = dbOperations.put;
const dbGet = dbOperations.get;
const dbGetAll = dbOperations.getAll;
const dbDel = dbOperations.delete;
const dbClear = dbOperations.clear;

function promisifyTX(tx) {
    return new Promise((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
    });
}

/* ---------- PERFORMANCE OPTIMIZATIONS ---------- */
let searchTimeout = null;
function debounceSearch(func, delay = 500) {
    return function (...args) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => func.apply(this, args), delay);
    };
}

function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src]');
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
                imageObserver.unobserve(img);
            }
        });
    });

    images.forEach(img => imageObserver.observe(img));
}

const fetchCache = new Map();
async function optimizedFetch(url, options = {}) {
    const cacheKey = url + JSON.stringify(options);
    
    if (fetchCache.has(cacheKey)) {
        const cached = fetchCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 30000) {
            return cached.data;
        }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        
        clearTimeout(timeout);
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        fetchCache.set(cacheKey, {
            data,
            timestamp: Date.now()
        });
        
        if (fetchCache.size > 50) {
            const firstKey = fetchCache.keys().next().value;
            fetchCache.delete(firstKey);
        }
        
        return data;
    } catch (error) {
        clearTimeout(timeout);
        throw error;
    }
}

/* ---------- UTILS ---------- */
function createLoadingIndicator() {
    return `<div class="loading-indicator" id="loadingIndicator">
        <div class="preloader-spinner small"></div>
        <p>Загрузка...</p>
    </div>`;
}

function removeLoadingIndicator() {
    const indicator = document.getElementById('loadingIndicator');
    if (indicator) indicator.remove();
}

function createLoadMoreButton(text, onClick, id = 'loadMoreBtn') {
    return `<button class="load-more-btn" id="${id}" onclick="${onClick}">
        <i class="fas fa-arrow-down"></i> ${text}
    </button>`;
}

function createShowMoreButton(text, onClick, id = 'showMoreBtn') {
    return `<button class="show-more-btn" id="${id}" onclick="${onClick}">
        <i class="fas fa-chevron-down"></i> ${text}
    </button>`;
}

async function safeCreateAnimeCard(item) {
    try {
        return await createAnimeCard(item);
    } catch (error) {
        console.error('Error creating anime card:', error);
        return createFallbackCard(item);
    }
}

function createFallbackCard(item) {
    return `
    <div class="card fade-in">
        <div class="card-header">
            <h3 class="h2_name">${escapeHtml(item.title)}</h3>
            <div class="info-links">
                <a href="https://shikimori.one/animes?search=${encodeURIComponent(item.title)}" target="_blank" class="info-link" title="Shikimori"><i class="fas fa-external-link-alt"></i></a>
                <a href="https://anilist.co/search/anime?search=${encodeURIComponent(item.title)}" target="_blank" class="info-link" title="AniList"><i class="fas fa-external-link-alt"></i></a>
                <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(item.title)}" target="_blank" class="info-link" title="MyAnimeList"><i class="fas fa-external-link-alt"></i></a>
            </div>
        </div>
        <iframe class="single-player" src="${item.link}" allowfullscreen loading="lazy" title="Плеер: ${escapeHtml(item.title)}"></iframe>
        <div class="card-actions">
            <button class="action-btn favorite-btn" data-link="${item.link}" onclick="toggleFavorite('${escapeHtml(item.title).replace(/'/g, "\\'")}','${item.link}')" title="Удалить из избранного">
                <i class="fas fa-heart"></i>
            </button>
        </div>
    </div>`;
}

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Функция для безопасного парсинга JSON
function safeJsonParse(jsonString) {
    try {
        // Очищаем строку от недопустимых управляющих символов
        const cleanedString = jsonString.replace(/[\x00-\x1F\x7F]/g, '');
        return JSON.parse(cleanedString);
    } catch (error) {
        console.error('JSON parse error:', error);
        console.error('Problematic JSON string:', jsonString);
        throw new Error('Не удалось обработать данные аниме');
    }
}

/* ---------- FETCH ---------- */
async function fetchKodik(url, attempt = 1) {
    const ctrl = new AbortController(),
        t = setTimeout(() => ctrl.abort(), 10000);
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

async function fetchShikimoriInfo(title, attempt = 1) {
    const cacheKey = `shikimori_${title.toLowerCase().trim()}`;
    const CACHE_TTL = 24 * 60 * 60 * 1000;

    try {
        const cached = await dbGet(STORE_SHIKIMORI_CACHE, cacheKey);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
            return cached.data;
        }
    } catch (e) {}

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 8000);

    try {
        const searchUrl = `${SHIKIMORI_API_BASE}/animes?search=${encodeURIComponent(title)}&limit=1`;
        const response = await fetch(searchUrl, {
            signal: ctrl.signal,
            headers: {
                "User-Agent": "AniFox/2.4 (https://anifox-search.vercel.app)",
                Accept: "application/json",
            },
        });

        clearTimeout(timeout);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data || data.length === 0) return getFallbackShikimoriData(title);

        const anime = data[0];
        let detailedInfo = null;
        
        try {
            const detailUrl = `${SHIKIMORI_API_BASE}/animes/${anime.id}`;
            const detailResponse = await fetch(detailUrl, {
                signal: ctrl.signal,
                headers: {
                    "User-Agent": "AniFox/2.4 (https://anifox-search.vercel.app)",
                    Accept: "application/json",
                },
            });

            if (detailResponse.ok) detailedInfo = await detailResponse.json();
        } catch (detailError) {
            console.warn("Не удалось получить детальную информацию:", detailError);
        }

        const finalInfo = detailedInfo || anime;
        
        // ИСПРАВЛЕНИЕ: безопасная обработка score
        let ratingValue = null;
        if (finalInfo.score && typeof finalInfo.score === 'number') {
            ratingValue = finalInfo.score.toFixed(1);
        }

        const result = {
            description: finalInfo.description || `«${finalInfo.russian || finalInfo.name}» - аниме. ${finalInfo.english || ""}`,
            rating: ratingValue,
            duration: getDurationFromShikimori(finalInfo),
            status: getStatusFromShikimori(finalInfo.status),
            studios: finalInfo.studios ? finalInfo.studios.map((s) => s.name) : [],
            genres: finalInfo.genres ? finalInfo.genres.map((g) => g.russian || g.name) : [],
            poster_url: finalInfo.image ? `https://shikimori.one${finalInfo.image.original}` : null,
            shikimoriId: finalInfo.id,
            shikimoriUrl: `https://shikimori.one${finalInfo.url}`,
        };

        try {
            await dbPut(STORE_SHIKIMORI_CACHE, {
                query: cacheKey,
                data: result,
                cachedAt: Date.now(),
            });
        } catch (e) {
            console.warn("Не удалось сохранить в кэш Shikimori:", e);
        }

        return result;
    } catch (e) {
        clearTimeout(timeout);
        console.warn("Shikimori request failed:", e);

        if (attempt >= 2) return getFallbackShikimoriData(title);

        await new Promise((r) => setTimeout(r, attempt * 1000));
        return fetchShikimoriInfo(title, attempt + 1);
    }
}

function getDurationFromShikimori(anime) {
    if (!anime.duration) return null;
    const duration = anime.duration;
    if (duration < 10) return `${duration} мин.`;
    if (duration < 60) return `${duration} мин.`;
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    return minutes > 0 ? `${hours} ч. ${minutes} мин.` : `${hours} ч.`;
}

function getStatusFromShikimori(status) {
    const statusMap = {
        released: "завершён",
        ongoing: "выходит",
        anons: "анонсировано",
        latest: "недавно вышедшее",
    };
    return statusMap[status] || status;
}

function getFallbackShikimoriData(title) {
    const titleLower = title.toLowerCase();
    let genres = ["аниме"];
    
    if (titleLower.includes("приключ") || titleLower.includes("adventure")) genres.push("приключения");
    if (titleLower.includes("фэнтези") || titleLower.includes("fantasy")) genres.push("фэнтези");
    if (titleLower.includes("роман") || titleLower.includes("love") || titleLower.includes("romance")) genres.push("романтика");
    if (titleLower.includes("комеди") || titleLower.includes("comedy")) genres.push("комедия");
    if (titleLower.includes("драм") || titleLower.includes("drama")) genres.push("драма");
    if (titleLower.includes("экшен") || titleLower.includes("action")) genres.push("экшен");
    if (titleLower.includes("школ") || titleLower.includes("school")) genres.push("школа");

    return {
        description: `«${title}» - аниме. Подробное описание временно недоступно.`,
        rating: null,
        duration: "24 мин.",
        status: "завершён",
        studios: [],
        genres: genres.slice(0, 4),
        poster_url: null,
        isFallback: true,
    };
}

async function getAnimeExtendedInfo(item) {
    const cacheKey = item.title.toLowerCase().trim();

    try {
        const cached = await dbGet(STORE_ANIME_INFO, cacheKey);
        if (cached && Date.now() - cached.t < TTL) return cached.data;
    } catch (e) {}

    const result = {
        description: "",
        rating: null,
        duration: "",
        status: "",
        studios: [],
        additionalScreenshots: [],
        shikimoriData: null,
    };

    if (item.material_data) {
        const md = item.material_data;
        result.description = md.description || "";
        // ИСПРАВЛЕНИЕ: безопасная обработка rating
        result.rating = (md.rating && typeof md.rating === 'number') ? md.rating.toFixed(1) : null;
        result.duration = md.duration || "";
        result.status = md.status || "";
        result.studios = md.studios || [];
    }

    const needsMoreData = !result.description || result.description === "Описание отсутствует." || result.description.length < 50 || !result.rating || !result.studios.length;

    if (needsMoreData) {
        try {
            const shikimoriData = await fetchShikimoriInfo(item.title);
            if (shikimoriData) {
                result.shikimoriData = shikimoriData;
                if (!result.description || result.description.length < 50) result.description = shikimoriData.description;
                if (!result.rating) result.rating = shikimoriData.rating;
                if (!result.duration) result.duration = shikimoriData.duration;
                if (!result.status) result.status = shikimoriData.status;
                if (!result.studios.length) result.studios = shikimoriData.studios || [];
                if (shikimoriData.genres && (!item.genres || item.genres.length === 0)) item.genres = shikimoriData.genres;
            }
        } catch (e) {
            console.warn("Failed to fetch Shikimori data:", e);
        }
    }

    if ((!item.screenshots || item.screenshots.length < 3) && (!item.material_data?.screenshots || item.material_data.screenshots.length < 3)) {
        result.additionalScreenshots = generateRelevantScreenshots(item.genres || []);
    }

    try {
        await dbPut(STORE_ANIME_INFO, {
            title: cacheKey,
            data: result,
            t: Date.now(),
        });
    } catch (e) {
        console.warn("Не удалось сохранить в кэш аниме:", e);
    }

    return result;
}

function generateRelevantScreenshots(genres) {
    const genreScreenshots = {
        приключения: ["/resources/adventure1.jpg", "/resources/adventure2.jpg"],
        фэнтези: ["/resources/fantasy1.jpg", "/resources/fantasy2.jpg"],
        романтика: ["/resources/romance1.jpg", "/resources/romance2.jpg"],
        комедия: ["/resources/comedy1.jpg", "/resources/comedy2.jpg"],
        драма: ["/resources/drama1.jpg", "/resources/drama2.jpg"],
        экшен: ["/resources/action1.jpg", "/resources/action2.jpg"],
    };

    let screenshots = [];
    genres.forEach((genre) => {
        if (genreScreenshots[genre]) screenshots = [...screenshots, ...genreScreenshots[genre]];
    });

    return [...new Set(screenshots)].slice(0, 3);
}

/* ---------- API ---------- */
async function apiSearch(q) {
    q = q.trim().toLowerCase();
    if (!q) return { results: [] };
    
    const key = `${q}_${CACHE_VERSION}`;
    try {
        const cached = await dbGet(STORE_SEARCH_RESULTS, key);
        if (cached && Date.now() - cached.t < TTL) return cached.data;
    } catch {}
    
    const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(q)}&types=anime,anime-serial&with_material_data=true`;
    const data = await optimizedFetch(url);
    
    dbPut(STORE_SEARCH_RESULTS, { 
        query: key, 
        data, 
        t: Date.now(),
        version: CACHE_VERSION 
    }).catch(() => {});
    
    return data;
}

async function apiWeekly() {
    const key = `weekly_${CACHE_VERSION}`;
    try {
        const cached = await dbGet(STORE_SEARCH_RESULTS, key);
        if (cached && Date.now() - cached.t < TTL) return cached.data;
    } catch {}
    
    const url = `${BASE.replace("/search", "/list")}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&with_material_data=true`;
    const data = await optimizedFetch(url);
    
    dbPut(STORE_SEARCH_RESULTS, { 
        query: key, 
        data, 
        t: Date.now(),
        version: CACHE_VERSION 
    }).catch(() => {});
    
    return data;
}

/* ---------- UTILS ---------- */
const $ = (id) => document.getElementById(id);

function showNote(msg, type = "info") {
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const n = document.createElement("div");
    n.className = `notification notification-${type}`;
    n.innerHTML = `<i class="fas fa-${type === "success" ? "check" : type === "error" ? "exclamation-triangle" : "info"}"></i>
                   <span>${msg}</span>
                   <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
}

function toSlug(str) {
    const map = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya", " ": "-", _: "-",
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
    const base = ["аниме", "смотреть аниме онлайн", "русская озвучка", "anime hd"];
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
    // Полная очистка
    document.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
    
    const results = (apiData && apiData.results) || [];
    const query = new URLSearchParams(location.search).get("q") ||
                 (location.pathname.startsWith("/search/") ? 
                  location.pathname.replace("/search/", "").replace(/-/g, " ") : "");
    
    if (!query) return;
    
    // Удаляем query parameters из URL
    if (history.replaceState) {
        const cleanUrl = location.origin + location.pathname;
        history.replaceState(null, '', cleanUrl);
    }
    
    const top = results[0];
    let title, desc, kw, ogTitle, ogDesc, ogImage;
    
    if (top) {
        const { title: t, year, genres = "", material_data } = top;
        const clean = t.replace(/\[.*?\]/g, "").trim();
        title = `Смотреть аниме «${clean}» (${year}) онлайн бесплатно в HD — AniFox`;
        desc = `Аниме «${clean}» (${year}) уже на AniFox: русская озвучка, HD 1080p, без регистрации. Жанры: ${genres}. Смотри новые серии первым!`;
        kw = buildKeywords(clean, genres, year);
        ogTitle = `«${clean}» — смотреть онлайн`;
        ogDesc = desc;
        ogImage = material_data?.poster_url || "/resources/obl_web.jpg";
    } else {
        title = `Поиск «${query}» — AniFox`;
        desc = `По запросу «${query}» ничего не найдено, но вы можете посмотреть другие аниме на AniFox.`;
        kw = `аниме, ${query}, смотреть онлайн`;
        ogTitle = title;
        ogDesc = desc;
        ogImage = "/resources/obl_web.jpg";
    }
    
    // ОБНОВЛЕНО: Используем clean URL без параметров
    const cleanCanonical = location.origin + location.pathname;
    const currentUrl = location.origin + location.pathname;

    // Установка всех мета-тегов
    document.title = title;
    
    // Обновляем или создаем мета-теги
    updateMetaTag('name', 'description', desc);
    updateMetaTag('name', 'keywords', kw);
    
    // Open Graph
    updateMetaTag('property', 'og:title', ogTitle);
    updateMetaTag('property', 'og:description', ogDesc);
    updateMetaTag('property', 'og:image', ogImage);
    updateMetaTag('property', 'og:url', currentUrl);
    updateMetaTag('property', 'og:type', 'website');
    
    // Twitter
    updateMetaTag('name', 'twitter:title', ogTitle);
    updateMetaTag('name', 'twitter:description', ogDesc);
    updateMetaTag('name', 'twitter:image', ogImage);
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('property', 'twitter:domain', 'anifox-search.vercel.app');
    updateMetaTag('property', 'twitter:url', currentUrl);
    
    // Каноническая ссылка
    let linkCanon = document.createElement("link");
    linkCanon.rel = "canonical";
    linkCanon.href = cleanCanonical;
    linkCanon.setAttribute("data-dynamic", "");
    document.head.appendChild(linkCanon);
    
    // Микроразметка
    addStructuredData(query, results, cleanCanonical);
}

// ДОБАВЛЕНО: Функция для обновления или создания мета-тегов
function updateMetaTag(attr, name, content) {
    let metaTag;
    
    if (attr === 'property') {
        metaTag = document.querySelector(`meta[property="${name}"]`);
    } else {
        metaTag = document.querySelector(`meta[name="${name}"]`);
    }
    
    if (!metaTag) {
        metaTag = document.createElement('meta');
        if (attr === 'property') {
            metaTag.setAttribute('property', name);
        } else {
            metaTag.setAttribute('name', name);
        }
        metaTag.setAttribute('data-dynamic', '');
        document.head.appendChild(metaTag);
    }
    
    metaTag.setAttribute('content', content);
}

// ДОБАВЛЕНО: Функция для установки атрибутов (если используется)
function setAttr(selector, attr, value) {
    const element = document.querySelector(selector);
    if (element) {
        element.setAttribute(attr, value);
    }
}

// ДОБАВЛЕНО: Функция для очистки старых динамических элементов
function clearOldDynamicMeta() {
    document.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
}

// ДОБАВЛЕНО: Функция построения ключевых слов
function buildKeywords(title, genres, year) {
    const baseKeywords = [
        'аниме',
        'смотреть аниме онлайн',
        'аниме бесплатно',
        'AniFox',
        'аниме в HD'
    ];
    
    const titleKeywords = title
        .toLowerCase()
        .split(' ')
        .filter(word => word.length > 2);
    
    const genreKeywords = genres 
        ? genres.split(',').map(g => g.trim().toLowerCase())
        : [];
    
    return [...new Set([
        ...titleKeywords,
        ...genreKeywords,
        ...baseKeywords,
        `аниме ${year}`,
        `${title} смотреть онлайн`
    ])].slice(0, 20).join(', ');
}

// ДОБАВЛЕНО: Функция для микроразметки
function addStructuredData(query, results, canonical) {
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
    
    if (results.length) {
        jsonLd.mainEntity = results
            .slice(0, 10)
            .map((r) => ({
                "@type": "TVSeries",
                name: r.title,
                datePublished: r.year,
                genre: r.genres,
                image: r.material_data?.poster_url || "/resources/obl_web.jpg",
                url: `${location.origin}/search/${generateSlug(r.title)}`,
            }));
    }
            
    const scr = document.createElement("script");
    scr.type = "application/ld+json";
    scr.textContent = JSON.stringify(jsonLd);
    scr.setAttribute("data-dynamic", "");
    document.head.appendChild(scr);
}

function addStructuredData(query, results, canonical) {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "SearchResultsPage",
        "name": `Результаты поиска: ${query}`,
        "url": canonical,
        "description": `Результаты поиска по запросу: ${query}`,
        "mainEntity": {
            "@type": "ItemList",
            "numberOfItems": results.length,
            "itemListElement": results.slice(0, 10).map((item, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "item": {
                    "@type": "TVSeries",
                    "name": item.title,
                    "datePublished": item.year,
                    "genre": item.genres,
                    "image": item.material_data?.poster_url,
                    "url": `${location.origin}/?q=${encodeURIComponent(item.title)}`
                }
            }))
        }
    };
    
    const scr = document.createElement("script");
    scr.type = "application/ld+json";
    scr.textContent = JSON.stringify(jsonLd);
    scr.setAttribute("data-dynamic", "");
    document.head.appendChild(scr);
}

/* ---------- CARD ---------- */
async function createAnimeCard(item) {
    const t = item.title;
    const favs = await getFavorites();
    const isFav = favs.some(f => f.link === item.link);

    const hasInfoData = checkSimpleInfoData(item);
    const hasShareData = !!(item.link && t);
    const hasFavData = !!(item.link && t);

    return `
    <div class="card fade-in">
        <div class="card-header">
            <h3 class="h2_name">${t}</h3>
            <div class="info-links">
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
        <iframe class="single-player" src="${item.link}" allowfullscreen loading="lazy" title="Плеер: ${t}"></iframe>

        <div class="card-actions">
            ${hasFavData ? `
            <button class="action-btn favorite-btn" data-link="${item.link}"
                    onclick="toggleFavorite('${t.replace(/'/g, "\\'")}','${item.link}')"
                    title="${isFav ? 'Удалить из избранного' : 'Добавить в избранное'}">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </button>
            ` : ''}

            ${hasShareData ? `
            <button class="action-btn" onclick="shareAnime('${JSON.stringify(item).replace(/"/g, '&quot;')}')" title="Поделиться">
                <i class="fas fa-share"></i>
            </button>
            ` : ''}

            ${hasInfoData ? `
            <button class="action-btn" onclick="showAnimeInfo('${JSON.stringify(item).replace(/"/g, '&quot;')}')" title="Информация">
                <i class="fas fa-info-circle"></i>
            </button>
            ` : ''}
        </div>
    </div>`;
}

function checkSimpleInfoData(item) {
    return !!(item.material_data || item.year || (item.genres && item.genres.length));
}

/* ---------- FAVORITES ---------- */
let favoritesCache = null;

async function getFavorites() {
    if (favoritesCache) return favoritesCache;

    try {
        const favs = await dbGetAll(STORE_FAVORITES);
        favoritesCache = Array.isArray(favs) ? favs : [];
        return favoritesCache;
    } catch (e) {
        favoritesCache = [];
        return favoritesCache;
    }
}

function clearFavoritesCache() {
    favoritesCache = null;
}

window.toggleFavorite = async (title, link) => {
    try {
        const favs = await getFavorites();
        const old = favs.find((f) => f.link === link);

        if (old) {
            await dbDel(STORE_FAVORITES, old.id);
            showNote(`«${title}» удалено из избранного`, "info");
        } else {
            const newFavorite = {
                id: Date.now(),
                title: title,
                link: link,
                t: Date.now(),
                addedAt: new Date().toISOString(),
            };
            await dbAdd(STORE_FAVORITES, newFavorite);
            showNote(`«${title}» добавлено в избранное`, "success");
        }

        clearFavoritesCache();
        await refreshAllFavoriteButtons();

        if (location.search.includes("page=favorites")) {
            renderFavoritesPage();
        }
    } catch (e) {
        console.error("Toggle favorite error:", e);
        showNote("Ошибка при работе с избранным", "error");
    }
};

async function refreshAllFavoriteButtons() {
    const favs = await getFavorites();
    const favoriteLinks = new Set(favs.map((f) => f.link));

    document.querySelectorAll(".favorite-btn").forEach((btn) => {
        const link = btn.dataset.link;
        const isFav = favoriteLinks.has(link);
        const icon = btn.querySelector("i");
        
        if (icon) {
            icon.className = isFav ? "fas fa-heart" : "far fa-heart";
        }
        btn.title = isFav ? "Удалить из избранного" : "Добавить в избранное";
    });
}

window.refreshFavoriteIcons = refreshAllFavoriteButtons;

window.checkFavorites = async () => {
    try {
        const favs = await dbGetAll(STORE_FAVORITES);
        return favs;
    } catch (e) {
        return [];
    }
};

/* ---------- SHARE ---------- */
window.shareAnime = (itemRaw) => {
    let item;
    try {
        item = safeJsonParse(itemRaw);
    } catch (error) {
        console.error('Error parsing anime data for sharing:', error);
        showNote('Ошибка при подготовке данных для sharing', 'error');
        return;
    }
    
    const url = `${location.origin}/search/${toSlug(item.title_orig || item.title)}`;
    const text = `Смотри «${item.title}» (${item.year}) на AniFox.`;
    if (navigator.share) {
        navigator.share({ title: item.title, text, url });
    } else {
        navigator.clipboard.writeText(url);
        showNote("Ссылка скопирована в буфер обмена", "success");
    }
};

/* ---------- MODAL INFO ---------- */
window.showAnimeInfo = async (itemRaw) => {
    let item;
    try {
        item = safeJsonParse(itemRaw);
    } catch (error) {
        console.error('Error parsing anime data for info:', error);
        showNote('Ошибка при загрузке информации об аниме', 'error');
        return;
    }
    
    const md = item.material_data || {};

    const loadingHTML = `
    <div class="modal-overlay" onclick="closeAnimeModal(event)">
        <div class="modal-content" onclick="event.stopPropagation()">
            <button class="modal-close" onclick="closeAnimeModal()">&times;</button>
            <div class="modal-loading">
                <div class="preloader-spinner"></div>
                <p>Загрузка информации об аниме...</p>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML("beforeend", loadingHTML);
    document.body.classList.add("modal-open");

    try {
        const extendedInfo = await getAnimeExtendedInfo(item);

        const allScreenshots = [
            ...(item.screenshots || []),
            ...(md.screenshots || []),
            ...(extendedInfo.additionalScreenshots || []),
        ].slice(0, 8);

        const description = extendedInfo.description || md.description || "Описание отсутствует.";
        const rating = extendedInfo.rating || md.rating;
        const duration = extendedInfo.duration || md.duration;
        const status = extendedInfo.status || md.status;
        const studios = extendedInfo.studios.length ? extendedInfo.studios : md.studios || [];

        const favs = await getFavorites();
        const isFav = favs.some((f) => f.link === item.link);

        const html = `
        <div class="modal-overlay" onclick="closeAnimeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <button class="modal-close" onclick="closeAnimeModal()">&times;</button>
                <div class="modal-grid">
                    <div class="modal-left">
                        <img src="${md.poster_url || "/resources/obl_web.jpg"}" alt="Постер" class="modal-poster">
                        ${rating ? `<div class="modal-rating"><i class="fas fa-star"></i> ${rating}</div>` : ""}
                        <div class="modal-btns">
                            <button class="modal-btn ${isFav ? "secondary" : "primary"}" 
                                    id="favorite-btn" 
                                    onclick="handleFavoriteClick('${item.title.replace(/'/g, "\\'")}','${item.link}')"
                                    data-is-favorite="${isFav}">
                                <i class="${isFav ? "fas" : "far"} fa-heart"></i> 
                                <span class="btn-text">${isFav ? "Удалить из избранного" : "Добавить в избранное"}</span>
                                <span class="btn-loading" style="display: none;">
                                    <i class="fas fa-spinner fa-spin"></i> Загрузка...
                                </span>
                            </button>
                        </div>
                        ${extendedInfo.shikimoriData ? '<div class="modal-source-info"><i class="fas fa-database"></i> Данные дополнены Shikimori</div>' : ""}
                    </div>
                    <div class="modal-right">
                        <h2 class="modal-title">${item.title}</h2>
                        <p class="modal-orig">${item.title_orig || ""}</p>
                        <div class="modal-meta-grid">
                            <div class="meta-item"><span class="meta-label">Год:</span> <b>${item.year || "—"}</b></div>
                            <div class="meta-item"><span class="meta-label">Тип:</span> <b>${item.type || "—"}</b></div>
                            <div class="meta-item"><span class="meta-label">Качество:</span> <b>${item.quality || "—"}</b></div>
                            ${duration ? `<div class="meta-item"><span class="meta-label">Длительность:</span> <b>${duration}</b></div>` : ""}
                            ${status ? `<div class="meta-item"><span class="meta-label">Статус:</span> <b>${status}</b></div>` : ""}
                        </div>
                        ${studios.length > 0 ? `
                        <div class="modal-studios">
                            <span class="meta-label">Студии:</span> 
                            <span class="studios-list">${studios.join(", ")}</span>
                        </div>
                        ` : ""}
                        <div class="modal-genres">${(item.genres || []).map(g => `<span class="genre-tag">${g}</span>`).join("")}</div>
                        <div class="modal-desc">${description}</div>
                        ${allScreenshots.length > 0 ? `
                        <div class="modal-screens">
                            <h3 class="modal-screens-title">Скриншоты</h3>
                            <div class="screenshots-grid">
                                ${allScreenshots.map((s, index) => `
                                    <div class="screenshot-item" onclick="openScreenshotViewer('${allScreenshots.join("|")}', ${index})">
                                        <img src="${s}" loading="lazy" class="scr">
                                        <div class="screenshot-overlay">
                                            <i class="fas fa-expand"></i>
                                        </div>
                                    </div>
                                `).join("")}
                            </div>
                        </div>
                        ` : ""}
                    </div>
                </div>
            </div>
        </div>`;

        const modalOverlay = document.querySelector(".modal-overlay");
        if (modalOverlay) {
            modalOverlay.outerHTML = html;
        }
    } catch (error) {
        console.error("Error loading anime info:", error);
        const basicHTML = `
        <div class="modal-overlay" onclick="closeAnimeModal(event)">
            <div class="modal-content" onclick="event.stopPropagation()">
                <button class="modal-close" onclick="closeAnimeModal()">&times;</button>
                <div class="modal-grid">
                    <div class="modal-left">
                        <img src="${md.poster_url || "/resources/obl_web.jpg"}" alt="Постер" class="modal-poster">
                        <div class="modal-btns">
                            <button class="modal-btn primary" 
                                    id="favorite-btn"
                                    onclick="handleFavoriteClick('${item.title.replace(/'/g, "\\'")}','${item.link}')"
                                    data-is-favorite="false">
                                <i class="far fa-heart"></i> 
                                <span class="btn-text">Добавить в избранное</span>
                                <span class="btn-loading" style="display: none;">
                                    <i class="fas fa-spinner fa-spin"></i> Загрузка...
                                </span>
                            </button>
                        </div>
                    </div>
                    <div class="modal-right">
                        <h2 class="modal-title">${item.title}</h2>
                        <p class="modal-orig">${item.title_orig || ""}</p>
                        <p class="modal-meta">Год: <b>${item.year || "—"}</b> | Тип: <b>${item.type || "—"}</b> | Качество: <b>${item.quality || "—"}</b></p>
                        <div class="modal-genres">${(item.genres || []).map(g => `<span class="genre-tag">${g}</span>`).join("")}</div>
                        <div class="modal-desc">${md.description || "Описание отсутствует."}</div>
                    </div>
                </div>
            </div>
        </div>`;

        const modalOverlay = document.querySelector(".modal-overlay");
        if (modalOverlay) {
            modalOverlay.outerHTML = basicHTML;
        }
    }
};

window.handleFavoriteClick = async (title, link) => {
    const btn = document.getElementById('favorite-btn');
    if (!btn) return;

    const originalText = btn.querySelector('.btn-text').textContent;
    const originalIcon = btn.querySelector('i').className;
    const isCurrentlyFavorite = btn.getAttribute('data-is-favorite') === 'true';

    btn.disabled = true;
    btn.querySelector('.btn-text').style.display = 'none';
    btn.querySelector('.btn-loading').style.display = 'inline';

    try {
        await toggleFavorite(title, link);
        
        const newFavState = !isCurrentlyFavorite;
        btn.setAttribute('data-is-favorite', newFavState);
        
        if (newFavState) {
            btn.classList.remove('primary');
            btn.classList.add('secondary');
            btn.querySelector('i').className = 'fas fa-heart';
            btn.querySelector('.btn-text').textContent = 'Удалить из избранного';
        } else {
            btn.classList.remove('secondary');
            btn.classList.add('primary');
            btn.querySelector('i').className = 'far fa-heart';
            btn.querySelector('.btn-text').textContent = 'Добавить в избранное';
        }

        btn.style.transform = 'scale(1.05)';
        setTimeout(() => {
            btn.style.transform = 'scale(1)';
        }, 200);

    } catch (error) {
        console.error('Error toggling favorite:', error);
        btn.querySelector('.btn-text').textContent = originalText;
        btn.querySelector('i').className = originalIcon;
        alert('Произошла ошибка при изменении избранного. Попробуйте еще раз.');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').style.display = 'inline';
        btn.querySelector('.btn-loading').style.display = 'none';
    }
};

/* ---------- SCREENSHOT VIEWER ---------- */
window.openScreenshotViewer = (screenshotsString, startIndex) => {
    const screenshots = screenshotsString.split("|");
    let currentIndex = startIndex;

    const viewerHTML = `
    <div class="screenshot-viewer-overlay" onclick="closeScreenshotViewer()">
        <div class="screenshot-viewer-content" onclick="event.stopPropagation()">
            <button class="screenshot-viewer-close" onclick="closeScreenshotViewer()">&times;</button>
            <button class="screenshot-viewer-nav screenshot-viewer-prev" onclick="navigateScreenshot(-1)">
                <i class="fas fa-chevron-left"></i>
            </button>
            <button class="screenshot-viewer-nav screenshot-viewer-next" onclick="navigateScreenshot(1)">
                <i class="fas fa-chevron-right"></i>
            </button>
            <div class="screenshot-viewer-image-container">
                <img src="${screenshots[currentIndex]}" class="screenshot-viewer-image" id="screenshotViewerImage">
                <div class="screenshot-viewer-counter">
                    ${currentIndex + 1} / ${screenshots.length}
                </div>
            </div>
        </div>
    </div>
    `;

    document.body.insertAdjacentHTML("beforeend", viewerHTML);
    document.body.classList.add("screenshot-viewer-open");

    window.screenshotViewerData = {
        screenshots,
        currentIndex,
    };

    document.addEventListener("keydown", handleScreenshotKeyboard);
};

window.closeScreenshotViewer = () => {
    const viewer = document.querySelector(".screenshot-viewer-overlay");
    if (viewer) {
        viewer.remove();
        document.body.classList.remove("screenshot-viewer-open");
        document.removeEventListener("keydown", handleScreenshotKeyboard);
        delete window.screenshotViewerData;
    }
};

window.navigateScreenshot = (direction) => {
    if (!window.screenshotViewerData) return;

    const { screenshots, currentIndex } = window.screenshotViewerData;
    let newIndex = currentIndex + direction;

    if (newIndex < 0) newIndex = screenshots.length - 1;
    if (newIndex >= screenshots.length) newIndex = 0;

    window.screenshotViewerData.currentIndex = newIndex;

    const image = document.getElementById("screenshotViewerImage");
    const counter = document.querySelector(".screenshot-viewer-counter");

    image.src = screenshots[newIndex];
    counter.textContent = `${newIndex + 1} / ${screenshots.length}`;
};

function handleScreenshotKeyboard(e) {
    if (!window.screenshotViewerData) return;

    switch (e.key) {
        case "ArrowLeft":
            navigateScreenshot(-1);
            break;
        case "ArrowRight":
            navigateScreenshot(1);
            break;
        case "Escape":
            closeScreenshotViewer();
            break;
    }
}

window.closeAnimeModal = (e) => {
    if (e && e.target !== document.querySelector(".modal-overlay")) return;
    const mo = document.querySelector(".modal-overlay");
    if (mo) {
        mo.remove();
        document.body.classList.remove("modal-open");
    }
};
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAnimeModal();
});

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
    } catch (e) {}
};

window.clearSearchHistory = async () => {
    if (confirm("Очистить историю?")) {
        try {
            await dbClear(STORE_SEARCH_HISTORY);
            renderWeekly();
        } catch {
            showNote("Ошибка очистки истории", "error");
        }
    }
};

/* ---------- КНОПКИ ЗАГРУЗКИ ВМЕСТО ПРОГРЕССИВНОЙ ЗАГРУЗКИ ---------- */
const ITEMS_PER_PAGE = {
    search: 8,
    weekly: 6,
    favorites: 5
};

let currentDisplayCount = {
    search: 0,
    weekly: 0,
    favorites: 0
};

async function renderFavoritesPage() {
    const box = $("resultsBox");
    if (!box) return;

    box.innerHTML = '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка избранного...</p></div>';

    try {
        const favs = await getFavorites();
        currentFavorites = favs.sort((a, b) => b.t - a.t);
        currentDisplayCount.favorites = ITEMS_PER_PAGE.favorites;

        if (!currentFavorites.length) {
            box.innerHTML = `<div class="no-results fade-in">
                <i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
                <h2>В избранном пока ничего нет</h2>
                <p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p>
                <button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem">
                    <i class="fas fa-arrow-left"></i> Вернуться к поиску
                </button>
            </div>`;
            return;
        }

        const displayedFavorites = currentFavorites.slice(0, currentDisplayCount.favorites);
        const cards = await Promise.all(displayedFavorites.map(safeCreateAnimeCard));

        let html = `<section class="favorites-section">
            <div class="section-header">
                <h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2>
                <div class="stats-info">
                    <span class="stats-text">
                        <i class="fas fa-film"></i> Всего: <span class="stats-highlight">${currentFavorites.length} аниме</span>
                        | Показано: <span class="stats-highlight">${displayedFavorites.length}</span>
                    </span>
                </div>
            </div>
            <div class="results-grid" id="favoritesGrid">
                ${cards.join('')}
            </div>`;

        // Добавляем кнопку "Показать еще" если есть еще элементы
        if (currentDisplayCount.favorites < currentFavorites.length) {
            html += createLoadMoreButton(
                `Показать еще (${currentFavorites.length - currentDisplayCount.favorites})`,
                'loadMoreFavorites()',
                'loadMoreFavoritesBtn'
            );
        }

        html += `
            <div class="favorites-actions">
                <button onclick="clearFavorites()" class="clear-history-btn">
                    <i class="fas fa-trash"></i> Очистить избранное
                </button>
                <button onclick="navigateToHome()" class="clear-history-btn secondary">
                    <i class="fas fa-arrow-left"></i> Вернуться к поиску
                </button>
            </div>
        </section>`;

        box.innerHTML = html;

    } catch (e) {
        console.error("Error rendering favorites:", e);
        box.innerHTML = `<div class="no-results fade-in">
            <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
            <h2>Ошибка загрузки избранного</h2>
            <p>Попробуйте перезагрузить страницу</p>
            <p style="color:var(--gray);font-size:.9rem">${e.message}</p>
        </div>`;
    }
}

window.loadMoreFavorites = async function() {
    const btn = document.getElementById('loadMoreFavoritesBtn');
    const grid = document.getElementById('favoritesGrid');
    
    if (!btn || !grid) return;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
    btn.disabled = true;

    try {
        currentDisplayCount.favorites += ITEMS_PER_PAGE.favorites;
        const newFavorites = currentFavorites.slice(
            currentDisplayCount.favorites - ITEMS_PER_PAGE.favorites,
            currentDisplayCount.favorites
        );

        const newCards = await Promise.all(newFavorites.map(safeCreateAnimeCard));
        
        newCards.forEach(card => {
            grid.insertAdjacentHTML('beforeend', card);
        });

        // Обновляем статистику
        const statsInfo = document.querySelector('.favorites-section .stats-info');
        if (statsInfo) {
            statsInfo.innerHTML = `
                <span class="stats-text">
                    <i class="fas fa-film"></i> Всего: <span class="stats-highlight">${currentFavorites.length} аниме</span>
                    | Показано: <span class="stats-highlight">${Math.min(currentDisplayCount.favorites, currentFavorites.length)}</span>
                </span>
            `;
        }

        // Обновляем или удаляем кнопку
        if (currentDisplayCount.favorites >= currentFavorites.length) {
            btn.remove();
        } else {
            btn.innerHTML = `<i class="fas fa-arrow-down"></i> Показать еще (${currentFavorites.length - currentDisplayCount.favorites})`;
            btn.disabled = false;
        }

        await refreshAllFavoriteButtons();

    } catch (error) {
        console.error('Error loading more favorites:', error);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка загрузки';
        setTimeout(() => {
            btn.innerHTML = `<i class="fas fa-arrow-down"></i> Показать еще (${currentFavorites.length - currentDisplayCount.favorites + ITEMS_PER_PAGE.favorites})`;
            btn.disabled = false;
        }, 2000);
    }
}

window.clearFavorites = async () => {
    if (confirm("Очистить всё избранное?")) {
        try {
            await dbClear(STORE_FAVORITES);
            clearFavoritesCache();
            currentFavorites = [];
            currentDisplayCount.favorites = ITEMS_PER_PAGE.favorites;
            await refreshAllFavoriteButtons();

            if (location.search.includes("page=favorites")) {
                renderFavoritesPage();
            }
            showNote("Избранное очищено", "success");
        } catch (e) {
            console.error("Clear favorites error:", e);
            showNote("Ошибка при очистке избранного", "error");
        }
    }
};

/* ---------- HISTORY SECTION ---------- */
async function loadHistorySection() {
    try {
        const hist = await dbGetAll(STORE_SEARCH_HISTORY, "timestamp");
        const list = hist.sort((a, b) => b.t - a.t).slice(0, 10);
        if (!list.length) return '';

        let html = `<section class="history-section">
            <h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2>
            <div class="search-history-buttons">`;
        
        list.forEach(i => {
            html += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g, "\\'")}')">
                <i class="fas fa-search"></i> ${escapeHtml(i.query)}
                <span class="remove-history" onclick="removeFromHistory(event,${i.id})">
                    <i class="fas fa-times"></i>
                </span>
            </button>`;
        });
        
        html += `</div>
            <div class="history-actions">
                <button onclick="clearSearchHistory()" class="clear-history-btn">
                    <i class="fas fa-trash"></i> Очистить историю
                </button>
            </div>
        </section>`;
        
        return html;
    } catch {
        return '';
    }
}

/* ---------- RENDER WEEKLY ---------- */
async function renderWeekly() {
    const box = $("resultsBox");
    if (!box) return;
    
    box.innerHTML = '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка новинок...</p></div>';

    // Загружаем историю и новинки параллельно
    const [historyData, weeklyData] = await Promise.allSettled([
        loadHistorySection(),
        loadWeeklyData()
    ]);

    let finalHTML = '';
    
    if (historyData.status === 'fulfilled' && historyData.value) {
        finalHTML += historyData.value;
    }

    if (weeklyData.status === 'fulfilled' && weeklyData.value) {
        if (finalHTML) finalHTML += '<div class="content-separator"></div>';
        finalHTML += weeklyData.value;
    }

    if (!finalHTML) {
        finalHTML = `<div class="no-results fade-in">
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
    }

    box.innerHTML = finalHTML;
}

async function loadWeeklyData() {
    try {
        const data = await apiWeekly();
        updateSEOMeta(data);
        
        const seen = new Set();
        currentWeeklyResults = (data.results || []).filter(i => {
            const k = i.title.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        if (!currentWeeklyResults.length) return '';

        currentDisplayCount.weekly = ITEMS_PER_PAGE.weekly;
        const displayedWeekly = currentWeeklyResults.slice(0, currentDisplayCount.weekly);
        const cards = await Promise.all(displayedWeekly.map(safeCreateAnimeCard));

        let html = `<section class="weekly-section">
            <h2 class="section-title fade-in"><i class="fas fa-bolt"></i> Свежее за неделю</h2>
            <div class="stats-info">
                <span class="stats-text">
                    <i class="fas fa-film"></i> Всего: <span class="stats-highlight">${currentWeeklyResults.length} аниме</span>
                    | Показано: <span class="stats-highlight">${displayedWeekly.length}</span>
                </span>
            </div>
            <div class="results-grid" id="weeklyGrid">
                ${cards.join('')}
            </div>`;

        // Добавляем кнопку "Показать еще" если есть еще элементы
        if (currentDisplayCount.weekly < currentWeeklyResults.length) {
            html += createLoadMoreButton(
                `Показать еще новинки (${currentWeeklyResults.length - currentDisplayCount.weekly})`,
                'loadMoreWeekly()',
                'loadMoreWeeklyBtn'
            );
        }

        html += `</section>`;
        
        return html;
    } catch (e) {
        console.error("Weekly data loading error:", e);
        return '';
    }
}

window.loadMoreWeekly = async function() {
    const btn = document.getElementById('loadMoreWeeklyBtn');
    const grid = document.getElementById('weeklyGrid');
    
    if (!btn || !grid) return;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
    btn.disabled = true;

    try {
        currentDisplayCount.weekly += ITEMS_PER_PAGE.weekly;
        const newWeekly = currentWeeklyResults.slice(
            currentDisplayCount.weekly - ITEMS_PER_PAGE.weekly,
            currentDisplayCount.weekly
        );

        const newCards = await Promise.all(newWeekly.map(safeCreateAnimeCard));
        
        newCards.forEach(card => {
            grid.insertAdjacentHTML('beforeend', card);
        });

        // Обновляем статистику
        const statsInfo = document.querySelector('.weekly-section .stats-info');
        if (statsInfo) {
            statsInfo.innerHTML = `
                <span class="stats-text">
                    <i class="fas fa-film"></i> Всего: <span class="stats-highlight">${currentWeeklyResults.length} аниме</span>
                    | Показано: <span class="stats-highlight">${Math.min(currentDisplayCount.weekly, currentWeeklyResults.length)}</span>
                </span>
            `;
        }

        // Обновляем или удаляем кнопку
        if (currentDisplayCount.weekly >= currentWeeklyResults.length) {
            btn.remove();
        } else {
            btn.innerHTML = `<i class="fas fa-arrow-down"></i> Показать еще новинки (${currentWeeklyResults.length - currentDisplayCount.weekly})`;
            btn.disabled = false;
        }

        await refreshAllFavoriteButtons();

    } catch (error) {
        console.error('Error loading more weekly:', error);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка загрузки';
        setTimeout(() => {
            btn.innerHTML = `<i class="fas fa-arrow-down"></i> Показать еще новинки (${currentWeeklyResults.length - currentDisplayCount.weekly + ITEMS_PER_PAGE.weekly})`;
            btn.disabled = false;
        }, 2000);
    }
}

async function search() {
    const input = $("searchInput"),
        q = input?.value.trim() || "",
        box = $("resultsBox");
    
    if (!box) return;
    
    if (!q) {
        renderWeekly();
        return;
    }

    box.innerHTML = '<div class="loading-container"><div class="loading"></div><p class="loading-text">Поиск аниме...</p></div>';
    
    // Добавляем в историю без блокировки основного потока
    addHistory(q).catch(console.error);

    try {
        const data = await apiSearch(q);
        const seen = new Set();
        currentSearchResults = (data.results || []).filter(i => {
            const k = i.title.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });

        currentSearchQuery = q;

        if (!currentSearchResults.length) {
            await renderNoResults(q);
            return;
        }

        await renderSearchResults(q, currentSearchResults, data);
        
        const slug = toSlug(q);
        history.replaceState(null, null, `/search/${slug}`);
        if (input) input.value = "";
        updateSEOMeta(data);
        
    } catch (e) {
        box.innerHTML = `<div class="no-results fade-in">
            <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
            <h2>Ошибка загрузки</h2>
            <p>Попробуйте повторить поиск позже</p>
            <p style="color:var(--gray);font-size:.9rem">${e.message}</p>
        </div>`;
    }
}

async function renderSearchResults(query, results, data) {
    const box = $("resultsBox");
    
    currentDisplayCount.search = ITEMS_PER_PAGE.search;
    const displayedResults = results.slice(0, currentDisplayCount.search);
    const cards = await Promise.all(displayedResults.map(safeCreateAnimeCard));
    
    let html = `<section class="search-results-section">
        <div class="search-header">
            <h2 class="section-title fade-in"><i class="fas fa-search"></i> Результаты поиска: «${escapeHtml(query)}»</h2>
            <div class="stats-info">
                <span class="stats-text">
                    <i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${results.length} аниме</span> по запросу «${escapeHtml(query)}»
                    | Показано: <span class="stats-highlight">${displayedResults.length}</span>
                </span>
            </div>
        </div>
        <div class="results-grid" id="searchGrid">
            ${cards.join('')}
        </div>`;

    // Добавляем кнопку "Показать еще" если есть еще элементы
    if (currentDisplayCount.search < results.length) {
        html += createLoadMoreButton(
            `Показать еще результаты (${results.length - currentDisplayCount.search})`,
            'loadMoreSearchResults()',
            'loadMoreSearchBtn'
        );
    }

    html += `</section>`;
    
    box.innerHTML = html;
}

window.loadMoreSearchResults = async function() {
    const btn = document.getElementById('loadMoreSearchBtn');
    const grid = document.getElementById('searchGrid');
    
    if (!btn || !grid) return;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Загрузка...';
    btn.disabled = true;

    try {
        currentDisplayCount.search += ITEMS_PER_PAGE.search;
        const newResults = currentSearchResults.slice(
            currentDisplayCount.search - ITEMS_PER_PAGE.search,
            currentDisplayCount.search
        );

        const newCards = await Promise.all(newResults.map(safeCreateAnimeCard));
        
        newCards.forEach(card => {
            grid.insertAdjacentHTML('beforeend', card);
        });

        // Обновляем статистику
        const statsInfo = document.querySelector('.search-results-section .stats-info');
        if (statsInfo) {
            statsInfo.innerHTML = `
                <span class="stats-text">
                    <i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${currentSearchResults.length} аниме</span> по запросу «${escapeHtml(currentSearchQuery)}»
                    | Показано: <span class="stats-highlight">${Math.min(currentDisplayCount.search, currentSearchResults.length)}</span>
                </span>
            `;
        }

        // Обновляем или удаляем кнопку
        if (currentDisplayCount.search >= currentSearchResults.length) {
            btn.remove();
        } else {
            btn.innerHTML = `<i class="fas fa-arrow-down"></i> Показать еще результаты (${currentSearchResults.length - currentDisplayCount.search})`;
            btn.disabled = false;
        }

        await refreshAllFavoriteButtons();

    } catch (error) {
        console.error('Error loading more search results:', error);
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Ошибка загрузки';
        setTimeout(() => {
            btn.innerHTML = `<i class="fas fa-arrow-down"></i> Показать еще результаты (${currentSearchResults.length - currentDisplayCount.search + ITEMS_PER_PAGE.search})`;
            btn.disabled = false;
        }, 2000);
    }
}

async function renderNoResults(query) {
    const box = $("resultsBox");
    
    let html = `<div class="no-results fade-in">
        <i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
        <h2>По запросу «${escapeHtml(query)}» ничего не найдено</h2>
        <p>Попробуйте изменить запрос:</p>
        <ul>
            <li><i class="fas fa-spell-check"></i> Проверить правильность написания</li>
            <li><i class="fas fa-language"></i> Использовать английское название</li>
            <li><i class="fas fa-filter"></i> Искать по жанру или году</li>
            <li><i class="fas fa-simplify"></i> Упростить запрос</li>
        </ul>
    </div>`;

    // Добавляем историю поиска через некоторое время
    setTimeout(async () => {
        try {
            const hist = await dbGetAll(STORE_SEARCH_HISTORY, "timestamp");
            const list = hist.sort((a, b) => b.t - a.t).slice(0, 10);
            if (list.length) {
                let historyHTML = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
                list.forEach(
                    (i) =>
                        (historyHTML += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g, "\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event,${i.id})"><i class="fas fa-times"></i></span></button>`)
                );
                historyHTML += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
                box.innerHTML += '<div class="content-separator"></div>' + historyHTML;
            }
        } catch {}
    }, 100);

    box.innerHTML = html;
}

/* ---------- HEADER ---------- */
function updateHeader() {
    const h = document.querySelector(".top");
    if (!h) return;

    const isFavoritesPage = location.search.includes("page=favorites");
    const isSearchPage = !isFavoritesPage;

    h.innerHTML = `
    <a class="logo-link" href="/" onclick="navigateToHome(event)">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 265 275" fill="none">
            <rect width="40.4804" height="283.038" rx="15" transform="matrix(0.906596 -0.421999 0.423238 0.906018 103.258 17.0827)" fill="url(#paint0_linear_2_15)"/>
            <foreignObject x="-94.4697" y="2.52924" width="453.939" height="366.952"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(50px);clip-path:url(#bgblur_0_2_15_clip_path);height:100%;width:100%"></div></foreignObject>
            <rect data-figma-bg-blur-radius="100" width="40.4396" height="283.324" rx="15" transform="matrix(-0.506493 -0.862244 -0.863032 0.505149 265 131.879)" fill="url(#paint1_linear_2_15)"/>
            <rect width="40.4804" height="283.038" rx="15" transform="matrix(-0.906596 -0.421999 -0.423238 0.906018 156.62 17.5398)" fill="url(#paint2_linear_2_15)"/>
            <defs>
                <clipPath id="bgblur_0_2_15_clip_path" transform="translate(94.4697 -2.52924)"><rect width="40.4396" height="283.324" rx="15" transform="matrix(-0.506493 -0.862244 -0.863032 0.505149 265 131.879)"/></clipPath>
                <linearGradient id="paint0_linear_2_15" x1="20.2402" y1="3.11131e-08" x2="27.5397" y2="495.888" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0.7"/></linearGradient>
                <linearGradient id="paint1_linear_2_15" x1="25.1242" y1="411.958" x2="33.2642" y2="-4.77633" gradientUnits="userSpaceOnUse"><stop stop-color="#22083F" stop-opacity="0.7"/><stop offset="1" stop-color="#6C16C9"/></linearGradient>
                <linearGradient id="paint2_linear_2_15" x1="20.2402" y1="0" x2="20.2402" y2="283.038" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient>
            </defs>
        </svg>
        <span class="logo-text">AniFox</span>
    </a>
    <nav class="header-nav">
        <button class="nav-btn ${isSearchPage ? "active" : ""}" onclick="navigateToHome()">
            <i class="fas fa-search"></i> Поиск
        </button>
        <button class="nav-btn ${isFavoritesPage ? "active" : ""}" onclick="navigateToFavorites()">
            <i class="fas fa-heart"></i> Избранное
        </button>
    </nav>`;
}

window.navigateToHome = (e) => {
    if (e) e.preventDefault();
    history.replaceState(null, null, "/");
    updateHeader();
    renderWeekly();
    
    // ОБНОВЛЕНО: Добавлено обновление SEO мета-тегов для главной страницы
    updateSEOMetaForHome();
};

window.navigateToFavorites = () => {
    const url = location.search
        ? `${location.pathname}${location.search}${location.search.includes("?") ? "&" : "?"}page=favorites`
        : `${location.pathname}?page=favorites`;
    history.replaceState(null, null, url);
    updateHeader();
    renderFavoritesPage();
    
    // ОБНОВЛЕНО: Добавлено обновление SEO мета-тегов для страницы избранного
    updateSEOMetaForFavorites();
};

// ДОБАВЛЕНО: Функция для обновления SEO на главной странице
function updateSEOMetaForHome() {
    // Очищаем старые динамические мета-теги
    document.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
    
    const title = "AniFox — смотреть аниме онлайн в HD";
    const desc = "Большая база аниме: тысячи сериалов и фильмов в HD. Без регистрации, адаптировано под телефон и Smart-TV.";
    const currentUrl = location.origin + "/";
    
    // Обновляем мета-теги
    document.title = title;
    updateMetaTag('name', 'description', desc);
    updateMetaTag('name', 'keywords', 'аниме, смотреть аниме онлайн, аниме бесплатно, HD, русская озвучка');
    
    // Open Graph
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', desc);
    updateMetaTag('property', 'og:image', '/resources/obl_web.jpg');
    updateMetaTag('property', 'og:url', currentUrl);
    updateMetaTag('property', 'og:type', 'website');
    
    // Twitter
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', desc);
    updateMetaTag('name', 'twitter:image', '/resources/obl_web.jpg');
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('property', 'twitter:domain', 'anifox-search.vercel.app');
    updateMetaTag('property', 'twitter:url', currentUrl);
    
    // Каноническая ссылка
    updateCanonicalLink(currentUrl);
    
    // Микроразметка для главной страницы
    addHomeStructuredData();
}

// ДОБАВЛЕНО: Функция для обновления SEO на странице избранного
function updateSEOMetaForFavorites() {
    // Очищаем старые динамические мета-теги
    document.querySelectorAll('[data-dynamic]').forEach(el => el.remove());
    
    const title = "Избранное — AniFox";
    const desc = "Ваша коллекция избранных аниме на AniFox. Сохраняйте любимые сериалы и следите за новыми сериями.";
    const currentUrl = location.origin + location.pathname + "?page=favorites";
    
    // Обновляем мета-теги
    document.title = title;
    updateMetaTag('name', 'description', desc);
    updateMetaTag('name', 'keywords', 'избранное аниме, моя коллекция, сохраненные аниме, список просмотра');
    
    // Open Graph
    updateMetaTag('property', 'og:title', title);
    updateMetaTag('property', 'og:description', desc);
    updateMetaTag('property', 'og:image', '/resources/obl_web.jpg');
    updateMetaTag('property', 'og:url', currentUrl);
    updateMetaTag('property', 'og:type', 'website');
    
    // Twitter
    updateMetaTag('name', 'twitter:title', title);
    updateMetaTag('name', 'twitter:description', desc);
    updateMetaTag('name', 'twitter:image', '/resources/obl_web.jpg');
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('property', 'twitter:domain', 'anifox-search.vercel.app');
    updateMetaTag('property', 'twitter:url', currentUrl);
    
    // Каноническая ссылка
    updateCanonicalLink(currentUrl);
    
    // Микроразметка для страницы избранного
    addFavoritesStructuredData();
}

// ДОБАВЛЕНО: Функция для обновления канонической ссылки
function updateCanonicalLink(url) {
    let linkCanon = document.head.querySelector('link[rel="canonical"]');
    if (!linkCanon) {
        linkCanon = document.createElement("link");
        linkCanon.rel = "canonical";
        linkCanon.setAttribute("data-dynamic", "");
        document.head.appendChild(linkCanon);
    }
    linkCanon.href = url;
}

// ДОБАВЛЕНО: Микроразметка для главной страницы
function addHomeStructuredData() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "AniFox",
        "description": "Смотреть аниме онлайн в HD качестве бесплатно",
        "url": location.origin,
        "potentialAction": {
            "@type": "SearchAction",
            "target": `${location.origin}/search?q={search_term_string}`,
            "query-input": "required name=search_term_string"
        },
        "publisher": {
            "@type": "Organization",
            "name": "AniFox",
            "logo": {
                "@type": "ImageObject",
                "url": `${location.origin}/resources/logo.png`
            }
        }
    };
    
    const scr = document.createElement("script");
    scr.type = "application/ld+json";
    scr.textContent = JSON.stringify(jsonLd);
    scr.setAttribute("data-dynamic", "");
    document.head.appendChild(scr);
}

// ДОБАВЛЕНО: Микроразметка для страницы избранного
function addFavoritesStructuredData() {
    const jsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Избранные аниме",
        "description": "Коллекция избранных аниме пользователя",
        "url": location.href,
        "isPartOf": {
            "@type": "WebSite",
            "name": "AniFox",
            "url": location.origin
        }
    };
    
    const scr = document.createElement("script");
    scr.type = "application/ld+json";
    scr.textContent = JSON.stringify(jsonLd);
    scr.setAttribute("data-dynamic", "");
    document.head.appendChild(scr);
}

// ДОБАВЛЕНО: Функция для обновления мета-тегов (если еще не добавлена)
function updateMetaTag(attr, name, content) {
    let metaTag;
    
    if (attr === 'property') {
        metaTag = document.querySelector(`meta[property="${name}"]`);
    } else {
        metaTag = document.querySelector(`meta[name="${name}"]`);
    }
    
    if (!metaTag) {
        metaTag = document.createElement('meta');
        if (attr === 'property') {
            metaTag.setAttribute('property', name);
        } else {
            metaTag.setAttribute('name', name);
        }
        metaTag.setAttribute('data-dynamic', '');
        document.head.appendChild(metaTag);
    }
    
    metaTag.setAttribute('content', content);
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
    document.body.insertAdjacentHTML("afterbegin", 
        '<div id="mainPreloader" class="preloader-overlay"><div class="preloader-content"><div class="preloader-spinner"></div><p class="preloader-text">Загрузка AniFox...</p></div></div>'
    );

    try {
        await loadFontAwesome();
        cacheManager.startCleanupInterval();
        await initDB();
        updateHeader();

        const form = $("searchForm"),
            input = $("searchInput"),
            btn = $("scrollToTop");

        if (form) {
            form.addEventListener("submit", (e) => {
                e.preventDefault();
                search();
            });
        }

        if (input) {
            const path = location.pathname;

            if (path.startsWith("/search/")) {
                const slug = path.replace("/search/", "");
                input.value = slug.replace(/-/g, " ");
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
        console.error("Initialization error:", e);
        showNote("Ошибка загрузки приложения", "error");
    } finally {
        const p = document.getElementById("mainPreloader");
        if (p) {
            p.style.opacity = '0';
            setTimeout(() => p.remove(), 300);
        }
        setTimeout(lazyLoadImages, 1000);
    }
});

/* ---------- MEMORY MANAGEMENT ---------- */
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        fetchCache.clear();
    }
});

setInterval(() => {
    if (fetchCache.size > 100) {
        const keys = Array.from(fetchCache.keys()).slice(0, 50);
        keys.forEach(key => fetchCache.delete(key));
    }
}, 60000);

console.log(`🚀 AniFox ${CACHE_VERSION} loaded with button-based loading system`);