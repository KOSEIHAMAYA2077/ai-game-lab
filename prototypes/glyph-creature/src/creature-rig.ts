import { Bone, Skeleton } from 'three';
import type { Vec3 } from './model';

export const RIGGED_CREATURES = ['bird', 'fish', 'snake'] as const;
export type RiggedCreature = typeof RIGGED_CREATURES[number];
export const isRiggedCreature = (shape: string): shape is RiggedCreature => (RIGGED_CREATURES as readonly string[]).includes(shape);
const TAU = Math.PI * 2;
const FISH_ANCHORS = [.35, -.20, -.68, -1.18];
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => { const q = clamp(x); return q * q * (3 - 2 * q); };
type Joint = { name: string; parent: number; position: Vec3 };
type Palette = { time: number; matrices: Float32Array; joints: Float32Array };

function definition(shape: RiggedCreature): Joint[] {
  if (shape === 'bird') return [
    { name: 'body', parent: -1, position: [0, 0, 0] },
    { name: 'neck', parent: 0, position: [0, .39, 0] },
    { name: 'left-shoulder', parent: 0, position: [-.20, .20, 0] },
    { name: 'left-wrist', parent: 2, position: [-.72, .28, 0] },
    { name: 'right-shoulder', parent: 0, position: [.20, .20, 0] },
    { name: 'right-wrist', parent: 4, position: [.72, .28, 0] },
    { name: 'tail', parent: 0, position: [0, -.49, 0] },
  ];
  if (shape === 'fish') return [
    { name: 'head', parent: -1, position: [.35, 0, 0] },
    { name: 'body', parent: 0, position: [-.20, 0, 0] },
    { name: 'tail-base', parent: 1, position: [-.68, 0, 0] },
    { name: 'tail-tip', parent: 2, position: [-1.18, 0, 0] },
  ];
  return Array.from({ length: 9 }, (_, i) => {
    const v = i / 8, a = v * TAU * 1.3;
    return { name: i === 0 ? 'head' : `spine-${i}`, parent: i - 1,
      position: [.51 * Math.cos(a), 1.1 - 2.3 * v, .18 * Math.sin(a)] as Vec3 };
  });
}

/** Bone hierarchy and inverse bind transforms are real; glyph quads remain instanced.
 * A palette bank keeps multiple creatures from recomputing joints for every letter. */
export class CreatureRig {
  readonly definitions: Joint[];
  readonly bones: Bone[];
  readonly skeleton: Skeleton;
  readonly rest: Palette;
  private readonly bank: Palette[];
  private cursor = 0;
  private last: Palette | null = null;
  updates = 0;

  constructor(readonly shape: RiggedCreature) {
    this.definitions = definition(shape);
    this.bones = this.definitions.map(() => new Bone());
    this.definitions.forEach((joint, i) => {
      const bone = this.bones[i]; bone.name = joint.name;
      const parent = joint.parent < 0 ? [0, 0, 0] : this.definitions[joint.parent].position;
      bone.position.set(...joint.position.map((v, axis) => v - parent[axis]) as Vec3);
      if (joint.parent >= 0) this.bones[joint.parent].add(bone);
    });
    this.bones[0].updateMatrixWorld(true);
    this.skeleton = new Skeleton(this.bones);
    this.skeleton.update();
    const make = (): Palette => ({ time: NaN, matrices: new Float32Array(this.bones.length * 16), joints: new Float32Array(this.bones.length * 3) });
    this.rest = make(); this.copyInto(this.rest);
    this.bank = Array.from({ length: 16 }, make);
  }

  private copyInto(palette: Palette) {
    palette.matrices.set(this.skeleton.boneMatrices!);
    this.bones.forEach((bone, i) => {
      const m = bone.matrixWorld.elements;
      palette.joints.set([m[12], m[13], m[14]], i * 3);
    });
  }

