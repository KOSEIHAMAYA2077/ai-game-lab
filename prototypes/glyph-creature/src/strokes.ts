import './strokes.css'
import { dampAngle } from './stroke-transition'

type Mode = 'write' | 'scatter' | 'flow' | 'gather'
type Point = { x: number; y: number; z: number }
type Stroke = {
  points: Point[]; home: Point; position: Point; rotation: Point
  seed: number; drift: Point; index: number; char: string
}
const supported = Array.from('あ花火永水字球')
const canvas = document.querySelector<HTMLCanvasElement>('#strokes-scene')!
const context = canvas.getContext('2d')!
const measure = document.querySelector<SVGSVGElement>('#stroke-measure')!
const form = document.querySelector<HTMLFormElement>('#stroke-form')!
const input = document.querySelector<HTMLInputElement>('#stroke-input')!
const status = document.querySelector<HTMLParagraphElement>('#stroke-status')!
const terminal = document.querySelector<HTMLElement>('#stroke-terminal')!
const cache = new Map<string, Point[][]>()
let strokes: Stroke[] = []
let mode: Mode = 'write'
let elapsed = 0
let modeStarted = 0
let writingStarted = 0
let paused = false
let loadVersion = 0
let characterCount = 2
let currentText = ''
let width = 0
let height = 0
let lastTime = performance.now()
let composition = false
const view = { scale: 0, centerY: 0 }
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
const descriptions: Record<Mode, string> = {
  write: '一画ずつ、書いています。', scatter: '線を一本ずつ、ほどいています。',
  flow: '一画ずつが、空間を巡っています。', gather: '元の文字へ、戻ります。',
}
const random = (min: number, max: number) => min + Math.random() * (max - min)

async function readStrokes(character: string): Promise<Point[][]> {
  const cached = cache.get(character)
  if (cached) return cached
  const filename = character.codePointAt(0)!.toString(16).padStart(5, '0')
  const response = await fetch(`${import.meta.env.BASE_URL}strokes/${filename}.svg`)
  if (!response.ok) throw new Error(`「${character}」の筆画データを読めませんでした。`)
  const document = new DOMParser().parseFromString(await response.text(), 'image/svg+xml')
  const paths = Array.from(document.getElementsByTagName('path'))
  if (!paths.length || document.querySelector('parsererror')) throw new Error('筆画データを読み直してください。')
  const segments = paths.map(source => {
    const path = window.document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', source.getAttribute('d')!)
    measure.append(path)
    const length = path.getTotalLength()
    const count = Math.max(8, Math.ceil(length / 1.3))
    const points = Array.from({ length: count + 1 }, (_, i) => {
      const point = path.getPointAtLength(length * i / count)
      return { x: point.x - 54.5, y: point.y - 54.5, z: 0 }
    })
    path.remove()
    return points
  })
  cache.set(character, segments)
  return segments
}

function setMode(next: Mode) {
  mode = next
  modeStarted = elapsed
  if (next === 'write') writingStarted = elapsed
  if (next === 'scatter') {
    for (const stroke of strokes) {
      stroke.seed = random(0, Math.PI * 2)
      const angle = random(0, Math.PI * 2)
      const radius = random(100, 230)
      stroke.drift = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * .62, z: random(-170, 180) }
    }
  }
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-motion]')) {
    button.setAttribute('aria-pressed', String(button.dataset.motion === next))
  }
  status.textContent = `${currentText} · ${strokes.length}画 · ${descriptions[next]}`
  canvas.dataset.mode = next
}

