import dicomParser from 'dicom-parser';
import type { DicomSeriesSummary, DicomSliceMeta } from './dicom';

export type CtVolume = {
  data: Float32Array;
  columns: number;
  rows: number;
  slices: number;
  spacing: [number, number, number];
  min: number;
  max: number;
};

export type VolumeProgress = (completed: number, total: number) => void;

const UNCOMPRESSED_TRANSFER_SYNTAXES = new Set([
  '1.2.840.10008.1.2',
  '1.2.840.10008.1.2.1',
  '1.2.840.10008.1.2.2',
]);

export async function decodeSeriesToCtVolume(
  series: DicomSeriesSummary,
  onProgress?: VolumeProgress,
): Promise<CtVolume> {
  const { columns, rows } = series;
  const sliceCount = series.slices.length;
  const voxelCount = columns * rows * sliceCount;

  if (columns <= 0 || rows <= 0 || sliceCount <= 0) {
    throw new Error('Series geometry is incomplete.');
  }

  const data = new Float32Array(voxelCount);
  let globalMin = Number.POSITIVE_INFINITY;
  let globalMax = Number.NEGATIVE_INFINITY;

  for (let z = 0; z < sliceCount; z += 1) {
    const meta = series.slices[z];

    if (!UNCOMPRESSED_TRANSFER_SYNTAXES.has(meta.transferSyntaxUid)) {
      throw new Error(
        `Compressed Transfer Syntax is not supported yet: ${meta.transferSyntaxUid}`,
      );
    }

    const pixels = await decodeSlice(meta, columns, rows);
    const targetOffset = z * rows * columns;

    for (let i = 0; i < pixels.length; i += 1) {
      const calibrated = pixels[i] * meta.rescaleSlope + meta.rescaleIntercept;
      data[targetOffset + i] = calibrated;
      if (calibrated < globalMin) globalMin = calibrated;
      if (calibrated > globalMax) globalMax = calibrated;
    }

    onProgress?.(z + 1, sliceCount);
  }

  return {
    data,
    columns,
    rows,
    slices: sliceCount,
    spacing: [
      series.spacingX ?? 1,
      series.spacingY ?? 1,
      series.spacingZ ?? 1,
    ],
    min: globalMin,
    max: globalMax,
  };
}

async function decodeSlice(
  meta: DicomSliceMeta,
  expectedColumns: number,
  expectedRows: number,
): Promise<Int32Array> {
  const bytes = new Uint8Array(await meta.file.arrayBuffer());
  const dataSet = dicomParser.parseDicom(bytes);
  const pixelElement = dataSet.elements.x7fe00010;

  if (!pixelElement) {
    throw new Error(`Pixel Data is missing: ${meta.file.name}`);
  }

  const rows = dataSet.uint16('x00280010') ?? meta.rows;
  const columns = dataSet.uint16('x00280011') ?? meta.columns;

  if (rows !== expectedRows || columns !== expectedColumns) {
    throw new Error(
      `Mixed image matrix in one Series: ${columns}x${rows}, expected ${expectedColumns}x${expectedRows}`,
    );
  }

  const bitsAllocated = dataSet.uint16('x00280100') ?? meta.bitsAllocated;
  const pixelRepresentation = dataSet.uint16('x00280103') ?? meta.pixelRepresentation;
  const pixelCount = rows * columns;
  const result = new Int32Array(pixelCount);
  const dataOffset = pixelElement.dataOffset;
  const transferSyntax = meta.transferSyntaxUid;
  const littleEndian = transferSyntax !== '1.2.840.10008.1.2.2';

  if (bitsAllocated === 8) {
    for (let i = 0; i < pixelCount; i += 1) {
      const value = bytes[dataOffset + i];
      result[i] = pixelRepresentation === 1 && value > 127 ? value - 256 : value;
    }
    return result;
  }

  if (bitsAllocated !== 16) {
    throw new Error(`Unsupported BitsAllocated=${bitsAllocated} in ${meta.file.name}`);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < pixelCount; i += 1) {
    const offset = dataOffset + i * 2;
    result[i] =
      pixelRepresentation === 1
        ? view.getInt16(offset, littleEndian)
        : view.getUint16(offset, littleEndian);
  }

  return result;
}

export type Plane = 'axial' | 'coronal' | 'sagittal';

export function renderPlaneToCanvas(
  volume: CtVolume,
  plane: Plane,
  index: number,
  canvas: HTMLCanvasElement,
  windowCenter: number,
  windowWidth: number,
): void {
  const context = canvas.getContext('2d');
  if (!context) return;

  const { width, height } = planeDimensions(volume, plane);
  canvas.width = width;
  canvas.height = height;

  const image = context.createImageData(width, height);
  const low = windowCenter - windowWidth / 2;
  const invWidth = windowWidth > 0 ? 255 / windowWidth : 1;

  let p = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = samplePlane(volume, plane, index, x, y);
      const gray = Math.max(0, Math.min(255, Math.round((value - low) * invWidth)));
      image.data[p] = gray;
      image.data[p + 1] = gray;
      image.data[p + 2] = gray;
      image.data[p + 3] = 255;
      p += 4;
    }
  }

  context.putImageData(image, 0, 0);
}

function planeDimensions(volume: CtVolume, plane: Plane): { width: number; height: number } {
  switch (plane) {
    case 'axial':
      return { width: volume.columns, height: volume.rows };
    case 'coronal':
      return { width: volume.columns, height: volume.slices };
    case 'sagittal':
      return { width: volume.rows, height: volume.slices };
  }
}

function samplePlane(
  volume: CtVolume,
  plane: Plane,
  index: number,
  x: number,
  y: number,
): number {
  const { columns, rows, slices, data } = volume;

  switch (plane) {
    case 'axial': {
      const z = Math.max(0, Math.min(slices - 1, index));
      return data[z * rows * columns + y * columns + x];
    }
    case 'coronal': {
      const row = Math.max(0, Math.min(rows - 1, index));
      const z = slices - 1 - y;
      return data[z * rows * columns + row * columns + x];
    }
    case 'sagittal': {
      const column = Math.max(0, Math.min(columns - 1, index));
      const z = slices - 1 - y;
      return data[z * rows * columns + x * columns + column];
    }
  }
}
