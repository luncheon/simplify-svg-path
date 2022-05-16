declare const simplifySvgPath: (points: readonly (readonly [number, number])[] | {
    readonly x: number;
    readonly y: number;
}[], options?: {
    closed?: boolean;
    tolerance?: number;
    precision?: number;
}) => string;
export default simplifySvgPath;
