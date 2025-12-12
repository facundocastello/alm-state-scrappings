import fs from "fs";
import { config } from "./config.js";

export class ProgressTracker {
  private filePath: string;
  private completed: Set<string>;

  constructor(filePath: string = config.paths.reportsFinished) {
    this.filePath = filePath;
    this.completed = new Set();
    this.load();
  }

  private load(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    const content = fs.readFileSync(this.filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      this.completed.add(line.trim());
    }

    console.log(`Loaded ${this.completed.size} completed facilities from progress file`);
  }

  isCompleted(id: string): boolean {
    return this.completed.has(id);
  }

  markCompleted(id: string): void {
    if (this.completed.has(id)) return;

    this.completed.add(id);

    // Ensure directory exists
    const dir = this.filePath.substring(0, this.filePath.lastIndexOf("/"));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Append to file
    fs.appendFileSync(this.filePath, `${id}\n`);
  }

  getCompletedCount(): number {
    return this.completed.size;
  }

  getCompleted(): Set<string> {
    return new Set(this.completed);
  }
}
