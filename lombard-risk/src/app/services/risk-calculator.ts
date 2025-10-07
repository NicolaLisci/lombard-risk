import { Injectable } from '@angular/core';

export interface PortfolioRow {
  symbol: string;
  name: string;
  valueEUR: number;
  eligible: boolean;
}

@Injectable({ providedIn: 'root' })
export class RiskCalculatorService {

  computeLtv(portfolio: PortfolioRow[], loanUsed: number, haircut: number) {
    const eligible = portfolio.filter(p => p.eligible).reduce((s, p) => s + p.valueEUR, 0);
    const maxCredit = eligible * haircut;
    const ltv = loanUsed / eligible;
    const headroom = maxCredit - loanUsed;
    return { eligible, maxCredit, ltv, headroom };
  }

  stressTest(portfolio: PortfolioRow[], loanUsed: number, haircut: number, shocks = [0, -0.1, -0.2, -0.3, -0.4, -0.5]) {
    const eligible = portfolio.filter(p => p.eligible).reduce((s, p) => s + p.valueEUR, 0);
    return shocks.map(s => ({
      shock: s,
      ltv: loanUsed / (eligible * (1 + s))
    }));
  }

}
