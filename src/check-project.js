#!/usr/bin/env node
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

const CF_API_TOKEN = env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = env.CLOUDFLARE_ACCOUNT_ID;
const PROJECT_NAME = env.CF_PROJECT_NAME || 'tghub';

async function main() {
  const API_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}`;

  // Get project details
  const projectRes = await fetch(`${API_BASE}/pages/projects/${PROJECT_NAME}`, {
    headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
  });
  const projectData = await projectRes.json();
  console.log('=== Project Details ===');
  console.log(JSON.stringify(projectData.result?.subdomain ? { subdomain: projectData.result.subdomain, domains: projectData.result.domains } : projectData, null, 2));

  // Get existing domains
  const domainsRes = await fetch(`${API_BASE}/pages/projects/${PROJECT_NAME}/domains`, {
    headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
  });
  const domainsData = await domainsRes.json();
  console.log('\n=== Existing Domains ===');
  console.log(JSON.stringify(domainsData, null, 2));

  // Get deployments
  const deployRes = await fetch(`${API_BASE}/pages/projects/${PROJECT_NAME}/deployments?per_page=1`, {
    headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` }
  });
  const deployData = await deployRes.json();
  console.log('\n=== Latest Deployment URL ===');
  if (deployData.result && deployData.result[0]) {
    console.log(deployData.result[0].url);
  }
}

main().catch(console.error);
