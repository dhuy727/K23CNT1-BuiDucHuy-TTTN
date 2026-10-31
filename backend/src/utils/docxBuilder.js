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
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x21, 12);
    localHeader.writeUInt32LE(entryCrc, 14);
    localHeader.writeUInt32LE(compressedBuf.length, 18);
    localHeader.writeUInt32LE(uncompressedBuf.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localChunk = Buffer.concat([localHeader, nameBuf, compressedBuf]);
    localFileHeaders.push(localChunk);

    // Central directory file header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x21, 14);
    centralHeader.writeUInt32LE(entryCrc, 16);
    centralHeader.writeUInt32LE(compressedBuf.length, 20);
    centralHeader.writeUInt32LE(uncompressedBuf.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralDirHeaders.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localChunk.length;
  }

  const centralDirBuf = Buffer.concat(centralDirHeaders);
  const endOfCentralDir = Buffer.alloc(22);
  endOfCentralDir.writeUInt32LE(0x06054b50, 0);
  endOfCentralDir.writeUInt16LE(0, 4);
  endOfCentralDir.writeUInt16LE(0, 6);
  endOfCentralDir.writeUInt16LE(entries.length, 8);
  endOfCentralDir.writeUInt16LE(entries.length, 10);
  endOfCentralDir.writeUInt32LE(centralDirBuf.length, 12);
  endOfCentralDir.writeUInt32LE(offset, 16);
  endOfCentralDir.writeUInt16LE(0, 20);

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
 * Loại bỏ chuỗi base64 hoặc các mảnh thẻ HTML bị rò rỉ trong văn bản thuần
 */
const stripLeakedBase64Text = (text = '') => {
  if (!text) return '';
  return String(text)
    .replace(/<?\s*img\b[^>]*?src\s*=\s*(?:"data:image\/[^"]*"|'data:image\/[^']*'|&quot;data:image\/[^&]*&quot;)[^>]*?(?:\/?>|\/?&gt;)?/gi, '')
    .replace(/\bimg\s+(?:alt\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;)\s*)?src\s*=\s*(?:"data:image\/[\s\S]*?"|'data:image\/[\s\S]*?'|&quot;data:image\/[\s\S]*?&quot;)\s*(?:\/?>|\/?&gt;)?/gi, '')
    .replace(/\bsrc\s*=\s*(?:"data:image\/[\s\S]*?"|'data:image\/[\s\S]*?'|&quot;data:image\/[\s\S]*?&quot;)\s*(?:\/?>|\/?&gt;)?/gi, '')
    .replace(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=\s]+/gi, '')
    .replace(/a\s+id\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;)\s*(?:>|&gt;)\s*(?:\/a(?:>|&gt;))?/gi, '')
    .replace(/a\s+href\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;)\s*(?:>|&gt;)/gi, '')
    .replace(/\/a(?:>|&gt;)/gi, '')
    .replace(/(^|\s|•)\/?(?:ol|ul|li)(?:>|&gt;)/gi, '$1');
};

/**
 * Làm sạch và khôi phục các đoạn HTML từ Mammoth hoặc từ tệp cũ từng bị vỡ thẻ:
 * - Gỡ bỏ ảnh Windows Metafile (data:image/x-emf, wmf) không hiển thị được trên trình duyệt
 * - Khôi phục thẻ <img src="data:image/png..."> bị mất '<'
 * - Gỡ bỏ hoàn toàn mảnh vỡ thẻ <a id="_Toc...">/a>, <a href="#_Toc...">.../a>, ol>, li>
 * - Định dạng các dòng Mục lục (TOC) có ký tự tab (\t) trước số trang thành cấu trúc mục lục chuẩn
 */
