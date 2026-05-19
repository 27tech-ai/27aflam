// update.js - Script to fetch and update local movie data from TMDB
// Run with Node.js: node scripts/update.js
// Optional: node scripts/update.js trending  (update only trending)
// Optional: node scripts/update.js all       (update everything)

const fs = require('fs');
const path = require('path');

const API_KEY = '581842026857dccc1762ce91bff8f0aa';
const BASE_URL = 'https://api.themoviedb.org/3';
const DATA_DIR = path.join(__dirname, '..', 'data');
const ADULT_KEYWORDS = ['hentai', 'ecchi', 'porn', 'xxx', 'sex', 'nsfw', 'uncensored', 'erotic', '18+'];

const GENRES = {
    trending: { url: `${BASE_URL}/trending/movie/week`, name: 'trending.json', maxPages: 3 },
    action: { url: `${BASE_URL}/discover/movie?with_genres=28&sort_by=popularity.desc`, name: 'action.json', maxPages: 2 },
    comedy: { url: `${BASE_URL}/discover/movie?with_genres=35&sort_by=popularity.desc`, name: 'comedy.json', maxPages: 2 },
    horror: { url: `${BASE_URL}/discover/movie?with_genres=27&sort_by=popularity.desc`, name: 'horror.json', maxPages: 2 },
    drama: { url: `${BASE_URL}/discover/movie?with_genres=18&sort_by=popularity.desc`, name: 'drama.json', maxPages: 2 },
    scifi: { url: `${BASE_URL}/discover/movie?with_genres=878&sort_by=popularity.desc`, name: 'scifi.json', maxPages: 2 },
    'series-trending': { url: `${BASE_URL}/trending/tv/week?with_origin_country=US|GB`, name: 'series-trending.json', maxPages: 2 },
    'series-top': { url: `${BASE_URL}/tv/top_rated`, name: 'series-top.json', maxPages: 2 },
    anime: { url: `${BASE_URL}/discover/tv?with_genres=16&with_origin_country=JP&sort_by=popularity.desc`, name: 'anime.json', maxPages: 2 }
};

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

async function fetchJSON(url) {
    const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}api_key=${API_KEY}&include_adult=false`);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
}

function isBlockedContent(item) {
    if (!item) return true;
    if (item.adult === true) return true;
    const text = `${item.title || ''} ${item.name || ''} ${item.original_title || ''} ${item.original_name || ''} ${item.overview || ''}`.toLowerCase();
    return ADULT_KEYWORDS.some(k => text.includes(k));
}

async function fetchImdbId(movieId) {
    try {
        const data = await fetchJSON(`${BASE_URL}/movie/${movieId}/external_ids`);
        return data.imdb_id;
    } catch {
        return null;
    }
}

async function updateGenre(genreKey, config) {
    console.log(`\nUpdating ${genreKey}...`);
    const allMovies = [];

    for (let p = 1; p <= (config.maxPages || 1); p++) {
        const pageUrl = config.url.includes('page=') ? config.url : `${config.url}&page=${p}`;
        console.log(`  Page ${p}...`);

        try {
            const data = await fetchJSON(pageUrl);
            const movies = (data.results || []).filter(m => !isBlockedContent(m));
            allMovies.push(...movies);

            // Fetch IMDb IDs for movies (not series/anime)
            if (!genreKey.startsWith('series') && genreKey !== 'anime') {
                for (let i = 0; i < movies.length; i++) {
                    const movie = movies[i];
                    movie.imdb_id = await fetchImdbId(movie.id);
                    if (i < movies.length - 1) await new Promise(r => setTimeout(r, 150));
                }
            }

            // Rate limiting between pages
            if (p < (config.maxPages || 1)) await new Promise(r => setTimeout(r, 500));

            if (!data.results || data.results.length === 0) break;
        } catch (err) {
            console.error(`  Error on page ${p}:`, err.message);
            break;
        }
    }

    const filePath = path.join(DATA_DIR, config.name);
    fs.writeFileSync(filePath, JSON.stringify(allMovies, null, 2));
    console.log(`  Saved ${allMovies.length} items to ${config.name}`);
}

async function updateAll(selectedGenre) {
    console.log('Starting data update...' + (selectedGenre ? ` (${selectedGenre} only)` : ' (all genres)'));

    const entries = selectedGenre && selectedGenre !== 'all'
        ? [[selectedGenre, GENRES[selectedGenre]]].filter(([k, v]) => v)
        : Object.entries(GENRES);

    for (const [key, config] of entries) {
        try {
            await updateGenre(key, config);
        } catch (error) {
            console.error(`Error updating ${key}:`, error.message);
        }
    }

    console.log('\nUpdate complete!');
    console.log(`Total files in data/: ${fs.readdirSync(DATA_DIR).length}`);
}

const selectedGenre = process.argv[2] || null;
updateAll(selectedGenre).catch(console.error);
