import * as THREE from 'three';
import { COLORS, type SceneSpec } from '../../prototypes/glyph-creature/src/language';
import { smooth, growth, cameraDistance, type Vec3 } from '../../prototypes/glyph-creature/src/model';
import { composedPosition, randomUnit, intakePosition } from '../../prototypes/glyph-creature/src/shapes';
import { createSurfaceFrame, normalizeSurfaceFrame, surfaceFrame } from '../../prototypes/glyph-creature/src/surface-frame';
import { prepareMotion } from '../../prototypes/glyph-creature/src/motions';
import { sceneSpec, type Shape } from './surface';
import { CAPACITY, createProjection } from './projection-r2.mjs';
import { vertexShader, fragmentShader } from './shaders.mjs';
type BodyUnit = { id: number; text: string; ink: 'white' | 'blue' | 'green' | 'purple' };

// A texture tile is a drawing resource, never a body/material identity.
class VisualAtlas {
  canvas = document.createElement('canvas');
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  tiles = new Map<string, number>();
  rows = 1;
  constructor() {
    this.canvas.width = 64 * 32; this.canvas.height = 64;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = this.makeTexture();
  }
  makeTexture() {
    const texture = new THREE.CanvasTexture(this.canvas);
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    return texture;
  }
  add(text: string) {
    if (this.tiles.has(text)) return this.tiles.get(text)!;
    const tile = this.tiles.size;
    if (tile >= CAPACITY) throw new Error('visual atlas capacity');
    if (tile >= this.rows * 32) {
      const oldCanvas = this.canvas, oldTexture = this.texture;
      this.rows *= 2; this.canvas = document.createElement('canvas');
      this.canvas.width = 64 * 32; this.canvas.height = 64 * this.rows;
      this.ctx = this.canvas.getContext('2d')!; this.ctx.drawImage(oldCanvas, 0, 0);
      this.texture = this.makeTexture(); oldTexture.dispose();
    }
    this.ctx.fillStyle = '#ffffff'; this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
    this.ctx.font = '42px "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans CJK JP", monospace';
    this.ctx.fillText(text, (tile % 32) * 64 + 32, Math.floor(tile / 32) * 64 + 34, 54);
    this.tiles.set(text, tile); this.texture.needsUpdate = true;
    return tile;
  }
  dispose() { this.texture.dispose(); this.tiles.clear(); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
}

export class SurfaceScene {
  readonly projection = createProjection();
  readonly renderer: THREE.WebGLRenderer;
  readonly camera = new THREE.PerspectiveCamera(43, 1, .1, 100);
  readonly scene = new THREE.Scene();
  readonly atlas = new VisualAtlas();
  readonly geometry = new THREE.InstancedBufferGeometry();
  readonly material: THREE.ShaderMaterial;
  readonly planes: THREE.Mesh;
  readonly positions = new Float32Array(CAPACITY * 3);
  readonly origins = new Float32Array(CAPACITY * 3);
  readonly targets = new Float32Array(CAPACITY * 3);
  readonly sources = new Float32Array(CAPACITY * 3);
  readonly uv = new Float32Array(CAPACITY * 2);
  readonly phases = new Float32Array(CAPACITY);
  readonly inks = new Float32Array(CAPACITY * 4);
  readonly birthSizes = new Float32Array(CAPACITY);
  readonly frames = new Float32Array(CAPACITY * 4);
  readonly frameScratch = createSurfaceFrame();
  readonly matrix = new THREE.Matrix4();
  readonly quaternion = new THREE.Quaternion();
  readonly point: Vec3 = [0, 0, 0];
  readonly target: Vec3 = [0, 0, 0];
  readonly source: Vec3 = [0, 0, 0];
  private spec: SceneSpec = sceneSpec('sphere');
  private switchedAt = -100;
  private scale = 1;
  private distance = 3.8;
  private formation = 0;
  private seedFocus = 1;
  private width = 1;
  private height = 1;
  private dirtySize = true;
  private renders = 0;
  private resizeObserver: ResizeObserver;
  private turnX = .12;
  private turnY = -.25;
  private zoom = 1;
  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1); this.renderer.setClearColor(0x000000, 1);
    host.append(this.renderer.domElement);
    const plane = new THREE.PlaneGeometry(1, 1);
    this.geometry.index = plane.index!.clone();
    this.geometry.setAttribute('position', plane.getAttribute('position').clone());
    this.geometry.setAttribute('uv', plane.getAttribute('uv').clone()); plane.dispose();
    const attributes = { center: [this.positions, 3], atlasOffset: [this.uv, 2], bornAt: [this.projection.born, 1], phase: [this.phases, 1], inkColor: [this.inks, 4], birthSize: [this.birthSizes, 1], surfaceRotation: [this.frames, 4] };
    // Float64 born metadata is projected into a distinct Float32 GPU attribute below.
    for (const [name, [array, size]] of Object.entries(attributes)) {
      this.geometry.setAttribute(name, new THREE.InstancedBufferAttribute(name === 'bornAt' ? new Float32Array(CAPACITY) : array as Float32Array, size as number).setUsage(THREE.DynamicDrawUsage));
    }
    this.geometry.instanceCount = 0;
    this.material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, forceSinglePass: true,
      uniforms: { atlas: { value: this.atlas.texture }, atlasRows: { value: 1 }, time: { value: 0 }, glyphSize: { value: .145 }, distance: { value: 3.8 }, scale: { value: 1 }, testYaw: { value: 0 }, alignment: { value: 0 }, closedSurface: { value: 1 }, testPose: { value: false } }, vertexShader, fragmentShader });
    this.planes = new THREE.Mesh(this.geometry, this.material); this.planes.frustumCulled = false; this.scene.add(this.planes);
    this.resizeObserver = new ResizeObserver(() => { this.dirtySize = true; }); this.resizeObserver.observe(host);
    const canvas = this.renderer.domElement;
    let last: { x: number; y: number } | null = null;
    canvas.addEventListener('pointerdown', e => { last = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => { if (!last) return; this.turnY += (e.clientX - last.x) * .006; this.turnX = Math.max(-1.4, Math.min(1.4, this.turnX + (e.clientY - last.y) * .006)); last = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', () => { last = null; }); canvas.addEventListener('pointercancel', () => { last = null; });
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoom = Math.max(.65, Math.min(2.2, this.zoom * Math.exp(e.deltaY * .001))); }, { passive: false });
  }
  private resize() {
    this.width = Math.max(1, this.host.clientWidth); this.height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix(); this.renderer.setSize(this.width, this.height); this.dirtySize = false;
  }
  private upload(name: string) { const a = this.geometry.getAttribute(name) as THREE.InstancedBufferAttribute; a.needsUpdate = true; }
  draw(body: Iterable<BodyUnit>, presented: number, shape: Shape, t: number, dt: number) {
    if (this.dirtySize) this.resize();
    if (this.spec.shape !== sceneSpec(shape).shape) { this.origins.set(this.targets); this.spec = sceneSpec(shape); this.switchedAt = t; }
    const previousRows = this.atlas.rows;
    const { previous, count } = this.projection.sync(body, presented, t, (text: string) => this.atlas.add(text));
    const projectionScale = this.height / (2 * Math.tan(THREE.MathUtils.degToRad(43 / 2)));
    for (let i = previous; i < count; i++) {
      const id = this.projection.ids[i];
      this.phases[i] = randomUnit(id * 2654435761 + 1) * Math.PI * 2;
      this.inks.set([...COLORS[this.projection.inks[i] as keyof typeof COLORS], 1], i * 4);
      this.birthSizes[i] = 20 * 64 / 42 * this.distance / projectionScale;
      this.frames[i * 4 + 3] = 1;
      this.sources.set([0, -1.9 / this.scale, 0], i * 3);
      const p = composedPosition(this.spec, id, t, 1);
      this.origins.set(p, i * 3); this.targets.set(p, i * 3);
      (this.geometry.getAttribute('bornAt').array as Float32Array)[i] = this.projection.born[i];
    }
    if (previous !== count || previousRows !== this.atlas.rows) {
      for (let i = 0; i < count; i++) { const tile = this.projection.tiles[i]; this.uv[i * 2] = tile % 32 / 32; this.uv[i * 2 + 1] = 1 - (Math.floor(tile / 32) + 1) / this.atlas.rows; }
      for (const name of ['atlasOffset', 'bornAt', 'phase', 'inkColor', 'birthSize']) this.upload(name);
      this.material.uniforms.atlas.value = this.atlas.texture; this.material.uniforms.atlasRows.value = this.atlas.rows;
    }
    this.geometry.instanceCount = count;
    const safeCount = Math.max(1, count), lerp = dt === 0 ? 0 : 1 - Math.exp(-dt * 3.5);
    this.scale += (growth(safeCount) - this.scale) * lerp;
    this.formation += (1 - Math.exp(-Math.sqrt((safeCount - 1) / 30)) - this.formation) * lerp;
    this.seedFocus += (Math.exp(-(safeCount - 1) / 18) - this.seedFocus) * lerp;
    const formFit = 1 + (this.spec.shape === 'mobius' ? .2 : 0) * this.formation;
    this.distance += ((cameraDistance(safeCount) + .7 * this.formation) * this.zoom * Math.max(1, .93 / this.camera.aspect) * formFit - this.distance) * lerp;
    const blend = smooth((t - this.switchedAt) / 1.6);
    const alignment = .98 * smooth((Math.log2(safeCount) - 4) / 5) * blend;
    const motion = prepareMotion('calm', t);
    for (let i = 0; i < count; i++) {
      const id = this.projection.ids[i];
      const p = count === 1 ? [.018 * Math.sin(t * 1.3), .024 * Math.sin(t * .9), .012 * Math.sin(t)] : composedPosition(this.spec, id, t, 1, motion, this.point, alignment > 0 ? this.frameScratch : undefined);
      const intakeSeed = id * 2654435761 + 1; // Derived display metadata, never a material identity.
      const age = t - this.projection.born[i];
      const arrival = age >= 3.7 ? 1 : Math.max(0, Math.min(1, (age - randomUnit(intakeSeed + 5) * .2) / (2.4 + randomUnit(intakeSeed + 4) * 1.1)));
      for (let axis = 0; axis < 3; axis++) this.target[axis] = this.origins[i * 3 + axis] * (1 - blend) + p[axis] * (count === 1 ? 1 : this.formation) * blend;
      this.targets.set(this.target, i * 3);
      for (let axis = 0; axis < 3; axis++) this.source[axis] = this.sources[i * 3 + axis];
      this.positions.set(arrival < 1 ? intakePosition(this.source, this.target, arrival, intakeSeed) : this.target, i * 3);
      if (alignment > 0) {
        const f = count > 1 ? normalizeSurfaceFrame(this.frameScratch) : surfaceFrame(this.spec, id, t, 1, this.frameScratch)!;
        const { x, y, z } = f;
        this.matrix.set(x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1);
        this.quaternion.setFromRotationMatrix(this.matrix); this.frames.set(this.quaternion.toArray(), i * 4);
      }
    }
    this.upload('center'); if (alignment > 0) this.upload('surfaceRotation');
    this.planes.scale.setScalar(this.scale); this.planes.rotation.set(this.turnX + .09 * Math.sin(t * .038), this.turnY + t * .03, 0);
    this.camera.position.z = this.distance;
    const size = Math.max(.065, .145 / Math.pow(Math.max(1, count / 80), .10));
    const seedSize = 104 * this.distance / projectionScale / this.scale;
    const u = this.material.uniforms;
    u.glyphSize.value = size + (seedSize - size) * this.seedFocus; u.time.value = t; u.distance.value = this.distance; u.scale.value = this.scale; u.alignment.value = alignment; u.closedSurface.value = this.spec.shape === 'mobius' ? 0 : 1;
    this.renderer.render(this.scene, this.camera); this.renders++;
  }
  inspect() { return { ...this.projection.inspect(), renders: this.renders, shapeView: this.spec.shape, finite: this.positions.subarray(0, this.projection.count * 3).every(Number.isFinite), atlasKinds: this.atlas.tiles.size, atlasRows: this.atlas.rows, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles }; }
  destroy() { this.resizeObserver.disconnect(); this.geometry.dispose(); this.material.dispose(); this.atlas.dispose(); this.renderer.dispose(); this.renderer.domElement.remove(); }
}
