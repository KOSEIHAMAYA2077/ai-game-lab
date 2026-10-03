# native StaticEmbedding CLI 100分観測・独立監査

固定旧R5を100分枠で保持した一回の観測について、保存済み原票だけを照合した。通常20件＋長文hold4件、24返信、ps600/600、exit0、8固定入力不変を確認した。これは常駐アプリ・連続生成・意味精度・8時間稼働の試験ではない。

[REPORT](REPORT-R1.md)、[最終照合](FINAL-01.json)、[境界補足](FINAL-BOUNDARIES-R1.json)、[事前監査METHOD](METHOD-R1.md)、[途中監査とhelper失敗](PRECHECK-R1.md)、[helper訂正](HELPER-CORRECTION-R2.json)。

原票の再照合はrepo rootで次を実行する。モデル/ps/OSを起動しない保存ファイルの算術だけ。新output名を使い、既存最終結果は上書きしない。同じ原票の再照合は既知の回帰である。

```sh
python3 experiments/native-static-longrun-review-v1/audit_r2.py --output experiments/native-static-longrun-review-v1/FINAL-replay-02.json
```

raw/model/sourceを更新しない。このreviewは原票folderが存在することを前提にし、実行binaryやmodel tableを公開packへ複製しない。公開とGitはrootが所有する。
