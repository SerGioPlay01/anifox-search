/**
 * Улучшенный прелоадер с отслеживанием загрузки критических ресурсов
 * Оптимизирован для производительности и надежности
 */
((config = {}) => {
  const {
    preloaderId = 'preloader-site-full',
    timeout = 7000,
    minDisplayTime = 500,
    excludeSelectors = ['script[src*="analytics"]', 'img[loading="lazy"]']
  } = config;

  const preloader = document.getElementById(preloaderId);
  if (!preloader) return;

  // Получаем только критические ресурсы
  const criticalResources = getCriticalResources(excludeSelectors);
  if (criticalResources.length === 0) {
    hidePreloader();
    return;
  }

  const loadedResources = new Set();
  let isHidden = false;
  const startTime = Date.now();

  const hidePreloader = () => {
    if (isHidden) return;
    
    const elapsed = Date.now() - startTime;
    const remainingTime = Math.max(0, minDisplayTime - elapsed);
    
    setTimeout(() => {
      preloader.classList.add('hidden');
      document.body.style.overflow = '';
      document.documentElement.classList.remove('preloader-active');
      isHidden = true;
      
      // Очищаем ссылки на ресурсы
      loadedResources.clear();
    }, remainingTime);
  };

  const handleResourceLoad = (resource) => {
    if (isHidden) return;
    
    loadedResources.add(resource);
    
    if (loadedResources.size === criticalResources.length) {
      hidePreloader();
    }
  };

  const handleResourceError = (resource) => {
    console.warn('Resource failed to load:', resource.src || resource.href);
    handleResourceLoad(resource); // Продолжаем, даже если ресурс не загрузился
  };

  // Отслеживаем загрузку ресурсов
  trackResources(criticalResources, handleResourceLoad, handleResourceError);

  // Фолбек по таймауту
  const timeoutId = setTimeout(() => {
    if (!isHidden) {
      console.warn('Preloader hidden due to timeout');
      hidePreloader();
    }
  }, timeout);

  // Очистка таймаута при успешной загрузке
  const originalHide = hidePreloader;
  hidePreloader = () => {
    clearTimeout(timeoutId);
    originalHide();
  };

})(window.preloaderConfig); // Можно передать конфиг извне

/**
 * Получает критические ресурсы для отслеживания
 */
function getCriticalResources(excludeSelectors = []) {
  const selectors = [
    'link[rel="stylesheet"]:not([media="print"])',
    'script[src]:not([async]):not([defer])',
    'img:not([loading="lazy"]):not([decoding="async"])'
  ].join(',');

  const allResources = Array.from(document.querySelectorAll(selectors));
  
  // Фильтруем исключенные ресурсы
  return allResources.filter(resource => {
    return !excludeSelectors.some(selector => resource.matches(selector));
  });
}

/**
 * Отслеживает загрузку ресурсов
 */
function trackResources(resources, onLoad, onError) {
  resources.forEach(resource => {
    const tagName = resource.tagName.toLowerCase();
    
    switch (tagName) {
      case 'img':
        handleImage(resource, onLoad, onError);
        break;
        
      case 'link':
        handleStylesheet(resource, onLoad, onError);
        break;
        
      case 'script':
        handleScript(resource, onLoad, onError);
        break;
        
      default:
        onLoad(resource); // Для неизвестных типов считаем загруженными
    }
  });
}

/**
 * Обрабатывает загрузку изображений
 */
function handleImage(img, onLoad, onError) {
  if (img.complete && img.naturalWidth !== 0) {
    onLoad(img);
  } else {
    img.addEventListener('load', () => onLoad(img), { once: true });
    img.addEventListener('error', () => onError(img), { once: true });
    
    // Для SVG может не сработать событие load
    if (img.src?.endsWith('.svg')) {
      setTimeout(() => {
        if (img.complete) onLoad(img);
      }, 100);
    }
  }
}

/**
 * Обрабатывает загрузку стилей
 */
function handleStylesheet(link, onLoad, onError) {
  // Проверяем, применены ли стили
  const isLoaded = () => {
    try {
      return link.sheet || link.loaded;
    } catch (e) {
      return false;
    }
  };

  if (isLoaded()) {
    onLoad(link);
  } else {
    link.addEventListener('load', () => onLoad(link), { once: true });
    link.addEventListener('error', () => onError(link), { once: true });
    
    // Фолбек для старых браузеров
    setTimeout(() => {
      if (isLoaded()) onLoad(link);
    }, 100);
  }
}

/**
 * Обрабатывает загрузку скриптов
 */
function handleScript(script, onLoad, onError) {
  if (script.readyState === 'complete' || script.readyState === 'loaded') {
    onLoad(script);
  } else {
    script.addEventListener('load', () => onLoad(script), { once: true });
    script.addEventListener('error', () => onError(script), { once: true });
  }
}