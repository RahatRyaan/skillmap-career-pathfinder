/**
 * @skillmap/shared — the single source of truth for domain contracts.
 *
 * Server and client both import from here. If a shape is not in this package,
 * it is not part of the API.
 */

export * from './enums.js';
export * from './constants.js';
export * from './scoring.js';
export * from './errors.js';
export * from './primitives.js';
export * from './schemas.js';
