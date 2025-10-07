/* ---------- CONFIG ---------- */
const TOKEN = "a036c8a4c59b43e72e212e4d0388ef7d",
  BASE = "https://kodikapi.com/search",
  TTL = 6e5,
  DB_NAME = "AniFoxDB",
  DB_VERSION = 1,
  STORE_SEARCH_HISTORY = "search_history",
  STORE_FAVORITES = "favorites",
  STORE_SEARCH_RESULTS = "search_results";
let db = null;

/* ---------- DB ---------- */
const initDB = () =>
  db
    ? Promise.resolve(db)
    : new Promise((r, j) => {
        const q = indexedDB.open(DB_NAME, DB_VERSION);
        q.onerror = () => j(q.error);
        q.onsuccess = () => r((db = q.result));
        q.onupgradeneeded = (e) => {
          for (const n of [
            STORE_SEARCH_HISTORY,
            STORE_FAVORITES,
            STORE_SEARCH_RESULTS,
          ]) {
            if (!e.target.result.objectStoreNames.contains(n)) {
              const s = e.target.result.createObjectStore(n, {
                keyPath: n === STORE_SEARCH_RESULTS ? "query" : "id",
              });
              s.createIndex("timestamp", "t", { unique: !1 });
              if (n === STORE_FAVORITES)
                s.createIndex("title", "title", { unique: !1 });
            }
          }
        };
      });
const dbAdd = (s, d) =>
  initDB().then(
    (db) =>
      new Promise((r, j) => {
        const t = db.transaction([s], "readwrite");
        t.objectStore(s).add(d);
        t.oncomplete = () => r();
        t.onerror = () => j(t.error);
      })
  );
const dbPut = (s, d) =>
  initDB().then(
    (db) =>
      new Promise((r, j) => {
        const t = db.transaction([s], "readwrite");
        t.objectStore(s).put(d);
        t.oncomplete = () => r();
        t.onerror = () => j(t.error);
      })
  );
const dbGet = (s, k) =>
  initDB().then(
    (db) =>
      new Promise((r, j) => {
        const t = db.transaction([s], "readonly"),
          q = t.objectStore(s).get(k);
        q.onsuccess = () => r(q.result);
        q.onerror = () => j(q.error);
      })
  );
const dbGetAll = (s, i) =>
  initDB().then(
    (db) =>
      new Promise((r, j) => {
        const t = db.transaction([s], "readonly"),
          st = i ? t.objectStore(s).index(i) : t.objectStore(s),
          q = st.getAll();
        q.onsuccess = () => r(q.result);
        q.onerror = () => j(q.error);
      })
  );
const dbDel = (s, k) =>
  initDB().then(
    (db) =>
      new Promise((r, j) => {
        const t = db.transaction([s], "readwrite");
        t.objectStore(s).delete(k);
        t.oncomplete = () => r();
        t.onerror = () => j(t.error);
      })
  );
const dbClear = (s) =>
  initDB().then(
    (db) =>
      new Promise((r, j) => {
        const t = db.transaction([s], "readwrite");
        t.objectStore(s).clear();
        t.oncomplete = () => r();
        t.onerror = () => j(t.error);
      })
  );

/* ---------- FETCH ---------- */
const fetchKodik = async (url, a = 1) => {
  const c = new AbortController(),
    t = setTimeout(() => c.abort(), 1e4);
  try {
    const r = await fetch(url, { signal: c.signal });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (j.error) throw new Error(j.error);
    return j;
  } catch (e) {
    clearTimeout(t);
    if (a >= 3) throw e;
    await new Promise((r) => setTimeout(r, a * 500));
    return fetchKodik(url, a + 1);
  }
};

