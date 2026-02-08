declare module 'giframe' {
  export default class GIFrame {
    feed(chunk: Uint8Array): void;
    getBase64(): Promise<string>;
  }
}
