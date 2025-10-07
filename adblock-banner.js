(() => {
  const STORAGE_KEY = "anifox-adblock-choice"; // финальное решение
  const STORAGE_KEY_WANT = "anifox-adblock-want-disable"; // «хочет отключить»
  const STORAGE_KEY_RECHECK = "anifox-adblock-recheck";
  const AD_CHECK_URL =
    "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";
  const KODIK_AD_URL = "https://bd.kodik.biz/";

  let lock = false;

  // Подробная информация о поддержке сайта
  const SUPPORT_INFO = {
    whyImportant: [
      "Серверные расходы: хостинг, CDN, хранилище видео",
      "Ежедневное обновление базы аниме и метаданных",
      "Разработка новых функций и улучшение производительности",
      "Поддержка стабильной работы плееров и API",
      "Модерация контента и борьба с мертвыми ссылками",
    ],
    revenueTypes: [
      "Баннерная реклама на сайте (ненавязчивая)",
      "Реклама в плеере от Kodik (можно пропустить)",
      "Партнерские программы легальных стриминговых сервисов",
    ],
    userBenefits: [
      "Бесплатный доступ к тысячам аниме без регистрации",
      "HD качество и стабильная работа плееров",
      "Регулярные обновления и новинки",
      "Отсутствие платных подписок и скрытых платежей",
      "Безопасность и отсутствие вредоносных программ",
    ],
  };

  async function detectAdblock() {
    try {
      await fetch(AD_CHECK_URL, { method: "HEAD", mode: "no-cors" });
      return false;
    } catch {
      return true;
    }
  }

  function hasAdblockCache() {
    const script = document.createElement("script");
    script.src = AD_CHECK_URL;
    script.async = true;
    document.head.appendChild(script);
    const blocked = !script.offsetHeight;
    script.remove();
    return blocked;
  }

  function formatList(items) {
    return items
      .map((item) => `<li><i class="fas fa-check-circle"></i> ${item}</li>`)
      .join("");
  }

  function buildBanner() {
    if (lock) return;
    lock = true;

    const banner = document.createElement("div");
    banner.className = "ab-banner";
    banner.innerHTML = `
      <div class="ab-content">
        <div class="ab-header">
          <i class="fas fa-heart"></i>
          <h3>Поддержите AniFox</h3>
          <button class="ab-close">&times;</button>
        </div>
        
        <div class="ab-body">
          <p class="ab-text">
            <i class="fas fa-shield-alt"></i>
            Обнаружен блокировщик рекламы. Реклама помогает проекту оставаться бесплатным для всех пользователей.
          </p>
          
          <div class="ab-info-grid">
            <div class="ab-info-block">
              <h4><i class="fas fa-server"></i> Зачем нужна реклама?</h4>
              <ul>${formatList(SUPPORT_INFO.whyImportant)}</ul>
            </div>
            
            <div class="ab-info-block">
              <h4><i class="fas fa-ad"></i> Типы рекламы на сайте</h4>
              <ul>${formatList(SUPPORT_INFO.revenueTypes)}</ul>
              <div class="ab-ad-warning">
                <i class="fas fa-info-circle"></i>
                Реклама Kodik в плеере: можно пропустить через 5-10 секунд
              </div>
            </div>
            
            <div class="ab-info-block">
              <h4><i class="fas fa-gift"></i> Что получаете вы</h4>
              <ul>${formatList(SUPPORT_INFO.userBenefits)}</ul>
            </div>
          </div>
          
          <div class="ab-stats">
            <div class="ab-stat">
              <i class="fas fa-users"></i>
              <span>500K+ пользователей в месяц</span>
            </div>
            <div class="ab-stat">
              <i class="fas fa-video"></i>
              <span>10K+ аниме доступно</span>
            </div>
            <div class="ab-stat">
              <i class="fas fa-clock"></i>
              <span>24/7 без перебоев</span>
            </div>
          </div>
        </div>
        
        <div class="ab-actions">
          <button class="ab-btn ab-btn--soft" id="ab-continue">
            <i class="fas fa-shield-alt"></i>
            Продолжить с блокировщиком
          </button>
          <button class="ab-btn ab-btn--main" id="ab-disable">
            <i class="fas fa-ad"></i>
            Отключить блокировщик
          </button>
        </div>
        
        <div class="ab-footer">
          <p>Вы можете изменить свое решение в любое время, очистив localStorage браузера</p>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    // Обработчики кнопок
    banner.querySelector("#ab-continue").onclick = () => {
      localStorage.setItem(STORAGE_KEY, "with-adblock");
      localStorage.setItem(STORAGE_KEY + "-date", new Date().toISOString());
      hideBanner(banner);
    };

    banner.querySelector("#ab-disable").onclick = () => {
      localStorage.setItem(STORAGE_KEY, "disable-adblock");
      localStorage.setItem(STORAGE_KEY + "-date", new Date().toISOString());
      hideBanner(banner);
      showInstructions();
    };

    banner.querySelector(".ab-close").onclick = () => {
      localStorage.setItem(STORAGE_KEY, "dismissed");
      localStorage.setItem(STORAGE_KEY + "-date", new Date().toISOString());
      hideBanner(banner);
    };
  }

  function showInstructions() {
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
        </div>
        <button class="ab-btn ab-btn--main" onclick="this.closest('.ab-instructions-modal').remove(); window.location.reload();">
          <i class="fas fa-sync"></i> Обновить страницу
        </button>
      </div>
    `;
    document.body.appendChild(modal);
  }

  function hideBanner(banner) {
    banner.style.transform = "translateY(100%)";
    banner.style.opacity = "0";
    setTimeout(() => banner.remove(), 300);
  }

  async function run() {
    if (localStorage.getItem(STORAGE_KEY)) return;
    const detected = (await detectAdblock()) || hasAdblockCache();
    if (detected) buildBanner();
  }

  document.addEventListener("DOMContentLoaded", run);
})();