async function write(text: string) {
  const request = ++loadVersion
  const normalized = Array.from(text.normalize('NFC')).filter(char => !/\s/u.test(char))
  const unknown = [...new Set(normalized.filter(char => !supported.includes(char)))]
  const characters = normalized.filter(char => supported.includes(char)).slice(0, 6)
  if (!characters.length) {
    status.textContent = unknown.length ? `未収録：${unknown.join(' ')}。今は「あ 花 火 永 水 字 球」を試せます。` : '文字をひとつ、入れてみてください。'
    return
  }
  try {
    const shapes = await Promise.all(characters.map(readStrokes))
    if (request !== loadVersion) return
    const created: Stroke[] = []
    shapes.forEach((shape, charIndex) => {
      const offsetX = (charIndex - (characters.length - 1) / 2) * 138
      for (const points of shape) {
        const center = points.reduce((sum, p) => ({ x: sum.x + p.x / points.length, y: sum.y + p.y / points.length, z: 0 }), { x: 0, y: 0, z: 0 })
        const home = { x: center.x + offsetX, y: center.y, z: 0 }
        created.push({
          points: points.map(p => ({ x: p.x - center.x, y: p.y - center.y, z: 0 })),
          home, position: { ...home }, rotation: { x: 0, y: 0, z: 0 },
          seed: random(0, Math.PI * 2), drift: { x: 0, y: 0, z: 0 }, index: created.length, char: characters[charIndex],
        })
      }
    })
    strokes = created
    currentText = characters.join('')
    characterCount = characters.length
    canvas.dataset.text = currentText
    canvas.dataset.strokes = String(strokes.length)
    setMode('write')
    if (unknown.length) status.textContent += ` 未収録：${unknown.join(' ')}（表示から除外）。`
    if (normalized.filter(char => supported.includes(char)).length > 6) status.textContent += ' 先頭6文字を表示。'
  } catch (error) {
    if (request === loadVersion) status.textContent = error instanceof Error ? error.message : '読み込みに失敗しました。もう一度 enter。'
  }
}

function rotate(point: Point, rotation: Point): Point {
  const cx = Math.cos(rotation.x), sx = Math.sin(rotation.x)
  const cy = Math.cos(rotation.y), sy = Math.sin(rotation.y)
  const cz = Math.cos(rotation.z), sz = Math.sin(rotation.z)
  const y = point.y * cx - point.z * sx, z = point.y * sx + point.z * cx
  const x2 = point.x * cy + z * sy, z2 = -point.x * sy + z * cy
  return { x: x2 * cz - y * sz, y: x2 * sz + y * cz, z: z2 }
}

function targetFor(stroke: Stroke): { position: Point; rotation: Point } {
  const t = elapsed - modeStarted
  if (mode === 'scatter') {
    const drift = stroke.drift
    return {
      position: { x: drift.x + Math.sin(t * .3 + stroke.seed) * 15, y: drift.y + Math.cos(t * .37 + stroke.seed) * 12, z: drift.z },
      rotation: { x: Math.sin(stroke.seed + t * .18) * .8, y: stroke.seed + t * .16, z: stroke.seed * .5 + t * .12 },
    }
  }
  if (mode === 'flow') {
    const angle = stroke.index / Math.max(1, strokes.length) * Math.PI * 2 + elapsed * .3
    const layer = Math.sin(stroke.seed) * 34
    return {
      position: { x: Math.cos(angle) * (195 + layer), y: Math.sin(angle * 2 + elapsed * .2) * 65 + Math.cos(stroke.seed) * 16, z: Math.sin(angle) * (180 + layer) },
      rotation: { x: Math.sin(angle) * .6, y: -angle + Math.PI * .5, z: Math.sin(angle + stroke.seed) * .55 },
    }
  }
  return { position: stroke.home, rotation: { x: 0, y: 0, z: 0 } }
}

