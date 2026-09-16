interface TurboWarpExtension {
  getInfo(): Record<string, unknown>;
}

/**
 * The TurboWarp VM runtime. Loaded extensions publish their capability objects
 * on it under an `ext_<extension id>` key.
 */
interface TurboWarpRuntime extends Record<string, unknown> {
  ext_kubohiroyacamerasource?: unknown;
  on?: (event: string, listener: () => void) => void;
  off?: (event: string, listener: () => void) => void;
}

interface ScratchTranslate {
  (text: string): string;
  (message: {default: string; description?: string}, placeholders?: Record<string, string | number>): string;
}

interface ScratchApi {
  extensions: {
    unsandboxed: boolean;
    register(extension: TurboWarpExtension): void;
  };
  vm: {
    runtime: TurboWarpRuntime;
  };
  BlockType: Record<'COMMAND' | 'REPORTER' | 'BOOLEAN' | 'HAT', string>;
  ArgumentType: Record<'STRING' | 'NUMBER' | 'BOOLEAN', string>;
  Cast: {
    toString(value: unknown): string;
    toNumber(value: unknown): number;
    toBoolean(value: unknown): boolean;
  };
  translate: ScratchTranslate;
}

declare const Scratch: ScratchApi;

/**
 * Vite's inlined worker import.
 *
 * `?worker&inline` yields a constructor and embeds the worker's code in the
 * bundle, which is what keeps this extension one standalone file.
 */
declare module '*?worker&inline' {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

declare module '*?raw' {
  const source: string;
  export default source;
}
