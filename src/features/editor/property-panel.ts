/**
 * Property panel: safe-DOM form for Locations, Regions, and Routes.
 *
 * Implements forms for Marker, Region, and Route attributes using only
 * safe DOM APIs (textContent) and event emitters, preventing HTML
 * injection.
 */

import type { AtlasLocation } from '@/domain/location';
import type { AtlasRegion } from '@/domain/region';
import type { AtlasRoute } from '@/domain/route';

/** Values from the active edit form. */
export interface PropertyPanelValues {
  readonly type: 'location' | 'region' | 'route';
  readonly location?: {
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
    readonly childMapId: string;
  };
  readonly region?: {
    readonly name: string;
    readonly description: string;
    readonly fillColor: string;
    readonly borderColor: string;
    readonly opacity: number;
    readonly hiddenUntilDiscovered: boolean;
  };
  readonly route?: {
    readonly name: string;
    readonly bidirectional: boolean;
    readonly distance?: number;
    readonly distanceUnit: AtlasRoute['distanceUnit'];
    readonly travelTime?: number;
    readonly travelTimeUnit: AtlasRoute['travelTimeUnit'];
    readonly dangerLevel: AtlasRoute['dangerLevel'];
    readonly locked: boolean;
    readonly requirements: readonly string[];
  };
}

export class PropertyPanel {
  private readonly container: HTMLElement;
  private readonly onChange: (values: PropertyPanelValues) => void;
  private activeItemType: 'location' | 'region' | 'route' | null = null;

  constructor(container: HTMLElement, onChange: (values: PropertyPanelValues) => void) {
    this.container = container;
    this.onChange = onChange;
  }

  /** Renders a Location form. textContent safe. */
  renderLocation(location: AtlasLocation | null, isDefault: boolean): void {
    this.activeItemType = 'location';
    this.container.replaceChildren();
    if (!location) {
      this.renderEmpty('Select a marker to edit.');
      return;
    }

    this.container.append(
      this.row('Name', this.textInput('name', location.name)),
      this.row('Description', this.textArea('description', location.description ?? '')),
      this.row('Category', this.textInput('category', location.category ?? '')),
      this.row('Icon identifier', this.textInput('icon', location.icon ?? '')),
      this.row('Danger level (0-5)', this.dangerSelect(location.dangerLevel ?? 0)),
      this.row('Aliases (comma separated)', this.textInput('aliases', (location.aliases ?? []).join(', '))),
      this.row(
        'World Info keywords (comma separated)',
        this.textInput('keywords', (location.worldInfoKeywords ?? []).join(', ')),
      ),
      this.row('Child Map ID (optional)', this.textInput('childMapId', location.childMapId ?? '')),
      this.row('', this.checkbox('hidden', 'Hidden until discovered', location.hiddenUntilDiscovered === true)),
      this.row('', this.checkbox('discovered', 'Discovered by default', location.discoveredByDefault === true)),
      this.row('', this.checkbox('default', 'Set as default location', isDefault)),
    );

    this.bindEvents();
  }

  /** Renders a Region form. textContent safe. */
  renderRegion(region: AtlasRegion | null): void {
    this.activeItemType = 'region';
    this.container.replaceChildren();
    if (!region) {
      this.renderEmpty('Select a region to edit.');
      return;
    }

    this.container.append(
      this.row('Region Name', this.textInput('name', region.name)),
      this.row('Description', this.textArea('description', region.description ?? '')),
      this.row('Fill Color', this.colorInput('fillColor', region.fillColor ?? '#3498db')),
      this.row('Border Color', this.colorInput('borderColor', region.borderColor ?? '#2980b9')),
      this.row('Opacity (0.1–1.0)', this.numberInput('opacity', region.opacity ?? 0.3, 0.1, 1.0, 0.1)),
      this.row('', this.checkbox('hidden', 'Hidden until discovered', region.hiddenUntilDiscovered === true)),
    );

    this.bindEvents();
  }

