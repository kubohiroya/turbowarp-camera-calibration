import {
  CALIBRATION_LEASE_OWNER,
  CameraSourceError,
  requireCameraSource,
  requireProfileRegistry,
  toCameraSourceProfile,
  type CameraFrameSource,
  type CameraIntrinsicProfileV1,
  type CameraLease
} from './camera-source.js';
import {
  assertCameraIntrinsics,
  CalibrationProfileError,
  parseCalibrationProfile,
  type CameraIntrinsicsV1
} from './profile.js';
export type {
  BoardPoseOptions,
  BoardScaleSource,
  CalibrationErrorCode,
  CalibrationStartOptions,
  CalibrationState
} from './contract.js';
import type {
  BoardPoseOptions,
  CalibrationErrorCode,
  CalibrationStartOptions,
  CalibrationState
} from './contract.js';
import {MINIMUM_POSE_SPREAD, poseSpread} from './pose.js';
import type {
  CalibrationBackendFactory,
  CalibrationBackendPort,
  CalibrationBoard,
  CalibrationSample
} from './types.js';

/** The document a measured pose is reported as. */
const BOARD_POSE_SCHEMA = 'twcc/board-pose';

const MINIMUM_SAMPLES = 8;
const MAXIMUM_SAMPLES = 40;
const MINIMUM_SAMPLE_QUALITY = 0.2;
const MINIMUM_NORMALIZED_NOVELTY = 0.015;

/**
 * The share of samples held back from the fit, to be reprojected afterwards.
 *
 * A solve's own reprojection error says how well the answer reproduces the
 * samples that produced it. With few samples for the number of parameters an
 * overfitted answer scores well on exactly that, so some views are kept out of
 * the fit and scored separately. The two agreeing is the evidence; the two
 * disagreeing says the set was too small or too alike.
 *
 * Never at the cost of the minimum: if holding views back would leave fewer
 * than MINIMUM_SAMPLES to fit, fewer are held back, and none at all rather than
 * a fit that is weaker than the one the operator was promised.
 */
const HOLDOUT_FRACTION = 0.2;

/** Codes a profile validation can produce, and therefore can clear. */
const PROFILE_ERROR_CODES: ReadonlySet<string> = new Set([
  'invalid-calibration',
  'credential-forbidden',
  'calibration-not-applicable'
]);

export interface CameraCalibrationControllerOptions {
  runtime: TurboWarpRuntime;
  backend: CalibrationBackendFactory;
  nowMilliseconds?: () => number;
}

interface CalibrationSession {
  readonly calibrationId: string;
  readonly board: CalibrationBoard;
  readonly maximumReprojectionErrorPx: number;
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly deviceId: string;
  readonly previewFlip: string;
}

/**
 * One camera's calibration. Every shared camera gets its own instance so that
 * calibrating one camera never disturbs another camera's session or lease.
 */
class CameraCalibration {
  private session: CalibrationSession | undefined;
  private lease: CameraLease | undefined;
  private samples: CalibrationSample[] = [];
  private acquiring: Promise<void> | undefined;
  private sampling: Promise<void> | undefined;
  private solving: Promise<void> | undefined;
  private profile: CameraIntrinsicsV1 | undefined;
  private boardPose: string = '';
  private sessionSampleCount = 0;
  private sampleQuality = 0;
  private reprojectionError = 0;
  private holdoutError = 0;
  private holdoutCount = 0;
  private calibrationState: CalibrationState = 'idle';
  private calibrationErrorCode: CalibrationErrorCode = '';
  private calibrationErrorMessage = '';
  private operation = 0;

  public constructor(
    public readonly cameraId: string,
    private readonly runtime: TurboWarpRuntime,
    private readonly resolveBackend: () => Promise<CalibrationBackendPort>,
    private readonly nowMilliseconds: () => number
  ) {}

