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

// ── Native SCP File Receiver & Sender ─────────────────────────────
async function handleScp(stream, command, backendUrl, authUser, authToken) {
  const parts = command.split(/\s+/);
  const isDownload = parts.includes('-f'); // scp -f is triggered when client downloads: scp host:file ./
  const isUpload = parts.includes('-t');   // scp -t is triggered when client uploads: scp file host:

  const target = parts[parts.length - 1] || 'general';
  const cleanTarget = target.replace(/^\/+|\/+$/g, '');

  let room = 'general';
  let folder = '';
  let requestedFileName = '';

  if (cleanTarget && cleanTarget !== '.') {
    const slash = cleanTarget.indexOf('/');
    if (slash >= 0) {
      room = cleanTarget.slice(0, slash);
      const rest = cleanTarget.slice(slash + 1);
      const lastSlash = rest.lastIndexOf('/');
      if (lastSlash >= 0) {
        folder = rest.slice(0, lastSlash);
        requestedFileName = rest.slice(lastSlash + 1);
      } else {
        requestedFileName = rest;
      }
    } else {
      room = cleanTarget;
    }
  }

  // ── 1. SCP Download Handler (User runs: scp -P 2222 host:room/filename ./) ──
  if (isDownload) {
    try {
      // Find file in room files or room uploads
      let fileBuffer = null;
      let finalName = requestedFileName || 'downloaded_file';

      const spaceRes = await axios.get(`${backendUrl}/api/codespaces/${room}`);
      const files = spaceRes.data?.files || [];
      const matchFile = files.find((f) => !f.isFolder && (f.name === finalName || (f.path ? `${f.path}/${f.name}` : f.name) === cleanTarget.slice(room.length + 1)));

      if (matchFile) {
        fileBuffer = Buffer.from(matchFile.content || '', 'utf8');
        finalName = matchFile.name;
      } else {
        // Look in uploads
        const uploadsRes = await axios.get(`${backendUrl}/api/uploads?spaceName=${room}`);
        const uploads = uploadsRes.data?.uploads || [];
        const matchUpload = uploads.find((u) => u.originalName === finalName || u._id === finalName);
        if (matchUpload) {
          const dlRes = await axios.get(`${backendUrl}/api/uploads/share/${matchUpload._id}`, { responseType: 'arraybuffer' });
          fileBuffer = Buffer.from(dlRes.data);
          finalName = matchUpload.originalName;
        }
      }

      if (!fileBuffer) {
        stream.write(Buffer.from(`\x02scp: ${requestedFileName || cleanTarget}: No such file in workspace '${room}'\n`));
        if (typeof stream.exit === 'function') stream.exit(1);
        stream.end();
        return;
      }

      // Wait for client null ACK to start transfer
      const onClientAck = () => {
        // Send file header: C0644 <length> <filename>\n
        const header = `C0644 ${fileBuffer.length} ${finalName}\n`;
        stream.write(Buffer.from(header));

        stream.once('data', () => {
          // Send file content followed by null byte
          stream.write(fileBuffer);
          stream.write(Buffer.from([0]));

          stream.once('data', () => {
            if (typeof stream.exit === 'function') stream.exit(0);
            stream.end();
          });
        });
      };

      stream.once('data', onClientAck);
      return;
    } catch (err) {
      stream.write(Buffer.from(`\x02scp: Download error: ${err.message}\n`));
      if (typeof stream.exit === 'function') stream.exit(1);
      stream.end();
      return;
    }
  }

  // ── 2. SCP Upload Handler (User runs: scp -P 2222 local-file host:room/) ──
  let user = authUser;
  let token = authToken;

  if (!user || !token) {
    stream.write(Buffer.from('\x02Authentication required to upload files.\nPlease specify your username: scp -P 2222 <file> <username>@jeeban.life:<room>/\n'));
    if (typeof stream.exit === 'function') stream.exit(1);
    stream.end();
    return;
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
            // Upload to storage API with user credentials
            const FormData = require('form-data');
            const form = new FormData();
            form.append('spaceName', room);
            form.append('files', content, { filename: currentFile.name });

            await axios.post(`${backendUrl}/api/uploads`, form, {
              headers: {
                ...form.getHeaders(),
                Authorization: `Bearer ${authToken}`,
              },
            });

            // Also sync into room file tree
            await axios.post(`${backendUrl}/api/codespaces/${room}/file`, {
              fileName: currentFile.name,
              path: folder,
              content: content.toString('utf8'),
            }).catch(() => {});

            console.log(`[SCP] Uploaded '${currentFile.name}' to '${room}' by user '${authUser.username}'`);
          } catch (e) {
            console.error(`[SCP] Error saving file: ${e.response?.data?.message || e.message}`);
            stream.write(Buffer.from(`\x02Upload rejected: ${e.response?.data?.message || e.message}\n`));
            if (typeof stream.exit === 'function') stream.exit(1);
            stream.end();
            return;
          }

          state = 'WAIT_HEADER';
          currentFile = null;
          stream.write(Buffer.from([0]));
          // If transfer is single file, or stream ends, gracefully close
        } else {
          return;
        }
      }
    }
  });

  stream.on('end', () => {
    if (typeof stream.exit === 'function') {
      stream.exit(0);
    }
    stream.end();
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

    let authUser = null;
    let authToken = null;
    let authAttempts = 0;

    client
      .on('authentication', async (ctx) => {
        const username = (ctx.username || '').trim();

        // 1. Method 'none':
        // When running `ssh -p 2222 jeeban.life`, OpenSSH uses the local OS username.
        // If a specific username is explicitly passed (e.g. `scp user@host` or `ssh user@host`),
        // we MUST NOT accept 'none'; we must challenge with password / keyboard-interactive!
        // We only accept 'none' when no username was explicitly provided by the user.
        if (ctx.method === 'none') {
          // If username was explicitly specified in the command (like 'jeeban' or an email), challenge for password!
          if (username && username !== 'root' && username.toLowerCase() !== 'guest' && !username.includes('.')) {
            return ctx.reject(['password', 'keyboard-interactive']);
          }
          // Default instant guest access for `ssh -p 2222 jeeban.life`
          return ctx.accept();
        }

        // 2. Keyboard-Interactive Auth (if requested by client or scp)
        if (ctx.method === 'keyboard-interactive') {
          const prompts = [
            { prompt: 'Email: ', echo: true },
            { prompt: 'Password: ', echo: false },
          ];

          return ctx.prompt(prompts, async (responses) => {
            const userIdentifier = (responses[0] || '').trim();
            const pass = responses[1] || '';

            if (!userIdentifier || !pass) {
              authAttempts += 1;
              if (authAttempts >= 3) {
                client.end();
                return ctx.reject();
              }
              return ctx.reject(['keyboard-interactive']);
            }

            try {
              const res = await axios.post(`${BACKEND_URL}/api/auth/login`, {
                identifier: userIdentifier,
                password: pass,
              });

              authUser = res.data.user;
              authToken = res.data.token;
              console.log(`[SSH] Authenticated user '${authUser.username}' via keyboard-interactive [IP: ${clientIp}]`);
              return ctx.accept();
            } catch (err) {
              authAttempts += 1;
              console.warn(`[SSH] Login failed (${authAttempts}/3) for '${userIdentifier}': ${err.response?.data?.message || err.message}`);
              if (authAttempts >= 3) {
                client.end();
                return ctx.reject();
              }
              return ctx.reject(['keyboard-interactive']);
            }
          });
        }

        // 3. Password Auth (when user runs `scp -P 2222 file user@jeeban.life:room/`)
        if (ctx.method === 'password') {
          try {
            const res = await axios.post(`${BACKEND_URL}/api/auth/login`, {
              identifier: username,
              password: ctx.password,
            });

            authUser = res.data.user;
            authToken = res.data.token;
            console.log(`[SSH] Authenticated user '${authUser.username}' [IP: ${clientIp}]`);
            return ctx.accept();
          } catch (err) {
            authAttempts += 1;
            console.warn(`[SSH] Login failed (${authAttempts}/3) for '${username}': ${err.response?.data?.message || err.message}`);
            if (authAttempts >= 3) {
              client.end();
              return ctx.reject();
            }
            return ctx.reject(['password']);
          }
        }

        ctx.reject(['keyboard-interactive', 'password']);
      })
      .on('ready', () => {
        console.log(`[SSH] Client session ready: ${clientIp} (${authUser ? authUser.username : 'Guest'})`);

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
              user: authUser,
              token: authToken,
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
              handleScp(stream, info.command, BACKEND_URL, authUser, authToken).catch((err) => {
                console.error(`[SSH] SCP error: ${err.message}`);
                stream.end();
              });
              return;
            }

            const term = new TerminalSession(stream, BACKEND_URL, {
              room: 'general',
              user: authUser,
              token: authToken,
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
