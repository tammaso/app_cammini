// jsts (port JavaScript di JTS, la stessa base di shapely/GEOS) non ha i tipi: li dichiariamo in breve.
declare module 'jsts/org/locationtech/jts/monkey.js';
declare module 'jsts/org/locationtech/jts/io/GeoJSONReader.js' {
  export default class GeoJSONReader { read(geometria: unknown): import('jsts').Geometria; }
}
declare module 'jsts/org/locationtech/jts/io/GeoJSONWriter.js' {
  export default class GeoJSONWriter { write(geometria: import('jsts').Geometria): { type: string; coordinates: unknown }; }
}
declare module 'jsts/org/locationtech/jts/simplify/TopologyPreservingSimplifier.js' {
  const T: { simplify(g: import('jsts').Geometria, tolleranza: number): import('jsts').Geometria };
  export default T;
}
declare module 'jsts/org/locationtech/jts/operation/buffer/BufferOp.js' {
  const B: { bufferOp(g: import('jsts').Geometria, distanza: number, segmenti?: number): import('jsts').Geometria };
  export default B;
}
declare module 'jsts' {
  export interface Inviluppo { getMinX(): number; getMinY(): number; getMaxX(): number; getMaxY(): number; intersects(altro: Inviluppo): boolean }
  export interface Geometria {
    union(altra?: Geometria): Geometria;
    difference(altra: Geometria): Geometria;
    intersection(altra: Geometria): Geometria;
    intersects(altra: Geometria): boolean;
    buffer(distanza: number, segmenti?: number): Geometria;
    isValid(): boolean;
    isEmpty(): boolean;
    getArea(): number;
    getNumGeometries(): number;
    getGeometryN(n: number): Geometria;
    getGeometryType(): string;
    getEnvelopeInternal(): Inviluppo;
    getExteriorRing(): { getCoordinates(): { x: number; y: number }[] };
    getFactory(): { createGeometryCollection(g: Geometria[]): Geometria; buildGeometry(g: Geometria[]): Geometria };
  }
}