  public async start(options: CalibrationStartOptions): Promise<void> {
    // Validate before cancelling. A mistyped board must not cost the caller the
    // session and the samples it already collected.
    let normalized: CalibrationStartOptions;
    try {
      normalized = normalizeStartOptions(options);
    } catch (error) {
      this.refuse('invalid-board', error instanceof Error ? error.message : String(error));
    }
    await this.cancel();
    const acquiring = this.acquireSession(normalized);
    this.acquiring = acquiring;
    const clear = () => {
      if (this.acquiring === acquiring) this.acquiring = undefined;
    };
    void acquiring.then(clear, clear);
    await acquiring;
  }

  private async acquireSession(normalized: CalibrationStartOptions): Promise<void> {
    const operation = ++this.operation;
    this.calibrationState = 'acquiring-camera';
    this.clearError();
    let lease: CameraLease;
    try {
      lease = await requireCameraSource(this.runtime).acquireCamera({
        owner: CALIBRATION_LEASE_OWNER,
        cameraId: normalized.cameraId
      });
    } catch (error) {
      this.fail(
        error instanceof CameraSourceError ? error.code : 'camera-unavailable',
        error
      );
    }
    if (operation !== this.operation) {
      // A cancel arrived while the camera was starting. The lease belongs to
      // nobody now, so release it instead of retaining an orphan.
      await lease.release();
      return;
    }
    let frame: CameraFrameSource;
    try {
      frame = requireVideoFrame(lease);
    } catch (error) {
      await lease.release();
      this.fail('camera-ended', error);
    }
    this.session = {
      calibrationId: normalized.calibrationId,
      board: normalized.board,
      maximumReprojectionErrorPx: normalized.maximumReprojectionErrorPx,
      imageWidth: frame.width,
      imageHeight: frame.height,
      deviceId: frame.deviceId,
      previewFlip: frame.previewFlip
    };
    this.lease = lease;
    this.samples = [];
    this.sessionSampleCount = 0;
    this.sampleQuality = 0;
    this.reprojectionError = 0;
    this.holdoutError = 0;
    this.holdoutCount = 0;
    this.calibrationState = 'ready';
  }

  public addSample(): Promise<void> {
    if (this.sampling) return this.sampling;
    if (!this.session || !this.lease || this.calibrationState !== 'ready') {
      throw new Error(`Camera ${this.cameraId} calibration is not ready to sample.`);
    }
    const sampling = this.captureSample(this.operation);
    this.sampling = sampling;
    const clear = () => {
      if (this.sampling === sampling) this.sampling = undefined;
    };
    void sampling.then(clear, clear);
    return sampling;
  }

  public solve(): Promise<void> {
    if (this.solving) return this.solving;
    if (!this.session || !this.lease || this.calibrationState !== 'ready') {
      throw new Error(`Camera ${this.cameraId} calibration is not ready to solve.`);
    }
    if (this.samples.length < MINIMUM_SAMPLES) {
      this.reject('sample-insufficient', `At least ${MINIMUM_SAMPLES} accepted samples are required.`);
    }
    // Refused here rather than at capture time. A sample taken at a tilt some
    // other sample already has is not a wasted sample -- it still constrains
    // the principal point and the distortion. What cannot be solved from is a
    // whole set that never varied, and that is only knowable once the set is
    // complete.
    const spread = poseSpread(this.samples, this.session.board);
    if (spread < MINIMUM_POSE_SPREAD) {
      this.reject(
        'sample-poses-degenerate',
        `The board was held at nearly the same angle throughout (spread ${spread.toFixed(3)}, at least ${MINIMUM_POSE_SPREAD} is required). Tilt it between samples; moving it sideways does not separate focal length from distance.`
      );
    }
    const solving = this.solveSession(this.operation);
    this.solving = solving;
    const clear = () => {
      if (this.solving === solving) this.solving = undefined;
    };
    void solving.then(clear, clear);
    return solving;
  }

