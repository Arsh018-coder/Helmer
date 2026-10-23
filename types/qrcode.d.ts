/**
 * Minimal typings for the `qrcode` package (feature F4).
 *
 * The package ships no types of its own and `@types/qrcode` is not a dependency, so the one
 * function the app uses is declared here rather than pulling in a whole extra `@types` package
 * for a single call (AGENTS.md section 3: no dependency without a reason).
 */
declare module 'qrcode' {
  interface RenderOptions {
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
  }

  /** Render `text` as a PNG data URL, suitable for an `<img src>`. */
  export function toDataURL(text: string, options?: RenderOptions): Promise<string>;
}
