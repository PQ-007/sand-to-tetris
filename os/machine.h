// machine.h: the library for C programs on the Sand to Tetris computer
// (docs/C.md). It's C itself, compiled with the program; functions a
// program never calls are left out. The names mirror the C Shard OS
// (docs/OS.md). Names starting with __ are the library's own.

#define NULL ((void *)0)
#define true 1
#define false 0
typedef int bool;

#define SCREEN ((int *)0x4000)
#define KEYBOARD ((volatile int *)0x6000)
#define TIMER ((volatile int *)0x6001)
#define WIDTH 128
#define HEIGHT 96

#define KEY_BACKSPACE 8
#define KEY_ENTER 13
#define KEY_ESCAPE 27
#define KEY_SPACE 32
#define KEY_LEFT 128
#define KEY_UP 129
#define KEY_RIGHT 130
#define KEY_DOWN 131

// ---- numbers ----------------------------------------------------------------

int abs(int x) { return x < 0 ? -x : x; }
int min(int a, int b) { return a < b ? a : b; }
int max(int a, int b) { return a > b ? a : b; }
int clamp(int v, int lo, int hi) { return v < lo ? lo : v > hi ? hi : v; }

// 256 × sin of a quarter turn in 64 steps (0..64 inclusive).
const int __sin[65] = {
    0, 6, 13, 19, 25, 31, 38, 44, 50, 56, 62, 68, 74, 80, 86, 92, 98,
    104, 109, 115, 121, 126, 132, 137, 142, 147, 152, 157, 162, 167, 172, 177, 181,
    185, 190, 194, 198, 202, 206, 209, 213, 216, 220, 223, 226, 229, 231, 234, 237,
    239, 241, 243, 245, 247, 248, 250, 251, 252, 253, 254, 255, 255, 256, 256, 256
};

// 256 × sin(a), with a in 256ths of a turn (64 = a right angle).
int sin256(int a) {
    a &= 255;
    if (a < 64) return __sin[a];
    if (a < 128) return __sin[128 - a];
    if (a < 192) return -__sin[a - 128];
    return -__sin[256 - a];
}

int cos256(int a) { return sin256(a + 64); }

// The integer square root: the largest r with r × r <= v.
int isqrt(unsigned v) {
    unsigned r = 0;
    unsigned bit = 0x4000;
    while (bit > v) bit >>= 2;
    while (bit) {
        if (v >= r + bit) {
            v -= r + bit;
            r = (r >> 1) + bit;
        } else {
            r >>= 1;
        }
        bit >>= 2;
    }
    return r;
}

void *memset(void *p, int v, unsigned n) {
    int *q = (int *)p;
    while (n >= 4) {
        q[0] = v;
        q[1] = v;
        q[2] = v;
        q[3] = v;
        q += 4;
        n -= 4;
    }
    while (n) {
        *q++ = v;
        n--;
    }
    return p;
}

void *memcpy(void *d, const void *s, unsigned n) {
    int *a = (int *)d;
    int *b = (int *)s;
    while (n--) *a++ = *b++;
    return d;
}

// ---- random numbers: 16-bit xorshift (shifts 7, 9, 8), as in the OS ------

unsigned __seed = 1;
int __seeded = 0;

void srand(int s) { __seed = s ? s : 1; }

int rand(void) {
    unsigned s = __seed;
    s ^= s << 7;
    s ^= s >> 9;
    s ^= s << 8;
    __seed = s;
    return s & 0x7FFF;
}

int rand_below(int n) { return n > 0 ? rand() % n : 0; }

void seed_random(int s) { srand(s); }
int random(void) { return rand(); }
int random_below(int n) { return rand_below(n); }

// ---- the keyboard and time --------------------------------------------------

int key(void) { return *KEYBOARD; }
int ticks(void) { return *TIMER; }

void wait(int frames) {
    int start = *TIMER;
    while (*TIMER - start < frames) {}
}

// Waits until the frame counter moves on.
void next_frame(void) {
    int t = *TIMER;
    while (*TIMER == t) {}
}

// Waits for a key to be pressed and let go; the first press seeds the
// random numbers from the time, so every game is different.
int wait_key(void) {
    while (*KEYBOARD == 0) {}
    int k = *KEYBOARD;
    if (!__seeded) {
        srand(__seed ^ *TIMER);
        __seeded = 1;
    }
    while (*KEYBOARD != 0) {}
    return k;
}

