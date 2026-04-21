#!/usr/bin/env node
/**
 * Add custom domain to Cloudflare Pages project
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

let env = {};
const envPath = join(ROOT, '.env');
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim();
  }
}

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = env.CF_PROJECT_NAME || 'tghub';
const CUSTOM_DOMAIN = 'tghub.pages.dev';

async function main() {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    console.error('ERROR: Missing CLOUDFLARE_API_TOKEN or CLOUDFLARE_ACCOUNT_ID in .env');
    process.exit(1);
  }

  const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}`;

  console.log(`Adding custom domain "${CUSTOM_DOMAIN}" to project "${PROJECT_NAME}"...`);

  const res = await fetch(`${API_BASE}/pages/projects/${PROJECT_NAME}/domains`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ domain: CUSTOM_DOMAIN })
  });

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));

  if (data.success) {
    console.log('\nCustom domain added successfully!');
    console.log(`Domain: ${CUSTOM_DOMAIN}`);
    console.log(`Project: ${PROJECT_NAME}`);
  } else {
    console.error('\nFailed to add custom domain:', data.errors);
    process.exit(1);
  }
}

main().catch(console.error);
