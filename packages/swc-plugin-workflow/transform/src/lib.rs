use serde::Deserialize;
use std::collections::HashSet;
use swc_core::{
    common::{DUMMY_SP, SyntaxContext, errors::HANDLER},
    ecma::{
        ast::*,
        visit::{VisitMut, VisitMutWith, noop_visit_mut_type},
    },
};

#[derive(Debug, Clone)]
enum WorkflowErrorKind {
    NonAsyncFunction {
        span: swc_core::common::Span,
        directive: &'static str,
    },
    MisplacedDirective {
        span: swc_core::common::Span,
        directive: String,
        location: DirectiveLocation,
    },
    MisspelledDirective {
        span: swc_core::common::Span,
        directive: String,
        expected: &'static str,
    },
    ForbiddenExpression {
        span: swc_core::common::Span,
        expr: &'static str,
        directive: &'static str,
    },
    InvalidExport {
        span: swc_core::common::Span,
        directive: &'static str,
    },
}

#[derive(Debug, Clone)]
enum DirectiveLocation {
    Module,
    FunctionBody,
}

fn emit_error(error: WorkflowErrorKind) {
    let (span, msg) = match error {
        WorkflowErrorKind::NonAsyncFunction { span, directive } => (
            span,
            format!("Functions marked with \"{}\" must be async functions", directive),
        ),
        WorkflowErrorKind::MisplacedDirective { span, directive, location } => (
            span,
            format!(
                "The \"{}\" directive must be at the top of the {}",
                directive,
                match location {
                    DirectiveLocation::Module => "file",
                    DirectiveLocation::FunctionBody => "function body",
                }
            ),
        ),
        WorkflowErrorKind::MisspelledDirective { span, directive, expected } => (
            span,
            format!("Did you mean \"{}\"? \"{}\" is not a supported directive", expected, directive),
        ),
        WorkflowErrorKind::ForbiddenExpression { span, expr, directive } => (
            span,
            format!("Functions marked with \"{}\" cannot use `{}`", directive, expr),
        ),
        WorkflowErrorKind::InvalidExport { span, directive } => (
            span,
            format!("Only async functions can be exported from a \"{}\" file", directive),
        ),
    };
    
    HANDLER.with(|handler| handler.struct_span_err(span, &msg).emit());
}

// Helper function to detect similar strings (typos)
fn detect_similar_strings(a: &str, b: &str) -> bool {
    let a_chars: Vec<char> = a.chars().collect();
    let b_chars: Vec<char> = b.chars().collect();
    
    if (a_chars.len() as i32 - b_chars.len() as i32).abs() > 1 {
        return false;
    }
    
    let mut differences = 0;
    let mut i = 0;
    let mut j = 0;
    
    while i < a_chars.len() && j < b_chars.len() {
        if a_chars[i] != b_chars[j] {
            differences += 1;
            if differences > 1 {
                return false;
            }
            
            if a_chars.len() > b_chars.len() {
                i += 1;
            } else if b_chars.len() > a_chars.len() {
                j += 1;
            } else {
                i += 1;
                j += 1;
            }
        } else {
            i += 1;
            j += 1;
        }
    }
    
    differences + (a_chars.len() - i) + (b_chars.len() - j) == 1
}

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
    // Track closure variables
    names: Vec<Name>,
    should_track_names: bool,
    in_module_level: bool,
    in_callee: bool,
    // Track context for validation
    in_step_function: bool,
    in_workflow_function: bool,
}

// Structure to track variable names and their access patterns
#[derive(Debug, Clone, PartialEq, Eq)]
struct Name {
    id: Id,
    props: Vec<NameProp>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct NameProp {
    sym: swc_core::atoms::Atom,
    optional: bool,
}

impl From<&Ident> for Name {
    fn from(ident: &Ident) -> Self {
        Name {
            id: ident.to_id(),
            props: vec![],
        }
    }
}

impl TryFrom<&Expr> for Name {
    type Error = ();
    
