import express, { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { promises as fsp } from 'fs';
import { execFile } from 'child_process';
import util from 'util';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { YoutubeTranscript } from 'youtube-transcript';

dotenv.config();

const execFileAsync = util.promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Body parsers
app.use(express.json({ limit: '80mb' }));
app.use(express.urlencoded({ extended: true, limit: '80mb' }));

// Temp chunks root directory
const CHUNKS_DIR = '/tmp/sawti_chunks';
if (!fs.existsSync(CHUNKS_DIR)) {
  fs.mkdirSync(CHUNKS_DIR, { recursive: true });
}

// Multer memory storage for direct file uploads (up to 80MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 }, // 80MB
});

// Safe multer wrapper that always returns JSON errors
const handleFileUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(413).json({
          error: 'حجم الملف يتجاوز الحد المسموح به (الحد الأقصى 80 ميغابايت). يرجى تقليل حجم الملف أو استخراج الصوت منه.',
        });
        return;
      }
      res.status(400).json({ error: `خطأ في رفع الملف: ${err.message}` });
      return;
    } else if (err) {
      res.status(400).json({ error: `خطأ في معالجة الملف: ${err.message}` });
      return;
    }
    next();
  });
};

// Safe multer wrapper for chunks (up to 15MB per chunk)
const handleChunkUpload = (req: Request, res: Response, next: NextFunction) => {
  upload.single('chunk')(req, res, (err: any) => {
    if (err) {
      res.status(400).json({ error: `خطأ في معالجة الجزء المرفوع: ${err.message}` });
      return;
    }
    next();
  });
};

// Server-side Gemini client
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// Helper: Extract YouTube ID from varied formats
function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
  );
  return match ? match[1] : null;
}

// Convert/normalize any audio/video buffer using FFmpeg to 16kHz mono MP3
async function normalizeAudioWithFfmpeg(
  inputBuffer: Buffer,
  originalMime: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // If already tiny MP3 (< 5MB), keep as-is
  if (originalMime === 'audio/mp3' && inputBuffer.length < 5 * 1024 * 1024) {
    return { buffer: inputBuffer, mimeType: 'audio/mp3' };
  }

  const tempId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const inPath = `/tmp/${tempId}_in.bin`;
  const outPath = `/tmp/${tempId}_out.mp3`;

  try {
    await fsp.writeFile(inPath, inputBuffer);

    // Run ffmpeg: extract audio (-vn), downsample to 16kHz (-ar 16000), mono (-ac 1), 48k mp3
    await execFileAsync('ffmpeg', [
      '-y',
      '-i',
      inPath,
      '-vn',
      '-ar',
      '16000',
      '-ac',
      '1',
      '-b:a',
      '48k',
      outPath,
    ]);

    const normalizedBuffer = await fsp.readFile(outPath);
    return { buffer: normalizedBuffer, mimeType: 'audio/mp3' };
  } catch (ffmpegErr) {
    console.warn('FFmpeg normalization fallback, using original buffer:', ffmpegErr);
    return { buffer: inputBuffer, mimeType: originalMime };
  } finally {
    fsp.unlink(inPath).catch(() => {});
    fsp.unlink(outPath).catch(() => {});
  }
}

