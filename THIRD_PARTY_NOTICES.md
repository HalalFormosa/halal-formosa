# Third-party notices

Halal Formosa itself is licensed under the PolyForm Noncommercial License 1.0.0 (see [LICENSE](LICENSE)
and [NOTICE](NOTICE)). The components below are third-party and keep their own licenses.

## On-device background removal

| Component | Used for | License | Source |
|---|---|---|---|
| **U²-Net** (`u2netp` model, `public/models/u2netp.onnx`) | Finding the product in a photo | Apache License 2.0 | https://github.com/xuebinqin/U-2-Net |
| **ONNX Runtime Web** (`onnxruntime-web`) | Running the model in the browser/app | MIT | https://github.com/microsoft/onnxruntime |

- U²-Net: Xuebin Qin, Zichen Zhang, Chenyang Huang, Masood Dehghan, Osmar R. Zaiane and Martin Jagersand,
  "U²-Net: Going Deeper with Nested U-Structure for Salient Object Detection", Pattern Recognition, 2020.
- The ONNX conversion of `u2netp` is the one distributed with the `rembg` project (MIT,
  https://github.com/danielgatis/rembg). MD5 of the bundled file: `8e83ca70e441ab06c318d82300c84806`.

Earlier versions of the app used the `@imgly/background-removal` package (AGPL-3.0); it has been removed.

## Other dependencies

Every other production dependency is under a permissive license (MIT, Apache-2.0, ISC, BSD or MPL-2.0).
The full list with versions is in `package.json` / `package-lock.json`; each package's license text ships
with it in `node_modules/<package>/LICENSE`.
