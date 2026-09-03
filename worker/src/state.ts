import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Cursor of how far each market has been scanned.
 *
 * Persisted so a restart does not rescan from a market's fromBlock — archive
 * eth_getLogs is the scarcest resource the worker has (C8), and re-reading
 * thousands of blocks after every crash is what exhausts a rate limit.
 */
export interface WorkerState {
  scannedTo: Record<string, number>;
  resolved: Record<string, string>;
}

const PATH = 'worker/.state.json';

export function load(): WorkerState {
  try {
    return JSON.parse(readFileSync(PATH, 'utf8'));
  } catch {
    return { scannedTo: {}, resolved: {} };
  }
}

export function save(s: WorkerState): void {
  mkdirSync(dirname(PATH), { recursive: true });
  writeFileSync(PATH, JSON.stringify(s, null, 2));
}
