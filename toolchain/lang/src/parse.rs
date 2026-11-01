//! Stage 2: tokens into a syntax tree, by recursive descent: one function
//! per precedence level (docs/LANGUAGE.md "Expressions").
use crate::{Expr, Item, LangError, Param, Program, Stmt, Token, Type};

/// The program's syntax tree; the first mistake stops it.
pub fn parse(tokens: &[Token]) -> Result<Program, LangError> {
    let mut p = Parser { t: tokens, i: 0 };
    let mut items = Vec::new();
    while p.peek().is_some() {
        items.push(p.item()?);
    }
    Ok(Program { items })
}

type R<T> = Result<T, LangError>;

struct Parser<'a> {
    t: &'a [Token],
    i: usize,
}

/// A token as the learner wrote it, for messages.
fn shown(t: Option<&Token>) -> String {
    match t {
        None => "the end".into(),
        Some(Token::Num { value, .. }) => value.to_string(),
        Some(Token::Str { text, .. }) => format!("\"{text}\""),
        Some(Token::Name { text, .. } | Token::Kw { text, .. } | Token::Sym { text, .. }) => {
            text.clone()
        }
    }
}

impl Parser<'_> {
    fn peek(&self) -> Option<&Token> {
        self.t.get(self.i)
    }

    /// The line of the next token (or the last one, at the end).
    fn line(&self) -> usize {
        self.peek().or_else(|| self.t.last()).map_or(1, Token::line)
    }

    fn is_sym(&self, s: &str) -> bool {
        matches!(self.peek(), Some(Token::Sym { text, .. }) if text == s)
    }

    fn is_kw(&self, s: &str) -> bool {
        matches!(self.peek(), Some(Token::Kw { text, .. }) if text == s)
    }

    /// `what` is a symbol or keyword in backticks, or one of: name, type,
    /// expression, declaration, statement.
    fn expected(&self, what: &str) -> LangError {
        let found = shown(self.peek());
        LangError::new(
            self.line(),
            "expected",
            format!("expected {}, found {found}", what.trim_matches('`')),
            &[("what", what.to_string()), ("found", found)],
        )
    }

    fn sym(&mut self, s: &str) -> R<()> {
        if self.is_sym(s) {
            self.i += 1;
            Ok(())
        } else {
            Err(self.expected(&format!("`{s}`")))
        }
    }

    fn kw(&mut self, s: &str) -> R<()> {
        if self.is_kw(s) {
            self.i += 1;
            Ok(())
        } else {
            Err(self.expected(&format!("`{s}`")))
        }
    }

    fn eat_sym(&mut self, s: &str) -> bool {
        let yes = self.is_sym(s);
        if yes {
            self.i += 1;
        }
        yes
    }

    fn name(&mut self) -> R<String> {
        match self.peek() {
            Some(Token::Name { text, .. }) => {
                let text = text.clone();
                self.i += 1;
                Ok(text)
            }
            _ => Err(self.expected("name")),
        }
    }

    fn item(&mut self) -> R<Item> {
        let line = self.line();
        if self.is_kw("fn") {
            self.i += 1;
            let name = self.name()?;
            self.sym("(")?;
            let mut params = Vec::new();
            if !self.is_sym(")") {
                loop {
                    let name = self.name()?;
                    self.sym(":")?;
                    params.push(Param {
                        name,
                        ty: self.ty()?,
                    });
                    if !self.eat_sym(",") {
                        break;
                    }
                }
            }
            self.sym(")")?;
            let result = if self.eat_sym("->") {
                Some(self.ty()?)
            } else {
                None
            };
            let body = self.block()?;
            Ok(Item::Fn {
                name,
                params,
                result,
                body,
                line,
            })
        } else if self.is_kw("var") || self.is_kw("const") {
            let is_const = self.is_kw("const");
            self.i += 1;
            let name = self.name()?;
            let ty = if self.eat_sym(":") {
                Some(self.ty()?)
            } else {
                None
            };
            let value = if is_const {
                self.sym("=")?;
                Some(self.expr()?)
            } else if self.eat_sym("=") {
                Some(self.expr()?)
            } else {
                None
            };
            self.sym(";")?;
            Ok(match (is_const, value) {
                (true, Some(value)) => Item::Const {
                    name,
                    ty,
                    value,
                    line,
                },
                (_, value) => Item::Var {
                    name,
                    ty,
                    value,
                    line,
                },
            })
        } else {
            Err(self.expected("declaration"))
        }
    }

    fn ty(&mut self) -> R<Type> {
        if self.is_kw("int") {
            self.i += 1;
            Ok(Type::Int)
        } else if self.is_kw("bool") {
            self.i += 1;
            Ok(Type::Bool)
        } else if self.eat_sym("[") {
            let elem = if self.is_kw("int") || self.is_kw("bool") {
                self.ty()?
            } else {
                return Err(self.expected("type"));
            };
            let size = if self.eat_sym(";") {
                Some(Box::new(self.expr()?))
            } else {
                None
            };
            self.sym("]")?;
            Ok(Type::Array {
                elem: Box::new(elem),
                size,
            })
        } else {
            Err(self.expected("type"))
        }
    }

    fn block(&mut self) -> R<Vec<Stmt>> {
        self.sym("{")?;
        let mut out = Vec::new();
        while !self.is_sym("}") {
            if self.peek().is_none() {
                return Err(self.expected("`}`"));
            }
            out.push(self.stmt()?);
        }
        self.i += 1;
        Ok(out)
    }

    fn stmt(&mut self) -> R<Stmt> {
        let line = self.line();
        if self.is_kw("var") {
            self.i += 1;
            let name = self.name()?;
            let ty = if self.eat_sym(":") {
                Some(self.ty()?)
            } else {
                None
            };
            self.sym("=")?;
            let value = self.expr()?;
            self.sym(";")?;
            Ok(Stmt::Var {
                name,
                ty,
                value,
                line,
            })
        } else if self.is_kw("if") {
            self.if_stmt()
        } else if self.is_kw("while") {
            self.i += 1;
            let cond = self.expr()?;
            let body = self.block()?;
            Ok(Stmt::While { cond, body, line })
        } else if self.is_kw("for") {
            self.i += 1;
            let var = self.name()?;
            self.kw("in")?;
            let from = self.expr()?;
            self.sym("..")?;
            let to = self.expr()?;
            let body = self.block()?;
            Ok(Stmt::For {
                var,
                from,
                to,
                body,
                line,
            })
        } else if self.is_kw("break") || self.is_kw("continue") {
            let brk = self.is_kw("break");
            self.i += 1;
            self.sym(";")?;
            Ok(if brk {
                Stmt::Break { line }
            } else {
                Stmt::Continue { line }
            })
        } else if self.is_kw("return") {
            self.i += 1;
            let value = if self.is_sym(";") {
                None
            } else {
                Some(self.expr()?)
            };
            self.sym(";")?;
            Ok(Stmt::Return { value, line })
        } else {
            if self.peek().is_none() {
                return Err(self.expected("statement"));
            }
            let target = self.expr()?;
            if self.eat_sym("=") {
                let value = self.expr()?;
                self.sym(";")?;
                Ok(Stmt::Assign {
                    target,
                    value,
                    line,
                })
            } else {
                self.sym(";")?;
                Ok(Stmt::Expr { expr: target, line })
            }
        }
    }

    fn if_stmt(&mut self) -> R<Stmt> {
        let line = self.line();
        self.kw("if")?;
        let cond = self.expr()?;
        let then = self.block()?;
        let otherwise = if self.is_kw("else") {
            self.i += 1;
            if self.is_kw("if") {
                Some(vec![self.if_stmt()?])
            } else {
                Some(self.block()?)
            }
        } else {
            None
        };
        Ok(Stmt::If {
            cond,
            then,
            otherwise,
            line,
        })
    }

    fn expr(&mut self) -> R<Expr> {
        self.or()
    }

    /// `a op b op c`, left to right, for operators at one level.
    fn left_assoc(&mut self, ops: &[&str], kw: bool, next: fn(&mut Self) -> R<Expr>) -> R<Expr> {
        let mut left = next(self)?;
        loop {
            let line = self.line();
            let op = match self.peek() {
                Some(Token::Sym { text, .. } | Token::Kw { text, .. })
                    if ops.contains(&text.as_str())
                        && kw == matches!(self.peek(), Some(Token::Kw { .. })) =>
                {
                    text.clone()
                }
                _ => return Ok(left),
            };
            self.i += 1;
            let right = next(self)?;
            left = Expr::Binary {
                op,
                left: Box::new(left),
                right: Box::new(right),
                line,
            };
        }
    }

    fn or(&mut self) -> R<Expr> {
        self.left_assoc(&["or"], true, Self::and)
    }

    fn and(&mut self) -> R<Expr> {
        self.left_assoc(&["and"], true, Self::not)
    }

    fn not(&mut self) -> R<Expr> {
        if self.is_kw("not") {
            let line = self.line();
            self.i += 1;
            let operand = self.not()?;
            return Ok(Expr::Unary {
                op: "not".into(),
                operand: Box::new(operand),
                line,
            });
        }
        self.compare()
    }

    fn compare(&mut self) -> R<Expr> {
        const OPS: [&str; 6] = ["==", "!=", "<", "<=", ">", ">="];
        let is_cmp = |p: &Self| OPS.iter().any(|o| p.is_sym(o));
        let left = self.bit_or()?;
        if !is_cmp(self) {
            return Ok(left);
        }
        let line = self.line();
        let op = shown(self.peek());
        self.i += 1;
        let right = self.bit_or()?;
        if is_cmp(self) {
            return Err(LangError::new(
                self.line(),
                "chained-comparison",
                "comparisons don't chain: write a < b and b < c".into(),
                &[],
            ));
        }
        Ok(Expr::Binary {
            op,
            left: Box::new(left),
            right: Box::new(right),
            line,
        })
    }

    fn bit_or(&mut self) -> R<Expr> {
        self.left_assoc(&["|"], false, Self::bit_xor)
    }

    fn bit_xor(&mut self) -> R<Expr> {
        self.left_assoc(&["^"], false, Self::bit_and)
    }

    fn bit_and(&mut self) -> R<Expr> {
        self.left_assoc(&["&"], false, Self::shift)
    }

    fn shift(&mut self) -> R<Expr> {
        self.left_assoc(&["<<", ">>"], false, Self::sum)
    }

    fn sum(&mut self) -> R<Expr> {
        self.left_assoc(&["+", "-"], false, Self::product)
    }

    fn product(&mut self) -> R<Expr> {
        self.left_assoc(&["*", "/", "%"], false, Self::unary)
    }

    fn unary(&mut self) -> R<Expr> {
        if self.is_sym("-") || self.is_sym("~") {
            let line = self.line();
            let op = shown(self.peek());
            self.i += 1;
            let operand = self.unary()?;
            return Ok(Expr::Unary {
                op,
                operand: Box::new(operand),
                line,
            });
        }
        self.primary()
    }

    fn primary(&mut self) -> R<Expr> {
        let line = self.line();
        let tok = self.peek().cloned();
        match tok {
            Some(Token::Num { value, .. }) => {
                self.i += 1;
                Ok(Expr::Num { value, line })
            }
            Some(Token::Str { text, .. }) => {
                self.i += 1;
                Ok(Expr::Str { text, line })
            }
            Some(Token::Kw { text, .. }) if text == "true" || text == "false" => {
                self.i += 1;
                Ok(Expr::Bool {
                    value: text == "true",
                    line,
                })
            }
            Some(Token::Kw { text, .. }) if text == "mem" => {
                self.i += 1;
                self.sym("[")?;
                let addr = self.expr()?;
                self.sym("]")?;
                Ok(Expr::Mem {
                    addr: Box::new(addr),
                    line,
                })
            }
            Some(Token::Sym { text, .. }) if text == "(" => {
                self.i += 1;
                let e = self.expr()?;
                self.sym(")")?;
                Ok(e)
            }
            Some(Token::Sym { text, .. }) if text == "[" => {
                self.i += 1;
                let mut items = Vec::new();
                if !self.is_sym("]") {
                    loop {
                        items.push(self.expr()?);
                        if !self.eat_sym(",") {
                            break;
                        }
                    }
                }
                self.sym("]")?;
                Ok(Expr::Array { items, line })
            }
            Some(Token::Name { text: name, .. }) => {
                self.i += 1;
                if self.eat_sym("(") {
                    let mut args = Vec::new();
                    if !self.is_sym(")") {
                        loop {
                            args.push(self.expr()?);
                            if !self.eat_sym(",") {
                                break;
                            }
                        }
                    }
                    self.sym(")")?;
                    Ok(Expr::Call { name, args, line })
                } else if self.eat_sym("[") {
                    let index = self.expr()?;
                    self.sym("]")?;
                    Ok(Expr::Index {
                        name,
                        index: Box::new(index),
                        line,
                    })
                } else {
                    Ok(Expr::Name { name, line })
                }
            }
            _ => Err(self.expected("expression")),
        }
    }
}
