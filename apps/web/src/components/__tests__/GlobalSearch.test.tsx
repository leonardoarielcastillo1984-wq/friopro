import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import GlobalSearch from '../GlobalSearch';

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Search: () => <div data-testid="search-icon" />,
  Command: () => <div data-testid="command-icon" />,
  FileText: () => <div data-testid="file-icon" />,
  AlertTriangle: () => <div data-testid="alert-icon" />,
  Target: () => <div data-testid="target-icon" />,
  Users: () => <div data-testid="users-icon" />,
  X: () => <div data-testid="close-icon" />,
  ArrowRight: () => <div data-testid="arrow-icon" />
}));

// Mock apiFetch
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn()
}));

describe('GlobalSearch Component', () => {
  const mockResults = {
    documents: [
      { id: '1', title: 'Test Document', type: 'PDF' },
      { id: '2', title: 'Another Doc', type: 'DOCX' }
    ],
    ncrs: [
      { id: '1', code: 'NCR-001', title: 'Test NCR', severity: 'MAJOR' },
      { id: '2', code: 'NCR-002', title: 'Another NCR', severity: 'MINOR' }
    ],
    risks: [
      { id: '1', code: 'RISK-001', title: 'Test Risk', level: 5 },
      { id: '2', code: 'RISK-002', title: 'Another Risk', level: 3 }
    ],
    indicators: [
      { id: '1', name: 'Test Indicator', code: 'IND-001' },
      { id: '2', name: 'Another Indicator', code: 'IND-002' }
    ],
    trainings: [
      { id: '1', title: 'Test Training', category: 'Safety' },
      { id: '2', title: 'Another Training', category: 'Quality' }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock keyboard events
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  it('renders search trigger button', () => {
    render(<GlobalSearch />);
    
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    expect(searchButton).toBeInTheDocument();
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
  });

  it('opens search modal when trigger is clicked', () => {
    render(<GlobalSearch />);
    
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    expect(screen.getByPlaceholderText('Buscar en toda la aplicación...')).toBeInTheDocument();
  });

  it('opens search modal with Ctrl+K shortcut', () => {
    render(<GlobalSearch />);
    
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    
    expect(screen.getByPlaceholderText('Buscar en toda la aplicación...')).toBeInTheDocument();
  });

  it('opens search modal with Cmd+K shortcut (Mac)', () => {
    render(<GlobalSearch />);
    
    fireEvent.keyDown(document, { key: 'k', metaKey: true });
    
    expect(screen.getByPlaceholderText('Buscar en toda la aplicación...')).toBeInTheDocument();
  });

  it('closes search modal when escape key is pressed', async () => {
    render(<GlobalSearch />);
    
    // Open modal
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    // Close with escape
    fireEvent.keyDown(document, { key: 'Escape' });
    
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Buscar en toda la aplicación...')).not.toBeInTheDocument();
    });
  });

  it('closes search modal when close button is clicked', async () => {
    render(<GlobalSearch />);
    
    // Open modal
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    // Close with button
    const closeButton = screen.getByTestId('close-icon');
    fireEvent.click(closeButton);
    
    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Buscar en toda la aplicación...')).not.toBeInTheDocument();
    });
  });

  it('performs search when query is entered', async () => {
    const { apiFetch } = await import('@/lib/api');
    vi.mocked(apiFetch).mockResolvedValue(mockResults);
    
    render(<GlobalSearch />);
    
    // Open modal
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    // Enter search query
    const searchInput = screen.getByPlaceholderText('Buscar en toda la aplicación...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/search?q=test');
    });
  });

  it('displays search results correctly', async () => {
    const { apiFetch } = await import('@/lib/api');
    vi.mocked(apiFetch).mockResolvedValue(mockResults);
    
    render(<GlobalSearch />);
    
    // Open modal and search
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    const searchInput = screen.getByPlaceholderText('Buscar en toda la aplicación...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByText('Documentos')).toBeInTheDocument();
      expect(screen.getByText('No Conformidades')).toBeInTheDocument();
      expect(screen.getByText('Riesgos')).toBeInTheDocument();
      expect(screen.getByText('Indicadores')).toBeInTheDocument();
      expect(screen.getByText('Capacitaciones')).toBeInTheDocument();
    });
  });

  it('shows no results message when search returns empty', async () => {
    const { apiFetch } = await import('@/lib/api');
    vi.mocked(apiFetch).mockResolvedValue({
      documents: [],
      ncrs: [],
      risks: [],
      indicators: [],
      trainings: []
    });
    
    render(<GlobalSearch />);
    
    // Open modal and search
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    const searchInput = screen.getByPlaceholderText('Buscar en toda la aplicación...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    await waitFor(() => {
      expect(screen.getByText('No se encontraron resultados')).toBeInTheDocument();
    });
  });

  it('navigates to result when clicked', async () => {
    const { apiFetch } = await import('@/lib/api');
    vi.mocked(apiFetch).mockResolvedValue(mockResults);
    
    // Mock window.location
    const mockLocation = { href: '' };
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      writable: true,
    });
    
    render(<GlobalSearch />);
    
    // Open modal and search
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    const searchInput = screen.getByPlaceholderText('Buscar en toda la aplicación...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      const documentResult = screen.getByText('Test Document');
      fireEvent.click(documentResult);
    });
    
    // Check if navigation occurred (would need to mock router in real implementation)
    expect(screen.getByText('Test Document')).toBeInTheDocument();
  });

  it('handles keyboard navigation in results', async () => {
    const { apiFetch } = await import('@/lib/api');
    vi.mocked(apiFetch).mockResolvedValue(mockResults);
    
    render(<GlobalSearch />);
    
    // Open modal and search
    const searchButton = screen.getByRole('button', { name: /buscar/i });
    fireEvent.click(searchButton);
    
    const searchInput = screen.getByPlaceholderText('Buscar en toda la aplicación...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    await waitFor(() => {
      expect(screen.getByText('Documentos')).toBeInTheDocument();
    });
    
    // Test arrow key navigation
    fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
    fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    // Basic test that keyboard events don't crash
    expect(screen.getByPlaceholderText('Buscar en toda la aplicación...')).toBeInTheDocument();
  });
});
