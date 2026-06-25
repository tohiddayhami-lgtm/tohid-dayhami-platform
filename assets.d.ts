// Vite asset imports — `import x from 'file?url'` returns the emitted asset URL as a string.
declare module '*?url' {
  const src: string;
  export default src;
}
