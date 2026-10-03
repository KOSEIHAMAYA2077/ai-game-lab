# 再現と保存原票

repo rootを作業位置とし、macOS SDKのswiftc / JavaScriptCore、既存Node、既存Python3を使った。依存library・modelは追加していない。下記は**初回実行時のコマンド記録**で、出力は既存ファイルを上書きしない。再実行する場合は新helper revisionと別output pathを先に固定し、旧freeze/results/sourceを残す。本資料で余分な再callを実施していない。

1. 旧source・独立case・METHODをFREEZE-R1.jsonへSHA固定。候補未読、旧reference callも0の時点。
2. reference-node-r1.mjsで旧immutable Receiver.jsを同case実行しOLD-NODE-R1.jsonへ。OldJSCReference-R1.swiftを旧GeometryTypes/Projectionとcompile、OLD-JSC-SWIFT-R1.jsonへ。手書き期待12/12とengine差0を保存。
3. 候補manifest/source/app SHAをCANDIDATE-PIN-R1.jsonへ。候補API対応だけWIRE-MAPPING-R1/MAPPER-R1へ固定。helperR1 compile不合格を保持しprint構文を別helperR2へ。
4. candidate-node-r1.mjsとcandidate-review-r2で初回candidateR1を一度実行。COMPARISON-R1とREPORT-R1へW12不合格を残す。
5. 作者candidateR2別pin/appをCANDIDATE-PIN-R2/CANDIDATE-SOURCE-PIN-R2へ。helperR3を別compileし、BEFORE-R2-CANDIDATE-CALLS-R3へ固定後一度実行。JSはR1同byteなのでNode再call0。同caseをknown regressionとしてCOMPARISON-R2へ。

旧helper build（review folderを作業位置）:

```sh
swiftc -O Old-GeometryTypes.swift Old-Projection.swift OldJSCReference-R1.swift -framework JavaScriptCore -o old-jsc-reference-r1
```

初回候補helper compile（review folder）:

```sh
swiftc -O Candidate-GeometryTypes.swift Candidate-Projection.swift Candidate-ReceiverBridge.swift CandidateReview-R2.swift -framework JavaScriptCore -o candidate-review-r2
```

修正後helper compile（review folder）:

```sh
swiftc -O Candidate-GeometryTypes.swift CandidateR2-Projection.swift CandidateR2-ReceiverBridge.swift CandidateReview-R3.swift -framework JavaScriptCore -o candidate-review-r3
```

helperの実行はrepo root（appは起動せずReceiver.jsをJSCへ読むだけ）:

```sh
experiments/widget-metal-ambient-cache-review-v1/candidate-review-r3
```

保存結果の静的比較（review folder、candidate call0）:

```sh
python3 compare-r1.py CANDIDATE-JSC-SWIFT-R3.json COMPARISON-R2.json
```

命名に注意: CandidateReview-R2/CANDIDATE-JSC-SWIFT-R2は**helper R2＋candidate R1**、CandidateReview-R3/CANDIDATE-JSC-SWIFT-R3は**helper R3＋candidate R2 known regression**。CASES-R1/METHOD-R1/WIRE-MAPPING-R1は不変。metadata/query clockとprojectionTimeの二つは別で、後者はsynthetic presentationborn条件。

最終QAはJSON parse、固定SHA、relative Markdown link、generic private-path pattern、source/binary/outputのSHAを照合する。QA scriptはcandidateを呼ばない。RETURN-MANIFEST-R1.jsonから公開対象を選べる。OS/GPU/UI/実IME/model/全アプリresourceは再現範囲に含めない。
