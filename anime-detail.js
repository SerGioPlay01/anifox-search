/*
 * AniFox 2.5 - JavaScript для страницы деталей аниме
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 */

// Глобальные переменные
let currentAnime = null;
let currentAnimeId = null;

// Инициализация страницы
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Получаем параметры из URL
        const urlParams = new URLSearchParams(window.location.search);
        const animeId = urlParams.get('a'); // короткий ID
        const animeTitle = urlParams.get('t'); // название
        
        if (!animeId || !animeTitle) {
            showError('Неверные параметры URL');
            return;
        }
        
        // Инициализируем навигацию сразу после загрузки DOM
        initializeNavigation();
        
        // Пытаемся получить данные из sessionStorage
        let animeLink = null;
        const cachedData = getAnimeDataById(animeId);
        if (cachedData && cachedData.title === animeTitle) {
            animeLink = cachedData.link;
        }
        
        // Загружаем данные аниме
        await loadAnimeDetails(animeTitle, animeLink);
        
        // Переинициализируем навигацию после рендеринга контента
        setTimeout(() => {
            initializeNavigation();
            optimizePagePerformance();
        }, 100);
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки страницы');
    }
});

// Оптимизация производительности страницы деталей
function optimizePagePerformance() {
    // Оптимизация изображений
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        if ('decode' in img) {
            img.decode().catch(() => {});
        }
        if (!img.loading) {
            img.loading = 'lazy';
        }
    });
    
    // Оптимизация анимаций
    const animatedElements = document.querySelectorAll('.fade-in-up, .similar-anime-card');
    
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.animationPlayState = 'running';
                } else {
                    entry.target.style.animationPlayState = 'paused';
                }
            });
        }, {
            rootMargin: '50px 0px',
            threshold: 0.1
        });
        
        animatedElements.forEach(el => observer.observe(el));
    }
    
    // Оптимизация плеера
    const player = document.querySelector('.anime-player');
    if (player) {
        player.loading = 'lazy';
        // Отложенная загрузка плеера
        const playerObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Плеер становится видимым, можно загружать контент
                    entry.target.style.opacity = '1';
                    playerObserver.unobserve(entry.target);
                }
            });
        });
        playerObserver.observe(player);
    }
}

// Функция для получения данных аниме по ID (копируем из api.js)
function getAnimeDataById(animeId) {
    try {
        const data = sessionStorage.getItem(`anime_${animeId}`);
        if (data) {
            const animeData = JSON.parse(data);
            // Проверяем, что данные не старше 1 часа
            if (Date.now() - animeData.timestamp < 3600000) {
                return animeData;
            }
        }
    } catch (error) {
        console.warn('Error getting anime data from sessionStorage:', error);
    }
    return null;
}

// Функция для генерации короткого ID аниме (копируем из api.js)
function generateAnimeId(link) {
    let hash = 0;
    for (let i = 0; i < link.length; i++) {
        const char = link.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36).substring(0, 6);
}

// Функция для навигации к аниме (копируем из api.js)
window.navigateToAnime = function(animeId, title, link) {
    const animeData = {
        id: animeId,
        title: title,
        link: link,
        timestamp: Date.now()
    };
    
    sessionStorage.setItem(`anime_${animeId}`, JSON.stringify(animeData));
    
    const detailUrl = `/anime-detail.html?a=${animeId}&t=${encodeURIComponent(title)}`;
    window.location.href = detailUrl;
};

