/*
 * AniFox 2.4 - Баннер согласия на использование cookies
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * Функции:
 * - Отображение баннера согласия на cookies
 * - Сохранение согласия пользователя в localStorage
 * - Соответствие требованиям GDPR и других регуляций
 */

// Обертываем в IIFE для защиты от блокировки
(() => {
  'use strict';

  // ===========================================
  // НАСТРОЙКИ
  // ===========================================

  // Ключ для хранения согласия в localStorage
  const STORAGE_KEY = 'anifox-cookies-accepted';

  // ===========================================
  // ОСНОВНЫЕ ФУНКЦИИ
  // ===========================================

  /**
   * Инициализация баннера cookies
   * Проверяет, дал ли пользователь согласие ранее
   */
  function init() {
    // Если пользователь уже дал согласие, баннер не показываем
    if (localStorage.getItem(STORAGE_KEY)) return;
    
    // Показываем баннер
    buildBanner();
  }

  /**
   * Создание и отображение баннера согласия
   * Создает DOM-элемент баннера и добавляет обработчики событий
   */
  function buildBanner() {
    // Создаем контейнер баннера с защищенными атрибутами
    const banner = document.createElement('div');
    banner.className = 'privacy-consent-banner';
    
    // Добавляем защитные атрибуты
    banner.setAttribute('data-privacy', 'consent');
    banner.setAttribute('data-anifox', 'privacy-banner');
    
    // HTML содержимое баннера
    banner.innerHTML = `
      <p class="consent-text">
        Мы используем файлы cookie, чтобы сделать сайт удобнее.
        Подробности читайте в&nbsp;<a href="https://anifox-search.vercel.app/privacy-policy.html" target="_blank" class="consent-link">политике конфиденциальности</a>.
      </p>
      <div class="consent-actions">
        <button class="consent-btn" aria-label="Я ознакомлен(а)">Я ознакомлен(а)</button>
      </div>
    `;
    
    // Принудительные стили для защиты от блокировки
    banner.style.cssText += 'display: block !important; visibility: visible !important;';
    
    // Добавляем баннер на страницу
    document.body.appendChild(banner);

    // Обработчик клика по кнопке согласия
    banner.querySelector('.consent-btn').addEventListener('click', () => {
      // Сохраняем согласие в localStorage
      localStorage.setItem(STORAGE_KEY, '1');
      
      // Скрываем баннер с анимацией
      banner.classList.add('hidden');
      
      // Удаляем баннер из DOM после анимации
      setTimeout(() => banner.remove(), 300);
    });
  }

  // ===========================================
  // ИНИЦИАЛИЗАЦИЯ
  // ===========================================

  // Запускаем инициализацию после загрузки DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Публичный API для тестирования
  window.AniFoxCookies = {
    // Показать баннер принудительно
    showBanner: function() {
      const existingBanner = document.querySelector('.privacy-consent-banner');
      if (existingBanner) {
        existingBanner.remove();
      }
      localStorage.removeItem(STORAGE_KEY);
      buildBanner();
    },

    // Скрыть баннер
    hideBanner: function() {
      const banner = document.querySelector('.privacy-consent-banner');
      if (banner) {
        banner.classList.add('hidden');
        setTimeout(() => banner.remove(), 300);
      }
    },

    // Сбросить согласие
    reset: function() {
      localStorage.removeItem(STORAGE_KEY);
      this.showBanner();
    },

    // Получить статус согласия
    getStatus: function() {
      return {
        accepted: !!localStorage.getItem(STORAGE_KEY),
        bannerVisible: !!document.querySelector('.privacy-consent-banner')
      };
    }
  };

  // Создаем объект, который ожидает fallback
  window.AniFoxPrivacy = window.AniFoxCookies;

  // Добавляем функции для совместимости с fallback
  window.acceptAllCookies = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const banner = document.querySelector('.privacy-consent-banner');
    if (banner) {
      banner.classList.add('hidden');
      setTimeout(() => banner.remove(), 300);
    }
  };

  window.acceptNecessaryCookies = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    const banner = document.querySelector('.privacy-consent-banner');
    if (banner) {
      banner.classList.add('hidden');
      setTimeout(() => banner.remove(), 300);
    }
  };

})();