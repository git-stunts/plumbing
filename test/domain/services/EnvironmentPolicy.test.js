import EnvironmentPolicy from '../../../src/domain/services/EnvironmentPolicy.js';

describe('EnvironmentPolicy', () => {
  it('filters out non-whitelisted environment variables', () => {
    const env = {
      PATH: '/usr/bin',
      DANGEROUS_VAR: 'hack',
      GIT_AUTHOR_NAME: 'James Ross',
      LANG: 'en_US.UTF-8',
    };

    const filtered = EnvironmentPolicy.filter(env);

    expect(filtered).toEqual({
      PATH: '/usr/bin',
      GIT_AUTHOR_NAME: 'James Ross',
      LANG: 'en_US.UTF-8',
    });
    expect(filtered.DANGEROUS_VAR).toBeUndefined();
  });

  it('explicitly blocks GIT_CONFIG_PARAMETERS', () => {
    const env = {
      GIT_AUTHOR_NAME: 'James Ross',
      GIT_CONFIG_PARAMETERS: "'user.name=attacker'",
    };

    const filtered = EnvironmentPolicy.filter(env);

    expect(filtered.GIT_AUTHOR_NAME).toBe('James Ross');
    expect(filtered.GIT_CONFIG_PARAMETERS).toBeUndefined();
  });

  it('includes all requested identity and localization variables', () => {
    const env = {
      GIT_AUTHOR_NAME: 'name',
      GIT_AUTHOR_EMAIL: 'email',
      GIT_AUTHOR_DATE: 'date',
      GIT_COMMITTER_NAME: 'cname',
      GIT_COMMITTER_EMAIL: 'cemail',
      GIT_COMMITTER_DATE: 'cdate',
      LANG: 'lang',
      LC_ALL: 'all',
      LC_CTYPE: 'ctype',
      LC_MESSAGES: 'messages',
    };

    const filtered = EnvironmentPolicy.filter(env);

    expect(filtered).toEqual(env);
  });

  it('handles empty or undefined environment', () => {
    expect(EnvironmentPolicy.filter({})).toEqual({});
    expect(EnvironmentPolicy.filter(undefined)).toEqual({});
  });

  // Without a way to locate the user's configuration, git cannot read
  // ~/.gitconfig and falls back to inventing an identity from the system
  // account and hostname. Callers then see commits attributed to addresses
  // such as user@laptop.local that exist nowhere and verify against nothing,
  // while the operator's real, configured identity sits unread on disk.
  it('lets git locate the user configuration', () => {
    const env = {
      HOME: '/home/operator',
      XDG_CONFIG_HOME: '/home/operator/.config',
      GIT_CONFIG_GLOBAL: '/home/operator/.gitconfig',
    };

    const filtered = EnvironmentPolicy.filter(env);

    expect(filtered).toEqual(env);
  });

  it('passes USERPROFILE so Windows callers resolve a home directory too', () => {
    const filtered = EnvironmentPolicy.filter({ USERPROFILE: 'C:\\Users\\operator' });

    expect(filtered.USERPROFILE).toBe('C:\\Users\\operator');
  });

  // Reading configuration is not the same as accepting arbitrary overrides.
  // GIT_CONFIG_PARAMETERS injects settings directly into the process and stays
  // blocked, so a caller cannot smuggle configuration past the policy.
  it('still refuses direct configuration injection', () => {
    const filtered = EnvironmentPolicy.filter({
      HOME: '/home/operator',
      GIT_CONFIG_PARAMETERS: "'user.name=attacker'",
      GIT_EXEC_PATH: '/tmp/evil',
      GIT_TEMPLATE_DIR: '/tmp/evil',
    });

    expect(filtered.HOME).toBe('/home/operator');
    expect(filtered.GIT_CONFIG_PARAMETERS).toBeUndefined();
    expect(filtered.GIT_EXEC_PATH).toBeUndefined();
    expect(filtered.GIT_TEMPLATE_DIR).toBeUndefined();
  });

  it('keeps configuration-discovery paths out of caller overrides', () => {
    const filtered = EnvironmentPolicy.filterOverrides({
      PATH: '/tmp/caller-bin',
      HOME: '/tmp/caller-home',
      XDG_CONFIG_HOME: '/tmp/caller-xdg',
      GIT_CONFIG_GLOBAL: '/tmp/caller.gitconfig',
      USERPROFILE: 'C:\\Users\\caller',
      GIT_AUTHOR_NAME: 'Caller Identity',
    });

    expect(filtered).toEqual({ GIT_AUTHOR_NAME: 'Caller Identity' });
  });
});
