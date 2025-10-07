/* =========================================================
   AniFox 2.1  (полный клиентский билет)
   Улучшения: модальное окно информации об аниме + share по title_orig
   ========================================================= */

/* ---------- CONFIG ---------- */
const TOKEN   = 'a036c8a4c59b43e72e212e4d0388ef7d';
const BASE    = 'https://kodikapi.com/search';
const TTL     = 10 * 60 * 1000;                                       // 10-мин кэш

/* ---------- INDEXEDDB ---------- */
const DB_NAME = 'AniFoxDB';
const DB_VERSION = 1;
const STORE_SEARCH_HISTORY = 'search_history';
const STORE_FAVORITES      = 'favorites';
const STORE_SEARCH_RESULTS = 'search_results';

let db = null;
async function initDB(){
  if(db) return db;
  return new Promise((resolve,reject)=>{
    const r = indexedDB.open(DB_NAME,DB_VERSION);
    r.onerror = ()=>reject(r.error);
    r.onsuccess = ()=>{ db = r.result; resolve(db); };
    r.onupgradeneeded = e=>{
      const d = e.target.result;
      [STORE_SEARCH_HISTORY,STORE_FAVORITES,STORE_SEARCH_RESULTS].forEach(n=>{
        if(!d.objectStoreNames.contains(n)){
          const s = d.createObjectStore(n,{keyPath:n===STORE_SEARCH_RESULTS?'query':'id'});
          s.createIndex('timestamp','t',{unique:false});
          if(n===STORE_FAVORITES) s.createIndex('title','title',{unique:false});
        }
      });
    };
  });
}
async function dbAdd(s,data){ const db=await initDB(),tx=db.transaction([s],'readwrite'); tx.objectStore(s).add(data); return promisifyTX(tx); }
async function dbPut(s,data){ const db=await initDB(),tx=db.transaction([s],'readwrite'); tx.objectStore(s).put(data); return promisifyTX(tx); }
async function dbGet(s,key){ const db=await initDB(),tx=db.transaction([s],'readonly'); return tx.objectStore(s).get(key); }
async function dbGetAll(s,index){ 
  const db=await initDB(),tx=db.transaction([s],'readonly'),
        store=index?tx.objectStore(s).index(index):tx.objectStore(s);
  return store.getAll();
}
async function dbDel(s,key){ const db=await initDB(),tx=db.transaction([s],'readwrite'); tx.objectStore(s).delete(key); return promisifyTX(tx); }
async function dbClear(s){ const db=await initDB(),tx=db.transaction([s],'readwrite'); tx.objectStore(s).clear(); return promisifyTX(tx); }
function promisifyTX(tx){ return new Promise((res,rej)=>{ tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }

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

/* ---------- CARD ---------- */
async function createAnimeCard(item){
  const t = item.title;
  const favs = await dbGetAll(STORE_FAVORITES) || []; // ← добавили await
  const isFav = favs.some(f => f.link === item.link);
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
  try{
    const favs=await dbGetAll(STORE_FAVORITES);
    const old=favs.find(f=>f.link===link);
    if(old){ await dbDel(STORE_FAVORITES,old.id); showNote(`«${title}» удалено из избранного`,'info'); }
    else { await dbAdd(STORE_FAVORITES,{id:Date.now(),title,link,t:Date.now()}); showNote(`«${title}» добавлено в избранное`,'success'); }
    refreshFavoriteIcons();
    if(location.hash==='#favorites'||location.search.includes('page=favorites')) renderFavoritesPage();
  }catch(e){ console.error(e); showNote('Ошибка при работе с избранным','error'); }
};
window.refreshFavoriteIcons=async()=>{
  const favs=await dbGetAll(STORE_FAVORITES);
  const set=new Set(favs.map(f=>f.link));
  document.querySelectorAll('.favorite-btn').forEach(btn=>{
    const is=set.has(btn.dataset.link);
    btn.querySelector('i').className=is?'fas fa-heart':'far fa-heart';
    btn.title=is?'Удалить из избранного':'Добавить в избранное';
  });
};

/* ---------- SHARE ---------- */
window.shareAnime=(itemRaw)=>{
  const item=JSON.parse(itemRaw);
  const url=`${location.origin}/search/${toSlug(item.title_orig||item.title)}`;
  const text=`Смотри «${item.title}» (${item.year}) на AniFox. Жанры: ${(item.genres||[]).join(', ')}. ${url}`;
  if(navigator.share){ navigator.share({title:item.title,text,url}); }
  else { navigator.clipboard.writeText(url); showNote('Ссылка скопирована в буфер обмена','success'); }
};

/* ---------- MODAL INFO ---------- */
window.showAnimeInfo=(itemRaw)=>{
  const item=JSON.parse(itemRaw);
  const md=item.material_data||{};
  const screenshots=(item.screenshots||md.screenshots||[]).slice(0,6);
  const html=`
  <div class="modal-overlay" onclick="closeAnimeModal(event)">
    <div class="modal-content" onclick="event.stopPropagation()">
      <button class="modal-close" onclick="closeAnimeModal()">&times;</button>
      <div class="modal-grid">
        <div class="modal-left">
          <img src="${md.poster_url||'/resources/obl_web.jpg'}" alt="Постер" class="modal-poster">
          <div class="modal-btns">
            <a class="modal-btn primary" href="${item.link}" target="_blank">Смотреть</a>
            <button class="modal-btn secondary" onclick="toggleFavorite('${item.title.replace(/'/g,"\\'")}','${item.link}');closeAnimeModal();">
              <i class="fas fa-heart"></i> Избранное
            </button>
          </div>
        </div>
        <div class="modal-right">
          <h2 class="modal-title">${item.title}</h2>
          <p class="modal-orig">${item.title_orig||''}</p>
          <p class="modal-meta">Год: <b>${item.year||'—'}</b> | Тип: <b>${item.type||'—'}</b> | Качество: <b>${item.quality||'—'}</b></p>
          <div class="modal-genres">${(item.genres||[]).map(g=>`<span class="genre-tag">${g}</span>`).join('')}</div>
          <div class="modal-desc">${md.description||'Описание отсутствует.'}</div>
          <div class="modal-screens">
            ${screenshots.map(s=>`<img src="${s}" loading="lazy" class="scr">`).join('')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  document.body.classList.add('modal-open');
};
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
  const box=$('resultsBox'); if(!box) return;
  box.innerHTML='<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка избранного...</p></div>';
  try{
    const favs=(await dbGetAll(STORE_FAVORITES,'timestamp')).sort((a,b)=>b.t-a.t);
    if(!favs.length){
      box.innerHTML=`<div class="no-results fade-in"><i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>В избранном пока ничего нет</h2><p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p><button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div>`;
      return;
    }
    let html=`<section class="favorites-section"><div class="section-header"><h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Всего: <span class="stats-highlight">${favs.length} аниме</span></span></div></div><div class="results-grid">`;
    html+=(await Promise.all(favs.map(f=>createAnimeCard({title:f.title,link:f.link})))).join('');
    html+=`</div><div class="favorites-actions"><button onclick="clearFavorites()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить избранное</button><button onclick="navigateToHome()" class="clear-history-btn secondary"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div></section>`;
    box.innerHTML=html;
  }catch(e){ box.innerHTML=`<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки избранного</h2><p>Попробуйте перезагрузить страницу</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`; }
}
window.clearFavorites=async()=>{
  if(confirm('Очистить всё избранное?')){ try{ await dbClear(STORE_FAVORITES); renderFavoritesPage(); showNote('Избранное очищено','success'); }catch{ showNote('Ошибка при очистке избранного','error'); } }
};

async function renderWeekly(){
  const box=$('resultsBox'); if(!box) return;
  box.innerHTML='<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка новинок...</p></div>';
  const hasHist=await (async()=>{
    try{
      const hist=(await dbGetAll(STORE_SEARCH_HISTORY,'timestamp')).sort((a,b)=>b.t-a.t).slice(0,10);
      if(!hist.length) return false;
      let h=`<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
      hist.forEach(i=>h+=`<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g,"\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event,${i.id})"><i class="fas fa-times"></i></span></button>`);
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
          const hist=(await dbGetAll(STORE_SEARCH_HISTORY,'timestamp')).sort((a,b)=>b.t-a.t).slice(0,10);
          if(hist.length){
            let html=`<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
            hist.forEach(i=>html+=`<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(/'/g,"\\'")}')"><i class="fas fa-search"></i> ${i.query}<span class="remove-history" onclick="removeFromHistory(event,${i.id})"><i class="fas fa-times"></i></span></button>`);
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
    .modal-btn{display:flex;align-items:center;justify-content:center;gap:.5rem;padding:.6rem 1rem;border-radius:6px;border:none;font-weight:600;cursor:pointer;}
    .modal-btn.primary{background:var(--accent);color:#fff;}
    .modal-btn.secondary{background:var(--bg-tertiary);color:var(--text-primary);}
    .modal-title{font-size:1.6rem;margin-bottom:.25rem;}
    .modal-orig{opacity:.7;margin-bottom:.5rem;}
    .modal-meta{margin-bottom:.75rem;font-size:.9rem;}
    .modal-genres{display:flex;flex-wrap:wrap;gap:.35rem;margin-bottom:1rem;}
    .genre-tag{background:var(--bg-tertiary);padding:.25rem .55rem;border-radius:4px;font-size:.75rem;}
    .modal-desc{line-height:1.5;margin-bottom:1rem;}
    .modal-screens{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:.5rem;}
    .modal-screens .scr{width:100%;border-radius:6px;object-fit:cover;background:#000;}
    body.modal-open{overflow:hidden;}
    @keyframes fadeIn{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}
    @media(max-width:700px){.modal-grid{grid-template-columns:1fr}.modal-left{align-items:center}}
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