const repairLeakedHtmlContent = (html = '') => {
  if (!html) return '';
  let cleaned = String(html)
    // 1. Gỡ bỏ các thẻ <img> chứa ảnh Windows Metafile (x-emf, emf, x-wmf, wmf) vì trình duyệt báo lỗi ảnh vỡ
    .replace(
      /<img\b[^>]*?\bsrc\s*=\s*(?:"data:image\/(?:x-)?(?:emf|wmf)[^"]*"|'data:image\/(?:x-)?(?:emf|wmf)[^']*')[^>]*?>/gi,
      ''
    )
    .replace(
      /(^|>|\s)img\s+(?:alt\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;)\s+)?src\s*=\s*(?:"data:image\/(?:x-)?(?:emf|wmf)[^"]+"|'data:image\/(?:x-)?(?:emf|wmf)[^']+'|&quot;data:image\/(?:x-)?(?:emf|wmf)[^&]+&quot;)\s*\/?(?:>|&gt;)?/gi,
      '$1'
    )
    // 2. Khôi phục img alt="..." src="data:image/(png|jpeg|jpg|gif|webp)..." bị mất dấu '<'
    .replace(
      /(^|>|\s)img\s+(?:alt\s*=\s*(?:"([^"]*)"|'([^']*)'|&quot;([^&]*)&quot;)\s+)?src\s*=\s*(?:"(data:image\/(?:png|jpe?g|gif|webp)[^"]+)"|'(data:image\/(?:png|jpe?g|gif|webp)[^']+)'|&quot;(data:image\/(?:png|jpe?g|gif|webp)[^&]+)&quot;)\s*\/?(?:>|&gt;)?/gi,
      (full, prefix, a1, a2, a3, s1, s2, s3) => {
        const alt = escapeXml(decodeHtmlEntities(a1 || a2 || a3 || ''));
        const src = (s1 || s2 || s3 || '').replace(/\s+/g, '');
        if (!src) return prefix;
        return `${prefix}<img alt="${alt}" src="${src}" />`;
      }
    )
    // 3. Xóa các thẻ neo bookmark rỗng <a id="_Toc..."></a> và mảnh vỡ a id="_Toc...">/a> (kể cả khi dính liền chữ phía trước như Node.jsa id="_Toc...")
    .replace(/<a\b[^>]*?\bid\s*=\s*(?:"[^"]*"|'[^']*')[^>]*?>\s*<\/a>/gi, '')
    .replace(
      /<?a\s+id\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;)\s*(?:>|&gt;)\s*(?:<\/a>|\/a(?:>|&gt;))?/gi,
      ''
    )
    // 4. Mở bọc thẻ <a href="#_Toc...">Nội dung</a> hoặc mảnh vỡ a href="...">Nội dung/a>
    .replace(/<a\b[^>]*?\bhref\s*=\s*(?:"#[_a-zA-Z0-9-]+"|'#[_a-zA-Z0-9-]+')[^>]*?>([\s\S]*?)<\/a>/gi, '$1')
    .replace(/<?a\s+href\s*=\s*(?:"[^"]*"|'[^']*'|&quot;[^&]*&quot;)\s*(?:>|&gt;)/gi, '')
    .replace(/<\/a>|\/a(?:>|&gt;)/gi, '')
    // 5. Xóa các mảnh vỡ danh sách như "• ol>", "li>", "/ol>", "/li>"
    .replace(/(^|>|\s|•)\s*\/?(?:ol|ul|li)(?:>|&gt;)/gi, '$1')
    // 6. Chuyển các class căn lề của Mammoth sang inline style chuẩn cho trình soạn thảo
    .replace(/<(p|h[1-6])\s+class="docx-align-(center|right|justify)"([^>]*)>/gi, '<$1 style="text-align: $2;"$3>');

  // 7. Chuẩn hóa các dòng Mục lục (TOC) có ký tự tab (\t) ngăn cách tiêu đề và số trang ở cuối dòng
  cleaned = cleaned.replace(
    /<p([^>]*)>([\s\S]*?)<\/p>/gi,
    (full, attrs, inner) => {
      if (attrs.includes('docx-toc-item') || inner.includes('docx-toc-dots')) {
        return full;
      }
      // Nếu trong đoạn không chứa thẻ block/ảnh và có dạng: "Tiêu đề mục lục \t Số trang (số hoặc số La Mã)"
      if (!/<(img|table|div|ul|ol)\b/i.test(inner) && inner.includes('\t')) {
        const plainInner = inner.replace(/<\/?(?:strong|b|em|i|u|span)[^>]*>/gi, '').trim();
        const tocMatch = /^([^\t]+(?:\t[^\t]+)*?)\t+([0-9]+|[ivxlcdmIVXLCDM]+)$/.exec(plainInner);
        if (tocMatch) {
          const rawTitle = tocMatch[1].replace(/\t+/g, ' ').trim();
          const pageNum = tocMatch[2].trim();
          const isBold = /^<(strong|b)\b/i.test(inner.trim()) || /^(CHƯƠNG\s+\d+|MỞ\s+ĐẦU|KẾT\s+LUẬN|PHỤ\s+LỤC|TÀI\s+LIỆU|LỜI\s+CẢM\s+ƠN|DANH\s+MỤC)/i.test(rawTitle);
          const labelHtml = isBold ? `<strong>${escapeXml(decodeHtmlEntities(rawTitle))}</strong>` : escapeXml(decodeHtmlEntities(rawTitle));
          return `<p class="docx-toc-item"${attrs}><span class="docx-toc-label">${labelHtml}</span><span class="docx-toc-dots">\t</span><span class="docx-toc-page">${escapeXml(pageNum)}</span></p>`;
        }
      }
      return full;
    }
  );

  return cleaned;
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
    .replace(/<\/(td|th)>/gi, '\t')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  return stripLeakedBase64Text(decodeHtmlEntities(withBreaks))
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
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
    if (ext === 'png' && buf[0] === 0x89 && buf[1] === 0x50) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0 && width < 10000 && height < 10000) {
        return { width, height };
      }
    }
    if (ext === 'gif' && buf[0] === 0x47 && buf[1] === 0x49) {
      const width = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
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
 * Tách các đoạn inline run (đậm, nghiêng, gạch chân, tab, ảnh, xuống dòng) trong 1 đoạn HTML thành mảng runs cho OpenXML.
 */
const parseInlineRuns = (innerHtml = '', mediaList = []) => {
  const runs = [];
  const repaired = repairLeakedHtmlContent(innerHtml);
  const tokenRegex = /<(\/?[a-zA-Z0-9]+)\b([^>]*?)(\/?)>|([^<]+)/g;
  let bold = false;
  let italic = false;
  let underline = false;
  let inTocDots = false;
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
      } else if (lowerTag === 'span' && tagAttrs.includes('docx-toc-dots')) {
        inTocDots = true;
        runs.push({ tab: true });
      } else if (lowerTag === '/span' && inTocDots) {
        inTocDots = false;
      } else if (lowerTag === 'img') {
        const imgEntry = registerInlineImageFromAttrs(tagAttrs, mediaList);
        if (imgEntry) {
          runs.push({ image: imgEntry });
        }
      }
    } else if (textChunk && !inTocDots) {
      const cleanedText = stripLeakedBase64Text(decodeHtmlEntities(textChunk));
      if (cleanedText.length > 0) {
        // Nếu chuỗi có chứa ký tự \t, tách thành các run văn bản và run <w:tab/>
        const parts = cleanedText.split('\t');
        for (let i = 0; i < parts.length; i++) {
          if (parts[i].length > 0) {
            runs.push({
              text: parts[i],
              bold,
              italic,
              underline
            });
          }
          if (i < parts.length - 1) {
            runs.push({ tab: true });
          }
        }
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
 * Dựng XML cho 1 đoạn văn (<w:p>)
 */
const buildParagraphXml = (tag, attrs = '', innerHtml = '', mediaList = [], options = {}) => {
  const lowerTag = (tag || 'p').toLowerCase();
  const runs = parseInlineRuns(innerHtml, mediaList);
  const hasTab = runs.some((r) => r.tab) || attrs.includes('docx-toc-item');
  const hasImage = runs.some((r) => r.image);

  let align = options.defaultAlign || null;
  if (/text-align\s*:\s*center/i.test(attrs) || /docx-align-center/i.test(attrs)) align = 'center';
  else if (/text-align\s*:\s*right/i.test(attrs) || /docx-align-right/i.test(attrs)) align = 'right';
  else if (/text-align\s*:\s*justify/i.test(attrs) || /docx-align-justify/i.test(attrs)) align = 'both';
  else if (/text-align\s*:\s*left/i.test(attrs) || /docx-align-left/i.test(attrs)) align = 'left';
  else if (hasImage && runs.filter((r) => r.text && r.text.trim()).length === 0) {
    align = 'center';
  }

  const pPrParts = [];
  if (lowerTag === 'h1') {
    pPrParts.push('<w:pStyle w:val="Heading1"/>');
  } else if (lowerTag === 'h2') {
    pPrParts.push('<w:pStyle w:val="Heading2"/>');
  } else if (lowerTag === 'h3' || lowerTag === 'h4' || lowerTag === 'h5' || lowerTag === 'h6') {
    pPrParts.push('<w:pStyle w:val="Heading3"/>');
  }
  if (align) {
    pPrParts.push(`<w:jc w:val="${align}"/>`);
  }
  if (hasTab) {
    pPrParts.push('<w:tabs><w:tab w:val="right" w:leader="dot" w:pos="9026"/></w:tabs>');
  }
  const pPr = pPrParts.length > 0 ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';

  let prefixRun = '';
  if (lowerTag === 'li') {
    const bulletText = options.listPrefix || '• ';
    prefixRun = `<w:r><w:t xml:space="preserve">${escapeXml(bulletText)}</w:t></w:r>`;
  }

  const isHeading = /^h[1-6]$/.test(lowerTag);
  const forceBold = isHeading || Boolean(options.forceBold);

  const wRuns = runs
    .map((r) => {
      if (r.break) {
        return '<w:r><w:br/></w:r>';
      }
      if (r.tab) {
        return '<w:r><w:tab/></w:r>';
      }
      if (r.image) {
        return buildDrawingXml(r.image);
      }
      const rPrParts = [];
      if (r.bold || forceBold) {
        rPrParts.push('<w:b/>');
      }
      if (r.italic) {
        rPrParts.push('<w:i/>');
      }
      if (r.underline) {
        rPrParts.push('<w:u w:val="single"/>');
      }
      if (lowerTag === 'h1') {
        rPrParts.push('<w:sz w:val="32"/><w:szCs w:val="32"/>');
      } else if (lowerTag === 'h2') {
        rPrParts.push('<w:sz w:val="28"/><w:szCs w:val="28"/>');
      } else if (lowerTag === 'h3' || lowerTag === 'h4') {
        rPrParts.push('<w:sz w:val="26"/><w:szCs w:val="26"/>');
      }
      const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';
      return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(r.text)}</w:t></w:r>`;
    })
    .join('');

  return `<w:p>${pPr}${prefixRun}${wRuns}</w:p>`;
};

/**
 * Tìm vị trí thẻ đóng cân bằng (dùng cho <table> lồng nhau hoặc <ul>/<ol> lồng nhau)
 */
const findBalancedClosingTag = (html, tagName, contentStartIdx) => {
  const tagRe = new RegExp(`<(\\/?)${tagName}\\b[^>]*>`, 'gi');
  tagRe.lastIndex = contentStartIdx;
  let depth = 1;
  let m;
  while ((m = tagRe.exec(html)) !== null) {
    if (m[1] === '/') {
      depth--;
      if (depth === 0) {
        return {
          innerEnd: m.index,
          afterClose: tagRe.lastIndex
        };
      }
    } else if (!m[0].endsWith('/>')) {
      depth++;
    }
  }
  return null;
};

/**
 * Tách các phần tử con cấp 1 (<tr> trong <table>, hoặc <td>/<th> trong <tr>) mà không xâm phạm vào bảng con lồng bên trong
 */
const extractTopLevelTableParts = (html, partRegex) => {
  const results = [];
  const tokenRe = /<(\/?)table\b[^>]*>|<(tr|td|th)\b([^>]*)>/gi;
  let tableDepth = 0;
  let m;

  while ((m = tokenRe.exec(html)) !== null) {
    const fullMatch = m[0];
    if (/^<\/?table\b/i.test(fullMatch)) {
      if (m[1] === '/') {
        tableDepth = Math.max(0, tableDepth - 1);
      } else if (!fullMatch.endsWith('/>')) {
        tableDepth++;
      }
      continue;
    }

    if (tableDepth === 0 && m[2]) {
      const partTag = m[2].toLowerCase();
      if (partRegex.test(partTag)) {
        const attrs = m[3] || '';
        const contentStart = tokenRe.lastIndex;
        // Tìm thẻ đóng tương ứng ở cùng tableDepth === 0
        const closeSearchRe = new RegExp(`<(\\/?)(table|${partTag})\\b[^>]*>`, 'gi');
        closeSearchRe.lastIndex = contentStart;
        let subTableDepth = 0;
        let partDepth = 1;
        let cm;
        while ((cm = closeSearchRe.exec(html)) !== null) {
          const isClosing = cm[1] === '/';
          const cTag = cm[2].toLowerCase();
          if (cTag === 'table') {
            if (isClosing) subTableDepth = Math.max(0, subTableDepth - 1);
            else if (!cm[0].endsWith('/>')) subTableDepth++;
          } else if (subTableDepth === 0 && cTag === partTag) {
            if (isClosing) {
              partDepth--;
              if (partDepth === 0) {
                results.push({
                  tag: partTag,
                  attrs,
                  inner: html.slice(contentStart, cm.index)
                });
                tokenRe.lastIndex = closeSearchRe.lastIndex;
                break;
              }
            } else if (!cm[0].endsWith('/>')) {
              partDepth++;
            }
          }
        }
      }
    }
  }

  return results;
};

/**
 * Dựng XML cho bảng OpenXML (<w:tbl>) hỗ trợ cả bảng lồng nhau (như khung trang bìa + bảng danh sách sinh viên)
 */
const buildTableXml = (tableInnerHtml, mediaList = []) => {
  const rowItems = extractTopLevelTableParts(tableInnerHtml, /^tr$/i);
  if (rowItems.length === 0) return '';

  const parsedRows = rowItems
    .map((r) => extractTopLevelTableParts(r.inner, /^(td|th)$/i))
    .filter((cells) => cells.length > 0);

  if (parsedRows.length === 0) return '';

  const maxCols = Math.max(
    1,
    ...parsedRows.map((cells) =>
      cells.reduce((sum, c) => {
        const cs = /colspan\s*=\s*["']?(\d+)/i.exec(c.attrs);
        return sum + (cs ? Math.max(1, Number(cs[1])) : 1);
      }, 0)
    )
  );

  // Kiểm tra xem có phải khung bìa 1x1 hay bảng chữ ký không viền (1 dòng 2 cột mà ô đầu trống)
  const isSingleFrame = parsedRows.length === 1 && maxCols === 1;
  const isSignatureLayout =
    parsedRows.length === 1 &&
    maxCols === 2 &&
    htmlToPlainText(parsedRows[0][0]?.inner || '').trim() === '';

  let bordersXml = '';
  if (isSignatureLayout) {
    bordersXml = `
      <w:tblBorders>
        <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
        <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      </w:tblBorders>`;
  } else if (isSingleFrame) {
    bordersXml = `
      <w:tblBorders>
        <w:top w:val="double" w:sz="12" w:space="0" w:color="1E293B"/>
        <w:left w:val="double" w:sz="12" w:space="0" w:color="1E293B"/>
        <w:bottom w:val="double" w:sz="12" w:space="0" w:color="1E293B"/>
        <w:right w:val="double" w:sz="12" w:space="0" w:color="1E293B"/>
      </w:tblBorders>`;
  } else {
    bordersXml = `
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="475569"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="94A3B8"/>
      </w:tblBorders>`;
  }

  const colWidthDxa = Math.floor(9026 / maxCols);
  const tblGridXml = `<w:tblGrid>${Array.from({ length: maxCols }, () => `<w:gridCol w:w="${colWidthDxa}"/>`).join('')}</w:tblGrid>`;

  const wRows = parsedRows
    .map((cells, rowIdx) => {
      const isHeaderRow = rowIdx === 0 && parsedRows.length > 1 && !isSingleFrame;
      const wCells = cells
        .map((cell) => {
          const csMatch = /colspan\s*=\s*["']?(\d+)/i.exec(cell.attrs);
          const span = csMatch ? Math.max(1, Number(csMatch[1])) : 1;
          const pctW = Math.floor((5000 * span) / maxCols);
          const gridSpanXml = span > 1 ? `<w:gridSpan w:val="${span}"/>` : '';
          const shdXml =
            isHeaderRow || cell.tag === 'th'
              ? '<w:shd w:val="clear" w:color="auto" w:fill="F1F5F9"/>'
              : '';

          // Xây dựng các block bên trong ô
          const cellBlocks = parseHtmlBlocksToWordXml(cell.inner, mediaList, {
            inTableCell: true,
            defaultAlign: isSingleFrame || isSignatureLayout ? 'center' : null,
            forceBold: cell.tag === 'th'
          });

          let cellContentXml = cellBlocks.join('');
          // Quy chuẩn OpenXML: mỗi <w:tc> bắt buộc phải kết thúc bằng <w:p>
          if (!cellContentXml || !cellContentXml.trim().endsWith('</w:p>')) {
            cellContentXml += '<w:p/>';
          }

          return `<w:tc><w:tcPr><w:tcW w:w="${pctW}" w:type="pct"/>${gridSpanXml}${shdXml}</w:tcPr>${cellContentXml}</w:tc>`;
        })
        .join('');

      return `<w:tr>${wCells}</w:tr>`;
    })
    .join('');

  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${bordersXml}<w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:left w:w="140" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:right w:w="140" w:type="dxa"/></w:tblCellMar></w:tblPr>${tblGridXml}${wRows}</w:tbl>`;
};

/**
 * Phân tích chuỗi HTML thành danh sách các phần tử OpenXML (<w:p> và <w:tbl>) theo đúng thứ tự xuất hiện
 */
const parseHtmlBlocksToWordXml = (htmlContent = '', mediaList = [], options = {}) => {
  const blocks = [];
  const normalized = repairLeakedHtmlContent(String(htmlContent || '').trim());
  if (!normalized) return blocks;

  const topRe = /<(table|ul|ol|h1|h2|h3|h4|h5|h6|p|div|li|blockquote)\b([^>]*)>/gi;
  let cursor = 0;
  let m;

  const flushLooseInline = (slice) => {
    const trimmed = slice.trim();
    if (!trimmed) return;
    const textCheck = htmlToPlainText(trimmed);
    const hasImg = /<img\b/i.test(trimmed);
    if (textCheck || hasImg) {
      blocks.push(buildParagraphXml('p', '', trimmed, mediaList, options));
    }
  };

  while ((m = topRe.exec(normalized)) !== null) {
    if (m.index > cursor) {
      flushLooseInline(normalized.slice(cursor, m.index));
    }

    const tag = m[1].toLowerCase();
    const attrs = m[2] || '';
    const contentStart = topRe.lastIndex;

    const balanced = findBalancedClosingTag(normalized, tag, contentStart);
    if (!balanced) {
      // Nếu thẻ không có thẻ đóng cân bằng, xử lý phần còn lại như inline
      flushLooseInline(normalized.slice(m.index));
      cursor = normalized.length;
      break;
    }

    const inner = normalized.slice(contentStart, balanced.innerEnd);
    cursor = balanced.afterClose;
    topRe.lastIndex = cursor;

    if (tag === 'table') {
      const tblXml = buildTableXml(inner, mediaList);
      if (tblXml) {
        blocks.push(tblXml);
      }
    } else if (tag === 'ul' || tag === 'ol') {
      const liRe = /<li\b([^>]*)>([\s\S]*?)<\/li>/gi;
      let liMatch;
      let idx = 1;
      while ((liMatch = liRe.exec(inner)) !== null) {
        const listPrefix = tag === 'ol' ? `${idx}. ` : '• ';
        idx++;
        blocks.push(
          buildParagraphXml('li', liMatch[1] || '', liMatch[2] || '', mediaList, {
            ...options,
            listPrefix
          })
        );
      }
    } else {
      blocks.push(buildParagraphXml(tag, attrs, inner, mediaList, options));
    }
  }

  if (cursor < normalized.length) {
    flushLooseInline(normalized.slice(cursor));
  }

  return blocks;
};

/**
 * Chuyển đổi HTML hoặc văn bản sang cấu trúc tài liệu OpenXML (<w:document>)
 */
const buildDocumentXmlFromHtml = (htmlContent = '', mediaList = []) => {
  const raw = repairLeakedHtmlContent(String(htmlContent || '').trim());
  const normalized = raw.startsWith('<') ? raw : plainTextToHtml(raw);

  const wBlocks = parseHtmlBlocksToWordXml(normalized, mediaList);
  if (wBlocks.length === 0) {
    wBlocks.push('<w:p/>');
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
            xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
  <w:body>
    ${wBlocks.join('')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
};

/**
 * Tạo Buffer tệp .docx hoàn chỉnh từ chuỗi HTML hoặc văn bản (hỗ trợ cả bảng biểu, căn lề, mục lục và hình ảnh)
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
        <w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>
        <w:sz w:val="26"/>
        <w:szCs w:val="26"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120" w:line="312" w:lineRule="auto"/>
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
    <w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/></w:rPr>
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
    <w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>
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
 * Đọc Buffer .docx và trích xuất HTML định dạng (giữ nguyên căn lề, gạch chân, bảng biểu, mục lục) + văn bản thuần
 */
const extractHtmlFromDocxBuffer = async (buffer, fallbackText = '') => {
  if (buffer && Buffer.isBuffer(buffer) && buffer.length > 0) {
    try {
      const [htmlResult, rawResult] = await Promise.all([
        mammoth.convertToHtml(
          { buffer },
          {
            transformDocument: mammoth.transforms.paragraph((p) => {
              const sName = String(p.styleName || '');
              const sId = String(p.styleId || '');
              const isH1 = /^heading\s*1$/i.test(sName) || /^heading1$/i.test(sId);
              const isH2 = /^heading\s*2$/i.test(sName) || /^heading2$/i.test(sId);
              const isH3 = /^heading\s*3$/i.test(sName) || /^heading3$/i.test(sId);

              if (p.alignment === 'center') {
                if (isH1) return { ...p, styleName: 'Heading1Center' };
                if (isH2) return { ...p, styleName: 'Heading2Center' };
                if (isH3) return { ...p, styleName: 'Heading3Center' };
                if (!isH1 && !isH2 && !isH3) return { ...p, styleName: 'DocxAlignCenter' };
              } else if (p.alignment === 'right') {
                if (!isH1 && !isH2 && !isH3) return { ...p, styleName: 'DocxAlignRight' };
              } else if (p.alignment === 'both') {
                if (!isH1 && !isH2 && !isH3) return { ...p, styleName: 'DocxAlignJustify' };
              }
              return p;
            }),
            styleMap: [
              "p[style-name='Heading1Center'] => h1.docx-align-center:fresh",
              "p[style-name='Heading2Center'] => h2.docx-align-center:fresh",
              "p[style-name='Heading3Center'] => h3.docx-align-center:fresh",
              "p[style-name='DocxAlignCenter'] => p.docx-align-center:fresh",
              "p[style-name='DocxAlignRight'] => p.docx-align-right:fresh",
              "p[style-name='DocxAlignJustify'] => p.docx-align-justify:fresh",
              'u => u'
            ]
          }
        ),
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
