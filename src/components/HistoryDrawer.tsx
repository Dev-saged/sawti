import React, { useState } from 'react';
import { History, X, Search, Trash2, Calendar, Clock, FileText, ChevronRight } from 'lucide-react';
import { SavedTranscription, deleteTranscriptionFromHistory, clearTranscriptionHistory } from '../utils/storage';

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: SavedTranscription[];
  onSelectTranscription: (item: SavedTranscription) => void;
  onRefreshHistory: () => void;
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onSelectTranscription,
  onRefreshHistory,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    const q = search.toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.fullText.toLowerCase().includes(q) ||
      item.detectedLanguage?.toLowerCase().includes(q)
    );
  });

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteTranscriptionFromHistory(id);
    onRefreshHistory();
  };

  const handleClearAll = () => {
    if (window.confirm('هل أنت متأكد من رغبتك في حذف جميع المحفوظات السابقة؟')) {
      clearTranscriptionHistory();
      onRefreshHistory();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm text-right">
      <div className="w-full max-w-md bg-slate-900 border-r border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <History className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-white text-base">سجل التفريغ الصوتي</h3>
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-mono">
              {history.length}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/40">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute right-3 top-3" />
            <input
              type="text"
              placeholder="ابحث في السجل..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 pl-3 pr-9 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  onSelectTranscription(item);
                  onClose();
                }}
                className="group p-4 bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 hover:border-indigo-500/40 rounded-2xl cursor-pointer transition flex flex-col gap-2 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                    {item.detectedLanguage || 'تفريغ صوتي'}
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(item.timestamp).toLocaleDateString('ar-EG')}</span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-slate-200 line-clamp-1 group-hover:text-indigo-300 transition">
                  {item.title || 'تسجيل صوتي'}
                </h4>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {item.summary || item.fullText}
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-slate-900 mt-1">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{item.durationEstimate || 'غير محدد'}</span>
                  </div>

                  <button
                    onClick={(e) => handleDelete(e, item.id)}
                    className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition rounded"
                    title="حذف هذا العنصر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-500 py-12">
              <History className="w-10 h-10 text-slate-700" />
              <p className="text-xs">لا توجد تسجيلات محفوظة حالياً</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-between items-center">
            <button
              onClick={handleClearAll}
              className="text-xs text-red-400 hover:text-red-300 transition flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>مسح كل السجل</span>
            </button>
            <span className="text-[11px] text-slate-500">يُحفظ محلياً على جهازك</span>
          </div>
        )}
      </div>
    </div>
  );
};
