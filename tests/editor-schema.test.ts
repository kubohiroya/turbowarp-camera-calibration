import {readFileSync,readdirSync} from 'node:fs';
import {expect,it} from 'vitest';
import {compileSchemaBundle,validateSchemaInput} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {calibrationSchemaBundles,decodeCalibrationSource,validateCalibrationInput} from '../src/editor-schema.js';
import {parseCalibrationProfile} from '../src/calibration/profile.js';
import {serializeCameraInfoYaml} from '@kubohiroya/turbowarp-camera-source/profile';
import {cameraProfileSchemaBundles} from '@kubohiroya/turbowarp-camera-source/editor-schema';
const context={consumerId:'importCameraCalibration',nowMs:0,settings:null};
const compiled=Object.fromEntries(Object.entries(calibrationSchemaBundles).map(([variant,bundle])=>{const r=compileSchemaBundle(bundle);if(r.kind!=='compiled')throw Error(variant);return [variant,r.validator];}));
function compare(source:string){let expected=true;try{parseCalibrationProfile(source);}catch{expected=false;}
 let decoded:ReturnType<typeof decodeCalibrationSource>;try{decoded=decodeCalibrationSource(source);}catch{expect(expected).toBe(false);return;}
 const before=JSON.stringify(decoded.data);expect(validateSchemaInput(compiled[decoded.variantId]!,decoded.data as never,{context,ownerValidate:validateCalibrationInput}).kind==='valid').toBe(expected);expect(JSON.stringify(decoded.data)).toBe(before);expect(decoded.source).toBe(source);
}
it('matches all existing JSON input fixtures and legacy extra-field/coefficient acceptance',()=>{
 const dir=new URL('./fixtures/calibration/',import.meta.url);for(const name of readdirSync(dir))compare(readFileSync(new URL(name,dir),'utf8'));
 const legacy=JSON.parse(readFileSync(new URL('legacy-camera-calibration-v1.json',dir),'utf8'));legacy.extra='preserved';legacy.distortionCoefficients=Array(12).fill(0);compare(JSON.stringify(legacy));compare('');compare('{broken');
});
it('keeps raw ROS/twcs and consumer-specific fisheye rejection',()=>{
 const profile={schema:'twcs/camera-intrinsics' as const,version:1 as const,profileId:'run',cameraId:'camera',calibratedAt:'2026-09-15T04:05:06Z',producer:'fixture',cameraModel:'pinhole' as const,image:{width:800,height:600,undistorted:false},intrinsics:{fx:700,fy:700,cx:400,cy:300,skew:0},distortion:{model:'none' as const,coefficients:[]}};
 compare(JSON.stringify(profile));compare('\ufeff'+JSON.stringify(profile));const source=serializeCameraInfoYaml(profile);compare(source);compare(' '.repeat(65536)+'\n'+source);expect(decodeCalibrationSource(source)).toHaveProperty('data.camera_matrix');
 const fisheye={...profile,distortion:{model:'kannala-brandt' as const,coefficients:[0,0,0,0]}};compare(JSON.stringify(fisheye));compare(serializeCameraInfoYaml(fisheye));
});

import {validateCalibrationSource} from '../src/editor-schema.js';
it('source boundary preserves failure source and safe variant/format diagnostics',()=>{
 for(const source of ['{private malformed','{"schema":"private-unknown"}']) {const result=validateCalibrationSource(source,context);expect(result.source).toBe(source);expect(result.result.kind).toBe('invalid');expect(JSON.stringify(result.result)).not.toContain('private');}
 const source=readFileSync(new URL('./fixtures/calibration/valid-camera-intrinsics-v1.json',import.meta.url),'utf8');expect(validateCalibrationSource(source,context).result.kind).toBe('valid');
});

it('legacy extra keys that resemble ROS fields do not change the input variant', () => {
 const legacy=JSON.parse(readFileSync(new URL('./fixtures/calibration/legacy-camera-calibration-v1.json',import.meta.url),'utf8'));
 for(const extra of [{image_width:800},{image_width:null,camera_matrix:{raw:true}},{image_height:'preserved',distortion_model:'custom'}]){
  const data={...legacy,...extra},source=' \n'+JSON.stringify(data)+'\n';
  expect(()=>parseCalibrationProfile(source)).not.toThrow();
  const result=validateCalibrationSource(source,context);
  expect(result.result.kind).toBe('valid');expect(result.source).toBe(source);
  expect(result).toHaveProperty('variantId','legacy');expect(result).toHaveProperty('data',data);
 }
});

it('all calibration variants retain consumer identity through compile, structure and semantic diagnostics', () => {
 const twcs={schema:'twcs/camera-intrinsics' as const,version:1 as const,profileId:'run',cameraId:'camera',calibratedAt:'2026-09-15T04:05:06Z',producer:'fixture',cameraModel:'pinhole' as const,image:{width:800,height:600,undistorted:false},intrinsics:{fx:700,fy:700,cx:400,cy:300,skew:0},distortion:{model:'none' as const,coefficients:[]}};
 const sources={camerasource:readFileSync(new URL('./fixtures/calibration/valid-camera-intrinsics-v1.json',import.meta.url),'utf8'),legacy:readFileSync(new URL('./fixtures/calibration/legacy-camera-calibration-v1.json',import.meta.url),'utf8'),twcs:JSON.stringify(twcs),ros:serializeCameraInfoYaml(twcs)};
 for(const variant of ['camerasource','legacy','twcs','ros'] as const){
  const bundle=calibrationSchemaBundles[variant],identity={ownerId:'turbowarp-camera-calibration',contractId:'calibration-profile',revision:'parser-v0.14.0',variantId:variant};
  expect(bundle.identity).toEqual(identity);
  const malformed=compileSchemaBundle({...bundle,root:{...bundle.root,document:{type:'not-a-schema-type'}}});
  expect(malformed.kind).toBe('schema-error');expect(malformed.diagnostics[0]?.scope.identity).toEqual(identity);
  const structural=compiled[variant]!.validate(null,context);
  expect(structural.kind).toBe('invalid');expect(structural.diagnostics[0]?.scope).toEqual({identity,consumerId:context.consumerId});
  const decoded=decodeCalibrationSource(sources[variant]);
  const semantic=validateSchemaInput(compiled[variant]!,decoded.data as never,{context,ownerValidate:()=>({kind:'invalid',issues:[{dataPath:'',ruleId:'consumer-rule'}]})});
  expect(semantic.kind).toBe('invalid');expect(semantic.diagnostics[0]?.phase).toBe('semantic');expect(semantic.diagnostics[0]?.scope).toEqual({identity,consumerId:context.consumerId});
 }
 for(const variant of ['twcs','ros'] as const){
  expect(calibrationSchemaBundles[variant].root).toBe(cameraProfileSchemaBundles[variant].root);
  expect(calibrationSchemaBundles[variant].resources).toBe(cameraProfileSchemaBundles[variant].resources);
  expect(calibrationSchemaBundles[variant].provenance).toBe(cameraProfileSchemaBundles[variant].provenance);
  expect(cameraProfileSchemaBundles[variant].identity.contractId).toBe('camera-profile');
 }
});
