// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { MISSIONS, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_FARE, EVENT_HIT, EVENT_MISSION, EVENT_OVER, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT } from './world.js';
import { ACTION_CONFIRM, ACTION_MISSION, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { addToast, missionText, startMission } from './missions.js';
import { createCar } from './vehicles.js';
import { policeNear } from './police.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
// The live world, for automated play-testing and debugging from the console.
window.__solmar = world;
const renderer = createRenderer(canvas);
const audio = createAudio();

function readSave() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      return {
        cash: Number(saved.cash) || 0,
        missions: Number(saved.missions) || 0,
        bestCash: Number(saved.bestCash) || 0,
        sport: saved.sport === true,
      };
    }
  } catch {
    // Storage can be off (private windows): the save then lasts this visit only.
  }
  return { cash: 0, missions: 0, bestCash: 0, sport: false };
}

function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage can be off: the save then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function applySave() {
    const state = world.state;
    state.player.cash = save.cash;
    state.completedMissions = Math.min(save.missions, MISSIONS.length);
    if (save.missions >= MISSIONS.length) {
      state.mission.done = true;
      state.mission.active = false;
    } else {
      startMission(state, save.missions);
    }
    if (save.missions >= 2) {
      state.player.armed = true;
      state.player.ammo = 24;
    }
    if (save.sport && !state.player.sportOwned) {
      state.player.sportOwned = true;
      const sport = createCar(state, 690, 2180, 0, 'parked', '#f2c94c');
      sport.sport = true;
      state.cars.push(sport);
    }
  }

  function saveProgress() {
    save = {
      cash: world.state.player.cash,
      missions: world.state.completedMissions,
      bestCash: Math.max(save.bestCash, world.state.player.cash),
      sport: world.state.player.sportOwned,
    };
    writeSave(save);
  }

  function startGame() {
    world.reset();
    applySave();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.unlock();
    audio.startMusic();
    announce('Playing. Marco is in Solmar.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    saveProgress();
    audio.busted();
    announce(world.state.overReason === 'busted' ? 'Busted. The police caught Marco.' : 'Wasted. Marco went down.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      audio.click();
      startGame();
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    if (actions & ACTION_MISSION && screen === SCREEN_PLAY) {
      addToast(world.state, missionText(world.state));
    }
    return actions;
  }

  /** The mouse position in world units, for aiming the pistol. */
  function mouseWorld() {
    const ratio = window.devicePixelRatio || 1;
    const logicalX = (input.mouse.x * ratio - renderer.view.x) / renderer.view.scale;
    const logicalY = (input.mouse.y * ratio - renderer.view.y) / renderer.view.scale;
    const camera = world.state.camera;
    return {
      x: logicalX + camera.x - 640,
      y: logicalY + camera.y - 360,
    };
  }

  function step(actions) {
    const controls = input.controls();
    if (controls.shoot) {
      const mouse = mouseWorld();
      controls.shootX = mouse.x;
      controls.shootY = mouse.y;
    }
    const events = world.step(STEP, controls, screen === SCREEN_PLAY ? actions : 0);
    if (events & EVENT_MISSION) {
      audio.missionDone();
      saveProgress();
    }
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_HIT) audio.hit();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_FARE) audio.farePaid();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_OVER) endGame();
    audio.engine(world.state.player.onFoot ? 0 : Math.abs(world.state.player.speed));
    audio.siren(policeNear(world.state), STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    let actions = handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0, run: false, shoot: false, shootX: 0, shootY: 0 }, 0);
        accumulator -= STEP;
      }
      // The title screen slowly pans across the city behind the panel.
      world.state.camera.x = 1000 + Math.sin(world.state.time * 0.06) * 500;
      world.state.camera.y = 1200 + Math.cos(world.state.time * 0.04) * 300;
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        step(actions);
        // One-shot presses count once, even when a slow frame catches up on several steps:
        // without this, E would enter and leave a car in the same frame.
        actions = 0;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) break;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, save);
  }

  // Leaving the tab pauses a running game rather than letting the police catch Marco unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Solmar. Press Enter or click to play.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
