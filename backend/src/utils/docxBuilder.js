const zlib = require('zlib');
const mammoth = require('mammoth');

/**
 * Bảng tính CRC32 chuẩn cho định dạng ZIP (.docx OpenXML)
 */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

/**
 * Đóng gói danh sách [{ name, data: Buffer }] thành tệp ZIP chuẩn (.docx)
 */
const createZipBuffer = (entries) => {
  const localFileHeaders = [];
  const centralDirHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressedBuf = Buffer.isBuffer(entry.data)
      ? entry.data
      : Buffer.from(String(entry.data), 'utf8');
    const compressedBuf = zlib.deflateRawSync(uncompressedBuf);
    const entryCrc = crc32(uncompressedBuf);

    // Local file header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed to extract (2.0)
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(8, 8); // compression method: deflate (8)
    localHeader.writeUInt16LE(0, 10); // mod time
    localHeader.writeUInt16LE(0x21, 12); // mod date
    localHeader.writeUInt32LE(entryCrc, 14);
    localHeader.writeUInt32LE(compressedBuf.length, 18);
    localHeader.writeUInt32LE(uncompressedBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra field length

    const localChunk = Buffer.concat([localHeader, nameBuf, compressedBuf]);
    localFileHeaders.push(localChunk);

    // Central directory file header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(8, 10); // compression method: deflate
    centralHeader.writeUInt16LE(0, 12); // mod time
    centralHeader.writeUInt16LE(0x21, 14); // mod date
    centralHeader.writeUInt32LE(entryCrc, 16);
    centralHeader.writeUInt32LE(compressedBuf.length, 20);
    centralHeader.writeUInt32LE(uncompressedBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk number
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset of local header

    centralDirHeaders.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localChunk.length;
  }

  const centralDirBuf = Buffer.concat(centralDirHeaders);
  const endOfCentralDir = Buffer.alloc(22);
  endOfCentralDir.writeUInt32LE(0x06054b50, 0); // EOCD signature
  endOfCentralDir.writeUInt16LE(0, 4); // disk number
  endOfCentralDir.writeUInt16LE(0, 6); // disk with central dir
  endOfCentralDir.writeUInt16LE(entries.length, 8);
  endOfCentralDir.writeUInt16LE(entries.length, 10);
  endOfCentralDir.writeUInt32LE(centralDirBuf.length, 12);
  endOfCentralDir.writeUInt32LE(offset, 16);
  endOfCentralDir.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localFileHeaders, centralDirBuf, endOfCentralDir]);
};

const escapeXml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const decodeHtmlEntities = (str = '') =>
  String(str)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));

/**
 * Chuyển đổi HTML sang văn bản thuần (dùng cho extractedText và tìm kiếm AI/RAG)
 */
const htmlToPlainText = (html = '') => {
  if (!html) return '';
  const withBreaks = String(html)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  return decodeHtmlEntities(withBreaks)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const plainTextToHtml = (text = '') => {
  if (!text) return '<p></p>';
  return String(text)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `<p>${escapeXml(line)}</p>`)
    .join('');
};

/**
 * Tách các đoạn inline run (đậm, nghiêng, gạch chân) trong 1 block HTML thành mảng runs cho OpenXML
 */
const parseInlineRuns = (innerHtml = '') => {
  const runs = [];
  const tokenRegex = /(<\/?(?:b|strong|i|em|u|br)\b[^>]*>)|([^<]+)/gi;
  let bold = false;
  let italic = false;
  let underline = false;
  let match;

  while ((match = tokenRegex.exec(innerHtml)) !== null) {
    const tag = match[1];
    const textChunk = match[2];

    if (tag) {
      const lower = tag.toLowerCase();
      if (lower.startsWith('<br')) {
        runs.push({ break: true });
      } else if (lower.startsWith('<b') || lower.startsWith('<strong')) {
        bold = true;
      } else if (lower.startsWith('</b') || lower.startsWith('</strong')) {
        bold = false;
      } else if (lower.startsWith('<i') || lower.startsWith('<em')) {
        italic = true;
      } else if (lower.startsWith('</i') || lower.startsWith('</em')) {
        italic = false;
      } else if (lower.startsWith('<u')) {
        underline = true;
      } else if (lower.startsWith('</u')) {
        underline = false;
      }
    } else if (textChunk) {
      const decoded = decodeHtmlEntities(textChunk);
      if (decoded.length > 0) {
        runs.push({
          text: decoded,
          bold,
          italic,
          underline
        });
      }
    }
  }

  return runs;
};

/**
 * Chuyển đổi HTML hoặc văn bản sang cấu trúc các đoạn văn OpenXML (<w:p>)
 */
