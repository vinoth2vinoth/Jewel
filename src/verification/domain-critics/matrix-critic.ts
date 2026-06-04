import * as ts from 'typescript';

interface MatrixVar {
  name: string;
  rows: number;
  cols: number;
}

export function runMatrixCritic(content: string, filename: string): { status: 'PASS' | 'FAIL'; verdict?: string; reason?: string } {
  const sourceFile = ts.createSourceFile(filename, content, ts.ScriptTarget.Latest, true);
  const matrices: Map<string, MatrixVar> = new Map();
  const errors: string[] = [];

  function visit(node: ts.Node) {
    // 1. Find matrix instantiations: const m1 = new Matrix([[1, 2], [3, 4]]);
    if (ts.isVariableDeclaration(node) && node.initializer && ts.isNewExpression(node.initializer)) {
      const init = node.initializer;
      if (ts.isIdentifier(init.expression) && init.expression.text === 'Matrix' && init.arguments && init.arguments.length > 0) {
        const arg = init.arguments[0];
        if (ts.isArrayLiteralExpression(arg)) {
          // Parse rows and cols
          const rows = arg.elements.length;
          let cols = 0;
          if (rows > 0 && ts.isArrayLiteralExpression(arg.elements[0])) {
            cols = arg.elements[0].elements.length;
          }
          if (ts.isIdentifier(node.name)) {
            matrices.set(node.name.text, { name: node.name.text, rows, cols });
          }
        }
      }
    }

    // 2. Look for multiply calls inside or outside assert.throws
    if (ts.isCallExpression(node)) {
      const exp = node.expression;
      
      // Is it assert.throws?
      let isAssertThrows = false;
      if (ts.isPropertyAccessExpression(exp) && ts.isIdentifier(exp.expression) && exp.expression.text === 'assert' && exp.name.text === 'throws') {
        isAssertThrows = true;
      } else if (ts.isIdentifier(exp) && exp.text === 'throws') {
        isAssertThrows = true;
      }

      if (isAssertThrows && node.arguments && node.arguments.length > 0) {
        // Look inside the function/arrow function passed to assert.throws
        const firstArg = node.arguments[0];
        if (ts.isArrowFunction(firstArg) || ts.isFunctionExpression(firstArg)) {
          const checkMultiply = (child: ts.Node) => {
            if (ts.isCallExpression(child) && ts.isPropertyAccessExpression(child.expression) && child.expression.name.text === 'multiply') {
              const obj = child.expression.expression;
              const arg = child.arguments[0];
              if (ts.isIdentifier(obj) && ts.isIdentifier(arg)) {
                const matA = matrices.get(obj.text);
                const matB = matrices.get(arg.text);
                if (matA && matB) {
                  const valid = matA.cols === matB.rows;
                  if (valid) {
                    errors.push(`expecting valid matrix multiplication ${matA.rows}x${matA.cols} * ${matB.rows}x${matB.cols} to throw`);
                  }
                }
              }
            }
            ts.forEachChild(child, checkMultiply);
          };
          ts.forEachChild(firstArg.body, checkMultiply);
        }
      }

      // Is it a normal multiply call? If cols !== rows, it must throw, so if it's NOT inside assert.throws, it's a bug!
      if (ts.isPropertyAccessExpression(exp) && exp.name.text === 'multiply') {
        let parent = node.parent;
        let isWrappedInThrows = false;
        while (parent) {
          if (ts.isCallExpression(parent)) {
            const pExp = parent.expression;
            if (ts.isIdentifier(pExp) && pExp.text === 'throws') {
              isWrappedInThrows = true;
              break;
            }
            if (ts.isPropertyAccessExpression(pExp) && ts.isIdentifier(pExp.expression) && pExp.expression.text === 'assert' && pExp.name.text === 'throws') {
              isWrappedInThrows = true;
              break;
            }
          }
          parent = parent.parent;
        }

        const obj = exp.expression;
        const arg = node.arguments[0];
        if (ts.isIdentifier(obj) && ts.isIdentifier(arg)) {
          const matA = matrices.get(obj.text);
          const matB = matrices.get(arg.text);
          if (matA && matB) {
            const valid = matA.cols === matB.rows;
            if (!valid && !isWrappedInThrows) {
              errors.push(`expecting invalid matrix multiplication ${matA.rows}x${matA.cols} * ${matB.rows}x${matB.cols} to pass`);
            }
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (errors.length > 0) {
    return {
      status: 'FAIL',
      verdict: 'BAD_GENERATED_TEST',
      reason: `Matrix dimension rule violation: ${errors.join('; ')}`
    };
  }

  return { status: 'PASS' };
}
