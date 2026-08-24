/**
 * @fileoverview EnvironmentPolicy - Domain service for environment variable security
 */

/**
 * EnvironmentPolicy defines which environment variables are safe to pass
 * to the underlying Git process.
 *
 * It whitelists essential variables for identity, configuration discovery and
 * localization while explicitly blocking variables that could override security
 * settings.
 *
 * The distinction it draws is between letting git *find* the operator's
 * configuration and letting a caller *inject* configuration. The first is
 * ordinary git behaviour: without it git cannot read ~/.gitconfig, invents an
 * identity from the system account and hostname, and writes commits attributed
 * to an address that exists nowhere and verifies against nothing. The second
 * stays blocked: configuration-discovery paths are accepted only from the
 * runner's inherited environment, while GIT_CONFIG_PARAMETERS and friends are
 * never accepted.
 */
export default class EnvironmentPolicy {
  /**
   * List of environment variables allowed to be passed to the git process.
   * Whitelists identity (GIT_AUTHOR_*, GIT_COMMITTER_*), the paths git uses to
   * locate user configuration, and localization (LANG, LC_ALL).
   * @private
   */
  static _ALLOWED_KEYS = [
    'PATH',
    'GIT_CONFIG_NOSYSTEM',
    'GIT_ATTR_NOSYSTEM',
    // Identity
    'GIT_AUTHOR_NAME',
    'GIT_AUTHOR_EMAIL',
    'GIT_AUTHOR_DATE',
    'GIT_AUTHOR_TZ',
    'GIT_COMMITTER_NAME',
    'GIT_COMMITTER_EMAIL',
    'GIT_COMMITTER_DATE',
    'GIT_COMMITTER_TZ',
    // Configuration discovery: where git looks for the operator's own config.
    // HOME finds ~/.gitconfig, XDG_CONFIG_HOME finds ~/.config/git/config,
    // GIT_CONFIG_GLOBAL names the file outright, and USERPROFILE is how a home
    // directory is resolved on Windows. Runners accept these paths only from
    // their inherited environment, never from per-call overrides.
    'HOME',
    'XDG_CONFIG_HOME',
    'GIT_CONFIG_GLOBAL',
    'USERPROFILE',
    // Localization & Encoding
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'LC_MESSAGES',
  ];

  /**
   * List of environment variables that are explicitly blocked.
   * @private
   */
  static _BLOCKED_KEYS = ['GIT_CONFIG_PARAMETERS', 'GIT_EXEC_PATH', 'GIT_TEMPLATE_DIR'];

  /**
   * Configuration-discovery paths trusted only when inherited by a runner.
   * @private
   */
  static _CONFIG_DISCOVERY_KEYS = ['HOME', 'XDG_CONFIG_HOME', 'GIT_CONFIG_GLOBAL', 'USERPROFILE'];

  /**
   * Filters the provided environment object based on the whitelist and blacklist.
   * @param {Object} env - The source environment object (e.g., process.env).
   * @returns {Object} A sanitized environment object.
   */
  static filter(env = {}) {
    const sanitized = {};

    for (const key of EnvironmentPolicy._ALLOWED_KEYS) {
      // Ensure we don't allow a key if it's also in the blocked list (redundancy)
      if (EnvironmentPolicy._BLOCKED_KEYS.includes(key)) {
        continue;
      }

      if (env[key] !== undefined) {
        sanitized[key] = env[key];
      }
    }

    return sanitized;
  }

  /**
   * Filters caller-provided per-command environment overrides.
   *
   * A runner may inherit configuration-discovery paths from its trusted
   * process environment, but a caller must not redirect them.
   * @param {Object} env - Caller-provided environment overrides.
   * @returns {Object} Sanitized per-command overrides.
   */
  static filterOverrides(env = {}) {
    const sanitized = EnvironmentPolicy.filter(env);
    for (const key of EnvironmentPolicy._CONFIG_DISCOVERY_KEYS) {
      delete sanitized[key];
    }
    return sanitized;
  }
}
