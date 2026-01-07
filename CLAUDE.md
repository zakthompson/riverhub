# RiverHub

## Project Overview

RiverHub is an application that will run on a Raspberry Pi with an RC522 RFID module attached. It will serve as a smart room dashboard for a young child, allowing them to play music and alter room settings using RFID cards.

The MVP version of the app, which is the stage we are currently developing, will simply handle playing music. When no music is playing, it will display a playful clock. When a card is tapped, it will read the playlist URL, play it on a specified Sonos speaker, and display media controls on screen.

---

## Tech Stack

- **Python** back-end for reading and writing RFID cards
- **React** front-end using **TypeScript** and **Vite**
- **TanStack** suite wherever applicable
- **Tailwind CSS** for styling

* **ESLint** for linting
* **Prettier** for code formatting
* **Husky** for pre-commit hooks

---

## Development Principles

1. **Aggressive Simplicity**

   - Always prefer the simplest working solution.
   - Complexity should only be introduced when required (performance, maintainability, or feature necessity).
   - Avoid overengineering, speculative abstractions, or clever hacks.
   - Strive for clarity over cleverness.

2. **Don’t Repeat Yourself (DRY)**

   - Avoid duplication — if code is about to be repeated, factor it out into a reusable function or module.
   - Keep shared logic in a single source of truth to reduce maintenance cost.

3. **Prefer Functional Style**

   - Favor pure functions with no side effects where possible.
   - Compose small, focused functions rather than relying on large classes or inheritance.
   - Minimize mutability unless required for clarity or performance.

4. **Zero Tolerance for Broken Code**

   - Code must compile/build without errors.
   - No linting, formatting, or type errors allowed.
   - All tests must pass before code is considered complete.
   - Work-in-progress commits are acceptable, but merges must meet these standards.

5. **Production-Quality Expectations**

   - Code must be robust, maintainable, and secure.
   - Include appropriate error handling, input validation, and edge-case coverage.
   - Prioritize readability and maintainability — future contributors should be able to easily understand and extend the code.

6. **Highly Configurable**
   - As much as possible, features should be configurable via environment variable or configuration file

---

## Coding Style

- Follow project naming conventions (e.g. `camelCase` for variables/functions, `PascalCase` for types/classes).
- Prefer small, pure helper functions over large, monolithic blocks of logic.
- Avoid classes unless encapsulating state or behavior that clearly benefits from an object-oriented approach.
- **Use comments sparingly:**
  - Explain _why_ something unusual or non-obvious is being done.
  - Explain _what_ the code does only if it is necessarily complex and cannot be simplified further.
- Ensure all code is auto-formatted consistently using the project’s formatter/linter.

---

## Anti-Patterns to Avoid

- **Premature Optimization:** Don’t sacrifice clarity for speed unless performance is a proven bottleneck.
- **Unnecessary Abstractions:** Avoid layers of indirection, generic frameworks, or patterns that don’t clearly solve a real problem.
- **Global Mutable State:** Prefer passing data explicitly; global shared state makes code harder to reason about and test.
- **Magic Numbers & Strings:** Use named constants or enums for clarity and maintainability.
- **Silent Failures:** Don’t swallow errors; handle them explicitly or surface them clearly.
- **Commented-Out Code:** Remove dead code rather than leaving it commented. Git history preserves it.
