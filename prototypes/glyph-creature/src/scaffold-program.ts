import type { Vec3 } from './model';

export const PRIMITIVES = ['sphere', 'box', 'tube', 'blade', 'ring', 'vase'] as const;
export type Primitive = typeof PRIMITIVES[number];
export type Part = { id: string; primitive: Primitive; height: number; width: number; depth: number; bend: number; twist: number };
export type Relation = { kind: 'end' | 'above' | 'through'; parent: string; child: string };
export type Program = { version: 1; parts: Part[]; relation?: Relation };
export type ScaffoldProgram = Program;
export type Bounds = { min: Vec3; max: Vec3 };
export type Chart = 'side' | 'inside' | 'rim' | 'capStart' | 'capEnd';
export type Centerline = { kind: 'bezier' | 'loop'; closed: boolean; controls: Vec3[]; points: Vec3[] };
export type Section = { kind: 'ellipse' | 'superellipse'; exponent: number };
export type RadiusProfile = { kind: 'constant' | 'ellipse' | 'superellipse' | 'knots'; knots: { at: number; x: number; z: number }[] };
export type Anchors = { center: Vec3; start: Vec3; end: Vec3; top: Vec3; bottom: Vec3 };
export type CompiledPart = {
  id: string; source: Part; effective: Part; position: Vec3; rawPosition: Vec3;
  basis: [Vec3, Vec3, Vec3]; centerline: Centerline; section: Section; profile: RadiusProfile;
  bounds: Bounds; anchors: Anchors; area: number; cumulativeArea: number;
  anchorCharts: { top: { around: number; along: number; chart: Chart }; bottom: { around: number; along: number; chart: Chart } };
  charts: { chart: Chart; area: number; cumulative: number; coordinate: number[] }[];
};
export type CompiledProgram = {
  version: 1; source: Program; spec: Program; parts: CompiledPart[]; relation?: Relation;
  centerlines: { id: string; closed: boolean; points: Vec3[] }[];
  bounds: Bounds; scale: number; translation: Vec3; area: number;
  adjustments: { part: string; reason: 'surface-intersection'; height?: number; width?: number; depth?: number }[];
  throughCheck?: ThroughCheck;
};
export type ThroughCheck = {
  method: 'sampled-material-occupancy'; maximumPointsPerTime: number;
  atTimes: { time: number; sampledPoints: number; insideCount: number; outsideCount: number }[];
};

const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const clamp = (x: number) => Math.max(.00001, Math.min(.99999, x));
const assign = (p: Vec3, x: number, y: number, z: number): Vec3 => { p[0] = x; p[1] = y; p[2] = z; return p; };
const clone = (p: Vec3): Vec3 => [...p];
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Only a finite two-part program is accepted. No code, filenames, arbitrary
 * vertices or extra fields are executable through this schema. */
export function validateScaffoldProgram(raw: unknown): Program | null {
  if (!record(raw) || !exactKeys(raw, ['version', 'parts', 'relation']) || raw.version !== 1 || !Array.isArray(raw.parts) || raw.parts.length < 1 || raw.parts.length > 2) return null;
  const parts: Part[] = [];
  for (const value of raw.parts) {
    if (!record(value) || !exactKeys(value, ['id', 'primitive', 'height', 'width', 'depth', 'bend', 'twist'])) return null;
    if (typeof value.id !== 'string' || !/^[a-zA-Z0-9_-]{1,24}$/.test(value.id) || parts.some(part => part.id === value.id) || !(PRIMITIVES as readonly unknown[]).includes(value.primitive)) return null;
    for (const key of ['height', 'width', 'depth', 'bend', 'twist']) {
      const number = value[key], dimension = ['height', 'width', 'depth'].includes(key);
      if (typeof number !== 'number' || !Number.isFinite(number) || number < (dimension ? .4 : -1) || number > (dimension ? 1.8 : 1)) return null;
    }
    parts.push({ id: value.id, primitive: value.primitive as Primitive, height: value.height as number, width: value.width as number, depth: value.depth as number, bend: value.bend as number, twist: value.twist as number });
  }
  let relation: Relation | undefined;
  if (raw.relation !== undefined) {
    if (!record(raw.relation) || !exactKeys(raw.relation, ['kind', 'parent', 'child']) || !['end', 'above', 'through'].includes(String(raw.relation.kind))) return null;
    if (parts.length !== 2 || raw.relation.parent !== parts[0].id || raw.relation.child !== parts[1].id) return null;
    relation = { kind: raw.relation.kind as Relation['kind'], parent: parts[0].id, child: parts[1].id };
  }
  if (parts.length === 2 && !relation) return null;
  return { version: 1, parts, ...(relation ? { relation } : {}) };
}
export const validateProgram = validateScaffoldProgram;

