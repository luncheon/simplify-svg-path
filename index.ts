/*
 * simplify-svg-path
 *
 * The logic is a copy of Paper.js v0.12.11.
 */

/*
 * Paper.js - The Swiss Army Knife of Vector Graphics Scripting.
 * http://paperjs.org/
 *
 * Copyright (c) 2011 - 2020, Jürg Lehni & Jonathan Puckey
 * http://juerglehni.com/ & https://puckey.studio/
 *
 * Distributed under the MIT license. See LICENSE file for details.
 *
 * All rights reserved.
 */

// An Algorithm for Automatically Fitting Digitized Curves
// by Philip J. Schneider
// from "Graphics Gems", Academic Press, 1990
// Modifications and optimizations of original algorithm by Jürg Lehni.
const EPSILON = 1e-12
const MACHINE_EPSILON = 1.12e-16
const isMachineZero = (val: number) => val >= -MACHINE_EPSILON && val <= MACHINE_EPSILON

class Formatter {
  readonly multiplier = Math.pow(10, this.precision)

  constructor(readonly precision: number) {}

  number(val: number) {
    // It would be nice to use Number#toFixed() instead, but it pads with 0,
    // unnecessarily consuming space.
    // If precision is >= 16, don't do anything at all, since that appears
    // to be the limit of the precision (it actually varies).
    return this.precision < 16 ? Math.round(val * this.multiplier) / this.multiplier : val
  }

  pair(val1: number, val2: number) {
    return this.number(val1) + ',' + this.number(val2)
  }
}

class Point {
  constructor(readonly x: number, readonly y: number) {}

  negate(): Point {
    return new Point(-this.x, -this.y)
  }

  normalize(length = 1) {
    return this.multiply(length / (this.getLength() || Infinity))
  }

  add(p: Point): Point {
    return new Point(this.x + p.x, this.y + p.y)
  }

  subtract(p: Point): Point {
    return new Point(this.x - p.x, this.y - p.y)
  }

  multiply(n: number): Point {
    return new Point(this.x * n, this.y * n)
  }

  dot(p: Point): number {
    return this.x * p.x + this.y * p.y
  }

  getLength() {
    return Math.sqrt(this.x * this.x + this.y * this.y)
  }

  getDistance(p: Point): number {
    const dx = this.x - p.x
    const dy = this.y - p.y
    return Math.sqrt(dx * dx + dy * dy)
  }
}

class Segment {
  handleOut?: Point

  constructor(readonly point: Point, readonly handleIn?: Point) {}

  setHandleOut(handleOut: Point) {
    this.handleOut = handleOut
  }
}

class PathFitter {
  constructor(readonly points: Point[], readonly closed?: boolean) {}

  fit(error: number) {
    const points = this.points
    // We need to duplicate the first and last segment when simplifying a
    // closed path.
    if (this.closed) {
      points.unshift(points[points.length - 1])
      points.push(points[1]) // The point previously at index 0 is now 1.
    }
    const length = points.length
    if (length === 0) {
      return []
    }
    // To support reducing paths with multiple points in the same place
    // to one segment:
    const segments = [new Segment(points[0])]
    this.fitCubic(
      segments,
      error,
      0,
      length - 1,
      // Left Tangent
      points[1].subtract(points[0]),
      // Right Tangent
      points[length - 2].subtract(points[length - 1]),
    )
    // Remove the duplicated segments for closed paths again.
    if (this.closed) {
      segments.shift()
      segments.pop()
    }
    return segments
  }

  // Fit a Bezier curve to a (sub)set of digitized points
  fitCubic(segments: Segment[], error: number, first: number, last: number, tan1: Point, tan2: Point) {
    const points = this.points
    //  Use heuristic if region only has two points in it
    if (last - first === 1) {
      const pt1 = points[first],
        pt2 = points[last],
        dist = pt1.getDistance(pt2) / 3
      this.addCurve(segments, [pt1, pt1.add(tan1.normalize(dist)), pt2.add(tan2.normalize(dist)), pt2])
      return
    }
    // Parameterize points, and attempt to fit curve
    const uPrime = this.chordLengthParameterize(first, last)
    let maxError = Math.max(error, error * error),
      split: number,
      parametersInOrder = true
    // Try 4 iterations
    for (let i = 0; i <= 4; i++) {
      const curve = this.generateBezier(first, last, uPrime, tan1, tan2)
      //  Find max deviation of points to fitted curve
      const max = this.findMaxError(first, last, curve, uPrime)
      if (max.error < error && parametersInOrder) {
        this.addCurve(segments, curve)
        return
      }
      split = max.index
      // If error not too large, try reparameterization and iteration
      if (max.error >= maxError) break
      parametersInOrder = this.reparameterize(first, last, uPrime, curve)
      maxError = max.error
    }
    // Fitting failed -- split at max error point and fit recursively
    const tanCenter = points[split! - 1].subtract(points[split! + 1])
    this.fitCubic(segments, error, first, split!, tan1, tanCenter)
    this.fitCubic(segments, error, split!, last, tanCenter.negate(), tan2)
  }

