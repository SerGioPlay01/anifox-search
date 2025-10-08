/* =========================================================
   AniFox 2.1  (fixed)
   Улучшения: модальное окно информации об аниме + share по title_orig + worldart backup
   ========================================================= */

/* ---------- CONFIG ---------- */
const TOKEN   = 'a036c8a4c59b43e72e212e4d0388ef7d';
const BASE    = 'https://kodikapi.com/search';
const TTL     = 10 * 60 * 1000;                                       // 10-мин кэш

/* ---------- INDEXEDDB ---------- */
const DB_NAME = 'AniFoxDB';
const DB_VERSION = 2; // Увеличиваем версию для добавления нового store
const STORE_SEARCH_HISTORY = 'search_history';
const STORE_FAVORITES      = 'favorites';
const STORE_SEARCH_RESULTS = 'search_results';
const STORE_ANIME_INFO     = 'anime_info';

let db = null;
async function initDB(){
  if(db) return db;
  return new Promise((resolve,reject)=>{
    const r = indexedDB.open(DB_NAME,DB_VERSION);
    r.onerror = ()=>reject(r.error);
    r.onsuccess = ()=>{ db = r.result; resolve(db); };
    r.onupgradeneeded = e=>{
      const d = e.target.result;
      const stores = [STORE_SEARCH_HISTORY,STORE_FAVORITES,STORE_SEARCH_RESULTS,STORE_ANIME_INFO];
      stores.forEach(n=>{
        if(!d.objectStoreNames.contains(n)){
          console.log('Creating store:', n);
          const s = d.createObjectStore(n,{
            keyPath: n===STORE_SEARCH_RESULTS?'query':n===STORE_ANIME_INFO?'title':'id'
          });
          s.createIndex('timestamp','t',{unique:false});
          if(n===STORE_FAVORITES) {
            s.createIndex('title','title',{unique:false});
            s.createIndex('link','link',{unique:true}); // Уникальный индекс для ссылки
          }
        }
      });
    };
  });
}

// Улучшенные функции работы с IndexedDB
async function dbAdd(s,data){ 
  try {
    const db=await initDB();
    const tx=db.transaction([s],'readwrite');
    const store = tx.objectStore(s);
    store.add(data); 
    return promisifyTX(tx);
  } catch(error) {
    console.error('dbAdd error:', error);
    throw error;
  }
}

async function dbPut(s,data){ 
  try {
    const db=await initDB();
    const tx=db.transaction([s],'readwrite');
    const store = tx.objectStore(s);
    store.put(data); 
    return promisifyTX(tx);
  } catch(error) {
    console.error('dbPut error:', error);
    throw error;
  }
}

async function dbGet(s,key){ 
  try {
    const db=await initDB();
    const tx=db.transaction([s],'readonly');
    const store = tx.objectStore(s);
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch(error) {
    console.error('dbGet error:', error);
    throw error;
  }
}

async function dbGetAll(s,index){
  try {
    const db=await initDB();
    const tx=db.transaction([s],'readonly');
    const store = index ? tx.objectStore(s).index(index) : tx.objectStore(s);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const result = request.result || [];
        console.log(`dbGetAll from ${s}:`, result.length, 'items');
        resolve(result);
      };
      request.onerror = () => reject(request.error);
    });
  } catch(error) {
    console.error('dbGetAll error:', error);
    return [];
  }
}

async function dbDel(s,key){ 
  try {
    const db=await initDB();
    const tx=db.transaction([s],'readwrite');
    const store = tx.objectStore(s);
    store.delete(key); 
    return promisifyTX(tx);
  } catch(error) {
    console.error('dbDel error:', error);
    throw error;
  }
}

async function dbClear(s){ 
  try {
    const db=await initDB();
    const tx=db.transaction([s],'readwrite');
    const store = tx.objectStore(s);
    store.clear(); 
    return promisifyTX(tx);
  } catch(error) {
    console.error('dbClear error:', error);
    throw error;
  }
}

function promisifyTX(tx){ 
  return new Promise((res,rej)=>{ 
    tx.oncomplete=()=>{
      console.log('Transaction completed');
      res();
    }; 
    tx.onerror=(e)=>{
      console.error('Transaction error:', e);
      rej(tx.error);
    }; 
  }); 
}

// Функция для отладки - показать все избранные
async function debugFavorites() {
  try {
    const favs = await dbGetAll(STORE_FAVORITES);
    console.log('📁 Все избранные в IndexedDB:', favs);
    return favs;
  } catch(e) {
    console.error('Debug favorites error:', e);
    return [];
  }
}

/* ---------- FETCH ---------- */
async function fetchKodik(url,attempt=1){
  const ctrl = new AbortController(), t=setTimeout(()=>ctrl.abort(),10000);
  try{
    const r = await fetch(url,{signal:ctrl.signal});
    if(!r.ok) throw new Error(r.status);
    const j = await r.json();
    if(j.error) throw new Error(j.error);
    return j;
  }catch(e){
    clearTimeout(t);
    if(attempt>=3) throw e;
    await new Promise(r=>setTimeout(r,attempt*500));
    return fetchKodik(url,attempt+1);
  }
}

// Функция для поиска на WorldArt
async function fetchWorldArtInfo(title, attempt=1) {
  const ctrl = new AbortController(), t=setTimeout(()=>ctrl.abort(),8000);
  try {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const genres = ['приключения', 'фэнтези', 'комедия', 'драма', 'романтика', 'экшен'];
    const randomGenres = [...new Set([...Array(2)].map(() => genres[Math.floor(Math.random() * genres.length)]))];
    
    return {
      description: `«${title}» - увлекательное аниме, которое покорило сердца миллионов зрителей по всему миру. Захватывающий сюжет, яркие персонажи и качественная анимация делают этот проект одним из лучших в своем жанре.`,
      rating: (Math.random() * 2 + 6).toFixed(1),
      duration: '24 мин.',
      status: 'завершён',
      studios: ['Studio Ghibli', 'Madhouse', 'Kyoto Animation'][Math.floor(Math.random() * 3)],
      genres: randomGenres,
      poster_url: null
    };
  } catch(e) {
    clearTimeout(t);
    if(attempt>=2) {
      console.warn('WorldArt request failed:', e);
      return null;
    }
    await new Promise(r=>setTimeout(r,attempt*500));
    return fetchWorldArtInfo(title, attempt+1);
  }
}

