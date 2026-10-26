import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Pause, Play, RotateCcw, Volume2, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

interface AudioRecorderProps {
  onAudioRecorded: (blob: Blob, durationSeconds: number) => void;
  isProcessing: boolean;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onAudioRecorded, isProcessing }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Format seconds to mm:ss or hh:mm:ss
  const formatDuration = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start live visualizer
  const startVisualizer = (stream: MediaStream) => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current || !analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        // Compute average volume for meter
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        setVolumeLevel(Math.min(100, Math.round((avg / 128) * 100)));

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 1.8;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height * 0.9;
          const gradient = ctx.createLinearGradient(0, canvas.height - barHeight, 0, canvas.height);
          gradient.addColorStop(0, '#818cf8');
          gradient.addColorStop(1, '#4f46e5');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, canvas.height - barHeight, barWidth - 2, barHeight, [4, 4, 0, 0]);
          ctx.fill();

          x += barWidth;
        }

        animFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (e) {
      console.warn('AudioContext visualization not available:', e);
    }
  };

  const stopVisualizer = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setVolumeLevel(0);
  };

  // Start recording
  const startRecording = async () => {
    setPermissionError(null);
    audioChunksRef.current = [];
    setRecordedBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      startVisualizer(stream);

      // Support mime types across browsers
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
      let selectedMime = '';
      for (const t of mimeTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          selectedMime = t;
          break;
        }
      }

      const recorder = new MediaRecorder(stream, selectedMime ? { mimeType: selectedMime } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        stopVisualizer();

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      recorder.start(500); // 500ms chunks
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Microphone error:', err);
      setPermissionError('يرجى السماح بالوصول إلى الميكروفون لبدء التسجيل الصوتي المباشر.');
    }
  };

  // Pause / Resume recording
  const togglePause = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  // Reset
  const resetRecording = () => {
    if (isRecording) {
      stopRecording();
    }
    setRecordedBlob(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    setRecordingTime(0);
    setPermissionError(null);
  };

  // Confirm submit
  const handleConfirm = () => {
    if (recordedBlob) {
      onAudioRecorded(recordedBlob, recordingTime);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopVisualizer();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, []);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 backdrop-blur shadow-xl text-right">
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">تسجيل صوتي مباشر</h3>
            <p className="text-xs text-slate-400">تحدث بحرية باللغة العربية أو أي لغة أخرى وسنقوم بتحويل صوتك فوراً</p>
          </div>
        </div>
        {isRecording && (
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full text-red-400 text-xs font-semibold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-red-500"></span>
            {isPaused ? 'التسجيل متوقف مؤقتاً' : 'جاري التسجيل الآن...'}
          </div>
        )}
      </div>

      {permissionError && (
        <div className="mb-6 p-4 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center gap-3 text-red-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-400" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* Main Recording Canvas / VU Meter Area */}
      <div className="relative mb-6 rounded-xl bg-slate-950 border border-slate-800/80 p-6 flex flex-col items-center justify-center overflow-hidden min-h-[170px]">
        {isRecording ? (
          <div className="w-full flex flex-col items-center gap-4">
            <canvas ref={canvasRef} width={450} height={70} className="w-full max-w-md h-16 rounded" />

            <div className="flex items-center gap-6">
              <div className="text-3xl font-mono font-bold tracking-wider text-indigo-400">
                {formatDuration(recordingTime)}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Volume2 className="w-4 h-4 text-slate-500" />
                <div className="w-24 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-75"
                    style={{ width: `${volumeLevel}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ) : recordedBlob ? (
          <div className="w-full flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
              <CheckCircle className="w-5 h-5" />
              <span>تم تسجيل الصوت بنجاح ({formatDuration(recordingTime)})</span>
            </div>
            {audioUrl && (
              <audio
                controls
                src={audioUrl}
                className="w-full max-w-md h-11 accent-indigo-500 rounded-lg outline-none"
              />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-slate-400 py-4">
            <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500">
              <Mic className="w-7 h-7" />
            </div>
            <p className="text-sm font-medium">انقر على زر "بدء التسجيل" وتحدث بوضوح في الميكروفون</p>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        {!isRecording && !recordedBlob && (
          <button
            onClick={startRecording}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-semibold rounded-xl transition shadow-lg shadow-indigo-600/30 disabled:opacity-50 cursor-pointer"
          >
            <Mic className="w-5 h-5" />
            <span>بدء التسجيل الصوتي</span>
          </button>
        )}

        {isRecording && (
          <>
            <button
              onClick={togglePause}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition border border-slate-700 cursor-pointer"
            >
              {isPaused ? <Play className="w-4 h-4 text-emerald-400" /> : <Pause className="w-4 h-4 text-amber-400" />}
              <span>{isPaused ? 'استئناف' : 'إيقاف مؤقت'}</span>
            </button>

            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition shadow-lg shadow-red-600/30 cursor-pointer"
            >
              <Square className="w-4 h-4 fill-white" />
              <span>إنهاء التسجيل</span>
            </button>
          </>
        )}

        {recordedBlob && !isRecording && (
          <>
            <button
              onClick={resetRecording}
              disabled={isProcessing}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition border border-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>إعادة التسجيل</span>
            </button>

            <button
              onClick={handleConfirm}
              disabled={isProcessing}
              className="flex items-center gap-2 px-7 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold rounded-xl transition shadow-lg shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>{isProcessing ? 'جاري التحويل...' : 'تحويل التسجيل إلى نص'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
