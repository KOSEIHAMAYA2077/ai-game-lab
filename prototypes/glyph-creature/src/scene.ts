import { contourCandidate, contourColored, contourPageWeight, contourFrame, contourPath, contourSupported, contourVisit, facingBody, surfaceJourney, type ContourMode, type ContourShape } from './contour';
import { isWordSurface, CLOSED_WORD_SURFACES } from './word-surfaces';
import * as THREE from 'three';
import { Matter, MAX_GLYPHS, MAX_KINDS, growth, cameraDistance, smooth, type Form, type Vec3 } from './model';
import { COLORS, type SceneSpec } from './language';
import { composedPosition, intakePosition, randomUnit } from './shapes';
import { createSurfaceFrame, normalizeSurfaceFrame, surfaceFrame } from './surface-frame';
import { applyMotionFrame, prepareMotion, MOTION_EXTENT } from './motions';

const CELL = 64;
const COLUMNS = 32;

class Atlas {
  canvas = document.createElement('canvas');
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  ids = new Map<string, number>();
  constructor() {
    this.canvas.width = this.canvas.height = CELL * COLUMNS;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
  }
  add(text: string) {
    if (this.ids.has(text)) return this.ids.get(text)!;
    const id = this.ids.size;
    if (id >= MAX_KINDS) throw new Error('文字の種類数が上限に達しました');
    const x = (id % COLUMNS) * CELL;
    const y = Math.floor(id / COLUMNS) * CELL;
    this.ctx.fillStyle = '#ffffff';
    this.ctx.textAlign = 'center'; this.ctx.textBaseline = 'middle';
    this.ctx.font = '42px "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans CJK JP", monospace';
    this.ctx.fillText(text, x + CELL / 2, y + CELL / 2 + 2, CELL - 10);
    this.ids.set(text, id); this.texture.needsUpdate = true;
    return id;
  }
  clear() { this.ids.clear(); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); this.texture.needsUpdate = true; }
}

