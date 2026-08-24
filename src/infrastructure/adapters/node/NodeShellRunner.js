/**
 * @fileoverview Node.js implementation of the shell command runner (Streaming Only)
 */

import { spawn } from 'node:child_process';
import { RunnerResultSchema } from '../../../ports/RunnerResultSchema.js';
import { SessionRunnerResultSchema } from '../../../ports/SessionRunnerResultSchema.js';
import { DEFAULT_MAX_STDERR_SIZE } from '../../../ports/RunnerOptionsSchema.js';
import EnvironmentPolicy from '../../../domain/services/EnvironmentPolicy.js';
import BoundedTextCollector from '../../BoundedTextCollector.js';
import FailedSessionRunnerResult from '../../FailedSessionRunnerResult.js';

/**
 * Executes shell commands using Node.js spawn and always returns a stream.
 */
export default class NodeShellRunner {
  /**
   * Opens a long-lived duplex command session.
   * @type {import('../../../ports/CommandSessionRunnerPort.js').CommandSessionRunner}
   */
  async open({ command, args, cwd, timeout, maxStderrBytes, env: envOverrides }) {
    const baseEnv = EnvironmentPolicy.filter(globalThis.process?.env || {});
    const env = envOverrides
      ? { ...baseEnv, ...EnvironmentPolicy.filterOverrides(envOverrides) }
      : baseEnv;
    let child;
    try {
      child = spawn(command, args, { cwd, env });
    } catch (error) {
      return new FailedSessionRunnerResult(error);
    }
    const stderrPromise = new BoundedTextCollector(maxStderrBytes)
      .collect(child.stderr)
      .catch((error) => `[stderr collection failed: ${error.message}]`);
    let inputError = null;
    let terminated = false;
    let timedOut = false;
    let timeoutId;

    child.stdin.on('error', (error) => {
      inputError ??= error;
    });

    const finished = new Promise((resolve) => {
      let settled = false;
      const settle = async (code, signal, error = null) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({
          code: code ?? 1,
          error,
          signal,
          stderr: await stderrPromise,
          terminated,
          timedOut,
        });
      };
      child.once('error', (error) => void settle(1, null, error));
      child.once('close', (code, signal) => void settle(code, signal));
    });

    if (typeof timeout === 'number' && timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, timeout);
    }

    return SessionRunnerResultSchema.parse({
      stdoutStream: child.stdout,
      finished,
      write: async (bytes) => {
        if (inputError !== null) {
          throw inputError;
        }
        if (child.stdin.destroyed || !child.stdin.writable) {
          throw new Error('Command session input is not writable');
        }
        await new Promise((resolve, reject) => {
          child.stdin.write(bytes, (error) => {
            const failure = error ?? inputError;
            if (failure !== null) {
              reject(failure);
              return;
            }
            resolve();
          });
        });
      },
      closeInput: async () => {
        if (child.stdin.destroyed || child.stdin.writableEnded) {
          if (inputError !== null) {
            throw inputError;
          }
          return;
        }
        await new Promise((resolve, reject) => {
          const onError = (error) => {
            child.stdin.off('finish', onFinish);
            reject(error);
          };
          const onFinish = () => {
            child.stdin.off('error', onError);
            resolve();
          };
          child.stdin.once('error', onError);
          child.stdin.once('finish', onFinish);
          child.stdin.end();
        });
      },
      terminate: () => {
        terminated = true;
        child.stdin.destroy();
        if (!child.killed) {
          child.kill('SIGTERM');
        }
      },
    });
  }

  /**
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout, env: envOverrides }) {
    // Create a clean environment using Domain Policy
    const baseEnv = EnvironmentPolicy.filter(globalThis.process?.env || {});
    const env = envOverrides
      ? { ...baseEnv, ...EnvironmentPolicy.filterOverrides(envOverrides) }
      : baseEnv;

    const child = spawn(command, args, { cwd, env });

    if (child.stdin) {
      if (input) {
        child.stdin.end(input);
      } else {
        child.stdin.end();
      }
    }

    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      if (stderr.length < DEFAULT_MAX_STDERR_SIZE) {
        stderr += chunk.toString();
      }
    });

    const exitPromise = new Promise((resolve) => {
      let timeoutId;
      if (typeof timeout === 'number' && timeout > 0) {
        timeoutId = setTimeout(() => {
          child.kill();
          resolve({ code: 1, stderr, timedOut: true });
        }, timeout);
      }

      child.on('exit', (code) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({ code: code ?? 1, stderr, timedOut: false });
      });

      child.on('error', (err) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve({ code: 1, stderr: `${stderr}\n${err.message}`, timedOut: false, error: err });
      });
    });

    return RunnerResultSchema.parse({
      stdoutStream: child.stdout,
      exitPromise,
    });
  }
}
