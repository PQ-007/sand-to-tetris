// Example programs for the Machine page: assembly (docs/ASSEMBLY.md) and
// VM (docs/VM.md). A test builds every one with the reference toolchain
// and runs them.

export interface Example {
  id:
    | "sum"
    | "pattern"
    | "dot"
    | "count"
    | "vm-sum"
    | "vm-fact"
    | "vm-stripes"
    | "vm-dot";
  lang: "asm" | "vm";
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "sum",
    lang: "asm",
    source: `; Add 10 + 9 + ... + 1 and store the total in RAM[0].
        SET   r0, 0           ; total
        SET   r1, 10          ; counter
loop:   ADD   r0, r0, r1
        DEC   r1              ; sets Z when the counter reaches 0
        JNZ   loop
        SET   r2, 0
        STORE r0, [r2]        ; RAM[0] = 55
        HALT
`,
  },
  {
    id: "pattern",
    lang: "asm",
    source: `; Fill the screen with a checkerboard. The two row patterns live in
; .data: the loader puts them in RAM before the program starts.
.equ SCREEN 0x4000
.equ ROWS   96

.data
pattern: .word 0b1111000011110000, 0b0000111100001111

.code
        SET16 r1, SCREEN      ; the next screen word to fill
        SET   r2, 0           ; y
row:    SHR   r4, r2, 2       ; squares are 4 pixels tall:
        SET   r5, 1           ;   pattern number = (y / 4) AND 1
        AND   r4, r4, r5
        SET16 r5, pattern
        ADD   r5, r5, r4
        LOAD  r5, [r5 + 0]    ; this row's word
        SET   r3, 8           ; 8 words per row
word:   STORE r5, [r1 + 0]
        INC   r1
        DEC   r3
        JNZ   word
        INC   r2
        SET   r4, ROWS
        CMP   r2, r4
        JNZ   row
        HALT
`,
  },
  {
    id: "dot",
    lang: "asm",
    source: `; Move a dot with the arrow keys (click the screen first).
.equ SCREEN 0x4000
.equ KBD    0x6000
.equ LEFT   128
.equ UP     129
.equ RIGHT  130
.equ DOWN   131

        SET   r1, 64          ; x
        SET   r2, 48          ; y
        CALL  plot            ; draw the dot
wait:   SET16 r6, KBD
        LOAD  r3, [r6 + 0]    ; the key held now, 0 if none
        TEST  r3, r3
        JZ    wait
        CALL  plot            ; erase it (plot flips the pixel)
        MOV   r4, r3
        SUBI  r4, LEFT
        JNZ   notleft
        DEC   r1
notleft: MOV  r4, r3
        SUBI  r4, RIGHT
        JNZ   notright
        INC   r1
notright: MOV r4, r3
        SUBI  r4, UP
        JNZ   notup
        DEC   r2
notup:  MOV   r4, r3
        SUBI  r4, DOWN
        JNZ   notdown
        INC   r2
notdown: SET  r4, 127         ; x wraps around: 0..127
        AND   r1, r1, r4
        SET   r4, 96          ; y wraps around: 0..95
        CMP   r2, r4
        JLO   yok
        JZ    ytop            ; moved down off the bottom
        SET   r2, 95          ; moved up off the top
        JMP   yok
ytop:   SET   r2, 0
yok:    CALL  plot            ; draw it at the new place
release: SET16 r6, KBD        ; wait for the key to be let go
        LOAD  r3, [r6 + 0]
        TEST  r3, r3
        JNZ   release
        JMP   wait

; plot: flip the pixel at (x, y) = (r1, r2). Uses r4, r5, r6.
plot:   SHL   r4, r2, 3       ; the row starts at SCREEN + 8y
        SHR   r5, r1, 4       ; the word in the row: x / 16
        ADD   r4, r4, r5
        SET16 r5, SCREEN
        ADD   r4, r4, r5
        SET   r5, 15          ; the bit: 15 - (x mod 16)
        AND   r5, r1, r5
        SET16 r6, 0x8000
        SHR   r6, r6, r5
        LOAD  r5, [r4 + 0]
        XOR   r5, r5, r6
        STORE r5, [r4 + 0]
        RET
`,
  },
  {
    id: "count",
    lang: "asm",
    source: `; Count forever, showing the number in binary on the top row.
; It never halts: press Pause.
        SET16 r1, 0x4000
        SET   r0, 0
loop:   INC   r0
        STORE r0, [r1 + 0]
        JMP   loop
`,
  },
  {
    id: "vm-sum",
    lang: "vm",
    source: `; Add 10 + 9 + ... + 1. When main returns, its result is
; what's left on the stack (see Stack).
func main 0 2
        push 10
        set local 0         ; counter
label loop
        push local 1
        push local 0
        add
        set local 1         ; total = total + counter
        push local 0
        push 1
        sub
        dup
        set local 0         ; counter = counter - 1
        jumpif loop         ; until it reaches 0
        push local 1
        return
`,
  },
  {
    id: "vm-fact",
    lang: "vm",
    source: `; 7! = 7 * 6 * ... * 1, by a function that calls itself.
; Step through it and watch the stack grow one frame per call.
func main 0 0
        push 7
        call fact 1
        return

; fact(n) = 1 if n < 2, else n * fact(n - 1)
func fact 1 0
        push arg 0
        push 2
        lt
        jumpifnot more
        push 1
        return
label more
        push arg 0
        push arg 0
        push 1
        sub
        call fact 1
        mul
        return
`,
  },
  {
    id: "vm-stripes",
    lang: "vm",
    source: `; Diagonal stripes: each row is the row above it, moved one pixel
; right (and back every 8 rows). load and store reach the screen.
func main 0 1
        push 0
        set local 0         ; i: the screen word, 0..767
label next
        push 0x4000
        push local 0
        add                 ; its address
        push 0x8080
        push local 0
        push 3
        shr                 ; its row: i / 8
        push 7
        and                 ; row mod 8
        shr                 ; 0x8080 moved right by that much
        store
        push local 0
        push 1
        add
        dup
        set local 0
        push 768
        lt
        jumpif next
        push 0
        return
`,
  },
  {
    id: "vm-dot",
    lang: "vm",
    source: `; Move a dot with the arrow keys (click the screen first).
func main 0 3
        push 64
        set local 0         ; x
        push 48
        set local 1         ; y
        push local 0
        push local 1
        call flip 2         ; draw the dot
        pop
label wait
        push 0x6000
        load
        dup
        set local 2         ; the key held, 0 if none
        jumpifnot wait
        push local 0
        push local 1
        call flip 2         ; erase it (flip toggles the pixel)
        pop
        push local 2
        push 130            ; right
        eq
        jumpifnot notright
        push local 0
        push 1
        add
        set local 0
label notright
        push local 2
        push 128            ; left
        eq
        jumpifnot notleft
        push local 0
        push 1
        sub
        set local 0
label notleft
        push local 2
        push 131            ; down
        eq
        jumpifnot notdown
        push local 1
        push 1
        add
        set local 1
label notdown
        push local 2
        push 129            ; up
        eq
        jumpifnot notup
        push local 1
        push 1
        sub
        set local 1
label notup
        push local 0
        push 127
        and
        set local 0         ; x wraps around: 0..127
        push local 1
        push 96
        add
        push 96
        mod
        set local 1         ; y wraps around: 0..95
        push local 0
        push local 1
        call flip 2         ; draw it at the new place
        pop
label release
        push 0x6000
        load
        jumpif release      ; wait for the key to be let go
        jump wait

; flip(x, y): toggles the pixel at (x, y)
func flip 2 1
        push 0x4000
        push arg 1
        push 3
        shl                 ; 8y
        add
        push arg 0
        push 4
        shr                 ; x / 16
        add
        set local 0         ; the word: 0x4000 + 8y + x / 16
        push local 0
        push local 0
        load
        push 0x8000
        push arg 0
        push 15
        and
        shr                 ; the bit: 0x8000 >> (x mod 16)
        xor
        store
        push 0
        return
`,
  },
];
