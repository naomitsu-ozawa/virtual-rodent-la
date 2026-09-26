# VR計画(Meta Quest 3)

- 最終更新: 2026-09-27
- 状態: **計画段階**(オーナーの手元にまだ実機なし。実装はエミュレーターで先行可能)
- 関連: `docs/IMPLEMENTATION_PLAN.md`, `docs/AGENT_LOG.md`

## 1. 目的

Quest 3のブラウザ(Quest Browser)でVirtual Rodent Labを開き、CTを**3Dボリュームで立体的に観察・操作**できるようにする。

## 2. 決定事項(オーナー)

| 項目 | 決定 |
|---|---|
| 対象機器 | Meta Quest 3(Quest Browser) |
| データの持ち込み | Quest のブラウザで直接DICOMを開く。iPadで保存したプロジェクト(.vrlab)をDICOMフォルダに入れておけば、同じ状態から開始できる(既存の自動適用の仕組みをそのまま使う) |
| VRの標準表示 | **3Dボリューム**。メッシュは構築が重いので補助的な表示にとどめる |
| ボリューム描画 | **VR専用の実装でよい**(既存のWebGPUレンダラーは流用しない) |

## 3. 調査結果(2026年9月時点)

- Quest Browser は 2024年3月の v32 で WebGPU に対応済み。
- **WebXR で WebGPU を使う仕組み(WebXR–WebGPU Binding)は実験段階**。v146(2026年4月)で実験的に搭載され、`chrome://flags` の「WebXR experimental features」を有効にすると使える。その後 v149(7月)でスペースワープ、v150(8月)で中心窩レンダリングの WebGPU 対応が実験的に追加。
- 2026年1月時点の three.js の issue(#32858)では、この仕組みは Apple Vision Pro で正式、Chrome(Windows / Android XR)で実験的、Quest では未実装だった。
- WebXR + **WebGL2** はQuestで長く安定しており、three.js の `WebGLRenderer` の XR 対応も成熟している。
- Meta公式のエミュレーター **IWER**(Immersive Web Emulation Runtime, npm `iwer`, MIT)で、実機なしに WebXR をブラウザ上で動かせる。Quest 3 を含む機種をエミュレートできる。PlaywrightからCIで使うための fixture(`playwright-webxr`、2026年7月時点でMVP)も公開されている。

**結論**: 実験機能に依存せず、**WebGL2 + WebXR で VR 専用のボリューム描画を作る**。WebXR–WebGPU が Quest で正式化したら、既存WebGPUレンダラーの流用を再検討する(第4段階)。

## 4. 方針・アーキテクチャ

### 4.1 構成
- 新しいモジュール群(案): `docs/vr/`
  - `vr-session.js` … 「VRで見る」ボタン、セッション開始/終了、WebGLRenderer(`three.module.js`)とVR専用キャンバスの管理
  - `vr-volume.js` … VR用3Dテクスチャの作成とレイマーチング描画(GLSL)
  - `vr-planes.js` … VR内のMPR断面(同じ3Dテクスチャから切り出し)
  - `vr-input.js` … コントローラー/ハンドトラッキング(掴んで回転・移動、両手で拡大、スティックでスライス移動)
  - `vr-quality.js` … 解像度・中心窩レンダリング・ステップ数・自動品質調整
- VR中は通常画面(WebGPU)の描画を止め、GPUとメモリをVRに回す。VRを終えたら元に戻す。
- VRセッション外の既存機能には影響を与えない(VR非対応環境ではボタン自体を出さない: `navigator.xr.isSessionSupported('immersive-vr')`)。

### 4.2 データの流れ
- 現在の状態(元CT、または「3D再構築」で反映済みのフィルター)から **VR用の縮小ボリューム**を作る。
  - 既存のスライス供給の仕組み(フィルター済みスライスの供給元、`packCtSlice` と同じ換算)を流用し、VR用の解像度に縮小する。
  - 3D編集(`segmentEditState` の keep/exclude)も、VR解像度の**編集マスク(3Dテクスチャ)**に変換して反映する。
- テクスチャ形式の案: CT値を16ビット相当(例: R16F)で持ち、VR内でもウィンドウ調整を可能にする。メモリが厳しければ8ビット(ウィンドウ適用済み)に切り替える。

### 4.3 描画
- GLSL のレイマーチングで、既存 WGSL と**同じ描画ルール**を再現する: ウィンドウ中心/幅、セグメントの閾値・色・不透明度、3D編集による削除。
- MPR断面は同じ3Dテクスチャから切り出して描く(軽いので、スライス移動にリアルタイム追従)。
- 空の領域を飛ばす粗い占有テクスチャ(既存のブリックと同じ考え方)で高速化する。

### 4.4 品質と性能
- 目標 72 fps(1フレーム約13.9ms)。
- 描画解像度の縮小(`framebufferScaleFactor`)、中心窩レンダリング(`renderer.xr.setFoveation`)、ステップ数の上限、フレーム時間に応じた自動品質調整。
- VR用ボリュームの大きさ(一番長い辺): 256 / 384 / 512 から選択(既定値は実機で決める)。
  - 例: 1024×1024×1784 のデータを長辺384にすると 384×384×669、16ビットで約197MB。長辺256なら 256×256×446 で約58MB。

### 4.5 操作
- コントローラー/手で掴んで回転・移動、両手で拡大縮小。
- スティックやVR内パネルで、断面のスライス移動・不透明度・ウィンドウ調整。
- MR(パススルー, `immersive-ar`)で、現実の机の上に置いて観察する表示にも対応する。

## 5. 段階計画

### 第1段階: VRビューアーの土台
- 「VRで見る」ボタン(WebXR対応環境のみ表示)、セッション開始/終了
- VR専用ボリューム描画(まずは元CT、ウィンドウ設定のみ)
- 掴んで回転・移動、両手で拡大縮小
- **完了条件**: IWERを使ったE2E(VRに入る/描画が空でない/コントローラー操作で向きが変わる/VRを出ると通常表示に戻る)がCIで合格。VR非対応環境に影響なし。

### 第2段階: 表示内容の一致と VR 内操作
- 反映済みフィルター、セグメントの色分け、3D編集の反映
- MPR断面の表示とスライス移動、不透明度、ウィンドウ調整
- VR内の操作パネル
- **完了条件**: 描画ルールの一致テスト(CPU参照実装で WGSL/GLSL の計算結果を比較)と IWER E2E が合格。

### 第3段階: 実機調整(Quest 3 入手後)
- フレームレート、メモリ、VR用ボリュームの既定サイズ、自動品質調整の調整
- ハンドトラッキングの使い勝手
- MR(パススルー)
- Questでの DICOM 読み込み確認(フォルダ選択が使えない場合は DICOM の zip 読み込みを追加。公開デモの zip 読み込みを流用)

### 第4段階(任意)
- WebXR–WebGPU が Quest で正式化したら、既存WebGPUレンダラーの流用を検討
- VR内での3D編集(囲んで選択・切断など)、複数人での共有表示

## 6. テスト戦略
- **単体テスト**: VR用ボリュームの大きさ計算、縮小処理、編集マスクの変換、描画ルールの計算(CPU参照実装)
- **E2E**: IWER(npm `iwer` を直接、または `playwright-webxr`)で Quest 3 をエミュレートし、Playwright で自動テスト
- **実機**: Quest 3 での確認チェックリスト(第3段階で作成)

## 7. リスクと対策

| リスク | 対策 |
|---|---|
| Quest のメモリ不足 | VR用ボリュームの縮小、8ビットへの切替、VR中は通常画面のGPU資源を解放 |
| フレームレート不足 | 描画解像度の縮小、中心窩レンダリング、ステップ数上限、自動品質調整 |
| Quest Browser でフォルダ選択が使えない | DICOM の zip 読み込みを追加(実機で確認) |
| WGSL と GLSL の描画ルールのずれ | CPU参照実装による一致テスト |
| 大容量データ(ストリーミング表示)の Quest での読み込み | 実機で確認し、必要ならVR用の縮小ボリュームだけを先に作る |

## 8. 未決事項
- VR用ボリュームの既定サイズ(256 か 384 か)
- VR内の操作パネルの形(空中パネル / 手首メニュー)
- VR内で3D編集まで行うか(第4段階で判断)

## 9. 参考
- Meta Quest Browser リリースノート: https://www.meta.com/en-gb/help/quest/2988394104772773/
- Meta Quest Browser(Wikipedia): https://en.wikipedia.org/wiki/Meta_Quest_Browser
- three.js issue #32858 "WebGPU on WebXR": https://github.com/mrdoob/three.js/issues/32858
- IWER: https://github.com/meta-quest/immersive-web-emulation-runtime / npm `iwer`
- Immersive Web Emulator(ブラウザ拡張): https://github.com/meta-quest/immersive-web-emulator
- playwright-webxr: https://github.com/tomingtoming/playwright-webxr
