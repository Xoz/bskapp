import { expect, it } from 'vitest';
import { batteryPercent } from './matchSpace';
it('visar individuella batterier på samma procentskala', () => {
  expect(batteryPercent(125,125)).toBe(100);
  expect(batteryPercent(80,80)).toBe(100);
  expect(batteryPercent(100,125)).toBe(80);
  expect(batteryPercent(40,80)).toBe(50);
  expect(batteryPercent(65,100)).toBe(65);
});
it('håller stapeln inom 0–100 även vid skuld och ogiltigt underlag', () => {
  expect(batteryPercent(-20,80)).toBe(0);
  expect(batteryPercent(150,125)).toBe(100);
  expect(batteryPercent(80,0)).toBe(0);
  expect(batteryPercent(NaN,100)).toBe(0);
});
