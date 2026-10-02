# Windows向け文字surface runtime候補

確認日: 2026-10-03。**最初に比較する案は Win32＋D3D11＋DirectWrite** とする。現在のMetal比較版にある「6頂点の文字planeを、instance表とGPUの面計算でまとめて描く」構造を保ち、窓・shader・文字atlasのOS依存部だけ交換できるためである。これは移植範囲を根拠にした設計判断で、最小RAM・最速・省電力の実証ではない。[Microsoftのinstanced描画API](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-id3d11devicecontext-drawinstanced)、[DirectWriteの描画分離](https://learn.microsoft.com/en-us/windows/win32/direct2d/direct2d-and-directwrite)

このフォルダは文書案だけである。Windows実行物、Windows実機測定、library導入、shader compile、OS入力取得、OS設定変更を行っていない。現在のMac用アプリや既定60形を置き換えない。新しいモデルを移植・採用する案でもない。

## 保つ体験と比較の母数

| 保つもの | 最初のWindows比較範囲 | それだけでは達成しないもの |
| --- | --- | --- |
| 黒い400×440程度の小窓に、入力した文字が立体の面を流れる | 実際のclient寸法・DPI・backbuffer画素を記録。従来の外寸と同一と決めつけない | 作業の邪魔にならない、快適、見返したくなるという人間評価 |
| 文字は平面のinstance。面の位置・接線・変形をGPUで評価 | 共通の球・箱・メビウスの3形、bodyの1 draw／最大1,536 instance | 既定60形・骨格・6 Programの機能移植や、任意text-to-mesh |
| 材料の文字・順序・ID・追加時の色を保つ | 同じ人工fixture、同じ時刻・カメラで照合。最大身体32,000、文字種類1,024という既存の有限容量も別に扱う | 1,536描画文字が保存全体を表すという主張 |
| pause/hide時は周期描画予約を解除 | UIイベントと明示入力は処理。frame、予約数、CPUを別々に測る | 窓を覆うだけで必ず無負荷になる、process RAMが即時返るという保証 |
| 解釈は入力・必要な安定窓の到来時だけ | まず人工fixtureと明示入力。解釈器を常時frame loopへ入れない | 全アプリから確定した日本語本文を取得できるという保証 |

読んだ実装は [Metal v1 Renderer](../../desktop/glyph-metal-lab-v1/Sources/Renderer.swift) と [shader](../../desktop/glyph-metal-lab-v1/Sources/Glyphs.metal)。rootが改良中のv2カメラ・実窓測定は採用線の根拠にしていない。移植開始時には、rootが凍結した最新の正しいcamera／projectionを改めて基準へ指定する。

## 少数の候補

| 候補 | 残せる構造／交換するもの | runtime・processの境界 | 今回の判断 |
| --- | --- | --- | --- |
| **A: Win32＋D3D11＋DirectWrite** | `DrawInstanced(6,n,0,0)`、HLSL、instance buffer、alpha atlas。AppKit/Core Text/Metalは交換 | OSのgraphics APIを使う。C++ runtime、driver、shaderやfont準備、保存処理は依然必要。単一host processという設計案でもDWM等はOS側にある | **最初のWindows専用比較候補**。既存Metalとの対応が明確。Windows実測後に採否 |
| **B: SDL3＋OpenGLまたはVulkan** | SDLは窓・イベント層。GLSL＋GL instancing、またはSPIR-V＋Vulkan drawへ交換 | OpenGL context／function loading、またはVulkan loader／driverが必要。SDLが描画実装を自動で移植するわけではない | 複数OSの窓・イベント共有を重視する代案。まず一方のbackendだけ固定 |
| **C: native wgpu** | instance表を共通化しWGSLへ移植。WindowsはDX12/Vulkan、MacはMetal等 | native libraryで、browserを必須としない。ただしwindow/text/IMEは別。backend・compiler・依存の版固定が必要 | 将来両OSのshader・GPU資源管理を共有したい場合の代案。Windowsだけの初回移植に必須ではない |

AのAPI対応は [D3D11 DrawInstanced](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-id3d11devicecontext-drawinstanced)。Bでは [SDLのGL context](https://wiki.libsdl.org/SDL3/SDL_GL_CreateContext)、[Vulkan loader](https://wiki.libsdl.org/SDL3/SDL_Vulkan_LoadLibrary)、[Vulkan instanced draw](https://docs.vulkan.org/refpages/latest/refpages/source/vkCmdDraw.html) を確認した。**SDL3のGPU APIは別案で、公式backendはD3D12/Vulkan/Metal。D3D11やOpenGLのAPIラッパーではない。** [SDL_CreateGPUDevice](https://wiki.libsdl.org/SDL3/SDL_CreateGPUDevice)

Cは著者の [wgpu README](https://github.com/gfx-rs/wgpu) と版を指定した [30.0.1 backend表](https://docs.rs/wgpu/30.0.1/wgpu/enum.Backend.html) が根拠。そこにD3D11 backendはなく、WindowsのGLはdownlevel/best effortとして区別される。対応API名だけで対象iGPU上の動作や速度を保証しない。

## Web資産・UI frameworkを使う場合

| 案 | 公式情報から確認した構成 | この作品での使い分け |
| --- | --- | --- |
| WebView2＋既存WebGL | browser、renderer、GPU等のhelperを持つprocess group。数は機能・共有によって変わる | Web描画を再利用する比較基準になり得る。独自browserを同梱しないEvergreenでも、実行runtimeのprocess負担は残る |
| Tauri＋既存Web描画 | Rust coreとOS WebView。WindowsではWebView2 | 配布binaryの小ささと常駐RAMを別に測る。Metal shaderをそのままnative描画へ変える仕組みではない |
| Qt native Gui／Widgets／QRhi | native QtとQt WebEngineは別。QRhiは複数graphics APIを抽象化し、版互換には制約がある | cross-platform UIが必要になった時の候補。Qt library/plugin/compiler runtimeを含めて配布・資源を調べる |
| Qt WebEngine | Chromiumを使用し、描画・JavaScript等が別のQtWebEngineProcessで動く | WebView系の比較へ含める。Qt全体を必ずbrowser多processと呼ばない |

この区別は [WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model)、[EvergreenとFixed](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version)、[Tauri process model](https://v2.tauri.app/concept/process-model/)、[Qt WebEngine 6.8](https://doc.qt.io/qt-6.8/qtwebengine-overview.html)、[Qt QRhi 6.8](https://doc.qt.io/qt-6.8/qrhi.html)、[Qt Windows配布](https://doc.qt.io/qt-6.8/windows-deployment.html) に対応する。**この資料では各方式のRAM、起動秒数、消費電力の数値順位を付けない。**

## 研究mapへ接続する短文案

> Windows16GB laptop CPU/iGPUでの常駐条件は未検証。Metalの文字plane instance構造を保つ最初の移植案はWin32＋D3D11＋DirectWriteで、SDL3＋GL/Vulkanとnative wgpuを代案として整理した。共通3形、最大1,536描画文字、黒い小窓、pause/hide時の周期予約解除を同じ条件で測る。WebView2/Tauriはbrowser系processを含め、Qt nativeとWebEngineを分けて比較する。OS全体の入力取得、既定60形、6 Program、モデル採用、Windows配布・権限の保証はこの描画案と別であり、未実装・未測定。

共有research mapは編集していない。この段落はrootが採否を判断して使うための提案である。

詳細は [移植対応と接続前gate](PORT_PLAN.md)、[実機評価案](EVALUATION_PLAN.md)、[一次資料と読了範囲](SOURCES.md)、[ローカル参照SHA](LOCAL_REFERENCES.json)、[文書確認](DOCUMENT_CHECKS.json)。