const identityBasis = (): [Vec3, Vec3, Vec3] => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const emptyBounds = (): Bounds => ({ min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
const include = (bounds: Bounds, p: Vec3) => { for (let k = 0; k < 3; k++) { bounds.min[k] = Math.min(bounds.min[k], p[k]); bounds.max[k] = Math.max(bounds.max[k], p[k]); } };
const midpoint = (bounds: Bounds): Vec3 => bounds.min.map((x, k) => (x + bounds.max[k]) / 2) as Vec3;

function makePart(source: Part): CompiledPart {
  const effective = { ...source }, h = source.height;
  const ring = source.primitive === 'ring';
  const controls: Vec3[] = ring ? Array.from({ length: 8 }, (_, i) => {
    const angle = i * TAU / 8;
    return [source.width * Math.cos(angle), source.height * Math.sin(angle), .18 * source.bend * Math.sin(2 * angle)];
  }) : [[0, -h, 0], [.8 * source.bend, -h / 3, .2 * source.bend], [.8 * source.bend, h / 3, -.2 * source.bend], [0, h, 0]];
  const section: Section = { kind: source.primitive === 'box' || source.primitive === 'blade' ? 'superellipse' : 'ellipse', exponent: source.primitive === 'box' ? 12 : source.primitive === 'blade' ? 4 : 2 };
  let profile: RadiusProfile;
  if (source.primitive === 'sphere') profile = { kind: 'ellipse', knots: [] };
  else if (source.primitive === 'box') profile = { kind: 'superellipse', knots: [] };
  else if (source.primitive === 'blade') profile = { kind: 'knots', knots: [{ at: 0, x: .25 * source.width, z: .07 * source.depth }, { at: .6, x: .20 * source.width, z: .055 * source.depth }, { at: 1, x: .008 * source.width, z: .006 * source.depth }] };
  else if (source.primitive === 'vase') profile = { kind: 'knots', knots: [[0, .28], [.2, .72], [.45, .9], [.65, .69], [.83, .34], [1, .34]].map(([at, r]) => ({ at, x: r * source.width, z: r * source.depth })) };
  else {
    const minor = Math.min(.28 * source.depth, .45 * Math.min(source.width, source.height));
    profile = { kind: 'constant', knots: [{ at: 0, x: ring ? minor : .24 * source.width, z: ring ? minor : .24 * source.depth }] };
  }
  return { id: source.id, source: { ...source }, effective, position: [0, 0, 0], rawPosition: [0, 0, 0], basis: identityBasis(), centerline: { kind: ring ? 'loop' : 'bezier', closed: ring, controls, points: [] }, section, profile, bounds: emptyBounds(), anchors: { center: [0, 0, 0], start: [0, 0, 0], end: [0, 0, 0], top: [0, 0, 0], bottom: [0, 0, 0] }, anchorCharts: { top: { around: 0, along: 1, chart: 'side' }, bottom: { around: 0, along: 0, chart: 'side' } }, area: 0, cumulativeArea: 0, charts: [] };
}

/** Every part is evaluated by this shared centerline/section sweep. The controls
 * are real geometry data, rather than a shape name that dispatches to a mesh. */
function curve(part: CompiledPart, s: number, time: number, p: Vec3, tangent?: Vec3): void {
  const controls = part.centerline.controls;
  if (part.centerline.closed) {
    const value = fract(s) * controls.length, i = Math.floor(value), f = value - i;
    const p0 = controls[(i + controls.length - 1) % controls.length], p1 = controls[i], p2 = controls[(i + 1) % controls.length], p3 = controls[(i + 2) % controls.length];
    for (let k = 0; k < 3; k++) {
      const a = -p0[k] + p2[k], b = 2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k], c = -p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k];
      p[k] = .5 * (2 * p1[k] + a * f + b * f * f + c * f * f * f);
      if (tangent) tangent[k] = .5 * (a + 2 * b * f + 3 * c * f * f) * controls.length;
    }
    p[2] += .012 * Math.sin(2 * TAU * s + .09 * time);
    if (tangent) tangent[2] += .024 * TAU * Math.cos(2 * TAU * s + .09 * time);
  } else {
    const q = 1 - s;
    for (let k = 0; k < 3; k++) {
      p[k] = q * q * q * controls[0][k] + 3 * q * q * s * controls[1][k] + 3 * q * s * s * controls[2][k] + s * s * s * controls[3][k];
      if (tangent) tangent[k] = 3 * q * q * (controls[1][k] - controls[0][k]) + 6 * q * s * (controls[2][k] - controls[1][k]) + 3 * s * s * (controls[3][k] - controls[2][k]);
    }
    const drift = .018 * Math.sin(.11 * time);
    p[0] += 4 * s * (1 - s) * drift;
    if (tangent) tangent[0] += 4 * (1 - 2 * s) * drift;
  }
}

