/**
 * Động cơ Hàng đợi Tác vụ Nền Tự Thích Ứng (Hybrid Adaptive Background Queue Engine)
 * - Tự động phát hiện Redis (trong môi trường Docker / Production) và sử dụng BullMQ.
 * - Tự động fallback sang In-Memory Queue (đa luồng kiểm soát concurrency) khi chạy dev local không có Redis.
 */

const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');

const JOB_TYPES = {
  AI_CLASSIFY: 'AI_CLASSIFY',
  RAG_INDEX: 'RAG_INDEX'
};

const QUEUE_NAME = 'docuflow_heavy_jobs';
const CONCURRENCY_LIMIT = 2; // Giới hạn xử lý đồng thời 2 tác vụ nặng để tránh tràn RAM và nghẽn CPU

let queueMode = 'in-memory'; // 'bullmq' | 'in-memory'
let bullQueue = null;
let bullWorker = null;
let redisClient = null;

// Hàng đợi In-Memory dùng khi không có Redis
const inMemoryQueue = {
  queue: [],
  activeCount: 0,
  history: { completed: 0, failed: 0 },

  enqueue(type, data) {
    const job = { id: `mem_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`, type, data, createdAt: new Date() };
    this.queue.push(job);
    this.processNext();
    return job.id;
  },

  async processNext() {
    if (this.activeCount >= CONCURRENCY_LIMIT || this.queue.length === 0) {
      return;
    }

    const job = this.queue.shift();
    this.activeCount++;

    setImmediate(async () => {
      try {
        await executeJob(job.type, job.data);
        this.history.completed++;
      } catch (err) {
        console.error(`[In-Memory Queue] Thất bại khi xử lý tác vụ ${job.type} (${job.id}):`, err.message);
        this.history.failed++;
      } finally {
        this.activeCount--;
        this.processNext();
      }
    });
  }
};

/**
 * Trực tiếp thực thi logic nghiệp vụ của từng loại Job
 */
const executeJob = async (type, data) => {
  const { fileId } = data;
  if (!fileId) return;

  switch (type) {
    case JOB_TYPES.AI_CLASSIFY: {
      const aiService = require('../services/ai.service');
      console.log(`[Queue Worker] Đang phân loại AI & trích xuất văn bản cho file: ${fileId}...`);
      await aiService.processFile(fileId);
      break;
    }

    case JOB_TYPES.RAG_INDEX: {
      const ragIndexingService = require('../services/rag-indexing.service');
      console.log(`[Queue Worker] Đang lập chỉ mục RAG (Chunking + Embeddings) cho file: ${fileId}...`);
      await ragIndexingService.indexFileForRag(fileId);
      break;
    }

    default:
      console.warn(`[Queue Worker] Loại tác vụ không xác định: ${type}`);
  }
};

/**
 * Khởi tạo hệ thống Hàng đợi (Kiểm tra Redis -> BullMQ hoặc Fallback In-Memory)
 */
const initQueueEngine = async () => {
  const redisHost = process.env.REDIS_HOST || (process.env.NODE_ENV === 'production' ? 'redis' : null);
  const redisPort = parseInt(process.env.REDIS_PORT, 10) || 6379;

  if (redisHost) {
    try {
      console.log(`[Queue Engine] Đang thử kết nối Redis tại ${redisHost}:${redisPort}...`);
      const testClient = new Redis({
        host: redisHost,
        port: redisPort,
        password: process.env.REDIS_PASSWORD || undefined,
        connectTimeout: 2500,
        maxRetriesPerRequest: null,
        retryStrategy: () => null // Không retry vô tận nếu Redis offline
      });

      await new Promise((resolve, reject) => {
        testClient.once('ready', resolve);
        testClient.once('error', reject);
      });

      redisClient = testClient;
      bullQueue = new Queue(QUEUE_NAME, { connection: redisClient });

      bullWorker = new Worker(
        QUEUE_NAME,
        async (job) => {
          await executeJob(job.data.type, job.data);
        },
        {
          connection: new Redis({
            host: redisHost,
            port: redisPort,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: null
          }),
          concurrency: CONCURRENCY_LIMIT
        }
      );

      bullWorker.on('completed', (job) => {
        console.log(`[BullMQ Worker] Đã hoàn tất tác vụ: ${job.name} (ID: ${job.id})`);
      });

      bullWorker.on('failed', (job, err) => {
        console.error(`[BullMQ Worker] Lỗi xử lý tác vụ ${job?.name} (ID: ${job?.id}):`, err.message);
      });

      queueMode = 'bullmq';
      console.log(`🚀 [Queue Engine] Khởi chạy thành công với BullMQ + Redis (${CONCURRENCY_LIMIT} luồng xử lý đồng thời)!`);
      return;
    } catch (redisErr) {
      console.warn(`⚠️ [Queue Engine] Không thể kết nối Redis (${redisErr.message}). Tự động kích hoạt In-Memory Adaptive Queue!`);
    }
  }

  // Fallback an toàn cho Local Development
  queueMode = 'in-memory';
  console.log(`⚡ [Queue Engine] Đang hoạt động ở chế độ In-Memory Concurrency Queue (Giới hạn tối đa ${CONCURRENCY_LIMIT} tác vụ đồng thời).`);
};

/**
 * Đẩy một tác vụ vào hàng đợi
 */
const enqueueJob = async (type, data) => {
  if (queueMode === 'bullmq' && bullQueue) {
    try {
      const job = await bullQueue.add(type, { type, ...data }, {
        attempts: 2,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: true,
        removeOnFail: 100
      });
      return job.id;
    } catch (err) {
      console.warn('[Queue Engine] Lỗi đẩy vào BullMQ, fallback sang In-Memory:', err.message);
      return inMemoryQueue.enqueue(type, data);
    }
  }

  return inMemoryQueue.enqueue(type, data);
};

// API Helper tiện ích
const enqueueAiProcess = (fileId) => enqueueJob(JOB_TYPES.AI_CLASSIFY, { fileId });
const enqueueRagIndex = (fileId) => enqueueJob(JOB_TYPES.RAG_INDEX, { fileId });

const getQueueStatus = async () => {
  if (queueMode === 'bullmq' && bullQueue) {
    const counts = await bullQueue.getJobCounts('waiting', 'active', 'completed', 'failed');
    return {
      mode: 'bullmq-redis',
      concurrencyLimit: CONCURRENCY_LIMIT,
      ...counts
    };
  }

  return {
    mode: 'in-memory-queue',
    concurrencyLimit: CONCURRENCY_LIMIT,
    waiting: inMemoryQueue.queue.length,
    active: inMemoryQueue.activeCount,
    ...inMemoryQueue.history
  };
};

module.exports = {
  JOB_TYPES,
  initQueueEngine,
  enqueueJob,
  enqueueAiProcess,
  enqueueRagIndex,
  getQueueStatus
};