// ---- the screen: 128 × 96, 8 words a row, leftmost pixel in bit 15 ------

int *__target = SCREEN;
int __buf[768];

// Draw into a copy of the screen in RAM; show() puts it on the screen at
// once, so a frame never appears half drawn.
void use_buffer(void) { __target = __buf; }
void use_screen(void) { __target = SCREEN; }
// Draw into a 768-word image of your own (say, a background drawn once and
// copied in with memcpy each frame).
void draw_into(int *words) { __target = words; }

void show(void) {
    int *s = __buf;
    int *d = SCREEN;
    int *e = __buf + 768;
    while (s < e) {
        d[0] = s[0];
        d[1] = s[1];
        d[2] = s[2];
        d[3] = s[3];
        d[4] = s[4];
        d[5] = s[5];
        d[6] = s[6];
        d[7] = s[7];
        s += 8;
        d += 8;
    }
}

void clear(void) {
    int *p = __target;
    int *e = p + 768;
    while (p < e) {
        p[0] = 0;
        p[1] = 0;
        p[2] = 0;
        p[3] = 0;
        p[4] = 0;
        p[5] = 0;
        p[6] = 0;
        p[7] = 0;
        p += 8;
    }
}

void plot(int x, int y, int on) {
    if ((unsigned)x >= 128 || (unsigned)y >= 96) return;
    int *a = __target + (y << 3) + (x >> 4);
    unsigned bit = 0x8000u >> (x & 15);
    if (on)
        *a |= bit;
    else
        *a &= ~bit;
}

void xor_plot(int x, int y) {
    if ((unsigned)x >= 128 || (unsigned)y >= 96) return;
    __target[(y << 3) + (x >> 4)] ^= 0x8000u >> (x & 15);
}

int pixel(int x, int y) {
    if ((unsigned)x >= 128 || (unsigned)y >= 96) return 0;
    return (__target[(y << 3) + (x >> 4)] >> (15 - (x & 15))) & 1;
}

// A filled rectangle, clipped, a word at a time.
void fill_rect(int x, int y, int w, int h, int on) {
    int x1 = x + w;
    int y1 = y + h;
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x1 > 128) x1 = 128;
    if (y1 > 96) y1 = 96;
    if (x >= x1 || y >= y1) return;
    int *row = __target + (y << 3);
    for (; y < y1; y++, row += 8) {
        int px = x;
        while (px < x1) {
            int bit = px & 15;
            int n = 16 - bit;
            if (n > x1 - px) n = x1 - px;
            unsigned mask = (0xFFFFu << (16 - n)) >> bit;
            int *a = row + (px >> 4);
            if (on)
                *a |= mask;
            else
                *a &= ~mask;
            px += n;
        }
    }
}

void draw_rect(int x, int y, int w, int h) {
    fill_rect(x, y, w, 1, 1);
    fill_rect(x, y + h - 1, w, 1, 1);
    fill_rect(x, y, 1, h, 1);
    fill_rect(x + w - 1, y, 1, h, 1);
}

// A straight line (Bresenham).
void draw_line(int x0, int y0, int x1, int y1, int on) {
    int dx = abs(x1 - x0);
    int dy = -abs(y1 - y0);
    int sx = x0 < x1 ? 1 : -1;
    int sy = y0 < y1 ? 1 : -1;
    int e = dx + dy;
    for (;;) {
        plot(x0, y0, on);
        if (x0 == x1 && y0 == y1) break;
        int e2 = e << 1;
        if (e2 >= dy) {
            e += dy;
            x0 += sx;
        }
        if (e2 <= dx) {
            e += dx;
            y0 += sy;
        }
    }
}

// Up to 16 × h pixels: each row a word, bit 15 leftmost. mode 0 ORs the
// pixels in, 1 flips them, 2 clears them.
void __sprite(int x, int y, const int *rows, int h, int mode) {
    int sx = x & 15;
    int w = x >> 4;
    for (int i = 0; i < h; i++, y++) {
        if ((unsigned)y >= 96) continue;
        unsigned v = rows[i];
        if (!v) continue;
        int *row = __target + (y << 3);
        unsigned left = v >> sx;
        unsigned right = sx ? v << (16 - sx) : 0;
        if ((unsigned)w < 8) {
            if (mode == 0) row[w] |= left;
            else if (mode == 1) row[w] ^= left;
            else row[w] &= ~left;
        }
        if (right && (unsigned)(w + 1) < 8) {
            if (mode == 0) row[w + 1] |= right;
            else if (mode == 1) row[w + 1] ^= right;
            else row[w + 1] &= ~right;
        }
    }
}