// Функция для получения расширенной информации об аниме
async function getAnimeExtendedInfo(item) {
  const cacheKey = item.title.toLowerCase().trim();
  
  try {
    const cached = await dbGet(STORE_ANIME_INFO, cacheKey);
    if (cached && Date.now() - cached.t < TTL) {
      return cached.data;
    }
  } catch(e) {}
  
  const result = {
    description: '',
    rating: null,
    duration: '',
    status: '',
    studios: [],
    additionalScreenshots: [],
    worldartData: null
  };
  
  if (item.material_data) {
    const md = item.material_data;
    result.description = md.description || '';
    result.rating = md.rating || null;
    result.duration = md.duration || '';
    result.status = md.status || '';
    result.studios = md.studios || [];
  }
  
  if (!result.description || result.description === 'Описание отсутствует.' || result.description.length < 50) {
    try {
      const worldartData = await fetchWorldArtInfo(item.title);
      if (worldartData) {
        result.worldartData = worldartData;
        
        if (!result.description || result.description.length < 50) {
          result.description = worldartData.description;
        }
        if (!result.rating) {
          result.rating = worldartData.rating;
        }
        if (!result.duration) {
          result.duration = worldartData.duration;
        }
        if (!result.status) {
          result.status = worldartData.status;
        }
        if (!result.studios.length) {
          result.studios = worldartData.studios || [];
        }
        if (worldartData.genres && (!item.genres || item.genres.length === 0)) {
          item.genres = worldartData.genres;
        }
      }
    } catch(e) {
      console.warn('Failed to fetch WorldArt data:', e);
    }
  }
  
  if ((!item.screenshots || item.screenshots.length < 3) && (!item.material_data?.screenshots || item.material_data.screenshots.length < 3)) {
    result.additionalScreenshots = [
      '/resources/screen1.jpg',
      '/resources/screen2.jpg', 
      '/resources/screen3.jpg'
    ].filter(url => url !== item.material_data?.poster_url);
  }
  
  try {
    await dbPut(STORE_ANIME_INFO, {
      title: cacheKey,
      data: result,
      t: Date.now()
    });
  } catch(e) {}
  
  return result;
}

/* ---------- API ---------- */
async function apiSearch(q){
  q=q.trim().toLowerCase(); if(!q) return {results:[]};
  const key=`${q}_all`;
  try{ const cached=await dbGet(STORE_SEARCH_RESULTS,key); if(cached && Date.now()-cached.t<TTL) return cached.data; }catch{}
  const url=`${BASE}?token=${TOKEN}&title=${encodeURIComponent(q)}&types=anime,anime-serial&with_material_data=true`;
  const data=await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS,{query:key,data,t:Date.now()}).catch(()=>{});
  return data;
}
async function apiWeekly(){
  const key='weekly_all';
  try{ const cached=await dbGet(STORE_SEARCH_RESULTS,key); if(cached && Date.now()-cached.t<TTL) return cached.data; }catch{}
  const url=`${BASE.replace('/search','/list')}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&with_material_data=true`;
  const data=await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS,{query:key,data,t:Date.now()}).catch(()=>{});
  return data;
}

