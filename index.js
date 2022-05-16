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
const EPSILON = 1e-12;
const MACHINE_EPSILON = 1.12e-16;
const isMachineZero = (val) => val >= -MACHINE_EPSILON && val <= MACHINE_EPSILON;
class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    _negate() {
        return new Point(-this.x, -this.y);
    }
    _normalize(length = 1) {
        return this._multiply(length / (this._getLength() || Infinity));
    }
    _add(p) {
        return new Point(this.x + p.x, this.y + p.y);
    }
    _subtract(p) {
        return new Point(this.x - p.x, this.y - p.y);
    }
    _multiply(n) {
        return new Point(this.x * n, this.y * n);
    }
    _dot(p) {
        return this.x * p.x + this.y * p.y;
    }
    _getLength() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    _getDistance(p) {
        const dx = this.x - p.x;
        const dy = this.y - p.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
class Segment {
    constructor(_point, _handleIn) {
        this._point = _point;
        this._handleIn = _handleIn;
    }
}
const fit = (points, closed, error) => {
    // We need to duplicate the first and last segment when simplifying a
    // closed path.
    if (closed) {
        points.unshift(points[points.length - 1]);
        points.push(points[1]); // The point previously at index 0 is now 1.
    }
    const length = points.length;
    if (length === 0) {
        return [];
    }
    // To support reducing paths with multiple points in the same place
    // to one segment:
    const segments = [new Segment(points[0])];
    fitCubic(points, segments, error, 0, length - 1, 
    // Left Tangent
    points[1]._subtract(points[0]), 
    // Right Tangent
    points[length - 2]._subtract(points[length - 1]));
    // Remove the duplicated segments for closed paths again.
    if (closed) {
        segments.shift();
        segments.pop();
    }
    return segments;
};
// Fit a Bezier curve to a (sub)set of digitized points
const fitCubic = (points, segments, error, first, last, tan1, tan2) => {
    //  Use heuristic if region only has two points in it
    if (last - first === 1) {
        const pt1 = points[first], pt2 = points[last], dist = pt1._getDistance(pt2) / 3;
        addCurve(segments, [pt1, pt1._add(tan1._normalize(dist)), pt2._add(tan2._normalize(dist)), pt2]);
        return;
    }
    // Parameterize points, and attempt to fit curve
    const uPrime = chordLengthParameterize(points, first, last);
    let maxError = Math.max(error, error * error), split, parametersInOrder = true;
    // Try not 4 but 5 iterations
    for (let i = 0; i <= 4; i++) {
        const curve = generateBezier(points, first, last, uPrime, tan1, tan2);
        //  Find max deviation of points to fitted curve
        const max = findMaxError(points, first, last, curve, uPrime);
        if (max.error < error && parametersInOrder) {
            addCurve(segments, curve);
            return;
        }
        split = max.index;
        // If error not too large, try reparameterization and iteration
        if (max.error >= maxError)
            break;
        parametersInOrder = reparameterize(points, first, last, uPrime, curve);
        maxError = max.error;
    }
    // Fitting failed -- split at max error point and fit recursively
    const tanCenter = points[split - 1]._subtract(points[split + 1]);
    fitCubic(points, segments, error, first, split, tan1, tanCenter);
    fitCubic(points, segments, error, split, last, tanCenter._negate(), tan2);
};
const addCurve = (segments, curve) => {
    const prev = segments[segments.length - 1];
    prev._handleOut = curve[1]._subtract(curve[0]);
    segments.push(new Segment(curve[3], curve[2]._subtract(curve[3])));
};
// Use least-squares method to find Bezier control points for region.
const generateBezier = (points, first, last, uPrime, tan1, tan2) => {
    const epsilon = /*#=*/ EPSILON, abs = Math.abs, pt1 = points[first], pt2 = points[last], 
    // Create the C and X matrices
    C = [
        [0, 0],
        [0, 0],
    ], X = [0, 0];
    for (let i = 0, l = last - first + 1; i < l; i++) {
        const u = uPrime[i], t = 1 - u, b = 3 * u * t, b0 = t * t * t, b1 = b * t, b2 = b * u, b3 = u * u * u, a1 = tan1._normalize(b1), a2 = tan2._normalize(b2), tmp = points[first + i]._subtract(pt1._multiply(b0 + b1))._subtract(pt2._multiply(b2 + b3));
        C[0][0] += a1._dot(a1);
        C[0][1] += a1._dot(a2);
        // C[1][0] += a1.dot(a2);
        C[1][0] = C[0][1];
        C[1][1] += a2._dot(a2);
        X[0] += a1._dot(tmp);
        X[1] += a2._dot(tmp);
    }
    // Compute the determinants of C and X
    const detC0C1 = C[0][0] * C[1][1] - C[1][0] * C[0][1];
    let alpha1;
    let alpha2;
    if (abs(detC0C1) > epsilon) {
        // Kramer's rule
        const detC0X = C[0][0] * X[1] - C[1][0] * X[0], detXC1 = X[0] * C[1][1] - X[1] * C[0][1];
        // Derive alpha values
        alpha1 = detXC1 / detC0C1;
        alpha2 = detC0X / detC0C1;
    }
    else {
        // Matrix is under-determined, try assuming alpha1 == alpha2
        const c0 = C[0][0] + C[0][1], c1 = C[1][0] + C[1][1];
        alpha1 = alpha2 = abs(c0) > epsilon ? X[0] / c0 : abs(c1) > epsilon ? X[1] / c1 : 0;
    }
    // If alpha negative, use the Wu/Barsky heuristic (see text)
    // (if alpha is 0, you get coincident control points that lead to
    // divide by zero in any subsequent NewtonRaphsonRootFind() call.
    const segLength = pt2._getDistance(pt1), eps = epsilon * segLength;
    let handle1, handle2;
    if (alpha1 < eps || alpha2 < eps) {
        // fall back on standard (probably inaccurate) formula,
        // and subdivide further if needed.
        alpha1 = alpha2 = segLength / 3;
    }
    else {
        // Check if the found control points are in the right order when
        // projected onto the line through pt1 and pt2.
        const line = pt2._subtract(pt1);
        // Control points 1 and 2 are positioned an alpha distance out
        // on the tangent vectors, left and right, respectively
        handle1 = tan1._normalize(alpha1);
        handle2 = tan2._normalize(alpha2);
        if (handle1._dot(line) - handle2._dot(line) > segLength * segLength) {
            // Fall back to the Wu/Barsky heuristic above.
            alpha1 = alpha2 = segLength / 3;
            handle1 = handle2 = null; // Force recalculation
        }
    }
    // First and last control points of the Bezier curve are
    // positioned exactly at the first and last data points
    return [pt1, pt1._add(handle1 || tan1._normalize(alpha1)), pt2._add(handle2 || tan2._normalize(alpha2)), pt2];
};
// Given set of points and their parameterization, try to find
// a better parameterization.
const reparameterize = (points, first, last, u, curve) => {
    for (let i = first; i <= last; i++) {
        u[i - first] = findRoot(curve, points[i], u[i - first]);
    }
    // Detect if the new parameterization has reordered the points.
    // In that case, we would fit the points of the path in the wrong order.
    for (let i = 1, l = u.length; i < l; i++) {
        if (u[i] <= u[i - 1])
            return false;
    }
    return true;
};
// Use Newton-Raphson iteration to find better root.
const findRoot = (curve, point, u) => {
    const curve1 = [], curve2 = [];
    // Generate control vertices for Q'
    for (let i = 0; i <= 2; i++) {
        curve1[i] = curve[i + 1]._subtract(curve[i])._multiply(3);
    }
    // Generate control vertices for Q''
    for (let i = 0; i <= 1; i++) {
        curve2[i] = curve1[i + 1]._subtract(curve1[i])._multiply(2);
    }
    // Compute Q(u), Q'(u) and Q''(u)
    const pt = evaluate(3, curve, u), pt1 = evaluate(2, curve1, u), pt2 = evaluate(1, curve2, u), diff = pt._subtract(point), df = pt1._dot(pt1) + diff._dot(pt2);
    // u = u - f(u) / f'(u)
    return isMachineZero(df) ? u : u - diff._dot(pt1) / df;
};
// Evaluate a bezier curve at a particular parameter value
const evaluate = (degree, curve, t) => {
    // Copy array
    const tmp = curve.slice();
    // Triangle computation
    for (let i = 1; i <= degree; i++) {
        for (let j = 0; j <= degree - i; j++) {
            tmp[j] = tmp[j]._multiply(1 - t)._add(tmp[j + 1]._multiply(t));
        }
    }
    return tmp[0];
};
// Assign parameter values to digitized points
// using relative distances between points.
const chordLengthParameterize = (points, first, last) => {
    const u = [0];
    for (let i = first + 1; i <= last; i++) {
        u[i - first] = u[i - first - 1] + points[i]._getDistance(points[i - 1]);
    }
    for (let i = 1, m = last - first; i <= m; i++) {
        u[i] /= u[m];
    }
    return u;
};
// Find the maximum squared distance of digitized points to fitted curve.
const findMaxError = (points, first, last, curve, u) => {
    let index = Math.floor((last - first + 1) / 2), maxDist = 0;
    for (let i = first + 1; i < last; i++) {
        const P = evaluate(3, curve, u[i - first]);
        const v = P._subtract(points[i]);
        const dist = v.x * v.x + v.y * v.y; // squared
        if (dist >= maxDist) {
            maxDist = dist;
            index = i;
        }
    }
    return {
        error: maxDist,
        index: index,
    };
};
const getSegmentsPathData = (segments, closed, precision) => {
    const length = segments.length;
    const precisionMultiplier = 10 ** precision;
    const round = precision < 16 ? (n) => Math.round(n * precisionMultiplier) / precisionMultiplier : (n) => n;
    const formatPair = (x, y) => round(x) + ',' + round(y);
    let first = true;
    let prevX, prevY, outX, outY;
    const parts = [];
    const addSegment = (segment, skipLine) => {
        const curX = segment._point.x;
        const curY = segment._point.y;
        if (first) {
            parts.push('M' + formatPair(curX, curY));
            first = false;
        }
        else {
            const inX = curX + (segment._handleIn?.x ?? 0);
            const inY = curY + (segment._handleIn?.y ?? 0);
            if (inX === curX && inY === curY && outX === prevX && outY === prevY) {
                // l = relative lineto:
                if (!skipLine) {
                    const dx = curX - prevX;
                    const dy = curY - prevY;
                    parts.push(dx === 0 ? 'v' + round(dy) : dy === 0 ? 'h' + round(dx) : 'l' + formatPair(dx, dy));
                }
            }
            else {
                // c = relative curveto:
                parts.push('c' +
                    formatPair(outX - prevX, outY - prevY) +
                    ' ' +
                    formatPair(inX - prevX, inY - prevY) +
                    ' ' +
                    formatPair(curX - prevX, curY - prevY));
            }
        }
        prevX = curX;
        prevY = curY;
        outX = curX + (segment._handleOut?.x ?? 0);
        outY = curY + (segment._handleOut?.y ?? 0);
    };
    if (!length)
        return '';
    for (let i = 0; i < length; i++)
        addSegment(segments[i]);
    // Close path by drawing first segment again
    if (closed && length > 0) {
        addSegment(segments[0], true);
        parts.push('z');
    }
    return parts.join('');
};
const simplifySvgPath = (points, options = {}) => {
    if (points.length === 0) {
        return '';
    }
    return getSegmentsPathData(fit(points.map(typeof points[0].x === 'number' ? (p) => new Point(p.x, p.y) : (p) => new Point(p[0], p[1])), options.closed, options.tolerance ?? 2.5), options.closed, options.precision ?? 5);
};
export default simplifySvgPath;
