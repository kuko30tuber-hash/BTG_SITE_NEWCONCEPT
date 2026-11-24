#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   GitHub issue ("Submit news" form) → news article
   Reads the issue from the Actions event, has Groq write the article, saves
   the attached images into news/images/, and writes news/<slug>.json.
   Writes slug/title to $GITHUB_OUTPUT for the workflow's reply comment.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { downloadImage, writeArticle, plainArticle, hasGroq, saveArticle, SERIES, readJson, writeJson } from './news-lib.mjs';

const NEWS_DIR = process.env.NEWS_DIR || path.join(process.cwd(), 'news');
const IMG_DIR = path.join(NEWS_DIR, 'images');
const log = (...a) => console.log('[news-from-issue]', ...a);

/** Issue-form bodies look like "### Post\n\n<value>\n\n### Series\n\n<value>…". */
export function parseForm(body) {
  const out = {};
  const parts = String(body || '').replace(/\r\n/g, '\n').split(/^###\s+/m).slice(1);
  parts.forEach((p) => {
    const nl = p.indexOf('\n');
    const label = p.slice(0, nl).trim().toLowerCase();
    const value = p.slice(nl + 1).trim();
    out[label] = value === '_No response_' ? '' : value;
  });
  return out;
}

/** Pull image URLs out of markdown/HTML and return the text without them. */
export function splitImages(text) {
  const urls = [];
  let clean = String(text || '')
    .replace(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g, (_, u) => { urls.push(u); return ''; })
    .replace(/<img[^>]*\ssrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi, (_, u) => { urls.push(u); return ''; })
    // bare GitHub attachment links on their own line
    .replace(/^\s*(https:\/\/github\.com\/user-attachments\/assets\/[\w-]+)\s*$/gm, (_, u) => { urls.push(u); return ''; });
  clean = clean.replace(/\n{3,}/g, '\n\n').trim();
  return { text: clean, images: [...new Set(urls)] };
}

/** Re-running an issue replaces its earlier article (and that article's images). */
async function removeOldVersions(num) {
  const manifestFile = path.join(NEWS_DIR, 'manifest.json');
  const manifest = await readJson(manifestFile, { articles: [] });
  const prefix = 'post-' + num + '-';
  const old = (manifest.articles || []).filter((s) => s.startsWith(prefix) && !s.startsWith(prefix + 'img'));
  if (!old.length) return;
  for (const slug of old) {
    await fs.rm(path.join(NEWS_DIR, slug + '.json'), { force: true });
    for (const f of await fs.readdir(IMG_DIR).catch(() => [])) if (f.startsWith(slug + '-')) await fs.rm(path.join(IMG_DIR, f), { force: true });
  }
  manifest.articles = manifest.articles.filter((s) => !old.includes(s));
  await writeJson(manifestFile, manifest);
  log('replaced earlier version(s):', old.join(', '));
}

async function main() {
  const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8')) : {};
  let issue = event.issue;
  if (!issue && process.env.ISSUE_NUMBER) {
    // Manual re-run: fetch the issue from the API
    const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/repos/${process.env.GITHUB_REPOSITORY}/issues/${process.env.ISSUE_NUMBER}`,
      { headers: { Authorization: 'token ' + process.env.GITHUB_TOKEN, Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error('Could not load issue #' + process.env.ISSUE_NUMBER + ': ' + res.status);
    issue = await res.json();
  }
  if (!issue) throw new Error('No issue in this event');
  const form = parseForm(issue.body);
  // Plain issues (not from the form) still work: the whole body is the post.
  const raw = form.post != null ? form.post : String(issue.body || '');
  const { text, images } = splitImages(raw);
  const chosen = (form.series || 'Auto-detect').trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test((form['date (optional)'] || '').trim())
    ? form['date (optional)'].trim() + 'T12:00:00Z'
    : issue.created_at;

  if (!text && !images.length) throw new Error('The issue has no text or images to publish.');

  await fs.mkdir(IMG_DIR, { recursive: true });
  // Download the images first, so the AI can read them (image-only posts)
  const tmpBase = 'post-' + issue.number + '-img';
  const auth = process.env.GITHUB_TOKEN ? { Authorization: 'token ' + process.env.GITHUB_TOKEN } : {};
  const tmpFiles = [];
  for (let i = 0; i < images.length && i < 8; i++) {
    const f = (await downloadImage(images[i], IMG_DIR, `${tmpBase}-${i + 1}`)) || (await downloadImage(images[i], IMG_DIR, `${tmpBase}-${i + 1}`, auth));
    if (f) tmpFiles.push(f); else log('Could not download image', images[i]);
  }

  let art;
  if (hasGroq()) {
    try { art = await writeArticle(text, images.length > 0, tmpFiles.map((f) => path.join(IMG_DIR, f))); }
    catch (e) { log('AI failed:', e.message); art = null; }
  }
  if (!art) art = text ? plainArticle(text) : { title: 'From the paddock', kicker: 'Gallery', series: 'General', tags: [], paragraphs: [], caption: '' };
  if (SERIES.includes(chosen.toUpperCase()) || chosen === 'General') art.series = chosen;

  const slug = 'post-' + issue.number + '-' + String(art.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  await removeOldVersions(issue.number);
  const files = [];
  for (const f of tmpFiles) {
    const final = f.replace(tmpBase, slug);
    await fs.rename(path.join(IMG_DIR, f), path.join(IMG_DIR, final));
    files.push(final);
  }

  await saveArticle(NEWS_DIR, slug, art, files, date, { source: 'issue', issue: issue.number });
  log('OK', slug, '—', art.title, `(${files.length} image(s))`);
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitle=${String(art.title).replace(/\n/g, ' ')}\nimages=${files.length}\nwanted=${images.length}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('[news-from-issue] ERROR:', e.message); process.exit(1); });
}
