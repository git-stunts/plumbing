import { describe, it, expect, vi } from 'vitest';
import { ensureDocker, isDockerEnvironment } from '../src/index.js';

describe('@git-stunts/docker-guard', () => {
  it('detects docker environments via GIT_STUNTS_DOCKER', () => {
    expect(isDockerEnvironment({ GIT_STUNTS_DOCKER: '1' })).toBe(true);
  });

  it('detects GitHub Actions via env marker', () => {
    expect(isDockerEnvironment({ GITHUB_ACTIONS: 'true' })).toBe(true);
  });

  it('rejects when no indicators exist', () => {
    expect(isDockerEnvironment({})).toBe(false);
  });

  it('writes banner and exits when guard fails', () => {
    const logger = vi.fn();
    const exit = vi.fn();

    ensureDocker({ env: {}, logger, exit });

    expect(logger).toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('is a no-op when docker env exists', () => {
    const logger = vi.fn();
    const exit = vi.fn();

    ensureDocker({ env: { GIT_STUNTS_DOCKER: '1' }, logger, exit });

    expect(logger).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });
});
