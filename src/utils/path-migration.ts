import * as fs from 'fs';
import { parseFile } from '@fast-csv/parse';
import { CsvEntry, CsvStructure } from '../model';
import { getCsvFileLinesAsArray, setCsvFileLines } from './storage-utils';
import { normalizePathSeparators } from './workspace-util';

/**
 * Migrate existing CSV file to use normalized path separators (forward slashes)
 * This fixes the issue where CodeRabbit imports use forward slashes while manual additions use backslashes
 *
 * @param reviewFile Path to the CSV file
 * @returns Promise that resolves to the number of entries migrated
 */
export function migratePathSeparators(reviewFile: string): Promise<number> {
  if (!fs.existsSync(reviewFile)) {
    return Promise.resolve(0);
  }

  const rows = getCsvFileLinesAsArray(reviewFile);
  if (rows.length === 0) {
    return Promise.resolve(0);
  }

  let migratedCount = 0;

  return new Promise<number>((resolve) => {
    const entries: CsvEntry[] = [];

    parseFile(reviewFile, { delimiter: ',', ignoreEmpty: true, headers: true })
      .on('error', (error: Error) => {
        console.error('Error parsing CSV file:', error);
        resolve(0);
      })
      .on('data', (entry: CsvEntry) => {
        const originalFilename = entry.filename;
        const normalizedFilename = normalizePathSeparators(entry.filename);

        if (originalFilename !== normalizedFilename) {
          migratedCount++;
          entry.filename = normalizedFilename;
        }

        entries.push(CsvStructure.finalizeParse(entry));
      })
      .on('end', () => {
        if (migratedCount > 0) {
          // Write back the migrated entries
          const lines = [CsvStructure.headerLine].concat(entries.map((entry) => CsvStructure.formatAsCsvLine(entry)));

          if (setCsvFileLines(reviewFile, lines)) {
            console.log(`Migrated ${migratedCount} entries with normalized path separators`);
          } else {
            console.error('Failed to write migrated entries');
            migratedCount = 0;
          }
        }

        resolve(migratedCount);
      });
  });
}
