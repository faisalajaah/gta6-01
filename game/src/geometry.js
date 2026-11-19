// Pure geometry and road-network helpers: no state, no drawing, no browser. The world, the
// cars and the pedestrians all ask these questions about the city grid.
import { GRID, ROAD_W, ROADS_X, ROADS_Y, WORLD } from './config.js';

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

/** Linear interpolation: `lerp(0, 10, 0.25)` is 2.5. */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Smoothstep: 0 below `edge0`, 1 above `edge1`, eased between them. */
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function distance(x1, y1, x2, y2) {
  return Math.hypot(x2 - x1, y2 - y1);
}

/** The squared distance, for comparing distances without a square root. */
export function distanceSquared(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return dx * dx + dy * dy;
}

/** The shortest turn from `from` to `to`, in (-PI, PI]. */
export function angleDifference(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the circle at (x, y) with radius r overlaps the rectangle. */
export function circleHitsRect(x, y, r, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy < r * r;
}

/** Push a circle out of a rectangle it overlaps; returns the corrected position. */
export function pushCircleOutOfRect(x, y, r, rect) {
  const nearestX = clamp(x, rect.x, rect.x + rect.w);
  const nearestY = clamp(y, rect.y, rect.y + rect.h);
  let dx = x - nearestX;
  let dy = y - nearestY;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return { x, y, hit: false };
  if (d2 === 0) {
    // The centre is inside the rectangle: push out through the nearest side.
    const left = x - rect.x;
    const right = rect.x + rect.w - x;
    const top = y - rect.y;
    const bottom = rect.y + rect.h - y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) return { x: rect.x - r, y, hit: true };
    if (min === right) return { x: rect.x + rect.w + r, y, hit: true };
    if (min === top) return { x, y: rect.y - r, hit: true };
    return { x, y: rect.y + rect.h + r, hit: true };
  }
  const d = Math.sqrt(d2);
  dx /= d;
  dy /= d;
  return { x: nearestX + dx * r, y: nearestY + dy * r, hit: true };
}

/**
 * Move a circle by (dx, dy) one axis at a time, sliding along building rectangles instead of
 * sticking to them. Returns whether either axis was blocked.
 */
export function moveCircle(buildings, entity, dx, dy, r) {
  // A circle already overlapping a building (wedged into a corner by a bump) is pushed out
  // first: without this, every step's move stays overlapping and the circle can never escape.
  for (const building of buildings) {
    if (circleHitsRect(entity.x, entity.y, r, building)) {
      const out = pushCircleOutOfRect(entity.x, entity.y, r, building);
      entity.x = out.x;
      entity.y = out.y;
    }
  }
  let blocked = false;
  let nextX = clamp(entity.x + dx, r, WORLD.width - r);
  for (const building of buildings) {
    if (circleHitsRect(nextX, entity.y, r, building)) {
      nextX = entity.x;
      blocked = true;
      break;
    }
  }
  entity.x = nextX;
  let nextY = clamp(entity.y + dy, r, WORLD.height - r);
  for (const building of buildings) {
    if (circleHitsRect(entity.x, nextY, r, building)) {
      nextY = entity.y;
      blocked = true;
      break;
    }
  }
  entity.y = nextY;
  return blocked;
}

/** True when the point is on a road (asphalt), including intersections. */
export function onRoad(x, y) {
  const half = ROAD_W / 2;
  for (const roadX of ROADS_X) if (Math.abs(x - roadX) <= half && y <= WORLD.beachY) return true;
  for (const roadY of ROADS_Y) if (Math.abs(y - roadY) <= half) return true;
  return false;
}

/** True when the point is on a sidewalk ring around a road. */
export function onSidewalk(x, y) {
  const half = ROAD_W / 2 + 14;
  const inner = ROAD_W / 2;
  for (const roadX of ROADS_X) {
    const d = Math.abs(x - roadX);
    if (d > inner && d <= half && y <= WORLD.beachY) return true;
  }
  for (const roadY of ROADS_Y) {
    const d = Math.abs(y - roadY);
    if (d > inner && d <= half) return true;
  }
  return false;
}

/** The nearest point on the road network to (x, y), for spawning cars and police. */
export function nearestRoadPoint(x, y) {
  let best = { x: ROADS_X[0], y: clamp(y, 0, WORLD.beachY) };
  let bestD2 = Infinity;
  for (const roadX of ROADS_X) {
    const point = { x: roadX, y: clamp(y, 0, WORLD.beachY) };
    const d2 = distanceSquared(x, y, point.x, point.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = point;
    }
  }
  for (const roadY of ROADS_Y) {
    const point = { x: clamp(x, 0, WORLD.width), y: roadY };
    const d2 = distanceSquared(x, y, point.x, point.y);
    if (d2 < bestD2) {
      bestD2 = d2;
      best = point;
    }
  }
  return best;
}

/** The road centreline nearest (x, y): axis 'x' means a vertical road at that x. */
export function nearestRoad(x, y) {
  let axis = 'x';
  let coord = ROADS_X[0];
  let bestD = Math.abs(x - ROADS_X[0]);
  for (const roadX of ROADS_X) {
    if (Math.abs(x - roadX) < bestD) {
      bestD = Math.abs(x - roadX);
      coord = roadX;
    }
  }
  let bestY = Math.abs(y - ROADS_Y[0]);
  let coordY = ROADS_Y[0];
  for (const roadY of ROADS_Y) {
    if (Math.abs(y - roadY) < bestY) {
      bestY = Math.abs(y - roadY);
      coordY = roadY;
    }
  }
  if (bestY < bestD) {
    axis = 'y';
    coord = coordY;
  }
  return { axis, coord };
}

/** True when (x, y) is near a crossing road's centreline, where a car may turn. */
export function atIntersection(x, y) {
  const near = 14;
  for (const roadX of ROADS_X) if (Math.abs(x - roadX) <= near) {
    for (const roadY of ROADS_Y) if (Math.abs(y - roadY) <= near) return true;
  }
  return false;
}

/** The grid cell (block) containing a point, for placing buildings. */
export function blockOf(x, y) {
  return { bx: Math.floor(x / GRID), by: Math.floor(y / GRID) };
}
