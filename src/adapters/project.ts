/**
 * ContextBridge — Project Adapter
 *
 * Detects project metadata from the filesystem.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ProjectInfo {
  name?: string | undefined;
  language?: string | undefined;
  description?: string | undefined;
  rootPath?: string | undefined;
}

interface PackageJson {
  name?: unknown;
  description?: unknown;
  [key: string]: unknown;
}

/**
 * Detect the primary programming language of a project based on config files.
 */
function detectLanguage(dir: string): string | undefined {
  const indicators: { file: string; language: string }[] = [
    { file: 'package.json', language: 'JavaScript/TypeScript' },
    { file: 'tsconfig.json', language: 'TypeScript' },
    { file: 'Cargo.toml', language: 'Rust' },
    { file: 'pyproject.toml', language: 'Python' },
    { file: 'requirements.txt', language: 'Python' },
    { file: 'setup.py', language: 'Python' },
    { file: 'go.mod', language: 'Go' },
    { file: 'pom.xml', language: 'Java (Maven)' },
    { file: 'build.gradle', language: 'Java (Gradle)' },
    { file: 'Gemfile', language: 'Ruby' },
    { file: 'composer.json', language: 'PHP' },
    { file: 'CMakeLists.txt', language: 'C/C++' },
    { file: 'Makefile', language: 'C/C++' },
    { file: '*.csproj', language: 'C#' },
    { file: 'pubspec.yaml', language: 'Dart/Flutter' },
    { file: 'mix.exs', language: 'Elixir' },
    { file: 'stack.yaml', language: 'Haskell' },
  ];

  // Check tsconfig before package.json for better specificity
  const orderedChecks = [...indicators];
  for (const { file, language } of orderedChecks) {
    if (!file.includes('*') && fs.existsSync(path.join(dir, file))) {
      return language;
    }
  }

  return undefined;
}

/**
 * Read and parse package.json if present.
 */
function readPackageJson(dir: string): PackageJson | undefined {
  const pkgPath = path.join(dir, 'package.json');
  try {
    const content = fs.readFileSync(pkgPath, 'utf-8');
    return JSON.parse(content) as PackageJson;
  } catch {
    return undefined;
  }
}

/**
 * Collect project metadata from the given directory.
 */
export function collectProjectInfo(dir: string): ProjectInfo {
  const resolvedDir = path.resolve(dir);
  const info: ProjectInfo = {
    rootPath: resolvedDir,
    name: path.basename(resolvedDir),
  };

  // Try to get more detail from package.json
  const pkg = readPackageJson(resolvedDir);
  if (pkg) {
    if (typeof pkg.name === 'string' && pkg.name) {
      info.name = pkg.name;
    }
    if (typeof pkg.description === 'string' && pkg.description) {
      info.description = pkg.description.slice(0, 1024);
    }
  }

  info.language = detectLanguage(resolvedDir);

  return info;
}
