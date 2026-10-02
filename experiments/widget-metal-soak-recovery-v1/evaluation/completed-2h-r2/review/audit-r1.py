"""Saved-file arithmetic only. No sampler, engine, OS, GPU or UI calls."""
from pathlib import Path
from datetime import datetime
import hashlib
import json
import math
import struct
import zlib

HERE = Path(__file__).resolve().parent
BASE = HERE.parent
ROOT = HERE.parents[4]
RUN = BASE / 'metal-soak-2h-r2'
ATTEMPT = BASE / 'metal-soak-2h-r2-attempt'
REPORT = {'version': 'independent-readonly-audit-r1', 'recordedAt': datetime.now().astimezone().isoformat(), 'checks': [], 'observed': {}}

def load(path):
    return json.loads(path.read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def eq(actual, wanted, name):
    if actual != wanted:
        raise AssertionError(f'{name}: {actual!r} != {wanted!r}')

def close(actual, wanted, name):
    if not math.isclose(actual, wanted, abs_tol=1e-10, rel_tol=1e-10):
        raise AssertionError(f'{name}: {actual!r} != {wanted!r}')

def check(name, fn):
    try:
        value = fn()
        REPORT['checks'].append({'name': name, 'passed': True, 'observed': value})
    except Exception as error:
        REPORT['checks'].append({'name': name, 'passed': False, 'error': f'{type(error).__name__}: {error}'})

publication = load(BASE / 'PUBLICATION.json')
run = load(RUN / 'run.json')
result = load(RUN / 'result.json')
summary = load(RUN / 'resource-summary.json')
launch = load(ATTEMPT / 'launch.json')
exit_record = load(ATTEMPT / 'exit.json')
identity = load(ATTEMPT / 'child-identity.json')
boundary = load(RUN / 'boundaries.json')['boundaries']
pixels = load(RUN / 'pixel-finite-checks.json')['samples']
samples = [json.loads(line) for line in (RUN / 'resource-samples.ndjson').read_text().splitlines()]
interval_record = load(RUN / 'resource-cpu-intervals.json')
histogram = load(RUN / 'submit-histogram.json')
valid = [(i, row) for i, row in enumerate(samples) if 'error' not in row['processes'][0]]
missing = [(i, row) for i, row in enumerate(samples) if 'error' in row['processes'][0]]

def public_bytes():
    eq(len(publication['files']), 30, 'public file count')
    paths = []
    for record in publication['files']:
        relative = Path(record['file'])
        assert not relative.is_absolute() and '..' not in relative.parts
        path = BASE / relative
        eq(path.stat().st_size, record['bytes'], f'{relative} bytes')
        eq(digest(path), record['sha256'], f'{relative} SHA')
        paths.append(record['file'])
    eq(len(set(paths)), 30, 'unique public files')
    raw_files = [p for name in ['metal-soak-2h-r2', 'metal-soak-2h-r2-attempt'] for p in (BASE / name).rglob('*') if p.is_file()]
    eq(set(str(p.relative_to(BASE)) for p in raw_files) | {'metal-soak-2h-r2-launch.json'}, set(paths), 'copy tree coverage')
    eq(publication['originalPreserved'], True, 'publication preserved flag')
    for relative in paths:
        if relative.endswith(('.json', '.ndjson', '.txt', '.log')):
            text = (BASE / relative).read_text()
            assert '/Users/' not in text and '/var/folders/' not in text
    return {'matchedFiles': 30, 'publicationSHA256': digest(BASE / 'PUBLICATION.json'), 'personalAbsolutePathOccurrences': 0}

check('A01-public-bytes', public_bytes)

def frozen_source():
    expected_shader = 'e3416ddc373018f7dfb7359efe4f55779949ce4f5185b7862a000ef0cdebde9a'
    eq(run['sourceSHA256'], expected_shader, 'run shader')
    eq(result['surfaceSourceSHA256'], expected_shader, 'result shader')
    eq(launch['source']['shader']['sha256'], expected_shader, 'launch shader')
    eq(digest(ROOT / 'desktop/glyph-metal-lab-v1/Sources/Glyphs.metal'), expected_shader, 'actual shader source')
    frozen = load(ROOT / 'experiments/widget-metal-soak-v1/evaluation/frozen-r5-source-manifest.json')
    for relative, wanted in frozen.items():
        eq(digest(ROOT / 'desktop/glyph-metal-lab-v1' / relative), wanted, relative)
    harness = load(ROOT / 'experiments/widget-metal-soak-v1/evaluation/harness-manifest.json')
    for relative, wanted in harness['source_sha256'].items():
        eq(digest(ROOT / relative), wanted, relative)
    eq(digest(ROOT / harness['resource_counter_source']), harness['resource_counter_source_sha256'], 'calibrated helper C source')
    for name in ['engine', 'helper']:
        key = 'soak' if name == 'engine' else 'native-metrics'
        eq(launch['source'][name]['sha256'], harness['helper_sha256'][key], name + ' recorded executable hash')
    eq(launch['source']['sampler']['sha256'], digest(ROOT / 'experiments/widget-metal-soak-v1/sample.py'), 'sampler')
    eq(launch['supervisorSHA256'], digest(ROOT / 'experiments/widget-metal-soak-recovery-v1/supervise.py'), 'supervisor')
    return {'r5SourceFilesMatched': len(frozen), 'harnessSourcesMatched': len(harness['source_sha256']), 'shaderSHA256': expected_shader, 'executables': 'launch hash matched archived build manifest; binaries not recompiled or executed'}

check('A02-frozen-source', frozen_source)

def child_exit():
    pid = int((RUN / 'pid.txt').read_text())
    eq(pid, run['pid'], 'pid.txt')
    for obj in [result, summary]:
        eq(obj['pid'], pid, 'run/resource pid')
    eq(identity['enginePID'], pid, 'identity engine pid')
    eq(exit_record['enginePID'], pid, 'exit engine pid')
    eq(exit_record['samplerPID'], identity['samplerPID'], 'sampler pid')
    eq(exit_record['engineExitCode'], 0, 'engine exit')
    eq(exit_record['samplerExitCode'], 0, 'sampler exit')
    eq(exit_record['childExitCodes'], [{'pid': pid, 'code': 0}, {'pid': identity['samplerPID'], 'code': 0}], 'child exits')
    eq(exit_record['status'], 'children-exited', 'supervisor status')
    eq(exit_record['engineFinalPresent'], True, 'engine final')
    eq(exit_record['samplerFinalPresent'], True, 'sampler final')
    eq(launch['existingOutputsReplaced'], False, 'old outputs')
    return {'supervisorPID': launch['supervisorPID'], 'enginePID': pid, 'samplerPID': identity['samplerPID'], 'exitCodes': [0, 0], 'supervisedMonotonicSeconds': exit_record['supervisedElapsedSeconds'], 'supervisedUTCSeconds': (datetime.fromisoformat(exit_record['finishedUTC'])-datetime.fromisoformat(exit_record['startedUTC'])).total_seconds(), 'currentProcessStateMeasured': False}

check('A03-child-exit', child_exit)

def engine_time():
    eq(run['durationSeconds'], 7200, 'requested run')
    eq(result['requestedSeconds'], 7200, 'requested result')
    eq(result['status'], 'completed', 'engine final status')
    assert result['elapsedSeconds'] >= result['requestedSeconds']
    eq(result['drawCalls'], result['frames'], 'one draw/frame')
    eq(result['drawsPerFrame'], 1, 'draw count')
    eq(result['frames'], 108000, 'announced frame observation')
    close(result['actualFPS'], result['frames']/result['elapsedSeconds'], 'actual submission cadence')
    eq(run['width']*run['height']*4, result['renderTargetBytes'], 'render target bytes')
    eq(result['instanceBytes'], 1536*80, 'instances')
    eq(result['uniformBytes'], 176, 'uniforms')
    eq((datetime.fromisoformat(run['deadlineUTC'])-datetime.fromisoformat(run['startedUTC'])).total_seconds(), 7200, 'UTC second-precision deadline')
    return {'engineSeconds': result['elapsedSeconds'], 'overRequestedSeconds': result['elapsedSeconds']-7200, 'framesAndDraws': result['frames'], 'submissionRate': result['frames']/result['elapsedSeconds'], 'renderTargetBytes': result['renderTargetBytes'], 'instancesBytes': result['instanceBytes'], 'uniformBytes':176, 'UTCMetadataPrecisionSeconds':1, 'presentationFPSMeasured': False}

check('A04-engine-cadence', engine_time)

def retention_boundary():
    eq(len(boundary), 11, 'scheduled boundaries before7200')
    initial = pixels[0]['storedGlyphs']
    eq(initial, 1536, 'initial fixture')
    delays = []
    for phase, row in enumerate(boundary, 1):
        eq(row['boundary'], phase, 'phase')
        eq(row['shape'], phase % 3, 'shape')
        assert phase*600 <= row['elapsedSeconds'] < (phase+1)*600
        eq(row['addedGlyphs'], 400, 'whole artificial additions')
        eq(row['storedGlyphs'], initial+phase*400, 'stored count')
        eq(row['drawnGlyphs'], 1536, 'bounded draw')
        eq(row['oldIDsAndInksPreserved'], True, 'source guard outcome')
        eq(row['texturesCreated'], phase+1, 'texture creation count')
        eq(row['atlasRGBABytes'], 2048*64*row['atlasRows']*4, 'atlas bitmap')
        eq(row['atlasKinds'], 22+phase*48+1, 'newCJK48 and initial family emoji1')
        assert row['atlasRows'] & (row['atlasRows']-1) == 0
        assert row['atlasKinds'] <= row['atlasRows']*32
        assert row['atlasRows'] == 1 or row['atlasKinds'] > row['atlasRows']//2*32
        delays.append(row['elapsedSeconds']-phase*600)
    for name in ['storedGlyphs','drawnGlyphs','atlasKinds','atlasRows','atlasRGBABytes','texturesCreated']:
        eq(result[name], boundary[-1][name], 'final '+name)
    return {'boundaries':11, 'addedGlyphsTotal':4400, 'storedFinal':5936, 'drawn':1536, 'atlasKinds':551, 'atlasRows':32, 'atlasBitmapBytes':16777216, 'texturesCreated':12, 'maximumBoundaryDelaySeconds':max(delays), 'idTextInkSeedAndTileEvidence':'boolean recorded after source exact-prefix and old atlas key/value guards; individual tuples are not present in public raw'}

check('A05-retention-boundaries', retention_boundary)

def pixel_finite():
    eq(len(pixels), 40, 'pixel samples')
    eq(sum(row['finiteMapPoints'] for row in pixels), 600, 'finite points sum')
    eq(result['finiteMapPointsChecked'], 600, 'final finite count')
    eq(result['pixelChecks'], 40, 'final pixel checks')
    hashes = []
    for i, row in enumerate(pixels):
        eq(row['finiteMapPoints'], 15, '3shapes x5positions')
        assert row['litPixels']>400 and row['litPixels']<=400*440
        eq(row['drawnGlyphs'], 1536, 'pixel draw count')
        assert row['frames'] <= result['frames']
        eq(row['shape'], int(row['elapsedSeconds']//600)%3, 'pixel shape phase')
        phase=int(row['elapsedSeconds']//600)
        eq(row['storedGlyphs'],1536+400*phase,'pixel stored')
        eq(row['texturesCreated'],phase+1,'pixel texture count')
        eq(row['priorSwiftTextureObjectsStillAlive'],0,'old weak texture objects')
        assert len(row['pixelSHA256'])==64 and all(c in '0123456789abcdef' for c in row['pixelSHA256'])
        assert len(row['BGRPixelSum'])==3 and all(0 <= c <= 400*440*255 for c in row['BGRPixelSum'])
        if i:
            assert row['elapsedSeconds']-pixels[i-1]['elapsedSeconds']>=180
            assert row['frames']>pixels[i-1]['frames']
        hashes.append(row['pixelSHA256'])
    eq(result['priorSwiftTextureObjectsStillAlive'],0,'final weak texture objects')
    return {'samples':40,'finitePoints':600,'finiteScalarComponentsCheckedBySource':600*9,'minimumLitPixels':min(r['litPixels'] for r in pixels),'maximumLitPixels':max(r['litPixels'] for r in pixels),'firstElapsed':pixels[0]['elapsedSeconds'],'lastElapsed':pixels[-1]['elapsedSeconds'],'uniquePixelHashes':len(set(hashes)),'perShapeSampleCount':{str(s):sum(r['shape']==s for r in pixels) for s in range(3)},'weakTextureObjectAliveMax':max(r['priorSwiftTextureObjectsStillAlive'] for r in pixels),'individualFiniteOutputsPersisted':False,'finiteScope':'p/du/dv at 15 fixed inputs percheck, not allrenderedglyphs/alltimes/normals/geometrycorrectness'}

check('A06-pixel-finite-counts', pixel_finite)

def histogram_errors():
    counts=histogram['counts']
    eq(len(counts),2001,'bins')
    eq(sum(counts),result['frames'],'sum histogram')
    eq(histogram['binWidthMS'],.01,'bin width')
    goal=math.ceil(.95*result['frames'])
    total=0;index=None
    for i,count in enumerate(counts):
        assert count>=0
        total+=count
        if index is None and total>=goal:index=i
    close(index*.01,result['submitWallP95MSUpperBin'],'p95 upperbin')
    eq(counts[-1],result['submitHistogramOverflowAt20MS'],'overflow bucket')
    eq(result['metalErrors'],0,'MTL errors recorded')
    eq(result['inFlightTimeouts'],0,'timeout recorded')
    eq(result['skippedDeadlines'],0,'skips recorded')
    assert result['submitWallMaximumMS']>=index*.01-.01
    return {'histogramTotal':total,'p95Rank':goal,'p95UpperBinMS':index*.01,'maximumSubmitMS':result['submitWallMaximumMS'],'overflowBucketCount':counts[-1],'metalErrors':0,'timeouts':0,'skippedDeadlines':0,'timingScope':'uniform-to-commit only; excludes in-flight wait, mutation, readback, finite kernel, PNG','gpuPerDrawCompletedCounterPersisted':False}

check('A07-histogram-errors',histogram_errors)

def resource_identity():
    eq(len(samples),summary['samples'],'resource rows')
    eq(len(missing),summary['missingSamples'],'missing')
    eq(len(missing),1,'announced missing count')
    start=summary['processStartAbstime'];pid=run['pid']
    for _,row in valid:
        eq(len(row['processes']),1,'explicit one process')
        proc=row['processes'][0]
        eq(proc['pid'],pid,'resource PID')
        eq(proc['start_abstime'],start,'resource PID start')
        eq(row['mach_timebase'],{'numer':125,'denom':3},'calibrated timebase')
        eq(proc['coalition_resource_id'],56201,'resource coalition')
        eq(proc['coalition_jetsam_id'],56202,'jetsam coalition')
    eq(missing[0][0],len(samples)-1,'missing is terminal row')
    eq(missing[0][1]['processes'],[{'error':3,'pid':pid}],'error row')
    eq(summary['status'],'completed','sampler final status from engineFinal')
    eq(summary['engineFinal'],result,'sampler engineFinal snapshot')
    last_progress=summary['lastEngineProgress'];eq(last_progress,samples[-1]['engine'],'last packet unchanged on terminal error')
    return {'totalRows':len(samples),'validRows':len(valid),'missingRows':len(missing),'explicitPID':pid,'startAbstime':start,'resourceCoalition':56201,'jetsamCoalition':56202,'machTimebase':{'numer':125,'denom':3},'missingIndexZeroBased':missing[0][0],'missingObservedUTC':missing[0][1]['observedUTC'],'missingAfterLastValidSeconds':(missing[0][1]['monotonic_ns']-valid[-1][1]['monotonic_ns'])/1e9,'missingPosition':'one terminal proc_pid_rusage errno3 after last valid interval; final engine record separately completed','lastProgressFrame':last_progress['frames'],'finalEngineFrame':result['frames']}

check('A08-resource-identity-missing',resource_identity)

def resource_arithmetic():
    first=valid[0][1];last=valid[-1][1];a=first['processes'][0];b=last['processes'][0]
    seconds=(last['monotonic_ns']-first['monotonic_ns'])/1e9
    cpu_ns=b['user_ns']+b['system_ns']-a['user_ns']-a['system_ns']
    cpu=cpu_ns/1e9/seconds*100
    close(seconds,summary['elapsedValidSeconds'],'resource seconds')
    close(cpu,summary['cpuSingleCorePercent'],'resource CPU')
    peaks={name:max(row['processes'][0][key] for _,row in valid) for name,key in [('peakChargedFootprintBytes','footprint_bytes'),('peakRSSBytes','resident_bytes'),('processLifetimeMaximumFootprintBytes','lifetime_max_footprint_bytes')]}
    for name,value in peaks.items():eq(value,summary[name],name)
    eq(summary['firstChargedFootprintBytes'],a['footprint_bytes'],'first charged')
    eq(summary['lastChargedFootprintBytes'],b['footprint_bytes'],'last charged')
    intervals=[]
    for (_,prior),(_,current) in zip(valid,valid[1:]):
        x=prior['processes'][0];y=current['processes'][0]
        duration=(current['monotonic_ns']-prior['monotonic_ns'])/1e9
        delta=y['user_ns']+y['system_ns']-x['user_ns']-x['system_ns']
        assert duration>0 and delta>=0
        intervals.append({'endUTC':current['observedUTC'],'seconds':duration,'singleCorePercent':delta/1e9/duration*100})
    eq(len(intervals),len(interval_record),'CPU intervals')
    for computed,reported in zip(intervals,interval_record):
        eq(computed['endUTC'],reported['endUTC'],'CPU interval end')
        close(computed['seconds'],reported['seconds'],'CPU interval wall')
        close(computed['singleCorePercent'],reported['singleCorePercent'],'CPU interval rate')
    weighted=sum(r['seconds']*r['singleCorePercent'] for r in intervals)/sum(r['seconds'] for r in intervals)
    close(weighted,cpu,'weighted CPU intervals')
    peak_positions={name:[{'row':i,'observedUTC':row['observedUTC'],'engineElapsed':row['engine']['elapsedSeconds']} for i,row in valid if row['processes'][0][key]==peaks[name]] for name,key in [('peakChargedFootprintBytes','footprint_bytes'),('peakRSSBytes','resident_bytes'),('processLifetimeMaximumFootprintBytes','lifetime_max_footprint_bytes')]}
    return {'validSeconds':seconds,'engineSecondsNotResourceInterval':result['elapsedSeconds'],'differenceSeconds':result['elapsedSeconds']-seconds,'CPUCounterDeltaNS':cpu_ns,'cpuSingleCorePercent':cpu,'weightedIntervalCPUPercent':weighted,'unweightedIntervalMeanCPUPercent':sum(r['singleCorePercent'] for r in intervals)/len(intervals),'intervals':len(intervals),'minimumIntervalSeconds':min(r['seconds'] for r in intervals),'maximumIntervalSeconds':max(r['seconds'] for r in intervals),'firstObservedUTC':first['observedUTC'],'lastObservedUTC':last['observedUTC'],'observedUTCIntervalSeconds':(datetime.fromisoformat(last['observedUTC'])-datetime.fromisoformat(first['observedUTC'])).total_seconds(),'peaksBytes':peaks,'peaksMiB':{k:v/(1024**2) for k,v in peaks.items()},'firstChargedBytes':a['footprint_bytes'],'lastChargedBytes':b['footprint_bytes'],'peakSamplePositions':peak_positions}

check('A09-resource-arithmetic',resource_arithmetic)

def read_png_rgba(path):
    data=path.read_bytes();eq(data[:8],b'\x89PNG\r\n\x1a\n','PNG signature');cursor=8;compressed=[];header=None
    while cursor<len(data):
        length=struct.unpack('>I',data[cursor:cursor+4])[0];kind=data[cursor+4:cursor+8];payload=data[cursor+8:cursor+8+length];crc=struct.unpack('>I',data[cursor+8+length:cursor+12+length])[0]
        eq(zlib.crc32(kind+payload)&0xffffffff,crc,'PNG CRC')
        if kind==b'IHDR':header=struct.unpack('>IIBBBBB',payload)
        if kind==b'IDAT':compressed.append(payload)
        cursor+=12+length
    width,height,depth,color,compression,filtermethod,interlace=header
    eq((width,height,depth,color,compression,filtermethod,interlace),(400,440,8,6,0,0,0),'PNG layout')
    raw=zlib.decompress(b''.join(compressed));stride=width*4;prev=bytearray(stride);out=bytearray()
    eq(len(raw),height*(stride+1),'PNG scanlinebytes')
    def paeth(a,b,c):
        p=a+b-c;pa=abs(p-a);pb=abs(p-b);pc=abs(p-c);return a if pa<=pb and pa<=pc else b if pb<=pc else c
    for y in range(height):
        offset=y*(stride+1);mode=raw[offset];row=bytearray(raw[offset+1:offset+1+stride]);assert 0<=mode<=4
        for x in range(stride):
            left=row[x-4] if x>=4 else 0;up=prev[x];corner=prev[x-4] if x>=4 else 0
            add=0 if mode==0 else left if mode==1 else up if mode==2 else (left+up)//2 if mode==3 else paeth(left,up,corner)
            row[x]=(row[x]+add)&255
        out.extend(row);prev=row
    return out

def png_observations():
    import re
    pngs=sorted(RUN.glob('frame-*.png'));wanted=[pixels[0]]
    previous_shape=pixels[0]['shape']
    for row in pixels[1:]:
        if row['shape']!=previous_shape:wanted.append(row);previous_shape=row['shape']
    eq(len(pngs),len(wanted),'source first/frame shape-change PNG policy')
    verified=[]
    for row in wanted:
        path=RUN/f"frame-{int(row['elapsedSeconds']):05d}-shape{row['shape']}.png"
        rgba=read_png_rgba(path);bgra=bytearray(len(rgba));channels=[0,0,0];lit=0
        for i in range(0,len(rgba),4):
            r,g,b,a=rgba[i:i+4];bgra[i:i+4]=bytes([b,g,r,a]);channels[0]+=b;channels[1]+=g;channels[2]+=r
            lit+=max(r,g,b)>8
        eq(hashlib.sha256(bgra).hexdigest(),row['pixelSHA256'],'decoded PNG pixel SHA')
        eq(channels,row['BGRPixelSum'],'decoded PNG sums')
        eq(lit,row['litPixels'],'decoded PNG lit count')
        verified.append({'file':path.name,'sampleFrames':row['frames'],'litPixels':lit,'BGRPixelSum':channels,'pixelSHA256':row['pixelSHA256']})
    return {'PNGFilesDecoded':len(verified),'sampleRowsWithoutPNG':40-len(verified),'verified':verified,'noVisualQualityJudgment':True}

check('A06b-PNG-pixel-recomputation',png_observations)

def method_scope():
    for obj in [run,result]:
        for field in ['restoreUserHistory','writeUserHistory'] if obj is run else ['historyRead','historyWrite','windowCPUorRAMClaim']:
            eq(obj[field],False,field)
    for field in ['GPUUtilizationMeasured','powerMeasured','systemUniqueRAMMeasured','windowAppCPUorRAMMeasured']:
        eq(summary[field],False,field)
    eq(run['samplingBeginsAfterCompilation'],True,'compile exclusion run')
    eq(summary['initialLibraryCompilationExcludedFromCPUInterval'],True,'compile exclusion sampler')
    eq(summary['lifetimeMaximumMayIncludeInitialization'],True,'lifetime peak scope')
    return {'initialLibraryRenderPipelineMS':run['initialLibraryAndRenderPipelineMS'],'samplingAfterCompilation':True,'nativeWindowMeasured':False,'scope':'Frozen R5 three authored shapes, 400x440 offscreen. Independent completedR2 only; no interruptedR1/preflight addition. Concurrent root CPU builds/nativeUI, not idle-system comparison. No13shape/8h/16GBlaptop/Windows/power/uniqueRAM/globalinput claim.'}

check('A10-A11-method-scope',method_scope)
REPORT['totals']={'checks':len(REPORT['checks']),'passed':sum(r['passed'] for r in REPORT['checks']),'failed':sum(not r['passed'] for r in REPORT['checks'])}
with (HERE/'AUDIT-R1.json').open('x') as file:
    json.dump(REPORT,file,ensure_ascii=False,indent=2);file.write('\n')
print(json.dumps({'output':'experiments/widget-metal-soak-recovery-v1/evaluation/completed-2h-r2/review/AUDIT-R1.json',**REPORT['totals'],'failures':[r for r in REPORT['checks'] if not r['passed']]},ensure_ascii=False))
