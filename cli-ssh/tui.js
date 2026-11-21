const axios = require('axios');
const readline = require('readline');
const FormData = require('form-data');

// ANSI formatting helpers - Cyber Pink & Neon Green Theme (Zero emojis)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Theme: Cyber Pink
  pink: '\x1b[38;5;206m',        // Vibrant Pink
  pinkBright: '\x1b[38;5;213m',  // Bright Neon Pink
  pinkBg: '\x1b[48;5;198m',      // Pink Background

  // Theme: Neon Green
  green: '\x1b[38;5;48m',        // Neon Emerald Green
  greenBright: '\x1b[38;5;49m',  // Bright Green
  greenDim: '\x1b[38;5;29m',     // Dark Emerald
  greenBg: '\x1b[48;5;35m',      // Green Background

  // Utility colors
  white: '\x1b[97m',
  gray: '\x1b[90m',
  grayLight: '\x1b[37m',
  red: '\x1b[38;5;196m',
  yellow: '\x1b[38;5;220m',
};

class TerminalSession {
  constructor(stream, backendUrl, options = {}) {
    this.stream = stream;
    this.backendUrl = backendUrl.replace(/\/+$/, '');
    this.room = options.room || 'general';
    this.running = true;
    this.token = null;
    this.user = null;
  }

  write(text) {
    if (this.stream && this.stream.writable) {
      this.stream.write(text.replace(/\n/g, '\r\n'));
    }
  }

  writeln(text = '') {
    this.write(text + '\n');
  }

  clearScreen() {
    this.write('\x1b[2J\x1b[H');
  }

  printHeader() {
    const userDisplay = this.user
      ? `${C.green}${C.bold}${this.user.username}${C.reset} ${C.gray}(${this.user.email})${C.reset} ${C.pink}[${((this.user.storageUsedBytes || 0) / (1024 * 1024)).toFixed(1)} MB / 200 MB]${C.reset}`
      : `${C.yellow}Guest${C.reset} ${C.dim}[Select 'Log In' to unlock 200MB uploads]${C.reset}`;

    this.writeln(`${C.green}┌────────────────────────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.green}│${C.reset}  ${C.bold}${C.pink}CODECOLLAB TERMINAL CLIENT${C.reset} ${C.dim}v1.0.0${C.reset}                                    ${C.green}│${C.reset}`);
    this.writeln(`${C.green}│${C.reset}  Endpoint : ${C.white}https://jeeban.life${C.reset}                     Status : ${C.green}${C.bold}CONNECTED${C.reset}    ${C.green}│${C.reset}`);
    this.writeln(`${C.green}└────────────────────────────────────────────────────────────────────────┘${C.reset}`);
    this.writeln(`  ${C.dim}Active User      :${C.reset} ${userDisplay}`);
    this.writeln(`  ${C.dim}Active Workspace :${C.reset} ${C.bold}${C.pink}${this.room}${C.reset}`);
    this.writeln(`  ${C.dim}Web URL          :${C.reset} ${C.green}${C.underline}https://jeeban.life/${this.room}${C.reset}`);
    this.writeln();
  }

