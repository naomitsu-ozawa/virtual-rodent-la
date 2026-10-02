# Remote XR — ファクトチェックと検討メモ

対象: `docs/REMOTE_XR_CONCEPT.md`（同じブランチ）  
作成: 2026-10-02（来週の検討用）  
状態: 調査メモ。アプリのコードは変更していない。

## 0. 確度の表記

| 記号 | 意味 |
|---|---|
| **A** | 一次情報を直接読んで確認した（ソースコード、仕様書の原文、ツールの実際の出力） |
| **B** | 公式ページ・信頼できる情報源の検索要約で確認した（本文は直接読めていない） |
| **C** | 未確認。実機で測るか、追加の調査が必要 |

調査環境の制約: chromestatus.com、chromium.googlesource.com、meta.com、developers.meta.com、
w3.org、toji.dev、communityforums.atmeta.com はこの環境から直接開けなかった。
そのため、これらに由来する項目は B にとどめている。

---

## 1. 議論の経緯（要約）

1. 構想ドキュメントは「Macで描画し、Questは表示と姿勢の取得だけを担当する」案。
2. Quest単体の VR は build 391 で標準サイズは 72 fps に達している。
   ただし Quest 本体のメモリでは 256³ が既定で、512³ が上限に近い。
3. 本当の動機（オーナー、2026-10-02）: 最新の CT は 1024×1024 のスライスを z 方向に連続撮影して
   全身を撮れる。この巨大なデータを外部の GPU で描画したい。
4. したがって **遠隔描画（Questは映像を受け取るだけ）が本命**。
   「Macで前処理してQuestで描画」するハイブリッド案（構想 §18）は、Quest に入る大きさまで縮小することになるので目的に合わない。
5. Windows ＋ Quest Link（Meta Horizon Link）なら、Chrome の WebXR がそのまま Quest に出る可能性が高い。
   その場合、映像の送受信・姿勢・遅延対策は Meta が担当し、自作の部分はほぼなくなる → **近道の候補**。

---

## 2. データ量（計算）

| データ | 1スライス | 合計（16 bit） |
|---|---|---|
| 512³（現在の練習データ） | 0.5 MiB | 256 MiB |
| 1024² × 2,000 枚 | 2 MiB | 約 4 GiB |
| 1024² × 4,000 枚 | 2 MiB | 約 8 GiB |

VRL の GPU 上のボリュームは `rg8unorm`（1ボクセル2バイト、`docs/medical-volume.js`）なので、GPU 上でもほぼ同じ大きさになる。

---

## 3. ファクトチェック結果

### 3.1 Windows ＋ Quest Link 経路（近道の候補）

| # | 主張 | 確度 | 根拠・補足 |
|---|---|---|---|
| W1 | Windows 版 Chrome の WebXR は OpenXR を使う（Chrome 81 以降、既定で有効） | **B** | Chromium の `device/vr/README.md` の要約。Windows と Android の Chromium が OpenXR に対応 |
| W2 | ただし Chrome が使えるのは、拡張機能 `XR_EXT_win32_appcontainer_compatible` を実装した OpenXR ランタイムだけ | **B** | 同 README の要約。実装していないランタイムは、起動オプション `--disable-features=XRSandbox` で試せる（テスト用） |
| W3 | Meta Horizon Link のランタイムが W2 の拡張機能を実装しているか | **C** | 確認できなかった。Meta フォーラムに「Link（OpenXR）＋ Chrome 安定版で WebXR の出入りも描画も問題なく動く」という報告があるが、投稿日は未確認 |
| W4 | 2020 年当時、Chrome は Oculus 独自ランタイムの対応をやめて OpenXR に移行し、Oculus の OpenXR 対応待ちだった | **A** | A-Frame の issue #4558（2020-04-21）を直接読んだ。現在の Link は OpenXR ランタイムとして設定できる（W5） |
| W5 | Link を「有効な OpenXR ランタイム」に設定できる（Link アプリ → 設定 → 一般。管理者権限が必要） | **B** | Unity の Meta OpenXR ドキュメントの要約 |
| W6 | Link の PC 要件: Windows 10/11。推奨は RTX 20 シリーズ以上か Radeon RX 6000 以上。RTX 2050 は対象外。Intel Arc は非対応。USB-C 3.2（5 Gbps 以上）のケーブル | **B** | meta.com のヘルプの検索要約（ページは直接開けなかった） |
| W7 | ノート PC では USB-C 端子の配線によって Link がつながらない機種がある | **C** | 一般的に言われているが、一次情報は未確認。だめなら Air Link（Wi-Fi）を試す |
| W8 | Windows 版 Chrome での WebXR と WebGPU の連携（`XRGPUBinding`）は実験段階（フラグが必要。Chrome 135 Canary 以降、139 で Windows / Android 向けに開発者テスト可能）。仕様は 2026-06-15 付けの Editor's Draft | **B** | 検索要約（Chrome の WebXR 担当者のブログに由来）。**今の VR モードは WebGL2 なので、この経路には影響しない** |

