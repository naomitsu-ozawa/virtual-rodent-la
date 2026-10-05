# Demo DICOM (sample1)

Practice dataset (512 x 512 x 512) for the VR prototype. Upload the .dcm files here.

## Bundled project (optional)

A project file placed here is applied automatically when 練習用データ is opened:

1. Open 練習用データ in the app, adjust it, and save with プロジェクトを保存.
2. Rename the saved file to `project.vrlab`.
3. Put it in `docs/demo/sample1/` (next to `index.json`).

The project must be saved from this same dataset: its fingerprint (series UID, size, slice count, spacing) is checked, and a project from other data is not applied. The file is always revalidated with the server (not kept in the sample cache), so an updated `project.vrlab` takes effect on the next open.