/* ---------- после нажатия «Отключить» НЕ пишем сразу choice ---------- */
function onWantDisable() {
  localStorage.setItem(STORAGE_KEY_WANT, '1');   // только флаг «хочет»
  setTimeout(() => reCheckAdblock(), RE_CHECK_DELAY);
}

/* ---------- повторная проверка ---------- */
async function reCheckAdblock() {
  // пользователь уже нажимал «с блокировщиком» — не докучаем
  if (localStorage.getItem(STORAGE_KEY) === 'with-adblock') return;

  const stillBlocked = await detectAdblock() || hasAdblockCache();
  if (!stillBlocked) {
    // ✅ реклама разблокирована — фиксируем выбор
    localStorage.setItem(STORAGE_KEY, 'disable-adblock');
    localStorage.removeItem(STORAGE_KEY_WANT);
    return;
  }

  // ❌ всё ещё заблокировано — показываем напоминание
  showReminder();
}

function hideBanner(banner) {
  banner.style.transform = "translateY(100%)";
  banner.style.opacity = "0";
  setTimeout(() => banner.remove(), 300);

  // если пользователь выбрал «отключить», запускаем повторную проверку
  if (localStorage.getItem(STORAGE_KEY) === "disable-adblock") {
    setTimeout(() => reCheckAdblock(), RE_CHECK_DELAY);
  }
}


function showReminder() {
  if (document.querySelector('.ab-reminder')) return; // уже показано

  const r = document.createElement('div');
  r.className = 'ab-reminder';
  r.innerHTML = `
    <div class="ab-reminder-content">
      <i class="fas fa-exclamation-triangle"></i>
      <h4>Блокировщик всё ещё активен</h4>
      <p>Пожалуйста, отключите расширение и нажмите кнопку ниже.</p>
      <button class="ab-btn ab-btn--main" id="ab-recheck-btn">
        <i class="fas fa-check"></i> Я всё сделал
      </button>
    </div>`;
  document.body.appendChild(r);

  r.querySelector('#ab-recheck-btn').onclick = () => {
    r.remove();
    setTimeout(() => reCheckAdblock(), 500); // снова проверяем
  };
}