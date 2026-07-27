import { describe, expect, it } from 'vitest';
import {
  buildScanPages,
  fitScanImage,
  filterScanPages,
  nextScanIndex,
  rotateScanView,
  restoreScanView,
  type ScanView,
} from '../src/model/scanGallery';

describe('scan gallery model', () => {
  const pages = buildScanPages(188);

  it('builds zero-padded page labels and urls', () => {
    expect(pages[0]).toEqual({
      number: 1,
      label: '0001',
      url: 'r473op1d4496/0001.jpg',
      thumbUrl: 'r473op1d4496/thumbs/0001.jpg',
      orientation: 'portrait',
    });
    expect(pages.at(-1)?.label).toBe('0188');
  });

  it('filters by page query and parity', () => {
    expect(filterScanPages(pages, '018', 'all').map((page) => page.label)).toEqual([
      '0018', '0180', '0181', '0182', '0183', '0184', '0185', '0186', '0187', '0188',
    ]);
    expect(filterScanPages(pages, '', 'even').every((page) => page.number % 2 === 0)).toBe(true);
  });

  it('moves through a filtered list and wraps at the ends', () => {
    const filtered = filterScanPages(pages, '018', 'all');
    expect(nextScanIndex(filtered, 0, 1)).toBe(1);
    expect(nextScanIndex(filtered, 0, -1)).toBe(filtered.length - 1);
    expect(nextScanIndex(filtered, filtered.length - 1, 1)).toBe(0);
  });

  it('restores a saved view while keeping invalid values safe', () => {
    const saved: ScanView = { scale: 2.4, x: -130, y: 80, rotation: 270 };
    expect(restoreScanView(saved)).toEqual(saved);
    expect(restoreScanView({ scale: Number.NaN, x: 99999, y: -99999 })).toEqual({
      scale: 1,
      x: 0,
      y: 0,
      rotation: 0,
    });
  });

  it('rotates a saved view in quarter-turns and wraps around', () => {
    const view: ScanView = { scale: 1, x: 0, y: 0, rotation: 270 };
    expect(rotateScanView(view, 90).rotation).toBe(0);
    expect(rotateScanView(view, -90).rotation).toBe(180);
  });

  it('fits each image by its natural dimensions and current rotation', () => {
    const landscape = fitScanImage({ width: 5684, height: 4177 }, { width: 1200, height: 700 }, 0, 32);
    const quarterTurn = fitScanImage({ width: 5684, height: 4177 }, { width: 1200, height: 700 }, 90, 32);

    expect(landscape.width).toBeCloseTo(865.5, 0);
    expect(landscape.height).toBeCloseTo(636);
    expect(quarterTurn.width).toBeLessThan(landscape.width);
    expect(quarterTurn.height).toBeLessThan(landscape.height);
    expect(quarterTurn.orientedWidth).toBeLessThanOrEqual(1168);
    expect(quarterTurn.orientedHeight).toBeLessThanOrEqual(636);
  });
});