    fn try_from(expr: &Expr) -> Result<Self, Self::Error> {
        match expr {
            Expr::Ident(ident) => Ok(Name::from(ident)),
            Expr::Member(member) => {
                if let MemberProp::Ident(prop) = &member.prop {
                    let mut name = Name::try_from(&*member.obj)?;
                    name.props.push(NameProp {
                        sym: prop.sym.clone(),
                        optional: false,
                    });
                    Ok(name)
                } else {
                    Err(())
                }
            }
            Expr::OptChain(opt_chain) => {
                if let OptChainBase::Member(member) = &*opt_chain.base {
                    if let MemberProp::Ident(prop) = &member.prop {
                        let mut name = Name::try_from(&*member.obj)?;
                        name.props.push(NameProp {
                            sym: prop.sym.clone(),
                            optional: opt_chain.optional,
                        });
                        Ok(name)
                    } else {
                        Err(())
                    }
                } else {
                    Err(())
                }
            }
            _ => Err(()),
        }
    }
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
            names: Vec::new(),
            should_track_names: false,
            in_module_level: true,
            in_callee: false,
            in_step_function: false,
            in_workflow_function: false,
        }
    }

    // Helper function to convert parameter patterns to expressions
    fn pat_to_expr(&self, pat: &Pat) -> Expr {
        match pat {
            Pat::Ident(ident) => Expr::Ident(Ident::new(
                ident.id.sym.clone(),
                DUMMY_SP,
                SyntaxContext::empty(),
            )),
            Pat::Object(obj_pat) => {
                // Reconstruct object from destructured bindings
                let props = obj_pat.props.iter().filter_map(|prop| {
                    match prop {
                        ObjectPatProp::KeyValue(kv) => {
                            let key = match &kv.key {
                                PropName::Ident(ident) => PropName::Ident(IdentName::new(
                                    ident.sym.clone(),
                                    DUMMY_SP,
                                )),
                                PropName::Str(s) => PropName::Str(Str {
                                    span: DUMMY_SP,
                                    value: s.value.clone(),
                                    raw: None,
                                }),
                                PropName::Num(n) => PropName::Num(Number {
                                    span: DUMMY_SP,
                                    value: n.value,
                                    raw: None,
                                }),
                                PropName::BigInt(bi) => PropName::BigInt(BigInt {
                                    span: DUMMY_SP,
                                    value: bi.value.clone(),
                                    raw: None,
                                }),
                                PropName::Computed(_computed) => {
                                    // For computed properties, we need to handle differently
                                    // For now, skip them
                                    return None;
                                }
                            };
                            
                            Some(PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
                                key,
                                value: Box::new(self.pat_to_expr(&kv.value)),
                            }))))
                        }
                        ObjectPatProp::Assign(assign) => {
                            // Shorthand property like {a} in {a, b}
                            Some(PropOrSpread::Prop(Box::new(Prop::Shorthand(Ident::new(
                                assign.key.sym.clone(),
                                DUMMY_SP,
                                SyntaxContext::empty(),
                            )))))
                        }
                        ObjectPatProp::Rest(rest) => {
                            // Handle rest pattern like {...rest}
                            Some(PropOrSpread::Spread(SpreadElement {
                                dot3_token: DUMMY_SP,
                                expr: Box::new(self.pat_to_expr(&rest.arg)),
                            }))
                        }
                    }
                }).collect();
                
                Expr::Object(ObjectLit {
                    span: DUMMY_SP,
                    props,
                })
            }
            Pat::Array(array_pat) => {
                // Reconstruct array from destructured bindings
                let elems = array_pat.elems.iter().map(|elem| {
                    elem.as_ref().map(|pat| ExprOrSpread {
                        spread: None,
                        expr: Box::new(self.pat_to_expr(pat)),
                    })
                }).collect();
                
                Expr::Array(ArrayLit {
                    span: DUMMY_SP,
                    elems,
                })
            }
            Pat::Rest(rest_pat) => {
                // For rest patterns in function parameters, just use the identifier
                self.pat_to_expr(&rest_pat.arg)
            }
            Pat::Assign(assign_pat) => {
                // For default parameters, use the left side identifier
                self.pat_to_expr(&assign_pat.left)
            }
            _ => {
                // For other patterns, fall back to null
                // This includes: Pat::Invalid, Pat::Expr
                Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))
            }
        }
    }

    // Check if a function has the "use step" directive
    fn has_use_step_directive(&self, body: &Option<BlockStmt>) -> bool {
        if let Some(body) = body {
            let mut is_first_meaningful = true;
            
            for stmt in body.stmts.iter() {
                if let Stmt::Expr(ExprStmt { expr, span: stmt_span, .. }) = stmt {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        if value == "use step" {
                            if !is_first_meaningful {
                                emit_error(WorkflowErrorKind::MisplacedDirective {
                                    span: *stmt_span,
                                    directive: value.to_string(),
                                    location: DirectiveLocation::FunctionBody,
                                });
                            }
                            return true;
                        } else if detect_similar_strings(value, "use step") {
                            emit_error(WorkflowErrorKind::MisspelledDirective {
                                span: *stmt_span,
                                directive: value.to_string(),
                                expected: "use step",
                            });
                        }
                    }
                }
                // Any non-directive statement means directives can't come after
                is_first_meaningful = false;
            }
            
            false
        } else {
            false
        }
    }

    // Check if a function has the "use workflow" directive
    fn has_use_workflow_directive(&self, body: &Option<BlockStmt>) -> bool {
        if let Some(body) = body {
            let mut is_first_meaningful = true;
            
            for stmt in body.stmts.iter() {
                if let Stmt::Expr(ExprStmt { expr, span: stmt_span, .. }) = stmt {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        if value == "use workflow" {
                            if !is_first_meaningful {
                                emit_error(WorkflowErrorKind::MisplacedDirective {
                                    span: *stmt_span,
                                    directive: value.to_string(),
                                    location: DirectiveLocation::FunctionBody,
                                });
                            }
                            return true;
                        } else if detect_similar_strings(value, "use workflow") {
                            emit_error(WorkflowErrorKind::MisspelledDirective {
                                span: *stmt_span,
                                directive: value.to_string(),
                                expected: "use workflow",
                            });
                        }
                    }
                }
                // Any non-directive statement means directives can't come after
                is_first_meaningful = false;
            }
            
            false
        } else {
            false
        }
    }

    // Check if the module has a top-level "use step" directive
    fn check_module_directive(&mut self, items: &[ModuleItem]) -> bool {
        let mut found_directive = false;
        let mut is_first_meaningful = true;
        
        for item in items {
            match item {
                ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, span, .. })) => {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        if value == "use step" {
                            if !is_first_meaningful {
                                emit_error(WorkflowErrorKind::MisplacedDirective {
                                    span: *span,
                                    directive: value.to_string(),
                                    location: DirectiveLocation::Module,
                                });
                            } else {
                                found_directive = true;
                                // Don't break - continue checking for other directives
                            }
                        } else if value == "use workflow" {
                            // Can't have both directives
                            if found_directive {
                                emit_error(WorkflowErrorKind::MisplacedDirective {
                                    span: *span,
                                    directive: value.to_string(),
                                    location: DirectiveLocation::Module,
                                });
                            }
                        } else if detect_similar_strings(value, "use step") {
                            emit_error(WorkflowErrorKind::MisspelledDirective {
                                span: *span,
                                directive: value.to_string(),
                                expected: "use step",
                            });
                        }
                    }
                    // Any non-directive expression statement means directives can't come after
                    if !found_directive {
                        is_first_meaningful = false;
                    }
                }
                ModuleItem::ModuleDecl(ModuleDecl::Import(_)) => {
                    // Imports after directive are not allowed
                    if found_directive {
                        // This is okay - imports can come after directives
                    } else {
                        // But directives can't come after imports
                        is_first_meaningful = false;
                    }
                }
                _ => {
                    // Any other module item means directives can't come after
                    is_first_meaningful = false;
                }
            }
        }
        
        found_directive
    }

    // Check if the module has a top-level "use workflow" directive
    fn check_module_workflow_directive(&mut self, items: &[ModuleItem]) -> bool {
        let mut found_directive = false;
        let mut is_first_meaningful = true;
        
        for item in items {
            match item {
                ModuleItem::Stmt(Stmt::Expr(ExprStmt { expr, span, .. })) => {
                    if let Expr::Lit(Lit::Str(Str { value, .. })) = &**expr {
                        if value == "use workflow" {
                            if !is_first_meaningful {
                                emit_error(WorkflowErrorKind::MisplacedDirective {
                                    span: *span,
                                    directive: value.to_string(),
                                    location: DirectiveLocation::Module,
                                });
                            } else {
                                found_directive = true;
                                // Don't break - continue checking for other directives
                            }
                        } else if value == "use step" {
                            // Can't have both directives
                            if found_directive {
                                emit_error(WorkflowErrorKind::MisplacedDirective {
                                    span: *span,
                                    directive: value.to_string(),
                                    location: DirectiveLocation::Module,
                                });
                            }
                        } else if detect_similar_strings(value, "use workflow") {
                            emit_error(WorkflowErrorKind::MisspelledDirective {
                                span: *span,
                                directive: value.to_string(),
                                expected: "use workflow",
                            });
                        }
                    }
                    // Any non-directive expression statement means directives can't come after
                    if !found_directive {
                        is_first_meaningful = false;
                    }
                }
                ModuleItem::ModuleDecl(ModuleDecl::Import(_)) => {
                    // Imports after directive are not allowed
                    if found_directive {
                        // This is okay - imports can come after directives
                    } else {
                        // But directives can't come after imports
                        is_first_meaningful = false;
                    }
                }
                _ => {
                    // Any other module item means directives can't come after
                    is_first_meaningful = false;
                }
            }
        }
        
        found_directive
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
                Some(ExprOrSpread {
                    spread: None,
                    expr: Box::new(self.pat_to_expr(param)),
                })
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
                Some(ExprOrSpread {
                    spread: None,
                    expr: Box::new(self.pat_to_expr(param)),
                })
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
            callee: Callee::Expr(Box::new(Expr::Call(CallExpr {
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
            }))),
            args: vec![],
            type_args: None,
        })
    }

    // Create a workflow start call (client mode)
    fn create_workflow_start_call(&self, fn_name: &str, params: &[Param]) -> Expr {
        let args_array = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: params.iter().map(|param| {
                Some(ExprOrSpread {
                    spread: None,
                    expr: Box::new(self.pat_to_expr(&param.pat)),
                })
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
                Some(ExprOrSpread {
                    spread: None,
                    expr: Box::new(self.pat_to_expr(&param.pat)),
                })
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

    fn visit_mut_function(&mut self, function: &mut Function) {
        let has_step_directive = self.has_use_step_directive(&function.body);
        let has_workflow_directive = self.has_use_workflow_directive(&function.body);
        
        // Set context for forbidden expression checking
        let old_in_step = self.in_step_function;
        let old_in_workflow = self.in_workflow_function;
        let old_in_module = self.in_module_level;
        
        if has_step_directive {
            self.in_step_function = true;
        }
        if has_workflow_directive {
            self.in_workflow_function = true;
        }
        self.in_module_level = false;
        
        // Visit children
        function.visit_mut_children_with(self);
        
        // Restore context
        self.in_step_function = old_in_step;
        self.in_workflow_function = old_in_workflow;
        self.in_module_level = old_in_module;
    }

    fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
        let has_step_directive = self.has_use_step_directive_arrow(&arrow.body);
        let has_workflow_directive = self.has_use_workflow_directive_arrow(&arrow.body);
        
        // Set context for forbidden expression checking
        let old_in_step = self.in_step_function;
        let old_in_workflow = self.in_workflow_function;
        let old_in_module = self.in_module_level;
        
        if has_step_directive {
            self.in_step_function = true;
        }
        if has_workflow_directive {
            self.in_workflow_function = true;
        }
        self.in_module_level = false;
        
        // Visit children
        arrow.visit_mut_children_with(self);
        
        // Restore context
        self.in_step_function = old_in_step;
        self.in_workflow_function = old_in_workflow;
        self.in_module_level = old_in_module;
    }

    // Add forbidden expression checks
    fn visit_mut_this_expr(&mut self, expr: &mut ThisExpr) {
        if self.in_step_function {
            emit_error(WorkflowErrorKind::ForbiddenExpression {
                span: expr.span,
                expr: "this",
                directive: "use step",
            });
        } else if self.in_workflow_function {
            emit_error(WorkflowErrorKind::ForbiddenExpression {
                span: expr.span,
                expr: "this",
                directive: "use workflow",
            });
        }
    }

    fn visit_mut_super(&mut self, sup: &mut Super) {
        if self.in_step_function {
            emit_error(WorkflowErrorKind::ForbiddenExpression {
                span: sup.span,
                expr: "super",
                directive: "use step",
            });
        } else if self.in_workflow_function {
            emit_error(WorkflowErrorKind::ForbiddenExpression {
                span: sup.span,
                expr: "super",
                directive: "use workflow",
            });
        }
    }

    fn visit_mut_ident(&mut self, ident: &mut Ident) {
        if ident.sym == *"arguments" {
            if self.in_step_function {
                emit_error(WorkflowErrorKind::ForbiddenExpression {
                    span: ident.span,
                    expr: "arguments",
                    directive: "use step",
                });
            } else if self.in_workflow_function {
                emit_error(WorkflowErrorKind::ForbiddenExpression {
                    span: ident.span,
                    expr: "arguments",
                    directive: "use workflow",
                });
            }
        }
    }

    // Track when we're in a callee position
    fn visit_mut_callee(&mut self, callee: &mut Callee) {
        let old_in_callee = self.in_callee;
        self.in_callee = true;
        callee.visit_mut_children_with(self);
        self.in_callee = old_in_callee;
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
            // Validate exports if we have a file-level directive
            if self.has_file_directive || self.has_file_workflow_directive {
                match item {
                    ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => {
                        match &export.decl {
                            Decl::Fn(fn_decl) => {
                                if !fn_decl.function.is_async {
                                    emit_error(WorkflowErrorKind::InvalidExport {
                                        span: export.span,
                                        directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                    });
                                }
                            }
                            Decl::Var(var_decl) => {
                                // Check if any of the variable declarations contain non-async functions
                                for decl in &var_decl.decls {
                                    if let Some(init) = &decl.init {
                                        match &**init {
                                            Expr::Fn(fn_expr) => {
                                                if !fn_expr.function.is_async {
                                                    emit_error(WorkflowErrorKind::InvalidExport {
                                                        span: export.span,
                                                        directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                                    });
                                                }
                                            }
                                            Expr::Arrow(arrow_expr) => {
                                                if !arrow_expr.is_async {
                                                    emit_error(WorkflowErrorKind::InvalidExport {
                                                        span: export.span,
                                                        directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                                    });
                                                }
                                            }
                                            Expr::Lit(_) => {
                                                // Literals are not allowed
                                                emit_error(WorkflowErrorKind::InvalidExport {
                                                    span: export.span,
                                                    directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                                });
                                            }
                                            _ => {
                                                // Other expressions might be okay if they resolve to async functions
                                                // but we can't easily check that statically
                                            }
                                        }
                                    }
                                }
                            }
                            Decl::Class(_) => {
                                // Classes are not allowed
                                emit_error(WorkflowErrorKind::InvalidExport {
                                    span: export.span,
                                    directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                });
                            }
                            Decl::TsInterface(_) | Decl::TsTypeAlias(_) | Decl::TsEnum(_) | Decl::TsModule(_) => {
                                // TypeScript declarations are okay
                            }
                            Decl::Using(_) => {
                                emit_error(WorkflowErrorKind::InvalidExport {
                                    span: export.span,
                                    directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                });
                            }
                        }
                    }
                    ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(named)) => {
                        if named.src.is_some() {
                            // Re-exports are not allowed
                            emit_error(WorkflowErrorKind::InvalidExport {
                                span: named.span,
                                directive: if self.has_file_directive { "use step" } else { "use workflow" },
                            });
                        }
                    }
                    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(default)) => {
                        match &default.decl {
                            DefaultDecl::Fn(fn_expr) => {
                                if !fn_expr.function.is_async {
                                    emit_error(WorkflowErrorKind::InvalidExport {
                                        span: default.span,
                                        directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                    });
                                }
                            }
                            DefaultDecl::Class(_) => {
                                emit_error(WorkflowErrorKind::InvalidExport {
                                    span: default.span,
                                    directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                });
                            }
                            DefaultDecl::TsInterfaceDecl(_) => {
                                // TypeScript interface is okay
                            }
                        }
                    }
                    ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(expr)) => {
                        match &*expr.expr {
                            Expr::Fn(fn_expr) => {
                                if !fn_expr.function.is_async {
                                    emit_error(WorkflowErrorKind::InvalidExport {
                                        span: expr.span,
                                        directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                    });
                                }
                            }
                            Expr::Arrow(arrow_expr) => {
                                if !arrow_expr.is_async {
                                    emit_error(WorkflowErrorKind::InvalidExport {
                                        span: expr.span,
                                        directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                    });
                                }
                            }
                            _ => {
                                // Other default exports are not allowed
                                emit_error(WorkflowErrorKind::InvalidExport {
                                    span: expr.span,
                                    directive: if self.has_file_directive { "use step" } else { "use workflow" },
                                });
                            }
                        }
                    }
                    ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all)) => {
                        // export * from '...' is not allowed
                        emit_error(WorkflowErrorKind::InvalidExport {
                            span: export_all.span,
                            directive: if self.has_file_directive { "use step" } else { "use workflow" },
                        });
                    }
                    _ => {}
                }
            }
            
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
                                // Keep the function declaration but replace its body with a proxy call
                                self.remove_use_step_directive(&mut fn_decl.function.body);
                                if let Some(body) = &mut fn_decl.function.body {
                                    let mut proxy_call = self.create_step_proxy(&fn_name);
                                    // Add function arguments to the proxy call
                                    if let Expr::Call(call) = &mut proxy_call {
                                        call.args = fn_decl.function.params.iter().map(|param| {
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(self.pat_to_expr(&param.pat)),
                                            }
                                        }).collect();
                                    }
                                    body.stmts = vec![Stmt::Return(ReturnStmt {
                                        span: DUMMY_SP,
                                        arg: Some(Box::new(proxy_call)),
                                    })];
                                }
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
                                // Keep the function declaration but replace its body with a proxy call
                                self.remove_use_step_directive(&mut fn_decl.function.body);
                                if let Some(body) = &mut fn_decl.function.body {
                                    let mut proxy_call = self.create_step_proxy(&fn_name);
                                    // Add function arguments to the proxy call
                                    if let Expr::Call(call) = &mut proxy_call {
                                        call.args = fn_decl.function.params.iter().map(|param| {
                                            ExprOrSpread {
                                                spread: None,
                                                expr: Box::new(self.pat_to_expr(&param.pat)),
                                            }
                                        }).collect();
                                    }
                                    body.stmts = vec![Stmt::Return(ReturnStmt {
                                        span: DUMMY_SP,
                                        arg: Some(Box::new(proxy_call)),
                                    })];
                                }
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
                                                    // Keep the function expression but replace its body with a proxy call
                                                    self.remove_use_step_directive(&mut fn_expr.function.body);
                                                    if let Some(body) = &mut fn_expr.function.body {
                                                        let mut proxy_call = self.create_step_proxy(&name);
                                                        // Add function arguments to the proxy call
                                                        if let Expr::Call(call) = &mut proxy_call {
                                                            call.args = fn_expr.function.params.iter().map(|param| {
                                                                ExprOrSpread {
                                                                    spread: None,
                                                                    expr: Box::new(self.pat_to_expr(&param.pat)),
                                                                }
                                                            }).collect();
                                                        }
                                                        body.stmts = vec![Stmt::Return(ReturnStmt {
                                                            span: DUMMY_SP,
                                                            arg: Some(Box::new(proxy_call)),
                                                        })];
                                                    }
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
                                                    // Keep the arrow function but replace its body with a proxy call
                                                    self.remove_use_step_directive_arrow(&mut arrow_expr.body);
                                                    let mut proxy_call = self.create_step_proxy(&name);
                                                    // Add function arguments to the proxy call
                                                    if let Expr::Call(call) = &mut proxy_call {
                                                        call.args = arrow_expr.params.iter().map(|param| {
                                                            ExprOrSpread {
                                                                spread: None,
                                                                expr: Box::new(self.pat_to_expr(param)),
                                                            }
                                                        }).collect();
                                                    }
                                                    arrow_expr.body = Box::new(BlockStmtOrExpr::Expr(Box::new(proxy_call)));
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
                                            // Keep the function expression but replace its body with a proxy call
                                            self.remove_use_step_directive(&mut fn_expr.function.body);
                                            if let Some(body) = &mut fn_expr.function.body {
                                                let mut proxy_call = self.create_step_proxy(&name);
                                                // Add function arguments to the proxy call
                                                if let Expr::Call(call) = &mut proxy_call {
                                                    call.args = fn_expr.function.params.iter().map(|param| {
                                                        ExprOrSpread {
                                                            spread: None,
                                                            expr: Box::new(self.pat_to_expr(&param.pat)),
                                                        }
                                                    }).collect();
                                                }
                                                body.stmts = vec![Stmt::Return(ReturnStmt {
                                                    span: DUMMY_SP,
                                                    arg: Some(Box::new(proxy_call)),
                                                })];
                                            }
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
                                            // Keep the arrow function but replace its body with a proxy call
                                            self.remove_use_step_directive_arrow(&mut arrow_expr.body);
                                            let mut proxy_call = self.create_step_proxy(&name);
                                            // Add function arguments to the proxy call
                                            if let Expr::Call(call) = &mut proxy_call {
                                                call.args = arrow_expr.params.iter().map(|param| {
                                                    ExprOrSpread {
                                                        spread: None,
                                                        expr: Box::new(self.pat_to_expr(param)),
                                                    }
                                                }).collect();
                                            }
                                            arrow_expr.body = Box::new(BlockStmtOrExpr::Expr(Box::new(proxy_call)));
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

    // Handle JSX attributes with function values
    fn visit_mut_jsx_attr(&mut self, attr: &mut JSXAttr) {
        // Track function names from JSX attributes
        if let (Some(JSXAttrValue::JSXExprContainer(_container)), JSXAttrName::Ident(_ident_name)) = 
            (&attr.value, &attr.name) 
        {
            // Store the attribute name for function naming
            // This would need to be added to the struct as a field
        }
        
        attr.visit_mut_children_with(self);
    }

    // Handle object properties with function values
    fn visit_mut_prop_or_spread(&mut self, prop: &mut PropOrSpread) {
        match prop {
            PropOrSpread::Prop(boxed_prop) => {
                match &mut **boxed_prop {
                    Prop::Method(method_prop) => {
                        // Handle object methods
                        let has_step = self.has_use_step_directive(&method_prop.function.body);
                        let has_workflow = self.has_use_workflow_directive(&method_prop.function.body);
                        
                        if has_step && !method_prop.function.is_async {
                            emit_error(WorkflowErrorKind::NonAsyncFunction {
                                span: method_prop.function.span,
                                directive: "use step",
                            });
                        } else if has_workflow && !method_prop.function.is_async {
                            emit_error(WorkflowErrorKind::NonAsyncFunction {
                                span: method_prop.function.span,
                                directive: "use workflow",
                            });
                        }
                    }
                    _ => {}
                }
            }
            _ => {}
        }
        
        prop.visit_mut_children_with(self);
    }

    // Handle class methods
    fn visit_mut_class_method(&mut self, method: &mut ClassMethod) {
        if !method.is_static {
            // Instance methods can't be step/workflow functions
            let has_step = self.has_use_step_directive(&method.function.body);
            let has_workflow = self.has_use_workflow_directive(&method.function.body);
            
            if has_step {
                HANDLER.with(|handler| {
                    handler
                        .struct_span_err(
                            method.span,
                            "Instance methods cannot be marked with \"use step\". Only static methods, functions, and object methods are supported.",
                        )
                        .emit()
                });
            } else if has_workflow {
                HANDLER.with(|handler| {
                    handler
                        .struct_span_err(
                            method.span,
                            "Instance methods cannot be marked with \"use workflow\". Only static methods, functions, and object methods are supported.",
                        )
                        .emit()
                });
            }
        } else {
            // Static methods can be step/workflow functions
            method.visit_mut_children_with(self);
        }
    }

    // Handle assignment expressions
    fn visit_mut_assign_expr(&mut self, assign: &mut AssignExpr) {
        // Track function names from assignments like `foo = async () => {}`
        assign.visit_mut_children_with(self);
    }

    // Override visit_mut_expr to track closure variables
    fn visit_mut_expr(&mut self, expr: &mut Expr) {
        if !self.in_module_level && self.should_track_names {
            if let Ok(name) = Name::try_from(&*expr) {
                if self.in_callee {
                    // This is a callee, we need to track the actual value
                    // For now, just track the name
                }
                self.names.push(name);
            }
        }
        
        expr.visit_mut_children_with(self);
    }

    noop_visit_mut_type!();
}