  // ── Interactive Arrow / Tab Menu Selector ───────────────────────
  async selectMenu(items, title = 'Available Commands', initialIndex = 0) {
    this.stream.resume();
    let index = initialIndex;
    const count = items.length;

    const render = () => {
      let out = '';
      items.forEach((item, i) => {
        const isSel = i === index;
        if (isSel) {
          // Highlighted: Pink pointer, Green tag, Bold Pink label with bracket
          out += `  ${C.pink}${C.bold}»${C.reset} ${C.green}${C.bold}[${item.key}]${C.reset} ${C.pink}${C.bold}${item.label}${C.reset}\x1b[K\r\n`;
        } else {
          out += `    ${C.dim}[${item.key}]${C.reset} ${C.grayLight}${item.label}${C.reset}\x1b[K\r\n`;
        }
      });
      return out;
    };

    this.writeln(`${C.bold}${C.green}${title}:${C.reset}`);
    this.writeln(`${C.dim}  Navigate: ${C.pink}↑ / ↓${C.dim} or ${C.pink}Tab${C.dim}  |  Select: ${C.green}Enter${C.dim}  |  Direct: [Number Key]${C.reset}\r\n`);

    // Hide cursor during interactive selection
    this.write('\x1b[?25l');
    this.write(render());

    return new Promise((resolve) => {
      const onData = (chunk) => {
        const key = chunk.toString();

        if (key === '\u001b[A' || key === 'k') { // Up arrow
          index = (index - 1 + count) % count;
        } else if (key === '\u001b[B' || key === 'j') { // Down arrow
          index = (index + 1) % count;
        } else if (key === '\t') { // Tab
          index = (index + 1) % count;
        } else if (key === '\u001b[Z') { // Shift + Tab
          index = (index - 1 + count) % count;
        } else if (key === '\r' || key === '\n') { // Enter
          cleanup();
          return resolve(items[index].value);
        } else if (key === '\u0003') { // Ctrl+C
          cleanup();
          return resolve('exit');
        } else {
          // Direct hotkey matching (e.g. typing '1', '2', '0')
          const trimmed = key.trim().toLowerCase();
          const match = items.findIndex((it) => it.key.toLowerCase() === trimmed);
          if (match >= 0) {
            cleanup();
            return resolve(items[match].value);
          }
          return;
        }

        // Reposition cursor back up and redraw menu lines smoothly
        this.write(`\x1b[${count}A\r`);
        this.write(render());
      };

      const cleanup = () => {
        this.stream.removeListener('data', onData);
        this.write('\x1b[?25h'); // Restore cursor
        this.writeln();
      };

      this.stream.on('data', onData);
    });
  }

  // ── Text Prompts ────────────────────────────────────────────────
  async prompt(questionText) {
    this.stream.resume();
    const rl = readline.createInterface({
      input: this.stream,
      output: this.stream,
      terminal: true,
    });

    return new Promise((resolve) => {
      rl.question(`${C.green}${questionText}${C.reset}`, (answer) => {
        rl.close();
        this.stream.resume();
        resolve((answer || '').trim());
      });
    });
  }

  // Masked secret prompt (prints '*' for passwords without hanging)
  async promptSecret(questionText) {
    this.stream.resume();
    const { Writable } = require('stream');
    let muted = true;

    const mutableStdout = new Writable({
      write: (chunk, encoding, callback) => {
        if (!muted) {
          this.stream.write(chunk, encoding);
        } else {
          const str = chunk.toString();
          if (str === '\r' || str === '\n') {
            this.stream.write('\r\n');
          } else {
            this.stream.write(`${C.pink}*${C.reset}`);
          }
        }
        callback();
      }
    });

    const rl = readline.createInterface({
      input: this.stream,
      output: mutableStdout,
      terminal: true,
    });

    return new Promise((resolve) => {
      muted = false;
      this.write(`${C.green}${questionText}${C.reset}`);
      muted = true;

      rl.question('', (answer) => {
        rl.close();
        this.stream.resume();
        resolve((answer || '').trim());
      });
    });
  }

