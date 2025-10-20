/*
 * AniFox Achievements Integration
 * Интеграция системы достижений с основной функциональностью AniFox
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 */

class AniFoxAchievementsIntegration {
    constructor() {
        this.isInitialized = false;
        this.watchStartTime = null;
        this.currentSession = null;
        this.lastActivityTime = Date.now();
        this.activityTimeout = null;
        this.iframePlayers = new Map();
        this.behavioralData = {
            peakHours: [],
            favoriteGenres: new Map(),
            searchPatterns: [],
            watchPatterns: [],
            deviceInfo: this.getDeviceInfo(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        this.setupWatchTimeTracking();
        this.setupSearchTracking();
        this.setupSessionTracking();
        this.setupAdvancedTracking();
        this.setupBehavioralTracking();
        this.setupRealTimeMonitoring();
        this.isInitialized = true;
        
        console.log('🏆 AniFox Achievements System initialized');
    }

    // Отслеживание времени просмотра
    setupWatchTimeTracking() {
        // Отслеживание начала просмотра видео
        document.addEventListener('play', (e) => {
            if (e.target.tagName === 'VIDEO' || e.target.tagName === 'IFRAME') {
                this.startWatchSession();
            }
        });

        // Отслеживание паузы/остановки
        document.addEventListener('pause', (e) => {
            if (e.target.tagName === 'VIDEO') {
                this.pauseWatchSession();
            }
        });

        // Отслеживание окончания просмотра
        document.addEventListener('ended', (e) => {
            if (e.target.tagName === 'VIDEO') {
                this.endWatchSession();
            }
        });

        // Улучшенное отслеживание iframe плееров
        this.setupIframeTracking();
        
        // Отслеживание кликов на плееры
        this.setupPlayerClickTracking();

        // Отслеживание изменения страницы (SPA)
        this.setupPageChangeTracking();
    }

    startWatchSession() {
        this.watchStartTime = Date.now();
        this.currentSession = {
            startTime: this.watchStartTime,
            duration: 0,
            paused: false
        };
        
        console.log('🎬 Watch session started');
    }

    pauseWatchSession() {
        if (this.currentSession && !this.currentSession.paused) {
            this.currentSession.duration += Date.now() - this.watchStartTime;
            this.currentSession.paused = true;
            console.log('⏸️ Watch session paused');
        }
    }

    resumeWatchSession() {
        if (this.currentSession && this.currentSession.paused) {
            this.watchStartTime = Date.now();
            this.currentSession.paused = false;
            console.log('▶️ Watch session resumed');
        }
    }

    endWatchSession() {
        if (this.currentSession) {
            const totalDuration = this.currentSession.duration + (Date.now() - this.watchStartTime);
            this.addWatchTime(totalDuration / (1000 * 60 * 60)); // Convert to hours
            this.currentSession = null;
            this.watchStartTime = null;
            console.log('🏁 Watch session ended');
        }
    }

    addWatchTime(hours) {
        const stats = this.getStats();
        stats.totalWatchHours += hours;
        stats.watchSessions.push({
            date: new Date().toISOString(),
            duration: hours,
            type: 'anime_watch'
        });
        
        // Update daily stats
        this.updateDailyStats('watchTime', hours);
        
        this.saveStats(stats);
        this.checkWatchTimeAchievements(stats);
        this.checkSeasonalAchievements(stats);
        this.checkDeviceAchievements(stats);
        this.checkPerformanceAchievements(stats);
        this.checkBehavioralAchievements(stats);
    }

    // Отслеживание поисковых запросов
    setupSearchTracking() {
        // Отслеживание отправки формы поиска
        const searchForm = document.getElementById('searchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                const searchInput = document.getElementById('searchInput');
                if (searchInput && searchInput.value.trim()) {
                    this.recordSearch(searchInput.value.trim());
                }
            });
        }

        // Отслеживание поиска через URL параметры
        this.trackSearchFromURL();
    }

    recordSearch(query) {
        const stats = this.getStats();
        stats.totalSearches++;
        stats.searchHistory.push({
            query: query,
            date: new Date().toISOString(),
            timestamp: Date.now()
        });
        
        // Ограничиваем историю поиска до 1000 записей
        if (stats.searchHistory.length > 1000) {
            stats.searchHistory = stats.searchHistory.slice(-1000);
        }
        
        // Update daily stats
        this.updateDailyStats('searches', 1);
        
        this.saveStats(stats);
        this.checkSearchAchievements(stats);
        this.checkBehavioralAchievements(stats);
        
        console.log(`🔍 Search recorded: ${query}`);
    }

    trackSearchFromURL() {
        const urlParams = new URLSearchParams(window.location.search);
        const query = urlParams.get('q');
        if (query && query.trim()) {
            this.recordSearch(query.trim());
        }
    }

    // Улучшенное отслеживание iframe плееров
    setupIframeTracking() {
        // Отслеживание загрузки iframe
        document.addEventListener('DOMContentLoaded', () => {
            this.observeIframes();
        });

        // Отслеживание динамически добавляемых iframe
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1) { // Element node
                        if (node.tagName === 'IFRAME') {
                            this.setupIframePlayer(node);
                        }
                        // Проверяем дочерние элементы
                        const iframes = node.querySelectorAll && node.querySelectorAll('iframe');
                        if (iframes) {
                            iframes.forEach(iframe => this.setupIframePlayer(iframe));
                        }
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    observeIframes() {
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => this.setupIframePlayer(iframe));
    }

