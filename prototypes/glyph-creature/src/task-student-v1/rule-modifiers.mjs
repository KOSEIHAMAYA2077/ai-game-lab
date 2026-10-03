/** Explicit whole-body baseline; intrinsic body parts are not global commands. */
export function ruleAttributes(text) {
  const length=/全体.{0,6}(?:短く|縮め)|縦.{0,6}(?:短く|縮め)|背を低く/u.test(text)?'short':/全体.{0,6}(?:長く|伸ば)|縦.{0,6}(?:長く|伸ば)|背を高く/u.test(text)?'long':'neutral';
  const width=/全体.{0,6}(?:細く|狭く)|横.{0,6}(?:細く|狭く)|幅.{0,6}(?:細く|狭く)/u.test(text)?'narrow':/全体.{0,6}(?:太く|広く)|横.{0,6}(?:太く|広く)|幅.{0,6}(?:太く|広く)/u.test(text)?'wide':'neutral';
  const bend=/全体.{0,6}(?:曲げ|曲が)|全身.{0,6}(?:曲げ|曲が)|湾曲させ/u.test(text)?'curved':'straight';
  return {length,width,bend};
}
