import fs from "fs";
import { appendFile, readFile, writeFile } from "fs/promises";

import { ensureDir } from "./utils.js";
import {
  DATA_DIR,
  URLS_IN_PROGRESS_PATH,
  URLS_FINISHED_PATH,
} from "./config.js";
import type { FacilitySummary } from "./types.js";

const CSV_HEADER = "timestamp,fid,url\n";

const readCsvAsSet = async (filePath: string): Promise<Set<string>> => {
  if (!fs.existsSync(filePath)) {
    return new Set();
  }

  const content = await readFile(filePath, "utf8");
  return new Set(
    content
      .split("\n")
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [, fid, url] = line.split(",");
        return fid || url || line;
      })
  );
};

const appendCsvLine = async (filePath: string, fid: string, url: string): Promise<void> => {
  const timestamp = new Date().toISOString();
  await appendFile(filePath, `${timestamp},${fid},${url}\n`, "utf8");
};

export class ProgressTracker {
  private inProgressPath: string;
  private finishedPath: string;

  constructor(
    inProgressPath: string = URLS_IN_PROGRESS_PATH,
    finishedPath: string = URLS_FINISHED_PATH
  ) {
    this.inProgressPath = inProgressPath;
    this.finishedPath = finishedPath;
  }

  async init(): Promise<void> {
    await ensureDir(DATA_DIR);
    await Promise.all([this.ensureFile(this.inProgressPath), this.ensureFile(this.finishedPath)]);
  }

  private async ensureFile(filePath: string): Promise<void> {
    if (!fs.existsSync(filePath)) {
      await writeFile(filePath, CSV_HEADER, "utf8");
    }
  }

  async loadFinishedFids(): Promise<Set<string>> {
    return readCsvAsSet(this.finishedPath);
  }

  async markInProgress(summary: FacilitySummary): Promise<void> {
    await appendCsvLine(this.inProgressPath, summary.fid, summary.profileUrl);
  }

  async markFinished(summary: FacilitySummary): Promise<void> {
    await appendCsvLine(this.finishedPath, summary.fid, summary.profileUrl);
  }
}
