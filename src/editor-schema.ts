import document from '../schemas/camera-intrinsics-v1.schema.json' with {type: 'json'};
import legacy from '../schemas/editor-legacy-input.json' with {type: 'json'};
import type {SchemaBundle, SchemaDocument, SyncOwnerValidator} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {cameraProfileSchemaBundles, decodeCameraProfileSource, readCameraProfileInput} from '@kubohiroya/turbowarp-camera-source/editor-schema';
import {assertCameraIntrinsics, fromCameraSourceProfile, parseCalibrationProfile} from './calibration/profile.js';
export type CalibrationProfileVariant = 'camerasource' | 'twcs' | 'legacy' | 'ros';
function bundle(doc: typeof document | typeof legacy, path: string, variantId: string): SchemaBundle {
  const source={repository:'turbowarp-camera-calibration',path};
  return {identity:{ownerId:'turbowarp-camera-calibration',contractId:'calibration-profile',revision:'parser-v0.14.0',variantId},dialect:'2020-12',
    root:{retrievalUri:doc.$id,document:doc as SchemaDocument,artifact:{role:'canonical-schema',source}},resources:[],
    provenance:{canonicalSources:[source],generatedFiles:[],referenceSchemas:[],generationSources:[]}};
}
export const calibrationSchemaBundles={camerasource:bundle(document,'schemas/camera-intrinsics-v1.schema.json','camerasource'),
  legacy:bundle(legacy,'schemas/editor-legacy-input.json','legacy'),twcs:cameraProfileSchemaBundles.twcs,ros:cameraProfileSchemaBundles.ros} as const;
/** Preserve consumer-specific restrictions, including unsupported fisheye and zero-skew requirements. */
export const validateCalibrationInput: SyncOwnerValidator = data => {
  try {
    if(data&&typeof data==='object'&&Object.hasOwn(data,'image_width')){
      const result=readCameraProfileInput(data);if(!result.ok)throw Error();assertCameraIntrinsics(fromCameraSourceProfile(result.profile));
    }else parseCalibrationProfile(JSON.stringify(data));
    return {kind:'valid',issues:[]};
  }catch{return {kind:'invalid',issues:[{dataPath:'',ruleId:'calibration-owner-input'}]};}
};
export function decodeCalibrationSource(source:string){
  if(source.trim().startsWith('{')){
    const data:unknown=JSON.parse(source);
    if(data&&typeof data==='object'&&'schema' in data&&data.schema==='camerasource/camera-intrinsics')return {source,data,format:'json' as const,variantId:'camerasource' as const};
  }
  return decodeCameraProfileSource(source);
}
