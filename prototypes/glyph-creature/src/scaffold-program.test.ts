import { describe, expect, it } from 'vitest';
import type { Vec3 } from './model';
import { compiledPartSurfacePoint, compileScaffoldProgram, PRIMITIVES, programPartSurface, programSurface, validateProgram, type CompiledProgram, type Part, type Primitive, type Program } from './scaffold-program';

const part = (primitive: Primitive, id = '0', changes: Partial<Part> = {}): Part => ({ id, primitive, height: primitive === 'tube' ? 1.4 : 1, width: primitive === 'tube' ? .4 : 1, depth: primitive === 'tube' ? .4 : 1, bend: 0, twist: 0, ...changes });
const one = (primitive: Primitive, changes: Partial<Part> = {}): Program => ({ version: 1, parts: [part(primitive, '0', changes)] });
const pair = (parent: Primitive, child: Primitive, kind: 'end' | 'above' | 'through', parentChanges: Partial<Part> = {}, childChanges: Partial<Part> = {}): Program => ({ version: 1, parts: [part(parent, '0', parentChanges), part(child, '1', childChanges)], relation: { kind, parent: '0', child: '1' } });
const distance = (a: Vec3, b: Vec3) => Math.hypot(...a.map((x, i) => x - b[i]));
const closeVector = (a: Vec3, b: Vec3, precision = 8) => a.forEach((x, i) => expect(x).toBeCloseTo(b[i], precision));
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a.reduce((sum, x, i) => sum + x * b[i], 0);

function inversePartPoint(compiled: CompiledProgram, index: number, world: Vec3): Vec3 {
  const p = world.map((x, k) => (x - compiled.parts[index].position[k]) / compiled.scale) as Vec3;
  return compiled.parts[index].basis.map(axis => dot(axis, p)) as Vec3;
}

