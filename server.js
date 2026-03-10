const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-change-me';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'owner@logomagic.ai').toLowerCase();
const DB_FILE = path.join(__dirname, 'data.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 120;
const rateMap = new Map();

function nowIso() {
  return new Date().toISOString();
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    return {
      users: [],
      logos: [],
      subscriptions: [],
      counters: { userId: 1, logoId: 1, subId: 1 }
    };
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const db = loadDb();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, original] = String(stored || '').split(':');
  if (!salt || !original) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 120000, 32, 'sha256').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(original));
}

function createToken(payload) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(body).digest('base64url');
  if (signature !== expected) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  if (payload.exp < Date.now()) return null;
  return payload;
}

function json(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        return resolve(JSON.parse(raw));
      } catch {
        return reject(new Error('Invalid JSON'));
      }
    });
  });
}

function authUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  return verifyToken(token);
}

function checkRateLimit(req, res) {
  const ip = req.socket.remoteAddress || 'unknown';
  const t = Date.now();
  const bucket = rateMap.get(ip) || [];
  const filtered = bucket.filter((x) => t - x < RATE_WINDOW_MS);
  filtered.push(t);
  rateMap.set(ip, filtered);
  if (filtered.length > RATE_LIMIT) {
    json(res, 429, { error: 'Rate limit exceeded. Please slow down.' });
    return true;
  }
  return false;
}

function getMime(filePath) {
  const ext = path.extname(filePath);
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.svg': 'image/svg+xml'
  };
  return map[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
  const reqPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const filePath = path.normalize(path.join(PUBLIC_DIR, reqPath));
  if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return false;
  res.writeHead(200, { 'Content-Type': getMime(filePath) });
  res.end(fs.readFileSync(filePath));
  return true;
}

function buildLogoResult(body) {
  const styleTags = [body.visual_theme, body.style_preset, body.industry].filter(Boolean).join(' • ');
  return {
    headline: `${body.logo_type.toUpperCase()} | ${body.business_name || 'Brand'} | ${styleTags}`,
    seo: {
      title: `${body.business_name || 'Brand'} ${body.logo_type} logo | AI Logo Generator`,
      description: `AI-generated ${body.logo_type} logo for ${body.industry || 'modern businesses'} with ${body.brand_personality || 'professional'} tone.`,
      keywords: ['AI logo generator', body.logo_type, body.industry, body.color_palette, body.style_preset].filter(Boolean)
    },
    brandStrategy: {
      audience: body.target_audience,
      competitors: body.competitors,
      slogan: `Powering ${body.business_name || 'your brand'} with AI-designed identity.`
    },
    assets: {
      logo2dPng: `https://dummyimage.com/1024x1024/111827/ffffff&text=${encodeURIComponent((body.business_name || 'Brand') + '+2D')}`,
      logoSvg: `/templates/${(body.logo_type || 'standard').toLowerCase()}.svg`,
      logo3dGlb: body.logo_type === '3d' ? 'https://example.com/model.glb' : null,
      animationMp4: body.logo_type === 'animated' ? 'https://example.com/animation.mp4' : null,
      lottie: body.logo_type === 'animated' ? 'https://example.com/animation.json' : null,
      brandKitPdf: body.logo_type === 'brand-kit' ? 'https://example.com/brand-kit.pdf' : null,
      socialKitZip: 'https://example.com/social-kit.zip'
    }
  };
}

function getUserById(id) {
  return db.users.find((u) => u.id === id);
}

