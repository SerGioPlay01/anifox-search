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
    // VIEWPORT УПРАВЛЕНИЕ
    // =========================================
    
    function handleViewportChanges() {
        const viewport = document.querySelector('meta[name="viewport"]');
        
        // Обработка изменения ориентации
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                // Принудительный пересчет viewport
                viewport.setAttribute('content', 
                    'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover');
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
            });
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
    // ОПТИМИЗАЦИЯ ИЗОБРАЖЕНИЙ
    // =========================================
    
    function optimizeImages() {
        if (!isMobile()) return;
        
        // Ленивая загрузка изображений
        const images = document.querySelectorAll('img[data-src]');
        
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src;
                    img.classList.remove('image-loading');
                    observer.unobserve(img);
                }
            });
        });
        
        images.forEach(img => {
            img.classList.add('image-loading');
            imageObserver.observe(img);
        });
        
        // Обработка ошибок загрузки изображений
        document.addEventListener('error', (e) => {
            if (e.target.tagName === 'IMG') {
                const img = e.target;
                img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                img.classList.add('image-placeholder');
            }
        }, true);
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