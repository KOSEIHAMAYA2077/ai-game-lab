# 常駐・待機を測るための別実験案

この文書は方法案で、モデル・小窓の新しい計測を実施した記録ではない。今回の固定driver R2はqueryを終えるとowned serverを停止するため、10分のidleを確認した結果にはならない。

## 分けて測る状態

同じartifact・runtime・context・promptを固定し、次の状態を各10分、順序を入れ替えて3回ずつ比較する案。冷却・電源接続・画面解像度・他アプリ作業を記録し、Windows16GBの同条件も別に行う。

1. 小窓だけ表示。モデルserverなし。無入力のrenderer基準。
2. モデルを読み込んだ直後のserver単独idle。最初のquery前。
3. 固定した1 query後のserver単独idle。cache/KV/作業領域が残った状態。
4. 同じquery後にowned serverを通常終了し、小窓だけ表示。全体RAMが戻ったか。
5. 小窓とモデルを実接続。1分に1度の要求、2分に1度、入力休止時だけを別比較。
6. 小窓を停止、非表示、再表示する。各状態でrenderer提出数と全体CPU/RAMを対応させる。

query前後30秒は1秒周期、安定idleは5秒程度の観測にする案。測定用poll自体のプロセス時間を別記録し、常用アプリへ監視器を追加しない。250ms samplerの数値とは観測周期が異なるため、短いpeakの順位にそのまま混ぜない。

## CPUとmemory

CPUはkernel+userの累積時間の差をwall時間差で割り、1論理コア100%として表示する。総コア数で割ったsystem全体百分率も出す場合は別列にする。例えば4コアを同時に使うと前者は400%に近づき得る。累積時間の丸め・権限不足・process終了による欠測は0とせず、欠測として残す。

Windowsは[GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes)でkernel/userの総和を得られる。各threadの時間を合算するためwall timeを超え得る。[PROCESS_MEMORY_COUNTERS_EX](https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters_ex)はWorkingSet/PeakWorkingSetとPrivateUsageを別に持つ。PrivateUsageはcommit量で、RSSと同じ量ではない。

MacもRSSだけに絞らず、可能なら[Appleのtask_vm_info定義](https://raw.githubusercontent.com/apple-oss-distributions/xnu/main/osfmk/mach/task_info.h)にあるresident、compressed、phys_footprintを区別して採る。取得可能なrevisionと権限を記録し、値を取得していない今回のRSSをfootprintへ読み替えない。

server単独値はrenderer、文字atlas、UI、driver、共有browser、OSのpage cache等を含まない。単純に全プロセスRSSを足すと共有pageを二重に数える場合がある。小窓のprocess treeを列挙し、個別のprivate/footprintとOS全体のpressure/swapを併記する方法を対象OSごとに決める。

## 記録するもの

artifact/runtime SHA、model/architecture/quant/context/thread、host CPU/RAM/OS、電源・温度条件、所有PIDの生存/開始同一性、wall clockとmonotonic、累積CPU、RSS/footprint/commit、GPU提出・実測可能な利用率、page fault、pressure/swap、描画数、入力数、モデル要求数を保存する。実作業の文は公開原票へ入れず、計測用の人工入力列を使用する。

モデルを終了してprocessが消えたことと、OSのfile cacheがすぐ消えたことは別である。バッファや関連processが残る場合もあるため、終了後2分のbaseline復帰と、2時間の増加傾向を確認する。OS cacheを強制削除して良い値を作る操作は行わない。電力を測っていない場合は、低CPUを省電力達成と呼ばない。
