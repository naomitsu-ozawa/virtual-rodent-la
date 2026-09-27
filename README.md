# Virtual Rodent Lab

マウス・実験動物画像向けの、ブラウザで動くDICOM CTビューワーです。DICOMはアップロードせず、端末内で読み込み・処理します。日本語表示が標準で、画面右上のボタンで英語に切り替えられます。

> English summary is provided below.

公開ページ: https://naomitsu-ozawa.github.io/virtual-rodent-la/

## 主な機能

### 読み込み・表示
- ローカルのDICOMフォルダを読み込み、ブラウザ内で解析してSeriesごとにまとめる
- RescaleSlope / RescaleIntercept によるCT値キャリブレーション
- 圧縮DICOM（JPEG / JPEG-LS / JPEG 2000 / RLE）の伸張（実データでは未検証）
- Axial / Coronal / Sagittal の3面MPR（断面名は英語表記）
- 3D表示: GPUボリュームレンダリング（WebGPU）と、STL出力用のサーフェスメッシュ。WebGPUが使えない環境ではWebGLで表示
- 3D表示中の断面の重ね表示と、3Dパネルのスライススライダー・断面の不透明度調整
- 断面ビュー（3Dを断面で切って表示、断面のドラッグで位置を移動）
- 表示の切り替え: 3D / 2D / 分割、メインに表示するビューの入れ替え
- スライス移動: スライダー（ペン・指に1対1で追従）、左右スワイプ、マウスホイール

### セグメンテーション
- 組織セグメントを必要なときに追加（骨・軟部組織・脂肪・肺のプリセット）
- セグメントごとの表示ON/OFF、色、不透明度、CT値範囲
- 後処理: Opening / Closing / 小さい塊の除去 / 穴埋め
- MPRへのセグメント重ね表示
- 表面の平滑化、セグメントごとのSTL書き出し（mm単位）

### 画像フィルター（非破壊）
- Spike / Hole補正、Fast NLM 3D、Anisotropic Diffusion、Gaussian 3D / Median 3D（選択式）、Sigmoid、Bilateral 3D、TV Denoising 3D、Unsharp Mask 3D
- フィルターの追加・削除・並べ替え、強さや各パラメータの調整
- WebGPUのコンピュートシェーダで処理（使えない環境ではCPUで処理）

元のキャリブレーション済みCT値は変更せず、表示・フィルター・セグメンテーションは作業用のデータに対して行います。

### 体積解析と編集
- 3D（GPUボリューム表示）や断面でクリックした部品の体積を、元の解像度で計算（mm³ / µL）
- 囲み選択で、囲みの中に完全に入っている部品をまとめて選択
- 解析した部品はGPUボリュームの中で色付け表示（メッシュは作らない）
- 選択領域だけを残す / 選択領域を削除（クリックした部品すべてが対象。チェックを外すと対象外）、選択の統合、元に戻す / やり直す
- ペン・直線による切断
- 選択領域のSTL書き出し

### 保存・キャッシュ
- プロジェクトファイル（`.vrlab`）の保存と読み込み。フィルター設定・セグメント・編集内容を元の解像度のまま保存
- DICOMフォルダ内の `.vrlab` を、フォルダを開いたときに自動で適用（新しいものを優先）
- iPad / iPhoneでは共有シートから保存（「ファイル」アプリでDICOMフォルダに保存可能）
- 端末内キャッシュ（IndexedDB）: フィルター済みGPUボリュームと体積解析用のデータ。同じデータ・設定で開き直すと再計算を省略。3D画面右上の「キャッシュ削除」で消去

### 端末
- iPad / Macではワークスペース画面（ツールバーと設定パネル）を使用
- iPadではGPUボリュームの解像度（「iPad GPU」の設定）を端末の性能に合わせて選択。縮小したボリュームは表示専用で、体積の計算は常に元の解像度で行う

## 大容量DICOM

大容量のSeriesでも、解像度・CT値・voxel spacingは変更しません。ボリューム全体を一度に展開せず、元のDICOMをスライス・行単位で必要なときに読み込み、MPRとセグメンテーションを元の解像度で処理します。自動のダウンサンプリングは行いません（iPadのGPUボリュームは表示専用に縮小します）。

## 言語

初期表示は日本語です。右上の `English` ボタンで英語表示に切り替え、英語表示中は `日本語` ボタンで戻せます。

## 公開デモ

`公開マウスCTデモ` から、Zenodo record 12761093 の `PET-CT.zip` を必要なときに取得します。

- サイズ: 約20.8 MB
- 動物: マウス
- スキャナ: Siemens Inveon micro-PET/CT
- DICOM画像本体はこのリポジトリには保存していません

## リポジトリ構成