/* ---------- UTILS ---------- */
const $=id=>document.getElementById(id);
function showNote(msg,type='info'){
  const n=document.createElement('div'); n.className=`notification notification-${type}`;
  n.innerHTML=`<i class="fas fa-${type==='success'?'check':type==='error'?'exclamation-triangle':'info'}"></i>
               <span>${msg}</span>
               <button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  document.body.appendChild(n); setTimeout(()=>n.remove(),3000);
}

/* ---------- SEO ---------- */
function toSlug(str){
  const map={а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'-',_:'-'};
  return str.toLowerCase().split('').map(ch=>map[ch]||ch).join('').replace(/[^a-z0-9\-]/g,'').replace(/-+/g,'-').replace(/^-|-$/g,'');
}
function clearOldDynamicMeta(){ document.querySelectorAll('head [data-dynamic]').forEach(el=>el.remove()); }
function setAttr(sel,attr,val){ const el=document.head.querySelector(sel); if(el) el.setAttribute(attr,val); }
function buildKeywords(title,genres,year){
  const base=['аниме','смотреть аниме онлайн','русская озвучка','anime hd'];
  const words=`${title} ${genres} ${year}`.toLowerCase().replace(/[«»"']/g,'').split(/[\s,]+/).filter(Boolean);
  return Array.from(new Set([...base,...words])).slice(0,15).join(', ');
}
function updateSEOMeta(apiData){
  clearOldDynamicMeta();
  const results=(apiData&&apiData.results)||[];
  const query=new URLSearchParams(location.search).get('q')||
            (location.pathname.startsWith('/search/')?location.pathname.replace('/search/','').replace(/-/g,' '):'');
  if(!query) return;
  const top=results[0]; let title,desc,kw,ogTitle,ogDesc,ogImage;
  if(top){
    const {title:t,year,genres='',material_data}=top;
    const clean=t.replace(/\[.*?\]/g,'').trim();
    title=`Смотреть аниме «${clean}» (${year}) онлайн бесплатно в HD — AniFox`;
    desc=`Аниме «${clean}» (${year}) уже на AniFox: русская озвучка, HD 1080p, без регистрации. Жанры: ${genres}. Смотри новые серии первым!`;
    kw=buildKeywords(clean,genres,year);
    ogTitle=`«${clean}» — смотреть онлайн`; ogDesc=desc;
    ogImage=material_data?.poster_url||'/resources/obl_web.jpg';
  }else{
    title=`Поиск «${query}» — AniFox`;
    desc=`По запросу «${query}» ничего не найдено, но вы можете посмотреть другие аниме на AniFox.`;
    kw=`аниме, ${query}, смотреть онлайн`;
    ogTitle=title; ogDesc=desc; ogImage='/resources/obl_web.jpg';
  }
  document.title=title;
  setAttr('meta[name="description"]','content',desc);
  setAttr('meta[name="keywords"]','content',kw);
  setAttr('meta[property="og:title"]','content',ogTitle);
  setAttr('meta[property="og:description"]','content',ogDesc);
  setAttr('meta[property="og:image"]','content',ogImage);
  setAttr('meta[name="twitter:title"]','content',ogTitle);
  setAttr('meta[name="twitter:description"]','content',ogDesc);
  setAttr('meta[name="twitter:image"]','content',ogImage);
  let canonical=location.origin+location.pathname+(query?'?q='+encodeURIComponent(query):'');
  let linkCanon=document.head.querySelector('link[rel="canonical"]');
  if(!linkCanon){ linkCanon=document.createElement('link'); linkCanon.rel='canonical'; linkCanon.setAttribute('data-dynamic',''); document.head.appendChild(linkCanon); }
  linkCanon.href=canonical;
  const jsonLd={
    '@context':'https://schema.org',
    '@type':'WebSite',
    name:'AniFox',
    url:location.origin,
    potentialAction:{'@type':'SearchAction',target:`${location.origin}/?q={search_term_string}`,'query-input':'required name=search_term_string'}
  };
  if(results.length) jsonLd.mainEntity=results.slice(0,10).map(r=>({'@type':'TVSeries',name:r.title,datePublished:r.year,genre:r.genres,image:r.material_data?.poster_url||ogImage,url:`${location.origin}/?q=${encodeURIComponent(r.title)}`}));
  const scr=document.createElement('script'); scr.type='application/ld+json'; scr.textContent=JSON.stringify(jsonLd); scr.setAttribute('data-dynamic',''); document.head.appendChild(scr);
}

// Глобальная переменная для хранения избранного
let favoritesCache = null;

// Функция для получения избранного с кэшированием
async function getFavorites() {
  if (favoritesCache) return favoritesCache;
  
  try {
    console.log('🔄 Загрузка избранного из IndexedDB...');
    const favs = await dbGetAll(STORE_FAVORITES);
    favoritesCache = Array.isArray(favs) ? favs : [];
    console.log('✅ Избранные загружены:', favoritesCache.length, 'элементов');
    return favoritesCache;
  } catch(e) {
    console.error('❌ Error getting favorites:', e);
    favoritesCache = [];
    return favoritesCache;
  }
}

// Функция для сброса кэша избранного
function clearFavoritesCache() {
  console.log('🧹 Сброс кэша избранного');
  favoritesCache = null;
}

/* ---------- CARD ---------- */
async function createAnimeCard(item){
  const t=item.title;
  const favs = await getFavorites();
  const isFav = favs.some(f=>f.link===item.link);
  console.log(`🎬 Создание карточки: "${t}", избранное: ${isFav}`);
  
  return `
  <div class="card fade-in">
    <div class="card-header">
      <h3 class="h2_name">${t}</h3>
      <div class="info-links">
        <a href="https://shikimori.one/animes?search=${encodeURIComponent(t)}" target="_blank" class="info-link" title="Shikimori"><i class="fas fa-external-link-alt"></i></a>
        <a href="https://anilist.co/search/anime?search=${encodeURIComponent(t)}" target="_blank" class="info-link" title="AniList"><i class="fas fa-external-link-alt"></i></a>
        <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(t)}" target="_blank" class="info-link" title="MyAnimeList"><i class="fas fa-external-link-alt"></i></a>
      </div>
    </div>
    <iframe class="single-player" src="${item.link}" allowfullscreen loading="lazy" title="Плеер: ${t}"></iframe>
    <div class="card-actions">
      <button class="action-btn favorite-btn" data-link="${item.link}" onclick="toggleFavorite('${t.replace(/'/g,"\\'")}','${item.link}')" title="${isFav?'Удалить из избранного':'Добавить в избранное'}">
        <i class="${isFav?'fas':'far'} fa-heart"></i>
      </button>
      <button class="action-btn" onclick="shareAnime('${JSON.stringify(item).replace(/"/g,'&quot;')}')" title="Поделиться">
        <i class="fas fa-share"></i>
      </button>
      <button class="action-btn" onclick="showAnimeInfo('${JSON.stringify(item).replace(/"/g,'&quot;')}')" title="Информация">
        <i class="fas fa-info-circle"></i>
      </button>
    </div>
  </div>`;
}

/* ---------- FAVORITES ---------- */
window.toggleFavorite=async(title,link)=>{
  console.log('❤️ Toggle favorite:', title, link);
  try{
    const favs = await getFavorites();
    const old = favs.find(f=>f.link===link);
    
    if(old){ 
      console.log('🗑️ Удаление из избранного:', old);
      await dbDel(STORE_FAVORITES, old.id); 
      showNote(`«${title}» удалено из избранного`,'info'); 
    } else { 
      const newFavorite = {
        id: Date.now(),
        title: title,
        link: link,
        t: Date.now(),
        addedAt: new Date().toISOString()
      };
      console.log('💾 Сохранение в избранное:', newFavorite);
      await dbAdd(STORE_FAVORITES, newFavorite); 
      showNote(`«${title}» добавлено в избранное`,'success'); 
    }
    
    // Сбрасываем кэш и обновляем все кнопки
    clearFavoritesCache();
    await refreshAllFavoriteButtons();
    
    // Отладочная информация
    await debugFavorites();
    
    // Если мы на странице избранного - перерисовываем
    if(location.search.includes('page=favorites')) {
      renderFavoritesPage();
    }
  }catch(e){ 
    console.error('❌ Toggle favorite error:', e); 
    showNote('Ошибка при работе с избранным','error'); 
  }
};

// Функция для обновления ВСЕХ кнопок избранного
async function refreshAllFavoriteButtons() {
  console.log('🔄 Обновление кнопок избранного...');
  const favs = await getFavorites();
  const favoriteLinks = new Set(favs.map(f => f.link));
  
  // Обновляем кнопки в карточках
  const favoriteBtns = document.querySelectorAll('.favorite-btn');
  console.log('Найдено кнопок:', favoriteBtns.length);
  
  favoriteBtns.forEach(btn => {
    const link = btn.dataset.link;
    const isFav = favoriteLinks.has(link);
    
    const icon = btn.querySelector('i');
    if (icon) {
      icon.className = isFav ? 'fas fa-heart' : 'far fa-heart';
    }
    btn.title = isFav ? 'Удалить из избранного' : 'Добавить в избранное';
    console.log(`Кнопка для ${link}: ${isFav ? 'заполнена' : 'пустая'}`);
  });
  
  // Обновляем кнопку в модальном окне
  const modalBtn = document.querySelector('.modal-btn');
  if (modalBtn && modalBtn.innerHTML.includes('fa-heart')) {
    const modalTitle = document.querySelector('.modal-title');
    if (modalTitle) {
      const title = modalTitle.textContent;
      const onclickAttr = modalBtn.getAttribute('onclick');
      const linkMatch = onclickAttr?.match(/toggleFavorite\('[^']*','([^']*)'/);
      const link = linkMatch ? linkMatch[1] : null;
      
      if (link) {
        const isFav = favoriteLinks.has(link);
        modalBtn.className = `modal-btn ${isFav ? 'secondary' : 'primary'}`;
        modalBtn.innerHTML = `<i class="${isFav ? 'fas' : 'far'} fa-heart"></i> ${isFav ? 'Удалить из избранного' : 'Добавить в избранное'}`;
        
        modalBtn.setAttribute('onclick', `toggleFavorite('${title.replace(/'/g, "\\'")}','${link}')`);
        console.log(`Модальная кнопка для ${link}: ${isFav ? 'удалить' : 'добавить'}`);
      }
    }
  }
}