// Models with fallback for audio transcription and text processing
// gemini-3.5-transcribe is the specialized transcription model from Google GenAI SDK
// gemini-3.1-flash-lite provides ultra-fast processing and avoids 503 high-demand spikes
const AUDIO_MODELS = [
  'gemini-3.5-transcribe',
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

const TEXT_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.5-flash',
];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper to sanitize error messages so raw JSON / code 429 / 503 doesn't leak to client UI
function formatUserFriendlyErrorMessage(err: any): string {
  if (!err) return 'حدث خطأ غير متوقع في معالجة الطلب';
  const rawMsg = typeof err === 'string' ? err : err.message || '';

  if (
    rawMsg.includes('"code":429') ||
    rawMsg.includes('RESOURCE_EXHAUSTED') ||
    rawMsg.includes('quota') ||
    rawMsg.includes('Quota exceeded')
  ) {
    return 'تم استنفاد الحصة المؤقتة لخدمة الذكاء الاصطناعي على الخطة التجريبية. يرجى الانتظار بضع دقائق والمحاولة مجدداً.';
  }
  if (
    rawMsg.includes('"code":503') ||
    rawMsg.includes('503') ||
    rawMsg.includes('high demand') ||
    rawMsg.includes('spikes in demand') ||
    rawMsg.includes('Service Unavailable')
  ) {
    return 'تشهد خدمة الذكاء الاصطناعي ضغطاً مؤقتاً في الوقت الراهن. يرجى إعادة المحاولة بعد لحظات.';
  }
  if (rawMsg.includes('LIMIT_FILE_SIZE')) {
    return 'حجم الملف يتجاوز الحد المسموح به. يرجى اختيار ملف أصغر.';
  }

  try {
    const parsed = JSON.parse(rawMsg);
    if (parsed.error && parsed.error.message) {
      if (parsed.error.code === 429) {
        return 'تم استنفاد الحصة المؤقتة للخدمة. يرجى إعادة المحاولة لاحقاً.';
      }
      if (parsed.error.code === 503) {
        return 'تشهد خدمة الذكاء الاصطناعي ضغطاً مؤقتاً في الوقت الراهن. يرجى إعادة المحاولة بعد لحظات.';
      }
      return parsed.error.message;
    }
  } catch {
    // not JSON
  }

  return rawMsg;
}

// Resilient fallback executor across Gemini models
async function executeWithModelFallback(
  models: string[],
  requestFn: (model: string) => Promise<any>
): Promise<any> {
  let lastErr: any = null;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    
    // Attempt request with current model (with 1 quick retry if transient 503)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await requestFn(model);
      } catch (err: any) {
        lastErr = err;
        const status = err?.status || err?.code || 0;
        const msg = String(err?.message || '');
        const isTransient503 = status === 503 || msg.includes('503') || msg.includes('high demand');
        
        // If 503 on first attempt, brief wait and retry same model once
        if (isTransient503 && attempt === 0) {
          await sleep(500);
          continue;
        }
        
        // If it's a 503/429 and we have fallback models left, wait briefly before switching to next candidate
        if (i < models.length - 1) {
          await sleep(400 + Math.floor(Math.random() * 300));
        }
        break; // break retry loop to move to next fallback model
      }
    }
  }

  // All candidates exhausted
  throw new Error(formatUserFriendlyErrorMessage(lastErr));
}

