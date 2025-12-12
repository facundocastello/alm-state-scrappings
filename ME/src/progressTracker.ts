import fs from 'fs';
import path from 'path';
import { config } from './config.js';

const PROGRESS_FILE = path.join(config.dataDir, 'progress.json');

interface ProgressData {
  assistedHousingCompleted: string[];
  assistedHousingFailed: string[];
  nursingHomeCompleted: string[];
  hospiceCompleted: string[];
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
    assistedHousingCompleted: [],
    assistedHousingFailed: [],
    nursingHomeCompleted: [],
    hospiceCompleted: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function saveProgress(progress: ProgressData): void {
  ensureDataDir();
  progress.lastUpdated = new Date().toISOString();
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

export function markAssistedHousingCompleted(licenseNumber: string): void {
  const progress = loadProgress();
  if (!progress.assistedHousingCompleted.includes(licenseNumber)) {
    progress.assistedHousingCompleted.push(licenseNumber);
    saveProgress(progress);
  }
}

export function markAssistedHousingFailed(licenseNumber: string): void {
  const progress = loadProgress();
  if (!progress.assistedHousingFailed.includes(licenseNumber)) {
    progress.assistedHousingFailed.push(licenseNumber);
    saveProgress(progress);
  }
}

export function isAssistedHousingCompleted(licenseNumber: string): boolean {
  const progress = loadProgress();
  return progress.assistedHousingCompleted.includes(licenseNumber);
}

export function getAssistedHousingCompletedSet(): Set<string> {
  return new Set(loadProgress().assistedHousingCompleted);
}

export function markNursingHomeCompleted(facilityId: string): void {
  const progress = loadProgress();
  if (!progress.nursingHomeCompleted.includes(facilityId)) {
    progress.nursingHomeCompleted.push(facilityId);
    saveProgress(progress);
  }
}

export function markHospiceCompleted(facilityId: string): void {
  const progress = loadProgress();
  if (!progress.hospiceCompleted.includes(facilityId)) {
    progress.hospiceCompleted.push(facilityId);
    saveProgress(progress);
  }
}

export function resetProgress(): void {
  if (fs.existsSync(PROGRESS_FILE)) {
    fs.unlinkSync(PROGRESS_FILE);
  }
}
