/* =========================================================
   AniFox 2.4 (optimized)
   Улучшения: кнопки загрузки вместо прогрессивной загрузки + исправление JSON ошибок
   
   💻 Разработано SerGio Play
   🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
   📁 GitHub: https://github.com/SerGioPlay01/anifox-search
   
   При использовании данного проекта обязательно указывайте ссылку на разработчика.
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

// Оптимизированная ленивая загрузка изображений с исправлениями для мобильных
function lazyLoadImages() {
    const images = document.querySelectorAll('img[data-src], img:not([src]), img[src=""], img[src*="undefined"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // Добавляем обработчик ошибок перед загрузкой
                    img.onerror = function() {
                        console.log('Failed to load image:', this.dataset.src || this.src);
                        // Создаем placeholder вместо битого изображения
                        this.style.background = 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)';
                        this.style.display = 'flex';
                        this.style.alignItems = 'center';
                        this.style.justifyContent = 'center';
                        this.style.color = 'white';
                        this.style.fontSize = '2rem';
                        this.style.position = 'relative';
                        this.innerHTML = '<span style="z-index: 1;">📺</span>';
                        this.onerror = null;
                    };
                    
                    // Загружаем изображение
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    } else if (!img.src || img.src === '' || img.src.includes('undefined')) {
                        // Если нет src, создаем placeholder
                        img.style.background = 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)';
                        img.style.display = 'flex';
                        img.style.alignItems = 'center';
                        img.style.justifyContent = 'center';
                        img.style.color = 'white';
                        img.style.fontSize = '2rem';
                        img.style.position = 'relative';
                        img.innerHTML = '<span style="z-index: 1;">📺</span>';
                    }
                    
                    img.classList.remove('lazy');
                    img.classList.add('loaded');
                    
                    imageObserver.unobserve(img);
                }
            });
        }, {
            // Увеличиваем область предзагрузки для мобильных
            rootMargin: window.innerWidth <= 768 ? '300px 0px' : '100px 0px',
            threshold: 0.01
        });

        images.forEach(img => {
            // Добавляем класс для стилизации загружающихся изображений
            img.classList.add('lazy');
            imageObserver.observe(img);
        });
    } else {
        // Fallback для старых браузеров
        images.forEach(img => {
            img.onerror = function() {
                this.style.background = 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)';
                this.style.display = 'flex';
                this.style.alignItems = 'center';
                this.style.justifyContent = 'center';
                this.style.color = 'white';
                this.style.fontSize = '2rem';
                this.style.position = 'relative';
                this.innerHTML = '<span style="z-index: 1;">📺</span>';
                this.onerror = null;
            };
            
            if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            }
            img.classList.add('loaded');
        });
    }
}

// Оптимизированный скроллинг с throttling
let scrollTimeout = null;
let isScrolling = false;

function optimizeScrollPerformance() {
    const scrollToTopBtn = document.getElementById('scrollToTop');
    
    function handleScroll() {
        if (!isScrolling) {
            window.requestAnimationFrame(() => {
                if (scrollToTopBtn) {
                    scrollToTopBtn.classList.toggle("show", window.scrollY > 300);
                }
                isScrolling = false;
            });
            isScrolling = true;
        }
    }
    
    // Throttled scroll handler
    window.addEventListener('scroll', handleScroll, { passive: true });
}

// Виртуализация для больших списков
class VirtualScroller {
    constructor(container, itemHeight = 400, buffer = 5) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.buffer = buffer;
        this.items = [];
        this.visibleItems = new Map();
        this.scrollTop = 0;
        this.containerHeight = 0;
        
        this.init();
    }
    
    init() {
        this.container.style.position = 'relative';
        this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
        this.updateContainerHeight();
    }
    
    setItems(items) {
        this.items = items;
        this.updateVirtualHeight();
        this.render();
    }
    
    updateContainerHeight() {
        this.containerHeight = this.container.clientHeight;
    }
    
    updateVirtualHeight() {
        const totalHeight = this.items.length * this.itemHeight;
        let spacer = this.container.querySelector('.virtual-spacer');
        
        if (!spacer) {
            spacer = document.createElement('div');
            spacer.className = 'virtual-spacer';
            spacer.style.position = 'absolute';
            spacer.style.top = '0';
            spacer.style.left = '0';
            spacer.style.right = '0';
            spacer.style.pointerEvents = 'none';
            this.container.appendChild(spacer);
        }
        
        spacer.style.height = `${totalHeight}px`;
    }
    
    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        this.render();
    }
    
    render() {
        const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
        const endIndex = Math.min(
            this.items.length - 1,
            Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight) + this.buffer
        );
        
        // Удаляем элементы, которые больше не видны
        this.visibleItems.forEach((element, index) => {
            if (index < startIndex || index > endIndex) {
                element.remove();
                this.visibleItems.delete(index);
            }
        });
        
        // Добавляем новые видимые элементы
        for (let i = startIndex; i <= endIndex; i++) {
            if (!this.visibleItems.has(i) && this.items[i]) {
                const element = this.createItemElement(this.items[i], i);
                this.visibleItems.set(i, element);
                this.container.appendChild(element);
            }
        }
    }
    
    createItemElement(item, index) {
        const element = document.createElement('div');
        element.style.position = 'absolute';
        element.style.top = `${index * this.itemHeight}px`;
        element.style.left = '0';
        element.style.right = '0';
        element.style.height = `${this.itemHeight}px`;
        element.innerHTML = item;
        return element;
    }
}

// Оптимизация анимаций с requestAnimationFrame
function smoothTransition(element, property, from, to, duration = 300) {
    return new Promise(resolve => {
        const start = performance.now();
        const change = to - from;
        
        function animate(currentTime) {
            const elapsed = currentTime - start;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing function (ease-out)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const currentValue = from + (change * easeOut);
            
            element.style[property] = `${currentValue}px`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                resolve();
            }
        }
        
        requestAnimationFrame(animate);
    });
}

// Оптимизация DOM операций
function batchDOMUpdates(updates) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            updates.forEach(update => update());
            resolve();
        });
    });
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
        <i class="fas fa-arrow-down"></i> 
        <span class="btn-text">${text}</span>
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

// Безопасная пакетная функция создания карточек
async function safeCreateAnimeCards(animeList) {
    try {
        return await createAnimeCardsWithPosters(animeList);
    } catch (error) {
        console.error('Error in batch card creation, falling back to individual creation:', error);
        // Fallback к индивидуальному созданию карточек
        return Promise.all(animeList.map(safeCreateAnimeCard));
    }
}

function createFallbackCard(item) {
    // Создаем короткий ID для аниме
    const animeId = generateAnimeId(item.link);
    const detailUrl = `/anime-detail.html?a=${animeId}&t=${encodeURIComponent(item.title)}`;
    
    // ИСПРАВЛЕНО: Пытаемся использовать постер из Kodik API даже в fallback
    let posterUrl = '/resources/anime-placeholder.svg';
    if (item.material_data?.poster_url) {
        posterUrl = item.material_data.poster_url;
    } else if (item.screenshots && item.screenshots.length > 0) {
        posterUrl = item.screenshots[0];
    }
    
    return `
    <div class="anime-card fade-in" onclick="navigateToAnime('${animeId}', '${escapeHtml(item.title)}', '${item.link}')" style="cursor: pointer;">
        <div class="anime-poster">
            <img src="${posterUrl}" 
                 alt="Постер ${escapeHtml(item.title)}" 
                 loading="eager"
                 onerror="window.fixBrokenImage ? window.fixBrokenImage(this) : (this.onerror=null, this.src='/resources/anime-placeholder.svg');">
            <div class="anime-overlay">
                <div class="play-button">
                    <i class="fas fa-play"></i>
                </div>
            </div>
        </div>
        
        <div class="anime-info">
            <h3 class="anime-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</h3>
            
            <div class="anime-meta">
                <span class="anime-year">
                    <i class="fas fa-calendar"></i>
                    ${item.year || 'Неизвестно'}
                </span>
            </div>
        </div>

        <div class="anime-actions" onclick="event.stopPropagation();">
            <button class="action-btn favorite-btn" data-link="${item.link}" onclick="toggleFavorite('${escapeHtml(item.title).replace(/'/g, "\\'")}','${item.link}')" title="Добавить в избранное">
                <i class="far fa-heart"></i>
            </button>

            <button class="action-btn share-btn" onclick="shareAnime('${JSON.stringify(item).replace(/"/g, '&quot;')}')" title="Поделиться">
                <i class="fas fa-share"></i>
            </button>
        </div>
    </div>`;
}

// Батчинг запросов постеров для оптимизации
class PosterBatcher {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.batchSize = 3; // Обрабатываем по 3 постера одновременно
        this.batchDelay = 1000; // Задержка между батчами
    }

    async getPoster(title) {
        return new Promise((resolve) => {
            this.queue.push({ title, resolve });
            this.processBatch();
        });
    }

    async processBatch() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, this.batchSize);
            
            // Обрабатываем батч параллельно
            const promises = batch.map(async ({ title, resolve }) => {
                try {
                    const poster = await getShikimoriPoster(title);
                    resolve(poster);
                } catch (error) {
                    console.warn('Poster batch error:', error);
                    resolve(null);
                }
            });
            
            await Promise.all(promises);
            
            // Задержка между батчами
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.batchDelay));
            }
        }
        
        this.processing = false;
    }
}

const posterBatcher = new PosterBatcher();

// Rate limiting для Shikimori API
class ShikimoriRateLimiter {
    constructor() {
        this.requests = [];
        this.maxRequests = 5; // Максимум 5 запросов
        this.timeWindow = 60000; // За 60 секунд
        this.minDelay = 200; // Минимальная задержка между запросами
        this.lastRequestTime = 0;
    }

    async waitForSlot() {
        const now = Date.now();
        
        // Очищаем старые запросы
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        
        // Проверяем лимит
        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.timeWindow - (now - oldestRequest) + 100;
            console.log(`Shikimori rate limit: waiting ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return this.waitForSlot();
        }
        
        // Проверяем минимальную задержку
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minDelay) {
            const waitTime = this.minDelay - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        this.requests.push(Date.now());
        this.lastRequestTime = Date.now();
    }
}

const shikimoriLimiter = new ShikimoriRateLimiter();

// Пакетная загрузка постеров из Shikimori для улучшения производительности
async function batchLoadShikimoriPosters(animeList) {
    const BATCH_SIZE = 10; // Загружаем по 10 постеров одновременно
    const results = new Map();
    
    // Разбиваем список на батчи
    for (let i = 0; i < animeList.length; i += BATCH_SIZE) {
        const batch = animeList.slice(i, i + BATCH_SIZE);
        
        // Загружаем батч параллельно
        const batchPromises = batch.map(async (anime) => {
            try {
                const poster = await getShikimoriPoster(anime.title);
                return { title: anime.title, poster };
            } catch (error) {
                console.warn(`Ошибка загрузки постера для ${anime.title}:`, error);
                return { title: anime.title, poster: null };
            }
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Сохраняем результаты
        batchResults.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                results.set(result.value.title, result.value.poster);
            }
        });
        
        // Небольшая пауза между батчами для снижения нагрузки на API
        if (i + BATCH_SIZE < animeList.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    return results;
}

// Быстрое получение постера из Shikimori без полной загрузки данных
async function getShikimoriPoster(title) {
    const cacheKey = `poster_${title.toLowerCase().trim()}`;
    const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 дней для постеров

    try {
        // Проверяем кэш
        const cached = await dbGet(STORE_SHIKIMORI_CACHE, cacheKey);
        if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
            return cached.data;
        }
    } catch (e) {}

    try {
        // Ждем разрешения на запрос
        await shikimoriLimiter.waitForSlot();
        
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 8000);

        const searchUrl = `${SHIKIMORI_API_BASE}/animes?search=${encodeURIComponent(title)}&limit=1`;
        const response = await fetch(searchUrl, {
            signal: ctrl.signal,
            headers: {
                "User-Agent": "AniFox/2.4 (https://anifox-search.vercel.app)",
                Accept: "application/json",
            },
        });

        clearTimeout(timeout);

        if (response.status === 429) {
            console.warn('Shikimori rate limit exceeded, using fallback');
            return null;
        }

        if (!response.ok) {
            console.warn(`Shikimori API error: ${response.status}`);
            return null;
        }

        const data = await response.json();
        if (!data || data.length === 0) return null;

        const anime = data[0];
        const posterUrl = anime.image ? `https://shikimori.one${anime.image.x312 || anime.image.original}` : null;

        // Кэшируем результат
        try {
            await dbPut(STORE_SHIKIMORI_CACHE, {
                query: cacheKey,
                data: posterUrl,
                cachedAt: Date.now(),
            });
        } catch (e) {}

        return posterUrl;
    } catch (e) {
        console.warn('Shikimori poster request failed:', e.message);
        return null;
    }
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

// Проверка доступности изображения
async function isImageAccessible(url) {
    try {
        // Для локальных изображений всегда возвращаем true
        if (url.startsWith('/') || url.startsWith('./')) {
            return true;
        }
        
        // Для Kodik изображений всегда возвращаем true - они надежные
        if (url.includes('kodikapi.com') || url.includes('kodik-storage') || url.includes('kodik.cc')) {
            return true;
        }
        
        // Проверяем известные проблемные домены
        const problematicDomains = [
            'st.kp.yandex.net',  // Кинопоиск блокирует внешние запросы
            'avatars.mds.yandex.net'
        ];
        
        for (const domain of problematicDomains) {
            if (url.includes(domain)) {
                return false; // Сразу используем плейсхолдер для проблемных доменов
            }
        }
        
        // Для остальных доменов возвращаем true
        // Браузер сам обработает CORS ошибки через onerror
        return true;
        
    } catch (error) {
        return false;
    }
}

// Оптимизация URL изображений для лучшей производительности
function optimizeImageUrl(url, width = 312) {
    if (!url || url.startsWith('/')) return url;
    
    // Обеспечиваем HTTPS
    url = url.replace('http://', 'https://');
    
    // Оптимизация для Shikimori
    if (url.includes('shikimori.one')) {
        return url.replace('/original/', `/x${width}/`);
    }
    
    // Для Kodik изображений оставляем как есть - они уже оптимизированы
    if (url.includes('kodikapi.com') || url.includes('kodik-storage') || url.includes('kodik.cc')) {
        return url;
    }
    
    return url;
}

// Глобальная функция для обработки ошибок изображений
function handleImageError(img) {
    if (img.src !== '/resources/anime-placeholder.svg') {
        console.log('Image failed to load, using placeholder:', img.src);
        img.src = '/resources/anime-placeholder.svg';
        img.onerror = null; // Предотвращаем бесконечный цикл
    }
}

// Инициализация обработчиков изображений для существующих элементов
function initImageHandlers() {
    document.querySelectorAll('img[src*="shikimori.one"], img[src*="kp.yandex.net"]').forEach(img => {
        if (!img.onerror) {
            img.onerror = () => handleImageError(img);
        }
    });
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

    try {
        // Ждем разрешения на запрос
        await shikimoriLimiter.waitForSlot();
        
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 8000);

        const searchUrl = `${SHIKIMORI_API_BASE}/animes?search=${encodeURIComponent(title)}&limit=1`;
        const response = await fetch(searchUrl, {
            signal: ctrl.signal,
            headers: {
                "User-Agent": "AniFox/2.4 (https://anifox-search.vercel.app)",
                Accept: "application/json",
            },
        });

        clearTimeout(timeout);

        if (response.status === 429) {
            console.warn('Shikimori rate limit exceeded for:', title);
            if (attempt < 2) {
                await new Promise(r => setTimeout(r, 5000)); // Ждем 5 секунд
                return fetchShikimoriInfo(title, attempt + 1);
            }
            return getFallbackShikimoriData(title);
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!data || data.length === 0) return getFallbackShikimoriData(title);

        const anime = data[0];
        let detailedInfo = null;
        
        try {
            // Ждем еще один слот для детальной информации
            await shikimoriLimiter.waitForSlot();
            
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
            poster_url: finalInfo.image ? `https://shikimori.one${finalInfo.image.x312 || finalInfo.image.original}` : null,
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
    
    const url = `${BASE.replace("/search", "/list")}?token=${TOKEN}&year=2026&updated_at=1&types=anime,anime-serial&with_material_data=true`;
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

// Функция для копирования текста в буфер обмена
async function copyToClipboard(text) {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Fallback для старых браузеров
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            textArea.style.opacity = '0';
            textArea.style.pointerEvents = 'none';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            // Пытаемся скопировать
            let result = false;
            try {
                result = document.execCommand('copy');
            } catch (execError) {
                console.warn('execCommand copy failed:', execError);
            }
            
            document.body.removeChild(textArea);
            return result;
        }
    } catch (error) {
        console.error('Ошибка при копировании в буфер обмена:', error);
        return false;
    }
}

function showNote(msg, type = "info", copyText = null, persistent = false) {
    // Если не постоянное уведомление, удаляем существующие
    if (!persistent) {
        document.querySelectorAll('.notification:not(.persistent)').forEach(n => n.remove());
    }
    
    const n = document.createElement("div");
    n.className = `notification notification-${type}${persistent ? ' persistent' : ''}`;
    
    // Создаем иконку
    const icon = document.createElement("i");
    icon.className = `fas fa-${type === "success" ? "check" : type === "error" ? "exclamation-triangle" : type === "warning" ? "exclamation" : "info"}`;
    
    // Создаем текст сообщения
    const messageSpan = document.createElement("span");
    messageSpan.textContent = msg;
    
    // Создаем кнопку копирования, если нужно
    let copyButton = null;
    if (copyText) {
        copyButton = document.createElement("button");
        copyButton.className = "notification-copy-btn";
        copyButton.title = "Копировать код защиты";
        copyButton.innerHTML = '<i class="fas fa-copy"></i>';
        copyButton.addEventListener('click', async () => {
            const success = await copyToClipboard(copyText);
            if (success) {
                copyButton.innerHTML = '<i class="fas fa-check"></i>';
                copyButton.classList.add('copied');
                setTimeout(() => {
                    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    copyButton.classList.remove('copied');
                }, 2000);
            } else {
                copyButton.innerHTML = '<i class="fas fa-times"></i>';
                copyButton.classList.add('copy-failed');
                setTimeout(() => {
                    copyButton.innerHTML = '<i class="fas fa-copy"></i>';
                    copyButton.classList.remove('copy-failed');
                }, 2000);
            }
        });
    }
    
    // Создаем кнопку закрытия
    const closeButton = document.createElement("button");
    closeButton.className = "notification-close-btn";
    closeButton.innerHTML = '<i class="fas fa-times"></i>';
    closeButton.addEventListener('click', () => {
        n.style.opacity = '0';
        n.style.transform = 'translateX(100%)';
        setTimeout(() => n.remove(), 300);
    });
    
    // Добавляем все элементы
    n.appendChild(icon);
    n.appendChild(messageSpan);
    if (copyButton) {
        n.appendChild(copyButton);
    }
    n.appendChild(closeButton);
    
    document.body.appendChild(n);
    
    // Анимация появления
    setTimeout(() => {
        n.style.opacity = '1';
        n.style.transform = 'translateX(0)';
    }, 10);
    
    // Автоматическое удаление для непостоянных уведомлений
    if (!persistent) {
        const timeout = copyText ? 8000 : 5000; // Больше времени для уведомлений с кнопкой копирования
        setTimeout(() => {
            if (n.parentNode) {
                n.style.opacity = '0';
                n.style.transform = 'translateX(100%)';
                setTimeout(() => n.remove(), 300);
            }
        }, timeout);
    }
    
    return n; // Возвращаем элемент для возможности управления им
}

// Функция для скрытия конкретного уведомления
function hideNote(noteElement) {
    if (noteElement && noteElement.parentNode) {
        noteElement.style.opacity = '0';
        noteElement.style.transform = 'translateX(100%)';
        setTimeout(() => noteElement.remove(), 300);
    }
}

/* ---------- URL OPTIMIZATION ---------- */
// Создание красивого slug для аниме
function createAnimeSlug(title) {
    return title
        .toLowerCase()
        .replace(/[«»"']/g, '') // Убираем кавычки
        .replace(/[^\w\s-]/g, '') // Убираем специальные символы кроме букв, цифр, пробелов и дефисов
        .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
        .replace(/-+/g, '-') // Убираем множественные дефисы
        .replace(/^-|-$/g, '') // Убираем дефисы в начале и конце
        .substring(0, 100); // Ограничиваем длину
}

// Навигация к странице аниме с красивым URL
window.navigateToAnime = function(title, link) {
    const slug = createAnimeSlug(title);
    const url = `/anime/${slug}`;
    
    // Сохраняем данные аниме в sessionStorage для быстрого доступа
    const animeData = {
        title: title,
        link: link,
        timestamp: Date.now()
    };
    
    try {
        sessionStorage.setItem(`anime_${slug}`, JSON.stringify(animeData));
    } catch (e) {
        console.warn('SessionStorage недоступен:', e);
    }
    
    // Переходим на страницу
    window.location.href = url;
};

// Получение данных аниме из slug
function getAnimeFromSlug(slug) {
    try {
        const data = sessionStorage.getItem(`anime_${slug}`);
        if (data) {
            const animeData = JSON.parse(data);
            // Проверяем, что данные не старше 1 часа
            if (Date.now() - animeData.timestamp < 3600000) {
                return animeData;
            }
        }
    } catch (e) {
        console.warn('Ошибка получения данных из sessionStorage:', e);
    }
    return null;
}

// Улучшенная функция для создания slug (более универсальная)
function toSlug(str) {
    const map = {
        а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
        А: "A", Б: "B", В: "V", Г: "G", Д: "D", Е: "E", Ё: "E", Ж: "ZH", З: "Z", И: "I", Й: "Y", К: "K", Л: "L", М: "M", Н: "N", О: "O", П: "P", Р: "R", С: "S", Т: "T", У: "U", Ф: "F", Х: "H", Ц: "C", Ч: "CH", Ш: "SH", Щ: "SCH", Ъ: "", Ы: "Y", Ь: "", Э: "E", Ю: "YU", Я: "YA",
        " ": "-", _: "-", "«": "", "»": "", '"': "", "'": "", "!": "", "?": "", ".": "", ",": "", ":": "", ";": "", "(": "", ")": "", "[": "", "]": "", "{": "", "}": ""
    };
    
    return str
        .split("")
        .map((ch) => map[ch] || ch)
        .join("")
        .toLowerCase()
        .replace(/[^a-z0-9\-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 100);
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
    
    const top = results[0];
    let title, desc, kw, ogTitle, ogDesc, ogImage, ogImageWidth, ogImageHeight;
    
    if (top) {
        const { title: t, year, genres = "", material_data } = top;
        const clean = t.replace(/\[.*?\]/g, "").trim();
        title = `Смотреть аниме «${clean}» (${year}) онлайн бесплатно в HD — AniFox`;
        desc = `Смотреть аниме «${clean}» (${year}) онлайн бесплатно в HD качестве на AniFox. Русская озвучка, субтитры, без регистрации. Жанры: ${genres}. Смотри новые серии первым!`;
        kw = buildKeywords(clean, genres, year);
        ogTitle = `«${clean}» — смотреть онлайн`;
        ogDesc = desc;
        ogImage = material_data?.poster_url || "/resources/obl_web.jpg";
        ogImageWidth = "1200";
        ogImageHeight = "630";
    } else {
        title = `Поиск «${query}» — AniFox`;
        desc = `По запросу «${query}» ничего не найдено, но вы можете посмотреть другие аниме на AniFox.`;
        kw = `аниме, ${query}, смотреть онлайн`;
        ogTitle = title;
        ogDesc = desc;
        ogImage = "/resources/obl_web.jpg";
        ogImageWidth = "1200";
        ogImageHeight = "630";
    }
    
    // ОБНОВЛЕНО: Используем текущий URL для поиска
    const cleanCanonical = location.origin + location.pathname;
    const currentUrl = location.origin + location.pathname;

    // Установка всех мета-тегов
    document.title = title;
    
    // Обновляем или создаем мета-теги
    updateMetaTag('name', 'description', desc);
    updateMetaTag('name', 'keywords', kw);
    
    // Open Graph - расширенные теги
    updateMetaTag('property', 'og:title', ogTitle);
    updateMetaTag('property', 'og:description', ogDesc);
    updateMetaTag('property', 'og:image', ogImage);
    updateMetaTag('property', 'og:image:width', ogImageWidth);
    updateMetaTag('property', 'og:image:height', ogImageHeight);
    updateMetaTag('property', 'og:image:alt', top ? `Постер аниме «${top.title.replace(/\[.*?\]/g, "").trim()}»` : 'AniFox - смотреть аниме онлайн');
    updateMetaTag('property', 'og:url', currentUrl);
    updateMetaTag('property', 'og:type', 'website');
    updateMetaTag('property', 'og:site_name', 'AniFox');
    updateMetaTag('property', 'og:locale', 'ru_RU');
    
    // Twitter Cards - улучшенные теги
    updateMetaTag('name', 'twitter:card', 'summary_large_image');
    updateMetaTag('name', 'twitter:title', ogTitle);
    updateMetaTag('name', 'twitter:description', ogDesc);
    updateMetaTag('name', 'twitter:image', ogImage);
    updateMetaTag('name', 'twitter:image:alt', top ? `Постер аниме «${top.title.replace(/\[.*?\]/g, "").trim()}»` : 'AniFox - смотреть аниме онлайн');
    updateMetaTag('name', 'twitter:site', '@anifoxru');
    updateMetaTag('name', 'twitter:creator', '@anifoxru');
    
    // Дополнительные SEO теги
    updateMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMetaTag('name', 'googlebot', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    updateMetaTag('name', 'author', 'AniFox');
    updateMetaTag('name', 'publisher', 'AniFox');
    updateMetaTag('name', 'copyright', 'AniFox');
    updateMetaTag('name', 'language', 'ru');
    updateMetaTag('name', 'geo.region', 'RU');
    updateMetaTag('name', 'geo.placename', 'Russia');
    
    // Каноническая ссылка
    updateCanonicalLink(cleanCanonical);
    
    // Микроразметка
    addStructuredData(query, results, cleanCanonical);
    
    // Обновляем URL в истории браузера для лучшего SEO
    if (history.state !== query) {
        history.replaceState({ query: query, results: results.length }, '', currentUrl);
    }
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
        'смотреть аниме',
        'аниме онлайн',
        'смотреть аниме онлайн',
        'аниме бесплатно',
        'аниме HD',
        'аниме 2025',
        'аниме с русской озвучкой',
        'аниме с субтитрами',
        'популярное аниме',
        'новое аниме',
        'аниме стриминг',
        'AniFox'
    ];
    
    const titleKeywords = title
        .toLowerCase()
        .split(' ')
        .filter(word => word.length > 2);
    
    const genreKeywords = genres 
        ? genres.split(',').map(g => g.trim().toLowerCase())
        : [];
    
    const popularQueries = [
        `${title} смотреть онлайн`,
        `смотреть ${title} онлайн`,
        `${title} бесплатно`,
        `${title} HD`,
        `${title} русская озвучка`,
        `${title} субтитры`,
        `аниме ${title}`,
        `${title} аниме`,
        `смотреть ${title} бесплатно`,
        `${title} бесплатно онлайн`
    ];
    
    return [...new Set([
        ...titleKeywords,
        ...genreKeywords,
        ...baseKeywords,
        ...popularQueries,
        `аниме ${year}`,
        `${title} смотреть онлайн`
    ])].slice(0, 25).join(', ');
}

// ДОБАВЛЕНО: Функция для микроразметки результатов поиска
function addStructuredData(query, results, canonical) {
    // Основная разметка сайта
    const websiteJsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "AniFox",
        "url": location.origin,
        "description": "Бесплатная платформа для просмотра аниме онлайн в HD качестве",
        "inLanguage": "ru",
        "potentialAction": {
            "@type": "SearchAction",
            "target": `${location.origin}/?q={search_term_string}`,
            "query-input": "required name=search_term_string"
        }
    };
    
    // Разметка страницы результатов поиска
    const searchResultsJsonLd = {
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
                    "image": item.material_data?.poster_url || "/resources/obl_web.jpg",
                    "url": `${location.origin}/?q=${encodeURIComponent(item.title)}`,
                    "description": `Смотреть аниме «${item.title}» (${item.year}) онлайн бесплатно в HD качестве с русской озвучкой и субтитрами`,
                    "inLanguage": "ru",
                    "contentRating": "PG-13",
                    "aggregateRating": {
                        "@type": "AggregateRating",
                        "ratingValue": "4.5",
                        "ratingCount": "1000"
                    }
                }
            }))
        }
    };
    
    // Добавляем разметку сайта
    const websiteScript = document.createElement("script");
    websiteScript.type = "application/ld+json";
    websiteScript.textContent = JSON.stringify(websiteJsonLd);
    websiteScript.setAttribute("data-dynamic", "");
    document.head.appendChild(websiteScript);
    
    // Добавляем разметку результатов поиска
    const searchScript = document.createElement("script");
    searchScript.type = "application/ld+json";
    searchScript.textContent = JSON.stringify(searchResultsJsonLd);
    searchScript.setAttribute("data-dynamic", "");
    document.head.appendChild(searchScript);
}

