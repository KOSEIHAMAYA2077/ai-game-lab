/** Follow the closest equivalent orientation, even after many turns in a flow. */
export function dampAngle(current: number, target: number, amount: number): number {
  if (amount === 0) return current;
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const next = current + delta * amount;
  return Math.atan2(Math.sin(next), Math.cos(next));
}
