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
 * Loại bỏ chuỗi base64 hoặc thuộc tính thẻ <img> bị rò rỉ thành văn bản thuần
 */
const stripLeakedBase64Text = (text = '') => {
  if (!text) return '';
  return String(text)
    .replace(/<?\s*img\b[^>]*?src\s*=\s*(?:"data:image\/[^"]*"|'data:image\/[^']*'|&quot;data:image\/[^&]*&quot;)[^>]*?(?:\/?>|\/?&gt;)?/gi, '')
    .replace(/\bimg\s+(?:alt\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;)\s*)?src\s*=\s*(?:"data:image\/[\s\S]*?"|'data:image\/[\s\S]*?'|&quot;data:image\/[\s\S]*?&quot;)\s*(?:\/?>|\/?&gt;)?/gi, '')
    .replace(/\bsrc\s*=\s*(?:"data:image\/[\s\S]*?"|'data:image\/[\s\S]*?'|&quot;data:image\/[\s\S]*?&quot;)\s*(?:\/?>|\/?&gt;)?/gi, '')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+/gi, '');
};

/**
 * Khôi phục các đoạn thẻ <img ...> bị mất dấu '<' (do lỗi parse cũ) về lại thẻ <img> hợp lệ,
 * đồng thời dọn sạch các mảnh thẻ HTML bị rò rỉ thành chữ.
 */
const repairLeakedHtmlContent = (html = '') => {
  if (!html) return '';
  return String(html)
    // Khôi phục img alt="..." src="data:image/..." /> (bị mất '<' ở đầu) thành thẻ <img ... />
    .replace(
      /(^|>|\s)img\s+(?:alt\s*=\s*(?:"([^"]*)"|'([^']*)'|&quot;([^&]*)&quot;)\s+)?src\s*=\s*(?:"(data:image\/[^"]+)"|'(data:image\/[^']+)'|&quot;(data:image\/[^&]+)&quot;)\s*\/?(?:>|&gt;)?/gi,
      (full, prefix, a1, a2, a3, s1, s2, s3) => {
        const alt = escapeXml(decodeHtmlEntities(a1 || a2 || a3 || ''));
        const src = (s1 || s2 || s3 || '').replace(/\s+/g, '');
        if (!src) return prefix;
        return `${prefix}<img alt="${alt}" src="${src}" />`;
      }
    );
};

/**
 * Chuyển đổi HTML sang văn bản thuần (dùng cho extractedText và tìm kiếm AI/RAG)
 */
const htmlToPlainText = (html = '') => {
  if (!html) return '';
  const cleanedHtml = repairLeakedHtmlContent(html);
  const withBreaks = String(cleanedHtml)
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|blockquote)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  return stripLeakedBase64Text(decodeHtmlEntities(withBreaks))
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

const plainTextToHtml = (text = '') => {
  const clean = stripLeakedBase64Text(text || '');
  if (!clean) return '<p></p>';
  return String(clean)
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `<p>${escapeXml(line)}</p>`)
    .join('');
};

/**
 * Đọc kích thước (width, height) từ Buffer ảnh PNG/JPEG/GIF để nhúng vào OpenXML đúng tỷ lệ
 */
const getImageDimensionsPx = (buf, ext) => {
  try {
    if (!Buffer.isBuffer(buf) || buf.length < 24) {
      return { width: 220, height: 140 };
    }
    // PNG: IHDR chunk ở byte 16..23
    if (ext === 'png' && buf[0] === 0x89 && buf[1] === 0x50) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0 && width < 10000 && height < 10000) {
        return { width, height };
      }
    }
    // GIF: byte 6..9 (UInt16LE)
    if (ext === 'gif' && buf[0] === 0x47 && buf[1] === 0x49) {
      const width = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
    // JPEG: quét SOF0 / SOF2 marker
    if ((ext === 'jpeg' || ext === 'jpg') && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) {
          i++;
          continue;
        }
        const marker = buf[i + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          const height = buf.readUInt16BE(i + 5);
          const width = buf.readUInt16BE(i + 7);
          if (width > 0 && height > 0) {
            return { width, height };
          }
          break;
        }
        const blockLen = buf.readUInt16BE(i + 2);
        if (blockLen < 2) break;
        i += 2 + blockLen;
      }
    }
  } catch (e) {
    // Fallback kích thước mặc định
  }
  return { width: 220, height: 140 };
};

