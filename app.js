import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDfJfJfJfJfJfJfJfJfJfJfJfJfJfJfJfJf",
  authDomain: "movie-app-1f4f4.firebaseapp.com",
  projectId: "movie-app-1f4f4",
  storageBucket: "movie-app-1f4f4.appspot.com",
  messagingSenderId: "1f4f4f4f4f4f",
  appId: "1f4f4f4f4f4f",
  measurementId: "G-YOUR_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const API_KEY = '581842026857dccc1762ce91bff8f0aa';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const IMG_ORIG = 'https://image.tmdb.org/t/p/original';
const ADULT_KEYWORDS = ['hentai', 'ecchi', 'porn', 'xxx', 'sex', 'nsfw', 'uncensored', 'erotic', '18+'];

const GENRES = { trending: null, action: 28, comedy: 35, horror: 27, drama: 18, scifi: 878 };

// Local fallback data cache
const LOCAL_DATA_CACHE = {};

const API_TIMEOUT = 8000;

// Logging utility for TMDB and player failures
function logFailure(context, error) {
    const entry = {
        timestamp: new Date().toISOString(),
        context,
        error: error?.message || String(error)
    };
    console.warn('[27AFLAM LOG]', entry);
    try {
        const logs = JSON.parse(localStorage.getItem('27aflam_logs') || '[]');
        logs.push(entry);
        if (logs.length > 100) logs.splice(0, 50);
        localStorage.setItem('27aflam_logs', JSON.stringify(logs));
    } catch {}
}

// Fetch with timeout and local JSON fallback
async function fetchWithFallback(apiUrl, fallbackKey) {
    // Try fetching from Firestore first if fallbackKey corresponds to a collection
    if (['trending', 'action', 'horror'].includes(fallbackKey)) {
        try {
            const querySnapshot = await getDocs(collection(db, fallbackKey));
            const data = querySnapshot.docs.map(doc => doc.data());
            if (data.length > 0) {
                console.log(`Fetched data for ${fallbackKey} from Firestore.`);
                return data;
            }
        } catch (firestoreError) {
            logFailure(`Firestore fetch failed for ${fallbackKey}`, firestoreError);
            // Continue to API or local JSON fallback if Firestore fails
        }
    }

    // Original API fetch logic
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const response = await fetch(apiUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (response.ok) {
            const data = await response.json();
            if (fallbackKey) LOCAL_DATA_CACHE[fallbackKey] = data;
            return data;
        }
    } catch (apiError) {
        logFailure('API fetch failed', apiError);
    }

    // Original Fallback to local JSON file
    if (fallbackKey) {
        try {
            const response = await fetch(`/data/${fallbackKey}.json`);
            if (response.ok) {
                const data = await response.json();
                LOCAL_DATA_CACHE[fallbackKey] = data;
                return data;
            }
        } catch (jsonError) {
            logFailure('Local JSON fallback failed', jsonError);
        }
    }
    return null; // Return null if all methods fail
}
            if (LOCAL_DATA_CACHE[fallbackKey]) {
                return LOCAL_DATA_CACHE[fallbackKey];
            }
            const response = await fetch(`data/${fallbackKey}.json`);
            if (response.ok) {
                const data = await response.json();
                LOCAL_DATA_CACHE[fallbackKey] = { results: data };
                return { results: data };
            }
        } catch (localError) {
            logFailure('Local JSON fallback failed', localError);
        }
    }

    // Complete failure
    return { results: [], error: 'unavailable' };
}

let currentGenre = 'trending', movies = [], featured = [], page = 1, totalPg = 1, loading = false;

