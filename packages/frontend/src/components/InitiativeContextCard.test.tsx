import { describe, it, expect } from 'vitest';
import { render, screen } from '../test/utils';
import InitiativeContextCard, { getProgressBarColor } from './InitiativeContextCard';

describe('InitiativeContextCard', () => {
  it('renders placeholder when all props are empty/null', () => {
    render(
      <InitiativeContextCard
        tribu=""
        squad=""
        tipoIniciativa=""
        anioEjecucion=""
        avanceEsperado={null}
        avanceReal={null}
      />,
    );
    expect(
      screen.getByText('Contexto de iniciativa no disponible'),
    ).toBeInTheDocument();
  });

  it('renders metadata badges with values', () => {
    render(
      <InitiativeContextCard
        tribu="Digital"
        squad="Alpha"
        tipoIniciativa="Estratégica"
        anioEjecucion="2025"
        avanceEsperado={80}
        avanceReal={70}
      />,
    );
    expect(screen.getByText('Digital')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Estratégica')).toBeInTheDocument();
    expect(screen.getByText('2025')).toBeInTheDocument();
  });

  it('renders "—" for missing text values', () => {
    render(
      <InitiativeContextCard
        tribu=""
        squad="Alpha"
        tipoIniciativa=""
        anioEjecucion="2025"
        avanceEsperado={null}
        avanceReal={null}
      />,
    );
    const dashes = screen.getAllByText('—');
    expect(dashes.length).toBe(2);
  });

  it('renders Spanish labels for badges', () => {
    render(
      <InitiativeContextCard
        tribu="Digital"
        squad="Alpha"
        tipoIniciativa="Estratégica"
        anioEjecucion="2025"
        avanceEsperado={50}
        avanceReal={40}
      />,
    );
    expect(screen.getByText('Tribu:')).toBeInTheDocument();
    expect(screen.getByText('Squad:')).toBeInTheDocument();
    expect(screen.getByText('Tipo de Iniciativa:')).toBeInTheDocument();
    expect(screen.getByText('Año:')).toBeInTheDocument();
  });

  it('renders progress bars with percentage values', () => {
    render(
      <InitiativeContextCard
        tribu="Digital"
        squad="Alpha"
        tipoIniciativa="Estratégica"
        anioEjecucion="2025"
        avanceEsperado={80}
        avanceReal={65}
      />,
    );
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('65%')).toBeInTheDocument();
    expect(screen.getByText('Avance Esperado')).toBeInTheDocument();
    expect(screen.getByText('Avance Real')).toBeInTheDocument();
  });

  it('renders "Sin datos" when avance values are null', () => {
    render(
      <InitiativeContextCard
        tribu="Digital"
        squad="Alpha"
        tipoIniciativa="Estratégica"
        anioEjecucion="2025"
        avanceEsperado={null}
        avanceReal={null}
      />,
    );
    const sinDatos = screen.getAllByText('Sin datos');
    expect(sinDatos.length).toBe(2);
  });

  it('renders "Sin datos" for only one null avance value', () => {
    render(
      <InitiativeContextCard
        tribu="Digital"
        squad="Alpha"
        tipoIniciativa="Estratégica"
        anioEjecucion="2025"
        avanceEsperado={80}
        avanceReal={null}
      />,
    );
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });

  it('does not show placeholder when at least one prop has a value', () => {
    render(
      <InitiativeContextCard
        tribu="Digital"
        squad=""
        tipoIniciativa=""
        anioEjecucion=""
        avanceEsperado={null}
        avanceReal={null}
      />,
    );
    expect(
      screen.queryByText('Contexto de iniciativa no disponible'),
    ).not.toBeInTheDocument();
  });
});

describe('getProgressBarColor', () => {
  it('returns green when avanceReal is within 10pp of avanceEsperado', () => {
    expect(getProgressBarColor(80, 75)).toBe('#009056');
  });

  it('returns green when avanceReal equals avanceEsperado', () => {
    expect(getProgressBarColor(50, 50)).toBe('#009056');
  });

  it('returns green at exactly 10pp difference', () => {
    expect(getProgressBarColor(80, 70)).toBe('#009056');
  });

  it('returns red when avanceReal is more than 10pp behind', () => {
    expect(getProgressBarColor(80, 69)).toBe('#DC2626');
  });

  it('returns green when avanceReal exceeds avanceEsperado', () => {
    expect(getProgressBarColor(50, 90)).toBe('#009056');
  });
});
