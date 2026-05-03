# C-006: Cargo audit ignores must be scoped and justified

Cargo audit ignores are allowed only when the vulnerable dependency is unreachable
from the shipped build or has no fixed upstream version. Each ignored advisory
must include the dependency path, why it is unreachable or mitigated, and must
stay scoped to the single advisory ID.

Current approved exception:

- `RUSTSEC-2023-0071`: `rsa` is recorded through `sqlx-mysql` in `Cargo.lock`,
  but backend builds `sqlx` with `default-features = false` and only the
  `postgres` driver enabled.
