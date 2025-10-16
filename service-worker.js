/*
 * AniFox 2.4 - Service Worker
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * Функции:
 * - Кэширование статических ресурсов
 * - Стратегии кэширования (Cache First, Network First)
 * - Офлайн поддержка
 * - Автоматическое обновление кэша
 */

// ===========================================
// НАСТРОЙКИ КЭШИРОВАНИЯ
// ===========================================

// Имена кэшей для разных типов ресурсов
const CACHE_NAME = 'anifox-v2.0.1';        // Основной кэш
const STATIC_CACHE = 'static-v2.0.1';      // Статические ресурсы
const DYNAMIC_CACHE = 'dynamic-v2.0.1';    // Динамические ресурсы

// Файлы для кэширования при установке Service Worker
const STATIC_ASSETS = [
  '/',                                    // Главная страница
  '/index.html',                          // HTML файл
  '/style.css',                           // Основные стили
  '/api.js',                              // API скрипт
  '/manifest.json',                       // PWA манифест
  '/favicon/favicon.ico',                 // Иконка сайта
  '/favicon/apple-touch-icon.png',        // Иконка для iOS
  '/favicon/site.webmanifest',            // Веб-манифест
  '/resources/obl_web.jpg',               // Фоновое изображение
  '/css/all.min.css',                     // Font Awesome стили
  '/fonts/rubik/rubik-regular.ttf'        // Основной шрифт
];

// Паттерны для стратегии Network First
const NETWORK_FIRST_PATTERNS = [
  /kodikapi\.com/,
  /shikimori\.one\/api/
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('Service Worker: Caching static assets');
        // Используем cache.addAll с обработкой ошибок для каждого запроса
        return Promise.all(
          STATIC_ASSETS.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`Service Worker: Failed to cache ${url}`, error);
            });
          })
        );
      })
      .then(() => {
        console.log('Service Worker: Installed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker: Installation failed', error);
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем старые кэши
          if (![STATIC_CACHE, DYNAMIC_CACHE, CACHE_NAME].includes(cacheName)) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем нетрадиционные схемы
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Пропускаем POST запросы и другие неподдерживаемые методы
  if (request.method !== 'GET') {
    return;
  }

  // Для API запросов используем стратегию Network First
  if (NETWORK_FIRST_PATTERNS.some(pattern => pattern.test(url.href))) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Для статических ресурсов используем стратегию Cache First
  if (isStaticAsset(request)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Для остальных запросов используем стратегию Stale While Revalidate
  event.respondWith(staleWhileRevalidateStrategy(request));
});

// Проверка, является ли запрос статическим ресурсом
function isStaticAsset(request) {
  const url = new URL(request.url);
  
  // Проверяем по расширениям файлов
  const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.woff', '.woff2', '.ttf'];
  if (staticExtensions.some(ext => url.pathname.endsWith(ext))) {
    return true;
  }
  
  // Проверяем по доменам CDN
  const cdnDomains = ['cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
  if (cdnDomains.some(domain => url.hostname.includes(domain))) {
    return true;
  }
  
  // Проверяем по точному совпадению с нашими ассетами
  return STATIC_ASSETS.some(asset => {
    if (asset.startsWith('/')) {
      return url.pathname === asset || url.pathname.endsWith(asset);
    }
    return url.href === asset;
  });
}

// Стратегия: Cache First (только для GET запросов)
async function cacheFirstStrategy(request) {
  try {
    // Проверяем, что это запрос к нашему домену
    if (!request.url.startsWith(self.location.origin)) {
      // Для внешних запросов просто делаем fetch без кэширования
      return fetch(request);
    }

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    
    // Кэшируем только успешные ответы и только для нашего домена
    if (networkResponse.status === 200 && request.url.startsWith(self.location.origin)) {
      const cache = await caches.open(STATIC_CACHE);
      // Создаем копию response для кэширования
      cache.put(request, networkResponse.clone()).catch(error => {
        console.warn('Service Worker: Failed to cache response', error);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Cache First strategy failed', error);
    // Возвращаем fallback для основных страниц
    if (request.url === self.location.origin + '/') {
      return caches.match('/index.html');
    }
    return new Response('Network error happened', {
      status: 408,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

// Стратегия: Network First (только для GET запросов)
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Кэшируем только успешные ответы
    if (networkResponse.status === 200) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone()).catch(error => {
        console.warn('Service Worker: Failed to cache API response', error);
      });
    }
    
    return networkResponse;
  } catch (error) {
    console.warn('Service Worker: Network First - falling back to cache');
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Fallback для API запросов
    return new Response(JSON.stringify({ error: 'Network unavailable' }), {
      status: 408,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// Стратегия: Stale While Revalidate (только для GET запросов)
async function staleWhileRevalidateStrategy(request) {
  try {
    const cachedResponse = await caches.match(request);
    
    // Независимо от наличия кэша, обновляем его в фоне
    const fetchPromise = fetch(request).then(async (networkResponse) => {
      if (networkResponse.status === 200) {
        const cache = await caches.open(DYNAMIC_CACHE);
        cache.put(request, networkResponse.clone()).catch(error => {
          console.warn('Service Worker: Failed to update cache in Stale While Revalidate', error);
        });
      }
      return networkResponse;
    }).catch(error => {
      console.warn('Service Worker: Background update failed', error);
      // Игнорируем ошибки фонового обновления
    });

    // Возвращаем кэшированный ответ или результат запроса
    return cachedResponse || fetchPromise;
  } catch (error) {
    console.error('Service Worker: Stale While Revalidate failed', error);
    return fetch(request);
  }
}

// Упрощенная фоновая синхронизация
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Обновляем кэш для основных API endpoints
    const cache = await caches.open(DYNAMIC_CACHE);
    console.log('Service Worker: Background sync completed');
  } catch (error) {
    console.error('Service Worker: Background sync failed', error);
  }
}

// Push уведомления (упрощенная версия)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Новые аниме ждут вас!',
      icon: '/favicon/apple-touch-icon.png',
      badge: '/favicon/apple-touch-icon.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'AniFox', options)
    );
  } catch (error) {
    console.error('Service Worker: Push notification error', error);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Ищем открытую вкладку с нашим сайтом
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Открываем новую вкладку если не нашли
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url || '/');
      }
    })
  );
});

// Обработка ошибок
self.addEventListener('error', (event) => {
  console.error('Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
});