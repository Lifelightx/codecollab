const axios = require('axios');
const readline = require('readline');

// ANSI formatting helpers (strict clean monochrome & accents, zero emojis)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

class TerminalSession {
  constructor(stream, backendUrl, options = {}) {
    this.stream = stream;
    this.backendUrl = backendUrl.replace(/\/+$/, '');
    this.room = options.room || 'general';
    this.rl = null;
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
      ? `${C.green}${this.user.username}${C.reset} (${this.user.email})`
      : `${C.yellow}Guest${C.reset} [Log in via command 6]`;

    this.writeln(`${C.gray}┌────────────────────────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.gray}│${C.reset}  ${C.bold}${C.white}CODECOLLAB TERMINAL CLIENT${C.reset} ${C.gray}v1.0.0${C.reset}                                    ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}│${C.reset}  Endpoint : ${C.cyan}https://jeeban.life${C.reset}                     Status : ${C.green}CONNECTED${C.reset}    ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}└────────────────────────────────────────────────────────────────────────┘${C.reset}`);
    this.writeln(`Active User      : ${userDisplay}`);
    this.writeln(`Active Workspace : ${C.bold}${C.yellow}${this.room}${C.reset}`);
    this.writeln(`Web URL          : ${C.cyan}https://jeeban.life/${this.room}${C.reset}`);
    this.writeln();
  }

  async prompt(questionText) {
    return new Promise((resolve) => {
      this.rl.question(questionText, (answer) => {
        resolve((answer || '').trim());
      });
    });
  }

