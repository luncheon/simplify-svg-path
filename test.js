import assert from 'assert'
import Paper from 'paper'
import simplifySvgPath from './index.js'

new Paper.Project()

const simplifySvgPathByPaper = (segments, { closed, tolerance, precision }) => {
  const path = new Paper.Path(segments)
  closed && path.closePath()
  path.simplify(tolerance)
  return path.getPathData(undefined, precision)
}

let actualTime = 0
let expectedTime = 0

for (let i = 0; i < 100; i++) {
  const points = []
  for (let i = 0; i < 1000; i++) {
    points.push([Math.random() * 100, Math.random() * 100])
  }
  const options = {
    closed: Math.random() < 0.5,
    tolerance: Math.random() * 5 || 2.5,
    precision: i % 4,
  }
  const now1 = performance.now()
  const actual = simplifySvgPath(points, options)
  const now2 = performance.now()
  const expected = simplifySvgPathByPaper(points, options)
  const now3 = performance.now()
  actualTime += now2 - now1
  expectedTime += now3 - now2
  assert.strictEqual(
    actual,
    expected,
    `simplified path does not equal to Paper.js. closed: ${options.closed}, tolerance: ${options.tolerance}, precision: ${options.precision}`,
  )
}

console.log('passed', actualTime, '[ms]', Math.round((actualTime / expectedTime) * 10000) / 100, '%')
