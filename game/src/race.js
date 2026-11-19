// The street race: four checkpoints around Solmar against a rival driver, run from the
// start line by the stadium. Mission 7 (Street King) is one race; after it, pulling up to
// the line in a car and stopping starts a repeatable race for cash. The rival drives the
// same road-grid autopilot as the screenshot driver, so the race is a contest of lines,
// not of top speed: the rival is quick but the player's car is faster.
import { RACE, RACE_START } from './config.js';
import { angleDifference, clamp, distance } from './geometry.js';
import { addToast } from './missions.js';
import { createCar, steerCarTowards } from './vehicles.js';
import { moveCircle } from './geometry.js';
import { CAR } from './config.js';
/** The race route: east along the tower road, south, west, then north to the line. */
export const RACE_CHECKPOINTS = [
  { x: 2600, y: 600 },
  { x: 2600, y: 1800 },
  { x: 1000, y: 1800 },
  { x: 1000, y: 600 },
];

const CHECKPOINT_REACH = 80;
/** The rival's cruising speed: quick, but a good human run in a normal car beats it. */
const RIVAL_SPEED = 430;

/** The empty race state a fresh world starts with. */
export function createRaceState() {
  return {
    active: false,
    countdown: 0,
    beep: 0,
    index: 0,
    rivalIndex: 0,
    rival: null,
    prize: 0,
    result: null,
    cooldown: 0,
  };
}

/** True when the player is stopped in a car at the start line, ready to race. */
export function raceReady(state) {
  const race = state.race;
  const player = state.player;
  if (race.active || race.cooldown > 0 || player.onFoot || !player.car) return false;
  return distance(player.x, player.y, RACE_START.x, RACE_START.y) < 90
    && Math.abs(player.car.speed) < 100;
}

/**
 * Line both cars up at the start and count down. Returns false when the player has no
 * car to race in.
 */
export function startRace(state, prize) {
  const race = state.race;
  const player = state.player;
  if (player.onFoot || !player.car) {
    addToast(state, 'Get in a car first — the race starts from the line');
    return false;
  }
  const rival = createCar(state, RACE_START.x - 60, RACE_START.y - 16, 0, 'rival', '#c77ddb');
  rival.speed = 0;
  state.cars.push(rival);
  // Side by side in the two lanes, the player a nose ahead: no bump at the gun.
  player.car.x = RACE_START.x + 20;
  player.car.y = RACE_START.y + 16;
  player.car.angle = 0;
  player.car.speed = 0;
  player.x = player.car.x;
  player.y = player.car.y;
  race.active = true;
  race.countdown = RACE.countdown;
  race.beep = RACE.countdown;
  race.index = 0;
  race.rivalIndex = 0;
  race.rival = rival;
  race.prize = prize;
  race.result = null;
  addToast(state, 'Race! Three beeps, then go — beat the rival to the last checkpoint');
  return true;
}

/** Steer a car along the road grid toward a waypoint, like the screenshot driver. */
function driveRival(state, car, waypoint, dt) {
  const desired = Math.atan2(waypoint.y - car.y, waypoint.x - car.x);
  const diff = angleDifference(car.angle, desired);
  steerCarTowards(car, desired, dt, 3.0);
  const targetSpeed = Math.abs(diff) > 1.2 ? RIVAL_SPEED * 0.4 : RIVAL_SPEED;
  car.speed += clamp(targetSpeed - car.speed, -500 * dt, 420 * dt);
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  moveCircle(state.city.buildings, car, dx, dy, CAR.radius);
}

/**
 * Advance the race one step. Returns 1 on a checkpoint, 2 on a win, 3 on a loss.
 * The rival's progress is measured by checkpoints, the player's the same way.
 */
export function updateRace(state, dt) {
  const race = state.race;
  if (race.cooldown > 0 && !race.active) race.cooldown -= dt;
  if (!race.active) {
    if (raceReady(state)) startRace(state, RACE.prize);
    return 0;
  }
  if (race.countdown > 0) {
    // Hold both cars on the line while the lights count down.
    if (state.player.car) state.player.car.speed = 0;
    if (race.rival) race.rival.speed = 0;
    race.countdown -= dt;
    const whole = Math.ceil(race.countdown);
    if (whole < race.beep) {
      race.beep = whole;
      return 1;
    }
    if (race.countdown <= 0) {
      addToast(state, 'GO!');
      return 1;
    }
    return 0;
  }
  const player = state.player;
  const target = RACE_CHECKPOINTS[race.index];
  if (target && distance(player.x, player.y, target.x, target.y) < CHECKPOINT_REACH) {
    race.index += 1;
    if (race.index >= RACE_CHECKPOINTS.length) return endRace(state, true);
    addToast(state, `Checkpoint ${race.index + 1} of ${RACE_CHECKPOINTS.length}`);
    return 1;
  }
  if (race.rival) {
    const rivalTarget = RACE_CHECKPOINTS[race.rivalIndex];
    if (rivalTarget) {
      driveRival(state, race.rival, rivalTarget, dt);
      if (distance(race.rival.x, race.rival.y, rivalTarget.x, rivalTarget.y) < CHECKPOINT_REACH) {
        race.rivalIndex += 1;
        if (race.rivalIndex >= RACE_CHECKPOINTS.length) return endRace(state, false);
      }
    }
  }
  return 0;
}

/** Finish the race: pay the prize on a win, clear the rival, cool down the line. */
function endRace(state, won) {
  const race = state.race;
  race.active = false;
  race.result = won ? 'win' : 'loss';
  race.cooldown = RACE.cooldown;
  if (race.rival) {
    const index = state.cars.indexOf(race.rival);
    if (index >= 0) state.cars.splice(index, 1);
    race.rival = null;
  }
  if (won) {
    state.player.cash += race.prize;
    addToast(state, `Race won — +$${race.prize}`);
    return 2;
  }
  addToast(state, 'The rival beat you to the line — try again');
  return 3;
}

/** The HUD line for the race, or '' when nothing is happening. */
export function raceText(state) {
  const race = state.race;
  if (race.active && race.countdown > 0) return `Race starting — ${Math.ceil(race.countdown)}…`;
  if (race.active) {
    return `Race — checkpoint ${race.index + 1} of ${RACE_CHECKPOINTS.length} · rival ${race.rivalIndex + 1} of ${RACE_CHECKPOINTS.length}`;
  }
  if (raceReady(state)) return 'Stop here to race — $300 prize';
  return '';
}