function escapeHTML(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function escapeJS(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function addAdultFilter(url) {
    const u = new URL(url);
    u.searchParams.set('include_adult', 'false');
    return u.toString();
}

function isBlockedContent(item) {
    if (!item) return true;
    if (item.adult === true) return true;
    const text = `${item.title || ''} ${item.name || ''} ${item.original_title || ''} ${item.original_name || ''} ${item.overview || ''}`.toLowerCase();
    return ADULT_KEYWORDS.some(k => text.includes(k));
}

function filterSafeContent(items) {
    return (items || []).filter(i => !isBlockedContent(i));
}

// Theme / header
function initAutoHideHeader() {
    const h = document.querySelector('header');
    if (!h) return;
    let last = 0;
    window.addEventListener('scroll', () => {
        const c = window.scrollY;
        if (c > 80) { h.classList.toggle('header-hidden', c > last); h.classList.toggle('header-auto', c <= last); }
        else { h.classList.remove('header-hidden'); h.classList.add('header-auto'); }
        last = c;
    }, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
    initAutoHideHeader();
    if (!document.getElementById('sections-container')) return;
    const initialQuery = new URLSearchParams(window.location.search).get('q')?.trim();
    showSkeletons();
    loadFeatured();
    setupEvents();
    setupLazyLoad();
    setupPrefetch();
    if (initialQuery) {
        const input = document.getElementById('search');
        if (input) input.value = initialQuery;
        doSearch(initialQuery);
    } else {
        loadMainSection('trending');
    }
});

function setupEvents() {
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', e => {
        e.preventDefault();
        const link = e.target.closest('a[data-genre]');
        const g = link?.dataset.genre;
        if (g) {
            setActiveNav(g);
            page = 1;
            movies = [];
            if (g === 'series-trending') loadSeriesSection('series-trending');
            else if (g === 'series-top') loadSeriesSection('series-top');
            else if (g === 'anime') loadAnimeSection();
            else loadMainSection(g);
            closeFiltersPanel();
            window.scrollTo({ top: document.querySelector('.movies-section').offsetTop - 80, behavior: 'smooth' });
        }
    }));
    document.querySelectorAll('.footer-links a[data-genre]').forEach(l => l.addEventListener('click', e => {
        e.preventDefault();
        const link = e.target.closest('a[data-genre]');
        const g = link?.dataset.genre;
        if (g) {
            setActiveNav(g);
            page = 1;
            movies = [];
            if (g === 'series-trending') loadSeriesSection('series-trending');
            else if (g === 'series-top') loadSeriesSection('series-top');
            else if (g === 'anime') loadAnimeSection();
            else loadMainSection(g);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }));
    const si = document.getElementById('search'), sb = document.getElementById('search-btn');
    sb.addEventListener('click', () => { const q = si.value.trim(); if (q) { page = 1; movies = []; doSearch(q); } });
    si.addEventListener('keypress', e => { if (e.key === 'Enter') { const q = si.value.trim(); if (q) { page = 1; movies = []; doSearch(q); } } });
    document.getElementById('load-more').addEventListener('click', () => { if (page < totalPg && !loading) { page++; loadMore(); } });
    document.getElementById('hero-btn').addEventListener('click', () => document.querySelector('.movies-section').scrollIntoView({ behavior: 'smooth' }));
    setupFilterMenu();
}

function setActiveNav(g) { document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.genre === g)); }

function setupFilterMenu() {
    const toggle = document.getElementById('filters-toggle');
    const panel = document.getElementById('filters-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', () => {
        const isOpen = !panel.hidden;
        panel.hidden = isOpen;
        toggle.setAttribute('aria-expanded', String(!isOpen));
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeFiltersPanel();
    });

    document.addEventListener('click', e => {
        if (!document.getElementById('floating-filters')?.contains(e.target)) {
            closeFiltersPanel();
        }
    });
}

function closeFiltersPanel() {
    const toggle = document.getElementById('filters-toggle');
    const panel = document.getElementById('filters-panel');
    if (!toggle || !panel) return;
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
}

function showSkeletons() {
    const c = document.getElementById('sections-container');
    c.innerHTML = `<div class="section-block"><div class="section-header"><h2>Loading...</h2><div class="section-line"></div></div><div class="movies-grid">${'<div class="skeleton-card"><div class="skeleton skeleton-poster"></div><div class="skeleton-info"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-year"></div></div></div>'.repeat(12)}</div></div>`;
}

function ratingClass(pct) { return pct >= 70 ? 'rating-high' : pct >= 50 ? 'rating-mid' : 'rating-low'; }

