const child_process = require('child_process');
import { checkCommandPolicy } from '../safety/policy';
import { JewelConfig } from '../core/config';

// Retrieve config from process.env
const configStr = process.env.JEWEL_AUDIT_CONFIG;
if (configStr) {
  try {
    const config = JSON.parse(configStr) as JewelConfig;

    const verifyCommand = (command: string, args: any): void => {
      const actualArgs = Array.isArray(args) ? args : [];
      const fullCmd = [command, ...actualArgs].join(' ');
      const result = checkCommandPolicy(fullCmd, config);
      if (!result.allowed) {
        throw new Error(`[Jewel Process Auditor] Command blocked: ${result.reason}`);
      }
    };

    const verifySpawnOptions = (options: any): void => {
      if (!options) return;
      const file = options.file || '';
      const args = Array.isArray(options.args) ? options.args : [];
      let fullCmd = args.join(' ');
      // Ensure the executable itself is included in the command string checked by policy
      if (file) {
        const parts = file.split(/[/\\]/);
        const basename = parts[parts.length - 1].toLowerCase();
        if (!fullCmd.toLowerCase().includes(basename)) {
          fullCmd = `${file} ${fullCmd}`;
        }
      }
      const result = checkCommandPolicy(fullCmd, config);
      if (!result.allowed) {
        throw new Error(`[Jewel Process Auditor] Command blocked: ${result.reason}`);
      }
    };

    // 1. High-level Patch child_process.spawn and spawnSync
    const originalSpawn = child_process.spawn;
    const originalSpawnSync = child_process.spawnSync;

    child_process.spawn = function(command: string, args?: any, options?: any) {
      verifyCommand(command, args);
      return originalSpawn.apply(this, arguments as any);
    };

    child_process.spawnSync = function(command: string, args?: any, options?: any) {
      verifyCommand(command, args);
      return originalSpawnSync.apply(this, arguments as any);
    };

    // 2. Patch ChildProcess.prototype.spawn (async)
    if (child_process.ChildProcess && child_process.ChildProcess.prototype) {
      const originalProtoSpawn = child_process.ChildProcess.prototype.spawn;
      child_process.ChildProcess.prototype.spawn = function(options: any) {
        verifySpawnOptions(options);
        return originalProtoSpawn.apply(this, arguments as any);
      };
    }

    // 3. Patch process.binding('spawn_sync').spawn (sync)
    if (typeof (process as any).binding === 'function') {
      try {
        const spawnSyncBinding = (process as any).binding('spawn_sync');
        if (spawnSyncBinding && typeof spawnSyncBinding.spawn === 'function') {
          const originalSpawnSyncBinding = spawnSyncBinding.spawn;
          spawnSyncBinding.spawn = function(options: any) {
            verifySpawnOptions(options);
            return originalSpawnSyncBinding.apply(this, arguments as any);
          };
        }
      } catch (err) {
        // Ignore binding error if not available or blocked in VM sandbox
      }
    }
  } catch (err) {
    process.stderr.write(`[Jewel Preload Error] Failed to initialize process auditor: ${(err as Error).message}\n`);
  }
}
