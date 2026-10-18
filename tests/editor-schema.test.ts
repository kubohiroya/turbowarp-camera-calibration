import {readFileSync,readdirSync} from 'node:fs';
import {expect,it} from 'vitest';
import {compileSchemaBundle,validateSchemaInput} from '@kubohiroya/turbowarp-extension-data-editor/schema';
import {calibrationSchemaBundles,decodeCalibrationSource,validateCalibrationInput} from '../src/editor-schema.js';
import {parseCalibrationProfile} from '../src/calibration/profile.js';
import {serializeCameraInfoYaml} from '@kubohiroya/turbowarp-camera-source/profile';
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
 compare(JSON.stringify(profile));const source=serializeCameraInfoYaml(profile);compare(source);expect(decodeCalibrationSource(source)).toHaveProperty('data.camera_matrix');
 const fisheye={...profile,distortion:{model:'kannala-brandt' as const,coefficients:[0,0,0,0]}};compare(JSON.stringify(fisheye));compare(serializeCameraInfoYaml(fisheye));
});
