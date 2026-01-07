import "./deno_shim.js";

// Import all tests to run them in one Deno process with the shim
import "./GitBlob.test.js";
import "./GitRef.test.js";
import "./GitSha.test.js";
import "./ShellRunner.test.js";
import "./domain/entities/GitCommit.test.js";
import "./domain/entities/GitTree.test.js";
import "./domain/entities/GitTreeEntry.test.js";
import "./domain/errors/Errors.test.js";
import "./domain/services/ByteMeasurer.test.js";
import "./domain/value-objects/GitFileMode.test.js";
import "./domain/value-objects/GitObjectType.test.js";
