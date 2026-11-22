const axios = require('axios');
const readline = require('readline');
const FormData = require('form-data');

// ANSI formatting helpers - Matches user's bash prompt theme (Teal / Cyan & Blue)
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  // Primary: Mint Green / Teal (matches "jeebanjyoti.mallik@apmosys.mahape")
  green: '\x1b[38;5;49m',        // Bright Mint / Teal
  greenBright: '\x1b[38;5;50m',  // Electric Mint
  greenBg: '\x1b[48;5;36m',      // Teal Background

  // Accent: Sky Blue / Steel Blue (matches "rnd/codecollab$")
  blue: '\x1b[38;5;39m',         // Vibrant Blue / Steel Cyan
  blueBright: '\x1b[38;5;45m',   // Bright Sky Blue
  blueBg: '\x1b[48;5;33m',       // Blue Background

  // Aliases for compatibility
  pink: '\x1b[38;5;39m',         // Replaced with Blue/Cyan
  pinkBright: '\x1b[38;5;45m',
  pinkBg: '\x1b[48;5;33m',

  // Neutral
  white: '\x1b[97m',
  gray: '\x1b[90m',
  grayLight: '\x1b[37m',
};

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
    this.focusArea = 'sidebar'; // 'tabs' | 'sidebar' | 'editor'
    this.selectedFileIndex = 0;
    this.selectedUploadIndex = 0;
    this.editorScrollOffset = 0;
    this.workspaceFiles = [];
    this.workspaceUploads = [];
    this.currentFile = null; // Currently opened file in editor
    this.statusMessage = 'Welcome to CodeCollab IDE';
    this.isEditing = false;
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

      rl.question(`${C.green}${questionText}${C.reset}`, (answer) => {
        rl.close();
        this.stream.resume();
        resolve((answer || '').trim());
      });
    });
  }

  // ── Secret Prompt Helper ────────────────────────────────────────
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
          } else if (char === '\u0008' || char === '\x7f') {
            if (secret.length > 0) {
              secret = secret.slice(0, -1);
              this.write('\b \b');
            }
          } else if (char === '\u0003' || char === '\u001b') {
            this.stream.removeListener('data', onData);
            this.writeln();
            this.stream.resume();
            return resolve('__cancel__');
          } else if (char >= ' ' && char <= '~') {
            secret += char;
            this.write(`${C.pink}*${C.reset}`);
          }
        }
      };
      this.stream.on('data', onData);
    });
  }

  // ── Fetch Workspace Data ─────────────────────────────────────────
  async fetchWorkspaceData() {
    try {
      const res = await axios.get(`${this.backendUrl}/api/codespaces/${this.room}`);
      const space = res.data;
      this.workspaceFiles = (space.files || []).filter((f) => !f.isFolder);

      // Default to index.html if available, or first file
      if (!this.currentFile && this.workspaceFiles.length > 0) {
        const indexHtml = this.workspaceFiles.find((f) => f.name.toLowerCase() === 'index.html');
        this.currentFile = indexHtml || this.workspaceFiles[0];
        const idx = this.workspaceFiles.indexOf(this.currentFile);
        if (idx >= 0) this.selectedFileIndex = idx;
      } else if (this.currentFile) {
        // Refresh current file content if it was updated
        const updated = this.workspaceFiles.find((f) => f.name === this.currentFile.name && f.path === this.currentFile.path);
        if (updated) this.currentFile = updated;
      }
    } catch (e) {
      this.statusMessage = `Error fetching files: ${e.message}`;
    }

    try {
      const uploadRes = await axios.get(`${this.backendUrl}/api/uploads?spaceName=${this.room}`);
      this.workspaceUploads = uploadRes.data?.uploads || [];
    } catch {
      this.workspaceUploads = [];
    }
  }

  // ── Render Split-View IDE (VS Code Theme) ────────────────────────
  renderIDE() {
    const cols = Math.max(80, this.pty.cols || 80);
    const rows = Math.max(24, this.pty.rows || 24);

    const sidebarWidth = Math.min(32, Math.max(24, Math.floor(cols * 0.3)));
    const editorWidth = cols - sidebarWidth - 1; // 1 char for vertical border
    const bodyHeight = rows - 5; // Top bar (2), header (1), footer/status (2)

    let out = '\x1b[H'; // Move to home without flickering

    // ── 1. Top Bar: App Branding & Status ──────────────────────────
    const userLabel = this.user ? `${this.user.username}` : 'Guest';
    const topText = ` CODECOLLAB IDE - Workspace: [${this.room}] | User: [${userLabel}]`;
    const rightText = `https://jeeban.life/${this.room} `;
    const spaceBetween = Math.max(0, cols - topText.length - rightText.length);

    out += `${C.pinkBg}${C.bold}${C.white}${topText}${' '.repeat(spaceBetween)}${rightText}${C.reset}\x1b[K\r\n`;

    // ── 2. Tab Bar: [FILES] | [UPLOADS] ────────────────────────────
    const filesTabActive = this.activeTab === 'files';
    const filesTab = filesTabActive
      ? `${C.greenBg}${C.bold}${C.white} [1] FILES ${C.reset}`
      : `${C.gray}  [1] Files  ${C.reset}`;
    const uploadsTab = !filesTabActive
      ? `${C.pinkBg}${C.bold}${C.white} [2] UPLOADS (${this.workspaceUploads.length}) ${C.reset}`
      : `${C.gray}  [2] Uploads (${this.workspaceUploads.length})  ${C.reset}`;

    const currentFilename = this.activeTab === 'files'
      ? (this.currentFile ? `  ${C.pink}${this.currentFile.name}${C.reset} ${C.green}(${this.currentFile.language || 'text'})${C.reset}` : '  (No file open)')
      : `  ${C.pink}Codespace: ${C.green}${C.bold}${this.room}${C.reset}`;

    const leftTabSpace = sidebarWidth - 24;
    const tabPad = leftTabSpace > 0 ? ' '.repeat(leftTabSpace) : '';

    out += `${filesTab}${uploadsTab}${tabPad}${C.green}│${C.reset}${currentFilename}\x1b[K\r\n`;

    // ── 3. Separator Line ──────────────────────────────────────────
    out += `${C.green}${'─'.repeat(sidebarWidth)}┼${'─'.repeat(editorWidth)}${C.reset}\x1b[K\r\n`;

    // ── 4. Main Body: Left Sidebar + Right Editor/Preview ──────────
    // Prepare Left Sidebar Lines
    const leftLines = [];
    if (this.activeTab === 'files') {
      leftLines.push(`${C.bold}${C.green} EXPLORER${C.reset}`);
      if (this.workspaceFiles.length === 0) {
        leftLines.push(`  (No files)`);
      } else {
        this.workspaceFiles.forEach((file, idx) => {
          const isSelected = idx === this.selectedFileIndex;
          const isOpened = this.currentFile && this.currentFile.name === file.name;
          const prefix = isSelected ? `${C.pink}${C.bold}» ${C.reset}` : '  ';
          const name = file.name.length > sidebarWidth - 6 ? file.name.slice(0, sidebarWidth - 9) + '...' : file.name;

          if (isSelected) {
            leftLines.push(`${prefix}${C.pink}${C.bold}${name}${C.reset}`);
          } else if (isOpened) {
            leftLines.push(`${prefix}${C.green}${name}${C.reset}`);
          } else {
            leftLines.push(`${prefix}${name}`);
          }
        });
      }
      leftLines.push('');
      leftLines.push(` [i] Insert/Write`);
      leftLines.push(` [^O] Save File`);
      leftLines.push(` [N] + New File`);
      leftLines.push(` [D] Delete File`);
    } else {
      leftLines.push(`${C.bold}${C.pink} UPLOADS (${this.workspaceUploads.length})${C.reset}`);
      if (this.workspaceUploads.length === 0) {
        leftLines.push(`  (No uploads)`);
        leftLines.push(`  Use SCP to upload`);
      } else {
        this.workspaceUploads.forEach((u, idx) => {
          const isSelected = idx === this.selectedUploadIndex;
          const prefix = isSelected ? `${C.pink}${C.bold}» ${C.reset}` : '  ';
          const name = u.originalName.length > sidebarWidth - 6 ? u.originalName.slice(0, sidebarWidth - 9) + '...' : u.originalName;

          if (isSelected) {
            leftLines.push(`${prefix}${C.pink}${C.bold}${name}${C.reset}`);
          } else {
            leftLines.push(`${prefix}${C.green}${name}${C.reset}`);
          }
        });
      }
      leftLines.push('');
      leftLines.push(` [U] Direct SCP Guide`);
    }

    // Prepare Right Content Lines
    const rightLines = [];
    if (this.activeTab === 'files') {
      if (this.currentFile && this.currentFile.content) {
        const rawLines = this.currentFile.content.split('\n');
        rawLines.forEach((l, i) => {
          const lineNum = `${(i + 1).toString().padStart(3, ' ')} │ `;
          const truncated = l.length > editorWidth - 8 ? l.slice(0, editorWidth - 11) + '...' : l;
          rightLines.push(`${C.pink}${lineNum}${C.reset}${truncated}`);
        });
      } else if (this.currentFile) {
        rightLines.push(`  (Empty file. Press [P] to paste or edit content)`);
      } else {
        rightLines.push(`  Select a file from the explorer on the left or press [N] to create one.`);
      }
    } else {
      // Upload Tab Details
      const selectedUpload = this.workspaceUploads[this.selectedUploadIndex];
      if (selectedUpload) {
        rightLines.push('');
        rightLines.push(`  ${C.bold}${C.pink}FILE DETAILS${C.reset}`);
        rightLines.push(`  ${C.green}${'─'.repeat(Math.min(68, editorWidth - 6))}${C.reset}`);
        rightLines.push(`  ${C.bold}${C.pink}Original Name :${C.reset} ${C.green}${selectedUpload.originalName}${C.reset}`);
        rightLines.push(`  ${C.bold}${C.pink}File Size     :${C.reset} ${C.green}${((selectedUpload.size || 0) / 1024).toFixed(2)} KB (${selectedUpload.size} Bytes)${C.reset}`);
        rightLines.push(`  ${C.bold}${C.pink}MIME Type     :${C.reset} ${C.green}${selectedUpload.mimeType || 'application/octet-stream'}${C.reset}`);
        rightLines.push(`  ${C.bold}${C.pink}Uploaded At   :${C.reset} ${C.green}${new Date(selectedUpload.createdAt).toLocaleString()}${C.reset}`);
        rightLines.push(`  ${C.bold}${C.pink}Share URL     :${C.reset} ${C.green}${C.underline}https://jeeban.life/s/${selectedUpload._id}${C.reset}`);
        rightLines.push(`  ${C.green}${'─'.repeat(Math.min(68, editorWidth - 6))}${C.reset}`);
        rightLines.push('');
        rightLines.push(`  ${C.bold}${C.pink}Download to your machine (pwd):${C.reset}`);
        rightLines.push(`  ${C.green}┌── [ SCP COMMAND ] ──────────────────────────────────────────────────┐${C.reset}`);
        rightLines.push(`  ${C.green}│${C.reset} scp -P 2222 jeeban.life:${this.room}/"${selectedUpload.originalName}" ./`);
        rightLines.push(`  ${C.green}└─────────────────────────────────────────────────────────────────────┘${C.reset}`);
        rightLines.push('');
        rightLines.push(`  ${C.bold}${C.pink}Or via Curl:${C.reset}`);
        rightLines.push(`  ${C.green}┌── [ CURL COMMAND ] ─────────────────────────────────────────────────┐${C.reset}`);
        rightLines.push(`  ${C.green}│${C.reset} curl -O https://jeeban.life/s/${selectedUpload._id}`);
        rightLines.push(`  ${C.green}└─────────────────────────────────────────────────────────────────────┘${C.reset}`);
      } else {
        rightLines.push('');
        rightLines.push(`  ${C.pink}No uploaded files found in this workspace.${C.reset}`);
        rightLines.push('');
        rightLines.push(`  Upload files directly from your terminal:`);
        rightLines.push(`  ${C.green}scp -P 2222 <local-file> ${this.user ? this.user.username : '<username>'}@jeeban.life:${this.room}/${C.reset}`);
      }
    }

    // Combine left and right columns row by row
    for (let r = 0; r < bodyHeight; r++) {
      const leftContent = leftLines[r] || '';
      // Strip ANSI for width calculation
      const leftPlain = leftContent.replace(/\x1b\[[0-9;]*m/g, '');
      const leftPad = Math.max(0, sidebarWidth - leftPlain.length);

      const rightContent = rightLines[r] || '';
      out += `${leftContent}${' '.repeat(leftPad)}${C.green}│${C.reset} ${rightContent}\x1b[K\r\n`;
    }

    // ── 5. Status / Command Bar ────────────────────────────────────
    out += `${C.green}${'─'.repeat(cols)}${C.reset}\x1b[K\r\n`;
    const navHelp = this.isEditing
      ? ` [INSERT MODE] Type or paste | [Ctrl+O] to SAVE | [Esc] to CANCEL`
      : ` [↑/↓] Select File | [i] Write/Paste | [Ctrl+O] Save | [Tab] Switch Tab | [N] New | [S] Space | [Q] Exit`;
    out += `${C.dim}${navHelp}\x1b[K\r\n`;
    out += `${C.pink}STATUS:${C.reset} ${C.greenBright}${this.statusMessage}${C.reset}\x1b[K`;

    this.write(out);
  }

  // ── Handle IDE User Input ───────────────────────────────────────
  async runInteractive() {
    this.clearScreen();

    // 1. Initial Prompt: Ask for Workspace Name if not set or default
    this.writeln(`${C.pink}┌── [ CODECOLLAB IDE - WORKSPACE SETUP ] ────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Enter the Space Name you want to collaborate in.                       ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Press [Enter] for default 'general', or type custom workspace name.     ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}\n`);

    const requestedRoom = await this.prompt('Workspace Name [default: general]: ');
    if (requestedRoom && requestedRoom !== '__cancel__' && /^[a-zA-Z0-9_-]+$/.test(requestedRoom)) {
      this.room = requestedRoom.toLowerCase();
    } else {
      this.room = 'general';
    }

    this.write('\x1b[?25l'); // Hide cursor
    await this.fetchWorkspaceData();
    this.statusMessage = `Connected to workspace '${this.room}'`;
    this.renderIDE();

    // Key event listener
    return new Promise((resolve) => {
      const handleInput = async (buf) => {
        if (this.isEditing) return; // Prevent interference when in text prompt

        const key = buf.toString();

        // ── Arrows / Navigation ────────────────────────────────────
        if (key === '\x1b[A') { // Up Arrow
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
        } else if (key === '\x1b[B') { // Down Arrow
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
          this.statusMessage = `Switched to ${this.activeTab.toUpperCase()} tab`;
          this.renderIDE();
        } else if (key === '\x1b') { // Esc
          // Return to Files tab / beginning
          this.activeTab = 'files';
          this.selectedFileIndex = 0;
          if (this.workspaceFiles.length > 0) {
            this.currentFile = this.workspaceFiles[0];
          }
          this.statusMessage = 'Reset focus to file explorer';
          this.renderIDE();
        } else if (key === '\r' || key === '\n') { // Enter
          if (this.activeTab === 'files') {
            if (this.workspaceFiles[this.selectedFileIndex]) {
              this.currentFile = this.workspaceFiles[this.selectedFileIndex];
              this.statusMessage = `Opened '${this.currentFile.name}'`;
              this.renderIDE();
            }
          }
        } else if (key === 'i' || key === 'I') { // 'i' -> Enter insert/type/paste mode
          if (this.activeTab === 'files') {
            await this.handleDirectInlineEdit();
          }
        } else if (key === '\x0f') { // Ctrl+O (0x0F) -> Save directly
          if (this.activeTab === 'files' && this.currentFile) {
            await this.saveCurrentFile();
          }
        } else if (key.toLowerCase() === 'p') { // Paste / Edit (legacy shortcut also supported)
          await this.handleDirectInlineEdit();
        } else if (key.toLowerCase() === 'n') { // New File
          await this.handleCreateNewFile();
        } else if (key.toLowerCase() === 'd') { // Delete File
          await this.handleDeleteFile();
        } else if (key.toLowerCase() === 'u') { // SCP Guide
          await this.showScpGuideModal();
        } else if (key.toLowerCase() === 's') { // Switch Space
          await this.handleSwitchWorkspace();
        } else if (key.toLowerCase() === 'r') { // Refresh
          this.statusMessage = 'Refreshing workspace...';
          await this.fetchWorkspaceData();
          this.renderIDE();
        } else if (key.toLowerCase() === 'q' || key === '\x03') { // Quit / Ctrl+C
          this.stream.removeListener('data', handleInput);
          this.write('\x1b[?25h'); // Restore cursor
          this.clearScreen();
          this.writeln(`${C.green}[INFO] Session terminated. Goodbye.${C.reset}`);
          this.stream.end();
          resolve();
        }
      };

      this.stream.on('data', handleInput);
    });
  }

  // ── Download Uploaded File into Workspace ─────────────────────────
  async handleDownloadUpload() {
    const uploadItem = this.workspaceUploads[this.selectedUploadIndex];
    if (!uploadItem) return;

    this.isEditing = true;
    this.write('\x1b[?25h');
    this.clearScreen();

    this.writeln(`${C.pink}┌── [ DOWNLOAD UPLOAD TO WORKSPACE ] ────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} File : ${C.green}${uploadItem.originalName}${C.reset} (${((uploadItem.size || 0) / 1024).toFixed(2)} KB)`);
    this.writeln(`${C.pink}│${C.reset} This will save the uploaded file into your active workspace tree.      ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}\n`);

    const confirm = await this.prompt(`Download '${uploadItem.originalName}' into workspace? (Y/n): `);
    if (confirm.toLowerCase() === 'n' || this.isCancel(confirm)) {
      this.statusMessage = 'Download cancelled.';
    } else {
      try {
        const fileRes = await axios.get(`${this.backendUrl}/api/uploads/share/${uploadItem._id}`, {
          responseType: 'text',
        });

        await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
          fileName: uploadItem.originalName,
          path: '',
          content: fileRes.data || '',
          language: this.detectLanguage(uploadItem.originalName),
        });

        this.statusMessage = `Downloaded '${uploadItem.originalName}' into workspace files!`;
        this.activeTab = 'files'; // Switch view to files so the user immediately sees it
        await this.fetchWorkspaceData();
        const downloadedIdx = this.workspaceFiles.findIndex((f) => f.name === uploadItem.originalName);
        if (downloadedIdx >= 0) {
          this.selectedFileIndex = downloadedIdx;
          this.currentFile = this.workspaceFiles[downloadedIdx];
        }
      } catch (err) {
        this.statusMessage = `Download failed: ${err.message}`;
      }
    }

    this.write('\x1b[?25l');
    this.isEditing = false;
    this.renderIDE();
  }

  // ── Save Current File Helper ────────────────────────────────────
  async saveCurrentFile() {
    if (!this.currentFile) {
      this.statusMessage = 'No file open to save.';
      this.renderIDE();
      return;
    }

    try {
      await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
        fileName: this.currentFile.name,
        path: this.currentFile.path || '',
        content: this.currentFile.content || '',
        language: this.detectLanguage(this.currentFile.name),
      });
      this.statusMessage = `[SAVED] '${this.currentFile.name}' saved successfully!`;
    } catch (err) {
      this.statusMessage = `Save failed: ${err.message}`;
    }
    this.renderIDE();
  }

  // ── Direct Interactive Inline Write / Paste Mode ('i' to write, 'o' to save) ──
  async handleDirectInlineEdit() {
    if (!this.currentFile) {
      if (this.workspaceFiles.length > 0) {
        this.currentFile = this.workspaceFiles[0];
      } else {
        this.statusMessage = 'Create a file first with [N] before writing.';
        this.renderIDE();
        return;
      }
    }

    this.isEditing = true;
    this.statusMessage = `[INSERT MODE] Type or paste text. Press [Ctrl+O] to SAVE, or [Esc] to cancel.`;
    this.renderIDE();

    // Prepare buffer of lines from current file content
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
          this.statusMessage = 'Cancelled editing without saving.';
          this.isEditing = false;
          this.renderIDE();
          resolve();
          return;
        }

        // Process characters / pasted text (allows typing 'o' and 'O' normally!)
        for (let i = 0; i < str.length; i++) {
          const char = str[i];
          if (char === '\x0f') { // Ctrl+O inside multi-character chunk
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

  // ── Paste / Edit File Content (Legacy Prompt) ────────────────────
  async handlePasteIntoCurrentFile() {
    this.isEditing = true;
    this.write('\x1b[?25h');
    this.clearScreen();

    const targetFile = this.currentFile ? this.currentFile.name : 'index.html';

    this.writeln(`${C.pink}┌── [ PASTE / EDIT CONTENT ] ───────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Target File : ${C.green}${targetFile}${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Paste your code/text below.                                            ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Type ${C.bold}:wq${C.reset} on a new line and press Enter to save.                       ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Type ${C.bold}:q${C.reset} on a new line to cancel without saving.                       ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}\n`);

    this.writeln(`${C.green}[INPUT] Paste content (finish with :wq):${C.reset}`);

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

    if (lines.length > 0) {
      const content = lines.join('\n');
      try {
        await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
          fileName: targetFile,
          path: this.currentFile?.path || '',
          content,
          language: this.detectLanguage(targetFile),
        });
        this.statusMessage = `Saved ${lines.length} lines to '${targetFile}'!`;
        await this.fetchWorkspaceData();
      } catch (err) {
        this.statusMessage = `Save failed: ${err.message}`;
      }
    } else {
      this.statusMessage = 'Edit cancelled. File unchanged.';
    }

    this.write('\x1b[?25l');
    this.isEditing = false;
    this.renderIDE();
  }

  // ── Create New File in Workspace ─────────────────────────────────
  async handleCreateNewFile() {
    this.isEditing = true;
    this.write('\x1b[?25h');
    this.clearScreen();

    this.writeln(`${C.pink}┌── [ CREATE NEW FILE ] ────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Enter new file name (e.g. script.js, styles.css, README.md)             ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Press Enter or type ':q' to cancel.                                    ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}\n`);

    const fileName = await this.prompt('File Name: ');
    if (this.isCancel(fileName)) {
      this.statusMessage = 'File creation cancelled.';
    } else {
      try {
        await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
          fileName,
          path: '',
          content: '',
          language: this.detectLanguage(fileName),
        });
        await this.fetchWorkspaceData();
        const created = this.workspaceFiles.find((f) => f.name === fileName);
        if (created) {
          this.currentFile = created;
          this.selectedFileIndex = this.workspaceFiles.indexOf(created);
        }
        this.statusMessage = `Created '${fileName}'. Press [P] to paste content.`;
      } catch (err) {
        this.statusMessage = `Failed to create file: ${err.message}`;
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

    const confirm = await this.prompt(`Delete file '${this.currentFile.name}'? (y/N): `);
    if (confirm.toLowerCase() === 'y') {
      try {
        await axios.delete(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
          data: { fileName: this.currentFile.name, path: this.currentFile.path || '' },
        });
        this.statusMessage = `Deleted '${this.currentFile.name}'.`;
        this.currentFile = null;
        await this.fetchWorkspaceData();
      } catch (err) {
        this.statusMessage = `Delete failed: ${err.message}`;
      }
    } else {
      this.statusMessage = 'Delete cancelled.';
    }

    this.write('\x1b[?25l');
    this.isEditing = false;
    this.renderIDE();
  }

  // ── Show SCP Guide ───────────────────────────────────────────────
  async showScpGuideModal() {
    this.isEditing = true;
    this.write('\x1b[?25h');
    this.clearScreen();

    const userHint = this.user ? this.user.username : '<username>';
    this.writeln(`${C.pink}┌── [ DIRECT LOCAL SCP UPLOAD GUIDE ] ───────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} You can upload files directly from your computer terminal!             ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}                                                                        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}   ${C.bold}${C.green}scp -P 2222 <local-file> ${userHint}@jeeban.life:${this.room}/${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}                                                                        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Examples:                                                              ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset}   scp -P 2222 app.zip ${userHint}@jeeban.life:${this.room}/`);
    this.writeln(`${C.pink}│${C.reset}   scp -P 2222 document.pdf ${userHint}@jeeban.life:${this.room}/`);
    this.writeln(`${C.pink}│${C.reset}                                                                        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}│${C.reset} Uploaded files will appear in the [2] UPLOADS tab automatically!        ${C.pink}│${C.reset}`);
    this.writeln(`${C.pink}└───────────────────────────────────────────────────────────────────────┘${C.reset}\n`);

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

    const newSpace = await this.prompt(`Enter workspace name [current: ${this.room}]: `);
    if (!this.isCancel(newSpace) && /^[a-zA-Z0-9_-]+$/.test(newSpace)) {
      this.room = newSpace.toLowerCase();
      this.currentFile = null;
      this.selectedFileIndex = 0;
      await this.fetchWorkspaceData();
      this.statusMessage = `Switched to workspace '${this.room}'`;
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
}

module.exports = TerminalSession;
