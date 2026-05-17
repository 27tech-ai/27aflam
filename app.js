const API_KEY = '581842026857dccc1762ce91bff8f0aa';
const BASE = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/w500';
const IMG_ORIG = 'https://image.tmdb.org/t/p/original';

const GENRES = { trending: null, action: 28, comedy: 35, horror: 27, drama: 18, scifi: 878 };

let currentGenre = 'trending', movies = [], featured = [], page = 1, totalPg = 1, loading = false;

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
    showSkeletons();
    loadFeatured();
    loadMainSection('trending');
    setupEvents();
    setupLazyLoad();
});

function setupEvents() {
    document.querySelectorAll('.nav-link').forEach(l => l.addEventListener('click', e => {
        e.preventDefault();
        const g = e.target.dataset.genre;
        if (g) { setActiveNav(g); page = 1; movies = []; loadMainSection(g); }
    }));
    document.querySelectorAll('.footer-links a[data-genre]').forEach(l => l.addEventListener('click', e => {
        e.preventDefault();
        const g = e.target.dataset.genre;
        if (g) { setActiveNav(g); page = 1; movies = []; loadMainSection(g); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }));
    const si = document.getElementById('search'), sb = document.getElementById('search-btn');
    sb.addEventListener('click', () => { const q = si.value.trim(); if (q) { page = 1; movies = []; doSearch(q); } });
    si.addEventListener('keypress', e => { if (e.key === 'Enter') { const q = si.value.trim(); if (q) { page = 1; movies = []; doSearch(q); } } });
    document.getElementById('load-more').addEventListener('click', () => { if (page < totalPg && !loading) { page++; loadMore(); } });
    document.getElementById('hero-btn').addEventListener('click', () => document.querySelector('.movies-section').scrollIntoView({ behavior: 'smooth' }));
}

function setActiveNav(g) { document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.genre === g)); }

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
    return `<div class="movie-card" onclick="watchMovie('${m.id}','${m.imdb_id||''}','${encodeURIComponent(m.title||'')}')"><div class="poster-wrapper">${poster ? `<img data-src="${poster}" class="lazy-poster" alt="">` : ''}<div class="rating-badge ${cls}">${rating}%</div><div class="play-overlay"></div></div><div class="info"><div class="title">${m.title}</div><div class="year">${yr}</div></div></div>`;
}

function setupLazyLoad() {
    const obs = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.src = e.target.dataset.src; e.target.removeAttribute('data-src'); obs.unobserve(e.target); } }), { rootMargin: '200px' });
    document.querySelectorAll('.lazy-poster').forEach(i => obs.observe(i));
    const mo = new MutationObserver(() => document.querySelectorAll('.lazy-poster').forEach(i => { if (!i._o) { i._o = true; obs.observe(i); } }));
    mo.observe(document.getElementById('sections-container'), { childList: true, subtree: true });
}

async function loadFeatured() {
    const c = document.getElementById('featured-scroll');
    if (!c) return;
    try {
        const r = await fetch(`${BASE}/trending/movie/week?api_key=${API_KEY}`);
        const d = await r.json();
        featured = (d.results || []).slice(0, 10);
        const rand = featured[Math.floor(Math.random() * featured.length)];
        if (rand?.backdrop_path) document.querySelector('.hero-backdrop').style.backgroundImage = `url(${IMG_ORIG}${rand.backdrop_path})`;
        c.innerHTML = featured.map(m => {
            const bg = m.backdrop_path ? IMG + m.backdrop_path : '';
            return `<div class="featured-card" onclick="watchMovie('${m.id}','','${encodeURIComponent(m.title||'')}')"><img src="${bg}" loading="lazy"><div class="overlay"><h3>${m.title}</h3><span>&#9733; ${m.vote_average?.toFixed(1)||''}</span></div></div>`;
        }).join('');
    } catch(e) { console.error(e); }
}

async function loadMainSection(genre) {
    currentGenre = genre;
    const c = document.getElementById('sections-container');
    const lm = document.getElementById('load-more');
    c.innerHTML = '';
    loading = true;

    try {
        let url, title;
        if (genre === 'top-rated') { url = `${BASE}/movie/top_rated?api_key=${API_KEY}&page=${page}`; title = 'Top Rated'; }
        else if (genre === 'now-playing') { url = `${BASE}/movie/now_playing?api_key=${API_KEY}&page=${page}`; title = 'Now Playing'; }
        else if (genre === 'upcoming') { url = `${BASE}/movie/upcoming?api_key=${API_KEY}&page=${page}`; title = 'Upcoming'; }
        else if (genre === 'trending') { url = `${BASE}/trending/movie/week?api_key=${API_KEY}&page=${page}`; title = 'Trending Now'; }
        else { url = `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${GENRES[genre]}&sort_by=popularity.desc&page=${page}`; title = genre.charAt(0).toUpperCase() + genre.slice(1) + ' Movies'; }

        const r = await fetch(url);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        movies = page === 1 ? (d.results || []) : [...movies, ...(d.results || [])];

        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>${title}</h2><div class="section-line"></div></div><div class="movies-grid">${movies.map(cardHTML).join('')}</div></div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) { c.innerHTML = '<p class="error">Failed to load.</p>'; }
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
        else url = `${BASE}/discover/movie?api_key=${API_KEY}&with_genres=${GENRES[currentGenre]}&sort_by=popularity.desc&page=${page}`;

        const r = await fetch(url);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        movies = [...movies, ...(d.results || [])];
        const grid = document.querySelector('.movies-grid');
        if (grid) grid.innerHTML = movies.map(cardHTML).join('');
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
        const r = await fetch(`${BASE}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&page=${page}`);
        const d = await r.json();
        totalPg = d.total_pages || 1;
        movies = page === 1 ? (d.results || []) : [...movies, ...(d.results || [])];

        c.innerHTML = `<div class="section-block"><div class="section-header"><h2>Search: "${query}"</h2><div class="section-line"></div></div>${movies.length ? `<div class="movies-grid">${movies.map(cardHTML).join('')}</div>` : '<p class="no-results">No results found.</p>'}</div>`;
        lm.style.display = page < totalPg ? 'block' : 'none';
    } catch(e) { c.innerHTML = '<p class="error">Search failed.</p>'; }
}

function watchMovie(id, imdb, title) { window.location.href = `watch.html?id=${id}&imdb=${imdb}&title=${title}`; }
