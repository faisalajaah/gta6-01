// The heads-up display: cash and health, the wanted stars, the mission objective, the speed,
// the toasts and the minimap. Drawn in screen space after the world, so it never scrolls.
import { FONT, MISSIONS, PALETTE, PARK, VIEW, WORLD } from './config.js';
import { missionText } from './missions.js';

/** A cached canvas text writer: one font string per size, reused every frame. */
export function createText(context) {
  const fonts = new Map();
  return function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  };
}

const MINIMAP = { width: 190, height: 148, margin: 16 };

function drawStars(context, text, wanted, x, y) {
  let stars = '';
  for (let index = 0; index < 5; index += 1) stars += index < wanted ? '★' : '☆';
  text(stars, x, y, 30, wanted > 0 ? PALETTE.red : PALETTE.muted, 'center');
}

function drawMinimap(context, state) {
  const x0 = VIEW.width - MINIMAP.width - MINIMAP.margin;
  const y0 = MINIMAP.margin;
  const scaleX = (MINIMAP.width - 8) / WORLD.width;
  const scaleY = (MINIMAP.height - 8) / WORLD.height;
  context.fillStyle = PALETTE.panel;
  context.fillRect(x0, y0, MINIMAP.width, MINIMAP.height);
  context.save();
  context.beginPath();
  context.rect(x0 + 4, y0 + 4, MINIMAP.width - 8, MINIMAP.height - 8);
  context.clip();
  const toMapX = (x) => x0 + 4 + x * scaleX;
  const toMapY = (y) => y0 + 4 + y * scaleY;
  // The beach and the sea along the south edge.
  context.fillStyle = '#3fa7c4';
  context.fillRect(x0 + 4, toMapY(2320), MINIMAP.width - 8, MINIMAP.height - 8 - (toMapY(2320) - y0 - 4));
  context.fillStyle = '#e8cf9a';
  context.fillRect(x0 + 4, toMapY(2200), MINIMAP.width - 8, toMapY(2320) - toMapY(2200));
  // Roads as pale lines.
  context.strokeStyle = '#8a8378';
  context.lineWidth = 2;
  for (const roadX of [200, 600, 1000, 1400, 1800, 2200, 2600, 3000]) {
    context.beginPath();
    context.moveTo(toMapX(roadX), toMapY(0));
    context.lineTo(toMapX(roadX), toMapY(2200));
    context.stroke();
  }
  for (const roadY of [200, 600, 1000, 1400, 1800, 2200]) {
    context.beginPath();
    context.moveTo(toMapX(0), toMapY(roadY));
    context.lineTo(toMapX(3200), toMapY(roadY));
    context.stroke();
  }
  // Buildings as blocks, the park as green.
  context.fillStyle = '#5d5348';
  for (const building of state.city.buildings) {
    context.fillRect(toMapX(building.x), toMapY(building.y), Math.max(1, building.w * scaleX), Math.max(1, building.h * scaleY));
  }
  context.fillStyle = '#4d7a3a';
  context.fillRect(toMapX(PARK.x), toMapY(PARK.y), PARK.w * scaleX, PARK.h * scaleY);
  // The mission target, the police and the player.
  const mission = state.mission;
  if (mission.active && mission.target) {
    context.fillStyle = PALETTE.gold;
    const tx = toMapX(mission.target.x);
    const ty = toMapY(mission.target.y);
    context.beginPath();
    context.moveTo(tx, ty - 5);
    context.lineTo(tx + 5, ty);
    context.lineTo(tx, ty + 5);
    context.lineTo(tx - 5, ty);
    context.closePath();
    context.fill();
  }
  for (const car of state.cars) {
    if (car.kind !== 'police') continue;
    context.fillStyle = '#ff5a4e';
    context.fillRect(toMapX(car.x) - 2, toMapY(car.y) - 2, 4, 4);
  }
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.arc(toMapX(state.player.x), toMapY(state.player.y), 3.5, 0, Math.PI * 2);
  context.fill();
  context.restore();
  context.strokeStyle = 'rgba(245, 239, 224, 0.5)';
  context.lineWidth = 1;
  context.strokeRect(x0, y0, MINIMAP.width, MINIMAP.height);
}