- `docs/` — GitHub Pagesで公開するアプリ本体（ビルド不要のESモジュール）
  - `index.html`, `style.css` — エントリーポイントとスタイル
  - `app.js` — 全体をつなぐ部分（イベントの登録、3D表示の初期化・操作・描画ループ）
  - `version.js`, `version.json` — ビルド番号
- `tests/` — ユニットテスト・静的チェック（Vitest）とブラウザテスト（Playwright）
- `tools/` — 開発用ツール（ビルド番号の更新、モジュール分割の補助と検証）。`tools/split-history/` は分割作業の記録
- `scripts/serve-docs.mjs` — `docs/` をローカルで配信する簡易サーバー
- `index.html` — ローカル開発用のエントリーポイント（`docs/` と同じファイルを読み込む）
- `docs/DICOM_WEBGPU_SPEC.md` — 設計・動作仕様
- `docs/IMPLEMENTATION_PLAN.md` — 実装済みの項目、今後の開発項目、設計上のルール
- `docs/AGENT_LOG.md` — AIエージェントによる作業記録（作業前に読み、作業後に追記）
- `THIRD_PARTY_NOTICES.md` — 外部ライブラリ・公開データの情報

### `docs/` のモジュール

共通の土台
- `state.js` — アプリ全体の共有状態（読み取りは直接、書き込みはセッター経由）
- `ui-shell.js` — 画面のHTML骨格と各UI要素への参照
- `i18n.js` — 日本語 / 英語の表示文字列と言語切り替え
- `utils.js`, `settings.js`, `latest-runner.js`, `busy.js` — 汎用処理、UI設定値、「最新の1件だけ実行」ランナー、処理中表示

DICOMとボリューム
- `dicom.js` — DICOMヘッダ解析、Seriesのまとめ、Transfer Syntax
- `volume-io.js` — ピクセルの伸張・読み込み、スライスのキャッシュ
- `data-load.js` — Seriesの選択、ボリュームを開く処理、デモの読み込み、プロジェクトの保存・適用
- `project-file.js` — プロジェクトファイル（`.vrlab`）の形式

画像フィルター
- `gpu-shaders.js`, `gpu-compute.js` — WebGPUコンピュートシェーダ（WGSL）、デバイス・バッファ管理、GPUフィルター実行
- `cpu-filters.js` — CPUのフィルター計算（WebGPUが使えないとき）
- `source-filters.js` — 元DICOMに対するフィルター処理（ワーカー、領域の読み出し、フィルター済みスライスのキャッシュ）
- `filter-pipeline.js` — フィルターの画面と、フィルターのかけ直し

セグメンテーションと解析
- `segments.js`, `segment-ui.js` — セグメントの状態と操作欄
- `segment-runs.js`, `run-length.js`, `mask-ops.js` — セグメント領域の計算（ラン長表現、集合演算、連結成分、モルフォロジー）
- `run-pack.js`, `run-cache.js` — 体積解析用データの端末内キャッシュ
- `analysis-ops.js`, `analysis-results.js`, `edit-tools.js`, `lasso.js` — 体積解析、編集操作、結果一覧、囲み選択

2D断面（MPR）
- `mpr-render.js` — 断面の描画と描画順の管理、ドラッグ中の表示
- `mpr-orthogonal.js` — Coronal / Sagittal断面の組み立て、GPUボリュームからの読み出し
- `section-view.js` — 断面ビュー

3D
- `scene3d.js`, `three-status.js`, `three-state.js` — 3Dの再描画の依頼、状態表示
- `scene-view.js` — 描画エンジンの選択、向きの矢印、表示ボタン、回転の計算、切断線の処理
- `medical-volume.js` — WebGPUのボリュームレンダリング（解析結果の色付けを含む）
- `mpr3d-overlay.js` — 3D表示中の断面とそのプレビュー
- `surface-build.js`, `surface-mesh.js`, `mesh-geometry.js`, `rebuild-3d.js` — サーフェスメッシュの作成・平滑化・STL、3Dの作り直し
- `gpu-volume-data.js`, `gpu-volume-cache.js` — GPUボリュームのデータ更新と端末内キャッシュ
- `workspace-ui.js` — iPad / Mac用のワークスペース画面

モジュール同士の読み込みに循環がないこと、どのモジュールも `app.js` を読み込まないことは、テスト（`tests/static/no-import-cycles.test.js`）で確認しています。

旧Digimouse / MouseMapper関連の実験コードや生成データは、このDICOMビューワーには含めていません。

## ローカル開発

必要環境:

- Node.js
- モダンブラウザ（WebGPU対応ブラウザを推奨）

```bash
npm install
npm run dev
```

テスト:

```bash
npm test              # 構文・ビルド番号の整合・モジュールの循環チェック + ユニットテスト (Vitest)
npm run lint          # 未定義参照などの検出 (ESLint)
npx playwright install chromium
npm run test:e2e      # ブラウザでのスモークテスト (Playwright)
npm run test:e2e:demo # 公開デモ(約20.8MB)の読み込みテスト
```

