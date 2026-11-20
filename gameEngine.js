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

function startGame(state) {
  const updatedPlayers = assignRoles(state.players);
  return {
    ...state,
    phase: 'NIGHT_MISTRESS',
    dayNumber: 1,
    phaseEndsAt: Date.now() + NIGHT_DURATION_MS,
    lastAnnouncement: 'Город засыпает. Просыпается Любовница и делает свой выбор...',
    players: updatedPlayers,
    nightActions: {},
    dayVotes: {},
    detectiveReport: null
  };
}

function resolveNight(state) {
  const { DOCTOR: healedId, MAFIA: killedId, DETECTIVE: checkedId } = state.nightActions;
  let announcement = 'Наступило утро. ';
  let updatedPlayers = [...state.players];

  if (killedId && killedId !== healedId) {
    const victim = updatedPlayers.find((p) => p.id === killedId);
    if (victim) {
      victim.isAlive = false;
      announcement += `Этой ночью был убит игрок ${victim.username}.`;
    }
  } else if (killedId && killedId === healedId) {
    announcement += 'Мафия выходила на охоту, но Доктор спас жертву. Никто не погиб.';
  } else {
    announcement += 'Ночь прошла спокойно, никто не пострадал.';
  }

  let detectiveReport = null;
  if (checkedId) {
    const target = updatedPlayers.find((p) => p.id === checkedId);
    if (target) {
      detectiveReport = {
        targetId: target.id,
        targetName: target.username,
        isMafia: target.role === 'MAFIA'
      };
    }
  }

  return {
    ...state,
    phase: 'DAY_VOTING',
    phaseEndsAt: Date.now() + DAY_DURATION_MS,
    lastAnnouncement: announcement,
    players: updatedPlayers,
    nightActions: {},
    dayVotes: {},
    detectiveReport
  };
}

module.exports = { NIGHT_DURATION_MS, DAY_DURATION_MS, NIGHT_SEQUENCE, startGame, resolveNight };