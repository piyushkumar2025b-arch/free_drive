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
 * Converts a base64 Data URL or raw base64 string to an ArrayBuffer
 */
export function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
  const base64Index = dataUrl.indexOf('base64,');
  const base64 = base64Index !== -1 ? dataUrl.substring(base64Index + 7) : dataUrl;
  const binaryString = atob(base64.trim());
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Inspects a ZIP archive and returns file listings
 */
export async function inspectZipArchive(dataUrl: string): Promise<ZipEntryItem[]> {
  const buffer = dataUrlToArrayBuffer(dataUrl);
  const zip = await JSZip.loadAsync(buffer);
  const items: ZipEntryItem[] = [];

  zip.forEach((relativePath, zipEntry) => {
    items.push({
      name: relativePath.split('/').filter(Boolean).pop() || relativePath,
      relativePath,
      isFolder: zipEntry.dir,
      size: (zipEntry as any)._data?.uncompressedSize || 0,
      date: zipEntry.date,
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
 * Extracts a specific file from a ZIP archive as string or dataUrl
 */
export async function readZipEntryContent(
  dataUrl: string,
  entryPath: string
): Promise<{ text?: string; dataUrl?: string }> {
  const buffer = dataUrlToArrayBuffer(dataUrl);
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(entryPath);
  if (!file) throw new Error('File not found in archive');

  const ext = entryPath.split('.').pop()?.toLowerCase() || '';
  const isText = ['txt', 'md', 'json', 'js', 'ts', 'html', 'css', 'xml', 'csv', 'svg'].includes(ext);

  if (isText) {
    const text = await file.async('string');
    return { text };
  } else {
    const base64 = await file.async('base64');
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
    return { dataUrl: `data:${mime};base64,${base64}` };
  }
}

/**
 * Parses DOCX document buffer and converts to HTML
 */
export async function parseDocxToHtml(dataUrl: string): Promise<string> {
  const arrayBuffer = dataUrlToArrayBuffer(dataUrl);
  const result = await mammoth.convertToHtml({ arrayBuffer });
  return result.value || '<p><em>Empty Word document.</em></p>';
}

/**
 * Parses PPTX presentation buffer and extracts slides
 */
export async function parsePptxSlides(dataUrl: string): Promise<PptxSlide[]> {
  const buffer = dataUrlToArrayBuffer(dataUrl);
  const zip = await JSZip.loadAsync(buffer);
  const slides: PptxSlide[] = [];

  // Look for ppt/slides/slide*.xml
  const slidePaths: string[] = [];
  zip.forEach((relativePath) => {
    if (relativePath.match(/^ppt\/slides\/slide\d+\.xml$/i)) {
      slidePaths.push(relativePath);
    }
  });

  // Sort slides by number slide1, slide2, etc.
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

    // Extract all text nodes (<a:t>)
    const textNodes = xmlDoc.getElementsByTagName('a:t');
    const textItems: string[] = [];
    for (let j = 0; j < textNodes.length; j++) {
      const val = textNodes[j].textContent?.trim();
      if (val) textItems.push(val);
    }

    const title = textItems.length > 0 ? textItems[0] : `Slide ${i + 1}`;
    const content = textItems.length > 1 ? textItems.slice(1) : [];

    slides.push({
      slideNumber: i + 1,
      title,
      content,
    });
  }

  return slides;
}
