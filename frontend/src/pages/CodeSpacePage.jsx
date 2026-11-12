import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { VscFiles, VscSettingsGear, VscSourceControl, VscColorMode, VscAccount, VscCloudUpload } from 'react-icons/vsc';

import FileExplorer from '../components/FileExplorer';
import Editor, { THEME_OPTIONS, getThemeConfig } from '../components/Editor';
import TabBar from '../components/TabBar';
import PasscodeModal from '../components/PasscodeModal';
import JoinPrivateModal from '../components/JoinPrivateModal';
import SettingsMenu from '../components/SettingsMenu';
import AuthModal from '../components/AuthModal';
import ShareModal from '../components/ShareModal';
import GuestReminderBanner from '../components/GuestReminderBanner';
import { UploadPanel, UploadPreview } from '../components/UploadPanel';
import ProfilePopover from '../components/ProfilePopover';
import { useAppContext } from '../Context';

function CodeSpacePage() {
  const { spaceName } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const { 
    API_URL, 
    SOCKET_URL, 
    user, 
    authModalOpen, 
    authModalMode, 
    openAuthModal, 
    closeAuthModal 
  } = useAppContext();

  // --- Data State ---
  const [files, setFiles] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const [customSlug, setCustomSlug] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);

  // --- UI & Layout State ---
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [isSetPrivacyModalOpen, setIsSetPrivacyModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('codecollab-sidebar-width');
    return saved ? parseInt(saved, 10) : 240;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Upload panel state
  const [sidebarPanel, setSidebarPanel] = useState('explorer'); // 'explorer' | 'uploads'
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedUpload, setSelectedUpload] = useState(null);
  
  // Theme state with localStorage persistence
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('codecollab-theme') || 'vs-dark';
  });

  const themeConfig = getThemeConfig(currentTheme);
  const ui = themeConfig.ui;

  const handleThemeChange = (newTheme) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('codecollab-theme', newTheme);
  };

  // Resizable sidebar mouse event handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX - 48;
      if (newWidth >= 160 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (isResizing) {
        setIsResizing(false);
        setSidebarWidth((prev) => {
          localStorage.setItem('codecollab-sidebar-width', prev.toString());
          return prev;
        });
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  // --- Fetch data ---
  const fetchCodeSpaceData = async (passcode = null) => {
    setIsLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_URL}/codespaces/${spaceName}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });

      if (!res.ok) {
        if (res.status === 401) throw new Error('Incorrect passcode.');
        throw new Error('Could not fetch codespace data.');
      }

      const data = await res.json();
      setFiles(data.files || []);
      setIsPublic(data.isPublic);
      setIsOwner(!!data.ownerId);
      setCustomSlug(data.customSlug || '');
      setExpiresAt(data.expiresAt);

      if (data.files && data.files.length > 0) {
        setOpenFiles([data.files[0]]);
        setActiveFile(data.files[0]);
      }

      setShowAuthModal(false);
      setIsDataLoaded(true);

      const socket = io(SOCKET_URL);
      socketRef.current = socket;
      socket.emit('join-space', { spaceName });
      initializeSocketListeners(socket);
    } catch (error) {
      console.error(error.message);
      setAuthError(error.message);
      setShowAuthModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    document.title = activeFile 
      ? `${activeFile.name} - ${spaceName} · CodeCollab` 
      : `${spaceName} · CodeCollab`;
  }, [activeFile, spaceName]);

  useEffect(() => {
    fetch(`${API_URL}/codespaces/${spaceName}/status`)
      .then((res) => {
        if (!res.ok) throw new Error('Codespace not found.');
        return res.json();
      })
      .then((data) => {
        setIsOwner(data.isOwner);
        setCustomSlug(data.customSlug || '');
        setExpiresAt(data.expiresAt);
        if (data.isPublic) {
          fetchCodeSpaceData(null);
        } else {
          setIsLoading(false);
          setShowAuthModal(true);
        }
      })
      .catch((err) => {
        console.error(err);
        navigate('/');
      });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [spaceName]);

  const initializeSocketListeners = (socket) => {
    socket.on('file-created', (newFileList) => {
      if (Array.isArray(newFileList)) {
        setFiles(newFileList);
        const newlyCreated = newFileList[newFileList.length - 1];
        if (newlyCreated && !newlyCreated.isFolder) {
          setOpenFiles((prev) => {
            if (!prev.some((f) => f.name === newlyCreated.name)) {
              return [...prev, newlyCreated];
            }
            return prev;
          });
          setActiveFile(newlyCreated);
        }
      }
    });

    socket.on('code-updated', ({ file, content }) => {
      setFiles((prev) =>
        prev.map((f) => (f.name === file ? { ...f, content } : f))
      );
      setOpenFiles((prev) =>
        prev.map((f) => (f.name === file ? { ...f, content } : f))
      );
      setActiveFile((prev) =>
        prev?.name === file ? { ...prev, content } : prev
      );
    });

    socket.on('file-deleted', ({ fileName, files: updatedFiles }) => {
      if (updatedFiles) {
        setFiles(updatedFiles);
      } else {
        setFiles((prev) => prev.filter((f) => f.name !== fileName));
      }
      setOpenFiles((prev) => prev.filter((f) => f.name !== fileName));
      setActiveFile((prev) => (prev?.name === fileName ? null : prev));
    });

    socket.on('privacy-updated', (data) => {
      setIsPublic(data.isPublic);
    });

    socket.on('space-limit-exceeded', ({ message }) => {
      alert(`⚠️ Storage limit reached: ${message}`);
    });

    socket.on('auth-required', ({ message }) => {
      alert(`🔒 ${message}`);
      openAuthModal('register');
    });
  };

  const handleFileSelect = (file) => {
    if (file.isFolder) return;
    if (!openFiles.some((f) => f.name === file.name)) {
      setOpenFiles((prev) => [...prev, file]);
    }
    setActiveFile(file);
    setSelectedUpload(null); // clear upload preview when a code file is selected
  };

  const handleTabClick = (file) => {
    setActiveFile(file);
  };

  const handleTabClose = (fileName) => {
    const updated = openFiles.filter((f) => f.name !== fileName);
    setOpenFiles(updated);
    if (activeFile?.name === fileName) {
      setActiveFile(updated.length > 0 ? updated[updated.length - 1] : null);
    }
  };

  const handleDelete = (fileName) => {
    socketRef.current?.emit('delete-file', { spaceName, fileName });
  };

  const handleCreateFile = (fileName) => {
    let finalFileName = fileName.trim();
    if (!finalFileName.includes('.') && finalFileName.toLowerCase() !== 'dockerfile') {
      finalFileName += '.txt';
    }
    if (files.some((f) => f.name.toLowerCase() === finalFileName.toLowerCase())) {
      alert('A file with this name already exists.');
      return;
    }
    const language = finalFileName.toLowerCase() === 'dockerfile' 
      ? 'dockerfile' 
      : (finalFileName.split('.').pop() || 'plaintext');

    socketRef.current?.emit('create-file', {
      spaceName,
      fileName: finalFileName,
      language,
      isFolder: false,
    });
  };

  const handleCreateFolder = (folderName) => {
    if (!user) {
      openAuthModal('register');
      return;
    }
    const cleanName = folderName.trim();
    if (files.some((f) => f.name.toLowerCase() === cleanName.toLowerCase())) {
      alert('A file or folder with this name already exists.');
      return;
    }
    socketRef.current?.emit('create-file', {
      spaceName,
      fileName: cleanName,
      isFolder: true,
    });
  };

  const onCodeChange = (newCode) => {
    if (!activeFile) return;
    setActiveFile((prev) => ({ ...prev, content: newCode }));
    socketRef.current?.emit('code-change', {
      spaceName,
      file: activeFile.name,
      content: newCode,
    });
  };

  const handleTogglePrivacy = () => {
    if (isPublic) setIsSetPrivacyModalOpen(true);
    else updatePrivacySettings(true, null);
  };

  const updatePrivacySettings = async (newIsPublic, passcode) => {
    try {
      const res = await fetch(`${API_URL}/codespaces/${spaceName}/privacy`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newIsPublic, passcode }),
      });
      const data = await res.json();
      setIsPublic(data.isPublic);
      socketRef.current?.emit('privacy-change', { spaceName, ...data });
      setIsSetPrivacyModalOpen(false);
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
    }
  };

  if (!isDataLoaded) {
    return (
      <>
        {showAuthModal ? (
          <JoinPrivateModal
            spaceName={spaceName}
            onVerify={fetchCodeSpaceData}
            onCancel={() => navigate('/')}
            error={authError}
            isLoading={isLoading}
            themeConfig={themeConfig}
          />
        ) : (
          <div 
            className="flex items-center justify-center h-screen text-sm"
            style={{
              backgroundColor: ui.editorBg,
              color: ui.sidebarFg,
            }}
          >
            Loading {spaceName}...
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {isSetPrivacyModalOpen && (
        <PasscodeModal
          onSetPasscode={(passcode) => updatePrivacySettings(false, passcode)}
          onCancel={() => setIsSetPrivacyModalOpen(false)}
          themeConfig={themeConfig}
        />
      )}

      {/* Settings & Themes QuickPick */}
      <SettingsMenu
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        isPublic={isPublic}
        onTogglePrivacy={handleTogglePrivacy}
        spaceName={spaceName}
        themeConfig={themeConfig}
      />

      {/* Auth Modal (Sign In / Sign Up) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        defaultMode={authModalMode}
        themeConfig={themeConfig}
      />

      {/* Share & QR Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        spaceName={spaceName}
        currentSlug={customSlug}
        onSlugUpdated={(newSlug) => setCustomSlug(newSlug)}
        themeConfig={themeConfig}
      />

      <div 
        className="flex flex-col h-screen w-screen overflow-hidden font-sans transition-colors duration-150"
        style={{
          backgroundColor: ui.editorBg,
          color: ui.sidebarFg,
        }}
      >
        {/* 24h Guest Reminder Banner */}
        <GuestReminderBanner
          user={user}
          onOpenAuth={(mode) => openAuthModal(mode)}
          themeConfig={themeConfig}
        />

        {/* Main Workspace Body */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Activity Bar (48px) */}
          <div 
            className="w-12 flex flex-col justify-between items-center py-2 shrink-0 border-r select-none z-20 transition-colors duration-150"
            style={{
              backgroundColor: ui.activityBarBg,
              borderColor: ui.border,
            }}
          >
            <div className="flex flex-col items-center space-y-3">
              {/* Explorer icon */}
              <button
                onClick={() => {
                  setSidebarPanel('explorer');
                  setIsSidebarOpen(true);
                }}
                className="p-2.5 rounded transition-all cursor-pointer"
                style={{
                  color: isSidebarOpen && sidebarPanel === 'explorer' ? ui.activityBarActiveBorder : ui.activityBarFg,
                  borderLeft: isSidebarOpen && sidebarPanel === 'explorer' ? `2px solid ${ui.activityBarActiveBorder}` : '2px solid transparent',
                }}
                title="Explorer"
              >
                <VscFiles className="w-5 h-5" />
              </button>

              {/* Upload icon */}
              <button
                onClick={() => {
                  setSidebarPanel('uploads');
                  setIsSidebarOpen(true);
                }}
                className="p-2.5 rounded transition-all cursor-pointer"
                style={{
                  color: isSidebarOpen && sidebarPanel === 'uploads' ? ui.activityBarActiveBorder : ui.activityBarFg,
                  borderLeft: isSidebarOpen && sidebarPanel === 'uploads' ? `2px solid ${ui.activityBarActiveBorder}` : '2px solid transparent',
                }}
                title="Uploads"
              >
                <VscCloudUpload className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-2 relative">
              {/* Account button */}
              <button
                onClick={() => setIsProfileOpen((prev) => !prev)}
                className="p-2.5 transition-colors hover:opacity-80 cursor-pointer"
                style={{ color: user ? '#34d399' : ui.activityBarFg }}
                title={user ? `Signed in as ${user.username}` : "Sign In / Register"}
              >
                <VscAccount className="w-5 h-5" />
              </button>

              <ProfilePopover
                isOpen={isProfileOpen}
                onClose={() => setIsProfileOpen(false)}
                themeConfig={themeConfig}
              />

              <button
                onClick={() => setIsSettingsOpen(true)}
                className="p-2.5 transition-colors hover:opacity-80 cursor-pointer"
                style={{ color: ui.activityBarFg }}
                title="Settings & Themes"
              >
                <VscSettingsGear className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Collapsible & Resizable Sidebar */}
          {isSidebarOpen && (
            <div
              className="h-full overflow-hidden shrink-0 relative flex"
              style={{
                width: `${sidebarWidth}px`,
                transition: isResizing ? 'none' : 'width 0.15s ease-out',
              }}
            >
              <div className="w-full h-full overflow-hidden">
                {sidebarPanel === 'explorer' ? (
                  <FileExplorer
                    files={files}
                    spaceName={spaceName}
                    onFileSelect={handleFileSelect}
                    activeFile={activeFile}
                    onDeleteFile={handleDelete}
                    onCreateFile={handleCreateFile}
                    onCreateFolder={handleCreateFolder}
                    themeConfig={themeConfig}
                    isOwner={!!user}
                  />
                ) : (
                  <UploadPanel
                    uploadedFiles={uploadedFiles}
                    selectedUpload={selectedUpload}
                    onSelect={(f) => { setSelectedUpload(f); setActiveFile(null); }}
                    onDelete={(name) => {
                      setUploadedFiles(prev => prev.filter(f => f.name !== name));
                      if (selectedUpload?.name === name) setSelectedUpload(null);
                    }}
                    onUpload={(picked) => {
                      const newEntries = picked.map(file => ({
                        name: file.name,
                        url: URL.createObjectURL(file),
                        type: file.type,
                        size: file.size,
                      }));
                      setUploadedFiles(prev => {
                        const names = new Set(prev.map(f => f.name));
                        return [...prev, ...newEntries.filter(f => !names.has(f.name))];
                      });
                    }}
                    themeConfig={themeConfig}
                  />
                )}
              </div>

              {/* Resizer Handle */}
              <div
                onMouseDown={(e) => { e.preventDefault(); setIsResizing(true); }}
                className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-[#007acc]/60 transition-colors z-30"
                style={{ backgroundColor: isResizing ? ui.activeBorder : 'transparent' }}
                title="Drag to resize"
              />
            </div>
          )}

          {/* Right Editor Pane */}
          <div 
            className="flex flex-col flex-1 min-w-0 overflow-hidden"
            style={{ backgroundColor: ui.editorBg }}
          >
            {/* VS Code Tab Bar */}
            <TabBar
              openFiles={openFiles}
              activeFile={activeFile}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              isPublic={isPublic}
              onTogglePrivacy={handleTogglePrivacy}
              onOpenShare={() => setIsShareModalOpen(true)}
              themeConfig={themeConfig}
            />

            {/* Editor Area */}
            <div 
              className="flex-1 min-h-0 relative overflow-hidden"
              style={{ backgroundColor: ui.editorBg }}
            >
              {selectedUpload ? (
                <UploadPreview file={selectedUpload} themeConfig={themeConfig} />
              ) : activeFile ? (
                <Editor
                  key={activeFile.name}
                  fileName={activeFile.name}
                  language={activeFile.language}
                  value={activeFile.content}
                  onChange={onCodeChange}
                  theme={currentTheme}
                />
              ) : (
                <div 
                  className="flex flex-col items-center justify-center h-full select-none text-xs space-y-2 opacity-50"
                  style={{ color: ui.sidebarFg }}
                >
                  <VscFiles className="w-12 h-12" />
                  <p>No editor open. Select a file from the explorer.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Status Bar (22px) */}
        <div 
          className="h-[22px] flex items-center justify-between px-3 text-[11px] select-none shrink-0 z-20 transition-colors duration-150"
          style={{
            backgroundColor: ui.statusBarBg,
            color: ui.statusBarFg,
          }}
        >
          <div className="flex items-center space-x-3">
            <span className="flex items-center space-x-1">
              <VscSourceControl className="w-3.5 h-3.5" />
              <span>main</span>
            </span>
            <span>{customSlug ? `/${customSlug}` : spaceName}</span>
            <span className="opacity-80">
              {isPublic ? 'Public' : 'Protected'}
            </span>
            <span className="opacity-75">
              {user ? 'Retention: 60 Days' : 'Retention: 3 Days (Guest)'}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center space-x-1 opacity-90 hover:opacity-100 cursor-pointer"
              title="Click to change theme"
            >
              <VscColorMode className="w-3 h-3" />
              <span>{themeConfig.name}</span>
            </button>
            {activeFile && (
              <>
                <span>UTF-8</span>
                <span>{activeFile.language || 'plaintext'}</span>
              </>
            )}
            <span className="opacity-90">CodeCollab</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default CodeSpacePage;
