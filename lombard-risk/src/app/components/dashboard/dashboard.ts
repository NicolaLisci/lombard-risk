import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import * as echarts from 'echarts';
import { lastValueFrom } from 'rxjs';

import { RiskCalculatorService, PortfolioRow } from '../../services/risk-calculator';
import { MarketDataService } from '../../services/market-data';
import { FxService } from '../../services/fx';

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
    private api: MarketDataService, // Yahoo via RapidAPI
    private fx: FxService,          // Frankfurter (EUR base)
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
    window.addEventListener('resize', () => this.chart.resize());
  }

  ngOnDestroy() { this.chart?.dispose(); }

  // cache FX: 1 unità nella valuta -> EUR
  private fxCache: Record<string, number> = { EUR: 1 };

  /** Conversione del valore riga in EUR */
  valueEUR(r: PortfolioRow): number {
    const cc = r.currency || 'EUR';
    const rate = this.fxCache[cc] ?? (cc === 'EUR' ? 1 : 0);
    return r.qty * r.price * rate;
  }

  /** Ricostruisce le righe con valueEUR */
  private buildRowsEUR(): Array<PortfolioRow & { valueEUR: number }> {
    return this.portfolio.map(r => ({ ...r, valueEUR: this.valueEUR(r) }));
  }

  /** Aggiorna kpi + grafico */
  recalc() {
    const v = this.form.value;
    const rowsEUR = this.buildRowsEUR();
    const next = this.risk.computeKpi(rowsEUR, v.loanUsed ?? 0, v.haircut ?? 0.6, v.mcThresh ?? 0.75);

    queueMicrotask(() => {
      this.kpi = next;
      this.updateChart(rowsEUR, v.loanUsed ?? 0, v.haircut ?? 0.6, v.mcThresh ?? 0.75);
    });
  }

  /** Aggiunge un ticker, quota subito, aggiorna FX per la valuta reale e ricalcola */
  async addSymbol() {
    const raw = (this.search || '').trim();
    if (!raw) return;

    // crea riga placeholder
    const row: PortfolioRow = {
      symbol: raw,
      name: raw,
      qty: 1,
      price: 0,
      currency: 'EUR', // verrà sovrascritto dalla quote
      eligible: true
    };
    this.portfolio.push(row);
    this.search = '';

    // 1) quota subito dal provider (es. VWCE.MI → EUR, AAPL → USD)
    const q = await lastValueFrom(this.api.getQuote(raw));
    row.symbol = q.symbol || raw;
    row.name = q.name || row.symbol;
    row.price = q.price || 0;
    row.currency = q.currency || 'EUR';

    // 2) aggiorna FX solo se serve (e solo per la/e valute presenti)
    const cc = row.currency;
    if (cc && cc !== 'EUR' && !this.fxCache[cc]) {
      const rate = await lastValueFrom(this.fx.toEUR(1, cc));
      if (rate > 0) this.fxCache[cc] = rate;
    }

    // 3) ricalcola KPI/grafico
    this.recalc();
  }

  /** Grafico LTV vs calo portafoglio */
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
      grid: { left: 40, right: 20, top: 50, bottom: 40 },
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
