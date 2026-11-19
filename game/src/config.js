// Every tuning number and colour in one place. The view is a fixed 1280x720 logical area;
// the renderer scales it to the window, so no rule below depends on the screen size.
// Solmar is a fictional sun-soaked coastal city: warm sand, pastel blocks, a beach and a marina.
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The city is 3200 by 2400 world units. Roads run on a 400-unit grid; the beach is the south strip. */
export const WORLD = { width: 3200, height: 2400, beachY: 2200, seaY: 2320 };
export const ROADS_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];
export const ROAD_W = 64;
export const GRID = 400;

/** The blocks between the roads: each [from, to] is the gap between two road edges. */
export const BLOCK_X = [[0, 168], [232, 568], [632, 968], [1032, 1368], [1432, 1768], [1832, 2168], [2232, 2568], [2632, 2968], [3032, 3200]];
export const BLOCK_Y = [[0, 168], [232, 568], [632, 968], [1032, 1368], [1432, 1768], [1832, 2168]];

/** The park block, between roads x 1400..1800 and y 1000..1400, holds trees instead of buildings. */
export const PARK = { x: 1444, y: 1044, w: 312, h: 312 };

export const PLAYER = {
  radius: 12,
  walkSpeed: 205,
  runSpeed: 335,
  health: 100,
  punchRange: 34,
  punchDamage: 34,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  pistolAmmo: 24,
};

export const CAR = {
  length: 46,
  width: 22,
  radius: 17,
  accel: 300,
  brake: 520,
  reverseAccel: 200,
  maxSpeed: 540,
  maxReverse: 170,
  turnRate: 4.0,
  /** Extra turn and drag while the handbrake (Space) is held: tighter, dustier corners. */
  handbrakeTurn: 1.6,
  handbrakeDrag: 1.4,
  drag: 0.55,
  health: 100,
};

export const TRAFFIC = {
  count: 26,
  speedMin: 110,
  speedMax: 185,
  turnChance: 0.45,
};

export const PEDS = { count: 34, speedMin: 45, speedMax: 80 };

export const POLICE = {
  maxCars: 5,
  chaseSpeed: 560,
  ramDamage: 12,
  ramCooldown: 0.8,
  bustDistance: 48,
  bustTime: 1.2,
  spawnDistance: 520,
  /** At five stars the police block the road ahead of the player, once per heat. */
  roadblockStars: 5,
};

export const WANTED = {
  max: 5,
  steal: 1,
  hitPed: 1,
  punchPed: 1,
  shoot: 1,
  hitPolice: 2,
  crimeFreeSeconds: 20,
  decaySeconds: 8,
};

export const MISSIONS = [
  { id: 'first-wheels', title: 'First Wheels', reward: 200 },
  { id: 'sunset-courier', title: 'Sunset Courier', reward: 350 },
  { id: 'shake-the-heat', title: 'Shake the Heat', reward: 500 },
  { id: 'marina-job', title: 'The Marina Job', reward: 800 },
  { id: 'palms-heist', title: 'Palms Heist', reward: 1000 },
  { id: 'tower-run', title: 'Tower Run', reward: 1200 },
  { id: 'the-getaway', title: 'The Getaway', reward: 1400 },
  { id: 'street-king', title: 'Street King', reward: 1600 },
  { id: 'the-last-job', title: 'The Last Job', reward: 2000 },
];

/** Landmark spots the missions and the garage use. */
export const GARAGE = { x: 600, y: 2200 };
export const HOTEL = { x: 2800, y: 2000 };
export const TOWER = { x: 1200, y: 800 };
export const MARINA = { x: 3000, y: 2200 };
/** The bank on the south-west road, the finale's target. */
export const BANK = { x: 1000, y: 2000 };
/** The safehouse on the north-east corner, where the Getaway ends. */
export const SAFEHOUSE = { x: 3000, y: 200 };
/** The stadium block (roads x 2200..2600, y 200..600): an oval field, no buildings. */
export const STADIUM = { x: 2244, y: 244, w: 312, h: 312 };
/** The street-race start line, on the road beside the stadium. */
export const RACE_START = { x: 2200, y: 600 };

/** Hidden sun packages: twelve gold stars tucked around the city; all twelve pay a bonus. */
export const COLLECTIBLES = { count: 12, pickupCash: 25, allBonus: 500 };

/** The repeatable street race at the stadium: three checkpoints against a rival driver. */
export const RACE = { prize: 300, countdown: 3, cooldown: 10 };

/** One full day in Solmar lasts four minutes of play: noon, dusk, night, dawn. */
export const DAY = { cycleSeconds: 240, nightStart: 0.36, nightEnd: 0.64 };

/** The taxi side job: a fare pays a base amount plus a per-metre rate and a time bonus. */
export const TAXI = {
  baseFare: 60,
  perMetre: 0.25,
  timeBonus: 40,
  secondsPerMetre: 0.09,
  minTime: 25,
};

/** What the garage sells: a repair and a faster car, both paid in cash. */
export const SHOP = { repairCost: 150, sportCost: 800, sportSpeed: 1.35, sportAccel: 1.3 };

/** Where the save is kept between visits (this browser only). */
export const SAVE_KEY = 'solmar.save.v1';

export const PALETTE = {
  grass: '#7fae5a',
  sand: '#e8cf9a',
  sea: '#3fa7c4',
  seaDeep: '#2b7fa3',
  road: '#3d3a38',
  roadEdge: '#57504a',
  sidewalk: '#c9bfa9',
  lane: '#f2c94c',
  crosswalk: '#e8e2d4',
  panel: 'rgba(12, 14, 20, 0.72)',
  text: '#f5efe0',
  muted: '#c9bda6',
  gold: '#f2c94c',
  red: '#e5534b',
  blue: '#4fc3f7',
  green: '#7dd87d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
