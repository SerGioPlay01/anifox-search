/**
 * AniFox Anti-Adblock Banner v2.0
 * Улучшенная версия без внешних скриптов
 */
(function() {
  'use strict';

  // Конфигурация
  const CONFIG = {
    STORAGE_KEY: 'anifox-adblock-choice',
    STORAGE_KEY_WANT: 'anifox-adblock-want-disable',
    RE_CHECK_TRIES: 3,
    RE_CHECK_PAUSE: 1000,
    DETECTION_TIMEOUT: 2000
  };

  // Состояние приложения
  const state = {
    isLocked: false,
    currentBanner: null,
    detectionInProgress: false
  };

  /* ---------- Улучшенная система обнаружения без внешних скриптов ---------- */
  function detectAdblockHard() {
    return new Promise((resolve) => {
      if (state.detectionInProgress) {
        resolve(false);
        return;
      }

      state.detectionInProgress = true;
      let detectionCompleted = false;
      let blockedSignals = 0;
      const totalTests = 4;

      const timeoutId = setTimeout(() => {
        if (!detectionCompleted) {
          detectionCompleted = true;
          state.detectionInProgress = false;
          cleanupElements();
          resolve(blockedSignals >= 2); // Если 2+ теста показали блокировку
        }
      }, CONFIG.DETECTION_TIMEOUT);

      const cleanupElements = () => {
        baitElements.forEach(el => el.remove());
        fakeScript.remove();
        fakeIframe.remove();
      };

      const checkBlocked = () => {
        blockedSignals++;
      };

      // Тест 1: Bait элементы с классами рекламы
      const baitElements = [];
      const adClasses = [
        'ad-unit', 'ad-container', 'adsbox', 'ad-banner', 
        'advertisement', 'textads', 'banner-ad'
      ];

      adClasses.forEach(className => {
        const bait = document.createElement('div');
        bait.className = className;
        bait.style.cssText = `
          position: absolute;
          left: -9999px;
          top: -9999px;
          width: 1px;
          height: 1px;
          background-color: transparent;
        `;
        bait.innerHTML = '<div class="ad-text">Advertisement</div>';
        document.body.appendChild(bait);
        baitElements.push(bait);
      });

      // Тест 2: Fake скрипт с адблок-триггерами в URL
      const fakeScript = document.createElement('script');
      fakeScript.innerHTML = `
        // Fake ad script that should be blocked
        window._adScriptLoaded = true;
        if (typeof window.adDetectionCallback === 'function') {
          window.adDetectionCallback(false);
        }
      `;
      
      // Добавляем триггерные атрибуты
      fakeScript.setAttribute('type', 'text/javascript');
      fakeScript.setAttribute('data-ad-client', 'ca-pub-123456789');
      fakeScript.setAttribute('data-ad-slot', '1234567890');

      fakeScript.onerror = () => checkBlocked();
      
      // Если скрипт не выполнился за reasonable время
      setTimeout(() => {
        if (!window._adScriptLoaded) {
          checkBlocked();
        }
      }, 500);

      document.head.appendChild(fakeScript);

      // Тест 3: Fake iframe с рекламным URL
      const fakeIframe = document.createElement('iframe');
      fakeIframe.src = 'about:blank';
      fakeIframe.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 728px;
        height: 90px;
        border: none;
        visibility: hidden;
      `;
      fakeIframe.onload = function() {
        try {
          const iframeDoc = this.contentDocument || this.contentWindow.document;
          iframeDoc.open();
          iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Advertisement</title>
              <script>
                window.parent._adIframeLoaded = true;
              </script>
            </head>
            <body>
              <div class="banner-ad">Advertisement</div>
              <script src="http://ads.example.com/ad.js"></script>
            </body>
            </html>
          `);
          iframeDoc.close();
        } catch (e) {
          checkBlocked(); // Если доступ к iframe заблокирован
        }
      };
      fakeIframe.onerror = () => checkBlocked();

      document.body.appendChild(fakeIframe);

      // Тест 4: Проверка стилей bait элементов
      setTimeout(() => {
        baitElements.forEach(bait => {
          try {
            const computedStyle = window.getComputedStyle(bait);
            if (computedStyle.display === 'none' || 
                computedStyle.visibility === 'hidden' ||
                computedStyle.opacity === '0' ||
                computedStyle.height === '0px' ||
                computedStyle.width === '0px') {
              checkBlocked();
            }
          } catch (e) {
            // Ignore errors in style checking
          }
        });

        // Проверка iframe загрузки
        if (!window._adIframeLoaded) {
          setTimeout(() => {
            if (!window._adIframeLoaded) {
              checkBlocked();
            }
          }, 300);
        }
      }, 600);

      // Тест 5: MutationObserver для отслеживания удаления элементов
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.removedNodes) {
            if (node.nodeType === 1) { // ELEMENT_NODE
              const className = node.className || '';
              if (typeof className === 'string' && (
                className.includes('ad-') || 
                className.includes('banner') ||
                node.tagName === 'IFRAME'
              )) {
                checkBlocked();
              }
            }
          }
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      // Проверка браузерных блокировщиков
      detectBrowserBlockers().then((browserBlocked) => {
        if (browserBlocked) {
          checkBlocked();
        }
      });

      // Финальная проверка
      setTimeout(() => {
        if (!detectionCompleted) {
          detectionCompleted = true;
          clearTimeout(timeoutId);
          state.detectionInProgress = false;
          cleanupElements();
          observer.disconnect();
          
          // Очищаем глобальные переменные
          delete window._adScriptLoaded;
          delete window._adIframeLoaded;
          
          resolve(blockedSignals >= 2);
        }
      }, CONFIG.DETECTION_TIMEOUT - 100);
    });
  }

  async function detectBrowserBlockers() {
    const tests = [];
    
    // Brave Browser detection
    if (navigator.brave) {
      tests.push(new Promise(resolve => {
        try {
          navigator.brave.isBrave().then(result => resolve(result)).catch(() => resolve(false));
        } catch {
          resolve(false);
        }
      }));
    } else {
      tests.push(Promise.resolve(false));
    }

    // Ghostery detection
    tests.push(new Promise(resolve => {
      const ghosteryTests = [
        () => typeof window._ghostery !== 'undefined',
        () => typeof window.Ghostery !== 'undefined',
        () => document.documentElement.getAttribute('data-ghostery') !== null,
        () => navigator.userAgent.includes('Ghostery')
      ];
      
      for (const test of ghosteryTests) {
        if (test()) {
          resolve(true);
          return;
        }
      }
      resolve(false);
    }));

    // AdBlock detection via fake URL
    tests.push(new Promise(resolve => {
      const fakeImage = new Image();
      fakeImage.onload = () => resolve(false);
      fakeImage.onerror = () => resolve(true);
      fakeImage.src = 'https://pagead2.googlesyndication.com/pagead/images/blank.png';
      
      setTimeout(() => resolve(false), 500);
    }));

    const results = await Promise.all(tests);
    return results.some(result => result === true);
  }

  /* ---------- Улучшенная система баннеров ---------- */
  function buildBanner() {
    if (state.isLocked || document.querySelector('.ab-banner')) return;
    
    state.isLocked = true;
    state.currentBanner = document.createElement('div');
    state.currentBanner.className = 'ab-banner';
    
    const isMobile = window.innerWidth <= 768;
    
    state.currentBanner.innerHTML = `
      <div class="ab-content ${isMobile ? 'ab-content--mobile' : ''}">
        <div class="ab-header">
          <span class="ab-icon">❤️</span>
          <h3>Поддержите AniFox</h3>
          <button class="ab-close" id="ab-close" aria-label="Закрыть">×</button>
        </div>
        
        <div class="ab-main-content">
          <p class="ab-text">
            <span class="ab-icon">🛡️</span>
            Обнаружен блокировщик рекламы. Реклама помогает проекту оставаться бесплатным.
          </p>
          
          <div class="ab-stats">
            <div class="ab-stat"><span class="ab-icon">👥</span><span>500K+ пользователей в месяц</span></div>
            <div class="ab-stat"><span class="ab-icon">🎬</span><span>10K+ аниме доступно</span></div>
            <div class="ab-stat"><span class="ab-icon">⏰</span><span>24/7 без перебоев</span></div>
          </div>

          <div class="ab-info-grid">
            <div class="ab-info-block">
              <h4><span class="ab-icon">🖥️</span> Зачем нужна реклама?</h4>
              <ul>
                <li><span class="ab-icon">✅</span> Серверные расходы: хостинг, CDN, хранилище видео</li>
                <li><span class="ab-icon">✅</span> Ежедневное обновление базы аниме и метаданных</li>
                <li><span class="ab-icon">✅</span> Разработка новых функций и улучшение производительности</li>
              </ul>
            </div>
            <div class="ab-info-block">
              <h4><span class="ab-icon">📢</span> Типы рекламы</h4>
              <ul>
                <li><span class="ab-icon">✅</span> Баннерная реклама (ненавязчивая)</li>
                <li><span class="ab-icon">✅</span> Реклама в плеере от Kodik (можно пропустить)</li>
                <li><span class="ab-icon">✅</span> Партнерские программы стриминговых сервисов</li>
              </ul>
            </div>
          </div>

          <div class="ab-actions">
            <button class="ab-btn ab-btn--soft" id="ab-continue">
              <span class="ab-icon">🛡️</span> Продолжить с блокировщиком
            </button>
            <button class="ab-btn ab-btn--main" id="ab-disable">
              <span class="ab-icon">📢</span> Отключить блокировщик
            </button>
          </div>
        </div>
      </div>
    `;

    // Добавляем стили динамически
    addStyles();
    document.body.appendChild(state.currentBanner);
    document.body.classList.add('ab-scroll-lock');

    setupBannerEventListeners();
    
    // Анимация появления
    setTimeout(() => {
      state.currentBanner.classList.add('ab-banner--visible');
    }, 50);
  }

  function setupBannerEventListeners() {
    const banner = state.currentBanner;
    
    banner.querySelector('#ab-continue').addEventListener('click', () => {
      saveChoice('with-adblock');
    });

    banner.querySelector('#ab-disable').addEventListener('click', () => {
      onWantDisable();
    });

    banner.querySelector('#ab-close').addEventListener('click', () => {
      saveChoice('with-adblock');
    });

    banner.addEventListener('click', (e) => {
      if (e.target === banner) {
        saveChoice('with-adblock');
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
      }
    });
  }

  /* ---------- Инструкции ---------- */
  function showInstructions() {
    if (document.querySelector('.ab-instructions-modal')) return;

    const modal = document.createElement('div');
    modal.className = 'ab-instructions-modal';
    
    modal.innerHTML = `
      <div class="ab-instructions-content">
        <div class="ab-instructions-header">
          <h3><span class="ab-icon">ℹ️</span> Как отключить блокировщик</h3>
          <button class="ab-close" id="ab-instructions-close">×</button>
        </div>
        
        <div class="ab-instructions-grid">
          <div class="ab-instruction-item">
            <h4><span class="ab-icon">🔍</span> AdBlock / AdBlock Plus</h4>
            <ol>
              <li>Нажмите на иконку AdBlock в браузере</li>
              <li>Выберите "Не выполнять на страницах этого сайта"</li>
              <li>Обновите страницу</li>
            </ol>
          </div>
          
          <div class="ab-instruction-item">
            <h4><span class="ab-icon">🚫</span> uBlock Origin</h4>
            <ol>
              <li>Нажмите на иконку uBlock</li>
              <li>Кликните на большую кнопку питания</li>
              <li>Обновите страницу</li>
            </ol>
          </div>
          
          <div class="ab-instruction-item">
            <h4><span class="ab-icon">🛡️</span> AdGuard</h4>
            <ol>
              <li>Нажмите на иконку AdGuard</li>
              <li>Выключите защиту для этого сайта</li>
              <li>Обновите страницу</li>
            </ol>
          </div>
        </div>
        
        <div class="ab-instructions-actions">
          <button class="ab-btn ab-btn--main" id="ab-refresh-page">
            <span class="ab-icon">🔄</span> Обновить страницу
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#ab-instructions-close').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#ab-refresh-page').addEventListener('click', () => {
      window.location.reload();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  function saveChoice(value) {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY, value);
      localStorage.removeItem(CONFIG.STORAGE_KEY_WANT);
      hideBanner();
    } catch (e) {
      console.warn('Failed to save choice to localStorage:', e);
      hideBanner();
    }
  }

  function onWantDisable() {
    try {
      localStorage.setItem(CONFIG.STORAGE_KEY_WANT, '1');
      hideBanner();
      setTimeout(() => reCheckAdblock(), 1000);
    } catch (e) {
      console.warn('Failed to save want-disable flag:', e);
      hideBanner();
    }
  }

  function hideBanner() {
    if (!state.currentBanner) return;

    state.currentBanner.classList.remove('ab-banner--visible');
    
    setTimeout(() => {
      if (state.currentBanner) {
        state.currentBanner.remove();
        state.currentBanner = null;
      }
      document.body.classList.remove('ab-scroll-lock');
      state.isLocked = false;
    }, 300);
  }

  /* ---------- Улучшенная система повторной проверки ---------- */
  async function reCheckAdblock() {
    if (localStorage.getItem(CONFIG.STORAGE_KEY) === 'with-adblock') return;

    for (let i = 1; i <= CONFIG.RE_CHECK_TRIES; i++) {
      showProgress(`Проверка ${i} из ${CONFIG.RE_CHECK_TRIES}…`);
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.RE_CHECK_PAUSE));
      
      const stillBlocked = await detectAdblockHard();
      
      if (!stillBlocked) {
        hideProgress();
        saveChoice('disable-adblock');
        return;
      }
    }

    hideProgress();
    showReminder();
  }

  function showProgress(text) {
    hideProgress();
    
    const progress = document.createElement('div');
    progress.className = 'ab-progress';
    progress.innerHTML = `
      <div class="ab-progress-content">
        <div class="ab-progress-spinner"></div>
        <p>${text}</p>
      </div>
    `;
    
    document.body.appendChild(progress);
  }

  function hideProgress() {
    const progress = document.querySelector('.ab-progress');
    if (progress) {
      progress.remove();
    }
  }

  function showReminder() {
    if (document.querySelector('.ab-reminder')) return;
    
    const reminder = document.createElement('div');
    reminder.className = 'ab-reminder';
    
    reminder.innerHTML = `
      <div class="ab-reminder-content">
        <span class="ab-icon">⚠️</span>
        <h4>Блокировщик всё ещё активен</h4>
        <p>Пожалуйста, отключите расширение и нажмите кнопку ниже.</p>
        <div class="ab-reminder-actions">
          <button class="ab-btn ab-btn--main" id="ab-recheck">
            <span class="ab-icon">✅</span> Я всё сделал
          </button>
          <button class="ab-btn ab-btn--soft" id="ab-show-instructions">
            <span class="ab-icon">❓</span> Показать инструкции
          </button>
        </div>
      </div>
    `;
    
    document.body.appendChild(reminder);

    reminder.querySelector('#ab-recheck').addEventListener('click', () => {
      reminder.remove();
      setTimeout(() => reCheckAdblock(), 500);
    });

    reminder.querySelector('#ab-show-instructions').addEventListener('click', () => {
      reminder.remove();
      showInstructions();
    });
  }

  /* ---------- Инициализация ---------- */
  function init() {
    if (localStorage.getItem(CONFIG.STORAGE_KEY)) {
      return;
    }

    // Проверяем мобильные режимы
    const mobileBlockers = /Opera Mini|Chrome Lite|Yandex Turbo|Firefox Focus/i;
    if (mobileBlockers.test(navigator.userAgent)) {
      return;
    }

    // Запускаем обнаружение
    detectAdblockHard().then((blocked) => {
      if (blocked) {
        buildBanner();
      }
    });
  }

  // Запуск когда DOM готов
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Экспорт для отладки
  window.anifoxAdblockDetector = {
    version: '2.0',
    retest: () => {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      localStorage.removeItem(CONFIG.STORAGE_KEY_WANT);
      init();
    },
    reset: () => {
      localStorage.removeItem(CONFIG.STORAGE_KEY);
      localStorage.removeItem(CONFIG.STORAGE_KEY_WANT);
    }
  };
})();