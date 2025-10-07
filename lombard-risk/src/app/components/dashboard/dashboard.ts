import {
  Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, HostListener
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import * as echarts from 'echarts';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { Subject, of, lastValueFrom } from 'rxjs';

import { RiskCalculatorService, PortfolioRow } from '../../services/risk-calculator';
import { MarketDataService } from '../../services/market-data';
import { FxService } from '../../services/fx';
import { InfoHintComponent } from '../info-hint/info-hint/info-hint';

type Kpi = { eligibleCollateral: number; maxCredit: number; ltv: number; headroom: number; mcShock: number };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, InfoHintComponent],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartDiv') chartDiv!: ElementRef<HTMLDivElement>;
  chart!: echarts.ECharts;

  search = '';
  suggestions: { symbol: string; name: string; exchange?: string; type?: string }[] = [];
  private search$ = new Subject<string>();

  portfolio: PortfolioRow[] = [];
  form;
  kpi: Kpi = { eligibleCollateral: 0, maxCredit: 0, ltv: 0, headroom: 0, mcShock: 0 };
  private fxCache: Record<string, number> = { EUR: 1 };

  constructor(
    private fb: FormBuilder,
    private api: MarketDataService,
    private fx: FxService,
    private risk: RiskCalculatorService
  ) {
    this.form = this.fb.group({
      loanUsed: [15000, [Validators.required, Validators.min(0)]],
      haircut: [0.6, [Validators.required, Validators.min(0), Validators.max(1)]],
      mcThresh: [0.75, [Validators.required, Validators.min(0), Validators.max(1)]],
    });
  }

  ngAfterViewInit() {
    this.chart = echarts.init(this.chartDiv.nativeElement);
    this.form.valueChanges.subscribe(() => this.recalc());

    // autocomplete pipeline
    this.search$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap(q => q.length < 2 ? of([]) : this.api.searchSymbols(q))
      )
      .subscribe(list => (this.suggestions = list));

    window.addEventListener('resize', () => this.chart.resize());
  }

  ngOnDestroy() {
    this.chart?.dispose();
  }

  // chiude dropdown se clicchi fuori
  @HostListener('document:click', ['$event'])
  onClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    const inputEl = document.getElementById('symbolSearchBox');
    const dropdownEl = document.getElementById('symbolDropdown');
    if (inputEl && !inputEl.contains(target) && dropdownEl && !dropdownEl.contains(target)) {
      this.suggestions = [];
    }
  }

  onSearchChange(q: string) {
    this.search$.next(q);
  }

  async onSelectSuggestion(s: any) {
    this.suggestions = [];
    this.search = '';

    // aggiungi la riga
    const row: PortfolioRow = {
      symbol: s.symbol,
      name: s.name ?? s.symbol,
      qty: 1,
      price: 0,
      currency: 'EUR',
      eligible: true,
    };
    this.portfolio.push(row);

    // quota dal servizio Yahoo/RapidAPI
    const q = await lastValueFrom(this.api.getQuote(s.symbol));
    row.price = q.price || 0;
    row.currency = q.currency || 'EUR';
    row.name = q.name || row.name;

    // FX se serve
    if (row.currency !== 'EUR' && !this.fxCache[row.currency]) {
      const rate = await lastValueFrom(this.fx.toEUR(1, row.currency));
      if (rate > 0) this.fxCache[row.currency] = rate;
    }

    // aggiorna grafico e KPI
    this.recalc();
  }

  private buildRowsEUR(): Array<PortfolioRow & { valueEUR: number }> {
    return this.portfolio.map(r => ({ ...r, valueEUR: this.valueEUR(r) }));
  }

  valueEUR(r: PortfolioRow): number {
    const rate = this.fxCache[r.currency] ?? 1;
    return r.qty * r.price * rate;
  }

  recalc() {
    const v = this.form.value;
    const rowsEUR = this.buildRowsEUR();
    const next = this.risk.computeKpi(rowsEUR, v.loanUsed ?? 0, v.haircut ?? 0.6, v.mcThresh ?? 0.75);
    queueMicrotask(() => {
      this.kpi = next;
      this.updateChart(rowsEUR, v.loanUsed ?? 0, v.haircut ?? 0.6, v.mcThresh ?? 0.75);
    });
  }

  private updateChart(
    rowsEUR: Array<PortfolioRow & { valueEUR: number }>,
    loanUsed: number,
    haircut: number,
    mcThresh: number
  ) {
    const stress = this.risk.stressTest(rowsEUR, loanUsed, haircut);
    const labels = stress.map(p => `${Math.round(p.shock * 100)}%`);
    const series = stress.map(p => +(p.ltv * 100).toFixed(1));

    const option: echarts.EChartsOption = {
      title: { text: 'LTV vs Calo Portafoglio', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: labels, name: 'Calo (%)' },
      yAxis: { type: 'value', name: 'LTV (%)', min: 0, max: 120 },
      series: [
        {
          type: 'line',
          data: series,
          smooth: true,
          areaStyle: { opacity: 0.15, color: '#3b82f6' },
          lineStyle: { color: '#2563eb', width: 2 },
          symbol: 'circle',
          markLine: {
            symbol: 'none',
            lineStyle: { color: '#ef4444', type: 'dashed' },
            label: { formatter: `Soglia MC (${(mcThresh * 100).toFixed(0)}%)`, position: 'end' },
            data: [{ yAxis: mcThresh * 100 }],
          },
        },
      ],
    };
    this.chart.setOption(option);
  }
}