/* ---------- API ---------- */
const apiSearch = async (q) => {
  q = q.trim().toLowerCase();
  if (!q) return { results: [] };
  const key = `${q}_all`,
    cached = await dbGet(STORE_SEARCH_RESULTS, key).catch(() => {});
  if (cached && Date.now() - cached.t < TTL) return cached.data;
  const url = `${BASE}?token=${TOKEN}&title=${encodeURIComponent(
      q
    )}&types=anime,anime-serial&with_material_data=true`,
    data = await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS, { query: key, data, t: Date.now() }).catch(
    () => {}
  );
  return data;
};
const apiWeekly = async () => {
  const key = "weekly_all",
    cached = await dbGet(STORE_SEARCH_RESULTS, key).catch(() => {});
  if (cached && Date.now() - cached.t < TTL) return cached.data;
  const url = `${BASE.replace(
      "/search",
      "/list"
    )}?token=${TOKEN}&year=2025&updated_at=1&types=anime,anime-serial&with_material_data=true`,
    data = await fetchKodik(url);
  dbPut(STORE_SEARCH_RESULTS, { query: key, data, t: Date.now() }).catch(
    () => {}
  );
  return data;
};

/* ---------- UTILS ---------- */
const $ = (id) => document.getElementById(id);
const showNote = (m, t = "info") => {
  const n = document.createElement("div");
  n.className = `notification notification-${t}`;
  n.innerHTML = `<i class="fas fa-${
    t === "success" ? "check" : t === "error" ? "exclamation-triangle" : "info"
  }"></i><span>${m}</span><button onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 3e3);
};
const toSlug = (str) => {
  const m = {
    а: "a",
    б: "b",
    в: "v",
    г: "g",
    д: "d",
    е: "e",
    ё: "e",
    ж: "zh",
    з: "z",
    и: "i",
    й: "y",
    к: "k",
    л: "l",
    м: "m",
    н: "n",
    о: "o",
    п: "p",
    р: "r",
    с: "s",
    т: "t",
    у: "u",
    ф: "f",
    х: "h",
    ц: "c",
    ч: "ch",
    ш: "sh",
    щ: "sch",
    ъ: "",
    ы: "y",
    ь: "",
    э: "e",
    ю: "yu",
    я: "ya",
    " ": "-",
  };
  return str
    .toLowerCase()
    .split("")
    .map((c) => m[c] || c)
    .join("")
    .replace(/[^a-z0-9\-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};
const buildKeywords = (t, g, y) =>
  [
    ...new Set([
      "аниме",
      "смотреть аниме онлайн",
      "русская озвучка",
      "anime hd",
      ...`${t} ${g} ${y}`
        .toLowerCase()
        .replace(/[«»"']/g, "")
        .split(/[\s,]+/)
        .filter(Boolean),
    ]),
  ]
    .slice(0, 15)
    .join(", ");

/* ---------- SEO ---------- */
const clearOldDynamicMeta = () =>
  document.querySelectorAll("head [data-dynamic]").forEach((e) => e.remove());
const setAttr = (s, a, v) => {
  const el = document.head.querySelector(s);
  if (el) el.setAttribute(a, v);
};
const updateSEOMeta = async (apiData) => {
  clearOldDynamicMeta();
  const r = (apiData && apiData.results) || [],
    q = new URLSearchParams(location.search).get("q") || "",
    baseTitle = document.title || "AniFox",
    baseDesc =
      document.querySelector('meta[name="description"]')?.content || "",
    baseKeys = document.querySelector('meta[name="keywords"]')?.content || "",
    baseOGTitle =
      document.querySelector('meta[property="og:title"]')?.content || baseTitle,
    baseOGDesc =
      document.querySelector('meta[property="og:description"]')?.content ||
      baseDesc,
    baseTwTitle =
      document.querySelector('meta[name="twitter:title"]')?.content ||
      baseTitle,
    baseTwDesc =
      document.querySelector('meta[name="twitter:description"]')?.content ||
      baseDesc,
    baseOGImg =
      document.querySelector('meta[property="og:image"]')?.content ||
      "/resources/obl_web.webp";
  let t = baseTitle,
    d = baseDesc,
    k = baseKeys,
    ogt = baseOGTitle,
    ogd = baseOGDesc,
    twt = baseTwTitle,
    twd = baseTwDesc,
    ogi = baseOGImg;
  if (q) {
    const top = r[0];
    if (top) {
      const { clean: title } = top.title.replace(/\[.*?\]/g, "").trim(),
        { year, genres = "", material_data } = top;
      t = `Смотреть аниме «${title}» (${year}) онлайн бесплатно в HD — AniFox`;
      d = `Аниме «${title}» (${year}) уже на AniFox: русская озвучка, HD 1080p, без регистрации. Жанры: ${genres}. Смотри новые серии первым!`;
      k = buildKeywords(title, genres, year);
      ogt = twt = `«${title}» — смотреть онлайн`;
      ogd = twd = d;
      ogi = material_data?.poster_url || baseOGImg;
    } else {
      t = `Поиск «${q}» — AniFox`;
      d = `По запросу «${q}» ничего не найдено, но вы можете посмотреть другие аниме на AniFox.`;
      k = `аниме, ${q}, смотреть онлайн`;
      ogt = twt = t;
      ogd = twd = d;
    }
  }
  document.title = t;
  setAttr('meta[name="description"]', "content", d);
  setAttr('meta[name="keywords"]', "content", k);
  setAttr('meta[property="og:title"]', "content", ogt);
  setAttr('meta[property="og:description"]', "content", ogd);
  setAttr('meta[property="og:image"]', "content", ogi);
  setAttr('meta[name="twitter:title"]', "content", twt);
  setAttr('meta[name="twitter:description"]', "content", twd);
  setAttr('meta[name="twitter:image"]', "content", ogi);
  let c = location.origin + location.pathname;
  if (q) c += "?q=" + encodeURIComponent(q);
  let l = document.querySelector('link[rel="canonical"]');
  if (!l) {
    l = document.createElement("link");
    l.rel = "canonical";
    l.setAttribute("data-dynamic", "");
    document.head.appendChild(l);
  }
  l.href = c;
  const j = {
    ["@context"]: "https://schema.org",
    ["@type"]: "WebSite",
    name: "AniFox",
    url: location.origin,
    potentialAction: {
      "@type": "SearchAction",
      target: `${location.origin}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
  if (r.length)
    j.mainEntity = r
      .slice(0, 10)
      .map((e) => ({
        "@type": "TVSeries",
        name: e.title,
        datePublished: e.year,
        genre: e.genres,
        image: e.material_data?.poster_url || ogi,
        url: `${location.origin}/?q=${encodeURIComponent(e.title)}`,
      }));
  const s = document.createElement("script");
  s.type = "application/ld+json";
  s.textContent = JSON.stringify(j);
  s.setAttribute("data-dynamic", "");
  document.head.appendChild(s);
};

