
import React, { useState, useRef } from 'react';
import { CompanyProcess, Personnel, ProcessNode, MindMapLayout } from '../types';
import { MindMapEditor } from './MindMapEditor';
import { IconPlus, IconTrash, IconShield, IconUsers, IconCheck, IconMindMap } from './Icons';

interface Props {
  processes: CompanyProcess[];
  personnel: Personnel[];
  currentUser: Personnel;
  onSave: (process: CompanyProcess) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  lang: 'fa' | 'en';
}

function canAccess(process: CompanyProcess, user: Personnel): boolean {
  if (user.username === 'master') return true;
  if (process.accessType === 'all') return true;
  return process.accessibleTo.includes(user.id);
}

const IconX = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
);
const IconDownload = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
);
const IconUpload = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
);

// ─── Template builder helpers ────────────────────────────────────────────────

function n(id: string, label: string, parentId: string | null, childIds: string[], color: string): ProcessNode {
  return { id, label, parentId, childIds, notes: '', files: [], color, isCollapsed: false };
}

function buildBlank(title: string, rootId: string): ProcessNode[] {
  return [n(rootId, title, null, [], '#111827')];
}

function buildMindMap(title: string, rootId: string): ProcessNode[] {
  const ts = Date.now();
  const b = (i: number) => `b${i}_${ts}`;
  const s = (i: number, j: number) => `b${i}s${j}_${ts}`;
  const COLORS = ['#2563EB', '#059669', '#D97706', '#7C3AED'];
  const LABELS = ['شاخه اول', 'شاخه دوم', 'شاخه سوم', 'شاخه چهارم'];
  const nodes: ProcessNode[] = [n(rootId, title, null, [b(0), b(1), b(2), b(3)], '#111827')];
  LABELS.forEach((label, i) => {
    nodes.push(n(b(i), label, rootId, [s(i, 0), s(i, 1)], COLORS[i]));
    nodes.push(n(s(i, 0), `زیرشاخه ${i + 1}.۱`, b(i), [], COLORS[i]));
    nodes.push(n(s(i, 1), `زیرشاخه ${i + 1}.۲`, b(i), [], COLORS[i]));
  });
  return nodes;
}

function buildOrgChart(title: string, rootId: string): ProcessNode[] {
  const ts = Date.now();
  const id = (k: string) => `${k}_${ts}`;
  const m1 = id('m1'); const m2 = id('m2'); const m3 = id('m3');
  const e1 = id('e1'); const e2 = id('e2'); const e3 = id('e3');
  const e4 = id('e4'); const e5 = id('e5'); const e6 = id('e6');
  return [
    n(rootId,  title,         null,   [m1, m2, m3], '#111827'),
    n(m1, 'مدیر فروش',       rootId, [e1, e2],     '#2563EB'),
    n(m2, 'مدیر فناوری',     rootId, [e3, e4],     '#059669'),
    n(m3, 'مدیر مالی',       rootId, [e5, e6],     '#7C3AED'),
    n(e1, 'کارشناس فروش ۱',  m1,     [],           '#2563EB'),
    n(e2, 'کارشناس فروش ۲',  m1,     [],           '#2563EB'),
    n(e3, 'توسعه‌دهنده',     m2,     [],           '#059669'),
    n(e4, 'طراح UX',         m2,     [],           '#059669'),
    n(e5, 'حسابدار',          m3,     [],           '#7C3AED'),
    n(e6, 'کنترلر مالی',     m3,     [],           '#7C3AED'),
  ];
}

function buildFlowchart(title: string, rootId: string): ProcessNode[] {
  const ts = Date.now();
  const id = (k: string) => `${k}_${ts}`;
  const s1 = id('s1'); const s2 = id('s2'); const s3 = id('s3');
  const s4a = id('s4a'); const s4b = id('s4b'); const s5 = id('s5');
  return [
    n(rootId, title,            null,  [s1],        '#111827'),
    n(s1, 'تعریف نیاز',        rootId,[s2],        '#2563EB'),
    n(s2, 'بررسی و تحلیل',     s1,    [s3],        '#059669'),
    n(s3, 'تصمیم‌گیری',       s2,    [s4a, s4b],  '#D97706'),
    n(s4a,'مسیر الف',          s3,    [s5],        '#059669'),
    n(s4b,'مسیر ب',            s3,    [s5],        '#DC2626'),
    n(s5, 'پایان',             s4a,   [],           '#111827'),
  ];
}

