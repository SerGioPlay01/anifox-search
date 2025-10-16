/*
 * AniFox 2.4 - SEO оптимизация
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * Функции:
 * - SEO оптимизация футера
 * - Отслеживание кликов для аналитики
 * - Микроразметка Schema.org
 * - Улучшение доступности ссылок
 */

/**
 * Класс для SEO оптимизации футера
 * Обеспечивает улучшенную индексацию поисковыми системами
 */
class FooterSEO {
    constructor() {
        this.init();
    }

    /**
     * Инициализация всех SEO функций
     */
    init() {
        this.trackFooterClicks();
        this.addMicrodata();
        this.enhanceLinks();
    }

    /**
     * Отслеживание кликов в футере для аналитики
     * Отправляет данные о кликах в Google Analytics
     */
    trackFooterClicks() {
        const footer = document.querySelector('.site-footer');
        if (!footer) return;

        footer.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                const linkText = link.textContent.trim();
                const linkHref = link.getAttribute('href');
                
                // Отправляем событие в Google Analytics
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'footer_click', {
                        'event_category': 'Footer Navigation',
                        'event_label': linkText,
                        'link_url': linkHref
                    });
                }
                
                console.log('Footer link clicked:', linkText, linkHref);
            }
        });
    }

    /**
     * Добавление микроразметки Schema.org
     * Улучшает понимание структуры сайта поисковыми системами
     */
    addMicrodata() {
        // Добавляем микроразметку для навигации
        const footerSections = document.querySelectorAll('.footer-section');
        footerSections.forEach((section, index) => {
            section.setAttribute('itemscope', '');
            section.setAttribute('itemtype', 'https://schema.org/SiteNavigationElement');
        });
    }

    /**
     * Улучшение ссылок для SEO и безопасности
     * Добавляет необходимые атрибуты для внешних ссылок
     */
    enhanceLinks() {
        const footerLinks = document.querySelectorAll('.site-footer a[href]');
        
        footerLinks.forEach(link => {
            const href = link.getAttribute('href');
            
            // Добавляем rel атрибуты для внешних ссылок (безопасность)
            if (href.startsWith('http') && !href.includes('anifox.ru')) {
                link.setAttribute('rel', 'noopener noreferrer');
                link.setAttribute('target', '_blank');
            }
            
            // Добавляем title для улучшения доступности
            if (!link.getAttribute('title')) {
                const linkText = link.textContent.trim();
                link.setAttribute('title', linkText);
            }
        });
    }

    /**
     * Динамическое обновление популярных аниме в футере
     * @param {Array} animeList - Список популярных аниме
     */
    updatePopularAnime(animeList) {
        const popularSection = document.querySelector('.footer-section:nth-child(3) ul');
        if (!popularSection || !animeList) return;

        popularSection.innerHTML = '';
        animeList.slice(0, 5).forEach(anime => {
            const li = document.createElement('li');
            li.innerHTML = `<a href="/?q=${encodeURIComponent(anime.title)}">${anime.title}</a>`;
            popularSection.appendChild(li);
        });
    }
}

// ===========================================
// ИНИЦИАЛИЗАЦИЯ
// ===========================================

// Инициализация SEO функций при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.footerSEO = new FooterSEO();
});