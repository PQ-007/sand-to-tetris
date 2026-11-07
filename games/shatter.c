// Shatter: keep the ball in play with the paddle and break every brick
// (docs/programs/shatter.md). C on machine.h.
#include <machine.h>

#define TOP 8
#define COLS 10
#define ROWS 6
#define BW 12 // a brick's cell: 11 × 4 pixels and a 1-pixel gap
#define BH 5
#define BX 4  // the wall's left edge
#define BY 14 // and top
#define PADDLE_Y 88
#define FP 16 // the ball in sixteenths of a pixel

// Each brick's hits left: 0 = gone. The top rows take two hits.
int bricks[ROWS][COLS];
int left;
int px, pw; // the paddle's left edge and width
int bx, by, vx, vy;
int stuck;  // the ball sits on the paddle until a key launches it
int lives, score, level, best;

// Wall patterns, one per level (then they repeat): a bit per brick, the
// leftmost brick in bit 9.
const int patterns[4][ROWS] = {
    {0x3FF, 0x3FF, 0x3FF, 0x3FF, 0x3FF, 0x3FF},
    {0x2AA, 0x155, 0x2AA, 0x155, 0x2AA, 0x155},
    {0x030, 0x078, 0x0FC, 0x1FE, 0x3FF, 0x3FF},
    {0x3CF, 0x3CF, 0x000, 0x3FF, 0x201, 0x3FF},
};

void build(void) {
    left = 0;
    const int *p = patterns[level & 3];
    for (int r = 0; r < ROWS; r++)
        for (int c = 0; c < COLS; c++) {
            int on = (p[r] >> (COLS - 1 - c)) & 1;
            bricks[r][c] = on ? (r < 2 ? 2 : 1) : 0;
            left += on;
        }
}

void ready(void) {
    stuck = 1;
    pw = max(14, 22 - level * 2);
    px = 64 - pw / 2;
}

void reset(void) {
    lives = 3;
    score = 0;
    level = 0;
    build();
    ready();
}

void launch(void) {
    stuck = 0;
    int speed = 22 + level * 3;
    vx = (rand_below(2) ? speed : -speed) / 2;
    vy = -speed;
}

// The brick at pixel (x, y), as its row × COLS + column, or -1.
int brick_at(int x, int y) {
    int c = (x - BX) / BW;
    int r = (y - BY) / BH;
    if (x < BX || y < BY || c >= COLS || r >= ROWS) return -1;
    if (!bricks[r][c]) return -1;
    return r * COLS + c;
}

void hit(int b) {
    int r = b / COLS, c = b % COLS;
    if (--bricks[r][c] == 0) {
        left--;
        score += (ROWS - r) * 5;
    } else {
        score += 1;
    }
}

// One frame; 0 when the ball is lost.
int update(int k) {
    if (k == KEY_LEFT) px -= 3;
    if (k == KEY_RIGHT) px += 3;
    px = clamp(px, 0, 128 - pw);
    if (stuck) {
        bx = (px + pw / 2 - 1) * FP;
        by = (PADDLE_Y - 2) * FP;
        if (k == KEY_SPACE || k == KEY_UP) launch();
        return 1;
    }
    // Move one axis at a time, so the side the ball hit is known.
    int ox = bx, oy = by;
    bx += vx;
    int x = bx / FP, y = by / FP;
    int b = brick_at(vx > 0 ? x + 1 : x, y);
    if (b < 0) b = brick_at(vx > 0 ? x + 1 : x, y + 1);
    if (x < 0 || x > 126) {
        bx = ox;
        vx = -vx;
    } else if (b >= 0) {
        hit(b);
        bx = ox;
        vx = -vx;
    }
    by += vy;
    x = bx / FP;
    y = by / FP;
    b = brick_at(x, vy > 0 ? y + 1 : y);
    if (b < 0) b = brick_at(x + 1, vy > 0 ? y + 1 : y);
    if (y < TOP) {
        by = oy;
        vy = -vy;
    } else if (b >= 0) {
        hit(b);
        by = oy;
        vy = -vy;
    }
    // The paddle: where it's hit sets the angle.
    if (vy > 0 && y + 2 >= PADDLE_Y && y <= PADDLE_Y && x + 2 > px && x < px + pw) {
        by = (PADDLE_Y - 2) * FP;
        int speed = 22 + level * 3;
        vx = ((x + 1 - (px + pw / 2)) * speed * 2) / pw;
        vy = -speed;
    }
    return y < 98;
}

void draw(void) {
    clear();
    draw_text("SCORE", 0, 0);
    draw_int(score, 6, 0);
    draw_text("LEVEL", 12, 0);
    draw_int(level + 1, 18, 0);
    for (int i = 0; i < lives; i++) fill_rect(118 - i * 6, 1, 4, 3, 1);
    fill_rect(0, TOP - 2, 128, 1, 1);
    for (int r = 0; r < ROWS; r++)
        for (int c = 0; c < COLS; c++) {
            int n = bricks[r][c];
            if (!n) continue;
            int x = BX + c * BW, y = BY + r * BH;
            if (n == 2)
                fill_rect(x, y, BW - 1, BH - 1, 1);
            else
                draw_rect(x, y, BW - 1, BH - 1);
        }
    fill_rect(px, PADDLE_Y, pw, 3, 1);
    fill_rect(bx / FP, by / FP, 2, 2, 1);
}

// Text centred on a row (32 cells across).
void centre(const char *s, int row) {
    int n = 0;
    while (s[n]) n++;
    draw_text(s, 16 - n / 2, row);
}

void banner(const char *s) {
    fill_rect(20, 50, 88, 14, 0);
    draw_rect(20, 50, 88, 14);
    centre(s, 9);
    show();
}

// ---- main ----
int main(void) {
    use_buffer();
    clear();
    centre("SHATTER", 4);
    centre("LEFT AND RIGHT MOVE", 8);
    centre("SPACE LAUNCHES THE BALL", 10);
    centre("PRESS A KEY", 13);
    show();
    wait_key();
    for (;;) {
        reset();
        while (lives > 0) {
            if (!update(key())) {
                lives--;
                ready();
                if (lives > 0) {
                    draw();
                    banner("BALL LOST");
                    wait(40);
                }
            }
            if (left == 0) {
                level++;
                build();
                ready();
                draw();
                banner("WALL CLEARED");
                wait(60);
            }
            draw();
            show();
            next_frame();
        }
        if (score > best) best = score;
        draw();
        banner("GAME OVER");
        wait(60);
        wait_key();
    }
}