  pose(time: number | null): Palette {
    if (time === null) return this.rest;
    if (this.last?.time === time) return this.last;
    const cached = this.bank.find(p => p.time === time);
    if (cached) { this.last = cached; return cached; }
    for (const bone of this.bones) bone.rotation.set(0, 0, 0);
    const root = this.bones[0], bind = this.definitions[0].position;
    root.position.set(...bind);
    if (this.shape === 'bird') {
      const phase = time * TAU / 6;
      root.position.y += .028 * Math.sin(phase - .3);
      root.rotation.y = .025 * Math.sin(time * .31);
      this.bones[1].rotation.x = .035 * Math.sin(time * .52);
      const flap = .38 * Math.sin(phase), wrist = .11 * Math.sin(phase - .55);
      this.bones[2].rotation.z = -flap; this.bones[3].rotation.z = -wrist;
      this.bones[4].rotation.z = flap; this.bones[5].rotation.z = wrist;
      this.bones[6].rotation.x = .075 * Math.sin(phase - .8);
    } else if (this.shape === 'fish') {
      const phase = time * TAU / 4.8;
      root.rotation.y = .018 * Math.sin(phase);
      this.bones[1].rotation.y = .065 * Math.sin(phase - .35);
      this.bones[2].rotation.y = .21 * Math.sin(phase - .75);
      this.bones[3].rotation.y = .09 * Math.sin(phase - 1.05);
    } else {
      const phase = time * TAU / 7.6;
      for (let i = 0; i < this.bones.length; i++) {
        const amount = i / (this.bones.length - 1);
        this.bones[i].rotation.x = (.008 + .035 * amount) * Math.sin(phase - i * .58);
        this.bones[i].rotation.y = (.008 + .07 * amount) * Math.sin(phase - i * .64);
        this.bones[i].rotation.z = (.008 + .045 * amount) * Math.sin(phase - i * .69);
      }
    }
    root.updateMatrixWorld(true); this.skeleton.update();
    const palette = this.bank[this.cursor]; this.cursor = (this.cursor + 1) % this.bank.length;
    palette.time = time; this.copyInto(palette); this.last = palette; this.updates++;
    return palette;
  }
}

export type Influences = { indices: number[]; weights: number[] };
export const createInfluences = (): Influences => ({ indices: [0, 0, 0], weights: [1, 0, 0] });
export function creatureInfluences(shape: RiggedCreature, part: number, v: number, point: Vec3, out = createInfluences()): Influences {
  out.indices.fill(0); out.weights[0] = 1; out.weights[1] = 0; out.weights[2] = 0;
  if (shape === 'bird') {
    if (part >= 16 && part < 28) { out.indices[0] = 1; return out; }
    if (part >= 58) { out.indices[1] = 6; out.weights[1] = smooth((-point[1] - .42) / .25); out.weights[0] = 1 - out.weights[1]; return out; }
    if (part >= 28) {
      const shoulder = part % 2 ? 4 : 2, distance = Math.abs(point[0]);
      const attachment = smooth((distance - .13) / .30), tip = smooth((distance - .64) / .45);
      out.indices[1] = shoulder; out.indices[2] = shoulder + 1;
      out.weights[0] = 1 - attachment; out.weights[1] = attachment * (1 - tip); out.weights[2] = attachment * tip;
    }
  } else if (shape === 'fish') {
    const x = point[0], anchors = FISH_ANCHORS;
    const i = x >= anchors[1] ? 0 : x >= anchors[2] ? 1 : 2;
    out.indices[0] = i; out.indices[1] = i + 1;
    out.weights[1] = smooth((anchors[i] - x) / (anchors[i] - anchors[i + 1])); out.weights[0] = 1 - out.weights[1];
  } else if (part < 58) {
    const at = clamp(v) * 8, i = Math.min(7, Math.floor(at));
    out.indices[0] = i; out.indices[1] = i + 1;
    out.weights[1] = smooth(at - i); out.weights[0] = 1 - out.weights[1];
  }
  return out;
}

const rigs = new Map<RiggedCreature, CreatureRig>();
export function creatureRig(shape: RiggedCreature): CreatureRig {
  let rig = rigs.get(shape); if (!rig) { rig = new CreatureRig(shape); rigs.set(shape, rig); } return rig;
}
const influences = createInfluences();
/** Linear blend skinning: current bone world × inverse bind, applied to rest material.
 * The caller resamples this same function to obtain tangents including weight gradients. */
export function skinCreaturePoint(shape: RiggedCreature, part: number, v: number, time: number | null, point: Vec3): Vec3 {
  const palette = creatureRig(shape).pose(time);
  creatureInfluences(shape, part, v, point, influences);
  const x = point[0], y = point[1], z = point[2], m = palette.matrices;
  point[0] = point[1] = point[2] = 0;
  for (let j = 0; j < 3; j++) {
    const weight = influences.weights[j]; if (!weight) continue;
    const k = influences.indices[j] * 16;
    point[0] += weight * (m[k] * x + m[k + 4] * y + m[k + 8] * z + m[k + 12]);
    point[1] += weight * (m[k + 1] * x + m[k + 5] * y + m[k + 9] * z + m[k + 13]);
    point[2] += weight * (m[k + 2] * x + m[k + 6] * y + m[k + 10] * z + m[k + 14]);
  }
  return point;
}

export function inspectCreatureRig(shape: string, time: number) {
  if (!isRiggedCreature(shape)) return null;
  const rig = creatureRig(shape), pose = rig.pose(time);
  return { shape, bones: rig.definitions.map((joint, i) => ({ name: joint.name, parent: joint.parent,
    position: Array.from(pose.joints.subarray(i * 3, i * 3 + 3)) })),
    matrixUpdates: rig.updates, cacheSlots: 16, skinning: 'linear-blend', inverseBind: rig.skeleton.boneInverses.length };
}
