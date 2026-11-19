// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 view is
// scaled to fit the window and centred, the margin filled with the backdrop colour. The camera
// follows the player through Solmar: roads and lane paint, pastel blocks with long afternoon
// shadows, the park, the beach and the sea, then the cars, the people and the HUD.
import { CAR, GARAGE, MISSIONS, PALETTE, PARK, PLAYER, RACE_START, ROADS_X, ROADS_Y, ROAD_W, STADIUM, VIEW, WORLD } from './config.js';
import { createText, drawHud } from './hud.js';
import { RACE_CHECKPOINTS } from './race.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const text = createText(context);

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  function inView(state, x, y, margin) {
    const camera = state.camera;
    return x > camera.x - VIEW.width / 2 - margin && x < camera.x + VIEW.width / 2 + margin
      && y > camera.y - VIEW.height / 2 - margin && y < camera.y + VIEW.height / 2 + margin;
  }

  function drawGround(state) {
    // Grass, then the beach sand and the sea along the south edge.
    context.fillStyle = PALETTE.grass;
    context.fillRect(0, 0, WORLD.width, WORLD.height);
    context.fillStyle = PALETTE.sand;
    context.fillRect(0, WORLD.beachY, WORLD.width, WORLD.height - WORLD.beachY);
    context.fillStyle = PALETTE.sea;
    context.fillRect(0, WORLD.seaY, WORLD.width, WORLD.height - WORLD.seaY);
    context.fillStyle = PALETTE.seaDeep;
    for (let x = 0; x < WORLD.width; x += 90) {
      const wave = Math.sin((x + state.time * 40) * 0.02) * 4;
      context.fillRect(x, WORLD.seaY + 18 + wave, 46, 3);
    }
    // Beach umbrellas: a row of bright dots on the sand.
    const umbrellaColors = ['#e5534b', '#f2c94c', '#4fc3f7', '#c77ddb'];
    for (let index = 0; index < 12; index += 1) {
      const x = 180 + index * 260;
      const y = WORLD.beachY + 46 + (index % 2) * 30;
      context.fillStyle = umbrellaColors[index % umbrellaColors.length];
      context.beginPath();
      context.arc(x, y, 12, 0, Math.PI * 2);
      context.fill();
    }
    // Palm trees along the beachfront boardwalk, between the road and the sand.
    for (let x = 120; x < WORLD.width; x += 200) {
      const y = WORLD.beachY - 12;
      context.strokeStyle = '#8a6f4d';
      context.lineWidth = 5;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + 4, y - 26);
      context.stroke();
      context.fillStyle = '#3f8f3a';
      context.beginPath();
      context.arc(x + 4, y - 30, 13, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5cb85c';
      context.beginPath();
      context.arc(x + 1, y - 33, 8, 0, Math.PI * 2);
      context.fill();
    }
    // The marina: wooden docks reaching into the sea with boats moored alongside.
    context.fillStyle = '#8a6f4d';
    for (let index = 0; index < 3; index += 1) {
      const dockX = 2720 + index * 170;
      context.fillRect(dockX, WORLD.seaY - 30, 18, 130);
    }
    for (let index = 0; index < 3; index += 1) {
      const boatX = 2690 + index * 170;
      const boatY = WORLD.seaY + 42 + (index % 2) * 26;
      context.fillStyle = ['#e8e2d4', '#f2c94c', '#4fc3f7'][index];
      context.beginPath();
      context.moveTo(boatX - 26, boatY);
      context.lineTo(boatX + 26, boatY);
      context.lineTo(boatX + 16, boatY + 14);
      context.lineTo(boatX - 16, boatY + 14);
      context.closePath();
      context.fill();
      context.strokeStyle = '#5d5348';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(boatX, boatY);
      context.lineTo(boatX, boatY - 30);
      context.stroke();
    }
    // The park: darker grass and a path.
    context.fillStyle = '#6d9c4e';
    context.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
    context.fillStyle = '#c9bfa9';
    context.fillRect(PARK.x + PARK.w / 2 - 8, PARK.y, 16, PARK.h);
    context.fillRect(PARK.x, PARK.y + PARK.h / 2 - 8, PARK.w, 16);
    // The stadium: a green field, an oval running track and its name on the grass.
    context.fillStyle = '#6d9c4e';
    context.fillRect(STADIUM.x, STADIUM.y, STADIUM.w, STADIUM.h);
    context.strokeStyle = '#c96f4a';
    context.lineWidth = 14;
    context.beginPath();
    context.ellipse(STADIUM.x + STADIUM.w / 2, STADIUM.y + STADIUM.h / 2, 120, 90, 0, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = '#5a8a3e';
    context.beginPath();
    context.ellipse(STADIUM.x + STADIUM.w / 2, STADIUM.y + STADIUM.h / 2, 96, 66, 0, 0, Math.PI * 2);
    context.fill();
    text('STADIUM', STADIUM.x + STADIUM.w / 2, STADIUM.y + STADIUM.h / 2 + 6, 22, 'rgba(245, 239, 224, 0.9)', 'center');
    // The Old Town pier: wooden boards reaching into the sea at the west end of the beach.
    context.fillStyle = '#8a6f4d';
    context.fillRect(160, WORLD.seaY - 40, 80, 130);
    context.fillStyle = '#a0805a';
    for (let y = WORLD.seaY - 40; y < WORLD.seaY + 80; y += 16) context.fillRect(160, y, 80, 4);
    text('OLD TOWN', 200, WORLD.seaY - 52, 13, 'rgba(90, 70, 40, 0.6)', 'center');
  }

  function drawRoads() {
    const half = ROAD_W / 2;
    // Sidewalks ring each road.
    context.fillStyle = PALETTE.sidewalk;
    for (const roadX of ROADS_X) context.fillRect(roadX - half - 14, 0, ROAD_W + 28, WORLD.beachY + 14);
    for (const roadY of ROADS_Y) context.fillRect(0, roadY - half - 14, WORLD.width, ROAD_W + 28);
    // Asphalt.
    context.fillStyle = PALETTE.road;
    for (const roadX of ROADS_X) context.fillRect(roadX - half, 0, ROAD_W, WORLD.beachY);
    for (const roadY of ROADS_Y) context.fillRect(0, roadY - half, WORLD.width, ROAD_W);
    // Centre dashes.
    context.fillStyle = PALETTE.lane;
    for (const roadX of ROADS_X) {
      for (let y = 20; y < WORLD.beachY; y += 56) context.fillRect(roadX - 2, y, 4, 28);
    }
    for (const roadY of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 56) context.fillRect(x, roadY - 2, 28, 4);
    }
    // Crosswalks at every intersection.
    context.fillStyle = PALETTE.crosswalk;
    for (const roadX of ROADS_X) {
      for (const roadY of ROADS_Y) {
        for (let index = 0; index < 5; index += 1) {
          context.fillRect(roadX - half + 6 + index * 12, roadY - half - 12, 6, 10);
          context.fillRect(roadX - half + 6 + index * 12, roadY + half + 2, 6, 10);
        }
      }
    }
  }

  function drawBuildings(state) {
    for (const building of state.city.buildings) {
      if (!inView(state, building.x + building.w / 2, building.y + building.h / 2, 200)) continue;
      // Long afternoon shadow, sun from the north-west.
      context.fillStyle = 'rgba(20, 16, 10, 0.28)';
      context.fillRect(building.x + 14, building.y + 16, building.w, building.h);
      context.fillStyle = building.color;
      context.fillRect(building.x, building.y, building.w, building.h);
      context.fillStyle = building.roof;
      context.fillRect(building.x + 10, building.y + 10, building.w - 20, building.h - 20);
      context.fillStyle = 'rgba(0, 0, 0, 0.18)';
      context.fillRect(building.x + 18, building.y + 18, 26, 18);
      context.fillRect(building.x + building.w - 44, building.y + building.h - 36, 26, 18);
      // Downtown towers (around Solmar Tower) read taller: lit window grids on the face.
      // At night every window in the city lights up.
      const downtown = building.x + building.w / 2 > 900 && building.x + building.w / 2 < 1900
        && building.y + building.h / 2 > 500 && building.y + building.h / 2 < 1100;
      if (downtown || state.night) {
        context.fillStyle = state.night ? 'rgba(255, 214, 120, 0.9)' : 'rgba(255, 240, 180, 0.75)';
        for (let wx = building.x + 22; wx < building.x + building.w - 18; wx += 26) {
          for (let wy = building.y + 22; wy < building.y + building.h - 18; wy += 26) {
            context.fillRect(wx, wy, 10, 12);
          }
        }
      }
      if (building.name) {
        text(building.name, building.x + building.w / 2, building.y + building.h / 2, 20, 'rgba(245, 239, 224, 0.85)', 'center');
      }
    }
    for (const tree of state.city.trees) {
      if (!inView(state, tree.x, tree.y, 40)) continue;
      context.fillStyle = 'rgba(20, 16, 10, 0.25)';
      context.beginPath();
      context.arc(tree.x + 5, tree.y + 6, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#4d7a3a';
      context.beginPath();
      context.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#6d9c4e';
      context.beginPath();
      context.arc(tree.x - 3, tree.y - 3, tree.r * 0.6, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCar(state, car) {
    if (!inView(state, car.x, car.y, 60)) return;
    const flashing = Math.floor(state.time * 4) % 2 === 0;
    const len = car.length || CAR.length;
    const half = len / 2;
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(20, 16, 10, 0.3)';
    context.fillRect(-half + 4, -CAR.width / 2 + 5, len, CAR.width);
    if (car.kind === 'police') {
      context.fillStyle = '#f5f5f5';
      context.fillRect(-half, -CAR.width / 2, len, CAR.width);
      context.fillStyle = '#222222';
      context.fillRect(-6, -CAR.width / 2, 12, CAR.width);
    } else {
      context.fillStyle = car.color;
      context.fillRect(-half, -CAR.width / 2, len, CAR.width);
    }
    // Windshield and rear window; a bus shows three windows down its side.
    context.fillStyle = 'rgba(30, 40, 55, 0.85)';
    context.fillRect(2, -CAR.width / 2 + 4, 12, CAR.width - 8);
    if (car.bus) {
      context.fillRect(-half + 8, -CAR.width / 2 + 4, 12, CAR.width - 8);
      context.fillRect(-14, -CAR.width / 2 + 4, 12, CAR.width - 8);
    }
    // Headlights at the front.
    context.fillStyle = 'rgba(245, 239, 224, 0.9)';
    context.fillRect(half - 4, -CAR.width / 2 + 3, 3, 5);
    context.fillRect(half - 4, CAR.width / 2 - 8, 3, 5);
    // Brake lights glow red while the driver is braking.
    if (car.braking) {
      context.fillStyle = '#ff3b30';
      context.fillRect(-half + 1, -CAR.width / 2 + 3, 3, 5);
      context.fillRect(-half + 1, CAR.width / 2 - 8, 3, 5);
    }
    // Four wheels at the corners.
    context.fillStyle = '#1a1a1a';
    context.fillRect(-half + 6, -CAR.width / 2 - 2, 10, 4);
    context.fillRect(-half + 6, CAR.width / 2 - 2, 10, 4);
    context.fillRect(half - 16, -CAR.width / 2 - 2, 10, 4);
    context.fillRect(half - 16, CAR.width / 2 - 2, 10, 4);
    if (car.kind === 'police') {
      context.fillStyle = flashing ? '#ff3b30' : '#3b82ff';
      context.fillRect(-4, -CAR.width / 2 - 2, 8, 5);
      context.fillStyle = flashing ? '#3b82ff' : '#ff3b30';
      context.fillRect(-4, CAR.width / 2 - 3, 8, 5);
    }
    if (car.kind === 'player') {
      context.fillStyle = PALETTE.gold;
      context.fillRect(-half + 4, -2, len - 8, 4);
    }
    context.restore();
    // A rival driver gets a name tag so the race reads at a glance.
    if (car.kind === 'rival') text('RIVAL', car.x, car.y - 26, 13, '#c77ddb', 'center');
    if (car.kind === 'player' && car.health < 40) {
      context.fillStyle = 'rgba(120, 120, 120, 0.5)';
      context.beginPath();
      context.arc(car.x - 10, car.y - 8, 6 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
    // A disabled cruiser smokes where it died.
    if (car.disabled) {
      context.fillStyle = 'rgba(120, 120, 120, 0.55)';
      context.beginPath();
      context.arc(car.x - 6 + Math.sin(state.time * 7) * 3, car.y - 10, 7 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
    // Headlight beams at night, for the player, the police and the rival.
    if (state.night && (car.kind === 'player' || car.kind === 'police' || car.kind === 'rival')) {
      const angle = car.angle;
      const fx = car.x + Math.cos(angle) * half;
      const fy = car.y + Math.sin(angle) * half;
      const tipX = fx + Math.cos(angle) * 90;
      const tipY = fy + Math.sin(angle) * 90;
      context.fillStyle = 'rgba(255, 240, 180, 0.10)';
      context.beginPath();
      context.moveTo(fx, fy);
      context.lineTo(tipX + Math.cos(angle + Math.PI / 2) * 26, tipY + Math.sin(angle + Math.PI / 2) * 26);
      context.lineTo(tipX + Math.cos(angle - Math.PI / 2) * 26, tipY + Math.sin(angle - Math.PI / 2) * 26);
      context.closePath();
      context.fill();
    }
  }

  function drawPed(state, ped) {
    if (!inView(state, ped.x, ped.y, 30)) return;
    const size = ped.size || 1;
    if (ped.fare) {
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ped.x, ped.y, 14, 0, Math.PI * 2);
      context.stroke();
    }
    if (ped.state === 'down') {
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(ped.x, ped.y, 11 * size, 6 * size, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(20, 16, 10, 0.3)';
    context.beginPath();
    context.ellipse(ped.x + 3, ped.y + 4, 9 * size, 6 * size, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 8 * size, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(ped.x, ped.y, 4 * size, 0, Math.PI * 2);
    context.fill();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (!player.onFoot) return;
    if (player.hurtCd > 0 && Math.floor(player.hurtCd * 10) % 2 === 0) return;
    context.fillStyle = 'rgba(20, 16, 10, 0.3)';
    context.beginPath();
    context.ellipse(player.x + 3, player.y + 4, 10, 7, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2ec4b6';
    context.beginPath();
    context.arc(player.x, player.y, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(player.x, player.y, 5, 0, Math.PI * 2);
    context.fill();
    // Facing tick, so the player can see which way Marco looks.
    context.strokeStyle = '#f5efe0';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(player.x + Math.cos(player.angle) * 8, player.y + Math.sin(player.angle) * 8);
    context.lineTo(player.x + Math.cos(player.angle) * 16, player.y + Math.sin(player.angle) * 16);
    context.stroke();
    if (player.armed) {
      context.fillStyle = '#222222';
      context.fillRect(player.x + Math.cos(player.angle) * 12 - 3, player.y + Math.sin(player.angle) * 12 - 2, 8, 4);
    }
  }

  function drawMissionMarker(state) {
    const mission = state.mission;
    if (!mission.active || !mission.target) return;
    const pulse = 1 + Math.sin(state.time * 5) * 0.15;
    const { x, y } = mission.target;
    context.save();
    context.globalAlpha = 0.25;
    context.fillStyle = PALETTE.gold;
    context.fillRect(x - 4, y - 220, 8, 220);
    context.restore();
    context.strokeStyle = PALETTE.gold;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(x, y, 26 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.gold;
    context.beginPath();
    context.moveTo(x, y - 14);
    context.lineTo(x + 12, y);
    context.lineTo(x, y + 14);
    context.lineTo(x - 12, y);
    context.closePath();
    context.fill();
  }

  function drawTaxiMarker(state) {
    const taxi = state.taxi;
    if (!taxi) return;
    if (taxi.waiting) {
      // A waving fare: a gold ring and a dollar sign the player can spot from the road.
      const pulse = 1 + Math.sin(state.time * 5) * 0.12;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(taxi.waiting.x, taxi.waiting.y, 22 * pulse, 0, Math.PI * 2);
      context.stroke();
      text('$', taxi.waiting.x, taxi.waiting.y - 26, 18, PALETTE.gold, 'center');
    }
    if (taxi.riding && taxi.dest) {
      const pulse = 1 + Math.sin(state.time * 5) * 0.15;
      context.strokeStyle = PALETTE.green;
      context.lineWidth = 3;
      context.beginPath();
      context.arc(taxi.dest.x, taxi.dest.y, 26 * pulse, 0, Math.PI * 2);
      context.stroke();
      context.fillStyle = PALETTE.green;
      context.beginPath();
      context.moveTo(taxi.dest.x, taxi.dest.y - 12);
      context.lineTo(taxi.dest.x + 10, taxi.dest.y);
      context.lineTo(taxi.dest.x, taxi.dest.y + 12);
      context.lineTo(taxi.dest.x - 10, taxi.dest.y);
      context.closePath();
      context.fill();
    }
    // The garage always shows its sign, so the shop is easy to find.
    text('GARAGE', GARAGE.x, GARAGE.y - 40, 16, PALETTE.gold, 'center');
  }

  /** The sun packages: pulsing gold stars the player can spot from the road. */
  function drawCollectibles(state) {
    for (const item of state.collectibles || []) {
      if (item.taken || !inView(state, item.x, item.y, 30)) continue;
      const pulse = 1 + Math.sin(state.time * 5 + item.x) * 0.15;
      context.strokeStyle = PALETTE.gold;
      context.lineWidth = 2;
      context.beginPath();
      context.arc(item.x, item.y, 14 * pulse, 0, Math.PI * 2);
      context.stroke();
      text('★', item.x, item.y + 7, 18, PALETTE.gold, 'center');
    }
  }

  /** The race start line, always visible, and the checkpoints while a race is on. */
  function drawRaceMarkers(state) {
    const race = state.race;
    const sx = RACE_START.x;
    const sy = RACE_START.y;
    if (inView(state, sx, sy, 60)) {
      for (let index = 0; index < 6; index += 1) {
        context.fillStyle = index % 2 === 0 ? '#f5f5f5' : '#222222';
        context.fillRect(sx - 8, sy - 30 + index * 10, 16, 10);
      }
      text('START', sx, sy - 40, 13, PALETTE.gold, 'center');
    }
    if (!race || !race.active) return;
    for (let index = race.index; index < RACE_CHECKPOINTS.length; index += 1) {
      const point = RACE_CHECKPOINTS[index];
      if (!inView(state, point.x, point.y, 60)) continue;
      const current = index === race.index;
      const pulse = 1 + Math.sin(state.time * 5) * 0.12;
      context.strokeStyle = current ? PALETTE.gold : 'rgba(242, 201, 76, 0.5)';
      context.lineWidth = current ? 4 : 2;
      context.beginPath();
      context.arc(point.x, point.y, 30 * pulse, 0, Math.PI * 2);
      context.stroke();
      text(String(index + 1), point.x, point.y + 6, 18, current ? PALETTE.gold : 'rgba(245, 239, 224, 0.7)', 'center');
    }
  }

  /** A five-star roadblock: striped bars on the parked cruisers, and a warning label. */
  function drawRoadblock(state) {
    const block = state.roadblock;
    if (!block || !inView(state, block.x, block.y, 80)) return;
    for (const car of block.cars) {
      if (!inView(state, car.x, car.y, 40)) continue;
      context.save();
      context.translate(car.x, car.y);
      context.rotate(car.angle);
      for (let index = 0; index < 6; index += 1) {
        context.fillStyle = index % 2 === 0 ? '#ff3b30' : '#f5f5f5';
        context.fillRect(-30 + index * 10, -3, 10, 6);
      }
      context.restore();
    }
    text('ROADBLOCK', block.x, block.y - 46, 15, PALETTE.red, 'center');
  }

  function drawWorld(state) {
    context.save();
    context.translate(VIEW.width / 2 - state.camera.x, VIEW.height / 2 - state.camera.y);
    drawGround(state);
    drawRoads();
    drawBuildings(state);
    // Streetlight pools at every intersection after dark.
    if (state.night) {
      for (const roadX of ROADS_X) {
        for (const roadY of ROADS_Y) {
          if (!inView(state, roadX, roadY, 80)) continue;
          context.fillStyle = 'rgba(255, 214, 120, 0.08)';
          context.beginPath();
          context.arc(roadX, roadY, 70, 0, Math.PI * 2);
          context.fill();
          context.fillStyle = 'rgba(255, 230, 160, 0.9)';
          context.beginPath();
          context.arc(roadX, roadY, 4, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
    for (const pickup of state.pickups) {
      if (!pickup.active || !inView(state, pickup.x, pickup.y, 30)) continue;
      const bob = Math.sin(state.time * 4 + pickup.x) * 3;
      context.fillStyle = PALETTE.green;
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 10, 0, Math.PI * 2);
      context.fill();
      text('$', pickup.x, pickup.y + bob + 5, 14, '#12351a', 'center');
    }
    drawMissionMarker(state);
    drawTaxiMarker(state);
    drawCollectibles(state);
    drawRaceMarkers(state);
    drawRoadblock(state);
    for (const car of state.cars) drawCar(state, car);
    for (const ped of state.peds) drawPed(state, ped);
    drawPlayer(state);
    for (const bullet of state.bullets) {
      context.strokeStyle = 'rgba(255, 230, 109, 0.8)';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(bullet.px ?? bullet.x, bullet.py ?? bullet.y);
      context.lineTo(bullet.x, bullet.y);
      context.stroke();
      context.fillStyle = '#ffe66d';
      context.beginPath();
      context.arc(bullet.x, bullet.y, 3, 0, Math.PI * 2);
      context.fill();
    }
    for (const particle of state.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    context.restore();
    if (state.night) {
      // Night: a deep blue wash over the city, streetlights already glowing below.
      context.fillStyle = 'rgba(10, 16, 40, 0.42)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const vignette = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(4, 6, 16, 0.35)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    } else {
      // Golden afternoon light over everything, with a soft vignette.
      const light = context.createLinearGradient(0, 0, 0, VIEW.height);
      light.addColorStop(0, 'rgba(255, 190, 90, 0.10)');
      light.addColorStop(0.6, 'rgba(255, 190, 90, 0.03)');
      light.addColorStop(1, 'rgba(255, 150, 60, 0.08)');
      context.fillStyle = light;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const vignette = context.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.85);
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vignette.addColorStop(1, 'rgba(10, 8, 4, 0.22)');
      context.fillStyle = vignette;
      context.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function drawPanel(title, lines, prompt, accent) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = accent || 'rgba(245, 239, 224, 0.25)';
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 52, accent || PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  /** Paint one frame: the city, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, save) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawWorld(state);
    if (screen === SCREEN_TITLE) {
      context.fillStyle = 'rgba(12, 10, 6, 0.45)';
      context.fillRect(0, 0, VIEW.width, VIEW.height);
      const lines = [
        'Marco Solano is back in Solmar, and Lena Cruz has work for him.',
        'Steal cars, outrun the police, run the jobs — own the city.',
        '',
        'WASD move · Shift run · E enter or steal a car · F punch',
        'Mouse aim, click to shoot when armed · P pause · M mission · E taxi fare',
        'Space handbrake · H horn · 9 missions · street races · 12 sun packages',
        'Day turns to night — fares pay double after dark',
        '',
        `Saved: $${save.cash} · ${save.missions} of ${MISSIONS.length} missions done · Best cash $${save.bestCash}`,
      ];
      drawPanel('SOLMAR', lines, 'Press Enter or click to play', PALETTE.gold);
      // The tagline sits below the panel, clear of the save line inside it.
      const panelHeight = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
      text('Streets of Sun — an open-world crime game', VIEW.width / 2, VIEW.height / 2 + panelHeight / 2 + 28, 20, PALETTE.text, 'center');
      return;
    }
    drawHud(context, state, state.camera);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city will wait for you.', 'WASD move · E car · F punch · P resume'], 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      const busted = state.overReason === 'busted';
      const lines = [
        busted ? 'The Solmar police caught up with Marco.' : 'Marco went down in the streets of Solmar.',
        `Cash $${state.player.cash} · Missions ${state.completedMissions} of ${MISSIONS.length}`,
        'Your save keeps your cash and missions.',
      ];
      drawPanel(busted ? 'BUSTED' : 'WASTED', lines, 'Press Enter to try again', PALETTE.red);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, view };
}
