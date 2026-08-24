/**
 * @fileoverview Bun implementation of the shell command runner (Streaming Only)
 */

import { RunnerResultSchema } from '../../../ports/RunnerResultSchema.js';
import { SessionRunnerResultSchema } from '../../../ports/SessionRunnerResultSchema.js';
import EnvironmentPolicy from '../../../domain/services/EnvironmentPolicy.js';
import BoundedTextCollector from '../../BoundedTextCollector.js';
import FailedSessionRunnerResult from '../../FailedSessionRunnerResult.js';

/**
 * Executes shell commands using Bun.spawn and always returns a stream.
 */
export default class BunShellRunner {
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
      child = Bun.spawn([command, ...args], {
        cwd,
        env,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
      });
    } catch (error) {
      return new FailedSessionRunnerResult(error);
    }
    const stderrPromise = new BoundedTextCollector(maxStderrBytes)
      .collect(child.stderr)
      .catch((error) => `[stderr collection failed: ${error.message}]`);
    let terminated = false;
    let timedOut = false;
    let timeoutId;
    const finished = (async () => {
      try {
        const code = await child.exited;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        return {
          code,
          signal: null,
          stderr: await stderrPromise,
          terminated,
          timedOut,
        };
      } catch (error) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }
        return {
          code: 1,
          error,
          signal: null,
          stderr: await stderrPromise,
          terminated,
          timedOut,
        };
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    })();

    if (typeof timeout === 'number' && timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        try {
          child.kill();
        } catch {
          // The process may have exited between the timer and this callback.
        }
      }, timeout);
    }

    return SessionRunnerResultSchema.parse({
      stdoutStream: child.stdout,
      finished,
      write: async (bytes) => {
        child.stdin.write(bytes);
        await child.stdin.flush();
      },
      closeInput: async () => {
        child.stdin.end();
      },
      terminate: () => {
        terminated = true;
        try {
          child.stdin.end();
        } catch {
          // Input may already be closed after an early process exit.
        }
        try {
          child.kill('SIGTERM');
        } catch {
          // Termination is idempotent.
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

    const process = Bun.spawn([command, ...args], {
      cwd,
      env,
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    if (input) {
      process.stdin.write(input);
      process.stdin.end();
    } else {
      process.stdin.end();
    }

    const exitPromise = (async () => {
      let timeoutId;
      const timeoutPromise =
        timeout && timeout > 0
          ? new Promise((resolve) => {
              timeoutId = setTimeout(() => {
                try {
                  process.kill();
                } catch {
                  /* ignore */
                }
                resolve({ code: 1, stderr: 'Command timed out', timedOut: true });
              }, timeout);
            })
          : null;

      const completionPromise = (async () => {
        const code = await process.exited;
        const stderr = await new Response(process.stderr).text();
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        return { code, stderr, timedOut: false };
      })();

      if (!timeoutPromise) {
        return completionPromise;
      }

      return Promise.race([completionPromise, timeoutPromise]);
    })();

    return RunnerResultSchema.parse({
      stdoutStream: process.stdout,
      exitPromise,
    });
  }
}
