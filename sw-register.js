// Регистрация Service Worker
class SWRegister {
  constructor() {
    this.swScope = '/';
    this.installButton = null;
    this.init();
  }

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        await this.registerSW();
        this.setupUpdateHandling();
        this.setupInstallPrompt();
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async registerSW() {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: this.swScope
    });

    console.log('Service Worker registered:', registration);

    // Проверяем наличие обновлений каждые 24 часа
    setInterval(() => {
      registration.update();
    }, 24 * 60 * 60 * 1000);

    return registration;
  }

  setupUpdateHandling() {
    let refreshing = false;

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });

    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'UPDATE_AVAILABLE') {
        this.showUpdateNotification();
      }
    });
  }

  setupInstallPrompt() {
    // Создаем кнопку установки заранее, но скрываем её
    this.createInstallButton();
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      
      // Показываем кнопку установки
      this.showInstallButton();
    });

    // Скрываем кнопку после установки
    window.addEventListener('appinstalled', () => {
      console.log('PWA installed successfully');
      this.hideInstallButton();
      window.deferredPrompt = null;
    });
  }

  createInstallButton() {
    // Проверяем, не существует ли уже кнопка
    if (document.getElementById('install-button')) {
      return;
    }

    this.installButton = document.createElement('button');
    this.installButton.id = 'install-button';
    this.installButton.className = 'install-pwa-btn';
    this.installButton.innerHTML = '<i class="fas fa-download"></i> Установить приложение';
    this.installButton.onclick = () => this.installApp();
    
    // Сначала скрываем кнопку
    this.installButton.style.display = 'none';
    
    const header = document.querySelector('.top');
    if (header) {
      header.appendChild(this.installButton);
    }
  }

  showInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'flex';
    }
  }

  hideInstallButton() {
    if (this.installButton) {
      this.installButton.style.display = 'none';
    }
  }

  async installApp() {
    const promptEvent = window.deferredPrompt;
    if (!promptEvent) {
      console.log('No install prompt available');
      return false;
    }

    try {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      
      console.log('User response to install prompt:', outcome);
      window.deferredPrompt = null;
      
      if (outcome === 'accepted') {
        this.hideInstallButton();
        this.showInstallSuccessMessage();
      }
      
      return outcome === 'accepted';
    } catch (error) {
      console.error('Installation failed:', error);
      return false;
    }
  }

  showInstallSuccessMessage() {
    const notification = document.createElement('div');
    notification.className = 'install-notification success';
    notification.innerHTML = `
      <div class="notification-content">
        <i class="fas fa-check-circle"></i>
        <span>Приложение успешно установлено!</span>
        <button onclick="this.parentElement.parentElement.remove()" class="notification-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, 5000);
  }

  showUpdateNotification() {
    if (this.isUpdateNotificationShown) return;

    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-content">
        <i class="fas fa-sync-alt"></i>
        <span>Доступно обновление!</span>
        <button onclick="window.location.reload()" class="update-btn">
          Обновить
        </button>
        <button onclick="this.parentElement.parentElement.remove()" class="notification-close">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;

    document.body.appendChild(notification);
    this.isUpdateNotificationShown = true;

    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
        this.isUpdateNotificationShown = false;
      }
    }, 10000);
  }

  // Проверка, можно ли показать кнопку установки
  static canShowInstallPrompt() {
    return !window.PWA.isInstalled() && window.deferredPrompt;
  }

  // Показать/скрыть кнопку вручную
  static toggleInstallButton(show) {
    const instance = window.swRegisterInstance;
    if (instance) {
      if (show && this.canShowInstallPrompt()) {
        instance.showInstallButton();
      } else {
        instance.hideInstallButton();
      }
    }
  }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  window.swRegisterInstance = new SWRegister();
  SWRegister.checkPwaSupport();
});

// Глобальные функции для PWA
window.PWA = {
  // Установка приложения
  async installApp() {
    const instance = window.swRegisterInstance;
    if (instance) {
      return instance.installApp();
    }
    return false;
  },

  // Проверка, установлено ли приложение
  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone ||
           document.referrer.includes('android-app://');
  },

  // Показать кнопку установки
  showInstallButton() {
    SWRegister.toggleInstallButton(true);
  },

  // Скрыть кнопку установки
  hideInstallButton() {
    SWRegister.toggleInstallButton(false);
  },

  // Проверить статус установки
  getInstallStatus() {
    return {
      isInstalled: this.isInstalled(),
      canInstall: SWRegister.canShowInstallPrompt(),
      hasPrompt: !!window.deferredPrompt
    };
  }
};

// Дополнительные обработчики для надежности
window.addEventListener('load', () => {
  // Проверяем статус установки после загрузки
  setTimeout(() => {
    const status = window.PWA.getInstallStatus();
    console.log('PWA Install Status:', status);
    
    // Если приложение уже установлено, скрываем кнопку
    if (status.isInstalled) {
      window.PWA.hideInstallButton();
    }
  }, 1000);
});

// Обработчик для случаев, когда beforeinstallprompt не сработал
if ('getInstalledRelatedApps' in window.navigator) {
  window.navigator.getInstalledRelatedApps().then((apps) => {
    if (apps && apps.length > 0) {
      console.log('App is already installed via getInstalledRelatedApps');
      window.PWA.hideInstallButton();
    }
  });
}

// Менеджер состояния PWA
class PWAManager {
  constructor() {
    this.installButton = null;
    this.init();
  }

  init() {
    this.checkExistingButton();
    this.setupEventListeners();
    this.updateUI();
  }

  checkExistingButton() {
    // Удаляем дублирующиеся кнопки
    const buttons = document.querySelectorAll('#install-button');
    if (buttons.length > 1) {
      for (let i = 1; i < buttons.length; i++) {
        buttons[i].remove();
      }
    }
  }

  setupEventListeners() {
    // Отслеживаем изменения в DOM на случай динамического добавления кнопок
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1 && node.id === 'install-button') {
            this.handleNewInstallButton(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  handleNewInstallButton(button) {
    // Если это дубликат, удаляем его
    const existingButton = document.getElementById('install-button');
    if (existingButton && existingButton !== button) {
      button.remove();
      return;
    }

    // Назначаем правильный обработчик
    button.onclick = () => window.PWA.installApp();
  }

  updateUI() {
    // Обновляем класс body в зависимости от статуса установки
    if (window.PWA.isInstalled()) {
      document.body.classList.add('pwa-installed');
      document.body.classList.remove('pwa-not-installed');
    } else {
      document.body.classList.add('pwa-not-installed');
      document.body.classList.remove('pwa-installed');
    }
  }

  // Показать кнопку установки с анимацией
  showInstallButton() {
    const button = document.getElementById('install-button');
    if (button) {
      button.style.display = 'flex';
      button.classList.add('show');
      
      // Анимация появления
      setTimeout(() => {
        button.style.opacity = '1';
        button.style.transform = 'scale(1)';
      }, 100);
    }
  }

  // Скрыть кнопку установки с анимацией
  hideInstallButton() {
    const button = document.getElementById('install-button');
    if (button) {
      button.style.opacity = '0';
      button.style.transform = 'scale(0.8)';
      
      setTimeout(() => {
        button.style.display = 'none';
        button.classList.remove('show');
      }, 300);
    }
  }
}

// Инициализация менеджера PWA
document.addEventListener('DOMContentLoaded', () => {
  window.pwaManager = new PWAManager();
});

// Переопределяем глобальные функции для использования менеджера
if (window.PWA) {
  const originalShow = window.PWA.showInstallButton;
  const originalHide = window.PWA.hideInstallButton;
  
  window.PWA.showInstallButton = function() {
    if (window.pwaManager) {
      window.pwaManager.showInstallButton();
    }
    return originalShow?.apply(this, arguments);
  };
  
  window.PWA.hideInstallButton = function() {
    if (window.pwaManager) {
      window.pwaManager.hideInstallButton();
    }
    return originalHide?.apply(this, arguments);
  };
}