function buildSWOT(title: string, rootId: string): ProcessNode[] {
  const ts = Date.now();
  const id = (k: string) => `${k}_${ts}`;
  const sw = id('sw'); const wk = id('wk'); const op = id('op'); const th = id('th');
  const si = (branch: string, i: number) => id(`${branch}${i}`);
  return [
    n(rootId, title,              null,   [sw, wk, op, th], '#111827'),
    n(sw, 'نقاط قوت (S)',        rootId, [si('sw',1), si('sw',2)], '#059669'),
    n(si('sw',1), 'نقطه قوت ۱', sw,     [], '#059669'),
    n(si('sw',2), 'نقطه قوت ۲', sw,     [], '#059669'),
    n(wk, 'نقاط ضعف (W)',        rootId, [si('wk',1), si('wk',2)], '#DC2626'),
    n(si('wk',1), 'نقطه ضعف ۱', wk,     [], '#DC2626'),
    n(si('wk',2), 'نقطه ضعف ۲', wk,     [], '#DC2626'),
    n(op, 'فرصت‌ها (O)',         rootId, [si('op',1), si('op',2)], '#2563EB'),
    n(si('op',1), 'فرصت ۱',     op,     [], '#2563EB'),
    n(si('op',2), 'فرصت ۲',     op,     [], '#2563EB'),
    n(th, 'تهدیدها (T)',          rootId, [si('th',1), si('th',2)], '#D97706'),
    n(si('th',1), 'تهدید ۱',     th,     [], '#D97706'),
    n(si('th',2), 'تهدید ۲',     th,     [], '#D97706'),
  ];
}

function buildProject(title: string, rootId: string): ProcessNode[] {
  const ts = Date.now();
  const id = (k: string) => `${k}_${ts}`;
  const p1 = id('p1'); const p2 = id('p2'); const p3 = id('p3');
  return [
    n(rootId, title,               null, [p1, p2, p3], '#111827'),
    n(p1, 'فاز ۱: برنامه‌ریزی',  rootId, [id('p1a'), id('p1b')], '#2563EB'),
    n(id('p1a'), 'تعریف محدوده',  p1,    [], '#2563EB'),
    n(id('p1b'), 'زمان‌بندی',     p1,    [], '#2563EB'),
    n(p2, 'فاز ۲: اجرا',          rootId, [id('p2a'), id('p2b')], '#059669'),
    n(id('p2a'), 'توسعه',         p2,    [], '#059669'),
    n(id('p2b'), 'تست',           p2,    [], '#059669'),
    n(p3, 'فاز ۳: تحویل',         rootId, [id('p3a'), id('p3b')], '#D97706'),
    n(id('p3a'), 'استقرار',       p3,    [], '#D97706'),
    n(id('p3b'), 'آموزش',         p3,    [], '#D97706'),
  ];
}

// ─── Template registry ───────────────────────────────────────────────────────

interface TemplateConfig {
  id: string;
  name: string;
  desc: string;
  layout: MindMapLayout;
  accent: string;
  preview: React.ReactNode;
  build: (title: string, rootId: string) => ProcessNode[];
}

