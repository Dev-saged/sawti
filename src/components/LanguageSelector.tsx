import React, { useState } from 'react';
import { Globe, Users, Clock, Sliders, ChevronDown, Sparkles, BookOpen } from 'lucide-react';

export interface TranscriptionConfig {
  language: string;
  dialect: string;
  enableDiarization: boolean;
  enableTimestamps: boolean;
  contextNotes: string;
}

interface LanguageSelectorProps {
  config: TranscriptionConfig;
  onChange: (newConfig: TranscriptionConfig) => void;
  disabled?: boolean;
}

export const LANGUAGES = [
  { id: 'auto', label: 'التعرف التلقائي على اللغة (مستحسن)', flag: '🌐' },
  { id: 'ar', label: 'العربية (Arabic)', flag: '🇸🇦' },
  { id: 'en', label: 'الإنجليزية (English)', flag: '🇺🇸' },
  { id: 'fr', label: 'الفرنسية (Français)', flag: '🇫🇷' },
  { id: 'es', label: 'الإسبانية (Español)', flag: '🇪🇸' },
  { id: 'de', label: 'الألمانية (Deutsch)', flag: '🇩🇪' },
  { id: 'tr', label: 'التركية (Türkçe)', flag: '🇹🇷' },
  { id: 'it', label: 'الإيطالية (Italiano)', flag: '🇮🇹' },
  { id: 'ru', label: 'الروسية (Русский)', flag: '🇷🇺' },
  { id: 'zh', label: 'الصينية (中文)', flag: '🇨🇳' },
  { id: 'ja', label: 'اليابانية (日本語)', flag: '🇯🇵' },
  { id: 'ur', label: 'الأردية (اردو)', flag: '🇵🇰' },
  { id: 'hi', label: 'الهندية (हिन्दी)', flag: '🇮🇳' },
];

export const ARABIC_DIALECTS = [
  { id: 'any', label: 'تلقائي / عام' },
  { id: 'msa', label: 'الفصحى المعاصرة (Standard Arabic)' },
  { id: 'egyptian', label: 'اللهجة المصرية (Egyptian)' },
  { id: 'gulf', label: 'اللهجة الخليجية والسعودية (Saudi / Gulf)' },
  { id: 'levantine', label: 'اللهجة الشامية (سورية، لبنان، الأردن، فلسطين)' },
  { id: 'maghrebi', label: 'اللهجة المغاربية (المغرب، الجزائر، تونس)' },
  { id: 'iraqi', label: 'اللهجة العراقية' },
  { id: 'sudanese', label: 'اللهجة السودانية' },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ config, onChange, disabled }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-right backdrop-blur">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-5 h-5 text-indigo-400" />
          <h4 className="text-sm font-bold text-slate-200">إعدادات اللغة ودقة التفريغ</h4>
        </div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition cursor-pointer"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>{showAdvanced ? 'إخفاء الخيارات المتقدمة' : 'خيارات إضافية'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Language Selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5">لغة التسجيل الصوتي:</label>
          <div className="relative">
            <select
              value={config.language}
              disabled={disabled}
              onChange={(e) => onChange({ ...config, language: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 px-3 pr-9 appearance-none focus:outline-none focus:border-indigo-500 text-sm cursor-pointer disabled:opacity-50"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.flag} {l.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          </div>
        </div>

        {/* Dialect Selection if Arabic or Auto */}
        {(config.language === 'ar' || config.language === 'auto') && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">اللهجة / النبرة:</label>
            <div className="relative">
              <select
                value={config.dialect}
                disabled={disabled}
                onChange={(e) => onChange({ ...config, dialect: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-2.5 px-3 pr-9 appearance-none focus:outline-none focus:border-indigo-500 text-sm cursor-pointer disabled:opacity-50"
              >
                {ARABIC_DIALECTS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-800/60">
        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition">
          <input
            type="checkbox"
            checked={config.enableDiarization}
            disabled={disabled}
            onChange={(e) => onChange({ ...config, enableDiarization: e.target.checked })}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
          />
          <div className="flex items-center gap-2 text-xs">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="font-semibold text-slate-200">تحديد وفصل المتحدثين (Diarization)</span>
          </div>
        </label>

        <label className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-950/40 border border-slate-800/80 cursor-pointer hover:bg-slate-950 transition">
          <input
            type="checkbox"
            checked={config.enableTimestamps}
            disabled={disabled}
            onChange={(e) => onChange({ ...config, enableTimestamps: e.target.checked })}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-700 bg-slate-900"
          />
          <div className="flex items-center gap-2 text-xs">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold text-slate-200">طوابع زمنية دقيقة لكل فقرة (Timestamps)</span>
          </div>
        </label>
      </div>

      {/* Advanced Custom Vocabulary / Notes */}
      {showAdvanced && (
        <div className="mt-4 pt-3 border-t border-slate-800/60 space-y-2">
          <label className="block text-xs font-semibold text-slate-400">
            مصطلحات أو كلمات تقنية متخصصة (اختياري لتعزيز الدقة):
          </label>
          <input
            type="text"
            value={config.contextNotes}
            disabled={disabled}
            onChange={(e) => onChange({ ...config, contextNotes: e.target.value })}
            placeholder="مثال: ذكاء اصطناعي، Kubernetes, إبراهيم عبد الله، أسماء شركات أو مصطلحات طبية/قانونية..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2 px-3 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
          />
        </div>
      )}
    </div>
  );
};
