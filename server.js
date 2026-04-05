// ═══════════════════════════════════════════════════════════
// GIFTMIND SERVER — server.js
// Run: npm install && node server.js
// Requires: .env with ANTHROPIC_API_KEY and GEMINI_API_KEY
// ═══════════════════════════════════════════════════════════

import express from 'express';
import fetch from 'node-fetch';
import multer from 'multer';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// ── MIDDLEWARE ──────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname)); // serve index.html and assets

// Multer: memory storage for image uploads (up to 20 images, 5MB each)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 20 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ── ENV CHECK ──────────────────────────────────────────────
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const GEMINI_KEY    = process.env.GEMINI_API_KEY;

if (!ANTHROPIC_KEY) console.warn('⚠️  ANTHROPIC_API_KEY not set in .env');
if (!GEMINI_KEY)    console.warn('⚠️  GEMINI_API_KEY not set in .env');

// ══════════════════════════════════════════════════════════════
// ROUTE 1: /api/claude  — main chat + analysis calls
// ══════════════════════════════════════════════════════════════
app.post('/api/claude', async (req, res) => {
  const { prompt, system, messages, max_tokens = 1000 } = req.body;

  if (!ANTHROPIC_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured', text: 'API key missing — check server .env' });
  }

  // Build messages array — accept either raw prompt string OR full messages array
  const msgs = messages || [{ role: 'user', content: prompt || '' }];

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens,
        ...(system ? { system } : {}),
        messages: msgs
      })
    });

    const data = await response.json();

    // Log raw for debugging
    if (!response.ok) {
      console.error('Claude API error:', JSON.stringify(data, null, 2));
      return res.status(response.status).json({
        error: data.error?.message || 'Claude API error',
        text: `Error: ${data.error?.message || 'Unknown error'}`,
        raw: data
      });
    }

    // ✅ Correct Anthropic response parsing
    const text = data.content?.[0]?.text || 'No response';

    res.json({ text, raw: data });

  } catch (err) {
    console.error('Claude fetch error:', err.message);
    res.status(500).json({ error: err.message, text: 'Server error — check terminal' });
  }
});

// ══════════════════════════════════════════════════════════════
// ROUTE 2: /api/gemini/analyze-images
// Accepts up to 20 images, returns personality/vibe analysis
// ══════════════════════════════════════════════════════════════
app.post('/api/gemini/analyze-images', upload.array('images', 20), async (req, res) => {
  const { personName = 'this person', context = '' } = req.body;

  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured', text: 'Gemini key missing — check .env' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded', text: 'Upload at least 1 image' });
  }

  console.log(`📸 Analyzing ${req.files.length} images for: ${personName}`);

  // Build Gemini content parts — text + all images
  const parts = [
    {
      text: `Analyze these ${req.files.length} photos of ${personName} and give me a gift intelligence report.
${context ? `Additional context: ${context}` : ''}

From ONLY visual cues in these photos (style, surroundings, objects, aesthetic, fashion choices, what's in the background), tell me:

1. STYLE SIGNATURE — describe their aesthetic in 2 sentences (be specific: colors they wear, textures, whether they're minimalist or maximalist)
2. LIFESTYLE SIGNALS — what do the backgrounds/settings reveal about how they live?
3. INTEREST MARKERS — any objects, books, posters, equipment, or details visible that suggest hobbies?
4. GIFT VIBE TAGS — 5-7 short tags (e.g. "vintage collector", "plant parent", "cozy maximalist")
5. TOP 3 GIFT CATEGORIES — specific to what you see, India-aware (mention ₹ ranges, Indian platforms)
6. ONE THING TO AVOID — based purely on what you see

Be specific and reference actual things you see in the images. Format as JSON:
{
  "styleSignature": "...",
  "lifestyleSignals": "...",
  "interestMarkers": ["...", "..."],
  "giftVibeTags": ["...", "..."],
  "topGiftCategories": ["...", "...", "..."],
  "avoid": "...",
  "confidence": 85
}`
    }
  ];

  // Add each image as inline_data
  for (const file of req.files) {
    const base64 = file.buffer.toString('base64');
    const mimeType = file.mimetype;
    parts.push({
      inline_data: { mime_type: mimeType, data: base64 }
    });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok || data.error) {
      console.error('Gemini error:', JSON.stringify(data, null, 2));
      return res.status(response.status).json({
        error: data.error?.message || 'Gemini API error',
        text: `Gemini error: ${data.error?.message}`
      });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Try to parse JSON from response
    let parsed = null;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.warn('Gemini JSON parse failed, returning raw text');
    }

    res.json({
      text: rawText,
      parsed,
      imageCount: req.files.length,
      personName
    });

  } catch (err) {
    console.error('Gemini fetch error:', err.message);
    res.status(500).json({ error: err.message, text: 'Gemini server error' });
  }
});

