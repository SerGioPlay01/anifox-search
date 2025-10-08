// sw-register.js
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

// PWA Install Prompt
let deferredPrompt;
const installButton = document.createElement('button');

window.addEventListener('beforeinstallprompt', (e) => {
  // Предотвращаем автоматическое отображение баннера
  e.preventDefault();
  deferredPrompt = e;
  
  // Показываем свою кнопку установки
  showInstallButton();
});

function showInstallButton() {
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

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  installButton.style.display = 'none';
  deferredPrompt = null;
});