import * as THREE from 'three';
import { Matter, MAX_GLYPHS, MAX_KINDS, growth, cameraDistance, shapePosition, smooth, type Form } from './model';

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
  origins = new Float32Array(MAX_GLYPHS * 3);
  uv = new Float32Array(MAX_GLYPHS * 2);
  born = new Float32Array(MAX_GLYPHS);
  phases = new Float32Array(MAX_GLYPHS);
  material: THREE.ShaderMaterial;
  planes: THREE.Mesh;
  testYaw: number | null = null;
  count = 0;
  switchedAt = -100;
  turnX = 0.12;
  turnY = -0.25;
  zoom = 1;
  distance = 6.3;
  scale = 1;
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
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, forceSinglePass: true,
      uniforms: {
        atlas: { value: this.atlas.texture }, time: { value: 0 }, glyphSize: { value: 0.09 },
        distance: { value: 6.3 }, scale: { value: 1 }, testYaw: { value: 0 }, testPose: { value: false },
      },
      vertexShader: `
        attribute vec2 atlasOffset;
        attribute vec3 center;
        attribute float bornAt, phase;
        uniform float time, glyphSize, distance, scale, testYaw;
        uniform bool testPose;
        varying vec2 atlasUV;
        varying float freshness;
        varying float light;
        void main() {
          float pitch = testPose ? 0.0 : 0.25 * sin(time * 0.71 + phase);
          float yaw = testPose ? testYaw : phase + time * (0.32 + 0.09 * sin(phase));
          float roll = testPose ? 0.0 : 0.18 * sin(time * 0.47 + phase * 1.3);
          float pulse = testPose ? 1.0 : 1.0 + 0.16 * sin(time * 0.8 + phase);
          vec3 q = position * glyphSize * pulse;
          q = vec3(q.x, cos(pitch) * q.y - sin(pitch) * q.z, sin(pitch) * q.y + cos(pitch) * q.z);
          q = vec3(cos(yaw) * q.x + sin(yaw) * q.z, q.y, -sin(yaw) * q.x + cos(yaw) * q.z);
          q = vec3(cos(roll) * q.x - sin(roll) * q.y, sin(roll) * q.x + cos(roll) * q.y, q.z);
          vec4 mv = modelViewMatrix * vec4(center + q, 1.0);
          gl_Position = projectionMatrix * mv;
          atlasUV = atlasOffset + uv / 32.0;
          freshness = 1.0 - smoothstep(0.6, 7.6, time - bornAt);
          light = 0.30 + 0.70 * clamp((distance + 1.6 * scale + mv.z) / (3.2 * scale), 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D atlas;
        varying vec2 atlasUV;
        varying float freshness;
        varying float light;
        void main() {
          float alpha = texture2D(atlas, atlasUV).a;
          if (alpha < 0.06) discard;
          vec3 color = mix(vec3(0.90, 0.92, 0.90), vec3(1.0, 0.21, 0.19), freshness);
          gl_FragColor = vec4(color, alpha * light);
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

  sync() {
    for (let i = this.count; i < this.matter.glyphs.length; i++) {
      const glyph = this.matter.glyphs[i];
      const tile = this.atlas.add(glyph.text);
      this.uv[i * 2] = (tile % COLUMNS) / COLUMNS;
      this.uv[i * 2 + 1] = 1 - (Math.floor(tile / COLUMNS) + 1) / COLUMNS;
      this.born[i] = glyph.born;
      this.phases[i] = i * 2.399963229728653;
      this.origins.set([0, -1.9, 0], i * 3);
    }
    this.count = this.matter.glyphs.length;
    this.geometry.instanceCount = this.count;
    this.geometry.getAttribute('atlasOffset').needsUpdate = true;
    this.geometry.getAttribute('bornAt').needsUpdate = true;
    this.geometry.getAttribute('phase').needsUpdate = true;
  }

  setForm(form: Form) {
    if (form === this.matter.form) return;
    this.origins.set(this.positions);
    this.switchedAt = this.matter.time;
    this.matter.form = form;
  }

  reset() {
    this.atlas.clear(); this.count = 0; this.switchedAt = -100;
    this.testYaw = null;
    this.distance = 6.3; this.scale = 1; this.zoom = 1; this.turnX = 0.12; this.turnY = -0.25;
    this.sync();
  }

  render(dt: number) {
    const t = this.matter.time;
    const targetScale = growth(this.count);
    const lerp = dt === 0 ? 0 : 1 - Math.exp(-dt * 3.5);
    this.scale += (targetScale - this.scale) * lerp;
    const aspectFit = Math.max(1, 0.93 / this.camera.aspect);
    const targetDistance = cameraDistance(this.count) * this.zoom * aspectFit;
    this.distance += (targetDistance - this.distance) * lerp;
    const blend = smooth((t - this.switchedAt) / 1.6);
    for (let i = 0; i < this.count; i++) {
      const glyph = this.matter.glyphs[i];
      const p = this.count === 1
        ? this.testYaw === null ? [0.018 * Math.sin(t * 1.3), 0.024 * Math.sin(t * 0.9), 0.012 * Math.sin(t)] : [0, 0, 0]
        : shapePosition(this.matter.form, i, t, this.matter.seed);
      const arrival = smooth((t - glyph.born) / 1.4);
      for (let axis = 0; axis < 3; axis++) {
        const start = axis === 1 ? -1.9 : 0;
        const formed = start + (p[axis] - start) * arrival;
        this.positions[i * 3 + axis] = this.origins[i * 3 + axis] * (1 - blend) + formed * blend;
      }
    }
    this.geometry.getAttribute('center').needsUpdate = true;
    this.planes.scale.setScalar(this.scale);
    this.planes.rotation.set(this.testYaw === null ? this.turnX : 0, this.testYaw === null ? this.turnY + t * 0.025 : 0, 0);
    this.camera.position.z = this.distance;
    const size = Math.max(0.065, 0.145 / Math.pow(Math.max(1, this.count / 80), 0.10));
    const projectionScale = this.height / (2 * Math.tan(THREE.MathUtils.degToRad(43 / 2)));
    this.material.uniforms.glyphSize.value = this.count === 1
      ? 48 * this.distance / projectionScale / this.scale
      : size;
    this.material.uniforms.time.value = t;
    this.material.uniforms.distance.value = this.distance;
    this.material.uniforms.scale.value = this.scale;
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
    return { camera: this.distance, renderedScale: this.scale, drawn: this.count, points,
      finite: this.positions.subarray(0, this.count * 3).every(Number.isFinite),
      drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles,
      renderer: 'instanced-planes', testYaw: this.testYaw };
  }
}
