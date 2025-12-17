import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INPUT_FILE = path.join(__dirname, "output", "all_facilities.csv");
const OUTPUT_FILE = path.join(__dirname, "output", "all_facilities.csv");

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function splitLicenseExpiration(value: string): { license: string; expiration: string } {
  // Format: "NCF-0730 / 12/31/2026"
  const parts = value.split(" / ");
  if (parts.length === 2) {
    return { license: parts[0].trim(), expiration: parts[1].trim() };
  }
  return { license: value, expiration: "" };
}

function splitAdminNamePhone(value: string): { name: string; phone: string } {
  // Format: "GILL, KATHRYN PH#: 803-359-5181" or "GILL, KATHRYN PH#:"
  const match = value.match(/^(.+?)\s*PH#:\s*(.*)$/);
  if (match) {
    return { name: match[1].trim(), phone: match[2].trim() };
  }
  return { name: value, phone: "" };
}

async function main() {
  const content = fs.readFileSync(INPUT_FILE, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  if (lines.length < 2) {
    console.log("No data to process");
    return;
  }

  // Parse header
  const headers = parseCSVLine(lines[0]);

  // Find indices of columns to split
  const licenseExpIdx = headers.indexOf("License / Expiration");
  const adminNamePhoneIdx = headers.indexOf("Admin Name & Phone");

  if (licenseExpIdx === -1 || adminNamePhoneIdx === -1) {
    console.log("Columns already split or not found");
    console.log("License / Expiration index:", licenseExpIdx);
    console.log("Admin Name & Phone index:", adminNamePhoneIdx);
    return;
  }

  // Create new headers
  const newHeaders = [...headers];
  // Replace "License / Expiration" with "License", "Expiration"
  newHeaders.splice(licenseExpIdx, 1, "License", "Expiration");
  // Adjust index for admin column (shifted by 1 if after license)
  const adjustedAdminIdx = adminNamePhoneIdx > licenseExpIdx ? adminNamePhoneIdx + 1 : adminNamePhoneIdx;
  // Replace "Admin Name & Phone" with "Admin Name", "Admin Phone"
  newHeaders.splice(adjustedAdminIdx, 1, "Admin Name", "Admin Phone");

  const outputLines: string[] = [];
  outputLines.push(newHeaders.map(escapeCSV).join(","));

  // Process data rows
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);

    // Split license/expiration
    const licenseExp = splitLicenseExpiration(values[licenseExpIdx] || "");
    values.splice(licenseExpIdx, 1, licenseExp.license, licenseExp.expiration);

    // Adjust admin index and split
    const adjustedAdminIdx = adminNamePhoneIdx > licenseExpIdx ? adminNamePhoneIdx + 1 : adminNamePhoneIdx;
    const adminNamePhone = splitAdminNamePhone(values[adjustedAdminIdx] || "");
    values.splice(adjustedAdminIdx, 1, adminNamePhone.name, adminNamePhone.phone);

    outputLines.push(values.map(escapeCSV).join(","));
  }

  fs.writeFileSync(OUTPUT_FILE, outputLines.join("\n"), "utf-8");
  console.log(`Updated ${lines.length - 1} rows`);
  console.log(`Split "License / Expiration" → "License", "Expiration"`);
  console.log(`Split "Admin Name & Phone" → "Admin Name", "Admin Phone"`);
}

main().catch(console.error);
