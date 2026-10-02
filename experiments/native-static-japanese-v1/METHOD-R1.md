# Native tokenizer / F16 CPU parity METHOD R1

2026-10-03。元実験をread-onlyにし、native結果を見る前にモデル/原資料/455旧文＋人工edge期待値をEXPECTED-FREEZE-R1.jsonで固定する。Swift移植sourceは初回run前に別SOURCE-R1.jsonへfreeze。誤差閾値を結果後に緩めない。修正が必要ならR1source/失敗出力を残しR2へ。

## 既存modelと固定source

model hotchpotch/static-embedding-japanese、revision95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3。既存author metadata/CardのMIT確認を引き継ぎ、今回再download/再学習はしない。元weights32768×1024F32のfirst128をF16へ変換した取得済みtable8388608B、SHA65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201。tokenizer2127941B、SHA833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9。

tokenizers0.22.1（既存requirements-lock）をoracleにする。公式tagv0.22.1はcommit afaae088837b277c19f90604a1111a272838857bへ解決。8sourceはupstream/MANIFEST.jsonでURL/SHA固定、閲覧のみでremote codeは実行しない。Apache2 licenseをupstream/LICENSEへ同梱し、Swift算法の出所を記録する。

- [Unigram model.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/unigram/model.rs): from/encode_optimized/tokenize。min_score−10のUNK score、全prefix、float64 cumulative score、strict greater更新、UTF8 scalar単位でfallbackを入れる。fuse_unk=true、byte_fallback=false。
- [Unigram trie.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/models/unigram/trie.rs): common-prefixが短いterminalから順に出る。
- [unicode.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/normalizers/unicode.rs): Nmtのremove/map→NFKC。
- [normalizer.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/normalizer.rs): lowercaseはwhole-string contextでなく各Unicode char.to_lowercase。Swiftもscalarごとに変換。
- [metaspace.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/pre_tokenizers/metaspace.rs): ASCIIspaceを▁、always prepend、MergedWithNext split。trimや連続space collapseを足さない。
- [added_vocabulary.rs](https://github.com/huggingface/tokenizers/blob/afaae088837b277c19f90604a1111a272838857b/tokenizers/src/tokenizer/added_vocabulary.rs): non-normalized special66をnormalizerより前にleftmost-longest抽出。maskのみlstrip、他single_word/lstrip/rstrip/normalizedはfalse。literal specialはIDへ、postprocessorのautomatic BOS/EOSはadd_special_tokens=falseで無効。byte/character offsetの完全移植は本版のgateに含めず、ID/pieceを比較する。

## runtime範囲と数式

Foundation Unicode NFKCとscalar lower、Swift UTF8 trieによるUnigram DPを実装する。FoundationとRustのUnicode表versionをすべて一致とは断定せず、固定caseで確認した範囲を報告。対応しないmodel schemaは拒否。句全体をgreedyにすることや、UNKを一文字ごとの独立IDへ変える近似をしない。

table read-only mmap(MAP_PRIVATE/PROT_READ)、32768×128 little-endianFloat16→Float32。64tokenごとのFloat32 sequential accumulation、そのchunk totalをFloat32へ加え、token数で割る。L2はFloat32で計算する。NumPy reductionの加算順の影響はgateで分ける。captionベクトルは既存captions343を同処理、shape60/primitive6を別registry、labelごとの最大caption cosineを採りscore降順/label昇順。学習/閾値/alias guardの改良は行わず、rawrankのみ比較。

元encoderと同じ入力4000Unicode scalar/token4000まで、超過cropなしhold。空vector、unknownFraction>.8、nonfiniteをhold。UNK ratioだけで十分なunknown検出になるとは主張しない（元のfusedUNKの問題を保存）。UTF16/graphemeとscalar母数は区別する。normalization expansionに上限32768UTF8 byteを置くnative safety追加は元oracle範囲との差として表示し、4000scalar入力でこれを越すcaseは本parity外とする。private本文は入力しない。CLI JSONLの人工入力のみ。

## 固定期待値と判定gate

元455はcalibration112＋captions343を順序どおり使用、old numerical-checksの455に対応。旧品質評価のreuseであり新しいtest精度ではない。各textのID/piece/normalizer出力/pretokenizer出力、F16mean128/L2 vector、shape/primitive rawscore rankingを既存venvで固定。人工edgeは空白/control/Nmtmap/NFKC expansion/GreekΣ/İ/ligature/combining/emoji非BMP/Metaspace literal/66special＋masklstrip/lengthbound/UNKを事前固定。full table readや巨大teacherを追加しない。

- IDsとpiece順序: **全case exact一致必須**。max old455・edgeを分ける。
- normalization/pretoken strings: exact、Unicode表差は不一致を隠さずcase数で表示。
- mean/L2 vector、cosine score: absolute error≤1e-5、finite必須。
- rawTop1 label: strict exact、shape/primitive別。全rank順/caption選択のexactも記録し、完全順位parityとtop1を混同しない。score差>2e-5のpairは逆転を許容せず、≤2e-5のnear-tieは別件数で表示。gateを後から変えない。
- hold/meta: empty/input/token/unknownを一致比較。native byte safetyのみ明示差分。

## CPU/footprint

SDKCLI optimizedSwift build、GPU/UI/OS取得なし。read-only sourceSHA/weightSHAを毎run検査する。tokenizer JSON parse/native trie buildingと常駐後queryを分ける。cold init/first query/warm per-query p50/p95/p99/max、tokenization/mean/rank別のCPUwalltimeを人工fixtureで記録。mmap file bytesとprocess resident/physical footprint/maxRSSを分ける。Darwin getrusage ru_maxrssはbytes、task_info resident/phys_footprintはprocess全体。mapping sizeはresident weight量ではない。JSON oracle読み込み/test出力込みのpeakと、小さなquery CLIのpeakを区別。Windows16GB・電力・全app RAM・長期常駐は未測定。

旧static fresh140の品質は過去の同model/caption/閾値の人工成績で、今回Native速度/RAMで新しくなった精度ではない。nativeでtokens/mathが一致しても、意味一般化/default採用/任意text-to-mesh/comfort改善は主張しない。