// Инициализация навигации
function initializeNavigation() {
    // Добавляем обработчики для навигационных ссылок в хедере
    const headerNavLinks = document.querySelectorAll('.header-nav .nav-btn, .logo-link');
    
    headerNavLinks.forEach((link, index) => {
        // Удаляем старые обработчики если есть
        link.removeEventListener('click', handleNavClick);
        
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const href = this.getAttribute('href');
            
            // Обрабатываем навигацию по кнопкам
            if (this.classList.contains('nav-btn')) {
                if (this.textContent.includes('Поиск') || this.textContent.includes('Главная')) {
                    // Переход на главную страницу
                    this.style.opacity = '0.7';
                    this.style.transform = 'translateY(-2px)';
                    
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 150);
                } else if (this.textContent.includes('Избранное')) {
                    // Переход на страницу избранного
                    this.style.opacity = '0.7';
                    this.style.transform = 'translateY(-2px)';
                    
                    setTimeout(() => {
                        window.location.href = '/?page=favorites';
                    }, 150);
                }
            }
            // Обрабатываем внутренние ссылки
            else if (href && (href === '/' || href.startsWith('/?'))) {
                // Добавляем визуальный эффект
                this.style.opacity = '0.7';
                this.style.transform = 'translateY(-2px)';
                
                setTimeout(() => {
                    window.location.href = href;
                }, 150);
            }
        });
    });
    
    // Обработчики для хлебных крошек
    const breadcrumbLinks = document.querySelectorAll('.breadcrumb a');
    
    breadcrumbLinks.forEach((link, index) => {
        // Удаляем старые обработчики если есть
        link.removeEventListener('click', handleNavClick);
        
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href && (href === '/' || href.startsWith('/?'))) {
                e.preventDefault();
                
                this.style.opacity = '0.7';
                
                setTimeout(() => {
                    window.location.href = href;
                }, 100);
            }
        });
    });
    
    // Обработчики для футера
    const footerNavLinks = document.querySelectorAll('.footer-section a[href^="/"], .footer-section a[href^="/?"]');
    
    footerNavLinks.forEach((link, index) => {
        // Удаляем старые обработчики если есть
        link.removeEventListener('click', handleNavClick);
        
        link.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            
            if (href && (href === '/' || href.startsWith('/?'))) {
                e.preventDefault();
                
                this.style.opacity = '0.7';
                
                setTimeout(() => {
                    window.location.href = href;
                }, 100);
            }
        });
    });
    
    // Добавляем hover эффекты для навигационных элементов
    const allNavElements = document.querySelectorAll('.nav-btn, .logo-link, .breadcrumb a');
    
    allNavElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            if (!this.style.transform.includes('translateY')) {
                this.style.transform = 'translateY(-2px)';
            }
        });
        
        element.addEventListener('mouseleave', function() {
            if (this.style.opacity !== '0.7') {
                this.style.transform = 'translateY(0)';
            }
        });
    });
}

// Обработчик навигационных кликов
function handleNavClick(e) {
    const href = this.getAttribute('href');
    
    if (href && (href === '/' || href.startsWith('/?'))) {
        e.preventDefault();
        
        this.style.opacity = '0.7';
        
        setTimeout(() => {
            window.location.href = href;
        }, 100);
    }
}

// Загрузка деталей аниме
async function loadAnimeDetails(title, link) {
    try {
        showLoading();
        
        // Проверяем доступность API функций
        if (typeof apiSearch !== 'function') {
            console.error('API функции недоступны');
            showError('Ошибка загрузки API');
            return;
        }
        
        // Поиск аниме в API
        const searchData = await apiSearch(title);
        
        if (!searchData || !searchData.results || searchData.results.length === 0) {
            showError('Аниме не найдено');
            return;
        }
        
        // Находим нужное аниме
        let anime = searchData.results[0];
        if (link) {
            const foundAnime = searchData.results.find(item => item.link === link);
            if (foundAnime) anime = foundAnime;
        }
        
        currentAnime = anime;
        currentAnimeId = generateAnimeId(anime.title);
        
        // Получаем расширенную информацию
        let extendedInfo = {};
        try {
            if (typeof getAnimeExtendedInfo === 'function') {
                extendedInfo = await getAnimeExtendedInfo(anime);
            }
        } catch (error) {
            console.warn('Не удалось получить расширенную информацию:', error);
        }
        
        // Отображаем контент
        await renderAnimeDetails(anime, extendedInfo);
        
        // Обновляем SEO
        updateSEO(anime, extendedInfo);
        
        // Скрываем прелоадер
        hideLoading();
        
    } catch (error) {
        console.error('Ошибка загрузки аниме:', error);
        showError('Не удалось загрузить информацию об аниме: ' + error.message);
    }
}

