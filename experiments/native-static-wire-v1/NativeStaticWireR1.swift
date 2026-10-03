// Independent CPU adaptation of tokenizers v0.22.1 algorithms (Apache-2.0).
// Source attribution and fixed commit are in METHOD-R1.md and upstream/MANIFEST.json.
import Foundation
import CryptoKit
import Darwin

enum LabError: Error, CustomStringConvertible {
 case invalid(String)
 var description:String {switch self{case .invalid(let s):return s}}
}
func shaFile(_ path:String)throws->String{
 let handle=try FileHandle(forReadingFrom:URL(fileURLWithPath:path));defer{try? handle.close()}
 var hash=SHA256();while let bytes=try handle.read(upToCount:1_048_576),!bytes.isEmpty{hash.update(data:bytes)}
 return hash.finalize().map{String(format:"%02x",$0)}.joined()
}
func readJSON<T:Decodable>(_ path:String,_ type:T.Type)throws->T{try JSONDecoder().decode(type,from:Data(contentsOf:URL(fileURLWithPath:path)))}
func writeNew<T:Encodable>(_ path:String,_ value:T)throws{
 guard !FileManager.default.fileExists(atPath:path) else {throw LabError.invalid("output exists")}
 let data=try JSONEncoder().encode(value);try data.write(to:URL(fileURLWithPath:path),options:.withoutOverwriting)
}
func now()->Double{Double(DispatchTime.now().uptimeNanoseconds)*1e-6}
struct Memory:Codable{let residentBytes:UInt64;let physicalFootprintBytes:UInt64;let maxRSSBytes:Int64}
func memory()->Memory{
 var vm=task_vm_info_data_t();var count=mach_msg_type_number_t(MemoryLayout<task_vm_info_data_t>.size/MemoryLayout<integer_t>.size)
 let status=withUnsafeMutablePointer(to:&vm){p in p.withMemoryRebound(to:integer_t.self,capacity:Int(count)){task_info(mach_task_self_,task_flavor_t(TASK_VM_INFO),$0,&count)}}
 var usage=rusage();getrusage(RUSAGE_SELF,&usage)
 return Memory(residentBytes:status==KERN_SUCCESS ? vm.resident_size : 0,physicalFootprintBytes:status==KERN_SUCCESS ? vm.phys_footprint : 0,maxRSSBytes:Int64(usage.ru_maxrss))
}
struct Added:Codable{let id:Int;let content:String;let single_word:Bool;let lstrip:Bool;let rstrip:Bool;let normalized:Bool;let special:Bool}
struct VocabularyPair:Decodable{
 let text:String;let score:Double
 init(from decoder:Decoder)throws{var c=try decoder.unkeyedContainer();text=try c.decode(String.self);score=try c.decode(Double.self)}
}
struct Model:Decodable{let type:String;let unk_id:Int;let byte_fallback:Bool;let vocab:[VocabularyPair]}
struct PreTokenizer:Decodable{let type:String;let replacement:String;let prepend_scheme:String;let split:Bool}
struct NormalizerPart:Decodable{let type:String}
struct NormalizerSpec:Decodable{let type:String;let normalizers:[NormalizerPart]}
struct TokenizerSpec:Decodable{let added_tokens:[Added];let model:Model;let normalizer:NormalizerSpec;let pre_tokenizer:PreTokenizer}
struct TrieNode{var children:[UInt8:Int]=[:];var id:Int = -1}
struct TokenResult:Codable{var ids:[Int]?;var pieces:[String]?;var normalization:String?;var pretokenizedWholeNormalization:[String]?;var hold:String?}
final class NativeTokenizer{
 private var nodes=[TrieNode()];private let scores:[Double];private let added:[Added];private let addedBytes:[[UInt8]];private let vocabIds:[String:Int];private let unkScore:Double
 let baseVocab:Int;let addedCount:Int;var nodeCount:Int{nodes.count}
 init(path:String)throws{
  guard try shaFile(path)=="833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9" else {throw LabError.invalid("tokenizer SHA")}
  let spec:TokenizerSpec=try readJSON(path,TokenizerSpec.self)
  guard spec.model.type=="Unigram",spec.model.unk_id==3,!spec.model.byte_fallback,spec.model.vocab.count==32702,spec.normalizer.type=="Sequence",spec.normalizer.normalizers.map({$0.type})==["Nmt","NFKC","Lowercase"],spec.pre_tokenizer.type=="Metaspace",spec.pre_tokenizer.replacement=="▁",spec.pre_tokenizer.prepend_scheme=="always",spec.pre_tokenizer.split else {throw LabError.invalid("unsupported tokenizer schema")}
  guard spec.added_tokens.count==71,spec.added_tokens.allSatisfy({!$0.single_word && !$0.rstrip && !$0.normalized && $0.special && ($0.content=="<mask>" || !$0.lstrip) && $0.id>=0 && $0.id<32768}) else {throw LabError.invalid("unsupported added tokens")}
  scores=spec.model.vocab.map{$0.score};guard scores.allSatisfy({$0.isFinite}) else {throw LabError.invalid("nonfinite tokenizer score")}
  unkScore=(scores.min() ?? 0)-10;added=spec.added_tokens;addedBytes=added.map{Array($0.content.utf8)};baseVocab=scores.count;addedCount=added.count
  var ids:[String:Int]=[:]
  for (id,pair) in spec.model.vocab.enumerated(){
   guard !pair.text.isEmpty else {throw LabError.invalid("empty unigram piece")};ids[pair.text]=id;var node=0
   for byte in pair.text.utf8{if let next=nodes[node].children[byte]{node=next}else{let next=nodes.count;nodes.append(TrieNode());nodes[node].children[byte]=next;node=next}}
   nodes[node].id=id
  }
  vocabIds=ids
 }
 func normalize(_ source:String)->String{
  var filtered=String.UnicodeScalarView()
  for c in source.unicodeScalars{
   let x=c.value
   if (1...8).contains(x)||x==11||(14...31).contains(x)||x==127||x==143||x==159{continue}
   if [9,10,12,13,0x1680,0x2028,0x2029,0x2581,0xfeff,0xfffd].contains(x)||(0x200b...0x200f).contains(x){filtered.append(" ")}else{filtered.append(c)}
  }
  let nfkc=String(filtered).precomposedStringWithCompatibilityMapping.precomposedStringWithCanonicalMapping
  var lowered="";for scalar in nfkc.unicodeScalars{lowered+=scalar.properties.lowercaseMapping}
  return lowered
 }
 func pretokenize(_ source:String)->[String]{
  if source.isEmpty{return []};var replacement=source.replacingOccurrences(of:" ",with:"▁");if !replacement.hasPrefix("▁"){replacement="▁"+replacement}
  var result:[String]=[],piece=""
  for scalar in replacement.unicodeScalars{if scalar=="▁",!piece.isEmpty{result.append(piece);piece=""};piece.unicodeScalars.append(scalar)}
  if !piece.isEmpty{result.append(piece)};return result
 }
 private func scalarBytes(_ byte:UInt8)->Int{byte<0x80 ? 1 : byte<0xe0 ? 2 : byte<0xf0 ? 3 : 4}
 private func unigram(_ sentence:String)->([Int],[String]){
  let bytes=Array(sentence.utf8),size=bytes.count;if size==0{return([],[])}
  var bestScore=[Double](repeating:0,count:size+1),starts=[Int](repeating:-1,count:size+1),bestId=[Int](repeating:0,count:size+1),at=0
  while at<size{
   let width=scalarBytes(bytes[at]);var node=0,end=at,single=false
   while end<size,let next=nodes[node].children[bytes[end]]{
    node=next;end+=1;let id=nodes[node].id
    if id>=0{let score=bestScore[at]+scores[id];if starts[end]<0||score>bestScore[end]{bestScore[end]=score;starts[end]=at;bestId[end]=id};if end-at==width{single=true}}
   }
   if !single{let end=at+width,score=bestScore[at]+unkScore;if starts[end]<0||score>bestScore[end]{bestScore[end]=score;starts[end]=at;bestId[end]=3}}
   at+=width
  }
  var paths:[(Int,Int,Int)]=[];var end=size
  while end>0{let start=starts[end];precondition(start>=0&&start<end);paths.append((bestId[end],start,end));end=start}
  paths.reverse();var ids:[Int]=[],pieces:[String]=[],i=0
  while i<paths.count{let first=paths[i];var end=first.2;let start=first.1;i+=1;if first.0==3{while i<paths.count,paths[i].0==3{end=paths[i].2;i+=1}}
   let piece=String(decoding:bytes[start..<end],as:UTF8.self);pieces.append(piece);ids.append(vocabIds[piece] ?? 3)
  }
  return(ids,pieces)
 }
 private func whitespace(_ scalar:Unicode.Scalar)->Bool{let x=scalar.value;return (9...13).contains(x)||[0x20,0x85,0xa0,0x1680,0x2028,0x2029,0x202f,0x205f,0x3000].contains(x)||(0x2000...0x200a).contains(x)}
 func tokenize(_ source:String)->TokenResult{
  if source.unicodeScalars.count>4000{return TokenResult(ids:nil,pieces:nil,normalization:nil,pretokenizedWholeNormalization:nil,hold:"input_limit")}
  let whole=normalize(source);if whole.utf8.count>262144{return TokenResult(ids:nil,pieces:nil,normalization:nil,pretokenizedWholeNormalization:nil,hold:"native_normalization_byte_limit")}
  let bytes=Array(source.utf8);var ids:[Int]=[],pieces:[String]=[],cursor=0,at=0
  func ordinary(_ start:Int,_ end:Int){if start>=end{return};let s=normalize(String(decoding:bytes[start..<end],as:UTF8.self));for piece in pretokenize(s){let (a,b)=unigram(piece);ids+=a;pieces+=b}}
  while at<bytes.count{
   var matching:Int?=nil
   if bytes[at]==60||bytes[at]==91{for i in addedBytes.indices{let word=addedBytes[i];if at+word.count<=bytes.count,bytes[at..<at+word.count].elementsEqual(word),matching==nil||word.count>addedBytes[matching!].count{matching=i}}}
   if let i=matching{
    var start=at;let end=at+addedBytes[i].count
    if added[i].lstrip{while start>cursor{var previous=start-1;while previous>cursor,bytes[previous]&0xc0==0x80{previous-=1};let scalar=String(decoding:bytes[previous..<start],as:UTF8.self).unicodeScalars.first!;if !whitespace(scalar){break};start=previous}}
    ordinary(cursor,start);ids.append(added[i].id);pieces.append(String(decoding:bytes[start..<end],as:UTF8.self));cursor=end;at=end
   }else{at+=scalarBytes(bytes[at])}
  }
  ordinary(cursor,bytes.count)
  return TokenResult(ids:ids,pieces:pieces,normalization:whole,pretokenizedWholeNormalization:pretokenize(whole),hold:ids.count>4000 ? "token_limit" : nil)
 }
}
final class MappedTable{
 let bytes=8388608;private let fd:Int32;private let pointer:UnsafeMutableRawPointer
 init(path:String)throws{
  guard try shaFile(path)=="65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201" else {throw LabError.invalid("F16 table SHA")}
  fd=Darwin.open(path,O_RDONLY);guard fd>=0 else {throw LabError.invalid("table open")}
  var st=stat();guard fstat(fd,&st)==0,st.st_size==bytes else{Darwin.close(fd);throw LabError.invalid("table size")}
  let p=mmap(nil,bytes,PROT_READ,MAP_PRIVATE,fd,0);guard p != MAP_FAILED,let p=p else{Darwin.close(fd);throw LabError.invalid("mmap")};pointer=p
 }
 deinit{munmap(pointer,bytes);Darwin.close(fd)}
 func value(_ row:Int,_ column:Int)->Float{Float(Float16(bitPattern:pointer.load(fromByteOffset:(row*128+column)*2,as:UInt16.self).littleEndian))}
}
struct Embedding:Codable{let tokens:TokenResult;let unknownFraction:Double;let mean:[Float]?;let vector:[Float]?;let hold:String?}
final class NativeEncoder{
 let tokenizer:NativeTokenizer;let table:MappedTable
 init(tokenizerPath:String,tablePath:String)throws{tokenizer=try NativeTokenizer(path:tokenizerPath);table=try MappedTable(path:tablePath)}
 func encode(_ text:String)->Embedding{
  let tokens=tokenizer.tokenize(text);guard let ids=tokens.ids,tokens.hold==nil else{return Embedding(tokens:tokens,unknownFraction:0,mean:nil,vector:nil,hold:tokens.hold)}
  let unknown=ids.isEmpty ? 0 : Double(ids.filter{$0==3}.count)/Double(ids.count);var total=[Float](repeating:0,count:128)
  for start in stride(from:0,to:ids.count,by:64){var block=[Float](repeating:0,count:128);for id in ids[start..<min(start+64,ids.count)]{guard id>=0&&id<32768 else{return Embedding(tokens:tokens,unknownFraction:unknown,mean:nil,vector:nil,hold:"invalid_token_id")};for d in 0..<128{block[d]+=table.value(id,d)}};for d in 0..<128{total[d]+=block[d]}}
  if !ids.isEmpty{let count=Float(ids.count);for d in 0..<128{total[d]/=count}}
  guard total.allSatisfy({$0.isFinite}) else{return Embedding(tokens:tokens,unknownFraction:unknown,mean:nil,vector:nil,hold:"nonfinite_vector")}
  var square:Float=0;for x in total{square+=x*x};let norm=square.squareRoot()
  let hold=norm<=1e-12 ? "empty_vector" : unknown > 0.8 ? "unknown_tokens" : nil
  let vector=hold==nil ? total.map{$0/norm} : nil
  return Embedding(tokens:tokens,unknownFraction:unknown,mean:total,vector:vector,hold:hold)
 }
}
struct Caption:Codable{let registry:String;let label:String;let text:String}
struct InventoryEntry:Decodable{let registry:String;let label:String;let captions:[String]}
struct Inventory:Decodable{let entries:[InventoryEntry]}
struct Rank:Codable{let label:String;let score:Float;let captionIndex:Int}
final class NativeRanker{
 let encoder:NativeEncoder;let captions:[Caption];private let vectors:[[Float]]
 init(encoder:NativeEncoder,captions:[Caption])throws{self.encoder=encoder;self.captions=captions;var v:[[Float]]=[];for c in captions{guard let unit=encoder.encode(c.text).vector else{throw LabError.invalid("caption encode")};v.append(unit)};vectors=v}
 func rank(_ vector:[Float]?,_ registry:String)->[Rank]{
  guard let vector=vector else{return []};var best:[String:Rank]=[:]
  for i in captions.indices where captions[i].registry==registry{var dot:Float=0;for d in 0..<128{dot+=vectors[i][d]*vector[d]};let label=captions[i].label;if best[label]==nil||dot>best[label]!.score{best[label]=Rank(label:label,score:dot,captionIndex:i)}}
  return best.values.sorted{$0.score==$1.score ? $0.label<$1.label : $0.score>$1.score}
 }
}
struct CaseInput:Decodable{let id:String;let group:String;let text:String}
struct FixtureInput:Decodable{let captionIndex:[Caption];let cases:[CaseInput]}
struct CaseOutput:Codable{let id:String;let group:String;let encoding:Embedding;let ranks:[String:[Rank]];let tokenizeMs:Double;let totalMs:Double}
struct Timing:Codable{let initializationMs:Double;let captionIndexMs:Double;let sourceSHAvalidationIncluded:Bool}
struct Report:Codable{let schema:Int;let sourceVersion:String;let mappedTableBytes:Int;let baseVocab:Int;let addedTokens:Int;let trieNodes:Int;let timing:Timing;let memory:[String:Memory];let cases:[CaseOutput];let limitation:String}
import CoreFoundation

