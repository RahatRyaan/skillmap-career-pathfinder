import { describe, expect, it } from 'vitest';
import { formatHours, formatPercent, streakMessage, GAP_LABEL_COPY, cn, debounce } from './utils';

describe('formatPercent', () => {
  it('renders a percentage', () => {
    expect(formatPercent(42.35)).toBe('42.4%');
  });

  it('shows a dash rather than 0% for a missing value', () => {
    // 0% alignment and "no data" must not look the same.
    expect(formatPercent(null)).toBe('—');
    expect(formatPercent(undefined)).toBe('—');
    expect(formatPercent(0)).toBe('0%');
  });
});

describe('formatHours', () => {
  it('handles short and long durations', () => {
    expect(formatHours(0)).toBe('0h');
    expect(formatHours(0.5)).toBe('30min');
    expect(formatHours(3)).toBe('3h');
    expect(formatHours(40)).toContain('5 days');
  });

  it('does not say "1 hours"', () => {
    expect(formatHours(1)).toBe('1h');
  });
});

describe('streakMessage', () => {
  it('never shames the student', () => {
    expect(streakMessage(0)).toContain('Start a streak');
    expect(streakMessage(1)).toContain('That is a start');
    for (const days of [0, 1, 5, 20, 60]) {
      expect(streakMessage(days)).not.toMatch(/fail|lost|missed|broken/i);
    }
  });
});

describe('GAP_LABEL_COPY', () => {
  it('labels every status with text, not just colour', () => {
    for (const label of ['strong', 'developing', 'gap', 'critical']) {
      expect(GAP_LABEL_COPY[label]?.label).toBeTruthy();
      expect(GAP_LABEL_COPY[label]?.icon).toBeTruthy();
    }
  });
});

describe('cn', () => {
  it('lets a later class win over an earlier conflicting one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });
});

describe('debounce', () => {
  it('only fires once for a burst of calls', async () => {
    let calls = 0;
    const fn = debounce(() => {
      calls += 1;
    }, 10);
    fn();
    fn();
    fn();
    await new Promise((r) => setTimeout(r, 30));
    expect(calls).toBe(1);
  });
});