function cardHTML(m) {
    const poster = m.poster_path ? IMG + m.poster_path : '';
    const rating = m.vote_average ? (m.vote_average * 10).toFixed(0) : 'NR';
    const yr = m.release_date ? m.release_date.slice(0, 4) : '';
    const cls = m.vote_average ? ratingClass(m.vote_average * 10) : 'rating-mid';
    const title = escapeHTML(m.title || 'Untitled movie');
    const srcset = m.poster_path
        ? `https://image.tmdb.org/t/p/w342${m.poster_path} 342w, https://image.tmdb.org/t/p/w500${m.poster_path} 500w, https://image.tmdb.org/t/p/w780${m.poster_path} 780w`
        : '';
    return `<div class="movie-card" onclick="watchMovie('${m.id}','${escapeJS(m.imdb_id || '')}','${encodeURIComponent(m.title||'')}')"><div class="poster-wrapper">${poster ? `<img data-src="${poster}" ${srcset ? `srcset="${srcset}" sizes="(max-width: 480px) 120px, (max-width: 768px) 155px, 220px"` : ''} class="lazy-poster" alt="${title} poster" loading="lazy">` : ''}<div class="rating-badge ${cls}">${rating}%</div><div class="play-overlay"></div></div><div class="info"><div class="title">${title}</div><div class="year">${yr}</div></div></div>`;
}

function setupLazyLoad() {
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.src = e.target.dataset.src; e.target.removeAttribute('data-src'); obs.unobserve(e.target); } }), { rootMargin: '200px' });
    document.querySelectorAll('.lazy-poster').forEach(i => obs.observe(i));
    const mo = new MutationObserver(() => document.querySelectorAll('.lazy-poster').forEach(i => { if (!i._o) { i._o = true; obs.observe(i); } }));
    mo.observe(document.getElementById('sections-container'), { childList: true, subtree: true });
}

// Prefetch next page when user scrolls near bottom
let prefetchTriggered = false;
function setupPrefetch() {
    window.addEventListener('scroll', () => {
        if (prefetchTriggered || page >= totalPg || loading) return;
        const scrollBottom = window.innerHeight + window.scrollY;
        const docHeight = document.documentElement.scrollHeight;
        if (scrollBottom >= docHeight - 800) {
            prefetchTriggered = true;
            prefetchNextPage();
        }
    }, { passive: true });
}

async function prefetchNextPage() {
    const nextPage = page + 1;
    if (nextPage > totalPg) return;
    let url;
    if (currentGenre === 'trending') url = `${BASE}/trending/movie/week?api_key=${API_KEY}&page=${nextPage}`;
    else if (currentGenre === 'top-rated') url = `${BASE}/movie/top_rated?api_key=${API_KEY}&page=${nextPage}`;
    else if (currentGenre === 'now-playing') url = `${BASE}/movie/now_playing?api_key=${API_KEY}&page=${nextPage}`;
    else if (currentGenre === 'upcoming') url = `${BASE}/movie/upcoming?api_key=${API_KEY}&page=${nextPage}`;
    else if (currentGenre === 'series-trending') url = `${BASE}/trending/tv/week?api_key=${API_KEY}&page=${nextPage}`;
    else if (currentGenre === 'series-top') url = `${BASE}/tv/top_rated?api_key=${API_KEY}&page=${nextPage}`;
    else if (currentGenre === 'anime') url = `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc&page=${nextPage}`;
    else url = `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${GENRES[currentGenre]}&sort_by=popularity.desc&page=${nextPage}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        await fetch(addAdultFilter(url), { signal: controller.signal });
        clearTimeout(timeoutId);
    } catch {}
}

async function loadFeatured() {
    const c = document.getElementById('featured-scroll');
    if (!c) return;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const r = await fetch(addAdultFilter(`${BASE}/trending/movie/week?api_key=${API_KEY}`), { signal: controller.signal });
        clearTimeout(timeoutId);
        const d = await r.json();
        featured = filterSafeContent(d.results).slice(0, 10);
        const rand = featured[Math.floor(Math.random() * featured.length)];
        if (rand?.backdrop_path) document.querySelector('.hero-backdrop').style.backgroundImage = `url(${IMG_ORIG}${rand.backdrop_path})`;
        c.innerHTML = featured.map(m => {
            const bg = m.backdrop_path ? IMG + m.backdrop_path : '';
            const title = escapeHTML(m.title || 'Featured movie');
            return `<div class="featured-card" onclick="watchMovie('${m.id}','','${encodeURIComponent(m.title||'')}')"><img src="${bg}" loading="lazy" alt="${title} backdrop"><div class="overlay"><h3>${title}</h3><span>&#9733; ${m.vote_average?.toFixed(1)||''}</span></div></div>`;
        }).join('');
    } catch(e) {
        logFailure('loadFeatured', e);
    }
}

