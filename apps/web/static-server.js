import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3000;
const ROOT = '/sessions/pensive-admiring-thompson/mnt/web';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Route to sgi360-portal.html for root
  let filePath = req.url === '/' ? '/sgi360-portal.html' : req.url;
  filePath = path.join(ROOT, filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found\n' + filePath);
      return;
    }

    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ Static server running on http://localhost:${PORT}`);
  console.log(`🌐 SGI 360 Portal: http://localhost:${PORT}/`);
  console.log(`📝 Test page: http://localhost:${PORT}/test-login.html`);
  console.log(`📝 Legacy portal: http://localhost:${PORT}/sgi360-portal.html\n`);
});