// The R5 prefix is unchanged. This entry point only constrains transport.
struct WireRank: Encodable { let label: String; let score: Float }
struct WireReply: Encodable {
 let requestId: UInt64?; let registry: String?; let ranks: [WireRank]
 let hold: String?; let elapsedMs: Double
 enum CodingKeys: String, CodingKey { case requestId, registry, ranks, hold, elapsedMs }
 func encode(to encoder: Encoder) throws {
  var c = encoder.container(keyedBy: CodingKeys.self)
  if let value = requestId { try c.encode(value, forKey: .requestId) } else { try c.encodeNil(forKey: .requestId) }
  if let value = registry { try c.encode(value, forKey: .registry) } else { try c.encodeNil(forKey: .registry) }
  try c.encode(ranks, forKey: .ranks)
  if let value = hold { try c.encode(value, forKey: .hold) } else { try c.encodeNil(forKey: .hold) }
  try c.encode(elapsedMs, forKey: .elapsedMs)
 }
}
enum WireFailure: Error { case runtime, io, output }
func safeRequestId(_ value: Any?) -> UInt64? {
 guard let number = value as? NSNumber,
       CFGetTypeID(number) != CFBooleanGetTypeID() else { return nil }
 let d = number.doubleValue
 guard d.isFinite, d >= 0, d <= 9_007_199_254_740_991, d.rounded(.down) == d else { return nil }
 return UInt64(d)
}
func knownRegistry(_ value: Any?) -> String? {
 guard let s = value as? String, s == "shape" || s == "primitive" else { return nil }
 return s
}
func writeBytes(_ bytes: Data, to fd: Int32) throws {
 try bytes.withUnsafeBytes { buffer in
  guard let start = buffer.baseAddress else { return }
  var offset = 0
  while offset < bytes.count {
   let count = Darwin.write(fd, start.advanced(by: offset), bytes.count - offset)
   if count < 0 && errno == EINTR { continue }
   guard count > 0 else { throw WireFailure.io }
   offset += count
  }
 }
}
func emitReply(_ reply: WireReply) throws {
 guard reply.elapsedMs.isFinite, reply.elapsedMs >= 0,
       reply.ranks.allSatisfy({ $0.score.isFinite }) else { throw WireFailure.output }
 var data = try JSONEncoder().encode(reply)
 guard data.count <= 2048 else { throw WireFailure.output }
 data.append(10)
 try writeBytes(data, to: STDOUT_FILENO)
}
final class WireRuntime {
 let encoder: NativeEncoder; let ranker: NativeRanker
 init() throws {
  let local = ".local/static-japanese-v1"
  let revision = "95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3"
  let captionsPath = "experiments/static-japanese-retrieval-v1/captions.json"
  guard try shaFile(captionsPath) == "00a0483a29f2afa11d85d5019ac867d14c6b0d8ee71ac020da2bacb92ff587a8" else { throw WireFailure.runtime }
  encoder = try NativeEncoder(tokenizerPath: local + "/source/" + revision + "/0_StaticEmbedding/tokenizer.json", tablePath: local + "/tables/table-128-float16.bin")
  let inventory: Inventory = try readJSON(captionsPath)
  let captions = inventory.entries.flatMap { e in e.captions.map { Caption(registry: e.registry, label: e.label, text: $0) } }
  ranker = try NativeRanker(encoder: encoder, captions: captions)
 }
}
func wireMain() throws {
 guard CommandLine.arguments.count == 1 else { throw WireFailure.runtime }
 signal(SIGPIPE, SIG_IGN)
 var runtime: WireRuntime?
 func frame(_ bytes: Data?, overflow: Bool) throws {
  let start = now()
  func reject(_ reason: String, id: UInt64? = nil, registry: String? = nil) throws {
   try emitReply(WireReply(requestId: id, registry: registry, ranks: [], hold: reason, elapsedMs: max(0, now() - start)))
  }
  guard !overflow, let bytes = bytes else { try reject("frame_limit"); return }
  guard String(data: bytes, encoding: .utf8) != nil else { try reject("invalid_utf8"); return }
  let value: Any
  do { value = try JSONSerialization.jsonObject(with: bytes, options: [.fragmentsAllowed]) }
  catch { try reject("invalid_json"); return }
  let object = value as? [String: Any]
  let id = safeRequestId(object?["requestId"]), registry = knownRegistry(object?["registry"])
  guard let object = object, Set(object.keys) == Set(["requestId", "text", "registry"]),
        id != nil, let text = object["text"] as? String, object["registry"] is String else {
   try reject("invalid_schema", id: id, registry: registry); return
  }
  guard let registry = registry else { try reject("invalid_registry", id: id); return }
  if runtime == nil { runtime = try WireRuntime() }
  guard let runtime = runtime else { throw WireFailure.runtime }
  let result = runtime.encoder.encode(text)
  let ranks = runtime.ranker.rank(result.vector, registry).prefix(3).map { WireRank(label: $0.label, score: $0.score) }
  try emitReply(WireReply(requestId: id, registry: registry, ranks: ranks, hold: result.hold, elapsedMs: max(0, now() - start)))
 }
 var input = [UInt8](repeating: 0, count: 4096)
 var line = Data(); line.reserveCapacity(32768)
 var overflow = false
 while true {
  let count = input.withUnsafeMutableBytes { Darwin.read(STDIN_FILENO, $0.baseAddress, $0.count) }
  if count < 0 && errno == EINTR { continue }
  guard count >= 0 else { throw WireFailure.io }
  if count == 0 {
   if overflow || !line.isEmpty { try autoreleasepool { try frame(overflow ? nil : line, overflow: overflow) } }
   break
  }
  for byte in input.prefix(count) {
   if byte == 10 {
    try autoreleasepool { try frame(overflow ? nil : line, overflow: overflow) }
    line.removeAll(keepingCapacity: true); overflow = false
   } else if !overflow {
    if line.count == 32768 { line.removeAll(keepingCapacity: true); overflow = true }
    else { line.append(byte) }
   }
  }
 }
}
do { try wireMain() }
catch {
 // Never serialize the actual exception: it can contain paths or input.
 try? writeBytes(Data("wire_runtime_failure\n".utf8), to: STDERR_FILENO)
 exit(1)
}
