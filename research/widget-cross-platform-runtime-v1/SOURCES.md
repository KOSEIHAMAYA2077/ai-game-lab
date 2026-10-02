# 一次資料・日付・確認範囲

全て2026-10-03にweb本文を確認。Microsoft／SDL／Khronos／著者repo・crate docs／Tauri／Qtの一次資料に限定した。下の「読んだ範囲」は関連するAPI本体・節であり、仕様全体・全sampleの読了を意味しない。文書には本文をコピー配布せず、短い要約とURLを残した。公式情報をこの作品への実装候補に対応させた判断は、本資料の推測・提案である。

更新日が「未記録」のものは日付を推定していない。SDLのsince 3.2.0、wgpu30.0.1、Qt6.8はそれぞれAPI導入版／参照版で、最新releaseの認定ではない。

| ID・一次資料 | source更新日 | 読んだ範囲 | 対応する主張 | 適用限界 |
| --- | --- | --- | --- | --- |
| D01 [D3D11 DrawInstanced](https://learn.microsoft.com/en-us/windows/win32/api/d3d11/nf-d3d11-id3d11devicecontext-drawinstanced) | 2024-02-22 | API本体・引数・remarks・requirements | 1 callで同じprimitiveを複数instance描画できる。6頂点×nへの対応。 | Windows実装の速度・RAMは記載から推定しない。 |
| D02 [D3D11 resource introduction](https://learn.microsoft.com/en-us/windows/win32/direct3d11/overviews-direct3d-11-resources-intro) | 2021-10-06 | Resources、typing、views、lifecycle | buffer/textureとresource viewを分ける。 | 特定のbuffer割当・upload経路は未実装。 |
| D03 [Direct3D feature levels](https://learn.microsoft.com/en-us/windows/win32/direct3d11/overviews-direct3d-11-devices-downlevel-intro) | 2023-07-24 | feature level説明、D3D11表の11_0/SM5.0、footnotes | 機能対応と性能は別。要求levelでdevice生成を検査。 | 全16GB iGPUのdevice成功は不明。 |
| D04 [DirectWrite/Direct2D text rendering](https://learn.microsoft.com/en-us/windows/win32/direct2d/direct2d-and-directwrite) | 2020-08-19 | text services/rendering、glyph vs text、custom renderer、gray-alphaの本文 | text layoutとrendererは分離可能。graphemeとfont glyphは別。D2D gray renderingのalpha。 | Windows atlasの作成・抽出・font fallbackの実動作は未確認。 |
| D05 [DirectWrite CreateAlphaTexture](https://learn.microsoft.com/en-us/windows/win32/api/dwrite/nf-dwrite-idwriteglyphrunanalysis-createalphatexture) | 2024-02-22 | API本体・texture形式とbuffer引数 | bilevel/ClearTypeのalpha texture APIがある。 | この旧APIだけをgrayscale AA tile完成手段としない。 |
| D06 [DirectWrite bitmap target AA mode](https://learn.microsoft.com/en-us/windows/win32/api/dwrite_1/nf-dwrite_1-idwritebitmaprendertarget1-settextantialiasmode) | 2024-02-22 | API本体・default/GRAYSCALE・requirements | bitmap targetでgray AAを指定できる。 | D2Dと同じalpha抽出の保証としては使わない。 |
| D07 [DXGI flip model](https://learn.microsoft.com/en-us/windows/win32/direct3ddxgi/for-best-performance--use-dxgi-flip-model) | 2021-01-06 | flip/blt比較、buffer/MSAA/interop制約、Independent Flip条件 | flip modelを候補にし、buffer条件を固定する。 | 小窓でDWM bypassや電力削減を保証しない。 |
| D08 [IDXGISwapChain Present](https://learn.microsoft.com/en-us/windows/win32/api/dxgi/nf-dxgi-idxgiswapchain-present) | 2024-01-26 | API・return status・sync interval・remarks | occlusion/device errorを扱い、message threadとの待ち方を確認。 | 覆われた小窓全てが同じstatusを返すとはしない。 |
| D09 [GetFrameLatencyWaitableObject](https://learn.microsoft.com/en-us/windows/win32/api/dxgi1_3/nf-dxgi1_3-idxgiswapchain2-getframelatencywaitableobject) | 2024-02-22 | API本体・flag・wait handle・desktop requirements | presentation readinessをwaitable handleで待てる。 | 15fps制限は別のapp deadline。 |
| D10 [MsgWaitForMultipleObjectsEx](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-msgwaitformultipleobjectsex) | 2023-03-17 | input/handle/timeout、remarks、requirements | UI threadでmessageとhandleを処理する待ちの候補。 | 具体的timer/loopは実装・計測していない。 |
| D11 [GetProcessTimes](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-getprocesstimes) | 2022-11-01 | kernel/user time、multicore、100ns units | 各PIDのCPU time差分をelapsedで割る設計。 | collectorは未作成。CPUのquery access rightsも実機確認前。 |
| D12 [PROCESS_MEMORY_COUNTERS_EX](https://learn.microsoft.com/en-us/windows/win32/api/psapi/ns-psapi-process_memory_counters_ex) | 未記録 | WorkingSetSize、PrivateUsageのmember説明 | current working setとprivate commitを別列で報告。 | Mac footprintと同値にしない。更新日未記録。 |
| D13 [Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170) | 2026-03-09 | C/C++ runtime、buildtool整合、architecture、redistribution note | 使用するruntimeに応じた配布と版整合が必要。 | 対象compiler・再配布license条件は未選定。package未取得。 |
| S01 [SDL3 GPU device](https://wiki.libsdl.org/SDL3/SDL_CreateGPUDevice) | 未記録 | API本体、driver names、since 3.2.0 | GPU APIのbackendはvulkan/direct3d12/metal。 | SDL＋OpenGLとは別。端末のbackend動作は未確認。 |
| S02 [SDL3 OpenGL context](https://wiki.libsdl.org/SDL3/SDL_GL_CreateContext) | 未記録 | API本体、Windows function loading、main thread | SDL GL contextは別経路。WindowsのGL>1.1関数をloadする必要。 | GL driver/capability未確認。since 3.2.0は最新版番号ではない。 |
| S03 [SDL3 Vulkan loader](https://wiki.libsdl.org/SDL3/SDL_Vulkan_LoadLibrary) | 未記録 | API本体、dynamic loading、initialization | Vulkan loaderをloadする経路と依存がある。 | Windows driverが存在する保証ではない。 |
| S04 [SDL3 WaitEventTimeout](https://wiki.libsdl.org/SDL3/SDL_WaitEventTimeout) | 未記録 | API本体、timeout/infinite、thread requirements | event待ちとtimeoutを使うloop候補。 | 実際のwake/CPUは未測定。 |
| S05 [SDL3 StartTextInput](https://wiki.libsdl.org/SDL3/SDL_StartTextInput) | 未記録 | API本体、window、input/editing events、IME remarks | 自窓のUnicode inputをenableする。 | 全アプリの確定本文取得APIではない。 |
| S06 [SDL3 TextInputEvent](https://wiki.libsdl.org/SDL3/SDL_TextInputEvent) | 未記録 | struct/windowID/UTF-8 text、enable条件 | focusを持つwindowのtext event。 | undo理由やOS全体commit証拠を独立に保証しない。 |
| S07 [SDL3 TextEditingEvent](https://wiki.libsdl.org/SDL3/SDL_TextEditingEvent) | 未記録 | struct・editing text・cursor/range remarks | editingとinputは別eventとして扱う。 | Windows日本語IME操作は実機未確認。 |
| K01 [OpenGL ARB_draw_instanced](https://registry.khronos.org/OpenGL/extensions/ARB/ARB_draw_instanced.txt) | 未記録 | extension overview・DrawArraysInstanced/InstanceIDの本文 | GLでも複数instanceをまとめる概念に対応する。 | extension文書。modern core対応版は本資料で認定しない。 |
| K02 [Vulkan vkCmdDraw](https://docs.vulkan.org/refpages/latest/refpages/source/vkCmdDraw.html) | 未記録 | parameters、instanceCount description、Vulkan 1.0記載 | vertex/instance countを指定するdrawに対応。 | Vulkan実装のqueue/sync/resource管理は未実装。latest参照は時点依存。 |
| W01 [wgpu backend 30.0.1](https://docs.rs/wgpu/30.0.1/wgpu/enum.Backend.html) | 未記録 | Backend enumとplatform説明 | DX12/Vulkan/Metal/GL/Browser等を区別。D3D11は掲載なし。 | 版固定30.0.1。公式crate docsで、全driverの動作保証ではない。 |
| W02 [wgpu author repository](https://github.com/gfx-rs/wgpu) | 未記録 | README native API、supported platform表、WGSL/Naga、compiler・version注意 | native wgpuはbrowser必須でない。WGSLをplatform languageへ翻訳する。 | trunkの本文はaccess時点。library/driver/IME/配布は未測定・未選定。 |
| B01 [WebView2 process model](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model) | 2023-06-19 | browser/renderer/helper構成、process groupとUser Data Folder | hostだけをRAM/CPUの分母にしない。process数は可変。 | 共有や終了はactual PIDで確認。固定PID数を保証しない。 |
| B02 [WebView2 Evergreen vs Fixed](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/evergreen-vs-fixed-version) | 2025-10-15 | 取得された本文のdistribution model・preinstalled/check/runtime節 | Evergreen shared runtimeとFixed packageを区別。 | 独自同梱しないことはruntime RAM=0でない。runtime未取得。 |
| T01 [Tauri v2 process model](https://v2.tauri.app/concept/process-model/) | 2025-02-22 | core/WebView構成、platform WebViewの本文 | Rust core＋OS webview、WindowsではWebView2。 | binary sizeからresident量を推定しない。 |
| Q01 [Qt WebEngine 6.8 overview](https://doc.qt.io/qt-6.8/qtwebengine-overview.html) | 未記録 | ArchitectureとQtWebEngineProcess節 | Chromiumとseparate processを含む構成。 | native Qt全体がこの構成とはしない。Qt6.8 docs、最新版認定なし。 |
| Q02 [Qt QRhi 6.8](https://doc.qt.io/qt-6.8/qrhi.html) | 未記録 | API abstractionとcompatibility warning、GuiPrivate/ShaderTools節 | GL/ES/D3D/Metal/Vulkan抽象化と限定的互換保証。 | Qt version固定が必要。runtime資源の優劣は不明。 |
| Q03 [Qt Windows deployment 6.8](https://doc.qt.io/qt-6.8/windows-deployment.html) | 未記録 | windeployqt、libraries/plugins/imports/translations、compiler runtime節 | Qt dependencyとcompiler runtimeを配布範囲に含める。 | Qt選定やlicense/deploy確認は今回未実施。 |

## 本文未確認・根拠に使わなかった入口

| URL | 状態 |
| --- | --- |
| https://learn.microsoft.com/en-us/windows/win32/directwrite/custom-text-renderer-sample | tool_internal_error_no_body_read。主張の根拠には使わない |
| https://registry.khronos.org/OpenGL-Refpages/gl4/html/glDrawArraysInstanced.xhtml | unsupported_xhtml_no_body_read。主張の根拠には使わない |
| https://doc.qt.io/qt-6/qtgui-rhi.html | tool_internal_error_no_body_read。主張の根拠には使わない |

MicrosoftのUWP latency tutorialは概念確認の補助として閲覧したが、Win32の窓作成手順へそのまま移さない。desktopにも対応するD09を直接根拠にした。無指定Qt URLのdevelopment snapshotをstable版として扱わず、Q01–Q03は6.8の本文を確認した。

## この調査で未確認の事項

- Windows16GB CPU/iGPUでのdevice生成、実fps・CPU・RAM・電力・font/IME・8時間安定性。
- HLSL／WGSL／GLSLのcompileと数値parity、Windows atlasのcoverage抽出、最新cameraの移植。
- Windows input permission・secure field・全アプリprovider対応。描画runtimeの選定と別の問題。
- build tool、各library feature/license、system fontの利用・配布条件、installer/署名/SmartScreen/更新。Qt QRhiの互換注意を読んだことはQt配布許諾完了を意味しない。
- model/runtimeを含む全工程と、saving-off／OS adapterの接続。既定へのmodel採用見送りを変更しない。
- 人間の快適性、新規性、生産性改善。

機械可読なscope・authority・URLは [SOURCES.json](SOURCES.json)。ローカルの参照時点は [LOCAL_REFERENCES.json](LOCAL_REFERENCES.json)。
