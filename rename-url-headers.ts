#!/usr/bin/env ts-node
import { readFileSync, writeFileSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { join } from 'path';

interface CSVFile {
  path: string;
  oldHeader: string;
  newHeader: string;
}

const csvFiles: CSVFile[] = [
  {
    path: join(__dirname, 'NC/output/NC.csv'),
    oldHeader: 'profile_url',
    newHeader: 'URL_DETAIL',
  },
  {
    path: join(__dirname, 'MI/output/MI.csv'),
    oldHeader: 'profile_url',
    newHeader: 'URL_DETAIL',
  },
  {
    path: join(__dirname, 'NJ/output/NJ.csv'),
    oldHeader: 'Profile URL',
    newHeader: 'URL_DETAIL',
  },
];

function renameCSVHeader(filePath: string, oldHeader: string, newHeader: string): void {
  console.log(`\nProcessing: ${filePath}`);
  console.log(`  Renaming: "${oldHeader}" → "${newHeader}"`);

  try {
    // Read the CSV file
    const content = readFileSync(filePath, 'utf-8');

    // Parse the CSV
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    });

    if (records.length === 0) {
      console.log('  ⚠️  No records found');
      return;
    }

    // Check if old header exists
    const firstRecord = records[0];
    if (!(oldHeader in firstRecord)) {
      console.log(`  ⚠️  Header "${oldHeader}" not found in CSV`);
      console.log(`  Available headers: ${Object.keys(firstRecord).join(', ')}`);
      return;
    }

    // Rename the header by creating new objects with renamed keys
    const updatedRecords = records.map((record: any) => {
      const newRecord: any = {};
      for (const [key, value] of Object.entries(record)) {
        const newKey = key === oldHeader ? newHeader : key;
        newRecord[newKey] = value;
      }
      return newRecord;
    });

    // Get the new column order (preserving original order)
    const newColumns = Object.keys(firstRecord).map(key =>
      key === oldHeader ? newHeader : key
    );

    // Stringify back to CSV
    const output = stringify(updatedRecords, {
      header: true,
      columns: newColumns,
    });

    // Write back to the same file
    writeFileSync(filePath, output, 'utf-8');

    console.log(`  ✅ Successfully updated ${records.length} records`);
  } catch (error) {
    console.error(`  ❌ Error processing file: ${(error as Error).message}`);
  }
}

function main(): void {
  console.log('🔄 Renaming CSV headers to URL_DETAIL...\n');

  for (const { path, oldHeader, newHeader } of csvFiles) {
    renameCSVHeader(path, oldHeader, newHeader);
  }

  console.log('\n✅ All CSV files processed!');
}

main();
