// src/app/services/fx.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, catchError, of } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class FxService {
  // endpoint stabile (ECB): https://api.frankfurter.app
  private base = 'https://api.frankfurter.app/latest';

  constructor(private http: HttpClient) {}

  toEUR(amount: number, baseCurrency: string) {
    if (!amount) return of(0);
    if (!baseCurrency || baseCurrency === 'EUR') return of(amount);
    return this.http
      .get<any>(`${this.base}?amount=${amount}&from=${baseCurrency}&to=EUR`)
      .pipe(
        map(res => res?.rates?.EUR ?? 0),
        catchError(() => of(0)) // evita che un errore rompa il flusso
      );
  }
}
