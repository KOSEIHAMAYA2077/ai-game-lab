# Transfer / enumeration boundary

独立source review（candidate編集なし）で確認された範囲です。

| 場所 | 通常idle | material growth |
|---|---|---|
| JSC→Swift bridge | smallmetadataのみ、body JSON0 | metadata＋exactnewIDrange delta |
| Swift projection | newunit検算0、glyphs追加0 | newunitだけ検算・後にpresented view追加 |
| R3 core/shape-only | 既存bounded recent/body slice読み出しは残る | 既存canonical/material/shape処理 |
| delta emitter readBody | 呼ばない | 全body走査→afterIdより新しいrangeだけ転送 |
| native renderer | 同じprojectionで元15fps描画 | view変更時に元instance rebuild |

内部body enumeration0、idle全CPU0、O(delta)走査、全窓CPU改善や快適さは未検証です。省いたfull JSON/Swift prefix検算と、別レイヤーのboundedbody処理を分けて評価します。元core/source/shaderを変更せず、body/IDのownerはR3だけです。
