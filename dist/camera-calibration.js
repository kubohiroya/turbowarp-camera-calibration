// Name: TurboWarp-Camera-Calibration
// ID: kubohiroyacameracalibration
// Description: Calibrate a shared Camera Source camera and publish its intrinsic calibration profile.
// By: Hiroya Kubo
// License: MPL-2.0

(function (Scratch) {
  'use strict';

  //#region src/config.ts
  var extensionConfig = {
  	id: "kubohiroyacameracalibration",
  	slug: "camera-calibration",
  	name: "TurboWarp-Camera-Calibration",
  	description: "Calibrate a shared Camera Source camera and publish its intrinsic calibration profile.",
  	author: "Hiroya Kubo",
  	license: "MPL-2.0",
  	unsandboxed: true,
  	docsURI: "https://kubohiroya.github.io/turbowarp-camera-calibration/",
  	blockIconURI: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiByeD0iNCIgZmlsbD0iI2ZmZmZmZiIgc3Ryb2tlPSIjNEM5N0ZGIiBzdHJva2Utd2lkdGg9IjIiLz48ZyBmaWxsPSIjNEM5N0ZGIj48cmVjdCB4PSI2IiB5PSI2IiB3aWR0aD0iOSIgaGVpZ2h0PSI5Ii8+PHJlY3QgeD0iMjQiIHk9IjYiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiLz48cmVjdCB4PSIxNSIgeT0iMTUiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiLz48cmVjdCB4PSIzMyIgeT0iMTUiIHdpZHRoPSI5IiBoZWlnaHQ9IjkiLz48cmVjdCB4PSI2IiB5PSIyNCIgd2lkdGg9IjkiIGhlaWdodD0iOSIvPjxyZWN0IHg9IjI0IiB5PSIyNCIgd2lkdGg9IjkiIGhlaWdodD0iOSIvPjxyZWN0IHg9IjE1IiB5PSIzMyIgd2lkdGg9IjkiIGhlaWdodD0iOSIvPjxyZWN0IHg9IjMzIiB5PSIzMyIgd2lkdGg9IjkiIGhlaWdodD0iOSIvPjwvZz48L3N2Zz4="
  };
  var block_definitions_default = {
  	extensionName: "TurboWarp-Camera-Calibration",
  	blocks: [{
  		"opcode": "cameraCalibrationState",
  		"blockType": "REPORTER",
  		"text": "camera calibration state [CAMERA_ID]",
  		"description": "Returns the calibration session state for one shared Camera Source camera. The calibration procedure is not implemented yet, so this reporter always returns idle.",
  		"arguments": { "CAMERA_ID": {
  			"type": "STRING",
  			"defaultValue": "default"
  		} }
  	}]
  };
  //#endregion
  //#region src/extension.ts
  var blockDefinitions = block_definitions_default.blocks;
  var defaultCameraId = "default";
  /** The state reported before any calibration session exists. */
  var IDLE_CALIBRATION_STATE = "idle";
  function normalizeId(value, fallback = defaultCameraId) {
  	return String(value ?? "").trim() || fallback;
  }
  var CameraCalibrationExtension = class {
  	getInfo() {
  		return {
  			id: extensionConfig.id,
  			name: Scratch.translate(block_definitions_default.extensionName),
  			docsURI: extensionConfig.docsURI,
  			blockIconURI: extensionConfig.blockIconURI,
  			blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
  		};
  	}
  	cameraCalibrationState(args = {}) {
  		normalizeId(args.CAMERA_ID);
  		return IDLE_CALIBRATION_STATE;
  	}
  	toScratchBlock(block) {
  		return {
  			opcode: block.opcode,
  			blockType: Scratch.BlockType[block.blockType],
  			text: Scratch.translate(block.text),
  			arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [name, {
  				type: Scratch.ArgumentType[argument.type],
  				defaultValue: argument.defaultValue
  			}]))
  		};
  	}
  };
  //#endregion
  //#region src/index.ts
  if (extensionConfig.unsandboxed && !Scratch.extensions.unsandboxed) throw new Error(`${extensionConfig.name} must run unsandboxed.`);
  Scratch.extensions.register(new CameraCalibrationExtension());
  //#endregion

})(Scratch);