const server = http.createServer(async (req, res) => {
  if (checkRateLimit(req, res)) return;

  if (req.method === 'GET' && serveStatic(req, res)) return;

  if (req.method === 'POST' && req.url === '/api/auth/register') {
    try {
      const { name, email, password } = await parseBody(req);
      if (!name || !email || !password || password.length < 6) return json(res, 400, { error: 'Name, email and password (min 6) required.' });
      const normalizedEmail = String(email).toLowerCase().trim();
      if (db.users.some((u) => u.email === normalizedEmail)) return json(res, 409, { error: 'Email already exists.' });
      const role = normalizedEmail === ADMIN_EMAIL ? 'admin' : 'user';
      const user = { id: db.counters.userId++, name: String(name).trim(), email: normalizedEmail, passwordHash: hashPassword(password), role, created_at: nowIso() };
      db.users.push(user);
      db.subscriptions.push({ id: db.counters.subId++, user_id: user.id, plan: 'free', quota: 10, period_start: nowIso() });
      saveDb(db);
      return json(res, 201, { token: createToken({ id: user.id, email: user.email, role: user.role }), role: user.role, name: user.name });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  if (req.method === 'POST' && req.url === '/api/auth/login') {
    try {
      const { email, password } = await parseBody(req);
      const user = db.users.find((u) => u.email === String(email || '').toLowerCase().trim());
      if (!user || !verifyPassword(password || '', user.passwordHash)) return json(res, 401, { error: 'Invalid email or password.' });
      return json(res, 200, { token: createToken({ id: user.id, email: user.email, role: user.role }), role: user.role, name: user.name });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  if (req.method === 'GET' && req.url === '/api/public/stats') {
    const totalUsers = db.users.length;
    const totalLogos = db.logos.length;
    return json(res, 200, { totalUsers, totalLogos, uptime: process.uptime() });
  }

  if (req.method === 'POST' && req.url === '/api/logo/generate') {
    const auth = authUser(req);
    if (!auth) return json(res, 401, { error: 'Authentication required.' });
    try {
      const body = await parseBody(req);
      const required = ['prompt', 'logo_type', 'style_preset', 'brand_personality', 'color_palette'];
      const missing = required.filter((key) => !body[key]);
      if (missing.length) return json(res, 400, { error: `Missing fields: ${missing.join(', ')}` });
      const generated = buildLogoResult(body);
      const row = {
        id: db.counters.logoId++,
        user_id: auth.id,
        prompt: body.prompt,
        logo_type: body.logo_type,
        input_mode: body.input_mode || 'text',
        business_name: body.business_name || '',
        industry: body.industry || '',
        target_audience: body.target_audience || '',
        brand_personality: body.brand_personality,
        color_palette: body.color_palette,
        style_preset: body.style_preset,
        visual_theme: body.visual_theme || 'futuristic',
        competitors: body.competitors || '',
        generated_result: generated,
        created_at: nowIso()
      };
      db.logos.push(row);
      saveDb(db);
      return json(res, 201, { id: row.id, generated });
    } catch (e) {
      return json(res, 400, { error: e.message });
    }
  }

  if (req.method === 'GET' && req.url === '/api/dashboard/me') {
    const auth = authUser(req);
    if (!auth) return json(res, 401, { error: 'Authentication required.' });
    const mine = db.logos.filter((x) => x.user_id === auth.id);
    const byTypeMap = mine.reduce((acc, x) => ({ ...acc, [x.logo_type]: (acc[x.logo_type] || 0) + 1 }), {});
    const subscription = db.subscriptions.find((s) => s.user_id === auth.id) || { plan: 'free', quota: 10 };
    return json(res, 200, {
      user: getUserById(auth.id),
      stats: { totalLogos: mine.length, byType: byTypeMap, remaining: Math.max(subscription.quota - mine.length, 0) },
      history: mine.slice(-50).reverse()
    });
  }

  if (req.method === 'GET' && req.url === '/api/admin/overview') {
    const auth = authUser(req);
    if (!auth) return json(res, 401, { error: 'Authentication required.' });
    if (auth.role !== 'admin') return json(res, 403, { error: 'Admin access only.' });
    const typeMap = db.logos.reduce((acc, row) => ({ ...acc, [row.logo_type]: (acc[row.logo_type] || 0) + 1 }), {});
    return json(res, 200, {
      totals: { users: db.users.length, logos: db.logos.length },
      topStyles: Object.entries(typeMap).map(([type, total]) => ({ type, total })),
      recentUsers: db.users.slice(-20).reverse(),
      subscriptions: db.subscriptions
    });
  }

  if (serveStatic({ url: '/index.html' }, res)) return;
  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`Logomagic AI running at http://localhost:${PORT}`);
});
