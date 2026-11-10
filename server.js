const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');
const db = require('./db.js');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) {
        req.socket.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // --- API Routes ---
  try {
    // GET /api/summary
    if (pathname === '/api/summary' && method === 'GET') {
      const month = parsedUrl.query.month || '';
      const summary = db.getSummary(month);
      const currency = db.getSetting('currency', '$');
      return sendJson(res, 200, { ...summary, currency });
    }

    // GET /api/transactions
    if (pathname === '/api/transactions' && method === 'GET') {
      const { type, category, search, month, limit, offset } = parsedUrl.query;
      const transactions = db.getTransactions({
        type,
        category,
        search,
        month,
        limit: limit ? Number(limit) : 200,
        offset: offset ? Number(offset) : 0
      });
      return sendJson(res, 200, transactions);
    }

    // POST /api/transactions
    if (pathname === '/api/transactions' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.type || !['income', 'expense'].includes(body.type)) {
        return sendJson(res, 400, { error: 'Invalid transaction type (must be income or expense)' });
      }
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return sendJson(res, 400, { error: 'Amount must be a positive number' });
      }

      const item = db.addTransaction({
        type: body.type,
        category: body.category || '',
        description: body.description || '',
        amount,
        date: body.date || ''
      });
      return sendJson(res, 201, item);
    }

    // PUT /api/transactions/:id
    if (pathname.startsWith('/api/transactions/') && method === 'PUT') {
      const id = pathname.split('/')[3];
      if (!id) return sendJson(res, 400, { error: 'Missing ID' });
      const body = await parseJsonBody(req);
      if (!body.type || !['income', 'expense'].includes(body.type)) {
        return sendJson(res, 400, { error: 'Invalid transaction type' });
      }
      const amount = parseFloat(body.amount);
      if (isNaN(amount) || amount <= 0) {
        return sendJson(res, 400, { error: 'Amount must be positive number' });
      }

      const success = db.updateTransaction(id, {
        type: body.type,
        category: body.category || '',
        description: body.description || '',
        amount,
        date: body.date || ''
      });
      if (!success) {
        return sendJson(res, 404, { error: 'Transaction not found' });
      }
      return sendJson(res, 200, { success: true });
    }

    // DELETE /api/transactions/:id
    if (pathname.startsWith('/api/transactions/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      if (!id) return sendJson(res, 400, { error: 'Missing ID' });
      const success = db.deleteTransaction(id);
      if (!success) {
        return sendJson(res, 404, { error: 'Transaction not found' });
      }
      return sendJson(res, 200, { success: true });
    }

    // POST /api/clear (Clear all transactions)
    if (pathname === '/api/clear' && method === 'POST') {
      db.clearAllTransactions();
      return sendJson(res, 200, { success: true });
    }

    // GET /api/categories
    if (pathname === '/api/categories' && method === 'GET') {
      const categories = db.getAllCategories();
      return sendJson(res, 200, categories);
    }

    // GET /api/settings
    if (pathname === '/api/settings' && method === 'GET') {
      const currency = db.getSetting('currency', '$');
      const monthlyBudget = Number(db.getSetting('monthly_budget', 0));
      return sendJson(res, 200, { currency, monthlyBudget });
    }

    // POST /api/settings
    if (pathname === '/api/settings' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.currency) {
        db.setSetting('currency', body.currency.trim());
      }
      if (body.monthlyBudget !== undefined) {
        db.setSetting('monthly_budget', Math.max(0, parseFloat(body.monthlyBudget) || 0));
      }
      return sendJson(res, 200, {
        success: true,
        currency: db.getSetting('currency', '$'),
        monthlyBudget: Number(db.getSetting('monthly_budget', 0))
      });
    }

    // GET /api/export (CSV export)
    if (pathname === '/api/export' && method === 'GET') {
      const transactions = db.getTransactions({ limit: 10000 });
      let csv = 'ID,Date,Type,Category,Description,Amount\n';
      for (const t of transactions) {
        const safeDesc = `"${(t.description || '').replace(/"/g, '""')}"`;
        const safeCat = `"${(t.category || '').replace(/"/g, '""')}"`;
        csv += `${t.id},${t.date},${t.type},${safeCat},${safeDesc},${t.amount}\n`;
      }
      res.writeHead(200, {
        'Content-Type': 'text/csv; charset=UTF-8',
        'Content-Disposition': 'attachment; filename="budget-export.csv"'
      });
      return res.end(csv);
    }

    // Static Files Handling
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
      safePath = '/index.html';
    }

    const filePath = path.join(PUBLIC_DIR, safePath);

    // Make sure file is inside PUBLIC_DIR
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Forbidden');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }

    // Fallback: 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) {
    console.error('Server error:', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n=================================================`);
    console.log(`Minimal Budget Planner running at: http://localhost:${port}`);
    console.log(`SQLite database stored in: budget.db`);
    console.log(`=================================================\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const nextPort = Number(PORT) + 1;
    console.warn(`Port ${PORT} is in use, attempting port ${nextPort}...`);
    startServer(nextPort);
  } else {
    console.error('Server error:', err);
  }
});

startServer(PORT);

