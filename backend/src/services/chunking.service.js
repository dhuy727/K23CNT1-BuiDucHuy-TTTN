/**
 * Dịch vụ băm nhỏ văn bản (Semantic Text Chunking) cho RAG
 */

const DEFAULT_CHUNK_SIZE = 1200; // ~300 tokens
const DEFAULT_CHUNK_OVERLAP = 200; // ~50 tokens
const MIN_CHUNK_SIZE = 100; // bỏ qua các mẩu vụn quá ngắn

const estimateTokens = (text) => {
  if (!text) return 0;
  // Ước tính số token cho tiếng Việt và tiếng Anh (~3.5 - 4 ký tự / token)
  return Math.ceil(text.length / 3.8);
};

const extractSectionTitle = (text) => {
  if (!text) return '';
  const lines = text.trim().split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('#') || trimmed.length < 80) {
      return trimmed.replace(/^[#*\s-]+/, '').slice(0, 100);
    }
    break;
  }
  return '';
};

/**
 * Thuật toán tách đoạn Recursive Text Splitter
 */
const splitTextRecursively = (text, targetSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) => {
  if (!text || text.length <= targetSize) {
    return text && text.trim().length >= MIN_CHUNK_SIZE ? [text.trim()] : (text ? [text.trim()] : []);
  }

  const separators = ['\n\n# ', '\n\n', '\n', '. ', '! ', '? ', '; ', ' '];
  const chunks = [];

  const splitRecursive = (str, sepIndex = 0) => {
    if (str.length <= targetSize) {
      if (str.trim().length >= MIN_CHUNK_SIZE) {
        chunks.push(str.trim());
      }
      return;
    }

    if (sepIndex >= separators.length) {
      // Nếu đã thử mọi dấu phân tách mà vẫn dài hơn targetSize -> cắt thô
      for (let i = 0; i < str.length; i += (targetSize - overlap)) {
        const piece = str.slice(i, i + targetSize).trim();
        if (piece.length >= MIN_CHUNK_SIZE) {
          chunks.push(piece);
        }
      }
      return;
    }

    const sep = separators[sepIndex];
    const parts = str.split(sep);

    if (parts.length === 1) {
      // Không tìm thấy separator này trong chuỗi -> thử separator tiếp theo
      splitRecursive(str, sepIndex + 1);
      return;
    }

    let currentChunk = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partWithSep = i < parts.length - 1 ? part + sep : part;

      if ((currentChunk + partWithSep).length <= targetSize) {
        currentChunk += partWithSep;
      } else {
        if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
          chunks.push(currentChunk.trim());
          // Tạo overlap bằng cách lấy đuôi của chunk hiện tại
          const overlapText = currentChunk.slice(Math.max(0, currentChunk.length - overlap));
          currentChunk = overlapText + partWithSep;
        } else {
          // Đoạn hiện tại quá dài hoặc chưa có gì -> đệ quy xuống cấp phân tách nhỏ hơn
          if (partWithSep.length > targetSize) {
            splitRecursive(partWithSep, sepIndex + 1);
            currentChunk = '';
          } else {
            currentChunk = partWithSep;
          }
        }
      }
    }

    if (currentChunk.trim().length >= MIN_CHUNK_SIZE) {
      chunks.push(currentChunk.trim());
    }
  };

  splitRecursive(text, 0);

  // Loại bỏ các chunk trùng lặp liên tiếp do overlap
  const uniqueChunks = [];
  for (const c of chunks) {
    if (!uniqueChunks.includes(c)) {
      uniqueChunks.push(c);
    }
  }

  return uniqueChunks;
};

/**
 * Phân tích và tạo danh sách chunks từ tài liệu đã trích xuất
 */
const createChunksFromDocument = ({ pages = [], fullText = '' }, options = {}) => {
  const targetSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = options.overlap || DEFAULT_CHUNK_OVERLAP;

  const results = [];
  let globalChunkIndex = 0;

  if (pages && pages.length > 0) {
    // Có phân tách theo trang (ví dụ PDF)
    pages.forEach((page) => {
      const pageChunks = splitTextRecursively(page.text, targetSize, overlap);
      pageChunks.forEach((chunkText) => {
        results.push({
          chunkIndex: globalChunkIndex++,
          content: chunkText,
          pageNumber: page.pageNumber || 1,
          sectionTitle: extractSectionTitle(chunkText),
          tokenCount: estimateTokens(chunkText)
        });
      });
    });
  } else if (fullText) {
    // Không có trang rõ ràng (DOCX, TXT)
    const textChunks = splitTextRecursively(fullText, targetSize, overlap);
    textChunks.forEach((chunkText) => {
      results.push({
        chunkIndex: globalChunkIndex++,
        content: chunkText,
        pageNumber: 1,
        sectionTitle: extractSectionTitle(chunkText),
        tokenCount: estimateTokens(chunkText)
      });
    });
  }

  return results;
};

module.exports = {
  DEFAULT_CHUNK_SIZE,
  DEFAULT_CHUNK_OVERLAP,
  estimateTokens,
  splitTextRecursively,
  createChunksFromDocument
};
