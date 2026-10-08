import JSZip from 'jszip';
import mammoth from 'mammoth';

export interface ZipEntryItem {
  name: string;
  relativePath: string;
  isFolder: boolean;
  size: number;
  date: Date;
}

export interface PptxSlide {
  slideNumber: number;
  title: string;
  content: string[];
}

/**
 * Converts a base64 Data URL or raw base64 string to an ArrayBuffer safely
 */
export async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  if (!dataUrl) return new ArrayBuffer(0);

  // Fast native path for data URLs
  if (dataUrl.startsWith('data:') || dataUrl.startsWith('blob:')) {
    try {
      const res = await fetch(dataUrl);
      return await res.arrayBuffer();
    } catch {
      // Fallback to manual parsing below
    }
  }

  // Manual safe base64 decode
  try {
    const commaIndex = dataUrl.indexOf(',');
    let base64 = commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;
    // Clean whitespace and URL-encoded spaces
    base64 = base64.replace(/\s+/g, '').replace(/%20/g, '');

    // Pad base64 if needed
    while (base64.length % 4 !== 0) {
      base64 += '=';
    }

    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (err) {
    console.error('Failed converting data URL to ArrayBuffer:', err);
    return new ArrayBuffer(0);
  }
}

/**
 * Inspects a ZIP archive and returns file listings
 */
export async function inspectZipArchive(dataUrl: string): Promise<ZipEntryItem[]> {
  const buffer = await dataUrlToArrayBuffer(dataUrl);
  if (buffer.byteLength === 0) return [];

  const zip = await JSZip.loadAsync(buffer);
  const items: ZipEntryItem[] = [];

  zip.forEach((relativePath, zipEntry) => {
    // Skip internal Mac system files
    if (relativePath.startsWith('__MACOSX') || relativePath.endsWith('.DS_Store')) return;

    items.push({
      name: relativePath.split('/').filter(Boolean).pop() || relativePath,
      relativePath,
      isFolder: zipEntry.dir,
      size: (zipEntry as any)._data?.uncompressedSize || 0,
      date: zipEntry.date || new Date(),
    });
  });

  // Sort folders first, then alphabetically
  return items.sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.relativePath.localeCompare(b.relativePath);
  });
}

/**
 * Extracts a specific file from a ZIP archive as text or dataUrl
 */
export async function readZipEntryContent(
  dataUrl: string,
  entryPath: string
): Promise<{ text?: string; dataUrl?: string }> {
  const buffer = await dataUrlToArrayBuffer(dataUrl);
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(entryPath);
  if (!file) throw new Error('File not found in archive');

  const ext = entryPath.split('.').pop()?.toLowerCase() || '';
  const isText = [
    'txt', 'md', 'json', 'js', 'ts', 'jsx', 'tsx', 'html', 'css',
    'xml', 'csv', 'svg', 'py', 'yml', 'yaml', 'sql', 'sh'
  ].includes(ext);

  if (isText) {
    const text = await file.async('string');
    return { text };
  } else {
    const uint8 = await file.async('uint8array');
    let mime = 'application/octet-stream';
    if (ext === 'png') mime = 'image/png';
    else if (ext === 'jpg' || ext === 'jpeg') mime = 'image/jpeg';
    else if (ext === 'gif') mime = 'image/gif';
    else if (ext === 'webp') mime = 'image/webp';
    else if (ext === 'pdf') mime = 'application/pdf';

    // Convert uint8 to base64 safely
    let binary = '';
    const len = uint8.byteLength;
    const chunkSize = 8192;
    for (let i = 0; i < len; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        uint8.subarray(i, Math.min(i + chunkSize, len)) as any
      );
    }
    const b64 = btoa(binary);
    return { dataUrl: `data:${mime};base64,${b64}` };
  }
}

/**
 * Parses DOCX document buffer and converts to HTML
 */
