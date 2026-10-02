import { shapeChoices } from './language';
import { defaultSkeletonSpec, validateSkeletonSpec, type SkeletonSpec } from './skeleton-surface';

export type Resolution = { spec: SkeletonSpec | null; source: 'semantic-model' | 'unchanged' | 'rules' | 'replay'; modelMs: number; reason: string; confidence?: number };
export const API = 'http://127.0.0.1:4213';

// The comparison baseline deliberately shares the same bounded surfaces.
// It only recognizes authored words; it is never reported as model inference.
export function ruleResolution(text: string): Resolution {
  const shape = shapeChoices(text, false)[0];
  const families: Record<string, SkeletonSpec['family']> = { condense: 'sphere', vase: 'vase', sword: 'sword', mobius: 'mobius', ring: 'ring', cube: 'cube', cuboid: 'cube', square: 'cube' };
  const family = families[shape];
  if (!family) return { spec: null, source: 'rules', modelMs: 0, reason: '形の指定なし' };
  const spec = defaultSkeletonSpec(family);
  const normalized = text.normalize('NFKC');
  if (/細長|縦長|背が高|\b(?:tall|long|elongated)\b/iu.test(normalized)) { spec.height = 1.65; spec.width = .7; }
  if (/低い|平たい|\b(?:short|flat|squat)\b/iu.test(normalized)) spec.height = .6;
  if (/幅広|ふっくら|太い|\b(?:wide|broad|bulbous)\b/iu.test(normalized)) spec.width = 1.5;
  if (/細い|\b(?:slender|thin|narrow)\b/iu.test(normalized)) spec.width = .65;
  if (/首.{0,4}細|細い首|\bnarrow[- ]neck/iu.test(normalized)) spec.neck = .2;
  if (/口.{0,4}広|広い口|\bwide[- ]mouth/iu.test(normalized)) spec.neck = .85;
  if (/曲が|曲げ|しな|\b(?:curved|bent|arched)\b/iu.test(normalized)) spec.bend = .65;
  if (/ねじれ|捻|\b(?:twisted|twist|spiral)\b/iu.test(normalized)) spec.twist = .7;
  return { spec, source: 'rules', modelMs: 0, reason: '指定語' };
}

export async function modelResolution(text: string, signal: AbortSignal, previous: SkeletonSpec | null = null): Promise<Resolution> {
  const response = await fetch(`${API}/interpret`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, previous }), signal });
  if (!response.ok) throw new Error('モデルとの接続を確認してください。');
  const raw = await response.json();
  if (!['semantic-model', 'unchanged'].includes(raw.source) || raw.reason === 'model-unavailable' || !Number.isFinite(raw.modelMs) || raw.modelMs < 0) throw new Error('モデルの応答を確認できませんでした。');
  const spec = raw.spec === null ? null : validateSkeletonSpec(raw.spec);
  if (raw.spec !== null && !spec) throw new Error('形の値が範囲外でした。');
  return { spec, source: raw.source, modelMs: raw.modelMs, reason: String(raw.reason ?? ''), confidence: Number.isFinite(raw.confidence) ? raw.confidence : undefined };
}
