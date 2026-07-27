export type ScanParity = 'all' | 'even' | 'odd';

export type ScanPage = {
  number: number;
  label: string;
  url: string;
  thumbUrl: string;
  orientation: 'portrait' | 'landscape';
};

export type ScanView = {
  scale: number;
  x: number;
  y: number;
  rotation: number;
};

export type ScanSize = { width: number; height: number };

export type ScanFit = ScanSize & {
  scale: number;
  orientedWidth: number;
  orientedHeight: number;
};

export function buildScanPages(count: number, folder = 'r473op1d4496'): ScanPage[] {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const label = String(number).padStart(4, '0');
    return {
      number,
      label,
      url: `${folder}/${label}.jpg`,
      thumbUrl: `${folder}/thumbs/${label}.jpg`,
      orientation: 'portrait',
    };
  });
}

export function filterScanPages(pages: ScanPage[], query: string, parity: ScanParity): ScanPage[] {
  const normalized = query.trim().toLowerCase();
  return pages.filter((page) => {
    const matchesQuery = !normalized || page.label.includes(normalized) || String(page.number).includes(normalized);
    const matchesParity = parity === 'all' || (parity === 'even' ? page.number % 2 === 0 : page.number % 2 === 1);
    return matchesQuery && matchesParity;
  });
}

export function nextScanIndex(pages: ScanPage[], currentIndex: number, step: number): number {
  if (!pages.length) return -1;
  return (currentIndex + step + pages.length) % pages.length;
}

export function restoreScanView(value: Partial<ScanView> | null | undefined): ScanView {
  const scale = Number(value?.scale);
  const x = Number(value?.x);
  const y = Number(value?.y);
  const rotation = Number(value?.rotation);
  const normalizedRotation = Number.isFinite(rotation) && rotation % 90 === 0
    ? ((rotation % 360) + 360) % 360
    : 0;
  return {
    scale: Number.isFinite(scale) && scale >= 1 && scale <= 8 ? scale : 1,
    x: Number.isFinite(x) && Math.abs(x) <= 10000 ? x : 0,
    y: Number.isFinite(y) && Math.abs(y) <= 10000 ? y : 0,
    rotation: normalizedRotation,
  };
}

export function rotateScanView(view: ScanView, degrees: 90 | -90): ScanView {
  return restoreScanView({ ...view, rotation: view.rotation + degrees });
}

export function fitScanImage(natural: ScanSize, viewport: ScanSize, rotation: number, padding = 32): ScanFit {
  const availableWidth = Math.max(1, viewport.width - padding * 2);
  const availableHeight = Math.max(1, viewport.height - padding * 2);
  const quarterTurn = Math.abs(rotation) % 180 === 90;
  const orientedWidth = quarterTurn ? natural.height : natural.width;
  const orientedHeight = quarterTurn ? natural.width : natural.height;
  const scale = Math.min(availableWidth / orientedWidth, availableHeight / orientedHeight);
  const width = natural.width * scale;
  const height = natural.height * scale;
  return {
    width,
    height,
    scale,
    orientedWidth: quarterTurn ? height : width,
    orientedHeight: quarterTurn ? width : height,
  };
}