describe('finite centerline and section programs', () => {
  it('validates the finite schema and rejects invalid values, code fields and malformed graphs', () => {
    for (const primitive of PRIMITIVES) expect(validateProgram(one(primitive))).toEqual(one(primitive));
    const valid = pair('tube', 'sphere', 'end');
    expect(validateProgram(valid)).toEqual(valid);
    for (const raw of [null, [], false, 'sphere', { ...valid, version: 2 }, { ...valid, eval: 'run arbitrary code' }, { ...valid, parts: [] }, { ...valid, parts: [...valid.parts, part('box', '2')] }]) expect(validateProgram(raw)).toBeNull();
    for (const bad of ['missing', '0']) expect(validateProgram({ ...valid, relation: { ...valid.relation, child: bad } })).toBeNull();
    expect(validateProgram({ ...valid, relation: { kind: 'end', parent: '1', child: '0' } })).toBeNull();
    expect(validateProgram({ ...valid, relation: undefined })).toBeNull();
    expect(validateProgram({ ...one('sphere'), relation: { kind: 'end', parent: '0', child: '0' } })).toBeNull();
    for (const field of ['height', 'width', 'depth', 'bend', 'twist'] as const) for (const bad of [NaN, Infinity, -Infinity, '1', null, undefined]) {
      expect(validateProgram({ version: 1, parts: [{ ...part('sphere'), [field]: bad }] })).toBeNull();
    }
    for (const bad of [{ height: .39 }, { width: 1.81 }, { bend: -1.01 }, { primitive: 'unknown' }, { id: '../../local-file' }, { sourceCode: 'anything' }]) {
      expect(validateProgram({ version: 1, parts: [{ ...part('sphere'), ...bad }] })).toBeNull();
    }
    expect(compileScaffoldProgram(pair('box', 'sphere', 'through'))).toBeNull();
  });

  it('builds inspectable centerline, section and profile data, retaining the validated input', () => {
    const raw = pair('tube', 'sphere', 'end'), compiled = compileScaffoldProgram(raw)!;
    expect(compiled.spec).toEqual(raw); expect(compiled.source).toEqual(raw);
    expect(compiled.parts.map(p => p.id)).toEqual(['0', '1']);
    for (const p of compiled.parts) {
      expect(p.centerline.controls.length).toBe(4);
      expect(p.centerline.points.length).toBe(65);
      expect(p.section.kind).toBe('ellipse'); expect(p.area).toBeGreaterThan(0);
      expect(p.centerline.points.flat().every(Number.isFinite)).toBe(true);
    }
    expect(compiled.centerlines[0].points).toEqual(compiled.parts[0].centerline.points);
    raw.parts[0].height = .4;
    expect(compiled.spec.parts[0].height).toBe(1.4);
    expect(compiled.parts[0].profile.knots[0].x).toBeCloseTo(.096);
    const loop = compileScaffoldProgram(one('ring'))!;
    expect(loop.parts[0].centerline.closed).toBe(true);
    expect(loop.parts[0].centerline.controls.length).toBe(8);
  });

  it('the compiler preserves an actual cap-to-pole connection from a rod to a ball while both move', () => {
    for (const bend of [-1, 0, 1]) for (const twist of [-1, 1]) {
      const compiled = compileScaffoldProgram(pair('tube', 'sphere', 'end', { bend, twist }, { bend: -bend, twist }))!;
      closeVector(compiled.parts[0].anchors.end, compiled.parts[1].anchors.start);
      for (const time of [0, 73, 3600]) {
        const cap = compiledPartSurfacePoint(compiled, 0, .13, 0, time, 'capEnd');
        const pole = compiledPartSurfacePoint(compiled, 1, .71, 0, time);
        closeVector(cap, pole);
      }
      expect(compiled.parts[1].anchors.center[1]).toBeGreaterThan(compiled.parts[0].anchors.center[1]);
    }
  });

  it('above uses actual surface anchor points and retains contact during slow deformation', () => {
    for (const parent of ['sphere', 'box', 'tube'] as const) for (const child of ['sphere', 'box', 'tube'] as const) {
      const compiled = compileScaffoldProgram(pair(parent, child, 'above', { bend: .8, twist: -.6 }, { bend: -.8, twist: .6 }))!;
      closeVector(compiled.parts[0].anchors.top, compiled.parts[1].anchors.bottom);
      expect(compiled.parts[1].bounds.min[1]).toBeCloseTo(compiled.parts[0].bounds.max[1], 8);
      const a = compiled.parts[0].anchorCharts.top, b = compiled.parts[1].anchorCharts.bottom;
      for (const time of [0, 7, 73, 3600]) {
        closeVector(compiledPartSurfacePoint(compiled, 0, a.around, a.along, time, a.chart), compiledPartSurfacePoint(compiled, 1, b.around, b.along, time, b.chart));
      }
    }
  });

  it('through makes the ring surface cross the box boundary, including a huge requested ring around a tiny box', () => {
    for (const parentWidth of [.4, 1.8]) for (const parentHeight of [.4, 1.8]) for (const childWidth of [.4, 1.8]) for (const childDepth of [.4, 1.8]) {
      const raw = pair('box', 'ring', 'through', { width: parentWidth, height: parentHeight, depth: .8 }, { width: childWidth, height: 1.8, depth: childDepth });
      const compiled = compileScaffoldProgram(raw)!;
      const inside = inversePartPoint(compiled, 0, compiledPartSurfacePoint(compiled, 1, .5, 0, 0));
      const outside = inversePartPoint(compiled, 0, compiledPartSurfacePoint(compiled, 1, 0, 0, 0));
      // This is the implicit box surface, not a bounding-box overlap check.
      const field = (p: Vec3) => (p[0] / parentWidth) ** 12 + (p[1] / parentHeight) ** 12 + (p[2] / .8) ** 12 - 1;
      expect(field(inside)).toBeLessThan(0); expect(field(outside)).toBeGreaterThan(0);
      expect(compiled.adjustments).toHaveLength(1);
      expect(compiled.parts[1].source.width).toBe(childWidth);
      expect(compiled.parts[1].effective.width).not.toBe(childWidth);
    }
  });

  it('through rods cross the sphere on both sides instead of ending inside it', () => {
    const compiled = compileScaffoldProgram(pair('sphere', 'tube', 'through', { width: 1.8 }, { height: .4 }))!;
    const a = inversePartPoint(compiled, 0, compiledPartSurfacePoint(compiled, 1, .17, 0, 0, 'capStart'));
    const b = inversePartPoint(compiled, 0, compiledPartSurfacePoint(compiled, 1, .17, 0, 0, 'capEnd'));
    const field = (p: Vec3) => (p[0] / 1.8) ** 2 + p[1] ** 2 + p[2] ** 2 - 1;
    expect(a[0]).toBeLessThan(-1.8); expect(b[0]).toBeGreaterThan(1.8);
    expect(field(a)).toBeGreaterThan(0); expect(field(b)).toBeGreaterThan(0);
    const middle = inversePartPoint(compiled, 0, compiledPartSurfacePoint(compiled, 1, .25, .5, 0));
    expect(field(middle)).toBeLessThan(0);
  });

  it('holds the previous shape when a thick enclosing or bent avoiding tube provides no material crossing', () => {
    const tiny = { height: .4, width: .4, depth: .4 };
    expect(compileScaffoldProgram(pair('sphere', 'tube', 'through', tiny, { height: 1.8, width: 1.8, depth: 1.8, twist: -.8 }))).toBeNull();
    for (const parent of ['sphere', 'box'] as const) {
      expect(compileScaffoldProgram(pair(parent, 'tube', 'through', tiny, { height: 1.8, width: .4, depth: .4, bend: 1 }))).toBeNull();
    }
  });

  it('retains ordinary through combinations with nonzero bends and records finite sampling evidence', () => {
    for (const parent of PRIMITIVES) for (const child of ['ring', 'tube', 'blade'] as const) {
      const compiled = compileScaffoldProgram(pair(parent, child, 'through', { width: .9, depth: .65, bend: .4, twist: .7 }, { height: 1, width: .7, depth: .55, bend: -.4, twist: -.7 }))!;
      expect(compiled, `${parent}/${child}`).not.toBeNull();
      expect(compiled.throughCheck?.method).toBe('sampled-material-occupancy');
      expect(compiled.throughCheck?.maximumPointsPerTime).toBe(266);
      expect(compiled.throughCheck?.atTimes.map(row => row.time)).toEqual([0, 15, 30, 45]);
      for (const row of compiled.throughCheck!.atTimes) {
        expect(row.sampledPoints).toBeLessThanOrEqual(266);
        expect(row.insideCount).toBeGreaterThan(0); expect(row.outsideCount).toBeGreaterThan(0);
      }
    }
  });

  it('holds a bent rod that temporarily leaves a tiny ring despite crossing at the initial pose', () => {
    expect(compileScaffoldProgram(pair('ring', 'tube', 'through',
      { height: .4, width: .4, depth: .4, bend: .2, twist: .8 },
      { height: 1.8, width: .4, depth: .4, bend: 1, twist: -.8 }))).toBeNull();
  });

  it('supports two instances of the same primitive and preserves their distinct identities', () => {
    const compiled = compileScaffoldProgram(pair('sphere', 'sphere', 'above', { width: .4 }, { width: 1.8 }))!;
    expect(compiled.parts.map(p => p.id)).toEqual(['0', '1']);
    expect(compiled.parts[0].position).not.toEqual(compiled.parts[1].position);
    expect(compiled.parts[0].source.primitive).toBe(compiled.parts[1].source.primitive);
    expect(compiled.parts[0].area).toBeLessThan(compiled.parts[1].area);
  });

  it('all primitives and broad parameter extremes keep finite, fitted points and nondegenerate tangents', () => {
    for (const primitive of PRIMITIVES) for (const height of [.4, 1.8]) for (const width of [.4, 1.8]) for (const depth of [.4, 1.8]) {
      const compiled = compileScaffoldProgram(one(primitive, { height, width, depth, bend: .8, twist: -.8 }))!;
      for (const time of [0, 73, 4000]) for (const id of [0, 1, 11, 97, 8191]) {
        const p: Vec3 = [0, 0, 0], du: Vec3 = [0, 0, 0], dv: Vec3 = [0, 0, 0];
        expect(programSurface(compiled, id, time, 27, p, du, dv)).toBe(p);
        for (const vector of [p, du, dv]) expect(vector.every(Number.isFinite), primitive).toBe(true);
        expect(Math.hypot(...p), primitive).toBeLessThanOrEqual(1.7);
        expect(Math.hypot(...cross(du, dv)), primitive).toBeGreaterThan(.000001);
      }
    }
  });

  it('closed loop seams agree exactly under section twisting and slow body motion', () => {
    const compiled = compileScaffoldProgram(one('ring', { bend: 1, twist: 1 }))!;
    for (const time of [0, 73, 4000]) for (const around of [0, .13, .71]) for (const along of [0, .13, .71]) {
      closeVector(compiledPartSurfacePoint(compiled, 0, around, along, time), compiledPartSurfacePoint(compiled, 0, around + 1, along, time));
      closeVector(compiledPartSurfacePoint(compiled, 0, around, along, time), compiledPartSurfacePoint(compiled, 0, around, along + 1, time));
    }
  });

  it('vase outer wall, cavity, rim and flat base join at their shared chart boundaries', () => {
    const compiled = compileScaffoldProgram(one('vase', { bend: .7, twist: -.7 }))!;
    for (const time of [0, 73]) for (const around of [.13, .33, .71]) {
      const p = compiledPartSurfacePoint;
      // Reversing the material coordinate reverses the cavity and lip winding.
      const rimAround = -around;
      closeVector(p(compiled, 0, around, 1, time), p(compiled, 0, rimAround, 1, time, 'rim'));
      closeVector(p(compiled, 0, rimAround, 0, time, 'rim'), p(compiled, 0, rimAround, 1, time, 'inside'));
      closeVector(p(compiled, 0, around, 0, time), p(compiled, 0, around, 1, time, 'capStart'));
    }
  });

  it('uniform surface samplers cover both parts, retain the seeded identity and move continuously', () => {
    const compiled = compileScaffoldProgram(pair('tube', 'sphere', 'end'))!;
    const samples = Array.from({ length: 4096 }, (_, id) => programSurface(compiled, id, 17, 27));
    for (const index of [0, 1]) {
      const p = compiled.parts[index], occupied = new Set(Array.from({ length: 1024 }, (_, id) => programPartSurface(compiled, index, id, 17, 27).map(x => Math.floor(x * 30)).join(',')));
      expect(occupied.size).toBeGreaterThan(index === 0 ? 200 : 350);
      expect(samples.some(point => Math.abs(point[1] - p.anchors.center[1]) < .1)).toBe(true);
    }
    for (const id of [0, 1, 127, 8191]) for (const time of [0, 17, 4000]) {
      const p = programSurface(compiled, id, time, 27);
      expect(programSurface(compiled, id, time, 27)).toEqual(p);
      expect(distance(p, programSurface(compiled, id, time + .00001, 27))).toBeLessThan(.001);
    }
  });

  it('solid coating normals face outside the generated section and both rod caps', () => {
    for (const primitive of ['sphere', 'box', 'tube', 'blade'] as const) {
      const compiled = compileScaffoldProgram(one(primitive))!;
      for (const around of [.13, .33, .71]) for (const along of [.13, .5, .88]) {
        const h = .00001, a0 = compiledPartSurfacePoint(compiled, 0, around - h, along, 0), a1 = compiledPartSurfacePoint(compiled, 0, around + h, along, 0);
        const b0 = compiledPartSurfacePoint(compiled, 0, around, along - h, 0), b1 = compiledPartSurfacePoint(compiled, 0, around, along + h, 0);
        const normal = cross(a1.map((x, k) => x - a0[k]) as Vec3, b1.map((x, k) => x - b0[k]) as Vec3);
        const p = compiledPartSurfacePoint(compiled, 0, around, along, 0), opposite = compiledPartSurfacePoint(compiled, 0, around + .5, along, 0);
        expect(dot(normal, p.map((x, k) => x - opposite[k]) as Vec3)).toBeGreaterThan(0);
      }
    }
    const compiled = compileScaffoldProgram(one('tube'))!;
    for (const chart of ['capStart', 'capEnd'] as const) {
      const h = .00001, u = .13, v = .5;
      const a0 = compiledPartSurfacePoint(compiled, 0, u - h, v, 0, chart), a1 = compiledPartSurfacePoint(compiled, 0, u + h, v, 0, chart);
      const b0 = compiledPartSurfacePoint(compiled, 0, u, v - h, 0, chart), b1 = compiledPartSurfacePoint(compiled, 0, u, v + h, 0, chart);
      const normal = cross(a1.map((x, k) => x - a0[k]) as Vec3, b1.map((x, k) => x - b0[k]) as Vec3);
      expect(normal[1] * (chart === 'capStart' ? -1 : 1)).toBeGreaterThan(0);
    }
  });
});


