use swc_core::{
    common::{errors::HANDLER, SyntaxContext, DUMMY_SP},
    ecma::{
        ast::*,
        visit::{noop_visit_mut_type, VisitMut, VisitMutWith},
    },
};
use std::collections::HashSet;

#[derive(Debug)]
pub struct StepTransform {
    // Track if we're at module level
    in_module_level: bool,
    // Track if the file has a top-level "use step" directive
    has_file_directive: bool,
    // Track if we're inside an exported expression
    in_exported_expr: bool,
    // Collect step functions to be extracted
    step_functions: Vec<StepFunction>,
    // Set of function names that should be transformed to step proxies
    step_function_names: HashSet<String>,
}

#[derive(Debug, Clone)]
struct StepFunction {
    name: String,
    function: Function,
}

impl StepTransform {
    pub fn new() -> Self {
        Self {
            in_module_level: true,
            has_file_directive: false,
            in_exported_expr: false,
            step_functions: Vec::new(),
            step_function_names: HashSet::new(),
        }
    }

    // Check if a function has the "use step" directive
    fn has_use_step_directive(&self, body: &Option<BlockStmt>) -> bool {
        if let Some(body) = body {
            if let Some(first_stmt) = body.stmts.first() {
                if let Stmt::Expr(ExprStmt { expr, .. }) = first_stmt {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        return value == "use step";
                    }
                }
            }
        }
        false
    }

    // Check if the module has a top-level "use step" directive
    fn check_module_directive(&mut self, items: &[ModuleItem]) -> bool {
        if let Some(ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. }))) = items.first() {
            if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                return value == "use step";
            }
        }
        false
    }

    // Generate the import for useStep
    fn create_use_step_import(&self) -> ModuleItem {
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new("useStep".into(), DUMMY_SP, SyntaxContext::empty()),
                imported: None,
                is_type_only: false,
            })],
            src: Box::new(Str {
                span: DUMMY_SP,
                value: "@vercel/workflow-core/dist/step".into(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: ImportPhase::Evaluation,
        }))
    }

    // Create a proxy call to useStep
    fn create_step_proxy(&self, name: &str) -> Expr {
        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                "useStep".into(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )))),
            args: vec![ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Lit(Lit::Str(Str {
                    span: DUMMY_SP,
                    value: name.into(),
                    raw: None,
                }))),
            }],
            type_args: None,
        })
    }

    // Transform a step function to be wrapped with handleStep
    fn create_step_handler_export(&self, step_fn: &StepFunction) -> Vec<ModuleItem> {
        let mut items = Vec::new();

        // Import handleStep
        items.push(ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new("handleStep".into(), DUMMY_SP, SyntaxContext::empty()),
                imported: None,
                is_type_only: false,
            })],
            src: Box::new(Str {
                span: DUMMY_SP,
                value: "@vercel/workflow-core".into(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: ImportPhase::Evaluation,
        })));

        // Add the function declaration
        items.push(ModuleItem::Stmt(Stmt::Decl(Decl::Fn(FnDecl {
            ident: Ident::new(step_fn.name.clone().into(), DUMMY_SP, SyntaxContext::empty()),
            declare: false,
            function: Box::new(step_fn.function.clone()),
        }))));

        // Export const POST = handleStep(functionName)
        items.push(ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl {
            span: DUMMY_SP,
            decl: Decl::Var(Box::new(VarDecl {
                span: DUMMY_SP,
                ctxt: SyntaxContext::empty(),
                kind: VarDeclKind::Const,
                declare: false,
                decls: vec![VarDeclarator {
                    span: DUMMY_SP,
                    name: Pat::Ident(BindingIdent::from(Ident::new(
                        "POST".into(),
                        DUMMY_SP,
                        SyntaxContext::empty(),
                    ))),
                    init: Some(Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                            "handleStep".into(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        )))),
                        args: vec![ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Ident(Ident::new(
                                step_fn.name.clone().into(),
                                DUMMY_SP,
                                SyntaxContext::empty(),
                            ))),
                        }],
                        type_args: None,
                    }))),
                    definite: false,
                }],
            })),
        })));

        items
    }

    // Validate that the function is async
    fn validate_async_function(&self, function: &Function, span: swc_core::common::Span) -> bool {
        if !function.is_async {
            HANDLER.with(|handler| {
                handler
                    .struct_span_err(
                        span,
                        "Functions marked with \"use step\" must be async functions",
                    )
                    .emit()
            });
            false
        } else {
            true
        }
    }
}