async function loadMainSection(genre) {
    currentGenre = genre;
    const c = document.getElementById('sections-container');
    const lm = document.getElementById('load-more');
    c.innerHTML = '';
    loading = true;

    try {
        let url, title, fallbackKey;
        if (genre === 'top-rated') { url = `${BASE}/movie/top_rated?api_key=${API_KEY}&page=${page}`; title = 'Top Rated'; }
        else if (genre === 'now-playing') { url = `${BASE}/movie/now_playing?api_key=${API_KEY}&page=${page}`; title = 'Now Playing'; }
        else if (genre === 'upcoming') { url = `${BASE}/movie/upcoming?api_key=${API_KEY}&page=${page}`; title = 'Upcoming'; }
        else if (genre === 'trending') { url = `${BASE}/trending/movie/week?api_key=${API_KEY}&page=${page}`; title = 'Trending Now'; fallbackKey = 'trending'; }
        else if (genre === 'action') { url = `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${GENRES[genre]}&sort_by=popularity.desc&page=${page}`; title = genre.charAt(0).toUpperCase() + genre.slice(1) + ' Movies'; fallbackKey = 'action'; }
        else if (genre === 'horror') { url = `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${GENRES[genre]}&sort_by=popularity.desc&page=${page}`; title = genre.charAt(0).toUpperCase() + genre.slice(1) + ' Movies'; fallbackKey = 'horror'; }
        else { url = `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${GENRES[genre]}&sort_by=popularity.desc&page=${page}`; title = genre.charAt(0).toUpperCase() + genre.slice(1) + ' Movies'; }

        const d = await fetchWithFallback(addAdultFilter(url), fallbackKey);
        if (d.error === 'unavailable') {
            c.innerHTML = `<div class="section-block"><div class="section-header"><h2>${title}</h2><div class="section-line"></div></div><p class="error">Unable to load content. Please check your connection.</p></div>`;
            lm.style.display = 'none';
            loading = false;
            return;
        }
        totalPg = d.total_pages || 1;
        const safeResults = filterSafeContent(d.results);
        movies = page === 1 ? safeResults : [...movies, ...safeResults];

        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>${title}</h2><div class="section-line"></div></div><div class="movies-grid">${movies.map(cardHTML).join('')}</div></div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) {
        logFailure('loadMainSection', e);
        c.innerHTML = '<p class="error">Failed to load content.</p>';
    }
    loading = false;
}

async function loadMore() {
    loading = true;
    try {
        let url;
        if (currentGenre === 'trending') url = `${BASE}/trending/movie/week?api_key=${API_KEY}&page=${page}`;
        else if (currentGenre === 'top-rated') url = `${BASE}/movie/top_rated?api_key=${API_KEY}&page=${page}`;
        else if (currentGenre === 'now-playing') url = `${BASE}/movie/now_playing?api_key=${API_KEY}&page=${page}`;
        else if (currentGenre === 'upcoming') url = `${BASE}/movie/upcoming?api_key=${API_KEY}&page=${page}`;
        else if (currentGenre === 'series-trending') url = `${BASE}/trending/tv/week?api_key=${API_KEY}&page=${page}`;
        else if (currentGenre === 'series-top') url = `${BASE}/tv/top_rated?api_key=${API_KEY}&page=${page}`;
        else if (currentGenre === 'anime') url = `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc&page=${page}`;
        else url = `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${GENRES[currentGenre]}&sort_by=popularity.desc&page=${page}`;

        const r = await fetch(addAdultFilter(url));
        const d = await r.json();
        totalPg = d.total_pages || 1;
        movies = [...movies, ...filterSafeContent(d.results)];
        const grid = document.querySelector('.movies-grid');
        if (grid) {
            const cardFunc = currentGenre.includes('series') ? seriesCardHTML : (currentGenre === 'anime' ? animeCardHTML : cardHTML);
            grid.innerHTML = movies.map(cardFunc).join('');
        }
        document.getElementById('load-more').style.display = page < totalPg ? 'block' : 'none';
    } catch(e) {}
    loading = false;
}