function radii(part: CompiledPart, s: number): [number, number] {
  const profile = part.profile;
  if (profile.kind === 'ellipse' || profile.kind === 'superellipse') {
    const power = profile.kind === 'ellipse' ? 2 : 12, radius = Math.max(0, 1 - Math.abs(2 * s - 1) ** power) ** (1 / power);
    return [part.effective.width * radius, part.effective.depth * radius];
  }
  if (profile.kind === 'constant') return [profile.knots[0].x, profile.knots[0].z];
  const knots = profile.knots;
  let i = 0;
  while (i < knots.length - 2 && s > knots[i + 1].at) i++;
  const a = knots[i], b = knots[i + 1], f = Math.max(0, Math.min(1, (s - a.at) / (b.at - a.at)));
  // Smooth interpolation fixes the control values and keeps radii positive.
  const smooth = f * f * (3 - 2 * f);
  return [a.x * (1 - smooth) + b.x * smooth, a.z * (1 - smooth) + b.z * smooth];
}

const center: Vec3 = [0, 0, 0], tangent: Vec3 = [0, 0, 0], normal: Vec3 = [0, 0, 0], binormal: Vec3 = [0, 0, 0];
function localPoint(part: CompiledPart, around: number, along: number, time: number, chart: Chart, out: Vec3): Vec3 {
  let s = along, radial = 1, orientation = -1;
  if (chart === 'capStart') { s = 0; radial = Math.sqrt(Math.max(0, along)); }
  if (chart === 'capEnd') { s = 1; radial = Math.sqrt(Math.max(0, along)); orientation = 1; }
  if (chart === 'inside') s = .06 + .94 * along;
  if (chart === 'rim') { s = 1; orientation = 1; }
  curve(part, s, time, center, tangent);
  const length = Math.hypot(...tangent) || 1;
  for (let k = 0; k < 3; k++) tangent[k] /= length;
  const n = Math.hypot(tangent[0], tangent[1]) || 1;
  assign(normal, tangent[1] / n, -tangent[0] / n, 0);
  assign(binormal, normal[1] * tangent[2], -normal[0] * tangent[2], normal[0] * tangent[1] - normal[1] * tangent[0]);
  const twist = part.effective.twist * .8 * (part.centerline.closed ? Math.sin(s * TAU) : 2 * s - 1);
  const angle = orientation * around * TAU;
  let [rx, rz] = radii(part, s);
  if (chart === 'inside') {
    rx = Math.max(.015, rx - .055 * part.effective.width); rz = Math.max(.015, rz - .055 * part.effective.depth);
    const f = Math.max(0, (.08 - along) / .08), closing = along <= 0 ? 0 : Math.sqrt(Math.max(0, 1 - f * f));
    rx *= closing; rz *= closing; orientation = 1;
  }
  if (chart === 'rim') { rx -= .055 * part.effective.width * (1 - along); rz -= .055 * part.effective.depth * (1 - along); }
  const theta = chart === 'inside' ? around * TAU : angle, ct = Math.cos(theta), st = Math.sin(theta);
  const norm = part.section.kind === 'superellipse' ? (Math.abs(ct) ** part.section.exponent + Math.abs(st) ** part.section.exponent) ** (1 / part.section.exponent) : 1;
  // Rotate the completed section, rather than merely shifting its material coordinate.
  const sectionX = rx * ct / norm * radial, sectionZ = rz * st / norm * radial;
  const ca = Math.cos(twist), sa = Math.sin(twist);
  const x = ca * sectionX - sa * sectionZ, z = sa * sectionX + ca * sectionZ;
  return assign(out, center[0] + x * normal[0] + z * binormal[0], center[1] + x * normal[1] + z * binormal[1], center[2] + x * normal[2] + z * binormal[2]);
}