// Отображение деталей аниме
async function renderAnimeDetails(anime, extendedInfo) {
    const container = document.getElementById('animeDetailContent');
    
    const html = `
        <div class="anime-detail-container fade-in-up">
            <!-- Хлебные крошки -->
            <nav class="breadcrumb" aria-label="Навигация">
                <a href="/">Главная</a>
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <span>Аниме</span>
                <span class="breadcrumb-separator"><i class="fas fa-chevron-right"></i></span>
                <span>${escapeHtml(anime.title)}</span>
            </nav>
            
            <!-- Заголовок и основная информация -->
            <div class="anime-header">
                <div class="anime-poster">
                    ${renderPoster(anime, extendedInfo)}
                </div>
                
                <div class="anime-info">
                    <h1 class="anime-title">${escapeHtml(anime.title)}</h1>
                    ${anime.title_orig ? `<div class="anime-title-alt">${escapeHtml(anime.title_orig)}</div>` : ''}
                    
                    <!-- Статистика -->
                    <div class="anime-stats">
                        ${renderStats(anime, extendedInfo)}
                    </div>
                    
                    <!-- Жанры -->
                    ${renderGenres(anime, extendedInfo)}
                    
                    <!-- Действия -->
                    <div class="anime-actions">
                        ${renderActions(anime)}
                    </div>
                </div>
            </div>
            
            <!-- Описание -->
            ${renderDescription(anime, extendedInfo)}
            
            <!-- Плеер -->
            <div class="anime-player-section">
                <h2 class="section-title">
                    <i class="fas fa-play"></i>
                    Смотреть онлайн
                </h2>
                <div class="anime-player-container">
                    <iframe 
                        class="anime-player" 
                        src="${anime.link}" 
                        allowfullscreen 
                        loading="lazy"
                        title="Смотреть ${escapeHtml(anime.title)} онлайн"
                    ></iframe>
                </div>
            </div>
            
            <!-- Дополнительная информация -->
            ${renderAdditionalInfo(anime, extendedInfo)}
            
            <!-- Похожие аниме -->
            <div class="similar-anime-section">
                <h2 class="section-title">
                    <i class="fas fa-heart"></i>
                    Похожие аниме
                </h2>
                <div id="similarAnimeContainer">
                    <div class="loading-state">
                        <div class="loading-spinner"></div>
                        <p class="loading-text">Загрузка похожих аниме...</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    
    // Переинициализируем навигацию после рендеринга нового контента
    setTimeout(() => {
        initializeNavigation();
    }, 50);
    
    // Загружаем похожие аниме
    loadSimilarAnime(anime);
}

// Отображение постера
function renderPoster(anime, extendedInfo) {
    // Используем ту же логику получения постера, что и в карточках
    // Получаем постер приоритетно с Kodik API
    const posterUrl = anime.material_data?.poster_url || 
                     anime.screenshots?.[0] || 
                     extendedInfo?.shikimoriData?.poster_url ||
                     '/resources/anime-placeholder.svg';
    
    if (posterUrl && posterUrl !== '/resources/anime-placeholder.svg') {
        return `<img src="${posterUrl}" alt="Постер ${escapeHtml(anime.title)}" loading="lazy" onerror="this.src='/resources/anime-placeholder.svg'">`;
    } else {
        return `<div class="poster-placeholder">
            <i class="fas fa-image"></i>
        </div>`;
    }
}

// Отображение статистики
function renderStats(anime, extendedInfo) {
    const stats = [];
    
    // Рейтинг
    const rating = extendedInfo?.rating || anime.material_data?.rating;
    if (rating) {
        stats.push(`
            <div class="stat-item rating-item">
                <i class="fas fa-star"></i>
                <span>${rating}</span>
            </div>
        `);
    }
    
    // Эпизоды
    if (anime.episodes_count) {
        stats.push(`
            <div class="stat-item episodes-item">
                <i class="fas fa-film"></i>
                <span>${anime.episodes_count} эп.</span>
            </div>
        `);
    }
    
    // Статус
    const status = extendedInfo?.status || anime.material_data?.status;
    if (status) {
        stats.push(`
            <div class="stat-item status-item">
                <i class="fas fa-info-circle"></i>
                <span>${status}</span>
            </div>
        `);
    }
    
    // Длительность
    const duration = extendedInfo?.duration || anime.material_data?.duration;
    if (duration) {
        stats.push(`
            <div class="stat-item duration-item">
                <i class="fas fa-clock"></i>
                <span>${duration}</span>
            </div>
        `);
    }
    
    return stats.join('');
}

// Отображение жанров
function renderGenres(anime, extendedInfo) {
    const genres = extendedInfo?.shikimoriData?.genres || 
                  anime.material_data?.genres || 
                  anime.genres || 
                  [];
    
    if (genres.length === 0) return '';
    
    const genreLinks = genres.map(genre => 
        `<a href="/?q=${encodeURIComponent(genre)}" class="genre-tag">${escapeHtml(genre)}</a>`
    ).join('');
    
    return `<div class="anime-genres">${genreLinks}</div>`;
}

// Отображение действий
function renderActions(anime) {
    const isFavorite = isInFavorites(anime.link);
    
    return `
        <button class="action-button favorite-button ${isFavorite ? 'active' : ''}" 
                onclick="toggleFavorite('${escapeHtml(anime.title).replace(/'/g, "\\'")}', '${anime.link}')">
            <i class="fas fa-heart"></i>
            ${isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
        </button>
        
        <button class="action-button share-button" onclick="shareAnime()">
            <i class="fas fa-share"></i>
            Поделиться
        </button>
        
        <a href="https://shikimori.one/animes?search=${encodeURIComponent(anime.title)}" 
           target="_blank" rel="noopener" class="action-button external-link">
            <i class="fas fa-external-link-alt"></i>
            Shikimori
        </a>
        
        <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(anime.title)}" 
           target="_blank" rel="noopener" class="action-button external-link">
            <i class="fas fa-external-link-alt"></i>
            MyAnimeList
        </a>
    `;
}

// Отображение описания
function renderDescription(anime, extendedInfo) {
    const description = extendedInfo?.description || 
                       anime.material_data?.description || 
                       `«${anime.title}» - аниме. Подробное описание временно недоступно.`;
    
    return `
        <div class="anime-description">
            <h3><i class="fas fa-align-left"></i> Описание</h3>
            <p>${escapeHtml(description)}</p>
        </div>
    `;
}

// Отображение дополнительной информации
function renderAdditionalInfo(anime, extendedInfo) {
    const studios = extendedInfo?.studios || anime.material_data?.studios || [];
    const year = anime.year || 'Неизвестно';
    const type = anime.type || 'Аниме';
    
    return `
        <div class="anime-details-grid">
            <div class="detail-card">
                <h3><i class="fas fa-info"></i> Основная информация</h3>
                <ul class="detail-list">
                    <li>
                        <span class="label">Тип:</span>
                        <span class="value">${escapeHtml(type)}</span>
                    </li>
                    <li>
                        <span class="label">Год выпуска:</span>
                        <span class="value">${year}</span>
                    </li>
                    ${anime.episodes_count ? `
                    <li>
                        <span class="label">Эпизоды:</span>
                        <span class="value">${anime.episodes_count}</span>
                    </li>
                    ` : ''}
                    ${extendedInfo?.status ? `
                    <li>
                        <span class="label">Статус:</span>
                        <span class="value">${escapeHtml(extendedInfo.status)}</span>
                    </li>
                    ` : ''}
                </ul>
            </div>
            
            ${studios.length > 0 ? `
            <div class="detail-card">
                <h3><i class="fas fa-building"></i> Студии</h3>
                <ul class="detail-list">
                    ${studios.map(studio => `
                        <li>
                            <span class="value">${escapeHtml(studio)}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
            ` : ''}
            
            <div class="detail-card">
                <h3><i class="fas fa-link"></i> Полезные ссылки</h3>
                <ul class="detail-list">
                    <li>
                        <a href="https://shikimori.one/animes?search=${encodeURIComponent(anime.title)}" 
                           target="_blank" rel="noopener" class="value">
                            Shikimori <i class="fas fa-external-link-alt"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://anilist.co/search/anime?search=${encodeURIComponent(anime.title)}" 
                           target="_blank" rel="noopener" class="value">
                            AniList <i class="fas fa-external-link-alt"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(anime.title)}" 
                           target="_blank" rel="noopener" class="value">
                            MyAnimeList <i class="fas fa-external-link-alt"></i>
                        </a>
                    </li>
                </ul>
            </div>
        </div>
    `;
}

