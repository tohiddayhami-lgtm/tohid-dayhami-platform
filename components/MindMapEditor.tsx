
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CompanyProcess, ProcessNode, ProcessNodeFile, MindMapLayout } from '../types';
import { Personnel } from '../types';
import { uploadFile } from '../services/firebaseService';
import { IconPlus, IconTrash, IconLayout, IconCheck, IconFolder, IconZoomIn, IconZoomOut, IconFitScreen } from './Icons';

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
const V_STEP = 130;
const H_GAP_TOP = 28;

const BRANCH_COLORS = [
  '#2563EB', '#059669', '#D97706', '#7C3AED',
  '#DC2626', '#0891B2', '#EA580C', '#DB2777',
];

// ─── Right-tree layout ────────────────────────────────────────────────────────

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
  nodeId: string, depth: number, top: number,
  nodeMap: Map<string, ProcessNode>, positions: Record<string, { x: number; y: number }>
): void {
  const node = nodeMap.get(nodeId);
  if (!node) return;
  const visible = node.isCollapsed ? [] : node.childIds.filter(id => nodeMap.has(id));
  if (visible.length === 0) { positions[nodeId] = { x: depth * H_STEP, y: top }; return; }
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

// ─── Top-down layout ──────────────────────────────────────────────────────────

function getSubtreeWidth(nodeId: string, nodeMap: Map<string, ProcessNode>): number {
  const node = nodeMap.get(nodeId);
  if (!node) return NODE_W;
  if (node.isCollapsed || node.childIds.length === 0) return NODE_W;
  const visible = node.childIds.filter(id => nodeMap.has(id));
  if (visible.length === 0) return NODE_W;
  let total = 0;
  visible.forEach((id, i) => { total += getSubtreeWidth(id, nodeMap) + (i > 0 ? H_GAP_TOP : 0); });
  return Math.max(NODE_W, total);
}

function assignPositionsTopDown(
  nodeId: string, depth: number, left: number,
  nodeMap: Map<string, ProcessNode>, positions: Record<string, { x: number; y: number }>
): void {
  const node = nodeMap.get(nodeId);
  if (!node) return;
  const visible = node.isCollapsed ? [] : node.childIds.filter(id => nodeMap.has(id));
  const subtreeW = getSubtreeWidth(nodeId, nodeMap);
  positions[nodeId] = { x: left + (subtreeW - NODE_W) / 2, y: depth * V_STEP };
  if (visible.length === 0) return;
  let childLeft = left;
  for (const childId of visible) {
    const w = getSubtreeWidth(childId, nodeMap);
    assignPositionsTopDown(childId, depth + 1, childLeft, nodeMap, positions);
    childLeft += w + H_GAP_TOP;
  }
}

function computePositionsTopDown(rootId: string, nodes: ProcessNode[]): Record<string, { x: number; y: number }> {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const positions: Record<string, { x: number; y: number }> = {};
  assignPositionsTopDown(rootId, 0, 0, nodeMap, positions);
  return positions;
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

function getBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`;
}

function getBezierPathVertical(x1: number, y1: number, x2: number, y2: number): string {
  const midY = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Layout labels ─────────────────────────────────────────────────────────────

const LAYOUT_OPTIONS: { value: MindMapLayout; label: string }[] = [
  { value: 'tree-right', label: 'درخت →' },
  { value: 'tree-top', label: 'سازمانی ↓' },
  { value: 'flowchart', label: 'فلوچارت ↓' },
];

// ─── Component ─────────────────────────────────────────────────────────────────

export const MindMapEditor: React.FC<Props> = ({ process, currentUser, onSave, onBack }) => {
  const [nodes, setNodes] = useState<ProcessNode[]>(process.nodes);
  const [layoutType, setLayoutType] = useState<MindMapLayout>(process.layoutType ?? 'tree-right');
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
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inlineInputRef = useRef<HTMLInputElement>(null);

  const isVertical = layoutType !== 'tree-right';

  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const positions = useMemo(
    () => isVertical
      ? computePositionsTopDown(process.rootNodeId, nodes)
      : computePositions(process.rootNodeId, nodes),
    [nodes, process.rootNodeId, isVertical]
  );
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

  useEffect(() => {
    const t = setTimeout(() => fitToScreen(), 120);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fit when layout changes
  useEffect(() => {
    const t = setTimeout(() => fitToScreen(), 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutType]);

  const triggerSave = useCallback((updatedNodes: ProcessNode[], lt?: MindMapLayout) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsSaving(true);
    saveTimerRef.current = setTimeout(() => {
      onSave({
        ...process,
        nodes: updatedNodes,
        layoutType: lt ?? layoutType,
        lastUpdated: new Date().toISOString(),
        updatedBy: currentUser.fullName,
      });
      setIsSaving(false);
    }, 700);
  }, [process, currentUser, onSave, layoutType]);

  const handleLayoutChange = (lt: MindMapLayout) => {
    setLayoutType(lt);
    setShowLayoutMenu(false);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setIsSaving(true);
    onSave({
      ...process,
      nodes,
      layoutType: lt,
      lastUpdated: new Date().toISOString(),
      updatedBy: currentUser.fullName,
    });
    setIsSaving(false);
  };

  const handleJsonExport = () => {
    const exportData = {
      title: process.title,
      description: process.description,
      layoutType,
      rootNodeId: process.rootNodeId,
      nodes: nodes.map(n => ({
        id: n.id,
        label: n.label,
        parentId: n.parentId,
        childIds: n.childIds,
        notes: n.notes,
        color: n.color,
        isCollapsed: n.isCollapsed,
      })),
    };
    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${process.title.replace(/[/\\?%*:|"<>]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
      id: newId, label: 'دسته‌بندی جدید', parentId, childIds: [],
      notes: '', files: [], color, isCollapsed: false,
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
    setTimeout(() => { setInlineEditing(newId); setInlineText('دسته‌بندی جدید'); }, 50);
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
        id: `file-${Date.now()}`, name: file.name, url, type: file.type, size: file.size,
      };
      updateNode(selectedId, { files: [...(nodeMap.get(selectedId)?.files ?? []), newFile] });
    } catch {
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
    setShowLayoutMenu(false);
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: panStart.px + (e.clientX - panStart.mx), y: panStart.py + (e.clientY - panStart.my) });
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
      let d: string;
      if (isVertical) {
        d = getBezierPathVertical(p.x + NODE_W / 2, p.y + NODE_H, c.x + NODE_W / 2, c.y);
      } else {
        d = getBezierPath(p.x + NODE_W, p.y + NODE_H / 2, c.x, c.y + NODE_H / 2);
      }
      const color = node.color || '#6B7280';
      paths.push(
        <path key={`conn-${node.id}`} d={d} stroke={color} strokeWidth="2"
          strokeOpacity="0.6" fill="none" strokeLinecap="round" />
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
          style={{ position: 'absolute', left: pos.x, top: pos.y, width: NODE_W, height: NODE_H, zIndex: isSelected ? 10 : 5 }}
        >
          {/* Main node */}
          <div
            className="flex items-center gap-1.5 rounded-lg cursor-pointer select-none transition-all duration-100"
            style={{
              width: NODE_W, height: NODE_H, backgroundColor: bgColor,
              boxShadow: isSelected ? `0 0 0 3px white, 0 0 0 5px ${bgColor}` : '0 2px 6px rgba(0,0,0,0.18)',
              paddingLeft: 10,
              paddingRight: (!isVertical && hasChildren) ? 28 : 10,
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
              <span className="text-white text-xs font-medium truncate flex-1"
                style={{ direction: 'rtl', textAlign: 'right' }}>
                {node.label}
              </span>
            )}
            {node.notes && !isInlineEdit && (
              <span className="text-white/60 shrink-0" title="دارای یادداشت">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
              </span>
            )}
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
              style={isVertical ? {
                width: 18, height: 18,
                left: (NODE_W - 18) / 2,
                bottom: -9,
                borderColor: bgColor, color: bgColor, zIndex: 20,
              } : {
                width: 18, height: 18,
                top: (NODE_H - 18) / 2,
                right: -9,
                borderColor: bgColor, color: bgColor, zIndex: 20,
              }}
            >
              {node.isCollapsed ? '+' : '−'}
            </button>
          )}

          {/* Add child button */}
          {!node.isCollapsed && (
            <button
              data-node="true"
              onClick={e => { e.stopPropagation(); addChildNode(node.id); }}
              className="absolute flex items-center justify-center rounded-full bg-gray-900 text-white opacity-0 hover:opacity-100 transition-opacity"
              style={isVertical ? {
                width: 20, height: 20,
                left: (NODE_W - 20) / 2,
                bottom: hasChildren ? -28 : -10,
                zIndex: 20,
              } : {
                width: 20, height: 20,
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
    <div className="w-60 shrink-0 bg-white border-s border-gray-100 flex flex-col overflow-hidden" dir="rtl">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-medium text-gray-800 text-xs truncate flex-1 leading-relaxed">{selectedNode.label}</h3>
        <button
          onClick={() => setSelectedId(null)}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors shrink-0 mr-1"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">عنوان</label>
          <input
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-gray-300 focus:bg-white text-right transition-colors"
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            onBlur={() => { if (editLabel !== selectedNode.label) updateNode(selectedNode.id, { label: editLabel }); }}
            onKeyDown={e => { if (e.key === 'Enter') updateNode(selectedNode.id, { label: editLabel }); }}
          />
        </div>

        {selectedNode.parentId !== null && (
          <div>
            <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2 block">رنگ</label>
            <div className="flex flex-wrap gap-2">
              {BRANCH_COLORS.map(c => (
                <button key={c} onClick={() => updateNode(selectedNode.id, { color: c })}
                  className="w-5 h-5 rounded-full transition-all hover:scale-110"
                  style={{ backgroundColor: c, boxShadow: selectedNode.color === c ? `0 0 0 2px white, 0 0 0 3.5px ${c}` : 'none' }} />
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">یادداشت</label>
          <textarea
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-100 rounded-xl focus:outline-none focus:border-gray-300 focus:bg-white resize-none text-right transition-colors"
            rows={3}
            value={editNotes}
            onChange={e => setEditNotes(e.target.value)}
            onBlur={() => { if (editNotes !== selectedNode.notes) updateNode(selectedNode.id, { notes: editNotes }); }}
            placeholder="یادداشت..."
          />
        </div>

        <div>
          <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5 block">
            فایل‌ها {selectedNode.files.length > 0 && <span className="normal-case font-normal">({selectedNode.files.length})</span>}
          </label>
          {selectedNode.files.length > 0 && (
            <div className="space-y-1 mb-2">
              {selectedNode.files.map(f => (
                <div key={f.id} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  <span className="flex-1 truncate text-xs text-gray-700">{f.name}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{formatBytes(f.size)}</span>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-600 shrink-0 text-xs">↗</a>
                  <button
                    onClick={() => updateNode(selectedNode.id, { files: selectedNode.files.filter(x => x.id !== f.id) })}
                    className="text-gray-300 hover:text-red-500 shrink-0 transition-colors"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {uploading ? (
            <div className="space-y-1">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <p className="text-[11px] text-gray-400">آپلود... {Math.round(uploadProgress)}%</p>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-200 rounded-xl text-xs text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
            >
              <IconFolder className="w-3.5 h-3.5" /> افزودن فایل
            </button>
          )}
          <input ref={fileInputRef} type="file" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = ''; }} />
        </div>

        <button onClick={() => addChildNode(selectedNode.id)}
          className="w-full flex items-center justify-center gap-2 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-medium transition-colors">
          <IconPlus className="w-3.5 h-3.5" /> افزودن زیرشاخه
        </button>

        {selectedNode.parentId !== null && (
          showDeleteConfirm ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
              <p className="text-xs text-red-600 text-center">
                {selectedNode.childIds.length > 0 ? 'این شاخه و زیرشاخه‌هایش حذف می‌شوند.' : 'این شاخه حذف می‌شود.'}
              </p>
              <div className="flex gap-1.5">
                <button onClick={() => deleteNodeRecursive(selectedNode.id)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-1.5 rounded-lg text-xs font-medium transition-colors">
                  حذف
                </button>
                <button onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 bg-white border border-gray-200 text-gray-600 py-1.5 rounded-lg text-xs hover:bg-gray-50 transition-colors">
                  انصراف
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-full flex items-center justify-center gap-2 py-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl text-xs transition-colors">
              <IconTrash className="w-3.5 h-3.5" /> حذف شاخه
            </button>
          )
        )}
      </div>
    </div>
  );

  const posVals = Object.values(positions) as { x: number; y: number }[];
  const canvasW = posVals.length ? Math.max(...posVals.map(p => p.x)) + NODE_W + 200 : 1200;
  const canvasH = posVals.length ? Math.max(...posVals.map(p => p.y)) + NODE_H + 200 : 800;
  const currentLayoutLabel = LAYOUT_OPTIONS.find(l => l.value === layoutType)?.label ?? 'چیدمان';

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-100 shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-all font-medium shrink-0"
          dir="rtl"
        >
          ← بازگشت
        </button>
        <div className="w-px h-4 bg-gray-200 shrink-0" />
        <h2 className="font-semibold text-gray-900 text-sm flex-1 truncate" dir="rtl">{process.title}</h2>

        {/* Layout toggle */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowLayoutMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors"
            title="تغییر چیدمان"
            dir="rtl"
          >
            <IconLayout className="w-3.5 h-3.5" />
            <span>{currentLayoutLabel}</span>
          </button>
          {showLayoutMenu && (
            <div className="absolute top-full mt-1 right-0 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-50 min-w-[140px]" dir="rtl">
              {LAYOUT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleLayoutChange(opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${layoutType === opt.value ? 'text-indigo-600 font-medium' : 'text-gray-700'}`}
                >
                  <span>{opt.label}</span>
                  {layoutType === opt.value && <IconCheck className="w-3 h-3" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* JSON Export */}
        <button
          onClick={handleJsonExport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium transition-colors shrink-0"
          title="خروجی JSON"
          dir="rtl"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          JSON
        </button>

        {/* Zoom pill */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 shrink-0">
          <button onClick={() => setScale(s => Math.max(0.25, s * 0.83))}
            className="p-1.5 rounded-md hover:bg-white text-gray-500 hover:text-gray-800 transition-all" title="کوچک‌نمایی">
            <IconZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-gray-500 w-10 text-center tabular-nums select-none">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s * 1.2))}
            className="p-1.5 rounded-md hover:bg-white text-gray-500 hover:text-gray-800 transition-all" title="بزرگ‌نمایی">
            <IconZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-3.5 bg-gray-300 mx-0.5" />
          <button onClick={fitToScreen}
            className="p-1.5 rounded-md hover:bg-white text-gray-500 hover:text-gray-800 transition-all" title="تنظیم به صفحه">
            <IconFitScreen className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => { const root = nodes.find(n => n.parentId === null); if (root) addChildNode(root.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-medium transition-colors"
          >
            <IconPlus className="w-3.5 h-3.5" /> افزودن شاخه
          </button>
          <div className={`text-[11px] px-2 py-1 rounded-lg transition-all ${isSaving ? 'text-gray-400 bg-gray-50' : 'text-green-600 bg-green-50'}`}>
            {isSaving ? 'ذخیره...' : '✓ ذخیره شد'}
          </div>
        </div>
      </div>

      {/* Canvas + Edit Panel */}
      <div className="flex flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-[#FAFAFA]"
          style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.5 }}>
            <defs>
              <pattern id="grid-dot" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.8" fill="#D1D5DB" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-dot)" />
          </svg>

          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              position: 'absolute',
              width: canvasW,
              height: canvasH,
            }}
          >
            <svg width={canvasW} height={canvasH}
              className="absolute inset-0 pointer-events-none overflow-visible">
              {renderConnections()}
            </svg>
            {renderNodes()}
          </div>
        </div>

        {editPanel}
      </div>
    </div>
  );
};
