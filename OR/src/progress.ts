/**
 * Progress Tracking for Resume Capability
 */
import fs from "fs/promises";
import { PROGRESS_CSV, DATA_DIR } from "./config.js";

interface ProgressEntry {
  timestamp: string;
  facilityId: string;
  status: "completed" | "error";
  error?: string;
}

/**
 * Progress tracker for resumable scraping
 */
export class ProgressTracker {
  private completedIds: Set<string> = new Set();

  /**
   * Initialize tracker - load existing progress
   */
  async init(): Promise<void> {
    await fs.mkdir(DATA_DIR, { recursive: true });

    try {
      const content = await fs.readFile(PROGRESS_CSV, "utf-8");
      const lines = content.trim().split("\n").slice(1); // Skip header

      for (const line of lines) {
        const [, facilityId, status] = line.split(",");
        if (status === "completed") {
          this.completedIds.add(facilityId);
        }
      }

      console.log(`Loaded ${this.completedIds.size} completed facilities from progress file`);
    } catch {
      // File doesn't exist, create with header
      await fs.writeFile(PROGRESS_CSV, "timestamp,facilityId,status,error\n");
      console.log("Created new progress file");
    }
  }

  /**
   * Check if facility has been processed
   */
  isCompleted(facilityId: string): boolean {
    return this.completedIds.has(facilityId);
  }

  /**
   * Get set of completed facility IDs
   */
  getCompletedIds(): Set<string> {
    return new Set(this.completedIds);
  }

  /**
   * Mark facility as completed
   */
  async markCompleted(facilityId: string): Promise<void> {
    this.completedIds.add(facilityId);
    await this.appendEntry({
      timestamp: new Date().toISOString(),
      facilityId,
      status: "completed",
    });
  }

  /**
   * Mark facility as errored
   */
  async markError(facilityId: string, error: string): Promise<void> {
    await this.appendEntry({
      timestamp: new Date().toISOString(),
      facilityId,
      status: "error",
      error: error.replace(/,/g, ";").replace(/\n/g, " "),
    });
  }

  /**
   * Append entry to progress file
   */
  private async appendEntry(entry: ProgressEntry): Promise<void> {
    const line = `${entry.timestamp},${entry.facilityId},${entry.status},${entry.error || ""}\n`;
    await fs.appendFile(PROGRESS_CSV, line);
  }

  /**
   * Get statistics
   */
  getStats(): { completed: number } {
    return {
      completed: this.completedIds.size,
    };
  }
}
