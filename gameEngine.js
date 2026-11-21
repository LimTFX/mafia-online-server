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

function checkWinCondition(players) {
  const alive = players.filter((p) => p.isAlive);
  const mafiaCount = alive.filter((p) => p.role === 'MAFIA').length;
  const townCount = alive.length - mafiaCount;

  if (mafiaCount === 0) {
    return 'Победа мирных жителей! Вся мафия обезврежена.';
  }
  if (mafiaCount >= townCount) {
    return 'Победа Мафии! Город полностью захвачен.';
  }
  return null;
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
  let updatedPlayers = state.players.map((p) => ({ ...p }));

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

  const winMessage = checkWinCondition(updatedPlayers);
  if (winMessage) {
    return {
      ...state,
      phase: 'GAME_OVER',
      phaseEndsAt: null,
      lastAnnouncement: `${announcement} ${winMessage}`,
      players: updatedPlayers,
      nightActions: {},
      dayVotes: {},
      detectiveReport
    };
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

function resolveDay(state) {
  const tally = {};
  Object.values(state.dayVotes).forEach((targetId) => {
    tally[targetId] = (tally[targetId] || 0) + 1;
  });

  let maxVotes = 0;
  let candidateId = null;
  let isTie = false;

  Object.entries(tally).forEach(([id, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      candidateId = Number(id);
      isTie = false;
    } else if (count === maxVotes) {
      isTie = true;
    }
  });

  let updatedPlayers = state.players.map((p) => ({ ...p }));
  let announcement = '';

  if (candidateId && !isTie) {
    const exiled = updatedPlayers.find((p) => p.id === candidateId);
    if (exiled) {
      exiled.isAlive = false;
      announcement = `По итогам голосования город покидает ${exiled.username}. `;
    }
  } else {
    announcement = 'Голоса разделились поровну, никто не был исключен. ';
  }

  const winMessage = checkWinCondition(updatedPlayers);
  if (winMessage) {
    return {
      ...state,
      phase: 'GAME_OVER',
      phaseEndsAt: null,
      lastAnnouncement: `${announcement}${winMessage}`,
      players: updatedPlayers,
      dayVotes: {}
    };
  }

  return {
    ...state,
    phase: 'NIGHT_MISTRESS',
    dayNumber: (state.dayNumber || 1) + 1,
    phaseEndsAt: Date.now() + NIGHT_DURATION_MS,
    lastAnnouncement: `${announcement}Наступает ночь. Просыпается Любовница...`,
    players: updatedPlayers,
    nightActions: {},
    dayVotes: {},
    detectiveReport: null
  };
}

function advancePhaseIfExpired(state) {
  if (!state.phaseEndsAt || Date.now() < state.phaseEndsAt) {
    return { state, changed: false };
  }

  const nightIdx = NIGHT_SEQUENCE.indexOf(state.phase);
  if (nightIdx !== -1) {
    if (nightIdx < NIGHT_SEQUENCE.length - 1) {
      const nextPhase = NIGHT_SEQUENCE[nightIdx + 1];
      return {
        changed: true,
        state: {
          ...state,
          phase: nextPhase,
          phaseEndsAt: Date.now() + NIGHT_DURATION_MS,
          lastAnnouncement: ''
        }
      };
    }

    return { changed: true, state: resolveNight(state) };
  }

  if (state.phase === 'DAY_VOTING') {
    return { changed: true, state: resolveDay(state) };
  }

  return { state, changed: false };
}

function registerAction(state, userId, targetId) {
  const actor = state.players.find((p) => p.id === userId && p.isAlive);
  if (!actor) return state;

  const target = state.players.find((p) => p.id === targetId && p.isAlive);
  if (!target) return state;

  if (state.phase === 'NIGHT_MISTRESS' && actor.role === 'MISTRESS') {
    state.nightActions.MISTRESS = targetId;
  } else if (state.phase === 'NIGHT_DOCTOR' && actor.role === 'DOCTOR') {
    state.nightActions.DOCTOR = targetId;
  } else if (state.phase === 'NIGHT_MAFIA' && actor.role === 'MAFIA') {
    state.nightActions.MAFIA = targetId;
  } else if (state.phase === 'NIGHT_DETECTIVE' && actor.role === 'DETECTIVE') {
    state.nightActions.DETECTIVE = targetId;
  } else if (state.phase === 'DAY_VOTING') {
   state.dayVotes[userId] = targetId;
  }

  return state;
}

module.exports = { startGame, advancePhaseIfExpired, registerAction };