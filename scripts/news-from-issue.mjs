#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   GitHub issue ("Submit news" form) → news article
   Reads the issue from the Actions event, has Groq write the article, saves
   the attached images into news/images/, and writes news/<slug>.json.
   Writes slug/title to $GITHUB_OUTPUT for the workflow's reply comment.
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { downloadImage, groqArticle, plainArticle, hasGroq, saveArticle, SERIES } from './news-lib.mjs';

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

async function main() {
  const event = JSON.parse(await fs.readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const issue = event.issue;
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

  let art;
  if (!text) art = { title: 'From the paddock', kicker: 'Gallery', series: 'General', tags: [], paragraphs: [], caption: '' };
  else if (hasGroq()) {
    try { art = await groqArticle(text, images.length > 0); }
    catch (e) { log('AI failed, publishing the post as written:', e.message); art = plainArticle(text); }
  } else art = plainArticle(text);
  if (SERIES.includes(chosen.toUpperCase()) || chosen === 'General') art.series = chosen;

  await fs.mkdir(IMG_DIR, { recursive: true });
  const slug = 'post-' + issue.number + '-' + String(art.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  const auth = process.env.GITHUB_TOKEN ? { Authorization: 'token ' + process.env.GITHUB_TOKEN } : {};
  const files = [];
  for (let i = 0; i < images.length && i < 8; i++) {
    // Public repos serve attachments without auth; retry with the token for private ones.
    const f = (await downloadImage(images[i], IMG_DIR, `${slug}-${i + 1}`)) || (await downloadImage(images[i], IMG_DIR, `${slug}-${i + 1}`, auth));
    if (f) files.push(f); else log('Could not download image', images[i]);
  }

  await saveArticle(NEWS_DIR, slug, art, files, date, { source: 'issue', issue: issue.number });
  log('✓', slug, '—', art.title, `(${files.length} image(s))`);
  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, `slug=${slug}\ntitle=${String(art.title).replace(/\n/g, ' ')}\nimages=${files.length}\nwanted=${images.length}\n`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error('[news-from-issue] ERROR:', e.message); process.exit(1); });
}
