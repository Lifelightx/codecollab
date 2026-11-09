import MonacoEditor from '@monaco-editor/react';

const getMonacoLanguage = (extension) => {
  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'py':
      return 'python';
    case 'java':
      return 'java';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'txt':
    default:
      return 'plaintext';
  }
};

export const THEME_OPTIONS = [
  { 
    id: 'vs-dark', 
    name: 'VS Code Dark',
    ui: {
      activityBarBg: '#333333',
      activityBarFg: '#cccccc',
      activityBarActiveBorder: '#ffffff',
      sidebarBg: '#252526',
      sidebarFg: '#cccccc',
      sidebarHeaderFg: '#bbbbbb',
      sidebarHover: '#2a2d2e',
      sidebarActive: '#37373d',
      activeBorder: '#007acc',
      tabBarBg: '#252526',
      tabInactiveBg: '#2d2d2d',
      tabActiveBg: '#1e1e1e',
      tabActiveFg: '#ffffff',
      tabInactiveFg: '#969696',
      editorBg: '#1e1e1e',
      statusBarBg: '#007acc',
      statusBarFg: '#ffffff',
      border: '#1e1e1e'
    }
  },
  { 
    id: 'vs-light', 
    name: 'VS Code Light',
    ui: {
      activityBarBg: '#2c2c2c',
      activityBarFg: '#ffffff',
      activityBarActiveBorder: '#007acc',
      sidebarBg: '#f3f3f3',
      sidebarFg: '#333333',
      sidebarHeaderFg: '#6f6f6f',
      sidebarHover: '#e8e8e8',
      sidebarActive: '#e4e6f1',
      activeBorder: '#007acc',
      tabBarBg: '#f3f3f3',
      tabInactiveBg: '#ececec',
      tabActiveBg: '#ffffff',
      tabActiveFg: '#333333',
      tabInactiveFg: '#626262',
      editorBg: '#ffffff',
      statusBarBg: '#007acc',
      statusBarFg: '#ffffff',
      border: '#e7e7e7'
    }
  },
  { 
    id: 'monokai', 
    name: 'Monokai',
    ui: {
      activityBarBg: '#1e1f1c',
      activityBarFg: '#ccccc7',
      activityBarActiveBorder: '#a6e22e',
      sidebarBg: '#272822',
      sidebarFg: '#f8f8f2',
      sidebarHeaderFg: '#75715e',
      sidebarHover: '#3e3d32',
      sidebarActive: '#49483e',
      activeBorder: '#a6e22e',
      tabBarBg: '#1e1f1c',
      tabInactiveBg: '#272822',
      tabActiveBg: '#34352f',
      tabActiveFg: '#f8f8f2',
      tabInactiveFg: '#75715e',
      editorBg: '#272822',
      statusBarBg: '#75715e',
      statusBarFg: '#f8f8f2',
      border: '#1e1f1c'
    }
  },
  { 
    id: 'dracula', 
    name: 'Dracula',
    ui: {
      activityBarBg: '#191a21',
      activityBarFg: '#6272a4',
      activityBarActiveBorder: '#bd93f9',
      sidebarBg: '#21222c',
      sidebarFg: '#f8f8f2',
      sidebarHeaderFg: '#bd93f9',
      sidebarHover: '#282a36',
      sidebarActive: '#44475a',
      activeBorder: '#bd93f9',
      tabBarBg: '#191a21',
      tabInactiveBg: '#21222c',
      tabActiveBg: '#282a36',
      tabActiveFg: '#50fa7b',
      tabInactiveFg: '#6272a4',
      editorBg: '#282a36',
      statusBarBg: '#bd93f9',
      statusBarFg: '#282a36',
      border: '#191a21'
    }
  },
  { 
    id: 'github-dark', 
    name: 'GitHub Dark',
    ui: {
      activityBarBg: '#010409',
      activityBarFg: '#8b949e',
      activityBarActiveBorder: '#58a6ff',
      sidebarBg: '#0d1117',
      sidebarFg: '#c9d1d9',
      sidebarHeaderFg: '#8b949e',
      sidebarHover: '#161b22',
      sidebarActive: '#21262d',
      activeBorder: '#58a6ff',
      tabBarBg: '#010409',
      tabInactiveBg: '#0d1117',
      tabActiveBg: '#161b22',
      tabActiveFg: '#58a6ff',
      tabInactiveFg: '#8b949e',
      editorBg: '#0d1117',
      statusBarBg: '#1f6feb',
      statusBarFg: '#ffffff',
      border: '#30363d'
    }
  },
  { 
    id: 'nord', 
    name: 'Nord',
    ui: {
      activityBarBg: '#242933',
      activityBarFg: '#d8dee9',
      activityBarActiveBorder: '#88c0d0',
      sidebarBg: '#2e3440',
      sidebarFg: '#d8dee9',
      sidebarHeaderFg: '#81a1c1',
      sidebarHover: '#3b4252',
      sidebarActive: '#434c5e',
      activeBorder: '#88c0d0',
      tabBarBg: '#242933',
      tabInactiveBg: '#2e3440',
      tabActiveBg: '#3b4252',
      tabActiveFg: '#88c0d0',
      tabInactiveFg: '#d8dee9',
      editorBg: '#2e3440',
      statusBarBg: '#4c566a',
      statusBarFg: '#eceff4',
      border: '#242933'
    }
  },
  { 
    id: 'hc-black', 
    name: 'High Contrast',
    ui: {
      activityBarBg: '#000000',
      activityBarFg: '#ffffff',
      activityBarActiveBorder: '#00ff00',
      sidebarBg: '#000000',
      sidebarFg: '#ffffff',
      sidebarHeaderFg: '#ffffff',
      sidebarHover: '#222222',
      sidebarActive: '#333333',
      activeBorder: '#00ff00',
      tabBarBg: '#000000',
      tabInactiveBg: '#111111',
      tabActiveBg: '#000000',
      tabActiveFg: '#00ff00',
      tabInactiveFg: '#ffffff',
      editorBg: '#000000',
      statusBarBg: '#000000',
      statusBarFg: '#ffffff',
      border: '#6fc3df'
    }
  },
];

