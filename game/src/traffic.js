// Traffic cars that drive the road grid and pedestrians who walk the sidewalks. Both keep the
// city alive around the player and give the streets something to steal, dodge and hit.
import { CAR, GRID, PEDS, PLAYER, ROADS_X, ROADS_Y, TRAFFIC, WANTED, WORLD } from './config.js';
import { pick } from './random.js';
import { atIntersection, clamp, distance, nearestRoad, nearestRoadPoint } from './geometry.js';
import { createCar } from './vehicles.js';
import { addWanted } from './police.js';
import { burst } from './world.js';

const PED_SHIRTS = ['#e5534b', '#4fc3f7', '#f2c94c', '#7dd87d', '#c77ddb', '#f2836b', '#e8e2d4', '#5b8dd9'];

/** A road point near the player, for spawning traffic that the player can actually see. */
function spawnPointNear(state, minD, maxD) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = state.random() * Math.PI * 2;
    const dist = minD + state.random() * (maxD - minD);
    const x = clamp(state.player.x + Math.cos(angle) * dist, 40, WORLD.width - 40);
    const y = clamp(state.player.y + Math.sin(angle) * dist, 40, WORLD.beachY - 40);
    const point = nearestRoadPoint(x, y);
    if (distance(state.player.x, state.player.y, point.x, point.y) > 260) return point;
  }
  return nearestRoadPoint(state.player.x + 400, state.player.y);
}

/** Fill the streets with traffic cars and parked cars when the world resets. */
export function spawnTraffic(state) {
  for (let index = 0; index < TRAFFIC.count; index += 1) {
    const point = spawnPointNear(state, 200, 1200);
    const road = nearestRoad(point.x, point.y);
    const car = createCar(state, point.x, point.y, 0, 'traffic');
    car.axis = road.axis;
    car.road = road.coord;
    car.dir = state.random() < 0.5 ? 1 : -1;
    car.angle = road.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.speed = TRAFFIC.speedMin + state.random() * (TRAFFIC.speedMax - TRAFFIC.speedMin);
    car.cruise = car.speed;
    state.cars.push(car);
  }
  // Parked cars along the roads, free to take without the heat.
  for (let index = 0; index < 10; index += 1) {
    const point = spawnPointNear(state, 150, 1400);
    const road = nearestRoad(point.x, point.y);
    const car = createCar(state, point.x, point.y, 0, 'parked');
    car.axis = road.axis;
    car.road = road.coord;
    car.dir = state.random() < 0.5 ? 1 : -1;
    car.angle = road.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    // Parked on the roadside, out of the driving lane.
    if (road.axis === 'x') car.x = road.coord + (car.dir > 0 ? -26 : 26);
    else car.y = road.coord + (car.dir > 0 ? 26 : -26);
    state.cars.push(car);
  }
}

/** Fill the sidewalks with pedestrians when the world resets. */
export function spawnPeds(state) {
  for (let index = 0; index < PEDS.count; index += 1) {
    const point = spawnPointNear(state, 100, 1000);
    const road = nearestRoad(point.x, point.y);
    const dir = state.random() < 0.5 ? 1 : -1;
    const side = state.random() < 0.5 ? 1 : -1;
    const ped = {
      x: road.axis === 'x' ? road.coord + side * 46 : point.x,
      y: road.axis === 'y' ? road.coord + side * 46 : point.y,
      angle: 0,
      speed: PEDS.speedMin + state.random() * (PEDS.speedMax - PEDS.speedMin),
      axis: road.axis,
      dir,
      road: road.coord,
      side,
      state: 'walk',
      downTimer: 0,
      fleeTimer: 0,
      color: pick(state.random, PED_SHIRTS),
    };
    ped.angle = ped.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    state.peds.push(ped);
  }
}

/** One traffic car: cruise its road, slow for the car ahead, turn at intersections. */
function updateTrafficCar(state, car, dt) {
  if (car.kind === 'parked' || car.kind === 'player') return;
  // Slow down for a car ahead in the same lane, the player's included.
  let targetSpeed = car.cruise;
  for (const other of state.cars) {
    if (other === car) continue;
    if (other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
    const ahead = car.axis === 'x' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
    if (ahead > 0 && ahead < 80) targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed - 20));
  }
  car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
  const step = car.speed * dt;
  if (car.axis === 'x') car.y += step * car.dir;
  else car.x += step * car.dir;
  // Wrap around the city edge instead of driving into the sea or off the map.
  if (car.axis === 'x') {
    if (car.y > WORLD.beachY - 40 || car.y < 40) {
      car.dir *= -1;
      car.angle += Math.PI;
    }
  } else if (car.x > WORLD.width - 40 || car.x < 40) {
    car.dir *= -1;
    car.angle += Math.PI;
  }
  // At an intersection, sometimes turn onto the crossing road.
  if (atIntersection(car.x, car.y) && state.random() < TRAFFIC.turnChance * dt * 10) {
    const road = nearestRoad(car.x, car.y);
    const otherAxis = car.axis === 'x' ? 'y' : 'x';
    const crossCoord = otherAxis === 'x' ? Math.round(car.x / GRID) * GRID : Math.round(car.y / GRID) * GRID;
    const roads = otherAxis === 'x' ? ROADS_X : ROADS_Y;
    let nearest = roads[0];
    for (const roadCoord of roads) if (Math.abs(roadCoord - crossCoord) < Math.abs(nearest - crossCoord)) nearest = roadCoord;
    if (Math.abs(nearest - crossCoord) < 60) {
      car.axis = otherAxis;
      car.road = nearest;
      car.dir = state.random() < 0.5 ? 1 : -1;
      car.angle = otherAxis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      if (otherAxis === 'x') car.x = nearest + (car.dir > 0 ? -16 : 16);
      else car.y = nearest + (car.dir > 0 ? 16 : -16);
    }
  }
  // Stay in the driving lane for the road it is on.
  if (car.axis === 'x') car.x = car.road + (car.dir > 0 ? -16 : 16);
  else car.y = car.road + (car.dir > 0 ? 16 : -16);
}

