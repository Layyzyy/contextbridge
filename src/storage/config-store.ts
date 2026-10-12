/**
 * ContextBridge — Configuration Store
 *
 * Manages reading and writing of the project-level config file.
 */

import path from 'node:path';
import { atomicWriteFile, readFileOrNull, pathExists, ensureDir } from '../adapters/filesystem.js';
import { parseConfig, DEFAULT_CONFIG, type Config } from '../schema/config.js';
import { resolveAndValidateReal } from '../security/path-safety.js';
import {
  NotInitializedError,
  AlreadyInitializedError,
  ConfigurationError,
} from '../core/errors.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const CONTEXTBRIDGE_DIR = '.contextbridge';
export const CONFIG_FILENAME = 'config.json';
export const SNAPSHOTS_SUBDIR = 'snapshots';
export const GITIGNORE_FILENAME = '.gitignore';

// ---------------------------------------------------------------------------
// Config store
// ---------------------------------------------------------------------------

export class ConfigStore {
  private readonly projectRoot: string;
  private readonly cbDir: string;
  private readonly configPath: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
    this.cbDir = path.join(this.projectRoot, CONTEXTBRIDGE_DIR);
    this.configPath = path.join(this.cbDir, CONFIG_FILENAME);
  }

  get contextBridgeDir(): string {
    return this.cbDir;
  }

  get configFilePath(): string {
    return this.configPath;
  }

  /**
   * Check whether ContextBridge has been initialized in this project.
   */
  async isInitialized(): Promise<boolean> {
    return pathExists(this.configPath);
  }

  /**
   * Read the configuration file. Throws NotInitializedError if not initialized.
   */
  async read(): Promise<Config> {
    const raw = await readFileOrNull(this.configPath);
    if (raw === null) {
      throw new NotInitializedError(this.projectRoot);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ConfigurationError(
        `Config file at "${this.configPath}" is not valid JSON. ` +
          `Please fix the file or run "contextbridge init --force" to reset it.`,
      );
    }

    return parseConfig(parsed);
  }

  /**
   * Write a configuration to disk.
   */
  async write(config: Config): Promise<void> {
    const validated = parseConfig(config);
    await atomicWriteFile(this.configPath, JSON.stringify(validated, null, 2) + '\n', 0o600);
  }

  /**
   * Update configuration with partial values.
   */
  async update(updates: Partial<Config>): Promise<Config> {
    const current = await this.read();
    const updated = parseConfig({ ...current, ...updates });
    await this.write(updated);
    return updated;
  }

  /**
   * Initialize ContextBridge in the project directory.
   * Creates the .contextbridge/ directory, config.json, and a .gitignore.
   */
  async initialize(options: { force?: boolean } = {}): Promise<InitResult> {
    const alreadyExists = await this.isInitialized();

    if (alreadyExists && !options.force) {
      throw new AlreadyInitializedError(this.projectRoot);
    }

    const created: string[] = [];

    // Write default config
    await this.write(DEFAULT_CONFIG);
    created.push(this.configPath);

    // Create snapshots directory
    const snapshotsDir = path.join(this.cbDir, SNAPSHOTS_SUBDIR);
    const snapshotDirPath = resolveAndValidateReal(this.cbDir, SNAPSHOTS_SUBDIR);
    if (!(await pathExists(snapshotDirPath))) {
      await ensureDir(snapshotsDir);
      created.push(snapshotsDir);
    }

    // Create .gitignore to protect snapshots from accidental commit
    const gitignorePath = path.join(this.cbDir, GITIGNORE_FILENAME);
    if (!(await pathExists(gitignorePath))) {
      const gitignoreContent = [
        '# ContextBridge — local snapshots',
        '# Remove entries below if you want to commit snapshots to version control',
        'snapshots/',
        '',
      ].join('\n');
      await atomicWriteFile(gitignorePath, gitignoreContent, 0o644);
      created.push(gitignorePath);
    }

    return {
      projectRoot: this.projectRoot,
      cbDir: this.cbDir,
      configPath: this.configPath,
      createdFiles: created,
      wasAlreadyInitialized: alreadyExists,
    };
  }

  /**
   * Resolve the snapshot storage directory from config.
   */
  resolveSnapshotDir(config: Config): string {
    // storageDirectory in config is relative to projectRoot
    return path.resolve(this.projectRoot, config.storageDirectory);
  }
}

export interface InitResult {
  projectRoot: string;
  cbDir: string;
  configPath: string;
  createdFiles: string[];
  wasAlreadyInitialized: boolean;
}
