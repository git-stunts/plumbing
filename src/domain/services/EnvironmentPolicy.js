/**
 * @fileoverview EnvironmentPolicy - Domain service for environment variable security
 */

/**
 * EnvironmentPolicy defines which environment variables are safe to pass 
 * to the underlying Git process.
 */
export default class EnvironmentPolicy {
  /**
   * List of environment variables allowed to be passed to the git process.
   * @private
   */
  static _ALLOWED_KEYS = [
    'PATH',
    'GIT_EXEC_PATH',
    'GIT_TEMPLATE_DIR',
    'GIT_CONFIG_NOSYSTEM',
    'GIT_ATTR_NOSYSTEM',
    'GIT_CONFIG_PARAMETERS',
    // Identity
    'GIT_AUTHOR_NAME',
    'GIT_AUTHOR_EMAIL',
    'GIT_AUTHOR_DATE',
    'GIT_AUTHOR_TZ',
    'GIT_COMMITTER_NAME',
    'GIT_COMMITTER_EMAIL',
    'GIT_COMMITTER_DATE',
    'GIT_COMMITTER_TZ',
    // Localization & Encoding
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'LC_MESSAGES'
  ];

  /**
   * Filters the provided environment object based on the whitelist.
   * @param {Object} env - The source environment object (e.g., process.env).
   * @returns {Object} A sanitized environment object.
   */
  static filter(env = {}) {
    const sanitized = {};
    for (const key of EnvironmentPolicy._ALLOWED_KEYS) {
      if (env[key] !== undefined) {
        sanitized[key] = env[key];
      }
    }
    return sanitized;
  }
}
