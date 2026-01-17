#!/usr/bin/env node

/**
 * Скрипт проверки готовности проекта к развертыванию на Vercel
 * 
 * Проверяет:
 * - Наличие всех необходимых файлов
 * - Корректность конфигурации
 * - Валидность JSON файлов
 * - Доступность ресурсов
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Проверка готовности к развертыванию на Vercel...\n');

// Список обязательных файлов
const requiredFiles = [
    'index.html',
    'vercel.json',
    'manifest.json',
    'service-worker.js',
    'robots.txt',
    'sitemap.xml'
];

// Список рекомендуемых файлов
const recommendedFiles = [
    'favicon.ico',
    'style.css',
    'api.js',
    '.vercelignore'
];

let errors = 0;
let warnings = 0;

/**
 * Проверка существования файла
 */
function checkFile(filename, required = true) {
    const exists = fs.existsSync(filename);
    if (exists) {
        console.log(`✅ ${filename}`);
        return true;
    } else {
        if (required) {
            console.log(`❌ ${filename} - ОБЯЗАТЕЛЬНЫЙ ФАЙЛ ОТСУТСТВУЕТ`);
            errors++;
        } else {
            console.log(`⚠️  ${filename} - рекомендуемый файл отсутствует`);
            warnings++;
        }
        return false;
    }
}

/**
 * Проверка валидности JSON файла
 */
function checkJsonFile(filename) {
    if (!fs.existsSync(filename)) return false;
    
    try {
        const content = fs.readFileSync(filename, 'utf8');
        JSON.parse(content);
        console.log(`✅ ${filename} - валидный JSON`);
        return true;
    } catch (error) {
        console.log(`❌ ${filename} - НЕВАЛИДНЫЙ JSON: ${error.message}`);
        errors++;
        return false;
    }
}

/**
 * Проверка конфигурации Vercel
 */
function checkVercelConfig() {
    if (!fs.existsSync('vercel.json')) return false;
    
    try {
        const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
        
        // Проверяем наличие основных секций
        if (!config.routes && !config.rewrites) {
            console.log('⚠️  vercel.json - отсутствуют правила маршрутизации');
            warnings++;
        }
        
        if (config.headers) {
            console.log('✅ vercel.json - настроены заголовки кэширования');
        }
        
        return true;
    } catch (error) {
        console.log(`❌ vercel.json - ошибка конфигурации: ${error.message}`);
        errors++;
        return false;
    }
}

/**
 * Проверка PWA манифеста
 */
function checkPWAManifest() {
    if (!fs.existsSync('manifest.json')) return false;
    
    try {
        const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
        
        const requiredFields = ['name', 'short_name', 'start_url', 'display', 'icons'];
        const missingFields = requiredFields.filter(field => !manifest[field]);
        
        if (missingFields.length === 0) {
            console.log('✅ manifest.json - все обязательные поля присутствуют');
        } else {
            console.log(`⚠️  manifest.json - отсутствуют поля: ${missingFields.join(', ')}`);
            warnings++;
        }
        
        return true;
    } catch (error) {
        console.log(`❌ manifest.json - ошибка: ${error.message}`);
        errors++;
        return false;
    }
}

/**
 * Проверка структуры папок
 */
function checkFolderStructure() {
    const folders = ['css', 'webfonts', 'resources', 'favicon'];
    
    folders.forEach(folder => {
        if (fs.existsSync(folder) && fs.statSync(folder).isDirectory()) {
            console.log(`✅ Папка /${folder} существует`);
        } else {
            console.log(`⚠️  Папка /${folder} отсутствует`);
            warnings++;
        }
    });
}

/**
 * Проверка размера проекта
 */
function checkProjectSize() {
    function getDirectorySize(dirPath) {
        let totalSize = 0;
        
        function calculateSize(currentPath) {
            const stats = fs.statSync(currentPath);
            
            if (stats.isDirectory()) {
                const files = fs.readdirSync(currentPath);
                files.forEach(file => {
                    calculateSize(path.join(currentPath, file));
                });
            } else {
                totalSize += stats.size;
            }
        }
        
        calculateSize(dirPath);
        return totalSize;
    }
    
    const size = getDirectorySize('.');
    const sizeMB = (size / 1024 / 1024).toFixed(2);
    
    console.log(`📦 Размер проекта: ${sizeMB} MB`);
    
    if (size > 100 * 1024 * 1024) { // 100MB
        console.log('⚠️  Проект превышает рекомендуемый размер (100MB)');
        warnings++;
    }
}

// Запуск проверок
console.log('📋 Проверка обязательных файлов:');
requiredFiles.forEach(file => checkFile(file, true));

console.log('\n📋 Проверка рекомендуемых файлов:');
recommendedFiles.forEach(file => checkFile(file, false));

console.log('\n🔧 Проверка JSON файлов:');
checkJsonFile('vercel.json');
checkJsonFile('manifest.json');

console.log('\n⚙️  Проверка конфигурации:');
checkVercelConfig();
checkPWAManifest();

console.log('\n📁 Проверка структуры:');
checkFolderStructure();

console.log('\n📊 Анализ проекта:');
checkProjectSize();

// Итоговый отчет
console.log('\n' + '='.repeat(50));
console.log('📋 ИТОГОВЫЙ ОТЧЕТ');
console.log('='.repeat(50));

if (errors === 0 && warnings === 0) {
    console.log('🎉 Проект полностью готов к развертыванию на Vercel!');
} else if (errors === 0) {
    console.log(`✅ Проект готов к развертыванию (${warnings} предупреждений)`);
} else {
    console.log(`❌ Проект НЕ готов к развертыванию (${errors} ошибок, ${warnings} предупреждений)`);
}

console.log(`\n📊 Статистика:`);
console.log(`   Ошибки: ${errors}`);
console.log(`   Предупреждения: ${warnings}`);

if (errors > 0) {
    console.log('\n🔧 Исправьте ошибки перед развертыванием!');
    process.exit(1);
} else {
    console.log('\n🚀 Готово к развертыванию: vercel --prod');
    process.exit(0);
}