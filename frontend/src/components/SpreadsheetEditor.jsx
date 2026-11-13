import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { 
  VscSave, 
  VscCloudDownload, 
  VscAdd, 
  VscTrash, 
  VscLoading, 
  VscCheck, 
  VscTable 
} from 'react-icons/vsc';
import { useAppContext } from '../Context';

const ROW_HEIGHT = 24;
const HEADER_HEIGHT = 26;
const ROW_HEADER_WIDTH = 48;
const COL_WIDTH = 100;
const OVERSCAN = 10;

// Helper: Convert column index (0-based) to letter (0 -> A, 27 -> AB)
function colToLetter(colIndex) {
  let temp = colIndex;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

// ── Memoized Row Component: Never re-renders when other rows or selection changes ──
const GridRow = memo(function GridRow({ 
  r, 
  row, 
  colCount, 
  ui, 
  onCellClick, 
  onCellDoubleClick 
}) {
  return (
    <tr style={{ height: `${ROW_HEIGHT}px` }}>
      {/* Row Number Header (Sticky Left) */}
      <td
        className="border text-center text-[10px] select-none sticky left-0 z-10 font-mono"
        style={{
          width: `${ROW_HEADER_WIDTH}px`,
          minWidth: `${ROW_HEADER_WIDTH}px`,
          height: `${ROW_HEIGHT}px`,
          borderColor: ui.border,
          backgroundColor: ui.sidebarBg,
          color: ui.sidebarFg,
        }}
      >
        {r + 1}
      </td>

      {/* Row Cells */}
      {row.map((cellVal, c) => (
        <td
          key={c}
          onClick={() => onCellClick(r, c)}
          onDoubleClick={() => onCellDoubleClick(r, c)}
          className="border px-1.5 text-left truncate cursor-cell"
          style={{
            width: `${COL_WIDTH}px`,
            minWidth: `${COL_WIDTH}px`,
            maxWidth: `${COL_WIDTH}px`,
            height: `${ROW_HEIGHT}px`,
            borderColor: ui.border,
          }}
        >
          <span className="block truncate text-[12px] leading-tight select-none">
            {cellVal}
          </span>
        </td>
      ))}
    </tr>
  );
});

export default function SpreadsheetEditor({ file, themeConfig }) {
  const { API_URL, SOCKET_URL } = useAppContext();
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [activeSheet, setActiveSheet] = useState('');
  const [gridData, setGridData] = useState([]);
  const [selectedCell, setSelectedCell] = useState({ r: 0, c: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  // Virtualization window state
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const inputRef = useRef(null);
  const formulaInputRef = useRef(null);
  const gridContainerRef = useRef(null);
  const rafScrollRef = useRef(null);

  const backendOrigin = SOCKET_URL && SOCKET_URL !== '/' ? SOCKET_URL : '';
  const fileUrl = `${backendOrigin}/s/${file._id}`;

  const ui = themeConfig?.ui || {
    editorBg: '#1e1e1e',
    sidebarBg: '#252526',
    sidebarFg: '#cccccc',
    border: '#333333',
    activeBorder: '#007acc',
  };

  // ── Measure Viewport on Mount & Resize ──
  useEffect(() => {
    const updateSize = () => {
      if (gridContainerRef.current) {
        setViewportHeight(gridContainerRef.current.clientHeight || 600);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // ── Load spreadsheet on mount ──
  useEffect(() => {
    let isMounted = true;
    const fetchSpreadsheet = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await axios.get(fileUrl, { responseType: 'arraybuffer' });
        const data = new Uint8Array(res.data);
        const wb = XLSX.read(data, { type: 'array' });
        
        if (!isMounted) return;
        setWorkbook(wb);
        setSheetNames(wb.SheetNames || []);

        const initialSheet = wb.SheetNames[0] || 'Sheet1';
        setActiveSheet(initialSheet);
        loadSheetData(wb, initialSheet);
      } catch (err) {
        console.error('Failed to load spreadsheet:', err);
        if (isMounted) setError('Could not parse spreadsheet file.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSpreadsheet();
    return () => { isMounted = false; };
  }, [file._id]);

  const loadSheetData = (wb, sName) => {
    const ws = wb.Sheets[sName];
    if (!ws) {
      setGridData([['']]);
      return;
    }
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const minRows = Math.max(raw.length, 40);
    let maxCols = 15;
    raw.forEach(r => {
      if (Array.isArray(r) && r.length > maxCols) maxCols = r.length;
    });

    const padded = [];
    for (let r = 0; r < minRows; r++) {
      const row = [];
      const srcRow = raw[r] || [];
      for (let c = 0; c < maxCols; c++) {
        row.push(srcRow[c] !== undefined ? String(srcRow[c]) : '');
      }
      padded.push(row);
    }
    setGridData(padded);
    setSelectedCell({ r: 0, c: 0 });
    setIsEditing(false);
  };

  const saveCurrentSheetToWorkbook = useCallback(() => {
    if (!workbook || !activeSheet) return;
    const ws = XLSX.utils.aoa_to_sheet(gridData);
    workbook.Sheets[activeSheet] = ws;
  }, [workbook, activeSheet, gridData]);

  const handleSheetSwitch = (sName) => {
    if (sName === activeSheet) return;
    saveCurrentSheetToWorkbook();
    setActiveSheet(sName);
    if (workbook) {
      loadSheetData(workbook, sName);
    }
  };

  // ── Cell Commit & Edit ──
  const commitEdit = useCallback((val = null) => {
    const valToSave = val !== null ? val : editValue;
    setGridData(prev => {
      if (prev[selectedCell.r]?.[selectedCell.c] === valToSave) return prev;
      const next = [...prev];
      const targetRow = [...next[selectedCell.r]];
      targetRow[selectedCell.c] = valToSave;
      next[selectedCell.r] = targetRow;
      return next;
    });
    setIsEditing(false);
  }, [editValue, selectedCell]);

  const startEditing = useCallback((initialChar = null) => {
    const currentVal = gridData[selectedCell.r]?.[selectedCell.c] || '';
    setEditValue(initialChar !== null ? initialChar : currentVal);
    setIsEditing(true);
  }, [gridData, selectedCell]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCellClick = useCallback((r, c) => {
    if (isEditing) commitEdit();
    setSelectedCell({ r, c });
    gridContainerRef.current?.focus();
  }, [isEditing, commitEdit]);

  const handleCellDoubleClick = useCallback((r, c) => {
    setSelectedCell({ r, c });
    startEditing();
  }, [startEditing]);

  // ── 60fps RAF Throttled Scroll Listener ──
  const handleScroll = (e) => {
    const currentScrollTop = e.currentTarget.scrollTop;
    if (rafScrollRef.current) cancelAnimationFrame(rafScrollRef.current);
    rafScrollRef.current = requestAnimationFrame(() => {
      setScrollTop(currentScrollTop);
    });
  };

  // ── Keyboard Navigation (Zero DOM Re-renders) ──
  const handleKeyDown = useCallback((e) => {
    const maxR = gridData.length - 1;
    const maxC = (gridData[0]?.length || 1) - 1;

    if (isEditing) {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitEdit();
        if (selectedCell.r < maxR) {
          setSelectedCell(prev => ({ ...prev, r: prev.r + 1 }));
        }
        gridContainerRef.current?.focus();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        commitEdit();
        if (selectedCell.c < maxC) {
          setSelectedCell(prev => ({ ...prev, c: prev.c + 1 }));
        }
        gridContainerRef.current?.focus();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEditing(false);
        gridContainerRef.current?.focus();
      }
      return;
    }

    // Navigation when NOT editing (instant response, 0ms lag)
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, r: Math.max(0, prev.r - 1) }));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, r: Math.min(maxR, prev.r + 1) }));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, c: Math.max(0, prev.c - 1) }));
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, c: Math.min(maxC, prev.c + 1) }));
    } else if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      startEditing();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setSelectedCell(prev => ({ ...prev, c: Math.min(maxC, prev.c + 1) }));
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      commitEdit('');
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      startEditing(e.key);
    }
  }, [isEditing, gridData, selectedCell, commitEdit, startEditing]);

  const addRow = () => {
    if (isEditing) commitEdit();
    setGridData(prev => {
      const colCount = prev[0]?.length || 10;
      return [...prev, Array(colCount).fill('')];
    });
  };

  const addColumn = () => {
    if (isEditing) commitEdit();
    setGridData(prev => prev.map(row => [...row, '']));
  };

  const deleteCurrentRow = () => {
    if (gridData.length <= 1) return;
    if (isEditing) setIsEditing(false);
    setGridData(prev => prev.filter((_, i) => i !== selectedCell.r));
    setSelectedCell(prev => ({ ...prev, r: Math.max(0, prev.r - 1) }));
  };

  const handleAddSheet = () => {
    const newName = `Sheet${sheetNames.length + 1}`;
    if (!workbook) return;
    const ws = XLSX.utils.aoa_to_sheet([['']]);
    workbook.SheetNames.push(newName);
    workbook.Sheets[newName] = ws;
    setSheetNames([...workbook.SheetNames]);
    handleSheetSwitch(newName);
  };

  // ── Save to Backend ──
  const handleSave = async () => {
    if (!workbook) return;
    if (isEditing) commitEdit();

    try {
      setSaving(true);
      setError('');
      saveCurrentSheetToWorkbook();

      const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const formData = new FormData();
      formData.append('file', blob, file.originalName);

      await axios.put(`${API_URL}/uploads/${file._id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Save failed:', err);
      setError(err.response?.data?.message || 'Failed to save spreadsheet.');
    } finally {
      setSaving(false);
    }
  };

  // ── Download File ──
  const handleDownload = () => {
    if (!workbook) return;
    if (isEditing) commitEdit();
    saveCurrentSheetToWorkbook();
    XLSX.writeFile(workbook, file.originalName || 'spreadsheet.xlsx');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-xs opacity-60 gap-3">
        <VscLoading className="w-6 h-6 animate-spin text-blue-500" />
        <span>Loading spreadsheet...</span>
      </div>
    );
  }

  const colCount = gridData[0]?.length || 0;
  const currentCellCoord = `${colToLetter(selectedCell.c)}${selectedCell.r + 1}`;
  const currentCellValue = gridData[selectedCell.r]?.[selectedCell.c] || '';

  // ── Calculate Visible Window for Instant 60fps Rendering ──
  const totalRows = gridData.length;
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleRows = gridData.slice(startRow, endRow);

  const spacerTopHeight = startRow * ROW_HEIGHT;
  const spacerBottomHeight = (totalRows - endRow) * ROW_HEIGHT;

  // Floating active cell coordinates
  const activeCellTop = HEADER_HEIGHT + selectedCell.r * ROW_HEIGHT;
  const activeCellLeft = ROW_HEADER_WIDTH + selectedCell.c * COL_WIDTH;

  return (
    <div 
      className="flex flex-col w-full h-full overflow-hidden select-none outline-none"
      style={{ backgroundColor: ui.editorBg, color: ui.sidebarFg }}
    >
      {/* Top Toolbar */}
      <div 
        className="flex items-center justify-between px-3 py-1.5 border-b text-xs shrink-0"
        style={{ borderColor: ui.border, backgroundColor: ui.sidebarBg }}
      >
        <div className="flex items-center space-x-2">
          <VscTable className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-white truncate max-w-[200px]">
            {file.originalName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">
            XLSX
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1.5">
          <button
            onClick={addRow}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] transition-colors cursor-pointer"
            title="Add Row to Bottom"
          >
            <VscAdd className="w-3 h-3" />
            <span>Row</span>
          </button>
          <button
            onClick={addColumn}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] transition-colors cursor-pointer"
            title="Add Column to Right"
          >
            <VscAdd className="w-3 h-3" />
            <span>Col</span>
          </button>
          <button
            onClick={deleteCurrentRow}
            className="flex items-center space-x-1 px-2 py-1 rounded bg-white/5 hover:bg-red-500/20 hover:text-red-300 text-[11px] transition-colors cursor-pointer"
            title={`Delete Row ${selectedCell.r + 1}`}
          >
            <VscTrash className="w-3 h-3" />
            <span>Delete Row</span>
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-white/5 hover:bg-white/10 text-[11px] transition-colors cursor-pointer"
            title="Download Local Copy"
          >
            <VscCloudDownload className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-1.5 px-3 py-1 rounded font-medium text-[11px] text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer disabled:opacity-50"
            title="Save changes to Codespace"
          >
            {saving ? (
              <>
                <VscLoading className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveSuccess ? (
              <>
                <VscCheck className="w-3.5 h-3.5 text-green-300" />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <VscSave className="w-3.5 h-3.5" />
                <span>Save</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Formula Bar (Decoupled from table rendering) */}
      <div 
        className="flex items-center px-3 py-1 border-b text-xs shrink-0 font-mono"
        style={{ borderColor: ui.border, backgroundColor: ui.editorBg }}
      >
        <div 
          className="w-14 text-center py-0.5 px-1 bg-black/30 border rounded text-[11px] font-bold text-blue-400 mr-2 shrink-0"
          style={{ borderColor: ui.border }}
        >
          {currentCellCoord}
        </div>
        <span className="text-gray-500 mr-2 font-serif italic text-xs select-none">fx</span>
        <input
          ref={formulaInputRef}
          key={`${selectedCell.r}-${selectedCell.c}`}
          type="text"
          defaultValue={currentCellValue}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitEdit(e.currentTarget.value);
              gridContainerRef.current?.focus();
            }
          }}
          onBlur={(e) => commitEdit(e.currentTarget.value)}
          placeholder="Enter text or formula..."
          className="flex-1 bg-transparent border-0 outline-none text-white text-xs px-1 font-sans"
        />
      </div>

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-400 text-xs px-3 py-1">
          {error}
        </div>
      )}

      {/* Virtualized Spreadsheet Canvas with Floating Selection */}
      <div 
        ref={gridContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        className="flex-1 overflow-auto relative font-sans outline-none"
      >
        <div className="relative" style={{ width: `${ROW_HEADER_WIDTH + colCount * COL_WIDTH}px` }}>
          
          {/* ── Floating Active Cell Border (Moves in 0ms without re-rendering rows) ── */}
          <div
            className="absolute pointer-events-none z-20 transition-none"
            style={{
              top: `${activeCellTop}px`,
              left: `${activeCellLeft}px`,
              width: `${COL_WIDTH}px`,
              height: `${ROW_HEIGHT}px`,
              border: `2px solid ${ui.activeBorder}`,
              backgroundColor: `${ui.activeBorder}20`,
            }}
          />

          {/* ── In-place Floating Cell Editor (Mounts ONLY during edit mode) ── */}
          {isEditing && (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={() => commitEdit()}
              className="absolute z-30 px-1.5 text-[12px] font-sans text-white outline-none shadow-lg"
              style={{
                top: `${activeCellTop}px`,
                left: `${activeCellLeft}px`,
                width: `${COL_WIDTH}px`,
                height: `${ROW_HEIGHT}px`,
                backgroundColor: ui.editorBg,
                border: `2px solid ${ui.activeBorder}`,
              }}
            />
          )}

          <table className="border-collapse table-fixed w-full text-[12px]">
            {/* Sticky Header Row */}
            <thead 
              className="sticky top-0 z-30" 
              style={{ height: `${HEADER_HEIGHT}px`, backgroundColor: ui.sidebarBg }}
            >
              <tr>
                <th 
                  className="border text-center text-[10px] font-normal opacity-50 select-none sticky left-0 z-40"
                  style={{
                    width: `${ROW_HEADER_WIDTH}px`,
                    minWidth: `${ROW_HEADER_WIDTH}px`,
                    height: `${HEADER_HEIGHT}px`,
                    borderColor: ui.border,
                    backgroundColor: ui.sidebarBg,
                  }}
                />
                {Array.from({ length: colCount }).map((_, c) => (
                  <th
                    key={c}
                    className="border text-center text-[11px] font-medium select-none"
                    style={{
                      width: `${COL_WIDTH}px`,
                      minWidth: `${COL_WIDTH}px`,
                      height: `${HEADER_HEIGHT}px`,
                      borderColor: ui.border,
                      backgroundColor: ui.sidebarBg,
                      color: selectedCell.c === c ? '#ffffff' : ui.sidebarFg,
                    }}
                  >
                    {colToLetter(c)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Virtual Top Spacer */}
              {spacerTopHeight > 0 && (
                <tr style={{ height: `${spacerTopHeight}px` }}>
                  <td colSpan={colCount + 1} />
                </tr>
              )}

              {/* Only Render Rows in Current Viewport Window */}
              {visibleRows.map((row, idx) => {
                const r = startRow + idx;
                return (
                  <GridRow
                    key={r}
                    r={r}
                    row={row}
                    colCount={colCount}
                    ui={ui}
                    onCellClick={handleCellClick}
                    onCellDoubleClick={handleCellDoubleClick}
                  />
                );
              })}

              {/* Virtual Bottom Spacer */}
              {spacerBottomHeight > 0 && (
                <tr style={{ height: `${spacerBottomHeight}px` }}>
                  <td colSpan={colCount + 1} />
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Sheet Switcher Bar */}
      <div 
        className="flex items-center px-2 py-1 border-t text-xs shrink-0 select-none overflow-x-auto space-x-1"
        style={{ borderColor: ui.border, backgroundColor: ui.sidebarBg }}
      >
        <div className="flex items-center space-x-1">
          {sheetNames.map((sName) => {
            const isActive = sName === activeSheet;
            return (
              <button
                key={sName}
                onClick={() => handleSheetSwitch(sName)}
                className="px-3 py-1 rounded text-xs transition-colors cursor-pointer"
                style={{
                  backgroundColor: isActive ? ui.editorBg : 'transparent',
                  color: isActive ? '#ffffff' : ui.sidebarFg,
                  borderBottom: isActive ? `2px solid ${ui.activeBorder}` : '2px solid transparent',
                }}
              >
                {sName}
              </button>
            );
          })}
          <button
            onClick={handleAddSheet}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Add New Sheet"
          >
            <VscAdd className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
