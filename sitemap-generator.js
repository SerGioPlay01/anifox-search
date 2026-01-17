/*
 * AniFox 2.5 - Генератор sitemap.xml
 * 
 * 💻 Разработано SerGio Play
 * 🌐 Веб-сайт: https://sergioplay-dev.vercel.app/
 * 📁 GitHub: https://github.com/SerGioPlay01/anifox-search
 * 
 * При использовании данного проекта обязательно указывайте ссылку на разработчика.
 */

const fs = require('fs');
const path = require('path');

// Конфигурация
const SITE_URL = 'https://anifox-search.vercel.app';
const OUTPUT_FILE = 'sitemap.xml';

// Статические страницы
const staticPages = [
    {
        url: '/',
        changefreq: 'daily',
        priority: '1.0',
        lastmod: new Date().toISOString().split('T')[0]
    },
    {
        url: '/privacy-policy.html',
        changefreq: 'monthly',
        priority: '0.3',
        lastmod: new Date().toISOString().split('T')[0]
    },
    {
        url: '/license.html',
        changefreq: 'monthly',
        priority: '0.3',
        lastmod: new Date().toISOString().split('T')[0]
    }
];

// Популярные аниме для включения в sitemap
const popularAnime = [
    'Наруто',
    'Атака титанов',
    'Демон Слейер',
    'Ван Пис',
    'Тетрадь смерти',
    'Моя геройская академия',
    'Токийский гуль',
    'Драгонболл',
    'Блич',
    'Хвост феи',
    'Стальной алхимик',
    'Евангелион',
    'Код Гиас',
    'Хантер х Хантер',
    'Джоджо',
    'Магическая битва',
    'Клинок рассекающий демонов',
    'Ванпанчмен',
    'Моб Психо 100',
    'Доктор Стоун',
    'Обещанный Неверленд',
    'Огненная бригада',
    'Черный клевер',
    'Семь смертных грехов',
    'Реинкарнация безработного',
    'Реинкарнация в слизь',
    'Восхождение героя щита',
    'Оверлорд',
    'Ре:Зеро',
    'Коносуба'
];

// Генерация sitemap
function generateSitemap() {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

    // Добавляем статические страницы
    staticPages.forEach(page => {
        xml += `  <url>
    <loc>${SITE_URL}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
    });

    // Добавляем страницы поиска для популярных аниме
    popularAnime.forEach(anime => {
        const encodedTitle = encodeURIComponent(anime);
        xml += `  <url>
    <loc>${SITE_URL}/?q=${encodedTitle}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
`;
    });

    // Добавляем страницы деталей для популярных аниме
    popularAnime.forEach(anime => {
        const encodedTitle = encodeURIComponent(anime);
        xml += `  <url>
    <loc>${SITE_URL}/anime-detail.html?title=${encodedTitle}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <image:image>
      <image:loc>${SITE_URL}/resources/obl_web.jpg</image:loc>
      <image:title>${anime} - смотреть онлайн</image:title>
      <image:caption>Смотреть ${anime} онлайн бесплатно в HD качестве на AniFox</image:caption>
    </image:image>
  </url>
`;
    });

    // Добавляем страницу избранного
    xml += `  <url>
    <loc>${SITE_URL}/?page=favorites</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.7</priority>
  </url>
`;

    xml += '</urlset>';

    // Записываем файл
    fs.writeFileSync(OUTPUT_FILE, xml, 'utf8');
    console.log(`✅ Sitemap сгенерирован: ${OUTPUT_FILE}`);
    console.log(`📊 Всего URL: ${staticPages.length + popularAnime.length * 2 + 1}`);
}

// Генерация robots.txt
function generateRobots() {
    const robotsTxt = `User-agent: *
Allow: /

# Основные страницы
Allow: /
Allow: /anime-detail.html
Allow: /?page=favorites

# Статические ресурсы
Allow: /css/
Allow: /webfonts/
Allow: /resources/
Allow: /favicon/

# Запрещаем служебные файлы
Disallow: /api.js
Disallow: /script.js
Disallow: /seo.js
Disallow: /*.js$
Disallow: /vercel.json
Disallow: /package.json
Disallow: /.git/
Disallow: /.vscode/

# Sitemap
Sitemap: ${SITE_URL}/sitemap.xml
Sitemap: ${SITE_URL}/sitemap-seo.xml

# Crawl-delay для вежливого краулинга
Crawl-delay: 1
`;

    fs.writeFileSync('robots.txt', robotsTxt, 'utf8');
    console.log('✅ robots.txt обновлен');
}

// Генерация SEO sitemap с дополнительными метаданными
function generateSEOSitemap() {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

    // Главная страница с дополнительными метаданными
    xml += `  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
    <mobile:mobile/>
    <xhtml:link rel="alternate" hreflang="ru" href="${SITE_URL}/"/>
    <image:image>
      <image:loc>${SITE_URL}/resources/obl_web.jpg</image:loc>
      <image:title>AniFox - смотреть аниме онлайн бесплатно</image:title>
      <image:caption>Более 3000 аниме в HD качестве с русской озвучкой</image:caption>
    </image:image>
  </url>
`;

    // Популярные аниме с видео метаданными
    popularAnime.forEach(anime => {
        const encodedTitle = encodeURIComponent(anime);
        xml += `  <url>
    <loc>${SITE_URL}/anime-detail.html?title=${encodedTitle}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
    <mobile:mobile/>
    <xhtml:link rel="alternate" hreflang="ru" href="${SITE_URL}/anime-detail.html?title=${encodedTitle}"/>
    <image:image>
      <image:loc>${SITE_URL}/resources/obl_web.jpg</image:loc>
      <image:title>${anime} - смотреть онлайн</image:title>
      <image:caption>Смотреть ${anime} онлайн бесплатно в HD качестве</image:caption>
    </image:image>
    <video:video>
      <video:thumbnail_loc>${SITE_URL}/resources/obl_web.jpg</video:thumbnail_loc>
      <video:title>${anime} - смотреть онлайн</video:title>
      <video:description>Смотреть ${anime} онлайн бесплатно в HD качестве на AniFox</video:description>
      <video:content_loc>${SITE_URL}/anime-detail.html?title=${encodedTitle}</video:content_loc>
      <video:duration>1440</video:duration>
      <video:publication_date>${new Date().toISOString()}</video:publication_date>
      <video:family_friendly>yes</video:family_friendly>
      <video:live>no</video:live>
    </video:video>
  </url>
`;
    });

    xml += '</urlset>';

    fs.writeFileSync('sitemap-seo.xml', xml, 'utf8');
    console.log('✅ SEO Sitemap сгенерирован: sitemap-seo.xml');
}

// Запуск генерации
if (require.main === module) {
    console.log('🚀 Генерация sitemap и robots.txt...');
    generateSitemap();
    generateSEOSitemap();
    generateRobots();
    console.log('✅ Все файлы сгенерированы успешно!');
}

module.exports = {
    generateSitemap,
    generateSEOSitemap,
    generateRobots
};