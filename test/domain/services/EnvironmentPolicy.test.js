import EnvironmentPolicy from '../../../src/domain/services/EnvironmentPolicy.js';

describe('EnvironmentPolicy', () => {
  it('filters out non-whitelisted environment variables', () => {
    const env = {
      PATH: '/usr/bin',
      DANGEROUS_VAR: 'hack',
      GIT_AUTHOR_NAME: 'James Ross',
      LANG: 'en_US.UTF-8'
    };

    const filtered = EnvironmentPolicy.filter(env);

    expect(filtered).toEqual({
      PATH: '/usr/bin',
      GIT_AUTHOR_NAME: 'James Ross',
      LANG: 'en_US.UTF-8'
    });
    expect(filtered.DANGEROUS_VAR).toBeUndefined();
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
      LC_MESSAGES: 'messages'
    };

    const filtered = EnvironmentPolicy.filter(env);

    expect(filtered).toEqual(env);
  });

  it('handles empty or undefined environment', () => {
    expect(EnvironmentPolicy.filter({})).toEqual({});
    expect(EnvironmentPolicy.filter(undefined)).toEqual({});
  });
});