/* ---------- UTILS FOR CARDS ---------- */
// Функция для генерации короткого ID аниме
function generateAnimeId(link) {
    // Создаем короткий хеш из ссылки
    let hash = 0;
    for (let i = 0; i < link.length; i++) {
        const char = link.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Конвертируем в 32-битное число
    }
    // Конвертируем в base36 и берем первые 6 символов
    return Math.abs(hash).toString(36).substring(0, 6);
}

// Функция для навигации к аниме
window.navigateToAnime = function(animeId, title, link) {
    // Сохраняем данные аниме в sessionStorage для быстрого доступа
    const animeData = {
        id: animeId,
        title: title,
        link: link,
        timestamp: Date.now()
    };
    
    sessionStorage.setItem(`anime_${animeId}`, JSON.stringify(animeData));
    
    // Переходим на страницу деталей
    const detailUrl = `/anime-detail.html?a=${animeId}&t=${encodeURIComponent(title)}`;
    window.location.href = detailUrl;
};

// Функция для получения данных аниме по ID
function getAnimeDataById(animeId) {
    try {
        const data = sessionStorage.getItem(`anime_${animeId}`);
        if (data) {
            const animeData = JSON.parse(data);
            // Проверяем, что данные не старше 1 часа
            if (Date.now() - animeData.timestamp < 3600000) {
                return animeData;
            }
        }
    } catch (error) {
        console.warn('Error getting anime data from sessionStorage:', error);
    }
    return null;
}