  addCurve(segments: Segment[], curve: Point[]) {
    const prev = segments[segments.length - 1]
    prev.setHandleOut(curve[1].subtract(curve[0]))
    segments.push(new Segment(curve[3], curve[2].subtract(curve[3])))
  }

  // Use least-squares method to find Bezier control points for region.
  generateBezier(first: number, last: number, uPrime: number[], tan1: Point, tan2: Point) {
    const epsilon = /*#=*/ EPSILON,
      abs = Math.abs,
      points = this.points,
      pt1 = points[first],
      pt2 = points[last],
      // Create the C and X matrices
      C = [
        [0, 0],
        [0, 0],
      ],
      X = [0, 0]

    for (let i = 0, l = last - first + 1; i < l; i++) {
      const u = uPrime[i],
        t = 1 - u,
        b = 3 * u * t,
        b0 = t * t * t,
        b1 = b * t,
        b2 = b * u,
        b3 = u * u * u,
        a1 = tan1.normalize(b1),
        a2 = tan2.normalize(b2),
        tmp = points[first + i].subtract(pt1.multiply(b0 + b1)).subtract(pt2.multiply(b2 + b3))
      C[0][0] += a1.dot(a1)
      C[0][1] += a1.dot(a2)
      // C[1][0] += a1.dot(a2);
      C[1][0] = C[0][1]
      C[1][1] += a2.dot(a2)
      X[0] += a1.dot(tmp)
      X[1] += a2.dot(tmp)
    }

    // Compute the determinants of C and X
    const detC0C1 = C[0][0] * C[1][1] - C[1][0] * C[0][1]
    let alpha1
    let alpha2
    if (abs(detC0C1) > epsilon) {
      // Kramer's rule
      const detC0X = C[0][0] * X[1] - C[1][0] * X[0],
        detXC1 = X[0] * C[1][1] - X[1] * C[0][1]
      // Derive alpha values
      alpha1 = detXC1 / detC0C1
      alpha2 = detC0X / detC0C1
    } else {
      // Matrix is under-determined, try assuming alpha1 == alpha2
      const c0 = C[0][0] + C[0][1],
        c1 = C[1][0] + C[1][1]
      alpha1 = alpha2 = abs(c0) > epsilon ? X[0] / c0 : abs(c1) > epsilon ? X[1] / c1 : 0
    }

    // If alpha negative, use the Wu/Barsky heuristic (see text)
    // (if alpha is 0, you get coincident control points that lead to
    // divide by zero in any subsequent NewtonRaphsonRootFind() call.
    const segLength = pt2.getDistance(pt1),
      eps = epsilon * segLength
    let handle1, handle2
    if (alpha1 < eps || alpha2 < eps) {
      // fall back on standard (probably inaccurate) formula,
      // and subdivide further if needed.
      alpha1 = alpha2 = segLength / 3
    } else {
      // Check if the found control points are in the right order when
      // projected onto the line through pt1 and pt2.
      const line = pt2.subtract(pt1)
      // Control points 1 and 2 are positioned an alpha distance out
      // on the tangent vectors, left and right, respectively
      handle1 = tan1.normalize(alpha1)
      handle2 = tan2.normalize(alpha2)
      if (handle1.dot(line) - handle2.dot(line) > segLength * segLength) {
        // Fall back to the Wu/Barsky heuristic above.
        alpha1 = alpha2 = segLength / 3
        handle1 = handle2 = null // Force recalculation
      }
    }

    // First and last control points of the Bezier curve are
    // positioned exactly at the first and last data points
    return [pt1, pt1.add(handle1 || tan1.normalize(alpha1)), pt2.add(handle2 || tan2.normalize(alpha2)), pt2]
  }

  // Given set of points and their parameterization, try to find
  // a better parameterization.
  reparameterize(first: number, last: number, u: number[], curve: Point[]) {
    for (let i = first; i <= last; i++) {
      u[i - first] = this.findRoot(curve, this.points[i], u[i - first])
    }
    // Detect if the new parameterization has reordered the points.
    // In that case, we would fit the points of the path in the wrong order.
    for (let i = 1, l = u.length; i < l; i++) {
      if (u[i] <= u[i - 1]) return false
    }
    return true
  }

