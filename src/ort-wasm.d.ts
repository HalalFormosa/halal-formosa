// onnxruntime-web ships types only for its root entry; its "./wasm" subpath (CPU-only, much smaller
// bundle) has the same API. Our tsconfig uses classic Node resolution, so re-export the root types.
declare module 'onnxruntime-web/wasm' {
  export * from 'onnxruntime-web'
}