/* ---------- CARD ---------- */
// Улучшенная функция создания карточек с пакетной загрузкой постеров
async function createAnimeCardsWithPosters(animeList) {
    // ОПТИМИЗИРОВАНО: Загружаем постеры из Shikimori только для аниме без постеров в Kodik
    const animeNeedingShikimoriPosters = animeList.filter(item => 
        !item.material_data?.poster_url && 
        (!item.screenshots || item.screenshots.length === 0)
    );
    
    const posterMap = animeNeedingShikimoriPosters.length > 0 
        ? await batchLoadShikimoriPosters(animeNeedingShikimoriPosters)
        : new Map();
    
    // Создаем карточки с оптимизированной загрузкой постеров
    const cardPromises = animeList.map(async (item) => {
        try {
            return await createAnimeCardWithPoster(item, posterMap.get(item.title));
        } catch (error) {
            console.error('Error creating anime card:', error);
            return createFallbackCard(item);
        }
    });
    
    return Promise.all(cardPromises);
}

// Создание карточки аниме с предзагруженным постером
async function createAnimeCardWithPoster(item, shikimoriPoster = null) {
    const t = item.title;
    const favs = await getFavorites();
    const isFav = favs.some(f => f.link === item.link);

    // Создаем короткий ID для аниме
    const animeId = generateAnimeId(item.link);
    
    // ИСПРАВЛЕНО: Определяем постер с приоритетом Kodik API
    let posterUrl = '/resources/anime-placeholder.svg';
    
    // 1. Приоритет - Kodik API material_data.poster_url
    if (item.material_data?.poster_url) {
        posterUrl = item.material_data.poster_url;
    }
    // 2. Резерв - Kodik API screenshots[0]
    else if (item.screenshots && item.screenshots.length > 0) {
        posterUrl = item.screenshots[0];
    }
    // 3. Последний резерв - предзагруженный Shikimori постер
    else if (shikimoriPoster) {
        posterUrl = shikimoriPoster;
    }
    
    // Оптимизируем URL изображения
    if (posterUrl && posterUrl !== '/resources/anime-placeholder.svg') {
        posterUrl = optimizeImageUrl(posterUrl);
    }

    // Получаем базовую информацию
    const year = item.year || 'Неизвестно';
    const rating = item.material_data?.rating || null;
    const episodes = item.episodes_count || null;

    return `
    <div class="anime-card fade-in" onclick="navigateToAnime('${animeId}', '${escapeHtml(t)}', '${item.link}')" style="cursor: pointer;">
        <div class="anime-poster">
            <img src="${posterUrl}" 
                 alt="Постер ${escapeHtml(t)}" 
                 loading="lazy" 
                 decoding="async"
                 onerror="this.onerror=null; this.src='/resources/anime-placeholder.svg';"
                 onload="this.style.opacity='1';"
                 style="opacity: 0; transition: opacity 0.3s ease;">
            <div class="anime-overlay">
                <div class="play-button">
                    <i class="fas fa-play"></i>
                </div>
                ${rating ? `
                <div class="anime-rating">
                    <i class="fas fa-star"></i>
                    <span>${rating}</span>
                </div>
                ` : ''}
            </div>
        </div>
        
        <div class="anime-info">
            <h3 class="anime-title" title="${escapeHtml(t)}">${escapeHtml(t)}</h3>
            
            <div class="anime-meta">
                <span class="anime-year">
                    <i class="fas fa-calendar"></i>
                    ${year}
                </span>
                ${episodes ? `
                <span class="anime-episodes">
                    <i class="fas fa-film"></i>
                    ${episodes} эп.
                </span>
                ` : ''}
            </div>
        </div>

        <div class="anime-actions" onclick="event.stopPropagation();">
            <button class="action-btn favorite-btn ${isFav ? 'active' : ''}" data-link="${item.link}"
                    onclick="toggleFavorite('${escapeHtml(t).replace(/'/g, "\\'")}','${item.link}')"
                    title="${isFav ? 'Удалить из избранного' : 'Добавить в избранное'}">
                <i class="${isFav ? 'fas' : 'far'} fa-heart"></i>
            </button>

            <button class="action-btn share-btn" onclick="shareAnime('${JSON.stringify(item).replace(/"/g, '&quot;')}')" title="Поделиться">
                <i class="fas fa-share"></i>
            </button>
        </div>
    </div>`;
}

