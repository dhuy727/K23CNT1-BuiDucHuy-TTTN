const zlib = require('zlib');

/**
 * Bảng tính CRC32 chuẩn cho định dạng ZIP (.xlsx OpenXML)
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
 * Đóng gói danh sách [{ name, data: Buffer | string }] thành tệp ZIP chuẩn (.xlsx)
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

/**
 * Giải nén các entry từ Buffer ZIP (.xlsx) bằng Central Directory
 */
const readZipEntries = (zipBuf) => {
  const entries = new Map();
  if (!Buffer.isBuffer(zipBuf) || zipBuf.length < 22) return entries;

  // Tìm End of Central Directory (0x06054b50) từ cuối buffer
  let eocdOffset = -1;
  const minSearch = Math.max(0, zipBuf.length - 65557);
  for (let i = zipBuf.length - 22; i >= minSearch; i--) {
    if (zipBuf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) return entries;

  const totalEntries = zipBuf.readUInt16LE(eocdOffset + 10);
  let cdOffset = zipBuf.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < totalEntries; i++) {
    if (cdOffset + 46 > zipBuf.length) break;
    const sig = zipBuf.readUInt32LE(cdOffset);
    if (sig !== 0x02014b50) break;

    const compressionMethod = zipBuf.readUInt16LE(cdOffset + 10);
    const compressedSize = zipBuf.readUInt32LE(cdOffset + 20);
    const fileNameLen = zipBuf.readUInt16LE(cdOffset + 28);
    const extraLen = zipBuf.readUInt16LE(cdOffset + 30);
    const commentLen = zipBuf.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = zipBuf.readUInt32LE(cdOffset + 42);

    const fileName = zipBuf.slice(cdOffset + 46, cdOffset + 46 + fileNameLen).toString('utf8');
    cdOffset += 46 + fileNameLen + extraLen + commentLen;

    if (localHeaderOffset + 30 > zipBuf.length) continue;
    const localNameLen = zipBuf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = zipBuf.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compressedSlice = zipBuf.slice(dataStart, dataStart + compressedSize);

    try {
      let contentBuf = null;
      if (compressionMethod === 0) {
        contentBuf = compressedSlice;
      } else if (compressionMethod === 8) {
        contentBuf = zlib.inflateRawSync(compressedSlice);
      }
      if (contentBuf) {
        entries.set(fileName, contentBuf);
      }
    } catch (e) {
      // Bỏ qua entry lỗi
    }
  }

  return entries;
};

const escapeXml = (str = '') =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const decodeXmlEntities = (str = '') =>
  String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&amp;/g, '&');

/**
 * Chuyển chỉ số cột (0 -> A, 25 -> Z, 26 -> AA)
 */
const colIndexToLetter = (colIdx) => {
  let n = colIdx + 1;
  let str = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    n = Math.floor((n - 1) / 26);
  }
  return str;
};

/**
 * Chuyển chữ cái cột (A -> 0, Z -> 25, AA -> 26)
 */
const colLetterToIndex = (letters = '') => {
  let col = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    col = col * 26 + (upper.charCodeAt(i) - 64);
  }
  return Math.max(0, col - 1);
};

/**
 * Chuẩn hóa kích thước lưới 2D tối thiểu cho một Sheet (mặc định tối thiểu 12 dòng x 8 cột)
 */
const normalizeGrid = (rows = [], minRows = 12, minCols = 8) => {
  let maxCols = minCols;
  for (const r of rows) {
    if (Array.isArray(r) && r.length > maxCols) {
      maxCols = r.length;
    }
  }
  const totalRows = Math.max(minRows, rows.length);
  const result = [];
  for (let r = 0; r < totalRows; r++) {
    const srcRow = Array.isArray(rows[r]) ? rows[r] : [];
    const normalizedRow = [];
    for (let c = 0; c < maxCols; c++) {
      normalizedRow.push(srcRow[c] !== undefined && srcRow[c] !== null ? String(srcRow[c]) : '');
    }
    result.push(normalizedRow);
  }
  return result;
};

/**
 * Phân tích chuỗi CSV chuẩn RFC-4180 thành mảng 2 chiều
 */
const parseCsvToGrid = (csvText = '') => {
  const clean = String(csvText || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        currentCell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        currentCell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (ch === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += ch;
      }
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell);
    rows.push(currentRow);
  }

  return normalizeGrid(rows);
};