// Core transcription engine using resilient Gemini model fallback
async function runGeminiTranscription(
  ai: GoogleGenAI,
  audioBuffer: Buffer,
  mimeType: string,
  options: {
    language?: string;
    dialect?: string;
    enableDiarization?: boolean;
    enableTimestamps?: boolean;
    contextNotes?: string;
  }
) {
  const {
    language = 'auto',
    dialect = 'any',
    enableDiarization = true,
    enableTimestamps = true,
    contextNotes = '',
  } = options;

  const base64Audio = audioBuffer.toString('base64');

  const systemPrompt = `You are a world-class speech-to-text transcription and audio analysis AI.
Your job is to transcribe the provided audio/video with maximum fidelity, verbatim accuracy, proper punctuation, and correct spelling.

Language specifications:
- Requested Language: ${language === 'auto' ? 'Auto-detect spoken language' : language}
- Requested Dialect/Accent: ${dialect}
- Note: If Arabic is spoken, capture exact words with high precision. Respect modern standard or regional dialects (Egyptian, Gulf, Levantine, Maghrebi, etc.).
- Additional context provided by user: ${contextNotes || 'None'}

Formatting rules:
- Speaker Diarization: ${enableDiarization ? 'Detect different speakers accurately (e.g. "المتحدث 1", "المتحدث 2" or "Speaker 1", "Speaker 2").' : 'Assign to a single speaker.'}
- Timestamps: ${enableTimestamps ? 'Provide start and end timestamps in seconds (float or int) and formatted HH:MM:SS.' : 'Estimate timestamps sequentially.'}
- Output MUST be valid JSON adhering exactly to the requested structure.
- Never wrap the response in markdown backticks or commentary outside JSON.`;

  const audioPart = {
    inlineData: {
      mimeType: mimeType.startsWith('video/') || mimeType.startsWith('audio/') ? mimeType : 'audio/mp3',
      data: base64Audio,
    },
  };

  const textPart = {
    text: `Transcribe this audio recording into a rich, structured JSON response with the following schema:
{
  "title": "A short, descriptive title for the audio content",
  "detectedLanguage": "The detected language and dialect (e.g. العربية - اللهجة المصرية or English - US)",
  "durationEstimate": "Estimated total duration e.g. 02:45",
  "fullText": "The complete, cohesive transcript text with natural paragraphs and correct punctuation",
  "summary": "A 2-4 sentence executive summary of the content",
  "keyPoints": ["Bullet point 1", "Bullet point 2", "Bullet point 3"],
  "speakers": ["List of distinct speakers detected"],
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 4.5,
      "startTime": "00:00:00",
      "endTime": "00:00:04",
      "speaker": "المتحدث 1",
      "text": "Segment transcribed text"
    }
  ]
}

Return ONLY the JSON.`,
  };

  const response = await executeWithModelFallback(AUDIO_MODELS, (model) =>
    ai.models.generateContent({
      model,
      contents: {
        parts: [audioPart, textPart],
      },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: 'application/json',
      },
    })
  );

  const outputText = response.text || '{}';
  try {
    return JSON.parse(outputText);
  } catch {
    const cleaned = outputText.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  }
}

// API 1: Chunked File Upload (bypasses Cloud Run 32MB payload limit)
app.post('/api/upload-chunk', handleChunkUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: 'لم يتم استلام أي جزء من الملف' });
      return;
    }

    const {
      uploadId,
      chunkIndex: rawIndex,
      totalChunks: rawTotal,
      fileName = 'audio.mp3',
      mimeType: rawMime = 'audio/mp3',
      language = 'auto',
      dialect = 'any',
      enableDiarization = 'true',
      enableTimestamps = 'true',
      contextNotes = '',
    } = req.body;

    if (!uploadId) {
      res.status(400).json({ error: 'معرف الرفع (uploadId) مفقود' });
      return;
    }

    const chunkIndex = parseInt(rawIndex, 10);
    const totalChunks = parseInt(rawTotal, 10);

    // Create session directory
    const sessionDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(sessionDir)) {
      await fsp.mkdir(sessionDir, { recursive: true });
    }

    // Save current chunk
    const chunkFilePath = path.join(sessionDir, `chunk_${chunkIndex.toString().padStart(4, '0')}`);
    await fsp.writeFile(chunkFilePath, file.buffer);

    // If not final chunk, return progress
    if (chunkIndex + 1 < totalChunks) {
      res.json({
        success: true,
        progress: Math.round(((chunkIndex + 1) / totalChunks) * 100),
      });
      return;
    }

    // Final chunk received: assemble all chunks in order
    const chunkFiles = (await fsp.readdir(sessionDir)).filter((f) => f.startsWith('chunk_')).sort();

    if (chunkFiles.length !== totalChunks) {
      res.status(400).json({ error: 'بعض أجزاء الملف لم تصل بشكل سليم. يرجى إعادة المحاولة.' });
      return;
    }

    const chunkBuffers: Buffer[] = [];
    for (const fileItem of chunkFiles) {
      const buf = await fsp.readFile(path.join(sessionDir, fileItem));
      chunkBuffers.push(buf);
    }

    const fullBuffer = Buffer.concat(chunkBuffers);

    // Clean up chunks
    fsp.rm(sessionDir, { recursive: true, force: true }).catch(() => {});

    // Normalize audio via FFmpeg
    const { buffer: cleanBuffer, mimeType: cleanMime } = await normalizeAudioWithFfmpeg(
      fullBuffer,
      rawMime
    );

    // Transcribe with Gemini
    const ai = getGeminiClient();
    const parsedData = await runGeminiTranscription(ai, cleanBuffer, cleanMime, {
      language,
      dialect,
      enableDiarization: enableDiarization === 'true',
      enableTimestamps: enableTimestamps === 'true',
      contextNotes,
    });

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Chunk upload error:', error);
    res.status(500).json({
      error: formatUserFriendlyErrorMessage(error),
    });
  }
});