// Загрузка похожих аниме
async function loadSimilarAnime(anime) {
    try {
        const container = document.getElementById('similarAnimeContainer');
        
        // Получаем жанры текущего аниме
        const currentGenres = anime.material_data?.genres || anime.genres || [];
        let similarAnime = [];
        
        // Если есть жанры, ищем по ним
        if (currentGenres.length > 0) {
            // Перемешиваем жанры для разнообразия
            const shuffledGenres = [...currentGenres].sort(() => Math.random() - 0.5);
            
            for (const genre of shuffledGenres) {
                try {
                    const searchData = await apiSearch(genre);
                    if (searchData.results && searchData.results.length > 0) {
                        // Фильтруем текущее аниме и уже добавленные
                        const genreAnime = searchData.results
                            .filter(item => 
                                item.title !== anime.title && 
                                !similarAnime.some(existing => existing.title === item.title)
                            );
                        
                        // Добавляем случайные аниме из этого жанра
                        const shuffled = genreAnime.sort(() => Math.random() - 0.5);
                        similarAnime.push(...shuffled.slice(0, 3));
                        
                        // Если набрали достаточно, прекращаем поиск
                        if (similarAnime.length >= 12) break;
                    }
                } catch (error) {
                    console.warn(`Ошибка поиска по жанру "${genre}":`, error);
                }
            }
        }
        
        // Если по жанрам мало результатов, добавляем из общего поиска
        if (similarAnime.length < 6) {
            try {
                // Поиск по первому слову названия
                const titleWords = anime.title.split(' ').filter(word => word.length > 2);
                if (titleWords.length > 0) {
                    const searchData = await apiSearch(titleWords[0]);
                    if (searchData.results) {
                        const titleAnime = searchData.results
                            .filter(item => 
                                item.title !== anime.title && 
                                !similarAnime.some(existing => existing.title === item.title)
                            )
                            .sort(() => Math.random() - 0.5)
                            .slice(0, 6 - similarAnime.length);
                        
                        similarAnime.push(...titleAnime);
                    }
                }
            } catch (error) {
                console.warn('Ошибка поиска по названию:', error);
            }
        }
        
        // Если все еще мало результатов, добавляем случайные новинки
        if (similarAnime.length < 6) {
            try {
                const weeklyData = await apiWeekly();
                if (weeklyData.results) {
                    const weeklyAnime = weeklyData.results
                        .filter(item => 
                            item.title !== anime.title && 
                            !similarAnime.some(existing => existing.title === item.title)
                        )
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 6 - similarAnime.length);
                    
                    similarAnime.push(...weeklyAnime);
                }
            } catch (error) {
                console.warn('Ошибка загрузки новинок:', error);
            }
        }
        
        // Финальная проверка на дубли и перемешивание
        const uniqueAnime = [];
        const seenTitles = new Set();
        
        for (const item of similarAnime) {
            const normalizedTitle = item.title.toLowerCase().trim();
            if (!seenTitles.has(normalizedTitle)) {
                seenTitles.add(normalizedTitle);
                uniqueAnime.push(item);
            }
        }
        
        // Перемешиваем и берем первые 6
        const finalAnime = uniqueAnime
            .sort(() => Math.random() - 0.5)
            .slice(0, 6);
        
        if (finalAnime.length === 0) {
            container.innerHTML = `
                <div class="error-state">
                    <p>Похожие аниме не найдены</p>
                </div>
            `;
            return;
        }
        
        // Создаем карточки с использованием функции из api.js
        const cards = [];
        for (const item of finalAnime) {
            try {
                // Создаем упрощенную карточку для похожих аниме
                const animeId = generateAnimeId(item.link);
                
                // Получаем постер приоритетно с Kodik API
                let posterUrl = '/resources/anime-placeholder.svg';
                if (item.material_data?.poster_url) {
                    posterUrl = item.material_data.poster_url;
                } else if (item.screenshots && item.screenshots.length > 0) {
                    posterUrl = item.screenshots[0];
                }
                
                // Обеспечиваем HTTPS для внешних изображений
                if (posterUrl && posterUrl !== '/resources/anime-placeholder.svg') {
                    posterUrl = posterUrl.replace('http://', 'https://');
                }
                
                const card = `
                    <div class="similar-anime-card" onclick="navigateToAnime('${animeId}', '${escapeHtml(item.title)}', '${item.link}')" style="cursor: pointer;">
                        ${posterUrl !== '/resources/anime-placeholder.svg' ? 
                            `<img src="${posterUrl}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='/resources/anime-placeholder.svg'">` :
                            `<div class="poster-placeholder"><i class="fas fa-image"></i></div>`
                        }
                        <div class="similar-anime-info">
                            <h4 class="similar-anime-title">${escapeHtml(item.title)}</h4>
                            ${item.year ? `<span class="similar-anime-year">${item.year}</span>` : ''}
                        </div>
                        <div class="similar-anime-overlay">
                            <div class="play-button">
                                <i class="fas fa-play"></i>
                            </div>
                        </div>
                    </div>
                `;
                cards.push(card);
            } catch (error) {
                console.warn('Ошибка создания карточки:', error);
            }
        }
        
        const html = `
            <div class="similar-anime-grid">
                ${cards.join('')}
            </div>
        `;
        
        container.innerHTML = html;
        
        // Добавляем информацию о источниках рекомендаций
        if (currentGenres.length > 0) {
            const genreInfo = document.createElement('div');
            genreInfo.className = 'recommendation-info';
            genreInfo.innerHTML = `
                <p><i class="fas fa-info-circle"></i> Рекомендации основаны на жанрах: ${currentGenres.slice(0, 3).join(', ')}</p>
            `;
            container.appendChild(genreInfo);
        }
        
    } catch (error) {
        console.error('Ошибка загрузки похожих аниме:', error);
        document.getElementById('similarAnimeContainer').innerHTML = `
            <div class="error-state">
                <p>Ошибка загрузки похожих аниме</p>
            </div>
        `;
    }
}

