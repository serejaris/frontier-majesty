import { Game } from './game/Game.ts';

const host = document.getElementById('app');
const fpsEl = document.getElementById('hud-fps');
const camEl = document.getElementById('hud-camera');
const seedEl = document.getElementById('hud-seed');
const goldEl = document.getElementById('hud-gold');
const perksEl = document.getElementById('hud-perks');
const timeEl = document.getElementById('hud-time');
const uiRoot = document.getElementById('ui-root');

if (!host || !fpsEl || !camEl || !seedEl || !goldEl || !perksEl || !timeEl || !uiRoot) {
  throw new Error(
    'Missing required DOM nodes: #app, #hud-fps, #hud-camera, #hud-seed, #hud-gold, #hud-perks, #hud-time, #ui-root',
  );
}

const game = new Game(host, {
  hud: { fps: fpsEl, camera: camEl, seed: seedEl, gold: goldEl, perks: perksEl, time: timeEl },
  uiRoot,
});
game.start();

if (import.meta.hot) {
  import.meta.hot.dispose(() => game.dispose());
}
