const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const dbPath = path.join(__dirname, 'budget.db');
const db = new DatabaseSync(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
  CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Set default settings if not exists
const checkSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
if (!checkSettingStmt.get('currency')) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('currency', '$');
}

module.exports = {
  db,

  addTransaction({ type, category, description, amount, date }) {
    const formattedDate = date || new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      INSERT INTO transactions (type, category, description, amount, date)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      type,
      category.trim() || (type === 'income' ? 'Income' : 'General'),
      description.trim() || (type === 'income' ? 'Added Money' : 'Expense'),
      Number(amount),
      formattedDate
    );
    return {
      id: Number(result.lastInsertRowid),
      type,
      category: category.trim() || (type === 'income' ? 'Income' : 'General'),
      description: description.trim() || (type === 'income' ? 'Added Money' : 'Expense'),
      amount: Number(amount),
      date: formattedDate
    };
  },

  getTransactions({ type, category, search, month, limit = 100, offset = 0 } = {}) {
    let sql = 'SELECT * FROM transactions WHERE 1=1';
    const params = [];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (category && category !== 'all') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (month) {
      sql += ' AND date LIKE ?';
      params.push(`${month}%`);
    }
    if (search) {
      sql += ' AND (description LIKE ? OR category LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY date DESC, id DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    return db.prepare(sql).all(...params);
  },

  deleteTransaction(id) {
    const stmt = db.prepare('DELETE FROM transactions WHERE id = ?');
    const result = stmt.run(Number(id));
    return result.changes > 0;
  },

  clearAllTransactions() {
    db.exec('DELETE FROM transactions;');
    return true;
  },

  syncTransactions(transactions) {
    db.exec('BEGIN TRANSACTION;');
    try {
      db.exec('DELETE FROM transactions;');
      const stmt = db.prepare(`
        INSERT INTO transactions (id, type, category, description, amount, date)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const t of transactions) {
        stmt.run(
          t.id ? Number(t.id) : null,
          t.type,
          t.category ? t.category.trim() : (t.type === 'income' ? 'Income' : 'General'),
          t.description ? t.description.trim() : (t.type === 'income' ? 'Added Money' : 'Expense'),
          Number(t.amount) || 0,
          t.date || new Date().toISOString().split('T')[0]
        );
      }
      db.exec('COMMIT;');
      return true;
    } catch (err) {
      db.exec('ROLLBACK;');
      throw err;
    }
  },

  updateTransaction(id, { type, category, description, amount, date }) {
    const formattedDate = date || new Date().toISOString().split('T')[0];
    const stmt = db.prepare(`
      UPDATE transactions
      SET type = ?, category = ?, description = ?, amount = ?, date = ?
      WHERE id = ?
    `);
    const result = stmt.run(
      type,
      category.trim() || (type === 'income' ? 'Income' : 'General'),
      description.trim() || (type === 'income' ? 'Added Money' : 'Expense'),
      Number(amount),
      formattedDate,
      Number(id)
    );
    return result.changes > 0;
  },

  getTransactionById(id) {
    return db.prepare('SELECT * FROM transactions WHERE id = ?').get(Number(id));
  },

  getSummary(month) {
    let dateFilter = '';
    const params = [];
    if (month) {
      dateFilter = ' WHERE date LIKE ?';
      params.push(`${month}%`);
    }

    // Totals
    const totalsSql = `
      SELECT 
        SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as totalIncome,
        SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as totalExpense,
        COUNT(*) as totalTransactions
      FROM transactions
      ${dateFilter}
    `;
    const totals = db.prepare(totalsSql).get(...params) || {};
    const totalIncome = Number(totals.totalIncome || 0);
    const totalExpense = Number(totals.totalExpense || 0);
    const balance = totalIncome - totalExpense;

    // Category breakdown for expenses ("what spent for what")
    const categorySql = `
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE type = 'expense' ${month ? 'AND date LIKE ?' : ''}
      GROUP BY category
      ORDER BY total DESC
    `;
    const categoryRows = db.prepare(categorySql).all(...(month ? [`${month}%`] : []));
    const categoryBreakdown = categoryRows.map(row => ({
      category: row.category,
      total: Number(row.total),
      count: Number(row.count),
      percentage: totalExpense > 0 ? Number(((Number(row.total) / totalExpense) * 100).toFixed(1)) : 0
    }));

    // Income breakdown by category/source
    const incomeCatSql = `
      SELECT 
        category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM transactions
      WHERE type = 'income' ${month ? 'AND date LIKE ?' : ''}
      GROUP BY category
      ORDER BY total DESC
    `;
    const incomeRows = db.prepare(incomeCatSql).all(...(month ? [`${month}%`] : []));
    const incomeBreakdown = incomeRows.map(row => ({
      category: row.category,
      total: Number(row.total),
      count: Number(row.count),
      percentage: totalIncome > 0 ? Number(((Number(row.total) / totalIncome) * 100).toFixed(1)) : 0
    }));

    const monthlyBudget = Number(this.getSetting('monthly_budget', 0));
    const budgetRemaining = monthlyBudget > 0 ? monthlyBudget - totalExpense : null;
    const budgetUsedPercentage = monthlyBudget > 0 ? Number(((totalExpense / monthlyBudget) * 100).toFixed(1)) : null;

    return {
      totalIncome,
      totalExpense,
      balance,
      monthlyBudget,
      budgetRemaining,
      budgetUsedPercentage,
      categoryBreakdown,
      incomeBreakdown,
      transactionCount: Number(totals.totalTransactions || 0)
    };
  },

  getAllCategories() {
    const rows = db.prepare(`
      SELECT DISTINCT category FROM transactions ORDER BY category ASC
    `).all();
    return rows.map(r => r.category);
  },

  getSetting(key, fallback = null) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    return row ? row.value : fallback;
  },

  setSetting(key, value) {
    const stmt = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    stmt.run(key, String(value));
    return { key, value };
  }
};