**結論**: 仕組みとしてはつながるはず（W1・W5）。動くかどうかを最終的に決めるのは W3 で、これは実機で確かめるしかない。

### 3.2 Mac の「外部 GPU」

| # | 主張 | 確度 | 根拠・補足 |
|---|---|---|---|
| M1 | Apple Silicon の Mac は、macOS の標準機能としての外付け GPU（eGPU）に非対応。eGPU が使えたのは Thunderbolt 3/4 を持つ Intel Mac だけ | **B** | AppleInsider（2020）と複数の情報源。Apple のサポートページは直接読めていない |
| M2 | 2026 年に、オープンソースの実験的プロジェクト（TinyGPU）が Apple Silicon で一部の AMD / NVIDIA GPU を計算専用で使えるようにした。描画には使えない | **B** | 検索要約のみ。ブラウザの WebGPU から使えるとは考えにくい（**C**） |

**結論**: Mac 構成での「外部 GPU」は、Mac に内蔵の GPU のことになる。

### 3.3 大きいデータの制約（OS に関係なく残る）

| # | 主張 | 確度 | 根拠・補足 |
|---|---|---|---|
| D1 | WebGPU 仕様の既定の上限: `maxTextureDimension3D` 2048、`maxTextureArrayLayers` 256、`maxSampledTexturesPerShaderStage` 16、`maxStorageBufferBindingSize` 128 MiB、`maxBufferSize` 256 MiB | **A** | gpuweb/gpuweb の `spec/index.bs` 原文。実際の機器はこれより大きい値を出すことがある（→ D3） |
| D2 | VRL は 1 枚の 3D テクスチャにボリュームを入れ、一辺が `maxTextureDimension3D` を超えると全体を同じ倍率で縮小する | **A** | `docs/medical-volume.js:733`（`volumeTexturePlan`）、`:864–865` |
| D3 | Mac（Metal）や Windows（D3D12）の実際の `maxTextureDimension3D` | **C** | 機器ごとに `adapter.limits` で実測する |
| D4 | VR モード（WebGL2）の `MAX_3D_TEXTURE_SIZE` | **C** | WebGL2 仕様の最低保証は 256。実際の値は機器ごとに実測する |
| D5 | Quest 3 / 3S の本体メモリは 8 GB | **B** | Qualcomm の機器一覧、Tom's Hardware など複数 |

**結論**: 1024² × 2,000 枚以上をそのままの解像度で描くには、**z 方向を複数のテクスチャ（ブロック）に分けて持つ作業が必要**。
これは Windows でも Mac でも必要。WebGPU では 1 つのシェーダーから同時に 16 枚まで参照できる（D1）ので、方法としては可能。

### 3.4 Mac 自作経路（構想ドキュメントの本線）

