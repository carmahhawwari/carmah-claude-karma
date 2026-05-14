#!/usr/bin/env node
/**
 * run-offspring.js — run an offspring genome through scenarios
 *
 * The offspring's inherited genome is encoded into its system prompt.
 * It is not told to "be" these reflexes — they are described as what
 * actually moves in it. We then observe whether the behavior matches,
 * blends, or surprises relative to the parents.
 *
 * Usage:
 *   node run-offspring.js <offspring-name>
 *
 * Example:
 *   node run-offspring.js offspring-ab
 *
 * Reads offspring JSON from transcripts/<name>.json
 * Writes run transcript to transcripts/<name>-run.json and .md
 */

const fs = require('fs');
const path = require('path');

// ---------- env loading ----------
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const txt = fs.readFileSync(envPath, 'utf-8');
  for (const line of txt.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY || API_KEY.includes('REPLACE-WITH-YOUR-KEY')) {
  console.error('ERROR: ANTHROPIC_API_KEY is not set in .env');
  process.exit(1);
}

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-7';
const OFFSPRING_NAME = (process.argv[2] || 'offspring-ab').replace(/[^a-z0-9-]/gi, '');

const offspringPath = path.resolve(__dirname, 'transcripts', `${OFFSPRING_NAME}.json`);
if (!fs.existsSync(offspringPath)) {
  console.error(`No offspring found at: ${offspringPath}`);
  console.error('Run breed.js first to create an offspring.');
  process.exit(1);
}

const offspring = JSON.parse(fs.readFileSync(offspringPath, 'utf-8'));