/**
 * Xuất mảng 2 chiều thành chuỗi CSV (có UTF-8 BOM để mở trực tiếp trên Excel không lỗi tiếng Việt)
 */
const gridToCsvBuffer = (grid = []) => {
  // Cắt bỏ các dòng hoàn toàn trống ở cuối khi xuất CSV
  let lastNonEmptyRow = -1;
  for (let r = 0; r < grid.length; r++) {
    if (Array.isArray(grid[r]) && grid[r].some((cell) => String(cell || '').trim() !== '')) {
      lastNonEmptyRow = r;
    }
  }
  const effectiveRows = lastNonEmptyRow >= 0 ? grid.slice(0, lastNonEmptyRow + 1) : [['']];

  const lines = effectiveRows.map((row) => {
    let lastCol = -1;
    for (let c = 0; c < row.length; c++) {
      if (String(row[c] || '').trim() !== '') {
        lastCol = c;
      }
    }
    const cols = lastCol >= 0 ? row.slice(0, lastCol + 1) : [''];
    return cols
      .map((cell) => {
        const str = String(cell ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
      .join(',');
  });

  return Buffer.from('\uFEFF' + lines.join('\r\n'), 'utf8');
};

/**
 * Đọc Buffer .xlsx hoặc .csv và trả về JSON cấu trúc bảng tính:
 * { sheets: [{ name: 'Sheet1', data: [['A1', 'B1'], ...] }], plainText: '...' }
 */
const extractSpreadsheetFromBuffer = (buffer, extension = 'xlsx', fallbackText = '') => {
  const ext = String(extension || '').toLowerCase().replace(/^\./, '');

  // 1. Nếu là tệp CSV
  if (ext === 'csv') {
    const csvStr = buffer && buffer.length > 0 ? buffer.toString('utf8') : fallbackText || '';
    const data = parseCsvToGrid(csvStr);
    const workbook = {
      sheets: [{ name: 'Sheet1', data }]
    };
    return {
      content: JSON.stringify(workbook),
      plainText: spreadsheetToPlainText(workbook)
    };
  }

  // 2. Nếu là tệp Excel (.xlsx)
  if (buffer && Buffer.isBuffer(buffer) && buffer.length > 22) {
    try {
      const entries = readZipEntries(buffer);
      if (entries.size > 0) {
        // Đọc sharedStrings.xml nếu có
        const sharedStrings = [];
        const ssBuf = entries.get('xl/sharedStrings.xml');
        if (ssBuf) {
          const ssXml = ssBuf.toString('utf8');
          const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
          let siMatch;
          while ((siMatch = siRegex.exec(ssXml)) !== null) {
            const inner = siMatch[1];
            const tParts = [];
            const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/gi;
            let tMatch;
            while ((tMatch = tRegex.exec(inner)) !== null) {
              tParts.push(decodeXmlEntities(tMatch[1]));
            }
            sharedStrings.push(tParts.join(''));
          }
        }

        // Đọc danh sách sheet từ xl/workbook.xml & xl/_rels/workbook.xml.rels
        const relsMap = new Map();
        const wbRelsBuf = entries.get('xl/_rels/workbook.xml.rels');
        if (wbRelsBuf) {
          const relsXml = wbRelsBuf.toString('utf8');
          const relRegex = /<Relationship\b([^>]*?)\/?>/gi;
          let rMatch;
          while ((rMatch = relRegex.exec(relsXml)) !== null) {
            const attrs = rMatch[1];
            const idMatch = /\bId\s*=\s*"([^"]+)"/i.exec(attrs);
            const targetMatch = /\bTarget\s*=\s*"([^"]+)"/i.exec(attrs);
            if (idMatch && targetMatch) {
              let target = targetMatch[1].replace(/^\//, '');
              if (!target.startsWith('xl/')) {
                target = `xl/${target}`;
              }
              relsMap.set(idMatch[1], target);
            }
          }
        }

        const sheetDefs = [];
        const wbBuf = entries.get('xl/workbook.xml');
        if (wbBuf) {
          const wbXml = wbBuf.toString('utf8');
          const sheetRegex = /<sheet\b([^>]*?)\/?>/gi;
          let sMatch;
          while ((sMatch = sheetRegex.exec(wbXml)) !== null) {
            const attrs = sMatch[1];
            const nameMatch = /\bname\s*=\s*"([^"]+)"/i.exec(attrs);
            const rIdMatch = /\br:id\s*=\s*"([^"]+)"/i.exec(attrs);
            const sheetName = nameMatch ? decodeXmlEntities(nameMatch[1]) : `Sheet${sheetDefs.length + 1}`;
            const rId = rIdMatch ? rIdMatch[1] : null;
            const pathInZip = (rId && relsMap.get(rId)) || `xl/worksheets/sheet${sheetDefs.length + 1}.xml`;
            sheetDefs.push({ name: sheetName, path: pathInZip });
          }
        }

        if (sheetDefs.length === 0) {
          for (const key of entries.keys()) {
            if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(key)) {
              sheetDefs.push({ name: `Sheet${sheetDefs.length + 1}`, path: key });
            }
          }
        }

        const parsedSheets = [];
        for (const def of sheetDefs) {
          const sheetBuf = entries.get(def.path);
          if (!sheetBuf) continue;
          const sheetXml = sheetBuf.toString('utf8');
          const gridRows = [];

          const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/gi;
          let rowMatch;
          while ((rowMatch = rowRegex.exec(sheetXml)) !== null) {
            const rowAttrs = rowMatch[1] || '';
            const rowInner = rowMatch[2] || '';
            const rNumMatch = /\br\s*=\s*"(\d+)"/i.exec(rowAttrs);
            const rowIdx = rNumMatch ? Math.max(0, parseInt(rNumMatch[1], 10) - 1) : gridRows.length;

            while (gridRows.length <= rowIdx) {
              gridRows.push([]);
            }

            const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/gi;
            let cellMatch;
            let fallbackColIdx = 0;

            while ((cellMatch = cellRegex.exec(rowInner)) !== null) {
              const cAttrs = cellMatch[1] || '';
              const cInner = cellMatch[2] || '';
              const refMatch = /\br\s*=\s*"([A-Z]+)(\d+)"/i.exec(cAttrs);
              const typeMatch = /\bt\s*=\s*"([^"]+)"/i.exec(cAttrs);

              const colIdx = refMatch ? colLetterToIndex(refMatch[1]) : fallbackColIdx;
              fallbackColIdx = colIdx + 1;
              const cellType = typeMatch ? typeMatch[1] : 'n';

              let val = '';
              if (cellType === 'inlineStr') {
                const tParts = [];
                const tRegex = /<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/gi;
                let tMatch;
                while ((tMatch = tRegex.exec(cInner)) !== null) {
                  tParts.push(decodeXmlEntities(tMatch[1]));
                }
                val = tParts.join('');
              } else {
                const vMatch = /<v(?:\s+[^>]*)?>([\s\S]*?)<\/v>/i.exec(cInner);
                const rawV = vMatch ? decodeXmlEntities(vMatch[1]) : '';
                if (cellType === 's') {
                  const ssIdx = parseInt(rawV, 10);
                  val = !Number.isNaN(ssIdx) && sharedStrings[ssIdx] !== undefined ? sharedStrings[ssIdx] : rawV;
                } else if (cellType === 'b') {
                  val = rawV === '1' ? 'TRUE' : 'FALSE';
                } else {
                  val = rawV;
                }
              }

              while (gridRows[rowIdx].length <= colIdx) {
                gridRows[rowIdx].push('');
              }
              gridRows[rowIdx][colIdx] = val;
            }
          }

          parsedSheets.push({
            name: def.name,
            data: normalizeGrid(gridRows)
          });
        }

        if (parsedSheets.length > 0) {
          const workbook = { sheets: parsedSheets };
          return {
            content: JSON.stringify(workbook),
            plainText: spreadsheetToPlainText(workbook)
          };
        }
      }
    } catch (err) {
      console.warn('[XlsxBuilder] Không thể đọc cấu trúc ZIP .xlsx, chuyển sang fallback:', err.message);
    }
  }

  // Fallback nếu tệp rỗng hoặc mới khởi tạo
  const fallbackGrid = fallbackText ? parseCsvToGrid(fallbackText) : normalizeGrid([]);
  const defaultWorkbook = {
    sheets: [{ name: 'Sheet1', data: fallbackGrid }]
  };
  return {
    content: JSON.stringify(defaultWorkbook),
    plainText: spreadsheetToPlainText(defaultWorkbook)
  };
};

