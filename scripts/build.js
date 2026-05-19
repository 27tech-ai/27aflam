// build.js - Minify CSS/JS and generate performance report
// Run with Node.js: node scripts/build.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PERFORMANCE_BUDGET = {
    totalHTML: 50,     // KB
    totalCSS: 30,      // KB
    totalJS: 80,       // KB
    totalPage: 160     // KB (HTML + CSS + JS combined for initial load)
};

// Simple minification functions
function minifyCSS(css) {
    return css
        .replace(/\/\*[\s\S]*?\*\//g, '')  // Remove comments
        .replace(/\s+/g, ' ')               // Collapse whitespace
        .replace(/\s*{\s*/g, '{')           // Remove space before/after {
        .replace(/\s*}\s*/g, '}')           // Remove space before/after }
        .replace(/\s*;\s*/g, ';')           // Remove space before/after ;
        .replace(/\s*:\s*/g, ':')           // Remove space before/after :
        .replace(/\s*,\s*/g, ',')           // Remove space before/after ,
        .replace(/;}/g, '}')                // Remove trailing semicolons
        .trim();
}

function minifyJS(js) {
    return js
        .replace(/\/\*[\s\S]*?\*\//g, '')   // Remove block comments
        .replace(/\/\/.*$/gm, '')           // Remove line comments
        .replace(/\n\s*\n/g, '\n')          // Remove empty lines
        .replace(/\s+/g, ' ')               // Collapse whitespace
        .trim();
}

function formatSize(bytes) {
    return (bytes / 1024).toFixed(1) + ' KB';
}

function build() {
    console.log('Starting build...\n');

    // Read source files
    const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    const indexHTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    // Minify
    const minCSS = minifyCSS(css);
    const minJS = minifyJS(js);
    const minSW = minifyJS(sw);

    // Write minified files
    fs.writeFileSync(path.join(ROOT, 'style.min.css'), minCSS);
    fs.writeFileSync(path.join(ROOT, 'app.min.js'), minJS);
    fs.writeFileSync(path.join(ROOT, 'sw.min.js'), minSW);

    console.log('Minified files:');
    console.log(`  style.css:   ${formatSize(Buffer.byteLength(css))} -> ${formatSize(Buffer.byteLength(minCSS))} (${((Buffer.byteLength(minCSS) / Buffer.byteLength(css)) * 100).toFixed(0)}%)`);
    console.log(`  app.js:      ${formatSize(Buffer.byteLength(js))} -> ${formatSize(Buffer.byteLength(minJS))} (${((Buffer.byteLength(minJS) / Buffer.byteLength(js)) * 100).toFixed(0)}%)`);
    console.log(`  sw.js:       ${formatSize(Buffer.byteLength(sw))} -> ${formatSize(Buffer.byteLength(minSW))} (${((Buffer.byteLength(minSW) / Buffer.byteLength(sw)) * 100).toFixed(0)}%)`);

    // Performance budget check
    const htmlSize = Buffer.byteLength(indexHTML);
    const cssSize = Buffer.byteLength(minCSS);
    const jsSize = Buffer.byteLength(minJS);
    const swSize = Buffer.byteLength(minSW);
    const totalPage = htmlSize + cssSize + jsSize;

    console.log('\n--- Performance Budget ---');
    console.log(`  HTML:        ${formatSize(htmlSize)} / ${PERFORMANCE_BUDGET.totalHTML} KB  ${htmlSize / 1024 > PERFORMANCE_BUDGET.totalHTML ? 'OVER BUDGET' : 'OK'}`);
    console.log(`  CSS:         ${formatSize(cssSize)} / ${PERFORMANCE_BUDGET.totalCSS} KB  ${cssSize / 1024 > PERFORMANCE_BUDGET.totalCSS ? 'OVER BUDGET' : 'OK'}`);
    console.log(`  JS (app):    ${formatSize(jsSize)} / ${PERFORMANCE_BUDGET.totalJS} KB  ${jsSize / 1024 > PERFORMANCE_BUDGET.totalJS ? 'OVER BUDGET' : 'OK'}`);
    console.log(`  JS (sw):     ${formatSize(swSize)}`);
    console.log(`  Total page:  ${formatSize(totalPage)} / ${PERFORMANCE_BUDGET.totalPage} KB  ${totalPage / 1024 > PERFORMANCE_BUDGET.totalPage ? 'OVER BUDGET' : 'OK'}`);

    // Check if over budget
    const overBudget = [
        htmlSize / 1024 > PERFORMANCE_BUDGET.totalHTML,
        cssSize / 1024 > PERFORMANCE_BUDGET.totalCSS,
        jsSize / 1024 > PERFORMANCE_BUDGET.totalJS,
        totalPage / 1024 > PERFORMANCE_BUDGET.totalPage
    ].some(Boolean);

    if (overBudget) {
        console.log('\n⚠️  WARNING: Some files exceed the performance budget!');
    } else {
        console.log('\nAll files within performance budget.');
    }

    console.log('\nBuild complete!');
}

build();
