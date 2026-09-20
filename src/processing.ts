import type { CtVolume } from './volume';

export type FilterId = 'gaussian' | 'spikeHole' | 'nlm' | 'anisotropic';

export type ProcessingSettings = {
  gaussian: {
    enabled: boolean;
    strength: number;
  };
  spikeHole: {
    enabled: boolean;
    strength: number;
  };
  nlm: {
    enabled: boolean;
    strength: number;
  };
  anisotropic: {
    enabled: boolean;
    strength: number;
  };
};

export const DEFAULT_PROCESSING_SETTINGS: ProcessingSettings = {
  gaussian: { enabled: false, strength: 1 },
  spikeHole: { enabled: false, strength: 1 },
  nlm: { enabled: false, strength: 1 },
  anisotropic: { enabled: false, strength: 1 },
};

export type ProcessingProgress = (
  stage: string,
  completed: number,
  total: number,
) => void;

export async function processVolume(
  source: CtVolume,
  settings: ProcessingSettings,
  onProgress?: ProcessingProgress,
): Promise<CtVolume> {
  let data = new Float32Array(source.data);

  if (settings.gaussian.enabled) {
    data = gaussian3d(
      data,
      source.columns,
      source.rows,
      source.slices,
      settings.gaussian.strength,
      onProgress,
    );
    await yieldToBrowser();
  }

  if (settings.spikeHole.enabled) {
    data = spikeHoleCorrect3d(
      data,
      source.columns,
      source.rows,
      source.slices,
      settings.spikeHole.strength,
      onProgress,
    );
    await yieldToBrowser();
  }

  if (settings.nlm.enabled) {
    data = fastNlm3d(
      data,
      source.columns,
      source.rows,
      source.slices,
      settings.nlm.strength,
      onProgress,
    );
    await yieldToBrowser();
  }

  if (settings.anisotropic.enabled) {
    data = anisotropicDiffusion3d(
      data,
      source.columns,
      source.rows,
      source.slices,
      settings.anisotropic.strength,
      onProgress,
    );
    await yieldToBrowser();
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return {
    ...source,
    data,
    min,
    max,
  };
}

function gaussian3d(
  source: Float32Array,
  columns: number,
  rows: number,
  slices: number,
  strength: number,
  onProgress?: ProcessingProgress,
): Float32Array {
  const radius = Math.max(1, Math.min(3, Math.round(strength)));
  const sigma = Math.max(0.6, strength);
  const kernel = makeGaussianKernel(radius, sigma);
  const plane = columns * rows;

  let input = source;
  let output = new Float32Array(source.length);

  for (let z = 0; z < slices; z += 1) {
    for (let y = 0; y < rows; y += 1) {
      const rowBase = z * plane + y * columns;
      for (let x = 0; x < columns; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const xx = clampInt(x + k, 0, columns - 1);
          sum += input[rowBase + xx] * kernel[k + radius];
        }
        output[rowBase + x] = sum;
      }
    }
    onProgress?.('Gaussian X', z + 1, slices);
  }

  input = output;
  output = new Float32Array(source.length);

  for (let z = 0; z < slices; z += 1) {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const yy = clampInt(y + k, 0, rows - 1);
          sum += input[z * plane + yy * columns + x] * kernel[k + radius];
        }
        output[z * plane + y * columns + x] = sum;
      }
    }
    onProgress?.('Gaussian Y', z + 1, slices);
  }

  input = output;
  output = new Float32Array(source.length);

  for (let z = 0; z < slices; z += 1) {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        let sum = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const zz = clampInt(z + k, 0, slices - 1);
          sum += input[zz * plane + y * columns + x] * kernel[k + radius];
        }
        output[z * plane + y * columns + x] = sum;
      }
    }
    onProgress?.('Gaussian Z', z + 1, slices);
  }

  return output;
}

function spikeHoleCorrect3d(
  source: Float32Array,
  columns: number,
  rows: number,
  slices: number,
  strength: number,
  onProgress?: ProcessingProgress,
): Float32Array {
  const output = new Float32Array(source);
  const plane = columns * rows;
  const threshold = 120 * Math.max(0.25, strength);
  const pull = Math.min(1, 0.35 + strength * 0.2);
  const neighbors = new Float32Array(26);

  for (let z = 1; z < slices - 1; z += 1) {
    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < columns - 1; x += 1) {
        let count = 0;
        let sum = 0;
        let sumSq = 0;

        for (let dz = -1; dz <= 1; dz += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0 && dz === 0) continue;
              const value = source[(z + dz) * plane + (y + dy) * columns + (x + dx)];
              neighbors[count] = value;
              count += 1;
              sum += value;
              sumSq += value * value;
            }
          }
        }

        const mean = sum / count;
        const variance = Math.max(0, sumSq / count - mean * mean);
        const sd = Math.sqrt(variance);

        // Strong edges naturally have a high local variance. Preserve them.
        const edgeGuard = Math.max(threshold, sd * 2.75);
        const centerIndex = z * plane + y * columns + x;
        const center = source[centerIndex];

        if (Math.abs(center - mean) <= edgeGuard) continue;

        const median = median26(neighbors);
        if (Math.abs(center - median) <= threshold) continue;

        const delta = median - center;
        const maxCorrection = 800 * Math.max(0.25, strength);
        const correction = clamp(delta * pull, -maxCorrection, maxCorrection);
        output[centerIndex] = center + correction;
      }
    }
    onProgress?.('Spike / Hole', z, slices - 2);
  }

  return output;
}

