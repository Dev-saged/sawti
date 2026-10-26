/**
 * Direct HTTP Client using XMLHttpRequest.
 * Bypasses iframe proxy monkey-patching on window.fetch which fails on large payloads.
 * Provides real-time upload progress tracking and robust error reporting.
 */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Document | XMLHttpRequestBodyInit | null;
  onProgress?: (percent: number) => void;
  timeoutMs?: number;
}

export function apiRequest<T = any>(url: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = 'POST', headers = {}, body, onProgress, timeoutMs = 300000 } = options;

  return new Promise((resolve, reject) => {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open(method, url, true);
      xhr.timeout = timeoutMs;

      // Set custom headers (omit Content-Type if body is FormData so browser sets boundary automatically)
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Track upload progress
      if (onProgress && xhr.upload) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable && event.total > 0) {
            const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
            onProgress(percent);
          }
        };
      }

      xhr.onload = () => {
        const text = xhr.responseText || '';
        let data: any = {};
        try {
          data = JSON.parse(text);
        } catch {
          if (xhr.status === 413) {
            return reject(
              new Error('حجم الملف الصوتي كبير جداً ويتجاوز سعة الخادم. يرجى اختيار ملف أصغر أو مقطع أقصر.')
            );
          }
          const cleanSnippet = text.replace(/<[^>]*>?/gm, ' ').trim().slice(0, 160);
          return reject(
            new Error(`استجابة غير متوقعة من الخادم (${xhr.status}): ${cleanSnippet || 'خطأ في معالجة الطلب'}`)
          );
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          let errMsg = data.error || `خطأ في الخادم (${xhr.status}) أثناء معالجة الصوت`;
          if (
            typeof errMsg === 'string' &&
            (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota'))
          ) {
            errMsg = 'تم استنفاد الحصة المؤقتة للخدمة الذكية. يرجى الانتظار قليلاً وإعادة المحاولة.';
          } else if (
            typeof errMsg === 'string' &&
            (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('spikes in demand'))
          ) {
            errMsg = 'تشهد خدمة الذكاء الاصطناعي ضغطاً مؤقتاً في الوقت الراهن. يرجى إعادة المحاولة بعد لحظات.';
          } else if (typeof errMsg === 'string' && errMsg.startsWith('{') && errMsg.endsWith('}')) {
            try {
              const parsed = JSON.parse(errMsg);
              errMsg = parsed.error?.message || errMsg;
            } catch {
              // ignore
            }
          }
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        reject(
          new Error(
            'تعذر إكمال الاتصال بالخادم. يرجى التأكد من استقرار شبكة الإنترنت والمحاولة مرة أخرى.'
          )
        );
      };

      xhr.ontimeout = () => {
        reject(
          new Error(
            'استغرقت المعالجة وقتاً أطول من المتوقع وتجاوزت مهلة الانتظار. يرجى تجربة مقطع أقصر.'
          )
        );
      };

      xhr.send(body);
    } catch (err: any) {
      reject(err);
    }
  });
}
