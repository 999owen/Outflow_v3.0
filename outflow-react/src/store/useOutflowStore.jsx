// useOutflowStore.js — React Context + hook wrapping trackerStore.js
import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import * as Store from './trackerStore.js';

// ─── Context ──────────────────────────────────────────────────────────────────
const OutflowContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'SET_DB':
      return { ...state, db: action.db };
    case 'SET_SYNC_STATUS':
      return { ...state, syncStatus: action.status }; // 'idle' | 'syncing' | 'synced' | 'error'
    default:
      return state;
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function OutflowProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, {
    db: Store.load(),
    syncStatus: 'idle',
  });

  const refresh = useCallback(() => {
    dispatch({ type: 'SET_DB', db: Store.load() });
  }, []);

  // Debounced refresh — collapses rapid successive saves (e.g. save → async gist
  // push → persist again) into a single re-render so mid-animation store updates
  // don't corrupt Framer Motion's exit/enter lifecycle.
  const debounceTimer = useRef(null);
  const debouncedRefresh = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      dispatch({ type: 'SET_DB', db: Store.load() });
    }, 50);
  }, []);

  // Re-hydrate whenever another tab or window writes.
  // Keep stable named references so the cleanup can actually remove the same fn.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === Store.STORAGE_KEY || e.key === null) debouncedRefresh();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('tracker-updated', debouncedRefresh);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('tracker-updated', debouncedRefresh);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [debouncedRefresh]);

  // Auto-pull on load
  useEffect(() => {
    const pull = async () => {
      if (!state.db.settings.github_token) return;
      dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' });
      const pulled = await Store.pullFromGist();
      if (pulled) dispatch({ type: 'SET_DB', db: Store.load() });
      dispatch({ type: 'SET_SYNC_STATUS', status: pulled ? 'synced' : 'idle' });
    };
    pull();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <OutflowContext.Provider value={{ state, dispatch, refresh }}>
      {children}
    </OutflowContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useOutflowStore() {
  const ctx = useContext(OutflowContext);
  if (!ctx) throw new Error('useOutflowStore must be used inside <OutflowProvider>');
  const { state, refresh } = ctx;
  const { db, syncStatus } = state;

  const fmt = Store.formatter(db);
  const totals = Store.summary(db);

  // ── Entries ────────────────────────────────────────────────────────────────
  const addEntry = useCallback((type, entry) => {
    Store.addEntry(type, entry);
    refresh();
  }, [refresh]);

  const deleteEntry = useCallback((type, id) => {
    Store.deleteEntry(type, id);
    refresh();
  }, [refresh]);

  // ── Bills ──────────────────────────────────────────────────────────────────
  const addBill = useCallback((bill) => {
    Store.addBill(bill);
    refresh();
  }, [refresh]);

  const updateBill = useCallback((id, updates) => {
    Store.updateBill(id, updates);
    refresh();
  }, [refresh]);

  const deleteBill = useCallback((id) => {
    Store.deleteBill(id);
    refresh();
  }, [refresh]);

  // ── Settings ───────────────────────────────────────────────────────────────
  const updateSetting = useCallback((key, value) => {
    Store.updateSetting(key, value);
    refresh();
  }, [refresh]);

  // ── Data management ────────────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    Store.clear();
    refresh();
  }, [refresh]);

  const exportData = useCallback(() => {
    Store.exportToFile(db);
  }, [db]);

  const importData = useCallback((text) => {
    const result = Store.importFromJSON(text, Store.load());
    refresh();
    return result;
  }, [refresh]);

  const syncNow = useCallback(async () => {
    ctx.dispatch({ type: 'SET_SYNC_STATUS', status: 'syncing' });
    try {
      await Store.pushToGist(db);
      ctx.dispatch({ type: 'SET_SYNC_STATUS', status: 'synced' });
    } catch {
      ctx.dispatch({ type: 'SET_SYNC_STATUS', status: 'error' });
    }
  }, [db, ctx]);

  return {
    db,
    fmt,
    totals,
    syncStatus,
    addEntry,
    deleteEntry,
    addBill,
    updateBill,
    deleteBill,
    updateSetting,
    clearAll,
    exportData,
    importData,
    syncNow,
    refresh,
    // Store helpers passed through
    getAllExpenses: () => Store.getAllExpenses(db),
    expensesByWeek: (n) => Store.expensesByWeek(db, n),
    groceryByWeek: (n) => Store.groceryByWeek(db, n),
    groceryThisWeek: () => Store.groceryThisWeek(db),
  };
}
