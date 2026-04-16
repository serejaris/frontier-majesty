import { ECONOMY, HEROES } from '../config/Tuning.ts';
import type { HeroKind } from '../entities/Hero.ts';

export interface RecruitPanelDeps {
  /** Bottom-right mount host (shared with BuildMenu). */
  mountHost: HTMLElement;
  /** Whether a recruit of the given kind can be afforded (accounts for free-hire perks). */
  canAfford: (kind: HeroKind) => boolean;
  /** Whether the hero cap has been hit. */
  atCap: () => boolean;
  /** Current free-hire countdown string, e.g. "Free next" or "" if disabled. */
  hireHint: () => string;
  /** Fired when the player clicks "Recruit …"; host handles spend + spawn. */
  onRecruit: (kind: HeroKind) => void;
  /** Fired when the player dismisses the panel. */
  onClose: () => void;
}

/**
 * RecruitPanel — a lightweight DOM panel shown when a built Barracks is picked.
 *
 * Renders two buttons (Warrior 60g / Archer 70g), disables based on gold + cap,
 * and closes on Esc / right-click / close button.
 */
export class RecruitPanel {
  private readonly root: HTMLElement;
  private readonly btnWarrior: HTMLButtonElement;
  private readonly btnArcher: HTMLButtonElement;
  private readonly hintEl: HTMLElement;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly deps: RecruitPanelDeps;
  private visible = false;

  constructor(deps: RecruitPanelDeps) {
    this.deps = deps;

    this.root = document.createElement('div');
    this.root.id = 'recruit-panel';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'recruit-panel-title';
    title.textContent = 'Barracks — Recruit';
    this.root.appendChild(title);

    const btnRow = document.createElement('div');
    btnRow.className = 'recruit-panel-row';
    this.root.appendChild(btnRow);

    this.btnWarrior = this.makeButton(
      `Warrior (${ECONOMY.warriorCost}g)`,
      () => this.triggerRecruit('warrior'),
    );
    btnRow.appendChild(this.btnWarrior);

    this.btnArcher = this.makeButton(
      `Archer (${ECONOMY.archerCost}g)`,
      () => this.triggerRecruit('archer'),
    );
    btnRow.appendChild(this.btnArcher);

    this.hintEl = document.createElement('div');
    this.hintEl.className = 'recruit-panel-hint';
    this.root.appendChild(this.hintEl);

    const close = this.makeButton('Close', () => this.deps.onClose());
    close.classList.add('recruit-panel-close');
    this.root.appendChild(close);

    deps.mountHost.appendChild(this.root);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (!this.visible) return;
      if (e.key === 'Escape') {
        this.deps.onClose();
      }
    };
    window.addEventListener('keydown', this.onKeyDown);
  }

  show(): void {
    this.visible = true;
    this.root.style.display = 'block';
    this.refresh();
  }

  hide(): void {
    this.visible = false;
    this.root.style.display = 'none';
  }

  isVisible(): boolean {
    return this.visible;
  }

  /** Re-evaluate disabled states + labels. Host calls this every render frame. */
  refresh(): void {
    if (!this.visible) return;
    const atCap = this.deps.atCap();
    const canW = !atCap && this.deps.canAfford('warrior');
    const canA = !atCap && this.deps.canAfford('archer');
    if (this.btnWarrior.disabled !== !canW) this.btnWarrior.disabled = !canW;
    if (this.btnArcher.disabled !== !canA) this.btnArcher.disabled = !canA;
    const capMsg = atCap ? `Hero cap reached (${HEROES.cap}). ` : '';
    const hint = this.deps.hireHint();
    this.hintEl.textContent = capMsg + hint;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    this.root.remove();
  }

  private makeButton(label: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'recruit-panel-btn';
    btn.textContent = label;
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (btn.disabled) return;
      onClick();
    });
    return btn;
  }

  private triggerRecruit(kind: HeroKind): void {
    this.deps.onRecruit(kind);
    this.refresh();
  }
}
