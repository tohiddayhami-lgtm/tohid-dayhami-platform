import React, { useMemo, useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  AttachedFile, Personnel, TeamBrainstormColor, TeamBrainstormComment, TeamBrainstormPost,
} from '../types';
import { IconPaperclip, IconPlus, IconTrash, IconFile, IconUpload, IconEdit } from './Icons';
import {
  saveTeamBrainstormPost, updateTeamBrainstormPostInCloud, deleteTeamBrainstormPostFromCloud, uploadFileWithProgress,
} from '../services/firebaseService';
import { Language } from '../App';

const PAGE_SIZE = 6;

const COLORS: TeamBrainstormColor[] = ['yellow', 'pink', 'mint', 'sky', 'lavender', 'peach'];

const STICKY: Record<TeamBrainstormColor, { card: string; pin: string; tape: string }> = {
  yellow: { card: 'bg-[#fef08a]', pin: 'bg-red-500', tape: 'bg-yellow-100/80' },
  pink: { card: 'bg-[#fbcfe8]', pin: 'bg-rose-500', tape: 'bg-pink-100/80' },
  mint: { card: 'bg-[#a7f3d0]', pin: 'bg-emerald-600', tape: 'bg-emerald-100/80' },
  sky: { card: 'bg-[#bae6fd]', pin: 'bg-sky-600', tape: 'bg-sky-100/80' },
  lavender: { card: 'bg-[#ddd6fe]', pin: 'bg-violet-600', tape: 'bg-violet-100/80' },
  peach: { card: 'bg-[#fed7aa]', pin: 'bg-orange-600', tape: 'bg-orange-100/80' },
};

const ROTATIONS = ['-rotate-1', 'rotate-1', '-rotate-2', 'rotate-2', '-rotate-1', 'rotate-1'];

function resolveColor(color?: TeamBrainstormColor): TeamBrainstormColor {
  return color && COLORS.includes(color) ? color : 'yellow';
}

interface Props {
  currentUser: Personnel;
  posts: TeamBrainstormPost[];
  lang: Language;
}