  public async cancel(): Promise<void> {
    this.operation += 1;
    if (this.lease || this.acquiring || this.sampling || this.solving) {
      this.calibrationState = 'cancelling';
    }
    // The acquisition is awaited too, so that a start racing this cancel has
    // handed its lease back by the time cancel resolves.
    const pending = [this.acquiring, this.sampling, this.solving].filter(isPromise);
    const lease = this.lease;
    this.lease = undefined;
    this.session = undefined;
    await Promise.allSettled(pending);
    await lease?.release();
    this.samples = [];
    this.sessionSampleCount = 0;
    this.sampleQuality = 0;
    this.reprojectionError = 0;
    this.holdoutError = 0;
    this.holdoutCount = 0;
    this.calibrationState = 'idle';
    this.clearError();
  }

  public async cleanup(): Promise<void> {
    await this.cancel();
    this.profile = undefined;
    this.boardPose = '';
  }

  /**
   * Measures where the board is, once it is where it is going to stay.
   *
   * Deliberately not part of a calibration session. A calibration needs the
   * board to move -- a set collected without that cannot separate focal length
   * from distance, and solving is refused -- so while one is being collected
   * there is no single position to report. This takes its own camera lease,
   * reads one frame, and gives it straight back.
   */
  public async measureBoardPose(options: BoardPoseOptions): Promise<void> {
    const profile = this.profile;
    if (!profile) {
      this.refuse(
        'not-calibrated',
        `Camera ${this.cameraId} has no calibration profile, so nothing can say where the board is.`
      );
    }
    const board = normalizeBoard(options.board);
    let lease: CameraLease;
    try {
      lease = await requireCameraSource(this.runtime).acquireCamera({
        owner: CALIBRATION_LEASE_OWNER,
        cameraId: this.cameraId
      });
    } catch (error) {
      this.refuseWith(
        error instanceof CameraSourceError ? error.code : 'camera-unavailable',
        error
      );
    }
    try {
      const frame = requireVideoFrame(lease);
      const backend = await this.resolveBackend();
      const pose = await backend.measurePose(
        {element: frame.element, width: frame.width, height: frame.height},
        board,
        {
          intrinsicMatrix: profile.intrinsicMatrix,
          distortionModel: profile.distortionModel,
          distortionCoefficients: profile.distortionCoefficients,
          reprojectionErrorPx: profile.quality?.reprojectionErrorPx ?? 0
        }
      );
      if (!pose) {
        this.refuse(
          'board-pose-unavailable',
          'The board is not in the frame, or too little of it is.'
        );
      }
      this.boardPose = JSON.stringify({
        schema: BOARD_POSE_SCHEMA,
        version: 1,
        cameraId: this.cameraId,
        intrinsicProfileId: profile.calibrationId,
        imageWidth: frame.width,
        imageHeight: frame.height,
        board: {
          columns: board.columns,
          rows: board.rows,
          squareSizeMeters: board.squareSizeMeters,
          markerSizeMeters: board.markerSizeMeters
        },
        // Carried, not implied. See BoardScaleSource.
        scaleSource: options.scaleSource,
        cameraFromBoard: {
          rotation: pose.rotation,
          translationMeters: pose.translationMeters
        },
        cornerCount: pose.cornerCount,
        reprojectionErrorPx: pose.reprojectionErrorPx,
        observedPoints: pose.observedPoints,
        measuredAt: new Date(this.nowMilliseconds()).toISOString()
      });
      this.clearError();
    } finally {
      await lease.release();
    }
  }

  /** The last measured board pose, or an empty string when none was taken. */
  public boardPoseJson(): string {
    return this.boardPose;
  }

