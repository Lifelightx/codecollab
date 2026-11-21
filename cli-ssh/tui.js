const axios = require('axios');
const readline = require('readline');

// ANSI formatting helpers
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
    this.writeln(`${C.gray}┌────────────────────────────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.gray}│${C.reset}  ${C.bold}${C.white}CODECOLLAB TERMINAL CLIENT${C.reset} ${C.gray}v1.0.0${C.reset}                                    ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}│${C.reset}  Endpoint : ${C.cyan}https://jeeban.life${C.reset}                     Status : ${C.green}CONNECTED${C.reset}    ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}└────────────────────────────────────────────────────────────────────────┘${C.reset}`);
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
      this.writeln(`  ${C.cyan}[2]${C.reset} List Files in Workspace`);
      this.writeln(`  ${C.cyan}[3]${C.reset} View File Content`);
      this.writeln(`  ${C.cyan}[4]${C.reset} Switch Active Workspace`);
      this.writeln(`  ${C.cyan}[5]${C.reset} Get Workspace Share Link`);
      this.writeln(`  ${C.cyan}[0]${C.reset} Exit`);
      this.writeln();

      const choice = await this.prompt(`${C.bold}Command [0-5]: ${C.reset}`);
      this.writeln();

      switch (choice) {
        case '1':
          await this.handlePasteBuffer();
          break;
        case '2':
          await this.handleListFiles();
          break;
        case '3':
          await this.handleViewFile();
          break;
        case '4':
          await this.handleSwitchRoom();
          break;
        case '5':
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
          this.writeln(`${C.red}[ERROR] Invalid selection. Enter a number between 0 and 5.${C.reset}\n`);
          break;
      }
    }
  }

  async handlePasteBuffer() {
    this.writeln(`${C.gray}┌── [ PASTE BUFFER ] ───────────────────────────────────────────────────┐${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} Enter file name and paste your content.                               ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} To finish: Type ${C.bold}:wq${C.reset} on a new line and press Enter.                     ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}│${C.reset} To cancel: Type ${C.bold}:q!${C.reset} on a new line.                                      ${C.gray}│${C.reset}`);
    this.writeln(`${C.gray}└───────────────────────────────────────────────────────────────────────┘${C.reset}`);

    let fileName = await this.prompt(`File name [default: snippet.txt]: `);
    if (!fileName) fileName = 'snippet.txt';

    this.writeln(`\n${C.yellow}[INPUT] Paste or type content below (finish with :wq):${C.reset}`);

    const lines = [];
    while (true) {
      const line = await this.prompt('');
      if (line.trim() === ':wq') {
        break;
      }
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
      const res = await axios.post(`${this.backendUrl}/api/codespaces/${this.room}/file`, {
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
    let fileName = await this.prompt('Enter file name to view: ');
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
    // Parse arguments like --room <name> --file <name>
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
