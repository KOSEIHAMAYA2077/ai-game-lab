# Native ambient cache comparison R1

固定した R3 の本文・ID を、同じプロセス内の JavaScriptCore から Swift の表示 view へ渡す比較版です。旧 immutable native Build R5 と人工入力・人工時計・既存 80B 描画 instance を比較しました。通常の待機 tick では全文 JSON と全 prefix の再検算を行わず、小さい metadata だけを転送します。素材の追加時だけ新しい ID 範囲を受け取り、表示が追いつくときは受信済み view を使います。

採否は **限定された CPU/source 候補として受理、実窓・実 IME・小窓全体の資源は未確認** です。Mac はロック中で、アプリの UI 起動、OS 取得、GPU 実行、権限操作は行っていません。これは黒い空間と専用入力欄を持つ既存比較版の別 namespace であり、通常 60 形や既存アプリを置き換えません。

- [REPORT](REPORT.md): 結果、原失敗、比較の限界。
- [CPU API](CPU-API.md): session/generation/delta と reset の境界。
- [再現手順](REPRODUCE.md): repo root からの相対コマンド。
- [事前 METHOD](METHOD-R1.json)、[native14](fixtures/native14-r1.json)、[core3](fixtures/core3-r1.json)、[不正 wire8](fixtures/invalid8-r1.json)。AI が手書きした期待で、人間の意味評価ではありません。
- [immutable candidate/app pins](CACHE-CANDIDATE-R1.json)、[SUMMARY](SUMMARY-R1.json)、[runtime/source audit](RUNTIME-AUDIT-R1.json)。
- [CPU 原票](results-native-r1/cpu-report-r1.json)、[初回 Node](results-node-r1/core3.json)、[検査側 R2](results-node-r2/core3.json)。
- [局所 timing 初回](results-timing-r1.json)、[同じ workload の再計測](results-timing-r2.json)、[Unicode 上限の既知回帰](results-boundary-r1.json)。
- [公開ログ provenance](PUBLIC-LOG-PROVENANCE-R1.json): 原ログは ignored `work/private` に保持し、公開版だけ trace の個人パスを置換しています。status・assert・期待値は変えていません。

新アプリは `work/GlyphMatter-Ambient-Cache-R1.app`。build/sign/strict verify は成功、元 shader・OwnEditor R2・renderer の bytes は一致しています。`work` は公開 source に含める実行成果物ではなく、この Mac の凍結比較成果物です。実操作は root 所有で、今回は行っていません。