// Обновление SEO
function updateSEO(anime, extendedInfo) {
    const title = anime.title;
    const description = extendedInfo?.description || `Смотреть ${title} онлайн бесплатно в HD качестве на AniFox`;
    const posterUrl = anime.material_data?.poster_url || anime.screenshots?.[0] || extendedInfo?.shikimoriData?.poster_url || '/resources/obl_web.jpg';
    const currentUrl = window.location.href;
    
    // Обновляем title и мета-теги
    document.title = `${title} — смотреть аниме онлайн бесплатно в HD | AniFox`;
    document.getElementById('pageTitle').textContent = document.title;
    document.getElementById('pageDescription').setAttribute('content', description.substring(0, 160));
    
    // Генерируем ключевые слова
    const genres = extendedInfo?.shikimoriData?.genres || anime.genres || [];
    const keywords = [
        'смотреть аниме',
        title.toLowerCase(),
        'аниме онлайн',
        'аниме бесплатно',
        'аниме HD',
        ...genres.map(g => g.toLowerCase())
    ].join(', ');
    document.getElementById('pageKeywords').setAttribute('content', keywords);
    
    // Canonical URL
    document.getElementById('canonicalUrl').setAttribute('href', currentUrl);
    
    // Open Graph
    document.getElementById('ogTitle').setAttribute('content', `${title} — смотреть онлайн`);
    document.getElementById('ogDescription').setAttribute('content', description.substring(0, 200));
    document.getElementById('ogUrl').setAttribute('content', currentUrl);
    document.getElementById('ogImage').setAttribute('content', posterUrl);
    document.getElementById('ogImageAlt').setAttribute('content', `Постер аниме ${title}`);
    
    // Twitter Card
    document.getElementById('twitterTitle').setAttribute('content', `${title} — смотреть онлайн`);
    document.getElementById('twitterDescription').setAttribute('content', description.substring(0, 200));
    document.getElementById('twitterImage').setAttribute('content', posterUrl);
    
    // Структурированные данные
    updateStructuredData(anime, extendedInfo);
}

