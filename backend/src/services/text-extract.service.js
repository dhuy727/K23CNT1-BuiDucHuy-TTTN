const mammoth = require('mammoth');
const path = require('path');
const storageService = require('./storage.service');

const MAX_EXTRACT_CHARS = 15000;
const UNSUPPORTED_MESSAGE = 'Không trích xuất được nội dung';

class UnsupportedExtractError extends Error {
  constructor(message = UNSUPPORTED_MESSAGE) {
    super(message);
    this.name = 'UnsupportedExtractError';
    this.code = 'UNSUPPORTED';
  }
}

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown']);
const DOCX_EXTENSIONS = new Set(['docx']);
const PDF_EXTENSIONS = new Set(['pdf']);

const normalizeExtension = (file) => {
  const fromName = path.extname(file?.name || file?.originalName || file?.storagePath || '')
    .replace('.', '')
    .toLowerCase();
  return (file?.extension || fromName || '').toLowerCase().replace(/^\./, '');
};

const isSupportedExtractType = (file) => {
  const ext = normalizeExtension(file);
  return PDF_EXTENSIONS.has(ext) || DOCX_EXTENSIONS.has(ext) || TEXT_EXTENSIONS.has(ext);
};

const clipText = (text) => {
  const normalized = String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (normalized.length <= MAX_EXTRACT_CHARS) {
    return normalized;
  }
  return normalized.slice(0, MAX_EXTRACT_CHARS);
};

const readPdfText = async (buffer) => {
  const pdfParse = require('pdf-parse');
  const result = await pdfParse(buffer);
  return result?.text || '';
};

const readDocxText = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result?.value || '';
};

const readPlainText = (buffer) => {
  return buffer.toString('utf8');
};


const extractText = async (file) => {
  if (!file) {
    throw new UnsupportedExtractError(UNSUPPORTED_MESSAGE);
  }

  const ext = normalizeExtension(file);
  if (!isSupportedExtractType(file)) {
    throw new UnsupportedExtractError(UNSUPPORTED_MESSAGE);
  }

  let buffer;
  try {
    buffer = await storageService.getFileBuffer(file);
  } catch (err) {
    throw new Error(`Không thể đọc dữ liệu file để trích xuất nội dung: ${err.message}`);
  }

  let raw = '';
  if (PDF_EXTENSIONS.has(ext)) {
    raw = await readPdfText(buffer);
  } else if (DOCX_EXTENSIONS.has(ext)) {
    raw = await readDocxText(buffer);
  } else if (TEXT_EXTENSIONS.has(ext)) {
    raw = readPlainText(buffer);
  } else {
    throw new UnsupportedExtractError(UNSUPPORTED_MESSAGE);
  }

  return clipText(raw);
};

const MAX_RAG_EXTRACT_CHARS = 1000000; // Giới hạn an toàn 1 triệu ký tự cho RAG

const sanitizeText = (text) => {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Trích xuất toàn văn bản kèm thông tin trang phục vụ RAG chunking
 */
const extractDocumentForRag = async (file) => {
  if (!file) {
    throw new UnsupportedExtractError(UNSUPPORTED_MESSAGE);
  }

  const ext = normalizeExtension(file);
  if (!isSupportedExtractType(file)) {
    throw new UnsupportedExtractError(UNSUPPORTED_MESSAGE);
  }

  let buffer;
  try {
    buffer = await storageService.getFileBuffer(file);
  } catch (err) {
    throw new Error(`Không thể đọc dữ liệu file để trích xuất nội dung: ${err.message}`);
  }

  const pages = [];
  let fullText = '';

  if (PDF_EXTENSIONS.has(ext)) {
    const pdfParse = require('pdf-parse');
    const result = await pdfParse(buffer);
    const rawPdf = result?.text || '';
    
    // pdf-parse chèn ký tự form-feed '\f' giữa các trang
    const rawPages = rawPdf.split('\f');
    rawPages.forEach((pText, idx) => {
      const clean = sanitizeText(pText);
      if (clean) {
        pages.push({
          pageNumber: idx + 1,
          text: clean
        });
      }
    });

    fullText = pages.map((p) => p.text).join('\n\n');
  } else if (DOCX_EXTENSIONS.has(ext)) {
    const raw = await readDocxText(buffer);
    fullText = sanitizeText(raw);
    if (fullText) {
      pages.push({ pageNumber: 1, text: fullText });
    }
  } else if (TEXT_EXTENSIONS.has(ext)) {
    const raw = readPlainText(buffer);
    fullText = sanitizeText(raw);
    if (fullText) {
      pages.push({ pageNumber: 1, text: fullText });
    }
  } else {
    throw new UnsupportedExtractError(UNSUPPORTED_MESSAGE);
  }

  if (fullText.length > MAX_RAG_EXTRACT_CHARS) {
    fullText = fullText.slice(0, MAX_RAG_EXTRACT_CHARS);
  }

  return {
    pages,
    fullText,
    totalPages: pages.length || 1,
    extension: ext
  };
};

module.exports = {
  MAX_EXTRACT_CHARS,
  MAX_RAG_EXTRACT_CHARS,
  UNSUPPORTED_MESSAGE,
  UnsupportedExtractError,
  isSupportedExtractType,
  extractText,
  extractDocumentForRag
};

