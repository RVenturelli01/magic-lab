// Documentation examples of the viewer contract. No algorithm is executed.
// Each factory returns an independent document that the host can customize.
export function singleModuleExample() {
  return {
    version: 2,
    name: "Gradient descent — viewer example",
    hypothetical: true,
    root: "gradient-descent",
    symbols: [
      { id: "parameters", tex: "\\theta", description: "Parameter vector." },
      { id: "learning-rate", tex: "\\eta", description: "Positive step size." },
    ],
    algorithms: [
      {
        id: "gradient-descent",
        number: 1,
        title: "Gradient descent",
        input: [{ math: "f, \\theta_0, \\eta, T" }],
        output: [{ math: "\\theta_T" }],
        notes: [
          "An authored display example, not executable optimization code.",
        ],
        body: [
          {
            kind: "block",
            header: [{ keyword: "for" }, { math: "t=0,\\ldots,T-1" }],
            body: [
              {
                kind: "equation",
                math: "\\theta_{t+1} \\leftarrow \\theta_t - \\eta \\nabla f(\\theta_t)",
                note: "The step size is supplied by the host; no convergence claim is made.",
              },
            ],
          },
        ],
      },
    ],
  };
}

export function sharedModulesExample() {
  return {
    version: 2,
    name: "Full-batch and mini-batch — viewer example",
    hypothetical: true,
    root: "full-batch",
    pendingAlgorithms: [
      { id: "adaptive", title: "Adaptive update (not authored)" },
    ],
    symbols: [
      {
        id: "batch",
        tex: "B",
        description: "A nonempty batch of observations.",
      },
    ],
    algorithms: [
      {
        id: "full-batch",
        number: 1,
        title: "Full-batch descent",
        input: [{ math: "D, \\theta_0, \\eta, T" }],
        output: [{ math: "\\theta_T" }],
        notes: [],
        body: [
          {
            kind: "block",
            header: [{ keyword: "for" }, { math: "t=0,\\ldots,T-1" }],
            body: [
              {
                kind: "line",
                content: [
                  { math: "\\theta_{t+1} \\leftarrow" },
                  { call: "update" },
                  { math: "(\\theta_t,D,\\eta)" },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "mini-batch",
        number: 2,
        title: "Mini-batch descent",
        input: [{ math: "D, \\theta_0, \\eta, E" }],
        output: [{ math: "\\theta" }],
        notes: [
          "Batch construction is a host convention and must be described explicitly.",
        ],
        body: [
          { kind: "equation", math: "\\theta \\leftarrow \\theta_0" },
          {
            kind: "block",
            header: [{ keyword: "for" }, { math: "e=1,\\ldots,E" }],
            body: [
              {
                kind: "block",
                header: [
                  { keyword: "for each" },
                  { math: "B \\in \\mathcal{B}_e(D)" },
                ],
                note: "Each epoch uses a partition into nonempty batches; ordering is host-defined.",
                body: [
                  {
                    kind: "line",
                    content: [
                      { math: "\\theta \\leftarrow" },
                      { call: "update" },
                      { math: "(\\theta,B,\\eta)" },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "update",
        number: 3,
        title: "Mean-gradient update",
        input: [{ math: "\\theta, B, \\eta" }],
        output: [{ math: "\\theta'" }],
        notes: [],
        body: [
          {
            kind: "comment",
            text: "The same module is called by both main algorithms.",
          },
          {
            kind: "equation",
            math: "g \\leftarrow \\frac{1}{|B|} \\sum_{z \\in B} \\nabla_\\theta \\ell(\\theta;z)",
          },
          { kind: "equation", math: "\\theta' \\leftarrow \\theta - \\eta g" },
        ],
      },
    ],
  };
}