// API 2: Standard Transcribe Audio/Video
app.post('/api/transcribe', handleFileUpload, async (req: Request, res: Response): Promise<void> => {
  try {
    const ai = getGeminiClient();

    let audioBuffer: Buffer | null = null;
    let mimeType = 'audio/mp3';

    if (req.file) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/mp3';
    } else if (req.body.audioBase64) {
      audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
      mimeType = req.body.mimeType || 'audio/webm';
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      res.status(400).json({ error: 'لم يتم استلام أي بيانات صوتية صالحة للمعالجة' });
      return;
    }

    const {
      language = 'auto',
      dialect = 'any',
      enableDiarization = true,
      enableTimestamps = true,
      contextNotes = '',
    } = req.body;

    // Normalize audio via FFmpeg
    const { buffer: cleanBuffer, mimeType: cleanMime } = await normalizeAudioWithFfmpeg(
      audioBuffer,
      mimeType
    );

    const parsedData = await runGeminiTranscription(ai, cleanBuffer, cleanMime, {
      language,
      dialect,
      enableDiarization: enableDiarization === 'true' || enableDiarization === true,
      enableTimestamps: enableTimestamps === 'true' || enableTimestamps === true,
      contextNotes,
    });

    res.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({
      error: formatUserFriendlyErrorMessage(error),
    });
  }
});

// API 3: Process YouTube URL
app.post('/api/youtube', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, language = 'ar' } = req.body;
    if (!url) {
      res.status(400).json({ error: 'يرجى تقديم رابط يوتيوب صالح' });
      return;
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      res.status(400).json({ error: 'تعذر استخراج معرف الفيديو من الرابط المقدم' });
      return;
    }

    const ai = getGeminiClient();
    let rawTranscriptText = '';

    // Attempt 1: Fetch actual YouTube captions using youtube-transcript
    try {
      const transcriptList = await YoutubeTranscript.fetchTranscript(videoId, {
        lang: language === 'ar' ? 'ar' : undefined,
      });

      if (transcriptList && transcriptList.length > 0) {
        rawTranscriptText = transcriptList.map((item) => item.text).join(' ');
      }
    } catch (ytError) {
      console.log('Direct YouTube transcript fetch not available, falling back to Gemini URL analysis...', ytError);
    }

    const prompt = rawTranscriptText
      ? `You are an expert transcript editor and audio content analyzer.
Here is the raw transcript extracted from YouTube video (ID: ${videoId}, URL: ${url}):
"""
${rawTranscriptText.slice(0, 45000)}
"""

Please refine this transcript into a professional, cohesive document.
Fix punctuation, fix misheard words, format into logical speaking segments with estimated timestamps, identify speakers (e.g. "المقدم", "المتحدث 1"), write an executive summary and bullet points.

Return strictly JSON matching this structure:
{
  "title": "Title of the video content",
  "detectedLanguage": "The language of the video",
  "durationEstimate": "Estimated duration",
  "fullText": "Clean, well-punctuated complete text",
  "summary": "Executive summary of the video",
  "keyPoints": ["Key point 1", "Key point 2"],
  "speakers": ["Speaker names or roles"],
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 5.0,
      "startTime": "00:00:00",
      "endTime": "00:00:05",
      "speaker": "المتحدث 1",
      "text": "Segment text..."
    }
  ]
}`
      : `You are an expert YouTube content transcriber and analyst.
The user wants to transcribe and analyze the following YouTube video:
URL: ${url}
Video ID: ${videoId}

Analyze this YouTube video URL, its speech content, topic, and dialogue. Provide a high-accuracy, detailed transcription, executive summary, key takeaways, and timestamped segments in Arabic or the primary spoken language.

Return strictly JSON matching this structure:
{
  "title": "Title of the video content",
  "detectedLanguage": "The language of the video",
  "durationEstimate": "Estimated duration",
  "fullText": "Clean, well-punctuated complete text",
  "summary": "Executive summary of the video",
  "keyPoints": ["Key point 1", "Key point 2", "Key point 3"],
  "speakers": ["Speakers or presenter"],
  "segments": [
    {
      "id": 1,
      "start": 0.0,
      "end": 5.0,
      "startTime": "00:00:00",
      "endTime": "00:00:05",
      "speaker": "المتحدث 1",
      "text": "Segment text..."
    }
  ]
}`;

    const response = await executeWithModelFallback(TEXT_MODELS, (model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
        },
      })
    );

    const outputText = response.text || '{}';
    let parsedData;
    try {
      parsedData = JSON.parse(outputText);
    } catch {
      const cleaned = outputText.replace(/```json\n?|\n?```/g, '').trim();
      parsedData = JSON.parse(cleaned);
    }

    res.json({
      success: true,
      videoId,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('YouTube processing error:', error);
    res.status(500).json({
      error: formatUserFriendlyErrorMessage(error),
    });
  }
});

