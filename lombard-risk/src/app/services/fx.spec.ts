import { TestBed } from '@angular/core/testing';

import { Fx } from './fx';

describe('Fx', () => {
  let service: Fx;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Fx);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
