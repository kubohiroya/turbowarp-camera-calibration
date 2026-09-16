import {extensionConfig} from './config';
import definitions from './block-definitions.json';
import {CameraCalibrationController} from './calibration/controller.js';
import {openCvBackendFactory} from './calibration/opencv-backend.js';
import type {CalibrationBackendFactory} from './calibration/types.js';
import {
  createRuntimeCapability,
  runtimeCapabilityKey,
  type CameraCalibrationCapabilityV1
} from './runtime-capability.js';

type BlockTypeName = 'COMMAND' | 'REPORTER' | 'BOOLEAN';
type ArgumentTypeName = 'STRING' | 'NUMBER';

interface DefinitionArgument {
  type: ArgumentTypeName;
  defaultValue: string | number;
}

interface BlockDefinition {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  description: string;
  arguments: Record<string, DefinitionArgument>;
}

export interface CameraCalibrationExtensionOptions {
  runtime?: TurboWarpRuntime;
  backend?: CalibrationBackendFactory;
  nowMilliseconds?: () => number;
}

const blockDefinitions = definitions.blocks as readonly BlockDefinition[];
const defaultCameraId = 'default';

/** The state reported for a camera that has no calibration session. */
export const IDLE_CALIBRATION_STATE = 'idle';

function normalizeId(value: unknown, fallback = defaultCameraId): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export class CameraCalibrationExtension implements TurboWarpExtension {
  private readonly controller: CameraCalibrationController;
  private readonly runtime: TurboWarpRuntime;
  private capability: CameraCalibrationCapabilityV1 | undefined;

  public constructor(options: CameraCalibrationExtensionOptions = {}) {
    this.runtime = options.runtime ?? Scratch.vm.runtime;
    const nowMilliseconds = options.nowMilliseconds;
    this.controller = new CameraCalibrationController({
      runtime: this.runtime,
      backend: options.backend ?? openCvBackendFactory,
      ...(nowMilliseconds ? {nowMilliseconds} : {})
    });
    this.runtime[runtimeCapabilityKey] = this.createCapability();
    this.runtime.on?.('PROJECT_STOP_ALL', this.handleProjectBoundary);
    this.runtime.on?.('PROJECT_LOADED', this.handleProjectBoundary);
    this.runtime.on?.('RUNTIME_DISPOSED', this.handleDisposed);
  }

  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: extensionConfig.docsURI,
      blockIconURI: extensionConfig.blockIconURI,
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
    };
  }

  public async startCameraCalibration(args: {
    CAMERA_ID: unknown;
    CALIBRATION_ID: unknown;
    COLUMNS: unknown;
    ROWS: unknown;
    SQUARE_METERS: unknown;
    MAX_ERROR_PX: unknown;
  }): Promise<void> {
    await this.controller.start({
      cameraId: normalizeId(args.CAMERA_ID),
      calibrationId: Scratch.Cast.toString(args.CALIBRATION_ID).trim(),
      board: {
        columns: Scratch.Cast.toNumber(args.COLUMNS),
        rows: Scratch.Cast.toNumber(args.ROWS),
        squareSizeMeters: Scratch.Cast.toNumber(args.SQUARE_METERS)
      },
      maximumReprojectionErrorPx: Scratch.Cast.toNumber(args.MAX_ERROR_PX)
    });
  }

  public async addCameraCalibrationSample(args: {CAMERA_ID: unknown}): Promise<void> {
    await this.controller.addSample(normalizeId(args.CAMERA_ID));
  }

  public async solveCameraCalibration(args: {CAMERA_ID: unknown}): Promise<void> {
    await this.controller.solve(normalizeId(args.CAMERA_ID));
  }

  public async cancelCameraCalibration(args: {CAMERA_ID: unknown}): Promise<void> {
    await this.controller.cancel(normalizeId(args.CAMERA_ID));
  }

  public async cleanupCameraCalibration(args: {CAMERA_ID: unknown}): Promise<void> {
    await this.controller.cleanup(normalizeId(args.CAMERA_ID));
  }

  public async publishCameraCalibration(args: {CAMERA_ID: unknown}): Promise<void> {
    await this.controller.publishProfile(normalizeId(args.CAMERA_ID));
  }

  public async importCameraCalibration(args: {
    JSON: unknown;
    CAMERA_ID: unknown;
  }): Promise<void> {
    await this.controller.importProfile(
      normalizeId(args.CAMERA_ID),
      Scratch.Cast.toString(args.JSON)
    );
  }

  public cameraCalibrationJsonValid(args: {JSON: unknown; CAMERA_ID: unknown}): boolean {
    return this.controller.validateProfile(
      normalizeId(args.CAMERA_ID),
      Scratch.Cast.toString(args.JSON)
    );
  }

  public cameraCalibrationReady(args: {CAMERA_ID: unknown}): boolean {
    return this.controller.ready(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationState(args: {CAMERA_ID?: unknown} = {}): string {
    return this.controller.state(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationBackend(): string {
    return this.controller.backend();
  }

  public cameraCalibrationSampleCount(args: {CAMERA_ID: unknown}): number {
    return this.controller.sampleCount(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationSampleQuality(args: {CAMERA_ID: unknown}): number {
    return this.controller.latestSampleQuality(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationReprojectionError(args: {CAMERA_ID: unknown}): number {
    return this.controller.latestReprojectionError(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationPoseSpread(args: {CAMERA_ID: unknown}): number {
    return this.controller.poseSpread(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationHoldoutErrorPx(args: {CAMERA_ID: unknown}): number {
    return this.controller.latestHoldoutError(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationHoldoutSampleCount(args: {CAMERA_ID: unknown}): number {
    return this.controller.holdoutSampleCount(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationErrorCode(args: {CAMERA_ID: unknown}): string {
    return this.controller.errorCode(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationError(args: {CAMERA_ID: unknown}): string {
    return this.controller.errorMessage(normalizeId(args.CAMERA_ID));
  }

  public cameraCalibrationJson(args: {CAMERA_ID: unknown}): string {
    return this.controller.profileJson(normalizeId(args.CAMERA_ID));
  }

  /** Releases every camera lease when the project stops or is replaced. */
  private readonly handleProjectBoundary = (): void => {
    void this.controller.cancelAll();
  };

  private readonly handleDisposed = (): void => {
    // Taken down with the runtime it belongs to, so a consumer that outlives
    // the VM reads an absent extension rather than driving a dead controller.
    if (this.runtime[runtimeCapabilityKey] === this.capability) {
      delete this.runtime[runtimeCapabilityKey];
    }
    this.runtime.off?.('PROJECT_STOP_ALL', this.handleProjectBoundary);
    this.runtime.off?.('PROJECT_LOADED', this.handleProjectBoundary);
    this.runtime.off?.('RUNTIME_DISPOSED', this.handleDisposed);
    void this.controller.cleanupAll();
  };

  /**
   * The procedure, named rather than reached through opcodes.
   *
   * Every member routes to the same controller the blocks use, so a delegated
   * calibration and a calibration driven from the palette are one session and
   * not two views of one camera that disagree.
   */
  private createCapability(): CameraCalibrationCapabilityV1 {
    this.capability = createRuntimeCapability({
      start: (options) => this.controller.start({...options, cameraId: normalizeId(options.cameraId)}),
      addSample: (cameraId) => this.controller.addSample(normalizeId(cameraId)),
      solve: (cameraId) => this.controller.solve(normalizeId(cameraId)),
      publish: (cameraId) => this.controller.publishProfile(normalizeId(cameraId)),
      cancel: (cameraId) => this.controller.cancel(normalizeId(cameraId)),
      cleanup: (cameraId) => this.controller.cleanup(normalizeId(cameraId)),
      importProfile: (cameraId, json) => this.controller.importProfile(normalizeId(cameraId), json),
      validateProfile: (cameraId, json) =>
        this.controller.validateProfile(normalizeId(cameraId), json),
      state: (cameraId) => this.controller.state(normalizeId(cameraId)),
      ready: (cameraId) => this.controller.ready(normalizeId(cameraId)),
      backend: () => this.controller.backend(),
      sampleCount: (cameraId) => this.controller.sampleCount(normalizeId(cameraId)),
      sampleQuality: (cameraId) => this.controller.latestSampleQuality(normalizeId(cameraId)),
      reprojectionErrorPx: (cameraId) =>
        this.controller.latestReprojectionError(normalizeId(cameraId)),
      poseSpread: (cameraId) => this.controller.poseSpread(normalizeId(cameraId)),
      holdoutErrorPx: (cameraId) =>
        this.controller.latestHoldoutError(normalizeId(cameraId)),
      holdoutSampleCount: (cameraId) =>
        this.controller.holdoutSampleCount(normalizeId(cameraId)),
      errorCode: (cameraId) => this.controller.errorCode(normalizeId(cameraId)),
      errorMessage: (cameraId) => this.controller.errorMessage(normalizeId(cameraId)),
      profileJson: (cameraId) => this.controller.profileJson(normalizeId(cameraId))
    });
    return this.capability;
  }

  private toScratchBlock(block: BlockDefinition): Record<string, unknown> {
    return {
      opcode: block.opcode,
      blockType: Scratch.BlockType[block.blockType],
      text: Scratch.translate(block.text),
      arguments: Object.fromEntries(
        Object.entries(block.arguments).map(([name, argument]) => [
          name,
          {
            type: Scratch.ArgumentType[argument.type],
            defaultValue: argument.defaultValue
          }
        ])
      )
    };
  }
}
