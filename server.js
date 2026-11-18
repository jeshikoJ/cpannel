const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const url = require('url');
const { exec } = require('child_process');

const PORT = process.env.PORT || 2083;
const PUBLIC_DIR = path.join(__dirname, 'public');
const STORAGE_ROOT = path.join(__dirname, 'storage', 'public_html');
const DATA_FILE = path.join(__dirname, 'storage', 'cpanel_data.json');

// Ensure storage directories exist
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Seed sample files for File Manager if empty
function seedSampleFiles() {
  const sampleIndex = path.join(STORAGE_ROOT, 'index.html');
  if (!fs.existsSync(sampleIndex)) {
    fs.writeFileSync(sampleIndex, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to My Website</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="hero">
    <h1>🚀 Welcome to My Website</h1>
    <p>This website is successfully hosted and managed via cPanel!</p>
    <a href="#" class="btn">Explore Features</a>
  </div>
</body>
</html>`);

    fs.writeFileSync(path.join(STORAGE_ROOT, 'style.css'), `body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 0;
  background: #0f172a;
  color: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
}
.hero {
  text-align: center;
  padding: 3rem;
  background: #1e293b;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.5);
}
.btn {
  display: inline-block;
  margin-top: 1.5rem;
  padding: 0.75rem 1.75rem;
  background: #ff6c2c;
  color: #fff;
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
}`);

    fs.writeFileSync(path.join(STORAGE_ROOT, 'wp-config-sample.php'), `<?php
/**
 * The base configuration for WordPress
 */
define( 'DB_NAME', 'cpanel_wp_db' );
define( 'DB_USER', 'cpanel_wp_user' );
define( 'DB_PASSWORD', 'SecureP@ssw0rd!2026' );
define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' );
define( 'DB_COLLATE', '' );

$table_prefix = 'wp_';
define( 'WP_DEBUG', false );

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', __DIR__ . '/' );
}
require_once ABSPATH . 'wp-settings.php';
`);

    fs.writeFileSync(path.join(STORAGE_ROOT, 'contact.php'), `<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
    $message = htmlspecialchars($_POST['message'] ?? '');
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Thank you for reaching out! Your message has been queued.'
    ]);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Invalid request']);
`);

    fs.writeFileSync(path.join(STORAGE_ROOT, '.htaccess'), `# cPanel Apache Server Directives
RewriteEngine On
RewriteBase /

# Force HTTPS
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Prevent directory listings
Options -Indexes

# Security Headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "SAMEORIGIN"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>
`);

    const imgDir = path.join(STORAGE_ROOT, 'images');
    if (!fs.existsSync(imgDir)) {
      fs.mkdirSync(imgDir, { recursive: true });
      fs.writeFileSync(path.join(imgDir, 'logo.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <circle cx="50" cy="50" r="45" fill="#ff6c2c"/>
  <path d="M30 50 L45 65 L70 35" stroke="#ffffff" stroke-width="8" fill="none" stroke-linecap="round"/>
</svg>`);
    }
  }
}
seedSampleFiles();

