// The screenshot scenes behind ?shot=start|play|chase|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so the
// frame is what a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { angleDifference, clamp, distance } from './geometry.js';
import { startMission } from './missions.js';
import { addWanted } from './police.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 14;
const CHASE_SECONDS = 9;
const DRIVE_SECONDS = 10;
const END_SECONDS = 8;

const NEUTRAL = { x: 0, y: 0, run: false, shoot: false, shootX: 0, shootY: 0 };

/** A waypoint path along the road grid from the start corner to the garage. */
const CHASE_WAYPOINTS = [
  { x: 1000, y: 1800 },
  { x: 1400, y: 1800 },
  { x: 1800, y: 1800 },
  { x: 1800, y: 2200 },
  { x: 1400, y: 2200 },
  { x: 1000, y: 2200 },
  { x: 600, y: 2200 },
];

/**
 * A driver that follows the waypoint path along the road grid: to each waypoint it first drives
 * along the car's own road to the intersection with the waypoint's row or column, then turns
 * onto it, so the car never cuts across a block.
 */
function createDriver() {
  let path = [];
  let waypointIndex = 0;
  return function driveControls(state) {
    const car = state.player.car;
    if (!car) return NEUTRAL;
    if (waypointIndex >= CHASE_WAYPOINTS.length) return NEUTRAL;
    const waypoint = CHASE_WAYPOINTS[waypointIndex];
    if (distance(car.x, car.y, waypoint.x, waypoint.y) < 90) {
      waypointIndex += 1;
      path = [];
      if (waypointIndex >= CHASE_WAYPOINTS.length) return NEUTRAL;
    }
    if (path.length === 0) {
      const next = CHASE_WAYPOINTS[waypointIndex];
      if (car.axis === 'x') path = [{ x: car.road, y: next.y }, next];
      else path = [{ x: next.x, y: car.road }, next];
      if (distance(car.x, car.y, path[0].x, path[0].y) < 45) path.shift();
    }
    let target = path[0];
    if (distance(car.x, car.y, target.x, target.y) < 45) {
      path.shift();
      target = path[0] || CHASE_WAYPOINTS[waypointIndex];
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

/** Walk the player east along the sidewalk, safe from the traffic on the road. */
function walkControls(state) {
  const player = state.player;
  const target = { x: 1400, y: 1846 };
  const desired = Math.atan2(target.y - player.y, target.x - player.x);
  return { x: Math.cos(desired), y: Math.sin(desired), run: false, shoot: false, shootX: 0, shootY: 0 };
}

/**
 * Set `world` to the named scene (start, play, chase or end; any other name is start) and return
 * the screen to draw over it and the save to show on the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name === 'play') {
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      world.step(STEP, walkControls(state), 0);
    }
    return { screen: SCREEN_PLAY, save: { cash: 0, missions: 0, bestCash: 0 } };
  }
  if (name === 'chase') {
    // Put Marco in a parked car, give him three stars and a job, then drive the road grid
    // with the police behind him: the cover shows the chase, the HUD and the objective at once.
    const parked = state.cars.find((car) => car.kind === 'parked');
    if (parked) {
      state.player.x = parked.x;
      state.player.y = parked.y;
      parked.kind = 'player';
      parked.speed = 0;
      state.player.onFoot = false;
      state.player.car = parked;
    }
    state.player.cash = 550;
    state.completedMissions = 3;
    startMission(state, 3);
    state.mission.step = 1;
    state.mission.target = { x: 600, y: 2200 };
    addWanted(state, 3);
    const drive = createDriver();
    for (let index = 0; index < CHASE_SECONDS / STEP; index += 1) {
      world.step(STEP, drive(state), 0);
      if (state.overReason) break;
    }
    return { screen: state.overReason ? SCREEN_OVER : SCREEN_PLAY, save: { cash: 550, missions: 3, bestCash: 550 } };
  }
  if (name === 'drive') {
    // Marco driving a stolen car to the garage on a quiet afternoon: no heat, just the city,
    // the traffic and the road ahead.
    const parked = state.cars.find((car) => car.kind === 'parked');
    if (parked) {
      state.player.x = parked.x;
      state.player.y = parked.y;
      parked.kind = 'player';
      parked.speed = 0;
      state.player.onFoot = false;
      state.player.car = parked;
    }
    state.player.cash = 200;
    startMission(state, 0);
    state.mission.step = 1;
    state.mission.target = { x: 600, y: 2200 };
    const drive = createDriver();
    for (let index = 0; index < DRIVE_SECONDS / STEP; index += 1) {
      world.step(STEP, drive(state), 0);
      if (state.overReason) break;
    }
    return { screen: SCREEN_PLAY, save: { cash: 200, missions: 0, bestCash: 200 } };
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
