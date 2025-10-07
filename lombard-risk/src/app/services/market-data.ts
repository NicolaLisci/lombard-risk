// src/app/services/market-data.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { map, catchError, of, Observable } from 'rxjs';

export interface Quote {
  symbol: string;
  price: number;
  currency?: string;
  exchange?: string;   // es. "MIL" (short) o "Milan" (full)
  name?: string;       // longName / shortName
  marketState?: string;
}

@Injectable({ providedIn: 'root' })
export class MarketDataService {
  // 👇 endpoint RapidAPI (Yahoo). Mantieni questo base e passa "ticker" nei params.
  private base = 'https://yahoo-finance15.p.rapidapi.com/api/v1/markets/stock/quotes';
  private key  = 'b4711ab535mshdc60f59129f13abp18b6dcjsncd801f03b647'; // <-- metti la tua chiave RapidAPI

  constructor(private http: HttpClient) {}

  /**
   * Quote singolo (ETF o azione). Accetta simboli con suffisso es: "VWCE.MI", "AAPL".
   * Mappa sia schema { meta, body: [...] } (steadyapi-like) sia { body: { quotes: [...] } }.
   */
  getQuote(symbol: string): Observable<Quote> {
    const headers = new HttpHeaders({
      'X-RapidAPI-Key': this.key,
      'X-RapidAPI-Host': 'yahoo-finance15.p.rapidapi.com'
    });
    const params = new HttpParams().set('ticker', symbol);

    return this.http.get<any>(this.base, { headers, params }).pipe(
      map(res => {
        // compat: prova prima body.quotes[], poi body[]
        const item =
          res?.body?.quotes?.[0] ??
          res?.body?.[0] ??
          null;

          console.log(item.currency)

        return {
          symbol: item?.symbol ?? symbol,
          price: Number(item?.regularMarketPrice ?? 0),
          currency: item?.currency,
          exchange: item?.fullExchangeName ?? item?.exchange, // "Milan" oppure "MIL"
          name: item?.longName ?? item?.shortName ?? symbol,
          marketState: item?.marketState
        } as Quote;
      }),
      catchError(() => of({ symbol, price: 0 } as Quote))
    );
  }
}
