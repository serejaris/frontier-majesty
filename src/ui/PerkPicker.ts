import type { PerkDef } from '../progression/Perks.ts';

/**
 * Full-screen modal for the "choose 1 of 3" perk picker.
 *
 * Contract (per PRD §16):
 *  - Player MUST pick one; `Esc` is intentionally ignored.
 *  - The backdrop signals pause — the caller is expected to halt the sim
 *    while `show()` is awaited.
 *  - Each call to `show()` returns a Promise resolving to the picked PerkDef.
 */
export class PerkPicker {
  private readonly container: HTMLElement;
  private readonly root: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  private currentPerks: PerkDef[] = [];
  private resolver: ((perk: PerkDef) => void) | null = null;
  private disposed = false;

  constructor(container: HTMLElement = document.body) {
    this.container = container;

    this.root = document.createElement('div');
    this.root.id = 'perk-picker-root';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Choose a perk');
    Object.assign(this.root.style, {
      position: 'fixed',
      inset: '0',
      background: 'rgba(6, 9, 14, 0.72)',
      backdropFilter: 'blur(2px)',
      display: 'none',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '9999',
      fontFamily:
        "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      color: '#e6efff',
      userSelect: 'none',
    } as CSSStyleDeclaration);

    this.card = document.createElement('div');
    Object.assign(this.card.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(220px, 280px))',
      gap: '16px',
      padding: '24px',
      background: 'rgba(14, 20, 28, 0.96)',
      border: '1px solid rgba(255, 204, 102, 0.35)',
      borderRadius: '12px',
      boxShadow: '0 24px 64px rgba(0, 0, 0, 0.55)',
      maxWidth: 'min(920px, 92vw)',
    } as CSSStyleDeclaration);

    this.root.appendChild(this.card);
    this.container.appendChild(this.root);

    this.onKeyDown = (e: KeyboardEvent) => {
      if (this.root.style.display === 'none') return;
      // PRD: Esc must NOT dismiss — player must pick.
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const idx = e.key === '1' ? 0 : e.key === '2' ? 1 : e.key === '3' ? 2 : -1;
      if (idx >= 0 && idx < this.currentPerks.length) {
        e.preventDefault();
        e.stopPropagation();
        this.resolve(this.currentPerks[idx]!);
      }
    };
    // Capture phase so we intercept keys before game handlers.
    window.addEventListener('keydown', this.onKeyDown, true);
  }

  /** Show the picker with the given perks; resolves when one is chosen. */
  show(perks: PerkDef[]): Promise<PerkDef> {
    if (this.disposed) return Promise.reject(new Error('PerkPicker disposed'));
    if (perks.length === 0) return Promise.reject(new Error('PerkPicker: no perks'));

    this.currentPerks = perks;
    this.renderCards(perks);
    this.root.style.display = 'flex';

    return new Promise<PerkDef>((resolve) => {
      this.resolver = resolve;
    });
  }

  /** Hide without resolving. Primarily for cleanup / external cancellation. */
  hide(): void {
    this.root.style.display = 'none';
    this.currentPerks = [];
    this.resolver = null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown, true);
    this.root.remove();
  }

  private renderCards(perks: PerkDef[]): void {
    this.card.innerHTML = '';
    perks.forEach((perk, i) => {
      const col = document.createElement('div');
      Object.assign(col.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        padding: '18px',
        background: 'rgba(22, 30, 42, 0.9)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '10px',
        minHeight: '180px',
      } as CSSStyleDeclaration);

      const title = document.createElement('div');
      title.textContent = perk.title;
      Object.assign(title.style, {
        fontSize: '20px',
        fontWeight: '600',
        color: '#ffcc66',
        letterSpacing: '0.3px',
      } as CSSStyleDeclaration);

      const desc = document.createElement('div');
      desc.textContent = perk.description;
      Object.assign(desc.style, {
        fontSize: '14px',
        lineHeight: '1.45',
        opacity: '0.85',
        flex: '1',
      } as CSSStyleDeclaration);

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = `Choose  [${i + 1}]`;
      Object.assign(btn.style, {
        marginTop: 'auto',
        padding: '10px 14px',
        fontSize: '14px',
        fontWeight: '600',
        color: '#0b0f14',
        background: '#ffcc66',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        letterSpacing: '0.4px',
      } as CSSStyleDeclaration);
      btn.addEventListener('click', () => this.resolve(perk));
      btn.addEventListener('mouseenter', () => {
        btn.style.background = '#ffd98a';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = '#ffcc66';
      });

      col.appendChild(title);
      col.appendChild(desc);
      col.appendChild(btn);
      this.card.appendChild(col);
    });
  }

  private resolve(perk: PerkDef): void {
    const r = this.resolver;
    this.resolver = null;
    this.root.style.display = 'none';
    this.currentPerks = [];
    if (r) r(perk);
  }
}
