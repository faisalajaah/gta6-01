// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 view is
// scaled to fit the window and centred, the margin filled with the backdrop colour. The camera
// follows the player through Solmar: roads and lane paint, pastel blocks with long afternoon
// shadows, the park, the beach and the sea, then the cars, the people and the HUD.
import { CAR, GARAGE, MISSIONS, PALETTE, PARK, PLAYER, ROADS_X, ROADS_Y, ROAD_W, VIEW, WORLD } from './config.js';
import { createText, drawHud } from './hud.js';

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
      const downtown = building.x + building.w / 2 > 900 && building.x + building.w / 2 < 1900
        && building.y + building.h / 2 > 500 && building.y + building.h / 2 < 1100;
      if (downtown) {
        context.fillStyle = 'rgba(255, 240, 180, 0.75)';
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
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(20, 16, 10, 0.3)';
    context.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 5, CAR.length, CAR.width);
    if (car.kind === 'police') {
      context.fillStyle = '#f5f5f5';
      context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
      context.fillStyle = '#222222';
      context.fillRect(-6, -CAR.width / 2, 12, CAR.width);
    } else {
      context.fillStyle = car.color;
      context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
    }
    context.fillStyle = 'rgba(30, 40, 55, 0.85)';
    context.fillRect(-6, -CAR.width / 2 + 4, 14, CAR.width - 8);
    context.fillStyle = 'rgba(245, 239, 224, 0.9)';
    context.fillRect(CAR.length / 2 - 4, -CAR.width / 2 + 3, 3, 5);
    context.fillRect(CAR.length / 2 - 4, CAR.width / 2 - 8, 3, 5);
    if (car.kind === 'police') {
      context.fillStyle = flashing ? '#ff3b30' : '#3b82ff';
      context.fillRect(-4, -CAR.width / 2 - 2, 8, 5);
      context.fillStyle = flashing ? '#3b82ff' : '#ff3b30';
      context.fillRect(-4, CAR.width / 2 - 3, 8, 5);
    }
    if (car.kind === 'player') {
      context.fillStyle = PALETTE.gold;
      context.fillRect(-CAR.length / 2 + 4, -2, CAR.length - 8, 4);
    }
    context.restore();
    if (car.kind === 'player' && car.health < 40) {
      context.fillStyle = 'rgba(120, 120, 120, 0.5)';
      context.beginPath();
      context.arc(car.x - 10, car.y - 8, 6 + Math.sin(state.time * 9) * 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPed(state, ped) {
    if (!inView(state, ped.x, ped.y, 30)) return;
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
      context.ellipse(ped.x, ped.y, 11, 6, ped.angle, 0, Math.PI * 2);
      context.fill();
      return;
    }
    context.fillStyle = 'rgba(20, 16, 10, 0.3)';
    context.beginPath();
    context.ellipse(ped.x + 3, ped.y + 4, 9, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(ped.x, ped.y, 8, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(ped.x, ped.y, 4, 0, Math.PI * 2);
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

  function drawWorld(state) {
    context.save();
    context.translate(VIEW.width / 2 - state.camera.x, VIEW.height / 2 - state.camera.y);
    drawGround(state);
    drawRoads();
    drawBuildings(state);
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
    for (const car of state.cars) drawCar(state, car);
    for (const ped of state.peds) drawPed(state, ped);
    drawPlayer(state);
    for (const bullet of state.bullets) {
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
        'Garage: R repair $150 · B sport car $800 · Taxi fares pay cash',
        '',
        `Saved: $${save.cash} · ${save.missions} of ${MISSIONS.length} missions done · Best cash $${save.bestCash}`,
      ];
      drawPanel('SOLMAR', lines, 'Press Enter or click to play', PALETTE.gold);
      text('Streets of Sun — an open-world crime game', VIEW.width / 2, VIEW.height / 2 + 150, 20, PALETTE.text, 'center');
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
