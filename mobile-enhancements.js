/*
 * AniFox 2.4 - Мобильные улучшения (JavaScript)
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * Функции для улучшения мобильного опыта
 */

(function() {
    'use strict';

    // =========================================
    // ОПРЕДЕЛЕНИЕ МОБИЛЬНОГО УСТРОЙСТВА
    // =========================================
    
    const isMobile = () => {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    };

    const isTouch = () => {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    };

    // =========================================
    // VIEWPORT УПРАВЛЕНИЕ И ИСПРАВЛЕНИЕ СКРОЛЛА
    // =========================================
    
    function handleViewportChanges() {
        const viewport = document.querySelector('meta[name="viewport"]');
        
        // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Принудительно включаем скролл на мобильных
        function forceEnableScroll() {
            document.documentElement.style.overflow = 'auto';
            document.documentElement.style.overflowY = 'auto';
            document.documentElement.style.overflowX = 'hidden';
            document.documentElement.style.height = 'auto';
            document.documentElement.style.minHeight = '100vh';
            document.documentElement.style.position = 'static';
            document.documentElement.style.webkitOverflowScrolling = 'touch';
            document.documentElement.style.touchAction = 'manipulation';
            
            document.body.style.overflow = 'auto';
            document.body.style.overflowY = 'auto';
            document.body.style.overflowX = 'hidden';
            document.body.style.height = 'auto';
            document.body.style.minHeight = '100vh';
            document.body.style.position = 'static';
            document.body.style.webkitOverflowScrolling = 'touch';
            document.body.style.touchAction = 'manipulation';
        }
        
        // Принудительно включаем скролл сразу
        if (isMobile()) {
            forceEnableScroll();
            
            // Повторяем через небольшие интервалы для надежности
            setTimeout(forceEnableScroll, 100);
            setTimeout(forceEnableScroll, 500);
            setTimeout(forceEnableScroll, 1000);
        }
        
        // Обработка изменения ориентации
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Принудительный пересчет viewport
                viewport.setAttribute('content', 
                    'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover');
                
                // Принудительно включаем скролл после поворота
                if (isMobile()) {
                    forceEnableScroll();
                }
            }, 100);
        });

        // Обработка виртуальной клавиатуры
        if (isMobile()) {
            let initialViewportHeight = window.innerHeight;
            
            window.addEventListener('resize', () => {
                const currentHeight = window.innerHeight;
                const heightDifference = initialViewportHeight - currentHeight;
                
                if (heightDifference > 150) {
                    // Виртуальная клавиатура открыта
                    document.body.classList.add('keyboard-active');
                } else {
                    // Виртуальная клавиатура закрыта
                    document.body.classList.remove('keyboard-active');
                }
                
                // Всегда поддерживаем скролл
                forceEnableScroll();
            });
        }
        
        // Отслеживаем изменения классов, которые могут блокировать скролл
        if (isMobile()) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const target = mutation.target;
                        if (target === document.documentElement || target === document.body) {
                            // Если добавлены классы, блокирующие скролл, принудительно включаем его
                            const blockingClasses = ['modal-open', 'ab-scroll-lock', 'preloader-active', 'scroll-locked', 'no-scroll'];
                            const hasBlockingClass = blockingClasses.some(cls => target.classList.contains(cls));
                            
                            if (hasBlockingClass) {
                                setTimeout(forceEnableScroll, 10);
                            }
                        }
                    }
                });
            });
            
            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
            observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
        }
    }

    // =========================================
    // ТАЧ ЖЕСТЫ
    // =========================================
    
    class TouchGestureHandler {
        constructor() {
            this.startX = 0;
            this.startY = 0;
            this.endX = 0;
            this.endY = 0;
            this.minSwipeDistance = 50;
            
            this.init();
        }
        
        init() {
            if (!isTouch()) return;
            
            document.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
            document.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
            document.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
        }
        
        handleTouchStart(e) {
            this.startX = e.touches[0].clientX;
            this.startY = e.touches[0].clientY;
        }
        
        handleTouchMove(e) {
            if (!this.startX || !this.startY) return;
            
            this.endX = e.touches[0].clientX;
            this.endY = e.touches[0].clientY;
        }
        
        handleTouchEnd(e) {
            if (!this.startX || !this.startY) return;
            
            const deltaX = this.endX - this.startX;
            const deltaY = this.endY - this.startY;
            
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
                // Горизонтальный свайп
                if (Math.abs(deltaX) > this.minSwipeDistance) {
                    if (deltaX > 0) {
                        this.handleSwipeRight();
                    } else {
                        this.handleSwipeLeft();
                    }
                }
            } else {
                // Вертикальный свайп
                if (Math.abs(deltaY) > this.minSwipeDistance) {
                    if (deltaY > 0) {
                        this.handleSwipeDown();
                    } else {
                        this.handleSwipeUp();
                    }
                }
            }
            
            this.resetValues();
        }
        
        handleSwipeLeft() {
            // Свайп влево - следующая страница или закрытие модального окна
            const modal = document.querySelector('.modal-overlay:not(.hidden)');
            if (modal) {
                this.closeModal(modal);
            }
        }
        
        handleSwipeRight() {
            // Свайп вправо - назад
            if (window.history.length > 1) {
                window.history.back();
            }
        }
        
        handleSwipeUp() {
            // Свайп вверх - прокрутка к началу
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        
        handleSwipeDown() {
            // Свайп вниз - обновление страницы (pull-to-refresh)
            if (window.scrollY === 0) {
                this.triggerPullToRefresh();
            }
        }
        
        closeModal(modal) {
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.click();
            }
        }
        
        triggerPullToRefresh() {
            // Простая реализация pull-to-refresh
            const indicator = document.createElement('div');
            indicator.className = 'pull-indicator visible loading';
            indicator.innerHTML = '<i class="fas fa-sync-alt"></i>';
            document.body.appendChild(indicator);
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
        
        resetValues() {
            this.startX = 0;
            this.startY = 0;
            this.endX = 0;
            this.endY = 0;
        }
    }

    // =========================================
    // УЛУЧШЕННАЯ НАВИГАЦИЯ
    // =========================================
    
    function enhanceMobileNavigation() {
        if (!isMobile()) return;
        
        const header = document.querySelector('.top');
        const nav = document.querySelector('.header-nav');
        
        if (!header || !nav) return;
        
        // Создаем кнопку мобильного меню
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'mobile-nav-toggle';
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
        toggleBtn.setAttribute('aria-label', 'Открыть меню');
        
        // Добавляем кнопку в header
        header.appendChild(toggleBtn);
        
        // Скрываем навигацию по умолчанию на мобильных
        nav.classList.add('mobile-hidden');
        
        // Обработчик клика по кнопке
        toggleBtn.addEventListener('click', () => {
            const isHidden = nav.classList.contains('mobile-hidden');
            
            if (isHidden) {
                nav.classList.remove('mobile-hidden');
                nav.classList.add('mobile-visible');
                toggleBtn.innerHTML = '<i class="fas fa-times"></i>';
                toggleBtn.setAttribute('aria-label', 'Закрыть меню');
            } else {
                nav.classList.remove('mobile-visible');
                nav.classList.add('mobile-hidden');
                toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
                toggleBtn.setAttribute('aria-label', 'Открыть меню');
            }
        });
        
        // Закрываем меню при клике вне его
        document.addEventListener('click', (e) => {
            if (!header.contains(e.target) && nav.classList.contains('mobile-visible')) {
                nav.classList.remove('mobile-visible');
                nav.classList.add('mobile-hidden');
                toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
                toggleBtn.setAttribute('aria-label', 'Открыть меню');
            }
        });
    }

    // =========================================
    // КРИТИЧЕСКАЯ ОПТИМИЗАЦИЯ ИЗОБРАЖЕНИЙ ДЛЯ МОБИЛЬНЫХ
    // =========================================
    
    function optimizeImages() {
        if (!isMobile()) return;
        
        // Глобальная функция для обработки ошибок изображений
        window.handleImageError = function(img) {
            if (img.dataset.errorHandled) return; // Предотвращаем повторную обработку
            
            img.dataset.errorHandled = 'true';
            img.style.background = 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)';
            img.style.display = 'flex';
            img.style.alignItems = 'center';
            img.style.justifyContent = 'center';
            img.style.color = 'white';
            img.style.fontSize = '2rem';
            img.style.position = 'relative';
            img.innerHTML = '<span style="z-index: 1; pointer-events: none;">📺</span>';
            img.onerror = null;
        };
        
        // Ленивая загрузка изображений с улучшенной обработкой ошибок
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    
                    // Устанавливаем обработчик ошибок
                    img.onerror = () => window.handleImageError(img);
                    
                    // Загружаем изображение
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                    }
                    
                    img.classList.remove('image-loading');
                    observer.unobserve(img);
                }
            });
        }, {
            rootMargin: '300px 0px', // Увеличенная область для мобильных
            threshold: 0.01
        });
        
        images.forEach(img => {
            img.classList.add('image-loading');
            imageObserver.observe(img);
        });
        
        // Обработка уже загруженных изображений
        document.addEventListener('error', (e) => {
            if (e.target.tagName === 'IMG') {
                window.handleImageError(e.target);
            }
        }, true);
        
        // Принудительная проверка всех изображений на странице
        function checkAllImages() {
            const allImages = document.querySelectorAll('img');
            allImages.forEach(img => {
                // Проверяем изображения без src или с пустым src
                if (!img.src || img.src === '' || img.src.includes('undefined') || img.src.includes('null')) {
                    window.handleImageError(img);
                }
                
                // Добавляем обработчик ошибок если его нет
                if (!img.onerror && !img.dataset.errorHandled) {
                    img.onerror = () => window.handleImageError(img);
                }
            });
        }
        
        // Проверяем изображения сразу и через интервалы
        checkAllImages();
        setTimeout(checkAllImages, 1000);
        setTimeout(checkAllImages, 3000);
        
        // Наблюдаем за добавлением новых изображений
        const imageAddObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        const newImages = node.tagName === 'IMG' ? [node] : node.querySelectorAll('img');
                        newImages.forEach(img => {
                            if (!img.onerror && !img.dataset.errorHandled) {
                                img.onerror = () => window.handleImageError(img);
                            }
                        });
                    }
                });
            });
        });
        
        imageAddObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // =========================================
    // УЛУЧШЕНИЕ ПРОИЗВОДИТЕЛЬНОСТИ
    // =========================================
    
    function optimizePerformance() {
        if (!isMobile()) return;
        
        // Отключаем сложные анимации на слабых устройствах
        const isLowEndDevice = navigator.hardwareConcurrency <= 2 || 
                              navigator.deviceMemory <= 2;
        
        if (isLowEndDevice) {
            document.documentElement.classList.add('low-end-device');
            
            // Упрощаем анимации
            const style = document.createElement('style');
            style.textContent = `
                .low-end-device * {
                    animation-duration: 0.1s !important;
                    transition-duration: 0.1s !important;
                }
                .low-end-device .anime-card:hover {
                    transform: none !important;
                }
            `;
            document.head.appendChild(style);
        }
        
        // Оптимизация скролла
        let ticking = false;
        
        function updateScrollPosition() {
            // Обновляем позицию элементов при скролле
            const scrollTop = window.pageYOffset;
            
            // Показываем/скрываем кнопку "наверх"
            const scrollBtn = document.getElementById('scrollToTop');
            if (scrollBtn) {
                if (scrollTop > 300) {
                    scrollBtn.classList.add('show');
                } else {
                    scrollBtn.classList.remove('show');
                }
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

    // =========================================
    // АДАПТИВНЫЕ УВЕДОМЛЕНИЯ
    // =========================================
    
    function enhanceNotifications() {
        if (!isMobile()) return;
        
        // Переопределяем функцию показа уведомлений для мобильных
        const originalShowNotification = window.showNotification;
        
        window.showNotification = function(message, type = 'info', duration = 5000) {
            const notification = document.createElement('div');
            notification.className = `notification notification-${type}`;
            
            const icon = type === 'success' ? 'check-circle' : 
                        type === 'error' ? 'exclamation-circle' : 
                        type === 'warning' ? 'exclamation-triangle' : 'info-circle';
            
            notification.innerHTML = `
                <i class="fas fa-${icon}"></i>
                <span>${message}</span>
                <button class="notification-close-btn" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            document.body.appendChild(notification);
            
            // Автоматическое скрытие
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.classList.add('hide');
                    setTimeout(() => notification.remove(), 300);
                }
            }, duration);
            
            return notification;
        };
    }

    // =========================================
    // ИНИЦИАЛИЗАЦИЯ
    // =========================================
    
    function init() {
        // Проверяем, что мы на мобильном устройстве
        if (isMobile()) {
            document.documentElement.classList.add('mobile-device');
        }
        
        if (isTouch()) {
            document.documentElement.classList.add('touch-device');
        }
        
        // Инициализируем все улучшения
        handleViewportChanges();
        new TouchGestureHandler();
        enhanceMobileNavigation();
        optimizeImages();
        optimizePerformance();
        enhanceNotifications();
        
        console.log('Мобильные улучшения AniFox инициализированы');
    }

    // Запускаем инициализацию после загрузки DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // =========================================
    // ЭКСПОРТ ДЛЯ ГЛОБАЛЬНОГО ИСПОЛЬЗОВАНИЯ
    // =========================================
    
    window.AniFoxMobile = {
        isMobile,
        isTouch,
        TouchGestureHandler
    };

})();