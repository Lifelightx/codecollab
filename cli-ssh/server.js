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

const axios = require('axios');

// ── Native SCP File Receiver ──────────────────────────────────────
async function handleScp(stream, command, backendUrl) {
  const parts = command.split(/\s+/);
  const target = parts[parts.length - 1] || 'general';
  const cleanTarget = target.replace(/^\/+|\/+$/g, '');

  let room = 'general';
  let folder = '';

  if (cleanTarget && cleanTarget !== '.') {
    const slash = cleanTarget.indexOf('/');
    if (slash >= 0) {
      room = cleanTarget.slice(0, slash);
      folder = cleanTarget.slice(slash + 1);
    } else {
      room = cleanTarget;
    }
  }

  // Initial ACK
  stream.write(Buffer.from([0]));

  let buffer = Buffer.alloc(0);
  let state = 'WAIT_HEADER';
  let currentFile = null;

  stream.on('data', async (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length > 0) {
      if (state === 'WAIT_HEADER') {
        const newlineIdx = buffer.indexOf(0x0a);
        if (newlineIdx === -1) return;

        const line = buffer.slice(0, newlineIdx).toString('utf8');
        buffer = buffer.slice(newlineIdx + 1);

        if (line.startsWith('C')) {
          const match = line.match(/^C\d+\s+(\d+)\s+(.+)$/);
          if (match) {
            currentFile = {
              size: parseInt(match[1], 10),
              name: match[2],
            };
            state = 'WAIT_DATA';
            stream.write(Buffer.from([0]));
          }
        } else if (line.startsWith('D')) {
          const match = line.match(/^D\d+\s+(\d+)\s+(.+)$/);
          if (match) {
            const dirName = match[2];
            folder = folder ? `${folder}/${dirName}` : dirName;
            await axios.post(`${backendUrl}/api/codespaces/${room}/folder`, {
              folderName: dirName,
              path: folder.split('/').slice(0, -1).join('/'),
            }).catch(() => {});
            stream.write(Buffer.from([0]));
          }
        } else if (line.startsWith('E')) {
          const parts = folder.split('/');
          parts.pop();
          folder = parts.join('/');
          stream.write(Buffer.from([0]));
        }
      } else if (state === 'WAIT_DATA') {
        if (!currentFile) return;

        if (buffer.length >= currentFile.size + 1) {
          const content = buffer.slice(0, currentFile.size);
          buffer = buffer.slice(currentFile.size + 1);

          try {
            await axios.post(`${backendUrl}/api/codespaces/${room}/file`, {
              fileName: currentFile.name,
              path: folder,
              content: content.toString('utf8'),
            });
            console.log(`[SCP] Saved '${currentFile.name}' to '${room}' [folder: '${folder}']`);
          } catch (e) {
            console.error(`[SCP] Error saving file: ${e.message}`);
          }

          state = 'WAIT_HEADER';
          currentFile = null;
          stream.write(Buffer.from([0]));
        } else {
          return;
        }
      }
    }
  });
}

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

          // Command / piped execution / SCP file transfer
          session.on('exec', (accept, reject, info) => {
            const stream = accept();

            if (info.command && info.command.startsWith('scp ')) {
              handleScp(stream, info.command, BACKEND_URL).catch((err) => {
                console.error(`[SSH] SCP error: ${err.message}`);
                stream.end();
              });
              return;
            }

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
