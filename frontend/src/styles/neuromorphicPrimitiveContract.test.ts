import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss, { type AnyNode, type AtRule, type Declaration, type Root, type Rule } from "postcss";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readRuleDeclarations(rule: Rule) {
  const declarations = new Map<string, string>();
  rule.walkDecls((declaration) => {
    declarations.set(declaration.prop, declaration.value.trim());
  });
  return declarations;
}

function readLastThemeDeclarations(root: Root, selectors: readonly string[]) {
  const matches: Rule[] = [];
  root.walkRules((rule) => {
    const ruleSelectors = rule.selectors.map((selector) => selector.trim());
    if (
      ruleSelectors.length === selectors.length &&
      ruleSelectors.every((selector, index) => selector === selectors[index])
    ) {
      matches.push(rule);
    }
  });

  const rule = matches.at(-1);
  if (!rule) {
    throw new Error(`Missing CSS selector list: ${selectors.join(", ")}`);
  }
  return readRuleDeclarations(rule);
}

function readDeclaration(declarations: Map<string, string>, name: string) {
  const value = declarations.get(name);
  expect(value, name).toBeDefined();
  return value ?? "";
}

function expectDeclarations(
  declarations: Map<string, string>,
  expected: Record<string, string>,
) {
  for (const [name, value] of Object.entries(expected)) {
    expect(readDeclaration(declarations, name)).toBe(value);
  }
}

const THEME_SELECTORS = {
  dark: [':root[data-theme="dark"]', ":root.dark"],
  light: [':root[data-theme="light"]', ":root.light"],
} as const;

const PRIMITIVE_DECLARATIONS = {
  ".neu-flat": {
    "border-color": "transparent",
    background: "var(--neu-surface-bg)",
    "background-image": "none",
    "box-shadow": "none",
  },
  ".neu-raised": {
    "border-color": "transparent",
    background: "var(--neu-raised-bg)",
    "background-image": "none",
    "box-shadow": "var(--neu-raised-shadow)",
  },
  ".neu-raised-sm": {
    "border-color": "transparent",
    background: "var(--neu-raised-bg)",
    "background-image": "none",
    "box-shadow": "var(--neu-raised-sm-shadow)",
  },
  ".neu-inset": {
    "border-color": "transparent",
    background: "var(--neu-inset-bg)",
    "background-image": "none",
    "box-shadow": "var(--neu-inset-shadow)",
  },
  ".neu-pressed": {
    "border-color": "transparent",
    background: "var(--neu-inset-bg)",
    "background-image": "none",
    "box-shadow": "var(--neu-pressed-shadow)",
  },
  ".neu-semantic-raised": {
    "border-color": "transparent",
    "background-image": "none",
    "box-shadow": "var(--neu-control-shadow)",
  },
} as const satisfies Record<string, Record<string, string>>;

function isWithinComponentsLayer(rule: Rule) {
  let parent: AnyNode | undefined = rule.parent;
  while (parent) {
    if (
      parent.type === "atrule" &&
      parent.name === "layer" &&
      parent.params.trim() === "components"
    ) {
      return true;
    }
    parent = parent.parent;
  }
  return false;
}

function assertExactDeclarations(
  selector: string,
  rule: Rule,
  expected: Record<string, string>,
) {
  const nodes = rule.nodes ?? [];
  const unexpectedNode = nodes.find((node) => node.type !== "decl" && node.type !== "comment");
  if (unexpectedNode) {
    throw new Error(`${selector} contains an unexpected ${unexpectedNode.type} node`);
  }

  const declarations = nodes.filter((node): node is Declaration => node.type === "decl");
  const seen = new Set<string>();
  for (const declaration of declarations) {
    if (seen.has(declaration.prop)) {
      throw new Error(`${selector} contains duplicate ${declaration.prop} declarations`);
    }
    seen.add(declaration.prop);

    const expectedValue = expected[declaration.prop];
    if (expectedValue === undefined) {
      throw new Error(`${selector} contains unexpected declaration ${declaration.prop}`);
    }
    if (declaration.important || declaration.value.trim() !== expectedValue) {
      throw new Error(
        `${selector} ${declaration.prop} expected ${expectedValue}, received ${declaration.value}`,
      );
    }
  }

  for (const property of Object.keys(expected)) {
    if (!seen.has(property)) {
      throw new Error(`${selector} is missing declaration ${property}`);
    }
  }
}

function assertPrimitiveContract(source: string) {
  const root = postcss.parse(source);
  const exactRules = new Map<string, Rule[]>();

  root.walkRules((rule) => {
    const selector = rule.selector.trim();
    if (selector in PRIMITIVE_DECLARATIONS) {
      exactRules.set(selector, [...(exactRules.get(selector) ?? []), rule]);
    }
  });

  for (const [selector, expected] of Object.entries(PRIMITIVE_DECLARATIONS)) {
    const rules = exactRules.get(selector) ?? [];
    if (rules.length !== 1) {
      throw new Error(`${selector} must have exactly one exact-selector rule; found ${rules.length}`);
    }

    const rule = rules[0];
    if (!isWithinComponentsLayer(rule)) {
      throw new Error(`${selector} must be within @layer components`);
    }
    assertExactDeclarations(selector, rule, expected);
  }
}