export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind === 'police') continue;
    updateTrafficCar(state, car, dt);
    // Traffic too far from the player is respawned near the player, so the streets stay busy.
    if (car.kind === 'traffic' && distance(state.player.x, state.player.y, car.x, car.y) > 1700) {
      const point = spawnPointNear(state, 500, 900);
      const road = nearestRoad(point.x, point.y);
      car.x = point.x;
      car.y = point.y;
      car.axis = road.axis;
      car.road = road.coord;
      car.dir = state.random() < 0.5 ? 1 : -1;
      car.angle = road.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      car.speed = car.cruise;
    }
  }
  return 0;
}

/** One pedestrian: walk the sidewalk, flee danger, get up after being knocked down. */
function updatePed(state, ped, dt) {
  if (ped.state === 'down') {
    ped.downTimer -= dt;
    if (ped.downTimer <= 0) ped.state = 'walk';
    return;
  }
  const player = state.player;
  const playerCar = player.car;
  const danger = playerCar
    ? distance(ped.x, ped.y, playerCar.x, playerCar.y) < 140 && Math.abs(playerCar.speed) > 120
    : distance(ped.x, ped.y, player.x, player.y) < 60;
  if (danger && ped.fleeTimer <= 0) {
    ped.state = 'flee';
    ped.fleeTimer = 1.5;
  }
  if (ped.state === 'flee') {
    // Flee along the sidewalk, away from the player, never across the road into traffic.
    ped.fleeTimer -= dt;
    if (ped.axis === 'x') {
      ped.y += Math.sign(ped.y - player.y || 1) * 150 * dt;
      ped.angle = ped.y > player.y ? Math.PI / 2 : -Math.PI / 2;
    } else {
      ped.x += Math.sign(ped.x - player.x || 1) * 150 * dt;
      ped.angle = ped.x > player.x ? 0 : Math.PI;
    }
    ped.x = clamp(ped.x, 10, WORLD.width - 10);
    ped.y = clamp(ped.y, 10, WORLD.height - 10);
    if (ped.fleeTimer <= 0) ped.state = 'walk';
    return;
  }
  const step = ped.speed * dt;
  if (ped.axis === 'x') ped.y += step * ped.dir;
  else ped.x += step * ped.dir;
  if (ped.axis === 'x' && (ped.y > WORLD.beachY - 40 || ped.y < 40)) ped.dir *= -1;
  if (ped.axis === 'y' && (ped.x > WORLD.width - 40 || ped.x < 40)) ped.dir *= -1;
  if (atIntersection(ped.x, ped.y) && state.random() < 0.3 * dt * 10) {
    const road = nearestRoad(ped.x, ped.y);
    ped.axis = ped.axis === 'x' ? 'y' : 'x';
    ped.road = road.coord;
    ped.dir = state.random() < 0.5 ? 1 : -1;
    ped.side = state.random() < 0.5 ? 1 : -1;
  }
  if (ped.axis === 'x') ped.x = ped.road + ped.side * 46;
  else ped.y = ped.road + ped.side * 46;
  ped.angle = ped.axis === 'x' ? (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ped.dir > 0 ? 0 : Math.PI);
  // A fast car driven by the player knocks a pedestrian down: a crime.
  if (playerCar && Math.abs(playerCar.speed) > 80 && distance(ped.x, ped.y, playerCar.x, playerCar.y) < CAR.radius + 10) {
    ped.state = 'down';
    ped.downTimer = 3;
    burst(state, ped.x, ped.y, '#e5534b', 10, 140);
    addWanted(state, WANTED.hitPed);
    return 2;
  }
  // A traffic car that touches a pedestrian on foot knocks the player down hard.
  if (player.onFoot && player.hurtCd <= 0) {
    for (const car of state.cars) {
      if (car.kind !== 'traffic') continue;
      if (distance(player.x, player.y, car.x, car.y) < CAR.radius + PLAYER.radius && Math.abs(car.speed) > 40) {
        player.health -= 10;
        player.hurtCd = 1;
        burst(state, player.x, player.y, '#e5534b', 8, 120);
        return 64;
      }
    }
  }
  return 0;
}

export function updatePeds(state, dt) {
  let events = 0;
  for (const ped of state.peds) events |= updatePed(state, ped, dt);
  return events;
}
