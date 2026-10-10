// Authored, hypothetical DQN reference. No training implementation or outputs.
const math = (math) => ({ math });
const keyword = (keyword) => ({ keyword });
const line = (...content) => ({ kind: "line", content });
const equation = (math) => ({ kind: "equation", math });
const block = (header, body) => ({ kind: "block", header, body });
const call = (call) => ({ call });
const parameters = (tex) => [math(tex)];

export const dqnModules = [
  {
    id: "dqn",
    number: 5,
    title: "DQN",
    input: parameters(
      String.raw`\theta_0,\mathcal E,\mathcal A,K,N,M,C,\gamma,\varepsilon,\alpha`,
    ),
    output: parameters(String.raw`Q_\theta`),
    notes: [],
    body: [
      line(
        math(
          String.raw`\theta\leftarrow\theta_0,\quad\theta^-\leftarrow\theta_0,\quad\mathcal R\leftarrow\varnothing`,
        ),
      ),
      line(math(String.raw`s\leftarrow\operatorname{Reset}(\mathcal E)`)),
      block(
        [keyword("for "), math(String.raw`k=1,\ldots,K`), keyword(" do")],
        [
          line(
            math(String.raw`(s,\mathcal R)\leftarrow`),
            call("dqn-interaction"),
            math(
              String.raw`(\theta,\mathcal E,\mathcal A,s,\mathcal R,N,\varepsilon)`,
            ),
          ),
          block(
            [
              keyword("if "),
              math(String.raw`|\mathcal R|\ge M`),
              keyword(" then"),
            ],
            [
              line(
                math(String.raw`\theta\leftarrow`),
                call("dqn-update"),
                math(
                  String.raw`(\theta,\theta^-,\mathcal R,\mathcal A,M,\gamma,\alpha)`,
                ),
              ),
            ],
          ),
          block(
            [keyword("if "), math(String.raw`k\bmod C=0`), keyword(" then")],
            [
              {
                ...line(math(String.raw`\theta^-\leftarrow\theta`)),
                note: "Copy the online weights into the target network every C environment steps; hold target weights fixed between copies.",
              },
            ],
          ),
        ],
      ),
    ],
  },
  {
    id: "dqn-interaction",
    number: 6,
    title: "DQN Interaction",
    input: parameters(
      String.raw`\theta,\mathcal E,\mathcal A,s,\mathcal R,N,\varepsilon`,
    ),
    output: parameters(String.raw`(s,\mathcal R)`),
    notes: [],
    body: [
      line(
        math(
          String.raw`s_t\leftarrow s,\quad u\sim\operatorname{Uniform}(0,1)`,
        ),
      ),
      equation(
        String.raw`a_t\leftarrow\begin{cases}a,\ a\sim\operatorname{Uniform}(\mathcal A),&u<\varepsilon,\\ \arg\max_{a\in\mathcal A}Q_\theta(s_t,a),&u\ge\varepsilon.\end{cases}`,
      ),
      line(
        math(
          String.raw`(r_t,s'_t,d_t,\xi_t)\leftarrow\operatorname{Step}(\mathcal E,a_t)`,
        ),
      ),
      {
        ...line(
          math(
            String.raw`\mathcal R\leftarrow\operatorname{Append}_N(\mathcal R,(s_t,a_t,r_t,s'_t,d_t))`,
          ),
        ),
        note: "Store the transition's final next observation before resetting. Append keeps the most recent N transitions. Only true termination disables bootstrap.",
      },
      line(math(String.raw`s\leftarrow s'_t`)),
      block(
        [keyword("if "), math(String.raw`d_t\lor\xi_t`), keyword(" then")],
        [line(math(String.raw`s\leftarrow\operatorname{Reset}(\mathcal E)`))],
      ),
    ],
  },
  {
    id: "dqn-update",
    number: 7,
    title: "DQN Replay Update",
    input: parameters(
      String.raw`\theta,\theta^-,\mathcal R,\mathcal A,M,\gamma,\alpha`,
    ),
    output: parameters(String.raw`\theta`),
    notes: [],
    body: [
      line(
        math(
          String.raw`\mathcal B=\{(s_i,a_i,r_i,s'_i,d_i)\}_{i=1}^{M}\sim\operatorname{Sample}(\mathcal R,M)`,
        ),
      ),
      equation(
        String.raw`y_i\leftarrow r_i+\gamma(1-d_i)\max_{a'\in\mathcal A}Q_{\theta^-}(s'_i,a')`,
      ),
      {
        ...equation(
          String.raw`\mathcal L(\theta)=\frac{1}{2M}\sum_{i=1}^{M}\bigl(Q_\theta(s_i,a_i)-y_i\bigr)^2`,
        ),
        note: "Sample transitions uniformly from replay. Treat y as a fixed target when differentiating the online network; this is standard DQN, without Double DQN or prioritized replay.",
      },
      line(
        math(
          String.raw`\theta\leftarrow\theta-\alpha\nabla_\theta\mathcal L(\theta)`,
        ),
      ),
    ],
  },
];

export const dqnSymbols = [
  {
    id: "target-parameters",
    tex: String.raw`\theta^-`,
    description: "Frozen target Q-network parameters.",
  },
  {
    id: "q-network",
    tex: "Q",
    description:
      "Action-value network estimating discounted return for a state and action.",
  },
  {
    id: "replay-memory",
    tex: String.raw`\mathcal R`,
    description:
      "Replay buffer storing transitions from previous interactions.",
  },
  {
    id: "environment",
    tex: String.raw`\mathcal E`,
    description: "Environment used for interaction.",
  },
  {
    id: "action-space",
    tex: String.raw`\mathcal A`,
    description: "Finite set of available actions.",
  },
  {
    id: "replay-capacity",
    tex: "N",
    description: "Maximum number of transitions retained in replay memory.",
  },
  {
    id: "target-period",
    tex: "C",
    description: "Number of environment steps between target-network copies.",
  },
  {
    id: "exploration",
    tex: String.raw`\varepsilon`,
    description: "Probability of selecting a uniformly random action.",
  },
  {
    id: "random-draw",
    tex: "u",
    description:
      "Uniform random draw used for epsilon-greedy action selection.",
  },
  {
    id: "dqn-termination",
    tex: "d",
    description:
      "True terminal-state indicator; artificial time limits do not count as termination.",
  },
  {
    id: "dqn-truncation",
    tex: String.raw`\xi`,
    description:
      "Artificial truncation indicator, such as an environment time limit.",
  },
  {
    id: "bellman-target",
    tex: "y",
    description:
      "One-step Bellman target computed using the frozen target network.",
  },
  {
    id: "dqn-loss",
    tex: String.raw`\mathcal L`,
    description:
      "Mean squared Bellman error minimized by the online Q-network.",
  },
];