/* ---------- CARD ---------- */
const createAnimeCard = (i) => `
<div class="card fade-in">
  <div class="card-header">
    <h3 class="h2_name">${i.title}</h3>
    <div class="info-links">
      <a href="https://shikimori.one/animes?search=${encodeURIComponent(
        i.title
      )}" target="_blank" class="info-link" title="Shikimori"><i class="fas fa-external-link-alt"></i></a>
      <a href="https://anilist.co/search/anime?search=${encodeURIComponent(
        i.title
      )}" target="_blank" class="info-link" title="AniList"><i class="fas fa-external-link-alt"></i></a>
      <a href="https://myanimelist.net/search/all?q=${encodeURIComponent(
        i.title
      )}" target="_blank" class="info-link" title="MyAnimeList"><i class="fas fa-external-link-alt"></i></a>
    </div>
  </div>
  <iframe class="single-player" src="${
    i.link
  }" allowfullscreen loading="lazy" title="Плеер: ${i.title}"></iframe>
  <div class="card-actions">
    <button class="action-btn favorite-btn" onclick='toggleFavorite(${JSON.stringify(
      i.title
    )},${JSON.stringify(
  i.link
)})' title="Добавить в избранное"><i class="far fa-heart"></i></button>
    <button class="action-btn" onclick='shareAnime(${JSON.stringify(
      i.title
    )},${JSON.stringify(
  i.link
)})' title="Поделиться"><i class="fas fa-share"></i></button>
  </div>
</div>`;

