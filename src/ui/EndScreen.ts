/**
 * EndScreen — victory/defeat modal.
 *
 * Full-viewport dark backdrop, centred card with outcome title, stats, and a
 * single "New Run" button that invokes the onRestart callback. The caller
 * decides what restart actually means (usually reloading the page or
 * re-instantiating Game).
 */
export interface EndScreenData {
  outcome: 'victory' | 'defeat';
  seed: number;
  durationSec: number;
  perks: string[];
  heroesAlive: number;
  nestsDestroyed: number;
}

export class EndScreen {
  private readonly root: HTMLDivElement;
  private readonly title: HTMLElement;
  private readonly statsList: HTMLElement;
  private readonly button: HTMLButtonElement;
  private readonly onRestart: () => void;
  private mounted = false;

  constructor(onRestart: () => void) {
    this.onRestart = onRestart;

    this.root = document.createElement('div');
    this.root.className = 'end-screen';
    this.root.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'end-screen-card';
    this.root.appendChild(card);

    this.title = document.createElement('div');
    this.title.className = 'end-screen-title';
    card.appendChild(this.title);

    this.statsList = document.createElement('div');
    this.statsList.className = 'end-screen-stats';
    card.appendChild(this.statsList);

    this.button = document.createElement('button');
    this.button.className = 'end-screen-button';
    this.button.textContent = 'New Run';
    this.button.addEventListener('click', () => {
      this.onRestart();
    });
    card.appendChild(this.button);
  }

  show(data: EndScreenData): void {
    if (!this.mounted) {
      document.body.appendChild(this.root);
      this.mounted = true;
    }

    const victorious = data.outcome === 'victory';
    this.title.textContent = victorious ? 'VICTORY' : 'DEFEAT';
    this.title.classList.toggle('is-victory', victorious);
    this.title.classList.toggle('is-defeat', !victorious);

    this.statsList.innerHTML = '';
    appendStat(this.statsList, 'Seed', String(data.seed));
    appendStat(this.statsList, 'Duration', formatDuration(data.durationSec));
    appendStat(this.statsList, 'Heroes alive', String(data.heroesAlive));
    appendStat(this.statsList, 'Nests destroyed', String(data.nestsDestroyed));
    appendStat(this.statsList, 'Perks', data.perks.length > 0 ? data.perks.join(', ') : '—');

    this.root.style.display = 'flex';
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

function appendStat(list: HTMLElement, label: string, value: string): void {
  const row = document.createElement('div');
  row.className = 'end-screen-stat';
  const l = document.createElement('span');
  l.className = 'end-screen-stat-label';
  l.textContent = label;
  const v = document.createElement('span');
  v.className = 'end-screen-stat-value';
  v.textContent = value;
  row.appendChild(l);
  row.appendChild(v);
  list.appendChild(row);
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}
