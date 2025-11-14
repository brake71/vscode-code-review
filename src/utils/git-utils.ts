import { execSync } from 'child_process';
import * as path from 'path';

// Cache for current commit SHA to avoid repeated git operations
let cachedCommitSha: string | null = null;
let cachedWorkspaceRoot: string | null = null;

// Cache for file blame results to avoid repeated git operations for the same file
interface BlameCache {
  [filePath: string]: {
    shas: Map<number, string>;
    authors: Map<number, string>;
    timestamp: number;
  };
}

const blameCache: BlameCache = {};
const BLAME_CACHE_TTL = 60000; // 1 minute TTL for blame cache

/**
 * Get the SHA of the current commit
 * @param workspaceRoot The root path of the workspace
 * @returns The current commit SHA or empty string on error
 */
export function getCurrentCommitSha(workspaceRoot: string): string {
  // Return cached value if available and workspace hasn't changed
  if (cachedCommitSha !== null && cachedWorkspaceRoot === workspaceRoot) {
    return cachedCommitSha;
  }

  try {
    const sha = execSync('git rev-parse HEAD', {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();

    // Cache the result
    cachedCommitSha = sha;
    cachedWorkspaceRoot = workspaceRoot;

    return sha;
  } catch (error) {
    // Return empty string on error (e.g., not a git repository, git not installed)
    return '';
  }
}

/**
 * Get the commit SHA for a specific file and line using git blame
 * Falls back to current commit SHA if blame fails
 * Uses caching to avoid repeated git operations for the same file
 * @param workspaceRoot The root path of the workspace
 * @param filename The relative path to the file
 * @param line The line number (1-based)
 * @returns The commit SHA for the specified line or current commit SHA on error
 */
export function getCommitShaForFile(workspaceRoot: string, filename: string, line: number): string {
  const cacheKey = path.resolve(workspaceRoot, filename);

  // Check cache first
  const cached = blameCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < BLAME_CACHE_TTL) {
    const cachedSha = cached.shas.get(line);
    if (cachedSha) {
      return cachedSha;
    }
  }

  try {
    // Construct the absolute path to the file
    const filePath = path.resolve(workspaceRoot, filename);

    // Use git blame to get the commit SHA for the specific line
    // -L specifies the line range, --porcelain gives machine-readable output
    const blameOutput = execSync(`git blame -L ${line},${line} --porcelain "${filePath}"`, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    // The first line of porcelain output contains the commit SHA
    const firstLine = blameOutput.split('\n')[0];
    const sha = firstLine.split(' ')[0];

    // Cache the result
    if (!blameCache[cacheKey]) {
      blameCache[cacheKey] = {
        shas: new Map(),
        authors: new Map(),
        timestamp: Date.now(),
      };
    }
    blameCache[cacheKey].shas.set(line, sha);
    blameCache[cacheKey].timestamp = Date.now();

    return sha || getCurrentCommitSha(workspaceRoot);
  } catch (error) {
    // On error (file doesn't exist, not in git, etc.), return current commit SHA
    return getCurrentCommitSha(workspaceRoot);
  }
}

/**
 * Get the author of a specific line using git blame
 * Uses caching to avoid repeated git operations for the same file
 * @param workspaceRoot The root path of the workspace
 * @param filename The relative path to the file
 * @param line The line number (1-based)
 * @returns The author username or empty string on error
 */
export function getBlameAuthor(workspaceRoot: string, filename: string, line: number): string {
  const cacheKey = path.resolve(workspaceRoot, filename);

  // Check cache first
  const cached = blameCache[cacheKey];
  if (cached && Date.now() - cached.timestamp < BLAME_CACHE_TTL) {
    const cachedAuthor = cached.authors.get(line);
    if (cachedAuthor !== undefined) {
      return cachedAuthor;
    }
  }

  try {
    // Construct the absolute path to the file
    const filePath = path.resolve(workspaceRoot, filename);

    // Use git blame to get author information for the specific line
    // --porcelain gives machine-readable output with author information
    const blameOutput = execSync(`git blame -L ${line},${line} --porcelain "${filePath}"`, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    // Parse the porcelain output to find the author line
    // Format: "author <name>"
    const authorMatch = blameOutput.match(/^author (.+)$/m);
    const author = authorMatch && authorMatch[1] ? authorMatch[1].trim() : '';

    // Cache the result
    if (!blameCache[cacheKey]) {
      blameCache[cacheKey] = {
        shas: new Map(),
        authors: new Map(),
        timestamp: Date.now(),
      };
    }
    blameCache[cacheKey].authors.set(line, author);
    blameCache[cacheKey].timestamp = Date.now();

    return author;
  } catch (error) {
    // Cache empty result to avoid repeated failures
    if (!blameCache[cacheKey]) {
      blameCache[cacheKey] = {
        shas: new Map(),
        authors: new Map(),
        timestamp: Date.now(),
      };
    }
    blameCache[cacheKey].authors.set(line, '');
    blameCache[cacheKey].timestamp = Date.now();

    // Return empty string on error
    return '';
  }
}

/**
 * Batch process git blame for multiple lines in the same file
 * This is more efficient than calling getCommitShaForFile/getBlameAuthor multiple times
 * @param workspaceRoot The root path of the workspace
 * @param filename The relative path to the file
 * @param lines Array of line numbers to process
 * @returns Map of line numbers to {sha, author}
 */
export function batchGetBlameInfo(
  workspaceRoot: string,
  filename: string,
  lines: number[],
): Map<number, { sha: string; author: string }> {
  const result = new Map<number, { sha: string; author: string }>();
  const cacheKey = path.resolve(workspaceRoot, filename);
  const currentSha = getCurrentCommitSha(workspaceRoot);

  // Check cache for all lines first
  const cached = blameCache[cacheKey];
  const uncachedLines: number[] = [];

  if (cached && Date.now() - cached.timestamp < BLAME_CACHE_TTL) {
    for (const line of lines) {
      const cachedSha = cached.shas.get(line);
      const cachedAuthor = cached.authors.get(line);

      if (cachedSha !== undefined && cachedAuthor !== undefined) {
        result.set(line, { sha: cachedSha, author: cachedAuthor });
      } else {
        uncachedLines.push(line);
      }
    }
  } else {
    uncachedLines.push(...lines);
  }

  // If all lines are cached, return early
  if (uncachedLines.length === 0) {
    return result;
  }

  try {
    // Construct the absolute path to the file
    const filePath = path.resolve(workspaceRoot, filename);

    // Get the full blame output for the file (more efficient than multiple calls)
    const blameOutput = execSync(`git blame --porcelain "${filePath}"`, {
      cwd: workspaceRoot,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    // Parse the porcelain output
    const blameLines = blameOutput.split('\n');
    let currentLine = 1;
    let currentShaValue = '';
    let currentAuthor = '';

    for (let i = 0; i < blameLines.length; i++) {
      const line = blameLines[i];

      // First line of each block contains SHA and line info
      if (line.match(/^[0-9a-f]{40}/)) {
        const parts = line.split(' ');
        currentShaValue = parts[0];
        currentLine = parseInt(parts[2], 10);
      } else if (line.startsWith('author ')) {
        currentAuthor = line.substring(7).trim();
      } else if (line.startsWith('\t')) {
        // This is the actual code line, we have all info now
        if (uncachedLines.includes(currentLine)) {
          result.set(currentLine, {
            sha: currentShaValue || currentSha,
            author: currentAuthor,
          });

          // Cache the result
          if (!blameCache[cacheKey]) {
            blameCache[cacheKey] = {
              shas: new Map(),
              authors: new Map(),
              timestamp: Date.now(),
            };
          }
          blameCache[cacheKey].shas.set(currentLine, currentShaValue || currentSha);
          blameCache[cacheKey].authors.set(currentLine, currentAuthor);
          blameCache[cacheKey].timestamp = Date.now();
        }
        currentLine++;
      }
    }

    // Fill in any missing lines with current SHA and empty author
    for (const line of uncachedLines) {
      if (!result.has(line)) {
        result.set(line, { sha: currentSha, author: '' });
      }
    }
  } catch (error) {
    // On error, fill all uncached lines with current SHA and empty author
    for (const line of uncachedLines) {
      result.set(line, { sha: currentSha, author: '' });
    }
  }

  return result;
}

/**
 * Clear the blame cache
 * Useful for testing or when you know the repository has changed
 */
export function clearBlameCache(): void {
  Object.keys(blameCache).forEach((key) => delete blameCache[key]);
}

/**
 * Clear the commit SHA cache
 * Useful for testing or when you know the repository has changed
 */
export function clearCommitShaCache(): void {
  cachedCommitSha = null;
  cachedWorkspaceRoot = null;
}
