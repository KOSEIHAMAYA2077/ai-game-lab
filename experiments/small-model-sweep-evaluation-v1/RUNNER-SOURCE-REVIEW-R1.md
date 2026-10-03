# 実行・集計の境界を独立確認

2026-10-03、モデルの返信を受け取る前に `run_r2.py` を読み、純粋なJSON解析関数だけを4人工文字列で呼び出した。serverの起動、HTTP、モデル推論、driver編集は0件。固定した評価の6ファイルはSHAがすべて一致した。原票は [RUNNER-SOURCE-REVIEW-R1.json](RUNNER-SOURCE-REVIEW-R1.json)。

1. 一件が30秒のquery timeoutになると、driverはそのモデルのbatchを終了し、残りを `unattempted_case_ids` に保存する。固定24件の得点では未試行も0点だが、観測した意味誤答とは分けて報告する。
2. HTTP500の通常のerror envelopeに `choices` がない場合、`http_status=500` と原HTTP bytesは保存されるが、ケースのstatusは `invalid_response` になり、次のケースへ進む。grammar・runtime・chat templateの非互換はHTTP statusとserver logから別に確認し、文章理解の誤りと混ぜない。
3. driverの `strict_json` はキー重複を拒否しない。人工の重複 `action` キーを渡すと、後の値を読んで `contract_ok=true` となることを確認した。独立採点器はその同じ人工文字列を無効にする。driverの `contract_ok` は形式の目安であり、固定期待値との意味一致数でも独立した厳密JSON数でもない。
4. queryの時計は、server・モデルの起動後に始まる。前処理で入力ファイルをhashするため起動は制御されたcold cacheではない。queryの秒数だけでは「モデル準備から文字の形成まで30秒以内」を証明しない。
5. RSSはowned serverを約250ms周期で読んだ値であり、driver・OS・描画UIを含まない。短いピークを逃す可能性があり、一般16GBノートやwidget全体の負荷を保証しない。

`null` は有効なJSONだが、driverの `json_ok` は parsed がnullでないことを条件にするためfalseとなる。同値の独立契約判定もfalseであり、今回必要な5キーオブジェクトではない。見出しの「JSON成功」をJSON構文一般へ広げない。

この確認によってfixture・prompt・schema・採点器を変更していない。実モデルの結果が返るまで、精度・速度・runtime互換性の結果は未評価である。
