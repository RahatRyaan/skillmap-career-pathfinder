# Rule: frontend

## Data access

Pages call the typed wrappers in `lib/endpoints.ts`. Never compose a URL string
in a component. A contract change should break in exactly one file.

The API client owns tokens: one refresh per 401, concurrent 401s share it, and
a 401 with **no session** is not an expiry.

## Rendering states

Every page and every data-backed component has all four:

| State            | Component                               |
| ---------------- | --------------------------------------- |
| Loading          | `SkeletonCards` or `LoadingState`       |
| Error with retry | `ErrorState`                            |
| Empty            | `EmptyState` — friendly, never scolding |
| Loaded           | content                                 |

An empty state is a valid state, not a failure.

## Accessibility is structural

- Every input has a real `<label htmlFor>`. Placeholder is never the only label.
- Every icon-only button has `aria-label`.
- Focus is visible globally. Do not remove the ring.
- Interactive targets are at least 44px (`size="md"` is `h-11`).
- Colour is never the only signal: pair with a word or an icon.
- Every chart goes through `ChartFrame`, which guarantees a table equivalent.
- One `h1` per page, and landmarks.

## Performance

- Route-level lazy loading. Charts and the graph are separate chunks.
- Low-data mode must remove cost, not information. The skill map becomes a
  list with the same data.

## Copy

Never a salary. Never a guarantee. Never shame a gap: _"one level away"_ not
_"you failed"_. The disclaimer travels with every score.
