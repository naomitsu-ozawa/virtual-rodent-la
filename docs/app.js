
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.webgpu.js';
import { WebGLRenderer } from 'https://cdn.jsdelivr.net/npm/three@0.186.0/build/three.module.js';
import dicomParser from 'https://esm.sh/dicom-parser@1.8.21';
import { unzip } from 'https://esm.sh/fflate@0.8.2';

const DEMO_URL='https://zenodo.org/api/records/12761093/files/PET-CT.zip/content';
const DEMO_SIZE=20800000;
const app=document.querySelector('#app');
let currentLanguage='ja';
const I18N={
 ja:{
  subtitle:'マウス・実験動物画像のためのブラウザDICOM CTビューワー',
  gpuChecking:'WEBGPU 確認中',
  demo:'公開マウスCTデモ',openFolder:'DICOMフォルダを開く',
  dataset:'データセット',series:'DICOMシリーズ',selectData:'データを選択してください',
  selectDataHelp:'ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。',
  display:'表示',ctDisplay:'CT表示',windowCenter:'ウィンドウ中心',windowWidth:'ウィンドウ幅',
  segmentation:'セグメンテーション',segments:'組織セグメント',
  bone:'骨',soft:'軟部組織',fat:'脂肪',lung:'肺',min:'最小',max:'最大',opacity:'不透明度',segmentPreset:'セグメントプリセット',addSegment:'セグメントを追加',removeSegment:'削除',opening:'Opening',closing:'Closing',minComponent:'最小連結成分',holeFill:'Hole Filling',
  surfaceSmooth:'表面平滑化',strength:'強度',sigmoidCenter:'中心',filterThreshold:'検出閾値',iterations:'反復回数',passes:'Pass数',searchRadius:'探索半径',patchRadius:'パッチ半径',spatialSigma:'空間Sigma',intensitySigma:'強度Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'STL書き出し',volumeMode:'体積解析',volumeOff:'体積解析を終了',volumeHint:'3D上の部品をクリックしてください',resetFilters:'画像フィルターをリセット',
  controls:'断面画像: 左右スワイプ / マウスホイールでスライス移動',
  seriesUnselected:'シリーズ未選択',selectSeries:'左の一覧からCTシリーズを選択してください。',
  footer:'元のキャリブレーション済みCT値は保持されます。',
  slices:'スライス',matrix:'マトリクス',voxel:'ボクセル',stored:'保存形式',
  estimated:'推定展開サイズ',decoding:'CTボリュームを展開中…',ready:'CTボリューム準備完了',
  demoLoading:'公開マウスPET/CTを取得中…',demoSize:'約20.8MBの公開データです。',
  demoFailed:'公開デモを読み込めませんでした',dicomChecking:'DICOMを確認中…',
  pixelDeferred:'Pixel Dataはまだ展開しません。',noSeries:'DICOMシリーズを検出できませんでした',
  original:'元のキャリブレーション済みCT値',processingReset:'処理をリセットしました。元のキャリブレーション済みCT値を復元しました',
  demoCache:'公開デモ: キャッシュ済みデータを使用',demoDone:'公開デモ: ダウンロード完了。端末キャッシュへ保存中'
 },
 en:{
  subtitle:'Browser-based DICOM CT viewer for mouse and laboratory-animal imaging',
  gpuChecking:'WEBGPU CHECKING',
  demo:'Public mouse CT demo',openFolder:'Open DICOM folder',
  dataset:'DATASET',series:'DICOM Series',selectData:'Select data',
  selectDataHelp:'Use a local folder or the approximately 20.8 MB public mouse PET/CT demo.',
  display:'DISPLAY',ctDisplay:'CT display',windowCenter:'Window Center',windowWidth:'Window Width',
  segmentation:'SEGMENTATION',segments:'Tissue segments',
  bone:'Bone',soft:'Soft tissue',fat:'Fat',lung:'Lung',min:'Min',max:'Max',opacity:'Opacity',segmentPreset:'Segment preset',addSegment:'Add segment',removeSegment:'Remove',opening:'Opening',closing:'Closing',minComponent:'Min Component',holeFill:'Hole Filling',
  surfaceSmooth:'Surface Smooth',strength:'Strength',sigmoidCenter:'Center',filterThreshold:'Threshold',iterations:'Iterations',passes:'Passes',searchRadius:'Search Radius',patchRadius:'Patch Radius',spatialSigma:'Spatial Sigma',intensitySigma:'Intensity Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'Export STL',volumeMode:'Volume analysis',volumeOff:'Exit volume analysis',volumeHint:'Click a 3D component',resetFilters:'Reset image filters',
  controls:'MPR slices: swipe left/right or use the mouse wheel',
  seriesUnselected:'No Series selected',selectSeries:'Select a CT Series from the list on the left.',
  footer:'Original calibrated CT values are preserved.',
  slices:'Slices',matrix:'Matrix',voxel:'Voxel',stored:'Stored',
  estimated:'Estimated decoded size',decoding:'Decoding CT volume…',ready:'CT volume ready',
  demoLoading:'Loading public mouse PET/CT…',demoSize:'Approximately 20.8 MB of public data.',
  demoFailed:'Could not load the public demo',dicomChecking:'Checking DICOM…',
  pixelDeferred:'Pixel Data has not been expanded yet.',noSeries:'No DICOM Series detected',
  original:'Original calibrated CT values',processingReset:'Processing reset. Original calibrated CT values restored.',
  demoCache:'Public demo: using cached data',demoDone:'Public demo: download complete. Saving to device cache'
 }
};
const tr=key=>I18N[currentLanguage][key]??key;
function applyLanguage(lang){
 currentLanguage=lang;
 document.documentElement.lang=lang;
 document.title=lang==='ja'?'Virtual Rodent Lab — DICOMビューワー':'Virtual Rodent Lab — DICOM Viewer';
 document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(key)el.textContent=tr(key)});
 const toggle=document.querySelector('#language-toggle');if(toggle)toggle.textContent=lang==='ja'?'English':'日本語';
}
app.innerHTML=`
<main class="app-shell"><div id="processing-overlay" class="processing-overlay is-hidden" role="status" aria-live="polite" aria-busy="true"><div class="processing-spinner" aria-hidden="true"></div><strong id="processing-overlay-label">処理中…</strong></div>
<header class="topbar"><div><p class="eyebrow">SMALL-ANIMAL CT / WEBGPU</p><h1>Virtual Rodent Lab</h1><p class="subtitle" data-i18n="subtitle">マウス・実験動物画像のためのブラウザDICOM CTビューワー</p></div><div class="topbar-actions"><button id="language-toggle" class="secondary-button" type="button">English</button><div id="gpu-status" class="status status-checking" data-i18n="gpuChecking">WEBGPU 確認中</div><button id="demo-button" class="secondary-button" data-i18n="demo">公開マウスCTデモ</button><button id="open-folder" class="primary-button" data-i18n="openFolder">DICOMフォルダを開く</button><input id="folder-input" class="visually-hidden" type="file" webkitdirectory multiple></div></header>
<section class="workspace"><aside class="sidebar"><div class="sidebar-scroll"><section class="panel"><div class="panel-heading"><div><p class="panel-kicker" data-i18n="dataset">データセット</p><h2 data-i18n="series">DICOMシリーズ</h2></div></div><div id="scan-state" class="empty-state"><strong data-i18n="selectData">データを選択してください</strong><span data-i18n="selectDataHelp">ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。</span></div><div id="scan-progress" class="progress-wrap is-hidden"><div class="progress-track"><div id="scan-progress-bar" class="progress-bar"></div></div><span id="scan-progress-label">0 / 0</span></div><div id="series-list" class="series-list"></div></section>
<section class="panel compact-panel"><div class="panel-heading"><div><p class="panel-kicker" data-i18n="display">表示</p><h2 data-i18n="ctDisplay">CT表示</h2></div></div><label class="range-row"><span data-i18n="windowCenter">ウィンドウ中心</span><output id="wc-val">—</output><input id="wc" type="range" min="-2000" max="4000" value="500" disabled></label><label class="range-row"><span data-i18n="windowWidth">ウィンドウ幅</span><output id="ww-val">—</output><input id="ww" type="range" min="1" max="8000" value="3000" disabled></label><div class="panel-heading segment-heading"><div><p class="panel-kicker" data-i18n="segmentation">セグメンテーション</p><h2 data-i18n="segments">組織セグメント</h2></div></div><div class="segment-add-row">
  <label class="segment-preset-label"><span data-i18n="segmentPreset">セグメントプリセット</span>
    <select id="segment-add-select" class="filter-select" disabled>
      <option value="bone" data-i18n="bone">骨</option>
      <option value="soft" data-i18n="soft">軟部組織</option>
      <option value="fat" data-i18n="fat">脂肪</option>
      <option value="lung" data-i18n="lung">肺</option>
    </select>
  </label>
  <button id="segment-add-button" class="tool-chip" type="button" data-i18n="addSegment" disabled>セグメントを追加</button>
</div>
<div id="segment-controls" class="segment-controls"><div class="segment-card is-hidden" data-segment="bone">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="bone" checked disabled><strong data-i18n="bone">骨</strong></label><input class="segment-color" data-seg-color="bone" type="color" value="#f3f0e8" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="bone">—</output><input data-seg-min="bone" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="bone">—</output><input data-seg-max="bone" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="bone">0.85</output><input data-seg-opacity="bone" type="range" min="0" max="1" step="0.05" value="0.85" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="bone">0</output><input data-seg-opening="bone" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="bone">0</output><input data-seg-closing="bone" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="bone">0</output><input data-seg-min-component="bone" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="bone" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="bone" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="bone" data-i18n="removeSegment" disabled>削除</button>
</div><div class="segment-card is-hidden" data-segment="soft">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="soft"  disabled><strong data-i18n="soft">軟部組織</strong></label><input class="segment-color" data-seg-color="soft" type="color" value="#d97f7f" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="soft">—</output><input data-seg-min="soft" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="soft">—</output><input data-seg-max="soft" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="soft">0.28</output><input data-seg-opacity="soft" type="range" min="0" max="1" step="0.05" value="0.28" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="soft">0</output><input data-seg-opening="soft" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="soft">0</output><input data-seg-closing="soft" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="soft">0</output><input data-seg-min-component="soft" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="soft" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="soft" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="soft" data-i18n="removeSegment" disabled>削除</button>
</div><div class="segment-card is-hidden" data-segment="fat">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="fat"  disabled><strong data-i18n="fat">脂肪</strong></label><input class="segment-color" data-seg-color="fat" type="color" value="#e7c85d" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="fat">—</output><input data-seg-min="fat" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="fat">—</output><input data-seg-max="fat" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="fat">0.35</output><input data-seg-opacity="fat" type="range" min="0" max="1" step="0.05" value="0.35" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="fat">0</output><input data-seg-opening="fat" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="fat">0</output><input data-seg-closing="fat" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="fat">0</output><input data-seg-min-component="fat" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="fat" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="fat" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="fat" data-i18n="removeSegment" disabled>削除</button>
</div><div class="segment-card is-hidden" data-segment="lung">
<div class="segment-card-head"><label><input class="segment-enabled" type="checkbox" data-seg-enabled="lung" disabled><strong data-i18n="lung">肺</strong></label><input class="segment-color" data-seg-color="lung" type="color" value="#6fb8d6" disabled></div>
<label class="segment-range"><span data-i18n="min">最小</span><output data-seg-min-out="lung">—</output><input data-seg-min="lung" type="range" min="0" max="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="max">最大</span><output data-seg-max-out="lung">—</output><input data-seg-max="lung" type="range" min="0" max="1" value="1" disabled></label>
<label class="segment-range"><span data-i18n="opacity">不透明度</span><output data-seg-opacity-out="lung">0.35</output><input data-seg-opacity="lung" type="range" min="0" max="1" step="0.05" value="0.35" disabled></label>
<div class="segment-postprocess">
<label class="segment-range"><span data-i18n="opening">Opening</span><output data-seg-opening-out="lung">0</output><input data-seg-opening="lung" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="closing">Closing</span><output data-seg-closing-out="lung">0</output><input data-seg-closing="lung" type="range" min="0" max="3" step="1" value="0" disabled></label>
<label class="segment-range"><span data-i18n="minComponent">最小連結成分</span><output data-seg-min-component-out="lung">0</output><input data-seg-min-component="lung" type="range" min="0" max="5000" step="50" value="0" disabled></label>
<label class="surface-smooth-toggle"><input data-seg-hole-fill="lung" type="checkbox" disabled><strong data-i18n="holeFill">Hole Filling</strong></label>
</div>
<button class="segment-export-stl" data-seg-export="lung" data-i18n="exportStl" disabled>STL書き出し</button>
<button class="segment-remove-button" data-seg-remove="lung" data-i18n="removeSegment" disabled>削除</button>
</div></div><div class="surface-smooth-card">
  <label class="surface-smooth-toggle"><input id="surface-smooth-enabled" type="checkbox" checked disabled><strong data-i18n="surfaceSmooth">表面平滑化</strong></label>
  <label class="segment-range"><span data-i18n="strength">強度</span><output id="surface-smooth-value">0.60</output><input id="surface-smooth-strength" type="range" min="0" max="3" step="0.05" value="0.60" disabled></label>
</div>
<div class="filter-add-row">
  <select id="filter-add-select" class="filter-select">
    <option value="spikeHole">Spike / Hole</option>
    <option value="nlm">Fast NLM 3D</option>
    <option value="anisotropic">Anisotropic Diffusion</option>
    <option value="gaussian">Spatial Filter 3D</option>
    <option value="sigmoid">Sigmoid</option>
    <option value="bilateral">Bilateral 3D</option>
    <option value="tv">TV Denoising 3D</option>
    <option value="unsharp">Unsharp Mask 3D</option>
  </select>
  <button id="filter-add-button" class="tool-chip" type="button">フィルターを追加</button>
</div>
<div class="filter-control-list">
  <div class="filter-control-card is-hidden" data-filter-key="spikeHole" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-spike-hole" type="checkbox" disabled><strong>Spike / Hole</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="spike-hole-strength-value">0.50</output><input id="spike-hole-strength" type="range" min="0" max="1" step="0.05" value="0.50" disabled></label>
    <label class="segment-range"><span data-i18n="filterThreshold">検出閾値</span><output id="spike-hole-threshold-value">0.075</output><input id="spike-hole-threshold" type="range" min="0.01" max="0.15" step="0.005" value="0.075" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="nlm" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-nlm" type="checkbox" disabled><strong>Fast NLM 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="nlm-strength-value">0.45</output><input id="nlm-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
    <label class="segment-range"><span data-i18n="searchRadius">探索半径</span><output id="nlm-search-radius-value">1</output><input id="nlm-search-radius" type="range" min="1" max="2" step="1" value="1" disabled></label>
    <label class="segment-range"><span data-i18n="patchRadius">パッチ半径</span><output id="nlm-patch-radius-value">1</output><input id="nlm-patch-radius" type="range" min="0" max="2" step="1" value="1" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="anisotropic" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-anisotropic" type="checkbox" disabled><strong>Anisotropic Diffusion</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="anisotropic-strength-value">0.45</output><input id="anisotropic-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
    <label class="segment-range"><span data-i18n="iterations">反復回数</span><output id="anisotropic-iterations-value">4</output><input id="anisotropic-iterations" type="range" min="1" max="12" step="1" value="4" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="gaussian" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-gaussian" type="checkbox" disabled><strong>Spatial Filter 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span><select id="filter-smoothing-type" class="filter-select" disabled><option value="gaussian">Gaussian 3D</option><option value="median">Median 3D</option></select></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="gaussian-strength-value">0.40</output><input id="gaussian-strength" type="range" min="0" max="1" step="0.05" value="0.40" disabled></label>
    <label class="segment-range"><span data-i18n="passes">Pass数</span><output id="spatial-passes-value">2</output><input id="spatial-passes" type="range" min="1" max="6" step="1" value="2" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="sigmoid" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-sigmoid" type="checkbox" disabled><strong>Sigmoid</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="sigmoid-strength-value">0.50</output><input id="sigmoid-strength" type="range" min="0" max="1" step="0.05" value="0.50" disabled></label>
    <label class="segment-range"><span data-i18n="sigmoidCenter">中心</span><output id="sigmoid-center-value">—</output><input id="sigmoid-center" type="range" min="0" max="1" step="1" value="0" disabled></label>
  </div>

  <div class="filter-control-card is-hidden" data-filter-key="bilateral" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-bilateral" type="checkbox" disabled><strong>Bilateral 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="strength">強度</span><output id="bilateral-strength-value">0.45</output><input id="bilateral-strength" type="range" min="0" max="1" step="0.05" value="0.45" disabled></label>
    <label class="segment-range"><span data-i18n="spatialSigma">空間Sigma</span><output id="bilateral-spatial-value">1.20</output><input id="bilateral-spatial" type="range" min="0.5" max="2.5" step="0.1" value="1.2" disabled></label>
    <label class="segment-range"><span data-i18n="intensitySigma">強度Sigma</span><output id="bilateral-intensity-value">0.08</output><input id="bilateral-intensity" type="range" min="0.01" max="0.25" step="0.01" value="0.08" disabled></label>
    <label class="segment-range"><span data-i18n="passes">Pass数</span><output id="bilateral-passes-value">1</output><input id="bilateral-passes" type="range" min="1" max="3" step="1" value="1" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="tv" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-tv" type="checkbox" disabled><strong>TV Denoising 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="weight">Weight</span><output id="tv-weight-value">0.12</output><input id="tv-weight" type="range" min="0.01" max="0.30" step="0.01" value="0.12" disabled></label>
    <label class="segment-range"><span data-i18n="iterations">反復回数</span><output id="tv-iterations-value">8</output><input id="tv-iterations" type="range" min="1" max="20" step="1" value="8" disabled></label>
  </div>
  <div class="filter-control-card is-hidden" data-filter-key="unsharp" draggable="true">
    <div class="filter-control-head"><label class="filter-enable-label"><input class="filter-internal-toggle" id="filter-unsharp" type="checkbox" disabled><strong>Unsharp Mask 3D</strong></label><span class="filter-reorder-controls"><button type="button" class="filter-order-button" data-filter-move="up" aria-label="Move filter up">↑</button><button type="button" class="filter-order-button" data-filter-move="down" aria-label="Move filter down">↓</button><span class="filter-drag-handle" title="Drag to reorder">⋮⋮</span><button type="button" class="filter-remove-button" data-filter-remove aria-label="Remove filter">×</button></span></div>
    <label class="segment-range"><span data-i18n="radius">Radius</span><output id="unsharp-radius-value">1</output><input id="unsharp-radius" type="range" min="1" max="3" step="1" value="1" disabled></label>
    <label class="segment-range"><span data-i18n="amount">Amount</span><output id="unsharp-amount-value">0.80</output><input id="unsharp-amount" type="range" min="0" max="2" step="0.05" value="0.80" disabled></label>
    <label class="segment-range"><span data-i18n="filterThreshold">検出閾値</span><output id="unsharp-threshold-value">0.02</output><input id="unsharp-threshold" type="range" min="0" max="0.20" step="0.01" value="0.02" disabled></label>
  </div>
  <button id="filter-reset" class="tool-chip filter-reset" data-i18n="resetFilters" disabled>画像フィルターをリセット</button>
</div><p class="hint" data-i18n="controls">1本指: 3D回転 / 2本指: ズーム・移動 / MPRは上下ドラッグでスライス移動</p></section></div></aside>
<section class="viewer-grid"><section class="viewport-card viewport-card-main"><div class="viewport-label"><strong>3D</strong><span id="three-label">WebGPU</span></div><div class="volume-analysis-panel"><button id="volume-analysis-toggle" class="tool-chip" data-i18n="volumeMode" disabled>体積解析</button><div id="volume-analysis-result" class="volume-analysis-result is-hidden"></div></div><div id="viewport-3d" class="viewport viewport-3d"></div><div id="selected" class="selected-series-overlay"><strong data-i18n="seriesUnselected">シリーズ未選択</strong><span data-i18n="selectSeries">左の一覧からCTシリーズを選択してください。</span></div></section><section class="mpr-column">${['axial','coronal','sagittal'].map(p=>`<article class="viewport-card mpr-card"><div class="viewport-label"><strong>${p[0].toUpperCase()+p.slice(1)}</strong><span id="${p}-label">—</span></div><canvas id="${p}-canvas" class="mpr-canvas"></canvas><input id="${p}-slider" class="slice-slider" type="range" min="0" max="0" value="0" disabled></article>`).join('')}</section></section></section>
<footer><span id="footer" data-i18n="footer">元のキャリブレーション済みCT値は保持されます。</span><a href="https://github.com/naomitsu-ozawa/virtual-rodent-la" target="_blank" rel="noopener">Source / License</a></footer></main>`;