// Обновление структурированных данных
function updateStructuredData(anime, extendedInfo) {
    const rating = extendedInfo?.rating || anime.material_data?.rating;
    const genres = extendedInfo?.shikimoriData?.genres || anime.genres || [];
    const posterUrl = anime.material_data?.poster_url || anime.screenshots?.[0] || extendedInfo?.shikimoriData?.poster_url;
    
    const structuredData = {
        "@context": "https://schema.org",
        "@type": "TVSeries",
        "name": anime.title,
        "alternateName": anime.title_orig || anime.title,
        "description": extendedInfo?.description || `Смотреть ${anime.title} онлайн`,
        "url": window.location.href,
        "image": posterUrl,
        "genre": genres,
        "datePublished": anime.year ? `${anime.year}-01-01` : undefined,
        "numberOfEpisodes": anime.episodes_count,
        "inLanguage": "ru",
        "contentRating": "PG-13",
        "aggregateRating": rating ? {
            "@type": "AggregateRating",
            "ratingValue": rating,
            "ratingCount": 100,
            "bestRating": 10,
            "worstRating": 1
        } : undefined,
        "potentialAction": {
            "@type": "WatchAction",
            "target": {
                "@type": "EntryPoint",
                "urlTemplate": window.location.href,
                "inLanguage": "ru",
                "actionPlatform": [
                    "http://schema.org/DesktopWebPlatform",
                    "http://schema.org/MobileWebPlatform"
                ]
            }
        },
        "publisher": {
            "@type": "Organization",
            "name": "AniFox",
            "url": "https://anifox-search.vercel.app/",
            "logo": {
                "@type": "ImageObject",
                "url": "https://anifox-search.vercel.app/resources/obl_web.jpg"
            }
        }
    };
    
    // Удаляем undefined значения
    Object.keys(structuredData).forEach(key => {
        if (structuredData[key] === undefined) {
            delete structuredData[key];
        }
    });
    
    document.getElementById('structuredData').textContent = JSON.stringify(structuredData);
}

