import {extensionConfig} from './config';
import definitions from './block-definitions.json';

type BlockTypeName = 'COMMAND' | 'REPORTER' | 'BOOLEAN';
type ArgumentTypeName = 'STRING';

interface DefinitionArgument {
  type: ArgumentTypeName;
  defaultValue: string;
}

interface BlockDefinition {
  opcode: string;
  blockType: BlockTypeName;
  text: string;
  description: string;
  arguments: Record<string, DefinitionArgument>;
}

const blockDefinitions = definitions.blocks as readonly BlockDefinition[];
const defaultCameraId = 'default';

/** The state reported before any calibration session exists. */
export const IDLE_CALIBRATION_STATE = 'idle';

function normalizeId(value: unknown, fallback = defaultCameraId): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export class CameraCalibrationExtension implements TurboWarpExtension {
  public getInfo(): Record<string, unknown> {
    return {
      id: extensionConfig.id,
      name: Scratch.translate(definitions.extensionName),
      docsURI: extensionConfig.docsURI,
      blockIconURI: extensionConfig.blockIconURI,
      blocks: blockDefinitions.map((block) => this.toScratchBlock(block))
    };
  }

  public cameraCalibrationState(args: {CAMERA_ID?: unknown} = {}): string {
    // The calibration session is not implemented yet. Every camera reports idle
    // so that a project can branch on the state before the procedure lands.
    void normalizeId(args.CAMERA_ID);
    return IDLE_CALIBRATION_STATE;
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