/**
 * Trích xuất thông tin ảnh base64 từ thuộc tính thẻ <img ...> và đăng ký vào mediaList
 */
const registerInlineImageFromAttrs = (attrs = '', mediaList = []) => {
  if (!attrs) return null;
  const srcMatch = /src\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(attrs);
  if (!srcMatch) return null;
  const src = (srcMatch[1] || srcMatch[2] || '').trim();
  const dataUriMatch = /^data:image\/(png|jpeg|jpg|gif);base64,([\s\S]+)$/i.exec(src);
  if (!dataUriMatch) return null;

  const rawExt = dataUriMatch[1].toLowerCase();
  const ext = rawExt === 'jpg' ? 'jpeg' : rawExt;
  const base64Data = dataUriMatch[2].replace(/\s+/g, '');
  if (!base64Data) return null;

  let imgBuf;
  try {
    imgBuf = Buffer.from(base64Data, 'base64');
  } catch (e) {
    return null;
  }
  if (!imgBuf || imgBuf.length === 0) return null;

  const { width, height } = getImageDimensionsPx(imgBuf, ext);
  // Giới hạn kích thước hiển thị tối đa trên trang A4 (maxWidth = 460px, maxHeight = 460px)
  const maxPx = 460;
  let finalW = width;
  let finalH = height;
  if (finalW > maxPx) {
    const ratio = maxPx / finalW;
    finalW = maxPx;
    finalH = Math.max(24, Math.round(finalH * ratio));
  }
  if (finalH > maxPx) {
    const ratio = maxPx / finalH;
    finalH = maxPx;
    finalW = Math.max(24, Math.round(finalW * ratio));
  }

  // 1 pixel = 9525 EMUs trong OpenXML
  const cx = Math.round(finalW * 9525);
  const cy = Math.round(finalH * 9525);

  const id = mediaList.length + 1;
  const rId = `rIdImg${id}`;
  const fileExt = ext === 'jpeg' ? 'jpg' : ext;
  const fileName = `image${id}.${fileExt}`;

  const item = {
    id,
    rId,
    fileName,
    contentType: `image/${ext}`,
    buffer: imgBuf,
    cx,
    cy
  };
  mediaList.push(item);
  return item;
};

/**
 * Tách các đoạn inline run (đậm, nghiêng, gạch chân, ảnh, xuống dòng) trong 1 block HTML thành mảng runs cho OpenXML.
 * Bắt TẤT CẢ các thẻ HTML (<...>) để không bao giờ rò rỉ thuộc tính thẻ (như <img src="data:image/...">) thành chữ.
 */
