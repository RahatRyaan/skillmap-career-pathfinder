# Rule: architecture

## Dependency direction

```
packages/shared   pure, no I/O, imports nothing from the others
packages/server   imports shared
packages/client   imports shared
packages/content  imports shared
```

`shared` never imports from `server` or `client`. If it needs a new type, it
defines it there and both sides adopt it.

## Why

Ten packages working against one contract is the situation where drift happens.
The failure mode is not sloppy code, it is _subtly wrong shapes_: the client
expects a number, the server sends a string. A compiled shared contract turns
each of those into a build error at the point of change.

## Boundaries

- Controllers are folded into routes. A controller that only forwards to a
  service is a file to navigate without behaviour.
- Repositories are folded into services. Mongoose is a detail of a service.
- AI lives in its own module. Controllers never import a provider; they call
  `AIService`.

## Toolchain traps, and why the code looks odd

- **`mongoose.model<T>()` is called without a generic**, even with every type
  argument pinned. Instantiating mongoose's model type parameters from inside a
  helper exhausts memory in `tsc` and in ESLint's type-aware linting. The
  document interface is applied at the boundary instead.
- **Named imports only.** An inline `import('mongoose').Schema` type query does
  the same thing.
- **Models are registered through one non-generic helper** in
  `models/index.ts`. Read the comment there before changing it.

## Adding a package

Ask first whether it is a real boundary. A package per feature is worse than
one well-layered package: it multiplies build time and makes the contract
harder, not easier, to keep in one place.
