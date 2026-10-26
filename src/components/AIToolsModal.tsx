import React, { useState } from 'react';
import {
  FileText,
  CheckSquare,
  Languages,
  BookMarked,
  FileSpreadsheet,
  HelpCircle,
  Copy,
  Check,
  X,
  Sparkles,
  Loader2,
} from 'lucide-react';

import { apiRequest } from '../utils/httpClient';

interface AIToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fullText: string;
  onApplyText?: (newText: string) => void;
}

export const AIToolsModal: React.FC<AIToolsModalProps> = ({ isOpen, onClose, fullText, onApplyText }) => {
  const [activeTab, setActiveTab] = useState<'summarize' | 'action_items' | 'translate' | 'diacritize' | 'formal_report' | 'qa'>('summarize');
  const [targetLang, setTargetLang] = useState('English');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const runAiTool = async (action = activeTab) => {
    setLoading(true);
    setError(null);
    setResult('');

    try {
      const data = await apiRequest<{ success: boolean; result: string }>('/api/ai-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          text: fullText,
          targetLanguage: targetLang,
        }),
      });

      setResult(data.result);
    } catch (err: any) {
      setError(err.message || 'فشلت معالجة النص');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm text-right">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">المساعد الذكي للمحتوى الصوتي</h3>
              <p className="text-xs text-slate-400">تحليل، تلخيص، ترجمة، وصياغة تقارير بالذكاء الاصطناعي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 overflow-x-auto p-2 gap-1.5 scrollbar-thin">
          <button
            onClick={() => {
              setActiveTab('summarize');
              runAiTool('summarize');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'summarize'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>ملخص تنفيذي</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('action_items');
              runAiTool('action_items');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'action_items'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>المهام والتوصيات</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('formal_report');
              runAiTool('formal_report');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'formal_report'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>محضر اجتماع رسمي</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('translate');
              runAiTool('translate');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'translate'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <Languages className="w-3.5 h-3.5" />
            <span>ترجمة فورية</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('diacritize');
              runAiTool('diacritize');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'diacritize'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <BookMarked className="w-3.5 h-3.5" />
            <span>تشكيل وتدقيق لغوي</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('qa');
              runAiTool('qa');
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              activeTab === 'qa'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>أسئلة وأجوبة</span>
          </button>
        </div>

        {/* Translation Sub-controls */}
        {activeTab === 'translate' && (
          <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between gap-4">
            <span className="text-xs text-slate-300 font-semibold">اللغة المستهدفة للترجمة:</span>
            <div className="flex items-center gap-2">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              >
                <option value="English">الإنجليزية (English)</option>
                <option value="Arabic">العربية (Arabic)</option>
                <option value="French">الفرنسية (Français)</option>
                <option value="Spanish">الإسبانية (Español)</option>
                <option value="German">الألمانية (Deutsch)</option>
                <option value="Turkish">التركية (Türkçe)</option>
                <option value="Italian">الإيطالية (Italiano)</option>
                <option value="Russian">الروسية (Русский)</option>
                <option value="Urdu">الأردية (Urdu)</option>
              </select>
              <button
                onClick={() => runAiTool('translate')}
                disabled={loading}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                ترجمة الآن
              </button>
            </div>
          </div>
        )}

        {/* Result Area */}
        <div className="p-6 flex-1 overflow-y-auto min-h-[250px] bg-slate-950/30">
          {loading ? (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
              <p className="text-sm">يقوم الذكاء الاصطناعي بمعالجة النص وتحليله بدقة...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-950/40 border border-red-800 text-red-300 rounded-xl text-sm">
              {error}
            </div>
          ) : result ? (
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
              {result}
            </div>
          ) : (
            <div className="h-full min-h-[200px] flex flex-col items-center justify-center gap-2 text-slate-500">
              <Sparkles className="w-8 h-8 text-slate-600" />
              <p className="text-sm">اختر أحد الخيارات في الأعلى للبدء</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {result && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'تم النسخ' : 'نسخ النتيجة'}</span>
              </button>
            )}
            {result && onApplyText && (
              <button
                onClick={() => {
                  onApplyText(result);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition cursor-pointer"
              >
                <span>استبدال النص الحالي بهذه النتيجة</span>
              </button>
            )}
          </div>

          <button
            onClick={() => runAiTool()}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            <span>إعادة التوليد</span>
          </button>
        </div>
      </div>
    </div>
  );
};