    setupIframePlayer(iframe) {
        if (!iframe) return;

        // Сохраняем информацию о плеере
        const playerId = Date.now() + Math.random();
        this.iframePlayers.set(playerId, {
            element: iframe,
            src: iframe.src,
            startTime: Date.now(),
            isPlaying: false,
            lastActivity: Date.now()
        });

        // Отслеживание загрузки iframe
        iframe.addEventListener('load', () => {
            this.trackIframeLoad(iframe, playerId);
        });

        // Отслеживание кликов на iframe
        iframe.addEventListener('click', () => {
            this.trackIframeClick(iframe, playerId);
        });

        // Отслеживание фокуса на iframe
        iframe.addEventListener('focus', () => {
            this.trackIframeFocus(iframe, playerId);
        });

        // Отслеживание потери фокуса
        iframe.addEventListener('blur', () => {
            this.trackIframeBlur(iframe, playerId);
        });

        // Попытка отслеживания через postMessage (для некоторых плееров)
        window.addEventListener('message', (event) => {
            if (event.source === iframe.contentWindow) {
                this.handleIframeMessage(event.data, iframe, playerId);
            }
        });

        // Отслеживание изменений размера iframe
        const resizeObserver = new ResizeObserver((entries) => {
            entries.forEach(entry => {
                this.trackIframeResize(iframe, playerId, entry.contentRect);
            });
        });
        resizeObserver.observe(iframe);
    }

    trackIframeLoad(iframe, playerId) {
        console.log('🎬 Iframe player loaded:', iframe.src);
        const player = this.iframePlayers.get(playerId);
        if (player) {
            player.loadTime = Date.now();
            player.isLoaded = true;
        }
        this.startWatchSession();
    }

    trackIframeClick(iframe, playerId) {
        console.log('👆 Iframe player clicked:', iframe.src);
        const player = this.iframePlayers.get(playerId);
        if (player) {
            player.lastActivity = Date.now();
            player.clickCount = (player.clickCount || 0) + 1;
        }
        // Предполагаем, что клик означает начало воспроизведения
        this.startWatchSession();
    }

    trackIframeFocus(iframe, playerId) {
        console.log('🎯 Iframe player focused:', iframe.src);
        const player = this.iframePlayers.get(playerId);
        if (player) {
            player.lastActivity = Date.now();
            player.focusCount = (player.focusCount || 0) + 1;
        }
    }

    trackIframeBlur(iframe, playerId) {
        console.log('👁️ Iframe player blurred:', iframe.src);
        const player = this.iframePlayers.get(playerId);
        if (player) {
            player.lastActivity = Date.now();
        }
    }

    trackIframeResize(iframe, playerId, contentRect) {
        console.log('📏 Iframe player resized:', iframe.src, contentRect);
        const player = this.iframePlayers.get(playerId);
        if (player) {
            player.lastActivity = Date.now();
            player.lastSize = contentRect;
        }
    }

    handleIframeMessage(data, iframe, playerId) {
        // Обработка сообщений от плееров
        if (data && typeof data === 'object') {
            const player = this.iframePlayers.get(playerId);
            if (player) {
                player.lastActivity = Date.now();
            }

            switch (data.type) {
                case 'play':
                case 'playing':
                    if (player) player.isPlaying = true;
                    this.startWatchSession();
                    break;
                case 'pause':
                case 'paused':
                    if (player) player.isPlaying = false;
                    this.pauseWatchSession();
                    break;
                case 'ended':
                case 'complete':
                    if (player) player.isPlaying = false;
                    this.endWatchSession();
                    break;
                case 'timeupdate':
                    // Отслеживаем прогресс воспроизведения
                    if (player && data.currentTime) {
                        player.currentTime = data.currentTime;
                        player.duration = data.duration;
                    }
                    break;
            }
        }
    }

    // Отслеживание кликов на плееры
    setupPlayerClickTracking() {
        // Отслеживание кликов на элементы плееров
        document.addEventListener('click', (e) => {
            const target = e.target;
            
            // Проверяем, является ли клик по плееру
            if (this.isPlayerElement(target)) {
                this.trackPlayerClick(target);
            }
        });
    }

    isPlayerElement(element) {
        // Проверяем различные селекторы плееров
        const playerSelectors = [
            '.single-player',
            '.player',
            '.video-player',
            '.anime-player',
            '[class*="player"]',
            '[class*="video"]',
            'iframe[src*="player"]',
            'iframe[src*="embed"]',
            'iframe[src*="youtube"]',
            'iframe[src*="vimeo"]'
        ];

        return playerSelectors.some(selector => {
            try {
                return element.matches && element.matches(selector);
            } catch (e) {
                return false;
            }
        });
    }

    trackPlayerClick(element) {
        console.log('🎮 Player element clicked:', element);
        // Небольшая задержка перед началом отслеживания
        setTimeout(() => {
            this.startWatchSession();
        }, 1000);
    }