// Initial cPanel mock datasets
let cpanelData = {
  databases: [
    { name: 'cpanel_production', user: 'cpanel_dbadmin', size: '42.8 MB', collation: 'utf8mb4_unicode_ci' },
    { name: 'cpanel_wordpress', user: 'cpanel_wp_user', size: '18.4 MB', collation: 'utf8mb4_general_ci' },
    { name: 'cpanel_analytics', user: 'cpanel_stats', size: '6.2 MB', collation: 'utf8_general_ci' }
  ],
  dns_records: [
    { name: 'example.com', type: 'A', record: '192.168.1.100', ttl: 14400 },
    { name: 'www.example.com', type: 'CNAME', record: 'example.com', ttl: 14400 },
    { name: 'mail.example.com', type: 'A', record: '192.168.1.100', ttl: 14400 },
    { name: 'example.com', type: 'MX', record: 'mail.example.com (Priority 10)', ttl: 14400 },
    { name: 'example.com', type: 'TXT', record: 'v=spf1 +a +mx ~all', ttl: 14400 },
    { name: '_dmarc.example.com', type: 'TXT', record: 'v=DMARC1; p=quarantine;', ttl: 14400 }
  ],
  email_accounts: [
    { email: 'admin@example.com', usage: '320 MB', quota: '1024 MB', lastAccess: 'Today, 10:14 AM' },
    { email: 'support@example.com', usage: '85 MB', quota: '500 MB', lastAccess: 'Yesterday' },
    { email: 'billing@example.com', usage: '12 MB', quota: '500 MB', lastAccess: '3 days ago' },
    { email: 'newsletter@example.com', usage: '140 MB', quota: 'Unlimited', lastAccess: '1 week ago' }
  ],
  cron_jobs: [
    { id: 1, schedule: '0 0 * * *', command: '/usr/local/bin/php /home/user/public_html/cron.php >/dev/null 2>&1', description: 'Daily Database Backup & Maintenance' },
    { id: 2, schedule: '*/15 * * * *', command: 'curl -s https://example.com/api/sync-cache', description: 'Cache Invalidation Poller' }
  ],
  installed_apps: [
    { id: 'app-1', name: 'WordPress', version: '6.7.1', domain: 'example.com', path: '/', installedOn: '2026-10-15', status: 'Healthy' },
    { id: 'app-2', name: 'Node.js App', version: '20.x', domain: 'api.example.com', path: '/api', installedOn: '2026-11-02', status: 'Running' }
  ]
};

// Load saved data if exists
if (fs.existsSync(DATA_FILE)) {
  try {
    cpanelData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Error loading cpanel_data.json:', e);
  }
}

function persistData() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(cpanelData, null, 2), 'utf8');
  } catch (e) {
    console.error('Error persisting cpanel_data.json:', e);
  }
}

