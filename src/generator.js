#!/usr/bin/env node
/**
 * Telegram Groups & Channels Static Site Generator
 * Reads JSON data and generates SEO-optimized HTML pages and Markdown files.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, '..');
const OUTPUT_DIR = join(ROOT, 'public');
const DOCS_DIR = join(ROOT, 'docs');

const BLOCKED_CATEGORIES = new Set(['adult', '18+', 'xxx', 'porn', 'erotic', 'gambling']);
const BLOCKED_KEYWORDS = ['赌博', '菠菜', '成人', '色情', 'sexy', 'porn', 'xxx', '18+', 'nude'];

function isAdult(item) {
  if (item.category_code && BLOCKED_CATEGORIES.has(item.category_code.toLowerCase())) return true;
  if (item.category && BLOCKED_CATEGORIES.has(item.category.toLowerCase())) return true;
  const text = ((item.title || '') + ' ' + (item.description || '')).toLowerCase();
  return BLOCKED_KEYWORDS.some(kw => text.includes(kw.toLowerCase()));
}

function loadJSON(filename) {
  const raw = readFileSync(join(DATA_DIR, filename), 'utf-8');
  const data = JSON.parse(raw);
  return data.filter(item => !isAdult(item));
}

function groupBy(items, key) {
  const map = {};
  for (const item of items) {
    const k = item[key] || 'Other';
    if (!map[k]) map[k] = [];
    map[k].push(item);
  }
  return map;
}

function formatNumber(n) {
  if (!n && n !== 0) return 'N/A';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function slugify(str) {
  return str.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getMetaDesc(item) {
  const title = escapeHtml(item.title || '');
  const cat = escapeHtml(item.category || '');
  const cnt = formatNumber(item.subscribers_count || item.participants_count || 0);
  return `${title} - Popular ${cat} Telegram channel with ${cnt} subscribers. Free to join and explore on Telegram.`;
}

const SITE_NAME = 'TG Hub';
const SITE_DESC = 'Discover popular Telegram channels and groups. Browse curated collections of tech, news, crypto, career and more communities on Telegram.';
const SITE_URL = 'https://tghub.pages.dev';

function pageHeader({ title, description, canonicalUrl, ogType = 'website' }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:site_name" content="${SITE_NAME}">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <link rel="stylesheet" href="/assets/style.css">
</head>
<body>
  <header class="site-header">
    <div class="container">
      <a href="/" class="logo">TG Hub</a>
      <nav>
        <a href="/channels/">Channels</a>
        <a href="/groups/">Groups</a>
        <a href="/categories/">Categories</a>
      </nav>
    </div>
  </header>
  <main class="container">`;
}

function pageFooter() {
  return `  </main>
  <footer class="site-footer">
    <div class="container">
      <p>TG Hub - Discover Telegram communities. <a href="https://t.me" target="_blank" rel="noopener">Join on Telegram</a> | <a href="/sitemap.xml">Sitemap</a></p>
      <p>Curated directory: <a href="https://letstg.com" target="_blank" rel="noopener">letsTG</a> | <a href="https://tgviral.com" target="_blank" rel="noopener">TG Viral</a></p>
    </div>
  </footer>
</body>
</html>`;
}

function itemCard(item, type) {
  const title = escapeHtml(item.title || 'Unknown');
  const link = escapeHtml(item.link_url || '#');
  const cat = escapeHtml(item.category || '');
  const catSlug = slugify(cat);
  const count = formatNumber(item.subscribers_count || item.participants_count || 0);
  const desc = item.description ? escapeHtml(item.description) : '';
  const avatar = item.avatar_url ? `<img src="${escapeHtml(item.avatar_url)}" alt="${title}" class="avatar" loading="lazy" width="48" height="48">` : '';
  const countLabel = type === 'channel' ? 'subscribers' : 'members';
  const activity = item.last_post_ago || item.messages_7d ? `<span class="badge">${item.last_post_ago || (item.messages_7d + ' msgs/7d')}</span>` : '';

  return `    <div class="card">
      <div class="card-left">${avatar}</div>
      <div class="card-body">
        <h3><a href="${link}" target="_blank" rel="noopener">${title}</a></h3>
        <p class="card-meta">
          <a href="/${type}s/category/${catSlug}/" class="tag">${cat}</a>
          <span class="count">${count} ${countLabel}</span>
          ${activity}
        </p>
        ${desc ? `<p class="card-desc">${desc}</p>` : ''}
      </div>
    </div>`;
}

function renderPagination(current, total, baseUrl) {
  if (total <= 1) return '';
  let html = '<div class="pagination">';
  const maxLinks = 5;
  const half = Math.floor(maxLinks / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, start + maxLinks - 1);
  if (end - start < maxLinks - 1) start = Math.max(1, end - maxLinks + 1);

  if (current > 1) html += `<a href="${baseUrl}/${current - 1}/" class="page-link">Prev</a>`;
  for (let i = start; i <= end; i++) {
    const url = i === 1 ? baseUrl + '/' : `${baseUrl}/${i}/`;
    html += `<a href="${url}" class="page-link ${i === current ? 'active' : ''}">${i}</a>`;
  }
  if (current < total) html += `<a href="${baseUrl}/${current + 1}/" class="page-link">Next</a>`;
  html += '</div>';
  return html;
}

// ── Generate Homepage ───────────────────────────────────────────
function generateHomepage(channels, chats) {
  const topChannels = channels.slice(0, 20);
  const topChats = chats.slice(0, 20);
  const totalChannels = channels.length;
  const totalChats = chats.length;

  const html = `${pageHeader({
    title: `${SITE_NAME} - Popular Telegram Channels & Groups Directory`,
    description: `Browse ${totalChannels.toLocaleString()} Telegram channels and ${totalChats.toLocaleString()} groups. Discover tech, news, crypto, career communities and more.`,
    canonicalUrl: SITE_URL
  })}
    <div class="hero">
      <h1>Telegram Channels & Groups</h1>
      <p>Explore popular Telegram communities. ${totalChannels.toLocaleString()} channels and ${totalChats.toLocaleString()} groups curated for you.</p>
    </div>

    <section>
      <h2>Top Telegram Channels</h2>
      <div class="card-list">
${topChannels.map(c => itemCard(c, 'channel')).join('\n')}
      </div>
      <p class="see-more"><a href="/channels/">View all ${totalChannels.toLocaleString()} channels &rarr;</a></p>
    </section>

    <section>
      <h2>Popular Telegram Groups</h2>
      <div class="card-list">
${topChats.map(c => itemCard(c, 'group')).join('\n')}
      </div>
      <p class="see-more"><a href="/groups/">View all ${totalChats.toLocaleString()} groups &rarr;</a></p>
    </section>

    <section>
      <h2>Browse by Category</h2>
      <div class="category-grid">
        <a href="/channels/category/tech/" class="cat-card">Tech</a>
        <a href="/channels/category/news/" class="cat-card">News</a>
        <a href="/channels/category/crypto/" class="cat-card">Crypto</a>
        <a href="/channels/category/career/" class="cat-card">Career</a>
        <a href="/channels/category/business/" class="cat-card">Business</a>
        <a href="/channels/category/finance/" class="cat-card">Finance</a>
        <a href="/channels/category/education/" class="cat-card">Education</a>
        <a href="/channels/category/science/" class="cat-card">Science</a>
        <a href="/channels/category/sports/" class="cat-card">Sports</a>
        <a href="/channels/category/entertainment/" class="cat-card">Entertainment</a>
        <a href="/channels/category/food/" class="cat-card">Food</a>
        <a href="/channels/category/travel/" class="cat-card">Travel</a>
      </div>
    </section>
${pageFooter()}`;

  writeFileSync(join(OUTPUT_DIR, 'index.html'), html, 'utf-8');
  console.log('Generated: index.html');
}

// ── Generate listing pages ──────────────────────────────────────
const ITEMS_PER_PAGE = 50;

function paginate(items, page) {
  const start = (page - 1) * ITEMS_PER_PAGE;
  return items.slice(start, start + ITEMS_PER_PAGE);
}

function generateListingPage(type, items, page, totalPages) {
  const label = type === 'channel' ? 'Channels' : 'Groups';
  const baseUrl = `/${type}s`;
  const pluralUrl = type === 'channel' ? '/channels' : '/groups';
  const paged = paginate(items, page);
  const pageTitle = page === 1
    ? `Popular ${label} - ${SITE_NAME}`
    : `Popular ${label} (Page ${page}) - ${SITE_NAME}`;
  const pageDesc = page === 1
    ? `Discover popular ${type === 'channel' ? 'Telegram channels' : 'Telegram groups'}. Browse ${items.length} communities by subscriber count.`
    : `Browse ${type === 'channel' ? 'Telegram channels' : 'Telegram groups'} - Page ${page} of ${totalPages}.`;

  const html = `${pageHeader({
    title: pageTitle,
    description: pageDesc,
    canonicalUrl: `${SITE_URL}${pluralUrl}/${page > 1 ? page + '/' : ''}`
  })}
    <h1>Popular ${label}</h1>
    <p class="section-meta">Showing ${paged.length} of ${items.length} ${type === 'channel' ? 'channels' : 'groups'}</p>
    <div class="card-list">
${paged.map(c => itemCard(c, type)).join('\n')}
    </div>
${renderPagination(page, totalPages, pluralUrl)}
${pageFooter()}`;

  const dir = join(OUTPUT_DIR, `${type}s`);
  mkdirSync(dir, { recursive: true });
  const filename = page === 1 ? 'index.html' : `${page}/index.html`;
  const pageDir = page === 1 ? dir : join(dir, String(page));
  mkdirSync(pageDir, { recursive: true });
  writeFileSync(join(pageDir, 'index.html'), html, 'utf-8');
}

// ── Generate category pages ───────────────────────────────────────
function generateCategoryPages(items, type) {
  const grouped = groupBy(items, 'category');
  const label = type === 'channel' ? 'Channels' : 'Groups';
  const pluralUrl = type === 'channel' ? '/channels' : '/groups';

  for (const [cat, catItems] of Object.entries(grouped)) {
    const catSlug = slugify(cat);
    const catDir = join(OUTPUT_DIR, `${type}s`, 'category', catSlug);
    mkdirSync(catDir, { recursive: true });

    const totalPages = Math.ceil(catItems.length / ITEMS_PER_PAGE);
    for (let page = 1; page <= totalPages; page++) {
      const paged = paginate(catItems, page);
      const pageTitle = page === 1
        ? `${cat} ${label} - ${SITE_NAME}`
        : `${cat} ${label} (Page ${page}) - ${SITE_NAME}`;
      const pageDesc = page === 1
        ? `Browse ${paged.length} ${cat} Telegram ${type === 'channel' ? 'channels' : 'groups'}. Free communities to join.`
        : `Browse ${cat} ${type === 'channel' ? 'channels' : 'groups'} - Page ${page}`;

      const html = `${pageHeader({
        title: pageTitle,
        description: pageDesc,
        canonicalUrl: `${SITE_URL}${pluralUrl}/category/${catSlug}/${page > 1 ? page + '/' : ''}`
      })}
    <nav class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="${pluralUrl}/">${label}</a> &rsaquo; ${escapeHtml(cat)}</nav>
    <h1>${escapeHtml(cat)} ${label}</h1>
    <p class="section-meta">${catItems.length} ${type === 'channel' ? 'channels' : 'groups'} in this category</p>
    <div class="card-list">
${paged.map(c => itemCard(c, type)).join('\n')}
    </div>
${renderPagination(page, totalPages, `${pluralUrl}/category/${catSlug}`)}
${pageFooter()}`;

        const pageDir = page === 1 ? catDir : join(catDir, String(page));
        mkdirSync(pageDir, { recursive: true });
        writeFileSync(join(pageDir, 'index.html'), html, 'utf-8');
    }
    console.log(`  Category: ${cat} (${catItems.length} items, ${totalPages} pages)`);
  }
}

// ── Generate Markdown files ──────────────────────────────────────
function generateMarkdownFiles(items, type) {
  const grouped = groupBy(items, 'category');
  const label = type === 'channel' ? 'Telegram Channels' : 'Telegram Groups';

  // Overview MD
  let md = `# ${label}\n\n`;
  md += `Browse popular ${type === 'channel' ? 'Telegram channels' : 'Telegram groups'} curated in this directory.\n\n`;
  md += `## Categories\n\n`;
  const sortedCats = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);
  for (const [cat, catItems] of sortedCats) {
    const catSlug = slugify(cat);
    md += `- [${cat} (${catItems.length})](./${catSlug}/index.md)\n`;
  }
  md += `\n## Top ${label}\n\n`;
  for (const item of items.slice(0, 100)) {
    const title = item.title || 'Unknown';
    const link = item.link_url || '#';
    const cat = item.category || '';
    const count = formatNumber(item.subscribers_count || item.participants_count || 0);
    md += `- [${title}](${link}) - ${cat} (${count})\n`;
  }
  md += `\n> Curated by [TG Hub](${SITE_URL}) | [letsTG](https://letstg.com) | [TG Viral](https://tgviral.com)\n`;

  const mdDir = join(DOCS_DIR, type === 'channel' ? 'channels' : 'groups');
  mkdirSync(mdDir, { recursive: true });
  writeFileSync(join(mdDir, 'index.md'), md, 'utf-8');
  console.log(`Generated: docs/${type === 'channel' ? 'channels' : 'groups'}/index.md`);

  // Per-category MD files
  for (const [cat, catItems] of Object.entries(grouped)) {
    const catSlug = slugify(cat);
    const catDir = join(mdDir, catSlug);
    mkdirSync(catDir, { recursive: true });

    let catMd = `# ${cat} ${label}\n\n`;
    catMd += `Explore ${catItems.length} ${cat.toLowerCase()} ${type === 'channel' ? 'Telegram channels' : 'Telegram groups'}.\n\n`;
    for (const item of catItems) {
      const title = item.title || 'Unknown';
      const link = item.link_url || '#';
      const count = formatNumber(item.subscribers_count || item.participants_count || 0);
      const desc = item.description ? ` - ${item.description}` : '';
      catMd += `- [${title}](${link}) (${count}${desc})\n`;
    }
    catMd += `\n> Curated by [TG Hub](${SITE_URL}) | [letsTG](https://letstg.com) | [TG Viral](https://tgviral.com)\n`;

    writeFileSync(join(catDir, 'index.md'), catMd, 'utf-8');
  }
  console.log(`Generated: docs/${type === 'channel' ? 'channels' : 'groups'}/*/index.md`);
}

// ── Generate sitemap ─────────────────────────────────────────────
function generateSitemap(channels, chats) {
  const urls = [SITE_URL + '/'];

  // listing pages
  for (const type of ['channels', 'groups']) {
    const items = type === 'channels' ? channels : chats;
    urls.push(`${SITE_URL}/${type}/`);
    const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
    for (let p = 2; p <= totalPages; p++) urls.push(`${SITE_URL}/${type}/${p}/`);

    const grouped = groupBy(items, 'category');
    for (const [cat, catItems] of Object.entries(grouped)) {
      const catSlug = slugify(cat);
      urls.push(`${SITE_URL}/${type}/category/${catSlug}/`);
      const catPages = Math.ceil(catItems.length / ITEMS_PER_PAGE);
      for (let p = 2; p <= catPages; p++) urls.push(`${SITE_URL}/${type}/category/${catSlug}/${p}/`);
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`;

  writeFileSync(join(OUTPUT_DIR, 'sitemap.xml'), xml, 'utf-8');
  console.log(`Generated: sitemap.xml (${urls.length} URLs)`);
}

