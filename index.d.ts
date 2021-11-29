declare const simplifySvgPath: (points: readonly (readonly [number, number])[], options?: {
    closed?: boolean;
    tolerance?: number;
    precision?: number;
}) => string;
export default simplifySvgPath;
