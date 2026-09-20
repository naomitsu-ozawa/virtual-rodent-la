# Virtual Rodent Lab

マウス・実験動物画像向けのブラウザDICOM CTビューワーです。日本語を標準表示とし、アプリ右上のボタンから英語へ切り替えられます。

> English summary is provided below.

## 主な機能

- ローカルDICOMフォルダの読み込み
- ブラウザ内でのDICOM解析とSeriesのグループ化
- RescaleSlope / RescaleInterceptによるCT値キャリブレーション
- Axial / Coronal / Sagittal の3面MPR（断面名は英語表記）
- WebGPU優先、WebGLフォールバック対応のインタラクティブ3D表示
- 骨・軟部組織・脂肪・肺の閾値セグメンテーション
- セグメントごとの表示ON/OFF、色、不透明度、CT値範囲調整
- MPRへのセグメンテーション重畳
- セグメントの3Dサーフェスメッシュ表示
- セグメントごとのSTL書き出し（mmスケール）
- 3D上で連結成分を選択して体積解析（mm³ / µL）
- 表面平滑化
- 非破壊画像処理
  - Spike / Hole correction
  - Fast NLM 3D
  - Anisotropic Diffusion
  - Gaussian 3D
  - Sigmoid
- 各フィルターの強度調整とリセット
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
- Bone / soft-tissue / fat / lung threshold segmentation
- Per-segment visibility, color, opacity, and CT-range controls
- Segmentation overlays in MPR
- 3D segment surface meshes
- Per-segment STL export in physical mm scale
- Click a connected 3D component to measure its volume in mm³ / µL
- Surface smoothing
- Non-destructive filters: Spike / Hole, Fast NLM 3D, Anisotropic Diffusion, Gaussian 3D, and Sigmoid
- Filter strength controls and reset
- MPR slice navigation by left/right swipe or mouse wheel
- Optional public mouse PET/CT demo from Zenodo

The original calibrated CT-value volume is preserved separately from processed display data.
