import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import QuestionForm from '../QuestionForm';
import { MAX_COMMENTS_PER_DAY } from '../../../constants/validation';

describe('QuestionForm', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    isSubmitting: false,
    userCommentsToday: 0,
  };

  it('renders input and submit button when under daily limit', () => {
    render(<QuestionForm {...defaultProps} />);
    expect(screen.getByPlaceholderText('Hacé una pregunta...')).toBeInTheDocument();
    expect(screen.getByLabelText('Publicar pregunta')).toBeInTheDocument();
  });

  it('shows daily limit alert when at or over limit', () => {
    render(<QuestionForm {...defaultProps} userCommentsToday={MAX_COMMENTS_PER_DAY} />);
    expect(screen.getByText(/límite/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Hacé una pregunta...')).not.toBeInTheDocument();
  });

  it('calls onChange when typing', () => {
    const onChange = vi.fn();
    render(<QuestionForm {...defaultProps} onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText('Hacé una pregunta...'), { target: { value: 'test' } });
    expect(onChange).toHaveBeenCalledWith('test');
  });

  it('calls onSubmit on button click', () => {
    const onSubmit = vi.fn();
    render(<QuestionForm {...defaultProps} value="pregunta?" onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText('Publicar pregunta'));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('disables button when isSubmitting', () => {
    render(<QuestionForm {...defaultProps} value="test" isSubmitting />);
    expect(screen.getByLabelText('Publicar pregunta')).toBeDisabled();
  });

  it('disables button when value is empty', () => {
    render(<QuestionForm {...defaultProps} value="" />);
    expect(screen.getByLabelText('Publicar pregunta')).toBeDisabled();
  });

  it('shows char count when value is non-empty', () => {
    render(<QuestionForm {...defaultProps} value="hola" />);
    expect(screen.getByText(/4\//)).toBeInTheDocument();
  });

  it('calls onSubmit on Enter key', () => {
    const onSubmit = vi.fn();
    render(<QuestionForm {...defaultProps} value="pregunta" onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Hacé una pregunta...'), { key: 'Enter', shiftKey: false });
    expect(onSubmit).toHaveBeenCalled();
  });

  it('does NOT call onSubmit on Shift+Enter', () => {
    const onSubmit = vi.fn();
    render(<QuestionForm {...defaultProps} value="pregunta" onSubmit={onSubmit} />);
    fireEvent.keyDown(screen.getByPlaceholderText('Hacé una pregunta...'), { key: 'Enter', shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
