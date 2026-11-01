// Example programs for the Machine page (docs/ASSEMBLY.md). A test
// assembles every one with the reference assembler and runs them.

export interface Example {
  id: "sum" | "pattern" | "dot" | "count";
  source: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "sum",
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
    source: `; Count forever, showing the number in binary on the top row.
; It never halts: press Pause.
        SET16 r1, 0x4000
        SET   r0, 0
loop:   INC   r0
        STORE r0, [r1 + 0]
        JMP   loop
`,
  },
];
