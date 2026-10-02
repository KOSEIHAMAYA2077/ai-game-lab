/** Independent checks of actual sampled surfaces, rather than bounding-box overlap. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const directory = path.dirname(new URL(import.meta.url).pathname);
const root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'prototypes/glyph-creature/package.json'));
const geometryFile = path.join(root, 'prototypes/glyph-creature/src/scaffold-program.ts');
const source = fs.readFileSync(geometryFile, 'utf8');
const digest = crypto.createHash('sha256').update(source).digest('hex');
const { compileScaffoldProgram, compiledPartSurfacePoint, programPartSurface } = await import(pathToFileURL(geometryFile).href);
const dist = (a,b) => Math.hypot(...a.map((x,k)=>x-b[k]));
const fixtureFiles = ['fixture.json', 'same-type-fixture.json', 'followup-fixture.json'];
const inputFile = process.argv[2] ?? 'initial-cpu.json';
const outputFile = process.argv[3] ?? 'initial-geometry.json';
if (fs.existsSync(path.join(directory, outputFile))) throw new Error('Refusing to overwrite an evaluation result');
const input = JSON.parse(fs.readFileSync(path.join(directory,inputFile), 'utf8'));
const inputRows = new Map((input.rows ?? input.fixtures.flatMap(f=>f.rows)).map(row=>[row.id,row]));
function implicit(compiled, partIndex, point) {
  const part=compiled.parts[partIndex], s=part.effective;
  if (!['sphere','box'].includes(s.primitive) || Math.abs(s.bend)>1e-12) return null;
  const world=point.map((x,k)=>x/compiled.scale-compiled.translation[k]-part.rawPosition[k]);
  const local=part.basis.map(axis=>axis.reduce((sum,x,k)=>sum+x*world[k],0));
  const exponent=s.primitive==='sphere'?2:12;
  // In this revision twist adds to the section parameter before radii/norm.
  // Over all around values this is a reparameterization, not physical section rotation.
  return Math.abs(local[0]/s.width)**exponent+Math.abs(local[1]/s.height)**exponent+Math.abs(local[2]/s.depth)**exponent;
}
function assess(program) {
  const begin=performance.now(), compiled=compileScaffoldProgram(program), compileMs=performance.now()-begin;
  if (!compiled) return { compileAccepted:false,compileMs,reason:'compiler-rejects-relation-or-contract' };
  const clouds=compiled.parts.map((part,index)=>Array.from({length:2048},(_,id)=>programPartSurface(compiled,index,id,0,731)));
  const finite=clouds.every(points=>points.every(p=>p.every(Number.isFinite)));
  const row={compileAccepted:true,compileMs,finiteSurface:finite,compiled:{scale:compiled.scale,bounds:compiled.bounds,adjustments:compiled.adjustments,parts:compiled.parts.map(p=>({source:p.source,effective:p.effective,anchors:p.anchors,position:p.position,centerlineKind:p.centerline.kind,profile:p.profile.kind}))}};
  if (compiled.relation?.kind==='through') {
    const values=clouds[1].map(point=>implicit(compiled,0,point));
    if (values.some(v=>v===null)) row.intersection={tested:false,reason:'analytic-parent-only-zero-bend-sphere-or-superellipsoid'};
    else {
      const inside=values.filter(v=>v<1-1e-5).length, outside=values.filter(v=>v>1+1e-5).length;
      row.intersection={tested:true,sampledChildSurfacePoints:values.length,insideParent:inside,outsideParent:outside,minImplicit:Math.min(...values),maxImplicit:Math.max(...values),surfaceCrossesParent:inside>0&&outside>0};
    }
  }
  if (compiled.relation?.kind==='above') {
    row.contact={kind:'actual-top-bottom-material-contact',atTimes:[0,30].map(time=>{
      const a=compiled.parts[0].anchorCharts.top,b=compiled.parts[1].anchorCharts.bottom;
      const p=compiledPartSurfacePoint(compiled,0,a.around,a.along,time,a.chart),q=compiledPartSurfacePoint(compiled,1,b.around,b.along,time,b.chart);
      return {time,distance:dist(p,q),pass:dist(p,q)<1e-7};
    }),childCenterAboveParent:compiled.parts[1].anchors.center[1]>compiled.parts[0].anchors.center[1]};
  }
  if (compiled.relation?.kind==='end') {
    row.attachment={centerlineEndpointDistance:dist(compiled.parts[0].anchors.end,compiled.parts[1].anchors.start),pass:dist(compiled.parts[0].anchors.end,compiled.parts[1].anchors.start)<1e-7,scope:'Endpoint arrangement only. Does not prove watertight material contact for every primitive combination.'};
    // Parent endpoint must at least lie inside/on the child where a known analytic solid is available.
    const value=implicit(compiled,1,compiled.parts[0].anchors.end);
    if(value!==null)row.attachment.childImplicitAtParentTip={value,insideOrBoundary:value<=1+1e-6};
  }
  return row;
}
function nominal(expected) {
  const parts=expected.parts.map((p,i)=>{
    const values={id:String(i),primitive:p.primitive,height:1,width:1,depth:1,bend:0,twist:0};
    for(const [key,c]of Object.entries(p.attributes??{})) values[key]='min'in c?Math.max(1.4,c.min):'max'in c?Math.min(.6,c.max):c.minAbs??0;
    return values;
  });
  return {version:1,parts,...(expected.relation?{relation:{kind:expected.relation,parent:'0',child:'1'}}:{})};
}
const rows=[];
for(const file of fixtureFiles){const fixture=JSON.parse(fs.readFileSync(path.join(directory,file),'utf8'));for(const c of fixture.cases){if(!c.expected)continue;const actual=inputRows.get(c.id)?.output?.program;rows.push({id:c.id,modelMeaningPass:inputRows.get(c.id)?.meaningPass??null,modelDerived:actual?assess(actual):null,expectedNominal:assess(nominal(c.expected))});}}
const groups={};
for(const key of ['modelDerived','expectedNominal']){
 const data=rows.map(r=>r[key]).filter(Boolean),contacts=data.filter(r=>r.contact),intersection=data.filter(r=>r.intersection?.tested),endpoints=data.filter(r=>r.attachment);
 groups[key]={requested: data.length,compileAccepted:data.filter(r=>r.compileAccepted).length,finiteSurface:data.filter(r=>r.finiteSurface).length,aboveActualContactCases:contacts.length,aboveActualContactPass:contacts.filter(r=>r.contact.atTimes.every(t=>t.pass)&&r.contact.childCenterAboveParent).length,throughActualSurfaceCases:intersection.length,throughActualSurfacePass:intersection.filter(r=>r.intersection.surfaceCrossesParent).length,endEndpointCases:endpoints.length,endEndpointPass:endpoints.filter(r=>r.attachment.pass).length};
}
const report={sourceFile:'prototypes/glyph-creature/src/scaffold-program.ts',geometrySha256:digest,inputFile,timingScope:'CPU compile and numerical surface sampling; browser render excluded',summary:groups,limitations:['End check confirms centerline endpoint arrangement; only sphere/box children additionally receive an analytic inside test.','Through uses child-surface samples crossing the real implicit parent volume, not just overlapping bounds. Only zero-bend sphere/box parents are scored analytically; twist is a parameter shift in this renderer, not a rotated material section.','Above means material contact in this compiler, not a configurable floating gap.','Nominal expected programs bypass language; they evaluate geometry independently and are not controller successes.'],rows};
fs.writeFileSync(path.join(directory,outputFile),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.summary,null,2));