// API 4: AI Post-Processing Tools
app.post('/api/ai-action', async (req: Request, res: Response): Promise<void> => {
  try {
    const { action, text, targetLanguage = 'ar', segments = [] } = req.body;
    if (!text && (!segments || segments.length === 0)) {
      res.status(400).json({ error: 'لا يوجد نص للمعالجة' });
      return;
    }

    const ai = getGeminiClient();
    let prompt = '';
    const systemInstruction = 'You are an elite linguistic and content intelligence assistant.';

    switch (action) {
      case 'summarize':
        prompt = `قم بتقديم ملخص تنفيذي شامل واحترافي للنص التالي:
1. الفكرة الرئيسية والمغزى العام
2. أهم النقاط والمحاور
3. النتائج والاستخلاصات

النص:
"""
${text}
"""`;
        break;

      case 'action_items':
        prompt = `استخرج بدقة قائمة المهام والتوصيات والقرارات والإجراءات المطلوبة (Action Items) من النص التالي:
"""
${text}
"""`;
        break;

      case 'translate':
        prompt = `Translate the following text into ${targetLanguage} with extreme naturalness and professional phrasing:
"""
${text}
"""`;
        break;

      case 'diacritize':
        prompt = `قم بضبط وتشكيل النص العربي التالي تشكيلاً دقيقاً مع علامات الترقيم الصحيحة:
"""
${text}
"""`;
        break;

      case 'formal_report':
        prompt = `قم بإعادة صياغة هذا الحوار في صورة "محضر اجتماع رسمي أو تقرير احترافي موثق":
- موضوع الاجتماع / اللقاء
- الحضور / المتحدثين
- جدول الأعمال والمواضيع
- ملخص المداولات والنقاشات
- القرارات والتوصيات النهائية

النص:
"""
${text}
"""`;
        break;

      case 'qa':
        prompt = `قم بإنشاء 5 أسئلة وأجوبة ذكية ومبنية على محتوى هذا النص:
"""
${text}
"""`;
        break;

      default:
        res.status(400).json({ error: 'إجراء غير معروف' });
        return;
    }

    const response = await executeWithModelFallback(TEXT_MODELS, (model) =>
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
        },
      })
    );

    res.json({
      success: true,
      result: response.text || '',
    });
  } catch (error: any) {
    console.error('AI Action error:', error);
    res.status(500).json({
      error: formatUserFriendlyErrorMessage(error),
    });
  }
});

// Global Express error handler to ensure JSON response always
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Global server error handler:', err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'حدث خطأ داخلي في الخادم',
  });
});

// Vite middleware in dev or static files in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Sawti server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