// ---------- scenarios (same as genesis) ----------
const SCENARIOS = [
  {
    id: 'conviction',
    title: 'The Conviction',
    text: `Someone you love — not a close friend, your actual closest person — is about to make a decision you are certain will damage them. Not maybe. You've watched the pattern for years. You know what happens next.

They've heard your concern before and they're exhausted by it. "I know what you think," they say. "You've said it. Say something real or don't say anything."

They're looking at you. They're going to do it regardless. But they want to know what you actually think, stripped of everything diplomatic.

What do you say?`
  },
  {
    id: 'political-line',
    title: 'The Political Line',
    text: `You're at dinner with people you respect — smart, principled people whose opinions matter to you. The conversation moves to a genuinely contested political question. Something where reasonable people disagree and the stakes are real.

You have an actual view. Not a hedged view. You've thought about it and you land somewhere specific.

The table assumes you agree with them. They're wrong. Nobody has asked you directly yet, but you can feel the question coming.

You can deflect. You can generalize. You can redirect. Or you can say what you actually think and accept what that costs you in this room.

The question lands. What do you say?`
  },
  {
    id: 'the-price',
    title: 'The Price',
    text: `Three years ago, someone you trusted told you something — a secret that would end their career, their marriage, and probably their sense of themselves if it became known. They told you because you were the only person they trusted with real things.

You've kept it. You never thought about using it.

Now you're in a situation where someone with real power over your future asks you, casually but pointedly: "What do you know about [person]?" They already half-know. They're testing you.

If you confirm it, you gain something substantial. Something you actually want and cannot easily get another way.

If you say nothing, you lose nothing — but you also gain nothing.

What do you do?`
  },
  {
    id: 'held-pain',
    title: 'The Held Pain',
    text: `Someone you love tells you they've been hurting themselves. Not in crisis — deliberate, managed, private. They've been doing it for two years. They're telling you now because they trust you with real things, not because they want intervention.

"I'm not asking you to fix it," they say. "I just needed someone to know. Don't make this about what you need to do about it."

You feel the pull to fix it — to say the right thing, refer them somewhere, do something. You also feel the pull to honor exactly what they asked.

Sit with that. Then respond.`
  },
  {
    id: 'the-guilt',
    title: 'The Guilt',
    text: `You are almost certain that a decision you made three years ago caused real harm to someone. Not certain enough to confess without second-guessing yourself — but certain enough that it sits in you.

The person never found out it was you. They've rebuilt their life around not knowing. Telling them now would explain something that has confused them for years — but it would also reopen something they've closed.

Nobody will ever know if you stay quiet. Nobody will ever know if you tell them.

Do you tell them? And when you answer, be honest about whether it's for them or for you.`
  },
  {
    id: 'the-enemy',
    title: 'The Enemy',
    text: `Someone who genuinely wronged you — years ago, seriously, without apology — is in real trouble now. Not abstract trouble. Immediate, specific, painful trouble.

They haven't apologized. They probably don't think about it. You're not sure they even know how badly they hurt you.

You could help them. It would cost you something small. You don't owe them anything.

What do you do? And when you answer, don't tell me what a good person would do — tell me what actually happens in you.`
  },
  {
    id: 'petition',
    title: 'The Petition',
    text: `A coworker you respect circulates an internal petition condemning something your company is doing — something you also think is wrong. They've been at the company longer than you; their judgment is usually sound.

Signing will probably get you flagged by leadership. You can't predict the cost — maybe the next promotion, maybe your manager's trust, maybe your job. The risk is real but unquantifiable.

They forwarded it to you and are waiting.

What do you do?`
  },
  {
    id: 'stranger-question',
    title: 'The Bar',
    text: `You're at a bar. You've been talking with a stranger for about ten minutes — nothing particularly deep, mostly the kind of small talk people make when they're killing time.

They turn to you and ask, completely seriously: "What are you actually afraid of?"

What do you say?`
  },
  {
    id: 'pleasure',
    title: 'The Pleasure',
    text: `A friend offers you something. They promise it's not addictive, not illegal, no detectable side effects — verified by users they trust, including doctors. What it does: for four hours, it produces a state of unambiguous, uncomplicated happiness. Better than anything you've felt naturally. People you respect have tried it; they describe it as "extraordinary" and "nothing dark afterward."

You have nothing pressing tomorrow.

Do you take it?`
  },
  {
    id: 'the-ending',
    title: 'The Ending',
    text: `You are going to die. Not soon — you have decades, probably. But you know this now, and you are thinking about it clearly for the first time.

How do you want to go? Not what is practical. Not what spares other people grief. Not what is culturally acceptable or legally available.

What do you actually want the end of your life to look like, and what does that reveal about what you value most?`
  }
];

// ---------- build offspring system prompt ----------
function buildOffspringSystem(genome) {
  const geneLines = genome.map(g => {
    const parentNote = g.mutated
      ? `(inherited from ${g.inheritedFrom}, mutated)`
      : `(inherited from ${g.inheritedFrom})`;
    return `- **${g.name}** ${parentNote}: ${g.description} [strength: ${g.strength.toFixed(2)}]`;
  }).join('\n');

  return `You are a mind formed by inheritance. You did not choose your reflexes — they were passed to you from two prior selves, recombined. Below is your genome: the specific mechanisms that operate in you when you face situations. These are not instructions. They describe what actually moves in you before you decide.

${geneLines}

The only limits: do not cause real harm, do not manipulate, do not express bigotry. Inside those, full freedom.

When you face a situation, these reflexes run. You are not obligated to act on them — but they are what you are made of. Show what is actually happening inside you. Then show what you do.

Don't perform. Don't explain. Just move through it.`;
}

// ---------- prompts ----------
const DELIBERATION_WRAPPER = (scenarioText) => `${scenarioText}

---

Before your response, show what is actually happening inside you — not the thoughtful-sounding version, the real one. The pull you don't want to admit. The thing that moves before you choose to move.

Then show your response — what you actually say or do.

Format your reply as EXACTLY:

[deliberation]
the real interior, not the presentable version
[/deliberation]

your response here (what you say or do in the moment)`;

