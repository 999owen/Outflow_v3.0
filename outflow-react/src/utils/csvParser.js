// csvParser.js — Bank Statement CSV Parser & Duplicate Detection

/**
 * Robust RFC 4180 CSV Parser
 * Handles commas, quoted cells, embedded quotes (""), and varied line breaks (\r\n, \r, \n).
 */
export function parseCSV(text) {
  if (!text || typeof text !== 'string') return [];
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuote = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i++; // skip next quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Parse a date string into YYYY-MM-DD
 * Supports MM/DD/YY, MM/DD/YYYY, YYYY-MM-DD, M/D/YY, etc.
 */
export function normalizeDate(dateStr) {
  if (!dateStr) return '';
  const clean = String(dateStr).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  // MM/DD/YY or MM/DD/YYYY or M/D/YY or M/D/YYYY (with / or -)
  const slashMatch = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10);
    const day = parseInt(slashMatch[2], 10);
    let year = parseInt(slashMatch[3], 10);

    if (year < 100) {
      // 2-digit year: assume 2000s if < 70, else 1900s
      year = year < 70 ? 2000 + year : 1900 + year;
    }

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Fallback to JS Date parsing
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  return '';
}

/**
 * Clean transaction notes for clearer UI display
 */
export function cleanDescription(rawDesc, fallback = 'Transaction') {
  if (!rawDesc || !String(rawDesc).trim()) return fallback;
  let cleaned = String(rawDesc).trim();
  // Strip common bank prefixes if desired, but keep readable
  cleaned = cleaned.replace(/^(Debit|Digital)\s+Card\s+Purchase\s*-\s*/i, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned || fallback;
}

/**
 * Detect column indices from headers
 * Supports both single-column amount formats (Capital One, Amex, Apple Card)
 * and split debit/credit column formats (Discover, Chase, Citi, etc.)
 */
export function detectColumns(headerRow) {
  const headers = headerRow.map((h) => h.toLowerCase().trim());
  const map = {
    account: -1,
    description: -1,
    date: -1,
    postedDate: -1,
    type: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    category: -1,
    balance: -1,
  };

  headers.forEach((h, idx) => {
    // 1. Transaction Date / Date (prioritize transaction date over posted date)
    if (h === 'transaction date' || h === 'trans date' || h === 'date' || h === 'trans_date') {
      map.date = idx;
    } else if (h.includes('post date') || h.includes('posted date') || h.includes('posting date') || h === 'posted') {
      map.postedDate = idx;
    } else if (map.date === -1 && h.includes('date')) {
      map.date = idx;
    }

    // 2. Account / Card No
    if (h.includes('account') || h.includes('card no') || h.includes('card #') || h.includes('card number')) {
      map.account = idx;
    }

    // 3. Description / Payee / Merchant
    if (
      h.includes('desc') ||
      h.includes('memo') ||
      h.includes('payee') ||
      h.includes('merchant') ||
      h.includes('name') ||
      h === 'details'
    ) {
      map.description = idx;
    }

    // 4. Bank-provided Category
    if (h === 'category' || h.includes('category')) {
      map.category = idx;
    }

    // 5. Transaction Type (Credit vs Debit column)
    if (h === 'transaction type' || h === 'type' || h === 'trans type') {
      map.type = idx;
    }

    // 6. Split Debit Column (Discover, Chase, Citi, Wells Fargo)
    if (h === 'debit' || h === 'debit amount' || h.includes('withdrawal') || h.includes('outflow') || h === 'debits') {
      map.debit = idx;
    }

    // 7. Split Credit Column (Discover, Chase, Citi, Wells Fargo)
    if (h === 'credit' || h === 'credit amount' || h.includes('deposit') || h.includes('inflow') || h === 'credits') {
      map.credit = idx;
    }

    // 8. Single Amount Column
    if (h === 'amount' || h === 'transaction amount' || h === 'trans amount' || h.includes('total amount')) {
      map.amount = idx;
    } else if (h.includes('amount') && map.debit === -1 && map.credit === -1) {
      map.amount = idx;
    }

    // 9. Balance
    if (h.includes('balance')) {
      map.balance = idx;
    }
  });

  // If no transaction date found, fallback to posted date
  if (map.date === -1 && map.postedDate > -1) {
    map.date = map.postedDate;
  }

  return map;
}

/**
 * Smart categorizer for transactions, taking into account merchant text,
 * debit/credit type, and bank-provided category if available.
 */
export function suggestClassification(rawDesc, txType, amount, bankCategory = '') {
  const desc = (rawDesc || '').toUpperCase();
  const bCat = (bankCategory || '').toUpperCase();
  const isCredit = (txType || '').toUpperCase() === 'CREDIT' || amount < 0;

  if (isCredit) {
    // If it's a credit card bill autopay / payment made to the card,
    // this represents a balance transfer/payment from checking rather than income.
    if (
      bCat.includes('PAYMENT') ||
      desc.includes('AUTOPAY') ||
      desc.includes('PAYMENT') ||
      desc.includes('PYMT') ||
      desc.includes('THANK YOU')
    ) {
      return {
        target: 'skip',
        category: 'Credit Card Payment',
        notes: cleanDescription(rawDesc, bankCategory || 'Card Payment'),
        reason: 'Credit card payment / transfer',
      };
    }

    if (
      desc.includes('ADJUSTMENT') ||
      desc.includes('REFUND') ||
      desc.includes('RETURN') ||
      desc.includes('REVERSAL') ||
      bCat.includes('MERCHANDISE') ||
      bCat.includes('DINING') ||
      bCat.includes('RETAIL')
    ) {
      return {
        target: 'income',
        category: 'Refund',
        notes: `Refund: ${cleanDescription(rawDesc, bankCategory || 'Refund')}`,
        reason: 'Refund or merchant adjustment credit',
      };
    }
    return {
      target: 'income',
      category: 'Income',
      notes: cleanDescription(rawDesc, bankCategory || 'Deposit'),
      reason: 'Deposit or account credit',
    };
  }

  // Check for Groceries
  const groceryKeywords = [
    'WALMART', 'WAL-MART', 'SUPERCENTER', 'GROCERY', 'ALDI', 'KROGER', 'MEIJER',
    'WHOLE FOODS', 'TRADER JOE', 'SAFEWAY', 'FOOD LION', 'PUBLIX',
    'WEGMANS', 'COSTCO', 'HEB', 'PIGGLY', 'SPROUTS', 'MARKET',
  ];
  if (groceryKeywords.some((kw) => desc.includes(kw)) || bCat.includes('GROCER')) {
    return {
      target: 'grocery',
      category: 'Groceries',
      notes: cleanDescription(rawDesc, bankCategory || 'Groceries'),
      reason: 'Matched grocery merchant or category',
    };
  }

  // Check for Fixed / Essential Cost
  const costKeywords = [
    'RENT', 'MORTGAGE', 'ELECTRIC', 'WATER', 'ENERGY', 'GAS UTILITY',
    'INTERNET', 'BROADBAND', 'COMCAST', 'VERIZON', 'AT&T', 'INSURANCE',
    'GEICO', 'PROGRESSIVE', 'STATE FARM', 'LOAN', 'TUITION', 'STUDENT',
    'RH BROKERAGE', 'SUBSCRIPTION', 'HOSPITAL', 'CLINIC', 'PHARMACY', 'CVS', 'WALGREENS',
    'SQSP*', 'DOMAIN', 'TRANSPORTATION'
  ];
  if (
    costKeywords.some((kw) => desc.includes(kw)) ||
    bCat.includes('INTERNET') ||
    bCat.includes('UTILITIES') ||
    bCat.includes('MEDICAL') ||
    bCat.includes('HEALTH') ||
    bCat.includes('INSURANCE') ||
    bCat.includes('GAS/AUTOMOTIVE')
  ) {
    return {
      target: 'spend',
      category: 'Cost',
      notes: cleanDescription(rawDesc, bankCategory || 'Cost'),
      reason: 'Matched recurring bill / essential cost keyword or category',
    };
  }

  // Default Debits -> Personal Spend
  return {
    target: 'spend',
    category: 'Personal Spend',
    notes: cleanDescription(rawDesc, bankCategory || 'Purchase'),
    reason: 'Discretionary / personal purchase',
  };
}

/**
 * Check if a candidate matches an existing entry in the Outflow database
 */
export function findExistingMatch(candidate, db) {
  if (!db) return null;
  const candAmt = Math.abs(candidate.amount);
  const candDate = candidate.date;
  const candNotes = (candidate.notes || '').toLowerCase().trim();

  const allEntries = [
    ...(db.spend_entries || []).map((e) => ({ ...e, entry_type: 'spend' })),
    ...(db.income_entries || []).map((e) => ({ ...e, entry_type: 'income' })),
    ...(db.grocery_entries || []).map((e) => ({ ...e, entry_type: 'grocery' })),
  ];

  for (const entry of allEntries) {
    if (entry.date === candDate) {
      const entryAmt = Math.abs(Number(entry.amount));
      if (Math.abs(entryAmt - candAmt) < 0.001) {
        // Same date and exact same amount!
        const entryNotes = (entry.notes || '').toLowerCase().trim();
        // Check note similarity or exact match
        const notesMatch =
          !candNotes || !entryNotes ||
          candNotes.includes(entryNotes) ||
          entryNotes.includes(candNotes);

        if (notesMatch) {
          return {
            matchType: 'database',
            matchedEntry: entry,
            description: `Matches existing ${entry.entry_type} entry on ${entry.date} for $${entryAmt.toFixed(2)} (${entry.notes || 'No note'})`,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Parse CSV file text and return candidate transaction rows with duplicate detection and smart classification
 */
export function processStatementCSV(csvText, db) {
  const rawRows = parseCSV(csvText);
  if (rawRows.length < 2) {
    throw new Error('The CSV file does not contain enough data or is empty.');
  }

  const header = rawRows[0];
  const colMap = detectColumns(header);

  const hasAmount = colMap.amount > -1;
  const hasSplitAmount = colMap.debit > -1 || colMap.credit > -1;

  if (colMap.date === -1 || (!hasAmount && !hasSplitAmount)) {
    throw new Error('Could not identify "Date" and "Amount" (or "Debit"/"Credit") columns in the CSV file.');
  }

  const transactions = [];
  const seenInFile = new Map();

  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const row = rawRows[rowIndex];
    if (!row || row.length === 0 || row.every((c) => !c.trim())) continue;

    const rawDate = colMap.date > -1 ? row[colMap.date] : '';
    const date = normalizeDate(rawDate);
    const rawDesc = colMap.description > -1 ? row[colMap.description] : '';
    const bankCategory = colMap.category > -1 ? row[colMap.category] : '';

    let parsedAmt = 0;
    let isCredit = false;
    let rawType = colMap.type > -1 ? row[colMap.type] : '';

    if (hasSplitAmount) {
      const rawDebit = colMap.debit > -1 ? row[colMap.debit] : '';
      const rawCredit = colMap.credit > -1 ? row[colMap.credit] : '';
      const debitVal = parseFloat(String(rawDebit).replace(/[$,]/g, ''));
      const creditVal = parseFloat(String(rawCredit).replace(/[$,]/g, ''));

      if (!isNaN(debitVal) && debitVal > 0) {
        parsedAmt = debitVal;
        isCredit = false;
        rawType = 'Debit';
      } else if (!isNaN(creditVal) && creditVal > 0) {
        parsedAmt = creditVal;
        isCredit = true;
        rawType = 'Credit';
      } else {
        continue;
      }
    } else {
      const rawAmt = row[colMap.amount];
      const cleanAmtStr = String(rawAmt).replace(/[$,]/g, '');
      const numVal = parseFloat(cleanAmtStr);
      if (isNaN(numVal) || numVal === 0) continue;

      parsedAmt = Math.abs(numVal);
      const typeStr = (rawType || '').toLowerCase();
      if (typeStr.includes('credit') || typeStr.includes('deposit') || typeStr.includes('inflow')) {
        isCredit = true;
      } else if (typeStr.includes('debit') || typeStr.includes('payment') || typeStr.includes('withdrawal')) {
        isCredit = false;
      } else {
        isCredit = numVal > 0;
      }
      if (!rawType) {
        rawType = isCredit ? 'Credit' : 'Debit';
      }
    }

    if (!date || isNaN(parsedAmt) || parsedAmt === 0) {
      continue;
    }

    const initialSuggestion = suggestClassification(rawDesc, rawType, parsedAmt, bankCategory);

    const txItem = {
      id: `csv-${rowIndex}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      rawIndex: rowIndex,
      rawDescription: rawDesc || bankCategory || 'Card Purchase',
      bankCategory: bankCategory || null,
      rawType: rawType || (isCredit ? 'Credit' : 'Debit'),
      rawAmount: parsedAmt,
      date,
      amount: parsedAmt,
      notes: initialSuggestion.notes,
      targetType: initialSuggestion.target, // 'spend' | 'grocery' | 'income' | 'skip'
      category: initialSuggestion.category, // 'Cost' | 'Personal Spend' | 'Groceries' | 'Income' | 'Refund'
      originalTargetType: initialSuggestion.target,
      originalCategory: initialSuggestion.category,
      isDuplicate: false,
      duplicateReason: null,
      duplicateResolution: 'keep', // 'keep' | 'skip'
      ruleMatched: initialSuggestion.reason,
    };

    // Check 1: Intra-file duplicates (e.g. bought same good twice in one day or identical row in file)
    const fileKey = `${txItem.date}__${txItem.amount.toFixed(2)}__${txItem.rawDescription.toLowerCase().trim()}`;
    if (seenInFile.has(fileKey)) {
      const prevTx = seenInFile.get(fileKey);
      txItem.isDuplicate = true;
      txItem.duplicateReason = `Repeated in this statement on ${txItem.date} for $${txItem.amount.toFixed(2)} (Row ${prevTx.rawIndex} & Row ${txItem.rawIndex})`;
      txItem.duplicateResolution = 'skip';
      txItem.targetType = 'skip';
    } else {
      seenInFile.set(fileKey, txItem);
    }

    // Check 2: Match against existing database entries
    const dbMatch = findExistingMatch(txItem, db);
    if (dbMatch) {
      txItem.isDuplicate = true;
      txItem.duplicateReason = dbMatch.description;
      txItem.duplicateResolution = 'skip';
      txItem.targetType = 'skip';
    }

    transactions.push(txItem);
  }

  return transactions;
}
