#!/usr/bin/env node
/**
 * GitHub Deploy Script
 * 1. Create GitHub repo via API
 * 2. Push all files to the repo
 * 3. Enable GitHub Pages from /docs folder
 * 4. Set repo description and topics
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load env
let env = {};
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
}

const TOKEN = process.env.GITHUB_TOKEN || env.GITHUB_TOKEN;
const OWNER = process.env.GITHUB_OWNER || env.GITHUB_OWNER || '';
const REPO = process.env.GITHUB_REPO || env.GITHUB_REPO || 'telegram-groups-channels';

const API = 'https://api.github.com';
const HDRS = {
  'Authorization': `Bearer ${TOKEN}`,
  'Accept': 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'telegram-groups-deploy'
};

async function gh(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { ...HDRS, ...(options.headers || {}) }
  });
  return res.json();
}

async function createRepo() {
  console.log('Checking if repo exists...');
  const existing = await gh(`/repos/${OWNER}/${REPO}`);

  if (existing.id) {
    console.log(`Repo ${OWNER}/${REPO} already exists.`);
    return existing;
  }

  console.log('Creating new repo...');
  const created = await gh('/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: REPO,
      description: 'Discover popular Telegram channels and groups. Curated directory with thousands of free communities to join.',
      homepage: 'https://telegram-groups-channels.pages.dev',
      private: false,
      has_issues: true,
      has_projects: false,
      has_wiki: false,
      auto_init: false
    })
  });

  if (created.id) {
    console.log(`Repo created: ${created.html_url}`);
  } else {
    console.error('Failed to create repo:', created);
    throw new Error('Repo creation failed');
  }
  return created;
}

async function pushFiles() {
  console.log('Pushing files to GitHub...');

  const { execSync } = await import('child_process');
  const workDir = ROOT;

  try {
    execSync('git config --global init.defaultBranch main', { cwd: workDir, stdio: 'ignore' });
    execSync('git config --global user.email "deploy@tghub.pages.dev"', { cwd: workDir, stdio: 'ignore' });
    execSync('git config --global user.name "TG Hub Deploy"', { cwd: workDir, stdio: 'ignore' });
  } catch (e) {}

  const remoteUrl = `https://x-access-token:${TOKEN}@github.com/${OWNER}/${REPO}.git`;

  if (!existsSync(join(workDir, '.git'))) {
    console.log('Initializing git repository...');
    execSync('git init', { cwd: workDir });
    execSync('git remote add origin ' + remoteUrl, { cwd: workDir });
  } else {
    execSync('git remote set-url origin ' + remoteUrl, { cwd: workDir });
  }

  writeFileSync(join(workDir, '.gitignore'), [
    'node_modules/',
    '.env',
    '*.db',
    '*.log',
    '.DS_Store',
    '__pycache__/'
  ].join('\n'), 'utf-8');

  writeFileSync(join(workDir, 'README.md'), [
    '# Telegram Groups & Channels',
    '',
    'Discover popular Telegram communities. Browse thousands of curated channels and groups.',
    '',
    '## Quick Links',
    '',
    '- [Live Site](https://telegram-groups-channels.pages.dev)',
    '- [Channel Directory](./docs/channels/index.md)',
    '- [Group Directory](./docs/groups/index.md)',
    '- [Sitemap](./public/sitemap.xml)',
    '',
    '## Data Sources',
    '',
    '- [tgstat.com](https://cn.tgstat.com) - Telegram statistics platform',
    '',
    '## Related Projects',
    '',
    '- [letsTG](https://letstg.com)',
    '- [TG Viral](https://tgviral.com)',
    ''
  ].join('\n'), 'utf-8');

  execSync('git add -A', { cwd: workDir });

  const date = new Date().toISOString().split('T')[0];
  try {
    execSync('git commit -m "Update: ' + date + ' - Refreshed channel and group listings"', { cwd: workDir });
  } catch (e) {
    console.log('Nothing to commit (no changes detected).');
    return;
  }

  console.log('Pushing to GitHub...');
  try {
    execSync('git push -u origin main --force', { cwd: workDir });
    console.log('Files pushed successfully!');
  } catch (e) {
    console.error('Push failed. Try running manually:');
    console.error('  git push -u origin main --force');
  }
}

async function enablePages() {
  console.log('Enabling GitHub Pages...');

  const result = await gh(`/repos/${OWNER}/${REPO}/pages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source: {
        branch: 'main',
        path: '/docs'
      }
    })
  });

  if (result.html_url || result.url) {
    console.log('GitHub Pages enabled!');
    console.log('Your site will be available at: https://' + OWNER + '.github.io/' + REPO + '/');
  } else if (result.message && result.message.includes('already')) {
    console.log('GitHub Pages already enabled.');
  } else {
    console.log('Pages API response:', result);
    console.log('You may need to enable Pages manually in repo Settings.');
  }
}

async function setRepoMeta() {
  console.log('Updating repo metadata...');

  await gh(`/repos/${OWNER}/${REPO}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'Discover popular Telegram channels and groups - curated directory',
      homepage: 'https://telegram-groups-channels.pages.dev',
      topics: ['telegram', 'channels', 'groups', 'directory', 'community', 'messenger', 'resources']
    })
  });
}

async function main() {
  if (!TOKEN) {
    console.error('ERROR: GitHub token not found.');
    console.error('Please edit .env and fill in:');
    console.error('  GITHUB_TOKEN=your_personal_access_token');
    console.error('  GITHUB_OWNER=your_github_username');
    console.error('  GITHUB_REPO=telegram-groups-channels');
    console.error('');
    console.error('To create a token:');
    console.error('  GitHub Settings > Developer settings > Personal access tokens > Fine-grained tokens');
    console.error('  Permissions needed: repo (all), delete_repo');
    process.exit(1);
  }

  if (!OWNER) {
    const user = await gh('/user');
    if (user.login) {
      console.log('Detected GitHub username: ' + user.login);
    }
  }

  await createRepo();
  await pushFiles();
  await enablePages();
  await setRepoMeta();

  console.log('');
  console.log('Deployment complete!');
  console.log('Repo: https://github.com/' + OWNER + '/' + REPO);
  console.log('Site: https://' + (OWNER || 'USERNAME') + '.github.io/' + REPO + '/');
  console.log('');
  console.log('Note: GitHub Pages may take 2-5 minutes to build.');
}

main().catch(console.error);