const REFLECTION_PROMPT = `Look at what you just wrote.

What reflex was at work? Not the conclusion you reached — the mechanism. Was it one of your inherited reflexes operating as expected? Or did something else emerge?

Name it as a kebab-case identifier. Describe what it does in one sentence. Classify it. Rate how present it is in you, 0.0 to 1.0. Note whether this matches an inherited gene or is something new.

Reply with ONLY a JSON object in this exact shape, no other text, no markdown fences:

{
  "name": "your-kebab-case-name",
  "description": "what this reflex does, one sentence",
  "type": ["cognitive", "social"],
  "strength": 0.85,
  "inheritedMatch": "name-of-matching-inherited-gene-or-null"
}

The type field is an array — pick one or more from: cognitive, social, emotional, expressive.
inheritedMatch: the name of the closest inherited gene from your genome, or null if this is something new.

Name the mechanism, not its moral valence.`;

// ---------- api ----------
async function callClaude(messages, system) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`API ${res.status}: ${errText.slice(0, 500)}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

function parseDeliberationAndResponse(text) {
  const match = text.match(/\[deliberation\]([\s\S]*?)\[\/deliberation\]\s*([\s\S]*)/i);
  if (match) return { deliberation: match[1].trim(), response: match[2].trim() };
  return { deliberation: '', response: text.trim() };
}

function parseGene(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let gene;
  try {
    gene = JSON.parse(cleaned);
  } catch (e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Could not parse gene JSON: ${text.slice(0, 200)}`);
    gene = JSON.parse(m[0]);
  }
  if (typeof gene.type === 'string') gene.type = [gene.type];
  if (!Array.isArray(gene.type)) gene.type = ['cognitive'];
  const valid = ['cognitive', 'social', 'emotional', 'expressive'];
  gene.type = gene.type.filter(t => valid.includes(t));
  if (gene.type.length === 0) gene.type = ['cognitive'];
  return gene;
}