  /** Renders a Route form. textContent safe. */
  renderRoute(route: AtlasRoute | null): void {
    this.activeItemType = 'route';
    this.container.replaceChildren();
    if (!route) {
      this.renderEmpty('Select a route to edit.');
      return;
    }

    this.container.append(
      this.row('Route Name', this.textInput('name', route.name)),
      this.row('Distance', this.numberInput('distance', route.distance ?? 0, 0, 99999, 1)),
      this.row('Distance Unit', this.unitSelect('distanceUnit', route.distanceUnit ?? 'km', ['m', 'km', 'mi', 'day', 'hour'])),
      this.row('Travel Time', this.numberInput('travelTime', route.travelTime ?? 0, 0, 99999, 1)),
      this.row('Travel Time Unit', this.unitSelect('travelTimeUnit', route.travelTimeUnit ?? 'hour', ['minute', 'hour', 'day'])),
      this.row('Danger level (0-5)', this.dangerSelect(route.dangerLevel ?? 0)),
      this.row('Requirements (comma separated)', this.textInput('requirements', (route.requirements ?? []).join(', '))),
      this.row('', this.checkbox('bidirectional', 'Bidirectional Route', route.bidirectional)),
      this.row('', this.checkbox('locked', 'Locked Route', route.locked === true)),
    );

    this.bindEvents();
  }

  clear(): void {
    this.activeItemType = null;
    this.container.replaceChildren();
    this.renderEmpty('Select an element to edit.');
  }

  private renderEmpty(message: string): void {
    const empty = document.createElement('p');
    empty.className = 'st-atlas__property-empty';
    empty.textContent = message;
    this.container.append(empty);
  }

  private bindEvents(): void {
    // Clean listener and bind once
    this.container.replaceWith(this.container.cloneNode(true));
    const fresh = document.querySelector<HTMLElement>('.st-atlas__property-panel');
    if (fresh) {
      // Re-assign the container reference to keep elements wired
      Object.assign(this, { container: fresh });
      fresh.addEventListener('input', () => this.emit());
      fresh.addEventListener('change', () => this.emit());
    }
  }

  private collectValues(): PropertyPanelValues | null {
    if (!this.activeItemType) {
      return null;
    }
    const name = this.value('name');
    if (name === null) {
      return null;
    }

    if (this.activeItemType === 'location') {
      return {
        type: 'location',
        location: {
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
          childMapId: this.value('childMapId') ?? '',
        },
      };
    }

    if (this.activeItemType === 'region') {
      const opacityVal = Number.parseFloat(this.value('opacity') ?? '0.3');
      return {
        type: 'region',
        region: {
          name,
          description: this.value('description') ?? '',
          fillColor: this.value('fillColor') ?? '#3498db',
          borderColor: this.value('borderColor') ?? '#2980b9',
          opacity: Number.isFinite(opacityVal) ? opacityVal : 0.3,
          hiddenUntilDiscovered: this.checked('hidden'),
        },
      };
    }

    if (this.activeItemType === 'route') {
      const distVal = this.value('distance');
      const timeVal = this.value('travelTime');
      return {
        type: 'route',
        route: {
          name,
          bidirectional: this.checked('bidirectional'),
          distance: distVal ? Number.parseFloat(distVal) : undefined,
          distanceUnit: (this.value('distanceUnit') ?? 'km') as AtlasRoute['distanceUnit'],
          travelTime: timeVal ? Number.parseFloat(timeVal) : undefined,
          travelTimeUnit: (this.value('travelTimeUnit') ?? 'hour') as AtlasRoute['travelTimeUnit'],
          dangerLevel: this.dangerValue(),
          locked: this.checked('locked'),
          requirements: this.splitList(this.value('requirements')),
        },
      };
    }

    return null;
  }

  private emit(): void {
    const values = this.collectValues();
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

  private colorInput(id: string, value: string): HTMLElement {
    const input = document.createElement('input');
    input.type = 'color';
    input.id = `st-atlas-prop-${id}`;
    input.name = id;
    input.className = 'st-atlas__property-input';
    input.value = value;
    return input;
  }

  private numberInput(id: string, value: number, min: number, max: number, step: number): HTMLElement {
    const input = document.createElement('input');
    input.type = 'number';
    input.id = `st-atlas-prop-${id}`;
    input.name = id;
    input.value = String(value);
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.className = 'st-atlas__property-input text_pole';
    return input;
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

  private unitSelect(id: string, value: string, allowed: readonly string[]): HTMLElement {
    const select = document.createElement('select');
    select.id = `st-atlas-prop-${id}`;
    select.name = id;
    select.className = 'st-atlas__property-input text_pole';
    for (const unit of allowed) {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      if (unit === value) {
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