function rawWorld(part: CompiledPart, local: Vec3, out: Vec3): Vec3 {
  for (let k = 0; k < 3; k++) out[k] = part.rawPosition[k] + local[0] * part.basis[0][k] + local[1] * part.basis[1][k] + local[2] * part.basis[2][k];
  return out;
}

function makeChart(part: CompiledPart, chart: Chart): CompiledPart['charts'][number] {
  const coordinate = Array<number>(97).fill(0), p: Vec3 = [0, 0, 0], d: Vec3 = [0, 0, 0];
  let last = 0;
  for (let i = 0; i < coordinate.length; i++) {
    const s = i / (coordinate.length - 1), h = .0001;
    curve(part, chart === 'inside' ? .06 + .94 * s : s, 0, p, d);
    const [rx, rz] = radii(part, chart === 'inside' ? .06 + .94 * s : s);
    let density = Math.PI * 2 * Math.sqrt((rx * rx + rz * rz) / 2) * Math.hypot(...d);
    if (chart === 'inside') density *= .88;
    if (chart === 'capStart' || chart === 'capEnd') {
      const [x, z] = radii(part, chart === 'capStart' ? 0 : 1); density = Math.PI * x * z;
    } else if (chart === 'rim') {
      const [x, z] = radii(part, 1); density = Math.PI * (x * z - (x - .055 * part.effective.width) * (z - .055 * part.effective.depth));
    } else if (!part.centerline.closed) {
      const [x0, z0] = radii(part, Math.max(0, s - h)), [x1, z1] = radii(part, Math.min(1, s + h));
      density = Math.PI * 2 * Math.sqrt((rx * rx + rz * rz) / 2) * Math.hypot(Math.hypot(...d), (x1 - x0) / (2 * h), (z1 - z0) / (2 * h)) * (chart === 'inside' ? .88 : 1);
    }
    if (i) coordinate[i] = coordinate[i - 1] + (density + last) / (2 * (coordinate.length - 1));
    last = density;
  }
  const area = coordinate.at(-1) || 1;
  for (let i = 1; i < coordinate.length; i++) coordinate[i] /= area;
  return { chart, area, cumulative: 0, coordinate };
}

