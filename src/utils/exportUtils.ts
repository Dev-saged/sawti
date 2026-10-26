import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from 'docx';

export interface TranscriptSegment {
  id: number;
  start: number;
  end: number;
  startTime: string;
  endTime: string;
  speaker: string;
  text: string;
}

export interface TranscriptionResult {
  title?: string;
  detectedLanguage?: string;
  durationEstimate?: string;
  fullText: string;
  summary?: string;
  keyPoints?: string[];
  speakers?: string[];
  segments: TranscriptSegment[];
  createdAt?: string;
  mediaType?: 'recording' | 'audio' | 'video' | 'youtube';
  sourceName?: string;
}

// 1. Export as Word (.docx)
export async function exportToWord(data: TranscriptionResult, filename = 'transcription'): Promise<void> {
  const isArabic = /[\u0600-\u06FF]/.test(data.fullText || data.title || '');

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch in dxa
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children: [
          // Document Header / Title
          new Paragraph({
            text: data.title || 'تقرير تحويل الصوت إلى نص',
            heading: HeadingLevel.TITLE,
            alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { after: 300 },
          }),

          // Metadata Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: isArabic ? 'تاريخ المعالجة: ' : 'Date: ', bold: true }),
                          new TextRun(new Date().toLocaleDateString(isArabic ? 'ar-EG' : 'en-US')),
                        ],
                        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: isArabic ? 'اللغة المكتشفة: ' : 'Language: ', bold: true }),
                          new TextRun(data.detectedLanguage || (isArabic ? 'العربية' : 'English')),
                        ],
                        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                      }),
                    ],
                  }),
                ],
              }),
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: isArabic ? 'المدة التقديرية: ' : 'Duration: ', bold: true }),
                          new TextRun(data.durationEstimate || 'غير محدد'),
                        ],
                        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                      }),
                    ],
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: isArabic ? 'المتحدثون: ' : 'Speakers: ', bold: true }),
                          new TextRun(data.speakers && data.speakers.length > 0 ? data.speakers.join(', ') : '1'),
                        ],
                        alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),

          // Executive Summary Section (if available)
          ...(data.summary
            ? [
                new Paragraph({
                  text: isArabic ? 'ملخص المحتوى' : 'Executive Summary',
                  heading: HeadingLevel.HEADING_1,
                  alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { before: 400, after: 150 },
                }),
                new Paragraph({
                  text: data.summary,
                  alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { after: 300 },
                }),
              ]
            : []),

          // Key Takeaways Section (if available)
          ...(data.keyPoints && data.keyPoints.length > 0
            ? [
                new Paragraph({
                  text: isArabic ? 'أبرز النقاط والمحاور' : 'Key Points',
                  heading: HeadingLevel.HEADING_2,
                  alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { before: 300, after: 150 },
                }),
                ...data.keyPoints.map(
                  (pt) =>
                    new Paragraph({
                      text: `• ${pt}`,
                      alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                      spacing: { after: 100 },
                    })
                ),
              ]
            : []),

          // Dialogue / Segments Header
          new Paragraph({
            text: isArabic ? 'النص الكامل وتفاصيل الحوار' : 'Full Transcript',
            heading: HeadingLevel.HEADING_1,
            alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
            spacing: { before: 400, after: 200 },
          }),

          // Segments with Speaker & Timestamps
          ...(data.segments && data.segments.length > 0
            ? data.segments.flatMap((seg) => [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `[${seg.startTime} - ${seg.endTime}] `,
                      bold: true,
                      color: '6366F1',
                    }),
                    new TextRun({
                      text: `${seg.speaker}: `,
                      bold: true,
                      color: '1E293B',
                    }),
                    new TextRun({
                      text: seg.text,
                    }),
                  ],
                  alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { after: 150 },
                }),
              ])
            : [
                new Paragraph({
                  text: data.fullText,
                  alignment: isArabic ? AlignmentType.RIGHT : AlignmentType.LEFT,
                  spacing: { after: 200 },
                }),
              ]),

          // Official Copyright Signature
          new Paragraph({
            children: [
              new TextRun({
                text: '❖ جميع الحقوق محفوظة للأستاذ أحمد بشير ❖',
                bold: true,
                color: 'B45309',
                size: 26, // 13pt
                font: 'Traditional Arabic',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 600, after: 200 },
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${filename}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

// 2. Export as SubRip Subtitles (.srt)
export function exportToSRT(segments: TranscriptSegment[], filename = 'subtitles'): void {
  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
  };

  let srtContent = '';
  segments.forEach((seg, index) => {
    srtContent += `${index + 1}\n`;
    srtContent += `${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n`;
    srtContent += `${seg.speaker ? `${seg.speaker}: ` : ''}${seg.text}\n\n`;
  });

  const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${filename}.srt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

// 3. Export as WebVTT Subtitles (.vtt)
export function exportToVTT(segments: TranscriptSegment[], filename = 'subtitles'): void {
  const formatVttTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds % 1) * 1000);
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  };

  let vttContent = 'WEBVTT\n\n';
  segments.forEach((seg, index) => {
    vttContent += `${index + 1}\n`;
    vttContent += `${formatVttTime(seg.start)} --> ${formatVttTime(seg.end)}\n`;
    vttContent += `${seg.speaker ? `<v ${seg.speaker}>` : ''}${seg.text}\n\n`;
  });

  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${filename}.vtt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

// 4. Export as Plain Text (.txt)
export function exportToTXT(data: TranscriptionResult, filename = 'transcription'): void {
  let content = `=== ${data.title || 'تحويل الصوت إلى نص'} ===\n`;
  content += `التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
  if (data.detectedLanguage) content += `اللغة: ${data.detectedLanguage}\n`;
  if (data.durationEstimate) content += `المدة: ${data.durationEstimate}\n`;
  content += `----------------------------------------\n\n`;

  if (data.summary) {
    content += `[ملخص المحتوى]\n${data.summary}\n\n`;
  }

  if (data.keyPoints && data.keyPoints.length > 0) {
    content += `[أهم النقاط]\n`;
    data.keyPoints.forEach((pt) => {
      content += `• ${pt}\n`;
    });
    content += `\n`;
  }

  content += `[النص الكامل]\n`;
  if (data.segments && data.segments.length > 0) {
    data.segments.forEach((seg) => {
      content += `[${seg.startTime}] ${seg.speaker}: ${seg.text}\n`;
    });
  } else {
    content += data.fullText;
  }

  content += `\n\n========================================\n❖ جميع الحقوق محفوظة للأستاذ أحمد بشير ❖\n========================================\n`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = `${filename}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

// 5. Professional Print / PDF Export
export function exportToPDFPrint(data: TranscriptionResult): void {
  const isArabic = /[\u0600-\u06FF]/.test(data.fullText || data.title || '');
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('يرجى السماح بالنوافذ المنبثقة لطباعة / تصدير PDF');
    return;
  }

  const segmentsHtml =
    data.segments && data.segments.length > 0
      ? data.segments
          .map(
            (seg) => `
        <div class="segment">
          <div class="segment-meta">
            <span class="speaker">${seg.speaker}</span>
            <span class="time">${seg.startTime} - ${seg.endTime}</span>
          </div>
          <p class="segment-text">${seg.text}</p>
        </div>`
          )
          .join('')
      : `<p class="full-text">${data.fullText}</p>`;

  const keyPointsHtml =
    data.keyPoints && data.keyPoints.length > 0
      ? `<div class="section">
          <h2>أهم النقاط والمحاور</h2>
          <ul>${data.keyPoints.map((pt) => `<li>${pt}</li>`).join('')}</ul>
        </div>`
      : '';

  const summaryHtml = data.summary
    ? `<div class="section summary-box">
        <h2>الملخص التنفيذي</h2>
        <p>${data.summary}</p>
      </div>`
    : '';

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="${isArabic ? 'ar' : 'en'}" dir="${isArabic ? 'rtl' : 'ltr'}">
    <head>
      <meta charset="UTF-8">
      <title>${data.title || 'تقرير تحويل الصوت إلى نص'}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body {
          font-family: 'Cairo', system-ui, sans-serif;
          margin: 40px;
          color: #1e293b;
          background: #fff;
          line-height: 1.7;
        }
        .header {
          border-bottom: 2px solid #6366f1;
          padding-bottom: 20px;
          margin-bottom: 24px;
        }
        h1 {
          margin: 0 0 10px 0;
          color: #0f172a;
          font-size: 24px;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          background: #f8fafc;
          padding: 14px;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          font-size: 14px;
        }
        .summary-box {
          background: #eef2ff;
          border-right: 4px solid #6366f1;
          border-left: 4px solid #6366f1;
          padding: 16px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .summary-box h2 {
          color: #4338ca;
          margin-top: 0;
          font-size: 18px;
        }
        .section {
          margin: 24px 0;
        }
        .section h2 {
          font-size: 18px;
          color: #334155;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 6px;
        }
        ul {
          padding-right: 20px;
        }
        li {
          margin-bottom: 6px;
        }
        .segment {
          margin-bottom: 16px;
          padding: 12px;
          background: #fdfdfd;
          border: 1px solid #f1f5f9;
          border-radius: 6px;
          page-break-inside: avoid;
        }
        .segment-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
          font-size: 13px;
        }
        .speaker {
          font-weight: 700;
          color: #4f46e5;
        }
        .time {
          color: #64748b;
          font-family: monospace;
          background: #f1f5f9;
          padding: 2px 8px;
          border-radius: 4px;
        }
        .segment-text {
          margin: 0;
          font-size: 15px;
          color: #334155;
        }
        .pdf-signature-card {
          margin-top: 40px;
          padding: 18px 24px;
          border: 2px solid #f59e0b;
          background: #fffbeb;
          border-radius: 12px;
          text-align: center;
          page-break-inside: avoid;
        }
        .pdf-signature-text {
          font-family: 'Aref Ruqaa', 'Amiri', serif;
          font-size: 24px;
          font-weight: bold;
          color: #b45309;
          margin: 6px 0;
          letter-spacing: 0.5px;
        }
        .pdf-signature-sub {
          font-size: 12px;
          color: #92400e;
        }
        @media print {
          body {
            margin: 20px;
          }
          .no-print {
            display: none;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.title || 'تقرير تحويل الصوت إلى نص'}</h1>
        <div class="meta-grid">
          <div><strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-EG')}</div>
          <div><strong>اللغة المكتشفة:</strong> ${data.detectedLanguage || 'العربية'}</div>
          <div><strong>المدة التقديرية:</strong> ${data.durationEstimate || 'غير محدد'}</div>
          <div><strong>المتحدثون:</strong> ${data.speakers ? data.speakers.join(', ') : '1'}</div>
        </div>
      </div>

      ${summaryHtml}
      ${keyPointsHtml}

      <div class="section">
        <h2>النص الكامل وتفاصيل الحوار</h2>
        ${segmentsHtml}
      </div>

      <!-- Prominent Calligraphic Signature in Printed PDF -->
      <div class="pdf-signature-card">
        <div style="font-size: 18px; color: #d97706;">❖</div>
        <div class="pdf-signature-text">جميع الحقوق محفوظة للأستاذ أحمد بشير</div>
        <div class="pdf-signature-sub">منظومة صوتي الذكية لتحويل الصوت والفيديو واليوتيوب إلى نصوص</div>
        <div style="font-size: 18px; color: #d97706; margin-top: 4px;">❖</div>
      </div>

      <script>
        window.onload = function() {
          window.print();
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}
