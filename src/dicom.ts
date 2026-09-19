import dicomParser from 'dicom-parser';

export type DicomSliceMeta = {
  file: File;
  studyUid: string;
  seriesUid: string;
  seriesDescription: string;
  modality: string;
  rows: number;
  columns: number;
  bitsAllocated: number;
  pixelRepresentation: number;
  samplesPerPixel: number;
  pixelSpacing: [number, number] | null;
  sliceThickness: number | null;
  spacingBetweenSlices: number | null;
  instanceNumber: number | null;
  imagePositionPatient: [number, number, number] | null;
  imageOrientationPatient: [number, number, number, number, number, number] | null;
  rescaleSlope: number;
  rescaleIntercept: number;
  transferSyntaxUid: string;
};

export type DicomSeriesSummary = {
  id: string;
  studyUid: string;
  seriesUid: string;
  description: string;
  modality: string;
  slices: DicomSliceMeta[];
  rows: number;
  columns: number;
  spacingX: number | null;
  spacingY: number | null;
  spacingZ: number | null;
  bitsAllocated: number;
  estimatedBytes: number;
  transferSyntaxes: string[];
  slopeRange: [number, number];
  interceptRange: [number, number];
};

function numberValue(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseMultiNumber(value: string | undefined, count: number): number[] | null {
  if (!value) return null;
  const values = value
    .split('\\\\')
    .map((part) => Number(part.trim()))
    .filter((n) => Number.isFinite(n));
  return values.length >= count ? values.slice(0, count) : null;
}

function sortSlices(slices: DicomSliceMeta[]): DicomSliceMeta[] {
  return [...slices].sort((a, b) => {
    const az = a.imagePositionPatient?.[2];
    const bz = b.imagePositionPatient?.[2];
    if (az != null && bz != null && az !== bz) return az - bz;

    if (a.instanceNumber != null && b.instanceNumber != null) {
      return a.instanceNumber - b.instanceNumber;
    }

    return a.file.name.localeCompare(b.file.name, undefined, { numeric: true });
  });
}

function inferSpacingZ(slices: DicomSliceMeta[]): number | null {
  const sorted = sortSlices(slices);
  const deltas: number[] = [];

  for (let i = 1; i < sorted.length; i += 1) {
    const a = sorted[i - 1].imagePositionPatient?.[2];
    const b = sorted[i].imagePositionPatient?.[2];
    if (a != null && b != null) {
      const delta = Math.abs(b - a);
      if (delta > 0) deltas.push(delta);
    }
  }

  if (deltas.length > 0) {
    deltas.sort((a, b) => a - b);
    return deltas[Math.floor(deltas.length / 2)];
  }

  return (
    sorted.find((slice) => slice.spacingBetweenSlices != null)?.spacingBetweenSlices ??
    sorted.find((slice) => slice.sliceThickness != null)?.sliceThickness ??
    null
  );
}

export async function parseDicomFiles(
  files: File[],
  onProgress?: (completed: number, total: number) => void,
): Promise<DicomSliceMeta[]> {
  const output: DicomSliceMeta[] = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];

    try {
      const arrayBuffer = await file.arrayBuffer();
      const byteArray = new Uint8Array(arrayBuffer);
      const dataSet = dicomParser.parseDicom(byteArray, { untilTag: 'x7fe00010' });

      const seriesUid = dataSet.string('x0020000e')?.trim();
      if (!seriesUid) {
        onProgress?.(index + 1, files.length);
        continue;
      }

      const pixelSpacing = parseMultiNumber(dataSet.string('x00280030'), 2);
      const imagePosition = parseMultiNumber(dataSet.string('x00200032'), 3);
      const imageOrientation = parseMultiNumber(dataSet.string('x00200037'), 6);

      output.push({
        file,
        studyUid: dataSet.string('x0020000d')?.trim() || 'unknown-study',
        seriesUid,
        seriesDescription:
          dataSet.string('x0008103e')?.trim() ||
          dataSet.string('x00181030')?.trim() ||
          'Unnamed series',
        modality: dataSet.string('x00080060')?.trim() || 'Unknown',
        rows: dataSet.uint16('x00280010') ?? 0,
        columns: dataSet.uint16('x00280011') ?? 0,
        bitsAllocated: dataSet.uint16('x00280100') ?? 16,
        pixelRepresentation: dataSet.uint16('x00280103') ?? 0,
        samplesPerPixel: dataSet.uint16('x00280002') ?? 1,
        pixelSpacing: pixelSpacing ? [pixelSpacing[0], pixelSpacing[1]] : null,
        sliceThickness: nullableNumber(dataSet.string('x00180050')),
        spacingBetweenSlices: nullableNumber(dataSet.string('x00180088')),
        instanceNumber: nullableNumber(dataSet.string('x00200013')),
        imagePositionPatient: imagePosition
          ? [imagePosition[0], imagePosition[1], imagePosition[2]]
          : null,
        imageOrientationPatient: imageOrientation
          ? [
              imageOrientation[0],
              imageOrientation[1],
              imageOrientation[2],
              imageOrientation[3],
              imageOrientation[4],
              imageOrientation[5],
            ]
          : null,
        rescaleSlope: numberValue(dataSet.string('x00281053'), 1),
        rescaleIntercept: numberValue(dataSet.string('x00281052'), 0),
        transferSyntaxUid: dataSet.string('x00020010')?.trim() || 'unknown',
      });
    } catch {
      // Non-DICOM files inside a selected directory are ignored.
    }

    onProgress?.(index + 1, files.length);
  }

  return output;
}

export function groupDicomSeries(slices: DicomSliceMeta[]): DicomSeriesSummary[] {
  const groups = new Map<string, DicomSliceMeta[]>();

  for (const slice of slices) {
    const key = `${slice.studyUid}::${slice.seriesUid}`;
    const list = groups.get(key);
    if (list) list.push(slice);
    else groups.set(key, [slice]);
  }

  return [...groups.entries()]
    .map(([id, group]) => {
      const sorted = sortSlices(group);
      const first = sorted[0];
      const rows = Math.max(...sorted.map((slice) => slice.rows));
      const columns = Math.max(...sorted.map((slice) => slice.columns));
      const bitsAllocated = Math.max(...sorted.map((slice) => slice.bitsAllocated));
      const samplesPerPixel = Math.max(...sorted.map((slice) => slice.samplesPerPixel));
      const bytesPerSample = Math.max(1, Math.ceil(bitsAllocated / 8));
      const estimatedBytes =
        rows * columns * sorted.length * samplesPerPixel * bytesPerSample;

      const slopes = sorted.map((slice) => slice.rescaleSlope);
      const intercepts = sorted.map((slice) => slice.rescaleIntercept);

      return {
        id,
        studyUid: first.studyUid,
        seriesUid: first.seriesUid,
        description: first.seriesDescription,
        modality: first.modality,
        slices: sorted,
        rows,
        columns,
        spacingX: first.pixelSpacing?.[1] ?? null,
        spacingY: first.pixelSpacing?.[0] ?? null,
        spacingZ: inferSpacingZ(sorted),
        bitsAllocated,
        estimatedBytes,
        transferSyntaxes: [...new Set(sorted.map((slice) => slice.transferSyntaxUid))],
        slopeRange: [Math.min(...slopes), Math.max(...slopes)],
        interceptRange: [Math.min(...intercepts), Math.max(...intercepts)],
      } satisfies DicomSeriesSummary;
    })
    .sort((a, b) => b.slices.length - a.slices.length);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function formatSpacing(value: number | null): string {
  return value == null ? '—' : `${value.toFixed(4)} mm`;
}
