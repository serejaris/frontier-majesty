/**
 * HeroCard — read-only inspection panel, top-right.
 *
 * Per PRD, the player never commands heroes — this panel just reports state.
 * Two-column labelled list. No buttons. Call show(data) to populate+reveal,
 * hide() to hide, dispose() to detach.
 */
export interface HeroCardData {
  class: 'warrior' | 'archer';
  level: number;
  hp: number;
  maxHp: number;
  hasPotion: boolean;
  weaponTier: 0 | 1 | 2 | 3;
  armorTier: 0 | 1 | 2 | 3;
  personalGold: number;
  aiState: string;
  xp: number;
  xpToNext: number | null;
}

interface Fields {
  title: HTMLElement;
  level: HTMLElement;
  hp: HTMLElement;
  potion: HTMLElement;
  weapon: HTMLElement;
  armor: HTMLElement;
  gold: HTMLElement;
  ai: HTMLElement;
  xp: HTMLElement;
}

export class HeroCard {
  private readonly root: HTMLDivElement;
  private readonly fields: Fields;
  private mounted = false;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hero-card';
    this.root.style.display = 'none';

    const title = document.createElement('div');
    title.className = 'hero-card-title';
    this.root.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'hero-card-grid';
    this.root.appendChild(grid);

    const level = addRow(grid, 'Level');
    const hp = addRow(grid, 'HP');
    const potion = addRow(grid, 'Potion');
    const weapon = addRow(grid, 'Weapon');
    const armor = addRow(grid, 'Armor');
    const gold = addRow(grid, 'Gold');
    const ai = addRow(grid, 'AI');
    const xp = addRow(grid, 'XP');

    this.fields = { title, level, hp, potion, weapon, armor, gold, ai, xp };
  }

  show(data: HeroCardData): void {
    if (!this.mounted) {
      document.body.appendChild(this.root);
      this.mounted = true;
    }
    this.fields.title.textContent = `${data.class.toUpperCase()} · lvl ${data.level}`;
    this.fields.level.textContent = String(data.level);
    this.fields.hp.textContent = `${Math.max(0, Math.round(data.hp))} / ${data.maxHp}`;
    this.fields.potion.textContent = data.hasPotion ? 'yes' : '—';
    this.fields.weapon.textContent = tierLabel(data.weaponTier);
    this.fields.armor.textContent = tierLabel(data.armorTier);
    this.fields.gold.textContent = String(data.personalGold);
    this.fields.ai.textContent = data.aiState;
    this.fields.xp.textContent =
      data.xpToNext === null ? `${data.xp} (max)` : `${data.xp} / ${data.xpToNext}`;
    this.root.style.display = 'block';
  }

  hide(): void {
    this.root.style.display = 'none';
  }

  isVisible(): boolean {
    return this.mounted && this.root.style.display !== 'none';
  }

  dispose(): void {
    if (this.mounted) {
      this.root.remove();
      this.mounted = false;
    }
  }
}

function addRow(parent: HTMLElement, label: string): HTMLElement {
  const labelEl = document.createElement('div');
  labelEl.className = 'hero-card-label';
  labelEl.textContent = label;
  const valueEl = document.createElement('div');
  valueEl.className = 'hero-card-value';
  valueEl.textContent = '—';
  parent.appendChild(labelEl);
  parent.appendChild(valueEl);
  return valueEl;
}

function tierLabel(tier: 0 | 1 | 2 | 3): string {
  if (tier === 0) return 'T0 (none)';
  return `T${tier}`;
}