const $=s=>document.querySelector(s);
const viewport=$('#viewport-3d'),status=$('#gpu-status'),demoBtn=$('#demo-button'),folderBtn=$('#open-folder'),folderInput=$('#folder-input'),state=$('#scan-state'),prog=$('#scan-progress'),bar=$('#scan-progress-bar'),progLabel=$('#scan-progress-label'),list=$('#series-list'),selected=$('#selected'),footer=$('#footer'),threeLabel=$('#three-label'),wc=$('#wc'),ww=$('#ww'),wcVal=$('#wc-val'),wwVal=$('#ww-val'),gaussianBtn=$('#filter-gaussian'),smoothingType=$('#filter-smoothing-type'),spikeHoleBtn=$('#filter-spike-hole'),resetFilterBtn=$('#filter-reset'),nlmBtn=$('#filter-nlm'),anisotropicBtn=$('#filter-anisotropic'),sigmoidBtn=$('#filter-sigmoid'),gaussianStrength=$('#gaussian-strength'),gaussianStrengthValue=$('#gaussian-strength-value'),spatialPasses=$('#spatial-passes'),spatialPassesValue=$('#spatial-passes-value'),spikeHoleStrength=$('#spike-hole-strength'),spikeHoleStrengthValue=$('#spike-hole-strength-value'),spikeHoleThreshold=$('#spike-hole-threshold'),spikeHoleThresholdValue=$('#spike-hole-threshold-value'),nlmStrength=$('#nlm-strength'),nlmStrengthValue=$('#nlm-strength-value'),nlmSearchRadius=$('#nlm-search-radius'),nlmSearchRadiusValue=$('#nlm-search-radius-value'),nlmPatchRadius=$('#nlm-patch-radius'),nlmPatchRadiusValue=$('#nlm-patch-radius-value'),anisotropicStrength=$('#anisotropic-strength'),anisotropicStrengthValue=$('#anisotropic-strength-value'),anisotropicIterations=$('#anisotropic-iterations'),anisotropicIterationsValue=$('#anisotropic-iterations-value'),sigmoidStrength=$('#sigmoid-strength'),sigmoidStrengthValue=$('#sigmoid-strength-value'),sigmoidCenter=$('#sigmoid-center'),sigmoidCenterValue=$('#sigmoid-center-value'),bilateralBtn=$('#filter-bilateral'),bilateralStrength=$('#bilateral-strength'),bilateralStrengthValue=$('#bilateral-strength-value'),bilateralSpatial=$('#bilateral-spatial'),bilateralSpatialValue=$('#bilateral-spatial-value'),bilateralIntensity=$('#bilateral-intensity'),bilateralIntensityValue=$('#bilateral-intensity-value'),bilateralPasses=$('#bilateral-passes'),bilateralPassesValue=$('#bilateral-passes-value'),tvBtn=$('#filter-tv'),tvWeight=$('#tv-weight'),tvWeightValue=$('#tv-weight-value'),tvIterations=$('#tv-iterations'),tvIterationsValue=$('#tv-iterations-value'),unsharpBtn=$('#filter-unsharp'),unsharpRadius=$('#unsharp-radius'),unsharpRadiusValue=$('#unsharp-radius-value'),unsharpAmount=$('#unsharp-amount'),unsharpAmountValue=$('#unsharp-amount-value'),unsharpThreshold=$('#unsharp-threshold'),unsharpThresholdValue=$('#unsharp-threshold-value'),surfaceSmoothEnabled=$('#surface-smooth-enabled'),surfaceSmoothStrength=$('#surface-smooth-strength'),surfaceSmoothValue=$('#surface-smooth-value'),volumeAnalysisToggle=$('#volume-analysis-toggle'),volumeAnalysisResult=$('#volume-analysis-result'),filterControlList=$('.filter-control-list'),filterAddSelect=$('#filter-add-select'),filterAddButton=$('#filter-add-button'),segmentAddSelect=$('#segment-add-select'),segmentAddButton=$('#segment-add-button'),segmentControls=$('#segment-controls');
const planes=Object.fromEntries(['axial','coronal','sagittal'].map(p=>[p,{canvas:$('#'+p+'-canvas'),slider:$('#'+p+'-slider'),label:$('#'+p+'-label')}]))
const languageToggle=$('#language-toggle'),processingOverlay=$('#processing-overlay'),processingOverlayLabel=$('#processing-overlay-label');
languageToggle.onclick=()=>applyLanguage(currentLanguage==='ja'?'en':'ja');
applyLanguage('ja');;
let volume=null,sourceVolume=null,sceneState=null,activeId=null,activeSeries=null,volumeAnalysisMode=false,volumeAnalysisBusy=false,sourceRenderRevision=0;
const filterState={spikeHole:false,nlm:false,anisotropic:false,gaussian:false,sigmoid:false,bilateral:false,tv:false,unsharp:false};
const FILTER_CATALOG_ORDER=['spikeHole','nlm','anisotropic','gaussian','sigmoid','bilateral','tv','unsharp'];
let filterOrder=[];
let filterRebuildTimer=null;
let filterRebuildRevision=0;
let filterRebuildFinalize3D=true;
const filterWorkerState={worker:null,source:null,ready:false,initPromise:null,resolveInit:null,rejectInit:null,nextId:0,pending:new Map(),disabled:false};
const SEGMENT_PRESET_ORDER=['bone','soft','fat','lung'];
const segmentState={
 bone:{active:false,enabled:false,color:'#f3f0e8',opacity:.85,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 soft:{active:false,enabled:false,color:'#d97f7f',opacity:.28,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 fat:{active:false,enabled:false,color:'#e7c85d',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''},
 lung:{active:false,enabled:false,color:'#6fb8d6',opacity:.35,min:0,max:1,opening:0,closing:0,minComponent:0,holeFill:false,_maskCache:null,_maskCacheKey:''}
};
let segmentRenderTimer=null;

function renderSegmentPresets(){
 const active=new Set(SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active));
 for(const key of SEGMENT_PRESET_ORDER){
  const card=segmentControls.querySelector('[data-segment="'+key+'"]');
  if(card)card.classList.toggle('is-hidden',!active.has(key));
  const option=[...segmentAddSelect.options].find(o=>o.value===key);
  if(option)option.disabled=active.has(key);
 }
 const next=[...segmentAddSelect.options].find(o=>!o.disabled);
 if(next)segmentAddSelect.value=next.value;
 segmentAddSelect.disabled=!volume||!next;
 segmentAddButton.disabled=!volume||!next;
}
function addSegmentPreset(key){
 if(!volume||!SEGMENT_PRESET_ORDER.includes(key)||segmentState[key].active)return;
 const seg=segmentState[key];seg.active=true;seg.enabled=true;
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.checked=true;enabled.disabled=false;color.disabled=false;min.disabled=false;max.disabled=false;opacity.disabled=false;
 const sourceMode=volume?.sourceBacked===true;opening.disabled=sourceMode;closing.disabled=sourceMode;minComponent.disabled=sourceMode;holeFill.disabled=sourceMode;
 if(exportBtn)exportBtn.disabled=sourceMode;if(removeBtn)removeBtn.disabled=false;
 renderSegmentPresets();renderAll();scheduleSegment3D();
}
function removeSegmentPreset(key){
 if(!SEGMENT_PRESET_ORDER.includes(key)||!segmentState[key].active)return;
 const seg=segmentState[key];seg.active=false;seg.enabled=false;
 const enabled=$('[data-seg-enabled="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]');
 if(enabled)enabled.checked=false;if(removeBtn)removeBtn.disabled=true;
 renderSegmentPresets();clearAnalysisHighlight();renderAll();scheduleSegment3D();
}
segmentAddButton.onclick=()=>addSegmentPreset(segmentAddSelect.value);
volumeAnalysisToggle.onclick=()=>{
 if(!volume)return;
 volumeAnalysisMode=!volumeAnalysisMode;
 volumeAnalysisToggle.textContent=volumeAnalysisMode?tr('volumeOff'):tr('volumeMode');
 volumeAnalysisToggle.classList.toggle('is-active',volumeAnalysisMode);
 volumeAnalysisResult.classList.toggle('is-hidden',!volumeAnalysisMode);
 if(volumeAnalysisMode)volumeAnalysisResult.textContent=tr('volumeHint');
 else clearAnalysisHighlight();
};
folderBtn.onclick=()=>{folderInput.value='';folderInput.click()};
folderInput.onchange=async()=>{const files=[...(folderInput.files||[])];if(files.length)await inspect(files,false)};
demoBtn.onclick=async()=>{busy(true);resetVolume();list.replaceChildren();state.classList.remove('is-hidden');prog.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('demoLoading')+'</strong><span>'+tr('demoSize')+'</span>';try{const files=await loadDemo();await inspect(files,true)}catch(e){console.error(e);state.innerHTML='<strong>'+tr('demoFailed')+'</strong><span>'+esc(e.message||e)+'</span>';footer.textContent='Demo error: '+String(e.message||e)}finally{busy(false);prog.classList.add('is-hidden')}};
wc.oninput=ww.oninput=renderAll;
for(const key of Object.keys(segmentState)){
 const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]'),exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
 enabled.onchange=()=>{segmentState[key].enabled=enabled.checked;renderAll();scheduleSegment3D()};
 color.oninput=()=>{segmentState[key].color=color.value;renderAll();scheduleSegment3D()};
 min.oninput=()=>{segmentState[key].min=Math.min(+min.value,segmentState[key].max);min.value=segmentState[key].min;segmentState[key]._maskCache=null;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
 max.oninput=()=>{segmentState[key].max=Math.max(+max.value,segmentState[key].min);max.value=segmentState[key].max;segmentState[key]._maskCache=null;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
 opacity.oninput=()=>{segmentState[key].opacity=+opacity.value;updateSegmentOutputs(key);renderAll();scheduleSegment3D()};
 const invalidateSegment=()=>{segmentState[key]._maskCache=null;segmentState[key]._maskCacheKey='';clearAnalysisHighlight();renderAll();scheduleSegment3D()};
 opening.oninput=()=>{segmentState[key].opening=+opening.value;$('[data-seg-opening-out="'+key+'"]').value=opening.value;invalidateSegment()};
 closing.oninput=()=>{segmentState[key].closing=+closing.value;$('[data-seg-closing-out="'+key+'"]').value=closing.value;invalidateSegment()};
 minComponent.oninput=()=>{segmentState[key].minComponent=+minComponent.value;$('[data-seg-min-component-out="'+key+'"]').value=minComponent.value;invalidateSegment()};
 holeFill.onchange=()=>{segmentState[key].holeFill=holeFill.checked;invalidateSegment()};
 exportBtn.onclick=()=>exportSegmentStl(key);
 removeBtn.onclick=()=>removeSegmentPreset(key);
}
surfaceSmoothEnabled.onchange=()=>{surfaceSmoothStrength.disabled=!surfaceSmoothEnabled.checked||!volume;scheduleSegment3D()};
surfaceSmoothStrength.oninput=()=>{surfaceSmoothValue.value=(+surfaceSmoothStrength.value).toFixed(2);scheduleSegment3D()};
const liveFilterState={timer:null,base:null,key:null};
function beginLiveFilter(key){
 if(!volume)return;
 if(liveFilterState.key!==key||!liveFilterState.base){
  liveFilterState.key=key;
  liveFilterState.base=volume;
 }
}
function scheduleLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 liveFilterState.timer=setTimeout(()=>void fn(liveFilterState.base),260);
}
function finishLiveFilter(key,fn){
 if(!volume)return;
 beginLiveFilter(key);
 clearTimeout(liveFilterState.timer);
 void fn(liveFilterState.base).finally(()=>{
  if(liveFilterState.key===key){liveFilterState.base=null;liveFilterState.key=null}
 });
}
function bindLiveSlider(input,output,key,fn){
 input.addEventListener('pointerdown',()=>beginLiveFilter(key));
 input.addEventListener('input',()=>{
  output.value=(+input.value).toFixed(2);
  scheduleLiveFilter(key,fn);
 });
 input.addEventListener('change',()=>finishLiveFilter(key,fn));
}

function filterStageDescriptor(key){
 let params;
 if(key==='spikeHole')params={strength:+spikeHoleStrength.value,threshold:+spikeHoleThreshold.value};
 else if(key==='nlm')params={strength:+nlmStrength.value,searchRadius:+nlmSearchRadius.value,patchRadius:+nlmPatchRadius.value};
 else if(key==='anisotropic')params={strength:+anisotropicStrength.value,iterations:+anisotropicIterations.value};
 else if(key==='gaussian')params={mode:smoothingType.value,strength:+gaussianStrength.value,passes:+spatialPasses.value};
 else if(key==='sigmoid')params={strength:+sigmoidStrength.value,center:+sigmoidCenter.value};
 else if(key==='bilateral')params={strength:+bilateralStrength.value,spatialSigma:+bilateralSpatial.value,intensitySigma:+bilateralIntensity.value,passes:+bilateralPasses.value};
 else if(key==='tv')params={weight:+tvWeight.value,iterations:+tvIterations.value};
 else if(key==='unsharp')params={radius:+unsharpRadius.value,amount:+unsharpAmount.value,threshold:+unsharpThreshold.value};
 else params={};
 return{key,params,signature:key+':'+JSON.stringify(params)};
}
function activeFilterStages(){return filterOrder.filter(key=>filterState[key]).map(filterStageDescriptor)}
function setFilterWorkerBusy(busyState,label='Filters'){
 if(processingOverlay){
  processingOverlay.classList.toggle('is-hidden',!busyState);
  processingOverlay.setAttribute('aria-busy',busyState?'true':'false');
 }
 if(processingOverlayLabel)processingOverlayLabel.textContent=busyState?label+' · 処理中…':'';
 prog.classList.toggle('is-hidden',!busyState);
 if(busyState){bar.style.width='0%';progLabel.textContent=label}
}
function rejectFilterWorkerPending(reason){
 for(const pending of filterWorkerState.pending.values())pending.reject(reason);
 filterWorkerState.pending.clear();
}
function disposeFilterWorker(resetDisabled=true){
 rejectFilterWorkerPending(new Error('__SUPERSEDED__'));
 try{filterWorkerState.worker?.terminate()}catch{}
 filterWorkerState.worker=null;filterWorkerState.source=null;filterWorkerState.ready=false;filterWorkerState.initPromise=null;filterWorkerState.resolveInit=null;filterWorkerState.rejectInit=null;
 if(resetDisabled)filterWorkerState.disabled=false;
}
function resetFilterWorkerCache(){
 rejectFilterWorkerPending(new Error('__SUPERSEDED__'));
 try{filterWorkerState.worker?.postMessage({type:'reset'})}catch{}
}
async function ensureFilterWorker(){
 if(!sourceVolume||sourceVolume.sourceBacked||!sourceVolume.data||filterWorkerState.disabled||typeof Worker==='undefined')return false;
 if(filterWorkerState.worker&&filterWorkerState.source===sourceVolume&&filterWorkerState.ready)return true;
 if(filterWorkerState.worker&&filterWorkerState.source===sourceVolume&&filterWorkerState.initPromise)return filterWorkerState.initPromise;
 disposeFilterWorker(false);
 const worker=new Worker(new URL('./filter-worker.js?v=filter-worker-2',import.meta.url));
 filterWorkerState.worker=worker;filterWorkerState.source=sourceVolume;
 filterWorkerState.initPromise=new Promise((resolve,reject)=>{filterWorkerState.resolveInit=resolve;filterWorkerState.rejectInit=reject});
 worker.onmessage=e=>{
  const msg=e.data||{};
  if(msg.type==='ready'){
   filterWorkerState.ready=true;
   filterWorkerState.resolveInit?.(true);
   filterWorkerState.resolveInit=null;filterWorkerState.rejectInit=null;
   return;
  }
  if(msg.type==='progress'){
   if(filterWorkerState.pending.has(msg.id)){
    progress(msg.done,msg.total);
    if(msg.label)progLabel.textContent=msg.label+' · '+msg.done+' / '+msg.total;
   }
   return;
  }
  if(msg.type==='result'){
   const pending=filterWorkerState.pending.get(msg.id);if(!pending)return;
   filterWorkerState.pending.delete(msg.id);
   pending.resolve({data:new Float32Array(msg.buffer),cacheStages:msg.cacheStages||0,cacheBytes:msg.cacheBytes||0});
   return;
  }
  if(msg.type==='error'){
   const pending=filterWorkerState.pending.get(msg.id);if(!pending)return;
   filterWorkerState.pending.delete(msg.id);pending.reject(new Error(msg.message||'Filter worker error'));
  }
 };
 worker.onerror=e=>{
  const error=new Error(e.message||'Filter worker failed');
  filterWorkerState.disabled=true;
  filterWorkerState.rejectInit?.(error);
  rejectFilterWorkerPending(error);
 };
 const Ctor=sourceVolume.data.constructor,copy=new Ctor(sourceVolume.data.length);copy.set(sourceVolume.data);
 const isIOS=/iPad|iPhone|iPod/.test(navigator.platform)||(navigator.maxTouchPoints>2&&navigator.platform.includes('MacIntel'));
 const cacheLimit=isIOS?Math.min(128*1024*1024,Math.max(copy.byteLength,48*1024*1024)):Math.min(384*1024*1024,Math.max(copy.byteLength*2,96*1024*1024));
 worker.postMessage({type:'init',meta:{w:sourceVolume.columns,h:sourceVolume.rows,d:sourceVolume.slices,min:sourceVolume.min,max:sourceVolume.max},data:copy,cacheLimit},[copy.buffer]);
 try{return await filterWorkerState.initPromise}catch(e){filterWorkerState.disabled=true;return false}
}
function runFilterWorker(stages){
 const worker=filterWorkerState.worker;
 if(!worker||!filterWorkerState.ready)return Promise.reject(new Error('Filter worker unavailable'));
 rejectFilterWorkerPending(new Error('__SUPERSEDED__'));
 const id=++filterWorkerState.nextId;
 return new Promise((resolve,reject)=>{
  filterWorkerState.pending.set(id,{resolve,reject});
  worker.postMessage({type:'run',id,stages});
 });
}

function renderFilterOrder(){
 if(!filterControlList)return;
 const active=new Set(filterOrder);
 for(const key of FILTER_CATALOG_ORDER){
  const card=filterControlList.querySelector('[data-filter-key="'+key+'"]');
  if(!card)continue;
  card.classList.toggle('is-hidden',!active.has(key));
  if(active.has(key))filterControlList.insertBefore(card,resetFilterBtn);
 }
 for(const card of filterControlList.querySelectorAll('[data-filter-key]')){
  const key=card.dataset.filterKey,index=filterOrder.indexOf(key);
  const up=card.querySelector('[data-filter-move="up"]'),down=card.querySelector('[data-filter-move="down"]');
  if(up)up.disabled=index<=0;
  if(down)down.disabled=index<0||index>=filterOrder.length-1;
 }
 for(const option of filterAddSelect.options)option.disabled=active.has(option.value);
 const next=[...filterAddSelect.options].find(o=>!o.disabled);
 if(next)filterAddSelect.value=next.value;
 filterAddButton.disabled=!next;
 resetFilterBtn.disabled=!sourceVolume||filterOrder.length===0;
}
function addFilter(key){
 if(!FILTER_CATALOG_ORDER.includes(key)||filterOrder.includes(key))return;
 filterOrder.push(key);
 filterState[key]=true;
 const box={spikeHole:spikeHoleBtn,nlm:nlmBtn,anisotropic:anisotropicBtn,gaussian:gaussianBtn,sigmoid:sigmoidBtn,bilateral:bilateralBtn,tv:tvBtn,unsharp:unsharpBtn}[key];
 if(box)box.checked=true;
 renderFilterOrder();syncFilterControls();
 if(sourceVolume)scheduleFilterRebuild(0);
}
function removeFilter(key){
 const index=filterOrder.indexOf(key);if(index<0)return;
 filterOrder.splice(index,1);filterState[key]=false;
 const box={spikeHole:spikeHoleBtn,nlm:nlmBtn,anisotropic:anisotropicBtn,gaussian:gaussianBtn,sigmoid:sigmoidBtn,bilateral:bilateralBtn,tv:tvBtn,unsharp:unsharpBtn}[key];
 if(box)box.checked=false;
 renderFilterOrder();syncFilterControls();
 if(sourceVolume)scheduleFilterRebuild(0);
}
function moveFilter(key,delta){
 const from=filterOrder.indexOf(key),to=from+delta;
 if(from<0||to<0||to>=filterOrder.length)return;
 [filterOrder[from],filterOrder[to]]=[filterOrder[to],filterOrder[from]];
 renderFilterOrder();
 if(sourceVolume&&filterOrder.length)scheduleFilterRebuild(0);
}
function installFilterReorder(){
 if(!filterControlList)return;
 filterAddButton.addEventListener('click',()=>addFilter(filterAddSelect.value));
 for(const card of filterControlList.querySelectorAll('[data-filter-key]')){
  card.querySelector('[data-filter-move="up"]')?.addEventListener('click',()=>moveFilter(card.dataset.filterKey,-1));
  card.querySelector('[data-filter-move="down"]')?.addEventListener('click',()=>moveFilter(card.dataset.filterKey,1));
  card.querySelector('[data-filter-remove]')?.addEventListener('click',()=>removeFilter(card.dataset.filterKey));
  let draggedKey=null;
  card.addEventListener('dragstart',e=>{
   draggedKey=card.dataset.filterKey;card.classList.add('is-dragging');
   if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',draggedKey)}
  });
  card.addEventListener('dragend',()=>{draggedKey=null;card.classList.remove('is-dragging')});
  card.addEventListener('dragover',e=>{e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move'});
  card.addEventListener('drop',e=>{
   e.preventDefault();
   const fromKey=draggedKey||e.dataTransfer?.getData('text/plain'),targetKey=card.dataset.filterKey;
   if(!fromKey||fromKey===targetKey)return;
   const from=filterOrder.indexOf(fromKey),to=filterOrder.indexOf(targetKey);
   if(from<0||to<0)return;
   filterOrder.splice(from,1);filterOrder.splice(to,0,fromKey);
   renderFilterOrder();
   if(sourceVolume)scheduleFilterRebuild(0);
  });
 }
 renderFilterOrder();
}
function syncFilterControls(){
 gaussianStrength.disabled=!sourceVolume||!filterState.gaussian;
 spatialPasses.disabled=!sourceVolume||!filterState.gaussian;
 smoothingType.disabled=!sourceVolume||!filterState.gaussian;
 spikeHoleStrength.disabled=!sourceVolume||!filterState.spikeHole;
 spikeHoleThreshold.disabled=!sourceVolume||!filterState.spikeHole;
 nlmStrength.disabled=!sourceVolume||!filterState.nlm;
 nlmSearchRadius.disabled=!sourceVolume||!filterState.nlm;
 nlmPatchRadius.disabled=!sourceVolume||!filterState.nlm;
 anisotropicStrength.disabled=!sourceVolume||!filterState.anisotropic;
 anisotropicIterations.disabled=!sourceVolume||!filterState.anisotropic;
 sigmoidStrength.disabled=!sourceVolume||!filterState.sigmoid;
 sigmoidCenter.disabled=!sourceVolume||!filterState.sigmoid;
 bilateralStrength.disabled=!sourceVolume||!filterState.bilateral;bilateralSpatial.disabled=!sourceVolume||!filterState.bilateral;bilateralIntensity.disabled=!sourceVolume||!filterState.bilateral;bilateralPasses.disabled=!sourceVolume||!filterState.bilateral;
 tvWeight.disabled=!sourceVolume||!filterState.tv;tvIterations.disabled=!sourceVolume||!filterState.tv;
 unsharpRadius.disabled=!sourceVolume||!filterState.unsharp;unsharpAmount.disabled=!sourceVolume||!filterState.unsharp;unsharpThreshold.disabled=!sourceVolume||!filterState.unsharp;
 gaussianBtn.disabled=!sourceVolume;smoothingType.disabled=!sourceVolume||!filterState.gaussian;spikeHoleBtn.disabled=!sourceVolume;nlmBtn.disabled=!sourceVolume;anisotropicBtn.disabled=!sourceVolume;sigmoidBtn.disabled=!sourceVolume;bilateralBtn.disabled=!sourceVolume;tvBtn.disabled=!sourceVolume;unsharpBtn.disabled=!sourceVolume;
 gaussianBtn.checked=filterState.gaussian;spikeHoleBtn.checked=filterState.spikeHole;nlmBtn.checked=filterState.nlm;anisotropicBtn.checked=filterState.anisotropic;sigmoidBtn.checked=filterState.sigmoid;bilateralBtn.checked=filterState.bilateral;tvBtn.checked=filterState.tv;unsharpBtn.checked=filterState.unsharp;
 resetFilterBtn.disabled=!sourceVolume||filterOrder.length===0;
}
function scheduleFilterRebuild(delay=120,finalize3D=true){
 clearTimeout(filterRebuildTimer);
 filterRebuildFinalize3D=finalize3D;
 filterRebuildTimer=setTimeout(()=>{filterRebuildTimer=null;void rebuildActiveFilters(filterRebuildFinalize3D)},delay);
}
async function rebuildActiveFiltersLegacy(revision){
 let base=sourceVolume;
 for(const key of filterOrder){
  if(!filterState[key])continue;
  if(key==='spikeHole')await applySpikeHole(base);
  else if(key==='nlm')await applyNlm3D(base);
  else if(key==='anisotropic')await applyAnisotropicDiffusion(base);
  else if(key==='gaussian'){if(smoothingType.value==='median')await applyMedian3D(base);else await applyGaussian3D(base)}
  else if(key==='sigmoid')await applySigmoid(base);
  else if(key==='bilateral')await applyBilateral3D(base);
  else if(key==='tv')await applyTvDenoising3D(base);
  else if(key==='unsharp')await applyUnsharpMask3D(base);
  if(revision!==filterRebuildRevision)return;
  base=volume;
 }
}
async function rebuildActiveFilters(finalize3D=true){
 if(!sourceVolume)return;
 const revision=++filterRebuildRevision;
 clearTimeout(liveFilterState.timer);liveFilterState.base=null;liveFilterState.key=null;
 const stages=activeFilterStages();
 if(!stages.length){
  resetFilterWorkerCache();volume=sourceVolume;renderAll();if(finalize3D)render3D(volume);footer.textContent=tr('original');syncFilterControls();return;
 }
 setFilterWorkerBusy(true,'Filters');
 try{
  const workerReady=await ensureFilterWorker();
  if(revision!==filterRebuildRevision)return;
  if(workerReady){
   const result=await runFilterWorker(stages);
   if(revision!==filterRebuildRevision)return;
   volume=cloneVolumeWithData(sourceVolume,result.data);
   renderAll();
   if(finalize3D)render3D(volume);
   footer.textContent='Filter stack · '+stages.length+' · worker · cache '+result.cacheStages+' ('+fmt(result.cacheBytes)+')';
  }else{
   await rebuildActiveFiltersLegacy(revision);
  }
 }catch(e){
  if(String(e.message||e)!=='__SUPERSEDED__'){
   console.warn('Filter worker fallback.',e);
   filterWorkerState.disabled=true;
   if(revision===filterRebuildRevision)await rebuildActiveFiltersLegacy(revision);
  }
 }finally{
  if(revision===filterRebuildRevision)setFilterWorkerBusy(false);
  syncFilterControls();
 }
}
smoothingType.onchange=()=>{if(filterState.gaussian)scheduleFilterRebuild(0)};
for(const [input,output,key] of [[spikeHoleStrength,spikeHoleStrengthValue,'spikeHole'],[nlmStrength,nlmStrengthValue,'nlm'],[anisotropicStrength,anisotropicStrengthValue,'anisotropic'],[gaussianStrength,gaussianStrengthValue,'gaussian'],[sigmoidStrength,sigmoidStrengthValue,'sigmoid']]){
 input.oninput=()=>{output.value=(+input.value).toFixed(2);if(filterState[key])scheduleFilterRebuild(160,false)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
sigmoidCenter.oninput=()=>{sigmoidCenterValue.value=Math.round(+sigmoidCenter.value);if(filterState.sigmoid)scheduleFilterRebuild(160,false)};
sigmoidCenter.onchange=()=>{if(filterState.sigmoid)scheduleFilterRebuild(0)};
spikeHoleThreshold.oninput=()=>{spikeHoleThresholdValue.value=(+spikeHoleThreshold.value).toFixed(3);if(filterState.spikeHole)scheduleFilterRebuild(160,false)};
spikeHoleThreshold.onchange=()=>{if(filterState.spikeHole)scheduleFilterRebuild(0)};
anisotropicIterations.oninput=()=>{anisotropicIterationsValue.value=Math.round(+anisotropicIterations.value);if(filterState.anisotropic)scheduleFilterRebuild(160,false)};
anisotropicIterations.onchange=()=>{if(filterState.anisotropic)scheduleFilterRebuild(0)};
spatialPasses.oninput=()=>{spatialPassesValue.value=Math.round(+spatialPasses.value);if(filterState.gaussian)scheduleFilterRebuild(160,false)};
spatialPasses.onchange=()=>{if(filterState.gaussian)scheduleFilterRebuild(0)};
nlmSearchRadius.oninput=()=>{nlmSearchRadiusValue.value=Math.round(+nlmSearchRadius.value);if(filterState.nlm)scheduleFilterRebuild(180,false)};
nlmSearchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};
nlmPatchRadius.oninput=()=>{nlmPatchRadiusValue.value=Math.round(+nlmPatchRadius.value);if(filterState.nlm)scheduleFilterRebuild(180,false)};
nlmPatchRadius.onchange=()=>{if(filterState.nlm)scheduleFilterRebuild(0)};

for(const [input,output,key,digits] of [
 [bilateralStrength,bilateralStrengthValue,'bilateral',2],[bilateralSpatial,bilateralSpatialValue,'bilateral',2],[bilateralIntensity,bilateralIntensityValue,'bilateral',2],
 [tvWeight,tvWeightValue,'tv',2],[unsharpAmount,unsharpAmountValue,'unsharp',2],[unsharpThreshold,unsharpThresholdValue,'unsharp',2]
]){
 input.oninput=()=>{output.value=(+input.value).toFixed(digits);if(filterState[key])scheduleFilterRebuild(180,false)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
for(const [input,output,key] of [[bilateralPasses,bilateralPassesValue,'bilateral'],[tvIterations,tvIterationsValue,'tv'],[unsharpRadius,unsharpRadiusValue,'unsharp']]){
 input.oninput=()=>{output.value=Math.round(+input.value);if(filterState[key])scheduleFilterRebuild(180,false)};
 input.onchange=()=>{if(filterState[key])scheduleFilterRebuild(0)};
}
resetFilterBtn.onclick=()=>{filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;smoothingType.value='gaussian';filterOrder=[];for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();syncFilterControls();resetProcessing()};
installFilterReorder();

for(const p of Object.keys(planes)){planes[p].slider.oninput=()=>void renderPlane(p);installMprTouch(p)}

async function loadDemo(){
 let response=null,fromCache=false,cache=null;
 progLabel.textContent='Cache check…';
 bar.style.width='0%';

 if('caches' in window){
  try{
   cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
   if(cache){
    response=await withTimeout(cache.match(DEMO_URL),1200,null);
    if(response){fromCache=true;footer.textContent=tr('demoCache');}
   }
  }catch(e){
   console.warn('Cache lookup skipped.',e);
  }
 }

 if(!response){
  progLabel.textContent='接続中…';
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),20000);
  try{
   response=await fetch(DEMO_URL,{mode:'cors',credentials:'omit',signal:controller.signal,cache:'no-store'});
  }finally{
   clearTimeout(timeout);
  }
 }

 if(!response||!response.ok)throw new Error('Demo download failed: HTTP '+(response?.status??'unknown'));

 const reader=response.body?.getReader();let bytes;
 if(reader){
  const chunks=[];let n=0;
  while(true){
   const q=await reader.read();if(q.done)break;if(!q.value)continue;
   chunks.push(q.value);n+=q.value.byteLength;
   byteProgress(n,DEMO_SIZE,fromCache?'Cache':'Download');
  }
  bytes=new Uint8Array(n);let o=0;for(const c of chunks){bytes.set(c,o);o+=c.byteLength}
 }else{
  bytes=new Uint8Array(await response.arrayBuffer());
  byteProgress(bytes.byteLength,bytes.byteLength,fromCache?'Cache':'Download');
 }

 if(!fromCache&&cache){
  const copy=bytes.slice();
  cache.put(DEMO_URL,new Response(copy,{headers:{'Content-Type':'application/zip','Content-Length':String(copy.byteLength)}}))
   .then(()=>updateDemoCacheBadge())
   .catch(e=>console.warn('Demo cache save failed.',e));
 }

 byteProgress(bytes.byteLength,bytes.byteLength,'Unzip');
 const entries=await new Promise((res,rej)=>unzip(bytes,(e,f)=>e?rej(e):res(f)));
 const out=[];for(const [path,b] of Object.entries(entries)){if(path.endsWith('/')||!b.byteLength)continue;out.push(new File([b],path.split('/').pop()||path))}
 footer.textContent=fromCache?tr('demoCache'):tr('demoDone');
 return out;
}
function withTimeout(promise,ms,fallback){
 return Promise.race([promise,new Promise(resolve=>setTimeout(()=>resolve(fallback),ms))]);
}
async function updateDemoCacheBadge(){
 if(!('caches' in window))return;
 try{
  const cache=await withTimeout(caches.open('virtual-rodent-demo-v2'),1200,null);
  if(cache&&await withTimeout(cache.match(DEMO_URL),1200,null))demoBtn.textContent='公開マウスCTデモ ✓';
 }catch{}
}
void updateDemoCacheBadge();
async function inspect(files,auto){
 activeId=null;resetVolume();list.replaceChildren();state.classList.remove('is-hidden');state.innerHTML='<strong>'+tr('dicomChecking')+'</strong><span>'+tr('pixelDeferred')+'</span>';prog.classList.remove('is-hidden');busy(true);
 try{const slices=await parseFiles(files,(a,b)=>progress(a,b));const series=groupSeries(slices);if(!series.length){state.innerHTML='<strong>'+tr('noSeries')+'</strong>';return}state.classList.add('is-hidden');renderSeries(series);if(auto){const ct=series.find(s=>s.modality.toUpperCase()==='CT')||series[0];await selectSeries(ct)}}finally{busy(false);prog.classList.add('is-hidden')}
}

async function parseFiles(files,onProgress){
 const out=[];for(let i=0;i<files.length;i++){const f=files[i];try{const ds=dicomParser.parseDicom(new Uint8Array(await f.arrayBuffer()),{untilTag:'x7fe00010'});const seriesUid=ds.string('x0020000e')?.trim();if(seriesUid){const ps=multi(ds.string('x00280030'),2),pos=multi(ds.string('x00200032'),3);out.push({file:f,studyUid:ds.string('x0020000d')?.trim()||'study',seriesUid,description:ds.string('x0008103e')?.trim()||'Unnamed series',modality:ds.string('x00080060')?.trim()||'Unknown',rows:ds.uint16('x00280010')||0,columns:ds.uint16('x00280011')||0,bits:ds.uint16('x00280100')||16,signed:ds.uint16('x00280103')||0,samples:ds.uint16('x00280002')||1,pixelSpacing:ps?safePair(ps):null,thickness:num(ds.string('x00180050')),spacingBetween:num(ds.string('x00180088')),instance:num(ds.string('x00200013')),pos:pos?safeTriple(pos):null,slope:numberOr(ds.string('x00281053'),1),intercept:numberOr(ds.string('x00281052'),0),windowCenter:num(ds.string('x00281050')),windowWidth:num(ds.string('x00281051')),smallest:ds.uint16('x00280106'),largest:ds.uint16('x00280107'),pixelOffset:ds.elements.x7fe00010?.dataOffset??null,pixelLength:ds.elements.x7fe00010?.length??null,ts:ds.string('x00020010')?.trim()||'1.2.840.10008.1.2.1'})}}catch{}onProgress?.(i+1,files.length)}return out
}

function canDecodeToInt16(slices){
 for(const meta of slices){
  if(meta.bits!==8&&meta.bits!==16)return false;
  if(!Number.isInteger(meta.slope)||!Number.isInteger(meta.intercept))return false;
  const rawMin=meta.signed?-(2**(meta.bits-1)):0,rawMax=meta.signed?(2**(meta.bits-1)-1):(2**meta.bits-1);
  const x=rawMin*meta.slope+meta.intercept,y=rawMax*meta.slope+meta.intercept;
  if(Math.min(x,y)<-32768||Math.max(x,y)>32767)return false;
 }
 return true;
}
function sourceRangeFromMetadata(slices){
 let min=Infinity,max=-Infinity;
 for(const meta of slices){
  let rawMin=meta.smallest,rawMax=meta.largest;
  if(rawMin==null||rawMax==null){
   rawMin=meta.signed?-(2**(meta.bits-1)):0;
   rawMax=meta.signed?(2**(meta.bits-1)-1):(2**meta.bits-1);
  }else if(meta.signed&&meta.bits===16){
   if(rawMin>32767)rawMin-=65536;
   if(rawMax>32767)rawMax-=65536;
  }
  const x=rawMin*meta.slope+meta.intercept,y=rawMax*meta.slope+meta.intercept;
  min=Math.min(min,x,y);max=Math.max(max,x,y);
 }
 return{min,max};
}
function groupSeries(slices){
 const m=new Map();
 for(const s of slices){const k=s.studyUid+'::'+s.seriesUid;(m.get(k)||m.set(k,[]).get(k)).push(s)}
 return[...m.entries()].map(([id,g])=>{
  g.sort((a,b)=>((a.pos?.[2]??a.instance??0)-(b.pos?.[2]??b.instance??0)));
  const f=g[0],rows=Math.max(...g.map(x=>x.rows)),columns=Math.max(...g.map(x=>x.columns)),bits=Math.max(...g.map(x=>x.bits)),compact=canDecodeToInt16(g),count=rows*columns*g.length,decodedBytes=count*(compact?2:4),sourceBacked=decodedBytes>256*1024*1024,range=sourceRangeFromMetadata(g);
  let z=f.spacingBetween||f.thickness||1;
  if(g.length>1&&g[0].pos&&g[1].pos)z=Math.abs(g[1].pos[2]-g[0].pos[2])||z;
  return{id,description:f.description,modality:f.modality,slices:g,rows,columns,bits,bytes:decodedBytes,decodedBytes,compact,sourceBacked,min:range.min,max:range.max,windowCenter:f.windowCenter,windowWidth:f.windowWidth,spacingX:f.pixelSpacing?.[1]??1,spacingY:f.pixelSpacing?.[0]??1,spacingZ:z};
 }).sort((a,b)=>b.slices.length-a.slices.length)
}

function renderSeries(series){list.replaceChildren();for(const s of series){const b=document.createElement('button');b.className='series-card';b.innerHTML='<div class="series-card-header"><div><span class="modality-badge">'+esc(s.modality)+'</span><strong>'+esc(s.description)+'</strong></div><strong class="memory-estimate">'+fmt(s.bytes)+'</strong></div><dl class="series-meta-grid"><div><dt>Slices</dt><dd>'+s.slices.length+'</dd></div><div><dt>Matrix</dt><dd>'+s.columns+' × '+s.rows+'</dd></div><div><dt>Voxel</dt><dd>'+s.spacingX.toFixed(4)+' × '+s.spacingY.toFixed(4)+' × '+s.spacingZ.toFixed(4)+' mm</dd></div><div><dt>Stored</dt><dd>'+s.bits+'-bit</dd></div></dl><p class="series-note">推定展開サイズ: '+fmt(s.decodedBytes)+' · '+(s.sourceBacked?'フル解像度・ストリーミング':(s.compact?'Int16':'Float32'))+'</p>';b.onclick=()=>selectSeries(s);b.dataset.id=s.id;list.appendChild(b)}}

async function selectSeries(s){
 activeId=s.id;activeSeries=s;
 for(const n of list.children)n.classList.toggle('is-selected',n.dataset.id===activeId);
 selected.innerHTML='<strong>'+esc(s.description)+'</strong><span>'+esc(s.modality)+' · '+s.slices.length+' slices · '+s.columns+'×'+s.rows+(s.sourceBacked?' · full resolution':'')+'</span><span class="ready-badge">CT volume loading…</span>';
 prog.classList.remove('is-hidden');busy(true);let phase='decode';
 try{
  sourceVolume=s.sourceBacked?openSourceBackedVolume(s):await decode(s,(x,y)=>progress(x,y));
  volume=sourceVolume;phase='configure';configure(volume);enableProcessingControls(true);phase='render';renderAll();render3D(volume);
  selected.querySelector('.ready-badge').textContent=s.sourceBacked?'CT source ready · full resolution':'CT volume ready';
  footer.textContent=s.sourceBacked?'Full-resolution source-backed DICOM · no resampling':'CT range: '+Math.round(volume.min)+' to '+Math.round(volume.max)+' · '+volume.data.constructor.name+' '+fmt(volume.data.byteLength);
 }catch(e){
  console.error(e);const label=phase==='decode'?'Decode failed':phase==='configure'?'Configure failed':'Render failed';
  selected.querySelector('.ready-badge').textContent=label;footer.textContent=label+': '+String(e.message||e)
 }finally{prog.classList.add('is-hidden');busy(false)}
}
function openSourceBackedVolume(s){
 return{data:null,sourceBacked:true,series:s,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min:s.min,max:s.max,windowCenter:s.windowCenter,windowWidth:s.windowWidth,storage:'DICOM source'};
}
async function decodeSourceSlice(meta){
 if(!['1.2.840.10008.1.2','1.2.840.10008.1.2.1','1.2.840.10008.1.2.2'].includes(meta.ts))throw new Error('Compressed DICOMは次段階で対応: '+meta.ts);
 const bpp=meta.bits===8?1:meta.bits===16?2:0;
 if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 let bytes,offset=meta.pixelOffset;
 if(offset!=null){
  bytes=new Uint8Array(await meta.file.slice(offset,offset+meta.rows*meta.columns*bpp).arrayBuffer());
  offset=0;
 }else{
  const all=new Uint8Array(await meta.file.arrayBuffer()),ds=dicomParser.parseDicom(all),el=ds.elements.x7fe00010;
  if(!el)throw new Error('Pixel Data missing');bytes=all;offset=el.dataOffset;
 }
 const little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),n=meta.rows*meta.columns,out=new Float32Array(n);
 for(let i=0;i<n;i++){
  let raw;
  if(meta.bits===8){raw=bytes[offset+i];if(meta.signed&&raw>127)raw-=256}
  else raw=meta.signed?view.getInt16(offset+i*2,little):view.getUint16(offset+i*2,little);
  out[i]=raw*meta.slope+meta.intercept;
 }
 return out;
}
async function readSourceRow(meta,row){
 const bpp=meta.bits===8?1:meta.bits===16?2:0;if(!bpp)throw new Error('Unsupported BitsAllocated='+meta.bits);
 if(meta.pixelOffset==null){const full=await decodeSourceSlice(meta);return full.slice(row*meta.columns,(row+1)*meta.columns)}
 const start=meta.pixelOffset+row*meta.columns*bpp,end=start+meta.columns*bpp,bytes=new Uint8Array(await meta.file.slice(start,end).arrayBuffer()),little=meta.ts!=='1.2.840.10008.1.2.2',view=new DataView(bytes.buffer),out=new Float32Array(meta.columns);
 for(let x=0;x<meta.columns;x++){let raw;if(meta.bits===8){raw=bytes[x];if(meta.signed&&raw>127)raw-=256}else raw=meta.signed?view.getInt16(x*2,little):view.getUint16(x*2,little);out[x]=raw*meta.slope+meta.intercept}
 return out;
}
async function decode(s,onProgress){
 const Ctor=s.compact?Int16Array:Float32Array,count=s.columns*s.rows*s.slices.length,bytesNeeded=count*Ctor.BYTES_PER_ELEMENT;
 let data;try{data=new Ctor(count)}catch(e){throw new Error('Volume memory allocation failed: '+fmt(bytesNeeded)+' ('+Ctor.name+')')}
 let min=Infinity,max=-Infinity;
 for(let z=0;z<s.slices.length;z++){
  const slice=await decodeSourceSlice(s.slices[z]);data.set(slice,z*s.rows*s.columns);
  for(let i=0;i<slice.length;i++){const v=slice[i];if(v<min)min=v;if(v>max)max=v}
  onProgress?.(z+1,s.slices.length);if((z&7)===0)await frameYield();
 }
 return{data,columns:s.columns,rows:s.rows,slices:s.slices.length,spacing:[s.spacingX,s.spacingY,s.spacingZ],min,max,storage:Ctor.name,sourceBacked:false};
}

function enableProcessingControls(enabled){
 const sourceMode=enabled&&volume?.sourceBacked===true;
 if(!enabled||sourceMode){filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;filterOrder=[]}
 gaussianBtn.disabled=!enabled||sourceMode;smoothingType.disabled=!enabled||sourceMode||!filterState.gaussian;spikeHoleBtn.disabled=!enabled||sourceMode;nlmBtn.disabled=!enabled||sourceMode;anisotropicBtn.disabled=!enabled||sourceMode;bilateralBtn.disabled=!enabled||sourceMode;tvBtn.disabled=!enabled||sourceMode;unsharpBtn.disabled=!enabled||sourceMode;filterAddSelect.disabled=sourceMode;filterAddButton.disabled=sourceMode;
 resetFilterBtn.disabled=!enabled;
 surfaceSmoothEnabled.disabled=!enabled;
 surfaceSmoothStrength.disabled=!enabled||!surfaceSmoothEnabled.checked;
 syncFilterControls();
}
function cloneVolumeWithData(base,data){
 return{data,columns:base.columns,rows:base.rows,slices:base.slices,spacing:[...base.spacing],min:base.min,max:base.max,storage:data.constructor.name,sourceBacked:false};
}
async function applyGaussian3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Gaussian 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data;
  const strength=+gaussianStrength.value;
  let a=new Float32Array(src),b=new Float32Array(n);
  const axes=[[1,0,0],[0,1,0],[0,0,1]];
  const rounds=Math.max(1,Math.round(+spatialPasses.value));
  for(let round=0;round<rounds;round++)for(let pass=0;pass<axes.length;pass++){
   const [dx,dy,dz]=axes[pass];
   for(let z=0;z<d;z++){
    for(let y=0;y<h;y++){
     const row=z*h*w+y*w;
     for(let x=0;x<w;x++){
      const i=row+x;
      const x0=Math.max(0,x-dx),x1=Math.min(w-1,x+dx);
      const y0=Math.max(0,y-dy),y1=Math.min(h-1,y+dy);
      const z0=Math.max(0,z-dz),z1=Math.min(d-1,z+dz);
      const i0=z0*h*w+y0*w+x0,i1=z1*h*w+y1*w+x1;
      const blurred=(a[i0]+2*a[i]+a[i1])*.25;
      b[i]=a[i]*(1-strength)+blurred*strength;
     }
    }
    if((z&15)===0){progress((round*axes.length+pass)*d+z+1,rounds*axes.length*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='Gaussian 3D · live '+(+gaussianStrength.value).toFixed(2);
 }catch(e){console.error(e);footer.textContent='Gaussian error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyMedian3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Median 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data;
  const strength=+gaussianStrength.value;
  let a=new Float32Array(src),b=new Float32Array(n);
  const rounds=Math.max(1,Math.round(+spatialPasses.value));
  const vals=new Float32Array(7);
  for(let round=0;round<rounds;round++){
   b.set(a);
   for(let z=1;z<d-1;z++){
    for(let y=1;y<h-1;y++){
     const row=z*h*w+y*w;
     for(let x=1;x<w-1;x++){
      const i=row+x;
      vals[0]=a[i];vals[1]=a[i-1];vals[2]=a[i+1];vals[3]=a[i-w];vals[4]=a[i+w];vals[5]=a[i-w*h];vals[6]=a[i+w*h];
      for(let p=1;p<7;p++){const v=vals[p];let q=p-1;while(q>=0&&vals[q]>v){vals[q+1]=vals[q];q--}vals[q+1]=v}
      const median=vals[3];
      b[i]=a[i]*(1-strength)+median*strength;
     }
    }
    if((z&7)===0){progress(round*d+z+1,rounds*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='Median 3D · live '+strength.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Median error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applySpikeHole(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Spike / Hole');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,src=baseVolume.data,out=new Float32Array(src);
  const strength=+spikeHoleStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),thresholdRatio=+spikeHoleThreshold.value,threshold=range*thresholdRatio,edgeGuard=threshold*(.55+.35*strength);
  const correctionBlend=.20+.75*strength;
  let corrected=0;
  for(let z=1;z<d-1;z++){
   for(let y=1;y<h-1;y++){
    const row=z*h*w+y*w;
    for(let x=1;x<w-1;x++){
     const i=row+x,c=src[i];
     const ns=[src[i-1],src[i+1],src[i-w],src[i+w],src[i-w*h],src[i+w*h]];
     let sum=0,min=Infinity,max=-Infinity;for(const v of ns){sum+=v;if(v<min)min=v;if(v>max)max=v}
     const mean=sum/6,spread=max-min,diff=c-mean;
     if(spread<=edgeGuard&&Math.abs(diff)>threshold){
      const target=mean+Math.sign(diff)*threshold*.08;
      out[i]=c*(1-correctionBlend)+target*correctionBlend;corrected++;
     }
    }
   }
   if((z&7)===0){progress(z,d);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);footer.textContent='Spike / Hole · '+strength.toFixed(2)+' · threshold '+thresholdRatio.toFixed(3)+' · '+corrected.toLocaleString()+' voxels';
 }catch(e){console.error(e);footer.textContent='Spike/Hole error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyNlm3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Fast NLM 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,src=baseVolume.data,out=new Float32Array(src);
  const strength=+nlmStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),hParam=range*(.018+.11*strength),h2=hParam*hParam;
  const searchRadius=Math.max(1,Math.round(+nlmSearchRadius.value)),patchRadius=Math.max(0,Math.round(+nlmPatchRadius.value));
  const offsets=[];
  for(let dz=-searchRadius;dz<=searchRadius;dz++)for(let dy=-searchRadius;dy<=searchRadius;dy++)for(let dx=-searchRadius;dx<=searchRadius;dx++){
   if(dx||dy||dz)offsets.push([dx,dy,dz]);
  }
  const patch=[[0,0,0]];
  for(let r=1;r<=patchRadius;r++)patch.push([r,0,0],[-r,0,0],[0,r,0],[0,-r,0],[0,0,r],[0,0,-r]);
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  const sample=(x,y,z)=>src[clamp(z,0,d-1)*h*w+clamp(y,0,h-1)*w+clamp(x,0,w-1)];
  for(let z=0;z<d;z++){
   for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
     const center=src[z*h*w+y*w+x];
     let weighted=center,weightSum=1;
     for(const [dx,dy,dz] of offsets){
      const nx=x+dx,ny=y+dy,nz=z+dz;
      if(nx<0||ny<0||nz<0||nx>=w||ny>=h||nz>=d)continue;
      let dist2=0;
      for(const [px,py,pz] of patch){
       const a=sample(x+px,y+py,z+pz),b=sample(nx+px,ny+py,nz+pz),dv=a-b;
       dist2+=dv*dv;
      }
      dist2/=patch.length;
      const weight=Math.exp(-dist2/Math.max(h2,1e-6));
      weighted+=weight*src[nz*h*w+ny*w+nx];
      weightSum+=weight;
     }
     out[z*h*w+y*w+x]=weighted/weightSum;
    }
   }
   if((z&3)===0){progress(z+1,d);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);
  footer.textContent='Fast NLM 3D · '+strength.toFixed(2)+' · search '+searchRadius+' · patch '+patchRadius;
 }catch(e){console.error(e);footer.textContent='NLM error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyAnisotropicDiffusion(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Anisotropic Diffusion');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d;
  let a=new Float32Array(baseVolume.data),b=new Float32Array(n);
  const strength=+anisotropicStrength.value;
  const range=Math.max(1,baseVolume.max-baseVolume.min),kappa=range*(.025+.09*strength),kappa2=kappa*kappa,lambda=.06+.14*strength,iterations=Math.max(1,Math.round(+anisotropicIterations.value));
  for(let iter=0;iter<iterations;iter++){
   b.set(a);
   for(let z=1;z<d-1;z++){
    for(let y=1;y<h-1;y++){
     const row=z*h*w+y*w;
     for(let x=1;x<w-1;x++){
      const i=row+x,c=a[i];
      const neighbors=[a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]];
      let flux=0;
      for(const nv of neighbors){
       const diff=nv-c;
       const conduct=Math.exp(-(diff*diff)/Math.max(kappa2,1e-6));
       flux+=conduct*diff;
      }
      b[i]=c+lambda*flux;
     }
    }
    if((z&7)===0){progress(iter*d+z+1,iterations*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);
  footer.textContent='Anisotropic Diffusion · '+strength.toFixed(2)+' · '+iterations+' iterations';
 }catch(e){console.error(e);footer.textContent='Anisotropic error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyBilateral3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Bilateral 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,range=Math.max(1,baseVolume.max-baseVolume.min);
  const strength=+bilateralStrength.value,spatialSigma=+bilateralSpatial.value,intensitySigma=Math.max(1e-6,+bilateralIntensity.value*range),passes=Math.max(1,Math.round(+bilateralPasses.value));
  const radius=Math.max(1,Math.min(3,Math.ceil(spatialSigma*1.5))),sp2=2*spatialSigma*spatialSigma,int2=2*intensitySigma*intensitySigma;
  let a=new Float32Array(baseVolume.data),b=new Float32Array(n);
  for(let pass=0;pass<passes;pass++){
   for(let z=0;z<d;z++){
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     const i=z*h*w+y*w+x,center=a[i];let sum=0,wsum=0;
     for(let dz=-radius;dz<=radius;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;
      for(let dy=-radius;dy<=radius;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;
       for(let dx=-radius;dx<=radius;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;
        const j=zz*h*w+yy*w+xx,dv=a[j]-center,sw=Math.exp(-(dx*dx+dy*dy+dz*dz)/sp2),iw=Math.exp(-(dv*dv)/int2),ww=sw*iw;
        sum+=a[j]*ww;wsum+=ww;
       }
      }
     }
     const filtered=wsum?sum/wsum:center;b[i]=center*(1-strength)+filtered*strength;
    }
    if((z&3)===0){progress(pass*d+z+1,passes*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='Bilateral 3D · '+strength.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Bilateral error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applyTvDenoising3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'TV Denoising 3D');
 try{
  const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data,range=Math.max(1,baseVolume.max-baseVolume.min);
  const weight=+tvWeight.value,iterations=Math.max(1,Math.round(+tvIterations.value)),lambda=Math.min(.18,.02+weight*.45);
  let a=new Float32Array(src),b=new Float32Array(n);
  const eps=range*1e-4;
  for(let iter=0;iter<iterations;iter++){
   b.set(a);
   for(let z=1;z<d-1;z++)for(let y=1;y<h-1;y++){
    const row=z*h*w+y*w;
    for(let x=1;x<w-1;x++){
     const i=row+x,c=a[i],ns=[a[i-1],a[i+1],a[i-w],a[i+w],a[i-w*h],a[i+w*h]];
     let flux=0;
     for(const nv of ns){const diff=nv-c;flux+=diff/Math.sqrt(diff*diff+eps*eps)}
     b[i]=c+lambda*flux;
    }
    if((z&7)===0){progress(iter*d+z+1,iterations*d);await frameYield()}
   }
   const t=a;a=b;b=t;
  }
  volume=cloneVolumeWithData(baseVolume,a);renderAll();render3D(volume);footer.textContent='TV Denoising 3D · '+weight.toFixed(2)+' · '+iterations+' iterations';
 }catch(e){console.error(e);footer.textContent='TV error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function boxBlur3D(baseVolume,radius){
 const {columns:w,rows:h,slices:d}=baseVolume,n=w*h*d,src=baseVolume.data,r=Math.max(1,Math.round(radius));
 const out=new Float32Array(n);
 for(let z=0;z<d;z++){
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   let sum=0,count=0;
   for(let dz=-r;dz<=r;dz++){const zz=z+dz;if(zz<0||zz>=d)continue;
    for(let dy=-r;dy<=r;dy++){const yy=y+dy;if(yy<0||yy>=h)continue;
     for(let dx=-r;dx<=r;dx++){const xx=x+dx;if(xx<0||xx>=w)continue;sum+=src[zz*h*w+yy*w+xx];count++}
    }
   }
   out[z*h*w+y*w+x]=sum/Math.max(1,count);
  }
  if((z&7)===0)await frameYield();
 }
 return out;
}
async function applyUnsharpMask3D(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Unsharp Mask 3D');
 try{
  const src=baseVolume.data,blurred=await boxBlur3D(baseVolume,+unsharpRadius.value),out=new Float32Array(src.length),range=Math.max(1,baseVolume.max-baseVolume.min);
  const amount=+unsharpAmount.value,threshold=+unsharpThreshold.value*range;
  for(let i=0;i<src.length;i++){const detail=src[i]-blurred[i];out[i]=Math.abs(detail)>=threshold?src[i]+amount*detail:src[i]}
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);footer.textContent='Unsharp Mask 3D · amount '+amount.toFixed(2);
 }catch(e){console.error(e);footer.textContent='Unsharp error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
async function applySigmoid(baseVolume=volume){
 if(!baseVolume)return;setProcessingBusy(true,'Sigmoid');
 try{
  const src=baseVolume.data,out=new Float32Array(src.length);
  const min=baseVolume.min,max=baseVolume.max,range=Math.max(1,max-min);
  const strength=+sigmoidStrength.value,gain=2+strength*10;
  const centerValue=Math.max(min,Math.min(max,+sigmoidCenter.value)),center=(centerValue-min)/range;
  const lo=1/(1+Math.exp(gain*center)),hi=1/(1+Math.exp(-gain*(1-center))),norm=Math.max(1e-6,hi-lo);
  for(let i=0;i<src.length;i++){
   const x=Math.max(0,Math.min(1,(src[i]-min)/range));
   const y=(1/(1+Math.exp(-gain*(x-center)))-lo)/norm;
   out[i]=min+Math.max(0,Math.min(1,y))*range;
   if((i&0x3ffff)===0){progress(i+1,src.length);await frameYield()}
  }
  volume=cloneVolumeWithData(baseVolume,out);renderAll();render3D(volume);
  footer.textContent='Sigmoid · '+strength.toFixed(2)+' · center '+Math.round(centerValue);
 }catch(e){console.error(e);footer.textContent='Sigmoid error: '+String(e.message||e)}
 finally{setProcessingBusy(false)}
}
function resetProcessing(){
 clearTimeout(liveFilterState.timer);clearTimeout(filterRebuildTimer);filterRebuildRevision++;resetFilterWorkerCache();setFilterWorkerBusy(false);liveFilterState.base=null;liveFilterState.key=null;
 filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;syncFilterControls();
 if(!sourceVolume)return;volume=sourceVolume;renderAll();render3D(volume);footer.textContent=tr('processingReset');
}
function setProcessingBusy(busyState,label='Processing'){
 if(processingOverlay){
  processingOverlay.classList.toggle('is-hidden',!busyState);
  processingOverlay.setAttribute('aria-busy',busyState?'true':'false');
 }
 if(processingOverlayLabel)processingOverlayLabel.textContent=busyState?label+' · 処理中…':'';
 resetFilterBtn.disabled=busyState||!sourceVolume;
 gaussianBtn.disabled=spikeHoleBtn.disabled=nlmBtn.disabled=anisotropicBtn.disabled=sigmoidBtn.disabled=busyState||!sourceVolume;smoothingType.disabled=busyState||!sourceVolume||!filterState.gaussian;
 gaussianStrength.disabled=busyState||!sourceVolume||!filterState.gaussian;
 spatialPasses.disabled=busyState||!sourceVolume||!filterState.gaussian;
 spikeHoleStrength.disabled=busyState||!sourceVolume||!filterState.spikeHole;
 spikeHoleThreshold.disabled=busyState||!sourceVolume||!filterState.spikeHole;
 nlmStrength.disabled=busyState||!sourceVolume||!filterState.nlm;
 nlmSearchRadius.disabled=busyState||!sourceVolume||!filterState.nlm;
 nlmPatchRadius.disabled=busyState||!sourceVolume||!filterState.nlm;
 anisotropicStrength.disabled=busyState||!sourceVolume||!filterState.anisotropic;
 anisotropicIterations.disabled=busyState||!sourceVolume||!filterState.anisotropic;
 sigmoidStrength.disabled=busyState||!sourceVolume||!filterState.sigmoid;
 sigmoidCenter.disabled=busyState||!sourceVolume||!filterState.sigmoid;
 bilateralStrength.disabled=bilateralSpatial.disabled=bilateralIntensity.disabled=bilateralPasses.disabled=busyState||!sourceVolume||!filterState.bilateral;
 tvWeight.disabled=tvIterations.disabled=busyState||!sourceVolume||!filterState.tv;
 unsharpRadius.disabled=unsharpAmount.disabled=unsharpThreshold.disabled=busyState||!sourceVolume||!filterState.unsharp;
 folderBtn.disabled=demoBtn.disabled=busyState;prog.classList.toggle('is-hidden',!busyState);
 if(busyState){bar.style.width='0%';progLabel.textContent=label}
}
const frameYield=()=>new Promise(resolve=>setTimeout(resolve,0));

function configure(v){
 const range=Math.max(1,v.max-v.min),center=Number.isFinite(v.windowCenter)?v.windowCenter:(v.min+v.max)/2,initialWidth=Number.isFinite(v.windowWidth)&&v.windowWidth>0?v.windowWidth:range;wc.min=Math.floor(v.min);wc.max=Math.ceil(v.max);wc.value=center;ww.min=1;ww.max=Math.max(Math.ceil(range),Math.ceil(initialWidth));ww.value=initialWidth;wc.disabled=ww.disabled=false;
 sigmoidCenter.min=Math.floor(v.min);sigmoidCenter.max=Math.ceil(v.max);sigmoidCenter.step=Math.max(1,Math.round(range/1000));sigmoidCenter.value=Math.round(center);sigmoidCenterValue.value=Math.round(center);
 const vals={axial:[v.slices,v.slices/2],coronal:[v.rows,v.rows/2],sagittal:[v.columns,v.columns/2]};for(const [p,[max,mid]]of Object.entries(vals)){planes[p].slider.max=max-1;planes[p].slider.value=Math.floor(mid);planes[p].slider.disabled=false}
 configureSegments(v);
 volumeAnalysisToggle.disabled=v.sourceBacked===true;
}
function configureSegments(v){
 const huLike=v.min<=-500&&v.max>=1000;
 const defaults=huLike?{lung:[Math.max(v.min,-950),Math.min(v.max,-300)],fat:[Math.max(v.min,-250),Math.min(v.max,-50)],soft:[Math.max(v.min,-50),Math.min(v.max,350)],bone:[Math.max(v.min,350),v.max]}:{lung:[v.min+(v.max-v.min)*.03,v.min+(v.max-v.min)*.18],fat:[v.min,v.min+(v.max-v.min)*.22],soft:[v.min+(v.max-v.min)*.22,v.min+(v.max-v.min)*.58],bone:[v.min+(v.max-v.min)*.58,v.max]};
 for(const key of Object.keys(segmentState)){
  const cfg=segmentState[key],d=defaults[key];cfg.min=d[0];cfg.max=d[1];
  const enabled=$('[data-seg-enabled="'+key+'"]'),color=$('[data-seg-color="'+key+'"]'),min=$('[data-seg-min="'+key+'"]'),max=$('[data-seg-max="'+key+'"]'),opacity=$('[data-seg-opacity="'+key+'"]');
  const exportBtn=$('[data-seg-export="'+key+'"]'),removeBtn=$('[data-seg-remove="'+key+'"]'),opening=$('[data-seg-opening="'+key+'"]'),closing=$('[data-seg-closing="'+key+'"]'),minComponent=$('[data-seg-min-component="'+key+'"]'),holeFill=$('[data-seg-hole-fill="'+key+'"]');
  const usable=cfg.active,sourceMode=v.sourceBacked===true;
  enabled.disabled=color.disabled=min.disabled=max.disabled=opacity.disabled=!usable;opening.disabled=closing.disabled=minComponent.disabled=holeFill.disabled=!usable||sourceMode;if(exportBtn)exportBtn.disabled=!usable||sourceMode;if(removeBtn)removeBtn.disabled=!usable;enabled.checked=cfg.enabled;color.value=cfg.color;
  min.min=max.min=Math.floor(v.min);min.max=max.max=Math.ceil(v.max);min.value=cfg.min;max.value=cfg.max;opacity.value=cfg.opacity;opening.value=cfg.opening;closing.value=cfg.closing;minComponent.value=cfg.minComponent;holeFill.checked=cfg.holeFill;$('[data-seg-opening-out="'+key+'"]').value=cfg.opening;$('[data-seg-closing-out="'+key+'"]').value=cfg.closing;$('[data-seg-min-component-out="'+key+'"]').value=cfg.minComponent;cfg._maskCache=null;updateSegmentOutputs(key);
 }
 renderSegmentPresets();
}
function buildThresholdMask(v,seg){
 const mask=new Uint8Array(v.data.length);for(let i=0;i<v.data.length;i++){const x=v.data[i];if(x>=seg.min&&x<=seg.max)mask[i]=1}return mask;
}
function morphMask(mask,w,h,d,radius,dilate){
 let a=new Uint8Array(mask),b=new Uint8Array(mask.length),plane=w*h;
 for(let pass=0;pass<radius;pass++){
  b.fill(0);
  for(let z=0;z<d;z++)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=z*plane+y*w+x;
   if(dilate){
    let on=a[i]===1;if(!on&&x>0)on=a[i-1]===1;if(!on&&x<w-1)on=a[i+1]===1;if(!on&&y>0)on=a[i-w]===1;if(!on&&y<h-1)on=a[i+w]===1;if(!on&&z>0)on=a[i-plane]===1;if(!on&&z<d-1)on=a[i+plane]===1;b[i]=on?1:0;
   }else{
    let on=a[i]===1;if(on&&(x===0||a[i-1]===0))on=false;if(on&&(x===w-1||a[i+1]===0))on=false;if(on&&(y===0||a[i-w]===0))on=false;if(on&&(y===h-1||a[i+w]===0))on=false;if(on&&(z===0||a[i-plane]===0))on=false;if(on&&(z===d-1||a[i+plane]===0))on=false;b[i]=on?1:0;
   }
  }
  const t=a;a=b;b=t;
 }
 return a;
}
function fillMaskHoles(mask,w,h,d){
 const n=mask.length,plane=w*h,seen=new Uint8Array(n),stack=[];const push=i=>{if(i>=0&&i<n&&!mask[i]&&!seen[i]){seen[i]=1;stack.push(i)}};
 for(let z=0;z<d;z++)for(let y=0;y<h;y++){push(z*plane+y*w);push(z*plane+y*w+w-1)}
 for(let z=0;z<d;z++)for(let x=0;x<w;x++){push(z*plane+x);push(z*plane+(h-1)*w+x)}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){push(y*w+x);push((d-1)*plane+y*w+x)}
 while(stack.length){const i=stack.pop(),z=Math.floor(i/plane),rem=i-z*plane,y=Math.floor(rem/w),x=rem-y*w;if(x>0)push(i-1);if(x<w-1)push(i+1);if(y>0)push(i-w);if(y<h-1)push(i+w);if(z>0)push(i-plane);if(z<d-1)push(i+plane)}
 const out=new Uint8Array(mask);for(let i=0;i<n;i++)if(!mask[i]&&!seen[i])out[i]=1;return out;
}
function removeSmallMaskComponents(mask,w,h,d,minSize){
 if(minSize<=0)return mask;const out=new Uint8Array(mask),seen=new Uint8Array(mask.length),stack=[],plane=w*h;
 for(let seed=0;seed<out.length;seed++){if(!out[seed]||seen[seed])continue;const comp=[];stack.push(seed);seen[seed]=1;while(stack.length){const i=stack.pop();comp.push(i);const z=Math.floor(i/plane),rem=i-z*plane,y=Math.floor(rem/w),x=rem-y*w;const ns=[];if(x>0)ns.push(i-1);if(x<w-1)ns.push(i+1);if(y>0)ns.push(i-w);if(y<h-1)ns.push(i+w);if(z>0)ns.push(i-plane);if(z<d-1)ns.push(i+plane);for(const j of ns)if(out[j]&&!seen[j]){seen[j]=1;stack.push(j)}}if(comp.length<minSize)for(const i of comp)out[i]=0}
 return out;
}
function getProcessedSegmentMask(v,seg){
 const key=[v.data.length,seg.min,seg.max,seg.opening,seg.closing,seg.minComponent,seg.holeFill].join('|');if(seg._maskCache&&seg._maskCacheKey===key)return seg._maskCache;
 const w=v.columns,h=v.rows,d=v.slices;let mask=buildThresholdMask(v,seg);
 if(seg.opening>0){mask=morphMask(mask,w,h,d,seg.opening,false);mask=morphMask(mask,w,h,d,seg.opening,true)}
 if(seg.closing>0){mask=morphMask(mask,w,h,d,seg.closing,true);mask=morphMask(mask,w,h,d,seg.closing,false)}
 if(seg.holeFill)mask=fillMaskHoles(mask,w,h,d);
 if(seg.minComponent>0)mask=removeSmallMaskComponents(mask,w,h,d,seg.minComponent);
 seg._maskCache=mask;seg._maskCacheKey=key;return mask;
}
function updateSegmentOutputs(key){
 $('[data-seg-min-out="'+key+'"]').value=Math.round(segmentState[key].min);
 $('[data-seg-max-out="'+key+'"]').value=Math.round(segmentState[key].max);
 $('[data-seg-opacity-out="'+key+'"]').value=segmentState[key].opacity.toFixed(2);
}
function scheduleSegment3D(){if(!volume)return;clearTimeout(segmentRenderTimer);segmentRenderTimer=setTimeout(()=>render3D(volume),90)}
const planeRenderRevision={axial:0,coronal:0,sagittal:0};
function renderAll(){
 if(!volume)return;
 wcVal.value=Math.round(+wc.value);wwVal.value=Math.round(+ww.value);
 for(const p of Object.keys(planes))void renderPlane(p);
}
async function renderPlane(p){
 if(!volume)return;
 if(volume.sourceBacked)return renderPlaneSourceBacked(p);
 const c=planes[p],idx=+c.slider.value;c.label.textContent=idx+1;
 const dims=p==='axial'?[volume.columns,volume.rows]:p==='coronal'?[volume.columns,volume.slices]:[volume.rows,volume.slices],ctx=c.canvas.getContext('2d');c.canvas.width=dims[0];c.canvas.height=dims[1];
 const img=ctx.createImageData(...dims),low=+wc.value-(+ww.value)/2,scale=255/Math.max(+ww.value,1);let q=0;
 const segOrder=['lung','fat','soft','bone'],segMasks={};for(const key of segOrder){const seg=segmentState[key];if(seg.active&&seg.enabled)segMasks[key]=getProcessedSegmentMask(volume,seg)}
 for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++){
  let v;if(p==='axial')v=volume.data[idx*volume.rows*volume.columns+y*volume.columns+x];else if(p==='coronal'){const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+idx*volume.columns+x]}else{const z=volume.slices-1-y;v=volume.data[z*volume.rows*volume.columns+x*volume.columns+idx]}
  const g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  const voxelIndex=p==='axial'?idx*volume.rows*volume.columns+y*volume.columns+x:p==='coronal'?(volume.slices-1-y)*volume.rows*volume.columns+idx*volume.columns+x:(volume.slices-1-y)*volume.rows*volume.columns+x*volume.columns+idx;
  for(const key of segOrder){const seg=segmentState[key],mask=segMasks[key];if(!seg.active||!seg.enabled||!mask||!mask[voxelIndex])continue;const rgb=hexRgb(seg.color),a=Math.min(.75,seg.opacity*.65);rr=Math.round(rr*(1-a)+rgb[0]*a);gg=Math.round(gg*(1-a)+rgb[1]*a);bb=Math.round(bb*(1-a)+rgb[2]*a)}
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255
 }
 ctx.putImageData(img,0,0)
}
function paintSourcePlane(c,dims,values){
 const ctx=c.canvas.getContext('2d');c.canvas.width=dims[0];c.canvas.height=dims[1];
 const img=ctx.createImageData(...dims),low=+wc.value-(+ww.value)/2,scale=255/Math.max(+ww.value,1),segOrder=['lung','fat','soft','bone'];let q=0;
 for(let i=0;i<values.length;i++){
  const v=values[i],g=Math.max(0,Math.min(255,Math.round((v-low)*scale)));let rr=g,gg=g,bb=g;
  for(const key of segOrder){const seg=segmentState[key];if(!seg.active||!seg.enabled||v<seg.min||v>seg.max)continue;const rgb=hexRgb(seg.color),a=Math.min(.75,seg.opacity*.65);rr=Math.round(rr*(1-a)+rgb[0]*a);gg=Math.round(gg*(1-a)+rgb[1]*a);bb=Math.round(bb*(1-a)+rgb[2]*a)}
  img.data[q++]=rr;img.data[q++]=gg;img.data[q++]=bb;img.data[q++]=255;
 }
 ctx.putImageData(img,0,0);
}
async function renderPlaneSourceBacked(p){
 const c=planes[p],idx=+c.slider.value,series=volume.series,revision=++planeRenderRevision[p];c.label.textContent=idx+1;
 try{
  if(p==='axial'){
   const values=await decodeSourceSlice(series.slices[idx]);if(revision!==planeRenderRevision[p])return;
   paintSourcePlane(c,[series.columns,series.rows],values);return;
  }
  if(p==='coronal'){
   const values=new Float32Array(series.columns*series.slices.length);
   for(let z=0;z<series.slices.length;z++){
    const row=await readSourceRow(series.slices[z],idx);
    values.set(row,(series.slices.length-1-z)*series.columns);
    if((z&31)===0)await frameYield();
    if(revision!==planeRenderRevision[p])return;
   }
   paintSourcePlane(c,[series.columns,series.slices.length],values);return;
  }
  const values=new Float32Array(series.rows*series.slices.length);
  for(let z=0;z<series.slices.length;z++){
   const slice=await decodeSourceSlice(series.slices[z]),base=(series.slices.length-1-z)*series.rows;
   for(let y=0;y<series.rows;y++)values[base+y]=slice[y*series.columns+idx];
   if((z&7)===0)await frameYield();
   if(revision!==planeRenderRevision[p])return;
  }
  paintSourcePlane(c,[series.rows,series.slices.length],values);
 }catch(e){console.error(e);footer.textContent='MPR read error: '+String(e.message||e)}
}

function hexRgb(hex){const n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}

function installMprTouch(p){const c=planes[p];let id=null,startX=0,start=0;c.canvas.onpointerdown=e=>{if(!volume||c.slider.disabled)return;id=e.pointerId;startX=e.clientX;start=+c.slider.value;c.canvas.setPointerCapture(id)};c.canvas.onpointermove=e=>{if(id!==e.pointerId)return;const max=+c.slider.max,sens=Math.max(1,c.canvas.clientWidth/(max+1)),next=Math.round(start+(e.clientX-startX)/sens);c.slider.value=Math.max(0,Math.min(max,next));void renderPlane(p)};const end=e=>{if(id!==e.pointerId)return;if(c.canvas.hasPointerCapture(id))c.canvas.releasePointerCapture(id);id=null};c.canvas.onpointerup=end;c.canvas.onpointercancel=end;c.canvas.addEventListener('wheel',e=>{if(!volume||c.slider.disabled)return;e.preventDefault();const max=+c.slider.max,delta=e.deltaY===0?e.deltaX:e.deltaY,step=delta>0?1:-1;c.slider.value=Math.max(0,Math.min(max,+c.slider.value+step));void renderPlane(p)},{passive:false})}

async function start3D(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x090c0e);const camera=new THREE.PerspectiveCamera(38,1,.1,100);camera.position.z=5.2;scene.add(new THREE.HemisphereLight(0xffffff,0x182028,2.0));const keyLight=new THREE.DirectionalLight(0xffffff,2.4);keyLight.position.set(2,3,4);scene.add(keyLight);
 let renderer,backend='WEBGL';
 if('gpu' in navigator){
  try{
   const gpuRenderer=new THREE.WebGPURenderer({antialias:true});gpuRenderer.setPixelRatio(Math.min(devicePixelRatio,2));await gpuRenderer.init();renderer=gpuRenderer;backend='WEBGPU';
  }catch(error){
   console.warn('WebGPU init failed; falling back to WebGL.',error);
  }
 }
 if(!renderer){
  renderer=new WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));backend='WEBGL';
 }
 status.textContent=backend+' ACTIVE';status.className=backend==='WEBGPU'?'status status-ok':'status status-warning';threeLabel.textContent=backend;
 viewport.appendChild(renderer.domElement);sceneState={scene,camera,renderer,obj:null,analysisMesh:null,backend};
 const pointers=new Map();const pointerStarts=new Map();let distance=5.2,lastPinch=0,lastCenter=null;
 renderer.domElement.oncontextmenu=e=>e.preventDefault();
 renderer.domElement.onpointerdown=e=>{pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});pointerStarts.set(e.pointerId,{x:e.clientX,y:e.clientY});renderer.domElement.setPointerCapture(e.pointerId);if(pointers.size>=2){const[a,b]=[...pointers.values()];lastPinch=Math.hypot(b.x-a.x,b.y-a.y);lastCenter={x:(a.x+b.x)/2,y:(a.y+b.y)/2}}};
 renderer.domElement.onpointermove=e=>{const prev=pointers.get(e.pointerId);if(!prev)return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(!sceneState.obj)return;if(pointers.size===1){const dx=e.clientX-prev.x,dy=e.clientY-prev.y;const qYaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),dx*.008);const qPitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),dy*.008);sceneState.obj.quaternion.premultiply(qYaw);sceneState.obj.quaternion.premultiply(qPitch);sceneState.obj.quaternion.normalize();return}const[a,b]=[...pointers.values()],d=Math.hypot(b.x-a.x,b.y-a.y),center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};if(lastPinch){distance=THREE.MathUtils.clamp(distance*(lastPinch/Math.max(d,1)),2.2,12);camera.position.z=distance}if(lastCenter){const ps=distance*.0015;sceneState.obj.position.x+=(center.x-lastCenter.x)*ps;sceneState.obj.position.y-=(center.y-lastCenter.y)*ps}lastPinch=d;lastCenter=center};
 const endPointer=e=>{const start=pointerStarts.get(e.pointerId);const wasSingle=pointers.size===1;pointers.delete(e.pointerId);pointerStarts.delete(e.pointerId);if(renderer.domElement.hasPointerCapture(e.pointerId))renderer.domElement.releasePointerCapture(e.pointerId);if(pointers.size<2){lastPinch=0;lastCenter=null}if(e.type==='pointerup'&&wasSingle&&start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<6&&volumeAnalysisMode&&!volumeAnalysisBusy){void analyzeVolumeAtPointer(e,renderer.domElement,camera)}};
 renderer.domElement.onpointerup=endPointer;renderer.domElement.onpointercancel=endPointer;
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=THREE.MathUtils.clamp(distance+e.deltaY*.004,2.2,12);camera.position.z=distance},{passive:false});
 const resize=()=>{camera.aspect=viewport.clientWidth/Math.max(viewport.clientHeight,1);camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight,false)};new ResizeObserver(resize).observe(viewport);resize();
 renderer.setAnimationLoop(()=>renderer.render(scene,camera));
}
async function analyzeVolumeAtPointer(event,canvas,camera){
 if(!volume||!sceneState?.obj)return;
 volumeAnalysisBusy=true;
 volumeAnalysisResult.classList.remove('is-hidden');
 volumeAnalysisResult.textContent=currentLanguage==='ja'?'解析中…':'Analyzing…';
 try{
  const rect=canvas.getBoundingClientRect();
  const mouse=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
  const raycaster=new THREE.Raycaster();raycaster.setFromCamera(mouse,camera);
  const hit=raycaster.intersectObjects(sceneState.obj.children,true).find(h=>h.object?.userData?.segmentKey);
  if(!hit){volumeAnalysisResult.textContent=tr('volumeHint');return}
  const key=hit.object.userData.segmentKey,seg=segmentState[key],scale=hit.object.userData.displayScale;
  const local=hit.object.worldToLocal(hit.point.clone());
  const [vx,vy,vz]=volume.spacing,w=volume.columns,h=volume.rows,d=volume.slices;
  const px=w*vx,py=h*vy,pz=d*vz;
  let x=Math.round((local.x/scale+px/2)/vx),y=Math.round((-local.y/scale+py/2)/vy),z=Math.round((local.z/scale+pz/2)/vz);
  const processedMask=getProcessedSegmentMask(volume,seg);
  const inside=(ix,iy,iz)=>ix>=0&&iy>=0&&iz>=0&&ix<w&&iy<h&&iz<d&&processedMask[iz*h*w+iy*w+ix]===1;
  if(!inside(x,y,z)){
   let found=null;
   for(let r=1;r<=2&&!found;r++)for(let dz=-r;dz<=r&&!found;dz++)for(let dy=-r;dy<=r&&!found;dy++)for(let dx=-r;dx<=r;dx++){const ix=x+dx,iy=y+dy,iz=z+dz;if(inside(ix,iy,iz)){found=[ix,iy,iz];break}}
   if(!found){volumeAnalysisResult.textContent=currentLanguage==='ja'?'選択位置から領域を特定できませんでした':'Could not identify a component at the selected point';return}
   [x,y,z]=found;
  }
  const result=await connectedComponentVolume(volume,seg,x,y,z,processedMask);
  showAnalysisHighlight(volume,result.mask,key);
  const labels={bone:currentLanguage==='ja'?'骨':'Bone',soft:currentLanguage==='ja'?'軟部組織':'Soft tissue',fat:currentLanguage==='ja'?'脂肪':'Fat',lung:currentLanguage==='ja'?'肺':'Lung'};
  volumeAnalysisResult.innerHTML='<strong>'+labels[key]+'</strong><span>'+result.mm3.toFixed(2)+' mm³</span><span>'+result.mm3.toFixed(2)+' µL · '+result.voxels.toLocaleString()+' voxels</span>';
 }catch(e){
  console.error(e);volumeAnalysisResult.textContent=(currentLanguage==='ja'?'体積解析エラー: ':'Volume analysis error: ')+String(e.message||e);
 }finally{volumeAnalysisBusy=false}
}
async function connectedComponentVolume(v,seg,x0,y0,z0,mask=getProcessedSegmentMask(v,seg)){
 const w=v.columns,h=v.rows,d=v.slices,n=w*h*d,data=v.data,visited=new Uint8Array(n);
 let queue=new Int32Array(65536),head=0,tail=0;
 const grow=()=>{const next=new Int32Array(queue.length*2);next.set(queue);queue=next};
 const start=z0*h*w+y0*w+x0;queue[tail++]=start;visited[start]=1;
 let count=0,steps=0;
 const tryPush=i=>{if(i<0||i>=n||visited[i]||!mask[i])return;visited[i]=1;if(tail>=queue.length)grow();queue[tail++]=i};
 while(head<tail){
  const i=queue[head++];count++;
  const z=Math.floor(i/(h*w)),rem=i-z*h*w,y=Math.floor(rem/w),x=rem-y*w;
  if(x>0)tryPush(i-1);if(x<w-1)tryPush(i+1);if(y>0)tryPush(i-w);if(y<h-1)tryPush(i+w);if(z>0)tryPush(i-h*w);if(z<d-1)tryPush(i+h*w);
  if((++steps&0x3ffff)===0)await frameYield();
 }
 return{voxels:count,mm3:count*v.spacing[0]*v.spacing[1]*v.spacing[2],mask:visited};
}

