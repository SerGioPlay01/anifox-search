/*
 * AniFox 2.4 - Регистрация Service Worker и PWA
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * Функции:
 * - Регистрация Service Worker для кэширования
 * - PWA установка приложения
 * - Управление установочным баннером
 */

// ===========================================
// SERVICE WORKER
// ===========================================

// Регистрация Service Worker для кэширования ресурсов
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/service-worker.js')
      .then(function(registration) {
        console.log('ServiceWorker registration successful');
      })
      .catch(function(error) {
        console.log('ServiceWorker registration failed: ', error);
      });
  });
}

// ===========================================
// PWA УСТАНОВКА
// ===========================================

// Переменные для управления установкой PWA
let deferredPrompt;                    // Отложенный промпт установки
const installButton = document.createElement('button');  // Кнопка установки

// Обработчик события готовности к установке PWA
window.addEventListener('beforeinstallprompt', (e) => {
  // Предотвращаем автоматическое отображение баннера
  e.preventDefault();
  deferredPrompt = e;
  
  // Показываем свою кнопку установки
  showInstallButton();
});

/**
 * Создание и отображение кнопки установки PWA
 * Стилизует кнопку и добавляет обработчик клика
 */
function showInstallButton() {
  // Стилизация кнопки установки
  installButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 10px 20px;
    background: #5b0a99;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    z-index: 1000;
  `;
  installButton.textContent = 'Установить приложение';
  document.body.appendChild(installButton);
  
  // Обработчик клика по кнопке установки
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // Показываем установочный баннер
    deferredPrompt.prompt();
    
    // Ждем ответа пользователя
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      installButton.style.display = 'none';
    } else {
      console.log('User dismissed the install prompt');
    }
    
    deferredPrompt = null;
  });
}

// Обработчик успешной установки PWA
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  installButton.style.display = 'none';
  deferredPrompt = null;
});