function finishRawPart(part: CompiledPart): void {
  part.charts = [makeChart(part, 'side')];
  if (part.source.primitive === 'tube' || part.source.primitive === 'blade') part.charts.push(makeChart(part, 'capStart'), makeChart(part, 'capEnd'));
  if (part.source.primitive === 'vase') part.charts.push(makeChart(part, 'inside'), makeChart(part, 'rim'), makeChart(part, 'capStart'));
  part.area = part.charts.reduce((sum, chart) => sum + chart.area, 0);
  let accumulated = 0;
  for (const chart of part.charts) { accumulated += chart.area / part.area; chart.cumulative = accumulated; }
  part.bounds = emptyBounds();
  const local: Vec3 = [0, 0, 0], world: Vec3 = [0, 0, 0];
  const top: Vec3 = [0, -Infinity, 0], bottom: Vec3 = [0, Infinity, 0];
  for (const { chart } of part.charts) for (let j = 0; j <= 48; j++) for (let i = 0; i < 32; i++) {
    localPoint(part, i / 32, j / 48, 0, chart, local); rawWorld(part, local, world); include(part.bounds, world);
    if (world[1] > top[1]) { assign(top, ...world); part.anchorCharts.top = { around: i / 32, along: j / 48, chart }; }
    if (world[1] < bottom[1]) { assign(bottom, ...world); part.anchorCharts.bottom = { around: i / 32, along: j / 48, chart }; }
  }
  const linePoint = (s: number): Vec3 => { curve(part, s, 0, local); return rawWorld(part, local, [0, 0, 0]); };
  part.anchors = { center: linePoint(part.centerline.closed ? 0 : .5), start: linePoint(0), end: linePoint(1), top, bottom };
  if (part.centerline.closed) part.anchors.center = clone(part.rawPosition);
  part.centerline.points = Array.from({ length: 65 }, (_, i) => linePoint(i / 64));
}

/** Invert a swept section through its normal plane. This checks the generated
 * solid material, including a vase's hollow cavity, rather than its bounds.
 * Root finding is finite and numerical; it is not a universal SDF proof. */
function materialOccupancy(part: CompiledPart, world: Vec3, time: number): number {
  const relative = world.map((x, k) => x - part.rawPosition[k]) as Vec3;
  const point = part.basis.map(axis => axis.reduce((sum, x, k) => sum + x * relative[k], 0)) as Vec3;
  const line: Vec3 = [0, 0, 0], direction: Vec3 = [0, 0, 0];
  const plane = (s: number): number => {
    curve(part, s, time, line, direction);
    return (point[0] - line[0]) * direction[0] + (point[1] - line[1]) * direction[1] + (point[2] - line[2]) * direction[2];
  };
  const section = (s: number): number => {
    // An end plane is a boundary, never evidence of deep solid interior.
    if (!part.centerline.closed && (s <= .00001 || s >= .99999)) return Infinity;
    curve(part, s, time, line, direction);
    const length = Math.hypot(...direction) || 1;
    for (let k = 0; k < 3; k++) direction[k] /= length;
    const n = Math.hypot(direction[0], direction[1]) || 1;
    const nx = direction[1] / n, ny = -direction[0] / n;
    const bx = ny * direction[2], by = -nx * direction[2], bz = nx * direction[1] - ny * direction[0];
    const dx = point[0] - line[0], dy = point[1] - line[1], dz = point[2] - line[2];
    const u = dx * nx + dy * ny, v = dx * bx + dy * by + dz * bz;
    const angle = .8 * part.effective.twist * (part.centerline.closed ? Math.sin(s * TAU) : 2 * s - 1);
    const ca = Math.cos(angle), sa = Math.sin(angle), x = ca * u + sa * v, z = -sa * u + ca * v;
    const [rx, rz] = radii(part, s), power = part.section.exponent;
    if (rx < 1e-10 || rz < 1e-10) return Infinity;
    let score = Math.abs(x / rx) ** power + Math.abs(z / rz) ** power;
    if (part.source.primitive === 'vase' && s >= .06) {
      const along = (s - .06) / .94, f = Math.max(0, (.08 - along) / .08);
      const closing = along <= 0 ? 0 : Math.sqrt(Math.max(0, 1 - f * f));
      const ix = Math.max(.015, rx - .055 * part.effective.width) * closing;
      const iz = Math.max(.015, rz - .055 * part.effective.depth) * closing;
      if (ix > 1e-10 && iz > 1e-10) score = Math.max(score, 2 - (Math.abs(x / ix) ** power + Math.abs(z / iz) ** power));
      else if (Math.hypot(x, z) < 1e-8) score = Math.max(score, 1);
    }
    return score;
  };
  let best = Infinity, low = 0, lowValue = plane(0);
  if (Math.abs(lowValue) < 1e-9) best = Math.min(best, section(0));
  for (let i = 1; i <= 64; i++) {
    const high = i / 64, highValue = plane(high);
    if (Math.abs(highValue) < 1e-9) best = Math.min(best, section(high));
    if (lowValue * highValue < 0) {
      let a = low, b = high, fa = lowValue;
      for (let step = 0; step < 24; step++) {
        const mid = (a + b) / 2, fm = plane(mid);
        if (fa * fm <= 0) b = mid;
        else { a = mid; fa = fm; }
      }
      best = Math.min(best, section((a + b) / 2));
    }
    if (best < .995) return best;
    low = high; lowValue = highValue;
  }
  return best;
}

