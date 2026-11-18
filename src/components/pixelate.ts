/**
 * The effects as a dot matrix: drawn small, every lit cell lifted to one of a few steady levels,
 * then scaled up square with a hairline gap between cells — the look of the calculator's display.
 */
export class Pixelator {
  private low = document.createElement('canvas');
  private full = document.createElement('canvas');
  private mask: { cell: number; pattern: CanvasPattern } | null = null;

  /**
   * Paint W × H (CSS px) through `paint`, in cells of `px` CSS px, and return a canvas the size of
   * the view in device pixels. `paint` draws as usual; its lines come out as whole cells.
   */
  draw(W: number, H: number, dpr: number, px: number, paint: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
    const cw = Math.max(1, Math.ceil(W / px)), ch = Math.max(1, Math.ceil(H / px));
    const { low, full } = this;
    if (low.width !== cw || low.height !== ch) (low.width = cw), (low.height = ch);
    const lg = low.getContext('2d', { willReadFrequently: true })!;
    lg.setTransform(1 / px, 0, 0, 1 / px, 0, 0);
    lg.clearRect(0, 0, W, H);
    paint(lg);

    // a hairline covers part of a cell: lift it, and settle every cell on one of three levels, so nothing is mush
    const img = lg.getImageData(0, 0, cw, ch);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) {
      if (!d[i]) continue;
      const l = (d[i] / 255) * 2.6;
      d[i] = l < 0.12 ? 0 : l < 0.45 ? 80 : l < 0.85 ? 160 : 255;
    }
    lg.putImageData(img, 0, 0);

    const fw = Math.round(W * dpr), fh = Math.round(H * dpr);
    if (full.width !== fw || full.height !== fh) (full.width = fw), (full.height = fh);
    const fg = full.getContext('2d')!;
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, fw, fh);
    fg.imageSmoothingEnabled = false;
    const cell = Math.max(2, Math.round(px * dpr));
    fg.drawImage(low, 0, 0, cw, ch, 0, 0, cw * cell, ch * cell);
    // the gaps between cells
    fg.globalCompositeOperation = 'destination-out';
    fg.fillStyle = this.gaps(fg, cell);
    fg.fillRect(0, 0, fw, fh);
    fg.globalCompositeOperation = 'source-over';
    return full;
  }

  /** one cell with its gap along the right and bottom, repeated */
  private gaps(g: CanvasRenderingContext2D, cell: number): CanvasPattern {
    if (this.mask?.cell === cell) return this.mask.pattern;
    const c = document.createElement('canvas');
    c.width = c.height = cell;
    const x = c.getContext('2d')!;
    const gap = Math.max(1, Math.round(cell * 0.22));
    x.fillStyle = '#000';
    x.fillRect(cell - gap, 0, gap, cell);
    x.fillRect(0, cell - gap, cell, gap);
    this.mask = { cell, pattern: g.createPattern(c, 'repeat')! };
    return this.mask.pattern;
  }
}
