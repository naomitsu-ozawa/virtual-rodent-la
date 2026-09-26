// Extracted verbatim from app.js by tools/extract-module.mjs.
// Depends only on the imports below; never imports from app.js (no cycles).
import { currentLanguage } from './state.js?v=20260926-build195';
export const I18N={
 ja:{
  subtitle:'マウス・実験動物画像のためのブラウザDICOM CTビューワー',
  gpuChecking:'WEBGPU 確認中',
  demo:'公開マウスCTデモ',openFolder:'DICOMフォルダを開く',
  dataset:'データセット',series:'DICOMシリーズ',selectData:'データを選択してください',
  selectDataHelp:'ローカルフォルダ、または約20.8MBの公開マウスPET/CTデモを利用できます。',
  volumeFilterPending:'ボリュームはフィルター未反映 ·「3D再構築」で反映',
  volumeFilterUpdating:'ボリュームをフィルター設定に更新中…',
  display:'表示',ctDisplay:'CT表示',windowCenter:'ウィンドウ中心',windowWidth:'ウィンドウ幅',ctRange:'CT値操作範囲',autoRange:'Auto',fullRange:'Full',rebuild3D:'3D再構築',cancel3D:'再構築をキャンセル',cancelling3D:'キャンセル中…',threeCancelled:'3D再構築をキャンセルしました。以前の3Dを保持しています。',threeCurrent:'3Dは最新',threeStale:'3Dは再構築待ち',threeUpdating:'3D再構築中',mainView:'メインへ',
  segmentation:'セグメンテーション',segments:'組織セグメント',
  bone:'骨',soft:'軟部組織',fat:'脂肪',lung:'肺',min:'最小',max:'最大',opacity:'不透明度',segmentPreset:'セグメントプリセット',addSegment:'セグメントを追加',removeSegment:'削除',opening:'Opening',closing:'Closing',minComponent:'最小連結成分',holeFill:'Hole Filling',
  surfaceSmooth:'表面平滑化',strength:'強度',sigmoidCenter:'中心',filterThreshold:'検出閾値',iterations:'反復回数',passes:'Pass数',searchRadius:'探索半径',patchRadius:'パッチ半径',spatialSigma:'空間Sigma',intensitySigma:'強度Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'STL書き出し',volumeRender:'GPUボリューム',surfaceRender:'メッシュで確認',mprSurfaceOpacity:'断面不透明度（サーフェス）',mprVolumeOpacity:'断面不透明度（GPU）',volumeMode:'体積解析',volumeOff:'体積解析を終了',sliceAnalysis:'断面解析',sliceAnalysisOff:'断面解析を終了',sliceAnalysisHint:'3Dを切断する断面を選択してください',sectionReverse:'反転',sectionOff:'解除',sectionPosition:'断面位置',sectionSliceImage:'スライス画像を表示',sectionCap:'断面キャップ',sectionCapOpacity:'キャップ不透明度',sectionCapHatch:'ハッチング',volumeHint:'3D上の部品をクリックしてください',analysisRegions:'解析領域',mergeSelected:'選択を統合',clearRegions:'すべて解除',showRegion:'表示',hideRegion:'非表示',deleteRegion:'削除',mergedRegion:'統合領域',analysisRegion:'領域',mergeNeedsTwo:'2件以上の領域を選択してください',mergingRegions:'領域を統合中…',edit3D:'3D編集',editNavigate:'操作',selectEditRegion:'領域選択',cutRegion:'ペン切断',lineCutRegion:'直線切断',editTarget:'対象',editAuto:'自動',editReady:'操作を選択してください',editRegionHint:'3D上の領域をクリックすると連結領域を選択します。選択後「選択領域を削除」で削除できます。',editPenHint:'空間または3D上に曲線を描き、その曲線を起点とする切断面を指定します',editLineHint:'空間または3D上で直線を描き、その直線を起点とする平面切断を指定します',editAutoHint:'自動: 最初に触れたセグメントを編集対象にします',threeHelp:'3D操作',threeHelpMouse:'マウス / トラックパッド',threeHelpTouch:'タッチ',threeHelpQuick:'クイックビュー',threeHelpRotate:'左ドラッグ: 回転',threeHelpRoll:'Alt + 左ドラッグ: 平面回転',threeHelpPan:'Shift+左 / 右 / 中ドラッグ: 移動',threeHelpZoom:'ホイール: ズーム',threeHelpTouchRotate:'1本指: 回転',threeHelpTouchGesture:'2本指: 移動・ズーム・ひねり回転',threeHelpAxis:'X / Y / Z: 各軸の正面',threeHelpStep:'↶ / ↷: 15°ずつ平面回転',threeHelpPivot:'○ は現在の回転中心です',removeSelectedRegion:'選択領域を削除',keepSelectedRegion:'選択領域のみ残す',undoEdit:'Undo',redoEdit:'Redo',resetEdit:'編集リセット',cutWidth:'切断厚さ',cutDepth:'切断深さ',cutYaw:'左右角度',cutPitch:'上下角度',cutOffset:'切断面位置',applyCut:'切断を適用',cancelCut:'キャンセル',cutPendingHint:'切断予定範囲を確認し、幅・深さ・角度を調整してから「切断を適用」を押してください',exportSelectedStl:'選択領域STL',selectRegion2D:'2D/3Dで領域を選択',resetFilters:'画像フィルターをリセット',
  controls:'3D操作は3D画面右下の「？」から確認できます。断面画像: 左右スワイプ / マウスホイールでスライス移動',
  seriesUnselected:'シリーズ未選択',selectSeries:'左の一覧からCTシリーズを選択してください。',
  footer:'元のキャリブレーション済みCT値は保持されます。',
  slices:'スライス',matrix:'マトリクス',voxel:'ボクセル',stored:'保存形式',
  estimated:'推定展開サイズ',decoding:'CTボリュームを展開中…',ready:'CTボリューム準備完了',
  demoLoading:'公開マウスPET/CTを取得中…',demoSize:'約20.8MBの公開データです。',
  demoFailed:'公開デモを読み込めませんでした',dicomChecking:'DICOMを確認中…',
  pixelDeferred:'Pixel Dataはまだ展開しません。',noSeries:'DICOMシリーズを検出できませんでした',
  original:'元のキャリブレーション済みCT値',processingReset:'処理をリセットしました。元のキャリブレーション済みCT値を復元しました',
  ipadSettings:'設定',ipadClose:'閉じる',ipadData:'データ',ipadDisplay:'表示・Seg',ipadEdit:'3D編集',ipadView3d:'3D',ipadView2d:'2D',ipadViewSplit:'分割',
  demoCache:'公開デモ: キャッシュ済みデータを使用',demoDone:'公開デモ: ダウンロード完了。端末キャッシュへ保存中'
 },
 en:{
  subtitle:'Browser-based DICOM CT viewer for mouse and laboratory-animal imaging',
  gpuChecking:'WEBGPU CHECKING',
  demo:'Public mouse CT demo',openFolder:'Open DICOM folder',
  dataset:'DATASET',series:'DICOM Series',selectData:'Select data',
  selectDataHelp:'Use a local folder or the approximately 20.8 MB public mouse PET/CT demo.',
  volumeFilterPending:'Volume not updated to filters · press “Rebuild 3D”',
  volumeFilterUpdating:'Updating volume to current filters…',
  display:'DISPLAY',ctDisplay:'CT display',windowCenter:'Window Center',windowWidth:'Window Width',ctRange:'CT value range',autoRange:'Auto',fullRange:'Full',rebuild3D:'Rebuild 3D',cancel3D:'Cancel rebuild',cancelling3D:'Cancelling…',threeCancelled:'3D rebuild cancelled. Previous 3D retained.',threeCurrent:'3D is current',threeStale:'3D rebuild pending',threeUpdating:'Rebuilding 3D',mainView:'Main',
  segmentation:'SEGMENTATION',segments:'Tissue segments',
  bone:'Bone',soft:'Soft tissue',fat:'Fat',lung:'Lung',min:'Min',max:'Max',opacity:'Opacity',segmentPreset:'Segment preset',addSegment:'Add segment',removeSegment:'Remove',opening:'Opening',closing:'Closing',minComponent:'Min Component',holeFill:'Hole Filling',
  surfaceSmooth:'Surface Smooth',strength:'Strength',sigmoidCenter:'Center',filterThreshold:'Threshold',iterations:'Iterations',passes:'Passes',searchRadius:'Search Radius',patchRadius:'Patch Radius',spatialSigma:'Spatial Sigma',intensitySigma:'Intensity Sigma',weight:'Weight',radius:'Radius',amount:'Amount',exportStl:'Export STL',volumeRender:'GPU Volume',surfaceRender:'Review mesh',mprSurfaceOpacity:'MPR opacity (surface)',mprVolumeOpacity:'MPR opacity (GPU)',volumeMode:'Volume analysis',volumeOff:'Exit volume analysis',sliceAnalysis:'Section view',sliceAnalysisOff:'Exit section view',sliceAnalysisHint:'Choose a plane to cut the 3D model',sectionReverse:'Reverse',sectionOff:'Off',sectionPosition:'Section position',sectionSliceImage:'Show slice image',sectionCap:'Section cap',sectionCapOpacity:'Cap opacity',sectionCapHatch:'Hatching',volumeHint:'Click a 3D component',analysisRegions:'Analysis regions',mergeSelected:'Merge selected',clearRegions:'Clear all',showRegion:'Show',hideRegion:'Hide',deleteRegion:'Delete',mergedRegion:'Merged region',analysisRegion:'Region',mergeNeedsTwo:'Select at least two regions',mergingRegions:'Merging regions…',edit3D:'3D edit',editNavigate:'Navigate',selectEditRegion:'Select region',cutRegion:'Pen cut',lineCutRegion:'Line cut',editTarget:'Target',editAuto:'Auto',editReady:'Choose an edit tool',editRegionHint:'Click a connected region in the 3D view, then use Delete selected region to remove it.',editPenHint:'Draw a curve in space or on the 3D view to define the cutting surface',editLineHint:'Draw a line in space or on the 3D view to define a planar cut',editAutoHint:'Auto: the first touched segment becomes the edit target',threeHelp:'3D controls',threeHelpMouse:'Mouse / trackpad',threeHelpTouch:'Touch',threeHelpQuick:'Quick views',threeHelpRotate:'Left drag: rotate',threeHelpRoll:'Alt + left drag: roll',threeHelpPan:'Shift+left / right / middle drag: pan',threeHelpZoom:'Wheel: zoom',threeHelpTouchRotate:'One finger: rotate',threeHelpTouchGesture:'Two fingers: pan, zoom, twist-roll',threeHelpAxis:'X / Y / Z: face each axis',threeHelpStep:'↶ / ↷: roll by 15°',threeHelpPivot:'○ marks the current rotation center',removeSelectedRegion:'Delete selected region',keepSelectedRegion:'Keep selected region only',undoEdit:'Undo',redoEdit:'Redo',resetEdit:'Reset edits',cutWidth:'Cut thickness',cutDepth:'Cut depth',cutYaw:'Horizontal angle',cutPitch:'Vertical angle',cutOffset:'Cut plane position',applyCut:'Apply cut',cancelCut:'Cancel',cutPendingHint:'Review the planned cut, adjust width, depth and angles, then press Apply cut',exportSelectedStl:'Selected region STL',selectRegion2D:'Select a region in 2D or 3D',resetFilters:'Reset image filters',
  controls:'Open “?” at the lower-right of the 3D view for controls. MPR: swipe left/right or use the mouse wheel',
  seriesUnselected:'No Series selected',selectSeries:'Select a CT Series from the list on the left.',
  footer:'Original calibrated CT values are preserved.',
  slices:'Slices',matrix:'Matrix',voxel:'Voxel',stored:'Stored',
  estimated:'Estimated decoded size',decoding:'Decoding CT volume…',ready:'CT volume ready',
  demoLoading:'Loading public mouse PET/CT…',demoSize:'Approximately 20.8 MB of public data.',
  demoFailed:'Could not load the public demo',dicomChecking:'Checking DICOM…',
  pixelDeferred:'Pixel Data has not been expanded yet.',noSeries:'No DICOM Series detected',
  original:'Original calibrated CT values',processingReset:'Processing reset. Original calibrated CT values restored.',
  ipadSettings:'Settings',ipadClose:'Close',ipadData:'Data',ipadDisplay:'Display / Seg',ipadEdit:'3D edit',ipadView3d:'3D',ipadView2d:'2D',ipadViewSplit:'Split',
  demoCache:'Public demo: using cached data',demoDone:'Public demo: download complete. Saving to device cache'
 }
};
export const tr=key=>I18N[currentLanguage][key]??key;
