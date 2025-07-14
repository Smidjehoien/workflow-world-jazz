# Closure Handling Improvements

pranay: this file is cursor AI generated fluff. Will revisit and clean it but I wanted to dump this somewhere for now.

The current closure detection in the workflow transform is basic compared to Next.js's implementation. This document outlines the improvements needed to make it more robust.

## Current Implementation

Currently we have:
- Basic closure variable collection (`declared_idents`, `names`)
- Simple property access tracking (`Name` and `NameProp` structs)
- Basic expression tracking in `visit_mut_expr`
- No encryption, hoisting, or proper binding

## Needed Improvements

### 1. Add Encryption/Decryption of Closure Variables [pranay: not needed for us]

```rust
fn create_encryption_call(&self, action_id: &str, closure_vars: &[Name]) -> Expr {
    Expr::Call(CallExpr {
        callee: quote_ident!("encryptActionBoundArgs").as_callee(),
        args: std::iter::once(action_id.as_arg())
            .chain(closure_vars.iter().map(|var| var.as_arg()))
            .collect(),
        ..Default::default()
    })
}
```

This will require:
- Adding encryption utilities
- Handling decryption on the server side
- Ensuring secure transmission of encrypted values

### 2. Implement Function Hoisting

```rust
fn hoist_function_with_closure(&mut self, fn_name: &str, closure_vars: &[Name], body: &BlockStmt) -> (Stmt, Expr) {
    // Create hoisted function with closure vars as params
    let hoisted_fn = Stmt::Decl(Decl::Fn(FnDecl {
        ident: private_ident!(fn_name),
        function: Function {
            params: closure_vars.iter().map(|var| Param::from(var)).collect(),
            body: Some(body.clone()),
            ..Default::default()
        },
        ..Default::default()
    }));

    // Create proxy that binds closure vars
    let proxy = Expr::Call(CallExpr {
        callee: Expr::Member(MemberExpr {
            obj: Box::new(Expr::Ident(private_ident!(fn_name))),
            prop: quote_ident!("bind").into(),
        }),
        args: std::iter::once(Expr::Null(..).as_arg())
            .chain(closure_vars.iter().map(|var| var.as_arg())),
        ..Default::default()
    });

    (hoisted_fn, proxy)
}
```

This will require:
- Moving functions to module scope
- Handling name conflicts
- Preserving source maps
- Managing dependencies between hoisted functions

### 3. Add Proper Binding and Argument Passing

```rust
fn create_bound_action(&mut self, fn_name: &str, closure_vars: &[Name]) -> Expr {
    let action_id = self.generate_action_id(fn_name);
    
    Expr::Call(CallExpr {
        callee: quote_ident!("createBoundAction").as_callee(),
        args: vec![
            action_id.as_arg(),
            self.create_encryption_call(&action_id, closure_vars).as_arg(),
        ],
        ..Default::default()
    })
}
```

This will require:
- Creating unique action IDs
- Handling argument serialization
- Managing bound arguments on client and server

### 4. Enhance Closure Detection

```rust
fn visit_mut_class_method(&mut self, method: &mut ClassMethod) {
    let old_tracking = self.should_track_names;
    self.should_track_names = true;
    
    // Track closure vars from class scope
    let mut class_closure_vars = Vec::new();
    method.function.visit_mut_with(&mut ClosureTracker {
        declared: &self.declared_idents,
        found: &mut class_closure_vars,
    });
    
    // Process method normally
    method.visit_mut_children_with(self);
    
    self.should_track_names = old_tracking;
}
```

This will require:
- Better handling of class methods
- Support for object methods
- Handling computed properties
- Supporting optional chaining
- Tracking complex property access patterns

### 5. Runtime Support

Need to add runtime utilities for:
- Encryption/decryption
- Argument binding
- Action registration
- Error handling

### 6. Testing

Add test cases for:
- Complex closure scenarios
- Nested functions
- Class methods
- Object methods
- Property access patterns
- Error cases

## References

- Next.js server actions implementation in `next_server_action_transform.rs`
- Current workflow transform implementation
- SWC AST documentation

## Impact

These improvements will make the workflow transform more robust by:
- Properly handling closures in all contexts
- Securing closure variable transmission
- Maintaining correct scoping
- Supporting more complex usage patterns
- Providing better error messages

## Notes

- This is a significant undertaking that will require careful testing
- Should be done incrementally to maintain stability
- May require runtime API changes
- Will need documentation updates 