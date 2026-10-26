// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../ui/App';
import { CALCULATORS, searchCalculators } from '../features/registry';

beforeAll(() => {
  window.scrollTo = () => undefined;
  Element.prototype.scrollIntoView = () => undefined;
});
afterEach(() => { cleanup(); localStorage.clear(); });

const openCalc = (name: string) => {
  fireEvent.click(screen.getByRole('button', { name: /^Calculators$/ }));
  const btn = screen.getAllByRole('button').find((b) => b.className === 'calcrow-main' && b.textContent?.startsWith(name));
  if (!btn) throw new Error('calc not found ' + name);
  fireEvent.click(btn);
};

describe('search', () => {
  it.each(['drops per minute', 'gtt/min', 'IV drip'])('"%s" finds the gravity drip calculator', (q) => {
    expect(searchCalculators(q).map((c) => c.id)).toContain('drip-rate');
  });
  it.each([['MAP', 'map'], ['I&O', 'fluid-balance'], ['mg/kg', 'weight-dose'], ['sepsis', 'qsofa'], ['due date', 'edd'], ['lb to kg', 'converter']])('"%s" → %s', (q, id) => {
    expect(searchCalculators(q).slice(0, 3).map((c) => c.id)).toContain(id);
  });
});

describe('app navigation and screens', () => {
  it('renders home with quick access, disclaimer and bottom nav', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'NurseCalc Pro' })).toBeTruthy();
    expect(screen.getByText('Quick access')).toBeTruthy();
    expect(screen.getByText(/Educational and calculation aid/)).toBeTruthy();
    for (const t of ['Home', 'Calculators', 'Learn', 'Favorites', 'Settings']) expect(screen.getByRole('button', { name: new RegExp(`^${t}$`) })).toBeTruthy();
  });

  it('home search finds and opens a calculator', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText('Search calculators'), { target: { value: 'gtt/min' } });
    fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent?.startsWith('Gravity drip rate'))!);
    expect(screen.getByRole('heading', { name: 'Gravity drip rate' })).toBeTruthy();
  });

  it('drip rate: missing drop factor is rejected, example gives 31 gtt/min', () => {
    render(<App />);
    openCalc('Gravity drip rate');
    fireEvent.change(screen.getByLabelText('Volume'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Over'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByText(/Drop factor .* is required/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try example' }));
    const res = screen.getByLabelText('Gravity drip rate result');
    expect(within(res).getByText('31')).toBeTruthy();
    expect(within(res).getByText(/31.25 gtt\/min \(exact\)/)).toBeTruthy();
  });

  it('empty required input shows a field-level message', () => {
    render(<App />);
    openCalc('BMI');
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByText('Enter weight.')).toBeTruthy();
  });

  it('GCS: selecting cards totals automatically; NT never produces a total', () => {
    render(<App />);
    openCalc('Glasgow Coma Scale');
    fireEvent.click(screen.getByLabelText(/To sound/));
    fireEvent.click(screen.getByLabelText(/Confused/));
    fireEvent.click(screen.getByLabelText(/Obeys commands/));
    expect(within(screen.getByLabelText('Glasgow Coma Scale result')).getByText('13')).toBeTruthy();
    fireEvent.click(screen.getAllByLabelText(/Not testable/)[1]!);
    const res = screen.getByLabelText('Glasgow Coma Scale result');
    expect(within(res).getByText('E3 VNT M6')).toBeTruthy();
    expect(within(res).queryByText('13')).toBeNull();
  });

  it('high-alert calculators require confirmation', () => {
    render(<App />);
    openCalc('Insulin volume');
    fireEvent.change(screen.getByLabelText('Ordered dose'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getByText(/Tick the high-alert confirmation/)).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have confirmed/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(within(screen.getByLabelText('Insulin volume result')).getByText('0.08')).toBeTruthy();
  });

  it('every form calculator renders and its example produces a result', () => {
    for (const def of CALCULATORS.filter((c) => c.fields && c.example)) {
      render(<App />);
      openCalc(def.name);
      if (def.highAlert) fireEvent.click(screen.getByRole('checkbox', { name: /I have confirmed|I understand/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Try example' }));
      const calcBtn = screen.queryByRole('button', { name: 'Calculate' });
      if (def.highAlert && calcBtn) fireEvent.click(calcBtn);
      expect(screen.queryByLabelText(`${def.name} result`), def.id).not.toBeNull();
      cleanup();
      localStorage.clear();
    }
  });

  it('fluid log, converter and info screens open', () => {
    render(<App />);
    openCalc('Intake & output');
    expect(screen.getByText('Net balance')).toBeTruthy();
    expect(screen.getAllByText(/^\+150/).length).toBeGreaterThan(0); // sample: 860 in − 710 out
    cleanup();
    render(<App />);
    openCalc('Unit converter');
    expect(screen.getByText('1,000')).toBeTruthy(); // 1 mg = 1,000 mcg
  });

  it('favorites persist and the quiz records progress', () => {
    render(<App />);
    openCalc('MAP'.length ? 'Mean arterial pressure' : '');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add to favorites' })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /^Favorites$/ }));
    expect(screen.getAllByText('Mean arterial pressure').length).toBeGreaterThan(0);
    expect(JSON.parse(localStorage.getItem('nursecalc.v1.favorites')!)).toContain('map');

    fireEvent.click(screen.getByRole('button', { name: /^Learn$/ }));
    fireEvent.click(screen.getByRole('button', { name: /IV rates/ }));
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    expect(screen.getByText(/Correct|Not quite/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('nursecalc.v1.progress')!).answered).toBe(1);
  });

  it('dark theme setting applies data-theme', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Settings$/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('audit regressions', () => {
  it('comma decimal is refused with a specific message and no result appears', () => {
    render(<App />);
    openCalc('BMI');
    fireEvent.change(screen.getByLabelText('Weight'), { target: { value: '60,5' } });
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '160' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(screen.getAllByText(/Use a decimal point, not a comma/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('BMI result')).toBeNull();
  });

  it('heparin shows only the fields for the chosen mode', () => {
    render(<App />);
    openCalc('Heparin');
    expect(screen.queryByLabelText('Weight')).toBeNull();
    expect(screen.queryByLabelText('Current pump rate')).toBeNull();
    fireEvent.change(screen.getByLabelText('Calculate'), { target: { value: 'weightBased' } });
    expect(screen.getByLabelText('Weight')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Calculate'), { target: { value: 'doseFromRate' } });
    expect(screen.queryByLabelText('Weight')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /I have confirmed/ }));
    fireEvent.change(screen.getByLabelText('Concentration'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Current pump rate'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(within(screen.getByLabelText('Heparin / units-based infusion result')).getByText('1,200')).toBeTruthy();
  });

  it('a hidden field with a stale value never reaches the engine', () => {
    render(<App />);
    openCalc('Oxygen cylinder duration (psi)');
    fireEvent.change(screen.getByLabelText('Cylinder size'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(/Cylinder factor/), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Cylinder size'), { target: { value: 'E' } });
    fireEvent.change(screen.getByLabelText('Gauge pressure'), { target: { value: '2000' } });
    fireEvent.change(screen.getByLabelText('Flow rate'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calculate' }));
    expect(within(screen.getByLabelText('Oxygen cylinder duration (psi) result')).getByText('252')).toBeTruthy(); // E factor 0.28, not 9
  });

  it('sequential infusion plan computes totals', () => {
    render(<App />);
    openCalc('Sequential infusion plan');
    const res = screen.getByLabelText('Sequential infusion plan result');
    expect(within(res).getByText('1,500')).toBeTruthy();
    expect(within(res).getByText(/13 hr 0 min/)).toBeTruthy();
  });

  it('daily question is only counted once per day (Back goes through browser history)', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /^Answer$/ }));
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(await screen.findByRole('button', { name: /Review today/ }));
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(JSON.parse(localStorage.getItem('nursecalc.v1.progress')!).answered).toBe(1);
  });

  it('reference cards say "Awaiting clinical review", never "verified"', () => {
    render(<App />);
    openCalc('Glasgow-Blatchford score');
    expect(screen.getAllByText('Awaiting clinical review').length).toBeGreaterThan(0);
    expect(screen.queryByText(/clinically reviewed|verified reference/i)).toBeNull();
  });
});
