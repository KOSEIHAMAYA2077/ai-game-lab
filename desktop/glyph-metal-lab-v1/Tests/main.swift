import Foundation
import simd

var assertions = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    assertions += 1
    if !condition() { fputs("FAIL: \(message)\n",stderr);exit(1) }
}
func throwsInvalid(_ body: () throws -> Void, _ name: String) {
    do { try body(); check(false,name) } catch { check(true,name) }
}
check(MetalMatter.split("a e\u{301} あ 👨‍👩‍👧‍👦 🇯🇵\n\u{0000}\u{200D}") == ["a","é","あ","👨‍👩‍👧‍👦","🇯🇵"],"NFC grapheme clusters; controls excluded; emoji ZWJ retained")
var matter = MetalMatter()
let text = "青い表面 メビウスの輪 👨‍👩‍👧‍👦 e\u{301}"
let add = matter.add(text,repeatCount:8,ink:.blue,intakeSeed:123)
check(add.added == MetalMatter.split(text).count*8,"input repetition preserves accepted count")
check(matter.state.batches[0].text == text,"stored batch keeps original raw text")
let firstID = matter.glyphs[1].id
let firstText = matter.glyphs[1].text
matter.state.time=8;matter.state.shape = .mobius
_ = matter.add("黄色い球",repeatCount:3,ink:.yellow,intakeSeed:987)
check(matter.glyphs[firstID].text == firstText && matter.glyphs[firstID].ink == .blue,"new input never recolors or replaces old glyph")
check(matter.glyphs.last?.ink == .yellow,"new batch ink is isolated")
let encoded = try JSONEncoder().encode(matter.state)
let restored = try MetalMatter.restored(JSONDecoder().decode(MetalState.self,from:encoded))
check(restored.glyphs.count == matter.glyphs.count && restored.state.batches == matter.state.batches,"state roundtrip body and batches")
check(restored.glyphs.map(\.text) == matter.glyphs.map(\.text) && restored.glyphs.map(\.ink) == matter.glyphs.map(\.ink),"state roundtrip text and inks")
check(restored.glyphs.map(\.intakeSeed) == matter.glyphs.map(\.intakeSeed),"state roundtrip deterministic intake")
var invalid = matter.state;invalid.batches[0].added += 1
throwsInvalid({_ = try MetalMatter.restored(invalid)},"invalid accepted count is rejected")
invalid=matter.state;invalid.time = .infinity
throwsInvalid({_ = try MetalMatter.restored(invalid)},"nonfinite state time is rejected")
invalid=matter.state;invalid.batches[0].at = 9
throwsInvalid({_ = try MetalMatter.restored(invalid)},"out-of-order batch time is rejected")
invalid=matter.state;invalid.schema=99
throwsInvalid({_ = try MetalMatter.restored(invalid)},"unknown schema is rejected")
var capacity = MetalMatter.fixture(count:31999)
let tail = "あいうえお"
let limited = capacity.add(tail,ink:.red,intakeSeed:444)
check(limited.added==1 && capacity.glyphs.count==32000 && limited.limited,"body cap reports actual accepted count")
check(capacity.state.batches.last?.text==tail,"cap keeps complete submitted batch text")
let restoredCapacity = try MetalMatter.restored(capacity.state)
check(restoredCapacity.glyphs.count==32000,"capacity-limited state roundtrip")
let rejected = capacity.add(String(repeating:"a",count:16385))
check(rejected.added==0 && rejected.limited,"oversized UTF16 input rejected intact")
let sample = capacity.displayed()
check(sample.count==1536 && sample.first?.id==0 && sample.last?.id==31999,"sample includes seed and latest glyph")
check(Set(sample.map(\.id)).count==1536,"sample has distinct stable IDs")
check(sample.map(\.id) == sample.map(\.id).sorted(),"sample has original chronological order")
for n in [1,2,385,1536,1665,32000] {
    let fixture = MetalMatter.fixture(count:n)
    check(fixture.glyphs.count==n,"fixture exact count \(n)")
}
check(MetalMatter.fixture(count:Int.max).glyphs.count==32000,"fixture clamps oversized requested count")
check(MetalShape.inText("表面 青 メビウスの輪") == .mobius && MetalShape.inText("黄色い立方体") == .cube,"explicit shape vocabulary")
check(MetalInk.inText("青い表面") == .blue && MetalInk.inText("黄色い箱") == .yellow,"explicit color vocabulary")
var rawLimited = MetalMatter()
let sparseText = String(repeating:" ",count:16_383)+"x"
for i in 0..<64 {_ = rawLimited.add(sparseText,intakeSeed:UInt32(i))}
check(rawLimited.rawUTF8Bytes==1_048_576 && rawLimited.glyphs.count==65,"original text total is bounded separately from displayed glyphs")
let rawEncoder = JSONEncoder();rawEncoder.outputFormatting = [.sortedKeys]
let rawBefore = try rawEncoder.encode(rawLimited.state)
let rawRejected = rawLimited.add("新しい文字",ink:.yellow,intakeSeed:99)
let rawAfter = try rawEncoder.encode(rawLimited.state)
check(rawRejected.added==0 && rawRejected.limited && rawBefore==rawAfter,"raw capacity rejects intact; earlier original batches and ink remain unchanged")
check((try? MetalMatter.restored(rawLimited.state))?.rawUTF8Bytes==1_048_576,"one MiB original text restores intact")
let directory=URL(fileURLWithPath:CommandLine.arguments.dropFirst().first ?? NSTemporaryDirectory()).appendingPathComponent("metal-state-test-\(UUID().uuidString)")
let store=MetalStateStore(directory:directory)
let saved1=try store.save(matter.state),saved2=try store.save(capacity.state)
check(saved1 != saved2 && FileManager.default.fileExists(atPath:saved1.path) && FileManager.default.fileExists(atPath:saved2.path),"save appends independent atomic snapshots")
check(store.load()?.glyphs.count==32000,"newest complete valid snapshot restores")
try Data("invalid".utf8).write(to:directory.appendingPathComponent("99999999999999999999-malformed.json"))
check(store.load()?.glyphs.count==32000,"invalid later snapshot does not destroy earlier snapshot")
var checkedFrames=0,maxSphereRadiusError=0.0,maxTangentNormalError=0.0,maxSeamError=0.0
for seed:UInt32 in [1,42,123456,UInt32.max] {
    for time in [0.0,0.1,24,100,3600,28800] {
        for id in [0,1,2,385,1535,1664,31999] {
            for shape in MetalShape.allCases {
                let f=metalReferenceFrame(shape:shape,id:id,time:time,seed:seed)
                check((0..<3).allSatisfy{f.p[$0].isFinite && f.u[$0].isFinite && f.v[$0].isFinite},"finite position and analytic tangents")
                check(simd_length(f.u)>1e-6 && simd_length(simd_cross(f.u,f.v))>1e-6,"nondegenerate surface basis")
                checkedFrames+=1
                if shape == .sphere {
                    maxSphereRadiusError=max(maxSphereRadiusError,abs(simd_length(f.p)-1))
                    maxTangentNormalError=max(maxTangentNormalError,abs(simd_dot(f.p,f.u)),abs(simd_dot(f.p,f.v)))
                }
                if shape == .cube { check(abs(pow(f.p.x,12)+pow(f.p.y,12)+pow(f.p.z,12)-1)<1e-9,"rounded cube remains on L12 surface") }
            }
        }
        for u in [0.0,0.123,1,3,6,10] { for w in [-0.47,-0.1,0.0,0.1,0.47] {
            let a=metalReferenceMobius(u:u,w:w,time:time),b=metalReferenceMobius(u:u+2*Double.pi,w:-w,time:time)
            maxSeamError=max(maxSeamError,simd_length(a.p-b.p),simd_length(a.u-b.u),simd_length(a.v+b.v))
        } }
    }
}
check(maxSphereRadiusError<1e-10 && maxTangentNormalError<1e-9,"sphere shear preserves unit surface and tangent planes")
check(maxSeamError<1e-10,"Mobius chart seam position and opposite width tangent are continuous")
struct OriginalSurfaceCase: Decodable {var seed:UInt32;var time:Double;var id:Int;var shape:Int;var p:[Double];var u:[Double];var v:[Double]}
var maxOriginalTSComponentError=0.0
if CommandLine.arguments.count>=3 {
    let original=try JSONDecoder().decode([OriginalSurfaceCase].self,from:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[2])))
    for record in original {
        let actual=metalReferenceFrame(shape:MetalShape(rawValue:record.shape)!,id:record.id,time:record.time,seed:record.seed)
        for axis in 0..<3 {maxOriginalTSComponentError=max(maxOriginalTSComponentError,abs(actual.p[axis]-record.p[axis]),abs(actual.u[axis]-record.u[axis]),abs(actual.v[axis]-record.v[axis]))}
    }
    check(original.count==504 && maxOriginalTSComponentError<1e-9,"Swift port agrees with original surface-flow.ts component values")
}
let report:[String:Any] = ["assertions":assertions,"surfaceFrames":checkedFrames,"maximumOriginalTSComponentError":maxOriginalTSComponentError,"maximumSphereRadiusError":maxSphereRadiusError,"maximumSphereTangentNormalError":maxTangentNormalError,"maximumMobiusChartError":maxSeamError,"stateSnapshotPreserved":true,"status":"passed","gpuValidated":false]
print(String(data:try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]),encoding:.utf8)!)
