/*
 * AniFox 2.4 - Анти-адблок баннер
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * Функции:
 * - Обнаружение блокировщиков рекламы
 * - Показ баннера с просьбой отключить блокировщик
 * - Инструкции по отключению для разных браузеров
 * - Сохранение выбора пользователя
 * - Повторная проверка после отключения
 */

// Обертываем весь код в IIFE для изоляции переменных
(() => {
  // ===========================================
  // НАСТРОЙКИ
  // ===========================================

  // Ключи для хранения выбора пользователя в localStorage
  const STORAGE_KEY = "anifox-adblock-choice";
  const STORAGE_KEY_WANT = "anifox-adblock-want-disable";

  // Настройки повторной проверки
  const RE_CHECK_TRIES = 3;        // Количество попыток проверки
  const RE_CHECK_PAUSE = 1000;     // Пауза между проверками (мс)

  // Блокировка множественного показа баннера
  let lock = false;

// ===========================================
// ОБНАРУЖЕНИЕ БЛОКИРОВЩИКОВ
// ===========================================

/**
 * Улучшенная проверка блокировщиков рекламы без ложных срабатываний
 * Использует более консервативный подход для точного обнаружения
 * @param {Function} callback - Функция обратного вызова с результатом
 */
function detectAdblockHard(callback) {
  let blockedSignals = 0;      // Счетчик сигналов блокировки
  const totalTests = 4;        // Общее количество тестов (уменьшено для точности)
  let testsCompleted = 0;      // Количество завершенных тестов
  let testResults = [];        // Результаты тестов для анализа

  /**
   * Проверка завершения всех тестов
   * Определяет, заблокирована ли реклама на основе результатов
   */
  function checkCompletion() {
    testsCompleted++;
    if (testsCompleted >= totalTests) {
      // Более консервативная логика обнаружения - требуем больше доказательств
      const reliableBlockedTests = testResults.filter(r => r.reliable && r.blocked).length;
      const anyBlockedTests = testResults.filter(r => r.blocked).length;
      
      // Блокировщик обнаружен только если:
      // 1. Хотя бы 2 надежных теста показали блокировку
      // 2. ИЛИ 3+ любых теста показали блокировку
      // 3. И общий счетчик сигналов >= 3
      const blocked = (reliableBlockedTests >= 2 || anyBlockedTests >= 3) && blockedSignals >= 3;
      
      // Отладочная информация (только для localhost)
      if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
        console.log('AniFox AdBlock Detection:', {
          blockedSignals,
          totalTests,
          testResults,
          reliableBlockedTests,
          anyBlockedTests,
          finalResult: blocked
        });
      }
      
      callback(blocked);
    }
  }

  // ===========================================
  // ТЕСТ 1: BAIT ЭЛЕМЕНТЫ (КОНСЕРВАТИВНЫЙ)
  // ===========================================
  const bait = document.createElement("div");
  bait.className = "ads ad-unit ad-banner advertisement google-ads adsense";
  bait.style.cssText = "position: absolute !important; left: -9999px !important; top: -9999px !important; width: 300px !important; height: 250px !important; display: block !important; visibility: visible !important;";
  bait.innerHTML = '<div class="ad-text">Advertisement</div><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="ad" width="300" height="250">';
  document.body.appendChild(bait);

  setTimeout(() => {
    const style = window.getComputedStyle(bait);
    // Более строгая проверка - элемент должен быть полностью скрыт
    const isBlocked = (style.display === "none" || 
                      style.visibility === "hidden" || 
                      style.height === "0px" || 
                      style.width === "0px") &&
                     (bait.offsetHeight === 0 || bait.offsetWidth === 0);
    
    if (isBlocked) blockedSignals += 2; // Увеличиваем вес надежного теста
    testResults.push({ test: 'bait-element', blocked: isBlocked, reliable: true });
    
    if (document.body.contains(bait)) {
      bait.remove();
    }
    checkCompletion();
  }, 300);

  // ===========================================
  // ТЕСТ 2: БРАУЗЕРНЫЕ БЛОКИРОВЩИКИ
  // ===========================================
  Promise.all([isBrave(), isGhostery()]).then(([brave, ghostery]) => {
    const hasBrowserBlocker = brave || ghostery;
    if (hasBrowserBlocker) blockedSignals += 2; // Увеличиваем вес надежного теста
    testResults.push({ test: 'browser-blocker', blocked: hasBrowserBlocker, reliable: true });
    checkCompletion();
  });

  // ===========================================
  // ТЕСТ 3: FAKE СКРИПТ (УЛУЧШЕННЫЙ)
  // ===========================================
  window._adTest = false;
  const fakeScript = document.createElement("script");
  fakeScript.innerHTML = "window._adTest = true;";
  fakeScript.setAttribute("data-ad-client", "ca-pub-123456789");
  fakeScript.setAttribute("async", "");
  fakeScript.className = "adsbygoogle";

  let scriptBlocked = false;
  fakeScript.onerror = () => {
    scriptBlocked = true;
  };

  document.head.appendChild(fakeScript);

  setTimeout(() => {
    const isBlocked = !window._adTest || scriptBlocked;
    if (isBlocked) blockedSignals++;
    testResults.push({ test: 'fake-script', blocked: isBlocked, reliable: false });
    
    if (document.head.contains(fakeScript)) {
      fakeScript.remove();
    }
    delete window._adTest;
    checkCompletion();
  }, 400);

  // ===========================================
  // ТЕСТ 4: ВНЕШНИЕ ЗАПРОСЫ (КОНСЕРВАТИВНЫЙ)
  // ===========================================
  // Проверяем блокировку только известных рекламных доменов
  const testUrls = [
    'https://googleads.g.doubleclick.net/pagead/ads?test=1'
  ];
  
  let externalBlocked = 0;
  let externalTestsCompleted = 0;
  
  // Добавляем таймаут для внешних запросов
  const timeoutId = setTimeout(() => {
    if (externalTestsCompleted === 0) {
      // Если запросы не завершились за 2 секунды, считаем что блокировщика нет
      testResults.push({ test: 'external-requests', blocked: false, reliable: true });
      checkCompletion();
    }
  }, 2000);
  
  testUrls.forEach(url => {
    fetch(url, { 
      method: 'HEAD', 
      mode: 'no-cors',
      cache: 'no-cache'
    }).then(() => {
      // Запрос прошел
      externalTestsCompleted++;
      clearTimeout(timeoutId);
      if (externalTestsCompleted >= testUrls.length) {
        const isBlocked = externalBlocked >= 1;
        if (isBlocked) blockedSignals++;
        testResults.push({ test: 'external-requests', blocked: isBlocked, reliable: true });
        checkCompletion();
      }
    }).catch(() => {
      // Запрос заблокирован
      externalBlocked++;
      externalTestsCompleted++;
      clearTimeout(timeoutId);
      if (externalTestsCompleted >= testUrls.length) {
        const isBlocked = externalBlocked >= 1;
        if (isBlocked) blockedSignals++;
        testResults.push({ test: 'external-requests', blocked: isBlocked, reliable: true });
        checkCompletion();
      }
    });
  });
}

  async function isBrave() {
    if (navigator.brave) {
      try {
        return await navigator.brave.isBrave();
      } catch {
        return false;
      }
    }
    return false;
  }

  async function isGhostery() {
    return new Promise((resolve) => {
      const checks = [
        () => typeof window._ghostery !== "undefined",
        () => typeof window.Ghostery !== "undefined",
        () => document.documentElement.getAttribute("data-ghostery") !== null,
      ];

      for (const check of checks) {
        if (check()) {
          resolve(true);
          return;
        }
      }

      const ghosteryTest = document.createElement("div");
      ghosteryTest.style.cssText = "display: none;";
      ghosteryTest.setAttribute("data-ghostery", "test");
      document.body.appendChild(ghosteryTest);

      setTimeout(() => {
        const style = window.getComputedStyle(ghosteryTest);
        resolve(style.display === "none");
        ghosteryTest.remove();
      }, 100);
    });
  }

  /* ---------- баннер ---------- */
  function buildBanner() {
    if (lock || document.querySelector(".ab-banner")) return;
    lock = true;
    document.body.classList.add("ab-scroll-lock");

    const b = document.createElement("div");
    b.className = "ab-banner";
    b.innerHTML = `
      <div class="ab-content">
        <div class="ab-header">
          <i class="fas fa-heart"></i>
          <h3>Поддержите AniFox</h3>
        </div>
        <p class="ab-text"><i class="fas fa-shield-alt"></i> Обнаружен блокировщик. Реклама помогает проекту оставаться бесплатным.</p>

        <div class="ab-stats">
          <div class="ab-stat"><i class="fas fa-users"></i><span>500K+ пользователей в месяц</span></div>
          <div class="ab-stat"><i class="fas fa-video"></i><span>10K+ аниме доступно</span></div>
          <div class="ab-stat"><i class="fas fa-clock"></i><span>24/7 без перебоев</span></div>
        </div>

        <div class="ab-info-grid">
          <div class="ab-info-block"><h4><i class="fas fa-server"></i> Зачем нужна реклама?</h4><ul>
            <li><i class="fas fa-check-circle"></i> Серверные расходы: хостинг, CDN, хранилище видео</li>
            <li><i class="fas fa-check-circle"></i> Ежедневное обновление базы аниме и метаданных</li>
            <li><i class="fas fa-check-circle"></i> Разработка новых функций и улучшение производительности</li>
            <li><i class="fas fa-check-circle"></i> Поддержка стабильной работы плееров и API</li>
            <li><i class="fas fa-check-circle"></i> Модерация контента и борьба с мертвыми ссылками</li>
          </ul></div>
          <div class="ab-info-block"><h4><i class="fas fa-ad"></i> Типы рекламы на сайте</h4><ul>
            <li><i class="fas fa-check-circle"></i> Баннерная реклама на сайте (ненавязчивая)</li>
            <li><i class="fas fa-check-circle"></i> Реклама в плеере от Kodik (можно пропустить)</li>
            <li><i class="fas fa-check-circle"></i> Партнерские программы легальных стриминговых сервисов</li>
          </ul><div class="ab-ad-warning"><i class="fas fa-info-circle"></i> Реклама Kodik в плеере: можно пропустить через 5-10 секунд</div></div>
          <div class="ab-info-block"><h4><i class="fas fa-gift"></i> Что вы получаете</h4><ul>
            <li><i class="fas fa-check-circle"></i> Бесплатный доступ к тысячам аниме без регистрации</li>
            <li><i class="fas fa-check-circle"></i> HD качество и стабильная работа плееров</li>
            <li><i class="fas fa-check-circle"></i> Регулярные обновления и новинки</li>
            <li><i class="fas fa-check-circle"></i> Отсутствие платных подписок и скрытых платежей</li>
            <li><i class="fas fa-check-circle"></i> Безопасность и отсутствие вредоносных программ</li>
          </ul></div>
        </div>

        <div class="ab-actions">
          <button class="ab-btn ab-btn--soft" id="ab-continue"><i class="fas fa-shield-alt"></i> Продолжить с блокировщиком</button>
          <button class="ab-btn ab-btn--main" id="ab-disable"><i class="fas fa-ad"></i> Отключить блокировщик</button>
          <button class="ab-btn ab-btn--link" id="ab-howto"><i class="fas fa-question-circle"></i> Как отключить?</button>
        </div>
      </div>`;
    document.body.appendChild(b);

    b.querySelector("#ab-continue").onclick = () => {
      saveChoice("with-adblock", b);
      insertMiniBanner();
    };
    b.querySelector("#ab-disable").onclick = () => onWantDisable(b);
    b.querySelector("#ab-howto").onclick = () => showInstructions();
  }

  /* ---------- компактный баннер-напоминание ---------- */
  function insertMiniBanner() {
    if (document.querySelector(".ab-mini-banner")) return;
    const m = document.createElement("div");
    m.className = "ab-mini-banner";
    m.innerHTML = `
      <div class="ab-mini-content">
        <span><i class="fas fa-info-circle"></i> Реклама помогает проекту. Поддержите нас!</span>
        <button class="ab-mini-btn" id="ab-mini-howto">Как отключить?</button>
      </div>`;
    document.body.appendChild(m);
    m.querySelector("#ab-mini-howto").onclick = () => showInstructions();
  }

  /* ---------- удаление мини-баннера ---------- */
  function removeMiniBanner() {
    document.querySelector(".ab-mini-banner")?.remove();
  }

/* ---------- инструкции ---------- */
function showInstructions() {
  const isBraveBrowser = navigator.brave && navigator.brave.isBrave;
  const isGhosteryActive = isGhostery();
  const modal = document.createElement("div");
  modal.className = "ab-instructions-modal";
  modal.innerHTML = `
    <div class="ab-instructions-content">
      <h3><i class="fas fa-info-circle"></i> Как отключить блокировщик</h3>
      <div class="ab-instructions-grid">
        <div class="ab-instruction-item">
          <h4>AdBlock / AdBlock Plus</h4>
          <ol>
            <li>Нажмите на иконку AdBlock в браузере</li>
            <li>Выберите "Не выполнять на страницах этого сайта"</li>
            <li>Обновите страницу</li>
          </ol>
        </div>
        <div class="ab-instruction-item">
          <h4>uBlock Origin</h4>
          <ol>
            <li>Нажмите на иконку uBlock</li>
            <li>Кликните на большую кнопку питания</li>
            <li>Обновите страницу</li>
          </ol>
        </div>
        <div class="ab-instruction-item">
          <h4>AdGuard</h4>
          <ol>
            <li>Нажмите на иконку AdGuard</li>
            <li>Выключите защиту для этого сайта</li>
            <li>Обновите страницу</li>
          </ol>
        </div>
        ${
          isBraveBrowser
            ? `
        <div class="ab-instruction-item brave-block">
          <h4>Brave Browser</h4>
          <ol>
            <li>Нажмите на иконку льва в адресной строке</li>
            <li>Включите переключатель "Блокировка рекламы: ВЫКЛ" для anifox-search.vercel.app</li>
            <li>Обновите страницу</li>
          </ol>
          <div class="brave-hint">Brave блокирует рекламу по умолчанию. Отключите защиту именно для этого сайта.</div>
        </div>`
            : ""
        }
        ${
          isGhosteryActive
            ? `
        <div class="ab-instruction-item ghostery-block">
          <h4>Ghostery Tracker & Ad Blocker</h4>
          <ol>
            <li>Нажмите на иконку Ghostery (призрак) в панели инструментов</li>
            <li>В открывшемся окне нажмите <b>«Доверять сайту»</b> или отключите <b>«Блокировка рекламы»</b></li>
            <li>Обновите страницу</li>
          </ol>
          <div class="ghostery-hint">Ghostery автоматически блокирует рекламу и трекеры. Добавьте сайт в доверенные, чтобы отключить блокировку.</div>
        </div>`
            : ""
        }
      </div>

      <!-- новая кнопка «Проверить снова» -->
      <button class="ab-btn ab-btn--main" id="ab-check-again">
        <i class="fas fa-sync"></i> Проверить снова
      </button>
    </div>`;
  document.body.appendChild(modal);

  // слушатель кнопки
  modal.querySelector('#ab-check-again').onclick = () => {
    modal.remove();                        // убираем модалку
    localStorage.removeItem(STORAGE_KEY);  // сбрасываем старый выбор
    localStorage.removeItem(STORAGE_KEY_WANT);
    location.reload();

    // перепроверяем реальное состояние
    detectAdblockHard(blocked => {
      if (blocked) {
        buildBanner();              // реклама всё ещё блокируется → баннер
      } else {
        removeMiniBanner();         // разблокировали → убираем всё
      }
    });
  };
}

  function saveChoice(value, banner) {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.removeItem(STORAGE_KEY_WANT);
    hideBanner(banner);
  }

  function onWantDisable(banner) {
    localStorage.setItem(STORAGE_KEY_WANT, "1");
    hideBanner(banner);
    setTimeout(() => reCheckAdblock(), 1000);
  }

  function hideBanner(el) {
    el.style.transform = "translateY(100%)";
    el.style.opacity = "0";
    document.body.classList.remove("ab-scroll-lock");
    setTimeout(() => el.remove(), 300);
  }

  /* ---------- повторная проверка (3 попытки) ---------- */
  async function reCheckAdblock() {
    if (localStorage.getItem(STORAGE_KEY) === "with-adblock") return;

    for (let i = 1; i <= RE_CHECK_TRIES; i++) {
      showProgress(`Проверка ${i} из ${RE_CHECK_TRIES}…`);
      await new Promise((r) => setTimeout(r, RE_CHECK_PAUSE));

      const stillBlocked = await new Promise((resolve) => {
        detectAdblockHard(resolve);
      });

      if (!stillBlocked) {
        hideProgress();
        localStorage.setItem(STORAGE_KEY, "disable-adblock");
        localStorage.removeItem(STORAGE_KEY_WANT);
        removeMiniBanner();          // <-- убираем баннер
        return;
      }
    }

    hideProgress();
    showReminder();
  }

  /* ---------- прогресс-окно ---------- */
  function showProgress(text) {
    hideProgress();
    const p = document.createElement("div");
    p.className = "ab-progress";
    p.innerHTML = `
      <div class="ab-progress-content">
        <div class="ab-progress-spinner"></div>
        <p>${text}</p>
      </div>`;
    document.body.appendChild(p);
  }

  function hideProgress() {
    document.querySelector(".ab-progress")?.remove();
  }

  function showReminder() {
    if (document.querySelector(".ab-reminder")) return;
    const r = document.createElement("div");
    r.className = "ab-reminder";
    r.innerHTML = `
      <div class="ab-reminder-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h4>Блокировщик всё ещё активен</h4>
        <p>Пожалуйста, отключите расширение и нажмите кнопку ниже.</p>
        <div class="ab-reminder-actions">
          <button class="ab-btn ab-btn--main" id="ab-recheck"><i class="fas fa-check"></i> Я всё сделал</button>
          <button class="ab-btn ab-btn--soft" id="ab-show-instructions"><i class="fas fa-question-circle"></i> Вызвать инструкции</button>
        </div>
      </div>`;
    document.body.appendChild(r);

    r.querySelector("#ab-recheck").onclick = () => {
      r.remove();
      setTimeout(() => {
        location.reload();
      }, 500);
    };
    r.querySelector("#ab-show-instructions").onclick = () => {
      r.remove();
      showInstructions();
    };
  }

/* ---------- запуск (консервативный детект) ---------- */
function run() {
  // Добавляем задержку для полной загрузки страницы и всех ресурсов
  setTimeout(() => {
    const choice = localStorage.getItem(STORAGE_KEY);

    /* 1.  Ранее выбрали «с блокировщиком» – проверим, не разблокировали ли рекламу */
    if (choice === 'with-adblock') {
      detectAdblockHard(blocked => {
        if (!blocked) {                // пользователь выключил блокировщик
          localStorage.setItem(STORAGE_KEY, 'disable-adblock');
          localStorage.removeItem(STORAGE_KEY_WANT);
          removeMiniBanner();
        } else {
          insertMiniBanner();          // всё ещё блокирует – показываем
        }
      });
      return;
    }

    /* 2.  Ранее выбрали «отключил блокировщик» – проверим, не включил ли обратно */
    if (choice === 'disable-adblock') {
      detectAdblockHard(blocked => {
        if (blocked) {                 // включил обратно → сбрасываем выбор
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(STORAGE_KEY_WANT);
          buildBanner();               // показываем полный баннер
        } else {
          removeMiniBanner();          // всё хорошо, реклама не блокируется
        }
      });
      return;
    }

    /* 3.  Первый заход или сброшен выбор – консервативная логика */
    // Дополнительная проверка: не показываем баннер на localhost/127.0.0.1
    if (window.location.hostname === '127.0.0.1' || 
        window.location.hostname === 'localhost' ||
        window.location.hostname === '') {
      console.log('AniFox AdBlock: Development environment detected, skipping banner');
      return;
    }

    detectAdblockHard(blocked => {
      if (blocked) {
        // Дополнительная проверка перед показом баннера
        setTimeout(() => {
          // Повторная проверка через 1 секунду для уверенности
          detectAdblockHard(stillBlocked => {
            if (stillBlocked) {
              buildBanner();
            } else {
              console.log('AniFox AdBlock: Second check showed no blocker, banner not shown');
            }
          });
        }, 1000);
      } else {
        // Отладочная информация для localhost
        if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
          console.log('AniFox AdBlock: No blocker detected, banner not shown');
        }
      }
    });
  }, 1000); // Увеличиваем задержку до 1 секунды
}

