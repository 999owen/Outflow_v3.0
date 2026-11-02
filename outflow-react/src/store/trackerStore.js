// trackerStore.js — Ported directly from store.js (Outflow v3.0)
// Pure JS module, no React dependency. All logic is identical to the original.

export const STORAGE_KEY = 'owens_tracker_data';
export const SCHEMA_VERSION = 2;
export const TYPES = ['income', 'spend', 'grocery'];
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];

export const DEFAULT_SETTINGS = {
  spending_percentage: 35,
  monthly_grocery_limit: 280,
  currency: 'USD',
  github_token: '',
  gist_id: '',
  user_name: '',
  savings_goal_name: 'Emergency Fund',
  savings_goal_target: 1000,
  savings_goal_current: 0,
  savings_goal_date: '',
};

export function emptyData() {
  return {
    schema_version: SCHEMA_VERSION,
    last_updated: null,
    settings: { ...DEFAULT_SETTINGS },
    income_entries: [],
    spend_entries: [],
    grocery_entries: [],
    recurring_bills: [],
  };
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'e-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
}

// 'YYYY-MM-DD' parsed as LOCAL date
export function parseDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (
    d.getFullYear() !== Number(m[1]) ||
    d.getMonth() !== Number(m[2]) - 1 ||
    d.getDate() !== Number(m[3])
  ) {
    return null;
  }
  return d;
}

function isValidDate(value) {
  return parseDate(value) !== null;
}

export function weekKey(value) {
  if (!value) return null;
  let etDate;
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
    if (!m) return null;
    etDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  } else if (value instanceof Date) {
    const etString = value.toLocaleString('en-US', { timeZone: 'America/New_York' });
    etDate = new Date(etString);
  } else return null;

  etDate.setHours(etDate.getHours() - 3);
  const offset = (etDate.getDay() + 1) % 7;
  etDate.setDate(etDate.getDate() - offset);

  return (
    etDate.getFullYear() +
    '-' +
    String(etDate.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(etDate.getDate()).padStart(2, '0')
  );
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

export function normalizeSettings(raw) {
  const s = Object.assign({}, DEFAULT_SETTINGS, raw && typeof raw === 'object' ? raw : {});
  return {
    spending_percentage: clampNumber(s.spending_percentage, DEFAULT_SETTINGS.spending_percentage, 1, 100),
    monthly_grocery_limit: clampNumber(s.monthly_grocery_limit, DEFAULT_SETTINGS.monthly_grocery_limit, 0.01, 1e9),
    currency: SUPPORTED_CURRENCIES.indexOf(s.currency) > -1 ? s.currency : DEFAULT_SETTINGS.currency,
    github_token: s.github_token ? String(s.github_token) : '',
    gist_id: s.gist_id ? String(s.gist_id) : '',
    user_name: s.user_name ? String(s.user_name).trim() : '',
    savings_goal_name: s.savings_goal_name ? String(s.savings_goal_name).trim() : DEFAULT_SETTINGS.savings_goal_name,
    savings_goal_target: clampNumber(s.savings_goal_target, DEFAULT_SETTINGS.savings_goal_target, 0, 1e12),
    savings_goal_current: clampNumber(s.savings_goal_current, DEFAULT_SETTINGS.savings_goal_current, 0, 1e12),
    savings_goal_date: isValidDate(s.savings_goal_date) ? String(s.savings_goal_date) : '',
  };
}

function normalizeEntries(rawList) {
  const entries = [];
  let skipped = 0;
  (Array.isArray(rawList) ? rawList : []).forEach((e) => {
    if (!e || typeof e !== 'object') { skipped++; return; }
    const amount = parseFloat(e.amount);
    if (!isValidDate(e.date) || !isFinite(amount) || amount <= 0) { skipped++; return; }

    let category = e.category === undefined || e.category === null ? '' : String(e.category);
    if (!category) {
      category = 'Groceries';
    } else if (!['Groceries', 'Cost', 'Personal Spend'].includes(category)) {
      category = 'Personal Spend';
    }

    entries.push({
      id: typeof e.id === 'string' && e.id ? e.id : newId(),
      date: String(e.date),
      amount: Math.round(amount * 100) / 100,
      notes: e.notes === undefined || e.notes === null ? '' : String(e.notes),
      category,
    });
  });
  return { entries, skipped };
}

function normalizeBills(rawList) {
  const bills = [];
  let skipped = 0;
  (Array.isArray(rawList) ? rawList : []).forEach((b) => {
    if (!b || typeof b !== 'object') { skipped++; return; }
    const amount = parseFloat(b.amount);
    if (!b.name || typeof b.name !== 'string' || !isFinite(amount) || amount < 0) { skipped++; return; }

    let type = b.type === 'variable' ? 'variable' : 'fixed';
    let dueDay = parseInt(b.dueDay);
    if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 1;

    let actualAmount = b.actualAmount !== null && b.actualAmount !== undefined ? parseFloat(b.actualAmount) : null;
    if (actualAmount !== null && !isFinite(actualAmount)) actualAmount = null;

    bills.push({
      id: typeof b.id === 'string' && b.id ? b.id : newId(),
      name: String(b.name).trim(),
      type,
      amount: Math.round(amount * 100) / 100,
      actualAmount: actualAmount !== null ? Math.round(actualAmount * 100) / 100 : null,
      dueDay,
      isAutoPaid: !!b.isAutoPaid,
      isActive: b.isActive !== undefined ? !!b.isActive : true,
      lastUpdatedMonth: b.lastUpdatedMonth ? String(b.lastUpdatedMonth) : null,
    });
  });
  return { entries: bills, skipped };
}

export function normalize(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { db: emptyData(), skipped: 0, addedIds: false };
  }

  const db = emptyData();
  db.settings = normalizeSettings(raw.settings);
  db.last_updated = typeof raw.last_updated === 'string' ? raw.last_updated : null;

  let skipped = 0;
  let addedIds = false;

  TYPES.forEach((type) => {
    const key = type + '_entries';
    const rawList = Array.isArray(raw[key]) ? raw[key] : [];
    const result = normalizeEntries(rawList);
    if (rawList.some((e) => e && typeof e === 'object' && !e.id)) addedIds = true;
    db[key] = result.entries;
    skipped += result.skipped;
  });

  const rawBillsList = Array.isArray(raw.recurring_bills) ? raw.recurring_bills : [];
  const billsResult = normalizeBills(rawBillsList);
  if (rawBillsList.some((b) => b && typeof b === 'object' && !b.id)) addedIds = true;
  db.recurring_bills = billsResult.entries;
  skipped += billsResult.skipped;

  return { db, skipped, addedIds };
}