  public async importProfile(json: string): Promise<void> {
    let profile: CameraIntrinsicsV1;
    try {
      profile = parseCalibrationProfile(json);
    } catch (error) {
      this.failValidation(error);
    }
    if (profile.cameraId !== this.cameraId) {
      this.failValidation(
        new CalibrationApplicabilityError(
          `The profile calibrates camera ${profile.cameraId} and cannot be applied to camera ${this.cameraId}.`
        )
      );
    }
    const session = this.session;
    if (
      session &&
      (session.imageWidth !== profile.imageWidth || session.imageHeight !== profile.imageHeight)
    ) {
      this.failValidation(
        new CalibrationApplicabilityError(
          `The profile calibrates ${profile.imageWidth}x${profile.imageHeight}, but camera ${this.cameraId} is capturing ${session.imageWidth}x${session.imageHeight}.`
        )
      );
    }
    await this.cancel();
    this.profile = profile;
    this.reprojectionError = profile.quality?.reprojectionErrorPx ?? 0;
    this.sessionSampleCount = profile.quality?.sampleCount ?? 0;
    this.calibrationState = 'solved';
  }

  public validateProfile(json: string): boolean {
    try {
      parseCalibrationProfile(json);
      // Only a previous validation failure is answered here. A session
      // diagnostic, such as a refused solve, is not resolved by some other
      // JSON turning out to be valid.
      if (PROFILE_ERROR_CODES.has(this.calibrationErrorCode)) this.clearError();
      return true;
    } catch (error) {
      this.recordError(errorCodeFor(error), error);
      return false;
    }
  }

  /** Hands the solved profile to Camera Source, which owns the contract. */
  public async publishProfile(): Promise<void> {
    const profile = this.profile;
    // Publishing is not a session operation. A refused publication records its
    // code and leaves the calibration state alone: a solved profile that Camera
    // Source could not accept is still solved, and a session that already
    // failed is not repaired by asking to publish.
    if (!profile) {
      this.refuse('not-calibrated', `Camera ${this.cameraId} has no calibration profile to publish.`);
    }
    let registry;
    try {
      registry = requireProfileRegistry(this.runtime);
    } catch (error) {
      this.refuseWith(errorCodeFor(error), error);
    }
    let document: CameraIntrinsicProfileV1;
    try {
      document = toCameraSourceProfile(profile);
    } catch (error) {
      this.refuseWith(errorCodeFor(error), error);
    }
    let result;
    try {
      result = registry.registerProfile(document);
    } catch (error) {
      this.refuseWith('publish-failed', error);
    }
    // A registry that answers rather than throws is the normal path: Camera
    // Source validates the document and reports which member it objected to.
    // Reading only the thrown case would record a refusal as a success.
    if (!result.ok) {
      this.refuseWith(
        'publish-failed',
        new Error(
          `Camera Source refused the profile: ${result.error?.code ?? 'unknown'} at ${result.error?.path || '/'} -- ${result.error?.message ?? 'no detail reported'}`
        )
      );
    }
    this.clearError();
  }

  public state(): CalibrationState {
    return this.calibrationState;
  }

  public ready(): boolean {
    return this.calibrationState === 'ready';
  }

  public sampleCount(): number {
    return this.sessionSampleCount;
  }

  public latestSampleQuality(): number {
    return this.sampleQuality;
  }

  public latestReprojectionError(): number {
    return this.reprojectionError;
  }

  /** RMS reprojection over views the fit never saw. Zero when none were held. */
  public latestHoldoutError(): number {
    return this.holdoutError;
  }

  /** How many views were held back. Zero means nothing was validated. */
  public holdoutSampleCount(): number {
    return this.holdoutCount;
  }

  /** How varied the collected tilts are. Zero until a second sample lands. */
  public poseSpread(): number {
    const session = this.session;
    return session ? poseSpread(this.samples, session.board) : 0;
  }

  public errorCode(): CalibrationErrorCode {
    return this.calibrationErrorCode;
  }

  public errorMessage(): string {
    return this.calibrationErrorMessage;
  }

  public profileJson(): string {
    return this.profile ? JSON.stringify(this.profile) : '';
  }

