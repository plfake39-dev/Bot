const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const mineflayer = require('mineflayer');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const USERS_FILE = path.join(__dirname, 'users.json');

if (process.env.NODE_ENV === 'production' && SESSION_SECRET.length < 32) {
  console.error('Set SESSION_SECRET to a long random secret (at least 32 characters) in production.');
  process.exit(1);
}
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', { mode: 0o600 });

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
  catch { return []; }
}
function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), { mode: 0o600 });
}

app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(session({
  name: 'shahariar.sid',
  secret: SESSION_SECRET || 'local-development-only-change-this-secret-before-deploying',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 12
  }
}));
app.use(express.static(__dirname, { extensions: ['html'], index: 'index.html' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});
app.use(['/api/auth/register', '/api/auth/login'], authLimiter);

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'প্রথমে Sign In করুন।' });
  next();
}

let bot = null;
let botState = 'offline';
let botMessage = 'বট এখন বন্ধ আছে।';
let reconnectTimer = null;
let reconnectEnabled = false;
let stoppingForUser = false;
let lastError = '';

const serverConfig = {
  host: process.env.MC_HOST || 'goodluck.mcsh.io',
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.MC_BOT_NAME || 'ShahariarBD'
};

function safeBotStatus() {
  return {
    online: botState === 'online',
    state: botState,
    message: botMessage,
    host: serverConfig.host,
    username: serverConfig.username,
    lastError
  };
}

function scheduleReconnect() {
  if (!reconnectEnabled || stoppingForUser || reconnectTimer) return;
  botState = 'reconnecting';
  botMessage = 'সংযোগ বিচ্ছিন্ন; ১৫ সেকেন্ড পরে আবার চেষ্টা হবে।';
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectBot();
  }, 15000);
}

function connectBot() {
  if (bot || botState === 'connecting' || botState === 'online') {
    return safeBotStatus();
  }
  stoppingForUser = false;
  botState = 'connecting';
  botMessage = `${serverConfig.host}-এ সংযোগের চেষ্টা চলছে…`;
  lastError = '';

  try {
    const options = {
      host: serverConfig.host,
      port: serverConfig.port,
      username: serverConfig.username,
      hideErrors: false
    };

    // Set MC_AUTH=microsoft only if you own/are authorized to use a real Microsoft Minecraft account.
    // Microsoft auth may show a device-code prompt in the server logs. Never enter credentials in this web panel.
    if (process.env.MC_AUTH === 'microsoft') {
      options.auth = 'microsoft';
      if (process.env.MC_USERNAME) options.username = process.env.MC_USERNAME;
    }

    bot = mineflayer.createBot(options);

    bot.once('login', () => {
      botState = 'connecting';
      botMessage = 'Minecraft login হয়েছে; world spawn-এর অপেক্ষায়।';
    });
    bot.once('spawn', () => {
      botState = 'online';
      botMessage = 'বট সার্ভারে spawn করেছে এবং সংযুক্ত আছে।';
      lastError = '';
      console.log('[bot] Online on', serverConfig.host);
    });
    bot.on('kicked', reason => {
      lastError = typeof reason === 'string' ? reason : JSON.stringify(reason);
      botMessage = 'সার্ভার বটকে kick করেছে।';
      console.warn('[bot] Kicked:', lastError);
    });
    bot.on('error', err => {
      lastError = err.message || String(err);
      botMessage = 'বটের সংযোগে ত্রুটি হয়েছে।';
      console.error('[bot] Error:', lastError);
    });
    bot.once('end', reason => {
      console.log('[bot] Disconnected:', reason || '');
      bot = null;
      if (reconnectEnabled && !stoppingForUser) {
        scheduleReconnect();
      } else {
        botState = 'offline';
        botMessage = 'বট অফলাইন।';
      }
    });
  } catch (err) {
    bot = null;
    lastError = err.message || String(err);
    botState = 'offline';
    botMessage = 'বট শুরু করা যায়নি।';
    scheduleReconnect();
  }
  return safeBotStatus();
}

function disconnectBot() {
  reconnectEnabled = false;
  stoppingForUser = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  if (bot) {
    const current = bot;
    bot = null;
    try { current.quit('Dashboard requested disconnect'); } catch {}
  }
  botState = 'offline';
  botMessage = 'বটকে Offline করা হয়েছে।';
  return safeBotStatus();
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'ShahariarBD dashboard' }));

app.post('/api/auth/register', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'সঠিক ইমেইল লিখুন।' });
  if (password.length < 8) return res.status(400).json({ error: 'পাসওয়ার্ড অন্তত ৮ অক্ষরের হতে হবে।' });
  const users = readUsers();
  if (users.some(u => u.email === email)) return res.status(409).json({ error: 'এই ইমেইলে অ্যাকাউন্ট আছে; Sign In করুন।' });
  const passwordHash = await bcrypt.hash(password, 12);
  users.push({ email, passwordHash, createdAt: new Date().toISOString() });
  writeUsers(users);
  req.session.user = { email };
  res.json({ ok: true, user: { email } });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const user = readUsers().find(u => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: 'ইমেইল বা পাসওয়ার্ড সঠিক নয়।' });
  }
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'সেশন তৈরি করা যায়নি।' });
    req.session.user = { email };
    res.json({ ok: true, user: { email } });
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('shahariar.sid');
    res.json({ ok: true });
  });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ authenticated: !!req.session.user, user: req.session.user || null });
});

app.get('/api/bot/status', requireAuth, (req, res) => res.json(safeBotStatus()));

app.post('/api/bot/connect', requireAuth, (req, res) => {
  if (!reconnectEnabled) reconnectEnabled = true;
  const result = connectBot();
  res.json({ ...result, message: result.message || 'বটের সংযোগ শুরু হয়েছে।' });
});

app.post('/api/bot/disconnect', requireAuth, (req, res) => {
  res.json(disconnectBot());
});

app.listen(PORT, HOST, () => {
  console.log(`ShahariarBD dashboard running at http://${HOST}:${PORT}`);
  console.log(`Minecraft server: ${serverConfig.host}:${serverConfig.port}`);
  if (process.env.MC_AUTH === 'microsoft') {
    console.log('Microsoft auth enabled; follow Mineflayer device-code instructions in this terminal if shown.');
  }
});
