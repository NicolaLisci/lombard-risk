import { Component, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import * as echarts from 'echarts';
import { PortfolioRow, RiskCalculatorService } from '../../services/risk-calculator';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.scss']
})
export class DashboardComponent implements AfterViewInit {

  @ViewChild('chartDiv') chartDiv!: ElementRef<HTMLDivElement>;
  chart!: echarts.ECharts;

  // parametri base
  loanUsed = 15000;
  haircut = 0.6;

  portfolio: PortfolioRow[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', valueEUR: 20000, eligible: true },
    { symbol: 'MSFT', name: 'Microsoft Corp.', valueEUR: 15000, eligible: true },
    { symbol: 'BTP2032', name: 'BTP 2032', valueEUR: 10000, eligible: true },
  ];

  constructor(private risk: RiskCalculatorService) { }

  ngAfterViewInit(): void {
    this.initChart();
  }

  private initChart(): void {
    this.chart = echarts.init(this.chartDiv.nativeElement);
    this.updateChart();
    window.addEventListener('resize', () => this.chart.resize());
  }

  updateChart() {
    const stress = this.risk.stressTest(this.portfolio, this.loanUsed, this.haircut);
    const shocks = stress.map(s => `${Math.round(s.shock * 100)}%`);
    const ltv = stress.map(s => (s.ltv * 100).toFixed(1));

    const option: echarts.EChartsOption = {
      title: { text: 'LTV vs Calo Portafoglio', left: 'center' },
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: shocks, name: 'Calo (%)' },
      yAxis: { type: 'value', name: 'LTV (%)', min: 0, max: 120 },
      series: [{
        data: ltv,
        type: 'line',
        smooth: true,
        areaStyle: { opacity: 0.15, color: '#3b82f6' },
        lineStyle: { color: '#2563eb', width: 2 },
        symbol: 'circle'
      }]
    };
    this.chart.setOption(option);
  }

  get ltvInfo() {
    return this.risk.computeLtv(this.portfolio, this.loanUsed, this.haircut);
  }
}