// Helpers
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.connection.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendJson(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// Safe path resolver within STORAGE_ROOT
function resolveSafePath(relPath = '') {
  const safeRel = path.normalize(relPath).replace(/^(\.\.[\/\\])+/, '');
  const target = path.join(STORAGE_ROOT, safeRel);
  if (!target.startsWith(STORAGE_ROOT)) {
    return STORAGE_ROOT;
  }
  return target;
}

// CPU load tracking helper
let lastCpuInfo = os.cpus();
function getCpuUsagePercent() {
  const currentCpus = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;

  for (let i = 0; i < currentCpus.length; i++) {
    const prev = lastCpuInfo[i] ? lastCpuInfo[i].times : currentCpus[i].times;
    const curr = currentCpus[i].times;

    const prevTotal = Object.values(prev).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(curr).reduce((a, b) => a + b, 0);

    idleDiff += curr.idle - prev.idle;
    totalDiff += currTotal - prevTotal;
  }

  lastCpuInfo = currentCpus;
  if (totalDiff === 0) return 12.5; // fallback baseline
  const percentage = Math.max(0, Math.min(100, (1 - idleDiff / totalDiff) * 100));
  return parseFloat(percentage.toFixed(1));
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // --- API ROUTES ---

  // 1. Live Stats Endpoint
  if (pathname === '/api/stats' && req.method === 'GET') {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercentage = parseFloat(((usedMem / totalMem) * 100).toFixed(1));
    const cpuUsage = getCpuUsagePercent();

    // Calculate files count and approx storage size
    let fileCount = 0;
    let totalStorageBytes = 0;
    try {
      function scanDir(dir) {
        const list = fs.readdirSync(dir);
        for (const item of list) {
          const full = path.join(dir, item);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            scanDir(full);
          } else {
            fileCount++;
            totalStorageBytes += stat.size;
          }
        }
      }
      scanDir(STORAGE_ROOT);
    } catch (e) {
      // ignore
    }

    const storageMB = (totalStorageBytes / (1024 * 1024)).toFixed(2);

    return sendJson(res, {
      server: {
        hostname: os.hostname(),
        platform: os.platform(),
        release: os.release(),
        uptimeSeconds: Math.floor(os.uptime()),
        cpanelVersion: '124.0.18',
        apacheVersion: 'Apache/2.4.62 (Unix)',
        phpVersion: 'PHP 8.3.14',
        mysqlVersion: 'MySQL 8.0.39-community',
        serverIp: '192.168.1.100',
        serverName: 'cpanel.localdomain',
        sslStatus: 'Active (AutoSSL Valid)'
      },
      resources: {
        cpu: {
          usagePercent: cpuUsage,
          cores: os.cpus().length,
          model: os.cpus()[0]?.model || 'Generic x86_64 Processor'
        },
        memory: {
          totalBytes: totalMem,
          usedBytes: usedMem,
          freeBytes: freeMem,
          usagePercent: memPercentage,
          totalGB: (totalMem / (1024 ** 3)).toFixed(2),
          usedGB: (usedMem / (1024 ** 3)).toFixed(2)
        },
        disk: {
          usedMB: storageMB,
          quotaMB: '50000.00',
          usagePercent: parseFloat(((parseFloat(storageMB) / 50000) * 100).toFixed(2)) || 2.4
        },
        bandwidth: {
          usedGB: '38.45',
          quotaGB: '500.00',
          usagePercent: 7.7
        },
        inodes: {
          used: fileCount + 1420,
          limit: 250000,
          usagePercent: parseFloat((((fileCount + 1420) / 250000) * 100).toFixed(1))
        },
        mysqlDisk: {
          usedMB: '67.4 MB',
          quotaMB: '5000 MB',
          usagePercent: 1.3
        },
        entryProcesses: {
          current: 3,
          limit: 25
        }
      }
    });
  }

  // 2. File Manager: List Directory
  if (pathname === '/api/files' && req.method === 'GET') {
    const relDir = parsedUrl.query.dir || '';
    const targetDir = resolveSafePath(relDir);

    try {
      if (!fs.existsSync(targetDir)) {
        return sendJson(res, { error: 'Directory does not exist' }, 404);
      }

      const items = fs.readdirSync(targetDir);
      const fileList = items.map(name => {
        const fullPath = path.join(targetDir, name);
        try {
          const stats = fs.statSync(fullPath);
          return {
            name,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            mtime: stats.mtime,
            permissions: (stats.mode & parseInt('777', 8)).toString(8)
          };
        } catch (e) {
          return { name, isDirectory: false, size: 0, mtime: new Date(), permissions: '0644' };
        }
      });

      // Sort: folders first, then alphabetically
      fileList.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

      const currentRel = path.relative(STORAGE_ROOT, targetDir).replace(/\\/g, '/');
      return sendJson(res, {
        currentPath: currentRel ? '/' + currentRel : '/',
        files: fileList
      });
    } catch (e) {
      return sendJson(res, { error: e.message }, 500);
    }
  }

  // 3. File Manager: Read File
  if (pathname === '/api/files/read' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const targetPath = resolveSafePath(body.path || '');
      if (!fs.existsSync(targetPath) || fs.statSync(targetPath).isDirectory()) {
        return sendJson(res, { error: 'File not found or is a directory' }, 404);
      }
      const content = fs.readFileSync(targetPath, 'utf8');
      return sendJson(res, { content, path: body.path });
    } catch (e) {
      return sendJson(res, { error: e.message }, 500);
    }
  }

  // 4. File Manager: Write/Save File
  if (pathname === '/api/files/write' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const targetPath = resolveSafePath(body.path || '');
      fs.writeFileSync(targetPath, body.content || '', 'utf8');
      return sendJson(res, { success: true, message: 'File saved successfully' });
    } catch (e) {
      return sendJson(res, { error: e.message }, 500);
    }
  }

  // 5. File Manager: Create File or Folder
  if (pathname === '/api/files/create' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const targetPath = resolveSafePath(body.path || '');
      if (fs.existsSync(targetPath)) {
        return sendJson(res, { error: 'Item already exists' }, 400);
      }
      if (body.isDirectory) {
        fs.mkdirSync(targetPath, { recursive: true });
      } else {
        fs.writeFileSync(targetPath, body.content || '', 'utf8');
      }
      return sendJson(res, { success: true, message: `${body.isDirectory ? 'Directory' : 'File'} created successfully` });
    } catch (e) {
      return sendJson(res, { error: e.message }, 500);
    }
  }

  // 6. File Manager: Delete Item
  if (pathname === '/api/files/delete' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const targetPath = resolveSafePath(body.path || '');
      if (!fs.existsSync(targetPath)) {
        return sendJson(res, { error: 'Item does not exist' }, 404);
      }
      const stats = fs.statSync(targetPath);
      if (stats.isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      return sendJson(res, { success: true, message: 'Deleted successfully' });
    } catch (e) {
      return sendJson(res, { error: e.message }, 500);
    }
  }

  // 7. File Manager: Rename Item
  if (pathname === '/api/files/rename' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const oldTarget = resolveSafePath(body.oldPath || '');
      const newTarget = resolveSafePath(body.newPath || '');
      if (!fs.existsSync(oldTarget)) {
        return sendJson(res, { error: 'Original item does not exist' }, 404);
      }
      fs.renameSync(oldTarget, newTarget);
      return sendJson(res, { success: true, message: 'Renamed successfully' });
    } catch (e) {
      return sendJson(res, { error: e.message }, 500);
    }
  }

  // 8. Web Terminal Execution Endpoint
  if (pathname === '/api/terminal' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const rawCmd = (body.command || '').trim();
      if (!rawCmd) {
        return sendJson(res, { output: '' });
      }

      // Built-in terminal simulation & safe execution
      const [cmd, ...args] = rawCmd.split(/\s+/);
      const lowerCmd = cmd.toLowerCase();

      if (lowerCmd === 'help') {
        const helpText = `cPanel Virtual Terminal (CLI v2.4.0)
Available commands:
  uptime       - Show system uptime & load
  whoami       - Display current cPanel user
  pwd          - Print current working directory
  ls, dir      - List files in current directory
  date         - Display current server date and time
  cat <file>   - Display file contents
  df -h        - Display disk free statistics
  free -m      - Display memory usage in megabytes
  uname -a     - Display kernel and OS information
  node -v      - Print Node.js runtime version
  python --version - Print Python version
  git --version    - Print Git version
  php -v       - Show PHP CLI info
  mysql -v     - Show MySQL client info
  clear        - Clear terminal screen
  help         - Display this help message`;
        return sendJson(res, { output: helpText });
      }

      if (lowerCmd === 'whoami') {
        return sendJson(res, { output: 'cpanel_admin (UID: 1001, GID: 1001, Home: /home/cpanel_admin)' });
      }

      if (lowerCmd === 'pwd') {
        return sendJson(res, { output: '/home/cpanel_admin/public_html' });
      }

      if (lowerCmd === 'uptime') {
        const uptimeSec = Math.floor(os.uptime());
        const days = Math.floor(uptimeSec / 86400);
        const hours = Math.floor((uptimeSec % 86400) / 3600);
        const mins = Math.floor((uptimeSec % 3600) / 60);
        return sendJson(res, { output: ` 11:42:15 up ${days} days, ${hours}:${mins}, 1 user, load average: 0.18, 0.22, 0.15` });
      }

      if (lowerCmd === 'df' && args.includes('-h')) {
        return sendJson(res, {
          output: `Filesystem      Size  Used Avail Use% Mounted on
/dev/sda1        50G  1.2G   46G   3% /
/dev/sda2       100G   24G   71G  26% /home
tmpfs           7.8G     0  7.8G   0% /dev/shm`
        });
      }

      if (lowerCmd === 'free' && (args.includes('-m') || args.includes('-h'))) {
        const totalMb = Math.round(os.totalmem() / 1048576);
        const freeMb = Math.round(os.freemem() / 1048576);
        const usedMb = totalMb - freeMb;
        return sendJson(res, {
          output: `               total        used        free      shared  buff/cache   available
Mem:           ${totalMb}        ${usedMb}        ${freeMb}          32        1820       ${freeMb + 1200}
Swap:           4096         120        3976`
        });
      }

      if (lowerCmd === 'uname') {
        return sendJson(res, { output: `Linux cpanel-server 6.6.32-x86_64-cpanel #1 SMP PREEMPT_DYNAMIC ${os.release()} x86_64 x86_64 GNU/Linux` });
      }

      if (lowerCmd === 'php' && args.includes('-v')) {
        return sendJson(res, { output: `PHP 8.3.14 (cli) (built: Dec 12 2025 18:22:10) (NTS)\nCopyright (c) The PHP Group\nZend Engine v4.3.14, Copyright (c) Zend Technologies with Zend OPcache` });
      }

      if (lowerCmd === 'mysql' && args.includes('-v')) {
        return sendJson(res, { output: `mysql  Ver 8.0.39 for Linux on x86_64 (MySQL Community Server - GPL)` });
      }

      if (lowerCmd === 'ls' || lowerCmd === 'dir') {
        const files = fs.readdirSync(STORAGE_ROOT);
        const formatted = files.map(f => {
          const s = fs.statSync(path.join(STORAGE_ROOT, f));
          return `${s.isDirectory() ? 'drwxr-xr-x' : '-rw-r--r--'} 1 cpanel_admin cpanel_admin ${String(s.size).padStart(8)} ${s.mtime.toLocaleDateString()} ${f}`;
        }).join('\n');
        return sendJson(res, { output: formatted });
      }

      if (lowerCmd === 'cat') {
        const targetFile = args[0];
        if (!targetFile) return sendJson(res, { output: 'cat: missing file operand' });
        const filePath = resolveSafePath(targetFile);
        if (fs.existsSync(filePath) && !fs.statSync(filePath).isDirectory()) {
          const content = fs.readFileSync(filePath, 'utf8');
          return sendJson(res, { output: content.substring(0, 10000) });
        } else {
          return sendJson(res, { output: `cat: ${targetFile}: No such file or directory` });
        }
      }

      // Execute safe local shell binaries if supported
      const safeBinaries = ['node', 'git', 'python', 'date', 'echo'];
      if (safeBinaries.includes(lowerCmd)) {
        exec(rawCmd, { timeout: 4000, cwd: STORAGE_ROOT }, (err, stdout, stderr) => {
          return sendJson(res, { output: (stdout || stderr || (err ? err.message : '')).trim() });
        });
        return;
      }

      return sendJson(res, { output: `bash: ${cmd}: command not found. Type 'help' to see allowed commands.` });
    } catch (e) {
      return sendJson(res, { error: e.message }, 500);
    }
  }

  // 9. Data APIs for Databases, DNS, Emails, Cron, and Apps
  if (pathname.startsWith('/api/data/')) {
    const collection = pathname.replace('/api/data/', '').trim();
    if (!cpanelData[collection]) {
      return sendJson(res, { error: 'Unknown collection' }, 404);
    }

    if (req.method === 'GET') {
      return sendJson(res, { [collection]: cpanelData[collection] });
    }

    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        if (body.action === 'create') {
          cpanelData[collection].push(body.item);
          persistData();
          return sendJson(res, { success: true, [collection]: cpanelData[collection] });
        }
        if (body.action === 'delete') {
          cpanelData[collection] = cpanelData[collection].filter(item => {
            if (body.id) return item.id !== body.id;
            if (body.name) return item.name !== body.name;
            if (body.email) return item.email !== body.email;
            return true;
          });
          persistData();
          return sendJson(res, { success: true, [collection]: cpanelData[collection] });
        }
      } catch (e) {
        return sendJson(res, { error: e.message }, 500);
      }
    }
  }

  // --- STATIC FILE SERVING ---
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Access Denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA if not an api call
      if (!pathname.startsWith('/api/')) {
        filePath = path.join(PUBLIC_DIR, 'index.html');
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Endpoint not found' }));
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server Error loading file');
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

// Try starting on PORT (2083 default), fallback to 3000 if restricted
server.on('error', (e) => {
  if (e.code === 'EADDRINUSE' || e.code === 'EACCES') {
    console.warn(`Port ${PORT} unavailable (${e.code}), falling back to 3000...`);
    server.listen(3000, () => {
      console.log(`\n======================================================`);
      console.log(` cPanel Control Panel is running!`);
      console.log(` Open in browser: http://localhost:3000`);
      console.log(`======================================================\n`);
    });
  } else {
    console.error('Server error:', e);
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` cPanel Control Panel is running!`);
  console.log(` Open in browser: http://localhost:${PORT}`);
  console.log(` Storage Root:    ${STORAGE_ROOT}`);
  console.log(`======================================================\n`);
});
