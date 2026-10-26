/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Mic,
  Upload,
  Youtube,
  History,
  Sparkles,
  FileText,
  Languages,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Layers,
  FileCheck,
  ShieldCheck,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { AudioRecorder } from './components/AudioRecorder';
import { FileUploader } from './components/FileUploader';
import { YouTubeInput } from './components/YouTubeInput';
import { LanguageSelector, TranscriptionConfig } from './components/LanguageSelector';
import { TranscriptViewer } from './components/TranscriptViewer';
import { HistoryDrawer } from './components/HistoryDrawer';
import {
  TranscriptionResult,
  exportToWord,
  exportToPDFPrint,
} from './utils/exportUtils';
import {
  SavedTranscription,
  getSavedTranscriptions,
  saveTranscriptionToHistory,
} from './utils/storage';
import { uploadFileInChunks } from './utils/chunkUploader';
import { apiRequest } from './utils/httpClient';

export default function App() {
  const [activeMode, setActiveMode] = useState<'record' | 'upload' | 'youtube'>('record');
  const [config, setConfig] = useState<TranscriptionConfig>({
    language: 'auto',
    dialect: 'any',
    enableDiarization: true,
    enableTimestamps: true,
    contextNotes: '',
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Result state
  const [currentResult, setCurrentResult] = useState<TranscriptionResult | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState<string | null>(null);

  // History state
  const [history, setHistory] = useState<SavedTranscription[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  useEffect(() => {
    setHistory(getSavedTranscriptions());
  }, []);

  const refreshHistory = () => {
    setHistory(getSavedTranscriptions());
  };

  // 1. Process Live Recorded Audio
  const handleAudioRecorded = async (blob: Blob, _durationSec: number) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStep('جاري إرسال التسجيل الصوتي...');

    try {
      const blobUrl = URL.createObjectURL(blob);
      setAudioBlobUrl(blobUrl);

      const resData = await uploadFileInChunks(
        blob,
        {
          fileName: 'recording.webm',
          mimeType: blob.type || 'audio/webm',
          language: config.language,
          dialect: config.dialect,
          enableDiarization: config.enableDiarization,
          enableTimestamps: config.enableTimestamps,
          contextNotes: config.contextNotes,
        },
        (status) => {
          setProcessingStep(status);
        }
      );

      const result: TranscriptionResult = {
        ...resData,
        createdAt: new Date().toISOString(),
        mediaType: 'recording',
        sourceName: 'تسجيل صوتي مباشر',
      };

      setCurrentResult(result);
      saveTranscriptionToHistory(result);
      refreshHistory();
    } catch (err: any) {
      console.warn('Recording notice:', err?.message || err);
      setErrorMessage(err.message || 'فشلت معالجة التسجيل الصوتي');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // 2. Process Uploaded File (Audio or Video)
  const handleFileSelected = async (file: File) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStep('جاري فحص وتجهيز الملف...');

    try {
      if (file.size > 100 * 1024 * 1024) {
        throw new Error('حجم الملف يتجاوز الحد المسموح به (100 ميغابايت). يرجى اختيار ملف أصغر.');
      }

      const blobUrl = URL.createObjectURL(file);
      setAudioBlobUrl(blobUrl);

      const resData = await uploadFileInChunks(
        file,
        {
          fileName: file.name,
          mimeType: file.type || 'audio/mp3',
          language: config.language,
          dialect: config.dialect,
          enableDiarization: config.enableDiarization,
          enableTimestamps: config.enableTimestamps,
          contextNotes: config.contextNotes,
        },
        (status) => {
          setProcessingStep(status);
        }
      );

      const result: TranscriptionResult = {
        ...resData,
        createdAt: new Date().toISOString(),
        mediaType: file.type.startsWith('video/') ? 'video' : 'audio',
        sourceName: file.name,
      };

      setCurrentResult(result);
      saveTranscriptionToHistory(result);
      refreshHistory();
    } catch (err: any) {
      console.warn('File transcription notice:', err?.message || err);
      setErrorMessage(err.message || 'فشلت عملية تحويل الملف');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  // 3. Process YouTube Video Link
  const handleYouTubeSubmit = async (url: string) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProcessingStep('جاري جلب بيانات مقطع اليوتيوب وتحليل الحوار...');

    try {
      setAudioBlobUrl(null); // YouTube uses web embed

      const resData = await apiRequest<{ success: boolean; data: any; videoId?: string }>('/api/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          language: config.language,
        }),
      });

      const result: TranscriptionResult = {
        ...resData.data,
        createdAt: new Date().toISOString(),
        mediaType: 'youtube',
        sourceName: `YouTube: ${resData.videoId || url}`,
      };

      setCurrentResult(result);
      saveTranscriptionToHistory(result);
      refreshHistory();
    } catch (err: any) {
      console.warn('YouTube notice:', err?.message || err);
      setErrorMessage(err.message || 'حدث خطأ أثناء معالجة فيديو يوتيوب');
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleSelectHistoryItem = (item: SavedTranscription) => {
    setCurrentResult(item);
    setAudioBlobUrl(null);
  };

  const handleStartNew = () => {
    setCurrentResult(null);
    setAudioBlobUrl(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Cairo',sans-serif]">
      {/* Background ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Prominent Calligraphic Top Ribbon */}
      <div className="bg-gradient-to-r from-amber-950/60 via-amber-900/40 to-amber-950/60 border-b border-amber-500/30 py-2 px-4 shadow-sm relative z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-3 text-center">
          <span className="text-amber-400 text-sm select-none">❖</span>
          <p className="font-decorative text-base sm:text-lg md:text-xl font-bold tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-200 drop-shadow">
            جميع الحقوق محفوظة للأستاذ أحمد بشير
          </p>
          <span className="text-amber-400 text-sm select-none">❖</span>
        </div>
      </div>

      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Logo & App Branding */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Mic className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">صَوتِي</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  AI Transcriber
                </span>
              </div>
              <p className="text-xs text-slate-400">تحويل الصوت والفيديو واليوتيوب إلى نصوص احترافية</p>
            </div>
          </div>

          {/* Prominent Center Signature for Header */}
          <div className="hidden lg:flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="font-decorative text-base font-bold text-amber-300 tracking-wide">
              جميع الحقوق محفوظة للأستاذ أحمد بشير
            </span>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold transition cursor-pointer"
            >
              <History className="w-4 h-4 text-indigo-400" />
              <span>السجل المحفوظ</span>
              {history.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center">
                  {history.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error notification banner */}
        {errorMessage && (
          <div className="mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 flex items-center justify-between gap-4 animate-in fade-in">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-sm">{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-red-300 hover:text-white underline cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        )}

        {/* Processing State Modal / Overlay */}
        {isProcessing && (
          <div className="mb-8 p-8 rounded-3xl bg-slate-900/90 border border-indigo-500/40 shadow-2xl backdrop-blur text-center flex flex-col items-center justify-center gap-4 animate-pulse">
            <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">جاري معالجة وتفريغ الصوت...</h3>
              <p className="text-sm text-indigo-300 font-medium">{processingStep || 'يرجى الانتظار بضع ثوانٍ...'}</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>يتم التفريغ بواسطة نموذج Gemini المتطور مع دعم كامل للهجات وعلامات الترقيم</span>
            </div>
          </div>
        )}

        {/* If result is ready -> show TranscriptViewer */}
        {currentResult ? (
          <div className="space-y-6">
            <TranscriptViewer
              data={currentResult}
              onUpdateData={(newData) => {
                setCurrentResult(newData);
                saveTranscriptionToHistory(newData);
                refreshHistory();
              }}
              audioBlobUrl={audioBlobUrl}
              onNewTranscription={handleStartNew}
            />
          </div>
        ) : (
          /* Input Creation Flow */
          <div className="space-y-8">
            {/* Hero Section */}
            <div className="text-center max-w-3xl mx-auto pt-4 pb-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-4">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>دقة فائقة في اللغة العربية واللهجات واللغات العالمية</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight mb-4">
                حوّل التسجيلات والملفات واليوتيوب إلى{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-300 to-teal-300">
                  نصوص واضحة وموثقة
                </span>
              </h2>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                سجّل بصوتك مباشرة أو ارفع ملفات الصوت والفيديو أو الصق رابط فيديو يوتيوب، واحصل على نص مدقق مع المتحدثين والطوابع الزمنية مع إمكانية التصدير إلى Word و PDF.
              </p>
            </div>

            {/* Input Mode Selector Tabs */}
            <div className="flex items-center justify-center">
              <div className="bg-slate-900 p-1.5 rounded-2xl border border-slate-800 flex gap-1 max-w-md w-full shadow-lg">
                <button
                  type="button"
                  onClick={() => setActiveMode('record')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                    activeMode === 'record'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Mic className="w-4 h-4" />
                  <span>تسجيل صوتي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('upload')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                    activeMode === 'upload'
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>ملف صوت/فيديو</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMode('youtube')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
                    activeMode === 'youtube'
                      ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-md shadow-red-600/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Youtube className="w-4 h-4" />
                  <span>فيديو يوتيوب</span>
                </button>
              </div>
            </div>

            {/* Language & Transcription Settings */}
            <div className="max-w-3xl mx-auto">
              <LanguageSelector
                config={config}
                onChange={setConfig}
                disabled={isProcessing}
              />
            </div>

            {/* Active Mode Component */}
            <div className="max-w-3xl mx-auto">
              {activeMode === 'record' && (
                <AudioRecorder
                  onAudioRecorded={handleAudioRecorded}
                  isProcessing={isProcessing}
                />
              )}

              {activeMode === 'upload' && (
                <FileUploader
                  onFileSelected={handleFileSelected}
                  isProcessing={isProcessing}
                />
              )}

              {activeMode === 'youtube' && (
                <YouTubeInput
                  onTranscribeYouTube={handleYouTubeSubmit}
                  isProcessing={isProcessing}
                />
              )}
            </div>

            {/* Features Highlight Grid */}
            <div className="max-w-5xl mx-auto pt-8 border-t border-slate-900 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
                  <Languages className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">دعم لغات متعددة ولهجات عربية</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  تفريغ دقيق باللغة العربية الفصحى واللهجات (المصرية، الخليجية، الشامية، المغاربية) بالإضافة للإنجليزية ولغات العالم.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                  <FileCheck className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">تصدير Word (.docx) و PDF جاهز</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  احفظ مخرجاتك بنقرة واحدة في ملفات وورد رسمية متوافقة مع Microsoft Word وملفات PDF مهيأة للطباعة والمشاركة.
                </p>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center mb-3">
                  <Layers className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">فصل المتحدثين والطوابع الزمنية</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  تحديد تلقائي للأصوات المختلفة والمتحدثين مع طوابع زمنية دقيقة وتصدير ملفات ترجمة SRT و VTT لصناع المحتوى.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onSelectTranscription={handleSelectHistoryItem}
        onRefreshHistory={refreshHistory}
      />

      {/* Prominent Decorative Signature Footer */}
      <footer className="border-t border-amber-500/20 bg-gradient-to-b from-slate-950 via-slate-900 to-amber-950/20 py-10 mt-auto text-center relative overflow-hidden">
        {/* Top ambient golden divider glow */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent"></div>

        <div className="max-w-4xl mx-auto px-4 flex flex-col items-center justify-center gap-5">
          {/* Main Calligraphic Signature Emblem Card */}
          <div className="w-full max-w-2xl px-6 py-6 rounded-3xl bg-slate-900/90 border-2 border-amber-500/40 shadow-2xl shadow-amber-500/10 backdrop-blur flex flex-col items-center gap-3 relative">
            {/* Calligraphic Corner Ornaments */}
            <span className="absolute top-2.5 right-3 text-amber-400/60 text-xs select-none">✤</span>
            <span className="absolute top-2.5 left-3 text-amber-400/60 text-xs select-none">✤</span>
            <span className="absolute bottom-2.5 right-3 text-amber-400/60 text-xs select-none">✤</span>
            <span className="absolute bottom-2.5 left-3 text-amber-400/60 text-xs select-none">✤</span>

            {/* Prominent Decorative Calligraphic Signature */}
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-amber-400 text-lg sm:text-2xl select-none">❖</span>
              <h3 className="font-decorative text-2xl sm:text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-200 tracking-wide drop-shadow-md">
                جميع الحقوق محفوظة للأستاذ أحمد بشير
              </h3>
              <span className="text-amber-400 text-lg sm:text-2xl select-none">❖</span>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-md mx-auto">
              تطبيق صوتي الذكي لتحويل التسجيلات والملفات الصوتية والفيديو واليوتيوب إلى نصوص موثقة
            </p>

            <div className="flex items-center gap-2 pt-1 text-[11px] text-amber-300/80">
              <span className="px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 font-semibold">
                علامة مسجلة وموثقة © {new Date().getFullYear()}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-500">
            <span>حفظ محلي آمن</span>
            <span>•</span>
            <span>فصل المتحدثين والطوابع الزمنية</span>
            <span>•</span>
            <span>تصدير مباشر إلى Word (.docx) و PDF</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
