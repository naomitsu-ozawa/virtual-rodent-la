# Virtual Rodent Lab

マウス・実験動物画像向けのブラウザDICOM CTビューワーです。日本語を標準表示とし、アプリ右上のボタンから英語へ切り替えられます。

> English summary is provided below.

## 主な機能

- ローカルDICOMフォルダの読み込み
- ブラウザ内でのDICOM解析とSeriesのグループ化
- RescaleSlope / RescaleInterceptによるCT値キャリブレーション
- Axial / Coronal / Sagittal の3面MPR（断面名は英語表記）
- WebGPU優先、WebGLフォールバック対応のインタラクティブ3D表示
- 組織セグメントを必要時に追加（骨・軟部組織・脂肪・肺をプリセットとして収録）
- セグメントごとの表示ON/OFF、色、不透明度、CT値範囲調整
- MPRへのセグメンテーション重畳
- セグメントの3Dサーフェスメッシュ表示
- セグメントごとのSTL書き出し（mmスケール）
- 3D上で連結成分を選択して体積解析（mm³ / µL）
- セグメント後処理: Opening / Closing / Small Component Removal / Hole Filling
- 表面平滑化
- 非破壊画像処理
  - Spike / Hole correction
  - Fast NLM 3D
- NLMの探索半径・パッチ半径を調整
  - Anisotropic Diffusion
  - Gaussian 3D / Median 3D（選択式）
  - Sigmoid
- Bilateral 3D
- TV Denoising 3D
- Unsharp Mask 3D
- 各フィルターの強度調整とリセット
- Spike / Hole の検出閾値
- Anisotropic Diffusion の反復回数
- Gaussian / Median のPass数
- Sigmoidの中心CT値を調整
- 断面画像は左右スワイプ、マウスではホイールでスライス移動
- Zenodoの公開マウスPET/CTデモ

元のキャリブレーション済みCT値は保持され、表示・フィルター処理は作業用ボリュームに対して行います。

## 言語

アプリの初期表示は日本語です。

右上の `English` ボタンで英語表示へ切り替え、英語表示中は `日本語` ボタンで戻せます。

## リポジトリ構成

- `docs/index.html` — GitHub Pagesのエントリーポイント
- `docs/app.js` — 現行DICOMビューワー本体
- `docs/style.css` — UIスタイル
- `docs/DICOM_WEBGPU_SPEC.md` — 現在の設計・動作仕様
- `docs/IMPLEMENTATION_PLAN.md` — 実装済み項目と今後の開発項目
- `docs/THIRD_PARTY_NOTICES.md` — 外部ライブラリ・公開データの情報
- `index.html` — ローカル開発用エントリーポイント

旧Digimouse / MouseMapper関連の実験コードや生成データは、現在のDICOMビューワーには含めていません。

## 公開デモ

`公開マウスCTデモ` から、Zenodo record 12761093 の `PET-CT.zip` を必要時に取得します。

- サイズ：約20.8 MB
- 動物：マウス
- スキャナ：Siemens Inveon micro-PET/CT
- DICOM画像本体はこのGitHubリポジトリには保存していません

## ローカル開発

必要環境：

- Node.js
- モダンブラウザ
- WebGPU対応ブラウザを推奨

```bash
npm install
npm run dev
```

ルートの開発ページは、GitHub Pagesと同じ `docs/app.js` / `docs/style.css` を読み込みます。

## ライセンス

本ソフトウェアは **GNU Affero General Public License v3.0 only (AGPL-3.0-only)** の条件で公開します。

AGPLv3の条件を満たす限り、研究・教育・商用を含めて利用、改変、再配布できます。ネットワーク経由で改変版を提供する場合も、利用者へ対応するソースコードを提供する必要があります。

AGPLv3の条件に適合しないクローズドな商用利用を希望する場合は、著作権者から別途商用ライセンスを取得してください。

第三者ライブラリおよび公開データには、それぞれのライセンス・利用条件が適用されます。詳細は `THIRD_PARTY_NOTICES.md` を参照してください。

## 開発状況

研究・実証用プロトタイプとして開発中です。

---

## English

Virtual Rodent Lab is a browser-based DICOM CT viewer for mouse and other small-animal imaging.

The app uses Japanese by default. Use the language button in the top-right corner to switch between Japanese and English.

### Current capabilities

- Local DICOM directory loading
- Browser-side DICOM parsing and Series grouping
- CT calibration using RescaleSlope / RescaleIntercept
- Axial / Coronal / Sagittal MPR
- Interactive 3D rendering with WebGPU and WebGL fallback
- Add tissue segments as needed, with Bone / soft tissue / fat / lung presets
- Per-segment visibility, color, opacity, and CT-range controls
- Segmentation overlays in MPR
- 3D segment surface meshes
- Per-segment STL export in physical mm scale
- Click a connected 3D component to measure its volume in mm³ / µL
- Surface smoothing
- Non-destructive filters: Spike / Hole, Fast NLM 3D, Anisotropic Diffusion, selectable Gaussian 3D / Median 3D, and Sigmoid
- Filter strength controls and reset
- Adjustable NLM search radius and patch radius
- Spike / Hole detection threshold
- Anisotropic Diffusion iteration count
- Gaussian / Median pass count
- Adjustable Sigmoid center in CT-value units
- MPR slice navigation by left/right swipe or mouse wheel
- Bilateral 3D / TV Denoising 3D / Unsharp Mask 3D
- Segment post-processing: Opening / Closing / Small Component Removal / Hole Filling
- Optional public mouse PET/CT demo from Zenodo

The original calibrated CT-value volume is preserved separately from processed display data.

### License

This software is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**.

Use, modification, redistribution, and commercial use are permitted under the AGPLv3 terms. Modified versions made available to users over a network must offer the corresponding source code as required by the license.

A separate commercial license is available for proprietary or closed-source commercial use that cannot comply with the AGPLv3 requirements.

Third-party libraries and public datasets remain subject to their own licenses and terms. See `THIRD_PARTY_NOTICES.md`.
