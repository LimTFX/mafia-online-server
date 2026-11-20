const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { run, get, all, initDb } = require('./db');
const { resourceLimits } = require('worker_threads');

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
        [username. hashPassword(password), token]
      );

      res.json({ token, user: { id: result.id, username } });
    } catch (err) {
      res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер Mafia запущен на http://localhost:${PORT}`);
  });
});