export function load() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return emptyData();
  }
  if (!raw) return emptyData();

  let result;
  try {
    result = normalize(JSON.parse(raw));
  } catch {
    return emptyData();
  }

  if (result.addedIds || result.db.schema_version !== SCHEMA_VERSION || result.skipped > 0) {
    try { persist(result.db); } catch { /* read-only is still usable */ }
  }
  return result.db;
}

export function persist(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  try {
    window.dispatchEvent(new Event('tracker-updated'));
  } catch {}
  return db;
}

export function save(db, isSyncSetting = false) {
  db.schema_version = SCHEMA_VERSION;
  if (!isSyncSetting) {
    db.last_updated = new Date().toISOString();
  }
  try {
    persist(db);
    if (!isSyncSetting) {
      pushToGist(db);
    }
  } catch (err) {
    const quota = err && (err.name === 'QuotaExceededError' || err.code === 22);
    throw new Error(
      quota
        ? 'Storage is full. Export a backup and clear some entries.'
        : 'Could not save your data. Check that browser storage is enabled.'
    );
  }
  return db;
}

export function addEntry(type, entry) {
  if (!TYPES.includes(type)) throw new Error('Unknown entry type: ' + type);
  const amount = parseFloat(entry.amount);
  if (!isValidDate(entry.date)) throw new Error('Please enter a valid date.');
  if (!isFinite(amount) || amount <= 0) throw new Error('Please enter an amount greater than zero.');

  const db = load();
  db[type + '_entries'].push({
    id: newId(),
    date: String(entry.date),
    amount: Math.round(amount * 100) / 100,
    notes: entry.notes ? String(entry.notes) : '',
    category: entry.category
      ? String(entry.category)
      : type === 'grocery'
      ? 'Groceries'
      : 'Discretionary / Personal',
  });
  return save(db);
}