function assertPrimitiveImportOrder(source: string) {
  const root = postcss.parse(source);
  const imports = root.nodes.filter(
    (node): node is AtRule => node.type === "atrule" && node.name === "import",
  );
  const paths = imports.map((rule) => rule.params.trim());
  const tokensImport = '"./styles/tokens.css"';
  const primitiveImport = '"./styles/neuromorphic.css"';
  const tokenIndexes = paths.flatMap((path, index) => (path === tokensImport ? [index] : []));
  const primitiveIndexes = paths.flatMap((path, index) => (path === primitiveImport ? [index] : []));

  if (primitiveIndexes.length !== 1) {
    throw new Error(`${primitiveImport} must occur exactly once; found ${primitiveIndexes.length}`);
  }
  if (tokenIndexes.length !== 1 || primitiveIndexes[0] !== tokenIndexes[0] + 1) {
    throw new Error(`${primitiveImport} must occur immediately after ${tokensImport}`);
  }
}

describe("Neuromorphic contract validator regression fixtures", () => {
  it("rejects an exact primitive rule with the wrong shadow", () => {
    const css = readFileSync(resolve(__dirname, "neuromorphic.css"), "utf8");
    const wrongShadow = css.replace(
      "box-shadow: var(--neu-raised-shadow);",
      "box-shadow: var(--neu-inset-shadow);",
    );

    expect(wrongShadow).not.toBe(css);
    expect(() => assertPrimitiveContract(wrongShadow)).toThrow(/\.neu-raised.*box-shadow/);
  });

  it("rejects a primitive import that precedes the token import", () => {
    const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");
    const wrongOrder = css.replace(
      '@import "./styles/tokens.css";\n@import "./styles/neuromorphic.css";',
      '@import "./styles/neuromorphic.css";\n@import "./styles/tokens.css";',
    );

    expect(wrongOrder).not.toBe(css);
    expect(() => assertPrimitiveImportOrder(wrongOrder)).toThrow(/immediately after/);
  });

  it("ignores commented and descendant-selector lookalikes", () => {
    const css = readFileSync(resolve(__dirname, "neuromorphic.css"), "utf8");
    const lookalikes = `${css}
      /* .neu-raised { box-shadow: var(--wrong-shadow); } */
      .wrapper .neu-raised { box-shadow: var(--wrong-shadow); }
    `;

    expect(() => assertPrimitiveContract(lookalikes)).not.toThrow();
  });

  it("rejects duplicate exact primitive selectors", () => {
    const css = readFileSync(resolve(__dirname, "neuromorphic.css"), "utf8");
    const duplicate = `${css}
      @layer components {
        .neu-raised {
          border-color: transparent;
          background: var(--neu-raised-bg);
          background-image: none;
          box-shadow: var(--neu-raised-shadow);
        }
      }
    `;

    expect(() => assertPrimitiveContract(duplicate)).toThrow(/exactly one exact-selector rule/);
  });

  it("rejects extra primitive declarations", () => {
    const css = readFileSync(resolve(__dirname, "neuromorphic.css"), "utf8");
    const extraDeclaration = css.replace(
      "box-shadow: none;\n  }",
      "box-shadow: none;\n    color: red;\n  }",
    );

    expect(extraDeclaration).not.toBe(css);
    expect(() => assertPrimitiveContract(extraDeclaration)).toThrow(
      /\.neu-flat.*unexpected declaration color/,
    );
  });
});

describe("global Neuromorphic primitive contract", () => {
  it("defines the exact pure-material source tokens in the final theme blocks", () => {
    const css = readFileSync(resolve(__dirname, "tokens.css"), "utf8");
    const root = postcss.parse(css);
    const themes = {
      dark: readLastThemeDeclarations(root, THEME_SELECTORS.dark),
      light: readLastThemeDeclarations(root, THEME_SELECTORS.light),
    };
    const expected = {
      dark: { surface: "#2d3748", shadowDark: "#1a202c", shadowLight: "#4a5568" },
      light: { surface: "#e0e5ec", shadowDark: "#bec3c9", shadowLight: "#ffffff" },
    } as const;
    const shared = {
      "--neu-bg-primary": "var(--neu-surface-bg)",
      "--neu-bg-secondary": "var(--neu-surface-bg)",
      "--neu-primary": "#6366f1",
      "--neu-primary-dark": "#4f46e5",
      "--neu-raised-bg": "var(--neu-surface-bg)",
      "--neu-inset-bg": "var(--neu-surface-bg)",
      "--surface-page-gradient": "var(--neu-surface-bg)",
      "--neu-raised-shadow": "8px 8px 16px var(--neu-shadow-dark), -8px -8px 16px var(--neu-shadow-light)",
      "--neu-raised-sm-shadow": "4px 4px 8px var(--neu-shadow-dark), -4px -4px 8px var(--neu-shadow-light)",
      "--neu-inset-shadow": "inset 4px 4px 8px var(--neu-shadow-dark), inset -4px -4px 8px var(--neu-shadow-light)",
      "--neu-pressed-shadow": "inset 2px 2px 4px var(--neu-shadow-dark), inset -2px -2px 4px var(--neu-shadow-light)",
    };

    for (const themeName of ["dark", "light"] as const) {
      expectDeclarations(themes[themeName], {
        ...shared,
        "--neu-surface-bg": expected[themeName].surface,
        "--neu-shadow-dark": expected[themeName].shadowDark,
        "--neu-shadow-light": expected[themeName].shadowLight,
      });
    }
  });

  it("provides flat, raised, inset, pressed, and semantic component primitives", () => {
    const css = readFileSync(resolve(__dirname, "neuromorphic.css"), "utf8");

    expect(() => assertPrimitiveContract(css)).not.toThrow();
  });

  it("imports the primitive layer exactly once immediately after theme tokens", () => {
    const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

    expect(() => assertPrimitiveImportOrder(css)).not.toThrow();
  });
});
