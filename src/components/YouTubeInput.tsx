import React, { useState } from 'react';
import { Youtube, Sparkles, AlertCircle, ExternalLink, Clipboard, Play } from 'lucide-react';

interface YouTubeInputProps {
  onTranscribeYouTube: (url: string) => void;
  isProcessing: boolean;
}

export const YouTubeInput: React.FC<YouTubeInputProps> = ({ onTranscribeYouTube, isProcessing }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Extract YouTube ID
  const extractId = (inputUrl: string) => {
    const match = inputUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    return match ? match[1] : null;
  };

  const videoId = extractId(url);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
        setError(null);
      }
    } catch {
      // Ignore if clipboard access rejected
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError('يرجى إدخال رابط فيديو يوتيوب');
      return;
    }

    if (!videoId) {
      setError('الرابط المدخل غير صالح. يرجى التأكد من كتابة رابط يوتيوب صحيح (مثل: https://www.youtube.com/watch?v=...)');
      return;
    }

    onTranscribeYouTube(url.trim());
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl text-right">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center border border-red-500/20">
            <Youtube className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">تفريغ مقاطع يوتيوب (YouTube)</h3>
            <p className="text-xs text-slate-400">استخراج النص الكامل والمحاور والمتحدثين من أي فيديو أو شورتس</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-2">رابط الفيديو أو الشورتس:</label>
          <div className="relative flex items-center">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError(null);
              }}
              placeholder="https://www.youtube.com/watch?v=..."
              dir="ltr"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 pl-24 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 text-sm font-mono transition"
            />
            <button
              type="button"
              onClick={handlePaste}
              className="absolute left-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition border border-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>لصق</span>
            </button>
          </div>
          {error && (
            <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </p>
          )}
        </div>

        {/* Video Thumbnail & Preview */}
        {videoId && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center gap-4">
            <div className="relative w-full sm:w-48 aspect-video rounded-lg overflow-hidden bg-slate-900 flex-shrink-0 border border-slate-800 group">
              <img
                src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                alt="YouTube Thumbnail"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <Play className="w-8 h-8 text-white fill-white" />
              </div>
            </div>

            <div className="flex-1 text-right">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
                فيديو يوتيوب صالح
              </span>
              <p className="text-sm font-medium text-slate-200 mt-2 font-mono" dir="ltr">
                ID: {videoId}
              </p>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:underline mt-1"
              >
                <span>مشاهدة على يوتيوب</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isProcessing || !videoId}
            className="flex items-center gap-2 px-7 py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold rounded-xl transition shadow-lg shadow-red-600/30 text-sm disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isProcessing ? 'جاري استخراج وتفريغ النص...' : 'تفريغ محتوى اليوتيوب'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
