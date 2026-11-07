//! The typed syntax tree the parser builds and the code generator walks.

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Ty {
    Void,
    /// char, short and int: all one word.
    Int {
        unsigned: bool,
    },
    Ptr(Box<Ty>),
    /// Element type and count (None until an initialiser gives it).
    Array(Box<Ty>, Option<u32>),
    Func(Box<FnTy>),
    /// An index into [`Program::structs`].
    Struct(usize),
}

pub const INT: Ty = Ty::Int { unsigned: false };
pub const UNSIGNED: Ty = Ty::Int { unsigned: true };

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FnTy {
    pub ret: Ty,
    pub params: Vec<Ty>,
    /// Declared with `()`: any arguments are accepted.
    pub unspecified: bool,
}

impl Ty {
    pub fn ptr(t: Ty) -> Ty {
        Ty::Ptr(Box::new(t))
    }
    pub fn is_int(&self) -> bool {
        matches!(self, Ty::Int { .. })
    }
    pub fn is_ptr(&self) -> bool {
        matches!(self, Ty::Ptr(_))
    }
    /// Int or pointer: what fits in a register and can be compared.
    pub fn is_scalar(&self) -> bool {
        matches!(self, Ty::Int { .. } | Ty::Ptr(_))
    }
    pub fn is_unsigned(&self) -> bool {
        matches!(self, Ty::Int { unsigned: true } | Ty::Ptr(_))
    }
    /// What a pointer or array points at.
    pub fn target(&self) -> Option<&Ty> {
        match self {
            Ty::Ptr(t) | Ty::Array(t, _) => Some(t),
            _ => None,
        }
    }
    pub fn func(&self) -> Option<&FnTy> {
        match self {
            Ty::Func(f) => Some(f),
            Ty::Ptr(t) => match &**t {
                Ty::Func(f) => Some(f),
                _ => None,
            },
            _ => None,
        }
    }
}

#[derive(Clone, Debug)]
pub struct StructDef {
    pub tag: Option<String>,
    pub union: bool,
    pub members: Vec<Member>,
    pub size: u32,
    pub complete: bool,
}

#[derive(Clone, Debug)]
pub struct Member {
    pub name: String,
    pub ty: Ty,
    pub offset: u32,
}

/// Where a local lives in its function's frame.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Slot {
    /// The n-th one-word local.
    Word(u32),
    /// A larger local (array or struct), n words into the big locals.
    Big(u32),
    /// The n-th parameter.
    Param(u32),
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BinOp {
    Add,
    Sub,
    Mul,
    Div,
    Mod,
    Shl,
    Shr,
    And,
    Or,
    Xor,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CmpOp {
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UnOp {
    Neg,
    BitNot,
    Not,
}

#[derive(Clone, Debug)]
pub struct Expr {
    pub kind: Kind,
    pub ty: Ty,
    pub line: usize,
}

#[derive(Clone, Debug)]
pub enum Kind {
    Num(i32),
    Local(Slot),
    /// An index into [`Program::globals`].
    Global(usize),
    /// An index into [`Program::strings`]: the string's array.
    Str(usize),
    /// A function by name (a designator; its value is its address).
    Func(String),
    Deref(Box<Expr>),
    /// The member at this offset of a struct lvalue.
    Member(Box<Expr>, u32),
    /// The address of an lvalue (also how an array becomes a pointer).
    Addr(Box<Expr>),
    Unary(UnOp, Box<Expr>),
    /// `signed` decides `/`, `%` and `>>`.
    Binary(BinOp, bool, Box<Expr>, Box<Expr>),
    Cmp(CmpOp, bool, Box<Expr>, Box<Expr>),
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    /// Copies a struct when the type is one.
    Assign(Box<Expr>, Box<Expr>),
    OpAssign(BinOp, bool, Box<Expr>, Box<Expr>),
    /// `++`/`--` by delta (pointers step by their target's size).
    IncDec {
        target: Box<Expr>,
        delta: i32,
        post: bool,
    },
    Cond(Box<Expr>, Box<Expr>, Box<Expr>),
    Comma(Box<Expr>, Box<Expr>),
    Call(Box<Expr>, Vec<Expr>),
    /// A conversion that keeps the bits (every scalar is one word).
    Cast(Box<Expr>),
}

impl Expr {
    pub fn num(v: i32, line: usize) -> Expr {
        Expr {
            kind: Kind::Num(v),
            ty: INT,
            line,
        }
    }
    pub fn is_lvalue(&self) -> bool {
        matches!(
            self.kind,
            Kind::Local(_) | Kind::Global(_) | Kind::Deref(_) | Kind::Member(..) | Kind::Str(_)
        )
    }
    pub fn constant(&self) -> Option<i32> {
        match self.kind {
            Kind::Num(v) => Some(v),
            _ => None,
        }
    }
}

/// A label inside one function.
pub type Label = u32;

#[derive(Clone, Debug)]
pub enum Stmt {
    Expr(Expr),
    If(Expr, Box<Stmt>, Option<Box<Stmt>>),
    /// for, while and do-while.
    Loop {
        init: Option<Box<Stmt>>,
        cond: Option<Expr>,
        step: Option<Expr>,
        body: Box<Stmt>,
        brk: Label,
        cont: Label,
        test_first: bool,
    },
    Switch {
        value: Expr,
        cases: Vec<(i32, Label)>,
        default: Option<Label>,
        body: Box<Stmt>,
        brk: Label,
    },
    Label(Label),
    Goto(Label),
    Return(Option<Expr>, usize),
    Block(Vec<Stmt>),
}

/// A word of a global's starting value.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Word {
    Num(u16),
    /// A global's address plus an offset.
    Global(usize, i32),
    Str(usize, i32),
    Func(String),
}

#[derive(Clone, Debug)]
pub struct Global {
    pub name: String,
    pub ty: Ty,
    /// Starting words (shorter than the size: the rest are 0).
    pub init: Vec<Word>,
    pub line: usize,
}

#[derive(Clone, Debug)]
pub struct Func {
    pub name: String,
    pub ty: FnTy,
    pub body: Stmt,
    /// One-word locals, and words of big locals.
    pub words: u32,
    pub big: u32,
    pub labels: u32,
    pub line: usize,
}

#[derive(Clone, Debug, Default)]
pub struct Program {
    pub globals: Vec<Global>,
    pub strings: Vec<Vec<u16>>,
    pub funcs: Vec<Func>,
    pub structs: Vec<StructDef>,
}

impl Program {
    /// Words a value of this type takes; None for void, functions and
    /// incomplete types.
    pub fn size(&self, ty: &Ty) -> Option<u32> {
        match ty {
            Ty::Void | Ty::Func(_) => None,
            Ty::Int { .. } | Ty::Ptr(_) => Some(1),
            Ty::Array(t, n) => Some(self.size(t)?.checked_mul((*n)?)?),
            Ty::Struct(i) => {
                let s = self.structs.get(*i)?;
                s.complete.then_some(s.size)
            }
        }
    }
}
