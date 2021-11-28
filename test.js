import assert from 'assert'
import Paper from 'paper'
import simplifySvgPath from './index.min.js'

new Paper.Project()

const simplifySvgPathByPaper = (segments, { closed, tolerance, precision }) => {
  const path = new Paper.Path(segments)
  closed && path.closePath()
  path.simplify(tolerance)
  return path.getPathData(undefined, precision)
}

for (let i = 0; i < 1000; i++) {
  const points = []
  for (let i = 0; i < 100; i++) {
    points.push([Math.random() * 100, Math.random() * 100])
  }
  const options = {
    closed: Math.random() < 0.5,
    tolerance: Math.random() * 5 || 2.5,
    precision: (Math.random() * 20) | 0,
  }
  assert.strictEqual(
    simplifySvgPath(points, options),
    simplifySvgPathByPaper(points, options),
    `simplified path does not equal to Paper.js. closed: ${options.closed}, tolerance: ${options.tolerance}, precision: ${options.precision}`,
  )
}

console.log('passed')
