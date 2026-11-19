// The screenshot scenes behind ?shot=heist|race|stadium|garage. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so the
// frame is what a short game really looks like and the same seed always gives the same frame.
import { GARAGE, STEP } from './config.js';
import { angleDifference, clamp, distance } from './geometry.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { stageFare } from './taxi.js';
import { createCar } from './vehicles.js';
import { RACE_CHECKPOINTS, startRace } from './race.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 14;
const CHASE_SECONDS = 9;
const DRIVE_SECONDS = 6;
const END_SECONDS = 8;
const HEIST_SECONDS = 9;
const RACE_SECONDS = 8;
const STADIUM_SECONDS = 6;
const GARAGE_SECONDS = 6;

const NEUTRAL = { x: 0, y: 0, run: false, shoot: false, shootX: 0, shootY: 0 };

/** The beachfront chase, west along the beach road from the Marina to the garage. */
const BEACH_WAYPOINTS = [
  { x: 2600, y: 2200 },
  { x: 2200, y: 2200 },
  { x: 1800, y: 2200 },
  { x: 1400, y: 2200 },
  { x: 1000, y: 2200 },
  { x: 600, y: 2200 },
];

/** The heist getaway, east along the beach road from the Bank toward the Marina. */
const BEACH_EAST_WAYPOINTS = [
  { x: 1800, y: 2200 },
  { x: 2400, y: 2200 },
  { x: 3000, y: 2200 },
];

/** Downtown east along the tower road, past Solmar Tower. */
const DOWNTOWN_WAYPOINTS = [
  { x: 1000, y: 600 },
  { x: 1400, y: 600 },
  { x: 1800, y: 600 },
  { x: 2200, y: 600 },
  { x: 2600, y: 600 },
  { x: 3000, y: 600 },
];

/**
 * A driver that follows a waypoint path along the road grid: to each waypoint it first drives
 * along the car's own road to the intersection with the waypoint's row or column, then turns
 * onto it, so the car never cuts across a block.
 */
function createDriver(waypoints) {
  let path = [];
  let waypointIndex = 0;
  return function driveControls(state) {
    const car = state.player.car;
    if (!car) return NEUTRAL;
    if (waypointIndex >= waypoints.length) return NEUTRAL;
    const waypoint = waypoints[waypointIndex];
    if (distance(car.x, car.y, waypoint.x, waypoint.y) < 90) {
      waypointIndex += 1;
      path = [];
      if (waypointIndex >= waypoints.length) return NEUTRAL;
    }
    if (path.length === 0) {
      const next = waypoints[waypointIndex];
      if (car.axis === 'x') path = [{ x: car.road, y: next.y }, next];
      else path = [{ x: next.x, y: car.road }, next];
      if (distance(car.x, car.y, path[0].x, path[0].y) < 45) path.shift();
    }
    let target = path[0];
    if (distance(car.x, car.y, target.x, target.y) < 45) {
      path.shift();
      target = path[0] || waypoints[waypointIndex];
    }
    const desired = Math.atan2(target.y - car.y, target.x - car.x);
    const diff = angleDifference(car.angle, desired);
    const steer = clamp(diff * 1.6, -1, 1);
    // Ease off the throttle in a hard turn, so the turn stays inside the road; facing the
    // wrong way, back up and swing around instead of turning in place.
    let throttle = -1;
    if (Math.abs(diff) > 2.2) throttle = 1;
    else if (Math.abs(diff) > 1.2) throttle = 0;
    else if (Math.abs(steer) > 0.6) throttle = -0.4;
    return { x: steer, y: throttle, run: false, shoot: false, shootX: 0, shootY: 0 };
  };
}

