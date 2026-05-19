# 27AFLAM 2.0 Roadmap

This file lists the main upgrades that should be added to `2.0` to make the site faster, cleaner, and more compatible.

## Priority 1

- Add strong cache headers for `style.css`, `app.js`, images, and static assets.
- Add a Service Worker for offline fallback and faster repeat visits.
- Add TMDB/API fallback data from local JSON files when the API is slow or down.
- Add image `srcset` and responsive image sizes for mobile and desktop.
- Add better error states and timeouts for API requests and player loading.

## Priority 2

- Add more SEO landing pages with clear URLs for movies, series, anime, and genres.
- Add `Movie`, `TVSeries`, and `BreadcrumbList` structured data on detail pages.
- Add stronger accessibility labels, keyboard support, and focus states.
- Add lazy loading and prefetching for the next batch of content.
- Add server health checks and automatic fallback hints when one player server fails.

## Priority 3

- Minify CSS and JS for production builds.
- Add a performance budget and keep page weight under control.
- Add testing for mobile sizes, tablet sizes, and wide desktop screens.
- Add logging for TMDB failures and player load failures.
- Add a cleaner content pipeline for updating local JSON data.

## Notes

- Keep the existing adult-content filter.
- Keep the anime cover blur/block logic.
- Keep the popup blocking sandbox on all player iframes.
- Keep the `2.0` folder separate from the original site.

