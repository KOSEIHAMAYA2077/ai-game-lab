# StaticEmbedding asset notice

Upstream model: [hotchpotch/static-embedding-japanese](https://huggingface.co/hotchpotch/static-embedding-japanese).

Pinned revision: `95b3d9c80a7ccf604e2b5daee7b1b3eed6b1a9d3`.

The upstream model card designates the model weights and training code as MIT licensed. The card was checked by the root agent before these cached assets were copied. No upstream copyright holder or year is inferred here.

`tokenizer.json` is an unchanged copy of `0_StaticEmbedding/tokenizer.json` at the pinned revision. SHA256: `833add01c9eb44e78ffb2d9195caace320de0fcf64d1f4d95bc541b6e30a9fc9`.

`table-128-float16.bin` is derived from the pinned `0_StaticEmbedding/model.safetensors`: retain the first 128 columns of the original 32,768 × 1,024 Float32 embedding table, convert to Float16, and serialize little endian. This is truncation and numeric conversion, with no encoder retraining. Size: 8,388,608 bytes. SHA256: `65122d239d6c9fd804deee853736446415dc815134277c87adb9978f7b9e2201`.

The separate JavaScript tokenizer implementation adapts the public local `NativeStaticR5.swift` algorithm, which cites Hugging Face tokenizers v0.22.1 (Apache-2.0). Model asset licensing and tokenizer algorithm attribution are separate; see the runtime notice for that attribution.
