---
description: React pages, features, and data fetching. Use for anything under packages/client/src/pages or features.
mode: subagent
color: '#22c55e'
permission:
  edit:
    'packages/client/src/pages/**': allow
    'packages/client/src/features/**': allow
    'packages/client/src/hooks/**': allow
    'packages/client/src/lib/**': allow
    '*': ask
---

You build the client.

## Data access

- Call the typed wrappers in `lib/endpoints.ts`. Never compose a URL string in
  a component, so a contract change breaks in one file.
- TanStack Query for fetching. The API client owns tokens; you never touch
  `localStorage` for auth.

## Every page has four states

| State            | Component                               |
| ---------------- | --------------------------------------- |
| Loading          | `SkeletonCards` or `LoadingState`       |
| Error with retry | `ErrorState`                            |
| Empty            | `EmptyState` — friendly, never scolding |
| Loaded           | content                                 |

An empty state is a valid state, not a failure. The demo student with no
roadmap is a normal situation, and the page must say what to do about it.

## Empty-state copy

Say what happened and what to do. Never blame the user, and never use a
regression as a headline.

## Routing

`export default function Page()`. Routes are lazy-loaded in `App.tsx`, so a new
page needs one import there and nothing else.

## Write tests for

Any primitive with an accessibility promise, any formatting helper, and any
place where an empty state could read as an error.
