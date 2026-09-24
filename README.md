# ai-energy-optimisation
AI-based building energy optimisation using CSP and Hill Climbing

## Commands

```text
npm install
npm run typecheck
npm test
npm run demo
npm run demo:web
```

`npm run demo` loads the generic example scenario and runs the existing
validation, CSP solver, energy evaluation, Simple Hill Climbing, execution
visualisation, and console output pipeline. Simple Hill Climbing reports a
local optimum; it does not claim global optimality.

`npm run demo:web` starts the plain HTML/CSS/TypeScript browser interface.
It builds a user-provided scenario, runs the same existing pipeline, and
renders the returned CSP search tree, backtracking records, Hill Climbing
timeline, energy comparison, and raw execution events.
