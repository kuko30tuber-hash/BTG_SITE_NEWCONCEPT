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

const TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CHANNEL = (process.env.DISCORD_CHANNEL_ID || '').trim();
const GROQ_KEY = process.env.GROQ_API_KEY || '';
const MODELS = [process.env.GROQ_MODEL, 'openai/gpt-oss-120b', 'llama-3.3-70b-versatile'].filter(Boolean);
const FIRST_RUN_LIMIT = Number(process.env.FIRST_RUN_LIMIT || 20);
const NEWS_DIR = process.env.NEWS_DIR || path.join(process.cwd(), 'news');
const IMG_DIR = path.join(NEWS_DIR, 'images');
const STATE_FILE = path.join(NEWS_DIR, 'discord-state.json');
const MANIFEST = path.join(NEWS_DIR, 'manifest.json');
const DISCORD_API = process.env.DISCORD_API || 'https://discord.com/api/v10';
const GROQ_API = process.env.GROQ_API || 'https://api.groq.com/openai/v1/chat/completions';
const SERIES = ['F1', 'F2', 'XGT'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log('[discord-news]', ...a);

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}
async function writeJson(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

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

async function downloadImage(url, baseName) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    const ext = /png/.test(type) ? 'png' : /webp/.test(type) ? 'webp' : /gif/.test(type) ? 'gif' : 'jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 15 * 1024 * 1024) return null; // skip huge files
    const file = `${baseName}.${ext}`;
    await fs.writeFile(path.join(IMG_DIR, file), buf);
    return file;
  } catch { return null; }
}

/* ── Groq ────────────────────────────────────────────────────────────────── */
const SYSTEM = `You are the news editor of BeTheGrid, a sim-racing league website with F1, F2 and XGT championships.
Turn one Discord announcement into a short news article. Rules:
- Use ONLY facts stated in the post. Never invent results, quotes, numbers, dates or names.
- If the post is very short, write a short article (1-2 paragraphs). Do not pad it.
- Write in English, clear sports-news style. No emojis, no hashtags, no markdown.
- Do not mention Discord or "the post".
Return JSON only:
{"title": "headline, max 90 characters",
 "kicker": "1-3 word label, e.g. Race Report, Transfer, Announcement, Results, Calendar",
 "series": "F1" | "F2" | "XGT" | "General",
 "tags": ["up to 3 short tags, e.g. team or driver names"],
 "paragraphs": ["paragraph 1", "paragraph 2", "..."],
 "caption": "short image caption, or empty string"}`;

class RateLimited extends Error {}

async function groqArticle(text, hasImages) {
  let lastErr;
  for (const model of [...new Set(MODELS)]) {
    const res = await fetch(GROQ_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + GROQ_KEY },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Post${hasImages ? ' (has an image attached)' : ''}:\n"""\n${text.slice(0, 6000)}\n"""` }
        ]
      })
    });
    if (res.status === 429) throw new RateLimited('Groq rate limit reached');
    if (res.status === 404 || res.status === 400) { lastErr = new Error('Groq model ' + model + ': ' + (await res.text()).slice(0, 200)); continue; }
    if (!res.ok) throw new Error('Groq ' + res.status + ': ' + (await res.text()).slice(0, 200));
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    if (!json.title || !Array.isArray(json.paragraphs) || !json.paragraphs.length) throw new Error('Groq returned an incomplete article');
    return json;
  }
  throw lastErr || new Error('No Groq model worked');
}

/** No-AI fallback: first line = headline, rest = body, series by keyword. */
function plainArticle(text) {
  const lines = text.split('\n').map((l) => l.replace(/[*_~`>#]+/g, '').trim()).filter(Boolean);
  const title = (lines.shift() || 'News from the paddock').slice(0, 110);
  const series = SERIES.find((s) => new RegExp('\\b' + s + '\\b', 'i').test(text)) || 'General';
  const paragraphs = lines.join('\n').split(/\n{2,}|\n/).filter(Boolean);
  return { title, kicker: 'News', series, tags: [], paragraphs: paragraphs.length ? paragraphs : [title], caption: '' };
}

function publishedMeta(iso) {
  const d = new Date(iso);
  return `Published: ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* ── Main ────────────────────────────────────────────────────────────────── */
async function main() {
  if (!TOKEN) throw new Error('DISCORD_BOT_TOKEN secret is missing');
  if (!/^\d{5,25}$/.test(CHANNEL)) throw new Error('DISCORD_CHANNEL_ID variable is missing or not a number');
  if (!GROQ_KEY) log('GROQ_API_KEY missing — posts will be used as-is (no AI).');

  await fs.mkdir(IMG_DIR, { recursive: true });
  const state = await readJson(STATE_FILE, { lastMessageId: null });
  const manifest = await readJson(MANIFEST, { articles: [] });
  if (!Array.isArray(manifest.articles)) manifest.articles = [];

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
    } else if (GROQ_KEY) {
      try {
        art = await groqArticle(text, images.length > 0);
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

    const series = SERIES.includes(String(art.series).toUpperCase()) ? String(art.series).toUpperCase() : null;
    const tags = [...new Set([series, ...(art.tags || [])].filter(Boolean).map((t) => String(t).slice(0, 30)))].slice(0, 4);
    const body = (art.paragraphs || []).map((p) => `<p>${esc(p)}</p>`).join('\n')
      + files.slice(1).map((f) => `\n<p><img src="images/${esc(f)}" alt=""></p>`).join('');

    await writeJson(path.join(NEWS_DIR, slug + '.json'), {
      kicker: String(art.kicker || 'News').slice(0, 30),
      section: series || 'Paddock',
      tags,
      title: String(art.title).slice(0, 140),
      meta: publishedMeta(m.timestamp),
      image: files[0] ? 'images/' + files[0] : '',
      caption: files[0] ? String(art.caption || '').slice(0, 160) : '',
      body: body || '<p></p>',
      source: 'discord',
      discordMessageId: m.id
    });
    if (!manifest.articles.includes(slug)) manifest.articles.unshift(slug);
    state.lastMessageId = m.id;
    made++;
    log('✓', slug, '—', art.title);
  }

  await writeJson(STATE_FILE, state);
  await writeJson(MANIFEST, manifest);
  log(`done: ${made} article(s) written`);
}

main().catch((e) => { console.error('[discord-news] ERROR:', e.message); process.exit(1); });
