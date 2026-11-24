const axios = require('axios');
const readline = require('readline');

// ── Color Theme (Deep Plum / Rose / Berry aesthetic matching reference) ─────────
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Borders & Headers (Rose / Magenta)
  rose: '\x1b[38;2;218;75;125m',         // #da4b7d Box borders
  roseBright: '\x1b[38;2;255;107;157m',   // #ff6b9d Section headers & highlights
  roseDim: '\x1b[38;2;170;55;95m',        // Dim rose

  // Active Row Highlight (Deep Berry / Plum)
  selectBg: '\x1b[48;2;120;32;75m',       // #78204b Berry background
  selectFg: '\x1b[1m\x1b[97m',            // Crisp bold white

  // Text Colors
  textMain: '\x1b[38;2;240;230;236m',     // #f0e6ec Crisp light text
  textMuted: '\x1b[38;2;140;110;134m',    // #8c6e86 Dusky mauve / gray
  textDim: '\x1b[38;2;105;80;100m',       // #695064 Deep mauve for line numbers / comments

  // Syntax & Badge Accents
  blue: '\x1b[38;2;112;161;255m',         // #70a1ff Soft blue
  cyan: '\x1b[38;2;0;191;255m',           // #00bfff Bright sky blue / cyan
  mint: '\x1b[38;2;46;213;115m',          // #2ed573 Mint green (success / online)
  amber: '\x1b[38;2;243;156;18m',         // #f39c12 Amber / warning
  red: '\x1b[38;2;255;71;87m',            // #ff4757 Red / error

  // Aliases for compatibility
  green: '\x1b[38;2;46;213;115m',
  greenBright: '\x1b[38;2;46;213;115m',
  pink: '\x1b[38;2;218;75;125m',
  pinkBright: '\x1b[38;2;255;107;157m',
  pinkBg: '\x1b[48;2;120;32;75m',
  white: '\x1b[97m',
  gray: '\x1b[38;2;140;110;134m',
  grayLight: '\x1b[38;2;200;190;198m',
};

// ── String & ANSI Helpers ──────────────────────────────────────────────────
function stripAnsi(str) {
  return (str || '')
    .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
    .replace(/\x1b\]52;[^\x07]*\x07/g, '');
}

function visibleLength(str) {
  return stripAnsi(str).length;
}

