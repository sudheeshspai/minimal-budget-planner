# 💰 Minimal Budget Planner

A sleek, minimal, and fast budget planner with **real SQLite database** persistence. Zero external dependencies—runs natively with Node.js.

---

## ✨ Features

- **Real SQLite Database (`budget.db`)**: All transactions, categories, and settings are saved on disk automatically.
- **Accurate Budget Calculation**:
  - **Current Balance**: Instant calculation of net saved amount.
  - **Total Added (Income)**: Track all earnings and money added.
  - **Total Spent (Expenses)**: Real-time sum of expenditures.
- **"What I Spent For What" Breakdown**:
  - Visual category progress bars with percentage share of total spending.
  - Item count and category sums (Food, Rent, Bills, Groceries, Shopping, etc.).
- **Quick "+ Add Money" Button**:
  - Deposit funds with 1-click preset chips (`+10`, `+50`, `+100`, `+500`, `+1,000`) or custom amounts.
- **"- Add Expense" Tracker**:
  - Record what you spent on, choose or add custom categories, and pick dates.
- **Search & Filtering**:
  - Filter by **All**, **Expenses**, or **Income**.
  - Search by note, description, or category.
  - Monthly archive filter.
- **Currency Switcher**:
  - Easily switch between `$ (USD)`, `₹ (INR)`, `€ (EUR)`, `£ (GBP)`, `¥ (JPY)`, `C$ (CAD)`, and `A$ (AUD)`.
- **CSV Data Export**: Download your complete budget history with 1 click.
- **Dark / Light Mode**: Seamless theme switching with saved preference.

---

## 🚀 How to Run

In the project folder, simply run:

```bash
npm start
```
*(or `node server.js`)*

Then open your browser at:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📁 File Structure

```text
budget planer/
├── budget.db          # Local SQLite Database (auto-created)
├── db.js              # Database initialization & queries using Node's native SQLite
├── server.js          # Lightweight Node HTTP server and REST API
├── package.json       # Project info & start script
└── public/
    ├── index.html     # Minimalist dashboard UI
    ├── style.css      # Polished, modern responsive styling & dark/light theme
    └── app.js         # Frontend reactivity, API integration, and charts
```