/** Put Marco in a parked car placed at (x, y) facing `angle`, on the road at `road`. */
function putMarcoInCar(state, x, y, angle, road) {
  const parked = state.cars.find((car) => car.kind === 'parked');
  if (!parked) return;
  parked.x = x;
  parked.y = y;
  parked.angle = angle;
  parked.speed = 0;
  parked.axis = 'y';
  parked.road = road;
  state.player.x = parked.x;
  state.player.y = parked.y;
  state.player.angle = angle;
  parked.kind = 'player';
  state.player.onFoot = false;
  state.player.car = parked;
}

/** Walk the player toward a point on the sidewalk, safe from the traffic on the road. */
function walkTowards(tx, ty) {
  return function walkControls(state) {
    const player = state.player;
    const desired = Math.atan2(ty - player.y, tx - player.x);
    return { x: Math.cos(desired), y: Math.sin(desired), run: false, shoot: false, shootX: 0, shootY: 0 };
  };
}

/**
 * Set `world` to the named scene (heist, race, stadium, garage, or the older start, play,
 * chase, drive and end; any other name is start) and return the screen to draw over it
 * and the save to show on the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'heist') {
    // The cover: the Last Job at night — five stars, the Bank just robbed, Marco fleeing
    // east down the beach road toward the Tower. The heat arrives at the end of the run,
    // so the frame catches him mid-flight with cruisers spawning and a roadblock going
    // up ahead, the beach and the sea along the bottom of the frame.
    putMarcoInCar(state, 1200, 2200, 0, 2200);
    state.player.cash = 2400;
    state.completedMissions = 8;
    startMission(state, 8);
    state.mission.step = 1;
    state.mission.target = { x: 1200, y: 800 };
    state.mission.timer = 90;
    // Halfway through the dark stretch of the four-minute day.
    state.dayTime = 120;
    const drive = createDriver(BEACH_EAST_WAYPOINTS);
    for (let index = 0; index < 6 / STEP; index += 1) {
      world.step(STEP, drive(state), 0);
      if (state.overReason) break;
    }
    addWanted(state, 5);
    for (let index = 0; index < (HEIST_SECONDS - 6) / STEP; index += 1) {
      world.step(STEP, drive(state), 0);
      if (state.overReason) break;
    }
    return { screen: state.overReason ? SCREEN_OVER : SCREEN_PLAY, save: { cash: 2400, missions: 8, bestCash: 2400 } };
  }
  if (name === 'race') {
    // Street King mid-race: Marco and the rival through downtown, checkpoint rings on the
    // road and the race line on the HUD. The countdown is skipped so the frame catches
    // the race in full flight.
    putMarcoInCar(state, 2200, 600, 0, 600);
    state.player.cash = 1600;
    state.completedMissions = 7;
    startMission(state, 7);
    startRace(state, 300);
    state.race.countdown = 0;
    const drive = createDriver(RACE_CHECKPOINTS);
    for (let index = 0; index < RACE_SECONDS / STEP; index += 1) {
      world.step(STEP, drive(state), 0);
      if (state.overReason) break;
    }
    return { screen: SCREEN_PLAY, save: { cash: 1600, missions: 7, bestCash: 1600 } };
  }
  if (name === 'stadium') {
    // Marco on foot in the stadium field, a sun package glowing beside him and the running
    // track around him: the new district and the collectibles in one frame.
    state.player.x = 2320;
    state.player.y = 320;
    state.player.cash = 400;
    state.completedMissions = 6;
    startMission(state, 6);
    for (let index = 0; index < STADIUM_SECONDS / STEP; index += 1) {
      world.step(STEP, walkTowards(2360, 360)(state), 0);
    }
    return { screen: SCREEN_PLAY, save: { cash: 400, missions: 6, bestCash: 400 } };
  }
  if (name === 'garage') {
    // Marco on foot at the garage, the gold sport car parked beside him and a fare waving
    // for a cab: the shop, the car and the taxi job in one frame.
    state.player.x = 600;
    state.player.y = 2130;
    state.player.cash = 900;
    state.completedMissions = 5;
    startMission(state, 5);
    const sport = createCar(state, GARAGE.x + 90, GARAGE.y - 20, 0, 'parked', '#f2c94c');
    sport.sport = true;
    state.cars.push(sport);
    state.player.sportOwned = true;
    stageFare(state, 760, 2160);
    for (let index = 0; index < GARAGE_SECONDS / STEP; index += 1) {
      world.step(STEP, NEUTRAL, 0);
    }
    return { screen: SCREEN_PLAY, save: { cash: 900, missions: 5, bestCash: 900 } };
  }
  if (name === 'play') {
    // Marco on foot by the park, a fare waving for a cab beside him: city life, the new
    // taxi job and the park in one frame.
    state.player.x = 1150;
    state.player.y = 1046;
    stageFare(state, 1450, 1046);
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      world.step(STEP, walkTowards(1400, 1046)(state), 0);
    }
    return { screen: SCREEN_PLAY, save: { cash: 0, missions: 0, bestCash: 0 } };
  }
  if (name === 'chase') {
    // The cover: Marco fleeing west down the beach road with three stars, the Marina Job
    // running, cruisers behind him, the beach and the sea on the left of the frame.
    putMarcoInCar(state, 2900, 2200, Math.PI, 2200);
    state.player.cash = 550;
    state.completedMissions = 3;
    startMission(state, 3);
    state.mission.step = 1;
    state.mission.target = { x: 600, y: 2200 };
    addWanted(state, 3);
    const drive = createDriver(BEACH_WAYPOINTS);
    for (let index = 0; index < CHASE_SECONDS / STEP; index += 1) {
      world.step(STEP, drive(state), 0);
      if (state.overReason) break;
    }
    return { screen: state.overReason ? SCREEN_OVER : SCREEN_PLAY, save: { cash: 550, missions: 3, bestCash: 550 } };
  }
  if (name === 'drive') {
    // The Tower Run through downtown: Marco racing east past Solmar Tower with the timer
    // running and traffic on the road. Clear the cars on his lane first, so the run reads
    // as speed instead of a traffic jam.
    putMarcoInCar(state, 800, 600, 0, 600);
    state.player.cash = 1050;
    state.completedMissions = 5;
    startMission(state, 5);
    for (let index = state.cars.length - 1; index >= 0; index -= 1) {
      const car = state.cars[index];
      if (car.kind === 'traffic' && car.x > 700 && car.x < 3150 && Math.abs(car.y - 600) < 140) {
        state.cars.splice(index, 1);
      }
    }
    const drive = createDriver(DOWNTOWN_WAYPOINTS);
    for (let index = 0; index < DRIVE_SECONDS / STEP; index += 1) {
      world.step(STEP, drive(state), 0);
      if (state.overReason) break;
    }
    return { screen: SCREEN_PLAY, save: { cash: 1050, missions: 5, bestCash: 1050 } };
  }
  if (name === 'end') {
    // Marco on foot with three stars and a cruiser right on top of him: the arrest plays out
    // for real, and the frame ends on the BUSTED screen.
    addWanted(state, 3);
    for (let index = 0; index < END_SECONDS / STEP; index += 1) {
      world.step(STEP, NEUTRAL, 0);
      if (state.overReason) break;
      // Keep a cruiser pressed against Marco so the arrest cannot take all day.
      const police = state.cars.find((car) => car.kind === 'police');
      if (police) {
        police.x = state.player.x + 20;
        police.y = state.player.y;
        police.speed = 0;
      }
    }
    if (!state.overReason) state.overReason = 'busted';
    return { screen: SCREEN_OVER, save: { cash: 150, missions: 1, bestCash: 550 } };
  }
  for (let index = 0; index < START_SECONDS / STEP; index += 1) {
    world.step(STEP, NEUTRAL, 0);
  }
  return { screen: SCREEN_TITLE, save: { cash: 150, missions: 1, bestCash: 550 } };
}
