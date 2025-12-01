/**
 * Progress tracking for resumable scraping
 */
import fs from "fs/promises";
import { createReadStream, createWriteStream, existsSync } from "fs";
import { createInterface } from "readline";

const PROGRESS_FILE = "data/progress.csv";

/**
 * Load completed facility IDs from progress file
 */
export async function loadProgress(): Promise<Set<string>> {
  const completed = new Set<string>();

  if (!existsSync(PROGRESS_FILE)) {
    return completed;
  }

  const fileStream = createReadStream(PROGRESS_FILE);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const [facilityId, status] = line.split(",");
    if (status === "completed") {
      completed.add(facilityId);
    }
  }

  return completed;
}

/**
 * Mark a facility as completed
 */
export async function markCompleted(facilityId: string): Promise<void> {
  await fs.mkdir("data", { recursive: true });

  const line = `${facilityId},completed,${new Date().toISOString()}\n`;
  await fs.appendFile(PROGRESS_FILE, line);
}

/**
 * Mark a facility as failed
 */
export async function markFailed(facilityId: string, error: string): Promise<void> {
  await fs.mkdir("data", { recursive: true });

  const sanitizedError = error.replace(/,/g, ";").replace(/\n/g, " ");
  const line = `${facilityId},failed,${new Date().toISOString()},${sanitizedError}\n`;
  await fs.appendFile(PROGRESS_FILE, line);
}

/**
 * Initialize progress file with header
 */
export async function initProgress(): Promise<void> {
  await fs.mkdir("data", { recursive: true });

  if (!existsSync(PROGRESS_FILE)) {
    await fs.writeFile(PROGRESS_FILE, "facility_id,status,timestamp,error\n");
  }
}

/**
 * Get progress statistics
 */
export async function getProgressStats(): Promise<{
  completed: number;
  failed: number;
  total: number;
}> {
  let completed = 0;
  let failed = 0;

  if (!existsSync(PROGRESS_FILE)) {
    return { completed: 0, failed: 0, total: 0 };
  }

  const fileStream = createReadStream(PROGRESS_FILE);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let first = true;
  for await (const line of rl) {
    if (first) {
      first = false;
      continue; // Skip header
    }
    const [, status] = line.split(",");
    if (status === "completed") completed++;
    else if (status === "failed") failed++;
  }

  return { completed, failed, total: completed + failed };
}