  // Masked secret prompt (prints '*' for passwords)
  async promptSecret(questionText) {
    // Temporarily pause readline interface to capture raw keystrokes
    this.rl.pause();
    this.write(questionText);

    return new Promise((resolve) => {
      let secret = '';
      const onData = (chunk) => {
        const str = chunk.toString();
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === '\r' || char === '\n') {
            this.stream.removeListener('data', onData);
            this.writeln();
            this.rl.resume();
            return resolve(secret);
          } else if (char === '\u0008' || char === '\x7f') { // Backspace
            if (secret.length > 0) {
              secret = secret.slice(0, -1);
              this.write('\b \b');
            }
          } else if (char === '\u0003') { // Ctrl+C
            this.stream.removeListener('data', onData);
            this.writeln();
            this.rl.resume();
            return resolve('');
          } else if (char >= ' ' && char <= '~') {
            secret += char;
            this.write('*');
          }
        }
      };
      this.stream.on('data', onData);
    });
  }

  async runInteractive() {
    this.rl = readline.createInterface({
      input: this.stream,
      output: this.stream,
      terminal: true,
    });

    this.clearScreen();
    this.printHeader();

    while (this.running) {
      this.writeln(`${C.bold}Available Commands:${C.reset}`);
      this.writeln(`  ${C.cyan}[1]${C.reset} Paste Text / Code Buffer`);
      this.writeln(`  ${C.cyan}[2]${C.reset} Upload File to Storage (Requires Login)`);
      this.writeln(`  ${C.cyan}[3]${C.reset} List Files in Workspace`);
      this.writeln(`  ${C.cyan}[4]${C.reset} View File Content`);
      this.writeln(`  ${C.cyan}[5]${C.reset} Switch Active Workspace`);
      if (!this.user) {
        this.writeln(`  ${C.cyan}[6]${C.reset} Log In`);
        this.writeln(`  ${C.cyan}[7]${C.reset} Register (New Account)`);
      } else {
        this.writeln(`  ${C.cyan}[6]${C.reset} Log Out (${this.user.username})`);
      }
      this.writeln(`  ${C.cyan}[8]${C.reset} Workspace Access Info`);
      this.writeln(`  ${C.cyan}[0]${C.reset} Exit`);
      this.writeln();

      const choice = await this.prompt(`${C.bold}Command: ${C.reset}`);
      this.writeln();

      switch (choice) {
        case '1':
          await this.handlePasteBuffer();
          break;
        case '2':
          await this.handleFileUpload();
          break;
        case '3':
          await this.handleListFiles();
          break;
        case '4':
          await this.handleViewFile();
          break;
        case '5':
          await this.handleSwitchRoom();
          break;
        case '6':
          if (this.user) {
            this.handleLogout();
          } else {
            await this.handleLogin();
          }
          break;
        case '7':
          if (!this.user) {
            await this.handleRegister();
          } else {
            this.writeln(`${C.yellow}[INFO] You are already logged in as '${this.user.username}'.${C.reset}\n`);
          }
          break;
        case '8':
          this.handleShowLink();
          break;
        case '0':
        case 'exit':
        case 'quit':
          this.running = false;
          this.writeln(`${C.green}[INFO] Session terminated. Goodbye.${C.reset}`);
          this.stream.end();
          return;
        default:
          this.writeln(`${C.red}[ERROR] Invalid selection. Enter a number between 0 and 8.${C.reset}\n`);
          break;
      }
    }
  }

  // ── Authentication Handlers ─────────────────────────────────────
  async handleLogin() {
    this.writeln(`${C.gray}┌── [ USER LOGIN ] ─────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} Enter your CodeCollab credentials to log in.                           ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

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

    this.writeln(`${C.blue}[WAIT] Authenticating with server...${C.reset}`);

    try {
      const res = await axios.post(`${this.backendUrl}/api/auth/login`, {
        identifier,
        password,
      });

      this.token = res.data.token;
      this.user = res.data.user;

      this.writeln(`${C.green}[OK] Logged in successfully as '${this.user.username}'!${C.reset}`);
      this.writeln(`Storage quota: ${( (this.user.storageUsedBytes || 0) / (1024 * 1024) ).toFixed(2)} MB / 200 MB used.\n`);
      return true;
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Authentication failed: ${err.response?.data?.message || err.message}${C.reset}\n`);
      return false;
    }
  }

  async handleRegister() {
    this.writeln(`${C.gray}┌── [ CREATE ACCOUNT ] ─────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} Registration requires email verification via a 6-digit code.           ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    const email = await this.prompt('Email Address    : ');
    if (!email) return;

    const username = await this.prompt('Choose Username  : ');
    if (!username) return;

    const password = await this.promptSecret('Choose Password  : ');
    if (!password || password.length < 6) {
      this.writeln(`${C.red}[ERROR] Password must be at least 6 characters.${C.reset}\n`);
      return;
    }

    this.writeln(`${C.blue}[WAIT] Sending 6-digit verification code to '${email}'...${C.reset}`);

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

      this.writeln(`${C.blue}[WAIT] Verifying code...${C.reset}`);

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
    this.writeln(`${C.green}[OK] You have logged out. Now operating in Guest mode.${C.reset}\n`);
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

    this.writeln(`${C.gray}┌── [ FILE UPLOAD ] ────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} Paste the raw or Base64 content of the file.                          ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} Finish with :wq on a new line, or :q! to cancel.                       ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    const fileName = await this.prompt('Target file name (e.g. document.pdf, image.png): ');
    if (!fileName) return;

    this.writeln(`\n${C.yellow}[INPUT] Paste file contents or Base64 stream (finish with :wq):${C.reset}`);

    const lines = [];
    while (true) {
      const line = await this.prompt('');
      if (line.trim() === ':wq') break;
      if (line.trim() === ':q!') {
        this.writeln(`${C.yellow}[INFO] Upload cancelled.${C.reset}\n`);
        return;
      }
      lines.push(line);
    }

    const rawData = lines.join('\n');
    if (!rawData.trim()) {
      this.writeln(`${C.yellow}[WARN] No content provided. Upload aborted.${C.reset}\n`);
      return;
    }

    // Determine if user entered raw text or pure base64
    let fileBuffer;
    const isBase64 = /^[A-Za-z0-9+/=\s]+$/.test(rawData) && rawData.length % 4 === 0 && !rawData.includes(' ');
    if (isBase64) {
      fileBuffer = Buffer.from(rawData.replace(/\s+/g, ''), 'base64');
    } else {
      fileBuffer = Buffer.from(rawData, 'utf8');
    }

    this.writeln(`${C.blue}[WAIT] Uploading ${fileBuffer.length} bytes to workspace '${this.room}'...${C.reset}`);

    try {
      const FormData = require('form-data');
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
        this.writeln(`File ID     : ${uploaded._id}`);
        this.writeln(`Direct Link : ${C.cyan}https://jeeban.life/s/${uploaded._id}${C.reset}`);
      }
      this.writeln();
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Upload failed: ${err.response?.data?.message || err.message}${C.reset}\n`);
    }
  }

  // ── Quick Paste Buffer (Works for both Guests and Auth) ───────────
  async handlePasteBuffer() {
    this.writeln(`${C.gray}┌── [ PASTE BUFFER ] ───────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} Paste your code/text snippet below.                                    ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} To save: Type :wq on a new line and press Enter.                       ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} To cancel: Type :q! on a new line.                                     ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    let fileName = await this.prompt(`File name [default: snippet.txt]: `);
    if (!fileName) fileName = 'snippet.txt';

    this.writeln(`\n${C.yellow}[INPUT] Paste or type content below (finish with :wq):${C.reset}`);

    const lines = [];
    while (true) {
      const line = await this.prompt('');
      if (line.trim() === ':wq') break;
      if (line.trim() === ':q!') {
        this.writeln(`${C.yellow}[INFO] Paste cancelled.${C.reset}\n`);
        return;
      }
      lines.push(line);
    }

    const content = lines.join('\n');
    if (!content.trim()) {
      this.writeln(`${C.yellow}[WARN] Buffer was empty. Nothing saved.${C.reset}\n`);
      return;
    }

    this.writeln(`${C.blue}[WAIT] Saving '${fileName}' to workspace '${this.room}'...${C.reset}`);

    try {
      await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
        fileName,
        content,
        language: this.detectLanguage(fileName),
      });

      this.writeln(`${C.green}[OK] File '${fileName}' successfully synced!${C.reset}`);
      this.writeln(`Bytes written: ${Buffer.byteLength(content, 'utf8')} B`);
      this.writeln(`Live View    : ${C.cyan}https://jeeban.life/${this.room}${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Failed to save file: ${err.response?.data?.message || err.message}${C.reset}\n`);
    }
  }

  async handleListFiles() {
    this.writeln(`${C.blue}[WAIT] Fetching workspace files...${C.reset}`);
    try {
      const res = await axios.get(`${this.backendUrl}/api/codespaces/${this.room}`);
      const space = res.data;
      const files = space.files || [];

      if (files.length === 0) {
        this.writeln(`${C.yellow}[INFO] Workspace is currently empty.${C.reset}\n`);
        return;
      }

      this.writeln();
      this.writeln(`${C.bold}Workspace: ${this.room} (${files.length} item${files.length === 1 ? '' : 's'})${C.reset}`);
      this.writeln(`${C.gray}------------------------------------------------------------------------${C.reset}`);
      this.writeln(`  ${'NAME'.padEnd(28)} ${'TYPE'.padEnd(10)} ${'SIZE'.padEnd(12)} ${'PATH'}`);
      this.writeln(`${C.gray}------------------------------------------------------------------------${C.reset}`);

      files.forEach((f) => {
        const type = f.isFolder ? '<DIR>' : (f.language || 'file');
        const size = f.isFolder ? '-' : `${Buffer.byteLength(f.content || '', 'utf8')} B`;
        const pathStr = f.path ? `/${f.path}` : '/';
        this.writeln(`  ${f.name.padEnd(28)} ${type.padEnd(10)} ${size.padEnd(12)} ${pathStr}`);
      });
      this.writeln(`${C.gray}------------------------------------------------------------------------${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Failed to fetch workspace: ${err.response?.data?.msg || err.message}${C.reset}\n`);
    }
  }

  async handleViewFile() {
    const fileName = await this.prompt('Enter file name to view: ');
    if (!fileName) return;

    try {
      const res = await axios.get(`${this.backendUrl}/api/codespaces/${this.room}`);
      const space = res.data;
      const file = (space.files || []).find((f) => f.name.toLowerCase() === fileName.toLowerCase());

      if (!file) {
        this.writeln(`${C.red}[ERROR] File '${fileName}' not found in workspace '${this.room}'.${C.reset}\n`);
        return;
      }

      this.writeln(`\n${C.gray}--- [ ${file.name} ] (${file.language || 'text'}) ---${C.reset}`);
      this.writeln(file.content || `${C.gray}(Empty file)${C.reset}`);
      this.writeln(`${C.gray}--- [ END OF FILE ] ---${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Could not read file: ${err.message}${C.reset}\n`);
    }
  }

  async handleSwitchRoom() {
    const newRoom = await this.prompt(`Enter workspace name [current: ${this.room}]: `);
    if (newRoom && /^[a-zA-Z0-9_-]+$/.test(newRoom)) {
      this.room = newRoom.toLowerCase();
      this.writeln(`${C.green}[OK] Switched active workspace to: ${this.room}${C.reset}`);
      this.writeln(`Web URL: ${C.cyan}https://jeeban.life/${this.room}${C.reset}\n`);
    } else if (newRoom) {
      this.writeln(`${C.red}[ERROR] Invalid name. Use letters, numbers, hyphens, and underscores only.${C.reset}\n`);
    }
  }

  handleShowLink() {
    this.writeln(`${C.bold}Workspace Access Info:${C.reset}`);
    this.writeln(`  Direct URL : ${C.cyan}https://jeeban.life/${this.room}${C.reset}`);
    this.writeln(`  CLI Access : ssh -p 2222 jeeban.life\n`);
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