describe('physical section twisting', () => {
  it('rotates the whole noncircular point set, not only the glyph material positions', () => {
    // Recover raw part coordinates so automatic global fit cannot imitate twisting.
    const rawWidth = 1.4, rawDepth = .4, compiled = compileScaffoldProgram(one('box', { width: rawWidth, depth: rawDepth, twist: 1 }))!;
    for (const along of [.25, .75]) {
      const twist = .8 * (2 * along - 1), radius = (1 - Math.abs(2 * along - 1) ** 12) ** (1 / 12);
      const ca = Math.cos(twist), sa = Math.sin(twist), samples = Array.from({ length: 256 }, (_, i) => inversePartPoint(compiled, 0, compiledPartSurfacePoint(compiled, 0, i / 256, along, 0)));
      const implicit = (x: number, z: number) => (Math.abs(x / (rawWidth * radius))) ** 12 + (Math.abs(z / (rawDepth * radius))) ** 12 - 1;
      // The old UV-only twist puts *all* points on the untwisted implicit surface.
      expect(Math.max(...samples.map(p => Math.abs(implicit(p[0], p[2]))))).toBeGreaterThan(.5);
      for (const p of samples) {
        expect(Math.abs(implicit(ca * p[0] + sa * p[2], -sa * p[0] + ca * p[2]))).toBeLessThan(.00001);
      }
      // The lower and upper sections have opposing, nonzero orientations.
      const endpoint = inversePartPoint(compiled, 0, compiledPartSurfacePoint(compiled, 0, 0, along, 0));
      expect(Math.atan2(endpoint[2], endpoint[0])).toBeCloseTo(twist, 6);
    }
  });
});
