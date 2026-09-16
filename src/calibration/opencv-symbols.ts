// SPDX-License-Identifier: MPL-2.0
/**
 * Everything this backend reaches for on the OpenCV module.
 *
 * Checked at load, because the alternative is what happened: the guard asked
 * only whether `getBuildInformation` was a function, which every build answers
 * yes to, and three functions the backend calls were absent from the pinned
 * build for five releases. Nothing failed until an operator pressed a button,
 * and then it failed as "is not a function" with no indication that the build
 * was the problem.
 *
 * Constants are listed too. A missing one is a silent `undefined` handed to a
 * function that will read it as a zero flag, which is worse than a crash.
 */
export const REQUIRED_OPENCV_SYMBOLS = {
  functions: [
    'getBuildInformation',
    'imread',
    'cvtColor',
    'Laplacian',
    'meanStdDev',
    'matFromArray',
    'getPredefinedDictionary',
    'calibrateCameraExtended',
    'solvePnP',
    'projectPoints'
  ],
  constructors: [
    'Mat',
    'MatVector',
    'Size',
    'aruco_CharucoBoard',
    'aruco_CharucoDetector',
    'aruco_CharucoParameters',
    'aruco_DetectorParameters',
    'aruco_RefineParameters'
  ],
  constants: ['COLOR_RGBA2GRAY', 'CV_32FC2', 'CV_32FC3', 'CV_64F', 'DICT_4X4_50']
} as const;

/** Which of the required symbols the module does not provide. */
export function missingOpenCvSymbols(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return ['(not a module)'];
  const module = value as Record<string, unknown>;
  const missing: string[] = [];
  for (const name of [
    ...REQUIRED_OPENCV_SYMBOLS.functions,
    ...REQUIRED_OPENCV_SYMBOLS.constructors
  ]) {
    if (typeof module[name] !== 'function') missing.push(name);
  }
  for (const name of REQUIRED_OPENCV_SYMBOLS.constants) {
    if (typeof module[name] !== 'number') missing.push(name);
  }
  return missing;
}
