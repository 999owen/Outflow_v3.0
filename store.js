// Shared data layer for Owen's Spending Tracker.
// Everything lives in the browser's localStorage - no server or database required.
(function (global) {
    const STORAGE_KEY = 'owens_tracker_data';
    const SCHEMA_VERSION = 2;
    const TYPES = ['income', 'spend', 'grocery'];
    const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];

    const DEFAULT_SETTINGS = {
        spending_percentage: 35,
        monthly_grocery_limit: 280,
        currency: 'USD',
        github_token: '',
        gist_id: ''
    };

    const emptyData = () => ({
        schema_version: SCHEMA_VERSION,
        last_updated: null,
        settings: Object.assign({}, DEFAULT_SETTINGS),
        income_entries: [],
        spend_entries: [],
        grocery_entries: [],
        recurring_bills: []
    });

    function newId() {
        if (global.crypto && typeof global.crypto.randomUUID === 'function') {
            return global.crypto.randomUUID();
        }
        return 'e-' + Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e9).toString(36);
    }

    // 'YYYY-MM-DD' parsed as a LOCAL date. new Date('2026-08-03') parses as UTC,
    // which lands on the previous day west of Greenwich and shifts week grouping.
    function parseDate(value) {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
        if (!m) return null;
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) {
            return null; // rejects things like 2026-02-31
        }
        return d;
    }

    function isValidDate(value) {
        return parseDate(value) !== null;
    }

    function weekKey(value) {
        if (!value) return null;
        let etDate;
        if (typeof value === 'string') {
            const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
            if (!m) return null;
            // Parse string as 12:00 PM to avoid timezone boundary issues when applying ET offset
            etDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
        } else if (value instanceof Date) {
            const etString = value.toLocaleString('en-US', { timeZone: 'America/New_York' });
            etDate = new Date(etString);
        } else return null;

        // Shift by 3 hours to enforce 3 AM reset
        etDate.setHours(etDate.getHours() - 3);

        const offset = (etDate.getDay() + 1) % 7; // Sat(6)->0, Sun(0)->1, etc.
        etDate.setDate(etDate.getDate() - offset);

        return etDate.getFullYear() + '-' +
            String(etDate.getMonth() + 1).padStart(2, '0') + '-' +
            String(etDate.getDate()).padStart(2, '0');
    }

    function clampNumber(value, fallback, min, max) {
        const n = Number(value);
        if (!isFinite(n)) return fallback;
        return Math.min(Math.max(n, min), max);
    }

    function normalizeSettings(raw) {
        const s = Object.assign({}, DEFAULT_SETTINGS, raw && typeof raw === 'object' ? raw : {});
        return {
            spending_percentage: clampNumber(s.spending_percentage, DEFAULT_SETTINGS.spending_percentage, 1, 100),
            monthly_grocery_limit: clampNumber(s.monthly_grocery_limit, DEFAULT_SETTINGS.monthly_grocery_limit, 0.01, 1e9),
            // An unrecognised currency would make Intl.NumberFormat throw and blank every page.
            currency: SUPPORTED_CURRENCIES.indexOf(s.currency) > -1 ? s.currency : DEFAULT_SETTINGS.currency,
            github_token: s.github_token ? String(s.github_token) : '',
            gist_id: s.gist_id ? String(s.gist_id) : ''
        };
    }

    // Returns {entries, skipped}. Anything without a real date or a finite
    // positive amount is dropped rather than silently stored as $0.00.
    function normalizeEntries(rawList) {
        const entries = [];
        let skipped = 0;

        (Array.isArray(rawList) ? rawList : []).forEach(e => {
            if (!e || typeof e !== 'object') { skipped++; return; }
            const amount = parseFloat(e.amount);
            if (!isValidDate(e.date) || !isFinite(amount) || amount <= 0) { skipped++; return; }

            let category = e.category === undefined || e.category === null ? '' : String(e.category);
            // Default missing categories to Groceries for backward compatibility
            if (!category && (e.notes === undefined || (!String(e.notes).toLowerCase().includes('income') && !String(e.notes).toLowerCase().includes('paycheck')))) {
                category = 'Groceries';
            } else if (category && !['Groceries', 'Cost', 'Personal Spend'].includes(category)) {
                // Fallback legacy entries
                category = 'Personal Spend';
            }

            entries.push({
                id: typeof e.id === 'string' && e.id ? e.id : newId(),
                date: String(e.date),
                amount: Math.round(amount * 100) / 100,
                notes: e.notes === undefined || e.notes === null ? '' : String(e.notes),
                category: category
            });
        });

        return { entries: entries, skipped: skipped };
    }


    function normalizeBills(rawList) {
        const bills = [];
        let skipped = 0;

        (Array.isArray(rawList) ? rawList : []).forEach(b => {
            if (!b || typeof b !== 'object') { skipped++; return; }
            const amount = parseFloat(b.amount);
            if (!b.name || typeof b.name !== 'string' || !isFinite(amount) || amount < 0) { skipped++; return; }

            let type = b.type === 'variable' ? 'variable' : 'fixed';
            let dueDay = parseInt(b.dueDay);
            if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) {
                dueDay = 1;
            }

            let actualAmount = b.actualAmount !== null && b.actualAmount !== undefined ? parseFloat(b.actualAmount) : null;
            if (actualAmount !== null && !isFinite(actualAmount)) actualAmount = null;

            bills.push({
                id: typeof b.id === 'string' && b.id ? b.id : newId(),
                name: String(b.name).trim(),
                type: type,
                amount: Math.round(amount * 100) / 100,
                actualAmount: actualAmount !== null ? Math.round(actualAmount * 100) / 100 : null,
                dueDay: dueDay,
                isAutoPaid: !!b.isAutoPaid,
                isActive: b.isActive !== undefined ? !!b.isActive : true,
                lastUpdatedMonth: b.lastUpdatedMonth ? String(b.lastUpdatedMonth) : null
            });
        });

        return { entries: bills, skipped: skipped };
    }

    // Accepts anything and returns a valid db, reporting what it had to drop.
    function normalize(raw) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return { db: emptyData(), skipped: 0, addedIds: false };
        }

        const db = emptyData();
        db.settings = normalizeSettings(raw.settings);
        db.last_updated = typeof raw.last_updated === 'string' ? raw.last_updated : null;

        let skipped = 0;
        let addedIds = false;

        TYPES.forEach(type => {
            const key = type + '_entries';
            const rawList = Array.isArray(raw[key]) ? raw[key] : [];
            const result = normalizeEntries(rawList);
            // Entries saved before ids existed need one assigned and written back.
            if (rawList.some(e => e && typeof e === 'object' && !e.id)) addedIds = true;
            db[key] = result.entries;
            skipped += result.skipped;
        });

        const rawBillsList = Array.isArray(raw.recurring_bills) ? raw.recurring_bills : [];
        const billsResult = normalizeBills(rawBillsList);
        if (rawBillsList.some(b => b && typeof b === 'object' && !b.id)) addedIds = true;
        db.recurring_bills = billsResult.entries;
        skipped += billsResult.skipped;

        return { db: db, skipped: skipped, addedIds: addedIds };
    }

    function load() {
        let raw;
        try {
            raw = localStorage.getItem(STORAGE_KEY);
        } catch (err) {
            console.error('localStorage is unavailable:', err);
            return emptyData();
        }
        if (!raw) return emptyData();

        let result;
        try {
            result = normalize(JSON.parse(raw));
        } catch (err) {
            console.error('Saved data is corrupt and was ignored:', err);
            return emptyData();
        }

        // Migrate older records (no ids / older schema) once, in place.
        if (result.addedIds || result.db.schema_version !== SCHEMA_VERSION || result.skipped > 0) {
            try { persist(result.db); } catch (err) { /* read-only mode is still usable */ }
        }
        return result.db;
    }

    function persist(db) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
        try {
            global.dispatchEvent(new Event('tracker-updated'));
        } catch (e) {
            // Ignore if event dispatch fails
        }
        return db;
    }

    function save(db, isSyncSetting = false) {
        db.schema_version = SCHEMA_VERSION;

        // Don't bump last_updated or push if we are just configuring sync credentials
        if (!isSyncSetting) {
            db.last_updated = new Date().toISOString();
        }

        try {
            persist(db);
            if (!isSyncSetting) {
                // Async sync to gist
                pushToGist(db);
            }
        } catch (err) {
            console.error('Could not save data:', err);
            const quota = err && (err.name === 'QuotaExceededError' || err.code === 22);
            throw new Error(quota
                ? 'Storage is full. Export a backup and clear some entries.'
                : 'Could not save your data. Check that browser storage is enabled.');
        }
        return db;
    }

    function assertType(type) {
        if (TYPES.indexOf(type) === -1) throw new Error('Unknown entry type: ' + type);
    }

    // Writes always re-read storage first. A page holding a stale copy in memory
    // (e.g. it was open while another tab cleared or imported) would otherwise
    // write its old entries back and resurrect deleted data.
    function addEntry(type, entry) {
        assertType(type);
        const amount = parseFloat(entry.amount);
        if (!isValidDate(entry.date)) throw new Error('Please enter a valid date.');
        if (!isFinite(amount) || amount <= 0) throw new Error('Please enter an amount greater than zero.');

        const db = load();
        db[type + '_entries'].push({
            id: newId(),
            date: String(entry.date),
            amount: Math.round(amount * 100) / 100,
            notes: entry.notes ? String(entry.notes) : '',
            category: entry.category ? String(entry.category) : (type === 'grocery' ? 'Groceries' : 'Discretionary / Personal')
        });
        return save(db);
    }

    // Delete by id so duplicate date/amount/notes rows stay distinguishable.
    function deleteEntry(type, id) {
        assertType(type);
        const db = load();
        const list = db[type + '_entries'];
        const i = list.findIndex(e => e.id === id);
        if (i > -1) {
            list.splice(i, 1);
            return save(db);
        }
        return db;
    }

    function updateSetting(key, value) {
        const db = load();
        const next = Object.assign({}, db.settings);
        next[key] = value;
        db.settings = normalizeSettings(next);

        const isSyncSetting = key === 'github_token' || key === 'gist_id';
        return save(db, isSyncSetting);
    }

    // Notify open pages when another tab clears, imports, or edits data.
    function subscribe(callback) {
        const handler = function () { callback(load()); };
        global.addEventListener('storage', function (e) {
            // e.key is null when the whole store is wiped via localStorage.clear()
            if (e.key === STORAGE_KEY || e.key === null) handler();
        });
        global.addEventListener('tracker-updated', handler);
    }

    function clear() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
            console.error('Could not clear data:', err);
            throw new Error('Could not clear your data. Check that browser storage is enabled.');
        }
        return emptyData();
    }

    function pad(n) { return String(n).padStart(2, '0'); }

    function exportToFile() {
        const db = load();
        const now = new Date();
        const stamp = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
        const payload = Object.assign({}, db, { exported_at: now.toISOString() });

        // Remove sensitive info before exporting
        if (payload.settings) {
            payload.settings = Object.assign({}, payload.settings);
            delete payload.settings.github_token;
            delete payload.settings.gist_id;
        }

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'owens-tracker-backup-' + stamp + '.json';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        // Revoking immediately can cancel the download in some browsers.
        setTimeout(() => URL.revokeObjectURL(url), 10000);

        return counts(db);
    }

    // Returns {db, imported, skipped}. Throws if the file isn't a usable backup.
    function importFromJSON(text) {
        let parsed;
        try {
            parsed = JSON.parse(text);
        } catch (err) {
            throw new Error('That file is not valid JSON.');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('That backup is not in the expected format.');
        }
        const hasAnyList = TYPES.some(t => Array.isArray(parsed[t + '_entries']));
        if (!hasAnyList) throw new Error('That file contains no paycheck, spend or grocery entries.');

        const result = normalize(parsed);
        const currentDb = load();

        let importedCount = 0;
        TYPES.forEach(type => {
            const key = type + '_entries';
            const existingIds = new Set(currentDb[key].map(e => e.id));
            result.db[key].forEach(entry => {
                if (!existingIds.has(entry.id)) {
                    currentDb[key].push(entry);
                    importedCount++;
                }
            });
        });

        const existingBillIds = new Set(currentDb.recurring_bills.map(b => b.id));
        result.db.recurring_bills.forEach(bill => {
            if (!existingBillIds.has(bill.id)) {
                currentDb.recurring_bills.push(bill);
                importedCount++;
            }
        });

        // Preserve existing gist settings if not present in backup
        const token = currentDb.settings.github_token;
        const gistId = currentDb.settings.gist_id;

        currentDb.settings = result.db.settings;

        if (token && !currentDb.settings.github_token) {
            currentDb.settings.github_token = token;
        }
        if (gistId && !currentDb.settings.gist_id) {
            currentDb.settings.gist_id = gistId;
        }

        if (importedCount === 0 && result.skipped > 0) {
            throw new Error('Every entry in that file was invalid or already exists.');
        }

        save(currentDb);
        return { db: currentDb, imported: importedCount, skipped: result.skipped };
    }

    function counts(db) {
        return {
            income: db.income_entries.length,
            spend: db.spend_entries.length,
            grocery: db.grocery_entries.length,
            bills: db.recurring_bills.length,
            total: db.income_entries.length + db.spend_entries.length + db.grocery_entries.length + db.recurring_bills.length
        };
    }

    function sum(list) {
        return list.reduce((total, e) => total + e.amount, 0);
    }

    // Every page derives its numbers from here so they cannot disagree.
    function summary(db) {
        const allExpenses = getAllExpenses(db);

        const earned = sum(db.income_entries);
        const spent = sum(allExpenses.filter(e => e.entry_type === 'spend' && e.category !== 'Groceries'));
        const grocery = sum(allExpenses.filter(e => e.entry_type === 'grocery' || e.category === 'Groceries'));
        const totalSpent = spent; // excluding groceries based on old logic, but keeping allowance logic stable
        const allowance = earned * (db.settings.spending_percentage / 100);
        const thisWeek = weekKey(new Date());

        const currentMonth = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        const groceryThisMonth = sum(allExpenses.filter(e => {
            if (e.entry_type !== 'grocery' && e.category !== 'Groceries') return false;
            const d = parseDate(e.date);
            return d && d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') === currentMonth;
        }));

        return {
            earned: earned,
            spent: spent,
            grocery: grocery,
            totalSpent: totalSpent,
            allowance: allowance,
            remaining: allowance - totalSpent,
            saved: earned - allowance,
            groceryThisMonth: groceryThisMonth,
            groceryLeft: db.settings.monthly_grocery_limit - groceryThisMonth,
            thisWeekKey: thisWeek
        };
    }

    // The current calendar week's grocery total - not "whichever entry is last
    // in the list", which made a back-dated bill count as this week's.
    function groceryThisWeek(db) {
        const current = weekKey(new Date());
        const allExpenses = getAllExpenses(db);
        return sum(allExpenses.filter(e => (e.entry_type === 'grocery' || e.category === 'Groceries') && weekKey(e.date) === current));
    }

    // Groups grocery entries into the last `count` calendar weeks, oldest first,
    // including weeks with no spending so the chart keeps a real time axis.
    function groceryByWeek(db, count) {
        const totals = {};
        const allExpenses = getAllExpenses(db);
        allExpenses.forEach(e => {
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
            const key = cursor.getFullYear() + '-' +
                String(cursor.getMonth() + 1).padStart(2, '0') + '-' +
                String(cursor.getDate()).padStart(2, '0');
            weeks.unshift({
                key: key,
                label: i === 0 ? 'This Week' : (cursor.getMonth() + 1) + '/' + cursor.getDate(),
                total: totals[key] || 0
            });
            cursor.setDate(cursor.getDate() - 7);
        }
        return weeks;
    }

    function expensesByWeek(db, count) {
        const totals = {};
        const allExpenses = getAllExpenses(db);
        allExpenses.forEach(e => {
            const key = weekKey(e.date);
            if (!key) return;

            if (!totals[key]) {
                totals[key] = { cost: 0, personal: 0, grocery: 0 };
            }

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
            const key = cursor.getFullYear() + '-' +
                String(cursor.getMonth() + 1).padStart(2, '0') + '-' +
                String(cursor.getDate()).padStart(2, '0');

            weeks.unshift({
                key: key,
                label: i === 0 ? 'This Week' : (cursor.getMonth() + 1) + '/' + cursor.getDate(),
                costTotal: totals[key] ? totals[key].cost : 0,
                personalTotal: totals[key] ? totals[key].personal : 0,
                groceryTotal: totals[key] ? totals[key].grocery : 0
            });
            cursor.setDate(cursor.getDate() - 7);
        }
        return weeks;
    }

    function formatter(db) {
        const currency = (db.settings && db.settings.currency) || 'USD';
        try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency });
        } catch (err) {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
        }
    }

    async function pushToGist(db) {
        if (!db.settings.github_token) return;

        const payload = Object.assign({}, db);
        payload.settings = Object.assign({}, db.settings);
        const token = payload.settings.github_token;
        const gistId = payload.settings.gist_id;

        delete payload.settings.github_token;
        delete payload.settings.gist_id;

        const content = JSON.stringify(payload, null, 2);

        const headers = {
            'Authorization': 'token ' + token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
        };

        const body = JSON.stringify({
            description: "Owen's Spending Tracker Backup",
            public: false,
            files: {
                "owens_tracker_backup.json": {
                    content: content
                }
            }
        });

        try {
            if (gistId) {
                // Prevent overwriting a newer remote backup with stale/empty local data
                const checkRes = await fetch('https://api.github.com/gists/' + gistId, {
                    headers: {
                        'Authorization': 'token ' + token,
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    cache: 'no-store'
                });
                if (checkRes.ok) {
                    const data = await checkRes.json();
                    const file = data.files['owens_tracker_backup.json'];
                    if (file && file.content) {
                        const remoteDb = normalize(JSON.parse(file.content)).db;
                        const localDate = db.last_updated ? new Date(db.last_updated) : new Date(0);
                        const remoteDate = remoteDb.last_updated ? new Date(remoteDb.last_updated) : new Date(0);

                        if (remoteDate > localDate) {
                            console.log('Aborting push: Remote gist is newer than local data. Pulling instead.');
                            pullFromGist();
                            return;
                        }
                    }
                }

                const res = await fetch('https://api.github.com/gists/' + gistId, {
                    method: 'PATCH',
                    headers: headers,
                    body: body
                });
                if (!res.ok) throw new Error('Failed to update Gist');
            } else {
                const res = await fetch('https://api.github.com/gists', {
                    method: 'POST',
                    headers: headers,
                    body: body
                });
                if (!res.ok) throw new Error('Failed to create Gist');
                const data = await res.json();

                const currentDb = load();
                if (currentDb.settings.github_token === token) {
                    const next = Object.assign({}, currentDb.settings);
                    next.gist_id = data.id;
                    currentDb.settings = normalizeSettings(next);
                    persist(currentDb);
                }
            }
        } catch (err) {
            console.error('Gist push error:', err);
        }
    }

    async function pullFromGist() {
        const currentDb = load();
        const token = currentDb.settings.github_token;
        const gistId = currentDb.settings.gist_id;

        if (!token || !gistId) return;

        try {
            const res = await fetch('https://api.github.com/gists/' + gistId, {
                headers: {
                    'Authorization': 'token ' + token,
                    'Accept': 'application/vnd.github.v3+json'
                },
                cache: 'no-store'
            });

            if (!res.ok) throw new Error('Failed to fetch Gist');
            const data = await res.json();

            const file = data.files['owens_tracker_backup.json'];
            if (!file || !file.content) return;

            const remoteDbResult = normalize(JSON.parse(file.content));
            const remoteDb = remoteDbResult.db;

            const localDate = currentDb.last_updated ? new Date(currentDb.last_updated) : new Date(0);
            const remoteDate = remoteDb.last_updated ? new Date(remoteDb.last_updated) : new Date(0);

            if (remoteDate > localDate) {
                remoteDb.settings.github_token = token;
                remoteDb.settings.gist_id = gistId;
                persist(remoteDb);
            }
        } catch (err) {
            console.error('Gist pull error:', err);
        }
    }

    // Marks the sidebar link for the page you are on.
    function markActiveNav() {
        const here = location.pathname.split('/').pop() || 'dashboard.html';
        document.querySelectorAll('.sidebar-menu-item').forEach(link => {
            const target = link.getAttribute('href');
            link.classList.toggle('active', target === here);
        });
    }

    function getAllExpenses(db) {
        // Groceries are tracked independently in grocery_entries for legacy reasons,
        // but now we want to combine them with spend_entries for "All Expenses" view.
        const all = [
            ...db.spend_entries.map(e => Object.assign({}, e, { entry_type: 'spend' })),
            ...db.grocery_entries.map(e => Object.assign({}, e, { entry_type: 'grocery', category: e.category || 'Groceries' }))
        ];
        return all.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    }

    function addBill(bill) {
        const amount = parseFloat(bill.amount);
        if (!bill.name || !isFinite(amount) || amount < 0) throw new Error('Invalid bill data.');

        const db = load();
        let type = bill.type === 'variable' ? 'variable' : 'fixed';
        let dueDay = parseInt(bill.dueDay);
        if (isNaN(dueDay) || dueDay < 1 || dueDay > 31) dueDay = 1;

        let actualAmount = bill.actualAmount !== null && bill.actualAmount !== undefined ? parseFloat(bill.actualAmount) : null;
        if (actualAmount !== null && !isFinite(actualAmount)) actualAmount = null;

        const newBill = {
            id: newId(),
            name: String(bill.name).trim(),
            type: type,
            amount: Math.round(amount * 100) / 100,
            actualAmount: actualAmount !== null ? Math.round(actualAmount * 100) / 100 : null,
            dueDay: dueDay,
            isAutoPaid: !!bill.isAutoPaid,
            isActive: bill.isActive !== undefined ? !!bill.isActive : true,
            lastUpdatedMonth: bill.lastUpdatedMonth ? String(bill.lastUpdatedMonth) : null
        };

        db.recurring_bills.push(newBill);
        save(db);
        return newBill;
    }

    function updateBill(id, updates) {
        const db = load();
        const index = db.recurring_bills.findIndex(b => b.id === id);
        if (index === -1) throw new Error('Bill not found.');

        const b = db.recurring_bills[index];
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
            if (!isNaN(dueDay) && dueDay >= 1 && dueDay <= 31) b.dueDay = dueDay;
            else b.dueDay = 1;
        }
        if (updates.isAutoPaid !== undefined) b.isAutoPaid = !!updates.isAutoPaid;
        if (updates.isActive !== undefined) b.isActive = !!updates.isActive;
        if (updates.lastUpdatedMonth !== undefined) b.lastUpdatedMonth = updates.lastUpdatedMonth ? String(updates.lastUpdatedMonth) : null;

        save(db);
    }

    function deleteBill(id) {
        const db = load();
        const initialLength = db.recurring_bills.length;
        db.recurring_bills = db.recurring_bills.filter(b => b.id !== id);
        if (db.recurring_bills.length < initialLength) {
            save(db);
        }
    }

    global.TrackerStore = {
        STORAGE_KEY: STORAGE_KEY,
        SCHEMA_VERSION: SCHEMA_VERSION,
        SUPPORTED_CURRENCIES: SUPPORTED_CURRENCIES,
        emptyData: emptyData,
        load: load,
        save: save,
        addEntry: addEntry,
        deleteEntry: deleteEntry,
        updateSetting: updateSetting,
        subscribe: subscribe,
        clear: clear,
        exportToFile: exportToFile,
        importFromJSON: importFromJSON,
        counts: counts,
        summary: summary,
        groceryByWeek: groceryByWeek,
        expensesByWeek: expensesByWeek,
        weekKey: weekKey,
        parseDate: parseDate,
        formatter: formatter,
        markActiveNav: markActiveNav,
        pushToGist: pushToGist,
        pullFromGist: pullFromGist,
        getAllExpenses: getAllExpenses,
        addBill: addBill,
        updateBill: updateBill,
        deleteBill: deleteBill
    };

    // Auto-pull on load
    pullFromGist();
})(window);
