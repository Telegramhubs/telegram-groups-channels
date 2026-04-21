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
const SITE_URL = 'https://telegram-groups-channels.pages.dev';

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
        <a href="/guide/">Guide</a>
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

// ── Generate Guide page (Chinese SEO content) ────────────────────
function generateGuide() {
  const html = `${pageHeader({
    title: `Telegram 社群发现完全指南 - ${SITE_NAME}`,
    description: 'Telegram 内置搜索不够用？这篇指南涵盖关键词搜索、目录站、搜索机器人等6种经过验证的发现方法，帮你找到任何想要的 Telegram 社群。',
    canonicalUrl: `${SITE_URL}/guide/`
  })}
    <h1>Telegram 社群发现完全指南（2026版）</h1>
    <p class="section-meta">收录超过 2,000 个 Telegram 频道与 1,500 个群组，覆盖 40+ 分类</p>

    <div class="hero">
      <p>Telegram 已拥有超过 <strong>7 亿月活用户</strong>，是全球最重要的即时通讯与社群平台之一。然而，找到真正有价值的频道和群组却并不容易——Telegram 内置搜索只支持精确名称搜索，无法按主题、规模或活跃度筛选。</p>
      <p>本指南整理了发现优质 Telegram 社群的完整方法论，覆盖从入门到进阶的各个场景。</p>
    </div>

    <section>
      <h2>为什么 Telegram 搜索不够用？</h2>
      <ul>
        <li><strong>只能精确匹配名称</strong>——不知道准确名称就搜不到</li>
        <li><strong>没有分类和筛选</strong>——无法按主题、国家、语言筛选</li>
        <li><strong>没有活跃度参考</strong>——搜到的群可能早已荒废</li>
      </ul>
    </section>

    <section>
      <h2>发现 Telegram 社群的 6 种方法</h2>

      <h3>方法一：使用社群目录站（推荐）</h3>
      <p>像 <a href="https://letstg.com" target="_blank" rel="noopener">letsTG</a> 这样的目录站收录了 10 万+ 公开 Telegram 社群，支持：</p>
      <ul>
        <li><strong>关键词搜索</strong>——输入"加密货币""Python""营销"等关键词即可找到相关社群</li>
        <li><strong>分类浏览</strong>——按 Crypto、科技、教育、游戏、新闻等 40+ 分类查看</li>
        <li><strong>语言过滤</strong>——支持中文、英文、印地语、阿拉伯语等 30+ 语言</li>
        <li><strong>按规模排序</strong>——查看成员最多的社群，避免加入空群</li>
      </ul>

      <h3>方法二：Telegram 内搜索机器人</h3>
      <p><a href="https://t.me/letstgbot" target="_blank" rel="noopener">@letstgbot</a> 支持在 Telegram 里直接搜索：发送关键词，如"编程""英语""加密"，机器人立即返回匹配的频道/群组列表，包含名称和成员数，点击链接直接加入。</p>

      <h3>方法三：社交媒体推荐</h3>
      <p>Reddit 和 Twitter/X 上有大量 Telegram 社群推荐帖。推荐搜索：</p>
      <ul>
        <li>Reddit: <code>site:reddit.com telegram group recommendations</code></li>
        <li>子版块：r/Telegram、r/CryptoCurrency、r/Entrepreneur</li>
        <li>Twitter: <code>#TelegramGroups</code> <code>#TelegramChannels</code></li>
      </ul>

      <h3>方法四：参考同类社群</h3>
      <p>加入一个优质社群后，留意群公告、置顶消息或群主推荐的其他社群。Telegram 社群运营者通常会互相推荐相关主题的群组。</p>

      <h3>方法五：直接搜索 Telegram 频道列表</h3>
      <p>在 Google 搜索：<code>site:t.me "Telegram群组" + 分类关键词</code></p>

      <h3>方法六：向所在群友询问</h3>
      <p>最被低估的方法——直接在已有社群里问。一个简单的问题往往能换来 5 个以上优质推荐。</p>
    </section>

    <section>
      <h2>2026 年最热门分类 TOP 榜</h2>
      <p>基于 10 万+ 收录社群数据分析，2026 年最活跃的 Telegram 社群分类为：</p>
      <table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
        <thead><tr style="background:#f5f5f5;"><th>分类</th><th>活跃度</th><th>主要语言</th></tr></thead>
        <tbody>
          <tr><td>加密货币 &amp; 交易</td><td>★★★★★</td><td>中文、英文</td></tr>
          <tr><td>科技与编程</td><td>★★★★☆</td><td>中文、英文</td></tr>
          <tr><td>营销与商业</td><td>★★★★☆</td><td>英文</td></tr>
          <tr><td>新闻与媒体</td><td>★★★★☆</td><td>英文、阿拉伯语</td></tr>
          <tr><td>游戏</td><td>★★★☆☆</td><td>英文</td></tr>
          <tr><td>教育</td><td>★★★☆☆</td><td>英文、印地语</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>按语言寻找中文/其他语言社群</h2>

      <h3>中文 Telegram 社群</h3>
      <p>中文社群在 Telegram 上极为活跃，主要集中在：</p>
      <ul>
        <li><strong>东南亚华人圈</strong>——房产、签证、商业机会</li>
        <li><strong>加密货币中文社区</strong>——币安、OKX、Gate 官方群</li>
        <li><strong>技术交流</strong>——编程、AI、开源项目</li>
        <li><strong>出海创业</strong>——跨境电商、海外推广、海外资源对接</li>
      </ul>
      <p>在 letsTG 上可直接筛选「中文」语言，快速找到中文社群。</p>

      <h3>其他语言推荐</h3>
      <table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
        <thead><tr style="background:#f5f5f5;"><th>语言</th><th>推荐搜索</th></tr></thead>
        <tbody>
          <tr><td>英文</td><td>Telegram groups for programming, crypto, marketing</td></tr>
          <tr><td>印地语</td><td>टेलीग्राम ग्रुप, हिंदी टेलीग्राम</td></tr>
          <tr><td>阿拉伯语</td><td>مجموعات تيليجرام, قنوات تيليجرام</td></tr>
          <tr><td>俄语</td><td>Телеграмм группы, каналы Telegram</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>如何让你的频道被更多人发现？</h2>

      <h3>1. 提交到目录站</h3>
      <p>使用 <a href="https://t.me/letstgbot" target="_blank" rel="noopener">@letstgbot</a> 提交你的频道：转发频道任意一条消息给机器人，它会自动识别并收录你的频道信息。收录后，搜索相关关键词的用户就能找到你。</p>

      <h3>2. 在社交媒体分享</h3>
      <p>在 Reddit、Twitter、LinkedIn 等平台分享频道内容。优质内容自然带来订阅增长。</p>

      <h3>3. 与其他频道互推</h3>
      <p>找规模相近、主题相似的频道做互相推荐。这是一种对双方都有效的增长方式。</p>

      <h3>4. 保持更新频率</h3>
      <p>Telegram 算法会优先推荐活跃频道。每天至少发 1-2 条内容，保持群友活跃度。</p>
    </section>

    <section>
      <h2>实用工具与机器人推荐</h2>
      <table style="width:100%; border-collapse: collapse; margin: 1rem 0;">
        <thead><tr style="background:#f5f5f5;"><th>工具/机器人</th><th>用途</th></tr></thead>
        <tbody>
          <tr><td><a href="https://t.me/letstgbot" target="_blank" rel="noopener">@letstgbot</a></td><td>Telegram 内搜索+提交频道</td></tr>
          <tr><td><a href="https://letstg.com" target="_blank" rel="noopener">letsTG.com</a></td><td>网页端搜索 10 万+ 社群</td></tr>
          <tr><td><a href="https://cn.tgstat.com" target="_blank" rel="noopener">tgstat.com</a></td><td>Telegram 数据统计与分析</td></tr>
          <tr><td><a href="https://tgviral.com" target="_blank" rel="noopener">TG Viral</a></td><td>Telegram 病毒内容聚合平台</td></tr>
        </tbody>
      </table>
    </section>

    <section>
      <h2>结语</h2>
      <p>Telegram 是一座金矿，但大多数人都只在矿坑门口徘徊。通过目录站搜索、Telegram 机器人、社交媒体推荐这三条路径，你可以快速找到真正有价值的社群——无论你是想学编程、聊加密货币、找商业伙伴，还是只是看看新闻和娱乐内容。</p>
      <p><strong>关键不是找更多的群，而是找到真正有价值的群。</strong></p>
      <p><a href="https://letstg.com" target="_blank" rel="noopener" class="see-more">→ 在 letsTG 探索 10 万+ Telegram 社群 &rarr;</a></p>
      <p><a href="https://t.me/letstgbot" target="_blank" rel="noopener" class="see-more">→ 使用 TG 搜索机器人 @letstgbot &rarr;</a></p>
    </section>
${pageFooter()}`;

  const guideDir = join(OUTPUT_DIR, 'guide');
  mkdirSync(guideDir, { recursive: true });
  writeFileSync(join(guideDir, 'index.html'), html, 'utf-8');
  console.log('Generated: guide/index.html');
}

// ── Generate sitemap ─────────────────────────────────────────────
function generateSitemap(channels, chats) {
  const urls = [SITE_URL + '/', `${SITE_URL}/guide/`];

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

  // guide page
  console.log('\nGenerating guide page...');
  generateGuide();

  // markdown files
  console.log('\nGenerating Markdown files...');
  generateMarkdownFiles(channels, 'channel');
  generateMarkdownFiles(chats, 'group');

  generateSitemap(channels, chats);
  generateRobots();

  console.log('\nBuild complete!');
}

main();
