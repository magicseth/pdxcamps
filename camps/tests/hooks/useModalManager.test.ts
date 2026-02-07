import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useModalManager } from '@/hooks/useModalManager';

type TestModals = {
  confirm: { message: string };
  edit: { id: number };
  simple: undefined;
};

describe('useModalManager', () => {
  it('initializes all modals as closed', () => {
    const { result } = renderHook(() =>
      useModalManager<TestModals>(['confirm', 'edit', 'simple'])
    );

    expect(result.current.isOpen('confirm')).toBe(false);
    expect(result.current.isOpen('edit')).toBe(false);
    expect(result.current.isOpen('simple')).toBe(false);
  });

  it('opens a modal with data', () => {
    const { result } = renderHook(() =>
      useModalManager<TestModals>(['confirm', 'edit', 'simple'])
    );

    act(() => {
      result.current.open('confirm', { message: 'Are you sure?' });
    });

    expect(result.current.isOpen('confirm')).toBe(true);
    expect(result.current.getData('confirm')).toEqual({ message: 'Are you sure?' });
  });

  it('closes a modal', () => {
    const { result } = renderHook(() =>
      useModalManager<TestModals>(['confirm', 'edit', 'simple'])
    );

    act(() => {
      result.current.open('confirm', { message: 'test' });
    });
    expect(result.current.isOpen('confirm')).toBe(true);

    act(() => {
      result.current.close('confirm');
    });
    expect(result.current.isOpen('confirm')).toBe(false);
    expect(result.current.getData('confirm')).toBeNull();
  });

  it('closeAll closes all open modals', () => {
    const { result } = renderHook(() =>
      useModalManager<TestModals>(['confirm', 'edit', 'simple'])
    );

    act(() => {
      result.current.open('confirm', { message: 'test' });
      result.current.open('edit', { id: 1 });
    });

    act(() => {
      result.current.closeAll();
    });

    expect(result.current.isOpen('confirm')).toBe(false);
    expect(result.current.isOpen('edit')).toBe(false);
  });

  it('getData returns null for a closed modal', () => {
    const { result } = renderHook(() =>
      useModalManager<TestModals>(['confirm', 'edit', 'simple'])
    );

    expect(result.current.getData('confirm')).toBeNull();
  });
});
