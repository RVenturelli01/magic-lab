/** Reference algorithms for the exact recorded name/version key. */
export interface AlgorithmLine {
  depth: number;
  tex: string;
  kind?: "comment";
  note?: string;
}

export interface Formulation {
  title: string;
  family: string;
  input: string;
  output: string;
  lines: AlgorithmLine[];
  symbols: { symbol: string; meaning: string }[];
}

export const formulations: Record<string, Formulation> = {
  '["A2C",null]': {
    title: "Advantage Actor-Critic",
    family: "On-policy · actor–critic",
    input:
      "\\mathcal E,\\ \\pi_{\\theta_0},\\ V_{\\phi_0},\\ K,\\ n,\\ \\gamma,\\ \\beta,\\ \\eta_\\pi,\\ \\eta_V",
    output: "\\pi_{\\theta_K},\\ V_{\\phi_K}",
    lines: [
      { depth: 0, tex: "\\text{for }k=0,\\ldots,K-1\\text{ do}" },
      {
        depth: 1,
        tex: "\\text{Collect }\\mathcal D_k=\\{(s_t,a_t,r_t,s_{t+1},d_t)\\}_{t=0}^{T-1}\\text{ under }\\pi_{\\theta_k},\\quad T\\leq n",
        note: "Stop at a terminal transition or the rollout horizon; dₜ is the terminal indicator.",
      },
      {
        depth: 1,
        tex: "R_T\\leftarrow(1-d_{T-1})V_{\\phi_k}(s_T)",
        note: "Bootstrap only when the fragment stops before termination.",
      },
      { depth: 1, tex: "\\text{for }t=T-1,\\ldots,0\\text{ do}" },
      { depth: 2, tex: "R_t\\leftarrow r_t+\\gamma(1-d_t)R_{t+1}" },
      { depth: 2, tex: "\\widehat A_t\\leftarrow R_t-V_{\\phi_k}(s_t)" },
      { depth: 1, tex: "\\text{end}" },
      {
        depth: 1,
        tex: "\\theta_{k+1}\\leftarrow\\theta_k+\\eta_\\pi\\nabla_\\theta\\left[\\frac1T\\sum_{t=0}^{T-1}\\left(\\log\\pi_\\theta(a_t\\mid s_t)\\widehat A_t+\\beta H(\\pi_\\theta(\\cdot\\mid s_t))\\right)\\right]_{\\theta=\\theta_k}",
        note: "Treat advantages as fixed during the actor update; β = 0 omits entropy regularization.",
      },
      {
        depth: 1,
        tex: "\\phi_{k+1}\\leftarrow\\phi_k-\\eta_V\\nabla_\\phi\\left[\\frac1T\\sum_{t=0}^{T-1}(V_\\phi(s_t)-R_t)^2\\right]_{\\phi=\\phi_k}",
        note: "Treat bootstrapped returns as fixed critic targets.",
      },
      { depth: 0, tex: "\\text{end}" },
    ],
    symbols: [
      { symbol: "𝓔", meaning: "Environment" },
      { symbol: "𝒟", meaning: "Collected trajectory fragment" },
      { symbol: "π", meaning: "Stochastic policy" },
      { symbol: "θ", meaning: "Policy parameters" },
      { symbol: "V", meaning: "State-value function" },
      { symbol: "φ", meaning: "Value-function parameters" },
      { symbol: "K", meaning: "Number of outer updates" },
      { symbol: "n", meaning: "Maximum rollout length" },
      { symbol: "T", meaning: "Length of the current fragment" },
      { symbol: "d", meaning: "Terminal-transition indicator" },
      { symbol: "R", meaning: "Bootstrapped return" },
      { symbol: "Â", meaning: "Estimated advantage" },
      { symbol: "γ", meaning: "Reward discount factor" },
      { symbol: "β", meaning: "Entropy weight" },
      { symbol: "H", meaning: "Policy entropy" },
      { symbol: "η", meaning: "Actor or critic step size" },
    ],
  },
  '["PPO",null]': {
    title: "Proximal Policy Optimization",
    family: "On-policy · actor–critic",
    input:
      "\\mathcal E,\\ \\pi_{\\theta_0},\\ V_{\\phi_0},\\ K,\\ T_{\\max},\\ M,\\ \\gamma,\\ \\lambda,\\ \\varepsilon,\\ \\eta_\\pi,\\ \\eta_V",
    output: "\\pi_{\\theta_K},\\ V_{\\phi_K}",
    lines: [
      { depth: 0, tex: "\\text{for }k=0,\\ldots,K-1\\text{ do}" },
      {
        depth: 1,
        tex: "\\text{Collect }\\mathcal D_k=\\{(s_t,a_t,r_t,s_{t+1},d_t)\\}\\text{ using }\\pi_{\\theta_k}",
        note: "Collect up to Tₘₐₓ transitions per trajectory; keep the behavior policy fixed during optimization.",
      },
      {
        depth: 1,
        tex: "\\text{for each trajectory of length }T\\leq T_{\\max}\\text{ in }\\mathcal D_k\\text{ do}",
      },
      {
        depth: 2,
        tex: "\\delta_t\\leftarrow r_t+\\gamma(1-d_t)V_{\\phi_k}(s_{t+1})-V_{\\phi_k}(s_t)\\quad(t=0,\\ldots,T-1)",
      },
      { depth: 2, tex: "\\widehat A_T\\leftarrow0" },
      { depth: 2, tex: "\\text{for }t=T-1,\\ldots,0\\text{ do}" },
      {
        depth: 3,
        tex: "\\widehat A_t\\leftarrow\\delta_t+\\gamma\\lambda(1-d_t)\\widehat A_{t+1}",
      },
      {
        depth: 3,
        tex: "\\widehat R_t\\leftarrow\\widehat A_t+V_{\\phi_k}(s_t)",
      },
      { depth: 2, tex: "\\text{end}" },
      { depth: 1, tex: "\\text{end}" },
      {
        depth: 1,
        tex: "\\theta\\leftarrow\\theta_k,\\quad\\phi\\leftarrow\\phi_k",
      },
      { depth: 1, tex: "\\text{for }e=1,\\ldots,M\\text{ do}" },
      {
        depth: 2,
        tex: "\\text{for each minibatch }B\\subseteq\\mathcal D_k\\text{ do}",
      },
      {
        depth: 3,
        tex: "\\rho_t(\\theta)\\leftarrow\\frac{\\pi_\\theta(a_t\\mid s_t)}{\\pi_{\\theta_k}(a_t\\mid s_t)}",
      },
      {
        depth: 3,
        tex: "L_{\\mathrm{clip}}(\\theta;B)\\leftarrow\\frac1{|B|}\\sum_{t\\in B}\\min\\!\\left(\\rho_t(\\theta)\\widehat A_t,\\operatorname{clip}(\\rho_t(\\theta),1-\\varepsilon,1+\\varepsilon)\\widehat A_t\\right)",
      },
      {
        depth: 3,
        tex: "\\theta\\leftarrow\\theta+\\eta_\\pi\\nabla_\\theta L_{\\mathrm{clip}}(\\theta;B)",
        note: "Advantages and behavior-policy probabilities stay fixed through all M epochs.",
      },
      {
        depth: 3,
        tex: "\\phi\\leftarrow\\phi-\\eta_V\\nabla_\\phi\\left[\\frac1{|B|}\\sum_{t\\in B}(V_\\phi(s_t)-\\widehat R_t)^2\\right]",
      },
      { depth: 2, tex: "\\text{end}" },
      { depth: 1, tex: "\\text{end}" },
      {
        depth: 1,
        tex: "\\theta_{k+1}\\leftarrow\\theta,\\quad\\phi_{k+1}\\leftarrow\\phi",
      },
      { depth: 0, tex: "\\text{end}" },
    ],
    symbols: [
      { symbol: "𝓔", meaning: "Environment" },
      { symbol: "𝒟", meaning: "Collected rollout data" },
      { symbol: "π", meaning: "Stochastic policy" },
      {
        symbol: "θ",
        meaning:
          "Policy parameters; θₖ is the fixed behavior policy during update k",
      },
      { symbol: "V", meaning: "State-value function" },
      { symbol: "φ", meaning: "Value-function parameters" },
      { symbol: "K", meaning: "Number of outer updates" },
      {
        symbol: "T",
        meaning: "Trajectory length; Tₘₐₓ is the rollout horizon",
      },
      { symbol: "M", meaning: "Optimization epochs per collected batch" },
      { symbol: "B", meaning: "Minibatch of collected transitions" },
      { symbol: "d", meaning: "Terminal-transition indicator" },
      { symbol: "δ", meaning: "Temporal-difference residual" },
      { symbol: "Â", meaning: "Generalized advantage estimate" },
      {
        symbol: "R̂",
        meaning: "Value target formed from the advantage estimate",
      },
      {
        symbol: "ρ",
        meaning: "Candidate-to-behavior action probability ratio",
      },
      { symbol: "L", meaning: "Clipped surrogate objective" },
      { symbol: "γ", meaning: "Reward discount factor" },
      { symbol: "λ", meaning: "GAE trace parameter" },
      { symbol: "γλ", meaning: "Discount factor times GAE trace parameter" },
      { symbol: "ε", meaning: "PPO clipping range" },
      { symbol: "η", meaning: "Actor or critic step size" },
    ],
  },
  '["SAC",null]': {
    title: "Soft Actor-Critic",
    family: "Off-policy · maximum entropy",
    input:
      "\\mathcal D,\\ \\pi_{\\theta_0},\\ Q_{\\phi_{1,0}},\\ Q_{\\phi_{2,0}},\\ Q_{\\bar\\phi_{1,0}},\\ Q_{\\bar\\phi_{2,0}},\\ K,\\ m,\\ \\alpha,\\ \\gamma,\\ \\tau,\\ \\eta_\\pi,\\ \\eta_Q",
    output:
      "\\pi_{\\theta_K},\\ Q_{\\phi_{1,K}},\\ Q_{\\phi_{2,K}},\\ Q_{\\bar\\phi_{1,K}},\\ Q_{\\bar\\phi_{2,K}}",
    lines: [
      { depth: 0, tex: "\\text{for }k=0,\\ldots,K-1\\text{ do}" },
      {
        depth: 1,
        tex: "\\text{Sample }B=\\{(s_j,a_j,r_j,s'_j,d_j)\\}_{j=1}^{m}\\text{ from }\\mathcal D",
      },
      { depth: 1, tex: "\\text{for }j=1,\\ldots,m\\text{ do}" },
      { depth: 2, tex: "a'_j\\sim\\pi_{\\theta_k}(\\cdot\\mid s'_j)" },
      {
        depth: 2,
        tex: "y_j\\leftarrow r_j+\\gamma(1-d_j)\\left[\\min_{i\\in\\{1,2\\}}Q_{\\bar\\phi_{i,k}}(s'_j,a'_j)-\\alpha\\log\\pi_{\\theta_k}(a'_j\\mid s'_j)\\right]",
        note: "Hold the soft Bellman target fixed when differentiating critic losses.",
      },
      { depth: 1, tex: "\\text{end}" },
      { depth: 1, tex: "\\text{for }i\\in\\{1,2\\}\\text{ do}" },
      {
        depth: 2,
        tex: "\\phi_{i,k+1}\\leftarrow\\phi_{i,k}-\\eta_Q\\nabla_{\\phi_i}\\left[\\frac1m\\sum_{j=1}^{m}(Q_{\\phi_i}(s_j,a_j)-y_j)^2\\right]_{\\phi_i=\\phi_{i,k}}",
      },
      { depth: 1, tex: "\\text{end}" },
      {
        depth: 1,
        tex: "a_j(\\theta)\\sim\\pi_\\theta(\\cdot\\mid s_j)\\quad(j=1,\\ldots,m)",
        note: "Use reparameterized policy samples so actor gradients pass through sampled actions.",
      },
      {
        depth: 1,
        tex: "J_\\pi(\\theta)\\leftarrow\\frac1m\\sum_{j=1}^{m}\\left[\\alpha\\log\\pi_\\theta(a_j(\\theta)\\mid s_j)-\\min_{i\\in\\{1,2\\}}Q_{\\phi_{i,k+1}}(s_j,a_j(\\theta))\\right]",
      },
      {
        depth: 1,
        tex: "\\theta_{k+1}\\leftarrow\\theta_k-\\eta_\\pi\\nabla_\\theta J_\\pi(\\theta)\\big|_{\\theta=\\theta_k}",
      },
      { depth: 1, tex: "\\text{for }i\\in\\{1,2\\}\\text{ do}" },
      {
        depth: 2,
        tex: "\\bar\\phi_{i,k+1}\\leftarrow\\tau\\phi_{i,k+1}+(1-\\tau)\\bar\\phi_{i,k}",
      },
      { depth: 1, tex: "\\text{end}" },
      { depth: 0, tex: "\\text{end}" },
    ],
    symbols: [
      { symbol: "𝒟", meaning: "Replay buffer" },
      { symbol: "J", meaning: "Actor objective" },
      { symbol: "B", meaning: "Minibatch sampled from replay" },
      { symbol: "π", meaning: "Stochastic actor policy" },
      { symbol: "θ", meaning: "Actor parameters" },
      { symbol: "Q", meaning: "Action-value critic" },
      {
        symbol: "φ",
        meaning: "Critic parameters; a bar marks target-critic parameters",
      },
      { symbol: "φ̄", meaning: "Target-critic parameters" },
      { symbol: "K", meaning: "Number of update iterations" },
      { symbol: "m", meaning: "Minibatch size" },
      { symbol: "d", meaning: "Terminal-transition indicator" },
      { symbol: "y", meaning: "Soft Bellman target" },
      {
        symbol: "α",
        meaning: "Fixed entropy temperature in this reference formulation",
      },
      { symbol: "γ", meaning: "Reward discount factor" },
      { symbol: "τ", meaning: "Polyak target-update rate" },
      { symbol: "η", meaning: "Actor or critic step size" },
    ],
  },
};

