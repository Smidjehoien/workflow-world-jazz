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
    Step,
    Workflow,
    Client,
}

#[derive(Debug)]
pub struct StepTransform {
    mode: TransformMode,
    // Track if the file has a top-level "use step" directive
    has_file_directive: bool,
    // Track if the file has a top-level "use workflow" directive
    has_file_workflow_directive: bool,
    // Set of function names that are step functions
    step_function_names: HashSet<String>,
    // Set of function names that are workflow functions
    workflow_function_names: HashSet<String>,
    // Set of function names that have been registered (to avoid duplicates)
    registered_functions: HashSet<String>,
    // Collect registration calls for step mode
    registration_calls: Vec<Stmt>,
}

impl StepTransform {
    pub fn new(mode: TransformMode) -> Self {
        Self {
            mode,
            has_file_directive: false,
            has_file_workflow_directive: false,
            step_function_names: HashSet::new(),
            workflow_function_names: HashSet::new(),
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

    // Check if a function has the "use workflow" directive
    fn has_use_workflow_directive(&self, body: &Option<BlockStmt>) -> bool {
        if let Some(body) = body {
            if let Some(first_stmt) = body.stmts.first() {
                if let Stmt::Expr(ExprStmt { expr, .. }) = first_stmt {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        return value == "use workflow";
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

    // Check if the module has a top-level "use workflow" directive
    fn check_module_workflow_directive(&mut self, items: &[ModuleItem]) -> bool {
        if let Some(ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. }))) = items.first() {
            if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                return value == "use workflow";
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

    // Remove "use workflow" directive from function body
    fn remove_use_workflow_directive(&self, body: &mut Option<BlockStmt>) {
        if let Some(body) = body {
            if !body.stmts.is_empty() {
                if let Stmt::Expr(ExprStmt { expr, .. }) = &body.stmts[0] {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        if value == "use workflow" {
                            body.stmts.remove(0);
                        }
                    }
                }
            }
        }
    }

    // Check if an arrow function has the "use step" directive
    fn has_use_step_directive_arrow(&self, body: &BlockStmtOrExpr) -> bool {
        if let BlockStmtOrExpr::BlockStmt(body) = body {
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

    // Check if an arrow function has the "use workflow" directive
    fn has_use_workflow_directive_arrow(&self, body: &BlockStmtOrExpr) -> bool {
        if let BlockStmtOrExpr::BlockStmt(body) = body {
            if let Some(first_stmt) = body.stmts.first() {
                if let Stmt::Expr(ExprStmt { expr, .. }) = first_stmt {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        return value == "use workflow";
                    }
                }
            }
        }
        false
    }

    // Remove "use step" directive from arrow function body
    fn remove_use_step_directive_arrow(&self, body: &mut BlockStmtOrExpr) {
        if let BlockStmtOrExpr::BlockStmt(body) = body {
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

    // Remove "use workflow" directive from arrow function body
    fn remove_use_workflow_directive_arrow(&self, body: &mut BlockStmtOrExpr) {
        if let BlockStmtOrExpr::BlockStmt(body) = body {
            if !body.stmts.is_empty() {
                if let Stmt::Expr(ExprStmt { expr, .. }) = &body.stmts[0] {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        if value == "use workflow" {
                            body.stmts.remove(0);
                        }
                    }
                }
            }
        }
    }

    // Check if an arrow function should be treated as a step function
    fn should_transform_arrow_function(&self, arrow_fn: &ArrowExpr, is_exported: bool) -> bool {
        let has_directive = self.has_use_step_directive_arrow(&arrow_fn.body);

        // Function has explicit directive OR file has directive and function is exported
        (has_directive || (self.has_file_directive && is_exported)) && arrow_fn.is_async
    }

    // Check if an arrow function should be treated as a workflow function
    fn should_transform_workflow_arrow_function(&self, arrow_fn: &ArrowExpr, is_exported: bool) -> bool {
        let has_directive = self.has_use_workflow_directive_arrow(&arrow_fn.body);

        // Function has explicit directive OR file has workflow directive and function is exported
        (has_directive || (self.has_file_workflow_directive && is_exported)) && arrow_fn.is_async
    }

    // Validate that the arrow function is async
    fn validate_async_arrow_function(&self, arrow_fn: &ArrowExpr, span: swc_core::common::Span) -> bool {
        if !arrow_fn.is_async {
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

    // Create a step run call for arrow functions (client mode)
    fn create_run_step_call_arrow(&self, fn_name: &str, params: &[Pat]) -> Expr {
        let args_array = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: params.iter().map(|param| {
                if let Pat::Ident(ident) = param {
                    Some(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(
                            ident.id.sym.clone(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        ))),
                    })
                } else {
                    None
                }
            }).collect(),
        });

        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                "__private_run_step".into(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )))),
            args: vec![
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: fn_name.into(),
                        raw: None,
                    }))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Object(ObjectLit {
                        span: DUMMY_SP,
                        props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(IdentName::new(
                                "arguments".into(),
                                DUMMY_SP,
                            )),
                            value: Box::new(args_array),
                        })))],
                    })),
                },
            ],
            type_args: None,
        })
    }

    // Create a workflow start call for arrow functions (client mode)
    fn create_workflow_start_call_arrow(&self, fn_name: &str, params: &[Pat]) -> Expr {
        let args_array = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: params.iter().map(|param| {
                if let Pat::Ident(ident) = param {
                    Some(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(
                            ident.id.sym.clone(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        ))),
                    })
                } else {
                    None
                }
            }).collect(),
        });

        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                "__private_workflow_start".into(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )))),
            args: vec![
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: fn_name.into(),
                        raw: None,
                    }))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Object(ObjectLit {
                        span: DUMMY_SP,
                        props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(IdentName::new(
                                "arguments".into(),
                                DUMMY_SP,
                            )),
                            value: Box::new(args_array),
                        })))],
                    })),
                },
            ],
            type_args: None,
        })
    }

    // Generate the import for registerStepFunction (step mode)
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

    // Generate the import for workflow start function (client mode)
    fn create_workflow_start_import(&self) -> ModuleItem {
        let mut specifiers = Vec::new();
        
        if !self.workflow_function_names.is_empty() {
            specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new(
                    "__private_workflow_start".into(),
                    DUMMY_SP,
                    SyntaxContext::empty(),
                ),
                imported: Some(ModuleExportName::Ident(Ident::new(
                    "start".into(),
                    DUMMY_SP,
                    SyntaxContext::empty(),
                ))),
                is_type_only: false,
            }));
        }
        
        if !self.step_function_names.is_empty() {
            specifiers.push(ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                local: Ident::new(
                    "__private_run_step".into(),
                    DUMMY_SP,
                    SyntaxContext::empty(),
                ),
                imported: Some(ModuleExportName::Ident(Ident::new(
                    "runStep".into(),
                    DUMMY_SP,
                    SyntaxContext::empty(),
                ))),
                is_type_only: false,
            }));
        }

        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            specifiers,
            src: Box::new(Str {
                span: DUMMY_SP,
                value: "@vercel/workflow-core/runtime".into(),
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

    // Create a workflow start call (client mode)
    fn create_workflow_start_call(&self, fn_name: &str, params: &[Param]) -> Expr {
        let args_array = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: params.iter().map(|param| {
                if let Pat::Ident(ident) = &param.pat {
                    Some(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(
                            ident.id.sym.clone(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        ))),
                    })
                } else {
                    None
                }
            }).collect(),
        });

        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                "__private_workflow_start".into(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )))),
            args: vec![
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: fn_name.into(),
                        raw: None,
                    }))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Object(ObjectLit {
                        span: DUMMY_SP,
                        props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(IdentName::new(
                                "arguments".into(),
                                DUMMY_SP,
                            )),
                            value: Box::new(args_array),
                        })))],
                    })),
                },
            ],
            type_args: None,
        })
    }

    // Create a step run call (client mode)
    fn create_run_step_call(&self, fn_name: &str, params: &[Param]) -> Expr {
        let args_array = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: params.iter().map(|param| {
                if let Pat::Ident(ident) = &param.pat {
                    Some(ExprOrSpread {
                        spread: None,
                        expr: Box::new(Expr::Ident(Ident::new(
                            ident.id.sym.clone(),
                            DUMMY_SP,
                            SyntaxContext::empty(),
                        ))),
                    })
                } else {
                    None
                }
            }).collect(),
        });

        Expr::Call(CallExpr {
            span: DUMMY_SP,
            ctxt: SyntaxContext::empty(),
            callee: Callee::Expr(Box::new(Expr::Ident(Ident::new(
                "__private_run_step".into(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )))),
            args: vec![
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Lit(Lit::Str(Str {
                        span: DUMMY_SP,
                        value: fn_name.into(),
                        raw: None,
                    }))),
                },
                ExprOrSpread {
                    spread: None,
                    expr: Box::new(Expr::Object(ObjectLit {
                        span: DUMMY_SP,
                        props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                            key: PropName::Ident(IdentName::new(
                                "arguments".into(),
                                DUMMY_SP,
                            )),
                            value: Box::new(args_array),
                        })))],
                    })),
                },
            ],
            type_args: None,
        })
    }

    // Create a registration call for step mode
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

    // Check if a function should be treated as a workflow function
    fn should_transform_workflow_function(&self, function: &Function, is_exported: bool) -> bool {
        let has_directive = self.has_use_workflow_directive(&function.body);

        // Function has explicit directive OR file has workflow directive and function is exported
        (has_directive || (self.has_file_workflow_directive && is_exported)) && function.is_async
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
                    TransformMode::Step => {
                        if !self.registration_calls.is_empty() {
                            imports_to_add.push(self.create_register_import());
                        }
                    }
                    TransformMode::Client => {
                        if !self.workflow_function_names.is_empty() || !self.step_function_names.is_empty() {
                            imports_to_add.push(self.create_workflow_start_import());
                        }
                    }
                }

                // Add imports at the beginning
                for import in imports_to_add.into_iter().rev() {
                    module.body.insert(0, import);
                }

                // Add registration calls at the end for step mode
                if matches!(self.mode, TransformMode::Step) {
                    for call in self.registration_calls.drain(..) {
                        module.body.push(ModuleItem::Stmt(call));
                    }
                }
            }
            Program::Script(script) => {
                // For scripts, we need to convert to module if we have step or workflow functions
                if !self.step_function_names.is_empty() || !self.workflow_function_names.is_empty() {
                    let mut module_items = Vec::new();

                    match self.mode {
                        TransformMode::Workflow => {
                            // No imports needed for workflow mode
                        }
                        TransformMode::Step => {
                            if !self.registration_calls.is_empty() {
                                module_items.push(self.create_register_import());
                            }
                        }
                        TransformMode::Client => {
                            if !self.workflow_function_names.is_empty() || !self.step_function_names.is_empty() {
                                module_items.push(self.create_workflow_start_import());
                            }
                        }
                    }

                    // Convert script statements to module items
                    for stmt in &script.body {
                        module_items.push(ModuleItem::Stmt(stmt.clone()));
                    }

                    // Add registration calls for step mode
                    if matches!(self.mode, TransformMode::Step) {
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
        // Check for file-level directives
        self.has_file_directive = self.check_module_directive(items);
        self.has_file_workflow_directive = self.check_module_workflow_directive(items);

        // Remove file-level directive if present
        if !items.is_empty() {
            if let ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, .. })) = &items[0] {
                if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                    let should_remove = match self.mode {
                        TransformMode::Step => value == "use step",
                        TransformMode::Workflow => value == "use workflow", 
                        TransformMode::Client => value == "use step" || value == "use workflow",
                    };
                    if should_remove {
                        items.remove(0);
                    }
                }
            }
        }

        // Visit children normally
        for item in items.iter_mut() {
            item.visit_mut_with(self);
        }

        // Client mode no longer needs to remove step functions since we transform them
    }

    fn visit_mut_fn_decl(&mut self, fn_decl: &mut FnDecl) {
        let fn_name = fn_decl.ident.sym.to_string();

        if self.should_transform_function(&fn_decl.function, false) {
            if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                self.step_function_names.insert(fn_name.clone());

                match self.mode {
                    TransformMode::Step => {
                        self.remove_use_step_directive(&mut fn_decl.function.body);
                        self.create_registration_call(&fn_name);
                    }
                    TransformMode::Workflow => {
                        // For workflow mode, we need to replace the entire declaration
                        // This will be handled at a higher level
                    }
                    TransformMode::Client => {
                        // Step functions are completely removed in client mode
                        // This will be handled at a higher level
                    }
                }
            }
        } else if self.should_transform_workflow_function(&fn_decl.function, false) {
            if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                self.workflow_function_names.insert(fn_name.clone());

                match self.mode {
                    TransformMode::Step => {
                        // Workflow functions are not processed in step mode
                    }
                    TransformMode::Workflow => {
                        // For workflow mode, we need to replace the entire declaration
                        // This will be handled at a higher level
                    }
                    TransformMode::Client => {
                        // Workflow functions are transformed in client mode
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
                            TransformMode::Step => {
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
                            TransformMode::Client => {
                                // Transform step function body to use step run call
                                self.remove_use_step_directive(&mut fn_decl.function.body);
                                if let Some(body) = &mut fn_decl.function.body {
                                    body.stmts = vec![Stmt::Return(ReturnStmt {
                                        span: DUMMY_SP,
                                        arg: Some(Box::new(self.create_run_step_call(&fn_name, &fn_decl.function.params))),
                                    })];
                                }
                                stmt.visit_mut_children_with(self);
                            }
                        }
                    }
                } else if self.should_transform_workflow_function(&fn_decl.function, false) {
                    if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                        self.workflow_function_names.insert(fn_name.clone());

                        match self.mode {
                            TransformMode::Step => {
                                // Workflow functions are not processed in step mode
                                stmt.visit_mut_children_with(self);
                            }
                            TransformMode::Workflow => {
                                // In workflow mode, just remove the directive from workflow functions
                                self.remove_use_workflow_directive(&mut fn_decl.function.body);
                                stmt.visit_mut_children_with(self);
                            }
                            TransformMode::Client => {
                                // Transform workflow function body to use start call
                                self.remove_use_workflow_directive(&mut fn_decl.function.body);
                                if let Some(body) = &mut fn_decl.function.body {
                                    body.stmts = vec![Stmt::Return(ReturnStmt {
                                        span: DUMMY_SP,
                                        arg: Some(Box::new(self.create_workflow_start_call(&fn_name, &fn_decl.function.params))),
                                    })];
                                }
                                stmt.visit_mut_children_with(self);
                            }
                        }
                    }
                } else {
                    stmt.visit_mut_children_with(self);
                }
            }
            Stmt::Decl(Decl::Var(_)) => {
                // Handle variable declarations with function expressions
                stmt.visit_mut_children_with(self);
            }
            _ => {
                stmt.visit_mut_children_with(self);
            }
        }
    }

    fn visit_mut_export_decl(&mut self, export_decl: &mut ExportDecl) {
        match &mut export_decl.decl {
            Decl::Fn(fn_decl) => {
                let fn_name = fn_decl.ident.sym.to_string();

                if self.should_transform_function(&fn_decl.function, true) {
                    if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                        self.step_function_names.insert(fn_name.clone());

                        match self.mode {
                            TransformMode::Step => {
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
                            TransformMode::Client => {
                                // Transform step function body to use run step call
                                self.remove_use_step_directive(&mut fn_decl.function.body);
                                if let Some(body) = &mut fn_decl.function.body {
                                    body.stmts = vec![Stmt::Return(ReturnStmt {
                                        span: DUMMY_SP,
                                        arg: Some(Box::new(self.create_run_step_call(&fn_name, &fn_decl.function.params))),
                                    })];
                                }
                                export_decl.visit_mut_children_with(self);
                            }
                        }
                    }
                } else if self.should_transform_workflow_function(&fn_decl.function, true) {
                    if self.validate_async_function(&fn_decl.function, fn_decl.function.span) {
                        self.workflow_function_names.insert(fn_name.clone());

                        match self.mode {
                            TransformMode::Step => {
                                // Workflow functions are not processed in step mode
                                export_decl.visit_mut_children_with(self);
                            }
                            TransformMode::Workflow => {
                                // In workflow mode, just remove the directive from workflow functions
                                self.remove_use_workflow_directive(&mut fn_decl.function.body);
                                export_decl.visit_mut_children_with(self);
                            }
                            TransformMode::Client => {
                                // Transform workflow function body to use workflow start call
                                self.remove_use_workflow_directive(&mut fn_decl.function.body);
                                if let Some(body) = &mut fn_decl.function.body {
                                    body.stmts = vec![Stmt::Return(ReturnStmt {
                                        span: DUMMY_SP,
                                        arg: Some(Box::new(self.create_workflow_start_call(&fn_name, &fn_decl.function.params))),
                                    })];
                                }
                                export_decl.visit_mut_children_with(self);
                            }
                        }
                    }
                } else {
                    export_decl.visit_mut_children_with(self);
                }
            }
            Decl::Var(var_decl) => {
                // Handle exported variable declarations with function expressions/arrow functions
                for decl in var_decl.decls.iter_mut() {
                    if let Some(init) = &mut decl.init {
                        if let Pat::Ident(binding) = &decl.name {
                            let name = binding.id.sym.to_string();

                            match &mut **init {
                                Expr::Fn(fn_expr) => {
                                    if self.should_transform_function(&fn_expr.function, true) {
                                        if self.validate_async_function(
                                            &fn_expr.function,
                                            fn_expr.function.span,
                                        ) {
                                            self.step_function_names.insert(name.clone());

                                            match self.mode {
                                                TransformMode::Step => {
                                                    self.remove_use_step_directive(
                                                        &mut fn_expr.function.body,
                                                    );
                                                    self.create_registration_call(&name);
                                                }
                                                TransformMode::Workflow => {
                                                    // Replace with proxy
                                                    **init = self.create_step_proxy(&name);
                                                }
                                                TransformMode::Client => {
                                                    // Transform step function body to use run step call
                                                    self.remove_use_step_directive(
                                                        &mut fn_expr.function.body,
                                                    );
                                                    if let Some(body) = &mut fn_expr.function.body {
                                                        body.stmts = vec![Stmt::Return(ReturnStmt {
                                                            span: DUMMY_SP,
                                                            arg: Some(Box::new(self.create_run_step_call(&name, &fn_expr.function.params))),
                                                        })];
                                                    }
                                                }
                                            }
                                        }
                                    } else if self.should_transform_workflow_function(&fn_expr.function, true) {
                                        if self.validate_async_function(
                                            &fn_expr.function,
                                            fn_expr.function.span,
                                        ) {
                                            self.workflow_function_names.insert(name.clone());

                                            match self.mode {
                                                TransformMode::Step => {
                                                    // Workflow functions are not processed in step mode
                                                }
                                                TransformMode::Workflow => {
                                                    // In workflow mode, just remove the directive from workflow functions
                                                    self.remove_use_workflow_directive(&mut fn_expr.function.body);
                                                }
                                                TransformMode::Client => {
                                                    // Transform workflow function body to use workflow start call
                                                    self.remove_use_workflow_directive(
                                                        &mut fn_expr.function.body,
                                                    );
                                                    if let Some(body) = &mut fn_expr.function.body {
                                                        body.stmts = vec![Stmt::Return(ReturnStmt {
                                                            span: DUMMY_SP,
                                                            arg: Some(Box::new(self.create_workflow_start_call(&name, &fn_expr.function.params))),
                                                        })];
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                                Expr::Arrow(arrow_expr) => {
                                    if self.should_transform_arrow_function(arrow_expr, true) {
                                        if self.validate_async_arrow_function(arrow_expr, arrow_expr.span) {
                                            self.step_function_names.insert(name.clone());

                                            match self.mode {
                                                TransformMode::Step => {
                                                    self.remove_use_step_directive_arrow(&mut arrow_expr.body);
                                                    self.create_registration_call(&name);
                                                }
                                                TransformMode::Workflow => {
                                                    // Replace with proxy
                                                    **init = self.create_step_proxy(&name);
                                                }
                                                TransformMode::Client => {
                                                    // Transform arrow function to use run step call
                                                    self.remove_use_step_directive_arrow(&mut arrow_expr.body);
                                                    arrow_expr.body = Box::new(BlockStmtOrExpr::Expr(Box::new(
                                                        self.create_run_step_call_arrow(&name, &arrow_expr.params)
                                                    )));
                                                }
                                            }
                                        }
                                    } else if self.should_transform_workflow_arrow_function(arrow_expr, true) {
                                        if self.validate_async_arrow_function(arrow_expr, arrow_expr.span) {
                                            self.workflow_function_names.insert(name.clone());

                                            match self.mode {
                                                TransformMode::Step => {
                                                    // Workflow functions are not processed in step mode
                                                }
                                                TransformMode::Workflow => {
                                                    // In workflow mode, just remove the directive from workflow functions
                                                    self.remove_use_workflow_directive_arrow(&mut arrow_expr.body);
                                                }
                                                TransformMode::Client => {
                                                    // Transform arrow function to use workflow start call
                                                    self.remove_use_workflow_directive_arrow(&mut arrow_expr.body);
                                                    arrow_expr.body = Box::new(BlockStmtOrExpr::Expr(Box::new(
                                                        self.create_workflow_start_call_arrow(&name, &arrow_expr.params)
                                                    )));
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
                export_decl.visit_mut_children_with(self);
            }
            _ => {
                export_decl.visit_mut_children_with(self);
            }
        }
    }

    fn visit_mut_var_decl(&mut self, var_decl: &mut VarDecl) {
        // Handle variable declarations with function expressions
        for decl in var_decl.decls.iter_mut() {
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
                                        TransformMode::Step => {
                                            self.remove_use_step_directive(
                                                &mut fn_expr.function.body,
                                            );
                                            self.create_registration_call(&name);
                                        }
                                        TransformMode::Workflow => {
                                            // Replace with proxy
                                            **init = self.create_step_proxy(&name);
                                        }
                                        TransformMode::Client => {
                                            // Transform step function body to use run step call
                                            self.remove_use_step_directive(
                                                &mut fn_expr.function.body,
                                            );
                                            if let Some(body) = &mut fn_expr.function.body {
                                                body.stmts = vec![Stmt::Return(ReturnStmt {
                                                    span: DUMMY_SP,
                                                    arg: Some(Box::new(self.create_run_step_call(&name, &fn_expr.function.params))),
                                                })];
                                            }
                                        }
                                    }
                                }
                            } else if self.should_transform_workflow_function(&fn_expr.function, false) {
                                if self.validate_async_function(
                                    &fn_expr.function,
                                    fn_expr.function.span,
                                ) {
                                    self.workflow_function_names.insert(name.clone());

                                    match self.mode {
                                        TransformMode::Step => {
                                            // Workflow functions are not processed in step mode
                                        }
                                        TransformMode::Workflow => {
                                            // In workflow mode, just remove the directive from workflow functions
                                            self.remove_use_workflow_directive(&mut fn_expr.function.body);
                                        }
                                        TransformMode::Client => {
                                            // Transform workflow function body to use workflow start call
                                            self.remove_use_workflow_directive(
                                                &mut fn_expr.function.body,
                                            );
                                            if let Some(body) = &mut fn_expr.function.body {
                                                body.stmts = vec![Stmt::Return(ReturnStmt {
                                                    span: DUMMY_SP,
                                                    arg: Some(Box::new(self.create_workflow_start_call(&name, &fn_expr.function.params))),
                                                })];
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        Expr::Arrow(arrow_expr) => {
                            if self.should_transform_arrow_function(arrow_expr, false) {
                                if self.validate_async_arrow_function(arrow_expr, arrow_expr.span) {
                                    self.step_function_names.insert(name.clone());

                                    match self.mode {
                                        TransformMode::Step => {
                                            self.remove_use_step_directive_arrow(&mut arrow_expr.body);
                                            self.create_registration_call(&name);
                                        }
                                        TransformMode::Workflow => {
                                            // Replace with proxy
                                            **init = self.create_step_proxy(&name);
                                        }
                                        TransformMode::Client => {
                                            // Transform arrow function to use run step call
                                            self.remove_use_step_directive_arrow(&mut arrow_expr.body);
                                            arrow_expr.body = Box::new(BlockStmtOrExpr::Expr(Box::new(
                                                self.create_run_step_call_arrow(&name, &arrow_expr.params)
                                            )));
                                        }
                                    }
                                }
                            } else if self.should_transform_workflow_arrow_function(arrow_expr, false) {
                                if self.validate_async_arrow_function(arrow_expr, arrow_expr.span) {
                                    self.workflow_function_names.insert(name.clone());

                                    match self.mode {
                                        TransformMode::Step => {
                                            // Workflow functions are not processed in step mode
                                        }
                                        TransformMode::Workflow => {
                                            // In workflow mode, just remove the directive from workflow functions
                                            self.remove_use_workflow_directive_arrow(&mut arrow_expr.body);
                                        }
                                        TransformMode::Client => {
                                            // Transform arrow function to use workflow start call
                                            self.remove_use_workflow_directive_arrow(&mut arrow_expr.body);
                                            arrow_expr.body = Box::new(BlockStmtOrExpr::Expr(Box::new(
                                                self.create_workflow_start_call_arrow(&name, &arrow_expr.params)
                                            )));
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
