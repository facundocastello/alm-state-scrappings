import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const PROGRESS_FILE = path.join(config.dataDir, 'progress.json');

interface ProgressData {
  completed: string[];
  failed: string[];
  lastUpdated: string;
}

function ensureDataDir(): void {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

export function loadProgress(): ProgressData {
  ensureDataDir();

  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data) as ProgressData;
  }

  return {
    completed: [],
    failed: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function saveProgress(progress: ProgressData): void {
  ensureDataDir();
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

export function markCompleted(url: string): void {
  const progress = loadProgress();
  if (!progress.completed.includes(url)) {
    progress.completed.push(url);
    saveProgress(progress);
  }
}

export function markFailed(url: string): void {
  const progress = loadProgress();
  if (!progress.failed.includes(url)) {
    progress.failed.push(url);
    saveProgress(progress);
  }
}

export function isCompleted(url: string): boolean {
  const progress = loadProgress();
  return progress.completed.includes(url);
}

export function getCompletedUrls(): string[] {
  return loadProgress().completed;
}

export function resetProgress(): void {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}
