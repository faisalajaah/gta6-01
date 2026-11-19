// The game's rules and state, with no drawing and no browser in it: the city of Solmar, the
// player on foot and in cars, traffic, pedestrians, police, missions and the wanted level.
// step() advances one fixed step and returns what happened as bit flags, so the caller can react
// (sounds, announcements) without the world knowing about screens or sound.
import { BLOCK_X, BLOCK_Y, CAR, GARAGE, PARK, PLAYER, ROADS_X, ROADS_Y, SHOP, VIEW, WANTED, WORLD } from './config.js';
import { pick } from './random.js';
import { clamp, distance } from './geometry.js';
import { addToast, updateMission } from './missions.js';
import { addWanted, updatePolice } from './police.js';
import { punch, shoot, updateBullets } from './combat.js';
import { enterNearestCar, createCar, updatePlayerCar } from './vehicles.js';
import { moveCircle } from './geometry.js';
import { spawnPeds, spawnTraffic, updatePeds, updateTraffic } from './traffic.js';
import { ACTION_BUY, ACTION_ENTER, ACTION_PUNCH, ACTION_REPAIR } from './input.js';
import { createTaxiState, fareNearby, spawnFare, startFare, updateTaxi } from './taxi.js';

export const EVENT_PICKUP = 1;
export const EVENT_CRIME = 2;
export const EVENT_MISSION = 4;
export const EVENT_OVER = 8;
export const EVENT_SHOT = 16;
export const EVENT_PUNCH = 32;
export const EVENT_HIT = 64;
export const EVENT_CRASH = 128;
export const EVENT_FARE = 256;

const BUILDING_COLORS = ['#d9a05b', '#e8836b', '#e0b56a', '#7fb8a8', '#f0e0b8', '#c97e5e', '#a8b8a0', '#d98ab0', '#9fb3c8', '#e8b4a0'];
const ROOF_COLORS = ['#a08068', '#96705a', '#8a7f74', '#7a8a7a', '#b09078', '#8a6f8a'];
const CAR_COLORS = ['#e5534b', '#4fc3f7', '#f2c94c', '#e8e2d4', '#7dd87d', '#c77ddb', '#f2836b', '#5b8dd9'];
const PED_SHIRTS = ['#e5534b', '#4fc3f7', '#f2c94c', '#7dd87d', '#c77ddb', '#f2836b', '#e8e2d4', '#5b8dd9'];

function generateCity(random) {
  const buildings = [];
  const trees = [];
  // One or two buildings per block between the roads: never on a road, never on a sidewalk.
  for (const [bx0, bx1] of BLOCK_X) {
    for (const [by0, by1] of BLOCK_Y) {
      const inner = { x: bx0 + 12, y: by0 + 12, w: bx1 - bx0 - 24, h: by1 - by0 - 24 };
      if (inner.x === PARK.x && inner.y === PARK.y) {
        for (let index = 0; index < 14; index += 1) {
          trees.push({ x: PARK.x + 30 + random() * (PARK.w - 60), y: PARK.y + 30 + random() * (PARK.h - 60), r: 12 + random() * 8 });
        }
        continue;
      }
      // Buildings sit inside the block with grass around them, so the city reads green as
      // well as built-up.
      const area = { x: inner.x + 26, y: inner.y + 26, w: inner.w - 52, h: inner.h - 52 };
      const split = random() < 0.45 && area.w > 200 && area.h > 200;
      if (split) {
        const horizontal = random() < 0.5;
        if (horizontal) {
          buildings.push(makeBuilding(random, area.x, area.y, area.w, (area.h - 16) / 2));
          buildings.push(makeBuilding(random, area.x, area.y + (area.h + 16) / 2, area.w, (area.h - 16) / 2));
        } else {
          buildings.push(makeBuilding(random, area.x, area.y, (area.w - 16) / 2, area.h));
          buildings.push(makeBuilding(random, area.x + (area.w + 16) / 2, area.y, (area.w - 16) / 2, area.h));
        }
      } else {
        buildings.push(makeBuilding(random, area.x, area.y, area.w, area.h));
      }
      if (random() < 0.5) {
        trees.push({ x: inner.x + 8 + random() * (inner.w - 16), y: inner.y + 8 + random() * (inner.h - 16), r: 10 + random() * 6 });
      }
    }
  }
  // Landmarks the player learns by name: the tower and the hotel.
  const tower = buildings.find((b) => b.x > 1000 && b.x < 1400 && b.y > 600 && b.y < 1000);
  if (tower) tower.name = 'SOLMAR TOWER';
  const hotel = buildings.find((b) => b.x > 2600 && b.x < 3000 && b.y > 1800 && b.y < 2200);
  if (hotel) hotel.name = 'PALMS HOTEL';
  return { buildings, trees };
}

function makeBuilding(random, x, y, w, h) {
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    color: pick(random, BUILDING_COLORS),
    roof: pick(random, ROOF_COLORS),
    name: null,
  };
}

