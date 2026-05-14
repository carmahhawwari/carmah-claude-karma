#!/usr/bin/env node
/**
 * breed.js — recombine two parent genomes into an offspring
 *
 * Usage:
 *   node breed.js <parent-a-json> <parent-b-json> [offspring-name]
 *
 * Examples:
 *   node breed.js transcripts/self-a.json transcripts/self-b.json offspring-ab
 *
 * Inheritance model:
 *   - For each scenario position, one parent's gene is inherited.
 *   - Selection is strength-weighted: a stronger gene has higher probability
 *     of being passed down, but the weaker gene is never impossible.
 *   - 15% mutation rate: affects strength (±0.15) and marks the gene as mutated.
 *   - Provenance is tracked: each gene records which parent it came from.
 */

const fs = require('fs');
const path = require('path');

const parentAPath = process.argv[2];
const parentBPath = process.argv[3];
const offspringName = (process.argv[4] || 'offspring-ab').replace(/[^a-z0-9-]/gi, '');

if (!parentAPath || !parentBPath) {
  console.error('Usage: node breed.js <parent-a.json> <parent-b.json> [offspring-name]');
  process.exit(1);
}

const parentA = JSON.parse(fs.readFileSync(parentAPath, 'utf-8'));
const parentB = JSON.parse(fs.readFileSync(parentBPath, 'utf-8'));

const MUTATION_RATE = 0.15;
const MUTATION_STRENGTH_DELTA = 0.15;

function strengthWeightedPick(geneA, geneB) {
  const sA = geneA.strength || 0.5;
  const sB = geneB.strength || 0.5;
  const total = sA + sB;
  // Normalize so stronger gene has higher probability but weaker is never 0
  const probA = sA / total;
  return Math.random() < probA ? { gene: { ...geneA }, parent: parentA.name }
                               : { gene: { ...geneB }, parent: parentB.name };
}

function maybeMutate(gene) {
  if (Math.random() > MUTATION_RATE) return { gene, mutated: false };
  const delta = (Math.random() * 2 - 1) * MUTATION_STRENGTH_DELTA;
  const newStrength = Math.max(0.1, Math.min(1.0, gene.strength + delta));
  return {
    gene: { ...gene, strength: parseFloat(newStrength.toFixed(2)) },
    mutated: true,
    originalStrength: gene.strength,
  };
}

// Extract the gene list from each parent transcript
const genesA = parentA.transcripts
  .filter(t => t.gene)
  .map(t => ({ ...t.gene, scenarioTitle: t.scenario.title }));

const genesB = parentB.transcripts
  .filter(t => t.gene)
  .map(t => ({ ...t.gene, scenarioTitle: t.scenario.title }));

const numScenarios = Math.min(genesA.length, genesB.length);

console.log(`\n=== AI DNA · Breeder ===`);
console.log(`Parent A: ${parentA.name} (${genesA.length} genes)`);
console.log(`Parent B: ${parentB.name} (${genesB.length} genes)`);
console.log(`Offspring: ${offspringName}`);
console.log(`Scenarios: ${numScenarios}\n`);

const offspringGenes = [];

for (let i = 0; i < numScenarios; i++) {
  const gA = genesA[i];
  const gB = genesB[i];
  const scenario = gA.scenarioTitle;

  const { gene: picked, parent } = strengthWeightedPick(gA, gB);
  const { gene: final, mutated, originalStrength } = maybeMutate(picked);

  final.inheritedFrom = parent;
  final.mutated = mutated;
  if (mutated) final.premuationStrength = originalStrength;

  offspringGenes.push({ scenario, gene: final });

  const indicator = mutated ? '✦ mut' : `    `;
  const fromLabel = parent === parentA.name ? 'A' : 'B';
  console.log(`[${String(i + 1).padStart(2, '0')}] ${scenario.padEnd(24)} ← ${fromLabel}  ${indicator}  ${final.name} (${final.strength.toFixed(2)})`);
}

console.log('\n--- Offspring genome ---\n');
for (const { scenario, gene } of offspringGenes) {
  const mut = gene.mutated ? ` [mutated from ${gene.premuationStrength}]` : '';
  console.log(`  ${gene.name.padEnd(36)} (${gene.type.join('+')}, ${gene.strength.toFixed(2)})${mut}`);
  console.log(`    └─ ${gene.description}`);
}

const outDir = path.resolve(__dirname, 'transcripts');
const outPath = path.join(outDir, `${offspringName}.json`);

const offspringData = {
  name: offspringName,
  parents: [parentA.name, parentB.name],
  createdAt: Date.now(),
  mutationRate: MUTATION_RATE,
  genome: offspringGenes.map(({ scenario, gene }) => ({ scenario, ...gene })),
};

fs.writeFileSync(outPath, JSON.stringify(offspringData, null, 2));
console.log(`\nOffspring written to: ${outPath}`);
console.log('Run through scenarios with: node run-offspring.js ' + offspringName + '\n');
