/**
 * @fileoverview Deno implementation of the shell command runner (Streaming Only)
 */

import { RunnerResultSchema } from '../../../ports/RunnerResultSchema.js';
import { SessionRunnerResultSchema } from '../../../ports/SessionRunnerResultSchema.js';
import EnvironmentPolicy from '../../../domain/services/EnvironmentPolicy.js';
import BoundedTextCollector from '../../BoundedTextCollector.js';
import FailedSessionRunnerResult from '../../FailedSessionRunnerResult.js';

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder();

/**
 * Executes shell commands using Deno.Command and always returns a stream.
 */
export default class DenoShellRunner {
  /**
   * Opens a long-lived duplex command session.
   * @type {import('../../../ports/CommandSessionRunnerPort.js').CommandSessionRunner}
   */
  async open({ command, args, cwd, timeout, maxStderrBytes, env: envOverrides }) {
    const baseEnv = EnvironmentPolicy.filter(Deno.env.toObject());
    const env = envOverrides ? { ...baseEnv, ...EnvironmentPolicy.filter(envOverrides) } : baseEnv;
    let child;
    try {
      child = new Deno.Command(command, {
        args,
        cwd,
        env,
        stdin: 'piped',
        stdout: 'piped',
        stderr: 'piped'
      }).spawn();
    } catch (error) {
      return new FailedSessionRunnerResult(error);
    }
    const writer = child.stdin.getWriter();
    const stderrPromise = new BoundedTextCollector(maxStderrBytes)
      .collect(child.stderr)
      .catch((error) => `[stderr collection failed: ${error.message}]`);
    let terminated = false;
    let timedOut = false;
    let timeoutId;
    let inputClosurePromise = null;
    const closeInput = (abort = false) => {
      if (inputClosurePromise === null) {
        inputClosurePromise = abort ? writer.abort() : writer.close();
      }
      return inputClosurePromise;
    };
    const finished = (async () => {
      let status = { code: 1, signal: null };
      let processError = null;
      try {
        status = await child.status;
      } catch (error) {
        processError = error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
      try {
        await closeInput(true);
      } catch (error) {
        // Teardown after a clean exit must not rewrite the process result.
        if (status.code !== 0) {
          processError ??= error;
        }
      }
      return {
        code: status.code === 0 && (processError !== null || timedOut) ? 1 : status.code,
        error: processError,
        signal: status.signal,
        stderr: await stderrPromise,
        terminated,
        timedOut
      };
    })();

    if (typeof timeout === 'number' && timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        void closeInput(true).catch(() => {});
        try {
          child.kill('SIGTERM');
        } catch {
          // The process may already be complete.
        }
      }, timeout);
    }

    return SessionRunnerResultSchema.parse({
      stdoutStream: child.stdout,
      finished,
      write: async (bytes) => await writer.write(bytes),
      closeInput: async () => await closeInput(),
      terminate: () => {
        terminated = true;
        void closeInput(true).catch(() => {});
        try {
          child.kill('SIGTERM');
        } catch {
          // Termination is idempotent.
        }
      }
    });
  }

  /**
   * Executes a command
   * @type {import('../../../ports/CommandRunnerPort.js').CommandRunner}
   */
  async run({ command, args, cwd, input, timeout, env: envOverrides }) {
    // Create a clean environment using Domain Policy
    const baseEnv = EnvironmentPolicy.filter(Deno.env.toObject());
    const env = envOverrides ? { ...baseEnv, ...EnvironmentPolicy.filter(envOverrides) } : baseEnv;

    const cmd = new Deno.Command(command, {
      args,
      cwd,
      env,
      stdin: 'piped', 
      stdout: 'piped',
      stderr: 'piped',
    });

    const child = cmd.spawn();

    if (input && child.stdin) {
      const writer = child.stdin.getWriter();
      writer.write(typeof input === 'string' ? ENCODER.encode(input) : input);
      await writer.close();
    } else if (child.stdin) {
      await child.stdin.close();
    }

    const stderrPromise = (async () => {
      let stderr = '';
      if (child.stderr) {
        for await (const chunk of child.stderr) {
          stderr += DECODER.decode(chunk);
        }
      }
      return stderr;
    })();

    const exitPromise = (async () => {
      let timeoutId;
      const timeoutPromise = new Promise((resolve) => {
        if (timeout) {
          timeoutId = setTimeout(() => {
            try { child.kill("SIGTERM"); } catch { /* ignore */ }
            resolve({ code: 1, stderr: 'Command timed out', timedOut: true });
          }, timeout);
        }
      });

      const completionPromise = (async () => {
        const { code } = await child.status;
        const stderr = await stderrPromise;
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        return { code, stderr, timedOut: false };
      })();

      return Promise.race([completionPromise, timeoutPromise]);
    })();

    return RunnerResultSchema.parse({
      stdoutStream: child.stdout,
      exitPromise
    });
  }
}
