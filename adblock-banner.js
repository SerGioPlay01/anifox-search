/**
 * AniFox Anti-Adblock Banner 2.0
 * Максимально быстрая одноразовая проверка + автоматическое переключение
 */
(() => {
  const STORAGE_KEY = 'anifox-adblock-choice';   // 'with-adblock' | 'disable-adblock'
  let lock = false;

  /* ---------- 4 теста параллельно ---------- */
  async function detectAdblockFast() {
    const tests = await Promise.all([
      baitTest(),
      fakeScriptTest(),
      browserTest(),
      mutationTest()
    ]);
    // ≥2 положительных → считаем заблокированным
    return tests.filter(Boolean).length >= 2;
  }

  /* 1. Bait-элемент */
  function baitTest() {
    return new Promise(res => {
      const b = document.createElement('div');
      b.className = 'ads ad-unit ad-banner advertisement';
      b.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;';
      b.innerHTML = '<div class="ad-text">Advertisement</div>';
      document.body.appendChild(b);
      requestAnimationFrame(() => {
        const st = getComputedStyle(b);
        const blocked = st.display === 'none' || st.visibility === 'hidden' || st.height === '0px';
        b.remove();
        res(blocked);
      });
    });
  }

  /* 2. Фейковый скрипт */
  function fakeScriptTest() {
    return new Promise(res => {
      const s = document.createElement('script');
      s.innerHTML = 'window._abT=1';
      s.setAttribute('data-ad-client', 'ca-pub-123');
      s.onerror = () => res(true);
      document.head.appendChild(s);
      requestAnimationFrame(() => {
        const blocked = !window._abT;
        delete window._abT;
        s.remove();
        res(blocked);
      });
    });
  }

  /* 3. Браузерные блокировщики */
  async function browserTest() {
    const brave = navigator.brave && await navigator.brave.isBrave().catch(() => false);
    const ghost = 'Ghostery' in window || '_ghostery' in window || document.documentElement.dataset.ghostery != null;
    return Boolean(brave || ghost);
  }

  /* 4. Mutation-тест */
  function mutationTest() {
    return new Promise(res => {
      const el = document.createElement('div');
      el.className = 'banner-ad textads';
      el.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(el);

      const ob = new MutationObserver(() => {
        if (!document.body.contains(el)) {
          ob.disconnect();
          res(true);
        }
      });
      ob.observe(document.body, { childList: true, subtree: true });

      // через 400 мс считаем, что не удалили
      setTimeout(() => {
        ob.disconnect();
        el.remove();
        res(false);
      }, 400);
    });
  }

  /* ---------- баннеры ---------- */
  function buildBigBanner() {
    if (lock || document.querySelector('.ab-banner')) return;
    lock = true;
    document.body.classList.add('ab-scroll-lock');

    const b = document.createElement('div');
    b.className = 'ab-banner';
    b.innerHTML = `
      <div class="ab-content">
        <div class="ab-header"><i class="fas fa-heart"></i><h3>Поддержите AniFox</h3></div>
        <p class="ab-text"><i class="fas fa-shield-alt"></i> Обнаружен блокировщик. Реклама помогает проекту оставаться бесплатным.</p>
        <div class="ab-actions">
          <button class="ab-btn ab-btn--soft" id="ab-cont"><i class="fas fa-shield-alt"></i> Продолжить с блокировщиком</button>
          <button class="ab-btn ab-btn--main" id="ab-off"><i class="fas fa-ad"></i> Отключить блокировщик</button>
          <button class="ab-btn ab-btn--link" id="ab-how"><i class="fas fa-question-circle"></i> Как отключить?</button>
        </div>
      </div>`;
    document.body.appendChild(b);

    b.querySelector('#ab-cont').onclick = () => { saveChoice('with-adblock', b); insertMiniBanner(); };
    b.querySelector('#ab-off').onclick = () => { saveChoice('disable-adblock', b); removeMiniBanner(); location.reload(); };
    b.querySelector('#ab-how').onclick = () => showInstructions();
  }

  function insertMiniBanner() {
    if (document.querySelector('.ab-mini-banner')) return;
    const m = document.createElement('div');
    m.className = 'ab-mini-banner';
    m.innerHTML = `
      <div class="ab-mini-content">
        <span><i class="fas fa-info-circle"></i> Реклама помогает проекту. Поддержите нас!</span>
        <button class="ab-mini-btn" id="ab-mini-how">Как отключить?</button>
      </div>`;
    document.body.appendChild(m);
    m.querySelector('#ab-mini-how').onclick = () => showInstructions();
  }

  function removeMiniBanner() {
    document.querySelector('.ab-mini-banner')?.remove();
  }

  /* ---------- инструкции ---------- */
  function showInstructions() {
    const isBrave = navigator.brave && navigator.brave.isBrave;
    const isGhost = 'Ghostery' in window || '_ghostery' in window || document.documentElement.dataset.ghostery != null;

    const modal = document.createElement('div');
    modal.className = 'ab-instructions-modal';
    modal.innerHTML = `
      <div class="ab-instructions-content">
        <h3><i class="fas fa-info-circle"></i> Как отключить блокировщик</h3>
        <div class="ab-instructions-grid">
          <div class="ab-instruction-item">
            <h4>AdBlock / AdBlock Plus</h4>
            <ol><li>Нажмите на иконку AdBlock в браузере</li><li>Выберите "Не выполнять на страницах этого сайта"</li><li>Обновите страницу</li></ol>
          </div>
          <div class="ab-instruction-item">
            <h4>uBlock Origin</h4>
            <ol><li>Нажмите на иконку uBlock</li><li>Кликните на большую кнопку питания</li><li>Обновите страницу</li></ol>
          </div>
          <div class="ab-instruction-item">
            <h4>AdGuard</h4>
            <ol><li>Нажмите на иконку AdGuard</li><li>Выключите защиту для этого сайта</li><li>Обновите страницу</li></ol>
          </div>
          ${
            isBrave
              ? `<div class="ab-instruction-item brave-block">
                   <h4>Brave Browser</h4>
                   <ol><li>Нажмите на иконку льва в адресной строке</li><li>Отключите "Блокировку рекламы" для этого сайта</li><li>Обновите страницу</li></ol>
                 </div>`
              : ''
          }
          ${
            isGhost
              ? `<div class="ab-instruction-item ghostery-block">
                   <h4>Ghostery</h4>
                   <ol><li>Нажмите на иконку призрака</li><li>Нажмите "Доверять сайту" или отключите "Блокировку рекламы"</li><li>Обновите страницу</li></ol>
                 </div>`
              : ''
          }
        </div>
        <button class="ab-btn ab-btn--main" onclick="this.closest('.ab-instructions-modal').remove(); location.reload();">
          <i class="fas fa-sync"></i> Обновить страницу
        </button>
      </div>`;
    document.body.appendChild(modal);
  }

  function saveChoice(value, banner) {
    localStorage.setItem(STORAGE_KEY, value);
    hideBanner(banner);
  }

  function hideBanner(el) {
    el.style.transform = 'translateY(100%)';
    el.style.opacity = '0';
    document.body.classList.remove('ab-scroll-lock');
    setTimeout(() => el.remove(), 300);
  }

  /* ---------- основной запуск ---------- */
  async function run() {
    const choice = localStorage.getItem(STORAGE_KEY);
    const blocked = await detectAdblockFast();

    // пользователь ранее нажал «С блокировщиком», но щас реклама разблокирована
    if (choice === 'with-adblock' && !blocked) {
      localStorage.setItem(STORAGE_KEY, 'disable-adblock');
      removeMiniBanner();
      return;
    }

    // ранее не выбирали – показываем большой баннер
    if (!choice && blocked) {
      buildBigBanner();
      return;
    }

    // ранее нажали «С блокировщиком» и реклама всё ещё блокируется
    if (choice === 'with-adblock' && blocked) {
      insertMiniBanner();
      return;
    }

    // иначе считаем, что всё ок – ничего не показываем
    removeMiniBanner();
  }

  document.addEventListener('DOMContentLoaded', run);
})();