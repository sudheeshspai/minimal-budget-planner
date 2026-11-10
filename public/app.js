// App State
let currentCurrency = '$';
let currentTab = 'all';
let currentMonth = '';
let currentSearch = '';
let currentCategory = 'all';

// Preset Categories with Icons & Colors
const CATEGORY_ICONS = {
  // Expense
  'Food & Dining': '🍔',
  'Groceries': '🛒',
  'Rent & Housing': '🏠',
  'Bills & Utilities': '⚡',
  'Transportation': '🚗',
  'Shopping': '🛍️',
  'Entertainment': '🎬',
  'Health & Medical': '💊',
  'Personal Care': '✨',
  'Education': '📚',
  'Travel': '✈️',
  'General Expense': '💳',

  // Income
  'Salary': '💼',
  'Freelance': '💻',
  'Business': '🏢',
  'Investments': '📈',
  'Bonus & Gift': '🎁',
  'Deposit': '🏦',
  'General Income': '💰',

  // Fallback
  'Other': '🏷️'
};

const CATEGORY_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', 
  '#8b5cf6', '#14b8a6', '#f97316', '#ef4444', '#84cc16'
];

const DEFAULT_EXPENSE_CATS = [
  'Food & Dining', 'Groceries', 'Rent & Housing', 'Bills & Utilities',
  'Transportation', 'Shopping', 'Entertainment', 'Health & Medical', 'Other'
];

const DEFAULT_INCOME_CATS = [
  'Salary', 'Freelance', 'Business', 'Investments', 'Bonus & Gift', 'Deposit', 'Other'
];

