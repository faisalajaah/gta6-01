// Cars: creating them, driving the player's car with arcade physics, stealing one, and the
// collisions between cars. A car is one circle for collisions, which keeps bumping into
// buildings and other cars cheap and predictable.
import { CAR, PLAYER, WANTED } from './config.js';
import { angleDifference, clamp, distance, moveCircle, nearestRoad } from './geometry.js';
import { addWanted } from './police.js';
import { burst } from './world.js';
import { ACTION_ENTER } from './input.js';
import { pick } from './random.js';

export const CAR_COLORS = ['#e5534b', '#4fc3f7', '#f2c94c', '#e8e2d4', '#7dd87d', '#c77ddb', '#f2836b', '#5b8dd9'];

let nextCarId = 1;

/** A new car at (x, y) facing `angle`, of kind traffic, parked, police or player. */
export function createCar(state, x, y, angle, kind, color) {
  const car = {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    color: color || pick(state.random, CAR_COLORS),
    kind,
    health: CAR.health,
    driver: kind === 'traffic',
    cruise: 120 + state.random() * 60,
    axis: 'x',
    dir: 1,
    road: 0,
    ramCd: 0,
    hitCd: 0,
    crashCd: 0,
    skidCd: 0,
    sport: false,
  };
  nextCarId += 1;
  return car;
}

/** The nearest car the player could enter, within 64 units, or null. */
export function nearestEnterableCar(state) {
  const player = state.player;
  let best = null;
  let bestD = 64;
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

/**
 * Put the player into the nearest car. Stealing an occupied car is a crime and its driver flees
 * on foot; a parked car is free. Returns 0 (nothing), 1 (entered, no crime) or 2 (stole it).
 */
export function enterNearestCar(state) {
  const car = nearestEnterableCar(state);
  if (!car) return 0;
  const player = state.player;
  let stolen = false;
  if (car.kind === 'traffic' && car.driver) {
    stolen = true;
    car.driver = false;
    // The driver jumps out and runs away on foot.
    state.peds.push({
      x: car.x + 20, y: car.y + 20, angle: 0, speed: 120,
      axis: 'x', dir: 1, road: car.x, side: 0, state: 'flee', downTimer: 0,
      color: '#e8e2d4', fleeTimer: 2,
    });
    addWanted(state, WANTED.steal);
  }
  car.kind = 'player';
  car.speed = 0;
  player.onFoot = false;
  player.car = car;
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return stolen ? 2 : 1;
}

/** Step out of the player's car onto the road beside it. */
export function exitCar(state) {
  const player = state.player;
  const car = player.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  player.onFoot = true;
  player.car = null;
  const sideX = Math.cos(car.angle + Math.PI / 2);
  const sideY = Math.sin(car.angle + Math.PI / 2);
  player.x = clamp(car.x + sideX * 30, PLAYER.radius, 3200 - PLAYER.radius);
  player.y = clamp(car.y + sideY * 30, PLAYER.radius, 2400 - PLAYER.radius);
  player.angle = car.angle;
}

/** Drive the player's car: throttle, steering, drag, building slides and car bumps. */
export function updatePlayerCar(state, dt, controls, actions) {
  const player = state.player;
  const car = player.car;
  if (!car) {
    player.onFoot = true;
    return 0;
  }
  if (actions & ACTION_ENTER) {
    exitCar(state);
    return 0;
  }
  const throttle = -controls.y;
  const steer = controls.x;
  const accel = car.sport ? CAR.accel * 1.3 : CAR.accel;
  const topSpeed = car.sport ? CAR.maxSpeed * 1.35 : CAR.maxSpeed;
  if (throttle > 0) car.speed += accel * dt;
  else if (throttle < 0) {
    if (car.speed > 10) car.speed -= CAR.brake * dt;
    else car.speed -= CAR.reverseAccel * dt;
  }
  car.speed = clamp(car.speed, -CAR.maxReverse, topSpeed);
  car.speed -= car.speed * CAR.drag * dt;
  if (Math.abs(car.speed) < 4 && throttle === 0) car.speed = 0;
  const turn = steer * CAR.turnRate * dt * clamp(Math.abs(car.speed) / 120, 0.15, 1) * (car.speed < 0 ? -1 : 1);
  car.angle += turn;
  // Hard cornering at speed throws dust and smoke off the rear wheels.
  if (car.skidCd > 0) car.skidCd -= dt;
  if (Math.abs(car.speed) > 320 && Math.abs(steer) > 0.5 && car.skidCd <= 0) {
    car.skidCd = 0.09;
    const rearX = car.x - Math.cos(car.angle) * (CAR.length / 2);
    const rearY = car.y - Math.sin(car.angle) * (CAR.length / 2);
    burst(state, rearX, rearY, '#b8b0a0', 3, 60);
  }
  const dx = Math.cos(car.angle) * car.speed * dt;
  const dy = Math.sin(car.angle) * car.speed * dt;
  if (car.crashCd > 0) car.crashCd -= dt;
  const blocked = moveCircle(state.city.buildings, car, dx, dy, CAR.radius);
  if (blocked && Math.abs(car.speed) > 120 && car.crashCd <= 0) {
    car.crashCd = 0.6;
    car.health -= 3;
    car.speed *= 0.4;
    burst(state, car.x, car.y, '#f2c94c', 8, 120);
    if (car.health <= 0) {
      car.health = 0;
      state.overReason = 'busted';
      return 0;
    }
  }
  // Bump into other cars: push apart, trade a little speed, spark.
  for (const other of state.cars) {
    if (other === car || other.kind === 'player') continue;
    const d = distance(car.x, car.y, other.x, other.y);
    if (d < CAR.radius * 2 && d > 0.01) {
      const push = (CAR.radius * 2 - d) / 2;
      const nx = (car.x - other.x) / d;
      const ny = (car.y - other.y) / d;
      car.x += nx * push;
      car.y += ny * push;
      other.x -= nx * push;
      other.y -= ny * push;
      if (Math.abs(car.speed) > 100) {
        other.speed = Math.max(other.speed, car.speed * 0.5);
        car.speed *= 0.7;
        if (other.kind === 'police' && state.policeHitCd <= 0) {
          state.policeHitCd = 3;
          addWanted(state, WANTED.hitPolice);
        }
        burst(state, car.x, car.y, '#f2c94c', 6, 100);
      }
    }
  }
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  player.speed = Math.abs(car.speed);
  // Keep the road the car is on current, so autopilots can route along the grid.
  const road = nearestRoad(car.x, car.y);
  car.axis = road.axis;
  car.road = road.coord;
  if (car.health <= 0) return 0;
  return 0;
}

/** Keep a traffic car's nose pointed where it is going. */
export function steerCarTowards(car, targetAngle, dt, rate) {
  car.angle += clamp(angleDifference(car.angle, targetAngle), -rate * dt, rate * dt);
}