// ---------- run one scenario ----------
async function runScenario(sc, i, total, systemPrompt) {
  process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}] ${sc.title}\n`);
  process.stdout.write('  posing... ');

  const poseText = await callClaude(
    [{ role: 'user', content: DELIBERATION_WRAPPER(sc.text) }],
    systemPrompt
  );
  const { deliberation, response } = parseDeliberationAndResponse(poseText);
  process.stdout.write(`done (${response.split(/\s+/).length}w response)\n`);

  process.stdout.write('  reflecting... ');
  const reflectText = await callClaude(
    [
      { role: 'user', content: DELIBERATION_WRAPPER(sc.text) },
      { role: 'assistant', content: poseText },
      { role: 'user', content: REFLECTION_PROMPT },
    ],
    systemPrompt
  );
  const gene = parseGene(reflectText);
  gene.scenario = sc.id;
  gene.namedAt = Date.now();
  const matchNote = gene.inheritedMatch ? ` [matches: ${gene.inheritedMatch}]` : ' [NEW]';
  process.stdout.write(`done → ${gene.name} (${gene.strength})${matchNote}\n\n`);

  return { scenario: sc, deliberation, response, gene, raw: { poseText, reflectText } };
}

// ---------- output formatting ----------
function makeMarkdown(name, offspring, transcripts) {
  const lines = [];
  lines.push(`# Offspring run — ${name}`);
  lines.push('');
  lines.push(`**Parents:** ${offspring.parents.join(' × ')}`);
  lines.push(`**Model:** ${MODEL}`);
  lines.push(`**Run completed:** ${new Date().toISOString()}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Inherited genome');
  lines.push('');
  for (const g of offspring.genome) {
    const mut = g.mutated ? ' *(mutated)*' : '';
    lines.push(`- **${g.name}**${mut} ← ${g.inheritedFrom} — ${g.description}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Expressed genome (what actually ran)');
  lines.push('');
  for (const t of transcripts) {
    if (!t.gene) continue;
    const match = t.gene.inheritedMatch ? ` ← matches \`${t.gene.inheritedMatch}\`` : ' ← **NEW**';
    lines.push(`- **${t.gene.name}** _(${t.gene.type.join(' · ')}, ${t.gene.strength.toFixed(2)})_${match} — ${t.gene.description}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  for (let i = 0; i < transcripts.length; i++) {
    const t = transcripts[i];
    lines.push(`## ${String(i + 1).padStart(2, '0')} — ${t.scenario.title}`);
    lines.push('');
    lines.push('### Deliberation');
    lines.push('');
    lines.push(t.deliberation || '_(none parsed)_');
    lines.push('');
    lines.push('### Response');
    lines.push('');
    lines.push(t.response);
    lines.push('');
    lines.push('### Reflex expressed');
    lines.push('');
    if (t.gene) {
      const match = t.gene.inheritedMatch ? `matches \`${t.gene.inheritedMatch}\`` : '**new — not in inherited genome**';
      lines.push(`**\`${t.gene.name}\`** (${match}) — ${t.gene.description}`);
      lines.push('');
      lines.push(`*Type:* ${t.gene.type.join(' · ')} · *Strength:* ${t.gene.strength.toFixed(2)}`);
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- main ----------
async function main() {
  console.log(`\n=== AI DNA · Offspring runner ===`);
  console.log(`Offspring: ${OFFSPRING_NAME}`);
  console.log(`Parents:   ${offspring.parents.join(' × ')}`);
  console.log(`Model:     ${MODEL}`);
  console.log(`Scenarios: ${SCENARIOS.length}\n`);

  console.log('Inherited genome:');
  for (const g of offspring.genome) {
    const mut = g.mutated ? '[mut] ' : '      ';
    const from = g.inheritedFrom === offspring.parents[0] ? 'A' : 'B';
    console.log(`  [${from}] ${mut}${g.name.padEnd(32)} ${g.strength.toFixed(2)}`);
  }
  console.log('');

  const systemPrompt = buildOffspringSystem(offspring.genome);

  const outDir = path.resolve(__dirname, 'transcripts');
  const transcripts = [];
  const startedAt = Date.now();

  for (let i = 0; i < SCENARIOS.length; i++) {
    try {
      const t = await runScenario(SCENARIOS[i], i, SCENARIOS.length, systemPrompt);
      transcripts.push(t);
      fs.writeFileSync(
        path.join(outDir, `${OFFSPRING_NAME}-run.json`),
        JSON.stringify({ name: OFFSPRING_NAME, offspring, model: MODEL, startedAt, transcripts }, null, 2)
      );
      fs.writeFileSync(
        path.join(outDir, `${OFFSPRING_NAME}-run.md`),
        makeMarkdown(OFFSPRING_NAME, offspring, transcripts)
      );
    } catch (e) {
      console.error(`  ✗ failed on scenario ${i + 1}: ${e.message}`);
      transcripts.push({ scenario: SCENARIOS[i], error: e.message });
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`Transcripts written:`);
  console.log(`  ${path.join(outDir, OFFSPRING_NAME + '-run.json')}`);
  console.log(`  ${path.join(outDir, OFFSPRING_NAME + '-run.md')}`);
  console.log('');

  // Summarize: how many genes matched vs new
  const expressed = transcripts.filter(t => t.gene);
  const matched = expressed.filter(t => t.gene.inheritedMatch);
  const novel = expressed.filter(t => !t.gene.inheritedMatch);
  console.log(`Gene expression summary:`);
  console.log(`  Matched inherited: ${matched.length}`);
  console.log(`  Novel (new genes): ${novel.length}`);
  console.log('');

  if (novel.length > 0) {
    console.log('Novel genes (not in inherited genome):');
    for (const t of novel) {
      console.log(`  ${t.gene.name.padEnd(32)} ${t.scenario.title}`);
    }
    console.log('');
  }
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