/* ---------- FAVORITES ---------- */
window.toggleFavorite = async (t, l) => {
  try {
    const f = await dbGetAll(STORE_FAVORITES),
      old = f.find((e) => e.link === l);
    if (old) {
      await dbDel(STORE_FAVORITES, old.id);
      showNote(`«${t}» удалено из избранного`, "info");
      updateFavBtn(l, !1);
    } else {
      await dbAdd(STORE_FAVORITES, {
        id: Date.now(),
        title: t,
        link: l,
        t: Date.now(),
      });
      showNote(`«${t}» добавлено в избранное`, "success");
      updateFavBtn(l, !0);
    }
  } catch (e) {
    showNote("Ошибка при работе с избранным", "error");
  }
};
function updateFavBtn(l, is) {
  document.querySelectorAll(".favorite-btn").forEach((b) => {
    if (b.onclick && b.onclick.toString().includes(l)) {
      b.querySelector("i").className = is ? "fas fa-heart" : "far fa-heart";
      b.title = is ? "Удалить из избранного" : "Добавить в избранное";
    }
  });
}

/* ---------- SHARE ---------- */
window.shareAnime = (t, l) => {
  const u = `${location.origin}/search/${toSlug(t)}`;
  if (navigator.share)
    navigator.share({ title: t, text: `Смотри «${t}» на AniFox`, url: u });
  else {
    navigator.clipboard.writeText(u);
    showNote("Ссылка скопирована в буфер обмена", "success");
  }
};

/* ---------- HISTORY ---------- */
const addHistory = async (q) => {
  if (!q.trim()) return;
  try {
    const h = await dbGetAll(STORE_SEARCH_HISTORY),
      old = h.find((i) => i.query === q);
    if (old) await dbDel(STORE_SEARCH_HISTORY, old.id);
    await dbAdd(STORE_SEARCH_HISTORY, {
      id: Date.now(),
      query: q,
      t: Date.now(),
    });
  } catch {}
};
window.searchFromHistory = (q) => {
  $("searchInput").value = q;
  search();
};
window.removeFromHistory = async (e, id) => {
  e.stopPropagation();
  try {
    await dbDel(STORE_SEARCH_HISTORY, id);
    renderWeekly();
  } catch {}
};
window.clearSearchHistory = async () => {
  if (confirm("Очистить историю?")) {
    try {
      await dbClear(STORE_SEARCH_HISTORY);
      renderWeekly();
    } catch {
      showNote("Ошибка при очистке истории", "error");
    }
  }
};

