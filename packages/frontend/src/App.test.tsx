import { describe, it, expect } from 'vitest';
import { render, screen } from './test/utils';
import App from './App';

describe('App', () => {
  it('renders the application title', () => {
    render(<App />);
    expect(screen.getByText(/PO AI - Automatización para Product Owners/i)).toBeInTheDocument();
  });

  it('renders the welcome message', () => {
    render(<App />);
    expect(screen.getByText(/Bienvenido a PO AI/i)).toBeInTheDocument();
  });

  it('renders the description', () => {
    render(<App />);
    expect(screen.getByText(/Sistema de automatización para la generación de historias de usuario/i)).toBeInTheDocument();
  });
});
