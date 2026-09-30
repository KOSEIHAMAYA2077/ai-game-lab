import type { Motion } from './motions';

// Japanese fragments are deliberate vocabulary triggers, not a claim of negation understanding.
// English words need boundaries: "microwave" must not activate "wave".
const words: [RegExp, Motion][] = [
  [/呼吸|息づく|息づいて|脈動|\b(?:breath|breathe|breathing|pulse|pulsing)\b/iu, 'breathe'],
  [/ふわふわ|ふわり|ゆらゆら|漂う|漂って|羽ばたく|はばたく|波打つ|波打って|うねる|うねって|\b(?:wave|waving|ripple|rippling)\b/iu, 'wave'],
  [/通常|普通|変形なし|揺れなし|\b(?:calm|normal)\b/iu, 'calm'],
];

/** Distinct candidates in text order; repetitions never bias the random selection. */
export function motionChoices(text: string): Motion[] {
  const source = text.normalize('NFKC');
  const hits = words.flatMap(([pattern, motion]) => [...source.matchAll(new RegExp(pattern.source, pattern.flags + 'g'))]
    .map(match => ({ index: match.index!, motion })));
  return [...new Set(hits.sort((a, b) => a.index - b.index).map(hit => hit.motion))];
}

export type MotionInterpretation = { motion: Motion; recognized: boolean; choices: Motion[] };

/** No mention preserves the current motion. Explicit calm is a change, not absence. */
export function interpretMotion(text: string, current: Motion = 'calm', choose?: () => number): MotionInterpretation {
  const choices = motionChoices(text);
  if (!choices.length) return { motion: current, recognized: false, choices };
  const sample = choices.length > 1 ? choose?.() ?? 0 : 0;
  const index = Number.isFinite(sample) ? Math.max(0, Math.min(choices.length - 1, Math.floor(sample * choices.length))) : 0;
  return { motion: choices[index], recognized: true, choices };
}
