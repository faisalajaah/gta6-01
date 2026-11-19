// The taxi side job: a pedestrian waves for a cab, Marco drives them across Solmar, and
// the fare pays cash. Repeatable forever, so the city keeps paying after the story ends.
// The fare waits on a sidewalk, gets in when Marco walks up and presses E, and the clock
// runs until Marco drops them at the marked spot while driving.
import { ROADS_X, ROADS_Y, TAXI, WORLD } from './config.js';
import { distance } from './geometry.js';
import { addToast } from './missions.js';
import { chance, pick } from './random.js';

const PICKUP_DISTANCE = 56;
const DROP_DISTANCE = 80;

/** The empty taxi state a fresh world starts with. */
export function createTaxiState() {
  return { waiting: null, dest: null, timer: 0, fare: 0, riding: false, cooldown: 0 };
}

/** A far-away road point for a drop-off, never too close to where the fare starts. */
function farDestination(state, fromX, fromY) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const roadX = pick(state.random, ROADS_X);
    const roadY = pick(state.random, ROADS_Y);
    const dest = { x: roadX, y: roadY };
    if (distance(fromX, fromY, dest.x, dest.y) > 900) return dest;
  }
  return { x: 3000, y: 600 };
}

/** Put a waiting fare on a sidewalk near the player, waving for a cab. */
export function spawnFare(state) {
  const taxi = state.taxi;
  taxi.waiting = null;
  taxi.dest = null;
  taxi.riding = false;
  const roadX = pick(state.random, ROADS_X);
  const roadY = pick(state.random, ROADS_Y);
  const onVertical = chance(state.random, 0.5);
  const side = state.random() < 0.5 ? 1 : -1;
  const x = onVertical ? roadX + side * 46 : 200 + state.random() * 2800;
  const y = onVertical ? 200 + state.random() * 1900 : roadY + side * 46;
  const ped = {
    x: Math.max(20, Math.min(WORLD.width - 20, x)),
    y: Math.max(20, Math.min(WORLD.beachY - 20, y)),
    angle: 0, speed: 0, axis: onVertical ? 'x' : 'y', dir: 1, road: onVertical ? roadX : roadY, side,
    state: 'wait', downTimer: 0, fleeTimer: 0, color: '#f2c94c', fare: true,
  };
  state.peds.push(ped);
  taxi.waiting = ped;
  taxi.cooldown = 0;
}

/** Place a waiting fare at an exact spot, for the screenshot staging. */
export function stageFare(state, x, y) {
  spawnFare(state);
  const ped = state.taxi.waiting;
  ped.x = x;
  ped.y = y;
  ped.axis = 'x';
  ped.road = 1400;
  ped.side = 1;
}

/** True when Marco is on foot close enough to pick the fare up. */
export function fareNearby(state) {
  const taxi = state.taxi;
  if (!taxi.waiting || taxi.riding) return false;
  return distance(state.player.x, state.player.y, taxi.waiting.x, taxi.waiting.y) < PICKUP_DISTANCE;
}

/** Start the ride: the fare gets in, the destination and the clock are set. */
export function startFare(state) {
  const taxi = state.taxi;
  if (!taxi.waiting) return false;
  const ped = taxi.waiting;
  const index = state.peds.indexOf(ped);
  if (index >= 0) state.peds.splice(index, 1);
  taxi.dest = farDestination(state, ped.x, ped.y);
  const metres = distance(ped.x, ped.y, taxi.dest.x, taxi.dest.y);
  taxi.fare = Math.round(TAXI.baseFare + metres * TAXI.perMetre);
  taxi.timer = Math.max(TAXI.minTime, metres * TAXI.secondsPerMetre);
  taxi.riding = true;
  taxi.waiting = null;
  addToast(state, `Taxi fare — drop them off for $${taxi.fare}`);
  return true;
}

/** The HUD line for the taxi job, or '' when nothing is happening. */
export function taxiText(state) {
  const taxi = state.taxi;
  if (taxi.riding && taxi.dest) {
    return `Taxi: drop off — ${Math.ceil(taxi.timer)}s left · $${taxi.fare}`;
  }
  if (taxi.waiting && fareNearby(state)) return 'Press E — pick up the taxi fare';
  return '';
}

/** Advance the taxi job one step. Returns 1 when a fare is paid, else 0. */
export function updateTaxi(state, dt) {
  const taxi = state.taxi;
  if (taxi.cooldown > 0) {
    taxi.cooldown -= dt;
    if (taxi.cooldown <= 0 && !taxi.waiting && !taxi.riding) spawnFare(state);
    return 0;
  }
  if (!taxi.riding) return 0;
  taxi.timer -= dt;
  const player = state.player;
  if (!player.onFoot && taxi.dest && distance(player.x, player.y, taxi.dest.x, taxi.dest.y) < DROP_DISTANCE) {
    const bonus = taxi.timer > 0 ? TAXI.timeBonus : 0;
    const paid = taxi.fare + bonus;
    player.cash += paid;
    addToast(state, `Fare paid — +$${paid}${bonus ? ' (fast drop bonus!)' : ''}`);
    taxi.riding = false;
    taxi.dest = null;
    taxi.cooldown = 6;
    return 1;
  }
  if (taxi.timer <= 0) {
    addToast(state, 'Too slow — the fare walked away');
    taxi.riding = false;
    taxi.dest = null;
    taxi.cooldown = 6;
  }
  return 0;
}
