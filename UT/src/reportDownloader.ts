import path from "path";
import fs from "fs";
import { writeFile } from "fs/promises";

import { REPORTS_DIR } from "./config.js";
import { httpClient } from "./http.js";
import type { Checklist } from "./types.js";
import { ensureDir, formatDateForFile, sanitizeFid } from "./utils.js";

export const downloadChecklists = async (
  idNumber: string,
  checklists: Checklist[]
): Promise<void> => {
  if (!checklists.length) return;

  const fidFolder = path.join(REPORTS_DIR, sanitizeFid(idNumber));
  await ensureDir(fidFolder);

  for (const checklist of checklists) {
    const datePart = formatDateForFile(checklist.inspectionDate) || "undated";
    const fileName = `${datePart}-checklist-${checklist.checklistId}.pdf`;
    const filePath = path.join(fidFolder, fileName);

    if (fs.existsSync(filePath)) {
      checklist.localPath = filePath;
      continue;
    }

    try {
      const buffer = await httpClient.get(checklist.downloadUrl).buffer();
      await writeFile(filePath, buffer);
      checklist.localPath = filePath;
      console.log(`  Downloaded: ${fileName}`);
    } catch (err) {
      console.error(
        `  Failed to download checklist ${checklist.checklistId}: ${(err as Error).message}`
      );
    }
  }
};
