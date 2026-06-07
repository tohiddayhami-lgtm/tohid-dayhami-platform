
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CompanyProcess, ProcessNode, ProcessNodeFile } from '../types';
import { Personnel } from '../types';
import { uploadFile } from '../services/firebaseService';
import { IconPlus, IconTrash, IconEdit, IconCheck, IconFolder, IconPaperclip2, IconNote, IconZoomIn, IconZoomOut, IconFitScreen } from './Icons';

interface Props {
  process: CompanyProcess;
  currentUser: Personnel;
  onSave: (process: CompanyProcess) => void;
  onBack: () => void;
}

const NODE_W = 164;
const NODE_H = 44;
const H_STEP = 280;
const V_GAP = 18;

const BRANCH_COLORS = [
  '#2563EB', '#059669', '#D97706', '#7C3AED',
  '#DC2626', '#0891B2', '#EA580C', '#DB2777',
];

function getSubtreeHeight(nodeId: string, nodeMap: Map<string, ProcessNode>): number {
  const node = nodeMap.get(nodeId);
  if (!node) return NODE_H;
  if (node.isCollapsed || node.childIds.length === 0) return NODE_H;
  const visible = node.childIds.filter(id => nodeMap.has(id));
  if (visible.length === 0) return NODE_H;
  let total = 0;
  visible.forEach((id, i) => { total += getSubtreeHeight(id, nodeMap) + (i > 0 ? V_GAP : 0); });
  return Math.max(NODE_H, total);
}

function assignPositions(
  nodeId: string,
  depth: number,
  top: number,
  nodeMap: Map<string, ProcessNode>,
  positions: Record<string, { x: number; y: number }>
): void {
  const node = nodeMap.get(nodeId);
  if (!node) return;
  const visible = node.isCollapsed ? [] : node.childIds.filter(id => nodeMap.has(id));

  if (visible.length === 0) {
    positions[nodeId] = { x: depth * H_STEP, y: top };
    return;
  }

  let childTop = top;
  for (const childId of visible) {
    const h = getSubtreeHeight(childId, nodeMap);
    assignPositions(childId, depth + 1, childTop, nodeMap, positions);
    childTop += h + V_GAP;
  }

  const firstY = positions[visible[0]]?.y ?? top;
  const lastY = positions[visible[visible.length - 1]]?.y ?? top;
  positions[nodeId] = { x: depth * H_STEP, y: (firstY + lastY) / 2 };
}

function computePositions(rootId: string, nodes: ProcessNode[]): Record<string, { x: number; y: number }> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const positions: Record<string, { x: number; y: number }> = {};
  assignPositions(rootId, 0, 0, nodeMap, positions);
  return positions;
}

function getBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const MindMapEditor: React.FC<Props> = ({ process, currentUser, onSave, onBack }) => {
  const [nodes, setNodes] = useState<ProcessNode[]>(process.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0.85);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ mx: 0, my: 0, px: 0, py: 0 });
  const [editLabel, setEditLabel] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [inlineEditing, setInlineEditing] = useState<string | null>(null);
  const [inlineText, setInlineText] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const positions = useMemo(() => computePositions(process.rootNodeId, nodes), [nodes, process.rootNodeId]);
  const selectedNode = selectedId ? nodeMap.get(selectedId) ?? null : null;

  useEffect(() => {
    if (selectedNode) {
      setEditLabel(selectedNode.label);
      setEditNotes(selectedNode.notes);
      setShowDeleteConfirm(false);
    }
  }, [selectedId]);

  useEffect(() => {
    if (inlineEditing && inlineInputRef.current) {
      inlineInputRef.current.focus();
      inlineInputRef.current.select();
    }
  }, [inlineEditing]);

  // Auto-fit on first render so the map is centered in the viewport
  useEffect(() => {
    const t = setTimeout(() => fitToScreen(), 120);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const triggerSave = useCallback((updatedNodes: ProcessNode[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsSaving(true);
    saveTimerRef.current = setTimeout(() => {
      onSave({
        ...process,
        nodes: updatedNodes,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.fullName,
      });
      setIsSaving(false);
    }, 700);
  }, [process, currentUser, onSave]);

  const updateNode = useCallback((id: string, updates: Partial<ProcessNode>) => {
    setNodes(prev => {
      const next = prev.map(n => n.id === id ? { ...n, ...updates } : n);
      triggerSave(next);
      return next;
    });
  }, [triggerSave]);

  const getNextBranchColor = (existingNodes: ProcessNode[], parentId: string): string => {
    const siblings = existingNodes.filter(n => n.parentId === parentId);
    return BRANCH_COLORS[siblings.length % BRANCH_COLORS.length];
  };

  const addChildNode = useCallback((parentId: string) => {
    const parent = nodeMap.get(parentId);
    if (!parent) return;
    const newId = `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isRootChild = parent.parentId === null;
    const color = isRootChild
      ? getNextBranchColor(nodes, parentId)
      : (parent.color || BRANCH_COLORS[0]);

    const newNode: ProcessNode = {
      id: newId,
      label: 'دسته‌بندی جدید',
      parentId,
      childIds: [],
      notes: '',
      files: [],
      color,
      isCollapsed: false,
    };

    setNodes(prev => {
      const next = [
        ...prev.map(n => n.id === parentId ? { ...n, childIds: [...n.childIds, newId] } : n),
        newNode,
      ];
      triggerSave(next);
      return next;
    });
    setSelectedId(newId);
    // Start inline editing for new node
    setTimeout(() => {
      setInlineEditing(newId);
      setInlineText('دسته‌بندی جدید');
    }, 50);
  }, [nodeMap, nodes, triggerSave]);

  const deleteNodeRecursive = useCallback((id: string) => {
    const toDelete = new Set<string>();
    const queue = [id];
    while (queue.length > 0) {
      const curr = queue.pop()!;
      toDelete.add(curr);
      nodeMap.get(curr)?.childIds.forEach(c => queue.push(c));
    }
    const node = nodeMap.get(id);
    setNodes(prev => {
      const next = prev
        .filter(n => !toDelete.has(n.id))
        .map(n => n.id === node?.parentId
          ? { ...n, childIds: n.childIds.filter(c => !toDelete.has(c)) }
          : n);
      triggerSave(next);
      return next;
    });
    setSelectedId(null);
    setShowDeleteConfirm(false);
  }, [nodeMap, triggerSave]);

  const handleFileUpload = useCallback(async (file: File) => {
    if (!selectedId) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const { url } = await uploadFile(file, 'documents', (p) => setUploadProgress(p));
      const newFile: ProcessNodeFile = {
        id: `file-${Date.now()}`,
        name: file.name,
        url,
        type: file.type,
        size: file.size,
      };
      updateNode(selectedId, {
        files: [...(nodeMap.get(selectedId)?.files ?? []), newFile],
      });
    } catch (e) {
      alert('خطا در آپلود فایل. لطفاً دوباره تلاش کنید.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, [selectedId, nodeMap, updateNode]);

  const fitToScreen = useCallback(() => {
    if (!containerRef.current) return;
    const vals = Object.values(positions) as { x: number; y: number }[];
    if (vals.length === 0) return;
    const cW = containerRef.current.clientWidth;
    const cH = containerRef.current.clientHeight;
    const minX = Math.min(...vals.map(p => p.x));
    const minY = Math.min(...vals.map(p => p.y));
    const maxX = Math.max(...vals.map(p => p.x)) + NODE_W;
    const maxY = Math.max(...vals.map(p => p.y)) + NODE_H;
    const contentW = maxX - minX + 160;
    const contentH = maxY - minY + 120;
    const newScale = Math.min(cW / contentW, cH / contentH, 1.4);
    const newPanX = (cW - contentW * newScale) / 2 - minX * newScale + 80 * newScale;
    const newPanY = (cH - contentH * newScale) / 2 - minY * newScale + 60 * newScale;
    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [positions]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1.12 : 0.88;
    const newScale = Math.max(0.25, Math.min(2.5, scale * delta));
    const rect = containerRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    setPan(prev => ({
      x: mx - (mx - prev.x) * (newScale / scale),
      y: my - (my - prev.y) * (newScale / scale),
    }));
    setScale(newScale);
  }, [scale]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node]')) return;
    setIsPanning(true);
    setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
    setSelectedId(null);
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({
      x: panStart.px + (e.clientX - panStart.mx),
      y: panStart.py + (e.clientY - panStart.my),
    });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => setIsPanning(false), []);

  const finishInlineEdit = useCallback((nodeId: string) => {
    const trimmed = inlineText.trim() || 'بدون عنوان';
    updateNode(nodeId, { label: trimmed });
    if (selectedId === nodeId) setEditLabel(trimmed);
    setInlineEditing(null);
  }, [inlineText, updateNode, selectedId]);

  const renderConnections = () => {
    const paths: React.ReactNode[] = [];
    nodes.forEach(node => {
      if (!node.parentId) return;
      const p = positions[node.parentId];
      const c = positions[node.id];
      if (!p || !c) return;
      const x1 = p.x + NODE_W;
      const y1 = p.y + NODE_H / 2;
      const x2 = c.x;
      const y2 = c.y + NODE_H / 2;
      const color = node.color || '#6B7280';
      paths.push(
        <path
          key={`conn-${node.id}`}
          d={getBezierPath(x1, y1, x2, y2)}
          stroke={color}
          strokeWidth="2"
          strokeOpacity="0.6"
          fill="none"
          strokeLinecap="round"
        />
      );
    });
    return paths;
  };

  const renderNodes = () => {
    return nodes.map(node => {
      const pos = positions[node.id];
      if (!pos) return null;
      const isRoot = node.parentId === null;
      const isSelected = selectedId === node.id;
      const hasChildren = node.childIds.length > 0;
      const bgColor = isRoot ? '#111827' : node.color || '#3B82F6';
      const isInlineEdit = inlineEditing === node.id;

      return (
        <div
          key={node.id}
          data-node="true"
          style={{
            position: 'absolute',
            left: pos.x,
            top: pos.y,
            width: NODE_W,
            height: NODE_H,
            zIndex: isSelected ? 10 : 5,
          }}
        >
          {/* Main node box */}
          <div
            className="flex items-center gap-1.5 rounded-lg cursor-pointer select-none transition-all duration-100"
            style={{
              width: NODE_W,
              height: NODE_H,
              backgroundColor: bgColor,
              boxShadow: isSelected
                ? `0 0 0 3px white, 0 0 0 5px ${bgColor}`
                : '0 2px 6px rgba(0,0,0,0.18)',
              paddingLeft: 10,
              paddingRight: hasChildren ? 28 : 10,
            }}
            onClick={() => { if (!isInlineEdit) setSelectedId(node.id); }}
            onDoubleClick={() => {
              setSelectedId(node.id);
              setInlineEditing(node.id);
              setInlineText(node.label);
            }}
          >
            {isInlineEdit ? (
              <input
                ref={inlineInputRef}
                value={inlineText}
                onChange={e => setInlineText(e.target.value)}
                onBlur={() => finishInlineEdit(node.id)}
                onKeyDown={e => {
                  if (e.key === 'Enter') finishInlineEdit(node.id);
                  if (e.key === 'Escape') setInlineEditing(null);
                }}
                className="w-full bg-transparent text-white text-xs font-medium outline-none placeholder-white/50"
                style={{ minWidth: 0 }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="text-white text-xs font-medium truncate flex-1"
                style={{ direction: 'rtl', textAlign: 'right' }}
              >
                {node.label}
              </span>
            )}

            {/* Note indicator */}
            {node.notes && !isInlineEdit && (
              <span className="text-white/60 shrink-0" title="دارای یادداشت">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              </span>
            )}
            {/* File indicator */}
            {node.files.length > 0 && !isInlineEdit && (
              <span className="text-white/60 shrink-0 text-[9px] font-bold" title={`${node.files.length} فایل`}>
                {node.files.length}📎
              </span>
            )}
          </div>

          {/* Collapse/expand button */}
          {hasChildren && (
            <button
              data-node="true"
              onClick={e => { e.stopPropagation(); updateNode(node.id, { isCollapsed: !node.isCollapsed }); }}
              className="absolute flex items-center justify-center rounded-full bg-white border-2 text-[10px] font-bold transition-colors hover:bg-gray-100"
              style={{
                width: 18,
                height: 18,
                top: (NODE_H - 18) / 2,
                right: -9,
                borderColor: bgColor,
                color: bgColor,
                zIndex: 20,
              }}
            >
              {node.isCollapsed ? '+' : '−'}
            </button>
          )}

          {/* Add child button (shown on hover when not root-collapsed) */}
          {!node.isCollapsed && (
            <button
              data-node="true"
              onClick={e => { e.stopPropagation(); addChildNode(node.id); }}
              className="absolute flex items-center justify-center rounded-full bg-gray-900 text-white opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
              style={{
                width: 20,
                height: 20,
                top: (NODE_H - 20) / 2,
                right: hasChildren ? -28 : -10,
                zIndex: 20,
              }}
              title="افزودن زیرشاخه"
            >
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            </button>
          )}
        </div>
      );
    });
  };

  const editPanel = selectedNode && (
    <div className="w-72 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-hidden" dir="rtl">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 text-sm truncate flex-1">{selectedNode.label}</h3>
        <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-700 mr-2 text-lg leading-none">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Label */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">عنوان</label>
          <input
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 text-right"
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            onBlur={() => { if (editLabel !== selectedNode.label) updateNode(selectedNode.id, { label: editLabel }); }}
            onKeyDown={e => { if (e.key === 'Enter') updateNode(selectedNode.id, { label: editLabel }); }}
          />
        </div>

        {/* Color (only for non-root) */}
        {selectedNode.parentId !== null && (
          <div>
            <label className="text-xs font-medium text-gray-500 mb-2 block">رنگ</label>
            <div className="flex flex-wrap gap-2">
              {BRANCH_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => updateNode(selectedNode.id, { color: c })}
                  className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: selectedNode.color === c ? '#111' : 'transparent' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-1 block">یادداشت</label>
          <textarea
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 resize-none text-right"
            rows={3}
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            onBlur={() => { if (editNotes !== selectedNode.notes) updateNode(selectedNode.id, { notes: editNotes }); }}
            placeholder="یادداشت یا توضیح..."
          />
        </div>

        {/* Files */}
        <div>
          <label className="text-xs font-medium text-gray-500 mb-2 block">فایل‌ها ({selectedNode.files.length})</label>
          {selectedNode.files.length > 0 && (
            <div className="space-y-1 mb-2">
              {selectedNode.files.map(f => (
                <div key={f.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 text-xs">
                  <span className="flex-1 truncate text-gray-700">{f.name}</span>
                  <span className="text-gray-400 shrink-0">{formatBytes(f.size)}</span>
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                     className="text-blue-500 hover:text-blue-700 shrink-0">↗</a>
                  <button
                    onClick={() => updateNode(selectedNode.id, { files: selectedNode.files.filter(x => x.id !== f.id) })}
                    className="text-red-400 hover:text-red-600 shrink-0"
                  >&times;</button>
                </div>
              ))}
            </div>
          )}

          {uploading ? (
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              <p className="text-xs text-gray-500 mt-1">در حال آپلود... {Math.round(uploadProgress)}%</p>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 border-2 border-dashed border-gray-300 rounded-lg text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              <IconFolder className="w-4 h-4" /> افزودن فایل
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }}
          />
        </div>

        {/* Add child */}
        <button
          onClick={() => addChildNode(selectedNode.id)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-black transition-colors"
        >
          <IconPlus className="w-4 h-4" /> افزودن زیرشاخه
        </button>

        {/* Delete */}
        {selectedNode.parentId !== null && (
          <div>
            {showDeleteConfirm ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center space-y-2">
                <p className="text-xs text-red-700 font-medium">
                  {selectedNode.childIds.length > 0 ? 'این شاخه و تمام زیرشاخه‌هایش حذف می‌شوند.' : 'این شاخه حذف می‌شود.'}
                </p>
                <div className="flex gap-2">
                  <button onClick={() => deleteNodeRecursive(selectedNode.id)}
                    className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-xs font-medium hover:bg-red-700">حذف</button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 bg-white border border-gray-200 text-gray-600 py-1.5 rounded-lg text-xs hover:bg-gray-50">انصراف</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center justify-center gap-2 py-2 border border-red-200 text-red-500 rounded-lg text-sm hover:bg-red-50 transition-colors"
              >
                <IconTrash className="w-4 h-4" /> حذف شاخه
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // Calculate canvas bounds for SVG
  const posVals = Object.values(positions) as { x: number; y: number }[];
  const canvasW = posVals.length ? Math.max(...posVals.map(p => p.x)) + NODE_W + 200 : 1200;
  const canvasH = posVals.length ? Math.max(...posVals.map(p => p.y)) + NODE_H + 200 : 800;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span className="text-lg leading-none">→</span> بازگشت
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <h2 className="font-semibold text-gray-900 text-sm flex-1" dir="rtl">{process.title}</h2>

        {/* Toolbar */}
        <div className="flex items-center gap-1">
          <button onClick={() => setScale(s => Math.min(2.5, s * 1.2))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="بزرگ‌نمایی">
            <IconZoomIn className="w-4 h-4" />
          </button>
          <button onClick={() => setScale(s => Math.max(0.25, s * 0.83))}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="کوچک‌نمایی">
            <IconZoomOut className="w-4 h-4" />
          </button>
          <button onClick={fitToScreen}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors" title="تنظیم به صفحه">
            <IconFitScreen className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400 px-1 w-12 text-center">{Math.round(scale * 100)}%</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { const root = nodes.find(n => n.parentId === null); if (root) addChildNode(root.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-black transition-colors"
          >
            <IconPlus className="w-3.5 h-3.5" /> افزودن دسته
          </button>
          {isSaving && <span className="text-xs text-gray-400">در حال ذخیره...</span>}
          {!isSaving && <span className="text-xs text-green-600 font-medium">✓ ذخیره شد</span>}
        </div>
      </div>

      {/* Canvas + Edit Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-gray-50"
          style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Grid dots background */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.4 }}>
            <defs>
              <pattern id="grid-dot" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#D1D5DB" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-dot)" />
          </svg>

          {/* Transform container */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              position: 'absolute',
              width: canvasW,
              height: canvasH,
            }}
          >
            {/* SVG connections */}
            <svg
              width={canvasW}
              height={canvasH}
              className="absolute inset-0 pointer-events-none overflow-visible"
            >
              {renderConnections()}
            </svg>

            {/* Nodes */}
            {renderNodes()}
          </div>
        </div>

        {/* Edit Panel */}
        {editPanel}
      </div>
    </div>
  );
};