document.addEventListener('DOMContentLoaded', run);

// Публичный API для тестирования
window.AniFoxAdblock = {
  // Показать баннер принудительно
  showBanner: function() {
    const existingBanner = document.querySelector('.ab-banner');
    if (existingBanner) {
      existingBanner.remove();
    }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_WANT);
    buildBanner();
  },

  // Скрыть баннер
  hideBanner: function() {
    const banner = document.querySelector('.ab-banner');
    if (banner) {
      hideBanner(banner);
    }
    removeMiniBanner();
  },

  // Сбросить все настройки
  reset: function() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_WANT);
    const banner = document.querySelector('.ab-banner');
    if (banner) {
      hideBanner(banner);
    }
    removeMiniBanner();
  },

  // Проверить блокировщик вручную
  testDetection: function() {
    console.log('AniFox AdBlock: Manual detection test started...');
    detectAdblockHard(blocked => {
      console.log('AniFox AdBlock: Manual test result:', blocked);
      if (blocked) {
        console.log('AniFox AdBlock: Blocker detected, showing banner');
        this.showBanner();
      } else {
        console.log('AniFox AdBlock: No blocker detected');
      }
    });
  },

  // Принудительный тест с подробным выводом
  forceTest: function() {
    console.log('AniFox AdBlock: Force test started - ignoring cache...');
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_WANT);
    
    // Удаляем существующие баннеры
    const existingBanner = document.querySelector('.ab-banner');
    if (existingBanner) existingBanner.remove();
    removeMiniBanner();
    
    // Запускаем тест
    detectAdblockHard(blocked => {
      console.log('AniFox AdBlock: Force test completed');
      console.log('AniFox AdBlock: Result:', blocked ? 'BLOCKER DETECTED' : 'NO BLOCKER');
      
      if (blocked) {
        console.log('AniFox AdBlock: Showing banner due to detected blocker');
        buildBanner();
      } else {
        console.log('AniFox AdBlock: No banner shown - no blocker detected');
      }
    });
  },

  // Тест только определения без показа баннера
  testOnly: function() {
    console.log('AniFox AdBlock: Detection test only (no banner)...');
    detectAdblockHard(blocked => {
      console.log('AniFox AdBlock: Detection result:', blocked ? 'BLOCKER DETECTED' : 'NO BLOCKER');
      console.log('AniFox AdBlock: Banner would be', blocked ? 'SHOWN' : 'HIDDEN');
    });
  },

  // Получить статистику
  getStats: function() {
    return {
      hasChoice: !!localStorage.getItem(STORAGE_KEY),
      choice: localStorage.getItem(STORAGE_KEY),
      wantDisable: !!localStorage.getItem(STORAGE_KEY_WANT),
      bannerVisible: !!document.querySelector('.ab-banner'),
      miniBannerVisible: !!document.querySelector('.ab-mini-banner')
    };
  }
};

})();