- ビルド番号は `npm run bump-build` で一括更新します（`docs/version.js`、`docs/version.json`、各モジュールのキャッシュ対策クエリ `?v=YYYYMMDD-buildN`）。
- GitHub Actions（`.github/workflows/ci.yml`）で、push・PRごとにテストを自動実行します。
- PRごとのプレビューが `https://naomitsu-ozawa.github.io/virtual-rodent-la/pr-preview/pr-<番号>/` に公開されます（`.github/workflows/pages.yml`）。CIにはGPUがないため、WebGPUの動作はプレビューを実機で開いて確認します。
- URLに `?debug` を付けて開くと、フィルター適用中に2D断面をドラッグしたときの画像の出どころをフッターに表示します。
- 開発ルールと作業記録は `docs/IMPLEMENTATION_PLAN.md` と `docs/AGENT_LOG.md` を参照してください。

## ライセンス

本ソフトウェアは **GNU Affero General Public License v3.0 only (AGPL-3.0-only)** の条件で公開します。

AGPLv3の条件を満たす限り、研究・教育・商用を含めて利用、改変、再配布できます。ネットワーク経由で改変版を提供する場合も、利用者へ対応するソースコードを提供する必要があります。

AGPLv3の条件に適合しないクローズドな商用利用を希望する場合は、著作権者から別途商用ライセンスを取得してください。

第三者ライブラリおよび公開データには、それぞれのライセンス・利用条件が適用されます。詳細は `THIRD_PARTY_NOTICES.md` を参照してください。

## 開発状況

研究・実証用のプロトタイプとして開発中です。

---

## English

Virtual Rodent Lab is a browser-based DICOM CT viewer for mouse and other small-animal imaging. DICOM data is read and processed on the device and never uploaded. The app uses Japanese by default; the button in the top-right corner switches between Japanese and English.

Live site: https://naomitsu-ozawa.github.io/virtual-rodent-la/

### Current capabilities

- Local DICOM folder loading, browser-side parsing and Series grouping; CT calibration (RescaleSlope / RescaleIntercept); compressed transfer syntaxes (JPEG, JPEG-LS, JPEG 2000, RLE; untested on real data)
- Axial / Coronal / Sagittal MPR; slice sliders follow pen and touch 1:1, plus swipe and mouse wheel
- 3D view: WebGPU GPU volume rendering, and surface meshes for STL export (WebGL fallback); MPR planes in 3D with a slice panel; section view with draggable section plane; 3D / 2D / split layouts
- Tissue segments on demand (bone / soft tissue / fat / lung presets) with visibility, color, opacity and CT range; Opening / Closing / small component removal / hole filling; MPR overlays; surface smoothing; per-segment STL export in mm
- Non-destructive filters: Spike / Hole, Fast NLM 3D, Anisotropic Diffusion, Gaussian 3D / Median 3D, Sigmoid, Bilateral 3D, TV Denoising 3D, Unsharp Mask 3D — add, remove, reorder and tune; WebGPU compute with a CPU fallback
- Volume analysis at source resolution (mm³ / µL) by clicking a part in 3D or MPR, or with the lasso; analysed regions are coloured inside the GPU volume; keep / delete selected (all picked parts), merge, undo / redo, pen / line cut, region STL export
- Project files (`.vrlab`) with filters, segments and edits at source resolution; a `.vrlab` inside the opened DICOM folder is applied automatically; iPad saves through the share sheet
- Device-local cache (IndexedDB) of the filtered GPU volume and of the volume-analysis data, so reopening the same data and settings skips recomputation
- iPad / Mac workspace UI; on iPad the GPU volume resolution is chosen for the device (display only — volumes are always measured at source resolution)
- Optional public mouse PET/CT demo from Zenodo

The original calibrated CT-value volume is preserved separately from processed display data. Large series are read slice by slice from the source DICOM at full resolution, without automatic downsampling.

### Development

`npm install`, `npm run dev`; `npm test`, `npm run lint`, `npm run test:e2e`. Bump the build marker with `npm run bump-build` (`docs/version.js`, `docs/version.json`, module cache tags). Each pull request is previewed at `https://naomitsu-ozawa.github.io/virtual-rodent-la/pr-preview/pr-<number>/`; check WebGPU behaviour there on a device, since CI has no GPU. See `docs/IMPLEMENTATION_PLAN.md` (rules) and `docs/AGENT_LOG.md` (work log).

### License

This software is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**.

Use, modification, redistribution, and commercial use are permitted under the AGPLv3 terms. Modified versions made available to users over a network must offer the corresponding source code as required by the license.

A separate commercial license is available for proprietary or closed-source commercial use that cannot comply with the AGPLv3 requirements.

Third-party libraries and public datasets remain subject to their own licenses and terms. See `THIRD_PARTY_NOTICES.md`.