| # | 主張（構想ドキュメントの節） | 確度 | 根拠・補足 |
|---|---|---|---|
| R1 | IWER の `device.remote.connectTransport(port)` と、`set_transform` / `set_gamepad_state` / `set_input_mode` / `set_connected`（§8） | **A** | IWER のソース（`a65db1c`、2026-09-24）の `packages/iwer/src/remote/RemoteControlInterface.ts:819–856, 1177`。テスト `tests/remote/connectTransport.test.ts` もある |
| R2 | IWER は `stereoEnabled` のとき、画面の半分ずつを左右の目に使う（§9） | **A** | `session/XRSession.ts:309` |
| R3 | IWER の投影は左右とも同じ対称な透視投影（`fovy` と画面比から計算）。目ごとの非対称な視野は設定できない | **A** | `session/XRSession.ts:304–319`。**構想ドキュメントにない重要な点**（→ 4 章） |
| R4 | 目の間隔（IPD）は設定できる（既定 0.063 m） | **A** | `device/XRDevice.ts:122, 385, 470–475, 922–927` |
| R5 | `updateTargetFrameRate` は名目上の値を変えるだけで、実際の描画は Mac のブラウザの `requestAnimationFrame` の速さで回る（§16） | **A** | `session/XRSession.ts:846–849`（ソースのコメント）、`:229` |
| R6 | `adb reverse` が転送できるのは tcp と UNIX ドメインソケット（localabstract / localreserved / localfilesystem）だけで、UDP はない（§12） | **A** | `adb help` の実際の出力（Android Debug Bridge 1.0.41） |
| R7 | ALVR は有線（ADB）でのストリーミングに対応（v20.12 以降はダッシュボードから設定できる）（§13） | **B** | ALVR wiki の要約 |
| R8 | ALVR のストリーマーは macOS 非対応 | **A** | ALVR の `README.md` の対応表（macOS は ✗） |
| R9 | CloudXR のサーバーは上位の NVIDIA GPU と OpenXR アプリが前提。クライアントは WebXR ＋ WebGL で、姿勢を送り映像を受け取る（§13） | **A** | `NVIDIA/cloudxr-js-samples` の `README.md` |
| R10 | Quest Browser は H.264 / H.265 / VP8 / VP9 / AV1 に対応し、多くはハードウェアで復元できる。Meta は Media Capabilities API での確認を推奨 | **B** | Meta の「Browser Video Support」の検索要約 |
| R11 | Quest Browser で WebCodecs の `VideoDecoder` が使えるか（構想 Q1） | **C** | 公式の記載は見つからなかった。実機で確かめる |
| R12 | Quest Browser は WebXR Layers / Media Layers（`XRMediaBinding`）を 16.1（2021-06）から標準で有効にしている | **B** | Meta の WebXR Layers ドキュメントの検索要約 |
| R13 | Quest 3S の USB の規格（USB 2.0 か 3.x か） | **C** | 公式の記載は見つからなかった |

---

## 4. 構想ドキュメントにない設計上の注意（Mac 自作経路を選ぶ場合）

1. **投影のずれ（R3）**: IWER は左右とも同じ対称な投影を使う。一方、Quest の実際の各目の視野は左右非対称。
   Mac の画像をそのまま各目に貼ると、大きさと視差がずれて目が疲れる。対策は次のどちらか。
   - (a) IWER を改造して、Quest の実際の投影行列を受け取れるようにする
   - (b) Quest 側で、受け取った画像を「Mac が描いたときの視野」の形の板として空間に置いて表示する
2. **各フレームに描画時の姿勢を付ける**: (b) の方式で、フレームを描画時の姿勢の位置に固定して表示すると、
   頭を回したときの遅延の大部分が見えにくくなる。この表示方法と、フレームごとの姿勢 ID を最初から仕組みに含めないと、遅延の測定が当てにならない。
3. **Media Layers（R12）は軽いが、フレームと姿勢を対応させられない**。
   1 と 2 が必要なので、本命は WebGL に映像を貼る方式。
4. **WebRTC を adb 経由で通す案（構想 Q4）は後回し**: R6 のとおり UDP は通らない。
   USB で送るなら、WebSocket ＋ WebCodecs の案（構想 §12 USB 案 1）で足りる。
5. **Quest の開発者モード**には Meta の開発者組織アカウントが必要（**C**: 大学の機器で使えるかは要確認）。

---

## 5. 選択肢の比較

| | A: Windows ＋ Quest Link | B: Mac ＋ 自作 Remote XR |
|---|---|---|
| 新しく書くコード | ほぼなし（見込み） | 多い（映像の圧縮・送信・復元、姿勢の転送、投影の補正、遅延の測定） |
| 遅延対策 | Meta が担当 | 自作 |
| 必要な機材 | 対応 GPU を積んだ Windows PC、USB-C 3.x ケーブル | Mac、USB データケーブル、adb |
| 一番の不確定要素 | W3（Link ランタイムが Chrome で動くか） | R11（WebCodecs）、遅延、R3 の補正 |
| 大きいデータ | z 方向の分割が必要（3.3） | 同じく必要 |

