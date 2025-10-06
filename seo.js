// SEO улучшения для футера
class FooterSEO {
    constructor() {
        this.init();
    }

    init() {
        this.trackFooterClicks();
        this.addMicrodata();
        this.enhanceLinks();
    }

    // Отслеживание кликов в футере для аналитики
    trackFooterClicks() {
        const footer = document.querySelector('.site-footer');
        if (!footer) return;

        footer.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link) {
                const linkText = link.textContent.trim();
                const linkHref = link.getAttribute('href');
                
                // Можно отправить в Google Analytics
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

    // Добавление микроразметки динамически
    addMicrodata() {
        // Добавляем микроразметку для навигации
        const footerSections = document.querySelectorAll('.footer-section');
        footerSections.forEach((section, index) => {
            section.setAttribute('itemscope', '');
            section.setAttribute('itemtype', 'https://schema.org/SiteNavigationElement');
        });
    }

    // Улучшение ссылок для SEO
    enhanceLinks() {
        const footerLinks = document.querySelectorAll('.site-footer a[href]');
        
        footerLinks.forEach(link => {
            const href = link.getAttribute('href');
            
            // Добавляем rel атрибуты для внешних ссылок
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

    // Динамическое обновление популярных аниме в футере
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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.footerSEO = new FooterSEO();
});