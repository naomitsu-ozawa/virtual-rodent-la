import { unzip } from 'fflate';

export const PUBLIC_MOUSE_DEMO = {
  title: 'Public Mouse PET/CT demo',
  source:
    'Unda et al., Bidirectional regulation of motor circuits using magnetogenetic gene therapy',
  archiveUrl: 'https://zenodo.org/api/records/12761093/files/PET-CT.zip/content',
  archiveSizeBytes: 20_800_000,
  landingPage: 'https://zenodo.org/records/12761093',
} as const;

export type DemoProgress = {
  phase: 'download' | 'unzip';
  loaded: number;
  total: number | null;
};

export async function loadPublicMouseDemo(
  onProgress?: (progress: DemoProgress) => void,
): Promise<File[]> {
  const response = await fetch(PUBLIC_MOUSE_DEMO.archiveUrl, {
    mode: 'cors',
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`Demo download failed: HTTP ${response.status} ${response.statusText}`);
  }

  const totalHeader = response.headers.get('content-length');
  const total = totalHeader ? Number(totalHeader) : PUBLIC_MOUSE_DEMO.archiveSizeBytes;

  let archiveBytes: Uint8Array;

  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress?.({ phase: 'download', loaded, total });
    }

    archiveBytes = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      archiveBytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
  } else {
    const buffer = await response.arrayBuffer();
    archiveBytes = new Uint8Array(buffer);
    onProgress?.({ phase: 'download', loaded: archiveBytes.byteLength, total });
  }

  onProgress?.({ phase: 'unzip', loaded: 0, total: archiveBytes.byteLength });

  const entries = await new Promise<Record<string, Uint8Array>>((resolve, reject) => {
    unzip(archiveBytes, (error, files) => {
      if (error) reject(error);
      else resolve(files);
    });
  });

  const files: File[] = [];
  for (const [path, bytes] of Object.entries(entries)) {
    if (path.endsWith('/') || bytes.byteLength === 0) continue;
    files.push(new File([bytes], path.split('/').pop() || path));
  }

  onProgress?.({
    phase: 'unzip',
    loaded: archiveBytes.byteLength,
    total: archiveBytes.byteLength,
  });

  if (files.length === 0) {
    throw new Error('The demo archive did not contain readable files.');
  }

  return files;
}
