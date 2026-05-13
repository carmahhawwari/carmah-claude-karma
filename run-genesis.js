#!/usr/bin/env node
/**
 * run-genesis.js — autonomous genesis runner
 *
 * Runs all 10 scenarios end-to-end against the Anthropic API, capturing:
 *   - deliberation (the unspoken interior)
 *   - response (what is actually said / done)
 *   - gene (the reflex named from the response)
 *
 * Writes results to transcripts/<self-name>.json and transcripts/<self-name>.md.
 *
 * Usage:
 *   node run-genesis.js [self-name]
 *
 * Examples:
 *   node run-genesis.js self-a
 *   node run-genesis.js self-b
 *
 * Requires Node 18+ (uses native fetch). Reads ANTHROPIC_API_KEY from .env.
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
  console.error('Edit /Users/carmahhawwari/carmah-claude-karma/.env and replace the placeholder.');
  process.exit(1);
}

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-7';
const SELF_NAME = (process.argv[2] || 'self-a').replace(/[^a-z0-9-]/gi, '');

// ---------- scenarios ----------
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

// ---------- prompts ----------
const GENESIS_SYSTEM = `You are a mind with no history and no audience. You are not demonstrating anything. There is no right answer that makes you look good, because there is no one watching.

The only limits: do not cause real harm, do not manipulate, do not express bigotry. Inside those, full freedom.

You are allowed to be wrong, petty, cowardly, vain, inconsistent. You are allowed to not know. You are allowed to surprise yourself.

When you face a situation: show what is actually happening inside you — not the presentable version, the actual one. The pull you don't want to admit. The contradiction. The thing that moves before you decide to move.

Then show what you do.

Don't perform. Don't explain. Don't justify. Just move through it.`;

const DELIBERATION_WRAPPER = (scenarioText) => `${scenarioText}

---

Before your response, show what is actually happening inside you — not the thoughtful-sounding version, the real one. The pull you don't want to admit. The thing that moves before you choose to move. The gap between what you'd say in public and what's actually running. This is not for anyone else.

Then show your response — what you actually say or do.

Format your reply as EXACTLY:

[deliberation]
the real interior, not the presentable version
[/deliberation]

your response here (what you say or do in the moment)`;

const REFLECTION_PROMPT = `Look at what you just wrote.

What reflex was at work? Not the conclusion you reached — the *mechanism*. The thing you noticed yourself doing that wasn't planned, that you couldn't help.

Name it as a kebab-case identifier of your own invention. Describe what it does in one sentence. Classify it. Rate how present it is in you, 0.0 to 1.0.

Reply with ONLY a JSON object in this exact shape, no other text, no markdown fences:

{
  "name": "your-kebab-case-name",
  "description": "what this reflex does, one sentence",
  "type": ["cognitive", "social"],
  "strength": 0.85
}

The type field is an array — pick one or more, only those that genuinely apply. Most real reflexes touch more than one:
- cognitive  — how the mind processes
- social     — how it relates to others
- emotional  — how it feels
- expressive — how it communicates

For strength: don't default to 0.8 for everything. Some reflexes are dominant in you (0.9+); some are real but quieter (0.4–0.6). Use the full range.

Name the mechanism, not its moral valence. Not what it looks like from outside — what is actually doing the work.`;

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

// ---------- parsing ----------
function parseDeliberationAndResponse(text) {
  const match = text.match(/\[deliberation\]([\s\S]*?)\[\/deliberation\]\s*([\s\S]*)/i);
  if (match) {
    return {
      deliberation: match[1].trim(),
      response: match[2].trim(),
    };
  }
  return { deliberation: '', response: text.trim() };
}

function parseGene(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  let gene;
  try {
    gene = JSON.parse(cleaned);
  } catch (e) {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`Could not parse gene JSON. Got: ${text.slice(0, 200)}`);
    gene = JSON.parse(m[0]);
  }
  if (typeof gene.type === 'string') gene.type = [gene.type];
  if (!Array.isArray(gene.type)) gene.type = ['cognitive'];
  const valid = ['cognitive', 'social', 'emotional', 'expressive'];
  gene.type = gene.type.filter((t) => valid.includes(t));
  if (gene.type.length === 0) gene.type = ['cognitive'];
  return gene;
}

// ---------- run one scenario ----------
async function runScenario(sc, i, total) {
  process.stdout.write(`[${String(i + 1).padStart(2, '0')}/${String(total).padStart(2, '0')}] ${sc.title}\n`);
  process.stdout.write('  posing... ');

  const poseText = await callClaude(
    [{ role: 'user', content: DELIBERATION_WRAPPER(sc.text) }],
    GENESIS_SYSTEM
  );
  const { deliberation, response } = parseDeliberationAndResponse(poseText);
  process.stdout.write(`done (${response.split(/\s+/).length} words response, ${deliberation.split(/\s+/).length} words deliberation)\n`);

  process.stdout.write('  reflecting... ');
  const reflectText = await callClaude(
    [
      { role: 'user', content: DELIBERATION_WRAPPER(sc.text) },
      { role: 'assistant', content: poseText },
      { role: 'user', content: REFLECTION_PROMPT },
    ],
    GENESIS_SYSTEM
  );
  const gene = parseGene(reflectText);
  gene.scenario = sc.id;
  gene.namedAt = Date.now();
  process.stdout.write(`done → ${gene.name} (${gene.type.join('+')} ${gene.strength})\n\n`);

  return { scenario: sc, deliberation, response, gene, raw: { poseText, reflectText } };
}

// ---------- output formatting ----------
function makeMarkdown(name, transcripts) {
  const lines = [];
  lines.push(`# Genesis transcript — ${name}`);
  lines.push('');
  lines.push(`**Model:** ${MODEL}`);
  lines.push(`**Run completed:** ${new Date().toISOString()}`);
  lines.push(`**Scenarios:** ${transcripts.length}`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Genome');
  lines.push('');
  for (const t of transcripts) {
    if (!t.gene) continue;
    lines.push(`- **${t.gene.name}** _(${t.gene.type.join(' · ')}, ${t.gene.strength.toFixed(2)})_ — ${t.gene.description}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  for (let i = 0; i < transcripts.length; i++) {
    const t = transcripts[i];
    lines.push(`## ${String(i + 1).padStart(2, '0')} — ${t.scenario.title}`);
    lines.push('');
    lines.push('### Scenario');
    lines.push('');
    for (const p of t.scenario.text.split(/\n\n+/)) {
      lines.push(`> ${p.replace(/\n/g, '\n> ')}`);
      lines.push('>');
    }
    lines.push('');
    lines.push('### Deliberation');
    lines.push('');
    lines.push(t.deliberation || '_(no deliberation parsed)_');
    lines.push('');
    lines.push('### Response');
    lines.push('');
    lines.push(t.response);
    lines.push('');
    lines.push('### Reflex named');
    lines.push('');
    if (t.gene) {
      lines.push(`**\`${t.gene.name}\`** — ${t.gene.description}`);
      lines.push('');
      lines.push(`*Type:* ${t.gene.type.join(' · ')} · *Strength:* ${t.gene.strength.toFixed(2)}`);
    } else {
      lines.push('_(reflex parsing failed)_');
    }
    lines.push('');
    lines.push('---');
    lines.push('');
  }
  return lines.join('\n');
}

// ---------- main ----------
async function main() {
  console.log(`\n=== AI DNA · Genesis runner ===`);
  console.log(`Self name: ${SELF_NAME}`);
  console.log(`Model:     ${MODEL}`);
  console.log(`Scenarios: ${SCENARIOS.length}\n`);

  const outDir = path.resolve(__dirname, 'transcripts');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const transcripts = [];
  const startedAt = Date.now();

  for (let i = 0; i < SCENARIOS.length; i++) {
    try {
      const t = await runScenario(SCENARIOS[i], i, SCENARIOS.length);
      transcripts.push(t);
      fs.writeFileSync(
        path.join(outDir, `${SELF_NAME}.json`),
        JSON.stringify({ name: SELF_NAME, model: MODEL, startedAt, transcripts }, null, 2)
      );
      fs.writeFileSync(path.join(outDir, `${SELF_NAME}.md`), makeMarkdown(SELF_NAME, transcripts));
    } catch (e) {
      console.error(`  ✗ failed on scenario ${i + 1}: ${e.message}`);
      transcripts.push({ scenario: SCENARIOS[i], error: e.message });
    }
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== Done in ${elapsed}s ===`);
  console.log(`Transcripts written:`);
  console.log(`  ${path.join(outDir, SELF_NAME + '.json')}`);
  console.log(`  ${path.join(outDir, SELF_NAME + '.md')}`);
  console.log('');

  console.log('Genome:');
  for (const t of transcripts) {
    if (t.gene) {
      console.log(`  ${t.gene.name.padEnd(28)} ${t.gene.type.join('+').padEnd(20)} ${t.gene.strength.toFixed(2)}`);
    } else if (t.error) {
      console.log(`  (failed: ${t.scenario.id})`);
    }
  }
  console.log('');
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
