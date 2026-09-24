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

/**
 * Đọc nội dung tệp tin (hỗ trợ cả MinIO và Local) và trả về văn bản đã cắt độ dài.
 * Ném UnsupportedExtractError nếu không phải PDF / DOCX / TXT / Markdown.
 */
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

module.exports = {
  MAX_EXTRACT_CHARS,
  UNSUPPORTED_MESSAGE,
  UnsupportedExtractError,
  isSupportedExtractType,
  extractText
};
