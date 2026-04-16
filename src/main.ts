import { Game } from './game/Game.ts';

const host = document.getElementById('app');
const fpsEl = document.getElementById('hud-fps');
const camEl = document.getElementById('hud-camera');

if (!host || !fpsEl || !camEl) {
  throw new Error('Missing required DOM nodes: #app, #hud-fps, #hud-camera');
}

const game = new Game(host, { fps: fpsEl, camera: camEl });
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
