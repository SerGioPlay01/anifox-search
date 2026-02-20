/*
 * AniFox 2.4 - Обновление API по годам
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 * 
 * Функции:
 * - Получение аниме за определенный год
 * - Отображение последних обновлений
 * - Фильтрация дубликатов
 */

// ===========================================
// НАСТРОЙКИ API
// ===========================================

// URL для получения аниме за 2026 год с последними обновлениями
const url = `https://kodikapi.com/list?token=a036c8a4c59b43e72e212e4d0388ef7d&year=2026&updated_at=updated_at&types=anime,anime-serial`;

// ===========================================
// ОСНОВНАЯ ЛОГИКА
// ===========================================

// Запрос к API Kodik для получения данных
fetch(url)
    .then(response => response.json())
    .then(data => {
        // Получаем контейнер для отображения данных
        const container = document.getElementById('data');
        container.innerHTML = '';
        
        // Счетчики и фильтры
        let resultsCount = 0;                    // Счетчик отображаемых результатов
        let uniqueTitles = new Set();            // Множество для хранения уникальных названий
        
        // Проверяем наличие результатов в ответе API
        if (data.results && Array.isArray(data.results)) {
            // Обрабатываем каждый элемент из результатов
            data.results.forEach(item => {
                const title = item.title;
                
                // Проверяем уникальность и ограничение количества
                if (!uniqueTitles.has(title) && resultsCount < 5) {
                    const videoLink = item.link;
                    
                    // Создаем заголовок для аниме
                    const heading = document.createElement('h2');
                    heading.className = 'h2_name';
                    heading.textContent = title;
                    
                    // Создаем iframe для видео
                    const iframe = document.createElement('iframe');
                    iframe.className = 'iframe_video';
                    iframe.src = videoLink;
                    iframe.allowFullscreen = 'True';
                    
                    // Добавляем элементы в контейнер
                    container.appendChild(heading);
                    container.appendChild(iframe);
                    
                    // Обновляем счетчики
                    uniqueTitles.add(title);
                    resultsCount++;
                }
            });
        }
    })
    .catch(error => {
        // Обработка ошибок при запросе к API
        console.error('Error:', error);
    });
