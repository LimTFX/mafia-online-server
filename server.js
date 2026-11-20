const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { run, get, all, initDb } = require('./db');

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

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Сервер Mafia запущен на http://localhost:${PORT}`);
  });
});