function fastNlm3d(
  source: Float32Array,
  columns: number,
  rows: number,
  slices: number,
  strength: number,
  onProgress?: ProcessingProgress,
): Float32Array {
  const output = new Float32Array(source);
  const plane = columns * rows;
  const h = 55 + strength * 85;
  const h2 = h * h;
  const spatialSigma = 1.1 + strength * 0.45;
  const spatialDenom = 2 * spatialSigma * spatialSigma;

  // Fast local 3D NLM: 3x3x3 search neighborhood with a compact
  // 7-sample cross patch. This keeps the browser implementation practical
  // while preserving the NLM similarity-weighted averaging principle.
  const patchOffsets = [0, -1, 1, -columns, columns, -plane, plane];

  for (let z = 1; z < slices - 1; z += 1) {
    for (let y = 1; y < rows - 1; y += 1) {
      for (let x = 1; x < columns - 1; x += 1) {
        const centerIndex = z * plane + y * columns + x;
        let weightedSum = source[centerIndex];
        let weightSum = 1;

        for (let dz = -1; dz <= 1; dz += 1) {
          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0 && dz === 0) continue;

              const candidateIndex =
                centerIndex + dz * plane + dy * columns + dx;

              let patchSsd = 0;
              for (const patchOffset of patchOffsets) {
                const diff =
                  source[centerIndex + patchOffset] -
                  source[candidateIndex + patchOffset];
                patchSsd += diff * diff;
              }
              patchSsd /= patchOffsets.length;

              const spatial2 = dx * dx + dy * dy + dz * dz;
              const weight =
                Math.exp(-patchSsd / h2) *
                Math.exp(-spatial2 / spatialDenom);

              weightedSum += source[candidateIndex] * weight;
              weightSum += weight;
            }
          }
        }

        output[centerIndex] = weightedSum / weightSum;
      }
    }
    onProgress?.('Fast NLM 3D', z, slices - 2);
  }

  return output;
}

function anisotropicDiffusion3d(
  source: Float32Array,
  columns: number,
  rows: number,
  slices: number,
  strength: number,
  onProgress?: ProcessingProgress,
): Float32Array {
  const plane = columns * rows;
  const iterations = Math.max(1, Math.min(8, Math.round(strength * 2)));
  const kappa = 90 + strength * 90;
  const lambda = 0.14;

  let input = new Float32Array(source);
  let output = new Float32Array(source.length);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    output.set(input);

    for (let z = 1; z < slices - 1; z += 1) {
      for (let y = 1; y < rows - 1; y += 1) {
        for (let x = 1; x < columns - 1; x += 1) {
          const index = z * plane + y * columns + x;
          const center = input[index];

          const gradients = [
            input[index - 1] - center,
            input[index + 1] - center,
            input[index - columns] - center,
            input[index + columns] - center,
            input[index - plane] - center,
            input[index + plane] - center,
          ];

          let flux = 0;
          for (const gradient of gradients) {
            const ratio = gradient / kappa;
            const conductance = Math.exp(-(ratio * ratio));
            flux += conductance * gradient;
          }

          output[index] = center + lambda * flux;
        }
      }

      onProgress?.(
        `Anisotropic ${iteration + 1}/${iterations}`,
        z,
        slices - 2,
      );
    }

    const swap = input;
    input = output;
    output = swap;
  }

  return input;
}

function median26(values: Float32Array): number {
  const copy = Array.from(values);
  copy.sort((a, b) => a - b);
  const mid = copy.length / 2;
  return (copy[mid - 1] + copy[mid]) / 2;
}

function makeGaussianKernel(radius: number, sigma: number): Float32Array {
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  let sum = 0;

  for (let i = -radius; i <= radius; i += 1) {
    const value = Math.exp(-(i * i) / (2 * sigma * sigma));
    kernel[i + radius] = value;
    sum += value;
  }

  for (let i = 0; i < size; i += 1) {
    kernel[i] /= sum;
  }

  return kernel;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
