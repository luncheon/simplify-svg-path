import assert from 'assert'
import Paper from 'paper'
import simplifySvgPath from './index.js'

new Paper.Project()

const simplifySvgPathByPaper = segments => {
  const path = new Paper.Path(segments)
  path.simplify(1)
  return path.pathData
}

const points = Array(100).fill(0).map(() => [Math.random() * 100, Math.random() * 100])
assert.strictEqual(simplifySvgPath(points), simplifySvgPathByPaper(points))

console.log('passed')
