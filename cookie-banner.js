(() => {
  const STORAGE_KEY = 'anifox-cookies-accepted';

  function init() {
    if (localStorage.getItem(STORAGE_KEY)) return;
    buildBanner();
  }

  function buildBanner() {
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = `
      <p class="cookie-text">
        Мы используем файлы cookie, чтобы сделать сайт удобнее.
        Подробности читайте в&nbsp;<a href="https://anifox-search.vercel.app/privacy-policy.html" target="_blank" class="cookie-link">политике конфиденциальности</a>.
      </p>
      <div class="cookie-actions">
        <button class="cookie-btn" aria-label="Я ознакомлен(а)">Я ознакомлен(а)</button>
      </div>
    `;
    document.body.appendChild(banner);

    banner.querySelector('.cookie-btn').addEventListener('click', () => {
      localStorage.setItem(STORAGE_KEY, '1');
      banner.classList.add('hidden');
      setTimeout(() => banner.remove(), 300);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();