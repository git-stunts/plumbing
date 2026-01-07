/**
 * @fileoverview GitPersistencePort - Functional port for Git object persistence
 */

/**
 * @typedef {Object} GitPersistencePort
 * @property {function(import('../domain/entities/GitBlob.js').default): Promise<import('../domain/value-objects/GitSha.js').default>} writeBlob
 * @property {function(import('../domain/entities/GitTree.js').default): Promise<import('../domain/value-objects/GitSha.js').default>} writeTree
 * @property {function(import('../domain/entities/GitCommit.js').default): Promise<import('../domain/value-objects/GitSha.js').default>} writeCommit
 */
