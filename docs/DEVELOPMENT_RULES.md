# Development Rules

1. These documentation files are the project's source of truth.
2. Read the relevant documentation before modifying code.
3. Do not independently redesign the architecture.
4. Do not change module responsibilities without team approval.
5. Do not introduce frameworks, libraries, databases, or technologies without approval.
6. Do not duplicate AI logic across modules.
7. Keep AI logic separate from visualisation and interface logic.
8. Visualisation must consume actual algorithm events and data.
9. Do not fake search-tree branches, backtracking steps, or optimisation results.
10. Do not hard-code demonstration results when algorithms should produce them.
11. Maintain compatibility with existing data contracts.
12. Add tests for important algorithmic behaviour.
13. Keep changes limited to the assigned module whenever possible.
14. Do not modify another teammate's module unnecessarily.
15. Do not delete working code without understanding its dependencies.
16. Discuss architectural changes with the team before making them.
17. AI coding agents must follow these rules as well.
18. Treat building type as generic scenario input, not as a separate application mode or architectural branch.
19. Organise demonstration scenarios by problem size (`small`, `medium`, `large`) rather than by building category.
20. Search-tree, backtracking, and hill-climbing visualisations must represent actual emitted execution events and states.

When documentation and implementation conflict, stop and resolve the conflict with the team before expanding the implementation.
