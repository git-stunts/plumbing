/**
 * @fileoverview Docker-only safety guard.
 */

export function ensureDocker() {
  if (process.env.GIT_STUNTS_DOCKER !== '1' && !process.env.GITHUB_ACTIONS) {
    console.error('\n\n' +
      '============================================================\n' +
      '🚫 CRITICAL SAFETY ERROR: HOST EXECUTION PROHIBITED\n' +
      '============================================================\n' +
      '\n' +
      'This project manipulates Git internals and performs heavy \n' +
      'benchmarking that can corrupt your repository or system.\n' +
      '\n' +
      'YOU MUST RUN TESTS AND BENCHMARKS INSIDE DOCKER.\n' +
      '\n' +
      'Run: docker-compose run --rm test\n' +
      '============================================================\n');
    process.exit(1);
  }
}
