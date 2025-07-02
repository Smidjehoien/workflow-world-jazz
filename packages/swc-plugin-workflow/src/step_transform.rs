use serde::Deserialize;
use std::collections::HashSet;
use swc_core::{
    common::{DUMMY_SP, SyntaxContext, errors::HANDLER},
    ecma::{
        ast::*,
        visit::{VisitMut, VisitMutWith, noop_visit_mut_type},
    },
};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub enum TransformMode {
    Server,
    Workflow,
}

#[derive(Debug)]
pub struct StepTransform {
    mode: TransformMode,
    // Track if the file has a top-level "use step" directive
    has_file_directive: bool,
    // Set of function names that are step functions
    step_function_names: HashSet<String>,
    // Set of function names that have been registered (to avoid duplicates)
    registered_functions: HashSet<String>,
    // Collect registration calls for server mode
    registration_calls: Vec<Stmt>,
}

impl StepTransform {
    pub fn new(mode: TransformMode) -> Self {
        Self {
            mode,
            has_file_directive: false,
            step_function_names: HashSet::new(),
            registered_functions: HashSet::new(),
            registration_calls: Vec::new(),
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

    // Remove "use step" directive from function body
    fn remove_use_step_directive(&self, body: &mut Option<BlockStmt>) {
        if let Some(body) = body {
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
    }



    // Generate the import for registerStepFunction (server mode)
    fn create_register_import(&self) -> ModuleItem {
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new(
                    "registerStepFunction".into(),
                    DUMMY_SP,
                    SyntaxContext::empty(),
                ),
                imported: None,
                is_type_only: false,
            })],
            src: Box::new(Str {
                span: DUMMY_SP,
                value: "@vercel/workflow-core/private".into(),
                raw: None,
            }),
            type_only: false,
            with: None,
            phase: ImportPhase::Evaluation,
        }))
    }

    // Create a proxy call to globalThis[Symbol.for("WORKFLOW_USE_STEP")] (workflow mode)
    fn create_step_proxy(&self, name: &str) -> Expr {
        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                span: DUMMY_SP,
                obj: Box::new(Expr::Ident(Ident::new(
                    "globalThis".into(),
                    DUMMY_SP,
                    SyntaxContext::empty(),
                ))),
                prop: MemberProp::Computed(ComputedPropName {
                    span: DUMMY_SP,
                    expr: Box::new(Expr::Call(CallExpr {
                        span: DUMMY_SP,
                        ctxt: SyntaxContext::empty(),
                        callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
                            span: DUMMY_SP,
                            obj: Box::new(Expr::Ident(Ident::new(
                                "Symbol".into(),
                                DUMMY_SP,
                                SyntaxContext::empty(),
                            ))),
                            prop: MemberProp::Ident(IdentName::new(
                                "for".into(),
                                DUMMY_SP,
                            )),
                        }))),
                        args: vec![ExprOrSpread {
                            spread: None,
                            expr: Box::new(Expr::Lit(Lit::Str(Str {
                                span: DUMMY_SP,
                                value: "WORKFLOW_USE_STEP".into(),
                                raw: None,
                            }))),
                        }],
                        type_args: None,
                    })),
                }),
            }))),
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

    // Create a registration call for server mode
    fn create_registration_call(&mut self, name: &str) {
        // Only register each function once
        if !self.registered_functions.contains(name) {
            self.registered_functions.insert(name.to_string());
            self.registration_calls.push(Stmt::Expr(ExprStmt {
                span: DUMMY_SP,
                expr: Box::new(Expr::Call(CallExpr {
                    span: DUMMY_SP,
                    ctxt: SyntaxContext::empty(),
                    callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                        "registerStepFunction".into(),
                        DUMMY_SP,
                        SyntaxContext::empty(),
                    )))),
                    args: vec![ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(
                            name.into(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        ))),
                    }],
                    type_args: None,
                })),
            }));
        }
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

    // Check if a function should be treated as a step function
    fn should_transform_function(&self, function: &Function, is_exported: bool) -> bool {
        let has_directive = self.has_use_step_directive(&function.body);

        // Function has explicit directive OR file has directive and function is exported
        (has_directive || (self.has_file_directive && is_exported)) && function.is_async
    }
}