async function doSearch(query) {
    const c = document.getElementById('sections-container');
    const lm = document.getElementById('load-more');
    setActiveNav(null);
    c.innerHTML = '<div class="loading active"><div class="loading-spinner"></div></div>';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const r = await fetch(addAdultFilter(`${BASE}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`), { signal: controller.signal });
        clearTimeout(timeoutId);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        const safeResults = filterSafeContent(d.results);
        movies = page === 1 ? safeResults : [...movies, ...safeResults];

        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>Search: "${query}"</h2><div class="section-line"></div></div>${movies.length ? `<div class="movies-grid">${movies.map(cardHTML).join('')}</div>` : '<p class="no-results">No results found.</p>'}</div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) {
        logFailure('doSearch', e);
        c.innerHTML = '<p class="error">Search failed. Please try again.</p>';
    }
}

function watchMovie(id, imdb, title) { window.location.href = `watch.html?id=${id}&imdb=${imdb}&title=${title}`; }

// ─── SERIES ──────────────────────────────────────────────
function watchSeries(id, title) { window.location.href = `series.watch.html?id=${id}&title=${encodeURIComponent(title)}`; }

function seriesCardHTML(m) {
    const poster = m.poster_path ? IMG + m.poster_path : '';
    const rating = m.vote_average ? (m.vote_average * 10).toFixed(0) : 'NR';
    const yr = (m.first_air_date || '').slice(0, 4);
    const cls = m.vote_average ? ratingClass(m.vote_average * 10) : 'rating-mid';
    const title = escapeHTML(m.name || 'Untitled series');
    const srcset = m.poster_path
        ? `https://image.tmdb.org/t/p/w342${m.poster_path} 342w, https://image.tmdb.org/t/p/w500${m.poster_path} 500w, https://image.tmdb.org/t/p/w780${m.poster_path} 780w`
        : '';
    return `<div class="movie-card" onclick="watchSeries('${m.id}','${escapeJS(m.name||'')}')"><div class="poster-wrapper">${poster ? `<img data-src="${poster}" ${srcset ? `srcset="${srcset}" sizes="(max-width: 480px) 120px, (max-width: 768px) 155px, 220px"` : ''} class="lazy-poster" alt="${title} poster" loading="lazy">` : ''}${shouldHide ? '<div class="poster-block-label">COVER BLOCKED</div>' : ''}<div class="rating-badge ${cls}">${rating}%</div><div class="play-overlay"></div></div><div class="info"><div class="title">${title}</div><div class="year">${yr}</div></div></div>`;
}

async function loadSeriesSection(genre) {
    currentGenre = genre;
    const c = document.getElementById('sections-container');
    const lm = document.getElementById('load-more');
    c.innerHTML = '';
    loading = true;
    try {
        const SERIES_GENRES = { drama: 18, action: 10759, comedy: 35, scifi: 10765, anime: 16 };
        let url, title;
        if (genre === 'series-trending') { url = `${BASE}/trending/tv/week?api_key=${API_KEY}&page=${page}`; title = 'Trending Series'; }
        else if (genre === 'series-top') { url = `${BASE}/tv/top_rated?api_key=${API_KEY}&page=${page}`; title = 'Top Rated Series'; }
        else { url = `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=${SERIES_GENRES[genre]||18}&sort_by=popularity.desc&page=${page}`; title = genre.charAt(0).toUpperCase() + genre.slice(1) + ' Series'; }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const r = await fetch(addAdultFilter(url), { signal: controller.signal });
        clearTimeout(timeoutId);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        const safeResults = filterSafeContent(d.results);
        movies = page === 1 ? safeResults : [...movies, ...safeResults];
        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>${title}</h2><div class="section-line"></div></div><div class="movies-grid">${movies.map(seriesCardHTML).join('')}</div></div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) {
        logFailure('loadSeriesSection', e);
        c.innerHTML = '<p class="error">Failed to load series content. Please try again.</p>';
    }
    loading = false;
}

