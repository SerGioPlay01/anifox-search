/*  AniFox «конфиденциальная» рекламная мишень
    Блокировщики ловятся → трекинг не инициализируется
    Самоудаляется через 1,5 с
-------------------------------------------------- */

(function(){
    /* 1. Google-Adsense: создаём тег, но НЕ инициализируем */
    const g = document.createElement('script');
    g.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
    g.async = true;
    g.textContent = ''; // пусто → не запускается
    document.head.appendChild(g);

    /* 2. Яндекс-Директ: тег без вызова */
    const y = document.createElement('script');
    y.src = 'https://yastatic.net/pcode/adfox/loader.js';
    y.textContent = ''; // пусто → не запускается
    document.head.appendChild(y);

    /* 3. Скрытые баннерные блоки (0 px) без трекинга */
    const banners = [
        {id: 'div-gpt-ad-123456789-0',  cls: 'adsbygoogle'},
        {id: 'yandex_rtb_R-A-123456-7', cls: 'yandex-direct'},
        {id: 'adfox_123456',           cls: 'adfox-banner'}
    ];

    banners.forEach(b => {
        const d = document.createElement('div');
        d.id = b.id;
        d.className = b.cls;
        d.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;width:0!important;height:0!important;opacity:0!important;pointer-events:none!important;';
        // НЕ вызываем window.adsbygoogle || Ya.RTB
        document.body.appendChild(d);
    });

    /* 4. Пиксели-заглушки (не отправляют запросы) */
    const pixels = [
        'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7' // 1×1 прозрачный
    ];

    pixels.forEach(url => {
        const i = document.createElement('img');
        i.src = url;
        i.width = i.height = 1;
        i.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;opacity:0!important;pointer-events:none!important;';
        document.body.appendChild(i);
    });

    /* 5. Классические рекламные классы без контента */
    const classic = document.createElement('div');
    classic.className = 'advertisement ad-banner ad-slot banner-ad adsbygoogle adfox';
    classic.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;width:0!important;height:0!important;opacity:0!important;pointer-events:none!important;';
    document.body.appendChild(classic);

    /* 6. Пустой iframe без src (ловит Ghostery) */
    const f = document.createElement('iframe');
    f.src = 'about:blank'; // не грузим реальный домен
    f.style.cssText = 'position:absolute!important;left:-9999px!important;top:-9999px!important;width:0!important;height:0!important;opacity:0!important;pointer-events:none!important;border:none!important;';
    document.body.appendChild(f);

    /* 7. Сообщаем anti-adblock.js, что мишень загружена */
    window.__anifoxAdLoaded = true;

    /* 8. Самоудаление через 1,5 секунды */
    setTimeout(() => {
        document.head.removeChild(g);
        document.head.removeChild(y);
        banners.forEach(b => {
            const el = document.getElementById(b.id);
            if (el) el.remove();
        });
        document.querySelectorAll('img[src^="data:"]').forEach(img => img.remove());
        classic.remove();
        f.remove();
        console.log('[AniFox] Конфиденциальная мишень удалена из DOM');
    }, 1500);
})();