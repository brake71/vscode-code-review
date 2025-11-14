import * as fs from 'fs';
import { CsvEntry, CsvStructure } from '../model';
import { setCsvFileLines } from './storage-utils';
const parseFile = require('@fast-csv/parse').parseFile;

/**
 * Utility class for merging CSV comments and filtering duplicates
 */
export class CSVMerger {
  constructor(private csvFilePath: string) {}

  /**
   * Read existing comments from the CSV file
   *
   * @returns Promise<CsvEntry[]> Array of existing comments
   */
  public async readExisting(): Promise<CsvEntry[]> {
    // Check if file exists
    if (!fs.existsSync(this.csvFilePath)) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const existingComments: CsvEntry[] = [];

      parseFile(this.csvFilePath, {
        delimiter: ',',
        ignoreEmpty: true,
        headers: true,
      })
        .on('error', (error: Error) => {
          console.error('Error reading CSV file:', error);
          reject(error);
        })
        .on('data', (comment: CsvEntry) => {
          existingComments.push(CsvStructure.finalizeParse(comment));
        })
        .on('end', () => {
          resolve(existingComments);
        });
    });
  }

  /**
   * Merge new comments with existing ones, filtering out duplicates by ID
   *
   * @param existing Array of existing comments
   * @param newComments Array of new comments to merge
   * @returns Object containing merged comments and count of skipped duplicates
   */
  public mergeComments(
    existing: CsvEntry[],
    newComments: CsvEntry[],
  ): { merged: CsvEntry[]; skippedDuplicates: number } {
    // Create a Set of existing IDs for fast lookup
    const existingIds = new Set(existing.map((comment) => comment.id));

    // Filter new comments to exclude duplicates
    const uniqueNewComments: CsvEntry[] = [];
    let skippedDuplicates = 0;

    for (const comment of newComments) {
      if (existingIds.has(comment.id)) {
        skippedDuplicates++;
      } else {
        uniqueNewComments.push(comment);
        // Add to set to prevent duplicates within newComments array
        existingIds.add(comment.id);
      }
    }

    // Merge existing and unique new comments
    const merged = [...existing, ...uniqueNewComments];

    return { merged, skippedDuplicates };
  }

  /**
   * Write comments to the CSV file
   *
   * @param comments Array of comments to write
   * @returns Promise<boolean> true if successful, false otherwise
   */
  public async writeComments(comments: CsvEntry[]): Promise<boolean> {
    try {
      const lines = [CsvStructure.headerLine, ...comments.map((comment) => CsvStructure.formatAsCsvLine(comment))];

      return setCsvFileLines(this.csvFilePath, lines, true);
    } catch (error) {
      console.error('Error writing CSV file:', error);
      return false;
    }
  }
}
