# Third-party notices for the native bundle

The build copies this directory unchanged into `Contents/Resources/ThirdPartyLicenses` before signing. The Web build's existing `THIRD_PARTY_NOTICES.txt`, WordNet notices, and KanjiVG notices remain in `Contents/Resources/web`; do not remove them from distributions.

The original license files are copied from the installed packages at the locked versions. ONNX Runtime's license and complete third-party notices are copied from the official Microsoft repository at the matching stable tags or dev commit. `manifest.json` records the version, source and SHA-256 of each file. These notices do not grant or assert a license for Glyph Matter's own source code.

## Browser scope checked for this build

- `three@0.186.1`: MIT.
- `@huggingface/transformers@3.8.1`: Apache-2.0; its browser export is `dist/transformers.web.js`. The upstream source map identifies bundled `@huggingface/jinja`; Node's `sharp` and `onnxruntime-node` imports are excluded in that export.
- `@huggingface/jinja@0.5.10`: MIT.
- `onnxruntime-web@1.22.0`, its `onnxruntime-common@1.22.0`, the Transformers-owned `onnxruntime-web/common@1.22.0-dev.20250409-89f8206ba4`, and the top-level `onnxruntime-common@1.21.0`: Microsoft MIT. Stable 1.21.0/1.22.0 and dev commit `89f8206ba4` license texts and full upstream third-party notices are included.
- The source maps for the ordinary browser `ort.bundle.min.mjs` exports contain the runtime's WASM/JSEP implementation and common runtime; the optional `ort.all`/WebGL exports contain additional JS dependencies. Both stable and dev ordinary-export source maps were checked. Flatbuffers, protobufjs and its nine runtime subpackages, long and platform notices are included conservatively from the locked packages as well; this list is not a claim that every optional dependency executes in this application.
- `guid-typescript@1.0.9` appears in the optional WebGL/all source maps, but not the ordinary browser-export source maps selected here. Its npm package and upstream repository have no separate LICENSE file. This build does not select that optional code path. If a future build selects `onnxruntime-web/all` or `/webgl`, resolve its attribution before distributing that build rather than inventing a copyright notice.

The optional MiniLM model is downloaded separately from the official, pinned `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` repository and is declared Apache-2.0 there. The model is not included in this application bundle. Its source, revision and checksum remain in the application's model provenance documentation; Apache-2.0's complete text is included in the Transformers license file. No model input text is part of this license inventory.

The upstream ONNX Runtime notice is the full project's aggregate notice, including backends not used by this browser/WASM application. Preserve its contents; do not read its presence as proof that every listed backend is bundled.

Official sources: [ONNX Runtime 1.22.0 license](https://github.com/microsoft/onnxruntime/blob/v1.22.0/LICENSE), [1.22.0 third-party notices](https://github.com/microsoft/onnxruntime/blob/v1.22.0/ThirdPartyNotices.txt), [dev commit license](https://github.com/microsoft/onnxruntime/blob/89f8206ba4/LICENSE), [Transformers.js](https://github.com/huggingface/transformers.js), [Three.js](https://github.com/mrdoob/three.js).
