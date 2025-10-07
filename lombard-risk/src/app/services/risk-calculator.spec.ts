import { TestBed } from '@angular/core/testing';

import { RiskCalculator } from './risk-calculator';

describe('RiskCalculator', () => {
  let service: RiskCalculator;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RiskCalculator);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