const parseInlineRuns = (innerHtml = '', mediaList = []) => {
  const runs = [];
  const repaired = repairLeakedHtmlContent(innerHtml);
  const tokenRegex = /<(\/?[a-zA-Z0-9]+)\b([^>]*?)(\/?)>|([^<]+)/g;
  let bold = false;
  let italic = false;
  let underline = false;
  let match;

  while ((match = tokenRegex.exec(repaired)) !== null) {
    const rawTagName = match[1];
    const tagAttrs = match[2] || '';
    const textChunk = match[4];

    if (rawTagName) {
      const lowerTag = rawTagName.toLowerCase();
      if (lowerTag === 'br' || lowerTag === '/p' || lowerTag === '/div' || lowerTag === '/tr' || lowerTag === '/li') {
        runs.push({ break: true });
      } else if (lowerTag === 'b' || lowerTag === 'strong') {
        bold = true;
      } else if (lowerTag === '/b' || lowerTag === '/strong') {
        bold = false;
      } else if (lowerTag === 'i' || lowerTag === 'em') {
        italic = true;
      } else if (lowerTag === '/i' || lowerTag === '/em') {
        italic = false;
      } else if (lowerTag === 'u') {
        underline = true;
      } else if (lowerTag === '/u') {
        underline = false;
      } else if (lowerTag === 'img') {
        const imgEntry = registerInlineImageFromAttrs(tagAttrs, mediaList);
        if (imgEntry) {
          runs.push({ image: imgEntry });
        }
      }
      // Mọi thẻ HTML khác (span, a, font, table, td, th...) đều được bỏ qua an toàn, không biến thành văn bản
    } else if (textChunk) {
      const cleanedText = stripLeakedBase64Text(decodeHtmlEntities(textChunk));
      if (cleanedText.length > 0) {
        runs.push({
          text: cleanedText,
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
 * Dựng XML cho 1 ảnh inline (<w:drawing>) trong OpenXML
 */
const buildDrawingXml = (img) => `
<w:r>
  <w:drawing>
    <wp:inline distT="0" distB="0" distL="0" distR="0">
      <wp:extent cx="${img.cx}" cy="${img.cy}"/>
      <wp:docPr id="${img.id}" name="Picture ${img.id}"/>
      <wp:cNvGraphicFramePr>
        <a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/>
      </wp:cNvGraphicFramePr>
      <a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
          <pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
            <pic:nvPicPr>
              <pic:cNvPr id="${img.id}" name="${img.fileName}"/>
              <pic:cNvPicPr/>
            </pic:nvPicPr>
            <pic:blipFill>
              <a:blip r:embed="${img.rId}"/>
              <a:stretch><a:fillRect/></a:stretch>
            </pic:blipFill>
            <pic:spPr>
              <a:xfrm>
                <a:off x="0" y="0"/>
                <a:ext cx="${img.cx}" cy="${img.cy}"/>
              </a:xfrm>
              <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
            </pic:spPr>
          </pic:pic>
        </a:graphicData>
      </a:graphic>
    </wp:inline>
  </w:drawing>
</w:r>`.trim();

/**
 * Chuyển đổi HTML hoặc văn bản sang cấu trúc các đoạn văn OpenXML (<w:p>)
 */
const buildDocumentXmlFromHtml = (htmlContent = '', mediaList = []) => {
  const raw = repairLeakedHtmlContent(String(htmlContent || '').trim());
  const normalized = raw.startsWith('<') ? raw : plainTextToHtml(raw);

  // Tách thành từng block theo thẻ đóng hoặc dòng
  const blockRegex = /<(h1|h2|h3|h4|p|div|li|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
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
      runs: parseInlineRuns(inner, mediaList)
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
      } else if (p.tag === 'h3' || p.tag === 'h4') {
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
          if (r.image) {
            return buildDrawingXml(r.image);
          }
          const rPrParts = [];
          if (r.bold || p.tag === 'h1' || p.tag === 'h2' || p.tag === 'h3' || p.tag === 'h4') {
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
          } else if (p.tag === 'h3' || p.tag === 'h4') {
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
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
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
 * Tạo Buffer tệp .docx hoàn chỉnh từ chuỗi HTML hoặc văn bản (hỗ trợ cả hình ảnh nhúng)
 */
const buildDocxBufferFromHtml = (htmlContent = '') => {
  const mediaList = [];
  const documentXml = buildDocumentXmlFromHtml(htmlContent, mediaList);

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="png" ContentType="image/png"/>
  <Default Extension="jpg" ContentType="image/jpeg"/>
  <Default Extension="jpeg" ContentType="image/jpeg"/>
  <Default Extension="gif" ContentType="image/gif"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const mediaRels = mediaList
    .map(
      (img) =>
        `  <Relationship Id="${img.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${img.fileName}"/>`
    )
    .join('\n');

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${mediaRels ? `${mediaRels}\n` : ''}</Relationships>`;

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

  const zipEntries = [
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'word/_rels/document.xml.rels', data: docRelsXml },
    { name: 'word/styles.xml', data: stylesXml },
    { name: 'word/document.xml', data: documentXml },
    ...mediaList.map((img) => ({
      name: `word/media/${img.fileName}`,
      data: img.buffer
    }))
  ];

  return createZipBuffer(zipEntries);
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
      const html = repairLeakedHtmlContent((htmlResult?.value || '').trim());
      const plainText = stripLeakedBase64Text((rawResult?.value || '').trim()) || htmlToPlainText(html);
      if (html) {
        return { html, plainText };
      }
    } catch (err) {
      console.warn('[DocxBuilder] Không thể đọc buffer docx qua mammoth, dùng fallback text:', err.message);
    }
  }

  const safeText = stripLeakedBase64Text(fallbackText || '');
  return {
    html: plainTextToHtml(safeText),
    plainText: safeText
  };
};

module.exports = {
  buildDocxBufferFromHtml,
  extractHtmlFromDocxBuffer,
  htmlToPlainText,
  plainTextToHtml,
  repairLeakedHtmlContent,
  stripLeakedBase64Text
};