export function createWorld(random) {
  const city = generateCity(random);
  const state = {
    time: 0,
    random,
    city,
    player: {
      x: 600, y: 1840, angle: -Math.PI / 2, health: PLAYER.health, cash: 0,
      onFoot: true, car: null, armed: false, ammo: 0, punchCd: 0, shootCd: 0, hurtCd: 0, speed: 0,
      sportOwned: false,
    },
    cars: [],
    peds: [],
    bullets: [],
    particles: [],
    pickups: [],
    taxi: createTaxiState(),
    garageNear: false,
    wanted: 0,
    crimeTimer: 99,
    decayTimer: 0,
    bustTimer: 0,
    policeHitCd: 0,
    overReason: null,
    mission: { index: 0, step: 0, target: null, timer: 0, active: false, done: false, text: '' },
    camera: { x: 600, y: 1800 },
    toasts: [],
    completedMissions: 0,
  };

  function reset() {
    const player = state.player;
    player.x = 600;
    player.y = 1840;
    player.angle = -Math.PI / 2;
    player.health = PLAYER.health;
    player.cash = 0;
    player.onFoot = true;
    player.car = null;
    player.armed = false;
    player.ammo = 0;
    player.punchCd = 0;
    player.shootCd = 0;
    player.hurtCd = 0;
    player.speed = 0;
    player.sportOwned = false;
    state.cars = [];
    state.peds = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.taxi = createTaxiState();
    state.garageNear = false;
    state.wanted = 0;
    state.crimeTimer = 99;
    state.decayTimer = 0;
    state.bustTimer = 0;
    state.policeHitCd = 0;
    state.overReason = null;
    state.time = 0;
    state.completedMissions = 0;
    state.mission = { index: 0, step: 0, target: null, timer: 0, active: false, done: false, text: '' };
    state.toasts = [];
    state.camera = { x: 600, y: 1840 };
    spawnTraffic(state);
    spawnPeds(state);
    // Cash lying on the sidewalks: a small reward for exploring the city.
    for (let index = 0; index < 8; index += 1) {
      const roadX = pick(random, ROADS_X);
      const roadY = pick(random, ROADS_Y);
      const onVertical = random() < 0.5;
      state.pickups.push({
        x: onVertical ? roadX + 46 : 120 + random() * 2960,
        y: onVertical ? 120 + random() * 1960 : roadY + 46,
        amount: 25,
        active: true,
      });
    }
    // One pedestrian is already waving for a cab when the city opens.
    spawnFare(state);
  }

  /** Move the camera toward the player, eased so fast driving never snaps the view. */
  function followCamera(dt) {
    const player = state.player;
    const targetX = clamp(player.x, VIEW.width / 2, WORLD.width - VIEW.width / 2);
    const targetY = clamp(player.y, VIEW.height / 2, WORLD.height - VIEW.height / 2);
    const ease = Math.min(1, dt * 6);
    state.camera.x += (targetX - state.camera.x) * ease;
    state.camera.y += (targetY - state.camera.y) * ease;
  }

  /** The garage shop: repair the car or buy the sport car, both paid in cash. */
  function useGarage(state, actions) {
    const player = state.player;
    if (!state.garageNear || !player.onFoot) return 0;
    if (actions & ACTION_REPAIR) {
      let nearest = null;
      let nearestD = 300;
      for (const car of state.cars) {
        if (car.kind !== 'parked' && car.kind !== 'player') continue;
        const d = distance(player.x, player.y, car.x, car.y);
        if (d < nearestD) {
          nearestD = d;
          nearest = car;
        }
      }
      if (!nearest) {
        addToast(state, 'No car nearby to repair — bring one to the garage');
        return 0;
      }
      if (player.cash < SHOP.repairCost) {
        addToast(state, `Repair costs $${SHOP.repairCost} — you have $${player.cash}`);
        return 0;
      }
      player.cash -= SHOP.repairCost;
      nearest.health = CAR.health;
      addToast(state, `Garage repair — car fixed for $${SHOP.repairCost}`);
      return 1;
    }
    if (actions & ACTION_BUY) {
      if (player.sportOwned) {
        addToast(state, 'You already own the sport car — it is parked by the garage');
        return 0;
      }
      if (player.cash < SHOP.sportCost) {
        addToast(state, `The sport car costs $${SHOP.sportCost} — you have $${player.cash}`);
        return 0;
      }
      player.cash -= SHOP.sportCost;
      player.sportOwned = true;
      const sport = createCar(state, GARAGE.x + 90, GARAGE.y - 20, 0, 'parked', '#f2c94c');
      sport.sport = true;
      state.cars.push(sport);
      addToast(state, 'Sport car bought — gold, parked by the garage, and fast');
      return 1;
    }
    return 0;
  }

  function updatePlayerOnFoot(dt, controls, actions) {
    const player = state.player;
    const speed = controls.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    let dx = controls.x;
    let dy = controls.y;
    const length = Math.hypot(dx, dy);
    if (length > 1) {
      dx /= length;
      dy /= length;
    }
    player.speed = length > 0 ? speed : 0;
    if (length > 0) player.angle = Math.atan2(dy, dx);
    moveCircle(state.city.buildings, player, dx * speed * dt, dy * speed * dt, PLAYER.radius);
    if (player.punchCd > 0) player.punchCd -= dt;
    if (player.shootCd > 0) player.shootCd -= dt;
    if (player.hurtCd > 0) player.hurtCd -= dt;
    // At the garage, R repairs a nearby car and B buys the sport car.
    const shopEvent = useGarage(state, actions);
    if (actions & ACTION_ENTER) {
      // A waving fare comes first: E picks them up, otherwise E takes a car.
      if (fareNearby(state)) {
        startFare(state);
        return shopEvent ? EVENT_PICKUP : 0;
      }
      const entered = enterNearestCar(state);
      return entered === 2 ? EVENT_CRIME : 0;
    }
    if (actions & ACTION_PUNCH && player.punchCd <= 0) {
      player.punchCd = PLAYER.punchCooldown;
      return punch(state) ? EVENT_PUNCH | EVENT_CRIME : EVENT_PUNCH;
    }
    if (controls.shoot && player.armed && player.ammo > 0 && player.shootCd <= 0) {
      player.shootCd = PLAYER.shootCooldown;
      player.ammo -= 1;
      shoot(state, controls.shootX, controls.shootY);
      addWanted(state, WANTED.shoot);
      return EVENT_SHOT | EVENT_CRIME;
    }
    return shopEvent ? EVENT_PICKUP : 0;
  }

  function updatePickups() {
    const player = state.player;
    for (const pickup of state.pickups) {
      if (!pickup.active) continue;
      if (distance(player.x, player.y, pickup.x, pickup.y) < 30) {
        pickup.active = false;
        player.cash += pickup.amount;
        addToast(state, `+$${pickup.amount} found cash`);
        return EVENT_PICKUP;
      }
    }
    return 0;
  }

  function updateWanted(dt) {
    state.crimeTimer += dt;
    if (state.policeHitCd > 0) state.policeHitCd -= dt;
    if (state.wanted === 0) return;
    let nearestPolice = Infinity;
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      nearestPolice = Math.min(nearestPolice, distance(state.player.x, state.player.y, car.x, car.y));
    }
    if (state.crimeTimer > WANTED.crimeFreeSeconds && nearestPolice > 400) {
      state.decayTimer += dt;
      if (state.decayTimer >= WANTED.decaySeconds) {
        state.decayTimer = 0;
        state.wanted = Math.max(0, state.wanted - 1);
        if (state.wanted === 0) addToast(state, 'You lost the cops');
      }
    } else {
      state.decayTimer = 0;
    }
  }

  function updateParticles(dt) {
    for (let index = state.particles.length - 1; index >= 0; index -= 1) {
      const particle = state.particles[index];
      particle.life -= dt;
      if (particle.life <= 0) {
        state.particles.splice(index, 1);
        continue;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    }
    for (let index = state.toasts.length - 1; index >= 0; index -= 1) {
      state.toasts[index].timer -= dt;
      if (state.toasts[index].timer <= 0) state.toasts.splice(index, 1);
    }
  }

  /**
   * One fixed step. `controls` is the held movement state, `actions` the one-shot presses
   * taken this frame. Returns bit flags of what happened (EVENT_*).
   */
  function step(dt, controls, actions) {
    let events = 0;
    state.time += dt;
    events |= updateMission(state, dt);
    const player = state.player;
    if (player.onFoot) events |= updatePlayerOnFoot(dt, controls, actions);
    else events |= updatePlayerCar(state, dt, controls, actions);
    events |= updateTraffic(state, dt);
    events |= updatePeds(state, dt);
    events |= updatePolice(state, dt);
    events |= updateBullets(state, dt);
    events |= updatePickups();
    events |= updateTaxi(state, dt) ? EVENT_FARE : 0;
    state.garageNear = player.onFoot && distance(player.x, player.y, GARAGE.x, GARAGE.y) < 120;
    updateWanted(dt);
    updateParticles(dt);
    followCamera(dt);
    if (player.health <= 0) {
      state.overReason = 'wasted';
      events |= EVENT_OVER;
    }
    if (state.overReason) events |= EVENT_OVER;
    return events;
  }

  reset();
  return { state, reset, step };
}

/** Add a short-lived particle burst (dust, sparks, smoke) at a point. */
export function burst(state, x, y, color, count, speed) {
  for (let index = 0; index < count; index += 1) {
    const angle = state.random() * Math.PI * 2;
    const velocity = speed * (0.4 + state.random() * 0.6);
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life: 0.4 + state.random() * 0.4,
      maxLife: 0.8,
      color,
      size: 2 + state.random() * 3,
    });
  }
}
