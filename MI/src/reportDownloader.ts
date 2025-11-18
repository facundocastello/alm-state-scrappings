import path from "path";
import fs from "fs";
import { writeFile } from "fs/promises";

import { REPORTS_DIR } from "./config.js";
import { httpClient } from "./http.js";
import type { Report } from "./types.js";
import { ensureDir, formatDateForFile, slugify } from "./utils.js";

const sanitizeFid = (fid: string): string => {
  return fid.replace(/[^\w-]+/g, "_").replace(/_+/g, "_");
};

export const downloadReports = async (
  fid: string,
  reports: Report[]
): Promise<void> => {
  if (!reports.length) return;

  const fidFolder = path.join(REPORTS_DIR, sanitizeFid(fid));
  await ensureDir(fidFolder);

  for (const report of reports) {
    if (!report.documentUrl) continue;

    const datePart = formatDateForFile(report.reportDate) || "undated";
    const typePart = slugify(report.reportType || "report") || "report";
    const fileNamePart = slugify(report.fileName) || "report";

    let extension = ".pdf";
    try {
      const fileExt = path.extname(new URL(report.documentUrl).pathname);
      if (fileExt) {
        extension = fileExt;
      }
    } catch {
      // ignore
    }

    const fileName = `${datePart}-${typePart}-${fileNamePart}${extension}`;
    const filePath = path.join(fidFolder, fileName);

    if (fs.existsSync(filePath)) {
      report.localPath = filePath;
      continue;
    }

    try {
      const buffer = await httpClient.get(report.documentUrl).buffer();
      await writeFile(filePath, buffer);
      report.localPath = filePath;
      console.log(`Saved report ${fileName}`);
    } catch (err) {
      console.error(
        `Failed to download ${report.documentUrl}: ${(err as Error).message}`
      );
    }
  }
};