async function createAnimeCard(item) {
    try {
        const t = item.title;
        const favs = await getFavorites();
        const isFav = favs.some(f => f.link === item.link);

        // Создаем короткий ID для аниме (используем хеш от ссылки)
        const animeId = generateAnimeId(item.link);
        
        // Создаем ссылку на страницу деталей в новом формате
        const detailUrl = `/anime-detail.html?a=${animeId}&t=${encodeURIComponent(t)}`;

        // ИСПРАВЛЕНО: Получаем постер с правильным приоритетом
        let posterUrl = null;
        
        console.log('Создаем карточку для:', t);
        console.log('Данные item:', item);
        
        try {
            // 1. Приоритет - Kodik API material_data.poster_url
            if (item.material_data?.poster_url) {
                posterUrl = item.material_data.poster_url;
                console.log('✅ Найден постер в material_data:', posterUrl);
            }
            // 2. Резерв - прямое поле poster_url
            else if (item.poster_url) {
                posterUrl = item.poster_url;
                console.log('✅ Найден постер в poster_url:', posterUrl);
            }
            // 3. Резерв - Kodik API screenshots[0]
            else if (item.screenshots && item.screenshots.length > 0) {
                posterUrl = item.screenshots[0];
                console.log('✅ Используем скриншот из Kodik:', posterUrl);
            }
            // 4. Последний резерв - Shikimori API (только если нет постеров из Kodik)
            else {
                console.log('❌ Постер не найден в Kodik, пробуем Shikimori...');
                try {
                    const shikimoriPoster = await getShikimoriPoster(t);
                    if (shikimoriPoster) {
                        posterUrl = shikimoriPoster;
                        console.log('✅ Получен постер из Shikimori:', posterUrl);
                    } else {
                        console.log('❌ Постер не найден в Shikimori');
                    }
                } catch (shikimoriError) {
                    console.warn('❌ Ошибка получения постера из Shikimori:', shikimoriError);
                }
            }
        } catch (error) {
            console.warn('❌ Ошибка получения постера:', error);
        }
        
        // Если постер не найден, используем placeholder
        if (!posterUrl) {
            posterUrl = '/resources/anime-placeholder.svg';
            console.log('🔄 Используем placeholder для:', t);
        } else {
            // Оптимизируем URL изображения
            posterUrl = optimizeImageUrl(posterUrl);
            console.log('🖼️ Финальный URL постера:', posterUrl);
        }

        // Получаем базовую информацию
        const year = item.year || 'Неизвестно';
        const rating = item.material_data?.rating || null;
        const episodes = item.episodes_count || null;

        return `
        <div class="anime-card fade-in" onclick="navigateToAnime('${animeId}', '${escapeHtml(t)}', '${item.link}')" style="cursor: pointer;">
            <div class="anime-poster">
                <img src="${posterUrl}" 
                     alt="Постер ${escapeHtml(t)}" 
                     loading="eager"
                     decoding="async"
                     onerror="window.fixBrokenImage ? window.fixBrokenImage(this) : (this.onerror=null, this.src='/resources/anime-placeholder.svg');"
                     onload="this.style.opacity='1';"
                     style="opacity: 0; transition: opacity 0.3s ease;">
                <div class="anime-overlay">
                    <div class="play-button">
                        <i class="fas fa-play"></i>
                    </div>
                    ${rating ? `
                    <div class="anime-rating">
                        <i class="fas fa-star"></i>
                        <span>${rating}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="anime-info">
                <h3 class="anime-title" title="${escapeHtml(t)}">${escapeHtml(t)}</h3>
                
                <div class="anime-meta">
                    <span class="anime-year">
                        <i class="fas fa-calendar"></i>
                        ${year}
                    </span>
                    ${episodes ? `
                    <span class="anime-episodes">
                        <i class="fas fa-film"></i>
                        ${episodes} эп.
                    </span>
                    ` : ''}
                </div>
            </div>

            <div class="anime-actions" onclick="event.stopPropagation();">
                <button class="action-btn favorite-btn ${isFav ? 'active' : ''}" data-link="${item.link}" onclick="toggleFavorite('${escapeHtml(t).replace(/'/g, "\\'")}','${item.link}')" title="${isFav ? 'Удалить из избранного' : 'Добавить в избранное'}">
                    <i class="fa${isFav ? 's' : 'r'} fa-heart"></i>
                </button>

                <button class="action-btn share-btn" onclick="shareAnime('${JSON.stringify(item).replace(/"/g, '&quot;')}')" title="Поделиться">
                    <i class="fas fa-share"></i>
                </button>

                <a class="action-btn external-btn" href="${detailUrl}" title="Подробнее" onclick="event.stopPropagation();">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>
        </div>`;
    } catch (error) {
        console.error('Ошибка создания карточки аниме:', error);
        return createFallbackCard(item);
    }
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

/* ---------- EXPORT/IMPORT FAVORITES ---------- */
// Генерация уникального кода для защиты
function generateUniqueCode() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const checksum = btoa(timestamp + random).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `${timestamp}-${random}-${checksum}`.toUpperCase();
}

// Валидация уникального кода
function validateUniqueCode(code) {
    if (!code || typeof code !== 'string') return false;
    const parts = code.split('-');
    if (parts.length !== 3) return false;
    
    const [timestamp, random, checksum] = parts;
    if (!timestamp || !random || !checksum) return false;
    
    // Проверяем, что код не старше 30 дней
    const codeTime = parseInt(timestamp, 36);
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    
    return (now - codeTime) < thirtyDays;
}

// Экспорт избранного с защитой
async function exportFavorites() {
    try {
        const favorites = await getFavorites();
        if (!favorites.length) {
            showNote("В избранном нет аниме для экспорта", "info");
            return null;
        }

        const uniqueCode = generateUniqueCode();
        const processedFavorites = favorites
            .filter(fav => fav && fav.title && fav.link) // Фильтруем некорректные записи
            .map(fav => ({
                title: fav.title.trim(),
                link: fav.link.trim(),
                addedAt: fav.addedAt || new Date().toISOString()
            }));
        
        // Проверяем, что после фильтрации остались валидные записи
        if (!processedFavorites.length) {
            showNote("В избранном нет корректных данных для экспорта", "info");
            return null;
        }

        const exportData = {
            version: "1.0",
            timestamp: Date.now(),
            uniqueCode: uniqueCode,
            favorites: processedFavorites,
            checksum: generateChecksum(processedFavorites)
        };

        const exportString = JSON.stringify(exportData);
        // Исправляем проблему с кодировкой для btoa
        const compressedData = btoa(unescape(encodeURIComponent(exportString)));
        
        return {
            data: compressedData,
            code: uniqueCode,
            count: processedFavorites.length
        };
    } catch (error) {
        console.error("Export error:", error);
        showNote("Ошибка при экспорте избранного", "error");
        return null;
    }
}

// Импорт избранного с проверкой
async function importFavorites(importData, providedCode) {
    try {
        if (!importData || !providedCode) {
            throw new Error("Неверные данные для импорта");
        }

        // Декодируем данные с правильной обработкой кодировки
        let decodedString;
        try {
            decodedString = decodeURIComponent(escape(atob(importData)));
        } catch (decodeError) {
            throw new Error("Неверный формат файла или поврежденные данные");
        }
        
        let importObj;
        try {
            importObj = JSON.parse(decodedString);
        } catch (parseError) {
            throw new Error("Файл поврежден или имеет неверный формат");
        }

        // Проверяем версию
        if (importObj.version !== "1.0") {
            throw new Error("Неподдерживаемая версия файла");
        }

        // Проверяем уникальный код
        if (!validateUniqueCode(providedCode)) {
            throw new Error("Неверный или устаревший код защиты");
        }

        if (importObj.uniqueCode !== providedCode) {
            throw new Error("Код защиты не совпадает с файлом");
        }

        // Проверяем целостность данных
        if (!importObj.favorites || !Array.isArray(importObj.favorites)) {
            throw new Error("Поврежденные данные избранного");
        }

        // Проверяем контрольную сумму
        const currentChecksum = generateChecksum(importObj.favorites);
        if (importObj.checksum !== currentChecksum) {
            throw new Error("Файл поврежден или изменен");
        }

        // Получаем текущее избранное
        const currentFavorites = await getFavorites();
        const currentLinks = new Set(currentFavorites.map(f => f.link));

        // Фильтруем дубликаты
        const newFavorites = importObj.favorites.filter(fav => !currentLinks.has(fav.link));

        if (!newFavorites.length) {
            showNote("Все аниме из файла уже есть в избранном", "info");
            return { imported: 0, total: importObj.favorites.length };
        }

        // Добавляем новые избранные
        let importedCount = 0;
        for (const fav of newFavorites) {
            try {
                const newFavorite = {
                    id: Date.now() + Math.random(),
                    title: fav.title,
                    link: fav.link,
                    t: Date.now(),
                    addedAt: fav.addedAt || new Date().toISOString(),
                    imported: true
                };
                await dbAdd(STORE_FAVORITES, newFavorite);
                importedCount++;
            } catch (error) {
                console.warn("Failed to import favorite:", fav.title, error);
            }
        }

        clearFavoritesCache();
        await refreshAllFavoriteButtons();

        return {
            imported: importedCount,
            total: importObj.favorites.length,
            duplicates: importObj.favorites.length - newFavorites.length
        };

    } catch (error) {
        console.error("Import error:", error);
        throw error;
    }
}

// Генерация контрольной суммы
function generateChecksum(favorites) {
    const data = favorites.map(f => f.title + f.link).join('');
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

// Поделиться избранным через уникальную ссылку
async function shareFavorites() {
    try {
        const exportResult = await exportFavorites();
        if (!exportResult) return null;

        const shareUrl = `${location.origin}/?import=${encodeURIComponent(exportResult.data)}&code=${exportResult.code}`;
        
        return {
            url: shareUrl,
            code: exportResult.code,
            count: exportResult.count
        };
    } catch (error) {
        console.error("Share error:", error);
        showNote("Ошибка при создании ссылки для обмена", "error");
        return null;
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
                <div class="empty-favorites-actions" style="margin-top:2rem;display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;">
                    <button onclick="showImportModal()" class="action-btn secondary">
                        <i class="fas fa-upload"></i> Импорт избранного
                    </button>
                    <button onclick="navigateToHome()" class="clear-history-btn">
                        <i class="fas fa-arrow-left"></i> Вернуться к поиску
                    </button>
                </div>
            </div>`;
            return;
        }

        const displayedFavorites = currentFavorites.slice(0, currentDisplayCount.favorites);
        const cards = await safeCreateAnimeCards(displayedFavorites);

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
                <div class="favorites-export-actions">
                    <button onclick="shareFavoritesLink()" class="action-btn primary">
                        <i class="fas fa-share"></i> Поделиться ссылкой
                    </button>
                    <button onclick="exportFavoritesToFile()" class="action-btn secondary">
                        <i class="fas fa-download"></i> Экспорт в файл
                    </button>
                    <button onclick="showImportModal()" class="action-btn secondary">
                        <i class="fas fa-upload"></i> Импорт
                    </button>
                </div>
                <div class="favorites-manage-actions">
                    <button onclick="clearFavorites()" class="clear-history-btn">
                        <i class="fas fa-trash"></i> Очистить избранное
                    </button>
                    <button onclick="navigateToHome()" class="clear-history-btn secondary">
                        <i class="fas fa-arrow-left"></i> Вернуться к поиску
                    </button>
                </div>
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

    // Добавляем класс загрузки с анимацией
    btn.classList.add('loading');
    btn.innerHTML = '<i class="fas fa-spinner"></i> <span class="btn-text">Загрузка...</span>';
    btn.disabled = true;

    try {
        // Небольшая задержка для визуального эффекта
        await new Promise(resolve => setTimeout(resolve, 300));
        
        currentDisplayCount.favorites += ITEMS_PER_PAGE.favorites;
        const newFavorites = currentFavorites.slice(
            currentDisplayCount.favorites - ITEMS_PER_PAGE.favorites,
            currentDisplayCount.favorites
        );

        const newCards = await safeCreateAnimeCards(newFavorites);
        
        // Добавляем карточки с анимацией появления
        newCards.forEach((card, index) => {
            setTimeout(() => {
                const cardElement = document.createElement('div');
                cardElement.innerHTML = card;
                const actualCard = cardElement.firstElementChild;
                actualCard.style.opacity = '0';
                actualCard.style.transform = 'translateY(30px)';
                
                grid.appendChild(actualCard);
                
                // Анимация появления
                setTimeout(() => {
                    actualCard.style.transition = 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
                    actualCard.style.opacity = '1';
                    actualCard.style.transform = 'translateY(0)';
                }, 50);
            }, index * 100); // Задержка между карточками
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
        setTimeout(() => {
            btn.classList.remove('loading');
            
            if (currentDisplayCount.favorites >= currentFavorites.length) {
                // Анимация исчезновения кнопки
                btn.style.transition = 'all 0.3s ease';
                btn.style.opacity = '0';
                btn.style.transform = 'scale(0.8)';
                setTimeout(() => btn.remove(), 300);
            } else {
                btn.innerHTML = `<i class="fas fa-arrow-down"></i> <span class="btn-text">Показать еще (${currentFavorites.length - currentDisplayCount.favorites})</span>`;
                btn.disabled = false;
            }
        }, newCards.length * 100 + 200);

        await refreshAllFavoriteButtons();
    } catch (error) {
        console.error('Error loading more favorites:', error);
        btn.classList.remove('loading');
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> <span class="btn-text">Ошибка загрузки</span>';
        btn.disabled = false;
        
        setTimeout(() => {
            btn.innerHTML = `<i class="fas fa-arrow-down"></i> <span class="btn-text">Показать еще</span>`;
        }, 2000);
    }
};

// Улучшенная функция показа модального окна очистки
function showClearFavoritesModal() {
    // Создаем модальное окно динамически для лучшего контроля
    const modalHTML = `
    <div class="modal-overlay" id="clearFavoritesModal" onclick="handleClearModalOverlayClick(event)">
        <div class="modal-content clear-favorites-modal" onclick="event.stopPropagation()">
            <button class="modal-close" onclick="closeClearFavoritesModal()">&times;</button>
            <div class="modal-header">
                <div class="modal-icon danger">
                    <i class="fas fa-exclamation-triangle"></i>
                </div>
                <h2 class="modal-title">Очистить избранное?</h2>
                <p class="modal-subtitle">Это действие нельзя отменить</p>
            </div>
            
            <div class="modal-body">
                <div class="warning-info">
                    <div class="warning-item">
                        <i class="fas fa-trash"></i>
                        <span>Все избранные аниме будут удалены</span>
                    </div>
                    <div class="warning-item">
                        <i class="fas fa-undo-alt"></i>
                        <span>Восстановить данные будет невозможно</span>
                    </div>
                    <div class="warning-item">
                        <i class="fas fa-download"></i>
                        <span>Рекомендуем сначала создать экспорт</span>
                    </div>
                </div>
            </div>
            
            <div class="modal-actions">
                <button class="modal-btn secondary" onclick="closeClearFavoritesModal()">
                    <i class="fas fa-times"></i> Отмена
                </button>
                <button class="modal-btn primary" onclick="exportBeforeClear()">
                    <i class="fas fa-download"></i> Экспорт и очистка
                </button>
                <button class="modal-btn danger" onclick="confirmClearFavorites()">
                    <i class="fas fa-trash"></i> Очистить
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    document.body.classList.add("modal-open");
    
    // Добавляем обработчики
    document.addEventListener('keydown', handleClearModalEscapeKey);
}

// Новая функция для экспорта перед очисткой
window.exportBeforeClear = async () => {
    try {
        const exportResult = await exportFavorites();
        if (!exportResult) {
            showNote("Нет данных для экспорта", "info");
            return;
        }

        // Автоматически скачиваем файл
        const blob = new Blob([exportResult.data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anifox-favorites-backup-${new Date().toISOString().split('T')[0]}.txt`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Копируем код в буфер обмена
        await copyToClipboard(exportResult.code);
        
        showNote(`📁 Резервная копия создана (${exportResult.count} аниме). Код: ${exportResult.code}`, "success");
        
        // Небольшая задержка перед очисткой
        setTimeout(() => {
            confirmClearFavorites();
        }, 1000);
        
    } catch (error) {
        console.error("Export before clear error:", error);
        showNote(`❌ Ошибка при создании резервной копии: ${error.message}`, "error");
    }
};