function drawObjectiveArrow(context, text, state, camera) {
  const mission = state.mission;
  if (!mission.active || !mission.target) return;
  const screenX = mission.target.x - camera.x + VIEW.width / 2;
  const screenY = mission.target.y - camera.y + VIEW.height / 2;
  if (screenX > 0 && screenX < VIEW.width && screenY > 0 && screenY < VIEW.height) return;
  const dx = mission.target.x - state.player.x;
  const dy = mission.target.y - state.player.y;
  const angle = Math.atan2(dy, dx);
  const edgeX = VIEW.width / 2 + Math.cos(angle) * 420;
  const edgeY = VIEW.height / 2 + Math.sin(angle) * 240;
  const clampedX = Math.max(30, Math.min(VIEW.width - 30, edgeX));
  const clampedY = Math.max(90, Math.min(VIEW.height - 40, edgeY));
  context.save();
  context.translate(clampedX, clampedY);
  context.rotate(angle);
  context.fillStyle = PALETTE.gold;
  context.beginPath();
  context.moveTo(16, 0);
  context.lineTo(-10, -11);
  context.lineTo(-10, 11);
  context.closePath();
  context.fill();
  context.restore();
  const dist = Math.round(Math.hypot(dx, dy));
  text(`${dist}m`, clampedX, clampedY + 30, 15, PALETTE.gold, 'center');
}

/** Paint the HUD over the world: panels, stars, objective, speed, toasts and minimap. */
export function drawHud(context, state, camera) {
  const text = createText(context);
  const player = state.player;
  // Top-left panel: cash, health, missions done.
  context.fillStyle = PALETTE.panel;
  context.fillRect(16, 16, 250, 92);
  text(`$${player.cash}`, 30, 48, 28, PALETTE.gold, 'left');
  text(`Missions ${state.completedMissions}/${MISSIONS.length}`, 30, 76, 16, PALETTE.muted, 'left');
  context.fillStyle = '#3a2a2a';
  context.fillRect(30, 86, 150, 10);
  context.fillStyle = player.health > 30 ? PALETTE.green : PALETTE.red;
  context.fillRect(30, 86, 150 * (player.health / 100), 10);
  text('HP', 188, 96, 14, PALETTE.text, 'left');
  if (player.armed) text(`Pistol ${player.ammo}`, 30, 100, 14, PALETTE.blue, 'left');
  // Wanted stars, top centre.
  drawStars(context, text, state.wanted, VIEW.width / 2, 52);
  // Mission objective under the stars.
  const objective = missionText(state);
  if (objective) {
    const width = Math.min(560, 24 + objective.length * 8.4);
    context.fillStyle = PALETTE.panel;
    context.fillRect(VIEW.width / 2 - width / 2, 62, width, 34);
    text(objective, VIEW.width / 2, 86, 17, PALETTE.text, 'center');
  }
  drawObjectiveArrow(context, text, state, camera);
  // Speed and car health while driving, bottom left.
  if (!player.onFoot && player.car) {
    const kmh = Math.round(Math.abs(player.car.speed) * 0.36);
    context.fillStyle = PALETTE.panel;
    context.fillRect(16, VIEW.height - 96, 200, 80);
    text(`${kmh} km/h`, 30, VIEW.height - 58, 30, PALETTE.text, 'left');
    context.fillStyle = '#3a2a2a';
    context.fillRect(30, VIEW.height - 44, 150, 8);
    context.fillStyle = player.car.health > 30 ? PALETTE.green : PALETTE.red;
    context.fillRect(30, VIEW.height - 44, 150 * (player.car.health / 100), 8);
    text('CAR', 188, VIEW.height - 34, 13, PALETTE.text, 'left');
  }
  // Controls hint, bottom centre.
  text('WASD move · Shift run · E enter car · F punch · Click shoot · P pause', VIEW.width / 2, VIEW.height - 14, 14, PALETTE.muted, 'center');
  // Toasts, top centre under the objective.
  let toastY = 116;
  for (const toast of state.toasts) {
    const width = Math.min(560, 24 + toast.text.length * 8.4);
    context.fillStyle = 'rgba(12, 14, 20, 0.6)';
    context.fillRect(VIEW.width / 2 - width / 2, toastY, width, 30);
    text(toast.text, VIEW.width / 2, toastY + 21, 16, PALETTE.gold, 'center');
    toastY += 36;
  }
  drawMinimap(context, state);
}