const buildDocumentXmlFromHtml = (htmlContent = '') => {
  const raw = String(htmlContent || '').trim();
  const normalized = raw.startsWith('<') ? raw : plainTextToHtml(raw);

  // Tách thành từng block theo thẻ đóng hoặc dòng
  const blockRegex = /<(h1|h2|h3|p|div|li|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
  const paragraphs = [];
  let match;

  while ((match = blockRegex.exec(normalized)) !== null) {
    const tag = match[1].toLowerCase();
    const attrs = match[2] || '';
    const inner = match[3] || '';

    let align = null;
    if (/text-align\s*:\s*center/i.test(attrs)) align = 'center';
    else if (/text-align\s*:\s*right/i.test(attrs)) align = 'right';
    else if (/text-align\s*:\s*justify/i.test(attrs)) align = 'both';

    paragraphs.push({
      tag,
      align,
      runs: parseInlineRuns(inner)
    });
  }

  // Fallback nếu người dùng nhập văn bản không bọc trong thẻ block
  if (paragraphs.length === 0) {
    const lines = htmlToPlainText(normalized).split('\n');
    for (const line of lines) {
      paragraphs.push({
        tag: 'p',
        align: null,
        runs: line ? [{ text: line, bold: false, italic: false, underline: false }] : []
      });
    }
  }

  const wParagraphs = paragraphs
    .map((p) => {
      const pPrParts = [];
      if (p.tag === 'h1') {
        pPrParts.push('<w:pStyle w:val="Heading1"/>');
      } else if (p.tag === 'h2') {
        pPrParts.push('<w:pStyle w:val="Heading2"/>');
      } else if (p.tag === 'h3') {
        pPrParts.push('<w:pStyle w:val="Heading3"/>');
      }
      if (p.align) {
        pPrParts.push(`<w:jc w:val="${p.align}"/>`);
      }
      const pPr = pPrParts.length > 0 ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';

      const prefixRun =
        p.tag === 'li'
          ? '<w:r><w:t xml:space="preserve">• </w:t></w:r>'
          : '';

      const wRuns = p.runs
        .map((r) => {
          if (r.break) {
            return '<w:r><w:br/></w:r>';
          }
          const rPrParts = [];
          if (r.bold || p.tag === 'h1' || p.tag === 'h2' || p.tag === 'h3') {
            rPrParts.push('<w:b/>');
          }
          if (r.italic) {
            rPrParts.push('<w:i/>');
          }
          if (r.underline) {
            rPrParts.push('<w:u w:val="single"/>');
          }
          if (p.tag === 'h1') {
            rPrParts.push('<w:sz w:val="36"/><w:szCs w:val="36"/>');
          } else if (p.tag === 'h2') {
            rPrParts.push('<w:sz w:val="28"/><w:szCs w:val="28"/>');
          } else if (p.tag === 'h3') {
            rPrParts.push('<w:sz w:val="24"/><w:szCs w:val="24"/>');
          }
          const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';
          return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(r.text)}</w:t></w:r>`;
        })
        .join('');

      return `<w:p>${pPr}${prefixRun}${wRuns}</w:p>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${wParagraphs}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
};

/**
 * Tạo Buffer tệp .docx hoàn chỉnh từ chuỗi HTML hoặc văn bản
 */
const buildDocxBufferFromHtml = (htmlContent = '') => {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="160" w:line="276" w:lineRule="auto"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>
  </w:style>
</w:styles>`;

  const documentXml = buildDocumentXmlFromHtml(htmlContent);

  return createZipBuffer([
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/_rels/document.xml.rels', data: docRelsXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/document.xml', data: documentXml }
  ]);
};

/**
 * Đọc Buffer .docx và trích xuất HTML định dạng + văn bản thuần cho trình soạn thảo
 */
const extractHtmlFromDocxBuffer = async (buffer, fallbackText = '') => {
  if (buffer && Buffer.isBuffer(buffer) && buffer.length > 0) {
    try {
      const [htmlResult, rawResult] = await Promise.all([
        mammoth.convertToHtml({ buffer }),
        mammoth.extractRawText({ buffer })
      ]);
      const html = (htmlResult?.value || '').trim();
      const plainText = (rawResult?.value || '').trim() || htmlToPlainText(html);
      if (html) {
        return { html, plainText };
      }
    } catch (err) {
      console.warn('[DocxBuilder] Không thể đọc buffer docx qua mammoth, dùng fallback text:', err.message);
    }
  }

  const safeText = fallbackText || '';
  return {
    html: plainTextToHtml(safeText),
    plainText: safeText
  };
};

module.exports = {
  buildDocxBufferFromHtml,
  extractHtmlFromDocxBuffer,
  htmlToPlainText,
  plainTextToHtml
};

