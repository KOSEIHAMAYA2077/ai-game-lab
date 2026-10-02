# 再現と公開 CLI 契約

以下は repository root を作業 directory にする。取得済み model と venv は read-only。model の再 download は不要で、native CLI の実行には venv/Python/tokenizers/PyTorch を使わない。Apple SDK の Swift/Foundation/CryptoKit/Darwin が必要で、この版は macOS arm64 向け。既存原票に出力を上書きしない。

## 最終候補と検証用 rebuild

[BUILD-R5.json](BUILD-R5.json) の固定 source/binary SHA を使う。別名への rebuild 例:

```sh
swiftc -O experiments/native-static-japanese-v1/NativeStaticR5.swift \
  -o experiments/native-static-japanese-v1/native-static-local-rebuild
```

input model の canonical path と SHA:

| 参照 | repo relative path | SHA256 |
|---|---|---|
| 128F16 table | `.local/static-japanese-v1/tables/table-128-float16.bin` | `65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201` |
| tokenizer | `.local/static-japanese-v1/source/95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3/0_StaticEmbedding/tokenizer.json` | `833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9` |
| caption inventory | `experiments/static-japanese-retrieval-v1/captions.json` | `00a0483a29f2afa11d85d5019ac867d14c6b0d8ee71ac020da2bacb92ff587a8` |

CLI は tokenizer/table の SHA と schema/size を毎起動検証する。caption index の外部 path は受け取れるが、元 inventory の固定 SHA は実験 manifest で検査する。candidate 比較では固定 caption を使う。外部 input や downloaded code を実行する機能はない。

## JSONL request / response

```sh
printf '%s\n' '{"text":"青い球の人工文","registry":"shape"}' \
  | experiments/native-static-japanese-v1/native-static-r5
```

1 request＝1 JSON object＝1 line。`text` は String、`registry` は `shape` / `primitive`、省略時 shape。shape は既存60 label、primitive は旧6 labelの別 registry。newline は JSON escape 内に入れ、line を分けない。reply は各 request の後で明示 flush する。EOF で終了する。

reply の schema（下の `{...}` / `[...]` は説明用でそのまま有効 JSON ではない）:

```text
{
  encoding: {
    tokens: {ids:[Int], pieces:[String], normalization:String,
             pretokenizedWholeNormalization:[String], hold?:String},
    unknownFraction:Double, mean?:[Float32 x 128],
    vector?:[Float32 x 128], hold?:String
  },
  ranks:[{label:String, score:Float32, captionIndex:Int}],
  elapsedMs:Double,
  memory:{residentBytes:Int, physicalFootprintBytes:Int, maxRSSBytes:Int}
}
```

optional nil field は Swift JSONEncoder により省略する。hold は `encoding.hold` を見る。hold 時 unit vector はなく rank は空。token/input limit では mean もない。empty/unknown policy は mean が残る場合がある。`tokens.normalization` / `pretokenizedWholeNormalization` は whole text 診断で、literal special を先に抽出した実 encode 経路そのものではない。

raw rank の score は cosine、label 最大 caption score、captionIndex は343 flattened caption の global index。score が高いだけで accept/形変更しない。別の意味 confidence/否定/ambient policy は本 CLI に存在せず、呼出側へ勝手に追加しない。

decoded text は 4000 Unicode scalar、token4000、normalization262144 UTF8 byte 上限。超過は crop せず hold。外側 JSONL line byte bound は未実装で、malformed JSON/未知 registry は stderr error と exit1。人工 fixture と短い driver で使うための実験 API であり、未信頼 OS/adapter stream 用の production protocol ではない。本文を外部送信しないが、stdout の piece/normalization に文字が載る。private text を投入・保存しない。

`--model-dir` は既存 model directory の別 location、`--captions` は inventory path を指定できる。model 内容が異なれば固定 SHA で拒否する。私有 path は文書に記載しない。

## 既知 709 回帰

保存した oracle を使い、新しい出力名へ:

```sh
experiments/native-static-japanese-v1/native-static-r5 \
  --fixture experiments/native-static-japanese-v1/EXPECTED-R1.json \
  --output experiments/native-static-japanese-v1/NATIVE-LOCAL-R5.json
python3 experiments/native-static-japanese-v1/compare.py \
  experiments/native-static-japanese-v1/NATIVE-LOCAL-R5.json \
  experiments/native-static-japanese-v1/PARITY-LOCAL-R5.json
```

fixture mode は input text/caption だけを Decodable で読み、保存 oracle の expected 値を native に渡して出力を作らせない。比較 driver だけが expected 値を読む。Python は比較用であり native process とは別。

oracle の再生成は元の `.local/static-japanese-v1/venv/bin/python`、tokenizers0.22.1/NumPy2.0.2、[freeze_expected.py](freeze_expected.py) による。ただし original は freeze 済みなので、再生成するなら別 experiment folder と別 output 名へ移す。original EXPECTED を上書きしない。709 の内容を改良用に使った後は未見とは呼ばない。

## 計測の再現範囲

[bench_lean_r5.py](bench_lean_r5.py) は [METHOD-LEAN-CPU-R5](METHOD-LEAN-CPU-R5.md) の 1382 call と timeout を実装する。保存名を再利用せず別名で走らせる。`time -l` は native 子 process、Python driver は timing/peak 母数外。callback/GUI/GPU/body/adapter を起動しない。

結果は [LEAN-CPU-R5](LEAN-CPU-R5.json)、全 output の parity process は [NATIVE-R5](NATIVE-R5.json)。両者の peak は別母数。HOST-R5 の CPU/OS/SDK と、SOURCE/BUILD/EXPECTED の SHA を合わせて読む。短い synthetic batch の再現で、独立意味品質・全 app・Windows・電力・長期常駐へ一般化しない。