  private async captureSample(operation: number): Promise<void> {
    const session = this.session;
    const lease = this.lease;
    if (!session || !lease) return;
    if (this.samples.length >= MAXIMUM_SAMPLES) {
      this.reject('sample-limit', `At most ${MAXIMUM_SAMPLES} samples may be retained.`);
    }
    this.calibrationState = 'sampling';
    let frame: CameraFrameSource;
    try {
      frame = requireVideoFrame(lease);
    } catch (error) {
      // The device went away mid-session. Release before reporting so that a
      // disconnected camera cannot strand a lease other consumers share.
      await this.releaseSession();
      this.fail('camera-ended', error);
    }
    if (frame.width !== session.imageWidth || frame.height !== session.imageHeight) {
      this.reject(
        'resolution-mismatch',
        `Expected ${session.imageWidth}x${session.imageHeight}, received ${frame.width}x${frame.height}.`
      );
    }
    if (frame.deviceId !== session.deviceId || frame.previewFlip !== session.previewFlip) {
      this.reject(
        'capture-condition-mismatch',
        `The capture conditions changed after the session started. Restart the calibration for camera ${this.cameraId}.`
      );
    }
    let sample: CalibrationSample | undefined;
    try {
      const backend = await this.resolveBackend();
      sample = await backend.captureSample(
        {element: frame.element, width: frame.width, height: frame.height},
        session.board
      );
    } catch (error) {
      this.fail('sample-failed', error);
    }
    if (operation !== this.operation) return;
    if (!sample) this.reject('board-not-found', 'The complete chessboard was not found.');
    // A view need not show the whole board. The markers name each corner, so a
    // board running off the edge of the frame still contributes what it shows,
    // and those corners are near the image border -- which is where the
    // principal point and the distortion are decided.
    if (
      sample.corners.length !== sample.ids.length ||
      !Number.isFinite(sample.quality) ||
      sample.quality < MINIMUM_SAMPLE_QUALITY
    ) {
      this.reject('sample-low-quality', `Sample quality must be at least ${MINIMUM_SAMPLE_QUALITY}.`);
    }
    const accepted = sample;
    if (
      this.samples.some(
        (previous) =>
          normalizedCornerDistance(previous, accepted, session.imageWidth, session.imageHeight) <
          MINIMUM_NORMALIZED_NOVELTY
      )
    ) {
      this.reject('sample-too-similar', 'Move or tilt the board before capturing another sample.');
    }
    this.samples.push(accepted);
    this.sessionSampleCount = this.samples.length;
    this.sampleQuality = accepted.quality;
    this.calibrationState = 'ready';
    this.clearError();
  }

  private async solveSession(operation: number): Promise<void> {
    const session = this.session;
    const lease = this.lease;
    if (!session || !lease) return;
    this.calibrationState = 'solving';
    const {fitted, heldOut} = splitForValidation(this.samples);
    let solution;
    let holdoutError = 0;
    try {
      const backend = await this.resolveBackend();
      solution = await backend.solve(
        fitted,
        session.board,
        session.imageWidth,
        session.imageHeight
      );
      holdoutError = await backend.validate(heldOut, session.board, solution);
    } catch (error) {
      this.fail('solve-failed', error);
    }
    if (operation !== this.operation) return;
    this.reprojectionError = solution.reprojectionErrorPx;
    this.holdoutError = holdoutError;
    this.holdoutCount = heldOut.length;
    if (
      !Number.isFinite(this.reprojectionError) ||
      this.reprojectionError > session.maximumReprojectionErrorPx
    ) {
      this.calibrationState = 'ready';
      this.reject(
        'reprojection-too-high',
        `Reprojection RMS ${this.reprojectionError} px exceeds ${session.maximumReprojectionErrorPx} px.`
      );
    }
    const sampleCount = this.samples.length;
    let profile: CameraIntrinsicsV1;
    try {
      profile = assertCameraIntrinsics({
        schema: 'camerasource/camera-intrinsics',
        version: 1,
        calibrationId: session.calibrationId,
        cameraId: this.cameraId,
        cameraModel: 'pinhole',
        imageWidth: session.imageWidth,
        imageHeight: session.imageHeight,
        imageState: 'raw',
        intrinsicMatrix: solution.intrinsicMatrix,
        distortionModel: solution.distortionModel,
        distortionCoefficients: solution.distortionCoefficients,
        quality: {sampleCount, reprojectionErrorPx: solution.reprojectionErrorPx},
        calibratedAt: new Date(this.nowMilliseconds()).toISOString()
      });
    } catch (error) {
      this.fail('invalid-calibration', error);
    }
    this.profile = profile;
    this.sessionSampleCount = sampleCount;
    this.samples = [];
    this.lease = undefined;
    this.session = undefined;
    // The solve is complete whether or not Camera Source can complete the
    // release, so record it before handing the lease back.
    this.calibrationState = 'solved';
    this.clearError();
    await lease.release();
  }

