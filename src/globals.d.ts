interface TurboWarpExtension {
  getInfo(): Record<string, unknown>;
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
    runtime: Record<string, unknown> & {
      on?: (event: string, listener: () => void) => void;
      off?: (event: string, listener: () => void) => void;
    };
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