export function deleteEntry(type, id) {
  if (!TYPES.includes(type)) throw new Error('Unknown entry type: ' + type);
  const db = load();
  const list = db[type + '_entries'];
  const i = list.findIndex((e) => e.id === id);
  if (i > -1) {
    list.splice(i, 1);
    return save(db);
  }
  return db;
}

export function updateSetting(key, value) {
  const db = load();
  const next = { ...db.settings };
  if (key && typeof key === 'object') {
    Object.assign(next, key);
  } else {
    next[key] = value;
  }
  db.settings = normalizeSettings(next);
  const isSyncSetting = key === 'github_token' || key === 'gist_id';
  return save(db, isSyncSetting);
}

export function clear() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new Error('Could not clear your data. Check that browser storage is enabled.');
  }
  return emptyData();
}

export function getAllExpenses(db) {
  const all = [
    ...db.spend_entries.map((e) => ({ ...e, entry_type: 'spend' })),
    ...db.grocery_entries.map((e) => ({
      ...e,
      entry_type: 'grocery',
      category: e.category || 'Groceries',
    })),
  ];
  return all.sort((a, b) => parseDate(a.date) - parseDate(b.date));
}

function sum(list) {
  return list.reduce((total, e) => total + e.amount, 0);
}

export function summary(db) {
  const allExpenses = getAllExpenses(db);
  const earned = sum(db.income_entries);
  const spent = sum(
    allExpenses.filter((e) => e.entry_type === 'spend' && e.category !== 'Groceries')
  );
  const grocery = sum(
    allExpenses.filter((e) => e.entry_type === 'grocery' || e.category === 'Groceries')
  );
  const allowance = earned * (db.settings.spending_percentage / 100);

  const now = new Date();
  const currentMonth =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  const groceryThisMonth = sum(
    allExpenses.filter((e) => {
      if (e.entry_type !== 'grocery' && e.category !== 'Groceries') return false;
      const d = parseDate(e.date);
      return d && d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') === currentMonth;
    })
  );

  return {
    earned,
    spent,
    grocery,
    totalSpent: spent,
    allowance,
    remaining: allowance - spent,
    saved: earned - allowance,
    groceryThisMonth,
    groceryLeft: db.settings.monthly_grocery_limit - groceryThisMonth,
    thisWeekKey: weekKey(new Date()),
  };
}

export function groceryThisWeek(db) {
  const current = weekKey(new Date());
  const allExpenses = getAllExpenses(db);
  return sum(
    allExpenses.filter(
      (e) =>
        (e.entry_type === 'grocery' || e.category === 'Groceries') &&
        weekKey(e.date) === current
    )
  );
}