// Formatting helper
function formatMoney(amount, currency = currentCurrency) {
  const num = Number(amount) || 0;
  return `${currency}${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function getCategoryIcon(catName) {
  return CATEGORY_ICONS[catName] || '🏷️';
}

// Toast notification helper
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2500);
}

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDateInputs();
  initEventListeners();
  loadAllData();
});

function initTheme() {
  const savedTheme = localStorage.getItem('budget_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeIcon = document.getElementById('themeIcon');
  if (themeIcon) {
    themeIcon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('budget_theme', next);
  document.getElementById('themeIcon').textContent = next === 'dark' ? '☀️' : '🌙';
}

function initDateInputs() {
  const today = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('dateInput');
  if (dateInput) {
    dateInput.value = today;
  }
}

function initEventListeners() {
  // Theme Toggle
  document.getElementById('themeToggleBtn').addEventListener('click', toggleTheme);

  // Currency Selector
  const currencySelector = document.getElementById('currencySelector');
  currencySelector.addEventListener('change', async (e) => {
    currentCurrency = e.target.value;
    updateCurrencyLabels();
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: currentCurrency })
      });
      loadSummary();
      loadTransactions();
    } catch (err) {
      console.error('Failed to save currency:', err);
    }
  });

  // Month Selector
  const monthFilter = document.getElementById('monthFilter');
  monthFilter.addEventListener('change', (e) => {
    currentMonth = e.target.value;
    loadSummary();
    loadTransactions();
  });

  // Filter Tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.getAttribute('data-type');
      loadTransactions();
    });
  });

  // Search Input with debounce
  let searchTimer;
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      currentSearch = e.target.value.trim();
      loadTransactions();
    }, 250);
  });

  // Category Filter
  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    currentCategory = e.target.value;
    loadTransactions();
  });

  // Escape key to close modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function updateCurrencyLabels() {
  document.querySelectorAll('.currency-label').forEach(el => {
    el.textContent = currentCurrency;
  });
}

// Fetch and render everything
async function loadAllData() {
  try {
    // 1. Fetch settings (currency)
    const settingsRes = await fetch('/api/settings');
    const settings = await settingsRes.json();
    if (settings && settings.currency) {
      currentCurrency = settings.currency;
      const currencySelector = document.getElementById('currencySelector');
      if (currencySelector) currencySelector.value = currentCurrency;
      updateCurrencyLabels();
    }

    // 2. Load Summary & Transactions
    await Promise.all([loadSummary(), loadTransactions(), loadCategoriesDropdown()]);
  } catch (err) {
    console.error('Error loading data:', err);
  }
}

// Load Summary & What Spent For What
async function loadSummary() {
  try {
    const url = currentMonth ? `/api/summary?month=${currentMonth}` : '/api/summary';
    const res = await fetch(url);
    const data = await res.json();

    // Render Balances
    const balEl = document.getElementById('totalBalance');
    const incEl = document.getElementById('totalIncome');
    const expEl = document.getElementById('totalExpense');
    const balStatus = document.getElementById('balanceStatus');

    balEl.textContent = formatMoney(data.balance);
    incEl.textContent = formatMoney(data.totalIncome);
    expEl.textContent = formatMoney(data.totalExpense);

    if (data.balance < 0) {
      balStatus.textContent = 'Deficit / In Negative';
      balStatus.classList.add('negative');
      balEl.style.color = 'var(--danger)';
    } else {
      balStatus.textContent = 'In Good Standing';
      balStatus.classList.remove('negative');
      balEl.style.color = 'var(--text-main)';
    }

    document.getElementById('incomeCount').textContent = `${data.incomeBreakdown?.reduce((a, b) => a + b.count, 0) || 0} deposits`;
    document.getElementById('expenseCount').textContent = `${data.categoryBreakdown?.reduce((a, b) => a + b.count, 0) || 0} purchases`;

    // Render "What Spent For What"
    renderBreakdown(data.categoryBreakdown, data.totalExpense);
  } catch (err) {
    console.error('Failed to load summary:', err);
  }
}

// Render "What I Spent For What" breakdown list
function renderBreakdown(categories = [], totalExpense = 0) {
  const container = document.getElementById('breakdownContainer');
  const countBadge = document.getElementById('categoryCountBadge');
  countBadge.textContent = `${categories.length} categories`;

  if (!categories || categories.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>No expenses recorded yet.</p>
        <span>Add what you spent on to see category calculations here.</span>
      </div>
    `;
    return;
  }

  container.innerHTML = categories.map((cat, idx) => {
    const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
    const icon = getCategoryIcon(cat.category);
    return `
      <div class="breakdown-item clickable" onclick="filterByCategory('${escapeHtml(cat.category)}')" title="Click to filter by ${escapeHtml(cat.category)}">
        <div class="breakdown-top">
          <div class="category-name-wrap">
            <span class="cat-icon-circle">${icon}</span>
            <span class="category-title">${escapeHtml(cat.category)}</span>
            <span class="category-count">(${cat.count} ${cat.count === 1 ? 'item' : 'items'})</span>
          </div>
          <div class="category-amount-wrap">
            <div class="category-amount font-mono">${formatMoney(cat.total)}</div>
            <div class="category-percent">${cat.percentage}%</div>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${Math.min(cat.percentage, 100)}%; background-color: ${color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

function filterByCategory(catName) {
  currentCategory = catName;
  const select = document.getElementById('categoryFilter');
  if (select) select.value = catName;
  loadTransactions();
  // Scroll to transactions panel on mobile
  const txPanel = document.querySelector('.transactions-panel');
  if (txPanel && window.innerWidth < 900) {
    txPanel.scrollIntoView({ behavior: 'smooth' });
  }
}

async function clearAllData() {
  if (!confirm('⚠️ Are you sure you want to clear all transactions from the database? This cannot be undone.')) {
    return;
  }

  try {
    const res = await fetch('/api/clear', { method: 'POST' });
    if (res.ok) {
      showToast('Database cleared successfully!');
      currentCategory = 'all';
      currentSearch = '';
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = '';
      await Promise.all([loadSummary(), loadTransactions(), loadCategoriesDropdown()]);
    } else {
      showToast('Failed to clear database');
    }
  } catch (err) {
    console.error('Error clearing database:', err);
    showToast('Network error while clearing database');
  }
}

// Load Transactions
async function loadTransactions() {
  const listEl = document.getElementById('transactionsList');
  try {
    const params = new URLSearchParams();
    if (currentTab !== 'all') params.append('type', currentTab);
    if (currentCategory && currentCategory !== 'all') params.append('category', currentCategory);
    if (currentMonth) params.append('month', currentMonth);
    if (currentSearch) params.append('search', currentSearch);

    const res = await fetch(`/api/transactions?${params.toString()}`);
    const transactions = await res.json();

    if (!transactions || transactions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💸</div>
          <p>No transactions found</p>
          <span>Use '+ Money' to add funds or '- Expense' to track spending.</span>
        </div>
      `;
      return;
    }

    listEl.innerHTML = transactions.map(tx => {
      const isIncome = tx.type === 'income';
      const icon = getCategoryIcon(tx.category);
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'income' : 'expense';

      return `
        <div class="tx-item" data-id="${tx.id}">
          <div class="tx-left">
            <div class="tx-icon">${icon}</div>
            <div class="tx-info">
              <div class="tx-description" title="${escapeHtml(tx.description)}">
                ${escapeHtml(tx.description)}
              </div>
              <div class="tx-meta">
                <span class="tx-category-tag">${escapeHtml(tx.category)}</span>
                <span class="tx-date">${tx.date}</span>
              </div>
            </div>
          </div>
          <div class="tx-right">
            <span class="tx-amount font-mono ${amountClass}">${sign}${formatMoney(tx.amount)}</span>
            <button class="btn-delete-tx" onclick="deleteTransaction(${tx.id})" title="Delete entry">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load transactions:', err);
    listEl.innerHTML = '<div class="empty-state"><p>Error loading transactions</p></div>';
  }
}

// Load Categories for Filter Dropdown
async function loadCategoriesDropdown() {
  try {
    const res = await fetch('/api/categories');
    const categories = await res.json();
    const select = document.getElementById('categoryFilter');
    const currentValue = select.value;

    select.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = `${getCategoryIcon(cat)} ${cat}`;
      select.appendChild(opt);
    });

    if (categories.includes(currentValue)) {
      select.value = currentValue;
    }
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// Modal handling
function openAddModal(type = 'income') {
  const modal = document.getElementById('transactionModal');
  const modalTitle = document.getElementById('modalTitle');
  const typeIncomeRadio = document.getElementById('typeIncome');
  const typeExpenseRadio = document.getElementById('typeExpense');
  const amountInput = document.getElementById('amountInput');
  const descInput = document.getElementById('descInput');
  const customCatGroup = document.getElementById('customCatGroup');
  const customCatInput = document.getElementById('customCatInput');

  // Reset inputs
  amountInput.value = '';
  descInput.value = '';
  if (customCatGroup) customCatGroup.style.display = 'none';
  if (customCatInput) customCatInput.value = '';

  if (type === 'income') {
    typeIncomeRadio.checked = true;
    modalTitle.textContent = 'Add Money (Income)';
  } else {
    typeExpenseRadio.checked = true;
    modalTitle.textContent = 'Add Spent (Expense)';
  }

  updateModalFormType();
  modal.classList.remove('hidden');
  setTimeout(() => amountInput.focus(), 50);
}

function closeModal() {
  document.getElementById('transactionModal').classList.add('hidden');
}

function updateModalFormType() {
  const isIncome = document.getElementById('typeIncome').checked;
  const descLabel = document.getElementById('descLabel');
  const descInput = document.getElementById('descInput');
  const saveBtn = document.getElementById('saveBtn');
  const catSelect = document.getElementById('catSelect');
  const customCatGroup = document.getElementById('customCatGroup');

  customCatGroup.style.display = 'none';

  if (isIncome) {
    descLabel.textContent = 'Source / Note (e.g. Salary, Freelance)';
    descInput.placeholder = 'e.g. Monthly salary, Client payment';
    saveBtn.textContent = 'Add Money';
    saveBtn.className = 'btn btn-primary';

    // Populate income categories
    catSelect.innerHTML = DEFAULT_INCOME_CATS.map(c => 
      `<option value="${c}">${getCategoryIcon(c)} ${c}</option>`
    ).join('') + '<option value="__custom__">➕ New Category...</option>';
  } else {
    descLabel.textContent = 'What did you spend it on?';
    descInput.placeholder = 'e.g. Pizza with friends, Electric bill';
    saveBtn.textContent = 'Record Expense';
    saveBtn.className = 'btn btn-primary';

    // Populate expense categories
    catSelect.innerHTML = DEFAULT_EXPENSE_CATS.map(c => 
      `<option value="${c}">${getCategoryIcon(c)} ${c}</option>`
    ).join('') + '<option value="__custom__">➕ New Category...</option>';
  }
}

function checkCustomCategory(val) {
  const customCatGroup = document.getElementById('customCatGroup');
  const customCatInput = document.getElementById('customCatInput');
  if (val === '__custom__') {
    customCatGroup.style.display = 'block';
    customCatInput.required = true;
    customCatInput.focus();
  } else {
    customCatGroup.style.display = 'none';
    customCatInput.required = false;
  }
}

function setQuickAmount(preset) {
  const amountInput = document.getElementById('amountInput');
  const current = parseFloat(amountInput.value) || 0;
  amountInput.value = (current + preset).toFixed(2);
}

// Handle Form Submission
async function handleFormSubmit(e) {
  e.preventDefault();
  const type = document.getElementById('typeIncome').checked ? 'income' : 'expense';
  const amount = parseFloat(document.getElementById('amountInput').value);
  const description = document.getElementById('descInput').value.trim();
  const catSelect = document.getElementById('catSelect');
  const customCatInput = document.getElementById('customCatInput');
  const date = document.getElementById('dateInput').value;

  let category = catSelect.value;
  if (category === '__custom__') {
    category = customCatInput.value.trim() || 'Other';
  }

  if (isNaN(amount) || amount <= 0) {
    showToast('Please enter a valid amount');
    return;
  }

  try {
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        amount,
        description,
        category,
        date
      })
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Failed to save');
      return;
    }

    closeModal();
    showToast(type === 'income' ? 'Money added successfully!' : 'Expense recorded!');

    // Refresh UI
    await Promise.all([loadSummary(), loadTransactions(), loadCategoriesDropdown()]);
  } catch (err) {
    console.error('Error saving transaction:', err);
    showToast('Network error while saving');
  }
}

// Delete transaction
async function deleteTransaction(id) {
  if (!confirm('Are you sure you want to delete this record?')) return;

  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      showToast('Deleted successfully');
      await Promise.all([loadSummary(), loadTransactions(), loadCategoriesDropdown()]);
    } else {
      showToast('Failed to delete');
    }
  } catch (err) {
    console.error('Error deleting transaction:', err);
    showToast('Error deleting transaction');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

