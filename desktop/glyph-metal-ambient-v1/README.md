# Native editor → ambient surface comparison

専用の自作 `NSTextView` から、固定 R3 receiver が所有する文字 body / ID を既存 Geometry R3 の Metal 表示へ渡す独立比較版。Enter は送信操作にしない。既定60形、旧native版、旧保存状態は変更しない。

現在の候補は **Producer R2 / Bridge R2 / Build R5**。R1 の人工取消callbackで仮文字を素材化する失敗と、Bridge R1で合法な大きいbodyのJSON応答を拒む失敗があり、旧source・app・結果を保存して別版で修正した。作者の実native窓・実IME・常駐資源確認は0。Mac locked のため実操作の採否はrootへ返す。製品版やOS連動の達成ではない。

唯一の素材所有者は元 R3。native renderer は `readBody` の提示済みprefixから、同じ ID / 原文UTF-16 / 色を持つ view と表示座標を派生するだけ。新しい `Matter.add`、文字ID生成、文字の再分割はない。empty の `@` は別 `NSTextField` の仮表示であり、素材・atlas・描画instance は0。

形は字句ルールの球／箱／輪だけ。表示は sphere／cube／Mobius。**普通の輪をMobiusと同じ意味・形と扱わない**。16面・60形の意味モデルではない。旧色は保持し、色の選択は追加する文字だけに適用する。削除・undo・redo後も body を残す扱いは暫定。

この欄の `insertText` で、元本文・宣言range・追加文字・更新後本文・marked無しの条件が一致した場合だけ local producer の確定宣言を送る。これはOS/IME全般の確定証拠ではない。変換中・未知変更は0追加。一般 `unmarkText` は通常挿入を意味する場合もあるが、本比較は曖昧な経路を保守的に document-only と扱い、取消中の再入 `insertText` を素材化しない。実IMEによっては取りこぼす。

R3 body256 grapheme／本文512 UTF-16／単発256 UTF-16。初期本文は自動素材化しない。永久容量holdは全文書更新を受けても素材追加0、旧IDを保つ。nativeproducerはadmission常時readyの限定subsetで、temporary no-ACK の協調retry APIは公開しない。無損失取得とは呼ばない。

原文、glyph、復元可能ID列、色順、query、windowは volatile。通常の保存・rawログ・model・外部request・OS hook・clipboard自動取得はない。明示的な `--diagnostics-file` は count/shape/status/frame 等の集計だけを書く。`PAUSE` と非表示は描画予約・receiverの解釈/提示を止める設計。15fps設定の実present上限や実窓hideは未測定。

採否・失敗・人工原票は [比較記録](../../experiments/widget-metal-ambient-v1/README.md) と [再現手順](../../experiments/widget-metal-ambient-v1/REPRODUCE.md)。旧 `build.sh` と `build-r2.sh` は失敗保存用。現在のアプリはrepo rootから次を使い、新しい出力先を選ぶ。

```sh
bash desktop/glyph-metal-ambient-v1/build-r5.sh --output experiments/widget-metal-ambient-v1/work/GlyphMatter-Ambient-RepeatR5.app
```

コンパイル対象の入力欄は `Sources/OwnEditor-r2.swift`、bridgeは `Sources/ReceiverBridge-r2.swift` のみ。各R1と同時にコンパイルしない。現在の実行入口は `Sources/AppMain-r3.swift`。固定JS bundleの生成手順は再現文書を参照する。
