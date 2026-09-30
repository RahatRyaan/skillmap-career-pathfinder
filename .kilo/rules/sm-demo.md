# Rule: demo mode

Demo Mode is the default, and it is a first-class implementation, not a stub.
The competition demo runs in it.

## Invariants

1. **Deterministic.** The same input always produces the same output. No
   randomness, no clock-dependent branching, no network.
2. **Offline.** Nothing leaves the machine. No API key is required.
3. **Honest.** Every response says it came from rules, not a trained model.
4. **Complete.** It implements the whole `AIProvider` interface, so a demo
   exercises the same code path as production.

## The banner

A permanent banner appears on every page while the mode is not `openai`. It is
not dismissible, because its whole purpose is to prevent a misimpression.

## Fallback notice

When a real provider fails and the server falls back, the notice says so
explicitly. A silent fallback is worse than an error, because the user cannot
tell a rule-based answer from a model-based one.

## Testing

The same provider contract test runs against all three modes. A change that
breaks demo mode cannot ship.

## What demo mode is not

Not a mock and not a stub for tests. It is the shipping default, and it is what
runs if the free-tier host sleeps mid-demo and a real provider is unreachable.