  /** Drops the session and releases its lease without touching diagnostics. */
  private async releaseSession(): Promise<void> {
    const lease = this.lease;
    this.lease = undefined;
    this.session = undefined;
    this.samples = [];
    await lease?.release();
  }

  /** Refuses a session step and returns the live session to `ready`. */
  private reject(code: CalibrationErrorCode, message: string): never {
    if (this.calibrationState !== 'ready' && this.lease) this.calibrationState = 'ready';
    this.refuse(code, message);
  }

  /** Records why an operation was refused, without touching the state. */
  private refuse(code: CalibrationErrorCode, message: string): never {
    this.calibrationErrorCode = code;
    this.calibrationErrorMessage = `${code}: ${message}`;
    throw new Error(this.calibrationErrorMessage);
  }

  private refuseWith(code: CalibrationErrorCode, cause: unknown): never {
    this.recordError(code, cause);
    throw new Error(this.calibrationErrorMessage, {cause});
  }

  private fail(code: CalibrationErrorCode, cause: unknown): never {
    this.calibrationState = 'error';
    this.recordError(code, cause);
    throw new Error(this.calibrationErrorMessage, {cause});
  }

  /** Reports a rejected profile without disturbing the session or the state. */
  private failValidation(error: unknown): never {
    this.refuseWith(errorCodeFor(error), error);
  }

  private recordError(code: CalibrationErrorCode, cause: unknown): void {
    const detail = cause instanceof Error ? cause.message : String(cause);
    this.calibrationErrorCode = code;
    this.calibrationErrorMessage = `${code}: ${detail}`;
  }

  private clearError(): void {
    this.calibrationErrorCode = '';
    this.calibrationErrorMessage = '';
  }
}

/**
 * Routes calibration blocks to one `CameraCalibration` per shared camera and
 * owns the solver, which is created on first use and never at load time.
 */
export class CameraCalibrationController {
  private readonly cameras = new Map<string, CameraCalibration>();
  private readonly runtime: TurboWarpRuntime;
  private readonly backendFactory: CalibrationBackendFactory;
  private readonly nowMilliseconds: () => number;
  private backendPromise: Promise<CalibrationBackendPort> | undefined;

  public constructor(options: CameraCalibrationControllerOptions) {
    this.runtime = options.runtime;
    this.backendFactory = options.backend;
    this.nowMilliseconds = options.nowMilliseconds ?? Date.now;
  }

  public start(options: CalibrationStartOptions): Promise<void> {
    return this.camera(options.cameraId).start(options);
  }

  public addSample(cameraId: string): Promise<void> {
    return this.camera(cameraId).addSample();
  }

  public solve(cameraId: string): Promise<void> {
    return this.camera(cameraId).solve();
  }

  public cancel(cameraId: string): Promise<void> {
    return this.existing(cameraId)?.cancel() ?? Promise.resolve();
  }

