# R1結果

**このMacのJavaScriptCoreは、固定R3の人工契約をWebViewなしで処理できた。** 今回はCLI候補までで、native appへ採用する判断ではない。既存source、R3閾値、shape候補、ID allocatorは変更0。

METHOD SHA `faaaeb054116d82e53d822ec3e1d48b93c380a9eaf34ef1bf2fab9c3d9f6ba84` とCOMPARISON SHA `057bba1a924cc9fa78b30add544c091d27ba9661d3281d09d340656cd3efc57e` を実装前に固定。元人工CASES SHA `c7ffe342746c2c83d76d2721ae39a5440af3502db9d0cdf29082daaa826be208` は同byteで新folderに複写した。

| 観測 | Node-vm | JavaScriptCore |
|---|---:|---:|
| 元manual expected | 20/20 | 20/20 |
| assertion | 2571 | 2571 |
| actual receive | 120 | 120 |
| actual lexical queries | 18 | 18 |
| 同case意味出力一致 | 20/20 | 20/20 |
| 最終complete output一致 | true | true |

ACK、checkpoint、inspect、readonly body view、shape pending token、finite histories、元off/on artificial exportを比較した。キー順のみ無視、array順・本文Unicode・ID・ink・数値は一致を要求した。engine診断やdurationは意味一致に入れない。JSON化された観測出力の一致であり、全JS private heapのbit一致ではない。

各stepでbody<=bodyLimit<=256、ID1..n / nextId n+1、doc<=512 UTF-16、preview<=64、window<=128、recent<=64、pending<=1、history<=64、counter<=1e6、reveal<=4と単一body/ID所有を確認した。C12のlater combining markとemojiを元insertion-local graphemeのまま扱い、元のthrowing protected payloadは一度も読まないケースを保持した。C17だけ元の明示artificial opt-inでon exportを検証し、filesystem保存を実装していない。

generated IIFEは42,915B、SHA `a8634a0e792da0e44aeaf7a48abef44af0eb95aacc96c65e84bcf8f48e1f2ed5`。前後hash一致、frozen owned inputs9/9・readonly inputs9/9一致。native hostへ渡すfileはNodeが読んだ同じselected bundle。コンパイル/実行exit0、native stderr空。R1失敗はなくR2を作る必要は無かった。

## builtinと環境

両realmのIntl.Segmenter / Array.toReversed / Object.hasOwnはfunction。TextEncoder / structuredClone / fetch / document / window / process / require / clipboardはundefined。R3はTextEncoderやstructuredCloneを必要としない。fixture constructorのJSONだけを複写する補助は `JSON.parse(JSON.stringify(...))` であり、graphemeの代替には使わない。polyfill0、JSへnativecallback/FS/OS入力API注入0。

installed Swift6.3.2、実SDK26.5 /build25F70。事前METHODのSDK26.0はswiftc target表記からの誤推定だったので、METHODを上書きせず実環境訂正を別に残した。binaryのlink metadataはJavaScriptCore current624.2.5、Foundation等で、WebKit/WebView directlink/importは無し。これが別macOS/JSC版本でも動く保証ではない。ICU/grapheme versionsの全Unicode差は今回20ケースで網羅していない。

## 限界

同じ作者が元R3/fixtureも作った既存回帰であり、別の人体験や独立annotationの検証ではない。renderer / Metal / WebView比較資源 /実native editor /実IMEは接続0。knowncommitは信頼した人工producer宣言のままで、JSONに載せたからOS確定証拠になることはない。原JSONのunreadableDataはJS内でgetterを再構築して検証するので、getterをnative入力で認証した試験ではない。

host入力は固定した人工JSONだけ。1MiB guardはreadDataToEndOfFileで読んだ後に検査するため、任意stdinに対するhost RAM上限や安全なstream backpressureを保証しない。出力16MiB guardもJS結果生成後のhost検査であり、R3の有限状態以外を含む任意fixture expansion/CLI heapの厳密上限ではない。untrusted任意入力用CLIとしての採用はしない。Node-vmもcodeGenerationを止めた人工比較用realmであり、security sandboxの主張はしない。

raw結果の本文は人工のみ。future appではprivate body/readviewはvolatile、公開exportはR3 strict off aggregateを使う。今回の人工raw loggingを実文に流用しない。性能/RSS/CPU/GPUの測定は実施0、CLI値をwhole-window resourceへ換算しない。
