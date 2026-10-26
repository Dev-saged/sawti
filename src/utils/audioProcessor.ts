/**
 * Audio processing utilities for extracting audio from video/audio files
 * and compressing for optimal speech-to-text transmission.
 */

// Encode AudioBuffer to 16-bit PCM WAV (downsampled to 16kHz mono)
function audioBufferToWav(buffer: AudioBuffer, targetSampleRate = 16000): Blob {
  const numChannels = 1; // mono is ideal for speech recognition
  const sourceSampleRate = buffer.sampleRate;
  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.round(buffer.length / ratio);

  // Mix down channels to mono
  const inputLeft = buffer.getChannelData(0);
  const inputRight = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const mono = new Float32Array(buffer.length);

  if (inputRight) {
    for (let i = 0; i < buffer.length; i++) {
      mono[i] = (inputLeft[i] + inputRight[i]) / 2;
    }
  } else {
    mono.set(inputLeft);
  }

  // Resample
  const resampled = new Float32Array(targetLength);
  for (let i = 0; i < targetLength; i++) {
    const originIdx = Math.floor(i * ratio);
    resampled[i] = mono[originIdx] || 0;
  }

  // Create WAV container
  const byteRate = targetSampleRate * numChannels * 2; // 16-bit = 2 bytes
  const blockAlign = numChannels * 2;
  const dataSize = targetLength * 2;
  const totalSize = 36 + dataSize;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  // Write RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true);
  view.setUint32(24, targetSampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // BitsPerSample
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Write 16-bit PCM samples with clipping protection
  let offset = 44;
  for (let i = 0; i < targetLength; i++) {
    const s = Math.max(-1, Math.min(1, resampled[i]));
    const sample = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Extracts and optimizes audio from a video or audio file.
 * If file is already small audio (< 12MB), leaves it untouched.
 * For videos or larger files, extracts audio track and converts to 16kHz mono WAV.
 */
export async function optimizeAudioFile(
  file: File,
  onStatusUpdate?: (status: string) => void
): Promise<{ blob: Blob; mimeType: string; isExtracted: boolean }> {
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mkv|mov|webm|avi|flv)$/i.test(file.name);
  const isLarge = file.size > 12 * 1024 * 1024; // > 12MB

  // If already small audio file, pass as-is
  if (!isVideo && !isLarge) {
    return { blob: file, mimeType: file.type || 'audio/mp3', isExtracted: false };
  }

  // Attempt browser-based extraction & compression
  try {
    if (onStatusUpdate) {
      onStatusUpdate(isVideo ? 'جاري استخراج الصوت النقي من الفيديو...' : 'جاري ضغط وتحسين جودة الصوت...');
    }

    const arrayBuffer = await file.arrayBuffer();
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) {
      return { blob: file, mimeType: file.type || 'audio/mp3', isExtracted: false };
    }

    const audioCtx = new AudioContextClass();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close().catch(() => {});

    if (onStatusUpdate) {
      onStatusUpdate('جاري ترميز الصوت بدقة 16kHz المخصصة للذكاء الاصطناعي...');
    }

    const wavBlob = audioBufferToWav(audioBuffer, 16000);
    return {
      blob: wavBlob,
      mimeType: 'audio/wav',
      isExtracted: true,
    };
  } catch (err) {
    console.warn('Browser audio extraction failed, falling back to original file:', err);
    return { blob: file, mimeType: file.type || 'audio/mp3', isExtracted: false };
  }
}