const TEMPLATES: TemplateConfig[] = [
  {
    id: 'blank', name: 'خالی', desc: 'شروع از صفر', layout: 'tree-right', accent: 'bg-gray-100 text-gray-500',
    preview: (
      <svg viewBox="0 0 80 50" className="w-full h-full">
        <rect x="25" y="20" width="30" height="12" rx="3" fill="#E5E7EB"/>
      </svg>
    ),
    build: buildBlank,
  },
  {
    id: 'mindmap', name: 'مایند مپ', desc: '۴ شاخه اصلی', layout: 'tree-right', accent: 'bg-blue-50 text-blue-600',
    preview: (
      <svg viewBox="0 0 80 50" className="w-full h-full">
        <rect x="28" y="19" width="24" height="12" rx="3" fill="#1E3A5F"/>
        {[['#2563EB',10,8],['#059669',10,20],['#D97706',10,32],['#7C3AED',10,44]].map(([c,x,y],i)=>(
          <g key={i}>
            <path d={`M52 25 C60 25 60 ${y} ${x as number} ${y as number}`} stroke={c as string} strokeWidth="1.5" fill="none" opacity="0.7"/>
            <rect x={0} y={(y as number)-4} width="18" height="8" rx="2" fill={c as string} opacity="0.8"/>
          </g>
        ))}
      </svg>
    ),
    build: buildMindMap,
  },
  {
    id: 'orgchart', name: 'چارت سازمانی', desc: 'ساختار سلسله‌مراتبی', layout: 'tree-top', accent: 'bg-green-50 text-green-600',
    preview: (
      <svg viewBox="0 0 80 50" className="w-full h-full">
        <rect x="28" y="3" width="24" height="10" rx="2" fill="#111827"/>
        {[14,40,66].map((x,i)=>(
          <g key={i}>
            <line x1="40" y1="13" x2={x} y2="22" stroke="#9CA3AF" strokeWidth="1.2"/>
            <rect x={x-10} y="22" width="20" height="8" rx="2" fill="#059669" opacity="0.8"/>
            <line x1={x} y1="30" x2={x-6} y2="38" stroke="#9CA3AF" strokeWidth="1"/>
            <line x1={x} y1="30" x2={x+6} y2="38" stroke="#9CA3AF" strokeWidth="1"/>
            <rect x={x-12} y="38" width="10" height="6" rx="1" fill="#34D399" opacity="0.7"/>
            <rect x={x+2} y="38" width="10" height="6" rx="1" fill="#34D399" opacity="0.7"/>
          </g>
        ))}
      </svg>
    ),
    build: buildOrgChart,
  },
  {
    id: 'flowchart', name: 'فلوچارت', desc: 'جریان فرآیند', layout: 'flowchart', accent: 'bg-orange-50 text-orange-600',
    preview: (
      <svg viewBox="0 0 80 50" className="w-full h-full">
        {[3,14,25,36].map((y,i)=>(
          <g key={i}>
            <rect x="22" y={y} width="36" height="9" rx={i===2?4:2} fill={i===2?'#D97706':'#374151'} opacity={0.8-i*0.05}/>
            {i<3 && <line x1="40" y1={y+9} x2="40" y2={y+14} stroke="#9CA3AF" strokeWidth="1.2" markerEnd="url(#arr)"/>}
          </g>
        ))}
        <rect x="12" y="36" width="20" height="9" rx="2" fill="#059669" opacity="0.8"/>
        <rect x="48" y="36" width="20" height="9" rx="2" fill="#DC2626" opacity="0.8"/>
      </svg>
    ),
    build: buildFlowchart,
  },
  {
    id: 'swot', name: 'تحلیل SWOT', desc: 'نقاط قوت / ضعف / فرصت / تهدید', layout: 'tree-right', accent: 'bg-purple-50 text-purple-600',
    preview: (
      <svg viewBox="0 0 80 50" className="w-full h-full">
        <rect x="28" y="19" width="24" height="12" rx="3" fill="#111827"/>
        {[['#059669',8,8,'S'],['#DC2626',8,22,'W'],['#2563EB',8,36,'O'],['#D97706',8,50,'T']].map(([c,x,y,l],i)=>(
          <g key={i}>
            <path d={`M52 25 C60 25 60 ${y} 26 ${y}`} stroke={c as string} strokeWidth="1.3" fill="none" opacity="0.7"/>
            <rect x={0} y={(y as number)-5} width="26" height="10" rx="2" fill={c as string} opacity="0.8"/>
            <text x={13} y={(y as number)+3} textAnchor="middle" fill="white" fontSize="6" fontWeight="bold">{l}</text>
          </g>
        ))}
      </svg>
    ),
    build: buildSWOT,
  },
  {
    id: 'project', name: 'برنامه پروژه', desc: 'فازهای پروژه', layout: 'tree-right', accent: 'bg-indigo-50 text-indigo-600',
    preview: (
      <svg viewBox="0 0 80 50" className="w-full h-full">
        <rect x="28" y="19" width="24" height="12" rx="3" fill="#111827"/>
        {[['#2563EB',8,10,'فاز ۱'],['#059669',8,25,'فاز ۲'],['#D97706',8,40,'فاز ۳']].map(([c,x,y,l],i)=>(
          <g key={i}>
            <path d={`M52 25 C60 25 60 ${y} 28 ${y}`} stroke={c as string} strokeWidth="1.3" fill="none" opacity="0.7"/>
            <rect x={0} y={(y as number)-5} width="28" height="10" rx="2" fill={c as string} opacity="0.8"/>
            <text x={14} y={(y as number)+3} textAnchor="middle" fill="white" fontSize="5.5" fontWeight="bold">{l}</text>
          </g>
        ))}
      </svg>
    ),
    build: buildProject,
  },
];

