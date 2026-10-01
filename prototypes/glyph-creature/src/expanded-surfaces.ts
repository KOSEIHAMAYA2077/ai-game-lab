import type { Vec3 } from './model';
import { EXPANDED_SHAPES, type ExpandedShape } from './shape-catalog';
import { isRiggedCreature, skinCreaturePoint } from './creature-rig';

export const isExpandedSurface = (shape: string): shape is ExpandedShape => (EXPANDED_SHAPES as readonly string[]).includes(shape);
/** Only globally convex or star-shaped closed forms use the renderer's front-surface mask.
 * Open sheets and multipart/concave bodies retain their own local surface orientation. */
export const CLOSED_EXPANDED_SURFACES: readonly ExpandedShape[] = ['cone', 'cylinder', 'capsule', 'pyramid', 'diamond', 'octahedron', 'heart', 'egg', 'droplet', 'apple', 'pear', 'pumpkin', 'bottle', 'bell', 'lantern'];
const TAU = Math.PI * 2;
const fract = (x: number) => x - Math.floor(x);
const clamp = (x: number) => Math.max(.00001, Math.min(.99999, x));
const set = (out: Vec3, x: number, y: number, z: number): Vec3 => { out[0] = x; out[1] = y; out[2] = z; return out; };
const sq = (x: number) => x * x;
const CLOUD_PARTS = [[-.86,-.13,0,.50],[0,-.02,0,.72],[.83,-.13,0,.52],[-.42,.4,0,.52],[.38,.42,0,.46],[-.55,-.36,.13,.43],[.47,-.36,.08,.47],[0,-.36,-.15,.58]];
const BOLT_POINTS: readonly (readonly [number,number])[] = [[.12,1.35],[-.65,-.10],[-.06,-.10],[-.29,-1.35],[.66,.22],[.10,.22]];
const BOLT_TRIANGLES = [[0,1,2],[0,2,5],[2,3,4],[2,4,5]];
const BIRD_WING: readonly (readonly [number,number])[] = [[.18,.23],[1.42,.52],[.55,-.25]];
const BIRD_TAIL: readonly (readonly [number,number])[] = [[-.19,-.49],[.19,-.49],[0,-1.01]];
const FISH_TAIL: readonly (readonly [number,number])[] = [[-.68,0],[-1.36,.64],[-1.36,-.64]];
function ellipsoid(u: number, v: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, out: Vec3): Vec3 {
  const a = TAU * u, b = Math.acos(1 - 2 * v), r = Math.sin(b);
  return set(out, x + rx * r * Math.cos(a), y + ry * Math.cos(b), z + rz * r * Math.sin(a));
}
function tube(u: number, v: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, radius: number, out: Vec3): Vec3 {
  const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0, n = Math.hypot(dx, dy, dz);
  const bx = Math.abs(dy / n) < .9 ? -dz : dy, by = Math.abs(dy / n) < .9 ? 0 : -dx, bz = Math.abs(dy / n) < .9 ? dx : 0;
  const bn = Math.hypot(bx, by, bz), ax = bx / bn, ay = by / bn, az = bz / bn;
  const cx = (dy * az - dz * ay) / n, cy = (dz * ax - dx * az) / n, cz = (dx * ay - dy * ax) / n;
  const a = u * TAU, c = radius * Math.cos(a), s = radius * Math.sin(a);
  return set(out, x0 + dx * v + c * ax + s * cx, y0 + dy * v + c * ay + s * cy, z0 + dz * v + c * az + s * cz);
}
function torus(u: number, v: number, r: number, thickness: number, out: Vec3): Vec3 {
  const a = u * TAU, b = v * TAU, rr = r + thickness * Math.cos(b);
  return set(out, rr * Math.cos(a), rr * Math.sin(a), thickness * Math.sin(b));
}
function pointedLeaf(u: number, v: number, radius: number, height: number, depth: number, out: Vec3): Vec3 {
  const b = Math.PI * v, r = Math.sin(b), a = u * TAU;
  return set(out, radius * r * Math.cos(a), height * Math.cos(b), depth * r * Math.sin(a) + .16 * Math.sin(b * 2));
}
function trianglePatch(a: readonly [number,number], b: readonly [number,number], c: readonly [number,number], u: number, v: number, z: number, out: Vec3): Vec3 {
  const q=fract(u)*3, i=Math.floor(q), f=q-i, p=i===0?a:i===1?b:c, next=i===0?b:i===1?c:a;
  const cx=(a[0]+b[0]+c[0])/3, cy=(a[1]+b[1]+c[1])/3, r=Math.sqrt(v);
  return set(out,cx+(p[0]+(next[0]-p[0])*f-cx)*r,cy+(p[1]+(next[1]-p[1])*f-cy)*r,z);
}
function revolved(u: number, v: number, radius: number, y: number, out: Vec3): Vec3 {
  const a = u * TAU;
  return set(out, radius * Math.cos(a), y, radius * Math.sin(a));
}
/** Periodic u, bounded v, stable part: input letters never jump between disconnected parts. */
function authoredSurfacePoint(shape: ExpandedShape, u: number, v: number, t: number, part: number, out: Vec3 = [0, 0, 0]): Vec3 {
  const a = u * TAU, c = Math.cos(a), s = Math.sin(a), b = Math.PI * v, part64 = part % 64;
  if (shape === 'cone' || shape === 'cylinder') {
    if (part64 < 48) return revolved(u, v, shape === 'cone' ? 1.04 * Math.sqrt(v) : .86, 1.25 - 2.5 * (shape === 'cone' ? Math.sqrt(v) : v), out);
    const top = shape === 'cylinder' && part64 >= 56;
    return revolved(u, v, (shape === 'cone' ? 1.04 : .86) * Math.sqrt(v), top ? 1.25 : -1.25, out);
  }
  if (shape === 'capsule') {
    const y = 1 - 2 * v, r = Math.sqrt(1 - y * y);
    return set(out, .65 * r * c, .65 * y + .65 * Math.tanh(y * 6), .65 * r * s);
  }
  if (shape === 'pyramid' || shape === 'octahedron' || shape === 'diamond') {
    // Intersect a spherical ray with planar half-spaces. Closed, with visible flat facets.
    const y = 1 - 2 * v, r = Math.sqrt(1 - y * y), x = r * c, z = r * s;
    if (shape === 'octahedron') { const f = 1.28 / (Math.abs(x) + Math.abs(y) + Math.abs(z)); return set(out, x * f, y * f, z * f); }
    if (shape === 'pyramid') {
      const f = 1 / Math.max(Math.abs(x) + y * .58, Math.abs(z) + y * .58, -y * 1.05);
      return set(out, x * f, y * f * .86 - .15, z * f);
    }
    let edge = 0; for (let k = 0; k < 8; k++) edge = Math.max(edge, x * Math.cos(k * TAU / 8) + z * Math.sin(k * TAU / 8));
    const f = 1 / Math.max(edge + Math.max(y, 0) * .60, edge - Math.min(y, 0) * .85, y * 1.9);
    return set(out, x * f, y * f, z * f);
  }
  if (shape === 'heart') {
    const h = 1 - 2 * v, r = Math.sqrt(1 - h * h);
    return set(out, 1.15 * s ** 3 * r, (13 * c - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) / 15 * r, .30 * h);
  }
  if (shape === 'egg' || shape === 'droplet' || shape === 'pear') {
    const y = 1 - 2 * v, rr = Math.sqrt(1 - y * y);
    const r = shape === 'egg' ? rr * (.78 - .17 * y) : shape === 'pear' ? rr * (.29 + .64 / (1 + Math.exp((y-.02)*8))) : Math.sin(Math.PI*v) * (.39+.82*v);
    return set(out, r * c, y * (shape === 'egg' ? 1.15 : 1.35), r * s);
  }
  if (shape === 'moon') {
    // A tapered curved solid crescent, with a genuinely empty inner crescent.
    const q = -.12 * Math.PI + 1.24 * Math.PI * v, taper = Math.sin(Math.PI * v) ** .7;
    const radius = .20 * taper, x = .15 + .91 * Math.cos(q), y = 1.12 * Math.sin(q);
    return set(out, -(y + radius * c * Math.sin(q)), x + radius * c * Math.cos(q), .31 * taper * s);
  }
  if (shape === 'cloud') {
    const i = Math.floor(part64 / 8);
    const [x,y,z,r] = CLOUD_PARTS[i]; return ellipsoid(u,v,x,y,z,r,r*.82,r*.74,out);
  }
  if (shape === 'mushroom') {
    if (part64 < 44) { const y = 1 - v, r = 1.17 * Math.sqrt(1 - y*y); return set(out,r*c,.15+.88*y,r*s); }
    if (part64 < 52) return revolved(u,v,1.17*Math.sqrt(v),.15-.09*Math.sqrt(v),out);
    const r=.22+.07*Math.sin(b); return revolved(u,v,r,.17-1.44*v,out);
  }
  if (shape === 'leaf') { pointedLeaf(u,v,.67,1.35,.075,out); out[0]*=Math.sin(b)**.70; return out; }
  if (shape === 'apple' || shape === 'pumpkin') {
    if (part64 >= 60) return tube(u,v,0,.85,0,.12,1.25,.05,.075,out);
    const y=1-2*v, rr=Math.sqrt(1-y*y), lobes=shape==='pumpkin' ? 1+.10*Math.cos(8*a) : 1+.035*Math.cos(5*a);
    const r=rr*(shape==='pumpkin'?1.11:.98)*lobes, yy=y*(shape==='pumpkin'?.81:.94)*(1-.13*Math.exp(-sq(rr/.28)));
    return set(out,r*c,yy,r*s);
  }
  if (shape === 'shell') {
    const q=v*TAU*2.15, centerRadius=.055+.69*v, tubeR=.035+.29*v;
    const rr=centerRadius+tubeR*c;
    return set(out,rr*Math.cos(q),rr*Math.sin(q),tubeR*s+.34*(v-.5));
  }
  if (shape === 'fish') {
    if(part64<45) return ellipsoid(u,v,.1,0,0,.94,.45,.29,out);
    if(part64<58) return trianglePatch(FISH_TAIL[0],FISH_TAIL[1],FISH_TAIL[2],u,v,part64%2?.055:-.055,out);
    return set(out,.15-.65*v,.33+.43*Math.sin(b)*Math.abs(c),.065*s*Math.sin(b));
  }
  if (shape === 'bird') {
    if(part64<16) return ellipsoid(u,v,0,-.03,0,.27,.58,.25,out);
    if(part64<24) return ellipsoid(u,v,0,.61,0,.23,.25,.23,out);
    if(part64<28) return set(out,.075*c*(1-v),.66+.075*s*(1-v),.22+.31*v);
    if(part64>=58) return trianglePatch(BIRD_TAIL[0],BIRD_TAIL[1],BIRD_TAIL[2],u,v,part64%2?.047:-.047,out);
    const side=part64%2?1:-1, flap=.12*Math.sin(t*.19);
    trianglePatch(BIRD_WING[0],BIRD_WING[1],BIRD_WING[2],u,v,.05*Math.sin(a),out);
    out[2]+=flap*(out[0]-.18);out[0]*=side;return out;
  }
  if (shape === 'snake') {
    if(part64>=58) return ellipsoid(u,v,.49,1.14,.08,.28,.20,.23,out);
    const q=v*TAU*1.3, radius=.115+.035*(1-v), wave=.08*Math.sin(t*.13);
    return set(out,.51*Math.cos(q)+radius*c,1.1-2.30*v,.18*Math.sin(q+wave)+radius*s);
  }
  if (shape === 'turtle') {
    if(part64<38) ellipsoid(u,v,0,.02,0,.82,.35,1.02,out);
    else if(part64<46) ellipsoid(u,v,0,0,1.12,.23,.18,.37,out);
    else if(part64<62) { const i=Math.floor((part64-46)/4), side=i%2?1:-1, front=i<2?1:-1;ellipsoid(u,v,side*.78,-.10,front*.59,.39,.12,.23,out); }
    else tube(u,v,0,0,-.88,0,-.04,-1.30,.07*(1-v)+.012,out);
    const y=out[1],z=out[2];out[1]=y*Math.cos(.75)+z*Math.sin(.75);out[2]=-y*Math.sin(.75)+z*Math.cos(.75);return out;
  }
  if (shape === 'spider') {
    if(part64<16) return ellipsoid(u,v,0,.18,0,.49,.59,.35,out);
    if(part64<24) return ellipsoid(u,v,0,-.43,0,.31,.31,.28,out);
    const leg=Math.floor((part64-24)/5), side=leg%2?1:-1, row=Math.floor(leg/2), q=.83-.53*row;
    const bend=Math.sin(Math.PI*v), x=side*(.26+1.02*v), y=q+(.60-row*.42)*bend-.35*v;
    return set(out,x+.035*c,y+.035*s,.14*bend);
  }
  if (shape === 'rose' && part64 >= 48) {
    if(part64<56) return tube(u,v,.025,-.16,0,-.035,-1.43,.02,.041,out);
    const side=part64<60?-1:1;
    pointedLeaf(u,v,.17,.43,.043,out);
    const x=out[0],y=out[1],tilt=.91;
    out[0]=side*(.29+x*Math.cos(tilt)+y*Math.sin(tilt));
    out[1]=-.75-x*Math.sin(tilt)+y*Math.cos(tilt);out[2]+=.018;
    return out;
  }
  if (shape === 'lotus' || shape === 'rose') {
    const petal=part64%16, layer=petal<8?0:1, angle=(petal%8)*TAU/8+layer*.39+(shape==='rose'?layer*.31:0);
    const h=1-2*v, rr=Math.sqrt(1-h*h), open=shape==='lotus'?1:.59;
    const along=(.20+(1-h)*.49)*open, width=(shape==='lotus'?.34:.40)*rr*c;
    const y=shape==='lotus'?-.30+along*.49+.33*sq(h):-.49+1.11*v+.22*layer;
    const radial=along*(1-layer*.28)+(shape==='rose'?.22*Math.sin(b):0);
    set(out,radial*Math.cos(angle)+width*Math.sin(angle),y+.09*rr*s,radial*Math.sin(angle)-width*Math.cos(angle));
    if(shape==='rose'){const yy=out[1],zz=out[2];out[0]*=.78;out[1]=.43+.78*(zz*.96+yy*.28);out[2]=.78*(-yy*.96+zz*.28);}
    return out;
  }
  if (shape === 'sun') {
    if(part64<32) return ellipsoid(u,v,0,0,0,.69,.69,.48,out);
    const ray=Math.floor((part64-32)/2), angle=ray*TAU/16+.035*Math.sin(t*.08), r=.70+.58*v;
    const w=.13*(1-v)+.014;return set(out,r*Math.cos(angle)+w*c*Math.sin(angle),r*Math.sin(angle)-w*c*Math.cos(angle),w*s);
  }
  if (shape === 'snowflake') {
    const arm=part64%6, branch=Math.floor(part64/6)%5, angle=arm*TAU/6;
    const base=branch===0?0:branch<3?.50:.83, side=branch%2?1:-1, len=branch===0?1.24:.34;
    const aa=angle+(branch===0?0:side*Math.PI/3), x0=base*Math.cos(angle), y0=base*Math.sin(angle);
    return tube(u,v,x0,y0,0,x0+len*Math.cos(aa),y0+len*Math.sin(aa),0,.052,out);
  }
  if (shape === 'gear') {
    const q=v*TAU, tooth=1+.13*Math.tanh(Math.cos(12*a)*4), r=(.87+.24*Math.cos(q))*tooth;
    return set(out,r*c,r*s,.22*Math.sin(q));
  }
  if (shape === 'bolt') {
    const tri=BOLT_TRIANGLES[part64%4];
    return trianglePatch(BOLT_POINTS[tri[0]],BOLT_POINTS[tri[1]],BOLT_POINTS[tri[2]],u,v,part64<32?.075:-.075,out);
  }
  if (shape === 'bottle') {
    const y=1.30-2.6*v, neck=.29, body=.66, r=neck+(body-neck)/(1+Math.exp(-(v-.32)*28));
    if(part64>=60) return revolved(u,v,body*Math.sqrt(v),-1.30,out);
    return revolved(u,v,r*(1+.05*Math.exp(-sq((v-.055)/.04))),y,out);
  }
  if (shape === 'cup') {
    if(part64<44) return revolved(u,v,.68+.12*(1-v),.78-1.57*v,out);
    if(part64<52) return revolved(u,v,.68*Math.sqrt(v),-.79,out);
    const q=TAU*v, r=.41+.12*c;return set(out,.77+r*Math.cos(q),r*Math.sin(q),.12*s);
  }
  if (shape === 'teapot') {
    if(part64<37) return ellipsoid(u,v,0,-.15,0,.77,.68,.65,out);
    if(part64<43) {const r=.45*Math.sqrt(v);return set(out,r*c,.51-.09*v,r*s);}
    if(part64<46) return ellipsoid(u,v,0,.62,0,.13,.14,.13,out);
    if(part64<56) {const q=-1.15+2.30*v,r=.51+.095*c;return set(out,-.73-r*Math.cos(q),-.08+r*Math.sin(q),.095*s);}
    const r=.20-.115*v,x=.57+.78*v,y=-.04+.30*v+.30*v*v;
    return set(out,x+r*c*.50,y+r*s,r*c*.87);
  }
  if (shape === 'umbrella') {
    if(part64<49) {const r=1.19*Math.sqrt(v),y=.99-.72*sq(r/1.19)-.065*(1-Math.cos(8*a))*v;return set(out,r*c,y,r*s);}
    if(part64<59) return tube(u,v,0,.96,0,0,-1.03,0,.045,out);
    const q=v*Math.PI,r=.20+.047*c;return set(out,.20-r*Math.cos(q),-1.03-r*Math.sin(q),.047*s);
  }
  if (shape === 'bell') {
    if(part64>=57) return ellipsoid(u,v,0,-.93,0,.19,.25,.19,out);
    const r=.15+.39*Math.sin(b*.63)+.51*v**5;return revolved(u,v,r,1.13-2.12*v,out);
  }
  if (shape === 'lantern') {
    if(part64<52) {const y=1-2*v,r=(.42+.49*Math.sin(b))*(1+.022*Math.cos(12*a));return set(out,r*c,.96*y,r*s);}
    if(part64<60) return revolved(u,v,.45*Math.sqrt(v),part64<56?1.00:-1.00,out);
    const q=v*Math.PI;return set(out,.24*Math.cos(q),1.01+.24*Math.sin(q),.037*c);
  }
  if (shape === 'crown') {
    const r=.84+.19*v, top=.54+.39*(.5+.5*Math.cos(7*a))**3, y=-.64+v*(top+.64);
    return set(out,r*c,y,r*s);
  }
  if (shape === 'knot') {
    const q=u*TAU, f=2+Math.cos(3*q), x=.43*f*Math.cos(2*q), y=.43*f*Math.sin(2*q), z=.43*Math.sin(3*q);
    // Analytic tangent to a trefoil; a local normal plane keeps the tube round.
    const dx=.43*(-3*Math.sin(3*q)*Math.cos(2*q)-2*f*Math.sin(2*q)),dy=.43*(-3*Math.sin(3*q)*Math.sin(2*q)+2*f*Math.cos(2*q));
    const n=Math.hypot(dx,dy), nx=-dy/n,ny=dx/n, dz=1.29*Math.cos(3*q), tn=Math.hypot(n,dz), bx=-dz*ny/tn,by=dz*nx/tn,bz=n/tn;
    const cc=.15*Math.cos(v*TAU),ss=.15*Math.sin(v*TAU);
    return set(out,x+cc*nx+ss*bx,y+cc*ny+ss*by,z+ss*bz);
  }
  if (shape === 'wave') {
    // A continuous curling sheet; the inner crest curls over instead of orbiting a sphere.
    const q=.20+v*1.48*Math.PI, r=.91-.47*v, xx=(2*fract(u)-1)*1.25;
    return set(out,xx,-.12+r*Math.sin(q)+.13*Math.sin(xx*2+t*.14),.18+r*Math.cos(q));
  }
  if (shape === 'ribbon') {
    const side=part64%2?1:-1;
    if(part64<48) {const q=v*TAU, r=.51+.15*c;return set(out,side*(.48+r*Math.cos(q)),r*.80*Math.sin(q),.15*s+.11*Math.sin(q));}
    const w=2*v-1,x=side*(.13+.34*(1+c)),y=-.15-.92*(1+c)/2;
    return set(out,x+w*.14,y+.08*Math.sin(a*2+t*.11),.16*s);
  }
  return out;
}
export function expandedSurfacePoint(shape: ExpandedShape, u: number, v: number, t: number, part: number, out: Vec3 = [0, 0, 0]): Vec3 {
  authoredSurfacePoint(shape, u, v, isRiggedCreature(shape) ? 0 : t, part, out);
  return isRiggedCreature(shape) ? skinCreaturePoint(shape, part % 64, v, t, out) : out;
}
const dx: Vec3 = [0,0,0], dy: Vec3 = [0,0,0];
export function expandedSurface(shape: ExpandedShape, id: number, time: number, seed: number, out: Vec3 = [0,0,0], du?: Vec3, dv?: Vec3): Vec3 {
  const aa=fract((id+seed*.13)*.618033988749895),bb=fract((id+seed*.27)*.754877666246693),part=id%64;
  // Sheets with an open longitudinal seam oscillate rather than wrapping through it.
  const u=shape==='wave'?clamp(aa+.055*Math.sin(Math.PI*aa)*Math.sin(time*.09+bb*TAU)) : aa+time*.018+.045*Math.sin(bb*TAU+time*.071+seed);
  const v=clamp(bb+.055*Math.sin(Math.PI*bb)*Math.sin(aa*TAU+time*.083+seed*.3));
  expandedSurfacePoint(shape,u,v,time,part,out);
  if(du||dv){const h=.00001;
    if(du){expandedSurfacePoint(shape,u+h,v,time,part,dx);expandedSurfacePoint(shape,u-h,v,time,part,dy);for(let k=0;k<3;k++)du[k]=(dx[k]-dy[k])/(2*h);}
    if(dv){expandedSurfacePoint(shape,u,v+h,time,part,dx);expandedSurfacePoint(shape,u,v-h,time,part,dy);for(let k=0;k<3;k++)dv[k]=(dx[k]-dy[k])/(2*h);}
    // Parametric tips and overlapping patch boundaries have no unique tangent. A local
    // finite fallback prevents a single seed at such a point from poisoning the scene.
    if(du && Math.hypot(...du)<1e-9){du[0]=1;du[1]=0;du[2]=0;}
    if(dv && Math.hypot(...dv)<1e-9){dv[0]=0;dv[1]=1;dv[2]=0;}
  }
  return out;
}
