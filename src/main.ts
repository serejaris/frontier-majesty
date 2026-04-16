import { Game } from './game/Game.ts';

const host = document.getElementById('app');
const fpsEl = document.getElementById('hud-fps');
const camEl = document.getElementById('hud-camera');
const seedEl = document.getElementById('hud-seed');

if (!host || !fpsEl || !camEl || !seedEl) {
  throw new Error('Missing required DOM nodes: #app, #hud-fps, #hud-camera, #hud-seed');
}

const game = new Game(host, { fps: fpsEl, camera: camEl, seed: seedEl });
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