function closeClearFavoritesModal() {
    const modal = document.getElementById('clearFavoritesModal');
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            modal.remove();
            document.body.classList.remove('modal-open');
        }, 200);
        
        document.removeEventListener('keydown', handleClearModalEscapeKey);
    }
}

function handleClearModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
        closeClearFavoritesModal();
    }
}

function handleClearModalEscapeKey(event) {
    if (event.key === 'Escape') {
        closeClearFavoritesModal();
    }
}

async function confirmClearFavorites() {
    try {
        // Показываем индикатор загрузки
        const confirmBtn = document.querySelector('#clearFavoritesModal .modal-btn.danger');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Очистка...';
        confirmBtn.disabled = true;
        
        // Очищаем базу данных
        await dbClear(STORE_FAVORITES);
        clearFavoritesCache();
        
        // Обновляем глобальные переменные
        currentFavorites = [];
        currentDisplayCount.favorites = ITEMS_PER_PAGE.favorites;
        
        // Мгновенно обновляем интерфейс без перезагрузки
        if (location.search.includes("page=favorites")) {
            await renderFavoritesPage();
        }
        
        // Обновляем все кнопки избранного на сайте
        await refreshAllFavoriteButtons();
        
        closeClearFavoritesModal();
        showNote("✅ Избранное полностью очищено", "success");
        
    } catch (e) {
        console.error("Clear favorites error:", e);
        showNote(`❌ Ошибка при очистке избранного: ${e.message}`, "error");
    } finally {
        // Восстанавливаем кнопку
        const confirmBtn = document.querySelector('#clearFavoritesModal .modal-btn.danger');
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fas fa-trash"></i> Очистить';
            confirmBtn.disabled = false;
        }
    }
}