function clearAnalysisHighlight(){
 if(!sceneState?.analysisMesh)return;
 const mesh=sceneState.analysisMesh;
 if(mesh.parent)mesh.parent.remove(mesh);
 mesh.geometry?.dispose?.();
 if(Array.isArray(mesh.material))mesh.material.forEach(m=>m.dispose?.());else mesh.material?.dispose?.();
 sceneState.analysisMesh=null;
}
function showAnalysisHighlight(v,mask,key){
 clearAnalysisHighlight();
 if(!sceneState?.obj||!mask)return;
 const mesh=buildMaskSurface(v,mask,key);
 if(!mesh)return;
 sceneState.analysisMesh=mesh;
 sceneState.obj.add(mesh);
}
function buildMaskSurface(v,mask,key){
 const w=v.columns,h=v.rows,d=v.slices,[sx,sy,sz]=v.spacing;
 const positions=[],indices=[],vertexMap=new Map();
 const px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 let count=0;for(let i=0;i<mask.length;i++)if(mask[i])count++;
 const step=Math.max(1,Math.ceil(Math.cbrt(Math.max(1,count)/180000)));
 const inside=(x,y,z)=>{
  if(x<0||y<0||z<0||x>=w||y>=h||z>=d)return false;
  return mask[z*h*w+y*w+x]===1;
 };
 const vertex=(gx,gy,gz)=>{
  const k=gx+','+gy+','+gz;
  let id=vertexMap.get(k);if(id!==undefined)return id;
  id=positions.length/3;vertexMap.set(k,id);
  positions.push((gx*sx-px/2)*scale,-(gy*sy-py/2)*scale,(gz*sz-pz/2)*scale);
  return id;
 };
 const face=(a,b,c,dv)=>{
  const ia=vertex(...a),ib=vertex(...b),ic=vertex(...c),id=vertex(...dv);
  indices.push(ia,ib,ic,ia,ic,id);
 };
 const maxFaces=180000;let faces=0;
 outer:for(let z=0;z<d;z+=step)for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  if(!inside(x,y,z))continue;
  const x1=Math.min(w,x+step),y1=Math.min(h,y+step),z1=Math.min(d,z+step);
  if(!inside(x-step,y,z)){face([x,y,z],[x,y,z1],[x,y1,z1],[x,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x+step,y,z)){face([x1,y,z],[x1,y1,z],[x1,y1,z1],[x1,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y-step,z)){face([x,y,z],[x1,y,z],[x1,y,z1],[x,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y+step,z)){face([x,y1,z],[x,y1,z1],[x1,y1,z1],[x1,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,z-step)){face([x,y,z],[x,y1,z],[x1,y1,z],[x1,y,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,z+step)){face([x,y,z1],[x1,y,z1],[x1,y1,z1],[x,y1,z1]);if(++faces>=maxFaces)break outer}
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 if(surfaceSmoothEnabled.checked)taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value);
 const material=new THREE.MeshStandardMaterial({
  color:0x00d8ff,
  emissive:0x0088aa,
  emissiveIntensity:.75,
  transparent:true,
  opacity:.92,
  roughness:.35,
  metalness:0,
  side:THREE.DoubleSide,
  depthWrite:false,
  polygonOffset:true,
  polygonOffsetFactor:-2,
  polygonOffsetUnits:-2
 });
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='analysis_'+key;
 mesh.renderOrder=20;
 return mesh;
}

function appendSourceSliceFaces(positions,series,z,prev,curr,next){
 const w=series.columns,h=series.rows,d=series.slices.length,sx=series.spacingX,sy=series.spacingY,sz=series.spacingZ,px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const at=(m,x,y)=>m&&x>=0&&y>=0&&x<w&&y<h&&m[y*w+x]===1;
 const quad=(a,b,c,dv)=>positions.push(...a,...b,...c,...a,...c,...dv);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  if(!curr[y*w+x])continue;
  const x0=(x*sx-px/2)*scale,x1=((x+1)*sx-px/2)*scale,y0=-(y*sy-py/2)*scale,y1=-((y+1)*sy-py/2)*scale,z0=(z*sz-pz/2)*scale,z1=((z+1)*sz-pz/2)*scale;
  if(!at(curr,x-1,y))quad([x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0]);
  if(!at(curr,x+1,y))quad([x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]);
  if(!at(curr,x,y-1))quad([x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]);
  if(!at(curr,x,y+1))quad([x0,y1,z0],[x0,y1,z1],[x1,y1,z1],[x1,y1,z0]);
  if(!at(prev,x,y))quad([x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[x1,y0,z0]);
  if(!at(next,x,y))quad([x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]);
 }
}
function geometryFromSourcePositions(positions){
 if(!positions.length)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.computeVertexNormals();geometry.computeBoundingSphere();
 return geometry;
}
function thresholdSourceMask(data,seg){
 const mask=new Uint8Array(data.length);
 for(let i=0;i<data.length;i++)if(data[i]>=seg.min&&data[i]<=seg.max)mask[i]=1;
 return mask;
}
async function render3DSourceBacked(v){
 if(!sceneState||!v.series)return;
 const revision=++sourceRenderRevision,series=v.series;
 let savedTransform=null;
 if(sceneState.obj){
  savedTransform={position:sceneState.obj.position.clone(),quaternion:sceneState.obj.quaternion.clone(),scale:sceneState.obj.scale.clone()};
  sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj);
 }
 const group=new THREE.Group();
 if(savedTransform){group.position.copy(savedTransform.position);group.quaternion.copy(savedTransform.quaternion);group.scale.copy(savedTransform.scale)}
 sceneState.obj=group;sceneState.scene.add(group);
 const active=SEGMENT_PRESET_ORDER.filter(key=>segmentState[key].active&&segmentState[key].enabled);
 threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution';
 if(!active.length)return;
 const chunkDepth=8;
 for(const key of active){
  const seg=segmentState[key],materialParams={color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,depthWrite:seg.opacity>.55};
  let prev=null,curr=thresholdSourceMask(await decodeSourceSlice(series.slices[0]),seg);
  let next=series.slices.length>1?thresholdSourceMask(await decodeSourceSlice(series.slices[1]),seg):null;
  let positions=[];
  for(let z=0;z<series.slices.length;z++){
   if(revision!==sourceRenderRevision)return;
   appendSourceSliceFaces(positions,series,z,prev,curr,next);
   const flush=(z%chunkDepth===chunkDepth-1)||z===series.slices.length-1;
   if(flush){
    const geometry=geometryFromSourcePositions(positions);
    if(geometry){
     const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial(materialParams));
     mesh.name='segment_'+key+'_full_'+z;
     mesh.userData.segmentKey=key;
     mesh.userData.displayScale=3.3/Math.max(series.columns*series.spacingX,series.rows*series.spacingY,series.slices.length*series.spacingZ,1);
     group.add(mesh);
    }
    positions=[];
    footer.textContent='3D full resolution · '+key+' · '+(z+1)+' / '+series.slices.length;
    await frameYield();
   }
   prev=curr;curr=next;
   const nz=z+2;
   next=nz<series.slices.length?thresholdSourceMask(await decodeSourceSlice(series.slices[nz]),seg):null;
  }
 }
 if(revision===sourceRenderRevision){
  threeLabel.textContent=(sceneState.backend||'3D')+' · full resolution';
  footer.textContent='3D full resolution · source DICOM · no resampling';
 }
}

function surfaceSamplingStep(v){
 const total=v.columns*v.rows*v.slices;

 if(total<=12000000)return 1;
 if(total<=40000000)return 2;
 return Math.max(2,Math.ceil(Math.cbrt(total/2500000)));
}
function render3D(v){
 if(!sceneState)return;
 if(v.sourceBacked){void render3DSourceBacked(v);return}
 sourceRenderRevision++;
 sceneState.analysisMesh=null;
 let savedTransform=null;
 if(sceneState.obj){
  savedTransform={
   position:sceneState.obj.position.clone(),
   quaternion:sceneState.obj.quaternion.clone(),
   scale:sceneState.obj.scale.clone()
  };
  sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj)
 }
 const group=new THREE.Group();
 if(savedTransform){
  group.position.copy(savedTransform.position);
  group.quaternion.copy(savedTransform.quaternion);
  group.scale.copy(savedTransform.scale);
 }
 const total=v.columns*v.rows*v.slices;
 const step=surfaceSamplingStep(v);
 for(const key of ['lung','fat','soft','bone']){
  const seg=segmentState[key];
  if(!seg.active||!seg.enabled)continue;
  const mesh=buildSegmentSurface(v,seg,step,key);
  if(mesh)group.add(mesh);
 }
 sceneState.obj=group;sceneState.scene.add(group);
 threeLabel.textContent=(sceneState.backend||'3D')+' · surface mesh · step '+step;
}
function buildSegmentSurface(v,seg,step,key){
 const w=v.columns,h=v.rows,d=v.slices,[sx,sy,sz]=v.spacing,mask=getProcessedSegmentMask(v,seg);
 const positions=[],indices=[],vertexMap=new Map();
 const px=w*sx,py=h*sy,pz=d*sz,scale=3.3/Math.max(px,py,pz,1);
 const inside=(x,y,z)=>{
  if(x<0||y<0||z<0||x>=w||y>=h||z>=d)return false;
  return mask[z*h*w+y*w+x]===1;
 };
 const vertex=(gx,gy,gz)=>{
  const k=gx+','+gy+','+gz;
  let id=vertexMap.get(k);if(id!==undefined)return id;
  id=positions.length/3;vertexMap.set(k,id);
  positions.push((gx*sx-px/2)*scale,-(gy*sy-py/2)*scale,(gz*sz-pz/2)*scale);
  return id;
 };
 const face=(a,b,c,dv)=>{
  const ia=vertex(...a),ib=vertex(...b),ic=vertex(...c),id=vertex(...dv);
  indices.push(ia,ib,ic,ia,ic,id);
 };
 const maxFaces=key==='bone'?600000:300000;let faces=0;
 outer:for(let z=0;z<d;z+=step)for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  if(!inside(x,y,z))continue;
  const x1=Math.min(w,x+step),y1=Math.min(h,y+step),z1=Math.min(d,z+step);
  const nx=x-step,ny=y-step,nz=z-step,pxn=x+step,pyn=y+step,pzn=z+step;
  if(!inside(nx,y,z)){face([x,y,z],[x,y,z1],[x,y1,z1],[x,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(pxn,y,z)){face([x1,y,z],[x1,y1,z],[x1,y1,z1],[x1,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,ny,z)){face([x,y,z],[x1,y,z],[x1,y,z1],[x,y,z1]);if(++faces>=maxFaces)break outer}
  if(!inside(x,pyn,z)){face([x,y1,z],[x,y1,z1],[x1,y1,z1],[x1,y1,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,nz)){face([x,y,z],[x,y1,z],[x1,y1,z],[x1,y,z]);if(++faces>=maxFaces)break outer}
  if(!inside(x,y,pzn)){face([x,y,z1],[x1,y,z1],[x1,y1,z1],[x,y1,z1]);if(++faces>=maxFaces)break outer}
 }
 if(!indices.length)return null;
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({
  color:seg.color,transparent:seg.opacity<.999,opacity:seg.opacity,
  roughness:key==='bone'?.55:.8,metalness:0,side:THREE.DoubleSide,
  depthWrite:seg.opacity>.55
 });
 if(surfaceSmoothEnabled.checked){
  taubinSmoothGeometry(geometry,+surfaceSmoothStrength.value);
 }
 const mesh=new THREE.Mesh(geometry,material);mesh.name='segment_'+key;mesh.userData.segmentKey=key;mesh.userData.displayScale=scale;return mesh;
}


function exportSegmentStl(key){
 if(!volume)return;
 const seg=segmentState[key];
 const total=volume.columns*volume.rows*volume.slices;
 const step=surfaceSamplingStep(volume);
 const mesh=buildSegmentSurface(volume,seg,step,key);
 if(!mesh){footer.textContent='STL: segment is empty';return}
 try{
  const geometry=mesh.geometry.clone();
  const [sx,sy,sz]=volume.spacing;
  const physicalMax=Math.max(volume.columns*sx,volume.rows*sy,volume.slices*sz,1);
  const inverseDisplayScale=physicalMax/3.3;
  const posAttr=geometry.getAttribute('position');
  for(let i=0;i<posAttr.count;i++){
   posAttr.setXYZ(i,posAttr.getX(i)*inverseDisplayScale,posAttr.getY(i)*inverseDisplayScale,posAttr.getZ(i)*inverseDisplayScale);
  }
  posAttr.needsUpdate=true;geometry.computeVertexNormals();
  const blob=geometryToBinaryStl(geometry,key);
  const names={bone:'bone',soft:'soft-tissue',fat:'fat',lung:'lung'};
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='virtual-rodent-'+(names[key]||key)+'.stl';
  document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  footer.textContent=(currentLanguage==='ja'?'STLを書き出しました: ':'STL exported: ')+a.download;
  geometry.dispose();
 }finally{
  mesh.geometry.dispose();mesh.material.dispose();
 }
}
function geometryToBinaryStl(geometry,name='segment'){
 const pos=geometry.getAttribute('position'),index=geometry.index;
 if(!pos||!index)throw new Error('Indexed geometry required for STL export');
 const triCount=Math.floor(index.count/3),buffer=new ArrayBuffer(84+triCount*50),view=new DataView(buffer);
 const header=new TextEncoder().encode('Virtual Rodent Lab '+name);new Uint8Array(buffer,0,Math.min(80,header.length)).set(header.slice(0,80));
 view.setUint32(80,triCount,true);
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),n=new THREE.Vector3();
 let off=84;
 for(let t=0;t<triCount;t++){
  const ia=index.getX(t*3),ib=index.getX(t*3+1),ic=index.getX(t*3+2);
  a.fromBufferAttribute(pos,ia);b.fromBufferAttribute(pos,ib);c.fromBufferAttribute(pos,ic);
  ab.subVectors(b,a);ac.subVectors(c,a);n.crossVectors(ab,ac).normalize();
  for(const v of [n,a,b,c]){view.setFloat32(off,v.x,true);view.setFloat32(off+4,v.y,true);view.setFloat32(off+8,v.z,true);off+=12}
  view.setUint16(off,0,true);off+=2;
 }
 return new Blob([buffer],{type:'model/stl'});
}
function taubinSmoothGeometry(geometry,strength){
 const pos=geometry.getAttribute('position');
 const index=geometry.index;
 if(!pos||!index||strength<=0)return;
 const vertexCount=pos.count;
 const neighbors=Array.from({length:vertexCount},()=>new Set());
 const idx=index.array;
 for(let i=0;i<idx.length;i+=3){
  const a=idx[i],b=idx[i+1],c=idx[i+2];
  neighbors[a].add(b);neighbors[a].add(c);
  neighbors[b].add(a);neighbors[b].add(c);
  neighbors[c].add(a);neighbors[c].add(b);
 }
 const coords=new Float32Array(pos.array);
 const tmp=new Float32Array(coords.length);
 const baseStrength=Math.min(strength,1),lambda=.34*baseStrength,mu=-.36*baseStrength;
 const pass=(src,dst,factor)=>{
  for(let i=0;i<vertexCount;i++){
   const ns=neighbors[i];
   if(ns.size===0){dst[i*3]=src[i*3];dst[i*3+1]=src[i*3+1];dst[i*3+2]=src[i*3+2];continue}
   let ax=0,ay=0,az=0;
   for(const j of ns){ax+=src[j*3];ay+=src[j*3+1];az+=src[j*3+2]}
   const inv=1/ns.size;ax*=inv;ay*=inv;az*=inv;
   const o=i*3;dst[o]=src[o]+factor*(ax-src[o]);dst[o+1]=src[o+1]+factor*(ay-src[o+1]);dst[o+2]=src[o+2]+factor*(az-src[o+2]);
  }
 };
 const iterations=Math.max(1,Math.round(strength<=1?2+strength*4:6+(strength-1)*18));
 let a=coords,b=tmp;
 for(let k=0;k<iterations;k++){
  pass(a,b,lambda);[a,b]=[b,a];
  pass(a,b,mu);[a,b]=[b,a];
 }
 pos.array.set(a);pos.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

function resetVolume(){sourceRenderRevision++;disposeFilterWorker(true);setFilterWorkerBusy(false);activeSeries=null;clearAnalysisHighlight();smoothingType.value='gaussian';filterOrder=[];for(const box of [spikeHoleBtn,nlmBtn,anisotropicBtn,gaussianBtn,sigmoidBtn,bilateralBtn,tvBtn,unsharpBtn])box.checked=false;renderFilterOrder();for(const key of SEGMENT_PRESET_ORDER){segmentState[key].active=false;segmentState[key].enabled=false;const enabled=$('[data-seg-enabled="'+key+'"]');if(enabled)enabled.checked=false}renderSegmentPresets();volumeAnalysisMode=false;volumeAnalysisBusy=false;volumeAnalysisToggle.disabled=true;volumeAnalysisToggle.classList.remove('is-active');volumeAnalysisToggle.textContent=tr('volumeMode');volumeAnalysisResult.classList.add('is-hidden');volumeAnalysisResult.textContent='';filterRebuildRevision++;filterState.spikeHole=filterState.nlm=filterState.anisotropic=filterState.gaussian=filterState.sigmoid=filterState.bilateral=filterState.tv=filterState.unsharp=false;volume=null;sourceVolume=null;enableProcessingControls(false);surfaceSmoothEnabled.disabled=true;surfaceSmoothStrength.disabled=true;gaussianStrength.disabled=true;spatialPasses.disabled=true;spikeHoleStrength.disabled=true;spikeHoleThreshold.disabled=true;nlmStrength.disabled=true;nlmSearchRadius.disabled=true;nlmPatchRadius.disabled=true;anisotropicStrength.disabled=true;anisotropicIterations.disabled=true;bilateralStrength.disabled=true;bilateralSpatial.disabled=true;bilateralIntensity.disabled=true;bilateralPasses.disabled=true;tvWeight.disabled=true;tvIterations.disabled=true;unsharpRadius.disabled=true;unsharpAmount.disabled=true;unsharpThreshold.disabled=true;wc.disabled=ww.disabled=true;for(const key of Object.keys(segmentState)){for(const sel of ['enabled','color','min','max','opacity','opening','closing','min-component','hole-fill']){const el=$('[data-seg-'+sel+'="'+key+'"]');if(el)el.disabled=true}const exportBtn=$('[data-seg-export="'+key+'"]');if(exportBtn)exportBtn.disabled=true;const removeBtn=$('[data-seg-remove="'+key+'"]');if(removeBtn)removeBtn.disabled=true}wcVal.value=wwVal.value='—';for(const p of Object.values(planes)){p.slider.disabled=true;p.label.textContent='—';p.canvas.getContext('2d')?.clearRect(0,0,p.canvas.width,p.canvas.height)}if(sceneState?.obj){sceneState.scene.remove(sceneState.obj);dispose(sceneState.obj);sceneState.obj=null}threeLabel.textContent=sceneState?.backend||'3D'}
function dispose(o){o.traverse(c=>{c.geometry?.dispose?.();if(Array.isArray(c.material))c.material.forEach(m=>m.dispose());else c.material?.dispose?.()})}
function busy(v){folderBtn.disabled=demoBtn.disabled=v}
function progress(a,b){bar.style.width=(b?Math.round(a/b*100):0)+'%';progLabel.textContent=a+' / '+b}
function byteProgress(a,b,label){bar.style.width=Math.min(100,Math.round(a/b*100))+'%';progLabel.textContent=label+' '+fmt(a)+' / '+fmt(b)}
function fmt(n){if(!n)return'0 B';const u=['B','KiB','MiB','GiB'];const i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),u.length-1);return(n/1024**i).toFixed(i?2:0)+' '+u[i]}
function num(v){const n=Number(v);return Number.isFinite(n)?n:null}function numberOr(v,f){const n=Number(v);return Number.isFinite(n)?n:f}function multi(v,n){if(!v)return null;const a=v.split('\\').map(Number);return a.length>=n&&a.every(Number.isFinite)?a.slice(0,n):null}function safePair(a){return[a[0],a[1]]}function safeTriple(a){return[a[0],a[1],a[2]]}function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
start3D().catch(e=>{console.error(e);status.textContent='3D RENDERER ERROR';status.className='status status-error';threeLabel.textContent='MPR ONLY';footer.textContent='3D初期化に失敗しました。DICOM/MPRは利用できます: '+String(e.message||e)});
