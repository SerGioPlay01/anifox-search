/**
 * AniFox Anti-Adblock Banner
 * Показывает баннер только при активном блокировщике.
 * 1. "Продолжить с блокировщиком" — больше не показываем.
 * 2. "Отключить и продолжить" — проверяем до победного.
 * 3. Всё хранится в localStorage, куки не нужны.
 */
(() => {
  const STORAGE_KEY       = 'anifox-adblock-choice';   // финальное решение
  const STORAGE_KEY_WANT  = 'anifox-adblock-want-disable'; // «хочет отключить»
  const AD_CHECK_URL      = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
  const RE_CHECK_DELAY    = 3000; // ms

  let lock = false;

  /* ---------- детект ---------- */
  async function detectAdblock() {
    try { await fetch(AD_CHECK_URL, { method: 'HEAD', mode: 'no-cors' }); return false; } catch { return true; }
  }
  function hasAdblockCache() {
    const s = document.createElement('script');
    s.src = AD_CHECK_URL; s.async = true; document.head.appendChild(s);
    const blocked = !s.offsetHeight; s.remove(); return blocked;
  }

  /* ---------- баннер ---------- */
  function buildBanner() {
    if (lock || document.querySelector('.ab-banner')) return;
    lock = true;

    const b = document.createElement('div');
    b.className = 'ab-banner';
    b.innerHTML = `
      <div class="ab-content">
        <div class="ab-header">
          <i class="fas fa-heart"></i>
          <h3>Поддержите AniFox</h3>
          <button class="ab-close">&times;</button>
        </div>
        <p class="ab-text"><i class="fas fa-shield-alt"></i> Обнаружен блокировщик. Реклама помогает проекту оставаться бесплатным.</p>
        <div class="ab-actions">
          <button class="ab-btn ab-btn--soft" id="ab-continue"><i class="fas fa-shield-alt"></i> Продолжить с блокировщиком</button>
          <button class="ab-btn ab-btn--main" id="ab-disable"><i class="fas fa-ad"></i> Отключить и продолжить</button>
        </div>
      </div>`;
    document.body.appendChild(b);

    b.querySelector('#ab-continue').onclick  = () => saveChoice('with-adblock', b);
    b.querySelector('#ab-disable').onclick   = () => onWantDisable(b);
    b.querySelector('.ab-close').onclick     = () => saveChoice('dismissed', b);
  }

  function saveChoice(value, banner) {
    localStorage.setItem(STORAGE_KEY, value);
    localStorage.removeItem(STORAGE_KEY_WANT);
    hideBanner(banner);
  }

  function onWantDisable(banner) {
    localStorage.setItem(STORAGE_KEY_WANT, '1');
    hideBanner(banner);
    setTimeout(() => reCheckAdblock(), RE_CHECK_DELAY);
  }

  function hideBanner(el) {
    el.style.transform = 'translateY(100%)'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  }

  /* ---------- повторная проверка ---------- */
  async function reCheckAdblock() {
    if (localStorage.getItem(STORAGE_KEY) === 'with-adblock') return;

    const stillBlocked = await detectAdblock() || hasAdblockCache();
    if (!stillBlocked) {               // ✅ разблокировали
      localStorage.setItem(STORAGE_KEY, 'disable-adblock');
      localStorage.removeItem(STORAGE_KEY_WANT);
      return;
    }
    showReminder();                    // ❌ ещё блокирует
  }

  function showReminder() {
    if (document.querySelector('.ab-reminder')) return;
    const r = document.createElement('div'); r.className = 'ab-reminder';
    r.innerHTML = `
      <div class="ab-reminder-content">
        <i class="fas fa-exclamation-triangle"></i>
        <h4>Блокировщик всё ещё активен</h4>
        <p>Пожалуйста, отключите расширение и нажмите кнопку ниже.</p>
        <button class="ab-btn ab-btn--main" id="ab-recheck">
          <i class="fas fa-check"></i> Я всё сделал
        </button>
      </div>`;
    document.body.appendChild(r);
    r.querySelector('#ab-recheck').onclick = () => {
      r.remove(); setTimeout(() => reCheckAdblock(), 500);
    };
  }

  /* ---------- запуск ---------- */
  async function run() {
    if (localStorage.getItem(STORAGE_KEY)) return;          // решение принято
    if (localStorage.getItem(STORAGE_KEY_WANT)) {           // хочет отключить
      reCheckAdblock(); return;
    }
    const blocked = await detectAdblock() || hasAdblockCache();
    if (blocked) buildBanner();
  }

  document.addEventListener('DOMContentLoaded', run);
})();