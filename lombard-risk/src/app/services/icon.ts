import { Injectable } from '@angular/core';
import feather, { FeatherIcon } from 'feather-icons';

type FeatherIconsMap = typeof feather.icons;
type FeatherIconName = keyof FeatherIconsMap;

@Injectable({ providedIn: 'root' })
export class IconService {
  /** Verifica se il nome esiste nelle icone */
  private isIconName(name: string): name is FeatherIconName {
    return Object.prototype.hasOwnProperty.call(feather.icons, name);
  }

  /** Restituisce l'SVG HTML per un'icona Feather */
  get(name: string, className = 'w-5 h-5'): string {
    const key: FeatherIconName = this.isIconName(name) ? name : 'help-circle';
    const icon: FeatherIcon = feather.icons[key];
    return icon.toSvg({ class: className, 'stroke-width': 1.8 });
  }
}