window.clearFavorites = showClearFavoritesModal;

window.clearFavorites = showClearFavoritesModal;

// Переменная для хранения данных импорта
let pendingImportData = null;

// Функции для работы с модальным окном ввода кода защиты
function showCodeInputModal(importData) {
    pendingImportData = importData;
    const modal = document.getElementById('codeInputModal');
    const input = document.getElementById('protectionCodeInput');
    
    if (modal && input) {
        modal.style.display = 'flex';
        document.body.classList.add('modal-open');
        input.value = '';
        input.focus();
        
        // Добавляем обработчик для Enter
        input.addEventListener('keypress', handleCodeInputKeypress);
        
        // Добавляем обработчик для закрытия по клику на overlay
        modal.addEventListener('click', handleModalOverlayClick);
        
        // Добавляем обработчик для Escape
        document.addEventListener('keydown', handleModalEscapeKey);
    }
}

function closeCodeInputModal() {
    const modal = document.getElementById('codeInputModal');
    const input = document.getElementById('protectionCodeInput');
    
    if (modal && input) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
        input.removeEventListener('keypress', handleCodeInputKeypress);
        modal.removeEventListener('click', handleModalOverlayClick);
        document.removeEventListener('keydown', handleModalEscapeKey);
        pendingImportData = null;
    }
}

function handleModalOverlayClick(event) {
    if (event.target === event.currentTarget) {
        closeCodeInputModal();
    }
}

function handleModalEscapeKey(event) {
    if (event.key === 'Escape') {
        closeCodeInputModal();
    }
}

function handleCodeInputKeypress(event) {
    if (event.key === 'Enter') {
        confirmCodeInput();
    }
}

async function confirmCodeInput() {
    const input = document.getElementById('protectionCodeInput');
    const code = input.value.trim();
    
    if (!code) {
        showNote("Пожалуйста, введите код защиты", "error");
        input.focus();
        return;
    }
    
    if (!pendingImportData) {
        showNote("Ошибка: данные для импорта не найдены", "error");
        closeCodeInputModal();
        return;
    }
    
    try {
        // Показываем индикатор загрузки
        const confirmBtn = document.querySelector('.code-input-buttons .modal-btn.primary');
        const originalText = confirmBtn.innerHTML;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Импорт...';
        confirmBtn.disabled = true;
        
        const result = await importFavorites(pendingImportData, code);
        
        if (result) {
            let message = `Импортировано ${result.imported} из ${result.total} аниме`;
            if (result.duplicates > 0) {
                message += ` (${result.duplicates} дубликатов пропущено)`;
            }
            showNote(message, "success");
            closeCodeInputModal();
            
            // Обновляем страницу избранного, если мы на ней
            if (location.search.includes("page=favorites")) {
                renderFavoritesPage();
            } else {
                // Обновляем кнопки избранного на странице
                await refreshAllFavoriteButtons();
            }
        } else {
            showNote("Ошибка при импорте избранного", "error");
        }
    } catch (error) {
        console.error("Import error:", error);
        showNote(`Ошибка при импорте: ${error.message}`, "error");
    } finally {
        // Восстанавливаем кнопку
        const confirmBtn = document.querySelector('.code-input-buttons .modal-btn.primary');
        if (confirmBtn) {
            confirmBtn.innerHTML = '<i class="fas fa-check"></i> Импортировать';
            confirmBtn.disabled = false;
        }
    }
}

