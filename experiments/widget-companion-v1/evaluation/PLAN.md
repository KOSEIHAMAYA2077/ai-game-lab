# 常駐版を独立に確認する計画

2026-10-03。評価担当が実装前に固定した計画。実装・主画面・モデルを編集せず、数値が出る前に合格条件を達成済みと書かない。

## 参考にする体験

[Desktop Heroes の開発元 press kit](https://press.telazer.com/sheet.php?p=desktop_heroes)は、画面下の小範囲で他の作業と並行して動くこと、必要な時だけ関与すること、背景のクリックや文字の可読性を保つ Virtual Mode / See Protect Mode を説明している。[開発元のゲーム一覧](https://telazer.com/)も画面下に静かに常駐する設計を説明する。

ここから参考にするのは、小窓・穏やかな動き・他の作業を邪魔しない操作である。素材、ゲーム進行、宣伝文句を模倣しない。公式説明には常駐時の実 RAM・CPU の測定がなく、Desktop Heroes 自体の軽さを数値の根拠にしない。

## 環境と数値の意味

今回の実機は Apple M5 / 32GB macOS。16GB laptop CPU/iGPU の実測に代えない。ダウンロード量はディスク転送量であり、モデル展開後や常駐アプリの RAM とは分ける。

専用アプリの主プロセスと、その起動で生じる WebContent / Networking / GPU プロセスを起動前後の差・bundle 名・終了時の消滅で帰属する。XPC プロセスは親 PID が launchd になることがあり、親子ツリーだけで関連プロセスを除外しない。既存ブラウザの同名プロセスを勝手にアプリへ加算しない。帰属できない共有サービスがあれば別に記録する。

必要なら測定専用 helper で [Apple の private diagnostic ABI](https://github.com/apple-oss-distributions/xnu/blob/main/bsd/sys/proc_info_private.h) の coalition ID も比較する。この ABI は公開アプリの動作には使わず、取得できなければその旨を記録する。coalition が一致するだけで関係を確定せず、起動・終了との一致も確認する。

メモリは `proc_pid_rusage` の `ri_phys_footprint` を主指標とし、プロセスごとの値と選んだ関連プロセス群の合計を示す。合計は macOS が各プロセスへ計上する footprint の集計で、共有ページを完全に重複除外したシステム RAM 差分とは呼ばない。RSS、JS heap、モデル取得量も区別する。[Apple のメモリ計測解説](https://developer.apple.com/videos/play/wwdc2022/10106/)は footprint を主指標とし、Apple Silicon では CPU / GPU 資源も含むと説明する。[API の公式実装](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/bsd_kern.c)も resident size と footprint を別に取得している。

CPU は各プロセスの user + system 累積 CPU 時間の差を経過時間で割り、`CPU秒 / 実時間秒 × 100` とする。1論理コアを使い続けると100%。ホスト全コアで割らない。描画 hook のフレーム数と1回の計算時間を並べ、FPS 制限だけで軽量化成功としない。GPU 使用率や電力は、実際に取得できなければ未測定とする。

`ri_user_time` / `ri_system_time` は Mach ticks のため、`mach_timebase_info` の numer/denom を128bit中間値で掛けてナノ秒へ換算する。[公式 XNU の取得元](https://github.com/apple-oss-distributions/xnu/blob/main/osfmk/kern/task.c)は `rm_time_mach` を返す。測定前に、このMacで約0.5秒のCPUループを測り、換算後が1コア約100%になることを校正する。換算しない値をナノ秒と呼ぶと、このMacでは約41.7倍過小になる。

## 固定した確認項目

1. 同じ文で形状 Program が以前の版と変わらず、文字が面を流れる。
2. 白い文字の後へ青い文字を入れ、以前の文字・色を保持する。追加分だけ青くなる。
3. 解釈完了後 Worker が終了し、次の入力では新しい Worker で再び解釈できる。
4. 停止・非表示の間、位置更新と描画の回数が増えない。再開時に長い時間差による飛び跳ねを起こさない。
5. 通常表示は15fps、吸収中は30fpsが上限。通常時の1回描画 CPU 時間 p95 を測る。
6. リセット・中断後に遅れたモデル応答が以前の文字を復活させない。
7. 一般文・未知の形では以前の形を残し、入力文字は追加する。
8. 関連プロセスの実メモリは、起動直後・通常表示・モデル解釈ピーク・解釈後・停止・非表示・時間経過で比較する。

最初の候補予算は通常200MiB程度、解釈中512MiB以内、穏やかな表示で1コア換算 CPU 5%以内・描画 p95 3ms以内。いずれも未検証の設計目標。満たさなければ値と差を報告する。20分程度の放置観測が作業時間内に可能なら行うが、30分・2時間試験と読み替えない。

## 手順

`fixture.json` を UI 試験の前に保存する。意味精度の新しい評価としては扱わず、保持・再入力・描画制御の回帰を中心にする。関連プロセス調査の原票や画面はローカルの非公開領域、公開する結果は人工文と数値・帰属理由のみ。使用したソースとビルドの hash、操作した順番、測定窓、失敗例を残す。
