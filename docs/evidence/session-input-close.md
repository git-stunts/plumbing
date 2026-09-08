# Node session input closure

Change kind: bug fix. Tracking: [#18](https://github.com/git-stunts/plumbing/issues/18).

## Contract and failure

Closing command-session input must settle after stdin finishes or closes. An
input error rejects the operation; the process result independently determines
whether the command succeeded. Node documents `close` as resource closure and
`finish` as successful completion of the writable flush. Destruction can close a
stream without `finish`: [Node stream events](https://nodejs.org/api/stream.html#event-close).

The former Node adapter waited only for `error` or `finish`. A close-only event
order left `closeInput()` pending even after `session.finished` reported code 0.
Typed Git protocol close operations await this promise, so they could also hang.

## Reproducer and falsification

`test/NodeSessionLifecycle.test.js` supplies a controlled child at the Node spawn
boundary, using real Node writable/readable streams. It starts input closure,
holds the writable final callback, destroys stdin, ends output, and delivers child
completion. One event-loop turn drains stream events and promise continuations;
no elapsed-time wait or timer threshold determines the assertion.

The oracle is the session closure contract, not the implementation's output. The
test confirms that the child exited, stdin was destroyed, and the successful-flush
event did not occur before checking that closure settled. These witnesses make
the injected event ordering explicit.

At regression commit `21630bb`, the Node 20 Docker lane failed the named check
`closeInput must settle after stdin closes and the child has completed`, reporting
`pending` instead of `fulfilled`. Test body: 11 ms; suite: 232 ms. Replaying the
expanded suite against that adapter produced three intended failures: raw input
closure and fast-import closure for child exit codes 0 and 1. The normal-flush and
input-error controls passed. None failed through the test runner's timeout.

Replay the original red revision in a disposable checkout:

```sh
docker compose -p plumbing-session-close-red run --build --rm node-test \
  npm run test:local -- test/NodeSessionLifecycle.test.js
```

## Repair and validation

Input shutdown now listens for `close` as well as `finish` and `error`, and removes
all temporary listeners on every terminal path. It preserves input errors and
leaves exit-code validation to the existing protocol/session completion contract.

The expanded five-test lifecycle suite passes. The focused lifecycle, command
session, shell runner, and real Git protocol suites pass 49 tests. The full
`COMPOSE_PROJECT_NAME=plumbing-session-close npm test` matrix passes:

| Runtime | Result |
| --- | --- |
| Node 20 / Vitest | 236 tests, 31 files |
| Bun | 236 tests |
| Deno | 30 top-level tests, 271 steps |

ESLint, formatting checks on touched JavaScript, and whitespace checks pass.

## Scope and remaining evidence

This failure was found while investigating
[git-warp #878](https://github.com/git-stunts/git-warp/issues/878). Its original
CI timeout lacked operation-level diagnostics, so the historical event ordering
is unknown. The regression proves a concrete hanging lifecycle and its repair;
consumer adoption and the git-warp regression remain separate release evidence.

The test is retained while Node duplex sessions promise completion. Deletion is
appropriate only if that capability is removed or a stronger boundary regression
provably covers the same close-without-finish ordering and error semantics.
