# simplify-svg-path

Extracts `Path#simplify()` from Paper.js.  
http://paperjs.org/reference/path/#simplify

## Installation & Usage

### [npm](https://www.npmjs.com/package/@luncheon/simplify-svg-path)

```bash
$ npm i @luncheon/simplify-svg-path
```

```javascript
import simplifySvgPath from '@luncheon/simplify-svg-path'

const points = [[10, 10], [10, 20], [20, 20]];
const path = simplifySvgPath(points);
// "M10,10c0,3.33333 -2.35702,7.64298 0,10c2.35702,2.35702 6.66667,0 10,0"
```

### CDN ([jsDelivr](https://www.jsdelivr.com/package/npm/@luncheon/simplify-svg-path))

```html
<script src="https://cdn.jsdelivr.net/npm/@luncheon/simplify-svg-path@0.1.3"></script>
<script>
  const path = simplifySvgPath([[10, 10], [10, 20], [20, 20]]);
</script>
```

## API

```ts
simplifySvgPath(
  points: [x: number, y: number][], // `{ x: number, y: number }[]` is also acceptable
  {
    tolerance: number = 2.5,
    precision: number = 5,
  } = {}
): string

// SVG path command string such as
// "M10,10c0,3.33333 -2.35702,7.64298 0,10c2.35702,2.35702 6.66667,0 10,0"
```

## Note

The logic is a copy of Paper.js v0.12.11.  
If you like this, please send your thanks and the star to [Paper.js](https://github.com/paperjs/paper.js).