// ── Generate robots.txt ──────────────────────────────────────────
function generateRobots() {
  const content = `User-agent: *
Allow: /
Disallow:

Sitemap: ${SITE_URL}/sitemap.xml
`;
  writeFileSync(join(OUTPUT_DIR, 'robots.txt'), content, 'utf-8');
  console.log('Generated: robots.txt');
}

// ── CSS is written directly; generator copies it to public/assets/style.css ──

// ── Main ─────────────────────────────────────────────────────────
function main() {
  console.log('Loading data...');
  const channels = loadJSON('channels_20260421_161604.json');
  const chats = loadJSON('chats_20260421_161604.json');
  console.log(`Channels (after filter): ${channels.length}`);
  console.log(`Chats (after filter): ${chats.length}`);

  mkdirSync(join(OUTPUT_DIR, 'assets'), { recursive: true });

  console.log('\nGenerating pages...');
  generateHomepage(channels, chats);

  // channels listing
  const chTotalPages = Math.ceil(channels.length / ITEMS_PER_PAGE);
  for (let p = 1; p <= chTotalPages; p++) generateListingPage('channel', channels, p, chTotalPages);
  console.log(`Generated: ${chTotalPages} channel listing pages`);

  // chats listing
  const ctTotalPages = Math.ceil(chats.length / ITEMS_PER_PAGE);
  for (let p = 1; p <= ctTotalPages; p++) generateListingPage('group', chats, p, ctTotalPages);
  console.log(`Generated: ${ctTotalPages} group listing pages`);

  // category pages
  console.log('\nGenerating category pages...');
  generateCategoryPages(channels, 'channel');
  generateCategoryPages(chats, 'group');

  // markdown files
  console.log('\nGenerating Markdown files...');
  generateMarkdownFiles(channels, 'channel');
  generateMarkdownFiles(chats, 'group');

  generateSitemap(channels, chats);
  generateRobots();

  console.log('\nBuild complete!');
}

main();