// Explicit demonstration versions, derived from the reference records above.
// They describe illustrative procedures, not executed training implementations.
const a2c = formulations['["A2C",null]'];
formulations['["A2C","demo-no-entropy"]'] = {
  ...a2c,
  input: a2c.input.replace(",\\ \\beta", ""),
  lines: a2c.lines.map((line) =>
    line.tex.includes("+\\beta H")
      ? {
          ...line,
          tex: line.tex.replace("+\\beta H(\\pi_\\theta(\\cdot\\mid s_t))", ""),
          note: "Treat advantages as fixed during the actor update; this variant omits entropy regularization.",
        }
      : line,
  ),
  symbols: a2c.symbols.filter(({ symbol }) => symbol !== "β" && symbol !== "H"),
};

const ppo = formulations['["PPO",null]'];
formulations['["PPO","demo-normalized"]'] = {
  ...ppo,
  lines: [
    ...ppo.lines.slice(0, 10),
    {
      depth: 1,
      tex: "\\mu\\leftarrow\\frac1{|\\mathcal D_k|}\\sum_{t\\in\\mathcal D_k}\\widehat A_t,\\quad\\sigma\\leftarrow\\sqrt{\\frac1{|\\mathcal D_k|}\\sum_{t\\in\\mathcal D_k}(\\widehat A_t-\\mu)^2}",
    },
    {
      depth: 1,
      tex: "\\widehat A_t\\leftarrow\\frac{\\widehat A_t-\\mu}{\\sigma+10^{-8}}\\quad(t\\in\\mathcal D_k)",
      note: "Normalize over the collected batch after computing value targets; keep the normalized advantages fixed during optimization.",
    },
    ...ppo.lines.slice(10),
  ],
  symbols: [
    ...ppo.symbols,
    { symbol: "μ", meaning: "Mean advantage over the collected batch" },
    {
      symbol: "σ",
      meaning: "Population standard deviation of batch advantages",
    },
  ],
};

