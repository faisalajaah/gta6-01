// The wanted level and the Solmar police: black-and-white cruisers that spawn when the player
// commits crimes, chase the player through the streets, ram their car and arrest them on foot.
import { CAR, POLICE, WANTED, WORLD } from './config.js';
import { angleDifference, clamp, distance, moveCircle, nearestRoadPoint } from './geometry.js';
import { createCar, steerCarTowards } from './vehicles.js';
import { burst } from './world.js';

/** Raise the wanted level by `amount` stars and restart the crime-free clock. */
export function addWanted(state, amount) {
  state.wanted = Math.min(WANTED.max, state.wanted + amount);
  state.crimeTimer = 0;
  state.decayTimer = 0;
}

/** How many police cruisers the wanted level calls for right now. */
export function wantedPoliceCount(state) {
  return Math.min(POLICE.maxCars, state.wanted);
}

/** Spawn one cruiser on a road near the player, out of the player's sight. */
function spawnPoliceCar(state) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle = state.random() * Math.PI * 2;
    const x = clamp(state.player.x + Math.cos(angle) * POLICE.spawnDistance, 40, WORLD.width - 40);
    const y = clamp(state.player.y + Math.sin(angle) * POLICE.spawnDistance, 40, WORLD.beachY - 40);
    const point = nearestRoadPoint(x, y);
    if (distance(state.player.x, state.player.y, point.x, point.y) < 300) continue;
    const car = createCar(state, point.x, point.y, 0, 'police', '#f5f5f5');
    car.speed = POLICE.chaseSpeed * 0.6;
    state.cars.push(car);
    return;
  }
}

/** A cruiser that has been far from the player for a long stretch gives up the chase. */
const GIVE_UP_SECONDS = 25;
const GIVE_UP_DISTANCE = 600;
const CLOSE_DISTANCE = 300;

/** One cruiser: steer toward the player, ram them, and arrest them on foot. */
function updatePoliceCar(state, car, dt) {
  const player = state.player;
  const targetAngle = Math.atan2(player.y - car.y, player.x - car.x);
  steerCarTowards(car, targetAngle, dt, 3.2);
  const d = distance(player.x, player.y, car.x, car.y);
  car.chaseTimer = (car.chaseTimer || 0) + (d > GIVE_UP_DISTANCE ? dt : 0);
  if (d < CLOSE_DISTANCE) car.chaseTimer = 0;
  if (car.chaseTimer > GIVE_UP_SECONDS) {
    // Lost the player: go back to patrolling instead of chasing forever.
    car.kind = 'traffic';
    car.cruise = 140;
    car.chaseTimer = 0;
    return;
  }
  const targetSpeed = d > 120 ? POLICE.chaseSpeed : POLICE.chaseSpeed * 0.75;
  car.speed += clamp(targetSpeed - car.speed, -500 * dt, 420 * dt);
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  const blocked = moveCircle(state.city.buildings, car, dx, dy, CAR.radius);
  if (blocked) car.speed *= 0.6;
  if (car.ramCd > 0) car.ramCd -= dt;
  // Ramming the player's car damages it; ramming the player on foot hurts them.
  if (d < CAR.radius + 16 && car.ramCd <= 0) {
    car.ramCd = POLICE.ramCooldown;
    if (player.onFoot) {
      player.health -= POLICE.ramDamage;
      player.hurtCd = 1;
      burst(state, player.x, player.y, '#e5534b', 10, 140);
    } else if (player.car) {
      player.car.health -= 5;
      burst(state, car.x, car.y, '#f2c94c', 8, 120);
      car.speed *= 0.5;
      if (player.car.health <= 0) {
        state.overReason = 'busted';
      }
    }
  }
}

export function updatePolice(state, dt) {
  const wantedCount = wantedPoliceCount(state);
  let policeCars = state.cars.filter((car) => car.kind === 'police');
  if (state.wanted > 0 && policeCars.length < wantedCount) spawnPoliceCar(state);
  policeCars = state.cars.filter((car) => car.kind === 'police');
  for (const car of policeCars) {
    if (state.wanted === 0) {
      // The heat is off: this cruiser goes back to patrolling and drives away.
      car.kind = 'traffic';
      car.cruise = 140;
      continue;
    }
    updatePoliceCar(state, car, dt);
    if (state.overReason) return 8;
  }
  // Standing next to any cruiser on foot gets the player arrested: one shared clock, so
  // several cruisers cannot cancel each other's arrests.
  const player = state.player;
  let nearPolice = false;
  for (const car of policeCars) {
    if (distance(player.x, player.y, car.x, car.y) < POLICE.bustDistance) nearPolice = true;
  }
  if (player.onFoot && nearPolice) {
    state.bustTimer += dt;
    if (state.bustTimer >= POLICE.bustTime) state.overReason = 'busted';
  } else {
    state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
  }
  // A cruiser far from the player after the heat fades is removed.
  for (let index = state.cars.length - 1; index >= 0; index -= 1) {
    const car = state.cars[index];
    if (car.kind === 'police' && state.wanted === 0) state.cars.splice(index, 1);
  }
  return 0;
}

/** True when any police cruiser is close enough for its siren to be heard. */
export function policeNear(state) {
  for (const car of state.cars) {
    if (car.kind === 'police' && distance(state.player.x, state.player.y, car.x, car.y) < 500) return true;
  }
  return false;
}
