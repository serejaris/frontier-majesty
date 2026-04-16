import * as THREE from 'three';
import { WORLD } from '../config/Tuning.ts';

export interface RendererBundle {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  canvas: HTMLCanvasElement;
  dispose: () => void;
}

export function createRenderer(host: HTMLElement): RendererBundle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight, false);
  renderer.setClearColor(WORLD.skyColor, 1);
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WORLD.skyColor);
  scene.fog = new THREE.Fog(WORLD.skyColor, 2600, 5200);

  const resizeObserver = new ResizeObserver(() => {
    renderer.setSize(host.clientWidth, host.clientHeight, false);
  });
  resizeObserver.observe(host);

  return {
    renderer,
    scene,
    canvas: renderer.domElement,
    dispose: () => {
      resizeObserver.disconnect();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    },
  };
}
