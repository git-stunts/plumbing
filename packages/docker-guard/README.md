# @git-stunts/docker-guard

Tiny guard that ensures tests and benchmarks only execute inside Docker. Each git-stunts package can import the guard, then call `ensureDocker()` before any runtime work begins.

## Usage

```javascript
import { ensureDocker } from '@git-stunts/docker-guard';

ensureDocker();
```

You can also pass overrides for testing:

```javascript
import { ensureDocker } from '@git-stunts/docker-guard';

ensureDocker({
  env: { GIT_STUNTS_DOCKER: '1' },
  logger: () => {},
  exit: () => {}
});
```
