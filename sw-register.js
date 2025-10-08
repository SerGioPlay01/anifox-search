// sw-register.js — легковесный, надёжный регистратор Service Worker + PWA UI

class AniFoxPWA {
  constructor() {
    if (window.aniFoxPWAInstance) {
      console.warn('AniFoxPWA уже инициализирован');
      return;
    }
    window.aniFoxPWAInstance = this;

    this.installButton = null;
    this.isUpdateNotificationShown = false;
    this.deferredPrompt = null;

    this.init();
  }

  async init() {
    if (!('serviceWorker' in navigator)) return;

    try {
      await this.registerServiceWorker();
      this.setupUpdateListener();
      this.setupInstallPrompt();
      this.createInstallButton();
    } catch (err) {
      console.error('❌ Ошибка инициализации PWA:', err);
    }
  }

  async registerServiceWorker() {
    const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    console.log('✅ Service Worker зарегистрирован:', registration);

    // Проверка обновлений раз в 24 часа
    setInterval(() => registration.update(), 24 * 60 * 60 * 1000);
    return registration;
  }

  setupUpdateListener() {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        this.showUpdateNotification();
      }
    });
  }

  setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
      console.log('✅ PWA установлено');
      this.hideInstallButton();
      this.deferredPrompt = null;
    });
  }

  createInstallButton() {
    if (document.getElementById('install-button')) return;

    this.installButton = document.createElement('button');
    this.installButton.id = 'install-button';
    this.installButton.className = 'install-pwa-btn';
    this.installButton.innerHTML = '<i class="fas fa-download"></i> Установить приложение';
    this.installButton.style.display = 'none';
    this.installButton.onclick = () => this.promptInstall();

    const header = document.querySelector('.top');
    if (header) header.appendChild(this.installButton);
  }

  showInstallButton() {
    if (this.isInstalled() || !this.installButton) return;
    this.installButton.style.display = 'flex';
  }

  hideInstallButton() {
    if (this.installButton) this.installButton.style.display = 'none';
  }

  isInstalled() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone ||
      document.referrer.includes('android-app://')
    );
  }

  async promptInstall() {
    if (!this.deferredPrompt) {
      console.warn('⚠️ Нет отложенного запроса на установку');
      return false;
    }

    try {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;

      if (outcome === 'accepted') {
        this.hideInstallButton();
        this.showSuccessMessage();
      }
      return outcome === 'accepted';
    } catch (err) {
      console.error('❌ Ошибка при установке PWA:', err);
      return false;
    }
  }

  showSuccessMessage() {
    const msg = document.createElement('div');
    msg.className = 'install-notification success';
    msg.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-check-circle"></i>
        <span>Приложение успешно установлено!</span>
        <button class="notification-close" onclick="this.closest('.install-notification').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    document.body.appendChild(msg);
    setTimeout(() => msg.remove(), 5000);
  }

  showUpdateNotification() {
    if (this.isUpdateNotificationShown) return;

    const notif = document.createElement('div');
    notif.className = 'update-notification';
    notif.innerHTML = `
      <div class="update-content">
        <i class="fas fa-sync-alt"></i>
        <span>Доступно обновление!</span>
        <button class="update-btn" onclick="window.location.reload()">Обновить</button>
        <button class="notification-close" onclick="this.closest('.update-notification').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    document.body.appendChild(notif);
    this.isUpdateNotificationShown = true;

    setTimeout(() => {
      if (notif.parentNode) {
        notif.remove();
        this.isUpdateNotificationShown = false;
      }
    }, 10000);
  }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
  new AniFoxPWA();
});

// Глобальный помощник (опционально, для отладки)
window.PWA = {
  install: () => window.aniFoxPWAInstance?.promptInstall(),
  isInstalled: () => window.aniFoxPWAInstance?.isInstalled() ?? false,
  showInstall: () => window.aniFoxPWAInstance?.showInstallButton(),
  hideInstall: () => window.aniFoxPWAInstance?.hideInstallButton()
};