function resize() {
  width = innerWidth
  height = innerHeight
  const dpr = Math.min(devicePixelRatio || 1, 2)
  canvas.width = width * dpr
  canvas.height = height * dpr
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function render(dt: number) {
  context.fillStyle = '#000'
  context.fillRect(0, 0, width, height)
  const sceneBottom = terminal.getBoundingClientRect().top - 24
  const targetCenterY = 45 + Math.max(90, (sceneBottom - 45) * .5)
  const writingScale = Math.min(2.5, (width - 50) / Math.max(145, characterCount * 138), (sceneBottom - 60) / 150)
  const movingScale = Math.min(1.75, (width - 50) / 580, (sceneBottom - 65) / 370)
  const targetScale = Math.max(.1, mode === 'write' || mode === 'gather' ? writingScale : movingScale)
  const ease = paused ? 0 : 1 - Math.exp(-dt * 3.3)
  if (!view.scale) { view.scale = targetScale; view.centerY = targetCenterY }
  view.scale += (targetScale - view.scale) * ease
  view.centerY += (targetCenterY - view.centerY) * ease
  const { scale, centerY } = view
  // A mode change does not create unseen strokes; the initial writing keeps unfolding.
  const writeTime = reducedMotion ? 1000 : (elapsed - writingStarted) * Math.max(3, strokes.length / 3.5)
  const sorted = [...strokes].sort((a, b) => b.position.z - a.position.z)
  for (const stroke of sorted) {
    const target = targetFor(stroke)
    for (const axis of ['x', 'y', 'z'] as const) {
      stroke.position[axis] += (target.position[axis] - stroke.position[axis]) * ease
      stroke.rotation[axis] = dampAngle(stroke.rotation[axis], target.rotation[axis], ease)
    }
    const reveal = Math.max(0, Math.min(1, writeTime - stroke.index))
    if (reveal <= 0) continue
    const steps = Math.max(2, Math.ceil(stroke.points.length * reveal))
    context.beginPath()
    let cameraScale = 1
    for (let i = 0; i < steps; i++) {
      const point = rotate(stroke.points[i], stroke.rotation)
      const z = point.z + stroke.position.z
      cameraScale = 620 / Math.max(260, 620 + z)
      const x = width * .5 + (point.x + stroke.position.x) * scale * cameraScale
      const y = centerY + (point.y + stroke.position.y) * scale * cameraScale
      if (!i) context.moveTo(x, y)
      else context.lineTo(x, y)
    }
    context.lineWidth = Math.max(.7, 1.85 * scale * cameraScale)
    context.lineCap = 'round'
    context.lineJoin = 'round'
    context.strokeStyle = reveal < 1 ? '#ff956e' : `rgba(245,242,232,${Math.max(.33, Math.min(1, cameraScale * .8))})`
    context.stroke()
  }
}

function frame(now: number) {
  const dt = Math.min(.05, Math.max(0, (now - lastTime) / 1000))
  lastTime = now
  const activeDt = !paused && !document.hidden ? dt : 0
  elapsed += activeDt
  render(activeDt)
  requestAnimationFrame(frame)
}

form.addEventListener('submit', event => {
  event.preventDefault()
  if (!composition) void write(input.value)
})
input.addEventListener('compositionstart', () => { composition = true })
input.addEventListener('compositionend', () => { composition = false })
input.addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.isComposing || event.keyCode === 229 || composition)) event.preventDefault()
})
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-motion]')) {
  button.addEventListener('click', () => setMode(button.dataset.motion as Mode))
}
document.querySelector<HTMLButtonElement>('#stroke-pause')!.addEventListener('click', event => {
  paused = !paused
  const button = event.currentTarget as HTMLButtonElement
  button.textContent = paused ? '動かす' : 'とめる'
  button.setAttribute('aria-pressed', String(paused))
  canvas.dataset.paused = String(paused)
})
document.querySelector<HTMLButtonElement>('#stroke-help')!.addEventListener('click', event => {
  const guide = document.querySelector<HTMLElement>('#stroke-guide')!
  guide.hidden = !guide.hidden
  ;(event.currentTarget as HTMLButtonElement).setAttribute('aria-expanded', String(!guide.hidden))
})
for (const character of supported) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = character
  button.addEventListener('click', () => { input.value = character; void write(character) })
  document.querySelector('#stroke-examples')!.append(button)
}
window.addEventListener('resize', resize)
resize()
void write(input.value)
requestAnimationFrame(frame)

if (import.meta.env.DEV) {
  ;(window as any).__GLYPH_STROKES__ = {
    inspect: () => {
      const writeTime = reducedMotion ? 1000 : (elapsed - writingStarted) * Math.max(3, strokes.length / 3.5)
      return { text: currentText, mode, time: elapsed, paused, view: { ...view },
        strokes: strokes.map(stroke => ({ index: stroke.index, char: stroke.char, points: stroke.points.length,
          position: { ...stroke.position }, home: { ...stroke.home }, rotation: { ...stroke.rotation },
          reveal: Math.max(0, Math.min(1, writeTime - stroke.index)) })) }
    },
  }
}
