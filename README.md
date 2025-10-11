# 🦊 AniFox - Anime Search Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-AniFox-red?style=for-the-badge&logo=vercel)](https://anifox-search.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github)](https://github.com/SerGioPlay01/anifox-search)
[![Developer](https://img.shields.io/badge/Developer-SerGio%20Play-blue?style=for-the-badge&logo=github)](https://github.com/SerGioPlay01)

> **Лучшая платформа для просмотра аниме онлайн в HD качестве. Бесплатно и без регистрации.**

AniFox — это современная веб-платформа для поиска и просмотра аниме, построенная с использованием передовых веб-технологий. Проект предоставляет удобный интерфейс для поиска аниме, просмотра в высоком качестве и управления личной коллекцией.

## 🎯 Цели проекта

### Для пользователей:
- **Быстрый поиск аниме** — мощная система поиска с поддержкой русских и английских названий
- **HD качество** — просмотр аниме в высоком разрешении (720p/1080p)
- **Без регистрации** — полный доступ к функционалу без создания аккаунта
- **Персональная коллекция** — сохранение избранных аниме в браузере
- **Адаптивный дизайн** — отличная работа на всех устройствах (ПК, планшет, смартфон)
- **PWA поддержка** — установка как нативное приложение

### Для разработчиков:
- **Современный стек** — чистый JavaScript, HTML5, CSS3
- **Оптимизация производительности** — кэширование, ленивая загрузка, дебаунсинг
- **SEO оптимизация** — динамические мета-теги, структурированные данные
- **Модульная архитектура** — легко расширяемый и поддерживаемый код
- **API интеграция** — работа с внешними сервисами (Kodik, Shikimori)
- **Офлайн функциональность** — Service Worker, IndexedDB

## ✨ Основные возможности

### 🔍 Поиск и навигация
- **Умный поиск** — поддержка частичных совпадений и транслитерации
- **История поиска** — сохранение последних запросов
- **Фильтрация** — поиск по жанрам, годам, студиям
- **Свежие новинки** — автоматическое обновление каталога

### 📱 Пользовательский интерфейс
- **Современный дизайн** — темная тема с градиентами и анимациями
- **Адаптивность** — оптимизация для всех размеров экранов
- **Интуитивная навигация** — простое и понятное управление
- **Быстрая загрузка** — оптимизированные ресурсы и кэширование

### 💾 Локальное хранение
- **Избранное** — сохранение любимых аниме
- **История просмотров** — отслеживание просмотренного контента
- **Настройки** — персонализация интерфейса
- **Кэш данных** — ускорение повторных запросов

### 🎬 Плеер и контент
- **Встроенный плеер** — просмотр без перехода на другие сайты
- **HD качество** — поддержка высокого разрешения
- **Информация об аниме** — подробные описания, рейтинги, скриншоты
- **Ссылки на базы данных** — интеграция с Shikimori, AniList, MyAnimeList

## 🛠 Технологический стек

### Frontend
- **HTML5** — семантическая разметка
- **CSS3** — современные стили с CSS Grid, Flexbox, анимациями
- **Vanilla JavaScript** — чистый JS без фреймворков
- **PWA** — Progressive Web App функциональность

### API и сервисы
- **Kodik API** — получение видео-контента
- **Shikimori API** — информация об аниме
- **Font Awesome** — иконки
- **Yandex.Metrika** — аналитика

### Хранение данных
- **IndexedDB** — локальная база данных
- **LocalStorage** — простые настройки
- **Service Worker** — кэширование и офлайн режим

### Развертывание
- **Vercel** — хостинг и CDN
- **GitHub** — версионный контроль
- **Custom Domain** — anifox-search.vercel.app

## 🚀 Быстрый старт

### Установка и запуск

1. **Клонирование репозитория**
```bash
git clone https://github.com/SerGioPlay01/anifox-search.git
cd anifox-search
```

2. **Локальный запуск**
```bash
# Простой HTTP сервер
python -m http.server 8000
# или
npx serve .
# или
php -S localhost:8000
```

3. **Открытие в браузере**
```
http://localhost:8000
```

### Настройка API

1. **Получение токена Kodik**
   - Зарегистрируйтесь на [kodikapi.com](https://kodikapi.com)
   - Получите API токен
   - Замените токен в `api.js`:
   ```javascript
   const TOKEN = "ваш_токен_здесь";
   ```

2. **Настройка аналитики** (опционально)
   - Зарегистрируйтесь в [Yandex.Metrika](https://metrika.yandex.ru)
   - Замените ID в `index.html`:
   ```javascript
   ym(ваш_ID, 'init', { ... });
   ```

## 📁 Структура проекта

```
anifox-search/
├── 📄 index.html              # Главная страница
├── 🎨 style.css               # Основные стили
├── ⚡ api.js                  # API и основная логика
├── 🔧 script.js               # Дополнительные скрипты
├── 📱 manifest.json           # PWA манифест
├── ⚙️ vercel.json             # Конфигурация Vercel
├── 🔒 privacy-policy.html     # Политика конфиденциальности
├── 📁 css/                    # Font Awesome стили
├── 📁 favicon/                # Иконки сайта
├── 📁 fonts/                  # Локальные шрифты
├── 📁 resources/              # Изображения и ресурсы
├── 📁 webfonts/               # Font Awesome шрифты
└── 📄 README.md               # Документация
```

## 🔧 Конфигурация

### Основные настройки в `api.js`

```javascript
// API конфигурация
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const TTL = 10 * 60 * 1000; // 10 минут кэш
const SHIKIMORI_API_BASE = "https://shikimori.one/api";

// Настройки пагинации
const ITEMS_PER_PAGE = {
    search: 8,    // Результаты поиска
    weekly: 6,    // Свежие новинки
    favorites: 5  // Избранное
};
```

### PWA настройки в `manifest.json`

```json
{
  "name": "AniFox - Смотреть аниме онлайн",
  "short_name": "AniFox",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#5b0a99",
  "background_color": "#5b0a99"
}
```

## 🎨 Кастомизация

### Изменение цветовой схемы

В `style.css` найдите CSS переменные:

```css
:root {
  --red: #5b0a99;        /* Основной цвет */
  --black: #0a0a0a;      /* Фон */
  --white: #f2f2f2;      /* Текст */
  --gray: #666;          /* Вторичный текст */
  --accent: #9115ea;     /* Акцентный цвет */
}
```

### Добавление новых функций

1. **Новый API endpoint** — добавьте в `api.js`
2. **Новые стили** — расширьте `style.css`
3. **Дополнительная логика** — создайте новый модуль

## 📊 Производительность

### Оптимизации
- **Кэширование** — IndexedDB для API ответов
- **Ленивая загрузка** — изображения загружаются по требованию
- **Дебаунсинг** — оптимизация поисковых запросов
- **Сжатие ресурсов** — минифицированные CSS/JS
- **CDN** — быстрая доставка статики через Vercel

### Метрики
- **Lighthouse Score** — 90+ по всем категориям
- **First Contentful Paint** — < 1.5s
- **Largest Contentful Paint** — < 2.5s
- **Cumulative Layout Shift** — < 0.1

## 🔒 Безопасность и приватность

### Защита данных
- **HTTPS** — шифрование всех соединений
- **Локальное хранение** — данные не покидают устройство пользователя
- **CSP заголовки** — защита от XSS атак
- **Валидация входных данных** — санитизация пользовательского ввода

### Политика конфиденциальности
- Подробная информация в `privacy-policy.html`
- Соответствие GDPR требованиям
- Прозрачность сбора данных
- Права пользователей на удаление данных

## 🌐 SEO и доступность

### SEO оптимизация
- **Динамические мета-теги** — автоматическое обновление
- **Структурированные данные** — Schema.org разметка
- **Sitemap** — автоматическая генерация
- **Open Graph** — интеграция с социальными сетями

### Доступность
- **ARIA атрибуты** — поддержка скрин-ридеров
- **Клавиатурная навигация** — полная поддержка
- **Высокий контраст** — читаемость для всех пользователей
- **Альтернативный текст** — для всех изображений

## 🤝 Вклад в проект

### Как помочь проекту

1. **Сообщения об ошибках**
   - Создайте Issue с подробным описанием
   - Укажите браузер и версию
   - Приложите скриншоты если возможно

2. **Предложения улучшений**
   - Опишите новую функцию
   - Объясните пользу для пользователей
   - Предложите способ реализации

3. **Pull Request**
   - Форкните репозиторий
   - Создайте feature branch
   - Следуйте стилю кода проекта
   - Добавьте тесты если необходимо

### Стандарты кода

```javascript
// Именование переменных
const camelCase = "переменные";
const UPPER_CASE = "константы";

// Комментарии
/**
 * Функция для поиска аниме
 * @param {string} query - Поисковый запрос
 * @returns {Promise<Object>} Результаты поиска
 */
async function searchAnime(query) {
    // Реализация
}
```

## 📈 Планы развития

### Ближайшие обновления
- [ ] **Система рекомендаций** — умные предложения на основе истории
- [ ] **Темы оформления** — светлая/темная тема
- [ ] **Многоязычность** — поддержка английского языка
- [ ] **Уведомления** — оповещения о новых сериях
- [ ] **Экспорт данных** — резервное копирование избранного

### Долгосрочные цели
- [ ] **Мобильное приложение** — React Native версия
- [ ] **Социальные функции** — рейтинги, комментарии
- [ ] **API для разработчиков** — публичный API
- [ ] **Интеграция с календарями** — расписание выхода серий

## 📞 Поддержка и контакты

### Связь с разработчиком
- **GitHub**: [@SerGioPlay01](https://github.com/SerGioPlay01)
- **Портфолио**: [sergioplay-dev.vercel.app](https://sergioplay-dev.vercel.app)
- **Email**: sklarovs441@gmail.com

### Сообщество
- **Telegram**: [@anifoxru](https://t.me/anifoxru)
- **VK**: [vk.com/anifox_ru](https://vk.com/anifox_ru)

### Полезные ссылки
- [Документация Kodik API](https://kodikapi.com/docs)
- [Shikimori API](https://shikimori.one/api/doc)
- [PWA документация](https://web.dev/progressive-web-apps/)

## 📄 Лицензия

Этот проект распространяется под лицензией MIT. См. файл `LICENSE` для подробностей.

## ⚠️ Отказ от ответственности

AniFox не хранит видеофайлы на своих серверах и предоставляет только ссылки на контент, размещенный на сторонних платформах. Весь контент предназначен только для ознакомительного просмотра. Администрация не несет ответственности за содержание рекламных материалов и сторонних ресурсов.

---

<div align="center">

**Сделано с ❤️ для аниме-сообщества**

[![GitHub stars](https://img.shields.io/github/stars/SerGioPlay01/anifox-search?style=social)](https://github.com/SerGioPlay01/anifox-search/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/SerGioPlay01/anifox-search?style=social)](https://github.com/SerGioPlay01/anifox-search/network)

</div>

---

# 🦊 AniFox - Anime Search Platform

[![Live Demo](https://img.shields.io/badge/Live%20Demo-AniFox-red?style=for-the-badge&logo=vercel)](https://anifox-search.vercel.app/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=for-the-badge&logo=github)](https://github.com/SerGioPlay01/anifox-search)
[![Developer](https://img.shields.io/badge/Developer-SerGio%20Play-blue?style=for-the-badge&logo=github)](https://github.com/SerGioPlay01)

> **The best platform for watching anime online in HD quality. Free and without registration.**

AniFox is a modern web platform for searching and watching anime, built using cutting-edge web technologies. The project provides a convenient interface for anime search, high-quality viewing, and personal collection management.

## 🎯 Project Goals

### For Users:
- **Fast anime search** — powerful search system with support for Russian and English titles
- **HD quality** — watch anime in high resolution (720p/1080p)
- **No registration** — full access to functionality without creating an account
- **Personal collection** — save favorite anime in browser
- **Responsive design** — excellent performance on all devices (PC, tablet, smartphone)
- **PWA support** — install as a native application

### For Developers:
- **Modern stack** — clean JavaScript, HTML5, CSS3
- **Performance optimization** — caching, lazy loading, debouncing
- **SEO optimization** — dynamic meta tags, structured data
- **Modular architecture** — easily extensible and maintainable code
- **API integration** — work with external services (Kodik, Shikimori)
- **Offline functionality** — Service Worker, IndexedDB

## ✨ Key Features

### 🔍 Search and Navigation
- **Smart search** — support for partial matches and transliteration
- **Search history** — saving recent queries
- **Filtering** — search by genres, years, studios
- **Fresh releases** — automatic catalog updates

### 📱 User Interface
- **Modern design** — dark theme with gradients and animations
- **Responsiveness** — optimization for all screen sizes
- **Intuitive navigation** — simple and clear control
- **Fast loading** — optimized resources and caching

### 💾 Local Storage
- **Favorites** — save favorite anime
- **Viewing history** — track watched content
- **Settings** — interface personalization
- **Data cache** — speed up repeated requests

### 🎬 Player and Content
- **Built-in player** — watch without going to other sites
- **HD quality** — high resolution support
- **Anime information** — detailed descriptions, ratings, screenshots
- **Database links** — integration with Shikimori, AniList, MyAnimeList

## 🛠 Technology Stack

### Frontend
- **HTML5** — semantic markup
- **CSS3** — modern styles with CSS Grid, Flexbox, animations
- **Vanilla JavaScript** — clean JS without frameworks
- **PWA** — Progressive Web App functionality

### APIs and Services
- **Kodik API** — video content retrieval
- **Shikimori API** — anime information
- **Font Awesome** — icons
- **Yandex.Metrika** — analytics

### Data Storage
- **IndexedDB** — local database
- **LocalStorage** — simple settings
- **Service Worker** — caching and offline mode

### Deployment
- **Vercel** — hosting and CDN
- **GitHub** — version control
- **Custom Domain** — anifox-search.vercel.app

## 🚀 Quick Start

### Installation and Setup

1. **Clone the repository**
```bash
git clone https://github.com/SerGioPlay01/anifox-search.git
cd anifox-search
```

2. **Local development**
```bash
# Simple HTTP server
python -m http.server 8000
# or
npx serve .
# or
php -S localhost:8000
```

3. **Open in browser**
```
http://localhost:8000
```

### API Configuration

1. **Get Kodik token**
   - Register at [kodikapi.com](https://kodikapi.com)
   - Get API token
   - Replace token in `api.js`:
   ```javascript
   const TOKEN = "your_token_here";
   ```

2. **Setup analytics** (optional)
   - Register at [Yandex.Metrika](https://metrika.yandex.ru)
   - Replace ID in `index.html`:
   ```javascript
   ym(your_ID, 'init', { ... });
   ```

## 📁 Project Structure

```
anifox-search/
├── 📄 index.html              # Main page
├── 🎨 style.css               # Main styles
├── ⚡ api.js                  # API and main logic
├── 🔧 script.js               # Additional scripts
├── 📱 manifest.json           # PWA manifest
├── ⚙️ vercel.json             # Vercel configuration
├── 🔒 privacy-policy.html     # Privacy policy
├── 📁 css/                    # Font Awesome styles
├── 📁 favicon/                # Site icons
├── 📁 fonts/                  # Local fonts
├── 📁 resources/              # Images and resources
├── 📁 webfonts/               # Font Awesome fonts
└── 📄 README.md               # Documentation
```

## 🔧 Configuration

### Main settings in `api.js`

```javascript
// API configuration
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d";
const BASE = "https://kodikapi.com/search";
const TTL = 10 * 60 * 1000; // 10 minutes cache
const SHIKIMORI_API_BASE = "https://shikimori.one/api";

// Pagination settings
const ITEMS_PER_PAGE = {
    search: 8,    // Search results
    weekly: 6,    // Fresh releases
    favorites: 5  // Favorites
};
```

### PWA settings in `manifest.json`

```json
{
  "name": "AniFox - Смотреть аниме онлайн",
  "short_name": "AniFox",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#5b0a99",
  "background_color": "#5b0a99"
}
```

## 🎨 Customization

### Changing color scheme

In `style.css` find CSS variables:

```css
:root {
  --red: #5b0a99;        /* Primary color */
  --black: #0a0a0a;      /* Background */
  --white: #f2f2f2;      /* Text */
  --gray: #666;          /* Secondary text */
  --accent: #9115ea;     /* Accent color */
}
```

### Adding new features

1. **New API endpoint** — add to `api.js`
2. **New styles** — extend `style.css`
3. **Additional logic** — create new module

## 📊 Performance

### Optimizations
- **Caching** — IndexedDB for API responses
- **Lazy loading** — images load on demand
- **Debouncing** — search query optimization
- **Resource compression** — minified CSS/JS
- **CDN** — fast static delivery via Vercel

### Metrics
- **Lighthouse Score** — 90+ in all categories
- **First Contentful Paint** — < 1.5s
- **Largest Contentful Paint** — < 2.5s
- **Cumulative Layout Shift** — < 0.1

## 🔒 Security and Privacy

### Data Protection
- **HTTPS** — encryption of all connections
- **Local storage** — data doesn't leave user's device
- **CSP headers** — protection against XSS attacks
- **Input validation** — user input sanitization

### Privacy Policy
- Detailed information in `privacy-policy.html`
- GDPR compliance
- Data collection transparency
- User rights to data deletion

## 🌐 SEO and Accessibility

### SEO Optimization
- **Dynamic meta tags** — automatic updates
- **Structured data** — Schema.org markup
- **Sitemap** — automatic generation
- **Open Graph** — social media integration

### Accessibility
- **ARIA attributes** — screen reader support
- **Keyboard navigation** — full support
- **High contrast** — readability for all users
- **Alternative text** — for all images

## 🤝 Contributing

### How to help the project

1. **Bug reports**
   - Create Issue with detailed description
   - Specify browser and version
   - Attach screenshots if possible

2. **Feature suggestions**
   - Describe new feature
   - Explain benefit for users
   - Suggest implementation approach

3. **Pull Request**
   - Fork the repository
   - Create feature branch
   - Follow project code style
   - Add tests if necessary

### Code Standards

```javascript
// Variable naming
const camelCase = "variables";
const UPPER_CASE = "constants";

// Comments
/**
 * Function for anime search
 * @param {string} query - Search query
 * @returns {Promise<Object>} Search results
 */
async function searchAnime(query) {
    // Implementation
}
```

## 📈 Development Roadmap

### Upcoming Updates
- [ ] **Recommendation system** — smart suggestions based on history
- [ ] **Theme system** — light/dark theme
- [ ] **Multilingual support** — English language support
- [ ] **Notifications** — new episode alerts
- [ ] **Data export** — favorites backup

### Long-term Goals
- [ ] **Mobile app** — React Native version
- [ ] **Social features** — ratings, comments
- [ ] **Developer API** — public API
- [ ] **Calendar integration** — episode release schedule

## 📞 Support and Contacts

### Developer Contact
- **GitHub**: [@SerGioPlay01](https://github.com/SerGioPlay01)
- **Portfolio**: [sergioplay-dev.vercel.app](https://sergioplay-dev.vercel.app)
- **Email**: sklarovs441@gmail.com

### Community
- **Telegram**: [@anifoxru](https://t.me/anifoxru)
- **VK**: [vk.com/anifox_ru](https://vk.com/anifox_ru)

### Useful Links
- [Kodik API Documentation](https://kodikapi.com/docs)
- [Shikimori API](https://shikimori.one/api/doc)
- [PWA Documentation](https://web.dev/progressive-web-apps/)

## 📄 License

This project is distributed under the MIT License. See the `LICENSE` file for details.

## ⚠️ Disclaimer

AniFox does not store video files on its servers and only provides links to content hosted on third-party platforms. All content is intended for informational viewing only. The administration is not responsible for the content of advertising materials and third-party resources.

---

<div align="center">

**Made with ❤️ for the anime community**

[![GitHub stars](https://img.shields.io/github/stars/SerGioPlay01/anifox-search?style=social)](https://github.com/SerGioPlay01/anifox-search/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/SerGioPlay01/anifox-search?style=social)](https://github.com/SerGioPlay01/anifox-search/network)

</div>
