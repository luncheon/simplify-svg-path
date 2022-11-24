interface Point {
    readonly x: number;
    readonly y: number;
}
declare const simplifySvgPath: (points: readonly (readonly [number, number])[] | readonly Point[], options?: {
    closed?: boolean;
    tolerance?: number;
    precision?: number;
}) => string;
export default simplifySvgPath;
