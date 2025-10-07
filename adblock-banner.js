/**
 * AniFox Anti-Adblock Banner
 * Показывает баннер только при активном блокировщике.
 * 1. "Продолжить с блокировщиком" — больше не показываем.
 * 2. "Отключить и продолжить" — проверяем до победного.
 * 3. Поддержка: AdBlock, uBlock, AdGuard, Brave, Ghostery.
 * 4. Всё хранится в localStorage, куки не нужны.
 */
(() => {
  const STORAGE_KEY = "anifox-adblock-choice"; // финальное решение
  const STORAGE_KEY_WANT = "anifox-adblock-want-disable"; // «хочет отключить»
  const AD_CHECK_URL =
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
  const GHOSTERY_CHECK = "https://www.ghostery.com/ghostery-ad-blocker"; // любой URL Ghostery
  const RE_CHECK_DELAY = 3000; // ms

  let lock = false;

  /* ---------- детект ---------- */
  async function detectAdblock() {
    try {
      await fetch(AD_CHECK_URL, { method: "HEAD", mode: "no-cors" });
      return false;
    } catch {
      return true;
    }
  }
  function hasAdblockCache() {
    const s = document.createElement("script");
    s.src = AD_CHECK_URL;
    s.async = true;
    document.head.appendChild(s);
    const blocked = !s.offsetHeight;
    s.remove();
    return blocked;
  }
  async function isBrave() {
    return (navigator.brave && (await navigator.brave.isBrave())) || false;
  }
  async function isGhostery() {
    // Ghostery блокирует доступ к своим же URL + общий тест
    try {
      await fetch(GHOSTERY_CHECK, { method: "HEAD", mode: "no-cors" });
      return false;
    } catch {
      return true;
    }
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
          <button class="ab-close">&times;</button>
        </div>
        <p class="ab-text"><i class="fas fa-shield-alt"></i> Обнаружен блокировщик. Реклама помогает проекту оставаться бесплатным.</p>
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
          <div class="ab-info-block"><h4><i class="fas fa-gift"></i> Что получаете вы</h4><ul>
            <li><i class="fas fa-check-circle"></i> Бесплатный доступ к тысячам аниме без регистрации</li>
            <li><i class="fas fa-check-circle"></i> HD качество и стабильная работа плееров</li>
            <li><i class="fas fa-check-circle"></i> Регулярные обновления и новинки</li>
            <li><i class="fas fa-check-circle"></i> Отсутствие платных подписок и скрытых платежей</li>
            <li><i class="fas fa-check-circle"></i> Безопасность и отсутствие вредоносных программ</li>
          </ul></div>
        </div>
        <div class="ab-stats">
          <div class="ab-stat"><i class="fas fa-users"></i><span>500K+ пользователей в месяц</span></div>
          <div class="ab-stat"><i class="fas fa-video"></i><span>10K+ аниме доступно</span></div>
          <div class="ab-stat"><i class="fas fa-clock"></i><span>24/7 без перебоев</span></div>
        </div>
        <div class="ab-actions">
          <button class="ab-btn ab-btn--soft" id="ab-continue"><i class="fas fa-shield-alt"></i> Продолжить с блокировщиком</button>
          <button class="ab-btn ab-btn--main" id="ab-disable"><i class="fas fa-ad"></i> Отключить блокировщик</button>
        </div>
      </div>`;
    document.body.appendChild(b);

    b.querySelector("#ab-continue").onclick = () => {
      // Если Brave или Ghostery — показываем инструкцию
      if (navigator.brave || isGhostery()) {
        showInstructions();
      }
      saveChoice("with-adblock", b);
    };
    b.querySelector("#ab-disable").onclick = () => onWantDisable(b);
    b.querySelector(".ab-close").onclick = () => saveChoice("dismissed", b);
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
        <button class="ab-btn ab-btn--main" onclick="this.closest('.ab-instructions-modal').remove(); window.location.reload();">
          <i class="fas fa-sync"></i> Обновить страницу
        </button>
      </div>`;
    document.body.appendChild(modal);
  }

  function saveChoice(value, banner) {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.removeItem(STORAGE_KEY_WANT);
    hideBanner(banner);
  }

  function onWantDisable(banner) {
    localStorage.setItem(STORAGE_KEY_WANT, "1");
    hideBanner(banner);
    setTimeout(() => reCheckAdblock(), RE_CHECK_DELAY);
  }

  function hideBanner(el) {
    el.style.transform = "translateY(100%)";
    el.style.opacity = "0";
    document.body.classList.remove("ab-scroll-lock");
    setTimeout(() => el.remove(), 300);
  }

  /* ---------- повторная проверка (улучшенная) ---------- */
  const RECHECK_TRIES = 3;
  const RECHECK_PAUSE = 1500; // ms между попытками

  async function reCheckAdblock() {
    if (localStorage.getItem(STORAGE_KEY) === "with-adblock") return;

    for (let attempt = 1; attempt <= RECHECK_TRIES; attempt++) {
      // Прогресс для пользователя
      showProgress(`Проверка ${attempt} из ${RECHECK_TRIES}…`);

      // Ждём + сбрасываем кеш (случайный параметр)
      await new Promise((r) => setTimeout(r, RECHECK_PAUSE));
      const rnd = "?t=" + Date.now();

      const stillBlocked =
        (await detectAdblock()) ||
        hasAdblockCache() ||
        (await isBrave()) ||
        (await isGhostery());

      if (!stillBlocked) {
        // ✅ убрали блокировку
        hideProgress();
        localStorage.setItem(STORAGE_KEY, "disable-adblock");
        localStorage.removeItem(STORAGE_KEY_WANT);
        return;
      }
    }

    // ❌ после 3-х попыток всё ещё блокирует
    hideProgress();
    showReminder();
  }

  /* ---------- прогресс-окно ---------- */
  function showProgress(text) {
    hideProgress(); // на случай дубля
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
      setTimeout(() => reCheckAdblock(), 500);
    };
    r.querySelector("#ab-show-instructions").onclick = () => {
      r.remove();
      showInstructions();
    };
  }

  /* ---------- запуск ---------- */
  async function run() {
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (localStorage.getItem(STORAGE_KEY_WANT)) {
      reCheckAdblock();
      return;
    }
    const blocked =
      (await detectAdblock()) ||
      hasAdblockCache() ||
      (await isBrave()) ||
      (await isGhostery());
    if (blocked) buildBanner();
  }

  document.addEventListener("DOMContentLoaded", run);
})();