  public cleanup(cameraId: string): Promise<void> {
    return this.existing(cameraId)?.cleanup() ?? Promise.resolve();
  }

  public measureBoardPose(options: BoardPoseOptions): Promise<void> {
    return this.camera(options.cameraId).measureBoardPose(options);
  }

  public boardPoseJson(cameraId: string): string {
    return this.existing(cameraId)?.boardPoseJson() ?? '';
  }

  public importProfile(cameraId: string, json: string): Promise<void> {
    return this.camera(cameraId).importProfile(json);
  }

  public publishProfile(cameraId: string): Promise<void> {
    return this.camera(cameraId).publishProfile();
  }

  public validateProfile(cameraId: string, json: string): boolean {
    return this.camera(cameraId).validateProfile(json);
  }

  /** Releases every lease. Used for project stop, reload, and disposal. */
  public async cancelAll(): Promise<void> {
    await Promise.allSettled([...this.cameras.values()].map((camera) => camera.cancel()));
  }

  /** Releases every lease and forgets every in-memory profile. */
  public async cleanupAll(): Promise<void> {
    await Promise.allSettled([...this.cameras.values()].map((camera) => camera.cleanup()));
    this.cameras.clear();
  }

  public backend(): string {
    return this.backendFactory.name;
  }

  public state(cameraId: string): CalibrationState {
    return this.existing(cameraId)?.state() ?? 'idle';
  }

  public ready(cameraId: string): boolean {
    return this.existing(cameraId)?.ready() ?? false;
  }

  public sampleCount(cameraId: string): number {
    return this.existing(cameraId)?.sampleCount() ?? 0;
  }

  public latestSampleQuality(cameraId: string): number {
    return this.existing(cameraId)?.latestSampleQuality() ?? 0;
  }

  public latestReprojectionError(cameraId: string): number {
    return this.existing(cameraId)?.latestReprojectionError() ?? 0;
  }

  public poseSpread(cameraId: string): number {
    return this.existing(cameraId)?.poseSpread() ?? 0;
  }

  public latestHoldoutError(cameraId: string): number {
    return this.existing(cameraId)?.latestHoldoutError() ?? 0;
  }

  public holdoutSampleCount(cameraId: string): number {
    return this.existing(cameraId)?.holdoutSampleCount() ?? 0;
  }

  public errorCode(cameraId: string): CalibrationErrorCode {
    return this.existing(cameraId)?.errorCode() ?? '';
  }

  public errorMessage(cameraId: string): string {
    return this.existing(cameraId)?.errorMessage() ?? '';
  }

  public profileJson(cameraId: string): string {
    return this.existing(cameraId)?.profileJson() ?? '';
  }

  private existing(cameraId: string): CameraCalibration | undefined {
    return this.cameras.get(cameraId.trim());
  }

  private camera(cameraId: string): CameraCalibration {
    // The lease and the published profile both use the trimmed identifier, so
    // the record is keyed the same way rather than by whatever the caller typed.
    const key = cameraId.trim();
    const existing = this.cameras.get(key);
    if (existing) return existing;
    const created = new CameraCalibration(
      key,
      this.runtime,
      () => this.resolveBackend(),
      this.nowMilliseconds
    );
    this.cameras.set(key, created);
    return created;
  }

  /** Creates the solver once, on the first sample or solve of any camera. */
  private resolveBackend(): Promise<CalibrationBackendPort> {
    this.backendPromise ??= this.backendFactory.create();
    return this.backendPromise;
  }
}

class CalibrationApplicabilityError extends Error {
  public readonly code = 'calibration-not-applicable' as const;
}

function errorCodeFor(error: unknown): CalibrationErrorCode {
  if (error instanceof CalibrationApplicabilityError) return error.code;
  if (error instanceof CalibrationProfileError) return error.code;
  if (error instanceof CameraSourceError) return error.code;
  return 'invalid-calibration';
}