// Утилиты
function generateAnimeId(title) {
    return title.toLowerCase().replace(/[^a-zа-я0-9]/g, '-').replace(/-+/g, '-');
}

function showLoading() {
    const container = document.getElementById('animeDetailContent');
    container.innerHTML = `
        <div class="loading-state">
            <div class="loading-spinner"></div>
            <p class="loading-text">Загрузка информации об аниме...</p>
        </div>
    `;
}

function hideLoading() {
    const preloader = document.getElementById('preloader-site-full');
    if (preloader) {
        preloader.classList.add('hidden');
    }
}

function showError(message) {
    const container = document.getElementById('animeDetailContent');
    container.innerHTML = `
        <div class="error-state">
            <i class="fas fa-exclamation-triangle error-icon"></i>
            <h2 class="error-title">Ошибка</h2>
            <p class="error-message">${escapeHtml(message)}</p>
            <button class="retry-button" onclick="window.location.reload()">
                <i class="fas fa-redo"></i>
                Попробовать снова
            </button>
        </div>
    `;
    hideLoading();
}

// Функции взаимодействия
async function toggleFavorite(title, link) {
    try {
        const button = document.querySelector('.favorite-button');
        const isCurrentlyFavorite = button.classList.contains('active');
        
        if (isCurrentlyFavorite) {
            await removeFavorite(link);
            button.classList.remove('active');
            button.innerHTML = '<i class="fas fa-heart"></i> Добавить в избранное';
            showNote('Удалено из избранного', 'info');
        } else {
            await addFavorite(title, link);
            button.classList.add('active');
            button.innerHTML = '<i class="fas fa-heart"></i> Удалить из избранного';
            showNote('Добавлено в избранное', 'success');
        }
    } catch (error) {
        console.error('Ошибка при работе с избранным:', error);
        showNote('Ошибка при работе с избранным', 'error');
    }
}

async function shareAnime() {
    const title = currentAnime?.title || 'Аниме';
    const url = window.location.href;
    const text = `Смотрю "${title}" на AniFox`;
    
    if (navigator.share) {
        try {
            await navigator.share({
                title: title,
                text: text,
                url: url
            });
        } catch (error) {
            if (error.name !== 'AbortError') {
                fallbackShare(url, text);
            }
        }
    } else {
        fallbackShare(url, text);
    }
}

function fallbackShare(url, text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(() => {
            showNote('Ссылка скопирована в буфер обмена', 'success');
        }).catch(() => {
            showNote('Не удалось скопировать ссылку', 'error');
        });
    } else {
        showNote('Поделитесь ссылкой: ' + url, 'info');
    }
}

// Проверка избранного
function isInFavorites(link) {
    // Эта функция должна быть реализована в api.js
    // Временная заглушка
    return false;
}

// Добавление в избранное
async function addFavorite(title, link) {
    // Эта функция должна быть реализована в api.js
    console.log('Добавление в избранное:', title, link);
}

// Удаление из избранного
async function removeFavorite(link) {
    // Эта функция должна быть реализована в api.js
    console.log('Удаление из избранного:', link);
}

// Показ уведомлений
function showNote(message, type = 'info') {
    // Удаляем существующие уведомления
    document.querySelectorAll('.notification').forEach(n => n.remove());
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
        <span>${escapeHtml(message)}</span>
        <button onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    document.body.appendChild(notification);
    
    // Автоматическое скрытие через 5 секунд
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Экранирование HTML
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}