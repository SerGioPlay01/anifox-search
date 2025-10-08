/**
 * Прелоадер с реальным отслеживанием загрузки ресурсов
 * Скрывает прелоадер только после полной загрузки всех критичных ресурсов
 */

(() => {
  const preloader = document.getElementById('preloader-site-full');
  if (!preloader) return;

  const resources = Array.from(document.querySelectorAll('img, link[rel="stylesheet"], script[src]'));
  const loaded = new Set();
  const timeout = 5000; // Максимальное время ожидания (5 секунд)

  const hidePreloader = () => {
    preloader.classList.add('hidden');
    document.body.style.overflow = '';
  };

  const onLoad = (resource) => {
    loaded.add(resource);
    if (loaded.size === resources.length) {
      setTimeout(hidePreloader, 300); // Плавное исчезновение
    }
  };

  const onError = (resource) => {
    console.warn('Не удалось загрузить ресурс:', resource);
    onLoad(resource); // Считаем, что ресурс "загружен", чтобы не блокировать
  };

  resources.forEach((res) => {
    if (res.tagName === 'IMG') {
      if (res.complete) {
        onLoad(res);
      } else {
        res.addEventListener('load', () => onLoad(res));
        res.addEventListener('error', () => onError(res));
      }
    } else if (res.tagName === 'LINK' || res.tagName === 'SCRIPT') {
      if (res.sheet || res.readyState === 'complete') {
        onLoad(res);
      } else {
        res.addEventListener('load', () => onLoad(res));
        res.addEventListener('error', () => onError(res));
      }
    }
  });

  // Фолбек: скрываем прелоадер через 5 секунд, даже если что-то не загрузилось
  setTimeout(() => {
    if (!preloader.classList.contains('hidden')) {
      console.warn('Прелоадер скрыт по таймауту');
      hidePreloader();
    }
  }, timeout);
})();