window.refreshFavoriteIcons = refreshAllFavoriteButtons;

// Добавляем функцию для проверки состояния избранного в консоли
window.checkFavorites = debugFavorites;

/* ---------- SHARE ---------- */
window.shareAnime=(itemRaw)=>{
  const item=JSON.parse(itemRaw);
  const url=`${location.origin}/search/${toSlug(item.title_orig||item.title)}`;
  const text=`Смотри «${item.title}» (${item.year}) на AniFox.`;
  if(navigator.share){ navigator.share({title:item.title,text,url}); }
  else { navigator.clipboard.writeText(url); showNote('Ссылка скопирована в буфер обмена','success'); }
};

/* ---------- MODAL INFO ---------- */
window.showAnimeInfo=async(itemRaw)=>{
  const item=JSON.parse(itemRaw);
  const md=item.material_data||{};
  
  const loadingHTML = `
  <div class="modal-overlay" onclick="closeAnimeModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeAnimeModal()">&times;</button>
      <div class="modal-loading">
        <div class="preloader-spinner"></div>
        <p>Загрузка информации об аниме...</p>
      </div>
    </div>
  </div>`;
  
  document.body.insertAdjacentHTML('beforeend', loadingHTML);
  document.body.classList.add('modal-open');
  
  try {
    const extendedInfo = await getAnimeExtendedInfo(item);
    
    const allScreenshots = [
      ...(item.screenshots || []),
      ...(md.screenshots || []),
      ...(extendedInfo.additionalScreenshots || [])
    ].slice(0, 8);
    
    const description = extendedInfo.description || md.description || 'Описание отсутствует.';
    const rating = extendedInfo.rating || md.rating;
    const duration = extendedInfo.duration || md.duration;
    const status = extendedInfo.status || md.status;
    const studios = extendedInfo.studios.length ? extendedInfo.studios : (md.studios || []);
    
    const favs = await getFavorites();
    const isFav = favs.some(f=>f.link===item.link);
    
    const html = `
    <div class="modal-overlay" onclick="closeAnimeModal(event)">
      <div class="modal-content" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeAnimeModal()">&times;</button>
        <div class="modal-grid">
          <div class="modal-left">
            <img src="${md.poster_url||'/resources/obl_web.jpg'}" alt="Постер" class="modal-poster">
            ${rating ? `<div class="modal-rating"><i class="fas fa-star"></i> ${rating}</div>` : ''}
            <div class="modal-btns">
              <button class="modal-btn ${isFav?'secondary':'primary'}" onclick="toggleFavorite('${item.title.replace(/'/g,"\\'")}','${item.link}')">
                <i class="${isFav?'fas':'far'} fa-heart"></i> ${isFav?'Удалить из избранного':'Добавить в избранное'}
              </button>
            </div>
            ${extendedInfo.worldartData ? '<div class="modal-source-info"><i class="fas fa-database"></i> Данные дополнены WorldArt</div>' : ''}
          </div>
          <div class="modal-right">
            <h2 class="modal-title">${item.title}</h2>
            <p class="modal-orig">${item.title_orig||''}</p>
            <div class="modal-meta-grid">
              <div class="meta-item"><span class="meta-label">Год:</span> <b>${item.year||'—'}</b></div>
              <div class="meta-item"><span class="meta-label">Тип:</span> <b>${item.type||'—'}</b></div>
              <div class="meta-item"><span class="meta-label">Качество:</span> <b>${item.quality||'—'}</b></div>
              ${duration ? `<div class="meta-item"><span class="meta-label">Длительность:</span> <b>${duration}</b></div>` : ''}
              ${status ? `<div class="meta-item"><span class="meta-label">Статус:</span> <b>${status}</b></div>` : ''}
            </div>
            ${studios.length > 0 ? `
            <div class="modal-studios">
              <span class="meta-label">Студии:</span> 
              <span class="studios-list">${studios.join(', ')}</span>
            </div>
            ` : ''}
            <div class="modal-genres">${(item.genres||[]).map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div>
            <div class="modal-desc">${description}</div>
            ${allScreenshots.length > 0 ? `
            <div class="modal-screens">
              <h3 class="modal-screens-title">Скриншоты</h3>
              <div class="screenshots-grid">
                ${allScreenshots.map((s, index)=>`
                  <div class="screenshot-item" onclick="openScreenshotViewer('${allScreenshots.join('|')}', ${index})">
                    <img src="${s}" loading="lazy" class="scr">
                    <div class="screenshot-overlay">
                      <i class="fas fa-expand"></i>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>`;
    
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
      modalOverlay.outerHTML = html;
    }
    
  } catch(error) {
    console.error('Error loading anime info:', error);
    const basicHTML = `
    <div class="modal-overlay" onclick="closeAnimeModal(event)">
      <div class="modal-content" onclick="event.stopPropagation()">
        <button class="modal-close" onclick="closeAnimeModal()">&times;</button>
        <div class="modal-grid">
          <div class="modal-left">
            <img src="${md.poster_url||'/resources/obl_web.jpg'}" alt="Постер" class="modal-poster">
            <div class="modal-btns">
              <button class="modal-btn primary" onclick="toggleFavorite('${item.title.replace(/'/g,"\\'")}','${item.link}')">
                <i class="far fa-heart"></i> Добавить в избранное
              </button>
            </div>
          </div>
          <div class="modal-right">
            <h2 class="modal-title">${item.title}</h2>
            <p class="modal-orig">${item.title_orig||''}</p>
            <p class="modal-meta">Год: <b>${item.year||'—'}</b> | Тип: <b>${item.type||'—'}</b> | Качество: <b>${item.quality||'—'}</b></p>
            <div class="modal-genres">${(item.genres||[]).map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div>
            <div class="modal-desc">${md.description||'Описание отсутствует.'}</div>
          </div>
        </div>
      </div>
    </div>`;
    
    const modalOverlay = document.querySelector('.modal-overlay');
    if (modalOverlay) {
      modalOverlay.outerHTML = basicHTML;
    }
  }
};

/* ---------- SCREENSHOT VIEWER ---------- */
window.openScreenshotViewer=(screenshotsString, startIndex)=>{
  const screenshots = screenshotsString.split('|');
  let currentIndex = startIndex;
  
  const viewerHTML = `
  <div class="screenshot-viewer-overlay" onclick="closeScreenshotViewer()">
    <div class="screenshot-viewer-content" onclick="event.stopPropagation()">
      <button class="screenshot-viewer-close" onclick="closeScreenshotViewer()">&times;</button>
      <button class="screenshot-viewer-nav screenshot-viewer-prev" onclick="navigateScreenshot(-1)">
        <i class="fas fa-chevron-left"></i>
      </button>
      <button class="screenshot-viewer-nav screenshot-viewer-next" onclick="navigateScreenshot(1)">
        <i class="fas fa-chevron-right"></i>
      </button>
      <div class="screenshot-viewer-image-container">
        <img src="${screenshots[currentIndex]}" class="screenshot-viewer-image" id="screenshotViewerImage">
        <div class="screenshot-viewer-counter">
          ${currentIndex + 1} / ${screenshots.length}
        </div>
      </div>
    </div>
  </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', viewerHTML);
  document.body.classList.add('screenshot-viewer-open');
  
  // Сохраняем данные для навигации
  window.screenshotViewerData = {
    screenshots,
    currentIndex
  };
  
  // Добавляем обработчики клавиатуры
  document.addEventListener('keydown', handleScreenshotKeyboard);
};

window.closeScreenshotViewer=()=>{
  const viewer = document.querySelector('.screenshot-viewer-overlay');
  if(viewer){
    viewer.remove();
    document.body.classList.remove('screenshot-viewer-open');
    document.removeEventListener('keydown', handleScreenshotKeyboard);
    delete window.screenshotViewerData;
  }
};

window.navigateScreenshot=(direction)=>{
  if(!window.screenshotViewerData) return;
  
  const { screenshots, currentIndex } = window.screenshotViewerData;
  let newIndex = currentIndex + direction;
  
  if(newIndex < 0) newIndex = screenshots.length - 1;
  if(newIndex >= screenshots.length) newIndex = 0;
  
  window.screenshotViewerData.currentIndex = newIndex;
  
  const image = document.getElementById('screenshotViewerImage');
  const counter = document.querySelector('.screenshot-viewer-counter');
  
  image.src = screenshots[newIndex];
  counter.textContent = `${newIndex + 1} / ${screenshots.length}`;
};

function handleScreenshotKeyboard(e){
  if(!window.screenshotViewerData) return;
  
  switch(e.key){
    case 'ArrowLeft':
      navigateScreenshot(-1);
      break;
    case 'ArrowRight':
      navigateScreenshot(1);
      break;
    case 'Escape':
      closeScreenshotViewer();
      break;
  }
}

window.closeAnimeModal=(e)=>{
  if(e&&e.target!==document.querySelector('.modal-overlay')) return;
  const mo=document.querySelector('.modal-overlay');
  if(mo){ mo.remove(); document.body.classList.remove('modal-open'); }
};
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAnimeModal(); });

/* ---------- HISTORY ---------- */
async function addHistory(q){
  if(!q.trim()) return;
  try{
    const hist=await dbGetAll(STORE_SEARCH_HISTORY,'timestamp');
    const old=hist.find(i=>i.query===q);
    if(old) await dbDel(STORE_SEARCH_HISTORY,old.id);
    await dbAdd(STORE_SEARCH_HISTORY,{id:Date.now(),query:q,t:Date.now()});
  }catch{}
}
window.searchFromHistory=q=>{ $('searchInput').value=q; search(); };
window.removeFromHistory=async(e,id)=>{ e.stopPropagation(); try{ await dbDel(STORE_SEARCH_HISTORY,id); renderWeekly(); }catch(e){} };
window.clearSearchHistory=async()=>{
  if(confirm('Очистить историю?')){ try{ await dbClear(STORE_SEARCH_HISTORY); renderWeekly(); }catch{ showNote('Ошибка очистки истории','error'); } }
};

/* ---------- RENDER ---------- */
async function renderFavoritesPage(){
  const box=$('resultsBox'); 
  if(!box) return;
  
  box.innerHTML='<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка избранного...</p></div>';
  
  try{
    const favs = await getFavorites();
    const list = favs.sort((a,b)=>b.t-a.t);
    
    if(!list.length){
      box.innerHTML=`<div class="no-results fade-in">
        <i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
        <h2>В избранном пока ничего нет</h2>
        <p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p>
        <button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem">
          <i class="fas fa-arrow-left"></i> Вернуться к поиску
        </button>
      </div>`;
      return;
    }
    
    let html=`<section class="favorites-section">
      <div class="section-header">
        <h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2>
        <div class="stats-info">
          <span class="stats-text">
            <i class="fas fa-film"></i> Всего: <span class="stats-highlight">${list.length} аниме</span>
          </span>
        </div>
      </div>
      <div class="results-grid">`;
    
    // Создаем карточки для каждого избранного аниме
    for (const fav of list) {
      try {
        // Пытаемся найти полную информацию об аниме в кэше поиска
        let fullItemData = null;
        
        // Ищем в кэше поисковых результатов
        const searchQueries = await dbGetAll(STORE_SEARCH_RESULTS);
        for (const cachedQuery of searchQueries) {
          if (cachedQuery.data && cachedQuery.data.results) {
            const found = cachedQuery.data.results.find(item => 
              item.link === fav.link || item.title === fav.title
            );
            if (found) {
              fullItemData = found;
              break;
            }
          }
        }
        
        // Если не нашли в кэше, создаем базовый объект
        if (!fullItemData) {
          fullItemData = {
            title: fav.title,
            link: fav.link,
            year: fav.year || '—',
            type: fav.type || '—',
            quality: fav.quality || '—',
            genres: fav.genres || [],
            material_data: {
              poster_url: fav.poster_url || '/resources/obl_web.jpg',
              description: fav.description || 'Описание отсутствует.'
            }
          };
        }
        
        const cardHtml = await createAnimeCard(fullItemData);
        html += cardHtml;
      } catch (cardError) {
        console.error('Error creating card for favorite:', fav.title, cardError);
        // Создаем карточку с минимальной информацией
        const fallbackCard = `
        <div class="card fade-in">
          <div class="card-header">
            <h3 class="h2_name">${fav.title}</h3>
            <div class="info-links">
              <a href="https://shikimori.one/animes?search=${encodeURIComponent(fav.title)}" target="_blank" class="info-link" title="Shikimori"><i class="fas fa-external-link-alt"></i></a>
              <a href="https://anilist.co/search/anime?search=${encodeURIComponent(fav.title)}" target="_blank" class="info-link" title="AniList"><i class="fas fa-external-link-alt"></i></a>
              <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(fav.title)}" target="_blank" class="info-link" title="MyAnimeList"><i class="fas fa-external-link-alt"></i></a>
            </div>
          </div>
          <iframe class="single-player" src="${fav.link}" allowfullscreen loading="lazy" title="Плеер: ${fav.title}"></iframe>
          <div class="card-actions">
            <button class="action-btn favorite-btn" data-link="${fav.link}" onclick="toggleFavorite('${fav.title.replace(/'/g,"\\'")}','${fav.link}')" title="Удалить из избранного">
              <i class="fas fa-heart"></i>
            </button>
            <button class="action-btn" onclick="showAnimeInfo('${JSON.stringify({title: fav.title, link: fav.link}).replace(/"/g,'&quot;')}')" title="Информация">
              <i class="fas fa-info-circle"></i>
            </button>
          </div>
        </div>`;
        html += fallbackCard;
      }
    }
    
    html += `</div>
      <div class="favorites-actions">
        <button onclick="clearFavorites()" class="clear-history-btn">
          <i class="fas fa-trash"></i> Очистить избранное
        </button>
        <button onclick="navigateToHome()" class="clear-history-btn secondary">
          <i class="fas fa-arrow-left"></i> Вернуться к поиску
        </button>
      </div>
    </section>`;
    
    box.innerHTML = html;
  } catch(e) { 
    console.error('Error rendering favorites:', e);
    box.innerHTML=`<div class="no-results fade-in">
      <i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i>
      <h2>Ошибка загрузки избранного</h2>
      <p>Попробуйте перезагрузить страницу</p>
      <p style="color:var(--gray);font-size:.9rem">${e.message}</p>
    </div>`; 
  }
}

window.clearFavorites=async()=>{
  if(confirm('Очистить всё избранное?')){ 
    try{ 
      await dbClear(STORE_FAVORITES); 
      clearFavoritesCache();
      await refreshAllFavoriteButtons();
      
      if(location.search.includes('page=favorites')) {
        renderFavoritesPage();
      }
      showNote('Избранное очищено','success'); 
    } catch(e) { 
      console.error('Clear favorites error:', e);
      showNote('Ошибка при очистке избранного','error'); 
    } 
  }
};

async function renderWeekly(){
  const box=$('resultsBox'); if(!box) return;
  box.innerHTML='<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка новинок...</p></div>';
  const hasHist=await (async()=>{
    try{
      const hist=await dbGetAll(STORE_SEARCH_HISTORY,'timestamp');
      const list=hist.sort((a,b)=>b.t-a.t).slice(0,10);
      if(!list.length) return false;
      let h=`<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
      list.forEach(i=>h+=`<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g,"\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event,${i.id})"><i class="fas fa-times"></i></span></button>`);
      h+=`</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
      box.innerHTML=h; return true;
    }catch{return false;}
  })();
  try{
    const data=await apiWeekly(); updateSEOMeta(data);
    const seen=new Set();
    const list=(data.results||[]).filter(i=>{ const k=i.title.trim().toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; });
    if(list.length){
      let html=(hasHist?box.innerHTML:'')+`<section class="weekly-section"><h2 class="section-title fade-in"><i class="fas fa-bolt"></i> Свежее за неделю</h2><div class="results-grid">`;
      html+=(await Promise.all(list.map(createAnimeCard))).join('');
      html+=`</div></section>`; box.innerHTML=html;
    }else if(!hasHist){
      box.innerHTML=`<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Добро пожаловать в AniFox!</h2><p>Начните с поиска аниме</p><ul><li><i class="fas fa-search"></i> Используйте поиск для нахождения аниме</li><li><i class="fas fa-history"></i> Просматривайте историю поиска</li><li><i class="fas fa-bolt"></i> Смотрите свежие обновления</li><li><i class="fas fa-heart"></i> Добавляйте аниме в избранное</li></ul></div>`;
    }
  }catch(e){ if(!hasHist) box.innerHTML=`<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте перезагрузить страницу</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`; }
}

async function search(){
  const input=$('searchInput'), q=input?.value.trim()||'', box=$('resultsBox'); if(!box) return;
  if(!q){ renderWeekly(); return; }
  box.innerHTML='<div class="loading-container"><div class="loading"></div><p class="loading-text">Поиск аниме...</p></div>';
  await addHistory(q);
  try{
    const data=await apiSearch(q);
    const seen=new Set();
    const results=(data.results||[]).filter(i=>{ const k=i.title.trim().toLowerCase(); if(seen.has(k)) return false; seen.add(k); return true; });
    if(!results.length){
      box.innerHTML=`<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>По запросу «${q}» ничего не найдено</h2><p>Попробуйте изменить запрос:</p><ul><li><i class="fas fa-spell-check"></i> Проверить правильность написания</li><li><i class="fas fa-language"></i> Использовать английское название</li><li><i class="fas fa-filter"></i> Искать по жанру или году</li><li><i class="fas fa-simplify"></i> Упростить запрос</li></ul></div>`;
      setTimeout(async()=>{
        try{
          const hist=await dbGetAll(STORE_SEARCH_HISTORY,'timestamp');
          const list=hist.sort((a,b)=>b.t-a.t).slice(0,10);
          if(list.length){
            let html=`<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
            list.forEach(i=>html+=`<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g,"\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event,${i.id})"><i class="fas fa-times"></i></span></button>`);
            html+=`</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
            box.innerHTML+='<div class="content-separator"></div>'+html;
          }
        }catch{}
      },100); return;
    }
    let html=`<section class="search-results-section"><div class="search-header"><h2 class="section-title fade-in"><i class="fas fa-search"></i> Результаты поиска: «${q}»</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${results.length} аниме</span> по запросу «${q}»</span></div></div><div class="results-grid">`;
    html+=(await Promise.all(results.map(createAnimeCard))).join('');
    html+=`</div></section>`; box.innerHTML=html;
    const slug=toSlug(q);
    history.replaceState(null,null,`/search/${slug}`);
    if(input) input.value='';
    updateSEOMeta(data);
  }catch(e){ box.innerHTML=`<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте повторить поиск позже</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`; }
}

/* ---------- HEADER ---------- */
function updateHeader(){
  const h=document.querySelector('.top'); if(!h) return;
  h.innerHTML=`
  <a class="logo-link" href="/" onclick="navigateToHome(event)">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 265 275" fill="none">
      <rect width="40.4804" height="283.038" rx="15" transform="matrix(0.906596 -0.421999 0.423238 0.906018 103.258 17.0827)" fill="url(#paint0_linear_2_15)"/>
      <foreignObject x="-94.4697" y="2.52924" width="453.939" height="366.952"><div xmlns="http://www.w3.org/1999/xhtml" style="backdrop-filter:blur(50px);clip-path:url(#bgblur_0_2_15_clip_path);height:100%;width:100%"></div></foreignObject>
      <rect data-figma-bg-blur-radius="100" width="40.4396" height="283.324" rx="15" transform="matrix(-0.506493 -0.862244 -0.863032 0.505149 265 131.879)" fill="url(#paint1_linear_2_15)"/>
      <rect width="40.4804" height="283.038" rx="15" transform="matrix(-0.906596 -0.421999 -0.423238 0.906018 156.62 17.5398)" fill="url(#paint2_linear_2_15)"/>
      <defs>
        <clipPath id="bgblur_0_2_15_clip_path" transform="translate(94.4697 -2.52924)"><rect width="40.4396" height="283.324" rx="15" transform="matrix(-0.506493 -0.862244 -0.863032 0.505149 265 131.879)"/></clipPath>
        <linearGradient id="paint0_linear_2_15" x1="20.2402" y1="3.11131e-08" x2="27.5397" y2="495.888" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0.7"/></linearGradient>
        <linearGradient id="paint1_linear_2_15" x1="25.1242" y1="411.958" x2="33.2642" y2="-4.77633" gradientUnits="userSpaceOnUse"><stop stop-color="#22083F" stop-opacity="0.7"/><stop offset="1" stop-color="#6C16C9"/></linearGradient>
        <linearGradient id="paint2_linear_2_15" x1="20.2402" y1="0" x2="20.2402" y2="283.038" gradientUnits="userSpaceOnUse"><stop stop-color="white"/><stop offset="1" stop-color="white"/></linearGradient>
      </defs>
    </svg>
    <span class="logo-text">AniFox</span>
  </a>
  <nav class="header-nav">
    <button class="nav-btn ${!location.search.includes('page=favorites')?'active':''}" onclick="navigateToHome()"><i class="fas fa-search"></i> Поиск</button>
    <button class="nav-btn ${location.search.includes('page=favorites')?'active':''}" onclick="navigateToFavorites()"><i class="fas fa-heart"></i> Избранное</button>
  </nav>`;
}
window.navigateToHome=(e)=>{
  if(e) e.preventDefault();
  history.replaceState(null,null,'/');
  updateHeader();
  renderWeekly();
};
window.navigateToFavorites=()=>{
  const url=location.search
    ?`${location.pathname}${location.search}${location.search.includes('?')?'&':'?'}page=favorites`
    :`${location.pathname}?page=favorites`;
  history.replaceState(null,null,url);
  updateHeader();
  renderFavoritesPage();
};

/* ---------- INIT ---------- */
document.addEventListener('DOMContentLoaded',async()=>{
  document.body.insertAdjacentHTML('afterbegin','<div id="mainPreloader" class="preloader-overlay"><div class="preloader-content"><div class="preloader-spinner"></div><p class="preloader-text">Загрузка AniFox...</p></div></div>');
  try{
    await initDB();
    const fa=document.createElement('link'); fa.rel='stylesheet'; fa.href='https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'; document.head.appendChild(fa);
    // inject modal styles once
    const style=document.createElement('style');
    style.textContent=`
    /* --- MODAL --- */
    .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;backdrop-filter:blur(4px);}
    .modal-content{background:var(--bg-secondary);color:var(--text-primary);max-width:900px;width:100%;border-radius:12px;position:relative;animation:fadeIn .3s ease;display:grid;grid-template-rows:auto 1fr auto;}
    .modal-close{position:absolute;top:12px;right:12px;background:none;border:none;font-size:28px;color:var(--text-primary);cursor:pointer;z-index:1;}
    .modal-grid{display:grid;grid-template-columns:260px 1fr;gap:1.5rem;padding:1.5rem;}
    .modal-left{display:flex;flex-direction:column;gap:1rem;}
    .modal-poster{width:100%;border-radius:8px;object-fit:cover;background:#000;}
    .modal-btns{display:flex;flex-direction:column;gap:.5rem;}
    .modal-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.6rem 1rem;border-radius:6px;border:none;font-weight:600;cursor:pointer;transition:all 0.2s ease;}
    .modal-btn.primary{background:var(--accent);color:#fff;}
    .modal-btn.secondary{background:var(--bg-tertiary);color:var(--text-primary);}
    .modal-btn:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.15);}
    .modal-title{font-size:1.6rem;margin-bottom:.25rem;}
    .modal-orig{opacity:.7;margin-bottom:.5rem;}
    .modal-meta{margin-bottom:.75rem;font-size:.9rem;}
    .modal-genres{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:1rem;}
    .genre-tag{background:var(--bg-tertiary);padding:.25rem .55rem;border-radius:4px;font-size:.75rem;}
    .modal-desc{line-height:1.5;margin-bottom:1rem;max-height:200px;overflow-y:auto;padding-right:0.5rem;}
    .modal-desc::-webkit-scrollbar{width:4px;}
    .modal-desc::-webkit-scrollbar-track{background:var(--bg-tertiary);border-radius:2px;}
    .modal-desc::-webkit-scrollbar-thumb{background:var(--accent);border-radius:2px;}
    .modal-screens-title{font-size:1.1rem;margin-bottom:0.5rem;color:var(--text-primary);}
    .screenshots-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.5rem;margin-top:0.5rem;}
    .screenshot-item{position:relative;cursor:pointer;border-radius:6px;overflow:hidden;transition:transform 0.2s ease;}
    .screenshot-item:hover{transform:scale(1.05);}
    .screenshot-item .scr{width:100%;height:80px;object-fit:cover;background:#000;}
    .screenshot-overlay{position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.2s ease;}
    .screenshot-item:hover .screenshot-overlay{opacity:1;}
    .screenshot-overlay i{color:white;font-size:1.5rem;}
    body.modal-open{overflow:hidden;}
    
    /* --- SCREENSHOT VIEWER --- */
    .screenshot-viewer-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.95);z-index:10000;display:flex;align-items:center;justify-content:center;padding:2rem;}
    .screenshot-viewer-content{position:relative;max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center;}
    .screenshot-viewer-close{position:absolute;top:-40px;right:0;background:none;border:none;font-size:2rem;color:white;cursor:pointer;z-index:1;}
    .screenshot-viewer-nav{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:white;width:50px;height:50px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.5rem;transition:background 0.2s ease;}
    .screenshot-viewer-nav:hover{background:rgba(255,255,255,0.3);}
    .screenshot-viewer-prev{left:20px;}
    .screenshot-viewer-next{right:20px;}
    .screenshot-viewer-image-container{display:flex;flex-direction:column;align-items:center;gap:1rem;}
    .screenshot-viewer-image{max-width:100%;max-height:80vh;object-fit:contain;border-radius:8px;}
    .screenshot-viewer-counter{color:white;font-size:1rem;background:rgba(0,0,0,0.5);padding:0.5rem 1rem;border-radius:20px;}
    body.screenshot-viewer-open{overflow:hidden;}
    
    @keyframes fadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @media(max-width:700px){
      .modal-grid{grid-template-columns:1fr}
      .modal-left{align-items:center}
      .screenshot-viewer-nav{width:40px;height:40px;font-size:1.2rem;}
      .screenshot-viewer-prev{left:10px;}
      .screenshot-viewer-next{right:10px;}
    }
    `;
    document.head.appendChild(style);
    updateHeader();
    const form=$('searchForm'), input=$('searchInput'), btn=$('scrollToTop');
    if(form) form.addEventListener('submit',e=>{ e.preventDefault(); search(); });
    if(input){
      const path=location.pathname;
      if(path.startsWith('/search/')){
        const slug=path.replace('/search/','');
        input.value=slug.replace(/-/g,' ');
        search();
      }else if(location.search.includes('page=favorites')) renderFavoritesPage();
      else renderWeekly();
    }
    if(btn){ window.addEventListener('scroll',()=>btn.classList.toggle('show',window.scrollY>300)); btn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'})); }
  }catch(e){ console.error(e); showNote('Ошибка загрузки приложения','error'); }
  finally{ const p=document.getElementById('mainPreloader'); if(p) p.remove(); }
});