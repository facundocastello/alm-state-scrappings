import path from "path";
import fs from "fs";
import { writeFile } from "fs/promises";

import { REPORTS_DIR } from "./config.js";
import { httpClient } from "./http.js";
import type { StatementOfDeficiency } from "./types.js";
import { ensureDir, formatDateForFile, slugify } from "./utils.js";

const sanitizeFid = (fid: string): string => {
  return fid.replace(/[^\w-]+/g, "_").replace(/_+/g, "_");
};

export const downloadReports = async (
  fid: string,
  statements: StatementOfDeficiency[]
): Promise<void> => {
  if (!statements.length) return;

  const fidFolder = path.join(REPORTS_DIR, sanitizeFid(fid));
  await ensureDir(fidFolder);

  for (const statement of statements) {
    if (!statement.documentUrl) continue;

    const datePart = formatDateForFile(statement.inspectionDate) || "undated";
    const typePart = slugify(statement.documentType || "report") || "report";

    let extension = ".pdf";
    try {
      const fileExt = path.extname(new URL(statement.documentUrl).pathname);
      if (fileExt) {
        extension = fileExt;
      }
    } catch {
      // ignore
    }

    const fileName = `${datePart}-${typePart}${extension}`;
    const filePath = path.join(fidFolder, fileName);

    if (fs.existsSync(filePath)) {
      statement.localPath = filePath;
      continue;
    }

    try {
      const buffer = await httpClient.get(statement.documentUrl).buffer();
      await writeFile(filePath, buffer);
      statement.localPath = filePath;
      console.log(`Saved report ${fileName}`);
    } catch (err) {
      console.error(
        `Failed to download ${statement.documentUrl}: ${(err as Error).message}`
      );
    }
  }
};