// Глобальные функции для экспорта/импорта
window.exportFavoritesToFile = async () => {
    try {
        // Показываем индикатор загрузки
        const loadingNote = showNote("Подготовка экспорта...", "info", null, true);
        
        const exportResult = await exportFavorites();
        if (!exportResult) {
            hideNote(loadingNote);
            showNote("Нет данных для экспорта", "info");
            return;
        }

        if (!exportResult.data || !exportResult.code) {
            hideNote(loadingNote);
            throw new Error("Неверные данные экспорта");
        }

        // Автоматически копируем код защиты в буфер обмена
        const copySuccess = await copyToClipboard(exportResult.code);
        
        const blob = new Blob([exportResult.data], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anifox-favorites-${new Date().toISOString().split('T')[0]}.txt`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        hideNote(loadingNote);

        // Показываем уведомление с информацией об автоматическом копировании
        if (copySuccess) {
            showNote(`✅ Избранное экспортировано (${exportResult.count} аниме). Код защиты скопирован в буфер обмена!`, "success", exportResult.code);
        } else {
            showNote(`✅ Избранное экспортировано (${exportResult.count} аниме). Код защиты: ${exportResult.code}`, "success", exportResult.code);
        }

        // Обновляем кнопку экспорта с анимацией успеха
        const exportBtn = document.querySelector('button[onclick="exportFavoritesToFile()"]');
        if (exportBtn) {
            const originalHTML = exportBtn.innerHTML;
            exportBtn.innerHTML = '<i class="fas fa-check"></i> Экспортировано';
            exportBtn.classList.add('success-state');
            
            setTimeout(() => {
                exportBtn.innerHTML = originalHTML;
                exportBtn.classList.remove('success-state');
            }, 2000);
        }
    } catch (error) {
        console.error("Export to file error:", error);
        showNote(`❌ Ошибка при экспорте в файл: ${error.message}`, "error");
    }
};

// Улучшенная функция для показа модального окна импорта
window.showImportModal = () => {
    const modalHTML = `
    <div class="modal-overlay import-modal-overlay" onclick="closeImportModal(event)">
        <div class="modal-content import-modal" onclick="event.stopPropagation()">
            <button class="modal-close" onclick="closeImportModal()">&times;</button>
            <div class="import-modal-header">
                <h2 class="modal-title">
                    <i class="fas fa-file-import"></i> Импорт избранного
                </h2>
                <p class="modal-subtitle">Восстановите свою коллекцию избранных аниме</p>
            </div>
            
            <div class="import-methods">
                <div class="import-method">
                    <div class="import-method-icon">
                        <i class="fas fa-file-upload"></i>
                    </div>
                    <div class="import-method-content">
                        <h3>Из файла</h3>
                        <p>Выберите файл с экспортированным избранным (.txt)</p>
                        <button class="modal-btn primary" onclick="selectImportFile()">
                            <i class="fas fa-upload"></i> Выбрать файл
                        </button>
                    </div>
                </div>
                
                <div class="import-method">
                    <div class="import-method-icon">
                        <i class="fas fa-link"></i>
                    </div>
                    <div class="import-method-content">
                        <h3>По ссылке</h3>
                        <p>Вставьте ссылку для импорта избранного</p>
                        <div class="import-url-input">
                            <input type="url" id="importUrlInput" placeholder="https://anifox-search.vercel.app/?import=..." />
                            <button class="modal-btn secondary" onclick="importFromUrl()">
                                <i class="fas fa-download"></i> Импорт
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="import-info">
                <div class="info-item">
                    <i class="fas fa-shield-alt"></i>
                    <span>Для импорта требуется код защиты, который был создан при экспорте</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-info-circle"></i>
                    <span>Дубликаты автоматически исключаются при импорте</span>
                </div>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML("beforeend", modalHTML);
    document.body.classList.add("modal-open");
    
    // Фокус на поле ввода URL
    setTimeout(() => {
        const urlInput = document.getElementById('importUrlInput');
        if (urlInput) {
            urlInput.focus();
            
            // Обработчик Enter для быстрого импорта
            urlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    importFromUrl();
                }
            });
        }
    }, 100);
};

// Новая функция для импорта по URL
window.importFromUrl = () => {
    const urlInput = document.getElementById('importUrlInput');
    if (!urlInput || !urlInput.value.trim()) {
        showNote("Введите ссылку для импорта", "warning");
        return;
    }
    
    try {
        const url = new URL(urlInput.value.trim());
        const importData = url.searchParams.get('import');
        const code = url.searchParams.get('code');
        
        if (!importData || !code) {
            throw new Error("Неверная ссылка для импорта");
        }
        
        closeImportModal();
        processImport(importData, code);
    } catch (error) {
        showNote("Неверная ссылка для импорта", "error");
    }
};

// Функция для выбора файла импорта
window.selectImportFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.multiple = false;
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Показываем индикатор загрузки
            const loadingNote = showNote("Чтение файла...", "info", null, true);
            
            const text = await file.text();
            hideNote(loadingNote);
            
            closeImportModal();
            showCodeInputModal(text.trim());
        } catch (error) {
            console.error("Import from file error:", error);
            showNote(`❌ Ошибка при чтении файла: ${error.message}`, "error");
        }
    };
    
    input.click();
};

// Улучшенная функция обработки импорта
async function processImport(importData, code) {
    try {
        const loadingNote = showNote("Импорт избранного...", "info", null, true);
        
        const result = await importFavorites(importData, code);
        hideNote(loadingNote);
        
        if (result.imported > 0) {
            showNote(`✅ Импортировано ${result.imported} из ${result.total} аниме${result.duplicates > 0 ? ` (${result.duplicates} дубликатов пропущено)` : ''}`, "success");
            
            // Мгновенное обновление страницы избранного без перезагрузки
            if (location.search.includes("page=favorites")) {
                await renderFavoritesPage();
            }
        } else {
            showNote(`ℹ️ Все аниме из файла уже есть в избранном (${result.total} проверено)`, "info");
        }
    } catch (error) {
        console.error("Process import error:", error);
        showNote(`❌ Ошибка импорта: ${error.message}`, "error");
    }
}

window.importFavoritesFromFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.txt';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            showCodeInputModal(text.trim());
        } catch (error) {
            console.error("Import from file error:", error);
            showNote(`Ошибка при чтении файла: ${error.message}`, "error");
        }
    };
    input.click();
};

window.shareFavoritesLink = async () => {
    try {
        const loadingNote = showNote("Создание ссылки...", "info", null, true);
        
        const shareResult = await shareFavorites();
        hideNote(loadingNote);
        
        if (!shareResult) return;

        if (navigator.share) {
            await navigator.share({
                title: 'Мое избранное аниме - AniFox',
                text: `Поделиться избранным (${shareResult.count} аниме)`,
                url: shareResult.url
            });
        } else {
            await navigator.clipboard.writeText(shareResult.url);
            showNote(`🔗 Ссылка скопирована! Код защиты: ${shareResult.code}`, "success", shareResult.code);
        }
        
        // Обновляем кнопку с анимацией успеха
        const shareBtn = document.querySelector('button[onclick="shareFavoritesLink()"]');
        if (shareBtn) {
            const originalHTML = shareBtn.innerHTML;
            shareBtn.innerHTML = '<i class="fas fa-check"></i> Ссылка создана';
            shareBtn.classList.add('success-state');
            
            setTimeout(() => {
                shareBtn.innerHTML = originalHTML;
                shareBtn.classList.remove('success-state');
            }, 2000);
        }
    } catch (error) {
        console.error("Share link error:", error);
        showNote("❌ Ошибка при создании ссылки", "error");
    }
};

window.closeImportModal = (e) => {
    if (e && e.target !== e.currentTarget) return;
    
    const modal = document.querySelector(".import-modal-overlay");
    if (modal) {
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            modal.remove();
            document.body.classList.remove("modal-open");
        }, 200);
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

async function search(queryParam = null) {
    const input = $("searchInput"),
        q = queryParam || input?.value.trim() || "",
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
        
        // Создаем красивый URL для поиска
        const slug = toSlug(q);
        const cleanUrl = `/search/${slug}`;
        history.replaceState({ query: q, type: 'search' }, null, cleanUrl);
        
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
    history.replaceState({ type: 'home' }, null, "/");
    updateHeader();
    renderWeekly();
    
    // ОБНОВЛЕНО: Добавлено обновление SEO мета-тегов для главной страницы
    updateSEOMetaForHome();
};

window.navigateToFavorites = () => {
    // Всегда используем корневой путь для избранного
    const url = "/favorites";
    history.replaceState({ type: 'favorites' }, null, url);
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
    const currentUrl = location.origin + "/?page=favorites";
    
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
    let linkCanon = document.querySelector('link[rel="canonical"][data-dynamic]');
    if (!linkCanon) {
        linkCanon = document.createElement("link");
        linkCanon.rel = "canonical";
        linkCanon.setAttribute("data-dynamic", "");
        document.head.appendChild(linkCanon);
    }
    linkCanon.href = url;
}

// ДОБАВЛЕНО: Функция для структурированных данных главной страницы
function addHomeStructuredData() {
    const homeJsonLd = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "AniFox - Смотреть аниме онлайн",
        "url": location.origin,
        "description": "Бесплатная платформа для просмотра аниме онлайн в HD качестве. Тысячи сериалов и фильмов без регистрации.",
        "inLanguage": "ru",
        "potentialAction": {
            "@type": "SearchAction",
            "target": `${location.origin}/?q={search_term_string}`,
            "query-input": "required name=search_term_string"
        },
        "publisher": {
            "@type": "Organization",
            "name": "AniFox",
            "url": location.origin
        }
    };
    
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(homeJsonLd);
    script.setAttribute("data-dynamic", "");
    document.head.appendChild(script);
}