/**
 * Chuyển đổi cấu trúc JSON Workbook sang văn bản thuần phục vụ tìm kiếm AI / RAG
 */
const spreadsheetToPlainText = (workbookOrJson) => {
  try {
    const wb = typeof workbookOrJson === 'string' ? JSON.parse(workbookOrJson) : workbookOrJson;
    if (!wb || !Array.isArray(wb.sheets)) return '';
    return wb.sheets
      .map((sheet) => {
        const rows = Array.isArray(sheet.data) ? sheet.data : [];
        const nonEmptyLines = rows
          .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '').trim()).filter(Boolean).join(' | ') : ''))
          .filter(Boolean);
        if (nonEmptyLines.length === 0) return '';
        return `[${sheet.name || 'Sheet'}]\n${nonEmptyLines.join('\n')}`;
      })
      .filter(Boolean)
      .join('\n\n');
  } catch (e) {
    return '';
  }
};

/**
 * Đóng gói JSON Workbook ({ sheets: [{ name, data }] }) thành Buffer .xlsx hoặc .csv chuẩn
 */
const buildSpreadsheetBufferFromContent = (contentJson = '', extension = 'xlsx') => {
  const ext = String(extension || '').toLowerCase().replace(/^\./, '');
  let workbook;
  try {
    workbook = typeof contentJson === 'string' ? JSON.parse(contentJson) : contentJson;
  } catch (e) {
    workbook = {
      sheets: [{ name: 'Sheet1', data: parseCsvToGrid(String(contentJson || '')) }]
    };
  }

  const sheets =
    Array.isArray(workbook?.sheets) && workbook.sheets.length > 0
      ? workbook.sheets
      : [{ name: 'Sheet1', data: normalizeGrid([]) }];

  // Nếu là định dạng .csv -> xuất CSV UTF-8 BOM
  if (ext === 'csv') {
    return gridToCsvBuffer(sheets[0].data || []);
  }

  // Nếu là định dạng .xlsx / .xls -> đóng gói chuẩn OpenXML SpreadsheetML
  const worksheetOverrides = sheets
    .map(
      (_, idx) =>
        `  <Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join('\n');

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${worksheetOverrides}
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const sheetNodes = sheets
    .map((s, idx) => {
      const safeName = escapeXml(String(s.name || `Sheet${idx + 1}`).slice(0, 31));
      return `    <sheet name="${safeName}" sheetId="${idx + 1}" r:id="rIdSheet${idx + 1}"/>`;
    })
    .join('\n');

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
${sheetNodes}
  </sheets>
</workbook>`;

  const sheetRelsNodes = sheets
    .map(
      (_, idx) =>
        `  <Relationship Id="rIdSheet${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`
    )
    .join('\n');

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
${sheetRelsNodes}
</Relationships>`;

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;

  const zipEntries = [
    { name: '[Content_Types].xml', data: contentTypesXml },
    { name: '_rels/.rels', data: rootRelsXml },
    { name: 'xl/workbook.xml', data: workbookXml },
    { name: 'xl/_rels/workbook.xml.rels', data: workbookRelsXml },
    { name: 'xl/styles.xml', data: stylesXml }
  ];

  sheets.forEach((sheet, idx) => {
    const grid = Array.isArray(sheet.data) ? sheet.data : [];
    const rowXmlParts = [];

    for (let r = 0; r < grid.length; r++) {
      const row = Array.isArray(grid[r]) ? grid[r] : [];
      const cellXmlParts = [];

      for (let c = 0; c < row.length; c++) {
        const rawVal = row[c] !== undefined && row[c] !== null ? String(row[c]) : '';
        if (rawVal === '') continue;

        const cellRef = `${colIndexToLetter(c)}${r + 1}`;
        const trimmed = rawVal.trim();
        const isNumeric = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(trimmed);

        if (isNumeric) {
          cellXmlParts.push(`<c r="${cellRef}"><v>${trimmed}</v></c>`);
        } else {
          cellXmlParts.push(
            `<c r="${cellRef}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(rawVal)}</t></is></c>`
          );
        }
      }

      if (cellXmlParts.length > 0) {
        rowXmlParts.push(`    <row r="${r + 1}">${cellXmlParts.join('')}</row>`);
      }
    }

    const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${rowXmlParts.join('\n')}
  </sheetData>
</worksheet>`;

    zipEntries.push({
      name: `xl/worksheets/sheet${idx + 1}.xml`,
      data: sheetXml
    });
  });

  return createZipBuffer(zipEntries);
};

module.exports = {
  extractSpreadsheetFromBuffer,
  buildSpreadsheetBufferFromContent,
  spreadsheetToPlainText,
  parseCsvToGrid
};

