# Demo DICOM (sample2, mouse)

Practice dataset (512 x 512 x 512, Rigaku R_mCT2, 0.118 mm isotropic, about 60 mm cube). Chosen as 「マウス」 in the 練習データ chooser (sample1 is 「ラット」). The slices are listed in `index.json`.

Header check (build 495): PatientName "Sample", PatientID "1"; institution / physician / operator / station / serial fields are empty; the original file name appears only in ImageComments.

## Bundled project (optional)

Same as sample1: save a project from this dataset, rename it to `project.vrlab` and put it next to `index.json`. Without it nothing is applied (silent).
