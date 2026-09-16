import {readFile, stat} from 'node:fs/promises';
import {describe, expect, it} from 'vitest';

const bundleUrl = new URL('../dist/camera-calibration.js', import.meta.url);

describe('the committed extension bundle', () => {
  it('is one self-contained file with no module-level imports', async () => {
    const bundle = await readFile(bundleUrl, 'utf8');
    expect(bundle.startsWith('// Name: TurboWarp-Camera-Calibration')).toBe(true);
    // Node built-ins reached through the OpenCV build must be stubbed out, not
    // left as imports a browser cannot resolve.
    expect(bundle).not.toMatch(/(?:^|[^\w])(?:import|require)\s*\(?["'](?:fs|path|crypto)["']/mu);
    expect(bundle).not.toMatch(/^\s*import\s/mu);
  });

  it('carries our own OpenCV build, and never starts it on this thread', async () => {
    const bundle = await readFile(bundleUrl, 'utf8');
    const {size} = await stat(bundleUrl);
    // These only say the bundle calls the names. Whether the build provides
    // them is a question for `pnpm opencv:check`, which asks a browser: embind
    // registers OpenCV's functions at run time, so they appear in neither
    // file's text. An earlier version of this line asserted
    // `findChessboardCorners`, and passed for five releases while that
    // function was absent from the pinned build and no sample could be taken.
    expect(bundle).toContain('detectBoard');
    expect(bundle).toContain('calibrateCameraExtended');

    // Bracketed rather than floored. Too small means the solver fell out of
    // the bundle; too large means we are back on the stock 10.9 MB build,
    // which is three times the size and cannot start in a worker at all.
    expect(size).toBeGreaterThan(3_000_000);
    expect(size).toBeLessThan(6_000_000);

    // OpenCV is evaluated inside the worker, from vendored source, and the
    // worker is not created until a calibration starts. So nothing on the
    // thread that draws the stage ever touches the WebAssembly runtime --
    // which is the point: detection is twenty milliseconds and a solve over a
    // second, and both would be visible in the camera preview.
    expect(bundle).toContain('ENVIRONMENT_IS_WORKER');
    expect(bundle).not.toMatch(/require_opencv\(\)/u);

  });
});