export function groceryByWeek(db, count) {
  const totals = {};
  const allExpenses = getAllExpenses(db);
  allExpenses.forEach((e) => {
    if (e.entry_type === 'grocery' || e.category === 'Groceries') {
      const key = weekKey(e.date);
      if (key) totals[key] = (totals[key] || 0) + e.amount;
    }
  });

  const weeks = [];
  const currentKey = weekKey(new Date());
  const cursor = parseDate(currentKey);
  if (!cursor) return weeks;
  for (let i = 0; i < count; i++) {
    const key =
      cursor.getFullYear() +
      '-' +
      String(cursor.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(cursor.getDate()).padStart(2, '0');
    weeks.unshift({
      key,
      label: i === 0 ? 'This Week' : cursor.getMonth() + 1 + '/' + cursor.getDate(),
      total: totals[key] || 0,
    });
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

export function expensesByWeek(db, count) {
  const totals = {};
  const allExpenses = getAllExpenses(db);
  allExpenses.forEach((e) => {
    const key = weekKey(e.date);
    if (!key) return;
    if (!totals[key]) totals[key] = { cost: 0, personal: 0, grocery: 0 };
    if (e.entry_type === 'grocery' || e.category === 'Groceries') {
      totals[key].grocery += e.amount;
    } else if (e.category === 'Cost') {
      totals[key].cost += e.amount;
    } else {
      totals[key].personal += e.amount;
    }
  });

  const weeks = [];
  const currentKey = weekKey(new Date());
  const cursor = parseDate(currentKey);
  if (!cursor) return weeks;
  for (let i = 0; i < count; i++) {
    const key =
      cursor.getFullYear() +
      '-' +
      String(cursor.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(cursor.getDate()).padStart(2, '0');
    weeks.unshift({
      key,
      label: i === 0 ? 'This Week' : cursor.getMonth() + 1 + '/' + cursor.getDate(),
      costTotal: totals[key]?.cost ?? 0,
      personalTotal: totals[key]?.personal ?? 0,
      groceryTotal: totals[key]?.grocery ?? 0,
    });
    cursor.setDate(cursor.getDate() - 7);
  }
  return weeks;
}

export function formatter(db) {
  const currency = (db.settings && db.settings.currency) || 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency });
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  }
}

export function exportToFile(db) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  const payload = { ...db, exported_at: now.toISOString() };
  if (payload.settings) {
    payload.settings = { ...payload.settings };
    delete payload.settings.github_token;
    delete payload.settings.gist_id;
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'outflow-backup-' + stamp + '.json';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function importFromJSON(text, currentDb) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON.');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('That backup is not in the expected format.');
  }
  const hasAnyList = TYPES.some((t) => Array.isArray(parsed[t + '_entries']));
  if (!hasAnyList) throw new Error('That file contains no income, spend or grocery entries.');

  const result = normalize(parsed);

  let importedCount = 0;
  TYPES.forEach((type) => {
    const key = type + '_entries';
    const existingIds = new Set(currentDb[key].map((e) => e.id));
    result.db[key].forEach((entry) => {
      if (!existingIds.has(entry.id)) {
        currentDb[key].push(entry);
        importedCount++;
      }
    });
  });

  const existingBillIds = new Set(currentDb.recurring_bills.map((b) => b.id));
  result.db.recurring_bills.forEach((bill) => {
    if (!existingBillIds.has(bill.id)) {
      currentDb.recurring_bills.push(bill);
      importedCount++;
    }
  });

  const token = currentDb.settings.github_token;
  const gistId = currentDb.settings.gist_id;
  const existingGoalName = currentDb.settings.savings_goal_name;
  const existingGoalTarget = currentDb.settings.savings_goal_target;
  const existingGoalCurrent = currentDb.settings.savings_goal_current;
  const existingGoalDate = currentDb.settings.savings_goal_date;
  const existingUserName = currentDb.settings.user_name;

  currentDb.settings = result.db.settings;
  if (token && !currentDb.settings.github_token) currentDb.settings.github_token = token;
  if (gistId && !currentDb.settings.gist_id) currentDb.settings.gist_id = gistId;
  if (existingUserName && !parsed?.settings?.user_name) currentDb.settings.user_name = existingUserName;
  if (parsed?.settings?.savings_goal_target === undefined && existingGoalTarget !== undefined) {
    currentDb.settings.savings_goal_target = existingGoalTarget;
    currentDb.settings.savings_goal_current = existingGoalCurrent;
    currentDb.settings.savings_goal_name = existingGoalName;
    currentDb.settings.savings_goal_date = existingGoalDate;
  }

  if (importedCount === 0 && result.skipped > 0) {
    throw new Error('Every entry in that file was invalid or already exists.');
  }

  save(currentDb);
  return { db: currentDb, imported: importedCount, skipped: result.skipped };
}

export function addBill(bill) {
  const amount = parseFloat(bill.amount);
  if (!bill.name || !isFinite(amount) || amount < 0) throw new Error('Invalid bill data.');
  const db = load();
  let type = bill.type === 'variable' ? 'variable' : 'fixed';
  let dueDay = parseInt(bill.dueDay);
  if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 1;
  let actualAmount =
    bill.actualAmount !== null && bill.actualAmount !== undefined
      ? parseFloat(bill.actualAmount)
      : null;
  if (actualAmount !== null && !isFinite(actualAmount)) actualAmount = null;

  const newBill = {
    id: newId(),
    name: String(bill.name).trim(),
    type,
    amount: Math.round(amount * 100) / 100,
    actualAmount: actualAmount !== null ? Math.round(actualAmount * 100) / 100 : null,
    dueDay,
    isAutoPaid: !!bill.isAutoPaid,
    isActive: bill.isActive !== undefined ? !!bill.isActive : true,
    lastUpdatedMonth: bill.lastUpdatedMonth ? String(bill.lastUpdatedMonth) : null,
  };
  db.recurring_bills.push(newBill);
  save(db);
  return newBill;
}