export class GlyphScene {
  renderer: THREE.WebGLRenderer;
  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 100);
  scene = new THREE.Scene();
  atlas = new Atlas();
  geometry = new THREE.InstancedBufferGeometry();
  positions = new Float32Array(MAX_GLYPHS * 3);
  morphTargets = new Float32Array(MAX_GLYPHS * 3);
  origins = new Float32Array(MAX_GLYPHS * 3);
  uv = new Float32Array(MAX_GLYPHS * 2);
  born = new Float32Array(MAX_GLYPHS);
  phases = new Float32Array(MAX_GLYPHS);
  inks = new Float32Array(MAX_GLYPHS * 4);
  sources = new Float32Array(MAX_GLYPHS * 3);
  birthSizes = new Float32Array(MAX_GLYPHS);
  frames = new Float32Array(MAX_GLYPHS * 4);
  frameScratch = createSurfaceFrame();
  frameMatrix = new THREE.Matrix4();
  frameRotation = new THREE.Quaternion();
  contourRotation = new THREE.Quaternion();
  contourMode: ContourMode = 'off';
  contourMix = 0;
  contourIds = new Set<number>();
  contourRanks = new Int32Array(MAX_GLYPHS);
  contourWeights = new Float32Array(MAX_GLYPHS);
  contourData = new Float32Array(MAX_GLYPHS * 2);
  contourEligible = new Float32Array(MAX_GLYPHS);
  inverseBody = new THREE.Matrix4();
  contourCamera = new THREE.Vector3();
  contourRight = new THREE.Vector3();
  contourActive = 0;
  motionScratch = prepareMotion('calm', 0);
  localPoint: Vec3 = [0, 0, 0];
  movedPoint: Vec3 = [0, 0, 0];
  material: THREE.ShaderMaterial;
  planes: THREE.Mesh;
  testYaw: number | null = null;
  count = 0;
  switchedAt = -100;
  turnX = 0.12;
  turnY = -0.25;
  zoom = 1;
  distance = 3.8;
  scale = 1;
  formation = 0;
  seedFocus = 1;
  width = 1;
  height = 1;
  resizeObserver: ResizeObserver;

  constructor(readonly host: HTMLElement, readonly matter: Matter) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.domElement.setAttribute('aria-label', '入力した文字が流れて形を作る立体表示');
    this.renderer.domElement.setAttribute('role', 'img');
    this.host.appendChild(this.renderer.domElement);
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.setIndex(quad.index!.clone());
    this.geometry.setAttribute('position', quad.getAttribute('position').clone());
    this.geometry.setAttribute('uv', quad.getAttribute('uv').clone());
    quad.dispose();
    this.geometry.setAttribute('center', new THREE.InstancedBufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('atlasOffset', new THREE.InstancedBufferAttribute(this.uv, 2));
    this.geometry.setAttribute('bornAt', new THREE.InstancedBufferAttribute(this.born, 1));
    this.geometry.setAttribute('phase', new THREE.InstancedBufferAttribute(this.phases, 1));
    this.geometry.setAttribute('inkColor', new THREE.InstancedBufferAttribute(this.inks, 4));
    this.geometry.setAttribute('birthSize', new THREE.InstancedBufferAttribute(this.birthSizes, 1));
    this.geometry.setAttribute('contourData', new THREE.InstancedBufferAttribute(this.contourData, 2).setUsage(THREE.DynamicDrawUsage));
    this.geometry.setAttribute('contourEligible', new THREE.InstancedBufferAttribute(this.contourEligible, 1));
    this.geometry.setAttribute('surfaceRotation', new THREE.InstancedBufferAttribute(this.frames, 4).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, forceSinglePass: true,
      uniforms: {
        atlas: { value: this.atlas.texture }, time: { value: 0 }, glyphSize: { value: 0.09 },
        distance: { value: 6.3 }, scale: { value: 1 }, testYaw: { value: 0 }, testPose: { value: false },
        alignment: { value: 0 }, closedSurface: { value: 0 }, rimEmphasis: { value: 0 },
      },
      vertexShader: `
        attribute vec2 atlasOffset;
        attribute vec3 center;
        attribute float bornAt, phase, birthSize;
        attribute vec4 inkColor;
        attribute vec4 surfaceRotation;
        attribute vec2 contourData;
        attribute float contourEligible;
        uniform float time, glyphSize, distance, scale, testYaw, alignment, closedSurface, rimEmphasis;
        uniform bool testPose;
        varying vec2 atlasUV;
        varying float freshness;
        varying float light;
        varying vec3 glyphColor;
        void main() {
          float pitch = testPose ? 0.0 : 0.15 * sin(time * 0.17 + phase);
          float turn = phase + time * (0.09 + 0.025 * sin(phase));
          // Dense letters lie on the material surface; sparse letters still turn freely.
          float yaw = testPose ? testYaw : turn;
          float roll = testPose ? 0.0 : 0.12 * sin(time * 0.13 + phase * 1.3);
          float pulse = testPose ? 1.0 : 1.0 + 0.06 * sin(time * 0.19 + phase);
          vec3 q = position * glyphSize * pulse;
          q = vec3(q.x, cos(pitch) * q.y - sin(pitch) * q.z, sin(pitch) * q.y + cos(pitch) * q.z);
          q = vec3(cos(yaw) * q.x + sin(yaw) * q.z, q.y, -sin(yaw) * q.x + cos(yaw) * q.z);
          q = vec3(cos(roll) * q.x - sin(roll) * q.y, sin(roll) * q.x + cos(roll) * q.y, q.z);
          // Mix planar positions, not quaternion representatives. This stays continuous
          // across 180° (q and -q give the same result). Mid-density letters may flatten.
          vec3 materialPlane = position * glyphSize * pulse;
          materialPlane = vec3(cos(roll) * materialPlane.x - sin(roll) * materialPlane.y,
            sin(roll) * materialPlane.x + cos(roll) * materialPlane.y, materialPlane.z);
          vec3 onSurface = materialPlane + 2.0 * cross(surfaceRotation.xyz,
            cross(surfaceRotation.xyz, materialPlane) + surfaceRotation.w * materialPlane);
          q = mix(q, onSurface, testPose ? 0.0 : max(alignment, contourData.x));
          vec3 outward = vec3(0.0, 0.0, 1.0);
          outward += 2.0 * cross(surfaceRotation.xyz,
            cross(surfaceRotation.xyz, outward) + surfaceRotation.w * outward);
          vec3 viewNormal = normalize(normalMatrix * outward);
          vec3 viewCenter = (modelViewMatrix * vec4(center, 1.0)).xyz;
          float facing = dot(viewNormal, normalize(-viewCenter));
          float rim = (1.0 - smoothstep(0.04, 0.34, abs(facing))) * rimEmphasis * contourEligible;
          float settled = smoothstep(0.0, 3.8, time - bornAt);
          vec4 viewPlane = mix(modelViewMatrix * vec4(q, 0.0), vec4(position.xy * glyphSize * scale, 0.0, 0.0), rim * 0.65);
          vec4 mv = modelViewMatrix * vec4(center, 1.0) + mix(vec4(position.xy * birthSize, 0.0, 0.0), viewPlane, settled);
          gl_Position = projectionMatrix * mv;
          atlasUV = atlasOffset + uv / 32.0;
          freshness = 1.0 - smoothstep(0.6, 7.6, time - bornAt);
          glyphColor = mix(vec3(0.94, 0.95, 0.94), inkColor.rgb, inkColor.a > 0.5 ? 1.0 : freshness);
          light = 0.30 + 0.70 * clamp((distance + 1.6 * scale + mv.z) / (3.2 * scale), 0.0, 1.0);
          // Closed bodies show the material on their near side. Do not show the
          // reversed back hemisphere through it; open strips remain two-sided.
          float nearSide = smoothstep(-0.08, 0.18, facing);
          if (contourData.x > 0.001) nearSide = contourData.y;
          nearSide = mix(nearSide, max(nearSide, 0.78), rim);
          light = mix(light, max(light, 0.86), max(rim, contourData.x * 0.85));
          float coating = testPose ? 0.0 : max(closedSurface * smoothstep(0.3, 0.96, alignment), contourData.x) * settled;
          light *= mix(1.0, nearSide, coating);
        }
      `,
      fragmentShader: `
        uniform sampler2D atlas;
        varying vec2 atlasUV;
        varying float freshness;
        varying float light;
        varying vec3 glyphColor;
        void main() {
          float alpha = texture2D(atlas, atlasUV).a;
          if (alpha < 0.06) discard;
          gl_FragColor = vec4(glyphColor, alpha * light);
        }
      `,
    });
    this.planes = new THREE.Mesh(this.geometry, this.material);
    this.planes.frustumCulled = false;
    this.scene.add(this.planes);
    this.camera.position.z = this.distance;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.bindOrbit();
    this.sync();
  }

  resize() {
    this.width = this.host.clientWidth; this.height = this.host.clientHeight;
    this.camera.aspect = this.width / Math.max(1, this.height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
  }

  sync(screenPoints?: { x: number; y: number }[], fontSize = 20) {
    this.planes.updateMatrixWorld();
    const inverse = this.planes.matrixWorld.clone().invert();
    const rect = this.host.getBoundingClientRect();
    const projectionScale = this.height / (2 * Math.tan(THREE.MathUtils.degToRad(43 / 2)));
    const motion = prepareMotion(this.matter.spec.motion ?? 'calm', this.matter.time, this.motionScratch);
    let contourAdded = 0;
    for (let i = this.count; i < this.matter.glyphs.length; i++) {
      const glyph = this.matter.glyphs[i];
      const tile = this.atlas.add(glyph.text);
      this.uv[i * 2] = (tile % COLUMNS) / COLUMNS;
      this.uv[i * 2 + 1] = 1 - (Math.floor(tile / COLUMNS) + 1) / COLUMNS;
      this.born[i] = glyph.born;
      // Keep the seed's familiar pose. Other letters rotate independently of
      // the golden-angle positions, which otherwise form synchronized ribs.
      this.phases[i] = i === 0 ? 0 : randomUnit(i * 2654435761 + this.matter.seed) * Math.PI * 2;
      const ink = COLORS[glyph.ink ?? 'red'];
      this.inks.set([...ink, glyph.ink ? 1 : 0], i * 4);
      this.contourEligible[i] = contourColored(glyph.ink) ? 1 : 0;
      if (this.contourEligible[i] && contourAdded < 80 && (contourAdded === 0 || contourCandidate(i))) { this.contourRanks[i] = this.contourIds.size; this.contourIds.add(i); contourAdded++; }
      this.birthSizes[i] = fontSize * CELL / 42 * this.distance / projectionScale;
      this.frames[i * 4 + 3] = 1;
      const screen = screenPoints?.[glyph.inputIndex % screenPoints.length];
      const source: Vec3 = screen ? new THREE.Vector3(
        ((screen.x - rect.left) / this.width * 2 - 1) * this.distance / projectionScale * this.width / 2,
        (1 - (screen.y - rect.top) / this.height * 2) * this.distance / projectionScale * this.height / 2, 0,
      ).applyMatrix4(inverse).toArray() as Vec3 : [0, -1.9 / this.scale, 0];
      this.sources.set(source, i * 3);
      const target = composedPosition(this.matter.spec, i, this.matter.time, this.matter.seed, motion);
      this.origins.set(target, i * 3); this.morphTargets.set(target, i * 3);
    }
    this.count = this.matter.glyphs.length;
    this.geometry.instanceCount = this.count;
    this.geometry.getAttribute('atlasOffset').needsUpdate = true;
    this.geometry.getAttribute('bornAt').needsUpdate = true;
    this.geometry.getAttribute('phase').needsUpdate = true;
    this.geometry.getAttribute('inkColor').needsUpdate = true;
    this.geometry.getAttribute('contourEligible').needsUpdate = true;
    this.geometry.getAttribute('birthSize').needsUpdate = true;
  }

  setForm(form: Form) {
    this.setSpec({ ...this.matter.spec, shape: form, count: 1, arrangement: 'single', deformation: 'gentle' });
  }

  setSpec(spec: SceneSpec) {
    if (JSON.stringify(spec) === JSON.stringify(this.matter.spec)) return;
    this.origins.set(this.morphTargets);
    this.switchedAt = this.matter.time;
    this.matter.spec = { ...spec };
  }

  reset() {
    this.atlas.clear(); this.count = 0; this.switchedAt = -100;
    this.contourIds.clear(); this.contourData.fill(0); this.contourWeights.fill(0); this.contourMix = 0; this.contourActive = 0;
    this.testYaw = null;
    this.distance = 3.8; this.scale = 1; this.formation = 0; this.seedFocus = 1; this.zoom = 1; this.turnX = 0.12; this.turnY = -0.25;
    this.sync();
  }

  render(dt: number) {
    const t = this.matter.time;
    const motion = prepareMotion(this.matter.spec.motion ?? 'calm', t, this.motionScratch);
    const targetScale = growth(this.count);
    const lerp = dt === 0 ? 0 : 1 - Math.exp(-dt * 3.5);
    this.scale += (targetScale - this.scale) * lerp;
    // A handful of letters is a small body; it opens into the full form as it grows.
    const targetFormation = 1 - Math.exp(-Math.sqrt((this.count - 1) / 30));
    this.formation += (targetFormation - this.formation) * lerp;
    this.seedFocus += (Math.exp(-(this.count - 1) / 18) - this.seedFocus) * lerp;
    const aspectFit = Math.max(1, 0.93 / this.camera.aspect);
    // Fit the largest breath once; following its current scale would cancel the visible motion.
    const motionFit = 1 + (MOTION_EXTENT[motion.kind] - 1) * this.formation;
    const formFit = 1 + (isWordSurface(this.matter.spec.shape) ? .25 : this.matter.spec.shape === 'cube' ? .14 : this.matter.spec.shape === 'mobius' ? .2 : this.matter.spec.shape === 'fireworks' ? .1 : 0) * this.formation;
    const targetDistance = (cameraDistance(this.count) + .7 * this.formation + (this.matter.spec.count > 1 ? 1.8 : 0)) * this.zoom * aspectFit * motionFit * formFit;
    this.distance += (targetDistance - this.distance) * lerp;
    const blend = smooth((t - this.switchedAt) / 1.6);
    const aligned = surfaceFrame(this.matter.spec, 0, t, this.matter.seed, this.frameScratch) !== null;
    const alignment = aligned ? .98 * smooth((Math.log2(this.count) - 4) / 5) * blend : 0;
    const sharedSurface = alignment > 0 && (['condense', 'cube', 'cuboid', 'dango', 'mobius'].includes(this.matter.spec.shape) || isWordSurface(this.matter.spec.shape));
    const contourAllowed = contourSupported(this.matter.spec) && this.testYaw === null;
    this.contourMix += ((this.contourMode === 'contour' ? 1 : 0) - this.contourMix) * (dt > 0 ? 1 - Math.exp(-dt * 1.6) : 0);
    this.planes.scale.setScalar(this.scale);
    this.planes.rotation.set(this.testYaw === null ? this.turnX : 0, this.testYaw === null ? this.turnY + t * 0.025 : 0, 0);
    this.planes.updateMatrixWorld(true);
    this.inverseBody.copy(this.planes.matrixWorld).invert();
    this.contourCamera.set(0, 0, this.distance).applyMatrix4(this.inverseBody).divideScalar(Math.max(.001, this.formation * motion.scale));
    this.contourRight.set(1, 0, 0).transformDirection(this.inverseBody);
    const contourCamera = this.contourCamera.toArray() as Vec3, contourRight = this.contourRight.toArray() as Vec3;
    this.contourActive = 0;
    for (let i = 0; i < this.count; i++) {
      const glyph = this.matter.glyphs[i];
      const p = this.count === 1
        ? this.testYaw === null ? [0.018 * Math.sin(t * 1.3), 0.024 * Math.sin(t * 0.9), 0.012 * Math.sin(t)] : [0, 0, 0]
        : composedPosition(this.matter.spec, i, t, this.matter.seed, motion, this.localPoint, sharedSurface ? this.frameScratch : undefined).map(v => v * this.formation);
      const arrival = Math.max(0, Math.min(1, (t - glyph.born - randomUnit(glyph.intakeSeed + 5) * .2) / (2.4 + randomUnit(glyph.intakeSeed + 4) * 1.1)));
      let contourWeight = 0;
      let contourAxes: ReturnType<typeof contourFrame> | undefined;
      this.contourData[i * 2] = this.contourData[i * 2 + 1] = 0;
      if (contourAllowed && this.contourMix > .0001 && this.contourIds.has(i)) {
        const desired = this.contourMix * contourPageWeight(this.contourRanks[i], this.contourIds.size, t) * contourVisit(i, t) * smooth((t - glyph.born - 5) / 3);
        // Adding a later cohort must not teleport an earlier glyph when the schedule grows.
        this.contourWeights[i] += (desired - this.contourWeights[i]) * (dt > 0 ? 1 - Math.exp(-dt * 4) : 0);
        contourWeight = this.contourWeights[i];
        if (contourWeight > .0001) {
          const shape = this.matter.spec.shape as ContourShape;
          const path = contourPath(shape, i * .61803398875 + t * .018, contourCamera, contourRight);
          const scale = Math.max(.001, this.formation * motion.scale);
          const source = p.map(v => v / scale) as Vec3;
          const position = surfaceJourney(shape, source, path.point, contourWeight);
          for (let axis = 0; axis < 3; axis++) p[axis] = position[axis] * scale;
          contourAxes = contourFrame(position, path.tangent, contourCamera);
          this.contourData[i * 2] = contourWeight * blend;
          const facing = facingBody(shape, position, contourCamera);
          this.contourData[i * 2 + 1] = smooth((facing + .025) / .065);
          if (shape === 'condense' && facing >= -.025) this.contourData[i * 2 + 1] = Math.max(this.contourData[i * 2 + 1], smooth((contourWeight - .9) / .1) * .92);
          if (contourWeight > .5 && this.contourData[i * 2 + 1] > .1) this.contourActive++;
        }
      }
      const target = p.map((v, axis) => this.origins[i * 3 + axis] * (1 - blend) + v * blend) as Vec3;
      this.morphTargets.set(target, i * 3);
      const source = Array.from(this.sources.subarray(i * 3, i * 3 + 3)) as Vec3;
      const formed = arrival >= 1 ? target : intakePosition(source, target, arrival, glyph.intakeSeed);
      for (let axis = 0; axis < 3; axis++) {
        this.positions[i * 3 + axis] = formed[axis];
      }
      if (alignment > 0 || contourAxes) {
        const frame = sharedSurface ? normalizeSurfaceFrame(this.frameScratch)
          : surfaceFrame(this.matter.spec, i, t, this.matter.seed, this.frameScratch)!;
        if (motion.kind !== 'calm') {
          applyMotionFrame(motion, this.localPoint, frame.x, frame.y, this.movedPoint, frame.x, frame.y);
          normalizeSurfaceFrame(frame);
        }
        const { x, y, z } = frame;
        this.frameMatrix.set(x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1);
        this.frameRotation.setFromRotationMatrix(this.frameMatrix);
        if (contourAxes) {
          const { x, y, z } = contourAxes;
          this.frameMatrix.set(x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, 0, 0, 0, 1);
          this.contourRotation.setFromRotationMatrix(this.frameMatrix);
          this.frameRotation.slerp(this.contourRotation, contourWeight * blend);
        }
        this.frames[i * 4] = this.frameRotation.x; this.frames[i * 4 + 1] = this.frameRotation.y;
        this.frames[i * 4 + 2] = this.frameRotation.z; this.frames[i * 4 + 3] = this.frameRotation.w;
      }
    }
    this.geometry.getAttribute('center').needsUpdate = true;
    this.geometry.getAttribute('contourData').needsUpdate = true;
    if (alignment > 0 || this.contourIds.size > 0) this.geometry.getAttribute('surfaceRotation').needsUpdate = true;
    this.planes.scale.setScalar(this.scale);
    this.planes.rotation.set(this.testYaw === null ? this.turnX : 0, this.testYaw === null ? this.turnY + t * 0.025 : 0, 0);
    this.camera.position.z = this.distance;
    const size = Math.max(0.065, 0.145 / Math.pow(Math.max(1, this.count / 80), 0.10));
    const projectionScale = this.height / (2 * Math.tan(THREE.MathUtils.degToRad(43 / 2)));
    const seedSize = 104 * this.distance / projectionScale / this.scale;
    this.material.uniforms.glyphSize.value = size + (seedSize - size) * this.seedFocus;
    this.material.uniforms.time.value = t;
    this.material.uniforms.rimEmphasis.value = this.contourMode === 'emphasis' && contourAllowed ? 1 : 0;
    this.material.uniforms.distance.value = this.distance;
    this.material.uniforms.scale.value = this.scale;
    this.material.uniforms.alignment.value = alignment;
    this.material.uniforms.closedSurface.value = ['condense', 'cube', 'cuboid', 'dango', ...CLOSED_WORD_SURFACES].includes(this.matter.spec.shape) ? 1 : 0;
    this.material.uniforms.testPose.value = this.testYaw !== null;
    this.material.uniforms.testYaw.value = this.testYaw ?? 0;
    this.renderer.render(this.scene, this.camera);
  }

  bindOrbit() {
    const canvas = this.renderer.domElement;
    let last: { x: number; y: number } | null = null;
    let travel = 0;
    canvas.addEventListener('pointerdown', event => { last = { x: event.clientX, y: event.clientY }; travel = 0; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', event => {
      if (!last) return;
      travel += Math.hypot(event.clientX - last.x, event.clientY - last.y);
      this.turnY += (event.clientX - last.x) * 0.006;
      this.turnX = Math.max(-1.4, Math.min(1.4, this.turnX + (event.clientY - last.y) * 0.006));
      last = { x: event.clientX, y: event.clientY };
    });
    canvas.addEventListener('pointerup', event => {
      if (last && event.pointerType === 'touch' && travel < 8) this.host.dispatchEvent(new Event('open-terminal'));
      last = null;
    });
    canvas.addEventListener('pointercancel', () => { last = null; });
    canvas.addEventListener('wheel', event => {
      event.preventDefault(); this.zoom = Math.max(0.65, Math.min(2.2, this.zoom * Math.exp(event.deltaY * 0.001)));
    }, { passive: false });
  }

  inspect() {
    const points = Array.from(this.positions.slice(0, Math.min(this.count, 5) * 3));
    return { camera: this.distance, renderedScale: this.scale, formation: this.formation,
      glyphSize: this.material.uniforms.glyphSize.value, drawn: this.count, points,
      finite: this.positions.subarray(0, this.count * 3).every(Number.isFinite),
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      renderer: 'instanced-planes', testYaw: this.testYaw,
      contour: { mode: this.contourMode, supported: contourSupported(this.matter.spec), mix: this.contourMix, enrolled: this.contourIds.size, visible: this.contourActive,
        cameraLocal: this.contourCamera.toArray(), bodyScale: this.formation * (this.matter.spec.motion === 'breathe' ? prepareMotion('breathe', this.matter.time).scale : 1),
        colors: [...this.contourIds].reduce<Record<string, number>>((counts, id) => { const ink = this.matter.glyphs[id].ink ?? 'auto'; counts[ink] = (counts[ink] ?? 0) + 1; return counts; }, {}),
        selected: [...this.contourIds].slice(0, 12).map(id => ({ id, text: this.matter.glyphs[id].text, ink: this.matter.glyphs[id].ink,
          weight: this.contourData[id * 2], visibility: this.contourData[id * 2 + 1], point: Array.from(this.positions.subarray(id * 3, id * 3 + 3)) })) } };
  }
}
