/**
 * Ambient declarations for dependencies that ship no types.
 *
 * pdf-parse and mammoth are imported dynamically inside the CV pipeline so a
 * missing binary cannot break server startup. These declarations give the
 * dynamic imports a real shape.
 */

declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
  }
  function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}

declare module 'mammoth' {
  interface RawTextResult {
    value: string;
    messages: { type: string; message: string }[];
  }
  const mammoth: {
    extractRawText(input: { buffer: Buffer }): Promise<RawTextResult>;
  };
  export default mammoth;
}
