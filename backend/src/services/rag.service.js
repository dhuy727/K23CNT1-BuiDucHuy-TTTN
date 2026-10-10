/**
 * Dịch vụ Sinh câu trả lời RAG & Quản lý Luồng hội thoại (Generation & Conversation Service)
 */

const RagConversation = require('../models/ragConversation.model');
const RagMessage = require('../models/ragMessage.model');
const { hybridRetrieve } = require('./rag-retrieval.service');
const ApiError = require('../utils/apiError');

const DEFAULT_GEMINI_MODEL = process.env.AI_MODEL || 'gemini-3.6-flash';
const DEFAULT_OPENAI_MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

const getApiKey = () => (process.env.AI_API_KEY || '').trim();
const getProvider = () => (process.env.AI_PROVIDER || 'gemini').trim().toLowerCase();

/**
 * Xây dựng System Prompt chuẩn mực chống ảo giác
 */
const buildSystemPrompt = (citations = []) => {
  if (citations.length === 0) {
    return `Bạn là Trợ lý AI Quản lý Tài liệu SmartDocs.
Hiện tại không tìm thấy đoạn trích tài liệu nào khớp với câu hỏi của người dùng.
Hãy lịch sự thông báo cho người dùng rằng kho tài liệu được chỉ định không chứa thông tin này, hoặc gợi ý họ kiểm tra lại phạm vi tìm kiếm hoặc đảm bảo tài liệu đã được tải lên và lập chỉ mục. Không được tự bịa ra thông tin.`;
  }

  const contextBlocks = citations
    .map(
      (c, idx) =>
        `[Nguồn ${idx + 1}]
- Tên tệp: ${c.fileName}
- Trang: ${c.pageNumber}
${c.sectionTitle ? `- Tiêu đề mục: ${c.sectionTitle}\n` : ''}- Nội dung trích xuất:
"""
${c.content}
"""`
    )
    .join('\n\n');

  return `Bạn là Trợ lý AI thông minh chuyên gia phân tích tài liệu của hệ thống SmartDocs.
Nhiệm vụ của bạn là trả lời câu hỏi của người dùng một cách chính xác, mạch lạc, dễ hiểu và chuyên nghiệp dựa TRỰC TIẾP trên các đoạn trích tài liệu được cung cấp dưới đây.

QUY TẮC BẮT BUỘC (ANTI-HALLUCINATION & CITATION RULES):
1. CHỈ sử dụng thông tin có trong phần [NGỮ CẢNH TÀI LIỆU] bên dưới để trả lời. TUYỆT ĐỐI KHÔNG tự suy đoán hoặc bịa đặt số liệu, sự kiện.
2. Nếu ngữ cảnh không có đủ thông tin để trả lời câu hỏi, hãy nói rõ ràng: "Dựa trên các tài liệu hiện có trong kho lưu trữ, tôi không tìm thấy thông tin về [chủ đề câu hỏi]".
3. Khi trích dẫn bất kỳ thông tin hoặc số liệu nào từ tài liệu, hãy gắn số nguồn dạng [^1], [^2] tương ứng ở cuối câu để người dùng dễ tra cứu.
4. Trình bày câu trả lời bằng tiếng Việt chuẩn mực, sử dụng định dạng Markdown đẹp mắt (in đậm các từ khóa quan trọng, sử dụng danh sách gạch đầu dòng, bảng biểu nếu có số liệu so sánh).

---
[NGỮ CẢNH TÀI LIỆU]:
${contextBlocks}
---`;
};

/**
 * Gọi Gemini Streaming API qua SSE
 */