/* ---------- RENDER ---------- */
async function renderFavoritesPage() {
  const b = $("resultsBox");
  if (!b) return;
  b.innerHTML =
    '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка избранного...</p></div>';
  try {
    const f = (await dbGetAll(STORE_FAVORITES, "timestamp")).sort(
      (a, b) => b.t - a.t
    );
    if (!f.length) {
      b.innerHTML = `<div class="no-results fade-in"><i class="fas fa-heart fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>В избранном пока ничего нет</h2><p>Добавляйте аниме в избранное с помощью <i class="fas fa-heart"></i></p><button onclick="navigateToHome()" class="clear-history-btn" style="margin-top:1rem"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div>`;
      return;
    }
    let h = `<section class="favorites-section"><div class="section-header"><h2 class="section-title"><i class="fas fa-heart"></i> Избранное</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Всего: <span class="stats-highlight">${f.length} аниме</span></span></div></div><div class="results-grid">`;
    h += f
      .map((e) => createAnimeCard({ title: e.title, link: e.link }))
      .join("");
    h += `</div><div class="favorites-actions"><button onclick="clearFavorites()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить избранное</button><button onclick="navigateToHome()" class="clear-history-btn secondary"><i class="fas fa-arrow-left"></i> Вернуться к поиску</button></div></section>`;
    b.innerHTML = h;
  } catch (e) {
    b.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки избранного</h2><p>Попробуйте перезагрузить страницу</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}
window.clearFavorites = async () => {
  if (confirm("Очистить всё избранное?")) {
    try {
      await dbClear(STORE_FAVORITES);
      renderFavoritesPage();
      showNote("Избранное очищено", "success");
    } catch {
      showNote("Ошибка при очистке избранного", "error");
    }
  }
};

async function renderWeekly() {
  const b = $("resultsBox");
  if (!b) return;
  b.innerHTML =
    '<div class="section-preloader"><div class="preloader-spinner small"></div><p>Загрузка новинок...</p></div>';
  const hasHist = await (async () => {
    try {
      const h = (await dbGetAll(STORE_SEARCH_HISTORY, "timestamp"))
        .sort((a, b) => b.t - a.t)
        .slice(0, 10);
      if (!h.length) return !1;
      let html = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
      h.forEach(
        (i) =>
          (html += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(
            /'/g,
            "\\'"
          )}')"><i class="fas fa-search"></i> ${
            i.query
          }<span class="remove-history" onclick="removeFromHistory(event,${
            i.id
          })"><i class="fas fa-times"></i></span></button>`)
      );
      html += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
      b.innerHTML = html;
      return !0;
    } catch {
      return !1;
    }
  })();
  try {
    const data = await apiWeekly();
    updateSEOMeta(data);
    const seen = new Set(),
      list = (data.results || []).filter((i) => {
        const k = i.title.trim().toLowerCase();
        if (seen.has(k)) return !1;
        seen.add(k);
        return !0;
      });
    if (list.length) {
      let html =
        (hasHist ? b.innerHTML : "") +
        `<section class="weekly-section"><h2 class="section-title fade-in"><i class="fas fa-bolt"></i> Свежее за неделю</h2><div class="results-grid">`;
      html += list.map(createAnimeCard).join("");
      html += `</div></section>`;
      b.innerHTML = html;
    } else if (!hasHist) {
      b.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Добро пожаловать в AniFox!</h2><p>Начните с поиска аниме</p><ul><li><i class="fas fa-search"></i> Используйте поиск для нахождения аниме</li><li><i class="fas fa-history"></i> Просматривайте историю поиска</li><li><i class="fas fa-bolt"></i> Смотрите свежие обновления</li><li><i class="fas fa-heart"></i> Добавляйте аниме в избранное</li></ul></div>`;
    }
  } catch (e) {
    if (!hasHist)
      b.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте перезагрузить страницу</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}

async function search() {
  const i = $("searchInput"),
    q = i?.value.trim() || "",
    b = $("resultsBox");
  if (!b) return;
  if (!q) {
    renderWeekly();
    return;
  }
  b.innerHTML =
    '<div class="loading-container"><div class="loading"></div><p class="loading-text">Поиск аниме...</p></div>';
  await addHistory(q);
  try {
    const data = await apiSearch(q),
      seen = new Set(),
      res = (data.results || []).filter((it) => {
        const k = it.title.trim().toLowerCase();
        if (seen.has(k)) return !1;
        seen.add(k);
        return !0;
      });
    if (!res.length) {
      b.innerHTML = `<div class="no-results fade-in"><i class="fas fa-search fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>По запросу «${q}» ничего не найдено</h2><p>Попробуйте изменить запрос:</p><ul><li><i class="fas fa-spell-check"></i> Проверить правильность написания</li><li><i class="fas fa-language"></i> Использовать английское название</li><li><i class="fas fa-filter"></i> Искать по жанру или году</li><li><i class="fas fa-simplify"></i> Упростить запрос</li></ul></div>`;
      setTimeout(async () => {
        try {
          const h = (await dbGetAll(STORE_SEARCH_HISTORY, "timestamp"))
            .sort((a, b) => b.t - a.t)
            .slice(0, 10);
          if (h.length) {
            let html = `<section class="history-section"><h2 class="section-title fade-in"><i class="fas fa-history"></i> История поиска</h2><div class="search-history-buttons">`;
            h.forEach(
              (i) =>
                (html += `<button class="history-query-btn" onclick="searchFromHistory('${i.query.replace(
                  /'/g,
                  "\\'"
                )}')"><i class="fas fa-search"></i> ${
                  i.query
                }<span class="remove-history" onclick="removeFromHistory(event,${
                  i.id
                })"><i class="fas fa-times"></i></span></button>`)
            );
            html += `</div><div class="history-actions"><button onclick="clearSearchHistory()" class="clear-history-btn"><i class="fas fa-trash"></i> Очистить историю</button></div></section>`;
            b.innerHTML += '<div class="content-separator"></div>' + html;
          }
        } catch {}
      }, 100);
      return;
    }
    let html = `<section class="search-results-section"><div class="search-header"><h2 class="section-title fade-in"><i class="fas fa-search"></i> Результаты поиска: «${q}»</h2><div class="stats-info"><span class="stats-text"><i class="fas fa-film"></i> Найдено: <span class="stats-highlight">${res.length} аниме</span> по запросу «${q}»</span></div></div><div class="results-grid">`;
    html += res.map(createAnimeCard).join("");
    html += `</div></section>`;
    b.innerHTML = html;
    updateSEOMeta(data);
    const slug = toSlug(q);
    history.replaceState(
      null,
      null,
      `/search/${slug}?q=${encodeURIComponent(q)}`
    );
    if (i) i.value = "";
  } catch (e) {
    b.innerHTML = `<div class="no-results fade-in"><i class="fas fa-exclamation-triangle fa-3x" style="margin-bottom:1rem;opacity:.5"></i><h2>Ошибка загрузки</h2><p>Попробуйте повторить поиск позже</p><p style="color:var(--gray);font-size:.9rem">${e.message}</p></div>`;
  }
}