export function updateBill(id, updates, db) {
  const currentDb = db || load();
  const index = currentDb.recurring_bills.findIndex((b) => b.id === id);
  if (index === -1) throw new Error('Bill not found.');
  const b = currentDb.recurring_bills[index];
  if (updates.name !== undefined) b.name = String(updates.name).trim();
  if (updates.type !== undefined) b.type = updates.type === 'variable' ? 'variable' : 'fixed';
  if (updates.amount !== undefined) {
    const amt = parseFloat(updates.amount);
    if (isFinite(amt) && amt >= 0) b.amount = Math.round(amt * 100) / 100;
  }
  if (updates.actualAmount !== undefined) {
    if (updates.actualAmount === null) {
      b.actualAmount = null;
    } else {
      const actAmt = parseFloat(updates.actualAmount);
      if (isFinite(actAmt)) b.actualAmount = Math.round(actAmt * 100) / 100;
    }
  }
  if (updates.dueDay !== undefined) {
    let dueDay = parseInt(updates.dueDay);
    b.dueDay = !isNaN(dueDay) && dueDay >= 1 && dueDay <= 31 ? dueDay : 1;
  }
  if (updates.isAutoPaid !== undefined) b.isAutoPaid = !!updates.isAutoPaid;
  if (updates.isActive !== undefined) b.isActive = !!updates.isActive;
  if (updates.lastUpdatedMonth !== undefined)
    b.lastUpdatedMonth = updates.lastUpdatedMonth ? String(updates.lastUpdatedMonth) : null;
  save(currentDb);
  return currentDb;
}

export function deleteBill(id) {
  const db = load();
  const initialLength = db.recurring_bills.length;
  db.recurring_bills = db.recurring_bills.filter((b) => b.id !== id);
  if (db.recurring_bills.length < initialLength) save(db);
  return db;
}