export async function parseDocxToHtml(dataUrl: string): Promise<string> {
  const arrayBuffer = await dataUrlToArrayBuffer(dataUrl);
  if (arrayBuffer.byteLength === 0) {
    return '<p class="text-zinc-400 italic">Empty file.</p>';
  }

  try {
    const result = await mammoth.convertToHtml({ arrayBuffer });
    if (result.value && result.value.trim().length > 0) {
      return result.value;
    }
  } catch (docxError) {
    console.warn('Mammoth DOCX parser notice, attempting fallback string extraction:', docxError);
  }

  // Fallback for legacy .doc or binary Word documents:
  // Extract printable text streams from binary buffer
  const extracted = extractTextFromBinaryBuffer(arrayBuffer);
  if (extracted.trim().length > 0) {
    const paragraphs = extracted
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    return paragraphs
      .map((p, idx) => {
        if (idx === 0 && p.length < 100) {
          return `<h1 class="text-xl font-bold mb-3">${escapeHtml(p)}</h1>`;
        }
        return `<p class="mb-3 leading-relaxed">${escapeHtml(p)}</p>`;
      })
      .join('');
  }

  return '<p class="text-zinc-500 italic">Could not extract Word document text. Please download the file to view original formatting.</p>';
}

/**
 * Parses PPTX presentation buffer and extracts slides
 */
export async function parsePptxSlides(dataUrl: string): Promise<PptxSlide[]> {
  const buffer = await dataUrlToArrayBuffer(dataUrl);
  if (buffer.byteLength === 0) return [];

  try {
    const zip = await JSZip.loadAsync(buffer);
    const slides: PptxSlide[] = [];

    // Look for ppt/slides/slide*.xml
    const slidePaths: string[] = [];
    zip.forEach((relativePath) => {
      if (relativePath.match(/^ppt\/slides\/slide\d+\.xml$/i)) {
        slidePaths.push(relativePath);
      }
    });

    // Sort slides numerically: slide1, slide2, slide3...
    slidePaths.sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

    for (let i = 0; i < slidePaths.length; i++) {
      const path = slidePaths[i];
      const xmlText = await zip.file(path)?.async('string');
      if (!xmlText) continue;

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

      // Use localName to correctly bypass XML namespace prefixes (e.g. <a:p>, <a:t>, <p:sp>)
      const allElements = Array.from(xmlDoc.getElementsByTagName('*'));
      const paragraphElements = allElements.filter((el) => el.localName === 'p');

      const paragraphTexts: string[] = [];
      for (const p of paragraphElements) {
        // Collect all text nodes (<a:t> or <t>) inside this paragraph
        const pDescendants = Array.from(p.getElementsByTagName('*'));
        const textNodes = pDescendants.filter((el) => el.localName === 't');
        const text = textNodes
          .map((t) => t.textContent || '')
          .join('')
          .trim();

        if (text.length > 0) {
          paragraphTexts.push(text);
        }
      }

      // If no paragraphs were found via localName 'p', fallback to collecting all 't' nodes
      if (paragraphTexts.length === 0) {
        const textNodes = allElements.filter((el) => el.localName === 't');
        for (const t of textNodes) {
          const val = t.textContent?.trim();
          if (val) paragraphTexts.push(val);
        }
      }

      const title = paragraphTexts.length > 0 ? paragraphTexts[0] : `Slide ${i + 1}`;
      const content = paragraphTexts.length > 1 ? paragraphTexts.slice(1) : [];

      slides.push({
        slideNumber: i + 1,
        title,
        content,
      });
    }

    if (slides.length > 0) {
      return slides;
    }
  } catch (zipError) {
    console.warn('PPTX zip parse error, attempting legacy presentation extraction:', zipError);
  }

  // Fallback for legacy .ppt (binary format) or unstructured presentation
  const extracted = extractTextFromBinaryBuffer(buffer);
  if (extracted.trim().length > 0) {
    // Split extracted presentation text by major blocks
    const chunks = extracted
      .split(/\n{3,}|\x0C/)
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    return chunks.slice(0, 30).map((chunk, idx) => {
      const lines = chunk
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const title = lines[0] || `Slide ${idx + 1}`;
      const content = lines.slice(1);

      return {
        slideNumber: idx + 1,
        title,
        content,
      };
    });
  }

  return [];
}

/**
 * Extracts printable ASCII and UTF-8 strings from binary buffers (for legacy .doc and .ppt)
 */
function extractTextFromBinaryBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const len = bytes.length;
  let result = '';
  let currentRun = '';

  for (let i = 0; i < len; i++) {
    const byte = bytes[i];
    // Printable ASCII or newline/tab
    if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
      currentRun += String.fromCharCode(byte);
    } else {
      if (currentRun.length >= 4) {
        result += currentRun.trim() + '\n';
      }
      currentRun = '';
    }
  }
  if (currentRun.length >= 4) {
    result += currentRun.trim() + '\n';
  }

  return result.replace(/\n{3,}/g, '\n\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
