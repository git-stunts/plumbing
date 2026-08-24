/** Reproducible Docker-only benchmark for typed persistent Git protocol operations. */
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ensureDocker } from '@git-stunts/docker-guard';
import GitPlumbing, { ShellRunnerFactory } from '../index.js';

ensureDocker();

const MAX_BLOB_BATCH_PROTOCOL_BYTES = 64 * 1024 * 1024;
const DEFAULTS = Object.freeze({
  batchSize: 250,
  blobBytes: 4096,
  objectFormat: 'sha256',
  objects: 1000,
  output: null,
  runs: 5,
  warmups: 1,
});

const REF = 'refs/benchmarks/plumbing-protocol-session';
const SCENARIOS = Object.freeze(['fast-import', 'mktree', 'cat-file-info', 'update-ref']);
const STRATEGIES = Object.freeze(['baseline', 'optimized']);

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'plumbing-protocol-benchmark-'));
  try {
    const environment = await inspectEnvironment(root);
    const samples = [];
    const totalRounds = options.warmups + options.runs;
    for (let round = 0; round < totalRounds; round += 1) {
      for (let scenarioIndex = 0; scenarioIndex < SCENARIOS.length; scenarioIndex += 1) {
        const scenario = SCENARIOS[scenarioIndex];
        const order = (round + scenarioIndex) % 2 === 0 ? STRATEGIES : [...STRATEGIES].reverse();
        const witnesses = new Map();
        for (const strategy of order) {
          const sample = await runSample(root, scenario, strategy, options);
          witnesses.set(strategy, sample.identity);
          if (round >= options.warmups) {
            samples.push({ ...sample, run: round - options.warmups + 1 });
          }
        }
        if (witnesses.get('baseline') !== witnesses.get('optimized')) {
          throw new Error(`${scenario} changed Git object identity between strategies`);
        }
      }
    }

    const report = Object.freeze({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      environment,
      parameters: options,
      scenarios: summarize(samples),
      samples,
    });
    const json = `${JSON.stringify(report, null, 2)}\n`;
    if (options.output !== null) {
      fs.writeFileSync(options.output, json);
    }
    process.stdout.write(json);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

async function runSample(root, scenario, strategy, options) {
  const repoPath = fs.mkdtempSync(path.join(root, `${scenario}-${strategy}-`));
  const instrumented = await createInstrumentedPlumbing(repoPath, options.objectFormat);
  const input = createInput(options.objects, options.blobBytes);
  let identity;
  if (scenario === 'cat-file-info' || scenario === 'update-ref') {
    identity = await prepareObjects(instrumented.git, input, options.batchSize);
  } else if (scenario === 'mktree') {
    identity = await instrumented.git.execute({
      args: ['hash-object', '-w', '--stdin'],
      input: 'tree payload',
    });
  }

  const before = instrumented.counters();
  const started = performance.now();
  let result;
  if (scenario === 'fast-import') {
    result = await measureFastImport(instrumented.git, input, strategy, options.batchSize);
  } else if (scenario === 'mktree') {
    result = await measureMktree(
      instrumented.git,
      identity,
      options.objects,
      strategy,
      options.batchSize
    );
  } else if (scenario === 'cat-file-info') {
    result = await measureInfo(instrumented.git, identity, strategy, options.batchSize);
  } else {
    result = await measureUpdateRef(instrumented.git, identity, strategy);
  }
  const elapsedMs = performance.now() - started;
  const after = instrumented.counters();
  if (scenario === 'update-ref') {
    const finalOid = await instrumented.git.execute({ args: ['rev-parse', REF] });
    if (finalOid !== result.at(-1)) {
      throw new Error(`update-ref left ${finalOid} instead of ${result.at(-1)}`);
    }
  }
  const oneShotProcesses = after.oneShotProcesses - before.oneShotProcesses;
  const sessionProcesses = after.sessionProcesses - before.sessionProcesses;
  const stdinWrites = after.stdinWrites - before.stdinWrites;
  const apiCalls =
    strategy === 'baseline' || scenario === 'update-ref'
      ? options.objects
      : scenario === 'fast-import'
        ? stdinWrites - 2
        : stdinWrites;
  return Object.freeze({
    scenario,
    strategy,
    elapsedMs,
    gitProcesses: oneShotProcesses + sessionProcesses,
    oneShotProcesses,
    sessionProcesses,
    stdinWrites,
    apiCalls,
    identity: digestIdentifiers(result),
  });
}

async function measureFastImport(git, input, strategy, batchSize) {
  const writer = await git.openFastImportSession();
  const oids = [];
  try {
    if (strategy === 'baseline') {
      for (const content of input) {
        oids.push(await writer.writeBlob(content));
      }
    } else {
      for (const group of blobWindows(input, batchSize)) {
        oids.push(...(await writer.writeBlobs(group)));
      }
    }
    await writer.checkpoint();
  } finally {
    await writer.close();
  }
  return oids;
}

async function measureMktree(git, blobOid, count, strategy, batchSize) {
  const trees = Array.from({ length: count }, (_, index) => [
    {
      mode: '100644',
      type: 'blob',
      oid: blobOid,
      name: `entry-${String(index).padStart(6, '0')}`,
    },
  ]);
  const writer = await git.openMktreeSession();
  const oids = [];
  try {
    if (strategy === 'baseline') {
      for (const tree of trees) {
        oids.push(await writer.write(tree));
      }
    } else {
      for (const group of windows(trees, batchSize)) {
        oids.push(...(await writer.writeMany(group)));
      }
    }
  } finally {
    await writer.close();
  }
  return oids;
}

async function measureInfo(git, oids, strategy, batchSize) {
  const reader = await git.openCatFileSession();
  const metadata = [];
  try {
    if (strategy === 'baseline') {
      for (const oid of oids) {
        metadata.push(await reader.info(oid));
      }
    } else {
      for (const group of windows(oids, batchSize)) {
        metadata.push(...(await reader.infoMany(group)));
      }
    }
  } finally {
    await reader.close();
  }
  return metadata.map(({ oid }) => oid);
}

async function measureUpdateRef(git, oids, strategy) {
  let expectedOldOid = null;
  if (strategy === 'baseline') {
    for (const newOid of oids) {
      await git.execute({
        args: [
          'update-ref',
          '--no-deref',
          REF,
          newOid,
          expectedOldOid ?? '0'.repeat(newOid.length),
        ],
      });
      expectedOldOid = newOid;
    }
    return oids;
  }

  const writer = await git.openUpdateRefSession();
  try {
    for (const newOid of oids) {
      await writer.update({ ref: REF, newOid, expectedOldOid, noDeref: true });
      expectedOldOid = newOid;
    }
  } finally {
    await writer.close();
  }
  return oids;
}

async function prepareObjects(git, input, batchSize) {
  const writer = await git.openFastImportSession();
  const oids = [];
  try {
    for (const group of blobWindows(input, batchSize)) {
      oids.push(...(await writer.writeBlobs(group)));
    }
    await writer.checkpoint();
  } finally {
    await writer.close();
  }
  return oids;
}

async function createInstrumentedPlumbing(repoPath, objectFormat) {
  const ports = ShellRunnerFactory.createPorts({ env: 'node' });
  let oneShotProcesses = 0;
  let sessionProcesses = 0;
  let stdinWrites = 0;
  const runner = async (options) => {
    oneShotProcesses += 1;
    return await ports.runner(options);
  };
  const sessionRunner = async (options) => {
    sessionProcesses += 1;
    const result = await ports.sessionRunner(options);
    return {
      ...result,
      write: async (bytes) => {
        stdinWrites += 1;
        await result.write(bytes);
      },
    };
  };
  const git = await GitPlumbing.createDefault({
    cwd: repoPath,
    runner,
    sessionRunner,
  });
  await git.execute({ args: ['init', '--bare', `--object-format=${objectFormat}`] });
  return Object.freeze({
    git,
    counters: () => Object.freeze({ oneShotProcesses, sessionProcesses, stdinWrites }),
  });
}

async function inspectEnvironment(root) {
  const ports = ShellRunnerFactory.createPorts({ env: 'node' });
  const git = await GitPlumbing.createDefault({ cwd: root, ...ports });
  return Object.freeze({
    git: await git.execute({ args: ['--version'] }),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
  });
}

function createInput(count, bytes) {
  return Array.from({ length: count }, (_, index) => {
    const prefix = `object-${String(index).padStart(6, '0')}:`;
    return prefix.padEnd(bytes, String(index % 10));
  });
}

function windows(values, size) {
  const groups = [];
  for (let offset = 0; offset < values.length; offset += size) {
    groups.push(values.slice(offset, offset + size));
  }
  return groups;
}

function blobWindows(values, maxItems) {
  const groups = [];
  let group = [];
  let groupBytes = 0;
  for (let index = 0; index < values.length; index += 1) {
    const content = values[index];
    const contentBytes =
      typeof content === 'string' ? Buffer.byteLength(content) : content.byteLength;
    const framedBytes = blobRequestByteLength(contentBytes, index + 1);
    if (framedBytes > MAX_BLOB_BATCH_PROTOCOL_BYTES) {
      throw new Error(
        `One framed blob requires ${framedBytes} bytes; the shared batch ceiling is ${MAX_BLOB_BATCH_PROTOCOL_BYTES}`
      );
    }
    if (
      group.length > 0 &&
      (group.length === maxItems || groupBytes + framedBytes > MAX_BLOB_BATCH_PROTOCOL_BYTES)
    ) {
      groups.push(group);
      group = [];
      groupBytes = 0;
    }
    group.push(content);
    groupBytes += framedBytes;
  }
  if (group.length > 0) {
    groups.push(group);
  }
  return groups;
}

function blobRequestByteLength(contentBytes, mark) {
  return (
    Buffer.byteLength(`blob\nmark :${mark}\ndata ${contentBytes}\n`) +
    contentBytes +
    Buffer.byteLength(`\nget-mark :${mark}\n`)
  );
}

function digestIdentifiers(oids) {
  return crypto.createHash('sha256').update(oids.join('\n')).digest('hex');
}

function summarize(samples) {
  return Object.fromEntries(
    SCENARIOS.map((scenario) => {
      const byStrategy = Object.fromEntries(
        STRATEGIES.map((strategy) => {
          const selected = samples.filter(
            (sample) => sample.scenario === scenario && sample.strategy === strategy
          );
          const elapsed = selected.map(({ elapsedMs }) => elapsedMs);
          return [
            strategy,
            Object.freeze({
              medianMs: median(elapsed),
              madMs: medianAbsoluteDeviation(elapsed),
              gitProcesses: uniqueValue(selected.map(({ gitProcesses }) => gitProcesses)),
              oneShotProcesses: uniqueValue(
                selected.map(({ oneShotProcesses }) => oneShotProcesses)
              ),
              sessionProcesses: uniqueValue(
                selected.map(({ sessionProcesses }) => sessionProcesses)
              ),
              stdinWrites: uniqueValue(selected.map(({ stdinWrites }) => stdinWrites)),
              apiCalls: uniqueValue(selected.map(({ apiCalls }) => apiCalls)),
            }),
          ];
        })
      );
      const improvementPercent =
        ((byStrategy.baseline.medianMs - byStrategy.optimized.medianMs) /
          byStrategy.baseline.medianMs) *
        100;
      return [scenario, Object.freeze({ ...byStrategy, improvementPercent })];
    })
  );
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint];
}

