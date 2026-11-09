import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { VscClose } from 'react-icons/vsc';
import 'xterm/css/xterm.css';

const Terminal = forwardRef(({ socket, spaceName, onClose }, ref) => {
  const terminalRef = useRef(null);
  const xtermInstance = useRef(null);
  const fitAddonRef = useRef(null);

  useImperativeHandle(ref, () => ({
    runCode: (code) => {
      if (!xtermInstance.current) return;
      
      const term = xtermInstance.current;
      term.writeln('\x1b[36m> Executing JavaScript...\x1b[0m');

      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info,
      };

      console.log = (...args) => term.writeln(args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' '));
      console.error = (...args) => term.writeln(`\x1b[31m${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')}\x1b[0m`);
      console.warn = (...args) => term.writeln(`\x1b[33m${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')}\x1b[0m`);
      console.info = (...args) => term.writeln(`\x1b[34m${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ')}\x1b[0m`);

      try {
        new Function(code)();
        term.writeln('\x1b[32m> Done.\x1b[0m\n');
      } catch (e) {
        console.error(e.message);
      } finally {
        console.log = originalConsole.log;
        console.error = originalConsole.error;
        console.warn = originalConsole.warn;
        console.info = originalConsole.info;
      }
    }
  }));

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'Cascadia Code', Consolas, 'Courier New', monospace",
      theme: {
        background: '#1e1e1e',
        foreground: '#cccccc',
        cursor: '#aeafad',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
      },
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;

    term.writeln('\x1b[90mCodeCollab Integrated Console\x1b[0m');

    let currentInput = '';
    const prompt = () => term.write('\r\n\x1b[32m$\x1b[0m ');
    prompt();

    const disposable = term.onData((data) => {
      const code = data.charCodeAt(0);
      if (code === 13) { // Enter
        term.write('\r\n');
        if (currentInput.trim()) {
          try {
            new Function(currentInput)();
          } catch (err) {
            term.writeln(`\x1b[31m${err.message}\x1b[0m`);
          }
        }
        currentInput = '';
        prompt();
      } else if (code === 127) { // Backspace
        if (currentInput.length > 0) {
          currentInput = currentInput.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code < 32) {
        // control characters
      } else {
        currentInput += data;
        term.write(data);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        // ignore
      }
    });

    resizeObserver.observe(terminalRef.current);

    return () => {
      disposable.dispose();
      resizeObserver.disconnect();
      term.dispose();
    };
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#1e1e1e] border-t border-[#333333]">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 h-7 bg-[#252526] border-b border-[#333333] select-none text-[11px] uppercase tracking-wider text-[#cccccc]">
        <div className="flex items-center space-x-3">
          <span className="font-semibold text-white border-b-2 border-[#007acc] pb-1">Terminal</span>
          <span className="text-[#858585]">{spaceName}</span>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-[#37373d] text-[#858585] hover:text-white rounded"
            title="Close Panel"
          >
            <VscClose className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Terminal Body */}
      <div className="flex-1 w-full overflow-hidden p-2">
        <div ref={terminalRef} className="h-full w-full" />
      </div>
    </div>
  );
});

export default Terminal;
