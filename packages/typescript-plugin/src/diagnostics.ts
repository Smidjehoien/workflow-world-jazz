import {
  DISALLOWED_WORKFLOW_APIS,
  findFunctionCalls,
  getDirective,
  isAsyncFunction,
} from './utils';

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

          // Remove 'node:' prefix if present
          const cleanModuleName = moduleName.startsWith('node:')
            ? moduleName.slice(5)
            : moduleName;

          // Check if it's a disallowed Node.js module
          if (DISALLOWED_WORKFLOW_APIS.has(cleanModuleName)) {
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
