# CPU確認の事前範囲

Candidate FREEZE-R1後に追加した測定用ハーネス。candidate/閾値を変更しない。独立120の本文・結果を測定選択へ使わない。

Nodeのpure候補だけを新processで測る（baseline/Oxcなし）。同processの読み込み前/コード読み込み後/JSON parse＋create後/warm実行後にGCを要求してheapUsed/RSS/externalを記録。差分はこのprocessの比較であり、全app常駐RAMではない。process.resourceUsage().maxRSSはKiB。weightserializedbytes別記。

人工DEV114全文を固定順でwarm200call、各10回で1140query。512単位のworstケース3種（日本語連続、English連続、多数knownalias競合）を各100回。p50/p95/p99/maxをperformance.nowで測る。bridge/I/O/OS入力/body/GPU/atlas/init/startupはquery latencyに含まない。target数msは候補目標で、max保証ではない。同時アプリ負荷/一般PC/16GBWindows/電力は測らない。

JavaScriptCoreは同retriever.js、同R1weight、人工DEV114×6mode＋pilot8＋limit/type/quote境界caseをNodecompact期待値と比較。accepted/shape/nextShape/reason/rawTop1/query/evidenceは厳密、各60rank score/cosine/marginはabsolute error≤1e-12。戻りJSON経由のdouble丸めを含む。JSC init時間とwarm200→DEV114×10のpureJS内timerを別記（Date.nowのms粒度、batchtotal/per-call平均だけ）。CPUprocess・no UI/OS取得。これでJSC解析品質が保証されるわけではない。
