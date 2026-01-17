/*
 * AniFox 2.4 - Критические исправления для мобильных устройств
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * КРИТИЧЕСКИЕ ИСПРАВЛЕНИЯ:
 * - Принудительное включение скролла на мобильных
 * - Исправление загрузки изображений
 * - Оптимизация производительности
 */

(function() {
    'use strict';

    // Определение мобильного устройства
    const isMobile = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    };

    // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ СКРОЛЛА
    function forceEnableScroll() {
        if (!isMobile()) return;
        
        const styles = {
            overflow: 'auto !important',
            overflowY: 'auto !important',
            overflowX: 'hidden !important',
            height: 'auto !important',
            minHeight: '100vh !important',
            position: 'static !important',
            webkitOverflowScrolling: 'touch !important',
            touchAction: 'manipulation !important'
        };
        
        // Применяем стили к html и body
        Object.assign(document.documentElement.style, styles);
        Object.assign(document.body.style, styles);
        
        // Убираем проблемные классы
        const problematicClasses = ['modal-open', 'ab-scroll-lock', 'preloader-active', 'scroll-locked', 'no-scroll'];
        problematicClasses.forEach(cls => {
            document.documentElement.classList.remove(cls);
            document.body.classList.remove(cls);
        });
    }

    // ИСПРАВЛЕНИЕ ЗАГРУЗКИ ИЗОБРАЖЕНИЙ
    function fixImages() {
        // Глобальная функция для обработки ошибок изображений
        window.fixBrokenImage = function(img) {
            if (img.dataset.fixed) return;
            
            img.dataset.fixed = 'true';
            img.style.cssText = `
                background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%) !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: white !important;
                font-size: 2rem !important;
                position: relative !important;
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
            `;
            img.innerHTML = '<span style="z-index: 1; pointer-events: none;">📺</span>';
            img.onerror = null;
        };
        
        // Исправляем все изображения на странице
        function fixAllImages() {
            const images = document.querySelectorAll('img');
            images.forEach(img => {
                // Проверяем проблемные изображения
                if (!img.src || img.src === '' || img.src.includes('undefined') || img.src.includes('null')) {
                    window.fixBrokenImage(img);
                }
                
                // Добавляем обработчик ошибок
                if (!img.onerror && !img.dataset.fixed) {
                    img.onerror = () => window.fixBrokenImage(img);
                }
                
                // Принудительно загружаем изображения на мобильных
                if (isMobile() && img.loading === 'lazy') {
                    img.loading = 'eager';
                }
            });
        }
        
        // Исправляем изображения сразу и через интервалы
        fixAllImages();
        setTimeout(fixAllImages, 500);
        setTimeout(fixAllImages, 1500);
        setTimeout(fixAllImages, 3000);
        
        // Наблюдаем за новыми изображениями
        const observer = new MutationObserver(() => {
            setTimeout(fixAllImages, 100);
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // ОПТИМИЗАЦИЯ ПРОИЗВОДИТЕЛЬНОСТИ
    function optimizePerformance() {
        if (!isMobile()) return;
        
        // Отключаем сложные анимации на слабых устройствах
        if (navigator.hardwareConcurrency <= 2 || navigator.deviceMemory <= 2) {
            const style = document.createElement('style');
            style.textContent = `
                * {
                    animation-duration: 0.1s !important;
                    transition-duration: 0.1s !important;
                }
                .anime-card:hover {
                    transform: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Оптимизация скролла
        let ticking = false;
        
        function updateScrollPosition() {
            const scrollTop = window.pageYOffset;
            const scrollBtn = document.getElementById('scrollToTop');
            
            if (scrollBtn) {
                scrollBtn.classList.toggle('show', scrollTop > 300);
            }
            
            ticking = false;
        }
        
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(updateScrollPosition);
                ticking = true;
            }
        }, { passive: true });
    }

    // ИНИЦИАЛИЗАЦИЯ ИСПРАВЛЕНИЙ
    function init() {
        console.log('🔧 Применяем критические исправления для мобильных устройств...');
        
        // Применяем исправления сразу
        forceEnableScroll();
        fixImages();
        optimizePerformance();
        
        // Повторяем исправления через интервалы для надежности
        setTimeout(forceEnableScroll, 100);
        setTimeout(forceEnableScroll, 500);
        setTimeout(forceEnableScroll, 1000);
        
        // Исправляем скролл при изменении ориентации
        window.addEventListener('orientationchange', () => {
            setTimeout(forceEnableScroll, 100);
        });
        
        // Исправляем скролл при изменении размера окна
        window.addEventListener('resize', () => {
            setTimeout(forceEnableScroll, 100);
        });
        
        // Наблюдаем за изменениями DOM
        const observer = new MutationObserver((mutations) => {
            let needsScrollFix = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target === document.documentElement || target === document.body) {
                        needsScrollFix = true;
                    }
                }
            });
            
            if (needsScrollFix) {
                setTimeout(forceEnableScroll, 10);
            }
        });
        
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] });
        
        console.log('✅ Критические исправления применены успешно');
    }

    // Запускаем исправления как можно раньше
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Экспортируем функции для глобального использования
    window.MobileFixes = {
        forceEnableScroll,
        fixImages,
        optimizePerformance
    };

})();