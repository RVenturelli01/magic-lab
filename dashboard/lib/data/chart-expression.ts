type Resolver = (name: string) => number;
type Formula = (resolve: Resolver) => number;

/** Small arithmetic grammar; expressions never execute JavaScript. */
export function compileExpression(source: string): Formula {
  if (source.length > 2000) throw new Error("Expression is too long.");
  const tokens: string[] = [];
  let position = 0;
  while (position < source.length) {
    const rest = source.slice(position);
    const match =
      /^(\s+|\$\{[^{}\r\n]+\}|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[A-Za-z_]\w*|\*\*|[+\-*/^(),])/i.exec(
        rest,
      );
    if (!match)
      throw new Error(`Unexpected character at position ${position + 1}.`);
    position += match[0].length;
    if (match[0].trim()) tokens.push(match[0]);
    if (tokens.length > 256) throw new Error("Expression has too many terms.");
  }
  let index = 0;
  const functions: Record<
    string,
    { arity: number; call: (...values: number[]) => number }
  > = {
    abs: { arity: 1, call: Math.abs },
    sqrt: { arity: 1, call: Math.sqrt },
    log: { arity: 1, call: Math.log },
    log10: { arity: 1, call: Math.log10 },
    exp: { arity: 1, call: Math.exp },
    min: { arity: 2, call: Math.min },
    max: { arity: 2, call: Math.max },
    pow: { arity: 2, call: Math.pow },
  };
  function expression(binding = 0): Formula {
    const token = tokens[index++];
    if (!token) throw new Error("Expected a value.");
    let left: Formula;
    if (token === "+" || token === "-") {
      const child = expression(25);
      left = (resolve) => (token === "-" ? -1 : 1) * child(resolve);
    } else if (token === "(") {
      left = expression();
      if (tokens[index++] !== ")")
        throw new Error("Missing closing parenthesis.");
    } else if (/^(?:\d|\.)/.test(token)) {
      const value = Number(token);
      left = () => value;
    } else if (token.startsWith("${")) {
      const name = token.slice(2, -1).trim();
      left = (resolve) => resolve(name);
    } else if (
      ["_step", "_runtime", "_absolute_runtime", "x", "y"].includes(token)
    ) {
      left = (resolve) => resolve(token);
    } else if (Object.prototype.hasOwnProperty.call(functions, token)) {
      const fn = functions[token];
      if (tokens[index++] !== "(") throw new Error(`Use ${token}(…).`);
      const args = [expression()];
      while (tokens[index] === ",") {
        index++;
        args.push(expression());
      }
      if (tokens[index++] !== ")" || args.length !== fn.arity)
        throw new Error(`${token} expects ${fn.arity} argument(s).`);
      left = (resolve) => fn.call(...args.map((arg) => arg(resolve)));
    } else
      throw new Error(
        `Unknown variable or function: ${token}. Use \${metric/name} for metrics.`,
      );
    for (;;) {
      const op = tokens[index];
      const power =
        op === "+" || op === "-"
          ? 10
          : op === "*" || op === "/"
            ? 20
            : op === "^" || op === "**"
              ? 30
              : 0;
      if (!power || power <= binding) break;
      index++;
      const right = expression(power === 30 ? power - 1 : power);
      const previous = left;
      left = (resolve) => {
        const a = previous(resolve),
          b = right(resolve);
        return op === "+"
          ? a + b
          : op === "-"
            ? a - b
            : op === "*"
              ? a * b
              : op === "/"
                ? a / b
                : a ** b;
      };
    }
    return left;
  }
  const result = expression();
  if (index !== tokens.length)
    throw new Error(`Unexpected token: ${tokens[index]}.`);
  return result;
}

export function expressionError(source: string): string | undefined {
  if (!source.trim()) return;
  try {
    compileExpression(source);
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid expression.";
  }
}
