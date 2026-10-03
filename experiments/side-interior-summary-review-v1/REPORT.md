# Side-interior 結果index 最終監査

2026-10-03。rootの未公開indexをread-onlyで確認し、rootが反映した最終SHA `e3c6ce8cefe8dd10b6e3d6083e2ed32576605e977e5008fbc982bce440948367` を保存した。下記6点の指摘/明確化は採用済み。最終文書に追加の修正blockerは見つからない。新しい品質・実機・人間評価の合格を付けた結果ではない。

| 指摘 | 根拠 | rootの反映と採否 |
|---|---|---|
| 冒頭の作業影響を「試した」は未実施を含む | 人間評価0、ambient-study-questions READMEの評価案 | 技術3層の実験と、作業影響の評価案を分けた。採用 |
| native13を「面と骨格」と書く範囲 | v3 READMEは球/箱/メビウス＋作者10面、v4の魚/鳥/蛇が4/7/9bone | 13形は作者定義の面と動き。採用 |
| cacheの全sessionをbitwiseと読ませない | 独立COMPARISON-R2と本物Swift CPU raw | 12session/66非resetstepの素材等一致、804 CPU規定80B fields bitwise、14親条件/15attempt既知修正回帰。採用 |
| 日本語特徴の一致方法 | 709/独立20/補助4の固定数値gate | token厳密一致、浮動値は許容誤差内。新意味精度とは分離。採用 |
| 14/60の形網羅範囲 | 独立120文 REPORT、SUMMARY full | 正例60は12代表family×5で全60形一様網羅ではない。採用 |
| 材料256と文書512の単位/実操作範囲 | adapter README27、surface実UI README18、nativeambient REPORT49 | 人工契約256grapheme/512UTF16、上限全体の実入力検証ではない。採用 |

## 保存原票との一致

[静的照合](EVIDENCE-CHECK-R1.json)で以下を確認した。既存rawを読み直すだけで、candidateやmodelを呼んでいない。

- cache R2: 12session、66非resetstep、804 CPU instance。旧/new rawの16 Float32＋4UInt32規定fieldを再比較し差0。14親wire条件/15attemptすべて合格はW12修正後の既知回帰。R1の初回14/15不合格は消していない。
- native13資源: sphere/jellyfish/butterfly/saturn各約90秒・181標本。raw/summary/ROOT-VALUESでCPU1.59105〜2.01265%（1 logical core）、charged peak69.82909〜72.23536MiBが一致。400×440・白い人工1537保存/1536描画、推論/履歴なし、M5/32GiBの一つの対象PID。別offscreen R5並走を含み、無負荷PC/一般16GB/全13形の資源ではない。
- 日本語lean CLI: 1382callの別短batch、time-l終了max resident45,645,824B＝43.53125MiB（丸め43.53）。Python driverやwidgetは別。charged footprint、8MiB table file、RSSを同じ値にせず、native13と合算しない。
- 検索full: AI人工120文、positive60にhit14/accepted22/wrong8、no_shape40に誤反応2、unresolved20にhold18。description3/36、narrative1/12。既定採用見送り、60形一様網羅/実生活率/人の楽しさではない。

## 履歴・上限・テーマの範囲

素材256は追加イベントごとのoperation-local grapheme unitであり、256 UTF16文字ではない。旧人工cluster境界ではbody256で累積65,536 UTF16を保持できる。文書512はcanonical/adapter契約で、AppKitのあらゆるraw control変更や実IME経路の上限認証ではない。

既存Webのlocal ShapeCycleはactive viewing30秒、phrase hold60秒で、pause等を除外し長い中断後に1遷移する。周期変更を初めて提案した機能と扱わず、快適性で選んだ製品値にもしていない。全入力素材の用途と、命令/意味の採用policyは別。

保存された13形実窓は05:47〜05:59、Web専用欄のASCII確認は06:53。後のnative16/新ambient実窓はMac lockで未確認。現在ロックか解除済みかをこの監査で調べず、履歴だけを記す。Web実操作を日本語IME一般・容量全体のACK・bodyID個数の実観測へ広げない。

研究テーマは候補、仕事との共存・快適性・新規性・目標実機・未見意味・人間評価は未達として記す現在の区分が妥当。文字面/骨格の移植と、任意文から新規mesh生成は別。人間評価0をroot QA操作で増やさない。

100分CLIはMETHOD-R1だけを読み、実行完了や資源結果を一切補完しない。最終結果はrootが別README/REPORTに残す。indexは方法リンクのまま固定される。

## 確認方法と未確認

[36参照SHA](SOURCE-PIN-R1.json)。indexのlocalリンク17件はすべて存在、外部リンク3件は取得していない。公開Web/Releaseのremote現在状態をこの監査で新たに確認したものではない。保存原票の既存数値を静的に照合し、runtime/UI/OS/GPU/model/外部呼出し、共有source/doc/Git変更は0。新folderだけに資料を作った。
