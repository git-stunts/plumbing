import GitPlumbing from '../index.js';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';

/**
 * A caller that shells out through this library should see the same identity
 * git itself would use.
 *
 * The runner sanitizes the environment before spawning git. When that filter
 * drops every variable git uses to locate the user's configuration, git cannot
 * read ~/.gitconfig at all and manufactures an identity from the system account
 * and hostname instead. The result is a commit attributed to an address like
 * user@laptop.local, which exists nowhere, verifies against nothing, and quietly
 * replaces the identity the operator actually configured.
 *
 * This drives a real commit with the configuration supplied the ordinary way and
 * asserts the configured identity survives the filter.
 */
describe('User git configuration', () => {
  let repoPath;
  let homePath;
  let originalHome;
  let originalConfigGlobal;

  const CONFIGURED_NAME = 'Configured Operator';
  const CONFIGURED_EMAIL = 'operator@example.com';
  const CALLER_NAME = 'Caller Override';
  const CALLER_EMAIL = 'caller@example.com';

  beforeAll(() => {
    const stamp = Math.random().toString(36).substring(7);
    repoPath = path.join(os.tmpdir(), `git-plumbing-userconfig-repo-${stamp}`);
    homePath = path.join(os.tmpdir(), `git-plumbing-userconfig-home-${stamp}`);
    fs.mkdirSync(repoPath, { recursive: true });
    fs.mkdirSync(homePath, { recursive: true });

    fs.writeFileSync(
      path.join(homePath, '.gitconfig'),
      `[user]\n\tname = ${CONFIGURED_NAME}\n\temail = ${CONFIGURED_EMAIL}\n`
    );

    originalHome = process.env.HOME;
    originalConfigGlobal = process.env.GIT_CONFIG_GLOBAL;
    process.env.HOME = homePath;
    delete process.env.GIT_CONFIG_GLOBAL;
  });

  afterAll(() => {
    if (originalHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = originalHome;
    }

    if (originalConfigGlobal === undefined) {
      delete process.env.GIT_CONFIG_GLOBAL;
    } else {
      process.env.GIT_CONFIG_GLOBAL = originalConfigGlobal;
    }

    fs.rmSync(repoPath, { recursive: true, force: true });
    fs.rmSync(homePath, { recursive: true, force: true });
  });

  it('commits as the identity the operator configured', async () => {
    const git = await GitPlumbing.createDefault({ cwd: repoPath });
    await git.execute({ args: ['init'] });

    const tree = await git.execute({ args: ['write-tree'] });
    const commit = await git.execute({
      args: ['commit-tree', tree.trim(), '-m', 'configured identity'],
    });

    const author = await git.execute({
      args: ['log', '-1', '--format=%an <%ae>', commit.trim()],
    });

    expect(author.trim()).toBe(`${CONFIGURED_NAME} <${CONFIGURED_EMAIL}>`);
  });

  it('does not let a caller replace inherited configuration with GIT_CONFIG_GLOBAL', async () => {
    const callerConfig = path.join(homePath, 'caller.gitconfig');
    fs.writeFileSync(callerConfig, `[user]\n\tname = ${CALLER_NAME}\n\temail = ${CALLER_EMAIL}\n`);

    const git = await GitPlumbing.createDefault({ cwd: repoPath });
    await git.execute({ args: ['init'] });

    const tree = await git.execute({ args: ['write-tree'] });
    const commit = await git.execute({
      args: ['commit-tree', tree.trim(), '-m', 'trusted configuration'],
      env: { GIT_CONFIG_GLOBAL: callerConfig },
    });

    const author = await git.execute({
      args: ['log', '-1', '--format=%an <%ae>', commit.trim()],
    });

    expect(author.trim()).toBe(`${CONFIGURED_NAME} <${CONFIGURED_EMAIL}>`);
  });
});