**現時点の推奨**: A を先に実機で確かめる。動けば、残る作業は「大きいデータへの対応」だけになる。
B は、A が使えない場合（Mac で完結させたい場合など）に進める。

---

## 6. 来週の検討用：最初にやる確認（コード変更なし）

### 確認 1: Windows ＋ Link で VRL の VR モードが動くか（W3 を確定させる）

1. 対応 GPU の Windows PC に Meta Horizon Link を入れ、Quest を USB-C 3.x ケーブルでつなぐ。
2. Link アプリ → 設定 → 一般 →「Meta Horizon Link を有効な OpenXR ランタイムにする」。
3. Windows 版 Chrome でいつものプレビュー URL を開く。「VRで見る」ボタンが出るかを見る。
4. 練習データ（512³）で VR に入る。次を記録する。
   - Quest に表示されるか
   - コントローラーが効くか（つかむ・メニュー・レーザー）
   - VR パネルに出る fps
5. ボタンが出ない、または入れない場合: Chrome のバージョン、`chrome://gpu`、
   起動オプション `--disable-features=XRSandbox`（テスト用）で変わるかを記録する。

### 確認 2: 大きいデータでの上限（VR なしでよい）

- Windows PC と Mac の両方で、`adapter.limits.maxTextureDimension3D`、`maxBufferSize`、
  WebGL2 の `MAX_3D_TEXTURE_SIZE` を記録する（D3・D4）。
- 1024² × 2,000 枚程度のデータ（実データか合成データ）が読み込めるか、メモリはどれだけか、3D 表示は何 fps かを見る。

### オーナーに決めてもらうこと

- 描画担当に Windows ＋ RTX を使ってよいか。Mac だけで完結させたいか。
- 想定している実データ（スライス枚数、ボクセルサイズ、装置名）。サンプルがあるか。
- 使う予定の PC / Mac の機種、GPU、メモリ容量。

---

## 7. 出典

- IWER（ソースを取得して確認、commit `a65db1c`）: https://github.com/meta-quest/immersive-web-emulation-runtime
- WebGPU 仕様（原文）: https://github.com/gpuweb/gpuweb/blob/main/spec/index.bs
- `adb help` の出力（Android Debug Bridge 1.0.41、この環境で実行）
- Android adb ドキュメント: https://developer.android.com/tools/adb
- ALVR README: https://github.com/alvr-org/ALVR
- ALVR wired setup: https://github.com/alvr-org/ALVR/wiki/ALVR-wired-setup-(ALVR-over-USB)
- CloudXR.js samples: https://github.com/NVIDIA/cloudxr-js-samples
- A-Frame issue #4558（2020）: https://github.com/aframevr/aframe/issues/4558
- Chromium device/vr README（検索経由）: https://chromium.googlesource.com/chromium/src/+/HEAD/device/vr/README.md
- Meta Horizon Link PC requirements（検索経由）: https://www.meta.com/help/quest/140991407990979/
- Configure Meta Horizon Link（Unity、検索経由）: https://docs.unity3d.com/Packages/com.unity.xr.meta-openxr@2.3/manual/get-started/link.html
- WebXR with a Quest connected to desktop using Link（Meta フォーラム、検索経由）: https://communityforums.atmeta.com/discussions/dev-quest/webxr-with-a-quest-connected-to-desktop-using-link/833765
- Meta Browser Video Support（検索経由）: https://developers.meta.com/horizon/documentation/web/browser-video/
- Meta WebXR Layers（検索経由）: https://developers.meta.com/horizon/documentation/web/webxr-layers/
- Experimenting with WebGPU in WebXR（検索経由）: https://toji.dev/2025/03/03/experimenting-with-webgpu-in-webxr.html
- Apple Silicon と eGPU（AppleInsider、検索経由）: https://appleinsider.com/articles/20/11/10/apple-silicon-m1-macs-do-not-support-egpus
- Quest 3S の仕様（Qualcomm、検索経由）: https://www.qualcomm.com/xr-vr-ar/device-finder/meta-quest-3s
