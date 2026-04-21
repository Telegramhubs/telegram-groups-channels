#!/usr/bin/env node
/**
 * Cloudflare Pages Deploy Script (wrangler v4)
 * Uses wrangler pages deploy CLI for direct uploads.
 */
import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

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

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = process.env.CF_PROJECT_NAME || env.CF_PROJECT_NAME || 'tghub';
const DOCS_DIR = join(ROOT, 'public');

async function main() {
  if (!CF_ACCOUNT_ID) {
    console.error('ERROR: CLOUDFLARE_ACCOUNT_ID not found.');
    console.error('Please check your .env file.');
    process.exit(1);
  }

  console.log(`Deploying to Cloudflare Pages project: ${PROJECT_NAME}`);
  console.log(`Directory: ${DOCS_DIR}`);

  try {
    execSync(
      `npx wrangler pages deploy "${DOCS_DIR}" --project-name=${PROJECT_NAME}`,
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT_ID } }
    );
    console.log('\nDeployment complete!');
    console.log(`Check your site at: https://telegram-groups-channels.pages.dev`);
  } catch (e) {
    console.error('\nDeployment failed.');
    process.exit(1);
  }
}

main();
