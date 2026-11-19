// Combat on foot: punching the nearest person or cruiser, and shooting the pistol toward the
// mouse. Bullets fly straight, spark on buildings and hurt pedestrians and police cruisers.
import { CAR, PLAYER } from './config.js';
import { circleHitsRect, distance } from './geometry.js';
import { burst } from './world.js';

const BULLET_SPEED = 900;
const BULLET_LIFE = 0.8;
const BULLET_PED_DAMAGE = 50;
const BULLET_CAR_DAMAGE = 20;

/**
 * Punch whatever is closest in front of the player: a pedestrian goes down, a cruiser takes
 * damage. Returns true when something was hit.
 */
export function punch(state) {
  const player = state.player;
  const reach = PLAYER.punchRange + 14;
  let best = null;
  let bestD = reach;
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    const d = distance(player.x, player.y, ped.x, ped.y);
    if (d < bestD) {
      bestD = d;
      best = { kind: 'ped', target: ped };
    }
  }
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    const d = distance(player.x, player.y, car.x, car.y);
    if (d < bestD + 10) {
      bestD = d;
      best = { kind: 'car', target: car };
    }
  }
  if (!best) return false;
  if (best.kind === 'ped') {
    best.target.state = 'down';
    best.target.downTimer = 3;
    burst(state, best.target.x, best.target.y, '#f2c94c', 8, 120);
  } else {
    best.target.health -= 10;
    burst(state, best.target.x, best.target.y, '#f2c94c', 8, 120);
  }
  return true;
}

/** Fire one pistol round from the player toward a world point. */
export function shoot(state, targetX, targetY) {
  const player = state.player;
  const angle = Math.atan2(targetY - player.y, targetX - player.x);
  const muzzleX = player.x + Math.cos(angle) * 18;
  const muzzleY = player.y + Math.sin(angle) * 18;
  // A short muzzle flash at the barrel, so a shot reads even at a glance.
  burst(state, muzzleX, muzzleY, '#ffd166', 4, 90);
  state.bullets.push({
    x: muzzleX,
    y: muzzleY,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_LIFE,
  });
}

function bulletHitsCar(state, bullet) {
  for (const car of state.cars) {
    if (distance(bullet.x, bullet.y, car.x, car.y) < CAR.radius) {
      car.health -= BULLET_CAR_DAMAGE;
      burst(state, bullet.x, bullet.y, '#f2c94c', 6, 100);
      return true;
    }
  }
  return false;
}

function bulletHitsPed(state, bullet) {
  for (const ped of state.peds) {
    if (ped.state === 'down') continue;
    if (distance(bullet.x, bullet.y, ped.x, ped.y) < 14) {
      ped.state = 'down';
      ped.downTimer = 4;
      burst(state, ped.x, ped.y, '#e5534b', 10, 140);
      return true;
    }
  }
  return false;
}

export function updateBullets(state, dt) {
  for (let index = state.bullets.length - 1; index >= 0; index -= 1) {
    const bullet = state.bullets[index];
    bullet.life -= dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    let dead = bullet.life <= 0;
    if (!dead) {
      for (const building of state.city.buildings) {
        if (circleHitsRect(bullet.x, bullet.y, 2, building)) {
          burst(state, bullet.x, bullet.y, '#e8e2d4', 4, 80);
          dead = true;
          break;
        }
      }
    }
    if (!dead) dead = bulletHitsCar(state, bullet) || bulletHitsPed(state, bullet);
    if (dead) state.bullets.splice(index, 1);
  }
  return 0;
}
