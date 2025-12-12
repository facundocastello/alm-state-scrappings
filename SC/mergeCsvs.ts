import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = path.join(__dirname, "input");
const OUTPUT_FILE = path.join(__dirname, "output", "all_facilities.csv");

// All possible columns across all facility types (union of all columns)
const ALL_COLUMNS = [
  "Facility Type",
  "OBJECTID",
  "Name of Facility",
  "Location Street",
  "Location City",
  "Location State",
  "ZIP Code",
  "Phone", // Renamed from "Facility #"
  "Admin Name & Phone",
  "Facility Email",
  "Fac. Cont. Email",
  "License / Expiration",
  "County / Ownership Type",
  "Mailing Address",
  "Mailing City",
  "Mailing State",
  "Mailing ZIP",
  "Licensee",
  "Alzheimer Care",
  "Alzheimer Unit",
  "NH Beds",
  "Institutional NH Beds",
  "Number of Licensed Beds", // Calculated if empty: sum of all bed columns
  "Medical Detox Beds",
  "RTP Beds (PSAD)",
  "Social Detox Beds",
  "x",
  "y",
];

// Bed columns to sum for "Number of Licensed Beds" when empty
const BED_COLUMNS = [
  "NH Beds",
  "Institutional NH Beds",
  "Medical Detox Beds",
  "RTP Beds (PSAD)",
  "Social Detox Beds",
];

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function getFacilityTypeFromFilename(filename: string): string {
  return filename.replace(".csv", "");
}

async function main() {
  // Create output directory
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs.readdirSync(INPUT_DIR).filter((f) => f.endsWith(".csv"));
  const allRows: Map<string, string>[] = [];

  for (const file of files) {
    const facilityType = getFacilityTypeFromFilename(file);
    const filePath = path.join(INPUT_DIR, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter((l) => l.trim());

    if (lines.length < 2) continue;

    // Parse header (remove BOM if present)
    const headerLine = lines[0].replace(/^\uFEFF/, "");
    const headers = parseCSVLine(headerLine);

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]);
      const row = new Map<string, string>();

      // Add facility type
      row.set("Facility Type", facilityType);

      // Map each column
      for (let j = 0; j < headers.length; j++) {
        let colName = headers[j];
        // Rename "Facility #" to "Phone"
        if (colName === "Facility #") {
          colName = "Phone";
        }
        row.set(colName, values[j] || "");
      }

      // Calculate "Number of Licensed Beds" if empty - sum all bed columns
      const licensedBeds = row.get("Number of Licensed Beds");
      if (!licensedBeds || licensedBeds.trim() === "") {
        let total = 0;
        for (const bedCol of BED_COLUMNS) {
          const val = row.get(bedCol);
          if (val && val.trim() !== "") {
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
              total += num;
            }
          }
        }
        if (total > 0) {
          row.set("Number of Licensed Beds", total.toString());
        }
      }

      allRows.push(row);
    }

    console.log(`Processed ${file}: ${lines.length - 1} rows`);
  }

  // Write output CSV
  const outputLines: string[] = [];

  // Header
  outputLines.push(ALL_COLUMNS.map(escapeCSV).join(","));

  // Data rows
  for (const row of allRows) {
    const values = ALL_COLUMNS.map((col) => escapeCSV(row.get(col) || ""));
    outputLines.push(values.join(","));
  }

  fs.writeFileSync(OUTPUT_FILE, outputLines.join("\n"), "utf-8");
  console.log(`\nWrote ${allRows.length} total facilities to ${OUTPUT_FILE}`);
}

main().catch(console.error);
