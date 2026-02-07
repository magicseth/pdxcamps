'use client';

import { useState, useCallback } from 'react';

type ModalState<T> = {
  isOpen: boolean;
  data: T | null;
};

type ModalActions<TModals extends Record<string, unknown>> = {
  [K in keyof TModals]: ModalState<TModals[K]>;
} & {
  open: <K extends keyof TModals>(name: K, ...args: TModals[K] extends undefined ? [] : [data: TModals[K]]) => void;
  close: (name: keyof TModals) => void;
  isOpen: (name: keyof TModals) => boolean;
  getData: <K extends keyof TModals>(name: K) => TModals[K] | null;
  closeAll: () => void;
};

export function useModalManager<TModals extends Record<string, unknown>>(
  modalNames: (keyof TModals)[],
): ModalActions<TModals> {
  const initialState = {} as Record<keyof TModals, ModalState<unknown>>;
  for (const name of modalNames) {
    initialState[name] = { isOpen: false, data: null };
  }

  const [state, setState] = useState(initialState);

  const open = useCallback(
    <K extends keyof TModals>(name: K, ...args: TModals[K] extends undefined ? [] : [data: TModals[K]]) => {
      const data = args[0] ?? null;
      setState((prev) => ({
        ...prev,
        [name]: { isOpen: true, data },
      }));
    },
    [],
  );

  const close = useCallback((name: keyof TModals) => {
    setState((prev) => ({
      ...prev,
      [name]: { isOpen: false, data: null },
    }));
  }, []);

  const isOpen = useCallback((name: keyof TModals) => state[name]?.isOpen ?? false, [state]);

  const getData = useCallback(
    <K extends keyof TModals>(name: K): TModals[K] | null => (state[name]?.data as TModals[K]) ?? null,
    [state],
  );

  const closeAll = useCallback(() => {
    setState((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next) as (keyof TModals)[]) {
        next[key] = { isOpen: false, data: null };
      }
      return next;
    });
  }, []);

  return {
    ...state,
    open,
    close,
    isOpen,
    getData,
    closeAll,
  } as ModalActions<TModals>;
}