  // ── Main Interactive Loop ───────────────────────────────────────
  async runInteractive() {
    this.clearScreen();
    this.printHeader();

    let lastSelectedIndex = 0;

    while (this.running) {
      const menuItems = [
        { key: '1', label: 'Paste Text / Code Buffer', value: 'paste' },
        { key: '2', label: 'Upload File to Storage (Requires Login)', value: 'upload' },
        { key: '3', label: 'List Files in Workspace', value: 'list' },
        { key: '4', label: 'View File Content', value: 'view' },
        { key: '5', label: 'Switch Active Workspace', value: 'switch' },
      ];

      if (!this.user) {
        menuItems.push({ key: '6', label: 'Log In', value: 'login' });
        menuItems.push({ key: '7', label: 'Register (New Account)', value: 'register' });
      } else {
        menuItems.push({ key: '6', label: `Log Out (${this.user.username})`, value: 'logout' });
      }

      menuItems.push({ key: '8', label: 'Workspace Access Info', value: 'info' });
      menuItems.push({ key: '0', label: 'Disconnect Session', value: 'exit' });

      const choice = await this.selectMenu(menuItems, 'Main Menu', lastSelectedIndex);

      // Track index for next render
      const foundIdx = menuItems.findIndex((m) => m.value === choice);
      if (foundIdx >= 0) lastSelectedIndex = foundIdx;

      switch (choice) {
        case 'paste':
          await this.handlePasteBuffer();
          break;
        case 'upload':
          await this.handleFileUpload();
          break;
        case 'list':
          await this.handleListFiles();
          break;
        case 'view':
          await this.handleViewFile();
          break;
        case 'switch':
          await this.handleSwitchRoom();
          break;
        case 'login':
          await this.handleLogin();
          break;
        case 'register':
          await this.handleRegister();
          break;
        case 'logout':
          this.handleLogout();
          break;
        case 'info':
          this.handleShowLink();
          break;
        case 'exit':
          this.running = false;
          this.writeln(`${C.green}[INFO] Session terminated. Goodbye.${C.reset}`);
          this.stream.end();
          return;
      }

      this.writeln();
    }
  }

