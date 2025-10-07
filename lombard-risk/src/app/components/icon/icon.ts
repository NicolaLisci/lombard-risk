import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconService } from '../../services/icon';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `<span [innerHTML]="svg"></span>`
})
export class IconComponent implements OnChanges {
  @Input() name = 'help-circle';
  @Input()
  size:
    | '2xs'
    | 'xs'
    | 'sm'
    | 'md'
    | 'lg'
    | 'xl'
    | '2xl'
    | '3xl' = 'md';
  @Input() colorClass = ''; // es: 'text-red-500'
  svg: SafeHtml | null = null;

  // ✅ ora 8 livelli di grandezza, scalati progressivamente
  private sizeClassMap: Record<typeof this.size, string> = {
    '2xs': 'w-3 h-3',  // minuscola (tooltip, micro elementi)
    xs: 'w-4 h-4',     // molto piccola
    sm: 'w-5 h-5',     // piccola (icone nei bottoni)
    md: 'w-6 h-6',     // media (default)
    lg: 'w-8 h-8',     // grande
    xl: 'w-10 h-10',   // extra grande
    '2xl': 'w-12 h-12',// hero card, dashboard
    '3xl': 'w-16 h-16' // maxi (illustrazioni, splash)
  };

  constructor(private icons: IconService, private sanitizer: DomSanitizer) {}

  ngOnChanges(): void {
    const cls = `${this.sizeClassMap[this.size]} ${this.colorClass}`.trim();
    const html = this.icons.get(this.name, cls);
    this.svg = this.sanitizer.bypassSecurityTrustHtml(html);
  }
}