const THROUGH_COORDINATES: [number, number][] = [[0, .5], [.25, .5], [.5, .5], [.75, .5], [0, 0], [.5, 0], [.25, 0], [.75, 0], [0, 1], [.5, 1],
  ...Array.from({ length: 256 }, (_, i): [number, number] => [fract((i + 1) * .618033988749895), fract((i + 1) * .754877666246693)])];
function checkThroughMaterial(parent: CompiledPart, child: CompiledPart): ThroughCheck | null {
  const check: ThroughCheck = { method: 'sampled-material-occupancy', maximumPointsPerTime: THROUGH_COORDINATES.length, atTimes: [] };
  const local: Vec3 = [0, 0, 0], point: Vec3 = [0, 0, 0];
  // At most 1,064 material samples across four poses. This finite check does
  // not prove intersection at every intervening or future animation time.
  for (const time of [0, 15, 30, 45]) {
    const result = { time, sampledPoints: 0, insideCount: 0, outsideCount: 0 };
    for (const [around, along] of THROUGH_COORDINATES) {
      localPoint(child, around, along, time, 'side', local); rawWorld(child, local, point);
      const occupancy = materialOccupancy(parent, point, time);
      result.sampledPoints++;
      if (occupancy < .995) result.insideCount++;
      if (occupancy > 1.005) result.outsideCount++;
      if (result.insideCount && result.outsideCount) break;
    }
    check.atTimes.push(result);
    if (!result.insideCount || !result.outsideCount) return null;
  }
  return check;
}

/** Compile finite part instructions into real centerlines, sections, charts and
 * relative placement. This builds procedural geometry, not a neural mesh. */