export const getThemeConfig = (themeId) => {
  return THEME_OPTIONS.find((t) => t.id === themeId) || THEME_OPTIONS[0];
};

function Editor({ language, value, onChange, theme = 'vs-dark' }) {
  function handleEditorChange(val) {
    if (onChange) {
      onChange(val);
    }
  }

  const handleBeforeMount = (monaco) => {
    // Monokai
    monaco.editor.defineTheme('monokai', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '75715E' },
        { token: 'keyword', foreground: 'F92672' },
        { token: 'string', foreground: 'E6DB74' },
        { token: 'number', foreground: 'AE81FF' },
        { token: 'type', foreground: '66D9EF' },
      ],
      colors: {
        'editor.background': '#272822',
        'editor.foreground': '#F8F8F2',
        'editorLineNumber.foreground': '#90908A',
        'editor.lineHighlightBackground': '#3E3D32',
        'editorCursor.foreground': '#F8F8F0',
        'editor.selectionBackground': '#49483E',
      },
    });

    // Dracula
    monaco.editor.defineTheme('dracula', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272A4' },
        { token: 'keyword', foreground: 'FF79C6' },
        { token: 'string', foreground: 'F1FA8C' },
        { token: 'number', foreground: 'BD93F9' },
        { token: 'type', foreground: '8BE9FD' },
      ],
      colors: {
        'editor.background': '#282A36',
        'editor.foreground': '#F8F8F2',
        'editorLineNumber.foreground': '#6272A4',
        'editor.lineHighlightBackground': '#44475A',
        'editorCursor.foreground': '#F8F8F0',
        'editor.selectionBackground': '#44475A',
      },
    });

    // GitHub Dark
    monaco.editor.defineTheme('github-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8B949E' },
        { token: 'keyword', foreground: 'FF7B72' },
        { token: 'string', foreground: 'A5D6FF' },
        { token: 'number', foreground: '79C0FF' },
        { token: 'type', foreground: 'FFA657' },
      ],
      colors: {
        'editor.background': '#0D1117',
        'editor.foreground': '#C9D1D9',
        'editorLineNumber.foreground': '#6E7681',
        'editor.lineHighlightBackground': '#161B22',
        'editorCursor.foreground': '#58A6FF',
        'editor.selectionBackground': '#264F78',
      },
    });

    // Nord
    monaco.editor.defineTheme('nord', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '4C566A' },
        { token: 'keyword', foreground: '81A1C1' },
        { token: 'string', foreground: 'A3BE8C' },
        { token: 'number', foreground: 'B48EAD' },
        { token: 'type', foreground: '8FBCBB' },
      ],
      colors: {
        'editor.background': '#2E3440',
        'editor.foreground': '#D8DEE9',
        'editorLineNumber.foreground': '#4C566A',
        'editor.lineHighlightBackground': '#3B4252',
        'editorCursor.foreground': '#ECEFF4',
        'editor.selectionBackground': '#434C5E',
      },
    });
  };

  const monacoLanguage = getMonacoLanguage(language);

  return (
    <div className="h-full w-full">
      <MonacoEditor
        height="100%"
        width="100%"
        language={monacoLanguage}
        value={value}
        theme={theme}
        beforeMount={handleBeforeMount}
        onChange={handleEditorChange}
        options={{
          fontSize: 14,
          fontFamily: "'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
          fontLigatures: true,
          lineHeight: 1.5,
          minimap: { enabled: true, side: 'right' },
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderLineHighlight: 'line',
          scrollbar: {
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 12,
            horizontalScrollbarSize: 12,
          },
          bracketPairColorization: {
            enabled: true,
          },
        }}
      />
    </div>
  );
}

export default Editor;
