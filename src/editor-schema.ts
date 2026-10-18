import {
  compileSchemaBundle,
  validateSchemaInput,
} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import type {
  SchemaValidationContext,
  SchemaJsonValue,
  InputDiagnostic,
} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import document from '../schemas/camera-intrinsics-v1.schema.json' with { type: 'json' };
import legacy from '../schemas/editor-legacy-input.json' with { type: 'json' };
import type {
  SchemaBundle,
  SchemaDocument,
  SyncOwnerValidator,
} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {
  cameraProfileSchemaBundles,
  decodeCameraProfileSource,
  readCameraProfileInput,
} from '@kubohiroya/turbowarp-camera-source/editor-schema';
import {
  assertCameraIntrinsics,
  fromCameraSourceProfile,
  parseCalibrationProfile,
} from './calibration/profile.js';
export type CalibrationProfileVariant = 'camerasource' | 'twcs' | 'legacy' | 'ros';
const calibrationIdentity = {
  ownerId: 'turbowarp-camera-calibration',
  contractId: 'calibration-profile',
  revision: 'parser-v0.14.0',
};
function bundle(
  doc: typeof document | typeof legacy,
  path: string,
  variantId: string,
): SchemaBundle {
  const source = { repository: 'turbowarp-camera-calibration', path };
  return {
    identity: {
      ...calibrationIdentity,
      variantId,
    },
    dialect: '2020-12',
    root: {
      retrievalUri: doc.$id,
      document: doc as SchemaDocument,
      artifact: { role: 'canonical-schema', source },
    },
    resources: [],
    provenance: {
      canonicalSources: [source],
      generatedFiles: [],
      referenceSchemas: [],
      generationSources: [],
    },
  };
}
function importedBundle(producer: SchemaBundle): SchemaBundle {
  return {
    ...producer,
    identity: { ...calibrationIdentity, variantId: producer.identity.variantId },
  };
}
export const calibrationSchemaBundles = {
  camerasource: bundle(document, 'schemas/camera-intrinsics-v1.schema.json', 'camerasource'),
  legacy: bundle(legacy, 'schemas/editor-legacy-input.json', 'legacy'),
  twcs: importedBundle(cameraProfileSchemaBundles.twcs),
  ros: importedBundle(cameraProfileSchemaBundles.ros),
} as const;
/** Preserve consumer-specific restrictions, including unsupported fisheye and zero-skew requirements. */
export const validateCalibrationInput: SyncOwnerValidator = (data) => {
  try {
    // JSON profile discriminators take priority over extra keys that resemble ROS fields.
    if (data && typeof data === 'object' && !Object.hasOwn(data, 'schema') && Object.hasOwn(data, 'image_width')) {
      const result = readCameraProfileInput(data);
      if (!result.ok) throw Error();
      assertCameraIntrinsics(fromCameraSourceProfile(result.profile));
    } else parseCalibrationProfile(JSON.stringify(data));
    return { kind: 'valid', issues: [] };
  } catch {
    return { kind: 'invalid', issues: [{ dataPath: '', ruleId: 'calibration-owner-input' }] };
  }
};
export function decodeCalibrationSource(source: string) {
  if (source.trim().startsWith('{')) {
    const data: unknown = JSON.parse(source.trim());
    if (
      data &&
      typeof data === 'object' &&
      'schema' in data &&
      data.schema === 'camerasource/camera-intrinsics'
    )
      return { source, data, format: 'json' as const, variantId: 'camerasource' as const };
  }
  return {...decodeCameraProfileSource(source.trim()), source};
}

const sourceCompilations = Object.fromEntries(
  Object.entries(calibrationSchemaBundles).map(([key, bundle]) => [
    key,
    compileSchemaBundle(bundle),
  ]),
);
/** Safe source boundary: preserve raw input separately from diagnostics and normalized values. */
export function validateCalibrationSource(source: string, context: SchemaValidationContext) {
  let consumerId: string | undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(context, 'consumerId');
    if (descriptor && 'value' in descriptor && typeof descriptor.value === 'string')
      consumerId = descriptor.value;
  } catch {
    /* Leave the consumer unspecified when context cannot be inspected safely. */
  }
  let decoded: ReturnType<typeof decodeCalibrationSource>;
  try {
    decoded = decodeCalibrationSource(source);
  } catch (error) {
    const code =
      error instanceof TypeError && error.message === 'Unrecognized camera profile variant.'
        ? ('variant-unrecognized' as const)
        : ('input-format-invalid' as const);
    const diagnostics: readonly [InputDiagnostic & { phase: 'decode' }] = [
      {
        scope: {
          identity: {
            ...calibrationSchemaBundles.camerasource.identity,
            variantId: 'unrecognized',
          },
          ...(consumerId === undefined ? {} : { consumerId }),
        },
        phase: 'decode',
        code,
        dataPath: '',
      },
    ];
    return { source, result: { kind: 'invalid' as const, diagnostics } };
  }
  const compilation = sourceCompilations[decoded.variantId]!;
  if (compilation.kind !== 'compiled') return { ...decoded, result: compilation };
  return {
    ...decoded,
    result: validateSchemaInput(compilation.validator, decoded.data as SchemaJsonValue, {
      context,
      ownerValidate: validateCalibrationInput,
    }),
  };
}