function fitToWidth(str, width) {
  const plain = stripAnsi(str);
  if (plain.length === width) return str;
  if (plain.length < width) {
    return str + ' '.repeat(width - plain.length);
  }

  let curLen = 0;
  let result = '';
  let inEscape = false;
  let escapeSeq = '';

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '\x1b') {
      inEscape = true;
      escapeSeq = char;
      continue;
    }
    if (inEscape) {
      escapeSeq += char;
      if (/[a-zA-Z]/.test(char)) {
        inEscape = false;
        result += escapeSeq;
      }
      continue;
    }
    if (curLen < width - 1) {
      result += char;
      curLen++;
    } else if (curLen === width - 1) {
      result += '…';
      curLen++;
      break;
    }
  }
  if (curLen < width) {
    result += ' '.repeat(width - curLen);
  }
  return result + C.reset;
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimeAgo(dateInput) {
  if (!dateInput) return '-';
  const diffSec = Math.floor((Date.now() - new Date(dateInput).getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMo = Math.floor(diffDay / 30);
  return `${diffMo}mo ago`;
}

function copyToClipboard(stream, text) {
  if (!stream || !stream.writable) return;
  const b64 = Buffer.from(text, 'utf8').toString('base64');
  // 1. Standard OSC 52 for clipboard ('c') with BEL
  stream.write(`\x1b]52;c;${b64}\x07`);
  // 2. OSC 52 for primary selection ('p') with BEL (Linux middle-click selection)
  stream.write(`\x1b]52;p;${b64}\x07`);
  // 3. ST-terminated variants (\x1b\\)
  stream.write(`\x1b]52;c;${b64}\x1b\\`);
  stream.write(`\x1b]52;p;${b64}\x1b\\`);
  // 4. Tmux passthrough
  stream.write(`\x1bPtmux;\x1b\x1b]52;c;${b64}\x07\x1b\\`);
  stream.write(`\x1bPtmux;\x1b\x1b]52;p;${b64}\x07\x1b\\`);
  // 5. GNU Screen passthrough
  stream.write(`\x1bP\x1b]52;c;${b64}\x07\x1b\\`);
}

function highlightSyntax(codeLine) {
  if (/^\s*(\/\/|#|\/\*)/.test(codeLine)) {
    return `${C.textDim}${codeLine}${C.reset}`;
  }

  let line = codeLine;
  // Strings
  line = line.replace(/(["'`])(?:(?=(\\?))\2.)*?\1/g, (m) => `${C.mint}${m}${C.textMain}`);
  // Keywords
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|import|from|export|use|fn|pub|mod|struct|enum|impl|def|async|await|try|catch|new|type|interface|package)\b/g;
  line = line.replace(keywords, (m) => `${C.roseBright}${m}${C.textMain}`);
  // Types
  const types = /\b(string|number|boolean|any|void|int|float|PathBuf|Error|self|this|true|false|null|undefined|None)\b/g;
  line = line.replace(types, (m) => `${C.blue}${m}${C.textMain}`);
  // Calls
  line = line.replace(/\b([a-zA-Z0-9_]+!|\b[a-zA-Z0-9_]+(?=\())\b/g, (m) => `${C.cyan}${m}${C.textMain}`);

  return `${C.textMain}${line}${C.reset}`;
}

// ── Box Border Drawing ─────────────────────────────────────────────────────
function renderBoxTop(title, width) {
  const plainTitle = stripAnsi(title);
  if (!plainTitle) {
    return `${C.rose}╭${'─'.repeat(Math.max(0, width - 2))}╮${C.reset}`;
  }
  const titleVis = plainTitle.length;
  const fill = Math.max(0, width - 2 - (titleVis + 3));
  return `${C.rose}╭─ ${title} ${C.reset}${C.rose}${'─'.repeat(fill)}╮${C.reset}`;
}

function wrapCommand(cmd, maxWidth) {
  if (!cmd || cmd.length <= maxWidth) return [cmd || ''];
  const parts = [];
  let remaining = cmd;
  const maxIterations = 20;
  let iter = 0;

  while (remaining.length > maxWidth && iter < maxIterations) {
    iter++;
    let splitIdx = remaining.lastIndexOf(' ', maxWidth - 2);
    if (splitIdx <= 2) {
      splitIdx = Math.max(1, maxWidth - 2);
    }
    parts.push(remaining.slice(0, splitIdx) + ' \\');
    remaining = '  ' + remaining.slice(splitIdx).trimStart();
  }
  if (remaining.trim()) {
    parts.push(remaining);
  }
  return parts;
}

function renderBoxBottom(width) {
  return `${C.rose}╰${'─'.repeat(Math.max(0, width - 2))}╯${C.reset}`;
}

function renderBoxRow(content, width) {
  const inner = fitToWidth(content, Math.max(0, width - 2));
  return `${C.rose}│${C.reset}${inner}${C.rose}│${C.reset}`;
}

// ── Main TerminalSession Class ─────────────────────────────────────────────
class TerminalSession {
  constructor(stream, backendUrl, options = {}) {
    this.stream = stream;
    this.backendUrl = backendUrl.replace(/\/+$/, '');
    this.room = options.room || 'general';
    this.running = true;
    this.token = options.token || null;
    this.user = options.user || null;
    this.pty = options.pty || { rows: 24, cols: 80 };

    // IDE State
    this.activeTab = 'files'; // 'files' | 'uploads'
    this.selectedFileIndex = 0;
    this.selectedUploadIndex = 0;
    this.fileScrollOffset = 0;
    this.uploadScrollOffset = 0;
    this.editorScrollOffset = 0;

    this.workspaceFiles = [];
    this.workspaceUploads = [];
    this.currentFile = null;
    this.statusMessage = '● Connected';
    this.isEditing = false;
    this.passcodes = {};
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

  handleResize(info) {
    if (!info) return;
    this.pty = info;
    if (!this.isEditing) {
      this.renderIDE();
    }
  }

  isCancel(val) {
    if (val === null || val === undefined) return true;
    const s = val.toString().trim().toLowerCase();
    return s === '' || s === ':q' || s === 'q' || s === 'cancel' || s === 'back' || s === '__cancel__';
  }

  // ── Text Prompt Helper ──────────────────────────────────────────
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

      rl.question(`${C.roseBright}${questionText}${C.reset}`, (answer) => {
        rl.close();
        this.stream.resume();
        resolve((answer || '').trim());
      });
    });
  }

  getAuthHeaders(room = this.room) {
    const headers = {};
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }
    const cleanRoom = (room || this.room || '').toLowerCase();
    if (this.passcodes && this.passcodes[cleanRoom]) {
      headers['x-passcode'] = this.passcodes[cleanRoom];
    }
    return { headers };
  }

  // ── Password / Passcode Masked Input Helper ───────────────────────
  async promptPasscode(promptText = 'Passcode: ') {
    this.stream.resume();
    return new Promise((resolve) => {
      this.write(`${C.roseBright}${promptText}${C.reset}`);
      let input = '';
      const onData = (buf) => {
        const str = buf.toString('utf8');
        if (str === '\u001b' || str === '\u0003') { // Esc or Ctrl+C
          this.stream.removeListener('data', onData);
          this.writeln();
          resolve('__cancel__');
          return;
        }
        if (str.startsWith('\u001b')) {
          // Ignore other ANSI escape sequences (arrow keys, etc.)
          return;
        }
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === '\r' || char === '\n') {
            this.stream.removeListener('data', onData);
            this.writeln();
            resolve(input.trim());
            return;
          } else if (char === '\u0008' || char === '\x7f') { // Backspace
            if (input.length > 0) {
              input = input.slice(0, -1);
              this.write('\b \b');
            }
          } else if (char.charCodeAt(0) >= 32) {
            input += char;
            this.write('*');
          }
        }
      };
      this.stream.on('data', onData);
    });
  }

  // ── Check if workspace is private and unlock via passcode if needed ──
  async checkAndUnlockSpace(targetRoom) {
    const room = (targetRoom || 'general').toLowerCase();
    const isAdmin = this.user && (this.user.role === 'admin' || this.user.username?.toLowerCase() === 'admin');

    if (room === 'admin' && !isAdmin) {
      this.statusMessage = "✗ Access denied: 'admin' space is private to administrator.";
      return false;
    }

    try {
      const statusRes = await axios.get(`${this.backendUrl}/api/codespaces/${room}/status`, this.getAuthHeaders(room));
      const { isPublic, isOwner } = statusRes.data;

      if (!isPublic && !isOwner && !isAdmin) {
        // Test if already unlocked with stored passcode
        if (this.passcodes[room]) {
          try {
            await axios.post(`${this.backendUrl}/api/codespaces/${room}/data`, { passcode: this.passcodes[room] }, this.getAuthHeaders(room));
            return true;
          } catch {
            delete this.passcodes[room];
          }
        }

        // Prompt for passcode modal
        this.isEditing = true;
        this.write('\x1b[?25h');
        this.clearScreen();
        this.writeln(`${C.rose}╭─ [ PRIVATE WORKSPACE: ${room.toUpperCase()} ] ────────────────────────────────────────╮${C.reset}`);
        this.writeln(`${C.rose}│${C.reset} This workspace is private and protected by a passcode.                ${C.rose}│${C.reset}`);
        this.writeln(`${C.rose}│${C.reset} Enter passcode to continue, or press [Enter] / Ctrl+C to cancel.      ${C.rose}│${C.reset}`);
        this.writeln(`${C.rose}╰───────────────────────────────────────────────────────────────────────╯\r\n`);

        let attempts = 0;
        const maxAttempts = 3;

        while (attempts < maxAttempts) {
          const promptLabel = attempts === 0
            ? 'Enter Passcode: '
            : 'Try again (or [Enter] to cancel): ';

          const enteredPasscode = await this.promptPasscode(promptLabel);

          if (this.isCancel(enteredPasscode) || !enteredPasscode) {
            this.write('\x1b[?25l');
            this.isEditing = false;
            this.statusMessage = 'Access cancelled';
            return false;
          }

          try {
            await axios.post(`${this.backendUrl}/api/codespaces/${room}/data`, { passcode: enteredPasscode }, this.getAuthHeaders(room));
            this.passcodes[room] = enteredPasscode;
            this.write('\x1b[?25l');
            this.isEditing = false;
            this.statusMessage = `✓ Unlocked private workspace '${room}'`;
            return true;
          } catch (err) {
            attempts++;
            delete this.passcodes[room];
            if (attempts < maxAttempts) {
              this.writeln(`${C.red}✗ Incorrect passcode.${C.reset}\r\n`);
            } else {
              this.writeln(`\r\n${C.red}✗ Incorrect passcode. Maximum attempts reached.${C.reset}`);
              await new Promise((r) => setTimeout(r, 1200));
              this.write('\x1b[?25l');
              this.isEditing = false;
              this.statusMessage = `✗ Incorrect passcode for '${room}'`;
              return false;
            }
          }
        }
      }
      return true;
    } catch (e) {
      if (e.response?.status === 404) return true; // new space, allow creation
      if (e.response?.status === 401 || e.response?.status === 403) {
        this.statusMessage = `✗ Workspace '${room}' is private.`;
        return false;
      }
      return true;
    }
  }

  // ── Fetch Workspace Data ─────────────────────────────────────────
  async fetchWorkspaceData() {
    const cleanRoom = (this.room || 'general').toLowerCase();
    const payload = { passcode: (this.passcodes && this.passcodes[cleanRoom]) || null };

    try {
      const res = await axios.post(`${this.backendUrl}/api/codespaces/${cleanRoom}/data`, payload, this.getAuthHeaders(cleanRoom));
      const space = res.data;
      this.workspaceFiles = (space.files || []).filter((f) => !f.isFolder);

      if (!this.currentFile && this.workspaceFiles.length > 0) {
        const indexHtml = this.workspaceFiles.find((f) => f.name.toLowerCase() === 'index.html');
        this.currentFile = indexHtml || this.workspaceFiles[0];
        const idx = this.workspaceFiles.indexOf(this.currentFile);
        if (idx >= 0) this.selectedFileIndex = idx;
      } else if (this.currentFile) {
        const updated = this.workspaceFiles.find((f) => f.name === this.currentFile.name && f.path === this.currentFile.path);
        if (updated) this.currentFile = updated;
      }
    } catch (e) {
      this.workspaceFiles = [];
      this.statusMessage = `✗ Error: ${e.response?.data?.message || e.response?.data?.msg || e.message}`;
    }

    try {
      const uploadRes = await axios.get(`${this.backendUrl}/api/uploads?spaceName=${this.room}`, this.getAuthHeaders());
      this.workspaceUploads = uploadRes.data?.uploads || [];
    } catch {
      this.workspaceUploads = [];
    }
  }

  // ── Render Split-View IDE (Theme from reference image) ────────────
  renderIDE() {
    const cols = Math.max(76, this.pty.cols || 80);
    const rows = Math.max(22, this.pty.rows || 24);

    const userLabel = this.user ? `${this.user.username}` : 'Guest';
    const boxHeight = rows - 3; // 2 rows for footer shortcuts and status bar
    const innerRows = Math.max(6, boxHeight - 2);

    // Check if 3-panel layout fits (requires >= 105 columns)
    const isThreePane = cols >= 105;

    let p1Width, p2Width, p3Width;
    if (isThreePane) {
      p1Width = 22; // Places sidebar
      p2Width = Math.min(38, Math.max(28, Math.floor((cols - p1Width - 2) * 0.42))); // Middle file list
      p3Width = cols - p1Width - p2Width - 2; // Preview / details
    } else {
      p1Width = Math.min(36, Math.max(28, Math.floor(cols * 0.38))); // Combined sidebar/list
      p2Width = cols - p1Width - 1; // Preview / details
      p3Width = 0;
    }

    // ── Build Pane 1 Content ───────────────────────────────────────
    let p1Title = '';
    const p1Lines = [];

    if (isThreePane) {
      p1Title = `${C.roseBright}${C.bold}Places${C.reset}`;
      p1Lines.push(` ${C.roseBright}${C.bold}Navigation${C.reset}`);
      p1Lines.push(this.activeTab === 'files'
        ? `${C.selectBg}${C.selectFg} ▸ Files (${this.workspaceFiles.length})    ${C.reset}`
        : `   ${C.textMain}Files (${this.workspaceFiles.length})${C.reset}`);
      p1Lines.push(this.activeTab === 'uploads'
        ? `${C.selectBg}${C.selectFg} ▸ Uploads (${this.workspaceUploads.length})  ${C.reset}`
        : `   ${C.textMain}Uploads (${this.workspaceUploads.length})${C.reset}`);
      p1Lines.push(`   ${C.textMuted}SCP Guide [U]${C.reset}`);
      p1Lines.push(`   ${C.textMuted}Switch Space [S]${C.reset}`);
      p1Lines.push(`   ${C.textMuted}New File [N]${C.reset}`);
      p1Lines.push('');
      p1Lines.push(` ${C.roseBright}${C.bold}Status${C.reset}`);
      p1Lines.push(`  ${C.mint}● ONLINE${C.reset}`);
      p1Lines.push(`  ${C.textMuted}Room: ${C.roseBright}${this.room}${C.reset}`);
      p1Lines.push(`  ${C.textMuted}User: ${C.cyan}${userLabel}${C.reset}`);
      p1Lines.push(`  ${C.textMuted}jeeban.life${C.reset}`);
    } else {
      // 2-Pane mode: Left pane has tabs and file list
      const filesCount = this.workspaceFiles.length;
      const uploadsCount = this.workspaceUploads.length;
      p1Title = this.activeTab === 'files'
        ? `${C.selectBg}${C.selectFg} [1] Files (${filesCount}) ${C.reset}${C.textMuted} [2] Uploads (${uploadsCount})${C.reset}`
        : `${C.textMuted}[1] Files (${filesCount}) ${C.reset}${C.selectBg}${C.selectFg} [2] Uploads (${uploadsCount}) ${C.reset}`;

      // List of files or uploads
      const innerW = p1Width - 2;
      if (this.activeTab === 'files') {
        const total = this.workspaceFiles.length;
        if (this.selectedFileIndex < this.fileScrollOffset) this.fileScrollOffset = this.selectedFileIndex;
        if (this.selectedFileIndex >= this.fileScrollOffset + innerRows) this.fileScrollOffset = this.selectedFileIndex - innerRows + 1;

        if (total === 0) {
          p1Lines.push(`  ${C.textMuted}(No files in workspace)${C.reset}`);
          p1Lines.push(`  ${C.textMuted}Press [N] to create a file${C.reset}`);
        } else {
          for (let i = 0; i < innerRows; i++) {
            const idx = this.fileScrollOffset + i;
            if (idx >= total) break;
            const file = this.workspaceFiles[idx];
            const isSel = idx === this.selectedFileIndex;
            const sizeStr = formatSize(Buffer.byteLength(file.content || '', 'utf8'));
            const rightStr = `${sizeStr} `;
            const pointer = isSel ? '>' : ' ';
            const icon = '◆';
            const maxNameLen = Math.max(8, innerW - rightStr.length - 6);
            const displayName = file.name.length > maxNameLen ? file.name.slice(0, maxNameLen - 1) + '…' : file.name;
            const leftStr = ` ${pointer} ${icon} ${displayName}`;
            const padLen = Math.max(1, innerW - leftStr.length - rightStr.length);
            const lineStr = leftStr + ' '.repeat(padLen) + rightStr;

            if (isSel) {
              p1Lines.push(`${C.selectBg}${C.selectFg}${lineStr.slice(0, innerW)}${C.reset}`);
            } else {
              p1Lines.push(`   ${C.textMain}${displayName}${C.reset}${' '.repeat(padLen)}${C.textMuted}${rightStr}${C.reset}`);
            }
          }
        }
      } else {
        const total = this.workspaceUploads.length;
        if (this.selectedUploadIndex < this.uploadScrollOffset) this.uploadScrollOffset = this.selectedUploadIndex;
        if (this.selectedUploadIndex >= this.uploadScrollOffset + innerRows) this.uploadScrollOffset = this.selectedUploadIndex - innerRows + 1;

        if (total === 0) {
          p1Lines.push(`  ${C.textMuted}(No uploaded files)${C.reset}`);
          p1Lines.push(`  ${C.textMuted}Use SCP to upload:${C.reset}`);
          p1Lines.push(`  ${C.rose}scp -P 2222 <f> ${this.room}/${C.reset}`);
        } else {
          for (let i = 0; i < innerRows; i++) {
            const idx = this.uploadScrollOffset + i;
            if (idx >= total) break;
            const upload = this.workspaceUploads[idx];
            const isSel = idx === this.selectedUploadIndex;
            const sizeStr = formatSize(upload.size || 0);
            const rightStr = `${sizeStr} `;
            const pointer = isSel ? '>' : ' ';
            const icon = '⧉';
            const maxNameLen = Math.max(8, innerW - rightStr.length - 6);
            const displayName = upload.originalName.length > maxNameLen ? upload.originalName.slice(0, maxNameLen - 1) + '…' : upload.originalName;
            const leftStr = ` ${pointer} ${icon} ${displayName}`;
            const padLen = Math.max(1, innerW - leftStr.length - rightStr.length);
            const lineStr = leftStr + ' '.repeat(padLen) + rightStr;

            if (isSel) {
              p1Lines.push(`${C.selectBg}${C.selectFg}${lineStr.slice(0, innerW)}${C.reset}`);
            } else {
              p1Lines.push(`   ${C.textMain}${displayName}${C.reset}${' '.repeat(padLen)}${C.textMuted}${rightStr}${C.reset}`);
            }
          }
        }
      }
    }

    // ── Build Pane 2 Content (Middle Pane in 3-pane mode, or Right Pane in 2-pane mode) ──
    let p2Title = '';
    const p2Lines = [];

    if (isThreePane) {
      // Middle Pane is the File / Upload List
      const innerW = p2Width - 2;
      p2Title = `${C.roseBright}${C.bold}~/${this.room}${this.activeTab === 'uploads' ? '/uploads' : ''}${C.reset}`;

      if (this.activeTab === 'files') {
        const total = this.workspaceFiles.length;
        if (this.selectedFileIndex < this.fileScrollOffset) this.fileScrollOffset = this.selectedFileIndex;
        if (this.selectedFileIndex >= this.fileScrollOffset + innerRows) this.fileScrollOffset = this.selectedFileIndex - innerRows + 1;

        if (total === 0) {
          p2Lines.push(`  ${C.textMuted}(No files in workspace)${C.reset}`);
          p2Lines.push(`  ${C.textMuted}Press [N] to create a file${C.reset}`);
        } else {
          for (let i = 0; i < innerRows; i++) {
            const idx = this.fileScrollOffset + i;
            if (idx >= total) break;
            const file = this.workspaceFiles[idx];
            const isSel = idx === this.selectedFileIndex;
            const sizeStr = formatSize(Buffer.byteLength(file.content || '', 'utf8'));
            const rightStr = `${sizeStr} `;
            const pointer = isSel ? '>' : ' ';
            const icon = '◆';
            const maxNameLen = Math.max(8, innerW - rightStr.length - 6);
            const displayName = file.name.length > maxNameLen ? file.name.slice(0, maxNameLen - 1) + '…' : file.name;
            const leftStr = ` ${pointer} ${icon} ${displayName}`;
            const padLen = Math.max(1, innerW - leftStr.length - rightStr.length);
            const lineStr = leftStr + ' '.repeat(padLen) + rightStr;

            if (isSel) {
              p2Lines.push(`${C.selectBg}${C.selectFg}${lineStr.slice(0, innerW)}${C.reset}`);
            } else {
              p2Lines.push(`   ${C.textMain}${displayName}${C.reset}${' '.repeat(padLen)}${C.textMuted}${rightStr}${C.reset}`);
            }
          }
        }
      } else {
        const total = this.workspaceUploads.length;
        if (this.selectedUploadIndex < this.uploadScrollOffset) this.uploadScrollOffset = this.selectedUploadIndex;
        if (this.selectedUploadIndex >= this.uploadScrollOffset + innerRows) this.uploadScrollOffset = this.selectedUploadIndex - innerRows + 1;

        if (total === 0) {
          p2Lines.push(`  ${C.textMuted}(No uploaded files)${C.reset}`);
          p2Lines.push(`  ${C.textMuted}Upload files with SCP:${C.reset}`);
          p2Lines.push(`  ${C.rose}scp -P 2222 <f> ${this.room}/${C.reset}`);
        } else {
          for (let i = 0; i < innerRows; i++) {
            const idx = this.uploadScrollOffset + i;
            if (idx >= total) break;
            const upload = this.workspaceUploads[idx];
            const isSel = idx === this.selectedUploadIndex;
            const sizeStr = formatSize(upload.size || 0);
            const rightStr = `${sizeStr} `;
            const pointer = isSel ? '>' : ' ';
            const icon = '⧉';
            const maxNameLen = Math.max(8, innerW - rightStr.length - 6);
            const displayName = upload.originalName.length > maxNameLen ? upload.originalName.slice(0, maxNameLen - 1) + '…' : upload.originalName;
            const leftStr = ` ${pointer} ${icon} ${displayName}`;
            const padLen = Math.max(1, innerW - leftStr.length - rightStr.length);
            const lineStr = leftStr + ' '.repeat(padLen) + rightStr;

            if (isSel) {
              p2Lines.push(`${C.selectBg}${C.selectFg}${lineStr.slice(0, innerW)}${C.reset}`);
            } else {
              p2Lines.push(`   ${C.textMain}${displayName}${C.reset}${' '.repeat(padLen)}${C.textMuted}${rightStr}${C.reset}`);
            }
          }
        }
      }
    }

    // ── Build Preview / Details Content ────────────────────────────
    // In 3-pane mode, this is Pane 3. In 2-pane mode, this is Pane 2.
    const previewWidth = isThreePane ? p3Width : p2Width;
    let previewTitle = '';
    const previewLines = [];

    if (this.activeTab === 'files') {
      const activeFile = this.currentFile || this.workspaceFiles[this.selectedFileIndex];
      if (activeFile) {
        previewTitle = `${C.roseBright}${C.bold}${activeFile.name}${C.reset}`;
        const rawContent = activeFile.content || '';
        const lines = rawContent.split('\n');

        // Subheader line matching screenshot
        previewLines.push(` ${C.roseBright}Code${C.reset}  ${C.textMuted}${activeFile.language || 'text'} • ${lines.length} lines${C.reset}`);

        // Code preview with line numbers
        for (let i = 0; i < innerRows - 1; i++) {
          const lineIdx = i;
          if (lineIdx < lines.length) {
            const lineNum = `${(lineIdx + 1).toString().padStart(3, ' ')} │ `;
            const highlighted = highlightSyntax(lines[lineIdx]);
            previewLines.push(` ${C.textDim}${lineNum}${C.reset}${highlighted}`);
          } else {
            break;
          }
        }
      } else {
        previewTitle = `${C.roseBright}Editor${C.reset}`;
        previewLines.push('');
        previewLines.push(`  ${C.textMuted}Select a file from the explorer on the left.${C.reset}`);
        previewLines.push(`  ${C.textMuted}Press [N] to create a new file.${C.reset}`);
      }
    } else {
      // Upload Tab Details
      const uploadItem = this.workspaceUploads[this.selectedUploadIndex];
      if (uploadItem) {
        previewTitle = `${C.roseBright}${C.bold}${uploadItem.originalName}${C.reset}`;
        const sizeStr = formatSize(uploadItem.size || 0);
        previewLines.push(` ${C.roseBright}Upload${C.reset}  ${C.textMuted}${uploadItem.mimeType || 'application/octet-stream'} • ${sizeStr}${C.reset}`);
        previewLines.push('');
        previewLines.push(`  ${C.rose}▸ Name     :${C.reset} ${C.textMain}${uploadItem.originalName}${C.reset}`);
        previewLines.push(`  ${C.rose}▸ Size     :${C.reset} ${C.textMain}${sizeStr} (${uploadItem.size || 0} Bytes)${C.reset}`);
        previewLines.push(`  ${C.rose}▸ MIME     :${C.reset} ${C.textMain}${uploadItem.mimeType || 'application/octet-stream'}${C.reset}`);
        previewLines.push(`  ${C.rose}▸ Uploaded :${C.reset} ${C.textMain}${new Date(uploadItem.createdAt).toLocaleString()}${C.reset}`);
        previewLines.push(`  ${C.rose}▸ Share URL:${C.reset} ${C.cyan}${C.underline}https://jeeban.life/s/${uploadItem._id}${C.reset}  ${C.textMuted}[C] Copy${C.reset}`);
        previewLines.push('');

        // Curl command card
        const cardW = Math.min(66, Math.max(34, previewWidth - 6));
        const innerCardW = cardW - 4;
        previewLines.push(`  ${C.roseBright}Download via Curl:${C.reset} ${C.textMuted}[W] Copy${C.reset}`);
        previewLines.push(`  ${C.rose}╭─ [ CURL COMMAND ] ${'─'.repeat(Math.max(0, cardW - 20))}╮${C.reset}`);
        const curlCmd = `curl -fL -o "${uploadItem.originalName}" "https://jeeban.life/s/${uploadItem._id}"`;
        const wrappedCurl = wrapCommand(curlCmd, innerCardW);
        wrappedCurl.forEach((line) => {
          previewLines.push(`  ${C.rose}│${C.reset} ${fitToWidth(C.textMain + line, innerCardW)} ${C.rose}│${C.reset}`);
        });
        previewLines.push(`  ${C.rose}╰${'─'.repeat(Math.max(0, cardW - 2))}╯${C.reset}`);
        previewLines.push('');

        // SCP command card
        previewLines.push(`  ${C.roseBright}Download via SCP:${C.reset} ${C.textMuted}[S] Copy${C.reset}`);
        previewLines.push(`  ${C.rose}╭─ [ SCP COMMAND ] ${'─'.repeat(Math.max(0, cardW - 19))}╮${C.reset}`);
        const scpCmd = `scp -P 2222 jeeban.life:${this.room}/"${uploadItem.originalName}" ./`;
        const wrappedScp = wrapCommand(scpCmd, innerCardW);
        wrappedScp.forEach((line) => {
          previewLines.push(`  ${C.rose}│${C.reset} ${fitToWidth(C.textMain + line, innerCardW)} ${C.rose}│${C.reset}`);
        });
        previewLines.push(`  ${C.rose}╰${'─'.repeat(Math.max(0, cardW - 2))}╯${C.reset}`);
      } else {
        previewTitle = `${C.roseBright}Uploads${C.reset}`;
        previewLines.push('');
        previewLines.push(`  ${C.textMuted}No files uploaded yet in workspace '${this.room}'.${C.reset}`);
        previewLines.push('');
        previewLines.push(`  ${C.roseBright}Direct SCP upload from your local machine:${C.reset}`);
        previewLines.push(`  ${C.mint}scp -P 2222 <local-file> ${userLabel}@jeeban.life:${this.room}/${C.reset}`);
      }
    }

    // Assign preview lines to proper pane
    let p3Title = '';
    const p3Lines = [];
    if (isThreePane) {
      p3Title = previewTitle;
      p3Lines.push(...previewLines);
    } else {
      p2Title = previewTitle;
      p2Lines.push(...previewLines);
    }

    // ── Assemble Screen Rows ───────────────────────────────────────
    let out = '\x1b[H'; // Cursor to home

    // Top border row
    if (isThreePane) {
      out += `${renderBoxTop(p1Title, p1Width)} ${renderBoxTop(p2Title, p2Width)} ${renderBoxTop(p3Title, p3Width)}\x1b[K\r\n`;
    } else {
      out += `${renderBoxTop(p1Title, p1Width)} ${renderBoxTop(p2Title, p2Width)}\x1b[K\r\n`;
    }

    // Body rows
    for (let r = 0; r < innerRows; r++) {
      const line1 = p1Lines[r] || '';
      const line2 = p2Lines[r] || '';
      if (isThreePane) {
        const line3 = p3Lines[r] || '';
        out += `${renderBoxRow(line1, p1Width)} ${renderBoxRow(line2, p2Width)} ${renderBoxRow(line3, p3Width)}\x1b[K\r\n`;
      } else {
        out += `${renderBoxRow(line1, p1Width)} ${renderBoxRow(line2, p2Width)}\x1b[K\r\n`;
      }
    }

    // Bottom border row
    if (isThreePane) {
      out += `${renderBoxBottom(p1Width)} ${renderBoxBottom(p2Width)} ${renderBoxBottom(p3Width)}\x1b[K\r\n`;
    } else {
      out += `${renderBoxBottom(p1Width)} ${renderBoxBottom(p2Width)}\x1b[K\r\n`;
    }

    // ── Row 1: Context-Sensitive Shortcuts ─────────────────────────
    let navHelp = '';
    if (this.isEditing) {
      navHelp = ` ${C.amber}[INSERT MODE] Type or paste text${C.reset}  ${C.rose}│${C.reset}  ${C.roseBright}[^O] Save File${C.reset}  ${C.rose}│${C.reset}  ${C.textMuted}[Esc] Cancel${C.reset}`;
    } else if (this.activeTab === 'files') {
      navHelp = ` ${C.roseBright}[↑↓]${C.reset} Navigate  ${C.roseBright}[Enter]${C.reset} Open  ${C.roseBright}[i]${C.reset} Edit  ${C.roseBright}[^O]${C.reset} Save  ${C.roseBright}[Tab]${C.reset} Switch  ${C.roseBright}[N]${C.reset} New  ${C.roseBright}[D]${C.reset} Delete  ${C.roseBright}[Q]${C.reset} Exit`;
    } else {
      navHelp = ` ${C.roseBright}[↑↓]${C.reset} Navigate  ${C.roseBright}[C]${C.reset} Copy URL  ${C.roseBright}[W]${C.reset} Copy Curl  ${C.roseBright}[S]${C.reset} Copy SCP  ${C.roseBright}[Tab]${C.reset} Switch  ${C.roseBright}[U]${C.reset} SCP Guide  ${C.roseBright}[Q]${C.reset} Exit`;
    }
    out += `${navHelp}\x1b[K\r\n`;

    // ── Row 2: Status Bar (Matching screenshot footer) ─────────────
    let leftStatus = '';
    if (this.activeTab === 'files') {
      const idx = this.workspaceFiles.length > 0 ? this.selectedFileIndex + 1 : 0;
      const curName = this.currentFile ? this.currentFile.name : (this.workspaceFiles[0]?.name || '-');
      leftStatus = `${C.textMain}${idx}/${this.workspaceFiles.length}  ${curName}${C.reset}`;
    } else {
      const idx = this.workspaceUploads.length > 0 ? this.selectedUploadIndex + 1 : 0;
      const curName = this.workspaceUploads[this.selectedUploadIndex]?.originalName || '-';
      leftStatus = `${C.textMain}${idx}/${this.workspaceUploads.length}  ${curName}${C.reset}`;
    }

    const rightStatus = `${C.mint}● ONLINE${C.reset}  ${C.textMuted}room:${C.reset} ${C.roseBright}${this.room}${C.reset}  ${C.textMuted}user:${C.reset} ${C.cyan}${userLabel}${C.reset}`;

    // Center status feedback message
    const centerMsg = `${C.textMain}${this.statusMessage}${C.reset}`;

    const totalPlain = visibleLength(leftStatus) + visibleLength(centerMsg) + visibleLength(rightStatus);
    const gap = Math.max(2, Math.floor((cols - totalPlain) / 2));
    const pad1 = ' '.repeat(gap);
    const pad2 = ' '.repeat(Math.max(2, cols - totalPlain - gap));

    out += ` ${leftStatus}${pad1}${centerMsg}${pad2}${rightStatus}\x1b[K`;

    this.write(out);
  }

  // ── Handle IDE User Input ───────────────────────────────────────
  async runInteractive() {
    this.clearScreen();

    let target = 'general';
    let unlocked = false;

    while (true) {
      this.clearScreen();
      // Initial Workspace Setup Modal
      this.writeln(`${C.rose}╭─ [ CODECOLLAB IDE - WORKSPACE SETUP ] ────────────────────────────────╮${C.reset}`);
      this.writeln(`${C.rose}│${C.reset} Enter the Space Name you want to collaborate in.                       ${C.rose}│${C.reset}`);
      this.writeln(`${C.rose}│${C.reset} Press [Enter] for default 'general', or type custom workspace name.     ${C.rose}│${C.reset}`);
      this.writeln(`${C.rose}╰───────────────────────────────────────────────────────────────────────╯${C.reset}\n`);

      const requestedRoom = await this.prompt('Workspace Name [default: general]: ');
      if (this.isCancel(requestedRoom)) {
        target = 'general';
      } else if (/^[a-zA-Z0-9_-]+$/.test(requestedRoom)) {
        target = requestedRoom.toLowerCase();
      } else {
        target = 'general';
      }

      unlocked = await this.checkAndUnlockSpace(target);
      if (unlocked) {
        this.room = target;
        break;
      }

      // If user specifically asked for 'general' and it's unlocked, proceed
      if (target === 'general') {
        this.room = 'general';
        break;
      }

      // If unlocking custom workspace failed, do not silently force user into 'general'!
      this.clearScreen();
      this.writeln(`\r\n${C.red}✗ Could not unlock workspace '${target}'.${C.reset}\n`);
      const choice = await this.prompt(`Press [Enter] to try again, 'g' for general, or 'q' to quit: `);
      const c = (choice || '').trim().toLowerCase();
      if (c === 'g' || c === 'general') {
        this.room = 'general';
        break;
      } else if (c === 'q' || c === 'exit' || c === ':q') {
        this.stream.end();
        return;
      }
      // Otherwise loop back to workspace setup
    }

    this.write('\x1b[?25l'); // Hide cursor
    await this.fetchWorkspaceData();
    this.statusMessage = unlocked ? `✓ Connected to '${this.room}'` : '● Connected';
    this.renderIDE();

    // Key event listener
    return new Promise((resolve) => {
      const handleInput = async (buf) => {
        if (this.isEditing) return;

        const key = buf.toString();

        // ── Arrows / Navigation ────────────────────────────────────
        if (key === '\x1b[A' || key === 'k') { // Up Arrow / 'k'
          if (this.activeTab === 'files') {
            if (this.selectedFileIndex > 0) {
              this.selectedFileIndex--;
              this.currentFile = this.workspaceFiles[this.selectedFileIndex];
              this.renderIDE();
            }
          } else {
            if (this.selectedUploadIndex > 0) {
              this.selectedUploadIndex--;
              this.renderIDE();
            }
          }
        } else if (key === '\x1b[B' || key === 'j') { // Down Arrow / 'j'
          if (this.activeTab === 'files') {
            if (this.selectedFileIndex < this.workspaceFiles.length - 1) {
              this.selectedFileIndex++;
              this.currentFile = this.workspaceFiles[this.selectedFileIndex];
              this.renderIDE();
            }
          } else {
            if (this.selectedUploadIndex < this.workspaceUploads.length - 1) {
              this.selectedUploadIndex++;
              this.renderIDE();
            }
          }
        } else if (key === '\t' || key === '1' || key === '2') { // Tab or 1/2
          if (key === '1') this.activeTab = 'files';
          else if (key === '2') this.activeTab = 'uploads';
          else this.activeTab = this.activeTab === 'files' ? 'uploads' : 'files';
          this.statusMessage = `Switched to ${this.activeTab.toUpperCase()}`;
          this.renderIDE();
        } else if (key === '\x1b') { // Esc
          this.activeTab = 'files';
          this.selectedFileIndex = 0;
          if (this.workspaceFiles.length > 0) {
            this.currentFile = this.workspaceFiles[0];
          }
          this.statusMessage = '● Connected';
          this.renderIDE();
        } else if (key === '\r' || key === '\n') { // Enter
          if (this.activeTab === 'files') {
            if (this.workspaceFiles[this.selectedFileIndex]) {
              this.currentFile = this.workspaceFiles[this.selectedFileIndex];
              this.statusMessage = `Opened '${this.currentFile.name}'`;
              this.renderIDE();
            }
          }
        } else if (key === 'i' || key === 'I') { // 'i' -> Inline write / edit mode
          if (this.activeTab === 'files') {
            await this.handleDirectInlineEdit();
          }
        } else if (key === '\x0f') { // Ctrl+O (0x0F) -> Save directly
          if (this.activeTab === 'files' && this.currentFile) {
            await this.saveCurrentFile();
          }
        } else if (key.toLowerCase() === 'c') { // 'C' -> Copy URL
          if (this.activeTab === 'uploads') {
            const upload = this.workspaceUploads[this.selectedUploadIndex];
            if (upload) {
              const url = `https://jeeban.life/s/${upload._id}`;
              await this.showCopyModal('Share URL', url, 'Share URL');
            }
          } else {
            const url = `https://jeeban.life/${this.room}`;
            await this.showCopyModal('Workspace URL', url, 'Workspace URL');
          }
        } else if (key.toLowerCase() === 'w') { // 'W' -> Copy Curl Command
          if (this.activeTab === 'uploads') {
            const upload = this.workspaceUploads[this.selectedUploadIndex];
            if (upload) {
              const cmd = `curl -fL -o "${upload.originalName}" "https://jeeban.life/s/${upload._id}"`;
              await this.showCopyModal('Curl Command', cmd, 'Curl Command');
            }
          }
        } else if (key.toLowerCase() === 's' && this.activeTab === 'uploads') { // 'S' -> Copy SCP Command in Uploads tab
          const upload = this.workspaceUploads[this.selectedUploadIndex];
          if (upload) {
            const cmd = `scp -P 2222 jeeban.life:${this.room}/"${upload.originalName}" ./`;
            await this.showCopyModal('SCP Command', cmd, 'SCP Command');
          }
        } else if (key.toLowerCase() === 's' && this.activeTab === 'files') { // 'S' -> Switch Space in Files tab
          await this.handleSwitchWorkspace();
        } else if (key.toLowerCase() === 'n') { // New File
          await this.handleCreateNewFile();
        } else if (key.toLowerCase() === 'd') { // Delete File
          await this.handleDeleteFile();
        } else if (key.toLowerCase() === 'u') { // SCP Guide
          await this.showScpGuideModal();
        } else if (key.toLowerCase() === 'r') { // Refresh
          this.statusMessage = 'Refreshing workspace...';
          await this.fetchWorkspaceData();
          this.statusMessage = '✓ Workspace refreshed';
          this.renderIDE();
        } else if (key.toLowerCase() === 'q' || key === '\x03') { // Quit / Ctrl+C
          this.stream.removeListener('data', handleInput);
          this.write('\x1b[?25h'); // Restore cursor
          this.clearScreen();
          this.writeln(`${C.mint}[INFO] Session terminated. Goodbye.${C.reset}`);
          this.stream.end();
          resolve();
        }
      };

      this.stream.on('data', handleInput);
    });
  }

  // ── Save Current File Helper ────────────────────────────────────
  async saveCurrentFile() {
    if (!this.currentFile) {
      this.statusMessage = '✗ No file open to save';
      this.renderIDE();
      return;
    }

    try {
      await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
        fileName: this.currentFile.name,
        path: this.currentFile.path || '',
        content: this.currentFile.content || '',
        language: this.detectLanguage(this.currentFile.name),
      }, this.getAuthHeaders());
      this.statusMessage = `✓ Saved '${this.currentFile.name}'`;
    } catch (err) {
      this.statusMessage = `✗ Save failed: ${err.response?.data?.message || err.message}`;
    }
    this.renderIDE();
  }

  // ── Direct Interactive Inline Write / Paste Mode ─────────────────
  async handleDirectInlineEdit() {
    if (!this.currentFile) {
      if (this.workspaceFiles.length > 0) {
        this.currentFile = this.workspaceFiles[0];
      } else {
        this.statusMessage = 'Create a file first with [N] before writing';
        this.renderIDE();
        return;
      }
    }

    this.isEditing = true;
    this.statusMessage = `Editing '${this.currentFile.name}'`;
    this.renderIDE();

    const lines = this.currentFile.content ? this.currentFile.content.split('\n') : [''];
    let currentLine = '';

    await new Promise((resolve) => {
      const onData = async (chunk) => {
        const str = chunk.toString();

        // Check for Ctrl+O (\x0f) to save
        if (str === '\x0f') {
          this.stream.removeListener('data', onData);
          if (currentLine) {
            lines.push(currentLine);
          }
          this.currentFile.content = lines.join('\n');
          await this.saveCurrentFile();
          this.isEditing = false;
          resolve();
          return;
        }

        // Check for Escape to cancel
        if (str === '\x1b') {
          this.stream.removeListener('data', onData);
          this.statusMessage = 'Cancelled editing';
          this.isEditing = false;
          this.renderIDE();
          resolve();
          return;
        }

        // Process typed characters
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === '\x0f') {
            this.stream.removeListener('data', onData);
            if (currentLine) {
              lines.push(currentLine);
            }
            this.currentFile.content = lines.join('\n');
            await this.saveCurrentFile();
            this.isEditing = false;
            resolve();
            return;
          } else if (char === '\r' || char === '\n') {
            lines.push(currentLine);
            currentLine = '';
          } else if (char === '\u0008' || char === '\x7f') { // Backspace
            if (currentLine.length > 0) {
              currentLine = currentLine.slice(0, -1);
            } else if (lines.length > 0) {
              currentLine = lines.pop() || '';
            }
          } else if (char >= ' ' && char <= '~') {
            currentLine += char;
          }
        }

        // Live preview in IDE right pane
        const previewLines = [...lines];
        if (currentLine) previewLines.push(currentLine);
        this.currentFile.content = previewLines.join('\n');
        this.renderIDE();
      };

      this.stream.on('data', onData);
    });
  }

  // ── Create New File in Workspace ─────────────────────────────────
  async handleCreateNewFile() {
    this.isEditing = true;
    this.write('\x1b[?25h'); // Show cursor
    this.clearScreen();

    this.writeln(`${C.rose}╭─ [ CREATE NEW FILE ] ─────────────────────────────────────────────────╮${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} Enter new file name (e.g. script.js, styles.css, README.md)             ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} Press Enter or type ':q' to cancel.                                    ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}╰───────────────────────────────────────────────────────────────────────╯${C.reset}\n`);

    const fileName = await this.prompt('File Name: ');
    if (this.isCancel(fileName)) {
      this.statusMessage = 'File creation cancelled';
    } else {
      try {
        await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
          fileName,
          path: '',
          content: '',
          language: this.detectLanguage(fileName),
        }, this.getAuthHeaders());
        await this.fetchWorkspaceData();
        const created = this.workspaceFiles.find((f) => f.name === fileName);
        if (created) {
          this.currentFile = created;
          this.selectedFileIndex = this.workspaceFiles.indexOf(created);
        }
        this.statusMessage = `✓ Created '${fileName}'. Press [i] to write.`;
      } catch (err) {
        this.statusMessage = `✗ Failed to create file: ${err.response?.data?.message || err.message}`;
      }
    }

    this.write('\x1b[?25l');
    this.isEditing = false;
    this.renderIDE();
  }

  // ── Delete File ──────────────────────────────────────────────────
  async handleDeleteFile() {
    if (!this.currentFile) return;

    this.isEditing = true;
    this.write('\x1b[?25h');
    this.clearScreen();

    this.writeln(`${C.rose}╭─ [ DELETE FILE ] ─────────────────────────────────────────────────────╮${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} Are you sure you want to permanently delete:                           ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}│${C.reset}   ${C.roseBright}${this.currentFile.name}${C.reset}`);
    this.writeln(`${C.rose}╰───────────────────────────────────────────────────────────────────────╯${C.reset}\n`);

    const confirm = await this.prompt(`Delete '${this.currentFile.name}'? (y/N): `);
    if (confirm.toLowerCase() === 'y') {
      try {
        await axios.delete(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
          data: { fileName: this.currentFile.name, path: this.currentFile.path || '' },
          ...this.getAuthHeaders(),
        });
        this.statusMessage = `✓ Deleted '${this.currentFile.name}'`;
        this.currentFile = null;
        await this.fetchWorkspaceData();
      } catch (err) {
        this.statusMessage = `✗ Delete failed: ${err.response?.data?.message || err.message}`;
      }
    } else {
      this.statusMessage = 'Delete cancelled';
    }

    this.write('\x1b[?25l');
    this.isEditing = false;
    this.renderIDE();
  }

  // ── Show Copy Modal (Supports OSC 52 + GNOME Terminal triple-click copy) ──
  async showCopyModal(title, textToCopy, label = 'Command') {
    copyToClipboard(this.stream, textToCopy);

    this.isEditing = true;
    this.write('\x1b[?25h'); // Show cursor so user can select with mouse
    this.clearScreen();

    const cols = Math.max(76, this.pty.cols || 80);
    const boxW = Math.min(cols - 4, 76);

    this.writeln(`${C.rose}╭─ [ ${title.toUpperCase()} ] ${'─'.repeat(Math.max(0, boxW - title.length - 8))}╮${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} ${C.mint}✓ Sent to clipboard via OSC 52${C.reset} ${C.textMuted}(Kitty, Alacritty, VS Code, etc.)${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} ${C.textMuted}In GNOME Terminal (blocks OSC 52), copy the clean command below:${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} ${C.textMuted}(Triple-click the command line to select, then press Ctrl+Shift+C)${C.reset}`);
    this.writeln(`${C.rose}╰${'─'.repeat(Math.max(0, boxW - 2))}╯${C.reset}\n`);

    // The raw command line WITHOUT any borders or vertical bars on that row
    // This allows mouse triple-click in GNOME Terminal to select ONLY the exact command!
    this.writeln(`${C.bold}${C.textMain}${textToCopy}${C.reset}\n`);

    this.writeln(`${C.rose}${'─'.repeat(boxW)}${C.reset}`);
    this.writeln(`${C.textMuted}Press [Enter], [Esc], or any key to return to IDE...${C.reset}`);

    await new Promise((resolve) => {
      const onKey = () => {
        this.stream.removeListener('data', onKey);
        resolve();
      };
      this.stream.on('data', onKey);
    });

    this.write('\x1b[?25l'); // Hide cursor again
    this.isEditing = false;
    this.statusMessage = `✓ ${label} copied`;
    this.renderIDE();
  }

  // ── Show SCP Guide ───────────────────────────────────────────────
  async showScpGuideModal() {
    this.isEditing = true;
    this.write('\x1b[?25h');
    this.clearScreen();

    const userHint = this.user ? this.user.username : '<username>';
    this.writeln(`${C.rose}╭─ [ DIRECT LOCAL SCP UPLOAD GUIDE ] ───────────────────────────────────╮${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} You can upload files directly using your CodeCollab username!          ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}│${C.reset}                                                                        ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}│${C.reset}   ${C.bold}${C.mint}scp -P 2222 <local-file> ${userHint}@jeeban.life:${this.room}/${C.reset}`);
    this.writeln(`${C.rose}│${C.reset}                                                                        ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} Examples:                                                              ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}│${C.reset}   scp -P 2222 app.zip ${userHint}@jeeban.life:${this.room}/`);
    this.writeln(`${C.rose}│${C.reset}   scp -P 2222 document.pdf ${userHint}@jeeban.life:${this.room}/`);
    this.writeln(`${C.rose}│${C.reset}                                                                        ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} Enter your CodeCollab account password when prompted.                  ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}╰───────────────────────────────────────────────────────────────────────╯${C.reset}\n`);

    await this.prompt('Press [Enter] to return to IDE... ');
    this.write('\x1b[?25l');
    this.isEditing = false;
    this.renderIDE();
  }

  // ── Switch Workspace ─────────────────────────────────────────────
  async handleSwitchWorkspace() {
    this.isEditing = true;
    this.write('\x1b[?25h');
    this.clearScreen();

    this.writeln(`${C.rose}╭─ [ SWITCH WORKSPACE ] ────────────────────────────────────────────────╮${C.reset}`);
    this.writeln(`${C.rose}│${C.reset} Enter workspace name (e.g. general, my-project, team-demo)             ${C.rose}│${C.reset}`);
    this.writeln(`${C.rose}╰───────────────────────────────────────────────────────────────────────╯${C.reset}\n`);

    const newSpace = await this.prompt(`Workspace [current: ${this.room}]: `);
    if (!this.isCancel(newSpace) && /^[a-zA-Z0-9_-]+$/.test(newSpace)) {
      const target = newSpace.toLowerCase();
      const unlocked = await this.checkAndUnlockSpace(target);
      if (unlocked) {
        this.room = target;
        this.currentFile = null;
        this.selectedFileIndex = 0;
        await this.fetchWorkspaceData();
        this.statusMessage = `✓ Switched to '${this.room}'`;
      }
    }

    this.write('\x1b[?25l');
    this.isEditing = false;
    this.renderIDE();
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

    const cleanTargetRoom = (targetRoom || 'general').toLowerCase();
    const isAdmin = this.user && (this.user.role === 'admin' || this.user.username?.toLowerCase() === 'admin');
    if (cleanTargetRoom === 'admin' && !isAdmin) {
      this.stream.write("[ERROR] Access denied: 'admin' space is private to administrator.\n");
      this.stream.end();
      return;
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
        await axios.post(`${this.backendUrl}/api/codespaces/${cleanTargetRoom}/file`, {
          fileName: targetFile,
          content,
          language: this.detectLanguage(targetFile),
        }, this.getAuthHeaders());

        this.stream.write(`[OK] Piped content (${buffer.length} bytes) saved to '${targetFile}' in workspace '${cleanTargetRoom}'.\n`);
        this.stream.write(`URL: https://jeeban.life/${cleanTargetRoom}\n`);
      } catch (err) {
        this.stream.write(`[ERROR] Failed to save piped content: ${err.response?.data?.message || err.message}\n`);
      }
      this.stream.end();
    });
  }
}

module.exports = TerminalSession;