// Automatic temperature: entropy-constrained SAC, https://arxiv.org/abs/1812.05905.
const sac = formulations['["SAC",null]'];
formulations['["SAC","demo-auto-temperature"]'] = {
  ...sac,
  input: sac.input
    .replace("\\alpha,", "\\zeta_0,\\ \\bar H,")
    .concat(",\\ \\eta_\\alpha"),
  output: sac.output.concat(",\\ \\alpha_K"),
  lines: [
    sac.lines[0],
    { depth: 1, tex: "\\alpha_k\\leftarrow\\exp(\\zeta_k)" },
    ...sac.lines.slice(1, 12).map((line) => ({
      ...line,
      tex: line.tex.replaceAll("\\alpha", "\\alpha_k"),
    })),
    {
      depth: 1,
      tex: "J_\\alpha(\\zeta)\\leftarrow-\\frac1m\\sum_{j=1}^{m}\\exp(\\zeta)\\left[\\log\\pi_{\\theta_k}(a_j(\\theta_k)\\mid s_j)+\\bar H\\right]",
      note: "Use the current actor samples and hold log probabilities fixed in the temperature update. This is the exponential-parameterized dual objective.",
    },
    {
      depth: 1,
      tex: "\\zeta_{k+1}\\leftarrow\\zeta_k-\\eta_\\alpha\\nabla_\\zeta J_\\alpha(\\zeta)\\big|_{\\zeta=\\zeta_k},\\quad\\alpha_{k+1}\\leftarrow\\exp(\\zeta_{k+1})",
    },
    ...sac.lines.slice(12),
  ],
  symbols: [
    ...sac.symbols.map((symbol) =>
      symbol.symbol === "α"
        ? { ...symbol, meaning: "Learned positive entropy temperature" }
        : symbol.symbol === "J"
          ? {
              ...symbol,
              meaning: "Actor objective or temperature dual objective",
            }
          : symbol.symbol === "η"
            ? { ...symbol, meaning: "Actor, critic or temperature step size" }
            : symbol,
    ),
    { symbol: "ζ", meaning: "Log entropy temperature" },
    { symbol: "H", meaning: "Target policy entropy (barred H)" },
  ],
};