  // ── Authentication Handlers ─────────────────────────────────────
  async handleLogin() {
    this.writeln(`${C.pink}┌── [ USER LOGIN ] ─────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Enter your CodeCollab credentials to log in.                           ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    const identifier = await this.prompt('Username or Email : ');
    if (!identifier) {
      this.writeln(`${C.yellow}[INFO] Login cancelled.${C.reset}\n`);
      return false;
    }

    const password = await this.promptSecret('Password          : ');
    if (!password) {
      this.writeln(`${C.yellow}[INFO] Login cancelled.${C.reset}\n`);
      return false;
    }

    this.writeln(`${C.pink}[WAIT] Authenticating with server...${C.reset}`);

    try {
      const res = await axios.post(`${this.backendUrl}/api/auth/login`, {
        identifier,
        password,
      });

      this.token = res.data.token;
      this.user = res.data.user;

      this.writeln(`${C.green}[OK] Logged in successfully as '${this.user.username}'!${C.reset}`);
      this.writeln(`Storage: ${((this.user.storageUsedBytes || 0) / (1024 * 1024)).toFixed(2)} MB / 200 MB used.\n`);
      return true;
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Authentication failed: ${err.response?.data?.message || err.message}${C.reset}\n`);
      return false;
    }
  }

  async handleRegister() {
    this.writeln(`${C.pink}┌── [ CREATE ACCOUNT ] ─────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Registration requires email verification via a 6-digit code.           ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    const email = await this.prompt('Email Address    : ');
    if (!email) return;

    const username = await this.prompt('Choose Username  : ');
    if (!username) return;

    const password = await this.promptSecret('Choose Password  : ');
    if (!password || password.length < 6) {
      this.writeln(`${C.red}[ERROR] Password must be at least 6 characters.${C.reset}\n`);
      return;
    }

    this.writeln(`${C.pink}[WAIT] Sending 6-digit verification code to '${email}'...${C.reset}`);

    try {
      const otpRes = await axios.post(`${this.backendUrl}/api/auth/send-otp`, {
        email,
        username,
        password,
      });

      this.writeln(`${C.green}[OK] ${otpRes.data.message}${C.reset}`);
      if (otpRes.data.simulated && otpRes.data.otpPreview) {
        this.writeln(`${C.yellow}[DEV SIMULATION] Verification OTP: ${otpRes.data.otpPreview}${C.reset}`);
      }

      const otp = await this.prompt('Enter 6-digit code: ');
      if (!otp) {
        this.writeln(`${C.yellow}[INFO] Registration cancelled.${C.reset}\n`);
        return;
      }

      this.writeln(`${C.pink}[WAIT] Verifying code...${C.reset}`);

      const verifyRes = await axios.post(`${this.backendUrl}/api/auth/verify-otp`, {
        email,
        otp,
      });

      this.token = verifyRes.data.token;
      this.user = verifyRes.data.user;

      this.writeln(`${C.green}[OK] Account created and verified! Logged in as '${this.user.username}'.${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Registration failed: ${err.response?.data?.message || err.message}${C.reset}\n`);
    }
  }

  handleLogout() {
    this.token = null;
    this.user = null;
    this.writeln(`${C.green}[OK] Logged out. Now operating in Guest mode.${C.reset}\n`);
  }

  // ── File Upload via Storage API (Auth Required) ──────────────────
  async handleFileUpload() {
    if (!this.user || !this.token) {
      this.writeln(`${C.yellow}[AUTH REQUIRED] File storage uploads require a signed-in account.${C.reset}`);
      const doLogin = await this.prompt('Would you like to log in now? [y/N]: ');
      if (doLogin.toLowerCase() === 'y') {
        const ok = await this.handleLogin();
        if (!ok) return;
      } else {
        return;
      }
    }

    this.writeln(`${C.pink}┌── [ FILE UPLOAD ] ────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Paste the raw or Base64 content of the file.                          ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Finish with ${C.bold}:wq${C.reset} on a new line, or ${C.bold}:q!${C.reset} to cancel.                       ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    const fileName = await this.prompt('Target file name (e.g. document.pdf, image.png): ');
    if (!fileName) return;

    this.writeln(`\n${C.green}[INPUT] Paste file contents or Base64 stream (finish with :wq):${C.reset}`);

    const lines = [];
    const rl = readline.createInterface({ input: this.stream, output: this.stream, terminal: true });

    await new Promise((resolve) => {
      rl.on('line', (line) => {
        if (line.trim() === ':wq') {
          rl.close();
          resolve();
        } else if (line.trim() === ':q!') {
          lines.length = 0;
          rl.close();
          resolve();
        } else {
          lines.push(line);
        }
      });
    });
    this.stream.resume();

    if (lines.length === 0) {
      this.writeln(`${C.yellow}[INFO] Upload cancelled or empty buffer.${C.reset}\n`);
      return;
    }

    const rawData = lines.join('\n');
    let fileBuffer;
    const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(rawData) && rawData.length % 4 === 0 && !rawData.includes(' ');
    if (isBase64) {
      fileBuffer = Buffer.from(rawData.replace(/\s+/g, ''), 'base64');
    } else {
      fileBuffer = Buffer.from(rawData, 'utf8');
    }

    this.writeln(`${C.pink}[WAIT] Uploading ${fileBuffer.length} bytes to workspace '${this.room}'...${C.reset}`);

    try {
      const form = new FormData();
      form.append('spaceName', this.room);
      form.append('files', fileBuffer, { filename: fileName });

      const res = await axios.post(`${this.backendUrl}/api/uploads`, form, {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${this.token}`,
        },
      });

      const uploaded = res.data?.uploads?.[0];
      this.writeln(`${C.green}[OK] File '${fileName}' uploaded successfully!${C.reset}`);
      if (uploaded) {
        this.writeln(`  File ID     : ${uploaded._id}`);
        this.writeln(`  Direct Link : ${C.green}${C.underline}https://jeeban.life/s/${uploaded._id}${C.reset}`);
      }
      this.writeln();
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Upload failed: ${err.response?.data?.message || err.message}${C.reset}\n`);
    }
  }

  // ── Quick Paste Buffer (Works for both Guests and Auth) ───────────
  async handlePasteBuffer() {
    this.writeln(`${C.pink}┌── [ PASTE BUFFER ] ───────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Paste your code/text snippet below.                                    ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} To save: Type ${C.bold}:wq${C.reset} on a new line and press Enter.                       ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} To cancel: Type ${C.bold}:q!${C.reset} on a new line.                                     ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    let fileName = await this.prompt(`File name [default: snippet.txt]: `);
    if (!fileName) fileName = 'snippet.txt';

    this.writeln(`\n${C.green}[INPUT] Paste content below (finish with :wq):${C.reset}`);

    const lines = [];
    const rl = readline.createInterface({ input: this.stream, output: this.stream, terminal: true });

    await new Promise((resolve) => {
      rl.on('line', (line) => {
        if (line.trim() === ':wq') {
          rl.close();
          resolve();
        } else if (line.trim() === ':q!') {
          lines.length = 0;
          rl.close();
          resolve();
        } else {
          lines.push(line);
        }
      });
    });
    this.stream.resume();

    if (lines.length === 0) {
      this.writeln(`${C.yellow}[INFO] Buffer empty or cancelled. Nothing saved.${C.reset}\n`);
      return;
    }

    const content = lines.join('\n');
    this.writeln(`${C.pink}[WAIT] Saving '${fileName}' to workspace '${this.room}'...${C.reset}`);

    try {
      await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
        fileName,
        content,
        language: this.detectLanguage(fileName),
      });

      this.writeln(`${C.green}[OK] File '${fileName}' successfully synced!${C.reset}`);
      this.writeln(`Bytes written: ${Buffer.byteLength(content, 'utf8')} B`);
      this.writeln(`Live View    : ${C.green}${C.underline}https://jeeban.life/${this.room}${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Failed to save file: ${err.response?.data?.message || err.message}${C.reset}\n`);
    }
  }

  async handleListFiles() {
    this.writeln(`${C.pink}[WAIT] Fetching workspace files...${C.reset}`);
    try {
      const res = await axios.get(`${this.backendUrl}/api/codespaces/${this.room}`);
      const space = res.data;
      const files = space.files || [];

      if (files.length === 0) {
        this.writeln(`${C.yellow}[INFO] Workspace is currently empty.${C.reset}\n`);
        return;
      }

      this.writeln();
      this.writeln(`${C.bold}${C.green}Workspace: ${this.room} (${files.length} item${files.length === 1 ? '' : 's'})${C.reset}`);
      this.writeln(`${C.dim}------------------------------------------------------------------------${C.reset}`);
      this.writeln(`  ${C.pink}${'NAME'.padEnd(28)}${C.reset} ${C.pink}${'TYPE'.padEnd(10)}${C.reset} ${C.pink}${'SIZE'.padEnd(12)}${C.reset} ${C.pink}${'PATH'}${C.reset}`);
      this.writeln(`${C.dim}------------------------------------------------------------------------${C.reset}`);

      files.forEach((f) => {
        const type = f.isFolder ? '<DIR>' : (f.language || 'file');
        const size = f.isFolder ? '-' : `${Buffer.byteLength(f.content || '', 'utf8')} B`;
        const pathStr = f.path ? `/${f.path}` : '/';
        this.writeln(`  ${f.name.padEnd(28)} ${type.padEnd(10)} ${size.padEnd(12)} ${pathStr}`);
      });
      this.writeln(`${C.dim}------------------------------------------------------------------------${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Failed to fetch workspace: ${err.response?.data?.msg || err.message}${C.reset}\n`);
    }
  }

  async handleViewFile() {
    try {
      const res = await axios.get(`${this.backendUrl}/api/codespaces/${this.room}`);
      const space = res.data;
      const files = (space.files || []).filter((f) => !f.isFolder);

      if (files.length === 0) {
        this.writeln(`${C.yellow}[INFO] No readable files in this workspace.${C.reset}\n`);
        return;
      }

      // Build interactive file picker menu
      const fileMenuItems = files.map((f, i) => ({
        key: `${i + 1}`,
        label: `${f.name.padEnd(24)} (${f.language || 'text'}, ${Buffer.byteLength(f.content || '', 'utf8')} B)`,
        value: f.name,
      }));
      fileMenuItems.push({ key: '0', label: '< Cancel & Back', value: '__cancel__' });

      const chosenName = await this.selectMenu(fileMenuItems, 'Select File to View');
      if (!chosenName || chosenName === '__cancel__') return;

      const file = files.find((f) => f.name.toLowerCase() === chosenName.toLowerCase());
      if (file) {
        this.writeln(`\n${C.pink}─── [ ${file.name} ] (${file.language || 'text'}) ───────────────────────────────────────────${C.reset}`);
        this.writeln(file.content || `${C.dim}(Empty file)${C.reset}`);
        this.writeln(`${C.pink}─── [ END OF FILE ] ────────────────────────────────────────────────────────${C.reset}\n`);
      }
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Could not read file: ${err.message}${C.reset}\n`);
    }
  }

  async handleSwitchRoom() {
    const newRoom = await this.prompt(`Enter workspace name [current: ${this.room}]: `);
    if (newRoom && /^[a-zA-Z0-9_-]+$/.test(newRoom)) {
      this.room = newRoom.toLowerCase();
      this.writeln(`${C.green}[OK] Switched active workspace to: ${this.room}${C.reset}`);
      this.writeln(`Web URL: ${C.green}${C.underline}https://jeeban.life/${this.room}${C.reset}\n`);
    } else if (newRoom) {
      this.writeln(`${C.red}[ERROR] Invalid name. Use letters, numbers, hyphens, and underscores only.${C.reset}\n`);
    }
  }

  handleShowLink() {
    this.writeln(`${C.bold}${C.green}Workspace Access Info:${C.reset}`);
    this.writeln(`  Direct URL : ${C.pink}${C.underline}https://jeeban.life/${this.room}${C.reset}`);
    this.writeln(`  CLI Access : ${C.green}ssh -p 2222 jeeban.life${C.reset}\n`);
  }

  detectLanguage(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const map = {
      js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
      html: 'html', htm: 'html', css: 'css', scss: 'scss',
      json: 'json', py: 'python', sh: 'shell', bash: 'shell',
      md: 'markdown', c: 'c', cpp: 'cpp', java: 'java', go: 'go',
      rs: 'rust', sql: 'sql', yml: 'yaml', yaml: 'yaml',
    };
    return map[ext] || 'plaintext';
  }

  // Non-interactive piped execution (e.g. cat file | ssh ...)
  async handlePipedExecution(commandString) {
    const args = (commandString || '').split(/\s+/);
    let targetRoom = this.room;
    let targetFile = `upload_${Date.now()}.txt`;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--room' && args[i + 1]) targetRoom = args[i + 1];
      if (args[i] === '--file' && args[i + 1]) targetFile = args[i + 1];
    }

    const chunks = [];
    this.stream.on('data', (d) => chunks.push(d));
    this.stream.on('end', async () => {
      const buffer = Buffer.concat(chunks);
      const content = buffer.toString('utf8');

      if (!content.trim()) {
        this.stream.write('[WARN] No piped input received.\n');
        this.stream.end();
        return;
      }

      try {
        await axios.post(`${this.backendUrl}/api/codespaces/${targetRoom}/file`, {
          fileName: targetFile,
          content,
          language: this.detectLanguage(targetFile),
        });

        this.stream.write(`[OK] Piped content (${buffer.length} bytes) saved to '${targetFile}' in workspace '${targetRoom}'.\n`);
        this.stream.write(`URL: https://jeeban.life/${targetRoom}\n`);
      } catch (err) {
        this.stream.write(`[ERROR] Failed to save piped content: ${err.message}\n`);
      }
      this.stream.end();
    });
  }
}

module.exports = TerminalSession;