// ══════════════════════════════════════════════════════════════
// ROUTE 3: /api/letterboxd/scrape
// Scrapes public Letterboxd profile (no API needed)
// Works server-side — no CORS issues
// ══════════════════════════════════════════════════════════════
app.get('/api/letterboxd/scrape', async (req, res) => {
  const { username } = req.query;

  if (!username) return res.status(400).json({ error: 'username required' });

  const cleanUser = username.replace(/https?:\/\/(www\.)?letterboxd\.com\/?/i, '').replace(/\//g, '').trim();

  console.log(`🎬 Scraping Letterboxd: ${cleanUser}`);

  try {
    // Fetch main profile page
    const profileRes = await fetch(`https://letterboxd.com/${cleanUser}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    });

    if (!profileRes.ok) {
      return res.status(404).json({ error: `Letterboxd user "${cleanUser}" not found`, text: `Could not find letterboxd.com/${cleanUser}` });
    }

    const html = await profileRes.text();

    // Extract data with regex (no DOM parser needed)
    const extract = (pattern, fallback = '') => {
      const m = html.match(pattern);
      return m ? m[1].trim() : fallback;
    };
    const extractAll = (pattern) => {
      const results = [];
      let m;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((m = re.exec(html)) !== null) results.push(m[1].trim());
      return results;
    };

    // Display name
    const displayName = extract(/<h1 class="title-1 person-display-name"[^>]*>([^<]+)</, cleanUser);
    const bio = extract(/<div class="bio[^"]*"[^>]*>\s*<p[^>]*>([^<]{0,300})/, '');
    const filmsCount = extract(/(\d[\d,]+)\s*films?/i, '0');
    const followersCount = extract(/(\d[\d,]+)\s*followers?/i, '0');

    // Recent films from diary/watched (grab film titles)
    const recentFilms = extractAll(/<img alt="([^"]{2,60})" class="[^"]*image[^"]*"/g).slice(0, 15);
    // Favorite films (shown on profile)
    const favoriteFilms = extractAll(/title="([^"]{2,60})" \/>\s*<\/a>\s*<\/li>/g).slice(0, 4);

    // Also try to get films from the films page
    let topFilms = [];
    try {
      const filmsRes = await fetch(`https://letterboxd.com/${cleanUser}/films/by/date/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 ...' }
      });
      const filmsHtml = await filmsRes.text();
      const filmMatches = filmsHtml.match(/data-film-name="([^"]{2,60})"/g) || [];
      topFilms = filmMatches.slice(0, 20).map(m => m.replace(/data-film-name="|"/g, ''));
    } catch (e) { /* ignore */ }

    const profileData = {
      username: cleanUser,
      displayName,
      bio: bio.replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/&quot;/g,'"'),
      filmsCount,
      followersCount,
      recentFilms: [...new Set([...recentFilms, ...favoriteFilms])].filter(Boolean).slice(0, 15),
      topFilms: [...new Set(topFilms)].slice(0, 15),
      profileUrl: `https://letterboxd.com/${cleanUser}/`
    };

    // Now use Claude to analyze the film taste
    if (ANTHROPIC_KEY && (profileData.recentFilms.length > 0 || profileData.topFilms.length > 0)) {
      const allFilms = [...new Set([...profileData.topFilms, ...profileData.recentFilms])].slice(0,20);
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 600,
          messages: [{
            role: 'user',
            content: `Based on this Letterboxd profile, analyze their film taste for gift recommendations.

User: ${displayName} (@${cleanUser})
Films watched/rated: ${allFilms.join(', ')}
Bio: ${bio}

Give me: 
1. Film taste personality (2 sentences — what does choosing these films say about them?)  
2. 3 gift-relevant trait tags
3. 2 specific gift ideas tied to their film taste (India-aware, ₹ prices)

Be specific about the actual films. JSON format:
{"personality":"...","tags":["..."],"giftIdeas":["...","..."]}`
          }]
        })
      });
      const claudeData = await claudeRes.json();
      const analysis = claudeData.content?.[0]?.text || '';
      try {
        const jsonMatch = analysis.match(/\{[\s\S]*\}/);
        profileData.aiAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { personality: analysis };
      } catch { profileData.aiAnalysis = { personality: analysis }; }
    }

    res.json(profileData);

  } catch (err) {
    console.error('Letterboxd scrape error:', err.message);
    res.status(500).json({ error: err.message, text: 'Failed to scrape Letterboxd — check username' });
  }
});