void draw_sprite(int x, int y, const int *rows, int h) { __sprite(x, y, rows, h, 0); }
void xor_sprite(int x, int y, const int *rows, int h) { __sprite(x, y, rows, h, 1); }
void clear_sprite(int x, int y, const int *rows, int h) { __sprite(x, y, rows, h, 2); }

// ---- text: a 3 × 5 font in 4 × 6 cells, 32 columns × 16 rows ------------
// One word per character from ' ' (32) to '_' (95): 5 rows of 3 bits, the
// top row in bits 14-12 (the C Shard OS's font).
const int __font[64] = {
    0x0000, 0x2482, 0x5A00, 0x5F7D, 0x3C9E, 0x42A1, 0x2AAB, 0x2400,
    0x1491, 0x4494, 0x0AA8, 0x05D0, 0x0014, 0x01C0, 0x0002, 0x12A4,
    0x7B6F, 0x2C97, 0x62A7, 0x628E, 0x5BC9, 0x798E, 0x39EF, 0x7292,
    0x7BEF, 0x7BCE, 0x0410, 0x0414, 0x1511, 0x0E38, 0x4454, 0x6282,
    0x2BE3, 0x2BED, 0x6BAE, 0x3923, 0x6B6E, 0x79A7, 0x79A4, 0x396B,
    0x5BED, 0x7497, 0x126A, 0x5BAD, 0x4927, 0x5FED, 0x6B6D, 0x2B6A,
    0x6BA4, 0x2B73, 0x6BAD, 0x388E, 0x7492, 0x5B6F, 0x5B6A, 0x5BFD,
    0x5AAD, 0x5A92, 0x72A7, 0x6926, 0x4889, 0x324B, 0x2A00, 0x0007
};

int __glyph(int c) {
    if (c >= 'a' && c <= 'z') c -= 32;
    if (c < 32 || c > 95) c = '?';
    return __font[c - 32];
}

// A character in text cell (col, row), its cell cleared first.
void draw_char(int c, int col, int row) {
    if ((unsigned)col >= 32 || (unsigned)row >= 16) return;
    unsigned g = __glyph(c);
    int shift = 12 - ((col & 3) << 2);
    unsigned cell = 15u << shift;
    int *p = __target + row * 48 + (col >> 2);
    for (int r = 0; r < 5; r++, p += 8) {
        unsigned bits = (g >> (12 - r * 3)) & 7;
        *p = (*p & ~cell) | (bits << (shift + 1));
    }
    *p &= ~cell;
}

void draw_text(const char *s, int col, int row) {
    while (*s) draw_char(*s++, col++, row);
}

int __digits[6];

// v in decimal from cell (col, row); returns the cells it took.
int draw_int(int v, int col, int row) {
    // Work with v <= 0, so -32768 has no positive twin to overflow into.
    int neg = v < 0;
    if (!neg) v = -v;
    int n = 0;
    do {
        __digits[n++] = -(v % 10);
        v /= 10;
    } while (v);
    int c = col;
    if (neg) draw_char('-', c++, row);
    while (n) draw_char('0' + __digits[--n], c++, row);
    return c - col;
}

// A character with its top-left pixel at (x, y), ORed in (not cleared).
void draw_char_at(int c, int x, int y) {
    unsigned g = __glyph(c);
    int rows[5];
    for (int r = 0; r < 5; r++) rows[r] = ((g >> (12 - r * 3)) & 7) << 13;
    __sprite(x, y, rows, 5, 0);
}

void draw_text_at(const char *s, int x, int y) {
    while (*s) {
        draw_char_at(*s++, x, y);
        x += 4;
    }
}

int draw_int_at(int v, int x, int y) {
    int neg = v < 0;
    if (!neg) v = -v;
    int n = 0;
    do {
        __digits[n++] = -(v % 10);
        v /= 10;
    } while (v);
    int x0 = x;
    if (neg) {
        draw_char_at('-', x, y);
        x += 4;
    }
    while (n) {
        draw_char_at('0' + __digits[--n], x, y);
        x += 4;
    }
    return (x - x0) >> 2;
}
