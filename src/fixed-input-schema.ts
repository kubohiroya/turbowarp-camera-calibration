import document from '../schemas/block-editor-fixed-inputs.schema.json' with {type:'json'};
import type {SchemaBundle, SchemaDocument} from '@kubohiroya/turbowarp-extension-data-editor/schema';

/** Canonical fixed field fragments; URI is identity only, never fetched. */
export function fixedInputBundle(opcode: string, argument: string): SchemaBundle {
  const source = {repository:'turbowarp-camera-calibration', path:'schemas/block-editor-fixed-inputs.schema.json', symbol:`#/$defs/${opcode}/properties/${argument}`};
  const definitions = document.$defs as Record<string, {properties: Record<string, SchemaDocument>}>;
  return {identity:{ownerId:'turbowarp-camera-calibration', contractId:'fixed-inputs', revision:'1', variantId:opcode+'.'+argument}, dialect:'2020-12',
    root:{retrievalUri:document.$id, document:definitions[opcode]!.properties[argument]!, artifact:{role:'canonical-schema', source}}, resources:[],
    provenance:{canonicalSources:[source, ...[{"repository": "turbowarp-camera-calibration", "path": "src/calibration/controller.ts", "symbol": "normalizeBoard / normalizeStartOptions / boardMarkerCount"}, {"repository": "turbowarp-camera-calibration", "path": "src/board/aruco.ts", "symbol": "DICT_4X4_50"}, {"repository": "turbowarp-camera-calibration", "path": "src/extension.ts", "symbol": "readScaleSource"}]],
      generatedFiles:[{repository:'turbowarp-camera-calibration', path:'docs/schemas/block-editor-fixed-inputs.schema.json'}],
      generationSources:[{repository:'turbowarp-camera-calibration', path:'scripts/generate-fixed-input-docs.mjs'}], referenceSchemas:[]}};
}
