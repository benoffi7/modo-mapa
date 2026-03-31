import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ModerationEditor from '../ModerationEditor';

describe('ModerationEditor', () => {
  const mockOnSave = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders banned words as chips', () => {
    render(<ModerationEditor bannedWords={['spam', 'bad']} onSave={mockOnSave} />);
    expect(screen.getByText('spam')).toBeInTheDocument();
    expect(screen.getByText('bad')).toBeInTheDocument();
  });

  it('adds a word', () => {
    render(<ModerationEditor bannedWords={[]} onSave={mockOnSave} />);
    const input = screen.getByPlaceholderText('Agregar palabra');
    fireEvent.change(input, { target: { value: 'newword' } });
    fireEvent.click(screen.getByText('Agregar'));
    expect(screen.getByText('newword')).toBeInTheDocument();
  });

  it('removes a word when chip delete is clicked', () => {
    render(<ModerationEditor bannedWords={['spam', 'bad']} onSave={mockOnSave} />);
    // MUI Chip renders a delete icon as a sibling of label text
    const deleteButtons = screen.getAllByTestId('CancelIcon');
    fireEvent.click(deleteButtons[0]);
    expect(screen.queryByText('spam')).not.toBeInTheDocument();
    expect(screen.getByText('bad')).toBeInTheDocument();
  });

  it('validates empty word', () => {
    render(<ModerationEditor bannedWords={[]} onSave={mockOnSave} />);
    fireEvent.click(screen.getByText('Agregar'));
    // Nothing should be added, no error for empty
    expect(screen.getByText('Sin palabras baneadas')).toBeInTheDocument();
  });

  it('validates word too long', () => {
    render(<ModerationEditor bannedWords={[]} onSave={mockOnSave} />);
    const input = screen.getByPlaceholderText('Agregar palabra');
    fireEvent.change(input, { target: { value: 'a'.repeat(51) } });
    fireEvent.click(screen.getByText('Agregar'));
    expect(screen.getByText('La palabra no puede tener más de 50 caracteres')).toBeInTheDocument();
  });

  it('validates duplicate word', () => {
    render(<ModerationEditor bannedWords={['existing']} onSave={mockOnSave} />);
    const input = screen.getByPlaceholderText('Agregar palabra');
    fireEvent.change(input, { target: { value: 'existing' } });
    fireEvent.click(screen.getByText('Agregar'));
    expect(screen.getByText('Esta palabra ya está en la lista')).toBeInTheDocument();
  });

  it('shows confirmation dialog and saves', async () => {
    render(<ModerationEditor bannedWords={['old']} onSave={mockOnSave} />);

    // Add a word to enable save
    const input = screen.getByPlaceholderText('Agregar palabra');
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.click(screen.getByText('Agregar'));

    // Click save
    fireEvent.click(screen.getByText('Guardar cambios'));

    // Confirm dialog
    expect(screen.getByText('Confirmar cambios de moderación')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(['old', 'new']);
    });
  });

  it('shows error toast on save failure', async () => {
    mockOnSave.mockRejectedValueOnce(new Error('fail'));
    render(<ModerationEditor bannedWords={['old']} onSave={mockOnSave} />);

    // Add a word to enable save
    const input = screen.getByPlaceholderText('Agregar palabra');
    fireEvent.change(input, { target: { value: 'new' } });
    fireEvent.click(screen.getByText('Agregar'));

    fireEvent.click(screen.getByText('Guardar cambios'));
    fireEvent.click(screen.getByText('Confirmar'));

    await waitFor(() => {
      expect(screen.getByText('No se pudieron guardar los cambios')).toBeInTheDocument();
    });
  });

  it('disables save button when no changes', () => {
    render(<ModerationEditor bannedWords={['word']} onSave={mockOnSave} />);
    expect(screen.getByText('Guardar cambios')).toBeDisabled();
  });
});