export function compileScaffoldProgram(raw: unknown): CompiledProgram | null {
  const source = validateScaffoldProgram(raw);
  if (!source) return null;
  const parts = source.parts.map(makePart), adjustments: CompiledProgram['adjustments'] = [];
  let throughCheck: ThroughCheck | undefined;
  finishRawPart(parts[0]);
  if (parts.length === 2) {
    let child = parts[1]; const parent = parts[0], relation = source.relation!;
    if (relation.kind === 'through') {
      const effective = { ...child.effective };
      let throughShift = 0;
      if (effective.primitive === 'ring') {
        const [minor] = radii(child, .5);
        if (parent.effective.primitive === 'ring') {
          const separation = Math.max(radii(parent, .5)[0], minor);
          effective.width = parent.effective.width + separation;
          effective.height = parent.effective.height + separation;
        } else {
          // At the parent's central section the outward X boundary is known.
          // Put the torus centerline half a minor radius beyond that boundary:
          // its inside and outside then straddle the actual surface.
          const [parentRadius] = radii(parent, .5);
          effective.width = Math.max(parentRadius + minor * .5, minor + .08);
          effective.height = Math.max((parent.bounds.max[1] - parent.bounds.min[1]) / 2 + minor * .5, minor + .08);
          throughShift = parentRadius + minor * .5 - effective.width;
        }
        child = makePart(effective); child.source = { ...source.parts[1] }; parts[1] = child;
        adjustments.push({ part: child.id, reason: 'surface-intersection', width: effective.width, height: effective.height });
      } else if (effective.primitive === 'tube' || effective.primitive === 'blade') {
        effective.height = Math.max(effective.height, Math.max(parent.bounds.max[0] - parent.anchors.center[0], parent.anchors.center[0] - parent.bounds.min[0]) + .15);
        child = makePart(effective); child.source = { ...source.parts[1] }; parts[1] = child;
        child.basis = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];
        adjustments.push({ part: child.id, reason: 'surface-intersection', height: effective.height });
      } else return null;
      child.rawPosition = clone(parent.anchors.center);
      child.rawPosition[0] += throughShift;
      finishRawPart(child);
      const checked = checkThroughMaterial(parent, child);
      if (!checked) return null;
      throughCheck = checked;
    } else {
      finishRawPart(child);
      const anchor = relation.kind === 'end' ? parent.anchors.end : parent.anchors.top;
      const target = relation.kind === 'end' ? child.anchors.start : child.anchors.bottom;
      child.rawPosition = anchor.map((x, k) => x - target[k]) as Vec3;
      finishRawPart(child);
    }
  }
  const rawBounds = emptyBounds();
  for (const part of parts) { include(rawBounds, part.bounds.min); include(rawBounds, part.bounds.max); }
  const middle = midpoint(rawBounds), translation = middle.map(x => -x) as Vec3;
  const radius = Math.hypot(...rawBounds.max.map((x, k) => (x - rawBounds.min[k]) / 2 + .045));
  // A margin for slow deformation and breath is reserved before global fitting.
  const scale = 1.55 / radius;
  const world = (p: Vec3): Vec3 => p.map((x, k) => (x + translation[k]) * scale) as Vec3;
  let accumulated = 0; const area = parts.reduce((sum, part) => sum + part.area, 0);
  for (const part of parts) {
    part.position = world(part.rawPosition); part.bounds = { min: world(part.bounds.min), max: world(part.bounds.max) };
    for (const key of ['center', 'start', 'end', 'top', 'bottom'] as const) part.anchors[key] = world(part.anchors[key]);
    part.centerline.points = part.centerline.points.map(world);
    accumulated += part.area / area; part.cumulativeArea = accumulated;
  }
  return { version: 1, source, spec: source, parts, ...(source.relation ? { relation: source.relation } : {}), ...(throughCheck ? { throughCheck } : {}), centerlines: parts.map(part => ({ id: part.id, closed: part.centerline.closed, points: part.centerline.points })), bounds: { min: world(rawBounds.min), max: world(rawBounds.max) }, scale, translation, area, adjustments };
}

const attachmentCache = new WeakMap<CompiledProgram, { time: number; offset: Vec3 }>();
function attachmentOffset(program: CompiledProgram, partIndex: number, time: number): Vec3 | null {
  if (partIndex !== 1 || program.relation?.kind !== 'above') return null;
  const previous = attachmentCache.get(program);
  if (previous?.time === time) return previous.offset;
  const parent = program.parts[0], child = program.parts[1], local: Vec3 = [0, 0, 0], p: Vec3 = [0, 0, 0], q: Vec3 = [0, 0, 0];
  const a = parent.anchorCharts.top, b = child.anchorCharts.bottom;
  localPoint(parent, a.around, a.along, time, a.chart, local); rawWorld(parent, local, p);
  localPoint(child, b.around, b.along, time, b.chart, local); rawWorld(child, local, q);
  const offset = p.map((x, k) => (x - q[k]) * program.scale) as Vec3;
  attachmentCache.set(program, { time, offset });
  return offset;
}

