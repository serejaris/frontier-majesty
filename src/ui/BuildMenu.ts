import { ECONOMY } from '../config/Tuning.ts';
import type { BuildingKind } from '../entities/Building.ts';

interface BuildMenuEntry {
  kind: BuildingKind;
  label: string;
  cost: number;
  button: HTMLButtonElement;
}

/**
 * Bottom-center DOM build menu. The container sets pointer-events: none so
 * pan/drag still work when the cursor is between buttons; only the buttons
 * themselves capture clicks. Right-click anywhere and Esc both cancel.
 */
export class BuildMenu {
  onSelect: (kind: BuildingKind) => void = () => {};
  onCancel: () => void = () => {};

  private readonly root: HTMLElement;
  private readonly entries: BuildMenuEntry[];
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onContextMenu: (e: MouseEvent) => void;
  private currentGold = 0;

  constructor(mountHost: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'build-menu';

    const defs: Array<{ kind: BuildingKind; label: string; cost: number }> = [
      { kind: 'barracks', label: 'Barracks', cost: ECONOMY.barracksCost },
      { kind: 'market', label: 'Market', cost: ECONOMY.marketCost },
      { kind: 'blacksmith', label: 'Blacksmith', cost: ECONOMY.blacksmithCost },
    ];

    this.entries = defs.map((d) => {
      const button = document.createElement('button');
      button.className = 'build-menu-btn';
      button.dataset.kind = d.kind;
      button.innerHTML =
        `<span class="build-menu-label">${d.label}</span>` +
        `<span class="build-menu-cost">${d.cost}g</span>`;
      button.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (button.disabled) return;
        this.onSelect(d.kind);
      });
      this.root.appendChild(button);
      return { kind: d.kind, label: d.label, cost: d.cost, button };
    });

    mountHost.appendChild(this.root);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.onCancel();
    };
    this.onContextMenu = (_e: MouseEvent) => {
      // Canvas already preventDefaults contextmenu; this additionally cancels
      // a pending build selection whether the right-click lands on canvas,
      // an empty area, or the menu itself.
      this.onCancel();
    };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('contextmenu', this.onContextMenu);
  }

  setGold(gold: number): void {
    this.currentGold = gold;
    for (const e of this.entries) {
      const disabled = gold < e.cost;
      if (e.button.disabled !== disabled) e.button.disabled = disabled;
    }
  }

  get gold(): number {
    return this.currentGold;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('contextmenu', this.onContextMenu);
    this.root.remove();
  }
}
