const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('ssh2');
const TerminalSession = require('./tui');

const PORT = parseInt(process.env.SSH_PORT || '2222', 10);
const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:5000';
const KEY_PATH = process.env.KEY_PATH || path.join(__dirname, 'host_key.pem');

// ── Ensure Host Key ───────────────────────────────────────────────
function getOrCreateHostKey() {
  if (fs.existsSync(KEY_PATH)) {
    const existing = fs.readFileSync(KEY_PATH, 'utf8');
    if (existing.includes('BEGIN RSA PRIVATE KEY') || existing.includes('BEGIN OPENSSH PRIVATE KEY')) {
      return existing;
    }
  }
  console.log('[SSH] Generating new 2048-bit RSA host key (PKCS1 format)...');
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  });
  try {
    fs.mkdirSync(path.dirname(KEY_PATH), { recursive: true });
    fs.writeFileSync(KEY_PATH, privateKey, { mode: 0o600 });
  } catch (err) {
    console.warn('[SSH] Could not persist host key to disk; using in-memory key.');
  }
  return privateKey;
}

const hostKey = getOrCreateHostKey();

// ── SSH Server ────────────────────────────────────────────────────
const server = new Server(
  {
    hostKeys: [hostKey],
  },
  (client, info) => {
    const clientIp = info.ip || 'unknown';
    console.log(`[SSH] Incoming connection from ${clientIp}:${info.port}`);

    client
      .on('authentication', (ctx) => {
        // Accept all authentication methods (none, password, publickey) as guest
        ctx.accept();
      })
      .on('ready', () => {
        console.log(`[SSH] Client authenticated: ${clientIp}`);

        client.on('session', (accept, reject) => {
          const session = accept();
          let ptyInfo = null;

          session.on('pty', (accept, reject, info) => {
            ptyInfo = info;
            accept();
          });

          session.on('window-change', (accept, reject, info) => {
            ptyInfo = info;
            if (accept) accept();
          });

          // Interactive TUI session
          session.on('shell', (accept, reject) => {
            const stream = accept();
            const term = new TerminalSession(stream, BACKEND_URL, {
              room: 'general',
              pty: ptyInfo,
            });
            term.runInteractive().catch((err) => {
              console.error(`[SSH] Interactive session error: ${err.message}`);
              stream.end();
            });
          });

          // Command / piped execution (e.g. cat file | ssh ...)
          session.on('exec', (accept, reject, info) => {
            const stream = accept();
            const term = new TerminalSession(stream, BACKEND_URL, {
              room: 'general',
            });
            term.handlePipedExecution(info.command).catch((err) => {
              console.error(`[SSH] Exec session error: ${err.message}`);
              stream.end();
            });
          });
        });
      })
      .on('close', () => {
        console.log(`[SSH] Connection closed: ${clientIp}`);
      })
      .on('error', (err) => {
        console.error(`[SSH] Client error (${clientIp}):`, err.message);
      });
  }
);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SSH] CodeCollab SSH Terminal listening on 0.0.0.0:${PORT}`);
  console.log(`[SSH] Backend target: ${BACKEND_URL}`);
});

process.on('SIGTERM', () => {
  console.log('[SSH] Shutting down...');
  server.close(() => process.exit(0));
});
