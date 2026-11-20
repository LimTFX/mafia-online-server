const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { run, get, all, initDb } = require('./db');
const { resourceLimits } = require('worker_threads');
const { state } = require('../mafia-online-client/js/state');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(24).toString('hex');
}

function generateRoomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Требуется авторизация' });

  const user = await get('SELECT id, username FROM users WHERE token = ?', [token]);
  if (!user) return res.status(401).json({ error: 'Недействительная сессия' });

  req.user = user;
  next();
}

//Регистрация
app.post('/api/auth/register', async (req, res) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    if (username.length < 2) {
      return res.status(400).json({ error: 'Слишком короткий логин'});
     } else if (password.length < 3) {
       return res.status(400).json({ error: 'Слишком короткий пароль'});
     }

    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Это имя уже занято' });
    }

    const token = generateToken();
    const result = await run(
      'INSERT INTO users (username, password_hash, token) VALUES (?, ?, ?)',
      [username, hashPassword(password), token]
    );

    res.json({ token, user: { id: result.id, username } });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера при регистрации' });
  }
});

// Авторизация
app.post('/api/auth/login', async (req, res) => {
  try {
    const username = (req.body.username || '').trim();
    const password = req.body.password || '';
    const user = await get(
      'SELECT id, username, password_hash FROM users WHERE username = ?', 
      [username]
    );

    if (!user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }

    const token = generateToken();
    await run('UPDATE users SET token = ? WHERE id = ?',[token, user.id]);

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

// Проверка сессии
app.get('/api/me', authMiddleware, async (req, res) => {
  const rooms = await all('SELECT * FROM rooms');
  let activeRoom = null;

  for (const r of rooms) {
    const state = JSON.parse(r.game_state);
    if (state.players.some((p) => p.id === req.user.id)) {
      activeRoom = { id: r.id, name: r.name, code: r.code, hostId: r.host_id, status: r.status, ...state};
      break;
    }
  }

  res.json({ user: req.user, activeRoom });
});

// Список комнат
app.get('/api/rooms', authMiddleware, async (req, res) => {
  const rows = await all('SELECT * FROM rooms ORDER BY id DESC');
  const rooms = rows.map((r) => {
    const state = JSON.parse(r.game_state);
    return {
      id: r.id,
      name: r.name,
      code: r.code,
      status: r.status,
      playerCount: state.players.length
    };
  });

  res.json({ rooms });
});

// Создание комнаты
app.post('/api/rooms', authMiddleware, async (req, res) => {
  const name = (req.body.name || '').trim() || `Комната ${req.user.username}`;
  const code = generateRoomCode();
  const initialState = {
    phase: 'WAITING',
    dayNumber: 0,
    phaseEndsAt: null,
    lastAnnouncement: '',
    players: [{ id: req.user.id, username: req.user.username, role: null, isAlive: true }],
    nightActions: {},
    dayVotes: {}
  };

  const result = await run(
    'INSERT INTO rooms (name, code, host_id, status, game_state) VALUES (?, ?, ?, ?, ?)',
    [name, code, req.user.id, 'WAITING', JSON.stringify(initialState)]
  );

  res.json({
    rooms: {
      id: result.id,
      name,
      code,
      hostId: req.user.id,
      status: 'WAITING',
      ...initialState
    }
  });
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер Mafia запущен на http://localhost:${PORT}`);
  });
});