// ─── Sample JSON for AI ──────────────────────────────────────────────────────

const SAMPLE_JSON = {
  title: "برنامه‌ریزی کسب‌وکار",
  description: "پرامپت پیشنهادی برای هوش مصنوعی: یک مایند مپ JSON با همین ساختار برای موضوع [موضوع مورد نظر] بساز. رنگ‌های مجاز: #2563EB (آبی), #059669 (سبز), #D97706 (نارنجی), #7C3AED (بنفش), #DC2626 (قرمز), #0891B2 (آبی‌روشن). layoutType می‌تواند tree-right یا tree-top یا flowchart باشد.",
  layoutType: "tree-right",
  rootNodeId: "root",
  nodes: [
    { id: "root", label: "کسب‌وکار من", parentId: null, childIds: ["market", "product", "finance", "team"], notes: "", color: "#111827", isCollapsed: false },
    { id: "market", label: "بازار", parentId: "root", childIds: ["m1", "m2", "m3"], notes: "", color: "#2563EB", isCollapsed: false },
    { id: "m1", label: "مشتریان هدف", parentId: "market", childIds: [], notes: "", color: "#2563EB", isCollapsed: false },
    { id: "m2", label: "رقبا", parentId: "market", childIds: [], notes: "", color: "#2563EB", isCollapsed: false },
    { id: "m3", label: "سهم بازار", parentId: "market", childIds: [], notes: "", color: "#2563EB", isCollapsed: false },
    { id: "product", label: "محصول", parentId: "root", childIds: ["p1", "p2"], notes: "", color: "#059669", isCollapsed: false },
    { id: "p1", label: "ویژگی‌های کلیدی", parentId: "product", childIds: [], notes: "", color: "#059669", isCollapsed: false },
    { id: "p2", label: "مزیت رقابتی", parentId: "product", childIds: [], notes: "", color: "#059669", isCollapsed: false },
    { id: "finance", label: "مالی", parentId: "root", childIds: ["f1", "f2"], notes: "", color: "#D97706", isCollapsed: false },
    { id: "f1", label: "درآمد", parentId: "finance", childIds: [], notes: "", color: "#D97706", isCollapsed: false },
    { id: "f2", label: "هزینه‌ها", parentId: "finance", childIds: [], notes: "", color: "#D97706", isCollapsed: false },
    { id: "team", label: "تیم", parentId: "root", childIds: ["t1", "t2"], notes: "", color: "#7C3AED", isCollapsed: false },
    { id: "t1", label: "نقش‌ها", parentId: "team", childIds: [], notes: "", color: "#7C3AED", isCollapsed: false },
    { id: "t2", label: "مهارت‌های مورد نیاز", parentId: "team", childIds: [], notes: "", color: "#7C3AED", isCollapsed: false },
  ],
};

// ─── Component ───────────────────────────────────────────────────────────────