export const TeamBrainstormPanel: React.FC<Props> = ({ currentUser, posts, lang }) => {
  const T = lang === 'fa';
  const isMaster = currentUser.username === 'master';

  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [detailPost, setDetailPost] = useState<TeamBrainstormPost | null>(null);
  const [saving, setSaving] = useState(false);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftColor, setDraftColor] = useState<TeamBrainstormColor>('yellow');
  const [draftFiles, setDraftFiles] = useState<AttachedFile[]>([]);

  const [commentText, setCommentText] = useState('');
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [commentFiles, setCommentFiles] = useState<AttachedFile[]>([]);
  const [uploadingComment, setUploadingComment] = useState(false);

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [editCommentFiles, setEditCommentFiles] = useState<AttachedFile[]>([]);
  const [uploadingEditComment, setUploadingEditComment] = useState(false);

  const composeFileRef = useRef<HTMLInputElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const editCommentFileRef = useRef<HTMLInputElement>(null);

  const t = {
    title: T ? 'هم‌فکری تیمی' : 'Team Brainstorm',
    subtitle: T ? 'ایده بدهید، نظر بدهید، با هم پیش برویم' : 'Share ideas, comment, and collaborate',
    newIdea: T ? 'ایده جدید' : 'New idea',
    ideaTitle: T ? 'عنوان' : 'Title',
    ideaBody: T ? 'توضیح یا ایده شما' : 'Your idea or notes',
    color: T ? 'رنگ یادداشت' : 'Note color',
    attach: T ? 'پیوست' : 'Attach',
    publish: T ? 'ثبت یادداشت' : 'Post note',
    cancel: T ? 'انصراف' : 'Cancel',
    likes: T ? 'لایک' : 'Like',
    comments: T ? 'نظر' : 'Comments',
    writeComment: T ? 'نظر یا پاسخ بنویسید…' : 'Write a comment or reply…',
    send: T ? 'ارسال' : 'Send',
    reply: T ? 'پاسخ' : 'Reply',
    delete: T ? 'حذف' : 'Delete',
    edit: T ? 'ویرایش' : 'Edit',
    save: T ? 'ذخیره' : 'Save',
    editPost: T ? 'ویرایش یادداشت' : 'Edit note',
    editComment: T ? 'ویرایش نظر' : 'Edit comment',
    empty: T ? 'هنوز ایده‌ای ثبت نشده. اولین یادداشت را بگذارید!' : 'No ideas yet. Post the first sticky note!',
    prev: T ? 'قبلی' : 'Previous',
    next: T ? 'بعدی' : 'Next',
    page: T ? 'صفحه' : 'Page',
    of: T ? 'از' : 'of',
    close: T ? 'بستن' : 'Close',
    by: T ? 'از' : 'By',
    files: T ? 'پیوست‌ها' : 'Attachments',
  };

  useEffect(() => {
    if (!detailPost) return;
    const fresh = posts.find(p => p.id === detailPost.id);
    if (fresh) setDetailPost(fresh);
    else setDetailPost(null);
  }, [posts, detailPost?.id]);

  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagePosts = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return posts.slice(start, start + PAGE_SIZE);
  }, [posts, safePage]);

  const detailPostId = detailPost?.id ?? null;

  const resetCompose = () => {
    setDraftTitle('');
    setDraftBody('');
    setDraftColor('yellow');
    setDraftFiles([]);
    setComposeOpen(false);
    setEditingPostId(null);
  };

  const closeDetail = () => {
    setDetailPost(null);
    setReplyToId(null);
    setCommentText('');
    setCommentFiles([]);
    setEditingPostId(null);
    cancelCommentEdit();
  };

  const cancelCommentEdit = () => {
    setEditingCommentId(null);
    setEditCommentText('');
    setEditCommentFiles([]);
  };

  const startEditPost = (post: TeamBrainstormPost) => {
    setDraftTitle(post.title);
    setDraftBody(post.body);
    setDraftColor(post.color);
    setDraftFiles(post.files || []);
    setEditingPostId(post.id);
  };

  const savePostEdit = async () => {
    if (!editingPostId || !draftTitle.trim() || saving) return;
    if (draftFiles.some(f => f.status === 'uploading')) return;
    const post = posts.find(p => p.id === editingPostId);
    if (!post || post.authorId !== currentUser.id) return;
    setSaving(true);
    try {
      await updateTeamBrainstormPostInCloud(editingPostId, {
        title: draftTitle.trim(),
        body: draftBody.trim(),
        color: draftColor,
        files: draftFiles.filter(f => f.status === 'success'),
        updatedAt: new Date().toISOString(),
      });
      setEditingPostId(null);
      setDraftTitle('');
      setDraftBody('');
      setDraftColor('yellow');
      setDraftFiles([]);
    } finally {
      setSaving(false);
    }
  };

  const startEditComment = (comment: TeamBrainstormComment) => {
    setEditingCommentId(comment.id);
    setEditCommentText(comment.text);
    setEditCommentFiles(comment.files || []);
    setReplyToId(null);
  };

  const saveCommentEdit = async () => {
    if (!detailPost || !editingCommentId || !editCommentText.trim() || uploadingEditComment) return;
    if (editCommentFiles.some(f => f.status === 'uploading')) return;
    const target = (detailPost.comments || []).find(c => c.id === editingCommentId);
    if (!target || target.authorId !== currentUser.id) return;
    const comments = (detailPost.comments || []).map(c =>
      c.id === editingCommentId
        ? { ...c, text: editCommentText.trim(), files: editCommentFiles.filter(f => f.status === 'success') }
        : c,
    );
    await updateTeamBrainstormPostInCloud(detailPost.id, { comments, updatedAt: new Date().toISOString() });
    cancelCommentEdit();
  };

  const handleEditCommentFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingEditComment(true);
    const pending: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
    setEditCommentFiles(prev => [...prev, pending]);
    uploadFileWithProgress(
      file,
      (progress) => setEditCommentFiles(prev => prev.map(f => f === pending ? { ...f, progress } : f)),
      (url) => { setEditCommentFiles(prev => prev.map(f => f === pending ? { ...f, content: url, status: 'success', progress: 100 } : f)); setUploadingEditComment(false); },
      () => { setEditCommentFiles(prev => prev.filter(f => f !== pending)); setUploadingEditComment(false); },
      'documents',
    );
    e.target.value = '';
  };

  const handleComposeFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const pending: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
    setDraftFiles(prev => [...prev, pending]);
    uploadFileWithProgress(
      file,
      (progress) => setDraftFiles(prev => prev.map(f => f === pending ? { ...f, progress } : f)),
      (url) => setDraftFiles(prev => prev.map(f => f === pending ? { ...f, content: url, status: 'success', progress: 100 } : f)),
      () => setDraftFiles(prev => prev.filter(f => f !== pending)),
      'documents',
    );
    e.target.value = '';
  };

  const handleCommentFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingComment(true);
    const pending: AttachedFile = { name: file.name, size: file.size, type: file.type, content: '', status: 'uploading', progress: 0 };
    setCommentFiles(prev => [...prev, pending]);
    uploadFileWithProgress(
      file,
      (progress) => setCommentFiles(prev => prev.map(f => f === pending ? { ...f, progress } : f)),
      (url) => { setCommentFiles(prev => prev.map(f => f === pending ? { ...f, content: url, status: 'success', progress: 100 } : f)); setUploadingComment(false); },
      () => { setCommentFiles(prev => prev.filter(f => f !== pending)); setUploadingComment(false); },
      'documents',
    );
    e.target.value = '';
  };

  const publishPost = async () => {
    if (!draftTitle.trim() || saving) return;
    if (draftFiles.some(f => f.status === 'uploading')) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const post: TeamBrainstormPost = {
        id: `tb-${Date.now()}`,
        authorId: currentUser.id,
        authorName: currentUser.fullName,
        authorAvatar: currentUser.avatar,
        title: draftTitle.trim(),
        body: draftBody.trim(),
        color: draftColor,
        files: draftFiles.filter(f => f.status === 'success'),
        likedBy: [],
        comments: [],
        createdAt: now,
        updatedAt: now,
      };
      await saveTeamBrainstormPost(post);
      resetCompose();
      setPage(1);
    } finally {
      setSaving(false);
    }
  };

  const togglePostLike = async (post: TeamBrainstormPost) => {
    const likedBy = [...(post.likedBy || [])];
    const idx = likedBy.indexOf(currentUser.id);
    if (idx >= 0) likedBy.splice(idx, 1);
    else likedBy.push(currentUser.id);
    await updateTeamBrainstormPostInCloud(post.id, { likedBy, updatedAt: new Date().toISOString() });
  };

  const toggleCommentLike = async (post: TeamBrainstormPost, commentId: string) => {
    const comments = (post.comments || []).map(c => {
      if (c.id !== commentId) return c;
      const likedBy = [...(c.likedBy || [])];
      const idx = likedBy.indexOf(currentUser.id);
      if (idx >= 0) likedBy.splice(idx, 1);
      else likedBy.push(currentUser.id);
      return { ...c, likedBy };
    });
    await updateTeamBrainstormPostInCloud(post.id, { comments, updatedAt: new Date().toISOString() });
  };

  const submitComment = async () => {
    if (!detailPost || !commentText.trim() || uploadingComment) return;
    if (commentFiles.some(f => f.status === 'uploading')) return;
    const comment: TeamBrainstormComment = {
      id: `tbc-${Date.now()}`,
      authorId: currentUser.id,
      authorName: currentUser.fullName,
      text: commentText.trim(),
      files: commentFiles.filter(f => f.status === 'success'),
      likedBy: [],
      parentId: replyToId || undefined,
      createdAt: new Date().toISOString(),
    };
    const comments = [...(detailPost.comments || []), comment];
    await updateTeamBrainstormPostInCloud(detailPost.id, { comments, updatedAt: new Date().toISOString() });
    setCommentText('');
    setCommentFiles([]);
    setReplyToId(null);
  };

  const removePost = async (post: TeamBrainstormPost) => {
    if (!window.confirm(T ? 'این یادداشت حذف شود؟' : 'Delete this note?')) return;
    await deleteTeamBrainstormPostFromCloud(post.id);
    if (detailPostId === post.id) setDetailPost(null);
  };

  const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n)}…`);

  const renderStickyCard = (post: TeamBrainstormPost, idx: number) => {
    const color = resolveColor(post.color);
    const style = STICKY[color];
    const rot = ROTATIONS[idx % ROTATIONS.length];
    const likeCount = post.likedBy?.length || 0;
    const commentCount = post.comments?.length || 0;
    return (
      <div
        key={post.id || `tb-${idx}`}
        role="button"
        tabIndex={0}
        onClick={() => setDetailPost(post)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailPost(post); } }}
        className={`group relative text-right w-full min-h-[220px] p-5 pt-8 rounded-sm border border-black/10 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer ${style.card} ${rot}`}
      >
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3 rounded-sm ${style.tape} border border-black/5 shadow-sm`} />
        <div className={`absolute top-3 right-4 w-3 h-3 rounded-full ${style.pin} shadow-md ring-2 ring-white/60`} />
        <h4 className="font-bold text-gray-900 text-base leading-snug mb-2 pr-2">{post.title}</h4>
        <p className="text-sm text-gray-800/90 leading-relaxed line-clamp-4 whitespace-pre-wrap">{post.body || '—'}</p>
        {(post.files?.length ?? 0) > 0 && (
          <div className="mt-3 flex items-center gap-1 text-xs text-gray-700/80">
            <IconPaperclip className="w-3.5 h-3.5" /> {post.files!.length} {t.files}
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between text-xs text-gray-700">
          <span>{post.authorName}</span>
          <div className="flex items-center gap-3">
            <span>❤️ {likeCount}</span>
            <span>💬 {commentCount}</span>
          </div>
        </div>
      </div>
    );
  };

  const modalRoot = typeof document !== 'undefined' ? document.body : null;

  const composeModal = composeOpen && modalRoot ? createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4" onClick={resetCompose}>
      <div className={`relative w-full max-w-lg p-6 pt-10 rounded-sm shadow-2xl border border-black/10 ${STICKY[draftColor].card}`} onClick={e => e.stopPropagation()}>
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-4 rounded-sm ${STICKY[draftColor].tape} border border-black/5`} />
        <h3 className="font-bold text-gray-900 mb-4">{t.newIdea}</h3>
        <div className="space-y-3">
          <input className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white/70 text-sm font-bold outline-none focus:ring-2 focus:ring-gray-900/20" placeholder={t.ideaTitle} value={draftTitle} onChange={e => setDraftTitle(e.target.value)} />
          <textarea className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white/70 text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-gray-900/20 resize-y" placeholder={t.ideaBody} value={draftBody} onChange={e => setDraftBody(e.target.value)} />
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">{t.color}</p>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => setDraftColor(c)} className={`w-8 h-8 rounded-full border-2 ${STICKY[c].card} ${draftColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`} />
              ))}
            </div>
          </div>
          <div>
            <input ref={composeFileRef} type="file" className="hidden" onChange={handleComposeFiles} />
            <button type="button" onClick={() => composeFileRef.current?.click()} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 border border-black/10 hover:bg-white">
              <IconUpload className="w-3.5 h-3.5" /> {t.attach}
            </button>
            {draftFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {draftFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-white/60 rounded px-2 py-1">
                    <IconFile className="w-3 h-3" /> {f.name} {f.status === 'uploading' && '…'}
                    <button type="button" onClick={() => setDraftFiles(prev => prev.filter((_, j) => j !== i))} className="text-red-500 mr-auto">×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button type="button" onClick={resetCompose} className="flex-1 py-2 rounded-lg bg-white/80 text-sm font-medium border border-black/10">{t.cancel}</button>
          <button type="button" disabled={saving || !draftTitle.trim()} onClick={publishPost} className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50">{t.publish}</button>
        </div>
      </div>
    </div>,
    modalRoot,
  ) : null;

  const detailColor = detailPost ? resolveColor(editingPostId === detailPost.id ? draftColor : detailPost.color) : 'yellow';

  const detailModal = detailPost && modalRoot ? createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={closeDetail}>
      <div className={`relative w-full max-w-2xl my-6 p-6 pt-10 rounded-sm shadow-2xl border border-black/10 ${STICKY[detailColor].card}`} onClick={e => e.stopPropagation()}>
        <div className={`absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-4 rounded-sm ${STICKY[detailColor].tape} border border-black/5`} />
        {editingPostId === detailPost.id ? (
          <>
            <h3 className="font-bold text-gray-900 mb-4">{t.editPost}</h3>
            <div className="space-y-3">
              <input className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white/70 text-sm font-bold outline-none focus:ring-2 focus:ring-gray-900/20" placeholder={t.ideaTitle} value={draftTitle} onChange={e => setDraftTitle(e.target.value)} />
              <textarea className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white/70 text-sm min-h-[120px] outline-none focus:ring-2 focus:ring-gray-900/20 resize-y" placeholder={t.ideaBody} value={draftBody} onChange={e => setDraftBody(e.target.value)} />
              <div>
                <p className="text-xs font-bold text-gray-700 mb-2">{t.color}</p>
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setDraftColor(c)} className={`w-8 h-8 rounded-full border-2 ${STICKY[c].card} ${draftColor === c ? 'border-gray-900 scale-110' : 'border-transparent'}`} />
                  ))}
                </div>
              </div>
              <div>
                <input ref={composeFileRef} type="file" className="hidden" onChange={handleComposeFiles} />
                <button type="button" onClick={() => composeFileRef.current?.click()} className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/80 border border-black/10 hover:bg-white">
                  <IconUpload className="w-3.5 h-3.5" /> {t.attach}
                </button>
                {draftFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {draftFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-white/60 rounded px-2 py-1">
                        <IconFile className="w-3 h-3" /> {f.name} {f.status === 'uploading' && '…'}
                        <button type="button" onClick={() => setDraftFiles(prev => prev.filter((_, j) => j !== i))} className="text-red-500 mr-auto">×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => { setEditingPostId(null); setDraftTitle(''); setDraftBody(''); setDraftColor('yellow'); setDraftFiles([]); }} className="flex-1 py-2 rounded-lg bg-white/80 text-sm font-medium border border-black/10">{t.cancel}</button>
              <button type="button" disabled={saving || !draftTitle.trim()} onClick={savePostEdit} className="flex-1 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50">{t.save}</button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{detailPost.title}</h3>
                <p className="text-xs text-gray-600 mt-1">{t.by} {detailPost.authorName} · {new Date(detailPost.createdAt).toLocaleDateString(T ? 'fa-IR' : 'en-US')}</p>
              </div>
              <div className="flex items-center gap-2">
                {detailPost.authorId === currentUser.id && (
                  <button type="button" onClick={() => startEditPost(detailPost)} className="p-2 rounded-lg text-indigo-600 hover:bg-indigo-50" title={t.edit}><IconEdit className="w-4 h-4" /></button>
                )}
                {(detailPost.authorId === currentUser.id || isMaster) && (
                  <button type="button" onClick={() => removePost(detailPost)} className="p-2 rounded-lg text-red-500 hover:bg-red-50"><IconTrash className="w-4 h-4" /></button>
                )}
                <button type="button" onClick={closeDetail} className="text-gray-500 hover:text-gray-800 text-xl leading-none px-2">×</button>
              </div>
            </div>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap mb-4">{detailPost.body}</p>
            {(detailPost.files?.length ?? 0) > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {detailPost.files!.map((f, i) => (
                  <a key={i} href={f.content} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/80 text-xs text-gray-800 border border-black/10 hover:bg-white">
                    <IconFile className="w-3.5 h-3.5" /> {f.name}
                  </a>
                ))}
              </div>
            )}
            <button type="button" onClick={() => togglePostLike(detailPost)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${detailPost.likedBy?.includes(currentUser.id) ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white/70 border-black/10 text-gray-700 hover:bg-white'}`}>
              ❤️ {detailPost.likedBy?.length || 0} {t.likes}
            </button>

            <div className="mt-6 pt-4 border-t border-black/15">
              <h4 className="text-sm font-bold text-gray-800 mb-3">💬 {t.comments} ({detailPost.comments?.length || 0})</h4>
              <div className="space-y-3 max-h-64 overflow-y-auto mb-4">
                {(detailPost.comments || []).length === 0 && (
                  <p className="text-xs text-gray-600/80">{T ? 'اولین نظر را بنویسید.' : 'Be the first to comment.'}</p>
                )}
                {(detailPost.comments || []).filter(c => !c.parentId).map(c => {
                  const replies = (detailPost.comments || []).filter(r => r.parentId === c.id);
                  const renderOne = (item: TeamBrainstormComment, isReply?: boolean) => {
                    const isEditing = editingCommentId === item.id;
                    const isOwner = item.authorId === currentUser.id;
                    return (
                      <div key={item.id} className={`rounded-xl bg-white/75 border border-black/10 p-3 ${isReply ? 'mr-6 mt-2' : ''}`}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-bold text-gray-800">{item.authorName}</span>
                          <div className="flex items-center gap-2">
                            {!isEditing && (
                              <button type="button" onClick={() => toggleCommentLike(detailPost, item.id)} className={`text-xs ${item.likedBy?.includes(currentUser.id) ? 'text-rose-600' : 'text-gray-500'}`}>❤️ {item.likedBy?.length || 0}</button>
                            )}
                            {!isEditing && isOwner && (
                              <button type="button" onClick={() => startEditComment(item)} className="text-xs text-indigo-600 hover:underline">{t.edit}</button>
                            )}
                            {!isEditing && !isReply && (
                              <button type="button" onClick={() => setReplyToId(item.id)} className="text-xs text-indigo-600 hover:underline">{t.reply}</button>
                            )}
                          </div>
                        </div>
                        {isEditing ? (
                          <div className="space-y-2">
                            <textarea className="w-full px-2.5 py-2 rounded-lg border border-black/10 bg-white text-sm min-h-[64px] outline-none focus:ring-2 focus:ring-gray-900/20" value={editCommentText} onChange={e => setEditCommentText(e.target.value)} />
                            <div className="flex items-center gap-2 flex-wrap">
                              <input ref={editCommentFileRef} type="file" className="hidden" onChange={handleEditCommentFiles} />
                              <button type="button" onClick={() => editCommentFileRef.current?.click()} className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-black/10">
                                <IconPaperclip className="w-3 h-3" /> {t.attach}
                              </button>
                              {editCommentFiles.map((f, fi) => (
                                <span key={fi} className="text-[11px] text-gray-600 flex items-center gap-1">
                                  {truncate(f.name, 16)}
                                  <button type="button" onClick={() => setEditCommentFiles(prev => prev.filter((_, j) => j !== fi))} className="text-red-500">×</button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <button type="button" onClick={cancelCommentEdit} className="flex-1 py-1.5 rounded-lg bg-gray-100 text-xs font-medium">{t.cancel}</button>
                              <button type="button" disabled={!editCommentText.trim() || uploadingEditComment} onClick={saveCommentEdit} className="flex-1 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-bold disabled:opacity-50">{t.save}</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.text}</p>
                            {(item.files?.length ?? 0) > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.files!.map((f, fi) => (
                                  <a key={fi} href={f.content} target="_blank" rel="noreferrer" className="text-[11px] px-2 py-0.5 rounded bg-gray-100 text-gray-700 hover:underline">{f.name}</a>
                                ))}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  };
                  return (
                    <div key={c.id}>
                      {renderOne(c)}
                      {replies.map(r => renderOne(r, true))}
                    </div>
                  );
                })}
              </div>
              {replyToId && !editingCommentId && (
                <p className="text-xs text-indigo-600 mb-2 flex items-center gap-2">
                  {t.reply}…
                  <button type="button" onClick={() => setReplyToId(null)} className="text-gray-500 underline">{t.cancel}</button>
                </p>
              )}
              {!editingCommentId && (
                <>
                  <textarea
                    className="w-full px-3 py-2 rounded-lg border border-black/10 bg-white/80 text-sm min-h-[72px] outline-none focus:ring-2 focus:ring-gray-900/20"
                    placeholder={t.writeComment}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                  />
                  <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <input ref={commentFileRef} type="file" className="hidden" onChange={handleCommentFiles} />
                      <button type="button" onClick={() => commentFileRef.current?.click()} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/80 border border-black/10">
                        <IconPaperclip className="w-3.5 h-3.5" /> {t.attach}
                      </button>
                      {commentFiles.map((f, i) => (
                        <span key={i} className="text-[11px] text-gray-600">{truncate(f.name, 20)}</span>
                      ))}
                    </div>
                    <button type="button" disabled={!commentText.trim() || uploadingComment} onClick={submitComment} className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-50">{t.send}</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    modalRoot,
  ) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">💡</span> {t.title}
          </h2>
          <p className="text-sm text-gray-500 mt-1">{t.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setComposeOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-black shadow-lg shadow-gray-300/50 transition-all"
        >
          <IconPlus className="w-4 h-4" /> {t.newIdea}
        </button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 py-20 text-center text-gray-500 text-sm">
          {t.empty}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-1 py-2">
            {pagePosts.map((post, idx) => renderStickyCard(post, idx))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
              >
                {t.prev}
              </button>
              <span className="text-sm text-gray-600 font-medium">{t.page} {safePage} {t.of} {totalPages}</span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:bg-gray-50"
              >
                {t.next}
              </button>
            </div>
          )}
        </>
      )}

      {composeModal}
      {detailModal}
    </div>
  );
};
