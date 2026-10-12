/**
 * Example demonstrating programmatic usage of ContextBridge SDK
 *
 * Run with:
 * node examples/sdk-usage.mjs
 */
import { generateHandoff, generateCompactPrompt, estimateTokens } from '../dist/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read sample snapshot
const snapshotJson = readFileSync(join(__dirname, 'sample-snapshot.json'), 'utf-8');
const snapshot = JSON.parse(snapshotJson);

console.log('=== 1. Snapshot Summary ===');
console.log(`ID:        ${snapshot.id}`);
console.log(`Task:      ${snapshot.task.title}`);
console.log(`Objective: ${snapshot.task.objective}`);
console.log(`Status:    ${snapshot.task.status}`);

console.log('\n=== 2. Generated Markdown Handoff ===');
const handoff = generateHandoff(snapshot);
console.log(handoff);

console.log('=== 3. Compact Prompt & Token Estimation ===');
const compact = generateCompactPrompt(snapshot);
console.log(compact);
console.log(`\nEstimated token count: ~${estimateTokens(compact)} tokens`);
