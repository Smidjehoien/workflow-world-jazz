import builtinModules from 'builtin-modules';
import { findFunctionCalls, getDirective, isAsyncFunction } from './utils';

type TypeScriptLib = typeof import('typescript/lib/tsserverlibrary');
type Program = import('typescript/lib/tsserverlibrary').Program;
type Diagnostic = import('typescript/lib/tsserverlibrary').Diagnostic;
type Node = import('typescript/lib/tsserverlibrary').Node;
type FunctionLikeDeclaration =
  import('typescript/lib/tsserverlibrary').FunctionLikeDeclaration;
type CallExpression = import('typescript/lib/tsserverlibrary').CallExpression;

export function getCustomDiagnostics(
  fileName: string,
  program: Program,
  ts: TypeScriptLib
): Diagnostic[] {
  const sourceFile = program.getSourceFile(fileName);
  if (!sourceFile) {
    return [];
  }

  const diagnostics: Diagnostic[] = [];
  const typeChecker = program.getTypeChecker();

  function visit(node: Node) {
    // Check function declarations for workflow/step directives
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isArrowFunction(node) ||
      ts.isFunctionExpression(node)
    ) {
      const directive = getDirective(node, sourceFile, ts);

      if (directive === 'use workflow') {
        checkWorkflowFunction(node);
      } else if (directive === 'use step') {
        checkStepFunction(node);
      }
    }

    ts.forEachChild(node, visit);
  }

  function checkWorkflowFunction(node: FunctionLikeDeclaration) {
    // Ensure it's async
    if (!isAsyncFunction(node, typeChecker, ts)) {
      const start = node.getStart(sourceFile);
      const length = node.getWidth(sourceFile);
      diagnostics.push({
        file: sourceFile,
        start,
        length,
        messageText: 'Workflow functions must be async or return a Promise',
        category: ts.DiagnosticCategory.Error,
        code: 9001,
      });
    }

    // Check for disallowed API usage
    if (node.body) {
      const calls = findFunctionCalls(node.body, sourceFile, ts);
      for (const call of calls) {
        checkDisallowedApiUsage(call);
      }
    }
  }

  function checkStepFunction(node: FunctionLikeDeclaration) {
    // Ensure it's async
    if (!isAsyncFunction(node, typeChecker, ts)) {
      const start = node.getStart(sourceFile);
      const length = node.getWidth(sourceFile);
      diagnostics.push({
        file: sourceFile,
        start,
        length,
        messageText: 'Step functions must be async or return a Promise',
        category: ts.DiagnosticCategory.Error,
        code: 9002,
      });
    }
  }

  function checkSymbolForDisallowedModule(
    symbol: import('typescript/lib/tsserverlibrary').Symbol | undefined,
    callNode: CallExpression
  ) {
    if (!symbol) {
      return;
    }

    const declarations = symbol.getDeclarations();
    if (!declarations || declarations.length === 0) {
      return;
    }

    for (const decl of declarations) {
      if (!decl) {
        continue;
      }

      // Check if it's an import declaration
      if (
        ts.isImportClause(decl) ||
        ts.isImportSpecifier(decl) ||
        ts.isNamespaceImport(decl)
      ) {
        // ImportClause: parent is ImportDeclaration
        // ImportSpecifier: parent is NamedImports, parent.parent is ImportClause, parent.parent.parent is ImportDeclaration
        // NamespaceImport: parent is ImportClause, parent.parent is ImportDeclaration
        let importDecl:
          | import('typescript/lib/tsserverlibrary').ImportDeclaration
          | undefined;
        if (ts.isImportClause(decl)) {
          importDecl =
            decl.parent as import('typescript/lib/tsserverlibrary').ImportDeclaration;
        } else if (ts.isImportSpecifier(decl)) {
          importDecl = decl.parent?.parent
            ?.parent as import('typescript/lib/tsserverlibrary').ImportDeclaration;
        } else if (ts.isNamespaceImport(decl)) {
          importDecl = decl.parent
            ?.parent as import('typescript/lib/tsserverlibrary').ImportDeclaration;
        }

        if (
          importDecl &&
          importDecl.moduleSpecifier &&
          ts.isStringLiteral(importDecl.moduleSpecifier)
        ) {
          const moduleName = importDecl.moduleSpecifier.text;

          // Check if it's a disallowed Node.js module
          // builtin-modules already includes both 'fs' and 'node:fs' variants
          if (builtinModules.includes(moduleName)) {
            diagnostics.push({
              file: sourceFile,
              start: callNode.getStart(),
              length: callNode.getWidth(),
              messageText: `Node.js API "${moduleName}" is not available in workflow functions. Consider moving this code to a step function with "use step".`,
              category: ts.DiagnosticCategory.Error,
              code: 9003,
            });
            return;
          }
        }
      }
    }
  }

  function checkDisallowedApiUsage(call: CallExpression) {
    try {
      // Check for timer functions (setTimeout, setInterval, setImmediate)
      if (ts.isIdentifier(call.expression)) {
        const functionName = call.expression.text;

        if (functionName === 'setTimeout' || functionName === 'setInterval') {
          diagnostics.push({
            file: sourceFile,
            start: call.getStart(),
            length: call.getWidth(),
            messageText: `${functionName} is not available in workflow functions. Use 'sleep()' from @vercel/workflow-core instead.`,
            category: ts.DiagnosticCategory.Error,
            code: 9004,
          });
          return;
        }

        if (functionName === 'setImmediate') {
          diagnostics.push({
            file: sourceFile,
            start: call.getStart(),
            length: call.getWidth(),
            messageText: `setImmediate is not available in workflow functions. Consider restructuring your code or moving this logic to a step function with "use step".`,
            category: ts.DiagnosticCategory.Error,
            code: 9005,
          });
          return;
        }

        // Check for global fetch - suggest using the one from @vercel/workflow-core
        if (functionName === 'fetch') {
          const symbol = typeChecker.getSymbolAtLocation(call.expression);

          // Check if this is the global fetch (no import) or not from @vercel/workflow-core
          if (symbol) {
            const declarations = symbol.getDeclarations();

            if (declarations && declarations.length > 0) {
              const decl = declarations[0];

              // If it's an import, check if it's from @vercel/workflow-core
              if (
                ts.isImportSpecifier(decl) ||
                ts.isImportClause(decl) ||
                ts.isNamespaceImport(decl)
              ) {
                let importDecl:
                  | import('typescript/lib/tsserverlibrary').ImportDeclaration
                  | undefined;
                if (ts.isImportClause(decl)) {
                  importDecl =
                    decl.parent as import('typescript/lib/tsserverlibrary').ImportDeclaration;
                } else if (ts.isImportSpecifier(decl)) {
                  importDecl = decl.parent?.parent
                    ?.parent as import('typescript/lib/tsserverlibrary').ImportDeclaration;
                } else if (ts.isNamespaceImport(decl)) {
                  importDecl = decl.parent
                    ?.parent as import('typescript/lib/tsserverlibrary').ImportDeclaration;
                }

                if (
                  importDecl &&
                  importDecl.moduleSpecifier &&
                  ts.isStringLiteral(importDecl.moduleSpecifier)
                ) {
                  const moduleName = importDecl.moduleSpecifier.text;

                  // If it's already from @vercel/workflow-core, it's fine
                  if (moduleName === '@vercel/workflow-core') {
                    return;
                  }
                }
              }
            }
          }

          // If we get here, it's either global fetch or not from @vercel/workflow-core
          diagnostics.push({
            file: sourceFile,
            start: call.getStart(),
            length: call.getWidth(),
            messageText: `Use the 'fetch' step from @vercel/workflow-core instead of the global fetch in workflow functions.`,
            category: ts.DiagnosticCategory.Error,
            code: 9006,
          });
          return;
        }
      }

      // Case 1: Property access like fs.readFileSync()
      if (ts.isPropertyAccessExpression(call.expression)) {
        const objectSymbol = typeChecker.getSymbolAtLocation(
          call.expression.expression
        );
        checkSymbolForDisallowedModule(objectSymbol, call);
      }
      // Case 2: Direct identifier call like readFileSync() (from named import)
      else if (ts.isIdentifier(call.expression)) {
        const symbol = typeChecker.getSymbolAtLocation(call.expression);
        checkSymbolForDisallowedModule(symbol, call);
      }
    } catch (error) {
      // Silently fail - don't clutter the UI with internal errors
      console.log(
        `[workflow-plugin] Error in checkDisallowedApiUsage: ${error}`
      );
    }
  }

  visit(sourceFile);
  return diagnostics;
}
