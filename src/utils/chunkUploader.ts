import { apiRequest } from './httpClient';

export interface UploadMetadata {
  fileName: string;
  mimeType: string;
  language: string;
  dialect: string;
  enableDiarization: boolean;
  enableTimestamps: boolean;
  contextNotes: string;
}

/**
 * Uploads any audio or video file in safe 6MB chunks.
 * Bypasses Cloud Run's 32MB request limit and proxy connection drops.
 */
export async function uploadFileInChunks(
  fileOrBlob: Blob,
  metadata: UploadMetadata,
  onProgress: (status: string, percent: number) => void
): Promise<any> {
  const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunk size (well within Cloud Run limit)
  const totalSize = fileOrBlob.size;
  const totalChunks = Math.max(1, Math.ceil(totalSize / CHUNK_SIZE));
  const uploadId = `upl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE;
    const end = Math.min(totalSize, start + CHUNK_SIZE);
    const chunkBlob = fileOrBlob.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunkBlob, 'chunk.bin');
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(chunkIndex));
    formData.append('totalChunks', String(totalChunks));
    formData.append('fileName', metadata.fileName);
    formData.append('mimeType', metadata.mimeType);
    formData.append('language', metadata.language);
    formData.append('dialect', metadata.dialect);
    formData.append('enableDiarization', String(metadata.enableDiarization));
    formData.append('enableTimestamps', String(metadata.enableTimestamps));
    formData.append('contextNotes', metadata.contextNotes);

    const isLastChunk = chunkIndex + 1 === totalChunks;

    if (totalChunks > 1) {
      const chunkPct = Math.round(((chunkIndex + 1) / totalChunks) * 100);
      onProgress(
        isLastChunk
          ? 'اكتمل الرفع، جاري معالجة الصوت بالذكاء الاصطناعي...'
          : `جاري رفع الجزء ${chunkIndex + 1} من ${totalChunks} (${chunkPct}%)...`,
        chunkPct
      );
    } else {
      onProgress('جاري إرسال البيانات...', 80);
    }

    const res = await apiRequest<{ success: boolean; progress?: number; data?: any }>('/api/upload-chunk', {
      method: 'POST',
      body: formData,
      timeoutMs: isLastChunk ? 300000 : 90000,
    });

    if (isLastChunk) {
      return res.data;
    }
  }
}
