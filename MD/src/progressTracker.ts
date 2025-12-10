import { readFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname } from 'path';
import { config } from './config.js';

/**
 * Progress tracker for resumable scraping
 */
export class ProgressTracker {
  private inProgressPath: string;
  private finishedPath: string;

  constructor() {
    this.inProgressPath = config.paths.progress.inProgress;
    this.finishedPath = config.paths.progress.finished;
  }

  /**
   * Initialize progress files
   */
  async init(): Promise<void> {
    await mkdir(dirname(this.inProgressPath), { recursive: true });

    if (!existsSync(this.inProgressPath)) {
      await appendFile(this.inProgressPath, 'timestamp,assistedLivingId,name\n');
    }
    if (!existsSync(this.finishedPath)) {
      await appendFile(this.finishedPath, 'timestamp,assistedLivingId,name\n');
    }
  }

  /**
   * Load set of finished facility IDs
   */
  async loadFinishedIds(): Promise<Set<number>> {
    if (!existsSync(this.finishedPath)) {
      return new Set();
    }

    const content = await readFile(this.finishedPath, 'utf-8');
    const lines = content.trim().split('\n').slice(1); // Skip header

    const ids = new Set<number>();
    for (const line of lines) {
      const [, idStr] = line.split(',');
      if (idStr) {
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          ids.add(id);
        }
      }
    }

    return ids;
  }

  /**
   * Mark a facility as in progress
   */
  async markInProgress(id: number, name: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const safeName = name.replace(/,/g, ' ').replace(/"/g, "'");
    await appendFile(this.inProgressPath, `${timestamp},${id},"${safeName}"\n`);
  }

  /**
   * Mark a facility as finished
   */
  async markFinished(id: number, name: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const safeName = name.replace(/,/g, ' ').replace(/"/g, "'");
    await appendFile(this.finishedPath, `${timestamp},${id},"${safeName}"\n`);
  }
}