export async function pushToGist(db) {
  if (!db.settings.github_token) return;
  const payload = { ...db };
  payload.settings = { ...db.settings };
  const token = payload.settings.github_token;
  const gistId = payload.settings.gist_id;
  delete payload.settings.github_token;
  delete payload.settings.gist_id;
  const content = JSON.stringify(payload, null, 2);
  const headers = {
    Authorization: 'token ' + token,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
  const body = JSON.stringify({
    description: "Owen's Spending Tracker Backup",
    public: false,
    files: { 'owens_tracker_backup.json': { content } },
  });
  try {
    if (gistId) {
      const checkRes = await fetch('https://api.github.com/gists/' + gistId, {
        headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' },
        cache: 'no-store',
      });
      if (checkRes.ok) {
        const data = await checkRes.json();
        const file = data.files['owens_tracker_backup.json'];
        if (file && file.content) {
          const remoteDb = normalize(JSON.parse(file.content)).db;
          const localDate = db.last_updated ? new Date(db.last_updated) : new Date(0);
          const remoteDate = remoteDb.last_updated ? new Date(remoteDb.last_updated) : new Date(0);
          if (remoteDate > localDate) {
            pullFromGist();
            return;
          }
        }
      }
      const res = await fetch('https://api.github.com/gists/' + gistId, {
        method: 'PATCH',
        headers,
        body,
      });
      if (!res.ok) throw new Error('Failed to update Gist');
    } else {
      const res = await fetch('https://api.github.com/gists', { method: 'POST', headers, body });
      if (!res.ok) throw new Error('Failed to create Gist');
      const data = await res.json();
      const currentDb = load();
      if (currentDb.settings.github_token === token) {
        currentDb.settings = normalizeSettings({ ...currentDb.settings, gist_id: data.id });
        persist(currentDb);
      }
    }
  } catch (err) {
    console.error('Gist push error:', err);
  }
}

export async function pullFromGist() {
  const currentDb = load();
  const { github_token: token, gist_id: gistId } = currentDb.settings;
  if (!token || !gistId) return false;
  try {
    const res = await fetch('https://api.github.com/gists/' + gistId, {
      headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github.v3+json' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error('Failed to fetch Gist');
    const data = await res.json();
    const file = data.files['owens_tracker_backup.json'];
    if (!file || !file.content) return false;
    const remoteDb = normalize(JSON.parse(file.content)).db;
    const localDate = currentDb.last_updated ? new Date(currentDb.last_updated) : new Date(0);
    const remoteDate = remoteDb.last_updated ? new Date(remoteDb.last_updated) : new Date(0);
    if (remoteDate > localDate) {
      remoteDb.settings.github_token = token;
      remoteDb.settings.gist_id = gistId;
      persist(remoteDb);
      return true;
    }
    return false;
  } catch (err) {
    console.error('Gist pull error:', err);
    return false;
  }
}

export function getInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  const cleaned = name.trim();
  if (!cleaned) return 'U';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const letters = parts[0].replace(/[^a-zA-Z0-9]/g, '');
    return (letters.slice(0, 2) || parts[0].slice(0, 1)).toUpperCase();
  }
  const first = parts[0].replace(/[^a-zA-Z0-9]/g, '')[0] || parts[0][0];
  const last = parts[parts.length - 1].replace(/[^a-zA-Z0-9]/g, '')[0] || parts[parts.length - 1][0];
  return (first + last).toUpperCase();
}

export function getFinancialProjections(db) {
  const now = new Date();
  const currentMonthStr =
    now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

  // 1. Recurring bills committed monthly
  const activeBills = (Array.isArray(db?.recurring_bills) ? db.recurring_bills : []).filter(
    (b) => !!b?.isActive
  );
  const monthlyBills = activeBills.reduce((acc, b) => {
    const cost =
      b?.type === 'variable' &&
      b?.actualAmount !== null &&
      b?.actualAmount !== undefined &&
      b?.lastUpdatedMonth === currentMonthStr
        ? Number(b.actualAmount) || 0
        : Number(b?.amount) || 0;
    return acc + cost;
  }, 0);

  // 2. Income analysis
  const incomeEntries = Array.isArray(db?.income_entries) ? db.income_entries : [];
  const incomeByMonth = {};
  incomeEntries.forEach((e) => {
    if (!e?.date || !isFinite(Number(e?.amount))) return;
    const m = String(e.date).slice(0, 7);
    incomeByMonth[m] = (incomeByMonth[m] || 0) + Number(e.amount);
  });
  const incomeMonths = Object.keys(incomeByMonth);
  const totalIncomeAllTime = incomeEntries.reduce((acc, e) => acc + (Number(e?.amount) || 0), 0);
  const avgMonthlyIncome =
    incomeMonths.length > 0 ? totalIncomeAllTime / incomeMonths.length : totalIncomeAllTime;

  // 3. Expenses analysis (Spend + Groceries)
  const allExpenses = getAllExpenses(db);
  const expensesByMonth = {};
  allExpenses.forEach((e) => {
    if (!e?.date || !isFinite(Number(e?.amount))) return;
    const m = String(e.date).slice(0, 7);
    expensesByMonth[m] = (expensesByMonth[m] || 0) + Number(e.amount);
  });
  const expenseMonths = Object.keys(expensesByMonth);
  const totalExpensesAllTime = allExpenses.reduce((acc, e) => acc + (Number(e?.amount) || 0), 0);
  const avgMonthlyVariableExpenses =
    expenseMonths.length > 0 ? totalExpensesAllTime / expenseMonths.length : 0;

  // 4. Budgeted / Planned figures
  const spendingPercentage = Number(db?.settings?.spending_percentage) || 35;
  const plannedMonthlyAllowance = avgMonthlyIncome * (spendingPercentage / 100);
  const plannedMonthlyGroceries = Number(db?.settings?.monthly_grocery_limit) || 280;
  const plannedMonthlyOutflows = plannedMonthlyAllowance + plannedMonthlyGroceries + monthlyBills;
  const plannedMonthlySavings = Math.max(0, avgMonthlyIncome - plannedMonthlyOutflows);

  // 5. Actual average monthly outflows & savings pace
  const actualMonthlyOutflows = avgMonthlyVariableExpenses + monthlyBills;
  const actualMonthlySavings =
    expenseMonths.length > 0
      ? avgMonthlyIncome - actualMonthlyOutflows
      : plannedMonthlySavings;

  const effectiveMonthlySavings =
    actualMonthlySavings > 0 ? actualMonthlySavings : plannedMonthlySavings;

  const savingsRatePct =
    avgMonthlyIncome > 0 ? Math.max(0, (effectiveMonthlySavings / avgMonthlyIncome) * 100) : 0;

  // 6. Savings Goal Metrics
  const goalName = db?.settings?.savings_goal_name || 'Emergency Fund';
  const goalTarget = Number(db?.settings?.savings_goal_target) || 0;
  const goalCurrent = Number(db?.settings?.savings_goal_current) || 0;
  const goalDateStr = db?.settings?.savings_goal_date || '';
  const goalRemaining = Math.max(0, goalTarget - goalCurrent);
  const goalProgressPct = goalTarget > 0 ? Math.min(100, Math.max(0, (goalCurrent / goalTarget) * 100)) : 0;

  let monthsToGoal = null;
  let estimatedCompletionDate = null;
  if (goalRemaining <= 0) {
    monthsToGoal = 0;
    estimatedCompletionDate = now;
  } else if (effectiveMonthlySavings > 0) {
    monthsToGoal = goalRemaining / effectiveMonthlySavings;
    const estDate = new Date(now);
    estDate.setMonth(estDate.getMonth() + Math.ceil(monthsToGoal));
    estimatedCompletionDate = estDate;
  }

  let targetDateStatus = null; // 'achieved' | 'ahead' | 'behind' | 'deficit' | null
  let requiredMonthlySavings = null;
  let monthsUntilTargetDate = null;
  if (goalDateStr && goalTarget > 0) {
    const targetDateObj = parseDate(goalDateStr);
    if (targetDateObj) {
      const diffMs = targetDateObj.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      monthsUntilTargetDate = Math.max(0.1, diffDays / 30.4375);
      requiredMonthlySavings = goalRemaining / monthsUntilTargetDate;

      if (goalRemaining <= 0) {
        targetDateStatus = 'achieved';
      } else if (effectiveMonthlySavings >= requiredMonthlySavings) {
        targetDateStatus = 'ahead';
      } else if (effectiveMonthlySavings > 0) {
        targetDateStatus = 'behind';
      } else {
        targetDateStatus = 'deficit';
      }
    }
  }

  return {
    avgMonthlyIncome,
    monthlyBills,
    plannedMonthlyAllowance,
    plannedMonthlyGroceries,
    plannedMonthlyOutflows,
    plannedMonthlySavings,
    actualMonthlyOutflows,
    actualMonthlySavings,
    effectiveMonthlySavings,
    savingsRatePct,
    goal: {
      name: goalName,
      target: goalTarget,
      current: goalCurrent,
      date: goalDateStr,
      remaining: goalRemaining,
      progressPct: goalProgressPct,
      monthsToGoal,
      estimatedCompletionDate,
      targetDateStatus,
      requiredMonthlySavings,
      monthsUntilTargetDate,
    },
  };
}

export async function fetchGitHubUser(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('Please enter a GitHub token.');
  }
  const cleanToken = token.trim();
  if (!cleanToken) {
    throw new Error('Please enter a GitHub token.');
  }
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: 'token ' + cleanToken,
      Accept: 'application/vnd.github.v3+json',
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid GitHub token (401 Unauthorized).');
    if (res.status === 403) throw new Error('GitHub API rate limit exceeded or token forbidden (403).');
    throw new Error(`GitHub API error (${res.status})`);
  }
  const data = await res.json();
  const name = (data.name && String(data.name).trim()) || '';
  const login = (data.login && String(data.login).trim()) || '';
  return {
    name,
    login,
    preferred: name || login || '',
  };
}
