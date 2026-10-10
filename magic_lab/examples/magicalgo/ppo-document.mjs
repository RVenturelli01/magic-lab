// Authored, hypothetical PPO document. No training is implemented or executed.
import { writeFile } from "node:fs/promises";
import { dqnModules, dqnSymbols } from "./dqn-document.mjs";
const text = (text) => ({ text });
const math = (math) => ({ math });
const keyword = (keyword) => ({ keyword });
const call = (call) => ({ call });
const line = (...content) => ({ kind: "line", content });
const equation = (math) => ({ kind: "equation", math });
const block = (header, body) => ({ kind: "block", header, body });
const comment = (text) => ({ kind: "comment", text });
const parameters = (...values) =>
  values.flatMap((value, i) => [...(i ? [text(", ")] : []), math(value)]);
const catalog = {
  version: 2,
  name: "PPO · modular reference",
  hypothetical: true,
  root: "ppo",
  pendingAlgorithms: [
    { id: "sac", title: "SAC" },
    { id: "td3", title: "TD3" },
  ],
  algorithms: [
    {
      id: "ppo",
      number: 1,
      title: "PPO",
      input: parameters(
        String.raw`\theta_0`,
        "w_0",
        "K",
        String.raw`\widetilde K`,
        "M",
        String.raw`\{\mathcal E_e\}_{e=1}^{N_e}`,
        "T",
        String.raw`\gamma`,
        String.raw`\lambda`,
        String.raw`\epsilon`,
        "c_1",
        "c_2",
        String.raw`\alpha`,
      ),
      output: [math(String.raw`\pi_{\theta_K}`)],
      body: [
        line(math(String.raw`\theta\leftarrow\theta_0,\quad w\leftarrow w_0`)),
        block(
          [keyword("for "), math("k=1,\\ldots,K"), keyword(" do")],
          [
            comment("Data Collection"),
            line(
              math(String.raw`\mathcal D_k\leftarrow`),
              call("collect"),
              math(
                String.raw`\left(\pi_\theta,V_w,\{\mathcal E_e\}_{e=1}^{N_e},T,\gamma,\lambda\right)`,
              ),
            ),
            comment("Multi-Epoch Optimization"),
            line(
              math(String.raw`(\theta,w)\leftarrow`),
              call("optimize"),
              math(
                String.raw`\left(\theta,w,\mathcal D_k,\widetilde K,M,\epsilon,c_1,c_2,\alpha\right)`,
              ),
            ),
            line(math(String.raw`\theta_k\leftarrow\theta`)),
          ],
        ),
      ],
      notes: [],
    },
    {
      id: "collect",
      number: 2,
      title: "On-Policy Data Collection",
      input: parameters(
        String.raw`\pi_\theta`,
        "V_w",
        String.raw`\{\mathcal E_e\}_{e=1}^{N_e}`,
        "T",
        String.raw`\gamma`,
        String.raw`\lambda`,
      ),
      output: [math(String.raw`\mathcal D`)],
      body: [
        line(math(String.raw`\mathcal D\leftarrow\varnothing`)),
        block(
          [keyword("for "), math("e=1,\\ldots,N_e"), keyword(" do")],
          [
            line(
              math(
                String.raw`\mathcal D_e\leftarrow\varnothing,\quad s\leftarrow\operatorname{Reset}(\mathcal E_e)`,
              ),
            ),
            comment("Interaction"),
            block(
              [keyword("for "), math("t=1,\\ldots,T"), keyword(" do")],
              [
                line(
                  math(
                    String.raw`s_t\leftarrow s,\quad a_t\sim\pi_\theta(\cdot\mid s_t)`,
                  ),
                ),
                line(
                  math(
                    String.raw`(r_t,s'_t,d_t^{\mathrm{term}},d_t^{\mathrm{trunc}})\leftarrow\operatorname{Step}(\mathcal E_e,a_t)`,
                  ),
                ),
                line(
                  math(
                    String.raw`b_t\leftarrow1-d_t^{\mathrm{term}},\quad c_t\leftarrow1-\max(d_t^{\mathrm{term}},d_t^{\mathrm{trunc}})`,
                  ),
                ),
                line(
                  math(
                    String.raw`v_t\leftarrow V_w(s_t),\quad v'_t\leftarrow V_w(s'_t),\quad\rho_t\leftarrow\log\pi_\theta(a_t\mid s_t)`,
                  ),
                ),
                line(
                  math(
                    String.raw`\mathcal D_e\leftarrow\mathcal D_e\mathbin{\|}(s_t,a_t,r_t,v_t,v'_t,\rho_t,b_t,c_t)`,
                  ),
                ),
                line(math(String.raw`s\leftarrow s'_t`)),
                block(
                  [keyword("if "), math("c_t=0"), keyword(" then")],
                  [
                    line(
                      math(
                        String.raw`s\leftarrow\operatorname{Reset}(\mathcal E_e)`,
                      ),
                    ),
                  ],
                ),
              ],
            ),
            comment("Advantage Estimation"),
            line(
              math(String.raw`(\widehat A,\widehat R)\leftarrow`),
              call("gae"),
              math(String.raw`(\mathcal D_e,\gamma,\lambda)`),
            ),
            line(
              math(
                String.raw`\mathcal D\leftarrow\mathcal D\mathbin{\|}\left\{(s_t,a_t,\rho_t,\widehat A_t,\widehat R_t)\right\}_{t=1}^{T}`,
              ),
            ),
          ],
        ),
      ],
      notes: [
        "Step returns the final observation before reset. Artificial time limits use bootstrap mask b = 1 and trace mask c = 0.",
        "The policy and value parameters remain fixed throughout collection. The append operator preserves transition order.",
      ],
    },
    {
      id: "optimize",
      number: 3,
      title: "PPO Optimization",
      input: parameters(
        String.raw`\theta`,
        "w",
        String.raw`\mathcal D`,
        String.raw`\widetilde K`,
        "M",
        String.raw`\epsilon`,
        "c_1",
        "c_2",
        String.raw`\alpha`,
      ),
      output: [math(String.raw`(\theta,w)`)],
      body: [
        block(
          [
            keyword("for "),
            math(String.raw`j=1,\ldots,\widetilde K`),
            keyword(" do"),
          ],
          [
            line(
              math(
                String.raw`\widetilde{\mathcal D}\leftarrow\operatorname{Partition}\!\left(\operatorname{Permute}(\mathcal D),M\right)`,
              ),
            ),
            block(
              [
                keyword("for "),
                math(String.raw`\mathcal B\in\widetilde{\mathcal D}`),
                keyword(" do"),
              ],
              [
                comment("Clipped Surrogate"),
                equation(
                  String.raw`q_i(\theta)=\exp\!\left(\log\pi_\theta(a_i\mid s_i)-\rho_i\right)`,
                ),
                equation(
                  String.raw`L_i^{\mathrm{clip}}(\theta)=\min\!\left\{q_i(\theta)\widehat A_i,\ \operatorname{clip}\!\left(q_i(\theta),1-\epsilon,1+\epsilon\right)\widehat A_i\right\}`,
                ),
                comment("Value Loss"),
                equation(
                  String.raw`L_i^{\mathrm{vf}}(w)=\frac12\left(V_w(s_i)-\widehat R_i\right)^2`,
                ),
                comment("Joint Objective"),
                equation(
                  String.raw`\widehat L(\theta,w)=\frac1{|\mathcal B|}\sum_{i\in\mathcal B}\left[L_i^{\mathrm{clip}}(\theta)-c_1L_i^{\mathrm{vf}}(w)+c_2H\!\left(\pi_\theta(\cdot\mid s_i)\right)\right]`,
                ),
                comment("Gradient Ascent"),
                equation(
                  String.raw`(\theta,w)\leftarrow(\theta,w)+\alpha\left(\nabla_\theta\widehat L(\theta,w),\,\nabla_w\widehat L(\theta,w)\right)`,
                ),
              ],
            ),
          ],
        ),
      ],
      notes: [
        "The stored log-probabilities, advantages and return targets are held constant across all epochs. Gradients update separate actor and critic parameters simultaneously.",
        "Partition produces disjoint minibatches with 0 < |B| ≤ M. H denotes policy entropy. This reference uses gradient ascent; advantage normalization, Adam, value clipping and KL early stopping are omitted.",
      ],
    },
    {
      id: "gae",
      number: 4,
      title: "Generalized Advantage Estimation",
      input: parameters(
        String.raw`\mathcal D_e=\{(s_t,a_t,r_t,v_t,v'_t,\rho_t,b_t,c_t)\}_{t=1}^{T}`,
        String.raw`\gamma`,
        String.raw`\lambda`,
      ),
      output: [math(String.raw`\{(\widehat A_t,\widehat R_t)\}_{t=1}^{T}`)],
      body: [
        line(math(String.raw`\widehat A_{T+1}\leftarrow0`)),
        block(
          [keyword("for "), math("t=T,T-1,\\ldots,1"), keyword(" do")],
          [
            line(math(String.raw`\delta_t\leftarrow r_t+\gamma b_t v'_t-v_t`)),
            line(
              math(
                String.raw`\widehat A_t\leftarrow\delta_t+\gamma\lambda c_t\widehat A_{t+1}`,
              ),
            ),
            line(math(String.raw`\widehat R_t\leftarrow\widehat A_t+v_t`)),
          ],
        ),
      ],
      notes: [
        "Each environment has a separate backward trace. Rollout-end bootstrap is included through the stored next-state value; the residual trace beyond T is zero.",
      ],
    },
  ],
};
const symbol = (id, tex, description) => ({ id, tex, description });
catalog.symbols = [
  symbol(
    "theta-initial",
    String.raw`\theta_0`,
    "Initial trainable network parameters.",
  ),
  symbol(
    "theta-final",
    String.raw`\theta_K`,
    "Actor parameters after K training iterations.",
  ),
  symbol(
    "theta-iteration",
    String.raw`\theta_k`,
    "Actor parameters at the end of iteration k.",
  ),
  symbol(
    "theta",
    String.raw`\theta`,
    "Trainable actor or online Q-network parameters.",
  ),
  symbol("w-initial", "w_0", "Initial critic parameter vector."),
  symbol("w", "w", "Critic parameter vector defining the value function."),
  symbol(
    "epochs",
    String.raw`\widetilde K`,
    "Number of optimization epochs per collected rollout.",
  ),
  symbol("iterations", "K", "Total number of training iterations."),
  symbol("batch-size", "M", "Maximum number of samples in each minibatch."),
  symbol("environments", String.raw`\mathcal E_e`, "Environment e."),
  symbol("environment-count", "N_e", "Number of environments."),
  symbol(
    "horizon",
    "T",
    "Number of interaction steps collected per environment.",
  ),
  symbol("discount", String.raw`\gamma`, "Discount factor for future rewards."),
  symbol(
    "trace",
    String.raw`\lambda`,
    "GAE trace parameter controlling the bias–variance tradeoff.",
  ),
  symbol(
    "clip",
    String.raw`\epsilon`,
    "PPO probability-ratio clipping parameter.",
  ),
  symbol("value-weight", "c_1", "Coefficient of the value-function loss."),
  symbol("entropy-weight", "c_2", "Coefficient of the policy entropy bonus."),
  symbol(
    "learning-rate",
    String.raw`\alpha`,
    "Learning rate for the parameter update.",
  ),
  symbol(
    "policy",
    String.raw`\pi`,
    "Policy: the conditional probability distribution over actions.",
  ),
  symbol(
    "value",
    "V_w",
    "Critic: the estimated discounted return from a state.",
  ),
  symbol(
    "batch-collection",
    String.raw`\widetilde{\mathcal D}`,
    "Shuffled rollout partitioned into minibatches.",
  ),
  symbol(
    "rollout-iteration",
    String.raw`\mathcal D_k`,
    "On-policy rollout collected at training iteration k.",
  ),
  symbol(
    "rollout-local",
    String.raw`\mathcal D_e`,
    "Ordered transition buffer for environment e.",
  ),
  symbol(
    "rollout",
    String.raw`\mathcal D`,
    "Collected on-policy samples used for optimization.",
  ),
  symbol(
    "minibatch",
    String.raw`\mathcal B`,
    "Current minibatch of rollout or replay samples.",
  ),
  symbol(
    "state-next",
    "s'_t",
    "Final next observation from the transition, before any reset.",
  ),
  symbol("state", "s", "Environment state or observation."),
  symbol("action", "a", "Action sampled from the policy."),
  symbol("reward", "r", "Reward returned by the environment."),
  symbol(
    "value-next",
    "v'_t",
    "Critic prediction at the final next observation.",
  ),
  symbol(
    "value-estimate",
    "v",
    "Critic prediction stored during data collection.",
  ),
  symbol(
    "log-prob",
    String.raw`\rho`,
    "Action log-probability under the policy that collected the rollout.",
  ),
  symbol(
    "terminated",
    String.raw`d_t^{\mathrm{term}}`,
    "True terminal-state indicator: 1 at an MDP termination.",
  ),
  symbol(
    "truncated",
    String.raw`d_t^{\mathrm{trunc}}`,
    "Artificial truncation indicator, such as a time limit.",
  ),
  symbol(
    "bootstrap",
    "b",
    "Bootstrap mask: zero at a true terminal state, one otherwise.",
  ),
  symbol(
    "continuation",
    "c",
    "Trace-continuation mask: zero at every episode boundary.",
  ),
  symbol(
    "advantage",
    String.raw`\widehat A`,
    "Estimated advantage: return relative to the critic's baseline.",
  ),
  symbol(
    "return-target",
    String.raw`\widehat R`,
    "Fixed return target used to train the critic.",
  ),
  symbol(
    "td-residual",
    String.raw`\delta`,
    "One-step temporal-difference residual.",
  ),
  symbol(
    "ratio",
    "q",
    "Ratio of current action probability to rollout-time action probability.",
  ),
  symbol(
    "policy-loss",
    String.raw`L_i^{\mathrm{clip}}`,
    "Clipped PPO surrogate for sample i.",
  ),
  symbol(
    "value-loss",
    String.raw`L_i^{\mathrm{vf}}`,
    "Squared value-prediction loss for sample i.",
  ),
  symbol(
    "objective",
    String.raw`\widehat L`,
    "Joint objective maximized by actor and critic updates.",
  ),
  symbol("entropy", "H", "Entropy of the policy's action distribution."),
  symbol(
    "step-index",
    "t",
    "Interaction timestep within one environment rollout.",
  ),
  symbol("sample-index", "i", "Sample index within the current minibatch."),
  symbol("iteration-index", "k", "Training iteration index."),
  symbol("epoch-index", "j", "Optimization epoch index."),
  symbol("environment-index", "e", "Environment index."),
];
function find(nodes, match) {
  for (const node of nodes) {
    if (match(node)) return node;
    const child = node.body && find(node.body, match);
    if (child) return child;
  }
}
const moduleById = (id) => catalog.algorithms.find((a) => a.id === id);
find(moduleById("ppo").body, (n) =>
  n.content?.some((t) => t.call === "optimize"),
).note =
  "Reuse the same rollout for multiple optimization epochs; collect fresh data in the next training iteration.";
find(moduleById("collect").body, (n) =>
  n.content?.some((t) => t.math?.includes("b_t\\leftarrow")),
).note =
  "A true terminal state disables bootstrap. A time-limit truncation preserves bootstrap but stops the GAE trace.";
find(
  moduleById("optimize").body,
  (n) => n.kind === "equation" && n.math.startsWith("L_i"),
).note =
  "Clipping limits the surrogate's incentive for large probability-ratio changes; it is not a hard KL constraint.";
find(moduleById("gae").body, (n) =>
  n.content?.some((t) => t.math?.includes("A_{T+1}")),
).note =
  "The residual trace beyond the rollout is zero. Bootstrap from the final next observation is already included in the TD residual.";
for (const module of catalog.algorithms) module.notes = [];
catalog.algorithms.push(...dqnModules);
catalog.symbols.push(...dqnSymbols);
catalog.name = "PPO and DQN · modular references";
await writeFile(
  new URL("./algorithms.json", import.meta.url),
  JSON.stringify(catalog, null, 2) + "\n",
);
console.log(
  "Authored PPO and DQN references: 2 main algorithms and 5 submodules; no training executed.",
);
