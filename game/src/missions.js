// Missions and the story of Solmar: Marco Solano, a getaway driver back in town, takes jobs
// from Lena Cruz, a fixer who pays in cash. Each mission is steps with a target on the map;
// finishing one pays out and starts the next, and finishing all six makes Marco king of Solmar.
import { GARAGE, HOTEL, MARINA, MISSIONS } from './config.js';
import { distance } from './geometry.js';
import { addWanted } from './police.js';

const EAST_PLAZA = { x: 2600, y: 600 };
const TOWER_CHECKPOINTS = [
  { x: 1400, y: 600 },
  { x: 2600, y: 1000 },
  { x: 1800, y: 1400 },
];
const REACH_DISTANCE = 70;

/** A short message at the top of the screen for a few seconds. */
export function addToast(state, text) {
  state.toasts.push({ text, timer: 4 });
  if (state.toasts.length > 3) state.toasts.shift();
}

/** The objective line the HUD shows for the current mission step. */
export function missionText(state) {
  const mission = state.mission;
  if (mission.done) return 'King of Solmar — free roam. Enjoy the city.';
  const def = MISSIONS[mission.index];
  if (!def) return '';
  if (mission.index === 0) {
    return mission.step === 0 ? 'Steal a car — walk up to one and press E' : 'Drive to the garage';
  }
  if (mission.index === 1) {
    return mission.step === 0 ? 'Pick up the package at East Plaza' : `Deliver to the Marina — ${Math.ceil(mission.timer)}s left`;
  }
  if (mission.index === 2) return `Shake the heat — survive ${Math.ceil(mission.timer)}s`;
  if (mission.index === 3) {
    return mission.step === 0 ? 'Pick up the cash at the Marina' : 'Bring the cash back to the garage — the cops are on you';
  }
  if (mission.index === 4) {
    return mission.step === 0 ? 'Break into the Palms Hotel — grab the stash' : 'Escape to the garage — the cops are on you';
  }
  if (mission.index === 5) {
    return `Tower Run — checkpoint ${mission.step + 1} of 3 · ${Math.ceil(mission.timer)}s left`;
  }
  return def.title;
}

/** Begin mission `index` at its first step, with its targets and timers. */
export function startMission(state, index) {
  const mission = state.mission;
  mission.index = index;
  mission.step = 0;
  mission.active = true;
  mission.done = false;
  mission.timer = 0;
  mission.target = null;
  if (index === 0) {
    mission.target = null;
    addToast(state, 'Mission: First Wheels — steal a car');
  } else if (index === 1) {
    mission.target = EAST_PLAZA;
    addToast(state, 'Mission: Sunset Courier — pick up the package');
  } else if (index === 2) {
    mission.timer = 45;
    addWanted(state, 2);
    addToast(state, 'Mission: Shake the Heat — the cops are on you');
  } else if (index === 3) {
    mission.target = MARINA;
    addToast(state, 'Mission: The Marina Job — pick up the cash');
  } else if (index === 4) {
    mission.target = HOTEL;
    addToast(state, 'Mission: Palms Heist — the hotel stash, no witnesses');
  } else if (index === 5) {
    mission.target = TOWER_CHECKPOINTS[0];
    mission.timer = 75;
    addWanted(state, 1);
    addToast(state, 'Mission: Tower Run — three checkpoints, 75 seconds');
  }
}

/** Pay out a finished mission and start the next one, or finish the story. */
function completeMission(state) {
  const def = MISSIONS[state.mission.index];
  state.player.cash += def.reward;
  state.completedMissions += 1;
  addToast(state, `Mission complete: ${def.title} — +$${def.reward}`);
  const next = state.mission.index + 1;
  if (next >= MISSIONS.length) {
    state.mission.done = true;
    state.mission.active = false;
    state.mission.target = null;
    addToast(state, 'King of Solmar — you own this city now');
    return 4;
  }
  startMission(state, next);
  return 4;
}

/** Fail the courier: the package is gone, the job restarts. */
function failMission(state, reason) {
  addToast(state, `${reason} — the job restarts`);
  startMission(state, state.mission.index);
  return 4;
}

/**
 * Advance the current mission one step. Returns the mission event flag when a mission
 * completes or fails, so the caller can play the reward sound.
 */
export function updateMission(state, dt) {
  const mission = state.mission;
  if (!mission.active || mission.done) return 0;
  const player = state.player;
  if (mission.index === 0) {
    if (mission.step === 0 && !player.onFoot) {
      mission.step = 1;
      mission.target = GARAGE;
      addToast(state, 'Nice wheels — now drive to the garage');
    } else if (mission.step === 1 && distance(player.x, player.y, GARAGE.x, GARAGE.y) < REACH_DISTANCE) {
      return completeMission(state);
    }
    return 0;
  }
  if (mission.index === 1) {
    if (mission.step === 0 && distance(player.x, player.y, EAST_PLAZA.x, EAST_PLAZA.y) < REACH_DISTANCE) {
      mission.step = 1;
      mission.target = MARINA;
      mission.timer = 75;
      addToast(state, 'Package picked up — 75 seconds to the Marina');
    } else if (mission.step === 1) {
      mission.timer -= dt;
      if (distance(player.x, player.y, MARINA.x, MARINA.y) < REACH_DISTANCE) {
        player.armed = true;
        player.ammo = 24;
        addToast(state, 'Lena gave you a pistol — 24 rounds');
        return completeMission(state);
      }
      if (mission.timer <= 0) return failMission(state, 'Too slow — the buyer walked away');
    }
    return 0;
  }
  if (mission.index === 2) {
    mission.timer -= dt;
    if (mission.timer <= 0) {
      state.wanted = 0;
      for (let index = state.cars.length - 1; index >= 0; index -= 1) {
        if (state.cars[index].kind === 'police') state.cars.splice(index, 1);
      }
      return completeMission(state);
    }
    return 0;
  }
  if (mission.index === 3) {
    if (mission.step === 0 && distance(player.x, player.y, MARINA.x, MARINA.y) < REACH_DISTANCE) {
      mission.step = 1;
      mission.target = GARAGE;
      addWanted(state, 3);
      addToast(state, 'Cash grabbed — three stars, run for the garage');
    } else if (mission.step === 1 && distance(player.x, player.y, GARAGE.x, GARAGE.y) < REACH_DISTANCE) {
      return completeMission(state);
    }
    return 0;
  }
  if (mission.index === 4) {
    if (mission.step === 0 && distance(player.x, player.y, HOTEL.x, HOTEL.y) < REACH_DISTANCE) {
      mission.step = 1;
      mission.target = GARAGE;
      addWanted(state, 2);
      addToast(state, 'Stash grabbed — two stars, lose them at the garage');
    } else if (mission.step === 1 && distance(player.x, player.y, GARAGE.x, GARAGE.y) < REACH_DISTANCE) {
      return completeMission(state);
    }
    return 0;
  }
  if (mission.index === 5) {
    mission.timer -= dt;
    const target = TOWER_CHECKPOINTS[mission.step];
    if (target && distance(player.x, player.y, target.x, target.y) < REACH_DISTANCE) {
      mission.step += 1;
      if (mission.step >= TOWER_CHECKPOINTS.length) {
        addToast(state, 'All checkpoints hit — the Tower is yours');
        return completeMission(state);
      }
      mission.target = TOWER_CHECKPOINTS[mission.step];
      addToast(state, `Checkpoint ${mission.step} — next one up`);
    }
    if (mission.timer <= 0) return failMission(state, 'Out of time — the Tower Run restarts');
    return 0;
  }
  return 0;
}