/** A direct chart point exposes the constructed surface for independent tests.
 * around runs across the section, along follows the compiled centerline. */
export function compiledPartSurfacePoint(program: CompiledProgram, partIndex: number, around: number, along: number,
  time: number, chart: Chart = 'side', out: Vec3 = [0, 0, 0]): Vec3 {
  const part = program.parts[partIndex];
  localPoint(part, around, along, time, chart, out);
  const x = out[0], y = out[1], z = out[2], breath = 1 + .015 * Math.sin(time * .17), offset = attachmentOffset(program, partIndex, time);
  for (let k = 0; k < 3; k++) out[k] = (part.position[k] + program.scale * (x * part.basis[0][k] + y * part.basis[1][k] + z * part.basis[2][k]) + (offset?.[k] ?? 0)) * breath;
  return out;
}

function areaCoordinate(coordinate: number[], value: number): number {
  const q = clamp(value);
  let low = 0, high = coordinate.length - 1;
  while (high - low > 1) { const mid = (low + high) >>> 1; if (coordinate[mid] < q) low = mid; else high = mid; }
  return (low + (q - coordinate[low]) / Math.max(1e-12, coordinate[high] - coordinate[low])) / (coordinate.length - 1);
}
const before: Vec3 = [0, 0, 0], after: Vec3 = [0, 0, 0];

export function programPartSurface(program: CompiledProgram, partIndex: number, id: number, time: number, seed: number,
  out: Vec3 = [0, 0, 0], du?: Vec3, dv?: Vec3): Vec3 {
  const part = program.parts[partIndex], aa = fract((id + seed * .13) * .618033988749895), bb = fract((id + seed * .27) * .754877666246693);
  const selector = fract((id + seed * .41) * .569840290998053);
  const chart = part.charts.find(value => selector < value.cumulative) ?? part.charts.at(-1)!;
  let u = aa + time * .013 + .04 * Math.sin(bb * TAU + time * .073 + seed);
  let v = clamp(bb + .05 * Math.sin(Math.PI * bb) * Math.sin(aa * TAU + time * .095 + seed * .3));
  if (part.centerline.closed && chart.chart === 'side') v = fract(bb + time * .012 + .035 * Math.sin(aa * TAU + time * .061 + seed));
  if (chart.chart === 'side' || chart.chart === 'inside') v = areaCoordinate(chart.coordinate, v);
  if (chart.chart === 'rim') {
    const [rx] = radii(part, 1), inside = rx - .055 * part.effective.width;
    v = (Math.sqrt(inside * inside + v * (rx * rx - inside * inside)) - inside) / (rx - inside);
  }
  compiledPartSurfacePoint(program, partIndex, u, v, time, chart.chart, out);
  const h = .00001;
  if (du) {
    compiledPartSurfacePoint(program, partIndex, u + h, v, time, chart.chart, after); compiledPartSurfacePoint(program, partIndex, u - h, v, time, chart.chart, before);
    for (let k = 0; k < 3; k++) du[k] = (after[k] - before[k]) / (2 * h);
  }
  if (dv) {
    compiledPartSurfacePoint(program, partIndex, u, v + h, time, chart.chart, after); compiledPartSurfacePoint(program, partIndex, u, v - h, time, chart.chart, before);
    for (let k = 0; k < 3; k++) dv[k] = (after[k] - before[k]) / (2 * h);
  }
  return out;
}

export function programSurface(program: CompiledProgram, id: number, time: number, seed: number,
  out: Vec3 = [0, 0, 0], du?: Vec3, dv?: Vec3): Vec3 {
  const selector = fract((id + seed * .53) * .8191725133961645);
  const index = program.parts.findIndex(part => selector < part.cumulativeArea);
  return programPartSurface(program, index < 0 ? program.parts.length - 1 : index, id, time, seed, out, du, dv);
}
