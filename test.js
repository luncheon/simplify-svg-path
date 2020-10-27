import assert from 'assert'
import Paper from 'paper'
import simplifySvgPath from './index.min.js'

new Paper.Project()

const simplifySvgPathByPaper = (segments, tolerance) => {
  const path = new Paper.Path(segments)
  path.simplify(tolerance)
  return path.pathData
}

for (let i = 0; i < 100; i++) {
  const points = Array(100).fill(0).map(() => [Math.random() * 100, Math.random() * 100])
  const tolerance = Math.random() * 5
  assert.strictEqual(simplifySvgPath(points, { tolerance }), simplifySvgPathByPaper(points, tolerance))
}

console.log('passed')