impl VisitMut for StepTransform {
    fn visit_mut_program(&mut self, program: &mut Program) {
        // First pass: collect step functions
        program.visit_mut_children_with(self);

        // Add necessary imports and registrations
        match program {
            Program::Module(module) => {
                let mut imports_to_add = Vec::new();

                match self.mode {
                    TransformMode::Workflow => {
                        // No imports needed for workflow mode
                    }
                    TransformMode::Server => {
                        if !self.registration_calls.is_empty() {
                            imports_to_add.push(self.create_register_import());
                        }
                    }
                }

                // Add imports at the beginning
                for import in imports_to_add.into_iter().rev() {
                    module.body.insert(0, import);
                }

                // Add registration calls at the end for server mode
                if matches!(self.mode, TransformMode::Server) {
                    for call in self.registration_calls.drain(..) {
                        module.body.push(ModuleItem::Stmt(call));
                    }
                }
            }
            Program::Script(script) => {
                // For scripts, we need to convert to module if we have step functions
                if !self.step_function_names.is_empty() {
                    let mut module_items = Vec::new();

                    match self.mode {
                        TransformMode::Workflow => {
                            // No imports needed for workflow mode
                        }
                        TransformMode::Server => {
                            if !self.registration_calls.is_empty() {
                                module_items.push(self.create_register_import());
                            }
                        }
                    }

                    // Convert script statements to module items
                    for stmt in &script.body {
                        module_items.push(ModuleItem::Stmt(stmt.clone()));
                    }

                    // Add registration calls for server mode
                    if matches!(self.mode, TransformMode::Server) {
                        for call in self.registration_calls.drain(..) {
                            module_items.push(ModuleItem::Stmt(call));
                        }
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

    fn visit_mut_module_items(&mut self, items: &mut Vec<ModuleItem>) {
        // Check for file-level directive
        self.has_file_directive = self.check_module_directive(items);

        // Remove file-level directive if present
        if self.has_file_directive && !items.is_empty() {
            if let ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) = &items[0] {
                if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                    if value == "use step" {
                        items.remove(0);
                    }
                }
            }
        }

        // Visit children normally
        for item in items.iter_mut() {
            item.visit_mut_with(self);
        }
    }

    fn visit_mut_fn_decl(&mut self, fn_decl: &mut FnDecl) {
        let fn_name = fn_decl.ident.sym.to_string();

        if self.should_transform_function(&fn_decl.function, false) {
            if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                self.step_function_names.insert(fn_name.clone());

                match self.mode {
                    TransformMode::Server => {
                        self.remove_use_step_directive(&mut fn_decl.function.body);
                        self.create_registration_call(&fn_name);
                    }
                    TransformMode::Workflow => {
                        // For workflow mode, we need to replace the entire declaration
                        // This will be handled at a higher level
                    }
                }
            }
        }

        fn_decl.visit_mut_children_with(self);
    }

    fn visit_mut_stmt(&mut self, stmt: &mut Stmt) {
        match stmt {
            Stmt::Decl(Decl::Fn(fn_decl)) => {
                let fn_name = fn_decl.ident.sym.to_string();

                if self.should_transform_function(&fn_decl.function, false) {
                    if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                        self.step_function_names.insert(fn_name.clone());

                        match self.mode {
                            TransformMode::Server => {
                                self.remove_use_step_directive(&mut fn_decl.function.body);
                                self.create_registration_call(&fn_name);
                                stmt.visit_mut_children_with(self);
                            }
                            TransformMode::Workflow => {
                                // Replace function declaration with variable declaration
                                *stmt = Stmt::Decl(Decl::Var(Box::new(VarDecl {
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
                                })));
                            }
                        }
                    }
                } else {
                    stmt.visit_mut_children_with(self);
                }
            }
            _ => {
                stmt.visit_mut_children_with(self);
            }
        }
    }

    fn visit_mut_export_decl(&mut self, export_decl: &mut ExportDecl) {
        if let Decl::Fn(fn_decl) = &mut export_decl.decl {
            let fn_name = fn_decl.ident.sym.to_string();

            if self.should_transform_function(&fn_decl.function, true) {
                if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                    self.step_function_names.insert(fn_name.clone());

                    match self.mode {
                        TransformMode::Server => {
                            self.remove_use_step_directive(&mut fn_decl.function.body);
                            self.create_registration_call(&fn_name);
                            export_decl.visit_mut_children_with(self);
                        }
                        TransformMode::Workflow => {
                            // Replace with export const
                            export_decl.decl = Decl::Var(Box::new(VarDecl {
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
                            }));
                        }
                    }
                }
            } else {
                export_decl.visit_mut_children_with(self);
            }
        } else {
            export_decl.visit_mut_children_with(self);
        }
    }

    fn visit_mut_var_decl(&mut self, var_decl: &mut VarDecl) {
        // Handle variable declarations with function expressions
        for decl in &mut var_decl.decls {
            if let Some(init) = &mut decl.init {
                if let Pat::Ident(binding) = &decl.name {
                    let name = binding.id.sym.to_string();

                    match &mut **init {
                        Expr::Fn(fn_expr) => {
                            if self.should_transform_function(&fn_expr.function, false) {
                                if self.validate_async_function(
                                    &fn_expr.function,
                                    fn_expr.function.span,
                                ) {
                                    self.step_function_names.insert(name.clone());

                                    match self.mode {
                                        TransformMode::Server => {
                                            self.remove_use_step_directive(
                                                &mut fn_expr.function.body,
                                            );
                                            self.create_registration_call(&name);
                                        }
                                        TransformMode::Workflow => {
                                            // Replace with proxy
                                            **init = self.create_step_proxy(&name);
                                        }
                                    }
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }
        }

        var_decl.visit_mut_children_with(self);
    }

    noop_visit_mut_type!();
}
