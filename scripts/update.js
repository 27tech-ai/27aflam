// update.js - Script to fetch and update local movie data from TMDB
// Run with Node.js: node scripts/update.js

const fs = require('fs');
const path = require('path');

const API_KEY = '581842026857dccc1762ce91bff8f0aa';
const BASE_URL = 'https://api.themoviedb.org/3';
const DATA_DIR = path.join(__dirname, '..', 'data');

const GENRES = {
    trending: { url: `${BASE_URL}/trending/movie/week`, name: 'trending.json' },
    action: { url: `${BASE_URL}/discover/movie?with_genres=28&sort_by=popularity.desc`, name: 'action.json' },
    horror: { url: `${BASE_URL}/discover/movie?with_genres=27&sort_by=popularity.desc`, name: 'horror.json' }
};

async function fetchJSON(url) {
    const res = await fetch(`${url}?api_key=${API_KEY}`);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    return res.json();
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
    const data = await fetchJSON(config.url);
    const movies = data.results || [];

    // Fetch IMDb IDs
    for (let i = 0; i < movies.length; i++) {
        const movie = movies[i];
        movie.imdb_id = await fetchImdbId(movie.id);
        console.log(`  ${movie.title} - IMDb: ${movie.imdb_id || 'N/A'}`);

        // Rate limiting
        if (i < movies.length - 1) {
            await new Promise(r => setTimeout(r, 250));
        }
    }

    const filePath = path.join(DATA_DIR, config.name);
    fs.writeFileSync(filePath, JSON.stringify(movies, null, 2));
    console.log(`  Saved ${movies.length} movies to ${config.name}`);
}

async function updateAll() {
    console.log('Starting movie data update...');

    for (const [key, config] of Object.entries(GENRES)) {
        try {
            await updateGenre(key, config);
        } catch (error) {
            console.error(`Error updating ${key}:`, error.message);
        }
    }

    console.log('\nUpdate complete!');
}

updateAll().catch(console.error);