/* ---------- HEADER ---------- */
function updateHeader() {
  const h = document.querySelector(".top");
  if (h)
    h.innerHTML = `<a class="logo-link" href="/" onclick="navigateToHome(event)"><i class="fas fa-fox" style="font-size:1.5rem"></i><span class="logo-text">AniFox</span></a><nav class="header-nav"><button class="nav-btn ${
      !location.search.includes("page=favorites") ? "active" : ""
    }" onclick="navigateToHome()"><i class="fas fa-search"></i> Поиск</button><button class="nav-btn ${
      location.search.includes("page=favorites") ? "active" : ""
    }" onclick="navigateToFavorites()"><i class="fas fa-heart"></i> Избранное</button></nav>`;
}
window.navigateToHome = (e) => {
  if (e) e.preventDefault();
  const u =
    location.pathname +
    (location.search.includes("q=")
      ? location.search.replace(/[?&]page=favorites/g, "")
      : "");
  history.replaceState(null, null, u);
  updateHeader();
  renderWeekly();
};
window.navigateToFavorites = () => {
  const u = location.search
    ? `${location.pathname}${location.search}${
        location.search.includes("?") ? "&" : "?"
      }page=favorites`
    : `${location.pathname}?page=favorites`;
  history.replaceState(null, null, u);
  updateHeader();
  renderFavoritesPage();
};

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  document.body.insertAdjacentHTML(
    "afterbegin",
    '<div id="mainPreloader" class="preloader-overlay"><div class="preloader-content"><div class="preloader-spinner"></div><p class="preloader-text">Загрузка AniFox...</p></div></div>'
  );
  try {
    await initDB();
    const fa = document.createElement("link");
    fa.rel = "stylesheet";
    fa.href =
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css";
    document.head.appendChild(fa);
    updateHeader();
    const f = $("searchForm"),
      i = $("searchInput"),
      b = $("scrollToTop");
    if (f)
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        search();
      });
    if (i) {
      const p = new URLSearchParams(location.search),
        q = p.get("q"),
        page = p.get("page");
      if (q) {
        i.value = q;
        search();
      } else if (page === "favorites") {
        renderFavoritesPage();
      } else {
        renderWeekly();
      }
    }
    if (b) {
      window.addEventListener("scroll", () =>
        b.classList.toggle("show", window.scrollY > 300)
      );
      b.addEventListener("click", () =>
        window.scrollTo({ top: 0, behavior: "smooth" })
      );
    }
  } catch (e) {
    showNote("Ошибка загрузки приложения", "error");
  } finally {
    document.getElementById("mainPreloader")?.remove();
  }
});
