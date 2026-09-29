import { expect, test, type Page } from '@playwright/test';

type Point = { x: number; y: number; z: number };
type Stroke = { index: number; char: string; points: number; home: Point; position: Point; rotation: Point; reveal: number };
type State = { text: string; mode: string; time: number; paused: boolean; view: { scale: number; centerY: number }; strokes: Stroke[] };
const inspect = (page: Page): Promise<State> => page.evaluate(() => (window as any).__GLYPH_STROKES__.inspect());
const axes = ['x', 'y', 'z'] as const;
// The page clock is paused between samples. Force skips a stability wait for two frozen RAFs,
// while still using the browser's click action and the actual button event handlers.
const mode = (page: Page, name: string) => page.locator(`[data-motion="${name}"]`).click({ force: true });
const errors = new WeakMap<Page, string[]>();
const identities = (state: State) => state.strokes.map(({ index, char, points, home }) => ({ index, char, points, home }));

function quaternion(rotation: Point): number[] {
  const cx = Math.cos(rotation.x / 2), sx = Math.sin(rotation.x / 2);
  const cy = Math.cos(rotation.y / 2), sy = Math.sin(rotation.y / 2);
  const cz = Math.cos(rotation.z / 2), sz = Math.sin(rotation.z / 2);
  // The canvas applies x, then y, then z rotations: qz * qy * qx.
  return [cz * cy * sx - sz * sy * cx, cz * sy * cx + sz * cy * sx,
    sz * cy * cx - cz * sy * sx, cz * cy * cx + sz * sy * sx];
}
function angularDistance(a: Point, b: Point) {
  const qa = quaternion(a), qb = quaternion(b);
  const dot = Math.abs(qa.reduce((sum, value, i) => sum + value * qb[i], 0));
  return 2 * Math.acos(Math.min(1, dot));
}

test.beforeEach(async ({ page }) => {
  const messages: string[] = []; errors.set(page, messages);
  page.on('pageerror', error => messages.push(error.message));
  await page.clock.install({ time: new Date('2030-01-01T00:00:00Z') });
  await page.clock.pauseAt(new Date('2030-01-01T00:00:01Z'));
  await page.goto('/strokes.html');
  await expect(page.locator('#strokes-scene')).toHaveAttribute('data-strokes', '11');
  await page.clock.runFor(32);
  expect((await inspect(page)).text).toBe('花火');
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });

test('筆画の画角: ほどく/戻すで一瞬の拡縮をせず、現在の尺度から移る', async ({ page }) => {
  await page.clock.runFor(5000);
  const written = await inspect(page);
  await mode(page, 'scatter');
  const immediate = await inspect(page);
  expect(immediate.view).toEqual(written.view);
  await page.clock.runFor(16);
  const first = await inspect(page);
  expect(Math.abs(first.view.scale - written.view.scale)).toBeLessThan(written.view.scale * .06);
  await page.clock.runFor(1600);
  const scattered = await inspect(page);
  expect(scattered.view.scale).toBeLessThan(written.view.scale * .8);
  await mode(page, 'gather');
  expect((await inspect(page)).view).toEqual(scattered.view);
  await page.clock.runFor(16);
  expect(Math.abs((await inspect(page)).view.scale - scattered.view.scale)).toBeLessThan(written.view.scale * .06);
  await page.clock.runFor(2000);
  const gathered = await inspect(page);
  expect(gathered.view.scale).toBeCloseTo(written.view.scale, 2);
  expect(identities(gathered)).toEqual(identities(written));
});

test('筆画の帰還: 60秒流しても戻す回転は一周未満で、同じ11画が元字へ帰る', async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.runFor(4000);
  await mode(page, 'flow');
  await page.clock.runFor(60_000);
  let previous = await inspect(page);
  expect(previous.time).toBeGreaterThan(63);
  const original = identities(previous), rotationTravel = previous.strokes.map(() => 0);
  await mode(page, 'gather');
  // Samples are 32 ms apart; even the old long-angle rewind cannot hide a full turn
  // between these samples after this 60-second flow.
  for (let step = 0; step < 125; step++) {
    await page.clock.runFor(32);
    const current = await inspect(page);
    current.strokes.forEach((stroke, i) => {
      rotationTravel[i] += angularDistance(previous.strokes[i].rotation, stroke.rotation);
    });
    previous = current;
  }
  expect(Math.max(...rotationTravel)).toBeLessThan(Math.PI * 2);
  expect(identities(previous)).toEqual(original);
  for (const stroke of previous.strokes) for (const axis of axes) {
    expect(Math.abs(stroke.position[axis] - stroke.home[axis])).toBeLessThan(.002);
    expect(Math.abs(stroke.rotation[axis])).toBeLessThan(.001);
  }
  expect(previous.strokes.every(stroke => stroke.reveal === 1)).toBe(true);
});

test('筆画の途中操作: 書きかけをほどいても未描画の画が一度に増えない', async ({ page }) => {
  await page.clock.runFor(550);
  const writing = await inspect(page);
  const visible = writing.strokes.filter(stroke => stroke.reveal > 0).length;
  expect(visible).toBeGreaterThan(0); expect(visible).toBeLessThan(4);
  const before = writing.strokes.map(stroke => stroke.reveal);
  await mode(page, 'scatter');
  expect((await inspect(page)).strokes.map(stroke => stroke.reveal)).toEqual(before);
  await page.clock.runFor(16);
  const after = await inspect(page);
  const revealIncrease = after.strokes.reduce((sum, stroke, i) => sum + stroke.reveal - before[i], 0);
  expect(revealIncrease).toBeLessThan(.1);
  await mode(page, 'gather');
  expect((await inspect(page)).strokes.map(stroke => stroke.reveal)).toEqual(after.strokes.map(stroke => stroke.reveal));
  await page.clock.runFor(5000);
  const completed = await inspect(page);
  expect(completed.strokes.every(stroke => stroke.reveal === 1)).toBe(true);
  expect(identities(completed)).toEqual(identities(writing));
});

test('筆画の停止: 時計・位置・回転・描画量・画角が止まり、再開後に続く', async ({ page }) => {
  await page.clock.runFor(4000);
  await mode(page, 'flow');
  await page.clock.runFor(3000);
  await page.locator('#stroke-pause').click({ force: true });
  const before = await inspect(page);
  expect(before.paused).toBe(true);
  await page.clock.runFor(4000);
  const frozen = await inspect(page);
  expect(frozen.time).toBe(before.time);
  expect(frozen.view).toEqual(before.view);
  frozen.strokes.forEach((stroke, i) => {
    expect(stroke.reveal).toBe(before.strokes[i].reveal);
    for (const axis of axes) {
      expect(stroke.position[axis]).toBeCloseTo(before.strokes[i].position[axis], 12);
      expect(stroke.rotation[axis]).toBeCloseTo(before.strokes[i].rotation[axis], 12);
    }
  });
  await page.locator('#stroke-pause').click({ force: true });
  await page.clock.runFor(1000);
  const resumed = await inspect(page);
  expect(resumed.time - frozen.time).toBeGreaterThan(.9);
  expect(resumed.strokes[0].position).not.toEqual(frozen.strokes[0].position);
});
