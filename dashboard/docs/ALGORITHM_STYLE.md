# MagicAlgo algorithm style

Use this style for future mathematical algorithm entries. The intended reader is a mathematician who already knows basic algorithm and reinforcement learning notation. The user-approved reference is a compact, typeset algorithm box with the density and clarity of the supplied “(Rich) On-Policy Data Collection” example.

## Presentation

- Give each algorithm a numbered caption naming the procedure.
- Place **Input** before the body and **Output** after it. List actual inputs and the returned object, not intermediate values that the procedure itself computes.
- Number executable lines. Indent nested `for`, `if`, and `end` blocks visibly; use explicit loop ranges and conditions.
- Put one meaningful operation or a closely related group of assignments on each line. Use short phase comments only when they help locate a stage of the algorithm.
- Typeset symbols, indices, and equations as mathematical notation. Prefer proper LaTeX rendering to Unicode approximations or long inline equation strings.
- Show a brief description immediately on mouse hover, with a help cursor and hover highlight but no persistent underline. Define every algorithm-specific variable in `Formulation.symbols`; use the shared renderer's elementary-symbol definitions only when the meaning is the same across algorithms. Check variables in inputs, outputs, and every pseudocode line.
- Keep prose brief. Define unfamiliar or algorithm-specific notation, assumptions, and implementation choices adjacent to the algorithm or in optional notes. Do not explain elementary symbols line by line.
- Show data flow: initialization, collection or sampling, derived quantities, update or aggregation, and returned result. State terminal handling and boundary conditions when they affect the equations.
- Use consistent indices: for example, `t` for trajectory time and `k` for an outer optimization iteration. Distinguish parameters before and after an update.
- Write `argmax` or `argmin` only for an exact optimization problem. If the procedure performs gradient steps or approximate optimization, say so.

## Editorial standard

Describe the exact recorded algorithm version when its implementation is available. Otherwise label the entry as a reference formulation. Do not imply that an illustrative sample formulation was executed by a sample run. Verify equations, inputs, outputs, and notation against the implementation before associating them with a version.

The formulation data stores LaTeX for each numbered line and its nesting depth. Keep the pseudocode and typeset equations visible by default, with notation definitions directly below the algorithm. Use optional notes only for details that would interrupt the main procedure.

## Reuse rule

The same `AlgorithmDocument` renderer also owns side-by-side comparison. Both sides
use the ordinary caption, input/output, pseudocode, notes and notation components.
Exact unchanged pseudocode lines anchor alignment; changed rows have a highlighted
background, and inserted/deleted lines leave a corresponding gap.
Red/minus marks the current side and green/plus the comparison side. This compares
notation, not mathematical equivalence. Version-specific formulas stay in the
formulation records, never in a separate diff renderer.

Every algorithm uses the same typed `Formulation` interface in `lib/algorithms/formulations.ts` and the shared `AlgorithmDocument` component in `components/dashboard/algorithm-document.tsx`. Add or correct an algorithm by supplying its title, family, LaTeX input and output, pseudocode lines, and explicit notation definitions. Each line has a nesting depth, a LaTeX expression, and optionally a note. Mark an unnumbered phase comment with `kind: "comment"`.

The shared component owns captions, line numbering, indentation, mathematical typesetting, optional notes, and the notation list. Keep algorithm-specific mathematics in formulation data. Do not add a separate renderer, per-algorithm JSX branch, or per-algorithm CSS to reproduce these elements. Extend the common interface and component if a future algorithm needs a genuinely new element, then make that element available to all algorithms.

Key each formulation by the exact recorded `[name, version]` pair. Keep reference status visible; only describe a formulation as implementation-verified after checking its equations against that version's code.