impl VisitMut for StepTransform {
    fn visit_mut_program(&mut self, program: &mut Program) {
        // First, visit the program to collect step functions
        program.visit_mut_children_with(self);
        
        // Then, if we have step functions, add the import
        if !self.step_function_names.is_empty() {
            match program {
                Program::Module(module) => {
                    module.body.insert(0, self.create_use_step_import());
                }
                Program::Script(script) => {
                    // Scripts don't support imports, but we need to convert to module
                    // if we have step functions
                    let mut module_items = Vec::new();
                    module_items.push(self.create_use_step_import());
                    
                    // Convert script statements to module items
                    for stmt in &script.body {
                        module_items.push(ModuleItem::Stmt(stmt.clone()));
                    }
                    
                    // Replace program with module
                    *program = Program::Module(Module {
                        span: script.span,
                        body: module_items,
                        shebang: script.shebang.clone(),
                    });
                }
            }
        }
    }

    fn visit_mut_module(&mut self, module: &mut Module) {
        self.visit_mut_module_items(&mut module.body);
    }

    fn visit_mut_script(&mut self, script: &mut Script) {
        // Scripts are simpler - just process statements
        self.visit_mut_stmts(&mut script.body);
    }

    fn visit_mut_module_items(&mut self, items: &mut Vec<ModuleItem>) {
        // Check for file-level directive
        self.has_file_directive = self.check_module_directive(items);

        // If file has directive, remove it from the body
        if self.has_file_directive && !items.is_empty() {
            if let ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) = &items[0] {
                if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                    if value == "use step" {
                        items.remove(0);
                    }
                }
            }
        }

        // First pass: identify all step functions
        for item in items.iter() {
            match item {
                // Check regular function declarations
                ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                    let fn_name = fn_decl.ident.sym.to_string();
                    let has_directive = self.has_use_step_directive(&fn_decl.function.body);
                    
                    if has_directive && fn_decl.function.is_async {
                        self.step_function_names.insert(fn_name);
                    }
                }
                // Check exported function declarations
                ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
                    if let Decl::Fn(fn_decl) = &export_decl.decl {
                        let fn_name = fn_decl.ident.sym.to_string();
                        let has_directive = self.has_use_step_directive(&fn_decl.function.body);
                        
                        // For exported functions with "use step" directive
                        if has_directive && fn_decl.function.is_async {
                            self.step_function_names.insert(fn_name);
                        } else if self.has_file_directive && fn_decl.function.is_async {
                            // For file-level directive, all exported async functions are steps
                            self.step_function_names.insert(fn_name);
                        }
                    }
                }
                _ => {}
            }
        }

        let mut new = Vec::new();

        // Second pass: process module items and filter out step functions
        for mut item in items.drain(..) {
            let mut should_remove = false;
            let mut replacement_item = None;
            
            match &item {
                // Check regular function declarations
                ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => {
                    let fn_name = fn_decl.ident.sym.to_string();
                    
                    if self.step_function_names.contains(&fn_name) {
                        if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                            // Collect the function (with directive removed)
                            let mut function = *fn_decl.function.clone();
                            if let Some(body) = &mut function.body {
                                if !body.stmts.is_empty() {
                                    if let Stmt::Expr(ExprStmt { expr, .. }) = &body.stmts[0] {
                                        if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                                            if value == "use step" {
                                                body.stmts.remove(0);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            self.step_functions.push(StepFunction {
                                name: fn_name.clone(),
                                function,
                            });
                            
                            // Remove this function declaration
                            should_remove = true;
                        }
                    }
                }
                // Check exported function declarations
                ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
                    if let Decl::Fn(fn_decl) = &export_decl.decl {
                        let fn_name = fn_decl.ident.sym.to_string();
                        
                        if self.step_function_names.contains(&fn_name) {
                            if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                                // Collect the function (with directive removed)
                                let mut function = *fn_decl.function.clone();
                                if let Some(body) = &mut function.body {
                                    if !body.stmts.is_empty() {
                                        if let Stmt::Expr(ExprStmt { expr, .. }) = &body.stmts[0] {
                                            if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                                                if value == "use step" {
                                                    body.stmts.remove(0);
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                self.step_functions.push(StepFunction {
                                    name: fn_name.clone(),
                                    function,
                                });
                                
                                // For file-level directive, transform to const export
                                if self.has_file_directive {
                                    replacement_item = Some(ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl {
                                        span: export_decl.span,
                                        decl: Decl::Var(Box::new(VarDecl {
                                            span: DUMMY_SP,
                                            ctxt: SyntaxContext::empty(),
                                            kind: VarDeclKind::Const,
                                            declare: false,
                                            decls: vec![VarDeclarator {
                                                span: DUMMY_SP,
                                                name: Pat::Ident(BindingIdent::from(Ident::new(
                                                    fn_name.clone().into(),
                                                    DUMMY_SP,
                                                    SyntaxContext::empty(),
                                                ))),
                                                init: Some(Box::new(self.create_step_proxy(&fn_name))),
                                                definite: false,
                                            }],
                                        })),
                                    })));
                                } else {
                                    // For function-level directive, remove the function
                                    should_remove = true;
                                }
                            }
                        }
                    }
                }
                _ => {}
            }
            
            if let Some(replacement) = replacement_item {
                new.push(replacement);
            } else if !should_remove {
                item.visit_mut_with(self);
                new.push(item);
            }
        }

        *items = new;

        // TODO: In a real implementation, we would write step functions to separate files
        // For now, we'll just comment where they would go
        for step_fn in &self.step_functions {
            // This would write to api/steps/{name}.ts
            let _handler_code = self.create_step_handler_export(step_fn);
        }
    }

    fn visit_mut_export_decl(&mut self, export: &mut ExportDecl) {
        let old_in_exported = self.in_exported_expr;
        self.in_exported_expr = true;
        
        export.visit_mut_children_with(self);
        
        self.in_exported_expr = old_in_exported;
    }

    fn visit_mut_export_default_decl(&mut self, export: &mut ExportDefaultDecl) {
        let old_in_exported = self.in_exported_expr;
        self.in_exported_expr = true;
        
        // Handle default export functions
        if let DefaultDecl::Fn(fn_expr) = &mut export.decl {
            let has_directive = self.has_use_step_directive(&fn_expr.function.body);
            
            if has_directive || (self.has_file_directive && self.in_exported_expr) {
                if self.validate_async_function(&fn_expr.function, fn_expr.function.span) {
                    let name = fn_expr
                        .ident
                        .as_ref()
                        .map(|i| i.sym.to_string())
                        .unwrap_or_else(|| "default".to_string());
                    
                    self.step_functions.push(StepFunction {
                        name: name.clone(),
                        function: *fn_expr.function.clone(),
                    });
                    
                    // Replace with proxy
                    // For now, we'll just leave it as is since we can't easily replace a DefaultDecl::Fn
                    // In a real implementation, we'd transform this properly
                }
            }
        }
        
        export.visit_mut_children_with(self);
        self.in_exported_expr = old_in_exported;
    }

    fn visit_mut_stmts(&mut self, stmts: &mut Vec<Stmt>) {
        let old_in_module = self.in_module_level;
        self.in_module_level = false;
        
        // Process each statement and collect ones to keep
        let mut new_stmts = Vec::new();
        for mut stmt in stmts.drain(..) {
            let mut should_remove = false;
            
            // Check if this is a function declaration we need to transform
            if let Stmt::Decl(Decl::Fn(fn_decl)) = &stmt {
                let fn_name = fn_decl.ident.sym.to_string();
                let has_directive = self.has_use_step_directive(&fn_decl.function.body);
                
                if has_directive {
                    if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                        // Collect the function (with directive removed)
                        let mut function = *fn_decl.function.clone();
                        if let Some(body) = &mut function.body {
                            if !body.stmts.is_empty() {
                                if let Stmt::Expr(ExprStmt { expr, .. }) = &body.stmts[0] {
                                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                                        if value == "use step" {
                                            body.stmts.remove(0);
                                        }
                                    }
                                }
                            }
                        }
                        
                        self.step_functions.push(StepFunction {
                            name: fn_name.clone(),
                            function,
                        });
                        
                        self.step_function_names.insert(fn_name);
                        
                        // Remove this function declaration
                        should_remove = true;
                    }
                }
            }
            
            if !should_remove {
                stmt.visit_mut_with(self);
                new_stmts.push(stmt);
            }
        }
        
        *stmts = new_stmts;
        self.in_module_level = old_in_module;
    }

    fn visit_mut_call_expr(&mut self, call: &mut CallExpr) {
        // First visit children
        call.visit_mut_children_with(self);
        
        // Check if this is a call to a step function
        if let Callee::Expr(expr) = &mut call.callee {
            if let Expr::Ident(ident) = &**expr {
                let fn_name = ident.sym.to_string();
                if self.step_function_names.contains(&fn_name) {
                    // Transform add(1, 2) to useStep("add")(1, 2)
                    call.callee = Callee::Expr(Box::new(self.create_step_proxy(&fn_name)));
                }
            }
        }
    }

    fn visit_mut_var_decl(&mut self, var_decl: &mut VarDecl) {
        var_decl.visit_mut_children_with(self);
        
        // Transform function expressions in variable declarations
        for decl in &mut var_decl.decls {
            if let Some(init) = &mut decl.init {
                if let Pat::Ident(binding) = &decl.name {
                    let name = binding.id.sym.to_string();
                    
                    match &mut **init {
                        Expr::Fn(fn_expr) => {
                            let has_directive = self.has_use_step_directive(&fn_expr.function.body);
                            
                            if has_directive || (self.has_file_directive && self.in_exported_expr) {
                                if self.validate_async_function(&fn_expr.function, fn_expr.function.span) {
                                    self.step_functions.push(StepFunction {
                                        name: name.clone(),
                                        function: *fn_expr.function.clone(),
                                    });
                                    
                                    self.step_function_names.insert(name.clone());
                                    
                                    // Replace with proxy
                                    **init = self.create_step_proxy(&name);
                                }
                            }
                        }
                        Expr::Arrow(arrow) => {
                            let has_directive = match &*arrow.body {
                                BlockStmtOrExpr::BlockStmt(block) => {
                                    self.has_use_step_directive(&Some(block.clone()))
                                }
                                _ => false,
                            };
                            
                            if has_directive || (self.has_file_directive && self.in_exported_expr) {
                                if !arrow.is_async {
                                    HANDLER.with(|handler| {
                                        handler
                                            .struct_span_err(
                                                arrow.span,
                                                "Arrow functions marked with \"use step\" must be async",
                                            )
                                            .emit()
                                    });
                                } else {
                                    // Convert arrow to function for extraction
                                    let function = Function {
                                        params: arrow.params.iter().map(|p| Param::from(p.clone())).collect(),
                                        decorators: vec![],
                                        span: arrow.span,
                                        ctxt: SyntaxContext::empty(),
                                        body: match &*arrow.body {
                                            BlockStmtOrExpr::BlockStmt(block) => Some(block.clone()),
                                            BlockStmtOrExpr::Expr(expr) => Some(BlockStmt {
                                                span: DUMMY_SP,
                                                ctxt: SyntaxContext::empty(),
                                                stmts: vec![Stmt::Return(ReturnStmt {
                                                    span: DUMMY_SP,
                                                    arg: Some(Box::new(*expr.clone())),
                                                })],
                                            }),
                                        },
                                        is_generator: false,
                                        is_async: arrow.is_async,
                                        type_params: arrow.type_params.clone(),
                                        return_type: arrow.return_type.clone(),
                                    };
                                    
                                    self.step_functions.push(StepFunction {
                                        name: name.clone(),
                                        function,
                                    });
                                    
                                    self.step_function_names.insert(name.clone());
                                    
                                    // Replace with proxy
                                    **init = self.create_step_proxy(&name);
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    noop_visit_mut_type!();
} 