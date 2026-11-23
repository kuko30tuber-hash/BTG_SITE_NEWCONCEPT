#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Discord → News
   Reads new posts from one Discord channel and turns each into a news
   article for news.html:
     • Groq writes the headline + article and tags the series (F1/F2/XGT)
     • images attached to the post are downloaded into news/images/
       (Discord image links expire, so they must live in the repo)
     • news/<slug>.json + news/manifest.json are written
   Remembers the last processed message in news/discord-state.json.

   Env:
     DISCORD_BOT_TOKEN   (secret)  bot token, bot must be in the server
     DISCORD_CHANNEL_ID  (variable) channel to read
     GROQ_API_KEY        (secret)  optional; without it posts are used as-is
     GROQ_MODEL          (variable, optional) default openai/gpt-oss-120b
     FIRST_RUN_LIMIT     (optional) posts to import the first time, default 20
     NEWS_DIR            (optional) default ./news
   ═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs/promises';
import path from 'node:path';
import { sleep, readJson, writeJson, downloadImage as dl, writeArticle, plainArticle, RateLimited, hasGroq, saveArticle } from './news-lib.mjs';

const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CHANNEL = (process.env.DISCORD_CHANNEL_ID || '').trim();
const FIRST_RUN_LIMIT = Number(process.env.FIRST_RUN_LIMIT || 20);
const NEWS_DIR = process.env.NEWS_DIR || path.join(process.cwd(), 'news');
const IMG_DIR = path.join(NEWS_DIR, 'images');
const STATE_FILE = path.join(NEWS_DIR, 'discord-state.json');
const DISCORD_API = process.env.DISCORD_API || 'https://discord.com/api/v10';
const log = (...a) => console.log('[discord-news]', ...a);
const downloadImage = (url, base) => dl(url, IMG_DIR, base);

/* ── Discord ─────────────────────────────────────────────────────────────── */
async function discord(pathname) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(DISCORD_API + pathname, { headers: { Authorization: 'Bot ' + TOKEN, 'User-Agent': 'BTG-News (github actions, 1.0)' } });
    if (res.status === 429) {
      const body = await res.json().catch(() => ({}));
      await sleep(Math.ceil((body.retry_after || 2) * 1000) + 250);
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const hint = res.status === 401 ? ' (bot token is wrong — reset it and update the DISCORD_BOT_TOKEN secret)'
        : res.status === 403 ? ' (the bot is not in that server, or cannot see that channel — check View Channels + Read Message History)'
        : res.status === 404 ? ' (channel ID not found — check the DISCORD_CHANNEL_ID variable)' : '';
      throw new Error('Discord ' + res.status + hint + ': ' + text.slice(0, 200));
    }
    return res.json();
  }
  throw new Error('Discord rate limit did not clear');
}

/** New messages after `afterId`, oldest first. First run: the most recent FIRST_RUN_LIMIT. */
async function fetchNewMessages(afterId) {
  if (!afterId) {
    const recent = await discord(`/channels/${CHANNEL}/messages?limit=${Math.min(100, FIRST_RUN_LIMIT)}`);
    return recent.reverse();
  }
  const out = [];
  let cursor = afterId;
  for (let page = 0; page < 10; page++) {
    const batch = await discord(`/channels/${CHANNEL}/messages?limit=100&after=${cursor}`);
    if (!batch.length) break;
    batch.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
    out.push(...batch);
    cursor = batch[batch.length - 1].id;
    if (batch.length < 100) break;
  }
  return out;
}

/** Plain text of a post: message text + any embed titles/descriptions (announcement posts use embeds). */
function postText(m) {
  const parts = [m.content || ''];
  (m.embeds || []).forEach((e) => { if (e.title) parts.push(e.title); if (e.description) parts.push(e.description); });
  // Turn Discord markup into readable text
  return parts.join('\n\n')
    .replace(/<a?:(\w+):\d+>/g, '')           // custom emoji
    .replace(/<@[!&]?\d+>/g, '')              // user/role mentions
    .replace(/<#\d+>/g, '')                   // channel mentions
    .replace(/<t:(\d+)(:\w)?>/g, (_, t) => new Date(Number(t) * 1000).toUTCString().slice(5, 16))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function postImages(m) {
  const urls = [];
  (m.attachments || []).forEach((a) => {
    if ((a.content_type || '').startsWith('image/') || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(a.url)) urls.push(a.url);
  });
  (m.embeds || []).forEach((e) => {
    const u = (e.image && e.image.url) || (e.thumbnail && e.thumbnail.url);
    if (u) urls.push(u);
  });
  return [...new Set(urls)];
}


/* ── Main ────────────────────────────────────────────────────────────────── */
async function main() {
  if (!TOKEN) throw new Error('DISCORD_BOT_TOKEN secret is missing');
  if (!/^\d{5,25}$/.test(CHANNEL)) throw new Error('DISCORD_CHANNEL_ID variable is missing or not a number');
  if (!hasGroq()) log('GROQ_API_KEY missing — posts will be used as-is (no AI).');

  await fs.mkdir(IMG_DIR, { recursive: true });
  const state = await readJson(STATE_FILE, { lastMessageId: null });

  const messages = await fetchNewMessages(state.lastMessageId);
  log(`${messages.length} new message(s)`);
  let made = 0;

  for (const m of messages) {
    // Only real posts (default messages and replies); skip joins, pins, boosts, etc.
    if (![0, 19, 20].includes(m.type)) { state.lastMessageId = m.id; continue; }
    const text = postText(m);
    const images = postImages(m);
    if (!text && !images.length) { state.lastMessageId = m.id; continue; }

    let art;
    if (!text) {
      art = { title: 'From the paddock', kicker: 'Gallery', series: 'General', tags: [], paragraphs: [], caption: '' };
    } else if (hasGroq()) {
      try {
        art = await writeArticle(text, images.length > 0);
      } catch (e) {
        if (e instanceof RateLimited) { log('Groq limit reached — the rest will be done next run.'); break; }
        log('AI failed for message ' + m.id + ', using the post as-is:', e.message);
        art = plainArticle(text);
      }
      await sleep(2500); // stay well inside the free per-minute limits
    } else {
      art = plainArticle(text);
    }

    const slug = 'discord-' + m.id;
    const files = [];
    for (let i = 0; i < images.length && i < 6; i++) {
      const f = await downloadImage(images[i], `${slug}-${i + 1}`);
      if (f) files.push(f);
    }

    await saveArticle(NEWS_DIR, slug, art, files, m.timestamp, { source: 'discord', discordMessageId: m.id });
    state.lastMessageId = m.id;
    made++;
    log('✓', slug, '—', art.title);
  }

  await writeJson(STATE_FILE, state);
  log(`done: ${made} article(s) written`);
}

main().catch((e) => { console.error('[discord-news] ERROR:', e.message); process.exit(1); });
