/**
 * AniFox Anti-Adblock Banner
 * Улучшенная версия с лучшим обнаружением без внешних скриптов
 */
(() => {
  const STORAGE_KEY = "anifox-adblock-choice";
  const STORAGE_KEY_WANT = "anifox-adblock-want-disable";
  const RE_CHECK_TRIES = 3;
  const RE_CHECK_PAUSE = 1000;

  let lock = false;

  /* ---------- улучшенная проверка без внешних скриптов ---------- */
  function detectAdblockHard(callback) {
    let blockedSignals = 0;
    const totalTests = 4;
    let testsCompleted = 0;

    function checkCompletion() {
      testsCompleted++;
      if (testsCompleted >= totalTests) {
        const blocked = blockedSignals >= 2; // Если 2+ теста показали блокировку

        // Исключаем мобильные режимы
        const isMobileBlocked =
          /Opera Mini|Chrome Lite|Yandex Turbo|Firefox Focus/.test(
            navigator.userAgent
          );
        callback(blocked || isMobileBlocked);
      }
    }

    // Тест 1: Bait элементы с классами рекламы
    const bait = document.createElement("div");
    bait.className = "ads ad-unit ad-banner advertisement";
    bait.style.cssText =
      "position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px;";
    bait.innerHTML = '<div class="ad-text">Advertisement</div>';
    document.body.appendChild(bait);

    setTimeout(() => {
      const style = window.getComputedStyle(bait);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.height === "0px"
      ) {
        blockedSignals++;
      }
      bait.remove();
      checkCompletion();
    }, 300);

    // Тест 2: Fake скрипт с триггерными атрибутами
    const fakeScript = document.createElement("script");
    fakeScript.innerHTML = "window._adTest = true;";
    fakeScript.setAttribute("data-ad-client", "ca-pub-123456789");
    fakeScript.setAttribute("type", "text/javascript");

    fakeScript.onerror = () => {
      blockedSignals++;
      checkCompletion();
    };

    document.head.appendChild(fakeScript);

    setTimeout(() => {
      if (!window._adTest) {
        blockedSignals++;
      }
      fakeScript.remove();
      delete window._adTest;
      checkCompletion();
    }, 400);

    // Тест 3: Проверка браузерных блокировщиков
    Promise.all([isBrave(), isGhostery()]).then(([brave, ghostery]) => {
      if (brave || ghostery) {
        blockedSignals++;
      }
      checkCompletion();
    });

    // Тест 4: MutationObserver для отслеживания удаления элементов
    const testAd = document.createElement("div");
    testAd.className = "banner-ad textads";
    testAd.style.cssText =
      "position: absolute; left: -9999px; width: 1px; height: 1px;";
    document.body.appendChild(testAd);

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === testAd) {
            blockedSignals++;
            observer.disconnect();
            testAd.remove();
            checkCompletion();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      testAd.remove();
      checkCompletion();
    }, 500);
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
      // Проверка через различные методы обнаружения Ghostery
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

      // Дополнительная проверка
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

  /* ---------- улучшенный баннер с кнопкой "Как отключить?" ---------- */
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
        
        <!-- СТАТИСТИКА -->
        <div class="ab-stats">
          <div class="ab-stat"><i class="fas fa-users"></i><span>500K+ пользователей в месяц</span></div>
          <div class="ab-stat"><i class="fas fa-video"></i><span>10K+ аниме доступно</span></div>
          <div class="ab-stat"><i class="fas fa-clock"></i><span>24/7 без перебоев</span></div>
        </div>

        <!-- ПРЕИМУЩЕСТВА -->
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

        <!-- УЛУЧШЕННЫЕ КНОПКИ С ДОПОЛНИТЕЛЬНОЙ КНОПКОЙ -->
        <div class="ab-actions">
          <button class="ab-btn ab-btn--soft" id="ab-continue"><i class="fas fa-shield-alt"></i> Продолжить с блокировщиком</button>
          <button class="ab-btn ab-btn--help" id="ab-how-to-disable"><i class="fas fa-question-circle"></i> Как отключить?</button>
          <button class="ab-btn ab-btn--main" id="ab-disable"><i class="fas fa-ad"></i> Отключить блокировщик</button>
        </div>
      </div>`;
    document.body.appendChild(b);

    b.querySelector("#ab-continue").onclick = () => {
      saveChoice("with-adblock", b);
    };
    
    b.querySelector("#ab-how-to-disable").onclick = () => {
      showInstructions();
    };
    
    b.querySelector("#ab-disable").onclick = () => onWantDisable(b);
  }

  /* ---------- улучшенные инструкции с детекцией блокировщиков ---------- */
  function showInstructions() {
    const isBraveBrowser = navigator.brave;
    const modal = document.createElement("div");
    modal.className = "ab-instructions-modal";
    
    // Динамическое определение активных блокировщиков
    const activeBlockers = detectActiveBlockers();
    
    modal.innerHTML = `
      <div class="ab-instructions-content">
        <div class="ab-instructions-header">
          <h3><i class="fas fa-info-circle"></i> Как отключить блокировщик</h3>
          <button class="ab-close-btn" id="ab-close-instructions">&times;</button>
        </div>
        
        ${activeBlockers.length > 0 ? `
          <div class="ab-detected-blockers">
            <h4><i class="fas fa-bell"></i> Обнаруженные блокировщики:</h4>
            <div class="ab-blockers-list">
              ${activeBlockers.map(blocker => `
                <span class="ab-blocker-tag">${blocker}</span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        
        <div class="ab-instructions-grid">
          <div class="ab-instruction-item ${activeBlockers.includes('AdBlock') ? 'ab-active-blocker' : ''}">
            <h4><i class="fas fa-shield-alt"></i> AdBlock / AdBlock Plus</h4>
            <ol>
              <li>Нажмите на иконку AdBlock в браузере</li>
              <li>Выберите "Не выполнять на страницах этого сайта"</li>
              <li>Обновите страницу</li>
            </ol>
          </div>
          <div class="ab-instruction-item ${activeBlockers.includes('uBlock') ? 'ab-active-blocker' : ''}">
            <h4><i class="fas fa-cube"></i> uBlock Origin</h4>
            <ol>
              <li>Нажмите на иконку uBlock</li>
              <li>Кликните на большую кнопку питания</li>
              <li>Обновите страницу</li>
            </ol>
          </div>
          <div class="ab-instruction-item ${activeBlockers.includes('AdGuard') ? 'ab-active-blocker' : ''}">
            <h4><i class="fas fa-eye-slash"></i> AdGuard</h4>
            <ol>
              <li>Нажмите на иконку AdGuard</li>
              <li>Выключите защиту для этого сайта</li>
              <li>Обновите страницу</li>
            </ol>
          </div>
          ${isBraveBrowser ? `
          <div class="ab-instruction-item ab-active-blocker brave-block">
            <h4><i class="fab fa-brave"></i> Brave Browser</h4>
            <ol>
              <li>Нажмите на иконку льва в адресной строке</li>
              <li>Включите переключатель "Блокировка рекламы: ВЫКЛ" для anifox-search.vercel.app</li>
              <li>Обновите страницу</li>
            </ol>
            <div class="ab-blocker-hint">Brave блокирует рекламу по умолчанию. Отключите защиту именно для этого сайта.</div>
          </div>` : ''}
        </div>
        
        <div class="ab-instructions-footer">
          <button class="ab-btn ab-btn--main" id="ab-refresh-page">
            <i class="fas fa-sync"></i> Обновить страницу
          </button>
          <button class="ab-btn ab-btn--soft" id="ab-try-again">
            <i class="fas fa-redo"></i> Проверить снова
          </button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector("#ab-close-instructions").onclick = () => {
      modal.remove();
    };
    
    modal.querySelector("#ab-refresh-page").onclick = () => {
      window.location.reload();
    };
    
    modal.querySelector("#ab-try-again").onclick = () => {
      modal.remove();
      showProgress("Проверяем отключение блокировщика...");
      setTimeout(() => {
        detectAdblockHard((blocked) => {
          hideProgress();
          if (!blocked) {
            localStorage.setItem(STORAGE_KEY, "disable-adblock");
            showSuccessMessage();
          } else {
            showInstructions();
          }
        });
      }, 2000);
    };
  }

  /* ---------- детекция активных блокировщиков ---------- */
  function detectActiveBlockers() {
    const blockers = [];
    
    // Проверка AdBlock
    if (typeof window.adblock !== 'undefined' || 
        document.getElementById('ads') && 
        (document.getElementById('ads').offsetParent === null || 
         document.getElementById('ads').offsetHeight === 0)) {
      blockers.push('AdBlock');
    }
    
    // Проверка uBlock
    if (typeof window.uboIsBlocking !== 'undefined' || 
        typeof window.ublock !== 'undefined') {
      blockers.push('uBlock');
    }
    
    // Проверка AdGuard
    if (typeof window.adguard !== 'undefined' || 
        document.querySelector('script[src*="adguard"]')) {
      blockers.push('AdGuard');
    }
    
    // Проверка Ghostery
    if (typeof window._ghostery !== 'undefined' || 
        typeof window.Ghostery !== 'undefined') {
      blockers.push('Ghostery');
    }
    
    return blockers;
  }

  /* ---------- сообщение об успешном отключении ---------- */
  function showSuccessMessage() {
    const success = document.createElement("div");
    success.className = "ab-success-message";
    success.innerHTML = `
      <div class="ab-success-content">
        <i class="fas fa-check-circle"></i>
        <h4>Блокировщик отключен!</h4>
        <p>Спасибо за поддержку проекта! Теперь вы можете наслаждаться аниме без ограничений.</p>
        <button class="ab-btn ab-btn--main" onclick="this.closest('.ab-success-message').remove()">
          Продолжить
        </button>
      </div>`;
    document.body.appendChild(success);
  }

  function saveChoice(value, banner) {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.removeItem(STORAGE_KEY_WANT);
    hideBanner(banner);
  }

  function onWantDisable(banner) {
    localStorage.setItem(STORAGE_KEY_WANT, "1");
    hideBanner(banner);
    showProgress("Подготовка к проверке...");
    setTimeout(() => reCheckAdblock(), 1000);
  }

  function hideBanner(el) {
    el.style.transform = "translateY(100%)";
    el.style.opacity = "0";
    document.body.classList.remove("ab-scroll-lock");
    setTimeout(() => el.remove(), 300);
  }

  /* ---------- улучшенная повторная проверка ---------- */
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
        showSuccessMessage();
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
          <button class="ab-btn ab-btn--help" id="ab-show-instructions"><i class="fas fa-question-circle"></i> Показать инструкции</button>
        </div>
      </div>`;
    document.body.appendChild(r);

    r.querySelector("#ab-recheck").onclick = () => {
      r.remove();
      showProgress("Проверяем изменения...");
      setTimeout(() => {
        location.reload();
      }, 1500);
    };
    
    r.querySelector("#ab-show-instructions").onclick = () => {
      r.remove();
      showInstructions();
    };
  }

  /* ---------- запуск ---------- */
  function run() {
    if (localStorage.getItem(STORAGE_KEY)) return;
    
    // Если пользователь ранее хотел отключить блокировщик
    if (localStorage.getItem(STORAGE_KEY_WANT) === "1") {
      showProgress("Завершаем проверку...");
      setTimeout(() => reCheckAdblock(), 500);
      return;
    }
    
    detectAdblockHard((blocked) => {
      if (blocked) buildBanner();
    });
  }

  document.addEventListener("DOMContentLoaded", run);
})();