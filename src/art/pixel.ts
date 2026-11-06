/**
 * All art in the prototype is hand-placed pixels drawn into canvases at boot.
 * No image files to load, and every gear layer lines up on the same 16x20 grid.
 */
export type Color = string;

export class PixelGrid {
  readonly w: number;
  readonly h: number;
  private cells: (Color | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cells = new Array(w * h).fill(null);
  }

  px(x: number, y: number, c: Color): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.cells[y * this.w + x] = c;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: Color): this {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
    return this;
  }

  /** Horizontal line. */
  hl(x: number, y: number, w: number, c: Color): this {
    return this.rect(x, y, w, 1, c);
  }

  /** Vertical line. */
  vl(x: number, y: number, h: number, c: Color): this {
    return this.rect(x, y, 1, h, c);
  }

  /** Mirror pixels from the left half onto the right half. */
  mirrorX(): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < Math.floor(this.w / 2); x++) {
        const c = this.cells[y * this.w + x];
        if (c) this.cells[y * this.w + (this.w - 1 - x)] = c;
      }
    }
    return this;
  }

  /** Adds a 1px dark outline around every filled pixel. */
  outline(c: Color): this {
    const copy = [...this.cells];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (copy[y * this.w + x]) continue;
        const near = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const nx = x + dx!;
          const ny = y + dy!;
          return nx >= 0 && ny >= 0 && nx < this.w && ny < this.h && !!copy[ny * this.w + nx];
        });
        if (near) this.cells[y * this.w + x] = c;
      }
    }
    return this;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.cells[y * this.w + x];
        if (c) {
          ctx.fillStyle = c;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }
}
