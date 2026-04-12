/**
 * pdfjs-dist 5.x erwartet DOMMatrix, Path2D und ImageData global im Scope.
 * In Node.js / Vercel-Serverless-Functions fehlen diese APIs — deshalb
 * stellen wir minimale Stubs bereit, die nur die Operationen unterstützen,
 * die pdfjs bei der reinen Text-Extraktion tatsächlich aufruft.
 *
 * Diese Datei muss VOR dem ersten Import von "pdfjs-dist" geladen werden.
 */

class DOMMatrixPolyfill {
  a = 1
  b = 0
  c = 0
  d = 1
  e = 0
  f = 0
  m11 = 1
  m12 = 0
  m21 = 0
  m22 = 1
  m41 = 0
  m42 = 0

  constructor(init?: number[] | string) {
    if (Array.isArray(init) && init.length >= 6) {
      this.a = init[0]
      this.b = init[1]
      this.c = init[2]
      this.d = init[3]
      this.e = init[4]
      this.f = init[5]
      this.syncLongNames()
    }
  }

  private syncLongNames() {
    this.m11 = this.a
    this.m12 = this.b
    this.m21 = this.c
    this.m22 = this.d
    this.m41 = this.e
    this.m42 = this.f
  }

  multiply(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
    const result = new DOMMatrixPolyfill()
    result.a = this.a * other.a + this.c * other.b
    result.b = this.b * other.a + this.d * other.b
    result.c = this.a * other.c + this.c * other.d
    result.d = this.b * other.c + this.d * other.d
    result.e = this.a * other.e + this.c * other.f + this.e
    result.f = this.b * other.e + this.d * other.f + this.f
    result.syncLongNames()
    return result
  }

  translate(tx: number, ty: number): DOMMatrixPolyfill {
    const result = new DOMMatrixPolyfill()
    result.a = this.a
    result.b = this.b
    result.c = this.c
    result.d = this.d
    result.e = this.a * tx + this.c * ty + this.e
    result.f = this.b * tx + this.d * ty + this.f
    result.syncLongNames()
    return result
  }

  scale(sx: number, sy?: number): DOMMatrixPolyfill {
    const syVal = sy ?? sx
    const result = new DOMMatrixPolyfill()
    result.a = this.a * sx
    result.b = this.b * sx
    result.c = this.c * syVal
    result.d = this.d * syVal
    result.e = this.e
    result.f = this.f
    result.syncLongNames()
    return result
  }

  inverse(): DOMMatrixPolyfill {
    const det = this.a * this.d - this.b * this.c
    const result = new DOMMatrixPolyfill()
    if (det === 0) return result
    result.a = this.d / det
    result.b = -this.b / det
    result.c = -this.c / det
    result.d = this.a / det
    result.e = (this.c * this.f - this.d * this.e) / det
    result.f = (this.b * this.e - this.a * this.f) / det
    result.syncLongNames()
    return result
  }

  transformPoint(point: { x: number; y: number }) {
    return {
      x: this.a * point.x + this.c * point.y + this.e,
      y: this.b * point.x + this.d * point.y + this.f,
    }
  }
}

class Path2DPolyfill {
  addPath() {}
  arc() {}
  arcTo() {}
  bezierCurveTo() {}
  closePath() {}
  ellipse() {}
  lineTo() {}
  moveTo() {}
  quadraticCurveTo() {}
  rect() {}
  roundRect() {}
}

class ImageDataPolyfill {
  width: number
  height: number
  data: Uint8ClampedArray

  constructor(widthOrData: number | Uint8ClampedArray, heightOrWidth?: number, height?: number) {
    if (typeof widthOrData === "number") {
      this.width = widthOrData
      this.height = heightOrWidth ?? 0
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
    } else {
      this.data = widthOrData
      this.width = heightOrWidth ?? 0
      this.height = height ?? 0
    }
  }
}

const g = globalThis as Record<string, unknown>

if (typeof g.DOMMatrix === "undefined") {
  g.DOMMatrix = DOMMatrixPolyfill
}

if (typeof g.Path2D === "undefined") {
  g.Path2D = Path2DPolyfill
}

if (typeof g.ImageData === "undefined") {
  g.ImageData = ImageDataPolyfill
}

export {}
