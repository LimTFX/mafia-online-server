const NIGHT_DURATION_MS = 45 * 1000; //Время для каджой ночной роли
const DAY_DURATION_MS = 90 * 1000; //Время на девное обсуждение и голосование
//Позже можно добавить возможность выставлять время самому хосту комнаты

const NIGHT_SEQUENCE = [
  'NIGHT_MISTRESS',
  'NIGHT_DOCTOR',
  'NIGHT_MAFIA',
  'NIGHT_DETECTIVE'
];

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignRoles(players) {
  const count = players.length;
  const rolesPool = ['MAFIA', 'DOCTOR', 'DETECTIVE', 'MISTRESS'];

  //Если игроков больше 7, добавляем вторую мафию
  if (count >= 7) {
    rolesPool.push('MAFIA');
  }

  while (rolesPool.length < count) {
    rolesPool.push('CIVILIAN');
  }

  const shuffledRoles = shuffle(rolesPool);
  return players.map((player, idx) => ({
    ...player,
    role: shuffledRoles[idx],
    isAlive: true
  }));
}

module.exports = { NIGHT_DURATION_MS, DAY_DURATION_MS, NIGHT_SEQUENCE };