function medianAbsoluteDeviation(values) {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

function uniqueValue(values) {
  const unique = [...new Set(values)];
  return unique.length === 1 ? unique[0] : unique;
}

function parseArguments(args) {
  const parsed = { ...DEFAULTS };
  for (const argument of args) {
    const [name, rawValue] = argument.split('=', 2);
    if (name === '--output') {
      parsed.output = rawValue;
    } else if (name === '--object-format') {
      parsed.objectFormat = rawValue;
    } else if (name === '--batch-size') {
      parsed.batchSize = parsePositiveInteger(rawValue, name);
    } else if (name === '--blob-bytes') {
      parsed.blobBytes = parsePositiveInteger(rawValue, name);
    } else if (name === '--objects') {
      parsed.objects = parsePositiveInteger(rawValue, name);
    } else if (name === '--runs') {
      parsed.runs = parsePositiveInteger(rawValue, name);
    } else if (name === '--warmups') {
      parsed.warmups = parseNonNegativeInteger(rawValue, name);
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!['sha1', 'sha256'].includes(parsed.objectFormat)) {
    throw new Error('--object-format must be sha1 or sha256');
  }
  if (parsed.batchSize > 250) {
    throw new Error('--batch-size must not exceed the shared safe ceiling of 250');
  }
  if (parsed.blobBytes < 32) {
    throw new Error('--blob-bytes must be at least 32');
  }
  const largestFramedBlob = blobRequestByteLength(parsed.blobBytes, parsed.objects);
  if (largestFramedBlob > MAX_BLOB_BATCH_PROTOCOL_BYTES) {
    throw new Error(
      `--blob-bytes produces a ${largestFramedBlob}-byte framed blob, above the shared ${MAX_BLOB_BATCH_PROTOCOL_BYTES}-byte batch ceiling`
    );
  }
  return Object.freeze(parsed);
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

function parseNonNegativeInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
