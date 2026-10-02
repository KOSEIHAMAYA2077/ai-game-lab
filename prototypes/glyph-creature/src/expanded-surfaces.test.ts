import { expect, it } from 'vitest';
import { EXPANDED_SHAPES, EXPANDED_GROUPS, EXPANDED_NAMES, EXPANDED_ALIASES } from './shape-catalog';
import { expandedSurface, expandedSurfacePoint, isExpandedSurface } from './expanded-surfaces';
import type { Vec3 } from './model';

it('38 authored forms have unique ids, names, groups and usable aliases', () => {
  expect(EXPANDED_SHAPES).toHaveLength(38);
  expect(new Set(EXPANDED_SHAPES).size).toBe(38);
  expect(EXPANDED_GROUPS.flatMap(g => [...g.shapes]).sort()).toEqual([...EXPANDED_SHAPES].sort());
  for(const shape of EXPANDED_SHAPES){expect(isExpandedSurface(shape)).toBe(true);expect(EXPANDED_NAMES[shape]).toBeTruthy();expect(EXPANDED_ALIASES[shape].length).toBeGreaterThan(1);}
  expect(isExpandedSurface('an unsupported shape')).toBe(false);
});

it('all parts stay bounded and supply usable tangents over long-time samples', () => {
  const du:Vec3=[0,0,0],dv:Vec3=[0,0,0];
  for(const shape of EXPANDED_SHAPES)for(const t of [0,17,600,3600])for(const seed of [0,1,927])for(let part=0;part<64;part++){
    const id=part+64*(part%3),p=expandedSurface(shape,id,t,seed,undefined,du,dv);
    expect(p.every(Number.isFinite), `${shape} ${id} ${t}`).toBe(true);
    expect(Math.max(...p.map(Math.abs)),shape).toBeLessThan(1.85);
    for(const axis of [du,dv]){expect(axis.every(Number.isFinite),shape).toBe(true);expect(Math.hypot(...axis),shape).toBeGreaterThan(1e-10);}
    const q=expandedSurface(shape,id,t+.0001,seed);
    expect(Math.hypot(...p.map((x,i)=>x-q[i])),shape).toBeLessThan(.005);
  }
});

it('periodic materials do not teleport at the seam and deterministically retain patch identities', () => {
  for(const shape of EXPANDED_SHAPES)for(const part of [0,12,25,43,60]){
    const p=expandedSurfacePoint(shape,.31,.47,23,part);
    expect(expandedSurface(shape,part,23,4)).toEqual(expandedSurface(shape,part,23,4));
    if(shape!=='wave'){
      const q=expandedSurfacePoint(shape,1.31,.47,23,part);
      expect(Math.hypot(...p.map((x,i)=>x-q[i])),shape).toBeLessThan(1e-9);
    }
  }
});

it('the new forms are not identical point clouds with different labels', () => {
  const signatures=EXPANDED_SHAPES.map(shape=>Array.from({length:64},(_,id)=>expandedSurface(shape,id,12,3).map(v=>v.toFixed(4)).join(',')).join(';'));
  expect(new Set(signatures).size).toBe(EXPANDED_SHAPES.length);
});

it('surface output/tangents can be reused without replacing caller storage', () => {
  const p:Vec3=[0,0,0],du:Vec3=[0,0,0],dv:Vec3=[0,0,0];
  for(const shape of EXPANDED_SHAPES)expect(expandedSurface(shape,8191,24,1,p,du,dv)).toBe(p);
});
