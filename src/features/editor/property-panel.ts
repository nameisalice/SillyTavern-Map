/**
 * Property panel: a safe-DOM form for editing a location's fields.
 *
 * All user-provided text is inserted with `textContent`, never
 * `innerHTML`, so a malicious map pack cannot inject markup. The panel
 * reads from / writes to a form container; it does not own the working
 * document — the editor session does.
 */

import type { AtlasLocation } from '@/domain/location';

/** A collected field update from the form. */
export interface PropertyPanelValues {
  readonly name: string;
  readonly description: string;
  readonly category: string;
  readonly icon: string;
  readonly dangerLevel: AtlasLocation['dangerLevel'];
  readonly aliases: readonly string[];
  readonly worldInfoKeywords: readonly string[];
  readonly hiddenUntilDiscovered: boolean;
  readonly discoveredByDefault: boolean;
  readonly isDefault: boolean;
}

/** Builds a form inside `container` for the given location. */
export class PropertyPanel {
  private readonly container: HTMLElement;
  private readonly onChange: (values: PropertyPanelValues) => void;

  constructor(container: HTMLElement, onChange: (values: PropertyPanelValues) => void) {
    this.container = container;
    this.onChange = onChange;
  }

  /** Renders the form fields for a location. Safe DOM construction. */
  render(location: AtlasLocation | null, isDefault: boolean): void {
    this.container.replaceChildren();
    if (!location) {
      const empty = document.createElement('p');
      empty.className = 'st-atlas__property-empty';
      empty.textContent = 'Select a marker to edit its properties.';
      this.container.append(empty);
      return;
    }

    this.container.append(
      this.row('Name', this.textInput('name', location.name)),
      this.row('Description', this.textArea('description', location.description ?? '')),
      this.row('Category', this.textInput('category', location.category ?? '')),
      this.row('Icon identifier', this.textInput('icon', location.icon ?? '')),
      this.row('Danger level (0-5)', this.dangerSelect(location.dangerLevel ?? 0)),
      this.row(
        'Aliases (comma separated)',
        this.textInput('aliases', (location.aliases ?? []).join(', ')),
      ),
      this.row(
        'World Info keywords (comma separated)',
        this.textInput('keywords', (location.worldInfoKeywords ?? []).join(', ')),
      ),
      this.row(
        '',
        this.checkbox('hidden', 'Hidden until discovered', location.hiddenUntilDiscovered === true),
      ),
      this.row(
        '',
        this.checkbox('discovered', 'Discovered by default', location.discoveredByDefault === true),
      ),
      this.row('', this.checkbox('default', 'Set as default location', isDefault)),
    );

    this.container.addEventListener('input', () => this.emit());
    this.container.addEventListener('change', () => this.emit());
  }

  /** Collects current values from the form. */
  collect(): PropertyPanelValues | null {
    const name = this.value('name');
    if (name === null) {
      return null;
    }
    return {
      name,
      description: this.value('description') ?? '',
      category: this.value('category') ?? '',
      icon: this.value('icon') ?? '',
      dangerLevel: this.dangerValue(),
      aliases: this.splitList(this.value('aliases')),
      worldInfoKeywords: this.splitList(this.value('keywords')),
      hiddenUntilDiscovered: this.checked('hidden'),
      discoveredByDefault: this.checked('discovered'),
      isDefault: this.checked('default'),
    };
  }

  private emit(): void {
    const values = this.collect();
    if (values) {
      this.onChange(values);
    }
  }

  private row(label: string, control: HTMLElement): HTMLElement {
    const row = document.createElement('label');
    row.className = 'st-atlas__property-row';
    if (label) {
      const text = document.createElement('span');
      text.className = 'st-atlas__property-label';
      text.textContent = label;
      row.append(text);
    }
    row.append(control);
    return row;
  }

  private textInput(id: string, value: string): HTMLElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `st-atlas-prop-${id}`;
    input.name = id;
    input.className = 'st-atlas__property-input text_pole';
    input.value = value;
    return input;
  }

  private textArea(id: string, value: string): HTMLElement {
    const area = document.createElement('textarea');
    area.id = `st-atlas-prop-${id}`;
    area.name = id;
    area.className = 'st-atlas__property-input text_pole';
    area.rows = 3;
    area.value = value;
    return area;
  }

  private dangerSelect(value: number): HTMLElement {
    const select = document.createElement('select');
    select.id = 'st-atlas-prop-danger';
    select.name = 'danger';
    select.className = 'st-atlas__property-input text_pole';
    for (let level = 0; level <= 5; level += 1) {
      const option = document.createElement('option');
      option.value = String(level);
      option.textContent = String(level);
      if (level === value) {
        option.selected = true;
      }
      select.append(option);
    }
    return select;
  }

  private checkbox(id: string, label: string, checked: boolean): HTMLElement {
    const labelEl = document.createElement('label');
    labelEl.className = 'st-atlas__property-checkbox';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = `st-atlas-prop-${id}`;
    input.name = id;
    input.checked = checked;
    const text = document.createElement('span');
    text.textContent = label;
    labelEl.append(input, text);
    return labelEl;
  }

  private value(name: string): string | null {
    const el = this.container.querySelector<HTMLInputElement>(`[name="${name}"]`);
    return el?.value ?? null;
  }

  private checked(name: string): boolean {
    return this.container.querySelector<HTMLInputElement>(`[name="${name}"]`)?.checked ?? false;
  }

  private dangerValue(): AtlasLocation['dangerLevel'] {
    const el = this.container.querySelector<HTMLSelectElement>('[name="danger"]');
    const raw = el?.value ?? '0';
    const parsed = Number.parseInt(raw, 10);
    if (parsed >= 0 && parsed <= 5) {
      return parsed as AtlasLocation['dangerLevel'];
    }
    return 0;
  }

  private splitList(value: string | null): readonly string[] {
    if (!value) {
      return [];
    }
    return value
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }
}
