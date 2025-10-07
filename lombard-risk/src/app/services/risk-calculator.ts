import { Injectable } from '@angular/core';

export interface PortfolioRow {
  symbol: string;
  name: string;
  qty: number;        // 🔵 nuovo
  price: number;      // ultimo prezzo nella sua valuta nativa
  currency: 'EUR' | 'USD' | 'GBP' | string;
  eligible: boolean;
}

export interface RiskKpi {
  eligibleCollateral: number; // in EUR
  maxCredit: number;
  ltv: number;                // 0..1
  headroom: number;           // €
  mcShock: number;            // calo % del portafoglio che porta a MC (>=0)
}


@Injectable({ providedIn: 'root' })
export class RiskCalculatorService {

  // somma valori idonei (in EUR) - riceve già valori in EUR dal caller
  private eligibleEUR(rows: Array<PortfolioRow & { valueEUR: number }>): number {
    return rows.filter(r => r.eligible).reduce((s, r) => s + r.valueEUR, 0);
  }

  computeKpi(
    rowsEUR: Array<PortfolioRow & { valueEUR: number }>,
    loanUsed: number,
    portfolioAR: number,   // es. 0.60
    mcThresh: number       // es. 0.75
  ): RiskKpi {
    const eligible = this.eligibleEUR(rowsEUR);
    const maxCredit = eligible * portfolioAR;
    const ltv = eligible > 0 ? loanUsed / eligible : 0;
    const headroom = maxCredit - loanUsed;

    // shock deterministico fino a MC (risolve loanUsed / (eligible*(1+s)) = mcThresh)
    // => (1+s) = loanUsed/(eligible*mcThresh)  => s = loanUsed/(eligible*mcThresh) - 1
    const mcShock = eligible > 0 && mcThresh > 0
      ? Math.max(0, (loanUsed / (eligible * mcThresh)) - 1)
      : 0;

    return { eligibleCollateral: eligible, maxCredit, ltv, headroom, mcShock };
  }

  stressTest(
    rowsEUR: Array<PortfolioRow & { valueEUR: number }>,
    loanUsed: number,
    portfolioAR: number,
    shocks = [0, -0.1, -0.2, -0.3, -0.4, -0.5, -0.6]
  ) {
    const eligible0 = this.eligibleEUR(rowsEUR);
    return shocks.map(s => {
      const eligS = eligible0 * (1 + s);
      const ltvS = eligS > 0 ? loanUsed / eligS : Infinity;
      const headroomS = (eligS * portfolioAR) - loanUsed;
      return { shock: s, ltv: ltvS, headroom: headroomS };
    });
  }
}