async function doSearchSeries(query) {
    const c = document.getElementById('sections-container');
    const lm = document.getElementById('load-more');
    setActiveNav(null);
    c.innerHTML = '<div class="loading active"><div class="loading-spinner"></div></div>';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const r = await fetch(addAdultFilter(`${BASE}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`), { signal: controller.signal });
        clearTimeout(timeoutId);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        const safeResults = filterSafeContent(d.results);
        movies = page === 1 ? safeResults : [...movies, ...safeResults];
        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>Series: "${query}"</h2><div class="section-line"></div></div>${movies.length ? `<div class="movies-grid">${movies.map(seriesCardHTML).join('')}</div>` : '<p class="no-results">No results found.</p>'}</div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) {
        logFailure('doSearchSeries', e);
        c.innerHTML = '<p class="error">Series search failed. Please try again.</p>';
    }
}

// ─── ANIME ───────────────────────────────────────────────
function watchAnime(id, title) { window.location.href = `anime.watch.html?id=${id}&title=${encodeURIComponent(title)}`; }

function animeCardHTML(m) {
    const poster = m.poster_path ? IMG + m.poster_path : '';
    const rating = m.vote_average ? (m.vote_average * 10).toFixed(0) : 'NR';
    const yr = (m.first_air_date || '').slice(0, 4);
    const cls = m.vote_average ? ratingClass(m.vote_average * 10) : 'rating-mid';
    const text = `${m.name || ''} ${m.original_name || ''} ${m.overview || ''}`.toLowerCase();
    const girlKeywords = ['girl', 'girls', 'female', 'waifu', 'idol', 'magical girl', 'schoolgirl', 'princess', 'shoujo'];
    const shouldHide = girlKeywords.some(k => text.includes(k));
    const title = escapeHTML(m.name || 'Untitled anime');
    const srcset = m.poster_path
        ? `https://image.tmdb.org/t/p/w342${m.poster_path} 342w, https://image.tmdb.org/t/p/w500${m.poster_path} 500w, https://image.tmdb.org/t/p/w780${m.poster_path} 780w`
        : '';
    return `<div class="movie-card" onclick="watchAnime('${m.id}','${escapeJS(m.name||'')}')"><div class="poster-wrapper ${shouldHide ? 'poster-sensitive' : ''}">${poster ? `<img data-src="${poster}" ${srcset ? `srcset="${srcset}" sizes="(max-width: 480px) 120px, (max-width: 768px) 155px, 220px"` : ''} class="lazy-poster" alt="${title} poster" loading="lazy">` : ''}${shouldHide ? '<div class="poster-block-label">COVER BLOCKED</div>' : ''}<div class="rating-badge ${cls}">${rating}%</div><div class="play-overlay"></div></div><div class="info"><div class="title">${title}</div><div class="year">${yr}</div></div></div>`;
}

async function loadAnimeSection() {
    currentGenre = 'anime';
    const c = document.getElementById('sections-container');
    const lm = document.getElementById('load-more');
    c.innerHTML = '';
    loading = true;
    try {
        const url = `${BASE}/discover/tv?api_key=${API_KEY}&with_genres=16&with_origin_country=JP&sort_by=popularity.desc&page=${page}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const r = await fetch(addAdultFilter(url), { signal: controller.signal });
        clearTimeout(timeoutId);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        const safeResults = filterSafeContent(d.results);
        movies = page === 1 ? safeResults : [...movies, ...safeResults];
        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>Anime</h2><div class="section-line"></div></div><div class="movies-grid">${movies.map(animeCardHTML).join('')}</div></div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) {
        logFailure('loadAnimeSection', e);
        c.innerHTML = '<p class="error">Failed to load anime content. Please try again.</p>';
    }
    loading = false;
}

async function doSearchAnime(query) {
    const c = document.getElementById('sections-container');
    const lm = document.getElementById('load-more');
    setActiveNav(null);
    c.innerHTML = '<div class="loading active"><div class="loading-spinner"></div></div>';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
        const r = await fetch(addAdultFilter(`${BASE}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`), { signal: controller.signal });
        clearTimeout(timeoutId);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        const results = filterSafeContent(page === 1 ? (d.results || []) : [...movies, ...(d.results || [])]).filter(m => m.origin_country?.includes('JP'));
        movies = results;
        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>Anime: "${query}"</h2><div class="section-line"></div></div>${results.length ? `<div class="movies-grid">${results.map(animeCardHTML).join('')}</div>` : '<p class="no-results">No results found.</p>'}</div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) {
        logFailure('doSearchAnime', e);
        c.innerHTML = '<p class="error">Anime search failed. Please try again.</p>';
    }
}
