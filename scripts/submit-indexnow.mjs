import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { resolveSiteUrlOrExit } from './siteUrl.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = resolveSiteUrlOrExit(process.env);
const key = process.env.INDEXNOW_KEY || '7a823996-c355-4004-990d-da5720d02706';
const keyLocation = `${siteUrl}/${key}.txt`;
const isProduction = process.env.VERCEL_ENV === 'production' || process.env.INDEXNOW_FORCE === '1';
const dryRun = process.env.INDEXNOW_DRY_RUN === '1';

// sitemap.xml is a sitemap INDEX (see generate-sitemap.mjs); the actual page
// URLs live in its two member sitemaps.
const SITEMAP_FILES = ['public/sitemap-priority.xml', 'public/sitemap-guides.xml'];

function sitemapUrls() {
  const xml = SITEMAP_FILES.map((file) => readFileSync(join(root, file), 'utf8')).join('\n');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

function changedFiles() {
  try {
    return execFileSync('git', ['diff', '--name-only', 'HEAD^', 'HEAD'], { cwd: root, encoding: 'utf8' })
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function previousSitemapUrls() {
  try {
    const xml = SITEMAP_FILES.map((file) =>
      execFileSync('git', ['show', `HEAD^:${file}`], { cwd: root, encoding: 'utf8' }),
    ).join('\n');
    return new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]));
  } catch {
    return new Set();
  }
}

function urlsForChanges(urls, files) {
  const directUrls = (process.env.INDEXNOW_URLS || '')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean);
  if (directUrls.length) return directUrls;

  const previous = previousSitemapUrls();
  const newlyAdded = urls.filter((url) => !previous.has(url));
  const includes = (pattern) => files.some((file) => pattern.test(file));
  const selected = new Set(newlyAdded);

  if (includes(/^src\/data\/(serviceSeo|services\.|services\.ts)/) || includes(/^src\/pages\/ServiceDetail\.tsx$/)) {
    urls.filter((url) => /\/services\//.test(url)).forEach((url) => selected.add(url));
  }
  if (includes(/^src\/data\/categoryGuides\.ts$/) || includes(/^src\/pages\/CategoryGuide\.tsx$/)) {
    urls.filter((url) => /\/guides\//.test(url)).forEach((url) => selected.add(url));
  }
  if (includes(/^src\/pages\/Services\.tsx$/)) {
    urls.filter((url) => /\/(ar|en|ru|fa)\/services$/.test(url)).forEach((url) => selected.add(url));
  }
  if (includes(/^src\/i18n\//) || includes(/^src\/lib\/seo\.ts$/)) {
    urls.forEach((url) => selected.add(url));
  }

  return [...selected];
}

function validate() {
  if (!/^[A-Za-z0-9-]{8,128}$/.test(key)) throw new Error('INDEXNOW_KEY is not a valid IndexNow key.');
  if (!/^https:\/\/[^/]+$/.test(siteUrl)) throw new Error('VITE_BASE_URL must be an https origin without a path.');
}

async function submit(urls) {
  const payload = { host: new URL(siteUrl).host, key, keyLocation, urlList: urls };
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  console.log(`IndexNow response: ${response.status}${body ? ` ${body.slice(0, 500)}` : ''}`);
  if (![200, 202].includes(response.status)) console.warn('IndexNow did not accept this notification; the site deployment continues.');
}

async function main() {
  validate();
  if (!isProduction) {
    console.log('IndexNow skipped: not a production deployment. Set INDEXNOW_FORCE=1 for a manual test.');
    return;
  }

  const urls = urlsForChanges(sitemapUrls(), changedFiles());
  if (!urls.length) {
    console.log('IndexNow skipped: no new or content-relevant URLs detected.');
    return;
  }
  if (urls.length > 10_000) throw new Error(`IndexNow supports at most 10,000 URLs per request; received ${urls.length}.`);
  console.log(`IndexNow preparing ${urls.length} URL(s) with key file ${keyLocation}.`);
  if (dryRun) {
    console.log(JSON.stringify({ host: new URL(siteUrl).host, keyLocation, urls }, null, 2));
    return;
  }
  await submit(urls);
}

main().catch((error) => {
  console.warn(`IndexNow skipped after configuration/runtime error: ${error.message}`);
  // Never turn a healthy website deployment into a failed deployment because a notification endpoint is unavailable.
});