  // Use Newton-Raphson iteration to find better root.
  findRoot(curve: Point[], point: Point, u: number) {
    const curve1 = [],
      curve2 = []
    // Generate control vertices for Q'
    for (let i = 0; i <= 2; i++) {
      curve1[i] = curve[i + 1].subtract(curve[i]).multiply(3)
    }
    // Generate control vertices for Q''
    for (let i = 0; i <= 1; i++) {
      curve2[i] = curve1[i + 1].subtract(curve1[i]).multiply(2)
    }
    // Compute Q(u), Q'(u) and Q''(u)
    const pt = this.evaluate(3, curve, u),
      pt1 = this.evaluate(2, curve1, u),
      pt2 = this.evaluate(1, curve2, u),
      diff = pt.subtract(point),
      df = pt1.dot(pt1) + diff.dot(pt2)
    // u = u - f(u) / f'(u)
    return isMachineZero(df) ? u : u - diff.dot(pt1) / df
  }

  // Evaluate a bezier curve at a particular parameter value
  evaluate(degree: number, curve: Point[], t: number) {
    // Copy array
    const tmp = curve.slice()
    // Triangle computation
    for (let i = 1; i <= degree; i++) {
      for (let j = 0; j <= degree - i; j++) {
        tmp[j] = tmp[j].multiply(1 - t).add(tmp[j + 1].multiply(t))
      }
    }
    return tmp[0]
  }

  // Assign parameter values to digitized points
  // using relative distances between points.
  chordLengthParameterize(first: number, last: number) {
    const u = [0]
    for (let i = first + 1; i <= last; i++) {
      u[i - first] = u[i - first - 1] + this.points[i].getDistance(this.points[i - 1])
    }
    for (let i = 1, m = last - first; i <= m; i++) {
      u[i] /= u[m]
    }
    return u
  }

  // Find the maximum squared distance of digitized points to fitted curve.
  findMaxError(first: number, last: number, curve: Point[], u: number[]) {
    let index = Math.floor((last - first + 1) / 2),
      maxDist = 0
    for (let i = first + 1; i < last; i++) {
      const P = this.evaluate(3, curve, u[i - first])
      const v = P.subtract(this.points[i])
      const dist = v.x * v.x + v.y * v.y // squared
      if (dist >= maxDist) {
        maxDist = dist
        index = i
      }
    }
    return {
      error: maxDist,
      index: index,
    }
  }
}

const getSegmentsPathData = (segments: Segment[], closed: unknown, precision: number) => {
  const length = segments.length
  const f = new Formatter(precision)
  let first = true
  let prevX: number, prevY: number, outX: number, outY: number
  const parts: string[] = []

  const addSegment = (segment: Segment, skipLine?: boolean) => {
    const curX = segment.point.x
    const curY = segment.point.y
    if (first) {
      parts.push('M' + f.pair(curX, curY))
      first = false
    } else {
      const inX = curX + (segment.handleIn?.x ?? 0)
      const inY = curY + (segment.handleIn?.y ?? 0)
      if (inX === curX && inY === curY && outX === prevX && outY === prevY) {
        // l = relative lineto:
        if (!skipLine) {
          const dx = curX - prevX
          const dy = curY - prevY
          parts.push(dx === 0 ? 'v' + f.number(dy) : dy === 0 ? 'h' + f.number(dx) : 'l' + f.pair(dx, dy))
        }
      } else {
        // c = relative curveto:
        parts.push(
          'c' + f.pair(outX - prevX, outY - prevY) + ' ' + f.pair(inX - prevX, inY - prevY) + ' ' + f.pair(curX - prevX, curY - prevY),
        )
      }
    }
    prevX = curX
    prevY = curY
    outX = curX + (segment.handleOut?.x ?? 0)
    outY = curY + (segment.handleOut?.y ?? 0)
  }

  if (!length) return ''

  for (let i = 0; i < length; i++) addSegment(segments[i])
  // Close path by drawing first segment again
  if (closed && length > 0) {
    addSegment(segments[0], true)
    parts.push('z')
  }
  return parts.join('')
}

export default (
  points: readonly (readonly [number, number])[],
  options: { closed?: boolean; tolerance?: number; precision?: number } = {},
) =>
  getSegmentsPathData(
    new PathFitter(
      points.map(p => new Point(p[0], p[1])),
      options.closed,
    ).fit(options.tolerance ?? 2.5),
    options.closed,
    options.precision ?? 5,
  )
