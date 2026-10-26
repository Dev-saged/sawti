import React, { useState, useRef } from 'react';
import { Upload, FileAudio, Video, X, Sparkles, CheckCircle2, Film } from 'lucide-react';

interface FileUploaderProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileSelected, isProcessing }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = (file: File) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleClear = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isVideo = selectedFile?.type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi|flv)$/i.test(selectedFile?.name || '');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl text-right">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">استيراد ملف صوت أو فيديو</h3>
            <p className="text-xs text-slate-400">يدعم صيغ MP3, WAV, M4A, OGG, WebM, MP4, MKV, MOV حتى 100MB مع معالجة سريعة</p>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,video/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.webm,.mp4,.mkv,.mov,.avi"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
      />

      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-4 ${
            isDragging
              ? 'border-indigo-500 bg-indigo-500/10 scale-[0.99]'
              : 'border-slate-800 hover:border-slate-700 bg-slate-950/60 hover:bg-slate-950'
          }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-inner">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <p className="text-base font-semibold text-slate-200 mb-1">
              اسحب وأفلت ملف الصوت أو الفيديو هنا، أو <span className="text-indigo-400 underline">تصفح ملفاتك</span>
            </p>
            <p className="text-xs text-slate-400">نظام ذكي يستخرج الصوت من الفيديو ويقوم بتفريغه بدقة متناهية</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">MP3</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">WAV</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">M4A</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">MP4</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">MKV</span>
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-xs font-mono">MOV</span>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                {isVideo ? <Film className="w-6 h-6 text-purple-400" /> : <FileAudio className="w-6 h-6 text-indigo-400" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-100 max-w-xs sm:max-w-md truncate">
                  {selectedFile.name}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                  <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} ميغابايت</span>
                  <span>•</span>
                  <span>{isVideo ? 'ملف فيديو' : 'ملف صوتي'}</span>
                  <span>•</span>
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> جاهز للمعالجة
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleClear}
              disabled={isProcessing}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg transition disabled:opacity-50 cursor-pointer"
              title="إزالة الملف"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Player Preview */}
          {previewUrl && (
            <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 p-3 flex justify-center">
              {isVideo ? (
                <video
                  src={previewUrl}
                  controls
                  className="max-h-56 rounded-lg w-full max-w-md bg-black"
                />
              ) : (
                <audio
                  src={previewUrl}
                  controls
                  className="w-full max-w-md h-12 accent-indigo-500"
                />
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              onClick={handleClear}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition text-sm disabled:opacity-50 cursor-pointer"
            >
              اختيار ملف آخر
            </button>
            <button
              onClick={() => onFileSelected(selectedFile)}
              disabled={isProcessing}
              className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-600/30 text-sm disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isProcessing ? 'جاري التحويل...' : 'تحويل الملف إلى نص'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
