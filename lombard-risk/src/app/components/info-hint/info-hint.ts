import { Component, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-info',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .hint { position: relative; display: inline-flex; align-items: center; }

    .bubble {
      position: absolute;
      z-index: 50;
      min-width: 14rem;
      background: #111827;
      color: #fff;
      padding: .5rem .75rem;
      border-radius: .5rem;
      font-size: .8125rem;
      line-height: 1.15;
      box-shadow: 0 10px 25px rgba(0,0,0,.15);
      white-space: normal;
    }

    /* tooltip standard: a destra (default) */
    .bubble.right {
      left: 110%;
      top: 50%;
      transform: translateY(-50%);
    }
    .bubble.right::after {
      content: "";
      position: absolute;
      top: 50%;
      left: -6px;
      transform: translateY(-50%);
      border-width: 6px;
      border-style: solid;
      border-color: transparent #111827 transparent transparent;
    }

    /* tooltip a sinistra */
    .bubble.left {
      right: 110%;
      top: 50%;
      transform: translateY(-50%);
    }
    .bubble.left::after {
      content: "";
      position: absolute;
      top: 50%;
      right: -6px;
      transform: translateY(-50%);
      border-width: 6px;
      border-style: solid;
      border-color: transparent transparent transparent #111827;
    }

    /* tooltip centrato sotto */
    .bubble.center {
      top: 120%;
      left: 50%;
      transform: translateX(-50%);
    }
    .bubble.center::after {
      content: "";
      position: absolute;
      top: -6px;
      left: 50%;
      transform: translateX(-50%);
      border-width: 6px;
      border-style: solid;
      border-color: transparent transparent #111827 transparent;
    }

    .icon {
      width: 18px;
      height: 18px;
      margin-left: .35rem;
      border-radius: 9999px;
      background: #eef2ff;
      color: #4f46e5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      cursor: help;
    }
  `],
  template: `
  <span class="hint" (mouseenter)="open()" (mouseleave)="close()">
    <button
      type="button"
      class="icon"
      aria-label="Info"
      [attr.aria-describedby]="id"
      (focus)="open()" (blur)="close()">
      i
    </button>

    <div *ngIf="show"
         class="bubble"
         [ngClass]="placement"
         role="tooltip"
         [id]="id">
      {{ text }}
    </div>
  </span>
  `
})
export class InfoHintComponent {
  @Input() text = '';
  @Input() id = 'hint-' + Math.random().toString(36).slice(2);
  @Input() placement: 'right' | 'left' | 'center' = 'right';

  show = false;
  open() { this.show = true; }
  close() { this.show = false; }

  @HostListener('document:keydown.escape') esc() { this.close(); }
}
