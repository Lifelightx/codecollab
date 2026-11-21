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

  // ── Universal Back / Cancel Checker ──────────────────────────────
  isCancel(val) {
    if (val === null || val === undefined) return true;
    const s = val.toString().trim().toLowerCase();
    return s === '' || s === ':q' || s === 'q' || s === 'cancel' || s === 'back' || s === '__cancel__';
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
          out += `  ${C.pink}${C.bold}»${C.reset} ${C.green}${C.bold}[${item.key}]${C.reset} ${C.pink}${C.bold}${item.label}${C.reset}\x1b[K\r\n`;
        } else {
          out += `    ${C.dim}[${item.key}]${C.reset} ${C.grayLight}${item.label}${C.reset}\x1b[K\r\n`;
        }
      });
      return out;
    };

    this.writeln(`${C.bold}${C.green}${title}:${C.reset}`);
    this.writeln(`${C.dim}  Navigate: ${C.pink}↑ / ↓${C.dim} or ${C.pink}Tab${C.dim}  |  Select: ${C.green}Enter${C.dim}  |  Back: ${C.yellow}0 / Esc${C.reset}\r\n`);

    this.write('\x1b[?25l'); // Hide cursor
    this.write(render());

    return new Promise((resolve) => {
      const onData = (chunk) => {
        const key = chunk.toString();

        if (key === '\u001b[A' || key === 'k') {
          index = (index - 1 + count) % count;
        } else if (key === '\u001b[B' || key === 'j') {
          index = (index + 1) % count;
        } else if (key === '\t') {
          index = (index + 1) % count;
        } else if (key === '\u001b[Z') {
          index = (index - 1 + count) % count;
        } else if (key === '\r' || key === '\n') {
          cleanup();
          return resolve(items[index].value);
        } else if (key === '\u001b' || key === 'q' || key === 'Q') {
          // Esc or 'q' to go back
          cleanup();
          return resolve('__cancel__');
        } else if (key === '\u0003') {
          cleanup();
          return resolve('exit');
        } else {
          const trimmed = key.trim().toLowerCase();
          const match = items.findIndex((it) => it.key.toLowerCase() === trimmed);
          if (match >= 0) {
            cleanup();
            return resolve(items[match].value);
          }
          return;
        }

        this.write(`\x1b[${count}A\r`);
        this.write(render());
      };

      const cleanup = () => {
        this.stream.removeListener('data', onData);
        this.write('\x1b[?25h'); // Restore cursor
        this.writeln();
        this.stream.resume();
      };

      this.stream.on('data', onData);
    });
  }

  // ── Text Prompts with Instant Back / Cancel Support ───────────────
  async prompt(questionText) {
    this.stream.resume();
    const rl = readline.createInterface({
      input: this.stream,
      output: this.stream,
      terminal: true,
    });

    return new Promise((resolve) => {
      rl.on('SIGINT', () => {
        rl.close();
        this.stream.resume();
        this.writeln();
        resolve('__cancel__');
      });

      rl.question(`${C.green}${questionText}${C.reset}`, (answer) => {
        rl.close();
        this.stream.resume();
        resolve((answer || '').trim());
      });
    });
  }

  // Masked secret prompt (Raw character listener: ZERO initial asterisks + Esc/Ctrl+C support)
  async promptSecret(questionText) {
    this.stream.resume();
    this.write(`${C.green}${questionText}${C.reset}`);

    return new Promise((resolve) => {
      let secret = '';
      const onData = (chunk) => {
        const str = chunk.toString();
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === '\r' || char === '\n') {
            this.stream.removeListener('data', onData);
            this.writeln();
            this.stream.resume();
            return resolve(secret.trim());
          } else if (char === '\u0008' || char === '\x7f') { // Backspace
            if (secret.length > 0) {
              secret = secret.slice(0, -1);
              this.write('\b \b');
            }
          } else if (char === '\u0003' || char === '\u001b') { // Ctrl+C or Esc
            this.stream.removeListener('data', onData);
            this.writeln();
            this.stream.resume();
            return resolve('__cancel__');
          } else if (char >= ' ' && char <= '~') { // Printable ASCII only
            secret += char;
            this.write(`${C.pink}*${C.reset}`);
          }
        }
      };
      this.stream.on('data', onData);
    });
  }

  // ── Main Interactive Loop ───────────────────────────────────────
  async runInteractive() {
    this.clearScreen();
    this.printHeader();

    let lastSelectedIndex = 0;

    while (this.running) {
      const menuItems = [
        { key: '1', label: 'Paste Code / Create File (With Folder Picker)', value: 'paste' },
        { key: '2', label: 'Create Folder in Workspace', value: 'create_folder' },
        { key: '3', label: 'List Workspace Files & Folders', value: 'list' },
        { key: '4', label: 'View File Content', value: 'view' },
        { key: '5', label: 'Switch Active Workspace', value: 'switch' },
        { key: '6', label: 'Local File Upload Guide (Direct SCP)', value: 'scp_guide' },
      ];

      if (!this.user) {
        menuItems.push({ key: '7', label: 'Log In', value: 'login' });
        menuItems.push({ key: '8', label: 'Register (New Account)', value: 'register' });
      } else {
        menuItems.push({ key: '7', label: `Log Out (${this.user.username})`, value: 'logout' });
      }

      menuItems.push({ key: '9', label: 'Workspace Access Info', value: 'info' });
      menuItems.push({ key: '0', label: 'Disconnect Session', value: 'exit' });

      const choice = await this.selectMenu(menuItems, 'Main Menu', lastSelectedIndex);

      const foundIdx = menuItems.findIndex((m) => m.value === choice);
      if (foundIdx >= 0) lastSelectedIndex = foundIdx;

      switch (choice) {
        case 'paste':
          await this.handlePasteBuffer();
          break;
        case 'create_folder':
          await this.handleCreateFolder();
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
        case 'scp_guide':
          await this.handleScpGuide();
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
          await this.handleShowLink();
          break;
        case 'exit':
          this.running = false;
          this.writeln(`${C.green}[INFO] Session terminated. Goodbye.${C.reset}`);
          this.stream.end();
          return;
        case '__cancel__':
          // Pressed Esc on main menu - remain on menu
          break;
      }

      this.writeln();
    }
  }

  // ── Authentication Handlers ─────────────────────────────────────
  async handleLogin() {
    this.writeln(`${C.pink}┌── [ USER LOGIN ] ─────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Enter your CodeCollab credentials to log in.                           ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Press [Enter] on empty input or type ':q' / [Esc] to go back.          ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    const identifier = await this.prompt('Username or Email (or Enter to go back) : ');
    if (this.isCancel(identifier)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return false;
    }

    const password = await this.promptSecret('Password (or Enter to go back)          : ');
    if (this.isCancel(password)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
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
    this.writeln(`${C.pink}│${C.reset} Press [Enter] on empty input or type ':q' / [Esc] to go back.          ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    const email = await this.prompt('Email Address (or Enter to go back)    : ');
    if (this.isCancel(email)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }

    const username = await this.prompt('Choose Username (or Enter to go back)  : ');
    if (this.isCancel(username)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }

    const password = await this.promptSecret('Choose Password (or Enter to go back)  : ');
    if (this.isCancel(password)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }
    if (password.length < 6) {
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

      const otp = await this.prompt('Enter 6-digit code (or Enter to cancel): ');
      if (this.isCancel(otp)) {
        this.writeln(`${C.yellow}[INFO] Registration cancelled. Returned to Main Menu.${C.reset}\n`);
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

  // ── Helper: Discover Workspace Folders ──────────────────────────
  async getWorkspaceFolders() {
    try {
      const res = await axios.get(`${this.backendUrl}/api/codespaces/${this.room}`);
      const files = res.data?.files || [];
      const folderSet = new Set();
      folderSet.add(''); // Root

      files.forEach((f) => {
        if (f.isFolder && f.name) {
          const full = f.path ? `${f.path}/${f.name}` : f.name;
          folderSet.add(full);
        } else if (f.path) {
          folderSet.add(f.path);
        }
      });

      return Array.from(folderSet).sort();
    } catch {
      return [''];
    }
  }

  // ── Create Folder in Workspace ──────────────────────────────────
  async handleCreateFolder() {
    const folders = await this.getWorkspaceFolders();

    const folderItems = folders.map((f, i) => ({
      key: `${i + 1}`,
      label: f ? `/${f}` : `/ (Root directory)`,
      value: f,
    }));
    folderItems.push({ key: '0', label: '< Cancel & Back to Main Menu', value: '__cancel__' });

    const parentFolder = await this.selectMenu(folderItems, 'Select Parent Folder for New Subfolder');
    if (this.isCancel(parentFolder)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }

    const folderName = await this.prompt('New Folder Name (or Enter to cancel): ');
    if (this.isCancel(folderName)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(folderName)) {
      this.writeln(`${C.red}[ERROR] Invalid folder name. Use alphanumeric characters, dots or hyphens.${C.reset}\n`);
      return;
    }

    this.writeln(`${C.pink}[WAIT] Creating folder '${folderName}' in workspace '${this.room}'...${C.reset}`);

    try {
      await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/folder`, {
        folderName,
        path: parentFolder,
      });

      const fullPath = parentFolder ? `${parentFolder}/${folderName}` : folderName;
      this.writeln(`${C.green}[OK] Folder '/${fullPath}' created successfully!${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Failed to create folder: ${err.response?.data?.message || err.message}${C.reset}\n`);
    }
  }

  // ── Paste / Create File with Interactive Folder Selection ───────
  async handlePasteBuffer() {
    const folders = await this.getWorkspaceFolders();

    const folderItems = folders.map((f, i) => ({
      key: `${i + 1}`,
      label: f ? `/${f}` : `/ (Root directory)`,
      value: f,
    }));
    folderItems.push({ key: '+', label: '+ Create New Folder...', value: '__new_folder__' });
    folderItems.push({ key: '0', label: '< Cancel & Back to Main Menu', value: '__cancel__' });

    let targetFolder = await this.selectMenu(folderItems, 'Select Destination Folder');
    if (this.isCancel(targetFolder)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }

    if (targetFolder === '__new_folder__') {
      const newF = await this.prompt('New Folder Name (or Enter to cancel): ');
      if (this.isCancel(newF)) {
        this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
        return;
      }
      try {
        await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/folder`, { folderName: newF, path: '' });
        targetFolder = newF;
        this.writeln(`${C.green}[OK] Created folder '/${newF}'${C.reset}`);
      } catch (err) {
        this.writeln(`${C.red}[ERROR] Could not create folder: ${err.message}${C.reset}\n`);
        return;
      }
    }

    const folderDisplay = targetFolder ? `/${targetFolder}/` : '/';

    this.writeln(`${C.pink}┌── [ CREATE / PASTE FILE ] ─────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Destination : ${C.green}${folderDisplay}${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Enter file name, then paste or type content.                           ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Finish by typing ${C.bold}:wq${C.reset} on a new line and press Enter.                      ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Type ${C.bold}:q${C.reset} on a new line to cancel and go back.                             ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    let fileName = await this.prompt(`File Name (or :q to cancel) [default: snippet.txt]: `);
    if (fileName === ':q' || fileName.toLowerCase() === 'cancel' || fileName === '__cancel__') {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }
    if (!fileName) fileName = 'snippet.txt';

    this.writeln(`\n${C.green}[INPUT] Paste content below (finish with :wq, or :q to cancel):${C.reset}`);

    const lines = [];
    const rl = readline.createInterface({ input: this.stream, output: this.stream, terminal: true });

    await new Promise((resolve) => {
      rl.on('SIGINT', () => {
        lines.length = 0;
        rl.close();
        resolve();
      });

      rl.on('line', (line) => {
        if (line.trim() === ':wq') {
          rl.close();
          resolve();
        } else if (line.trim() === ':q!' || line.trim() === ':q') {
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
      this.writeln(`${C.yellow}[INFO] Cancelled or empty buffer. Nothing saved.${C.reset}\n`);
      return;
    }

    const content = lines.join('\n');
    this.writeln(`${C.pink}[WAIT] Saving '${fileName}' to '${folderDisplay}'...${C.reset}`);

    try {
      await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
        fileName,
        path: targetFolder,
        content,
        language: this.detectLanguage(fileName),
      });

      this.writeln(`${C.green}[OK] File '${folderDisplay}${fileName}' successfully saved!${C.reset}`);
      this.writeln(`Bytes written : ${Buffer.byteLength(content, 'utf8')} B`);
      this.writeln(`Live View     : ${C.green}${C.underline}https://jeeban.life/${this.room}${C.reset}\n`);
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Failed to save file: ${err.response?.data?.message || err.message}${C.reset}\n`);
    }
  }

  // ── Local File Upload Guide (Direct SCP) ────────────────────────
  async handleScpGuide() {
    this.writeln(`${C.pink}┌── [ UPLOAD FILES FROM YOUR LOCAL TERMINAL ] ───────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} You can upload any local file (code, PDF, images) directly using SCP!  ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Open another terminal on your machine and run:                         ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}                                                                        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}   ${C.bold}${C.green}scp -P 2222 <local-file> jeeban.life:${this.room}/${C.reset}                         ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}                                                                        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Examples:                                                              ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}   scp -P 2222 document.pdf jeeban.life:${this.room}/                           ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}   scp -P 2222 main.py jeeban.life:${this.room}/src/                            ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}                                                                        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Files are uploaded instantly and appear in your live workspace.        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}\n`);

    await this.prompt('Press [Enter] to return to Main Menu... ');
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
      this.writeln(`  ${C.pink}${'NAME'.padEnd(28)}${C.reset} ${C.pink}${'TYPE'.padEnd(10)}${C.reset} ${C.pink}${'SIZE'.padEnd(12)}${C.reset} ${C.pink}${'FOLDER'}${C.reset}`);
      this.writeln(`${C.dim}------------------------------------------------------------------------${C.reset}`);

      files.forEach((f) => {
        const type = f.isFolder ? '<DIR>' : (f.language || 'file');
        const size = f.isFolder ? '-' : `${Buffer.byteLength(f.content || '', 'utf8')} B`;
        const pathStr = f.path ? `/${f.path}` : '/';
        this.writeln(`  ${f.name.padEnd(28)} ${type.padEnd(10)} ${size.padEnd(12)} ${pathStr}`);
      });
      this.writeln(`${C.dim}------------------------------------------------------------------------${C.reset}\n`);

      await this.prompt('Press [Enter] to return to Main Menu... ');
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

      const fileMenuItems = files.map((f, i) => {
        const p = f.path ? `/${f.path}/` : '/';
        return {
          key: `${i + 1}`,
          label: `${(p + f.name).padEnd(26)} (${Buffer.byteLength(f.content || '', 'utf8')} B)`,
          value: f,
        };
      });
      fileMenuItems.push({ key: '0', label: '< Cancel & Back to Main Menu', value: '__cancel__' });

      const chosenFile = await this.selectMenu(fileMenuItems, 'Select File to View');
      if (this.isCancel(chosenFile) || chosenFile === '__cancel__') return;

      const p = chosenFile.path ? `/${chosenFile.path}/` : '/';
      this.writeln(`\n${C.pink}─── [ ${p}${chosenFile.name} ] (${chosenFile.language || 'text'}) ───────────────────────────────${C.reset}`);
      this.writeln(chosenFile.content || `${C.dim}(Empty file)${C.reset}`);
      this.writeln(`${C.pink}─── [ END OF FILE ] ────────────────────────────────────────────────────────${C.reset}\n`);

      await this.prompt('Press [Enter] to return to Main Menu... ');
    } catch (err) {
      this.writeln(`${C.red}[ERROR] Could not read file: ${err.message}${C.reset}\n`);
    }
  }

  async handleSwitchRoom() {
    const newRoom = await this.prompt(`Enter workspace name (or Enter to cancel) [current: ${this.room}]: `);
    if (this.isCancel(newRoom)) {
      this.writeln(`${C.yellow}[INFO] Cancelled. Returned to Main Menu.${C.reset}\n`);
      return;
    }

    if (/^[a-zA-Z0-9_-]+$/.test(newRoom)) {
      this.room = newRoom.toLowerCase();
      this.writeln(`${C.green}[OK] Switched active workspace to: ${this.room}${C.reset}`);
      this.writeln(`Web URL: ${C.green}${C.underline}https://jeeban.life/${this.room}${C.reset}\n`);
    } else {
      this.writeln(`${C.red}[ERROR] Invalid name. Use letters, numbers, hyphens, and underscores only.${C.reset}\n`);
    }
  }

  async handleShowLink() {
    this.writeln(`${C.bold}${C.green}Workspace Access Info:${C.reset}`);
    this.writeln(`  Direct URL : ${C.pink}${C.underline}https://jeeban.life/${this.room}${C.reset}`);
    this.writeln(`  CLI Access : ${C.green}ssh -p 2222 jeeban.life${C.reset}\n`);

    await this.prompt('Press [Enter] to return to Main Menu... ');
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
    let targetPath = '';

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--room' && args[i + 1]) targetRoom = args[i + 1];
      if (args[i] === '--file' && args[i + 1]) targetFile = args[i + 1];
      if (args[i] === '--path' && args[i + 1]) targetPath = args[i + 1];
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
          path: targetPath,
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
