import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import * as echarts from 'echarts';
import { RiskCalculatorService } from '../../services/risk-calculator';
import { PortfolioRow } from '../../services/risk-calculator';
import { MarketDataService } from '../../services/market-data';
import { FxService } from '../../services/fx';
import { lastValueFrom } from 'rxjs';

type Kpi = { eligibleCollateral: number; maxCredit: number; ltv: number; headroom: number; mcShock: number };

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements AfterViewInit, OnDestroy {
  @ViewChild('chartDiv') chartDiv!: ElementRef<HTMLDivElement>;
  chart!: echarts.ECharts;

  search = '';
  portfolio: PortfolioRow[] = [];

  form;
  kpi: Kpi = { eligibleCollateral: 0, maxCredit: 0, ltv: 0, headroom: 0, mcShock: 0 };

  constructor(
    private fb: FormBuilder,
    private api: MarketDataService,
    private fx: FxService,
    private risk: RiskCalculatorService
  ) {
    this.form = this.fb.group({
      loanUsed: [15000, [Validators.required, Validators.min(0)]],
      haircut: [0.60, [Validators.required, Validators.min(0), Validators.max(1)]],
      mcThresh: [0.75, [Validators.required, Validators.min(0), Validators.max(1)]],
    });
  }

  ngAfterViewInit() {
    this.chart = echarts.init(this.chartDiv.nativeElement);
    this.form.valueChanges.subscribe(() => this.recalc());
    this.refreshQuotesAndRecalc(); // prima valutazione
    window.addEventListener('resize', () => this.chart.resize());
  }

  ngOnDestroy() { this.chart?.dispose(); }

  private fxCache: Record<string, number> = { EUR: 1 };

  private buildRowsEUR(): Array<PortfolioRow & { valueEUR: number }> {
    return this.portfolio.map(r => ({ ...r, valueEUR: this.valueEUR(r) }));
  }

  recalc() {
    const v = this.form.value;
    const rowsEUR = this.buildRowsEUR();
    const next = this.risk.computeKpi(rowsEUR, v.loanUsed ?? 0, v.haircut ?? 0.6, v.mcThresh ?? 0.75);

    queueMicrotask(() => {           // oppure: setTimeout(() => { ... }, 0)
      this.kpi = next;
      this.updateChart(rowsEUR, v.loanUsed ?? 0, v.haircut ?? 0.6, v.mcThresh ?? 0.75);
    });
  }

  private async refreshQuotesAndRecalc() {
    // 1) quote
    for (const r of this.portfolio) {
      const q = await lastValueFrom(this.api.getQuote(r.symbol));
      if (q?.price) r.price = q.price;
    }

    // 2) FX (popola cache USD→EUR, ecc.)
    const currencies = Array.from(new Set(this.portfolio.map(p => p.currency))).filter(c => c !== 'EUR');
    for (const c of currencies) {
      const rate = await lastValueFrom(this.fx.toEUR(1, c)); // 1 unità base → EUR
      if (rate > 0) this.fxCache[c] = rate;
    }

    // 3) ricalcola *dopo* che FX è pronto
    this.recalc();
  }

  valueEUR(r: PortfolioRow): number {
    const rate = this.fxCache[r.currency] ?? (r.currency === 'EUR' ? 1 : 0);
    return r.qty * r.price * rate;
  }

  addSymbol() {
    const sym = (this.search || '').trim().toUpperCase();
    if (!sym) return;
    // aggiungi riga base; qty=1, currency USD come default
    this.portfolio.push({ symbol: sym, name: sym, qty: 1, price: 0, currency: 'USD', eligible: true });
    this.search = '';
    this.refreshQuotesAndRecalc();
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
      series: [{
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
          data: [{ yAxis: mcThresh * 100 }]
        }
      }]
    };
    this.chart.setOption(option);
  }
}
