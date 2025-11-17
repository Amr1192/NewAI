declare module 'pdfjs-dist/legacy/build/pdf' {
  export const GlobalWorkerOptions: any;
  export function getDocument(src: any): any;
}

declare module 'mammoth/mammoth.browser' {
  const mammoth: any;
  export default mammoth;
}
