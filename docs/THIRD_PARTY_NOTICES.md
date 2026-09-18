# Third-party notices

## MouseMapper whole-body mouse data
Source: https://github.com/erturklab/mouseMapper

The viewer uses only data from the same MouseMapper animal, `CD68_chow_7790`:
- organ segmentation:
  `Tissue_Module/example_data/organ_segmentation_sample/segmentation/CD68_chow_7790.nii.gz`
- autofluorescence input:
  `Tissue_Module/example_data/organ_segmentation_sample/pipeline_test/CD68_chow_7790_fused_whole_arivis_exportC01xy10z10_0000.nii.gz`
- propidium iodide input:
  `Tissue_Module/example_data/organ_segmentation_sample/pipeline_test/CD68_chow_7790_fused_whole_arivis_exportC01xy10z10_0001.nii.gz`

All three files are pinned to MouseMapper revision
`7fe04a9ccf37664d76fe548ae226147c0023ceb7`.

The demo does not currently render a skeleton. A prior experimental PI/autofluorescence threshold approximation was removed because it did not constitute a valid bone segmentation. A skeleton will only be re-enabled when a same-animal MouseMapper Tissue Module bone label is available. No external-animal skeleton is used.

MouseMapper is distributed under the Apache License 2.0. The original repository and its license remain the authoritative source for the upstream material.

## Surface Nets
The browser-side voxel-to-surface conversion is adapted from Mikola Lysenko's `isosurface` Surface Nets implementation:
https://github.com/mikolalysenko/isosurface

Copyright (c) 2012-2014 Mikola Lysenko. MIT License.

## Three.js
Three.js is used for WebGPU rendering and is distributed under the MIT License:
https://github.com/mrdoob/three.js
