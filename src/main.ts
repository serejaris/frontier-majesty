import { Game } from './game/Game.ts';

const host = document.getElementById('app');
const fpsEl = document.getElementById('hud-fps');
const camEl = document.getElementById('hud-camera');
const seedEl = document.getElementById('hud-seed');
const perksEl = document.getElementById('hud-perks');

if (!host || !fpsEl || !camEl || !seedEl || !perksEl) {
  throw new Error(
    'Missing required DOM nodes: #app, #hud-fps, #hud-camera, #hud-seed, #hud-perks',
  );
}

const game = new Game(host, { fps: fpsEl, camera: camEl, seed: seedEl, perks: perksEl });
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
