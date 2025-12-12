import fs from "fs";
import { mkdir } from "fs/promises";

export const cleanText = (value: string | null | undefined): string => {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/\u00A0/g, " ")
    .trim();
};

export const parseNumber = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const normalized = value.replace(/[^\d.-]/g, "");
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};

export const ensureDir = async (dirPath: string): Promise<void> => {
  if (fs.existsSync(dirPath)) {
    return;
  }
  await mkdir(dirPath, { recursive: true });
};

export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export const formatDateForFile = (value: string): string => {
  // Handle MM/DD/YYYY format
  const match = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (match) {
    const [, month, day, year] = match;
    if (month && day && year) {
      return `${year}${month.padStart(2, "0")}${day.padStart(2, "0")}`;
    }
  }
  // Handle YYYY-MM-DD format (Utah API format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.replace(/-/g, "");
  }
  return value.replace(/[^\d]/g, "") || "undated";
};

export const sanitizeFid = (fid: string): string => {
  return fid.replace(/[^\w-]+/g, "_").replace(/_+/g, "_");
};