const streamGemini = async ({ apiKey, model, messages, onChunk }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?key=${encodeURIComponent(apiKey)}&alt=sse`;

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.3
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini Stream lỗi (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      try {
        const payload = JSON.parse(jsonStr);
        const chunkText = payload?.candidates?.[0]?.content?.parts
          ?.map((p) => p.text || '')
          .join('');

        if (chunkText) {
          fullText += chunkText;
          onChunk(chunkText);
        }
      } catch (err) {
        // bỏ qua parse lỗi dòng lẻ
      }
    }
  }

  return fullText;
};

/**
 * Gọi OpenAI Streaming API
 */
const streamOpenAi = async ({ apiKey, model, messages, onChunk, baseUrl = 'https://api.openai.com/v1' }) => {
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
      stream: true
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI Stream lỗi (${response.status}): ${errorText.slice(0, 300)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === '[DONE]') continue;

      try {
        const payload = JSON.parse(jsonStr);
        const delta = payload?.choices?.[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      } catch (err) {
        // bỏ qua parse lỗi
      }
    }
  }

  return fullText;
};

/**
 * Xử lý phiên hỏi đáp RAG với Streaming SSE
 */
const chatStream = async ({
  userId,
  conversationId,
  message,
  scopeType = 'all',
  scopeTargetId = null,
  onCitations,
  onChunk
}) => {
  const cleanMessage = String(message || '').trim();
  if (!cleanMessage) {
    throw new ApiError(400, 'Nội dung tin nhắn không được để trống');
  }

  // 1. Quản lý hoặc tạo mới RagConversation
  let conversation;
  if (conversationId) {
    conversation = await RagConversation.findOne({ _id: conversationId, user: userId });
    if (!conversation) {
      throw new ApiError(404, 'Không tìm thấy cuộc trò chuyện');
    }
  } else {
    // Tự động đặt tiêu đề tóm tắt từ câu hỏi đầu tiên
    const title = cleanMessage.length > 50 ? `${cleanMessage.slice(0, 48)}...` : cleanMessage;
    conversation = await RagConversation.create({
      user: userId,
      title,
      scopeType,
      scopeTargetId: scopeTargetId || null
    });
  }

  // 2. Lưu tin nhắn của User
  await RagMessage.create({
    conversation: conversation._id,
    role: 'user',
    content: cleanMessage
  });

  // 3. Thực hiện Hybrid Retrieval tìm các đoạn trích liên quan
  console.log(`[RAG Service] Đang truy xuất tài liệu cho câu hỏi: "${cleanMessage.slice(0, 60)}" (Scope: ${scopeType})...`);
  const citations = await hybridRetrieve(
    userId,
    cleanMessage,
    { type: scopeType, targetId: scopeTargetId },
    5
  );

  // Gửi danh sách nguồn trích dẫn về cho Client trước khi sinh văn bản
  if (typeof onCitations === 'function') {
    onCitations(citations);
  }

  // 4. Lấy lịch sử hội thoại gần nhất (tối đa 4 lượt trước đó để duy trì ngữ cảnh ngắn gọn)
  const previousMessages = await RagMessage.find({ conversation: conversation._id })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();

  previousMessages.reverse();

  // 5. Chuẩn bị danh sách Messages cho LLM
  const systemPrompt = buildSystemPrompt(citations);
  const llmMessages = [
    { role: 'user', content: systemPrompt },
    { role: 'assistant', content: 'Tôi đã nắm rõ các đoạn trích tài liệu và sẵn sàng giải đáp câu hỏi của bạn một cách chính xác kèm trích dẫn.' }
  ];

  // Thêm các tin nhắn trước
  previousMessages.forEach((m) => {
    llmMessages.push({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    });
  });

  // 6. Gọi Streaming LLM
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new ApiError(500, 'Hệ thống chưa được cấu hình AI_API_KEY');
  }

  const provider = getProvider();
  let fullAnswer = '';

  if (provider === 'openai' || provider === 'openai-compatible') {
    fullAnswer = await streamOpenAi({
      apiKey,
      model: DEFAULT_OPENAI_MODEL,
      messages: llmMessages,
      onChunk,
      baseUrl: process.env.AI_BASE_URL || 'https://api.openai.com/v1'
    });
  } else {
    fullAnswer = await streamGemini({
      apiKey,
      model: DEFAULT_GEMINI_MODEL,
      messages: llmMessages,
      onChunk
    });
  }

  // 7. Lưu tin nhắn Assistant vào CSDL
  const savedAssistantMessage = await RagMessage.create({
    conversation: conversation._id,
    role: 'assistant',
    content: fullAnswer,
    citations: citations.map((c) => ({
      fileId: c.fileId,
      fileName: c.fileName,
      pageNumber: c.pageNumber,
      sectionTitle: c.sectionTitle,
      snippet: c.content.slice(0, 300),
      similarityScore: c.similarityScore
    }))
  });

  // Cập nhật thời gian tin nhắn cuối
  conversation.lastMessageAt = new Date();
  await conversation.save();

  return {
    conversationId: conversation._id,
    messageId: savedAssistantMessage._id,
    citations
  };
};

module.exports = {
  buildSystemPrompt,
  chatStream
};