    // Отслеживание сессий
    setupSessionTracking() {
        // Отслеживание времени на сайте
        this.startSessionTracking();
        
        // Отслеживание закрытия вкладки/браузера
        window.addEventListener('beforeunload', () => {
            this.endSessionTracking();
        });

        // Отслеживание потери фокуса
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseSessionTracking();
            } else {
                this.resumeSessionTracking();
            }
        });

        // Отслеживание активности пользователя
        this.setupActivityTracking();
    }

    setupActivityTracking() {
        // Отслеживание различных типов активности
        const activityEvents = ['click', 'scroll', 'keypress', 'mousemove'];
        
        activityEvents.forEach(eventType => {
            document.addEventListener(eventType, () => {
                this.recordActivity(eventType);
            }, { passive: true });
        });
    }

    recordActivity(type) {
        const stats = this.getStats();
        if (!stats.activityStats) {
            stats.activityStats = {
                clicks: 0,
                scrolls: 0,
                keypresses: 0,
                mousemoves: 0,
                totalActivity: 0
            };
        }

        switch (type) {
            case 'click':
                stats.activityStats.clicks++;
                break;
            case 'scroll':
                stats.activityStats.scrolls++;
                break;
            case 'keypress':
                stats.activityStats.keypresses++;
                break;
            case 'mousemove':
                stats.activityStats.mousemoves++;
                break;
        }

        stats.activityStats.totalActivity++;
        this.saveStats(stats);
        
        // Проверяем достижения по активности
        this.checkActivityAchievements(stats);
    }

    startSessionTracking() {
        const stats = this.getStats();
        const today = new Date().toDateString();
        const lastVisit = localStorage.getItem('anifox_last_visit');
        
        if (lastVisit !== today) {
            // Новый день - обновляем streak
            this.updateStreak();
            localStorage.setItem('anifox_last_visit', today);
        }
        
        this.sessionStartTime = Date.now();
        console.log('📊 Session tracking started');
    }

    endSessionTracking() {
        if (this.sessionStartTime) {
            const sessionDuration = (Date.now() - this.sessionStartTime) / (1000 * 60 * 60); // hours
            this.addSessionTime(sessionDuration);
        }
    }

    pauseSessionTracking() {
        if (this.sessionStartTime) {
            this.sessionPauseTime = Date.now();
        }
    }

    resumeSessionTracking() {
        if (this.sessionPauseTime) {
            const pauseDuration = Date.now() - this.sessionPauseTime;
            this.sessionStartTime += pauseDuration; // Adjust start time
            this.sessionPauseTime = null;
        }
    }

    addSessionTime(hours) {
        const stats = this.getStats();
        
        // Update daily stats using the helper method
        this.updateDailyStats('sessionTime', hours);
        
        // Проверяем достижения по времени на сайте
        this.checkSiteTimeAchievements(stats);
        this.checkBehavioralAchievements(stats);
    }

    updateStreak() {
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const currentStreak = parseInt(localStorage.getItem('anifox_streak') || '0');
        const lastStreakDate = localStorage.getItem('anifox_streak_date');
        
        if (lastStreakDate === yesterday.toDateString()) {
            // Продолжаем streak
            localStorage.setItem('anifox_streak', (currentStreak + 1).toString());
        } else if (lastStreakDate !== today.toDateString()) {
            // Сбрасываем streak
            localStorage.setItem('anifox_streak', '1');
        }
        
        localStorage.setItem('anifox_streak_date', today.toDateString());
    }

    // Проверка достижений
    checkWatchTimeAchievements(stats) {
        const achievements = this.getAchievements();
        const watchTimeAchievements = achievements.filter(a => a.type === 'watch_time');
        
        watchTimeAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id) && 
                stats.totalWatchHours >= achievement.target) {
                this.unlockAchievement(achievement, stats);
            }
        });
    }

    checkSearchAchievements(stats) {
        const achievements = this.getAchievements();
        const searchAchievements = achievements.filter(a => a.type === 'search');
        
        searchAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id) && 
                stats.totalSearches >= achievement.target) {
                this.unlockAchievement(achievement, stats);
            }
        });
    }

    checkSiteTimeAchievements(stats) {
        const achievements = this.getAchievements();
        const siteTimeAchievements = achievements.filter(a => a.type === 'site_time');
        
        const totalSiteTime = this.calculateTotalSiteTime(stats);
        
        siteTimeAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id) && 
                totalSiteTime >= achievement.target) {
                this.unlockAchievement(achievement, stats);
            }
        });
    }

    checkActivityAchievements(stats) {
        const achievements = this.getAchievements();
        const activityAchievements = achievements.filter(a => a.type === 'activity');
        
        if (!stats.activityStats) return;
        
        activityAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id)) {
                let current = 0;
                switch (achievement.id) {
                    case 'clicker_100':
                        current = stats.activityStats.clicks;
                        break;
                    case 'scroller_500':
                        current = stats.activityStats.scrolls;
                        break;
                    case 'typer_1000':
                        current = stats.activityStats.keypresses;
                        break;
                    case 'explorer_5000':
                    case 'power_user_10000':
                    case 'super_user_25000':
                    case 'ultimate_user_50000':
                        current = stats.activityStats.totalActivity;
                        break;
                }
                
                if (current >= achievement.target) {
                    this.unlockAchievement(achievement, stats);
                }
            }
        });
    }

    // Новые проверки достижений
    checkSeasonalAchievements(stats) {
        const achievements = this.getAchievements();
        const seasonalAchievements = achievements.filter(a => a.type === 'seasonal');
        
        if (!stats.seasonalStats) return;
        
        seasonalAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id)) {
                const season = this.getSeason(new Date().getMonth());
                if (stats.seasonalStats[season] >= achievement.target) {
                    this.unlockAchievement(achievement, stats);
                }
            }
        });
    }

    checkDeviceAchievements(stats) {
        const achievements = this.getAchievements();
        const deviceAchievements = achievements.filter(a => a.type === 'device');
        
        if (!this.behavioralData.deviceInfo) return;
        
        const deviceInfo = this.behavioralData.deviceInfo;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(deviceInfo.userAgent);
        const isTablet = /iPad|Android/i.test(deviceInfo.userAgent) && deviceInfo.screenWidth >= 768;
        const isDesktop = !isMobile && !isTablet;
        
        deviceAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id)) {
                let shouldUnlock = false;
                
                switch (achievement.id) {
                    case 'mobile_master':
                        shouldUnlock = isMobile;
                        break;
                    case 'tablet_titan':
                        shouldUnlock = isTablet;
                        break;
                    case 'desktop_dominator':
                        shouldUnlock = isDesktop;
                        break;
                }
                
                if (shouldUnlock) {
                    this.unlockAchievement(achievement, stats);
                }
            }
        });
    }

    checkPerformanceAchievements(stats) {
        const achievements = this.getAchievements();
        const performanceAchievements = achievements.filter(a => a.type === 'performance');
        
        if (!stats.performanceData || stats.performanceData.length === 0) return;
        
        const latestPerf = stats.performanceData[stats.performanceData.length - 1];
        const avgLoadTime = stats.performanceData.reduce((sum, perf) => sum + perf.loadTime, 0) / stats.performanceData.length;
        
        performanceAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id)) {
                let shouldUnlock = false;
                
                switch (achievement.id) {
                    case 'speed_demon':
                        shouldUnlock = latestPerf.loadTime < 2000; // Быстрая загрузка
                        break;
                    case 'stability_seeker':
                        shouldUnlock = stats.errors && stats.errors.length === 0; // Нет ошибок
                        break;
                }
                
                if (shouldUnlock) {
                    this.unlockAchievement(achievement, stats);
                }
            }
        });
    }

    checkBehavioralAchievements(stats) {
        const achievements = this.getAchievements();
        const behavioralAchievements = achievements.filter(a => a.type === 'behavioral');
        
        behavioralAchievements.forEach(achievement => {
            if (!stats.achievements.includes(achievement.id)) {
                let shouldUnlock = false;
                
                switch (achievement.id) {
                    case 'genre_explorer':
                        shouldUnlock = this.behavioralData.favoriteGenres.size >= achievement.target;
                        break;
                    case 'pattern_master':
                        shouldUnlock = this.behavioralData.searchPatterns.length > 0 && 
                                      this.behavioralData.watchPatterns.length > 0;
                        break;
                    case 'consistency_champion':
                        shouldUnlock = this.checkConsistencyPattern(stats);
                        break;
                }
                
                if (shouldUnlock) {
                    this.unlockAchievement(achievement, stats);
                }
            }
        });
    }

    checkConsistencyPattern(stats) {
        // Проверяем постоянство использования
        if (!stats.dailyStats) return false;
        
        const days = Object.keys(stats.dailyStats);
        if (days.length < 7) return false;
        
        // Проверяем, что пользователь активен минимум 5 дней из последних 7
        const recentDays = days.slice(-7);
        const activeDays = recentDays.filter(day => {
            const dayStats = stats.dailyStats[day];
            return (dayStats.sessionTime > 0 || dayStats.searches > 0 || dayStats.watchTime > 0);
        });
        
        return activeDays.length >= 5;
    }

    calculateTotalSiteTime(stats) {
        if (!stats.dailyStats) return 0;
        
        let totalTime = 0;
        Object.values(stats.dailyStats).forEach(dayStats => {
            totalTime += dayStats.sessionTime || 0;
        });
        
        return totalTime;
    }

    unlockAchievement(achievement, stats) {
        stats.achievements.push(achievement.id);
        
        // Добавляем опыт
        const xp = parseInt(achievement.reward.replace(/\D/g, ''));
        stats.experience += xp;
        
        // Проверяем повышение уровня
        this.checkLevelUp(stats);
        
        this.saveStats(stats);
        this.showAchievementNotification(achievement);
        
        console.log(`🏆 Achievement unlocked: ${achievement.title}`);
    }

    checkLevelUp(stats) {
        const requiredXP = stats.level * 1000;
        if (stats.experience >= requiredXP) {
            stats.level++;
            this.showLevelUpNotification(stats.level);
            console.log(`🎉 Level up! New level: ${stats.level}`);
        }
    }

    // Уведомления
    showAchievementNotification(achievement) {
        this.showNotification(
            `🏆 Достижение разблокировано!\n${achievement.title}\n${achievement.reward}`,
            'achievement'
        );
    }

    showLevelUpNotification(level) {
        this.showNotification(
            `🎉 Поздравляем!\nВы достигли уровня ${level}!`,
            'levelup'
        );
    }

    showNotification(message, type = 'info') {
        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `achievement-notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'achievement' ? 'trophy' : 'star'}"></i>
                <div class="notification-text">${message.replace(/\n/g, '<br>')}</div>
            </div>
        `;
        
        // Добавляем стили
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #5b0a99, #9115ea);
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(91, 10, 153, 0.4);
            z-index: 10000;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        // Удаляем через 5 секунд
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    // Работа с данными
    getStats() {
        const defaultStats = {
            totalWatchHours: 0,
            totalSearches: 0,
            watchSessions: [],
            searchHistory: [],
            achievements: [],
            level: 1,
            experience: 0,
            joinDate: new Date().toISOString(),
            dailyStats: {},
            activityStats: {
                clicks: 0,
                scrolls: 0,
                keypresses: 0,
                mousemoves: 0,
                totalActivity: 0
            }
        };

        const saved = localStorage.getItem('anifox_achievements');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure all required fields exist and don't add fake data
            return { ...defaultStats, ...parsed };
        }
        return defaultStats;
    }

    saveStats(stats) {
        localStorage.setItem('anifox_achievements', JSON.stringify(stats));
    }

    getAchievements() {
        // Возвращаем определения достижений
        return [
            // Watch Time Achievements
            { id: 'first_hour', title: 'Первые шаги', type: 'watch_time', target: 1, reward: '10 XP' },
            { id: 'marathon_5h', title: 'Марафонец', type: 'watch_time', target: 5, reward: '50 XP' },
            { id: 'dedicated_24h', title: 'Преданный фанат', type: 'watch_time', target: 24, reward: '100 XP' },
            { id: 'enthusiast_100h', title: 'Энтузиаст', type: 'watch_time', target: 100, reward: '500 XP' },
            { id: 'expert_500h', title: 'Эксперт', type: 'watch_time', target: 500, reward: '1000 XP' },
            { id: 'master_1000h', title: 'Мастер', type: 'watch_time', target: 1000, reward: '2000 XP' },
            { id: 'legend_5000h', title: 'Легенда', type: 'watch_time', target: 5000, reward: '5000 XP' },
            { id: 'ultimate_10000h', title: 'Ультимативный фанат', type: 'watch_time', target: 10000, reward: '10000 XP' },
            { id: 'godlike_25000h', title: 'Богоподобный', type: 'watch_time', target: 25000, reward: '25000 XP' },
            { id: 'transcendent_50000h', title: 'Трансцендентный', type: 'watch_time', target: 50000, reward: '50000 XP' },
            
            // Search Achievements
            { id: 'first_search', title: 'Первый поиск', type: 'search', target: 1, reward: '5 XP' },
            { id: 'curious_10', title: 'Любознательный', type: 'search', target: 10, reward: '25 XP' },
            { id: 'explorer_50', title: 'Исследователь', type: 'search', target: 50, reward: '100 XP' },
            { id: 'seeker_100', title: 'Искатель', type: 'search', target: 100, reward: '200 XP' },
            { id: 'hunter_500', title: 'Охотник', type: 'search', target: 500, reward: '500 XP' },
            { id: 'detective_1000', title: 'Детектив', type: 'search', target: 1000, reward: '1000 XP' },
            { id: 'archaeologist_2500', title: 'Археолог', type: 'search', target: 2500, reward: '2500 XP' },
            { id: 'scholar_5000', title: 'Учёный', type: 'search', target: 5000, reward: '5000 XP' },
            { id: 'sage_10000', title: 'Мудрец', type: 'search', target: 10000, reward: '10000 XP' },
            { id: 'oracle_25000', title: 'Оракул', type: 'search', target: 25000, reward: '25000 XP' },
            { id: 'omniscient_45000', title: 'Всезнающий', type: 'search', target: 45000, reward: '45000 XP' },
            
            // Site Time Achievements
            { id: 'visitor_1h', title: 'Посетитель', type: 'site_time', target: 1, reward: '20 XP' },
            { id: 'regular_10h', title: 'Постоянный посетитель', type: 'site_time', target: 10, reward: '100 XP' },
            { id: 'loyal_24h', title: 'Преданный пользователь', type: 'site_time', target: 24, reward: '200 XP' },
            { id: 'devoted_100h', title: 'Преданный фанат сайта', type: 'site_time', target: 100, reward: '500 XP' },
            { id: 'addicted_500h', title: 'Зависимый от AniFox', type: 'site_time', target: 500, reward: '1000 XP' },
            { id: 'obsessed_1000h', title: 'Одержимый AniFox', type: 'site_time', target: 1000, reward: '2000 XP' },
            { id: 'legendary_5000h', title: 'Легендарный пользователь', type: 'site_time', target: 5000, reward: '5000 XP' },
            { id: 'mythical_10000h', title: 'Мифический пользователь', type: 'site_time', target: 10000, reward: '10000 XP' },
            { id: 'divine_25000h', title: 'Божественный пользователь', type: 'site_time', target: 25000, reward: '25000 XP' },
            { id: 'eternal_50000h', title: 'Вечный пользователь', type: 'site_time', target: 50000, reward: '50000 XP' },
            
            // Activity Achievements
            { id: 'clicker_100', title: 'Кликатель', type: 'activity', target: 100, reward: '50 XP' },
            { id: 'scroller_500', title: 'Скроллер', type: 'activity', target: 500, reward: '100 XP' },
            { id: 'typer_1000', title: 'Печататель', type: 'activity', target: 1000, reward: '200 XP' },
            { id: 'explorer_5000', title: 'Исследователь интерфейса', type: 'activity', target: 5000, reward: '500 XP' },
            { id: 'power_user_10000', title: 'Продвинутый пользователь', type: 'activity', target: 10000, reward: '1000 XP' },
            { id: 'super_user_25000', title: 'Супер пользователь', type: 'activity', target: 25000, reward: '2500 XP' },
            { id: 'ultimate_user_50000', title: 'Ультимативный пользователь', type: 'activity', target: 50000, reward: '5000 XP' },
            
            // Special Achievements
            { id: 'daily_warrior', title: 'Ежедневный воин', type: 'streak', target: 7, reward: '100 XP' },
            { id: 'night_owl', title: 'Сова', type: 'special', target: 1, reward: '50 XP' },
            { id: 'early_bird', title: 'Ранняя пташка', type: 'special', target: 1, reward: '50 XP' },
            { id: 'weekend_warrior', title: 'Выходной воин', type: 'special', target: 1, reward: '75 XP' },
            { id: 'midnight_marathon', title: 'Полуночный марафон', type: 'special', target: 1, reward: '100 XP' },
            
            // Seasonal Achievements
            { id: 'spring_watcher', title: 'Весенний наблюдатель', type: 'seasonal', target: 1, reward: '75 XP' },
            { id: 'summer_binge', title: 'Летний марафон', type: 'seasonal', target: 1, reward: '75 XP' },
            { id: 'autumn_enthusiast', title: 'Осенний энтузиаст', type: 'seasonal', target: 1, reward: '75 XP' },
            { id: 'winter_warrior', title: 'Зимний воин', type: 'seasonal', target: 1, reward: '75 XP' },
            
            // Holiday Achievements
            { id: 'christmas_spirit', title: 'Рождественский дух', type: 'holiday', target: 1, reward: '100 XP' },
            { id: 'new_year_resolution', title: 'Новогоднее решение', type: 'holiday', target: 1, reward: '100 XP' },
            { id: 'spooky_season', title: 'Жуткий сезон', type: 'holiday', target: 1, reward: '100 XP' },
            { id: 'love_is_in_the_air', title: 'Любовь в воздухе', type: 'holiday', target: 1, reward: '100 XP' },
            
            // Device Achievements
            { id: 'mobile_master', title: 'Мобильный мастер', type: 'device', target: 1, reward: '50 XP' },
            { id: 'desktop_dominator', title: 'Доминатор десктопа', type: 'device', target: 1, reward: '50 XP' },
            { id: 'tablet_titan', title: 'Титан планшета', type: 'device', target: 1, reward: '50 XP' },
            
            // Performance Achievements
            { id: 'speed_demon', title: 'Демон скорости', type: 'performance', target: 1, reward: '75 XP' },
            { id: 'stability_seeker', title: 'Искатель стабильности', type: 'performance', target: 1, reward: '100 XP' },
            
            // Behavioral Achievements
            { id: 'genre_explorer', title: 'Исследователь жанров', type: 'behavioral', target: 5, reward: '150 XP' },
            { id: 'pattern_master', title: 'Мастер паттернов', type: 'behavioral', target: 1, reward: '200 XP' },
            { id: 'consistency_champion', title: 'Чемпион постоянства', type: 'behavioral', target: 1, reward: '250 XP' }
        ];
    }

    // Отслеживание изменений страницы для SPA
    setupPageChangeTracking() {
        let currentURL = window.location.href;
        
        // Отслеживание изменений URL
        const observer = new MutationObserver(() => {
            if (window.location.href !== currentURL) {
                currentURL = window.location.href;
                this.handlePageChange();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Отслеживание popstate событий
        window.addEventListener('popstate', () => {
            this.handlePageChange();
        });
    }

    handlePageChange() {
        // Обрабатываем изменение страницы
        setTimeout(() => {
            this.trackSearchFromURL();
        }, 100);
    }

    // Публичные методы для внешнего использования
    getCurrentStats() {
        return this.getStats();
    }

    getDetailedStats() {
        const stats = this.getStats();
        const achievements = this.getAchievements();
        
        return {
            ...stats,
            achievements: achievements,
            behavioralData: this.behavioralData,
            iframePlayers: Array.from(this.iframePlayers.entries()).map(([id, player]) => ({
                id,
                src: player.src,
                isPlaying: player.isPlaying,
                lastActivity: player.lastActivity,
                clickCount: player.clickCount || 0,
                focusCount: player.focusCount || 0
            })),
            systemInfo: {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                language: navigator.language,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                screenResolution: `${screen.width}x${screen.height}`,
                colorDepth: screen.colorDepth,
                pixelRatio: window.devicePixelRatio
            }
        };
    }

    addManualWatchTime(hours) {
        this.addWatchTime(hours);
    }

    addManualSearch(query) {
        this.recordSearch(query);
    }

    resetStats() {
        localStorage.removeItem('anifox_achievements');
        this.iframePlayers.clear();
        this.behavioralData = {
            peakHours: [],
            favoriteGenres: new Map(),
            searchPatterns: [],
            watchPatterns: [],
            deviceInfo: this.getDeviceInfo(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
        console.log('📊 Stats reset');
    }

    exportStats() {
        const stats = this.getDetailedStats();
        const dataStr = JSON.stringify(stats, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `anifox-detailed-stats-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
    }

    // Новые методы для продвинутого анализа
    getAchievementProgress() {
        const stats = this.getStats();
        const achievements = this.getAchievements();
        
        return achievements.map(achievement => {
            const isUnlocked = stats.achievements.includes(achievement.id);
            let progress = 0;
            let current = 0;
            
            switch (achievement.type) {
                case 'watch_time':
                    current = stats.totalWatchHours;
                    break;
                case 'search':
                    current = stats.totalSearches;
                    break;
                case 'site_time':
                    current = this.calculateTotalSiteTime(stats);
                    break;
                case 'activity':
                    if (stats.activityStats) {
                        switch (achievement.id) {
                            case 'clicker_100':
                                current = stats.activityStats.clicks;
                                break;
                            case 'scroller_500':
                                current = stats.activityStats.scrolls;
                                break;
                            case 'typer_1000':
                                current = stats.activityStats.keypresses;
                                break;
                            default:
                                current = stats.activityStats.totalActivity;
                        }
                    }
                    break;
            }
            
            progress = Math.min((current / achievement.target) * 100, 100);
            
            return {
                ...achievement,
                isUnlocked,
                progress: Math.round(progress),
                current,
                remaining: Math.max(achievement.target - current, 0)
            };
        });
    }

    getBehavioralInsights() {
        const stats = this.getStats();
        
        return {
            peakHours: this.behavioralData.peakHours,
            favoriteGenres: Object.fromEntries(this.behavioralData.favoriteGenres),
            searchPatterns: this.behavioralData.searchPatterns,
            watchPatterns: this.behavioralData.watchPatterns,
            deviceInfo: this.behavioralData.deviceInfo,
            consistency: this.checkConsistencyPattern(stats),
            totalSessions: stats.watchSessions ? stats.watchSessions.length : 0,
            averageSessionDuration: this.calculateAverageSessionDuration(stats)
        };
    }

    calculateAverageSessionDuration(stats) {
        if (!stats.watchSessions || stats.watchSessions.length === 0) return 0;
        
        const totalDuration = stats.watchSessions.reduce((sum, session) => sum + session.duration, 0);
        return totalDuration / stats.watchSessions.length;
    }

    updateDailyStats(type, value) {
        const stats = this.getStats();
        if (!stats.dailyStats) {
            stats.dailyStats = {};
        }
        
        const today = new Date().toDateString();
        if (!stats.dailyStats[today]) {
            stats.dailyStats[today] = {
                sessionTime: 0,
                searches: 0,
                watchTime: 0
            };
        }
        
        if (type === 'watchTime') {
            stats.dailyStats[today].watchTime += value;
        } else if (type === 'searches') {
            stats.dailyStats[today].searches += value;
        } else if (type === 'sessionTime') {
            stats.dailyStats[today].sessionTime += value;
        }
        
        // Обновляем this.stats и сохраняем
        this.stats = stats;
        this.saveStats(stats);
        console.log(`Updated daily stats for ${today}:`, stats.dailyStats[today]);
    }

    // ===========================================
    // ПРОДВИНУТОЕ ОТСЛЕЖИВАНИЕ
    // ===========================================

    setupAdvancedTracking() {
        // Отслеживание времени суток
        this.setupTimeOfDayTracking();
        
        // Отслеживание дней недели
        this.setupDayOfWeekTracking();
        
        // Отслеживание сезонов
        this.setupSeasonalTracking();
        
        // Отслеживание специальных событий
        this.setupSpecialEventTracking();
        
        // Улучшенное отслеживание iframe
        this.setupEnhancedIframeTracking();
    }

    setupTimeOfDayTracking() {
        const currentHour = new Date().getHours();
        this.behavioralData.peakHours.push(currentHour);
        
        // Проверяем достижения по времени суток
        this.checkTimeBasedAchievements(currentHour);
    }

    setupDayOfWeekTracking() {
        const dayOfWeek = new Date().getDay();
        const stats = this.getStats();
        
        if (!stats.dayOfWeekStats) {
            stats.dayOfWeekStats = {};
        }
        
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dayName = dayNames[dayOfWeek];
        
        if (!stats.dayOfWeekStats[dayName]) {
            stats.dayOfWeekStats[dayName] = 0;
        }
        
        stats.dayOfWeekStats[dayName]++;
        this.saveStats(stats);
        
        // Проверяем достижения по дням недели
        this.checkDayOfWeekAchievements(stats);
    }

    setupSeasonalTracking() {
        const month = new Date().getMonth();
        const season = this.getSeason(month);
        
        const stats = this.getStats();
        if (!stats.seasonalStats) {
            stats.seasonalStats = {};
        }
        
        if (!stats.seasonalStats[season]) {
            stats.seasonalStats[season] = 0;
        }
        
        stats.seasonalStats[season]++;
        this.saveStats(stats);
    }

    setupSpecialEventTracking() {
        const now = new Date();
        const month = now.getMonth();
        const day = now.getDate();
        
        // Проверяем специальные даты
        if (month === 11 && day === 25) { // Рождество
            this.recordSpecialEvent('christmas');
        } else if (month === 0 && day === 1) { // Новый год
            this.recordSpecialEvent('new_year');
        } else if (month === 9 && day === 31) { // Хэллоуин
            this.recordSpecialEvent('halloween');
        } else if (month === 1 && day === 14) { // День святого Валентина
            this.recordSpecialEvent('valentine');
        }
    }

    setupEnhancedIframeTracking() {
        // Улучшенное отслеживание iframe с Intersection Observer
        const iframeObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.trackIframeVisibility(entry.target);
                }
            });
        }, { threshold: 0.5 });

        // Отслеживание всех iframe на странице
        const observeIframes = () => {
            document.querySelectorAll('iframe').forEach(iframe => {
                iframeObserver.observe(iframe);
                this.setupIframePlayer(iframe);
            });
        };

        // Начальное наблюдение
        observeIframes();

        // Отслеживание новых iframe
        const mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.tagName === 'IFRAME') {
                        iframeObserver.observe(node);
                        this.setupIframePlayer(node);
                    }
                });
            });
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    setupBehavioralTracking() {
        // Отслеживание паттернов поиска
        this.setupSearchPatternTracking();
        
        // Отслеживание предпочтений жанров
        this.setupGenrePreferenceTracking();
        
        // Отслеживание паттернов просмотра
        this.setupWatchPatternTracking();
        
        // Отслеживание активности устройства
        this.setupDeviceActivityTracking();
    }

    setupSearchPatternTracking() {
        // Анализируем паттерны поиска
        const stats = this.getStats();
        if (stats.searchHistory && stats.searchHistory.length > 0) {
            const recentSearches = stats.searchHistory.slice(-10);
            this.analyzeSearchPatterns(recentSearches);
        }
    }

    setupGenrePreferenceTracking() {
        // Отслеживаем жанры из поисковых запросов
        const stats = this.getStats();
        if (stats.searchHistory) {
            stats.searchHistory.forEach(search => {
                this.analyzeGenreFromSearch(search.query);
            });
        }
    }

    setupWatchPatternTracking() {
        // Анализируем паттерны просмотра
        const stats = this.getStats();
        if (stats.watchSessions && stats.watchSessions.length > 0) {
            this.analyzeWatchPatterns(stats.watchSessions);
        }
    }

    setupDeviceActivityTracking() {
        // Отслеживаем активность устройства
        this.trackDeviceActivity();
    }

    setupRealTimeMonitoring() {
        // Мониторинг в реальном времени
        this.setupActivityTimeout();
        this.setupPerformanceMonitoring();
        this.setupErrorTracking();
    }

    setupActivityTimeout() {
        // Отслеживание неактивности
        const resetTimeout = () => {
            if (this.activityTimeout) {
                clearTimeout(this.activityTimeout);
            }
            
            this.activityTimeout = setTimeout(() => {
                this.handleInactivity();
            }, 5 * 60 * 1000); // 5 минут неактивности
        };

        // Сбрасываем таймер при любой активности
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
            document.addEventListener(event, resetTimeout, true);
        });

        resetTimeout();
    }

    setupPerformanceMonitoring() {
        // Мониторинг производительности
        if ('performance' in window) {
            window.addEventListener('load', () => {
                setTimeout(() => {
                    const perfData = performance.getEntriesByType('navigation')[0];
                    this.recordPerformanceData(perfData);
                }, 1000);
            });
        }
    }

    setupErrorTracking() {
        // Отслеживание ошибок
        window.addEventListener('error', (event) => {
            this.recordError(event.error, event.filename, event.lineno);
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.recordError(event.reason, 'Promise Rejection');
        });
    }

    // ===========================================
    // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ
    // ===========================================

    getDeviceInfo() {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screenWidth: screen.width,
            screenHeight: screen.height,
            colorDepth: screen.colorDepth,
            pixelRatio: window.devicePixelRatio,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            online: navigator.onLine
        };
    }

    getSeason(month) {
        if (month >= 2 && month <= 4) return 'spring';
        if (month >= 5 && month <= 7) return 'summer';
        if (month >= 8 && month <= 10) return 'autumn';
        return 'winter';
    }

    recordSpecialEvent(eventType) {
        const stats = this.getStats();
        if (!stats.specialEvents) {
            stats.specialEvents = {};
        }
        
        if (!stats.specialEvents[eventType]) {
            stats.specialEvents[eventType] = 0;
        }
        
        stats.specialEvents[eventType]++;
        this.saveStats(stats);
        
        // Проверяем специальные достижения
        this.checkSpecialEventAchievements(stats, eventType);
    }

    trackIframeVisibility(iframe) {
        console.log('👁️ Iframe became visible:', iframe.src);
        this.startWatchSession();
    }

    analyzeSearchPatterns(searches) {
        // Анализируем частоту поиска
        const frequency = searches.length;
        this.behavioralData.searchPatterns.push({
            frequency,
            timestamp: Date.now(),
            pattern: 'frequency_analysis'
        });
    }

    analyzeGenreFromSearch(query) {
        // Простой анализ жанров по ключевым словам
        const genreKeywords = {
            'action': ['экшен', 'боевик', 'сражение', 'битва'],
            'romance': ['романтика', 'любовь', 'романс'],
            'comedy': ['комедия', 'юмор', 'смешной'],
            'drama': ['драма', 'трагедия', 'серьезный'],
            'fantasy': ['фэнтези', 'магия', 'волшебство'],
            'sci-fi': ['фантастика', 'космос', 'будущее'],
            'horror': ['ужасы', 'хоррор', 'страшный'],
            'mystery': ['мистика', 'загадка', 'тайна']
        };

        const queryLower = query.toLowerCase();
        for (const [genre, keywords] of Object.entries(genreKeywords)) {
            if (keywords.some(keyword => queryLower.includes(keyword))) {
                const currentCount = this.behavioralData.favoriteGenres.get(genre) || 0;
                this.behavioralData.favoriteGenres.set(genre, currentCount + 1);
            }
        }
    }

    analyzeWatchPatterns(sessions) {
        // Анализируем паттерны просмотра
        const totalSessions = sessions.length;
        const avgDuration = sessions.reduce((sum, session) => sum + session.duration, 0) / totalSessions;
        
        this.behavioralData.watchPatterns.push({
            totalSessions,
            avgDuration,
            timestamp: Date.now(),
            pattern: 'watch_analysis'
        });
    }

    trackDeviceActivity() {
        // Отслеживаем изменения в устройстве
        window.addEventListener('resize', () => {
            this.recordDeviceChange('resize');
        });

        window.addEventListener('orientationchange', () => {
            this.recordDeviceChange('orientation');
        });

        window.addEventListener('online', () => {
            this.recordDeviceChange('online');
        });

        window.addEventListener('offline', () => {
            this.recordDeviceChange('offline');
        });
    }

    recordDeviceChange(type) {
        const stats = this.getStats();
        if (!stats.deviceActivity) {
            stats.deviceActivity = {};
        }
        
        if (!stats.deviceActivity[type]) {
            stats.deviceActivity[type] = 0;
        }
        
        stats.deviceActivity[type]++;
        this.saveStats(stats);
    }

    recordPerformanceData(perfData) {
        const stats = this.getStats();
        if (!stats.performanceData) {
            stats.performanceData = [];
        }
        
        stats.performanceData.push({
            loadTime: perfData.loadEventEnd - perfData.loadEventStart,
            domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
            timestamp: Date.now()
        });
        
        this.saveStats(stats);
    }

    recordError(error, filename, lineno) {
        const stats = this.getStats();
        if (!stats.errors) {
            stats.errors = [];
        }
        
        stats.errors.push({
            message: error?.message || error,
            filename: filename || 'Unknown',
            lineno: lineno || 0,
            timestamp: Date.now()
        });
        
        // Ограничиваем количество ошибок
        if (stats.errors.length > 100) {
            stats.errors = stats.errors.slice(-50);
        }
        
        this.saveStats(stats);
    }

    handleInactivity() {
        console.log('😴 User inactive for 5 minutes');
        // Можно добавить логику для обработки неактивности
    }

    // ===========================================
    // ПРОВЕРКИ ДОСТИЖЕНИЙ
    // ===========================================

    checkTimeBasedAchievements(hour) {
        const stats = this.getStats();
        const achievements = this.getAchievements();
        
        // Ночная сова (поздно ночью)
        if (hour >= 23 || hour <= 5) {
            this.checkAndUnlockAchievement('night_owl', stats, achievements);
        }
        
        // Ранняя пташка (рано утром)
        if (hour >= 5 && hour <= 8) {
            this.checkAndUnlockAchievement('early_bird', stats, achievements);
        }
    }

    checkDayOfWeekAchievements(stats) {
        const achievements = this.getAchievements();
        
        // Выходной воин (пятница-воскресенье)
        const dayOfWeek = new Date().getDay();
        if (dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0) {
            this.checkAndUnlockAchievement('weekend_warrior', stats, achievements);
        }
    }

    checkSpecialEventAchievements(stats, eventType) {
        const achievements = this.getAchievements();
        
        // Проверяем специальные достижения по событиям
        switch (eventType) {
            case 'christmas':
                this.checkAndUnlockAchievement('christmas_spirit', stats, achievements);
                break;
            case 'new_year':
                this.checkAndUnlockAchievement('new_year_resolution', stats, achievements);
                break;
            case 'halloween':
                this.checkAndUnlockAchievement('spooky_season', stats, achievements);
                break;
            case 'valentine':
                this.checkAndUnlockAchievement('love_is_in_the_air', stats, achievements);
                break;
        }
    }

    checkAndUnlockAchievement(achievementId, stats, achievements) {
        const achievement = achievements.find(a => a.id === achievementId);
        if (achievement && !stats.achievements.includes(achievementId)) {
            this.unlockAchievement(achievement, stats);
        }
    }
}

// Инициализация при загрузке страницы
let anifoxAchievements;

document.addEventListener('DOMContentLoaded', () => {
    anifoxAchievements = new AniFoxAchievementsIntegration();
});

// Экспорт для глобального использования
window.AniFoxAchievements = anifoxAchievements;

// CSS для анимаций уведомлений
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .achievement-notification {
        font-family: 'Rubik', system-ui, -apple-system, sans-serif;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 1rem;
    }
    
    .notification-content i {
        font-size: 1.5rem;
    }
    
    .notification-text {
        font-weight: 500;
        line-height: 1.4;
    }
`;
document.head.appendChild(style);
