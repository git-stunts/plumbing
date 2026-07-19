/**
 * A completed session result used when a runtime cannot spawn the process.
 */
export default class FailedSessionRunnerResult {
  /**
   * @param {unknown} failure
   */
  constructor(failure) {
    const error = failure instanceof Error ? failure : new Error(String(failure));
    this.stdoutStream = new ReadableStream({
      start(controller) {
        controller.close();
      },
    });
    this.finished = Promise.resolve(
      Object.freeze({
        code: 1,
        error,
        signal: null,
        stderr: '',
        terminated: false,
        timedOut: false,
      })
    );
    this.write = async () => {
      throw error;
    };
    this.closeInput = async () => {};
    this.terminate = () => {};
    Object.freeze(this);
  }
}