function requireVideoFrame(lease: CameraLease): CameraFrameSource {
  const frame = lease.getFrameSource();
  if (frame.kind !== 'video' || frame.width < 1 || frame.height < 1) {
    throw new Error('Camera Source has no current video frame.');
  }
  return frame;
}

function normalizeBoard(board: CalibrationBoard): CalibrationBoard {
  const columns = integerInRange(board.columns, 3, 20, 'columns');
  const rows = integerInRange(board.rows, 3, 20, 'rows');
  if (
    !Number.isFinite(board.squareSizeMeters) ||
    board.squareSizeMeters <= 0 ||
    board.squareSizeMeters > 1
  ) {
    throw new Error('square size must be within (0, 1] meter.');
  }
  // The marker has to leave white around it inside its square, or the detector
  // cannot separate it from the dark squares it touches.
  if (
    !Number.isFinite(board.markerSizeMeters) ||
    board.markerSizeMeters <= 0 ||
    board.markerSizeMeters >= board.squareSizeMeters
  ) {
    throw new Error('marker size must be greater than zero and smaller than the square size.');
  }
  return {
    columns,
    rows,
    squareSizeMeters: board.squareSizeMeters,
    markerSizeMeters: board.markerSizeMeters
  };
}

function normalizeStartOptions(options: CalibrationStartOptions): CalibrationStartOptions {
  const board = normalizeBoard(options.board);
  if (
    !Number.isFinite(options.maximumReprojectionErrorPx) ||
    options.maximumReprojectionErrorPx <= 0 ||
    options.maximumReprojectionErrorPx > 100
  ) {
    throw new Error('maximum reprojection error must be within (0, 100] px.');
  }
  return {
    cameraId: identifier(options.cameraId, 'camera ID'),
    calibrationId: identifier(options.calibrationId, 'calibration ID'),
    board,
    maximumReprojectionErrorPx: options.maximumReprojectionErrorPx
  };
}

function normalizedCornerDistance(
  left: CalibrationSample,
  right: CalibrationSample,
  width: number,
  height: number
): number {
  let squared = 0;
  for (let index = 0; index < left.corners.length; index += 1) {
    const a = left.corners[index];
    const b = right.corners[index];
    if (!a || !b) return Number.POSITIVE_INFINITY;
    squared += (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
  }
  return Math.sqrt(squared / left.corners.length) / Math.hypot(width, height);
}

function identifier(value: string, label: string): string {
  const text = value.trim();
  if (!/^[A-Za-z0-9._-]{1,64}$/u.test(text)) throw new Error(`invalid ${label}.`);
  return text;
}

function integerInRange(value: number, minimum: number, maximum: number, label: string): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

/**
 * Divides the samples into the ones fitted and the ones kept back.
 *
 * Spread evenly through the order they were captured rather than taken from
 * the end. Samples near each other in time are the ones most likely to share a
 * position, so a hold-out cut from the tail can be the least independent part
 * of the set -- which would make the check read better than it should.
 */
function splitForValidation(samples: readonly CalibrationSample[]): {
  fitted: CalibrationSample[];
  heldOut: CalibrationSample[];
} {
  const holdOut = Math.min(
    Math.floor(samples.length * HOLDOUT_FRACTION),
    samples.length - MINIMUM_SAMPLES
  );
  if (holdOut < 1) return {fitted: [...samples], heldOut: []};
  const step = samples.length / holdOut;
  const chosen = new Set(
    Array.from({length: holdOut}, (_, index) =>
      Math.min(samples.length - 1, Math.floor(index * step + step / 2))
    )
  );
  const fitted: CalibrationSample[] = [];
  const heldOut: CalibrationSample[] = [];
  samples.forEach((sample, index) => {
    (chosen.has(index) ? heldOut : fitted).push(sample);
  });
  return {fitted, heldOut};
}

function isPromise(value: Promise<void> | undefined): value is Promise<void> {
  return value !== undefined;
}