// ══════════════════════════════════════════════════════════════
// ROUTE 4: /api/notes  — CRUD for person notes
// Stores in notes.json (swap for a real DB in production)
// ══════════════════════════════════════════════════════════════
const NOTES_FILE = path.join(__dirname, 'notes.json');

function readNotes() {
  try {
    if (fs.existsSync(NOTES_FILE)) return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  } catch { }
  return {};
}

function writeNotes(data) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2));
}

// GET all people + their notes
app.get('/api/notes', (req, res) => {
  res.json(readNotes());
});

// GET notes for a specific person
app.get('/api/notes/:personId', (req, res) => {
  const notes = readNotes();
  res.json(notes[req.params.personId] || { notes: [], person: {} });
});

// POST — create/update person
app.post('/api/notes/person', (req, res) => {
  const { id, name, relationship, occasion, budget } = req.body;
  if (!id || !name) return res.status(400).json({ error: 'id and name required' });
  const notes = readNotes();
  if (!notes[id]) notes[id] = { person: {}, notes: [] };
  notes[id].person = { id, name, relationship, occasion, budget, updatedAt: new Date().toISOString() };
  writeNotes(notes);
  res.json({ ok: true, person: notes[id].person });
});

// POST — add a note to a person
app.post('/api/notes/:personId/add', (req, res) => {
  const { text, tag = 'observation', source = 'manual' } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const notes = readNotes();
  const personId = req.params.personId;
  if (!notes[personId]) notes[personId] = { person: { id: personId }, notes: [] };
  const note = {
    id: Date.now().toString(),
    text,
    tag,       // 'observation' | 'mention' | 'ai-insight' | 'gift-idea'
    source,    // 'manual' | 'chat' | 'spotify' | 'letterboxd' | 'gemini'
    createdAt: new Date().toISOString()
  };
  notes[personId].notes.unshift(note);
  writeNotes(notes);
  res.json({ ok: true, note });
});

// DELETE a note
app.delete('/api/notes/:personId/:noteId', (req, res) => {
  const notes = readNotes();
  const { personId, noteId } = req.params;
  if (notes[personId]) {
    notes[personId].notes = notes[personId].notes.filter(n => n.id !== noteId);
    writeNotes(notes);
  }
  res.json({ ok: true });
});

// DELETE a person entirely
app.delete('/api/notes/person/:personId', (req, res) => {
  const notes = readNotes();
  delete notes[req.params.personId];
  writeNotes(notes);
  res.json({ ok: true });
});

// POST — AI extracts mentions/insights from a block of text and saves as notes
app.post('/api/notes/:personId/extract', async (req, res) => {
  const { text, source = 'manual' } = req.body;
  if (!text || !ANTHROPIC_KEY) return res.status(400).json({ error: 'text and API key required' });

  const notes = readNotes();
  const personId = req.params.personId;
  const personName = notes[personId]?.person?.name || 'this person';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Extract gift-relevant insights from this text about ${personName}. 

Text: "${text}"

Find: things they mentioned wanting, hobbies referenced, places they visit, brands/items they like, aesthetic preferences, things that annoy them (to avoid).

Return as JSON array of notes (max 6):
[{"text":"...", "tag":"mention|observation|gift-idea|avoid"}, ...]

Only extract things actually stated. Be specific. If nothing relevant, return [].`
        }]
      })
    });
    const data = await response.json();
    const rawText = data.content?.[0]?.text || '[]';
    let extracted = [];
    try {
      const match = rawText.match(/\[[\s\S]*\]/);
      extracted = match ? JSON.parse(match[0]) : [];
    } catch { extracted = []; }

    // Save extracted notes
    if (!notes[personId]) notes[personId] = { person: { id: personId }, notes: [] };
    const saved = extracted.map(e => ({
      id: Date.now().toString() + Math.random(),
      text: e.text,
      tag: e.tag || 'observation',
      source,
      createdAt: new Date().toISOString()
    }));
    notes[personId].notes.unshift(...saved);
    writeNotes(notes);

    res.json({ ok: true, extracted: saved });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── START ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════╗
║   🎁 GIFTMIND SERVER — running on :${PORT}   ║
╠═══════════════════════════════════════════╣
║  POST /api/claude              → Claude AI ║
║  POST /api/gemini/analyze-images → Gemini  ║
║  GET  /api/letterboxd/scrape   → LB data   ║
║  GET/POST /api/notes           → Notes     ║
╚═══════════════════════════════════════════╝
  `);
});
