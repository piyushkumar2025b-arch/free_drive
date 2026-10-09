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

export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: string[][];
  totalRows: number;
}

/**
 * Converts a 0-indexed column integer to Excel-style letters (0 -> 'A', 25 -> 'Z', 26 -> 'AA')
 */
export function getColumnLetter(colIndex: number): string {
  let letter = '';
  let temp = colIndex;
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

/**
 * Converts an Excel cell coordinate column letters to 0-indexed number ('A' -> 0, 'B' -> 1, 'AA' -> 26)
 */
function colLetterToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + (colStr.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
}

/**
 * Converts a base64 Data URL or raw base64 string to an ArrayBuffer safely
 */
export async function dataUrlToArrayBuffer(dataUrl: string): Promise<ArrayBuffer> {
  if (!dataUrl) return new ArrayBuffer(0);

  // If it's a blob URL, fetch is the standard method
  if (dataUrl.startsWith('blob:')) {
    try {
      const res = await fetch(dataUrl);
      return await res.arrayBuffer();
    } catch (e) {
      console.warn('Failed fetching blob URL to buffer:', e);
      return new ArrayBuffer(0);
    }
  }

  // Fast direct synchronous decode for base64 data URLs
  if (dataUrl.startsWith('data:')) {
    const commaIndex = dataUrl.indexOf(',');
    if (commaIndex === -1) return new ArrayBuffer(0);
    const meta = dataUrl.substring(0, commaIndex);
    const rawData = dataUrl.substring(commaIndex + 1);

    if (meta.includes(';base64')) {
      try {
        const cleanBase64 = rawData.replace(/\s+/g, '');
        const binaryString = atob(cleanBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
      } catch (err) {
        console.warn('atob manual decode failed, trying fetch fallback:', err);
      }
    } else {
      // URL-encoded plain text data URL
      try {
        const decodedText = decodeURIComponent(rawData);
        const encoder = new TextEncoder();
        return encoder.encode(decodedText).buffer;
      } catch {
        const encoder = new TextEncoder();
        return encoder.encode(rawData).buffer;
      }
    }
  }

  // General fallback using fetch
  try {
    const res = await fetch(dataUrl);
    return await res.arrayBuffer();
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

/**
 * Parses XLSX Excel spreadsheet buffer and extracts sheets with cells
 */
export async function parseXlsxSpreadsheet(dataUrl: string): Promise<XlsxSheet[]> {
  const buffer = await dataUrlToArrayBuffer(dataUrl);
  if (buffer.byteLength === 0) return [];

  try {
    const zip = await JSZip.loadAsync(buffer);

    // 1. Extract shared strings table
    const sharedStrings: string[] = [];
    const sharedStringsFile = zip.file('xl/sharedStrings.xml');
    if (sharedStringsFile) {
      const xml = await sharedStringsFile.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const siNodes = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'si');
      for (const si of siNodes) {
        const tNodes = Array.from(si.getElementsByTagName('*')).filter((el) => el.localName === 't');
        const text = tNodes.map((t) => t.textContent || '').join('');
        sharedStrings.push(text);
      }
    }

    // 2. Discover sheets and their relationship IDs from workbook.xml
    const sheetDefs: { name: string; rId: string; sheetId: string }[] = [];
    const workbookFile = zip.file('xl/workbook.xml');
    if (workbookFile) {
      const xml = await workbookFile.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const sheetNodes = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'sheet');
      for (const s of sheetNodes) {
        const name = s.getAttribute('name') || `Sheet ${sheetDefs.length + 1}`;
        const sheetId = s.getAttribute('sheetId') || String(sheetDefs.length + 1);
        const rId =
          s.getAttribute('r:id') ||
          s.getAttribute('id') ||
          `rId${sheetDefs.length + 1}`;
        sheetDefs.push({ name, rId, sheetId });
      }
    }

    // 3. Map relationship IDs to file paths from workbook.xml.rels
    const relMap = new Map<string, string>();
    const relsFile = zip.file('xl/_rels/workbook.xml.rels');
    if (relsFile) {
      const xml = await relsFile.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');
      const relNodes = Array.from(doc.getElementsByTagName('*')).filter((el) => el.localName === 'Relationship');
      for (const r of relNodes) {
        const id = r.getAttribute('Id');
        const target = r.getAttribute('Target');
        if (id && target) {
          relMap.set(id, target.startsWith('xl/') ? target : `xl/${target.replace(/^\//, '')}`);
        }
      }
    }

    const sheets: XlsxSheet[] = [];

    // Fallback sheet targets if rels missing
    const resolvedSheets = sheetDefs.length > 0
      ? sheetDefs
      : [{ name: 'Sheet 1', rId: 'rId1', sheetId: '1' }];

    for (let sIdx = 0; sIdx < resolvedSheets.length; sIdx++) {
      const sDef = resolvedSheets[sIdx];
      let targetPath = relMap.get(sDef.rId) || `xl/worksheets/sheet${sIdx + 1}.xml`;
      let sheetFile = zip.file(targetPath);
      if (!sheetFile) {
        sheetFile = zip.file(`xl/worksheets/sheet${sIdx + 1}.xml`);
      }
      if (!sheetFile) {
        // Find any matching worksheet
        const candidates: string[] = [];
        zip.forEach((path) => {
          if (path.match(/^xl\/worksheets\/sheet\d+\.xml$/i)) candidates.push(path);
        });
        if (candidates[sIdx]) sheetFile = zip.file(candidates[sIdx]);
      }
      if (!sheetFile) continue;

      const xml = await sheetFile.async('string');
      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'text/xml');

      const allElements = Array.from(doc.getElementsByTagName('*'));
      const rowElements = allElements.filter((el) => el.localName === 'row');

      const sheetGrid: string[][] = [];
      let maxCols = 0;

      for (const rEl of rowElements) {
        const cellElements = Array.from(rEl.getElementsByTagName('*')).filter((el) => el.localName === 'c');
        const rowCells: string[] = [];

        for (const cEl of cellElements) {
          const coord = cEl.getAttribute('r') || '';
          const colLetters = coord.replace(/\d+/g, '').toUpperCase();
          const colIndex = colLetters ? colLetterToIndex(colLetters) : rowCells.length;

          const cellType = cEl.getAttribute('t');
          let cellValue = '';

          if (cellType === 'inlineStr') {
            const tEl = Array.from(cEl.getElementsByTagName('*')).find((el) => el.localName === 't');
            cellValue = tEl?.textContent || '';
          } else {
            const vEl = Array.from(cEl.getElementsByTagName('*')).find((el) => el.localName === 'v');
            if (vEl && vEl.textContent) {
              if (cellType === 's') {
                const sIndex = parseInt(vEl.textContent, 10);
                cellValue = sharedStrings[sIndex] !== undefined ? sharedStrings[sIndex] : vEl.textContent;
              } else if (cellType === 'b') {
                cellValue = vEl.textContent === '1' ? 'TRUE' : 'FALSE';
              } else {
                cellValue = vEl.textContent;
              }
            }
          }

          // Ensure array is large enough for sparse columns
          while (rowCells.length < colIndex) {
            rowCells.push('');
          }
          rowCells[colIndex] = cellValue;
        }

        if (rowCells.length > maxCols) {
          maxCols = rowCells.length;
        }
        sheetGrid.push(rowCells);
      }

      // Pad all rows to uniform column count
      const uniformRows = sheetGrid.map((r) => {
        const padded = [...r];
        while (padded.length < maxCols) {
          padded.push('');
        }
        return padded;
      });

      if (uniformRows.length > 0) {
        const headers = uniformRows[0].map((h, i) => h.trim() || `Column ${getColumnLetter(i)}`);
        const dataRows = uniformRows.slice(1, 200); // Display up to 200 rows in preview
        sheets.push({
          name: sDef.name,
          headers,
          rows: dataRows,
          totalRows: Math.max(0, uniformRows.length - 1),
        });
      }
    }

    if (sheets.length > 0) {
      return sheets;
    }
  } catch (err) {
    console.warn('XLSX parsing failed, fallback will be used:', err);
  }

  return [];
}