export const ProcessManager: React.FC<Props> = ({
  processes, personnel, currentUser, onSave, onDelete, lang,
}) => {
  const isMaster = currentUser.username === 'master';
  const [openProcessId, setOpenProcessId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateConfig>(TEMPLATES[1]);

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newAccessType, setNewAccessType] = useState<'all' | 'specific'>('all');
  const [newAccessIds, setNewAccessIds] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [importError, setImportError] = useState('');

  const [accessType, setAccessType] = useState<'all' | 'specific'>('all');
  const [accessIds, setAccessIds] = useState<string[]>([]);

  const jsonImportRef = useRef<HTMLInputElement>(null);

  const visibleProcesses = processes.filter(p => canAccess(p, currentUser));
  const activePersonnel = personnel.filter(p => p.status === 'active' && p.username !== 'master');
  const openProcess = visibleProcesses.find(p => p.id === openProcessId);

  // ── Create ──────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsSaving(true);
    const rootId = `root-${Date.now()}`;
    let accessibleTo = newAccessType === 'specific' ? newAccessIds : [];
    if (!isMaster && newAccessType === 'specific' && !accessibleTo.includes(currentUser.id))
      accessibleTo = [currentUser.id, ...accessibleTo];

    const newProcess: CompanyProcess = {
      id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: newTitle.trim(),
      description: newDesc.trim(),
      createdAt: new Date().toISOString(),
      createdBy: currentUser.fullName,
      accessType: newAccessType,
      accessibleTo,
      layoutType: selectedTemplate.layout,
      nodes: selectedTemplate.build(newTitle.trim(), rootId),
      rootNodeId: rootId,
    };
    await onSave(newProcess);
    closeCreate();
    setIsSaving(false);
    setOpenProcessId(newProcess.id);
  };

  const closeCreate = () => {
    setShowCreateModal(false);
    setNewTitle('');
    setNewDesc('');
    setNewAccessType('all');
    setNewAccessIds([]);
  };

  // ── Access ──────────────────────────────────────────────────────────────────
  const handleSaveAccess = async () => {
    if (!showAccessModal) return;
    const proc = processes.find(p => p.id === showAccessModal);
    if (!proc) return;
    setIsSaving(true);
    await onSave({ ...proc, accessType, accessibleTo: accessType === 'specific' ? accessIds : [] });
    setShowAccessModal(null);
    setIsSaving(false);
  };

  const openAccessModal = (proc: CompanyProcess) => {
    setAccessType(proc.accessType);
    setAccessIds(proc.accessibleTo);
    setShowAccessModal(proc.id);
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    await onDelete(id);
    setShowDeleteConfirm(null);
    if (openProcessId === id) setOpenProcessId(null);
  };

  const toggleId = (id: string, arr: string[], setArr: (v: string[]) => void) =>
    setArr(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  // ── JSON Import ─────────────────────────────────────────────────────────────
  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Support both full CompanyProcess JSON and simplified AI format
      const rawNodes: any[] = data.nodes ?? [];
      if (!Array.isArray(rawNodes) || rawNodes.length === 0)
        throw new Error('فایل JSON باید آرایه‌ای از nodes داشته باشد');

      // Normalise nodes — handle both full format and simplified { id, label, parent }
      const nodes: ProcessNode[] = rawNodes.map((nd: any) => ({
        id: nd.id ?? `n${Math.random().toString(36).slice(2, 7)}`,
        label: nd.label ?? nd.name ?? 'بدون عنوان',
        parentId: nd.parentId ?? nd.parent ?? null,
        childIds: nd.childIds ?? [],
        notes: nd.notes ?? '',
        files: nd.files ?? [],
        color: nd.color ?? '#374151',
        isCollapsed: nd.isCollapsed ?? false,
      }));

      // Rebuild childIds from parentId if missing (simplified format)
      const hasChildIds = rawNodes.some((nd: any) => Array.isArray(nd.childIds) && nd.childIds.length > 0);
      if (!hasChildIds) {
        const childMap: Record<string, string[]> = {};
        nodes.forEach(nd => {
          if (nd.parentId) {
            childMap[nd.parentId] = childMap[nd.parentId] ?? [];
            childMap[nd.parentId].push(nd.id);
          }
        });
        nodes.forEach(nd => { nd.childIds = childMap[nd.id] ?? []; });
      }

      const rootId = data.rootNodeId ?? nodes.find(nd => !nd.parentId)?.id ?? nodes[0].id;
      const title = data.title ?? file.name.replace(/\.json$/i, '');

      let accessibleTo: string[] = [];
      if (!isMaster) accessibleTo = [currentUser.id];

      const proc: CompanyProcess = {
        id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        description: data.description ?? '',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.fullName,
        accessType: isMaster ? 'all' : 'specific',
        accessibleTo,
        layoutType: (data.layoutType as MindMapLayout) ?? 'tree-right',
        nodes,
        rootNodeId: rootId,
      };
      await onSave(proc);
      setOpenProcessId(proc.id);
    } catch (err: any) {
      setImportError(err.message ?? 'فایل JSON نامعتبر است');
    }
    e.target.value = '';
  };

  // ── Sample JSON Download ────────────────────────────────────────────────────
  const downloadSample = () => {
    const json = JSON.stringify(SAMPLE_JSON, null, 2);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_mindmap.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Layout label ─────────────────────────────────────────────────────────────
  const layoutLabel = (lt?: MindMapLayout) => {
    if (lt === 'tree-top') return 'سازمانی ↓';
    if (lt === 'flowchart') return 'فلوچارت ↓';
    return 'درخت →';
  };

  // ── Open editor ──────────────────────────────────────────────────────────────
  if (openProcess) {
    return (
      <div className="fixed inset-0 z-[90] bg-white flex flex-col">
        <MindMapEditor
          process={openProcess}
          currentUser={currentUser}
          onSave={async (updated) => { await onSave(updated); }}
          onBack={() => setOpenProcessId(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in p-6" dir="rtl">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white px-5 py-4 rounded-2xl border border-gray-100 shadow-sm gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-xl">
            <IconMindMap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">مایند مپ</h2>
            <p className="text-xs text-gray-400 mt-0.5">{visibleProcesses.length} مایند مپ</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Import JSON */}
          <button
            onClick={() => { setImportError(''); jsonImportRef.current?.click(); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-xl transition-colors"
          >
            <IconUpload className="w-3.5 h-3.5" /> ایمپورت JSON
          </button>
          <input ref={jsonImportRef} type="file" accept=".json" className="hidden" onChange={handleJsonImport} />

          {/* Sample JSON */}
          <button
            onClick={downloadSample}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-xs font-medium rounded-xl transition-colors"
            title="دانلود نمونه JSON برای هوش مصنوعی"
          >
            <IconDownload className="w-3.5 h-3.5" /> نمونه JSON
          </button>

          {/* New */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-medium transition-colors"
          >
            <IconPlus className="w-4 h-4" /> مایند مپ جدید
          </button>
        </div>
      </div>

      {/* Import error */}
      {importError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <span>⚠ {importError}</span>
          <button onClick={() => setImportError('')} className="text-red-400 hover:text-red-600"><IconX className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* AI hint */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex items-start gap-3 text-xs text-indigo-700">
        <span className="text-base shrink-0">💡</span>
        <span>فایل «نمونه JSON» را دانلود کنید، به هوش مصنوعی بدهید و بخواهید مایند مپ مورد نظرتان را با همان ساختار بسازد. سپس فایل خروجی را ایمپورت کنید.</span>
      </div>

      {/* ── Grid ───────────────────────────────────────────────────────────── */}
      {visibleProcesses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-24 flex flex-col items-center gap-3">
          <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center">
            <IconMindMap className="w-7 h-7 text-gray-300" />
          </div>
          <p className="text-sm text-gray-400">هنوز مایند مپی ایجاد نشده.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-1 flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-black transition-colors"
          >
            <IconPlus className="w-4 h-4" /> مایند مپ جدید
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleProcesses.map(proc => {
            const nodeCount = proc.nodes.length - 1;
            const isOwner = proc.createdBy === currentUser.fullName;
            const updatedDate = new Date(proc.lastUpdated ?? proc.createdAt)
              .toLocaleDateString('fa-IR', { month: 'short', day: 'numeric' });

            return (
              <div
                key={proc.id}
                onClick={() => setOpenProcessId(proc.id)}
                className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-gray-200 hover:shadow-sm transition-all group cursor-pointer relative"
              >
                <div
                  className="absolute top-3 left-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  {isMaster && (
                    <button onClick={() => openAccessModal(proc)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="دسترسی">
                      <IconShield className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(isMaster || isOwner) && (
                    <button onClick={() => setShowDeleteConfirm(proc.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors" title="حذف">
                      <IconTrash className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="w-10 h-10 bg-gray-50 group-hover:bg-indigo-50 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <IconMindMap className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                </div>

                <h3 className="font-semibold text-gray-900 text-sm mb-1 text-right leading-snug">{proc.title}</h3>
                {proc.description && (
                  <p className="text-xs text-gray-400 line-clamp-2 text-right mb-4">{proc.description}</p>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-50 text-[11px] text-gray-400">
                  <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-mono">{layoutLabel(proc.layoutType)}</span>
                  <div className="flex items-center gap-2">
                    <span>{nodeCount} شاخه</span>
                    <span className="text-gray-200">·</span>
                    <span>{updatedDate}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ────────────────────────────────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in" dir="rtl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm">مایند مپ جدید</h3>
              <button onClick={closeCreate} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <IconX className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Template grid */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-3">قالب</label>
                <div className="grid grid-cols-3 gap-2">
                  {TEMPLATES.map(tmpl => (
                    <button
                      key={tmpl.id}
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-center transition-all ${
                        selectedTemplate.id === tmpl.id
                          ? 'border-gray-900 bg-gray-50'
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      {selectedTemplate.id === tmpl.id && (
                        <div className="absolute top-1.5 left-1.5 w-4 h-4 bg-gray-900 rounded-full flex items-center justify-center">
                          <IconCheck className="w-2.5 h-2.5 text-white" />
                        </div>
                      )}
                      <div className="w-full h-12 flex items-center justify-center">
                        {tmpl.preview}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{tmpl.name}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">{tmpl.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">عنوان *</label>
                <input
                  autoFocus
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 focus:bg-white text-right transition-colors"
                  placeholder="مثال: برنامه‌ریزی فروش، ساختار تیم..."
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && newTitle.trim() && handleCreate()}
                />
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">توضیح <span className="font-normal text-gray-400">(اختیاری)</span></label>
                <textarea
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 focus:bg-white resize-none text-right transition-colors"
                  rows={2}
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                />
              </div>

              {/* Access */}
              <div>
                <label className="text-xs font-semibold text-gray-600 block mb-2">سطح دسترسی</label>
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  {[{ v: 'all' as const, l: 'همه کارکنان' }, { v: 'specific' as const, l: 'افراد انتخابی' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setNewAccessType(v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${newAccessType === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {newAccessType === 'specific' && (
                <div className="max-h-36 overflow-y-auto space-y-0.5 border border-gray-100 rounded-xl bg-gray-50 p-2">
                  {activePersonnel.map(p => (
                    <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors">
                      <div
                        className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 ${newAccessIds.includes(p.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300 bg-white'}`}
                        onClick={() => toggleId(p.id, newAccessIds, setNewAccessIds)}
                      >
                        {newAccessIds.includes(p.id) && <IconCheck className="w-2.5 h-2.5 text-white" />}
                      </div>
                      <span className="text-sm text-gray-700 flex-1">{p.fullName}</span>
                      <span className="text-xs text-gray-400">{p.roles[0]}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || isSaving}
                className="flex-1 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              >
                {isSaving ? 'در حال ایجاد...' : `ایجاد با قالب «${selectedTemplate.name}»`}
              </button>
              <button onClick={closeCreate} className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Access Modal ─────────────────────────────────────────────────────── */}
      {showAccessModal && (() => {
        const proc = processes.find(p => p.id === showAccessModal);
        if (!proc) return null;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" dir="rtl">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">تنظیم دسترسی</h3>
                  <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{proc.title}</p>
                </div>
                <button onClick={() => setShowAccessModal(null)} className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                  <IconX className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
                  {[{ v: 'all' as const, l: 'همه کارکنان' }, { v: 'specific' as const, l: 'افراد انتخابی' }].map(({ v, l }) => (
                    <button key={v} onClick={() => setAccessType(v)}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${accessType === v ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                      {l}
                    </button>
                  ))}
                </div>
                {accessType === 'specific' && (
                  <div className="max-h-52 overflow-y-auto space-y-0.5 border border-gray-100 rounded-xl bg-gray-50 p-2">
                    {activePersonnel.map(p => (
                      <label key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white cursor-pointer transition-colors">
                        <div
                          className={`w-4 h-4 rounded-md border-2 flex items-center justify-center shrink-0 ${accessIds.includes(p.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300 bg-white'}`}
                          onClick={() => toggleId(p.id, accessIds, setAccessIds)}
                        >
                          {accessIds.includes(p.id) && <IconCheck className="w-2.5 h-2.5 text-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 truncate">{p.fullName}</p>
                          <p className="text-[11px] text-gray-400">{p.roles.join('، ')}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
                <button onClick={handleSaveAccess} disabled={isSaving}
                  className="flex-1 py-2.5 bg-gray-900 hover:bg-black text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors">
                  {isSaving ? 'ذخیره...' : 'ذخیره'}
                </button>
                <button onClick={() => setShowAccessModal(null)}
                  className="px-5 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  انصراف
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      {showDeleteConfirm && (() => {
        const proc = processes.find(p => p.id === showDeleteConfirm);
        if (!proc) return null;
        return (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setShowDeleteConfirm(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" dir="rtl" onClick={e => e.stopPropagation()}>
              <div className="p-6 text-center">
                <div className="w-11 h-11 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <IconTrash className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-2">حذف مایند مپ</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  <span className="font-semibold text-gray-700">«{proc.title}»</span> و تمام داده‌هایش حذف می‌شود.
                </p>
              </div>
              <div className="px-5 pb-5 flex gap-2">
                <button onClick={() => handleDelete(proc.id)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors">
                  حذف
                </button>
                <button onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 transition-colors">
                  انصراف
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
