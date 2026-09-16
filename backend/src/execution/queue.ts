type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  enqueuedAt: number;
};

export interface QueuedResult<T> {
  value: T;
  queuedMs: number;
}

const maxConcurrent = Number(process.env.NOESIS_MAX_CONCURRENT_RUNS ?? 2);
const maxQueued = Number(process.env.NOESIS_MAX_QUEUED_RUNS ?? 12);

let activeCount = 0;
const waiting: QueueTask<unknown>[] = [];

const drainQueue = () => {
  while (activeCount < maxConcurrent && waiting.length > 0) {
    const task = waiting.shift();
    if (!task) return;

    activeCount += 1;
    const queuedMs = Math.max(0, Math.round(performance.now() - task.enqueuedAt));

    task
      .run()
      .then((value) => task.resolve({ value, queuedMs }))
      .catch(task.reject)
      .finally(() => {
        activeCount -= 1;
        drainQueue();
      });
  }
};

export const runQueued = async <T>(run: () => Promise<T>): Promise<QueuedResult<T>> => {
  if (waiting.length >= maxQueued) {
    throw new Error("The execution queue is full. Please try again in a moment.");
  }

  return new Promise<QueuedResult<T>>((resolve, reject) => {
    waiting.push({
      run,
      resolve: resolve as (value: unknown) => void,
      reject,
      enqueuedAt: performance.now()
    });
    drainQueue();
  });
};

export const queueSnapshot = () => ({
  active: activeCount,
  waiting: waiting.length,
  maxConcurrent,
  maxQueued
});