// ДОБАВЛЕНО: Функция для структурированных данных страницы избранного
function addFavoritesStructuredData() {
    const favoritesJsonLd = {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        "name": "Избранное - AniFox",
        "url": `${location.origin}/?page=favorites`,
        "description": "Ваша коллекция избранных аниме на AniFox. Сохраняйте любимые сериалы и следите за новыми сериями.",
        "inLanguage": "ru",
        "mainEntity": {
            "@type": "ItemList",
            "name": "Избранные аниме",
            "description": "Список избранных аниме пользователя"
        }
    };
    
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(favoritesJsonLd);
    script.setAttribute("data-dynamic", "");
    document.head.appendChild(script);
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
            const urlParams = new URLSearchParams(location.search);

            // Проверяем параметры импорта
            if (urlParams.has('import') && urlParams.has('code')) {
                const importData = urlParams.get('import');
                const code = urlParams.get('code');
                
                // Показываем индикатор загрузки
                const loadingNote = showNote("🔄 Автоматический импорт избранного...", "info", null, true);
                
                try {
                    const result = await importFavorites(importData, code);
                    hideNote(loadingNote);
                    
                    if (result && result.imported > 0) {
                        let message = `✅ Импортировано ${result.imported} из ${result.total} аниме`;
                        if (result.duplicates > 0) {
                            message += ` (${result.duplicates} дубликатов пропущено)`;
                        }
                        showNote(message, "success");
                        
                        // Очищаем URL от параметров импорта
                        const cleanUrl = location.origin + "/";
                        history.replaceState(null, null, cleanUrl);
                        
                        // Переходим на страницу избранного с небольшой задержкой
                        setTimeout(() => {
                            navigateToFavorites();
                        }, 1500);
                        return;
                    } else if (result && result.imported === 0) {
                        showNote(`ℹ️ Все аниме из ссылки уже есть в избранном (${result.total} проверено)`, "info");
                        
                        // Очищаем URL и переходим на избранное
                        const cleanUrl = location.origin + "/";
                        history.replaceState(null, null, cleanUrl);
                        setTimeout(() => {
                            navigateToFavorites();
                        }, 2000);
                        return;
                    }
                } catch (error) {
                    hideNote(loadingNote);
                    console.error("Auto import error:", error);
                    showNote(`❌ Ошибка автоматического импорта: ${error.message}`, "error");
                    
                    // Очищаем URL от неверных параметров
                    const cleanUrl = location.origin + "/";
                    history.replaceState(null, null, cleanUrl);
                }
            }

            if (path.startsWith("/search/")) {
                const slug = path.replace("/search/", "");
                const query = slug.replace(/-/g, " ");
                if (input) input.value = query;
                search(query);
            } else if (location.search.includes("page=favorites")) {
                renderFavoritesPage();
            } else {
                renderWeekly();
            }
        }

        if (btn) {
            optimizeScrollPerformance(); // Используем оптимизированный скроллинг
            btn.addEventListener("click", () =>
                window.scrollTo({ top: 0, behavior: "smooth" })
            );
        }
        
        // Оптимизация производительности
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                // Предзагрузка критических ресурсов
                preloadCriticalResources();
                // Оптимизация изображений
                optimizeImages();
                // Мобильные оптимизации
                if (window.innerWidth <= 768) {
                    forceLoadImagesOnMobile();
                    optimizeImagesForMobile();
                }
            });
        } else {
            setTimeout(() => {
                preloadCriticalResources();
                optimizeImages();
                if (window.innerWidth <= 768) {
                    forceLoadImagesOnMobile();
                    optimizeImagesForMobile();
                }
            }, 1000);
        }
        
        // Проверяем сломанные изображения через 2 секунды
        setTimeout(fixBrokenImages, 2000);
        
        // Повторная проверка для мобильных через 5 секунд
        if (window.innerWidth <= 768) {
            setTimeout(() => {
                fixBrokenImages();
                forceLoadImagesOnMobile();
            }, 5000);
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

// Функции оптимизации производительности
function preloadCriticalResources() {
    // Предзагрузка критических изображений
    const criticalImages = [
        '/resources/anime-placeholder.svg',
        '/resources/obl_web.jpg'
    ];
    
    criticalImages.forEach(src => {
        const img = new Image();
        img.src = src;
    });
}

function optimizeImages() {
    // Оптимизация всех изображений на странице
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        // Добавляем декодирование изображений
        if ('decode' in img) {
            img.decode().catch(() => {
                // Игнорируем ошибки декодирования
            });
        }
        
        // Оптимизация загрузки
        if (!img.loading) {
            img.loading = 'lazy';
        }
    });
}

// Оптимизация анимаций карточек
function optimizeCardAnimations() {
    const cards = document.querySelectorAll('.anime-card');
    
    if ('IntersectionObserver' in window) {
        const animationObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                } else {
                    entry.target.style.animationPlayState = 'paused';
                }
            });
        }, {
            rootMargin: '100px 0px'
        });
        
        cards.forEach(card => {
            animationObserver.observe(card);
        });
    }
}

// Оптимизация прокрутки для мобильных устройств
function optimizeMobileScrolling() {
    // Убираем все блокировки скролла на мобильных
    if (window.innerWidth <= 768) {
        document.body.style.overflow = 'auto';
        document.body.style.overflowX = 'hidden';
        document.body.style.overflowY = 'auto';
        document.body.style.webkitOverflowScrolling = 'touch';
        document.body.style.height = 'auto';
        document.body.style.minHeight = '100vh';
        document.body.style.position = 'static';
        
        // Убираем классы которые могут блокировать скролл
        document.body.classList.remove('modal-open', 'ab-scroll-lock', 'preloader-active');
        
        // Исправляем HTML элемент
        document.documentElement.style.overflow = 'auto';
        document.documentElement.style.height = 'auto';
        document.documentElement.style.minHeight = '100vh';
        
        // Предотвращение bounce эффекта только для body
        document.body.addEventListener('touchmove', (e) => {
            // Разрешаем скролл для всех элементов кроме самого body
            if (e.target === document.body) {
                e.preventDefault();
            }
        }, { passive: false });
        
        console.log('Mobile scrolling optimized');
    }
}

// Инициализация оптимизаций
document.addEventListener('DOMContentLoaded', () => {
    optimizeMobileScrolling();
    
    // Отложенная инициализация тяжелых операций
    if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
            optimizeCardAnimations();
        });
    } else {
        setTimeout(optimizeCardAnimations, 2000);
    }
});

console.log(`🚀 AniFox ${CACHE_VERSION} loaded with button-based loading system`);
console.log(`💻 Разработано SerGio Play - https://sergioplay-dev.vercel.app/`);
console.log(`📁 GitHub: https://github.com/SerGioPlay01/anifox-search`);
// Функция для принудительной загрузки изображений на мобильных
function forceLoadImagesOnMobile() {
    if (window.innerWidth <= 768) {
        console.log('Forcing image load on mobile...');
        
        const images = document.querySelectorAll('.anime-poster img');
        
        images.forEach((img, index) => {
            // Убираем все блокирующие стили
            img.style.opacity = '1';
            img.style.visibility = 'visible';
            img.style.display = 'block';
            img.style.transition = 'none';
            img.style.animation = 'none';
            
            // Принудительно устанавливаем loading
            img.loading = 'eager';
            img.decoding = 'async';
            
            // Добавляем задержку для поэтапной загрузки
            setTimeout(() => {
                if (!img.complete || img.naturalHeight === 0) {
                    console.log('Reloading image:', img.src);
                    
                    // Создаем новое изображение для проверки загрузки
                    const testImg = new Image();
                    
                    testImg.onload = function() {
                        console.log('Image loaded successfully:', this.src);
                        img.src = this.src;
                        img.classList.add('loaded');
                        img.style.opacity = '1';
                    };
                    
                    testImg.onerror = function() {
                        console.log('Failed to load image on mobile:', this.src);
                        img.src = '/resources/anime-placeholder.svg';
                        img.classList.add('loaded');
                        img.style.opacity = '1';
                    };
                    
                    // Оптимизируем URL для мобильных
                    let mobileSrc = img.src;
                    if (mobileSrc && mobileSrc !== '/resources/anime-placeholder.svg') {
                        // Убираем параметры которые могут мешать
                        mobileSrc = mobileSrc.split('?')[0];
                        
                        // Добавляем HTTPS если нужно
                        mobileSrc = mobileSrc.replace('http://', 'https://');
                        
                        // Для Shikimori добавляем мобильные параметры
                        if (mobileSrc.includes('shikimori.one')) {
                            mobileSrc += '?mobile=1&w=300&h=400';
                        }
                    }
                    
                    testImg.src = mobileSrc;
                } else {
                    // Изображение уже загружено
                    img.style.opacity = '1';
                    img.classList.add('loaded');
                }
            }, index * 50); // Уменьшаем интервал для быстрой загрузки
        });
        
        console.log(`Processing ${images.length} images for mobile`);
    }
}

// Функция для проверки и исправления сломанных изображений
function fixBrokenImages() {
    const images = document.querySelectorAll('.anime-poster img');
    
    images.forEach(img => {
        // Проверяем, загружено ли изображение
        if (img.complete && img.naturalHeight === 0) {
            console.log('Broken image detected:', img.src);
            img.src = '/resources/anime-placeholder.svg';
            img.classList.add('loaded');
        }
        
        // Добавляем обработчик ошибок, если его нет
        if (!img.onerror) {
            img.onerror = function() {
                console.log('Image load error:', this.src);
                this.src = '/resources/anime-placeholder.svg';
                this.classList.add('loaded');
                this.onerror = null;
            };
        }
    });
}

// Функция для оптимизации изображений на мобильных
function optimizeImagesForMobile() {
    if (window.innerWidth <= 768) {
        const images = document.querySelectorAll('.anime-poster img');
        
        images.forEach(img => {
            // Добавляем атрибуты для лучшей производительности
            img.setAttribute('decoding', 'async');
            img.setAttribute('loading', 'lazy');
            
            // Оптимизируем URL для мобильных
            if (img.src && img.src.includes('shikimori.one')) {
                let optimizedSrc = img.src.replace('http://', 'https://');
                
                // Добавляем параметры оптимизации
                if (!optimizedSrc.includes('?')) {
                    optimizedSrc += '?w=300&h=400&fit=crop&quality=80';
                }
                
                if (img.src !== optimizedSrc) {
                    img.src = optimizedSrc;
                }
            }
        });
    }
}