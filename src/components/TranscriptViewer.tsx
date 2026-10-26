import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Download,
  Copy,
  Check,
  Sparkles,
  Users,
  Search,
  Clock,
  Printer,
  FileCode,
  FileSpreadsheet,
  Play,
  Pause,
  RotateCcw,
  Volume2,
  Share2,
  Edit3,
  Bookmark,
  ChevronDown,
  Trash2,
  Plus,
  Save,
  CheckCheck,
  MessagesSquare,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import {
  TranscriptionResult,
  TranscriptSegment,
  exportToWord,
  exportToPDFPrint,
  exportToSRT,
  exportToVTT,
  exportToTXT,
} from '../utils/exportUtils';
import { AIToolsModal } from './AIToolsModal';

export type ConversationFormat = 'speakers' | 'timestamps' | 'continuous';

interface TranscriptViewerProps {
  data: TranscriptionResult;
  onUpdateData: (newData: TranscriptionResult) => void;
  audioBlobUrl?: string | null;
  onNewTranscription: () => void;
}

export const TranscriptViewer: React.FC<TranscriptViewerProps> = ({
  data,
  onUpdateData,
  audioBlobUrl,
  onNewTranscription,
}) => {
  const [activeTab, setActiveTab] = useState<'diarized' | 'unified' | 'editor' | 'subtitles' | 'summary'>('diarized');
  const [copied, setCopied] = useState(false);
  const [copiedUnified, setCopiedUnified] = useState(false);
  const [copiedSegmentIdx, setCopiedSegmentIdx] = useState<number | null>(null);
  const [conversationFormat, setConversationFormat] = useState<ConversationFormat>('speakers');
  const [unifiedConversationText, setUnifiedConversationText] = useState<string>('');
  const [hasUserEditedUnified, setHasUserEditedUnified] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [showSearchReplace, setShowSearchReplace] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('الآن');
  const [editingSegmentIndex, setEditingSegmentIndex] = useState<number | null>(null);

  // Audio player sync state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Helper to format unified conversation from segments
  const formatUnifiedConversation = (
    segments: TranscriptSegment[],
    format: ConversationFormat,
    fullTextFallback: string
  ): string => {
    if (!segments || segments.length === 0) {
      return fullTextFallback || '';
    }

    if (format === 'continuous') {
      return segments
        .map((s) => s.text.trim())
        .filter(Boolean)
        .join('\n\n');
    }

    if (format === 'timestamps') {
      return segments
        .map((s) => {
          const time = s.startTime ? `[${s.startTime}] ` : '';
          const speaker = s.speaker ? `${s.speaker}: ` : '';
          return `${time}${speaker}${s.text.trim()}`;
        })
        .filter(Boolean)
        .join('\n\n');
    }

    // Default 'speakers'
    return segments
      .map((s) => {
        const speaker = s.speaker ? `${s.speaker}: ` : '';
        return `${speaker}${s.text.trim()}`;
      })
      .filter(Boolean)
      .join('\n\n');
  };

  // Sync unified conversation text whenever data updates unless user is currently editing
  useEffect(() => {
    if (!hasUserEditedUnified) {
      setUnifiedConversationText(formatUnifiedConversation(data.segments, conversationFormat, data.fullText));
    }
  }, [data.segments, data.fullText, conversationFormat, hasUserEditedUnified]);

  // Switch conversation format pills
  const handleFormatChange = (newFormat: ConversationFormat) => {
    setConversationFormat(newFormat);
    setHasUserEditedUnified(false);
    setUnifiedConversationText(formatUnifiedConversation(data.segments, newFormat, data.fullText));
  };

  // Reset unified conversation back to pristine generated text
  const handleResetUnified = () => {
    setHasUserEditedUnified(false);
    setUnifiedConversationText(formatUnifiedConversation(data.segments, conversationFormat, data.fullText));
  };

  // Copy entire unified conversation in a single click
  const handleCopyUnified = () => {
    const textToCopy =
      unifiedConversationText || formatUnifiedConversation(data.segments, conversationFormat, data.fullText);
    navigator.clipboard.writeText(textToCopy);
    setCopiedUnified(true);
    setTimeout(() => setCopiedUnified(false), 2500);
  };

  // Download unified conversation as TXT
  const handleDownloadUnifiedTxt = () => {
    const textToDownload =
      unifiedConversationText || formatUnifiedConversation(data.segments, conversationFormat, data.fullText);
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${data.title || 'conversation'}-unified.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(downloadUrl);
  };

  // Save manual unified edits back to fullText
  const handleSaveUnifiedEdits = () => {
    onUpdateData({
      ...data,
      fullText: unifiedConversationText,
    });
    markSaved();
  };

  // Copy full text
  const handleCopy = () => {
    navigator.clipboard.writeText(data.fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Text statistics
  const wordCount = data.fullText ? data.fullText.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = data.fullText ? data.fullText.length : 0;
  const readingTimeMin = Math.ceil(wordCount / 180);

  // Audio seek to segment
  const jumpToTime = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const markSaved = () => {
    const now = new Date();
    setLastSavedTime(
      `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now
        .getSeconds()
        .toString()
        .padStart(2, '0')}`
    );
  };

  // Search and replace in full text
  const handleReplaceAll = () => {
    if (!searchQuery) return;
    const regex = new RegExp(searchQuery, 'gi');
    const newFullText = data.fullText.replace(regex, replaceQuery);

    const newSegments = data.segments.map((s) => ({
      ...s,
      text: s.text.replace(regex, replaceQuery),
    }));

    onUpdateData({
      ...data,
      fullText: newFullText,
      segments: newSegments,
    });
    markSaved();
  };

  // Edit segment text inline
  const updateSegmentText = (index: number, newText: string) => {
    const updatedSegments = [...data.segments];
    updatedSegments[index] = { ...updatedSegments[index], text: newText };
    const updatedFullText = updatedSegments.map((s) => s.text).join(' ');

    onUpdateData({
      ...data,
      segments: updatedSegments,
      fullText: updatedFullText,
    });
    markSaved();
  };

  // Edit speaker name inline
  const updateSpeakerName = (oldName: string, newName: string) => {
    if (!newName.trim() || oldName === newName) return;
    const updatedSegments = data.segments.map((s) => (s.speaker === oldName ? { ...s, speaker: newName } : s));
    const updatedSpeakers = (data.speakers || []).map((s) => (s === oldName ? newName : s));

    onUpdateData({
      ...data,
      speakers: updatedSpeakers,
      segments: updatedSegments,
    });
    markSaved();
  };

  // Delete segment
  const deleteSegment = (index: number) => {
    if (data.segments.length <= 1) return;
    const updatedSegments = data.segments.filter((_, i) => i !== index);
    const updatedFullText = updatedSegments.map((s) => s.text).join(' ');
    onUpdateData({
      ...data,
      segments: updatedSegments,
      fullText: updatedFullText,
    });
    markSaved();
  };

  // Add new segment below
  const addSegmentBelow = (index: number) => {
    const current = data.segments[index];
    const newSeg: TranscriptSegment = {
      id: Date.now(),
      start: current ? current.end : 0,
      end: current ? current.end + 5 : 5,
      startTime: current ? current.endTime : '00:00:00',
      endTime: current ? current.endTime : '00:00:05',
      speaker: current ? current.speaker : 'المتحدث 1',
      text: 'فقرة جديدة...',
    };

    const updatedSegments = [...data.segments];
    updatedSegments.splice(index + 1, 0, newSeg);
    const updatedFullText = updatedSegments.map((s) => s.text).join(' ');

    onUpdateData({
      ...data,
      segments: updatedSegments,
      fullText: updatedFullText,
    });
    setEditingSegmentIndex(index + 1);
    markSaved();
  };

  // Update Summary inline
  const updateSummary = (newSummary: string) => {
    onUpdateData({
      ...data,
      summary: newSummary,
    });
    markSaved();
  };

  // Update KeyPoint inline
  const updateKeyPoint = (index: number, newPoint: string) => {
    const pts = [...(data.keyPoints || [])];
    pts[index] = newPoint;
    onUpdateData({
      ...data,
      keyPoints: pts,
    });
    markSaved();
  };

  // Add KeyPoint
  const addKeyPoint = () => {
    const pts = [...(data.keyPoints || []), 'نقطة رئيسية جديدة...'];
    onUpdateData({
      ...data,
      keyPoints: pts,
    });
    markSaved();
  };

  // Delete KeyPoint
  const deleteKeyPoint = (index: number) => {
    const pts = (data.keyPoints || []).filter((_, i) => i !== index);
    onUpdateData({
      ...data,
      keyPoints: pts,
    });
    markSaved();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl text-right">
      {/* Top Bar with Title, Language Badge, and Main Actions */}
      <div className="p-6 border-b border-slate-800 bg-slate-950/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex-1 w-full md:w-auto">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
              {data.detectedLanguage || 'تم التحويل بنجاح'}
            </span>
            {data.durationEstimate && (
              <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 text-xs font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {data.durationEstimate}
              </span>
            )}
            <span className="text-xs text-slate-400">
              {wordCount} كلمة • {readingTimeMin} دقيقة قراءة
            </span>

            {/* Live Auto-save status */}
            <span className="text-[11px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <CheckCheck className="w-3 h-3" />
              <span>محفوظ تلقائياً ({lastSavedTime})</span>
            </span>
          </div>

          {/* Inline Editable Document Title */}
          <div className="relative group/title flex items-center gap-2 max-w-2xl">
            <input
              type="text"
              value={data.title || ''}
              onChange={(e) => {
                onUpdateData({ ...data, title: e.target.value });
                markSaved();
              }}
              placeholder="اكتب عنوان التقرير هنا..."
              className="text-lg sm:text-xl font-bold text-white tracking-wide bg-transparent hover:bg-slate-950/80 focus:bg-slate-950 border-b border-dashed border-slate-700/60 focus:border-indigo-500 rounded-lg px-2 py-1 outline-none transition w-full"
              title="انقر لتعديل عنوان المستند مباشرة"
            />
            <Edit3 className="w-4 h-4 text-slate-500 group-hover/title:text-indigo-400 transition pointer-events-none flex-shrink-0" />
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>المساعد الذكي (AI)</span>
          </button>

          {/* Unified Conversation Quick Action */}
          <button
            onClick={() => {
              setActiveTab('unified');
              handleCopyUnified();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold transition cursor-pointer shadow-sm"
            title="تجميع المحادثة كلها في مربع واحد ونسخها مباشرة"
          >
            <MessagesSquare className="w-4 h-4 text-emerald-400" />
            <span>المحادثة في مربع واحد</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition border border-slate-700 cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تصدير وحفظ الملف</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {showExportMenu && (
              <div
                className="absolute left-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-30 p-2 text-right divide-y divide-slate-800"
                onClick={() => setShowExportMenu(false)}
              >
                <div className="pb-1 space-y-1">
                  <button
                    onClick={() => exportToWord(data)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-200 hover:bg-indigo-600/20 hover:text-indigo-300 transition text-right cursor-pointer"
                  >
                    <span className="font-semibold">مستند وورد (Word .docx)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">DOCX</span>
                  </button>

                  <button
                    onClick={() => exportToPDFPrint(data)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-200 hover:bg-red-600/20 hover:text-red-300 transition text-right cursor-pointer"
                  >
                    <span className="font-semibold">ملف بي دي إف (PDF / طباعة)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">PDF</span>
                  </button>
                </div>

                <div className="py-1 space-y-1">
                  <button
                    onClick={() => exportToSRT(data.segments)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300 transition text-right cursor-pointer"
                  >
                    <span className="font-semibold">ملف ترجمة (SubRip .srt)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">SRT</span>
                  </button>

                  <button
                    onClick={() => exportToVTT(data.segments)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-200 hover:bg-emerald-600/20 hover:text-emerald-300 transition text-right cursor-pointer"
                  >
                    <span className="font-semibold">ملف ترجمة ويب (WebVTT .vtt)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">VTT</span>
                  </button>
                </div>

                <div className="pt-1">
                  <button
                    onClick={() => exportToTXT(data)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs text-slate-200 hover:bg-slate-800 transition text-right cursor-pointer"
                  >
                    <span className="font-semibold">ملف نص عادي (.txt)</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-300 font-mono">TXT</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={onNewTranscription}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            تفريغ جديد
          </button>
        </div>
      </div>

      {/* Synchronized Audio Player bar (if audio is provided) */}
      {audioBlobUrl && (
        <div className="p-3 bg-slate-950 border-b border-slate-800/80 flex items-center justify-between gap-4 flex-wrap">
          <audio
            ref={audioRef}
            src={audioBlobUrl}
            onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
            onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!audioRef.current) return;
                if (isPlaying) {
                  audioRef.current.pause();
                  setIsPlaying(false);
                } else {
                  audioRef.current.play();
                  setIsPlaying(true);
                }
              }}
              className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition shadow-md cursor-pointer"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>

            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5);
                }
              }}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="الرجوع 5 ثوانٍ"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <div className="text-xs font-mono text-slate-300">
              <span>{Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}</span>
              <span className="text-slate-600"> / </span>
              <span>{Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="flex-1 max-w-md mx-4">
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const val = Number(e.target.value);
                setCurrentTime(val);
                if (audioRef.current) audioRef.current.currentTime = val;
              }}
              className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1.5">
            {[1, 1.25, 1.5].map((speed) => (
              <button
                key={speed}
                onClick={() => {
                  setPlaybackRate(speed);
                  if (audioRef.current) audioRef.current.playbackRate = speed;
                }}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition cursor-pointer ${
                  playbackRate === speed
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View Tabs & Inline Edit Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 bg-slate-950/40 px-6 py-2.5 gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-thin">
          <button
            onClick={() => setActiveTab('diarized')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'diarized'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>المتحدثون والتوقيت ({data.segments?.length || 0})</span>
          </button>

          <button
            onClick={() => setActiveTab('unified')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'unified'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
            }`}
          >
            <MessagesSquare className="w-3.5 h-3.5 text-emerald-400" />
            <span>المحادثة في مربع واحد</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-mono font-normal">
              نسخ الكل
            </span>
          </button>

          <button
            onClick={() => setActiveTab('editor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'editor'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>محرر النص الكامل</span>
          </button>

          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'summary'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>الملخص والمحاور</span>
          </button>

          <button
            onClick={() => setActiveTab('subtitles')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'subtitles'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>معاينة الترجمة (SRT)</span>
          </button>
        </div>

        {/* Inline Edit Notice & Search toggle */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-slate-800">
            <Edit3 className="w-3 h-3 text-indigo-400" />
            <span>انقر على أي نص لتصحيح الأخطاء الإملائية فوراً</span>
          </div>

          <button
            onClick={() => setShowSearchReplace(!showSearchReplace)}
            className={`p-2 rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5 ${
              showSearchReplace ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
            title="بحث واستبدال الكلمات في النص"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">بحث واستبدال</span>
          </button>
        </div>
      </div>

      {/* Search & Replace Floating Bar */}
      {showSearchReplace && (
        <div className="p-4 bg-slate-950 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
          <div>
            <input
              type="text"
              placeholder="ابحث عن كلمة لتصحيحها..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div>
            <input
              type="text"
              placeholder="استبدل بالكلمة الصحيحة..."
              value={replaceQuery}
              onChange={(e) => setReplaceQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg py-1.5 px-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReplaceAll}
              disabled={!searchQuery}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
            >
              استبدال وتصحيح الكل
            </button>
            <button
              onClick={() => setShowSearchReplace(false)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* Content Body Based on Active Tab */}
      <div className="p-6 min-h-[400px] max-h-[600px] overflow-y-auto scrollbar-thin">
        {/* Tab 1: Diarized & Timeline with Full Inline Editing */}
        {activeTab === 'diarized' && (
          <div className="space-y-4">
            {/* Quick banner to switch to unified single box conversation */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30 border border-emerald-500/30 gap-3 shadow-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <MessagesSquare className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">تريد جعل المحادثة كلها في مربع واحد ونسخها دفعة واحدة؟</h4>
                  <p className="text-[11px] text-slate-400">جمع حوار جميع المتحدثين في صندوق نصي موحد قابل للتعديل والنسخ بنقرة واحدة.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setActiveTab('unified');
                  handleCopyUnified();
                }}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer flex-shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>فتح المربع الموحد ونسخ الكل</span>
              </button>
            </div>

            {data.segments && data.segments.length > 0 ? (
              data.segments.map((seg, idx) => (
                <div
                  key={seg.id || idx}
                  className={`group p-4 rounded-2xl transition duration-150 relative border ${
                    editingSegmentIndex === idx
                      ? 'bg-slate-950 border-indigo-500/80 shadow-lg shadow-indigo-500/10'
                      : 'bg-slate-950/60 hover:bg-slate-950 border-slate-800/80 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    {/* Speaker badge & inline edit */}
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center text-xs font-bold">
                        {seg.speaker ? seg.speaker.replace(/[^0-9]/g, '') || idx + 1 : idx + 1}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg px-2 py-0.5">
                        <input
                          type="text"
                          value={seg.speaker || `المتحدث ${idx + 1}`}
                          onChange={(e) => updateSpeakerName(seg.speaker, e.target.value)}
                          className="text-xs font-bold text-indigo-400 bg-transparent outline-none w-24 sm:w-32"
                          title="انقر لتعديل اسم المتحدث"
                        />
                        <Edit3 className="w-3 h-3 text-slate-500 pointer-events-none" />
                      </div>
                    </div>

                    {/* Segment Tools */}
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => jumpToTime(seg.start)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800/80 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-300 text-xs font-mono transition cursor-pointer"
                        title="تشغيل الصوت من هذه اللحظة"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>{seg.startTime || '00:00:00'}</span>
                      </button>

                      {/* Explicit Edit Button */}
                      <button
                        onClick={() => setEditingSegmentIndex(editingSegmentIndex === idx ? null : idx)}
                        className={`p-1.5 rounded-lg text-xs transition cursor-pointer flex items-center gap-1 ${
                          editingSegmentIndex === idx
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                        title="تعديل مباشر لهذه الفقرة"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span className="text-[11px] hidden sm:inline">
                          {editingSegmentIndex === idx ? 'إتمام' : 'تعديل'}
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          const segTxt = seg.speaker ? `${seg.speaker}: ${seg.text}` : seg.text;
                          navigator.clipboard.writeText(segTxt);
                          setCopiedSegmentIdx(idx);
                          setTimeout(() => setCopiedSegmentIdx(null), 1500);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
                        title="نسخ هذه الفقرة فقط"
                      >
                        {copiedSegmentIdx === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => addSegmentBelow(idx)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition"
                        title="إضافة فقرة جديدة بالأسفل"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      {data.segments.length > 1 && (
                        <button
                          onClick={() => deleteSegment(idx)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                          title="حذف هذه الفقرة"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline Text Area with spellcheck */}
                  <div className="relative mt-2">
                    <textarea
                      value={seg.text}
                      rows={Math.max(2, Math.ceil(seg.text.length / 80))}
                      spellCheck={true}
                      dir="auto"
                      onFocus={() => setEditingSegmentIndex(idx)}
                      onChange={(e) => updateSegmentText(idx, e.target.value)}
                      className={`w-full bg-transparent text-sm text-slate-200 leading-relaxed outline-none resize-none transition rounded-xl p-2.5 font-sans ${
                        editingSegmentIndex === idx
                          ? 'bg-slate-900 border border-indigo-500/50 shadow-inner'
                          : 'hover:bg-slate-900/40 border border-transparent'
                      }`}
                      placeholder="اكتب أو صحح النص هنا..."
                    />
                    {editingSegmentIndex === idx && (
                      <div className="flex justify-between items-center text-[11px] text-slate-400 px-2 mt-1">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <Check className="w-3 h-3" /> جاري الحفظ المباشر
                        </span>
                        <button
                          onClick={() => setEditingSegmentIndex(null)}
                          className="px-2.5 py-0.5 rounded bg-indigo-600/30 text-indigo-300 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
                        >
                          تم التعديل
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 bg-slate-950 rounded-xl text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
                {data.fullText}
              </div>
            )}
          </div>
        )}

        {/* Tab: Unified Conversation in a Single Box */}
        {activeTab === 'unified' && (
          <div className="h-full flex flex-col space-y-4">
            {/* Header info & format controls */}
            <div className="p-4 bg-slate-950/80 border border-slate-800 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                  <MessagesSquare className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>المحادثة الكاملة في مربع واحد</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                      نسخ مجمع فوري
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    جميع الحوارات مجمعة في مربع نصي واحد لتسهيل قراءتها، تعديلها، ونسخها بالكامل بنقرة واحدة.
                  </p>
                </div>
              </div>

              {/* Main Prominent Copy Button & Secondary Actions */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  onClick={handleCopyUnified}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-lg cursor-pointer ${
                    copiedUnified
                      ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 scale-102 ring-2 ring-emerald-400'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95'
                  }`}
                  title="نسخ المحادثة بالكامل دفعة واحدة إلى الحافظة"
                >
                  {copiedUnified ? (
                    <>
                      <CheckCheck className="w-4 h-4 stroke-[2.5]" />
                      <span>تم نسخ المحادثة بالكامل بنجاح!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>نسخ المحادثة بالكامل دفعة واحدة</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadUnifiedTxt}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition border border-slate-700 cursor-pointer"
                  title="تنزيل المحادثة كملف نصي (.txt)"
                >
                  <FileDown className="w-4 h-4" />
                </button>

                {hasUserEditedUnified && (
                  <button
                    onClick={handleResetUnified}
                    className="p-2.5 bg-slate-800/80 hover:bg-slate-700 text-amber-400 rounded-xl transition border border-slate-700 cursor-pointer flex items-center gap-1 text-xs"
                    title="استرجاع النص الأصلي المنسق من المقاطع"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span className="hidden sm:inline">استرجاع</span>
                  </button>
                )}
              </div>
            </div>

            {/* Format options toolbar & Statistics */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 text-xs ml-1 font-medium">طريقة عرض المحادثة:</span>
                <button
                  onClick={() => handleFormatChange('speakers')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    conversationFormat === 'speakers'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  مع أسماء المتحدثين (حوار)
                </button>
                <button
                  onClick={() => handleFormatChange('timestamps')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    conversationFormat === 'timestamps'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  مع التوقيت والمتحدث
                </button>
                <button
                  onClick={() => handleFormatChange('continuous')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    conversationFormat === 'continuous'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  نص متصل بدون أسماء
                </button>
              </div>

              <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400 pr-2">
                <span>{unifiedConversationText.split('\n').filter(Boolean).length} أسطر</span>
                <span>•</span>
                <span>{unifiedConversationText.trim().split(/\s+/).filter(Boolean).length} كلمة</span>
                <span>•</span>
                <span>{unifiedConversationText.length} حرف</span>
              </div>
            </div>

            {/* The Unified Box: Single cohesive editable area with instant copy overlay */}
            <div className="relative group/box rounded-2xl overflow-hidden border border-slate-800 focus-within:border-emerald-500/60 bg-slate-950 transition shadow-inner">
              {/* Floating Quick Copy button inside the box corner */}
              <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                <button
                  onClick={handleCopyUnified}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition shadow-md flex items-center gap-1.5 cursor-pointer backdrop-blur-md ${
                    copiedUnified
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'bg-slate-800/90 hover:bg-emerald-600 text-slate-200 hover:text-white border border-slate-700/80'
                  }`}
                  title="نسخ المحتوى الآن بنقرة واحدة"
                >
                  {copiedUnified ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUnified ? 'تم النسخ!' : 'نسخ المحادثة'}</span>
                </button>
              </div>

              <textarea
                value={unifiedConversationText}
                onChange={(e) => {
                  setUnifiedConversationText(e.target.value);
                  setHasUserEditedUnified(true);
                }}
                spellCheck={true}
                dir="auto"
                rows={16}
                className="w-full bg-transparent p-5 pt-12 text-sm text-slate-200 leading-relaxed outline-none resize-y font-sans placeholder:text-slate-600 selection:bg-emerald-500/30"
                placeholder="جاري تجهيز نص المحادثة الموحدة..."
              />

              {/* Bottom bar inside the box */}
              <div className="p-3 bg-slate-900/60 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Edit3 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {hasUserEditedUnified
                      ? 'تم إجراء تعديلات مباشرة داخل هذا المربع. يمكنك نسخها فوراً أو حفظها إلى المستند.'
                      : 'المحادثة معروضة كلها في هذا المربع. يمكنك تعديل أي نص أو تصحيح أي كلمة مباشرة قبل النسخ.'}
                  </span>
                </div>

                {hasUserEditedUnified && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveUnifiedEdits}
                      className="px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>تحديث النص الكامل للمستند</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Full Text Editor */}
        {activeTab === 'editor' && (
          <div className="h-full flex flex-col space-y-3">
            <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 rounded-xl flex items-center justify-between text-xs text-indigo-300">
              <span className="flex items-center gap-1.5 font-medium">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>محرر النص الكامل: يمكنك تصحيح أي أخطاء لغوية أو إملائية وسوف تنعكس على التصدير مباشرة.</span>
              </span>
              <span className="font-mono text-slate-400">{charCount} حرف • {wordCount} كلمة</span>
            </div>
            <textarea
              value={data.fullText}
              spellCheck={true}
              dir="auto"
              onChange={(e) => {
                onUpdateData({ ...data, fullText: e.target.value });
                markSaved();
              }}
              rows={16}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-sm text-slate-200 leading-relaxed focus:outline-none focus:border-indigo-500 resize-none font-sans"
              placeholder="اكتب أو عدل النص هنا..."
            />
          </div>
        )}

        {/* Tab 3: Summary & Keypoints with Inline Editing */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/30">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2">
                  <Bookmark className="w-4 h-4" />
                  <span>الملخص التنفيذي للمحتوى (قابل للتعديل المباشر)</span>
                </h4>
                <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
              </div>
              <textarea
                value={data.summary || ''}
                rows={4}
                dir="auto"
                onChange={(e) => updateSummary(e.target.value)}
                placeholder="اكتب أو عدل الملخص هنا..."
                className="w-full bg-slate-950/80 border border-indigo-500/20 focus:border-indigo-500 rounded-xl p-3 text-sm text-slate-200 leading-relaxed outline-none resize-none"
              />
            </div>

            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-slate-200">أهم النقاط والمحاور المستفادة:</h4>
                <button
                  onClick={addKeyPoint}
                  className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة نقطة</span>
                </button>
              </div>

              {data.keyPoints && data.keyPoints.length > 0 ? (
                <ul className="space-y-2.5">
                  {data.keyPoints.map((pt, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-slate-300 group">
                      <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        ✓
                      </span>
                      <input
                        type="text"
                        value={pt}
                        dir="auto"
                        onChange={(e) => updateKeyPoint(i, e.target.value)}
                        className="flex-1 bg-transparent hover:bg-slate-900 border-b border-transparent hover:border-slate-700 focus:border-indigo-500 rounded px-2 py-1 outline-none text-sm text-slate-200 transition"
                      />
                      <button
                        onClick={() => deleteKeyPoint(i)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition"
                        title="حذف هذه النقطة"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">لا توجد نقاط رئيسية مضافة حالياً.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: Subtitles SRT */}
        {activeTab === 'subtitles' && (
          <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs text-slate-300 whitespace-pre leading-loose overflow-x-auto" dir="ltr">
            {data.segments && data.segments.length > 0
              ? data.segments.map((seg, idx) => (
                  <div key={idx} className="mb-4">
                    <span className="text-slate-500">{idx + 1}</span>
                    <br />
                    <span className="text-emerald-400">
                      {seg.startTime},000 --&gt; {seg.endTime},000
                    </span>
                    <br />
                    <span className="text-slate-200 font-sans" dir="auto">
                      {seg.speaker ? `${seg.speaker}: ` : ''}{seg.text}
                    </span>
                  </div>
                ))
              : 'لا توجد مقاطع زمنية كافية لتوليد ملف ترجمة.'}
          </div>
        )}
      </div>

      {/* Prominent Calligraphic Signature Card Footer */}
      <div className="px-6 py-4 bg-gradient-to-r from-slate-950 via-amber-950/20 to-slate-950 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-right">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 select-none text-base">❖</span>
          <span className="font-decorative text-lg sm:text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-200 tracking-wide drop-shadow">
            جميع الحقوق محفوظة للأستاذ أحمد بشير
          </span>
          <span className="text-amber-400 select-none text-base">❖</span>
        </div>
        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
            صوتي • AI Audio Transcriber
          </span>
        </div>
      </div>

      {/* AI Assistant Modal */}
      <AIToolsModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        fullText={data.fullText}
        onApplyText={(newText) => {
          onUpdateData({ ...data, fullText: newText });
          markSaved();
        }}
      />
    </div>
  );
};
