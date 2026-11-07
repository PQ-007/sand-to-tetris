// Prowl: clear the maze of dots while three seekers hunt you, each its own
// way (docs/programs/prowl.md). C on machine.h; the maze was drawn for it.
#include <machine.h>

#define COLS 21
#define ROWS 14
#define CELL 6
#define X0 1  // the maze's top-left pixel
#define Y0 11
#define SEEKERS 3

// # wall, . dot, o power dot, - the seekers' door, space: empty.
const char *maze[ROWS] = {
    "#####################",
    "#o........#........o#",
    "#.##.####.#.####.##.#",
    "#.##.####...####.##.#",
    "#...................#",
    "#.##.#.###.###.#.##.#",
    "#....#.###-###.#....#",
    "####.#.#     #.#.####",
    "#....#.#######.#....#",
    "#.##.#.........#.##.#",
    "#o.#.###.#.#.###.#.o#",
    "#..#.............#..#",
    "#.....#.......#.....#",
    "#####################",
};

char dots[ROWS][COLS]; // 1 dot, 2 power dot
int dots_left;
int background[768];   // the maze's lines, drawn once

// Positions in pixels from the maze's corner; a mover is at a cell when
// both are multiples of CELL. dir: 0 right, 1 down, 2 left, 3 up, -1 still.
const int dx[4] = {1, 0, -1, 0};
const int dy[4] = {0, 1, 0, -1};
int px, py, pdir, want;
int sx[SEEKERS], sy[SEEKERS], sdir[SEEKERS], swait[SEEKERS];
int fright;    // frames the seekers stay afraid
int chain;     // seekers caught during one fright
int lives, score, level, best, frame;

// Sprites drawn for this game (5 × 5; bit 15 leftmost).
const int you[5] = {0x2000, 0x7000, 0xF800, 0x7000, 0x2000};
const int seeker[SEEKERS][5] = {
    {0xF800, 0xA800, 0xF800, 0xF800, 0x8800},
    {0x7000, 0xA800, 0xF800, 0xA800, 0x8800},
    {0x2000, 0x7000, 0xA800, 0xF800, 0x8800},
};
const int afraid[5] = {0x8800, 0x5000, 0x2000, 0x5000, 0x8800};

int wall(int c, int r) {
    if ((unsigned)c >= COLS || (unsigned)r >= ROWS) return 1;
    char m = maze[r][c];
    return m == '#' || m == '-' || m == ' ';
}

void draw_maze(void) {
    draw_into(background);
    clear();
    for (int r = 0; r < ROWS; r++)
        for (int c = 0; c < COLS; c++) {
            char m = maze[r][c];
            int x = X0 + c * CELL, y = Y0 + r * CELL;
            if (m == '-') {
                for (int i = 0; i < CELL; i += 2) plot(x + i, y + 3, 1);
                continue;
            }
            if (m != '#') continue;
            // A line on each side that faces a corridor.
            if (c > 0 && maze[r][c - 1] != '#') fill_rect(x, y, 1, CELL, 1);
            if (c < COLS - 1 && maze[r][c + 1] != '#') fill_rect(x + CELL - 1, y, 1, CELL, 1);
            if (r > 0 && maze[r - 1][c] != '#') fill_rect(x, y, CELL, 1, 1);
            if (r < ROWS - 1 && maze[r + 1][c] != '#') fill_rect(x, y + CELL - 1, CELL, 1, 1);
        }
    use_buffer();
}

void place_movers(void) {
    px = 10 * CELL;
    py = 9 * CELL;
    pdir = want = 2;
    for (int i = 0; i < SEEKERS; i++) {
        sx[i] = (9 + i) * CELL;
        sy[i] = 7 * CELL;
        sdir[i] = -1;
        swait[i] = 30 + i * 90; // they leave the box one by one
    }
    fright = 0;
}

void fill_dots(void) {
    dots_left = 0;
    for (int r = 0; r < ROWS; r++)
        for (int c = 0; c < COLS; c++) {
            char m = maze[r][c];
            dots[r][c] = m == '.' ? 1 : m == 'o' ? 2 : 0;
            dots_left += dots[r][c] != 0;
        }
}

void reset(void) {
    lives = 3;
    score = 0;
    level = 0;
    fill_dots();
    place_movers();
}

int at_cell(int x, int y) { return x % CELL == 0 && y % CELL == 0; }

// Can a mover at cell (c, r) go in direction d?
int open(int c, int r, int d) { return d >= 0 && !wall(c + dx[d], r + dy[d]); }

void move_you(void) {
    // Turning back works at once; other turns wait for the next cell.
    if (want >= 0 && pdir >= 0 && (want ^ pdir) == 2) pdir = want;
    if (at_cell(px, py)) {
        int c = px / CELL, r = py / CELL;
        int d = dots[r][c];
        if (d) {
            dots[r][c] = 0;
            dots_left--;
            score += d == 2 ? 50 : 10;
            if (d == 2) {
                fright = max(120, 360 - level * 60);
                chain = 0;
                // Afraid seekers turn back.
                for (int i = 0; i < SEEKERS; i++)
                    if (sdir[i] >= 0) sdir[i] ^= 2;
            }
        }
        if (open(c, r, want)) pdir = want;
        if (!open(c, r, pdir)) pdir = -1;
    }
    if (pdir >= 0) {
        px += dx[pdir];
        py += dy[pdir];
    }
}

// Where seeker i heads: 0 straight for you, 1 four cells ahead of you,
// 2 for you when far, its own corner when close; afraid: away from you.
void target(int i, int *tc, int *tr) {
    int c = px / CELL, r = py / CELL;
    if (fright) {
        *tc = c < COLS / 2 ? COLS : -1;
        *tr = r < ROWS / 2 ? ROWS : -1;
        return;
    }
    if (i == 1 && pdir >= 0) {
        c += 4 * dx[pdir];
        r += 4 * dy[pdir];
    }
    if (i == 2) {
        int d = abs(sx[i] / CELL - c) + abs(sy[i] / CELL - r);
        if (d < 6) {
            c = 0;
            r = ROWS;
        }
    }
    *tc = c;
    *tr = r;
}

void move_seeker(int i) {
    if (swait[i]) {
        // Waiting in the box; then out through the door.
        if (--swait[i] == 0) {
            sx[i] = 10 * CELL;
            sy[i] = 5 * CELL;
            sdir[i] = i & 1 ? 0 : 2;
        }
        return;
    }
    if (at_cell(sx[i], sy[i])) {
        int c = sx[i] / CELL, r = sy[i] / CELL;
        int tc, tr;
        target(i, &tc, &tr);
        int best_d = -1, best_score = 0x7FFF;
        for (int d = 0; d < 4; d++) {
            if (!open(c, r, d) || (sdir[i] >= 0 && d == (sdir[i] ^ 2))) continue;
            int ec = c + dx[d] - tc, er = r + dy[d] - tr;
            int s = ec * ec + er * er;
            // Afraid, they wander: a random score.
            if (fright) s = rand_below(100);
            if (s < best_score) {
                best_score = s;
                best_d = d;
            }
        }
        // A dead end: turn back.
        sdir[i] = best_d >= 0 ? best_d : sdir[i] ^ 2;
    }
    sx[i] += dx[sdir[i]];
    sy[i] += dy[sdir[i]];
}

// One frame; 0 when a seeker catches you.
int update(int k) {
    frame++;
    if (k == KEY_RIGHT) want = 0;
    if (k == KEY_DOWN) want = 1;
    if (k == KEY_LEFT) want = 2;
    if (k == KEY_UP) want = 3;
    move_you();
    if (fright) fright--;
    for (int i = 0; i < SEEKERS; i++) {
        // Seekers are a little slower than you, and much slower afraid;
        // later levels make them quicker.
        int skip = fright ? 2 : max(3, 6 - level);
        if (frame % skip == 0) continue;
        move_seeker(i);
        if (swait[i]) continue;
        if (abs(sx[i] - px) < 4 && abs(sy[i] - py) < 4) {
            if (!fright) return 0;
            chain++;
            score += 100 << min(chain, 3);
            swait[i] = 90;
            sx[i] = 10 * CELL;
            sy[i] = 7 * CELL;
        }
    }
    return 1;
}

void draw(void) {
    memcpy(__buf, background, 768);
    draw_text("SCORE", 0, 0);
    draw_int(score, 6, 0);
    draw_text("LEVEL", 13, 0);
    draw_int(level + 1, 19, 0);
    for (int i = 0; i < lives; i++) draw_sprite(110 + i * 6, 1, you, 5);
    for (int r = 0; r < ROWS; r++)
        for (int c = 0; c < COLS; c++) {
            int d = dots[r][c];
            if (!d) continue;
            int x = X0 + c * CELL + 2, y = Y0 + r * CELL + 2;
            if (d == 1) plot(x, y, 1);
            else if (frame & 8) {
                fill_rect(x - 1, y, 3, 1, 1);
                fill_rect(x, y - 1, 1, 3, 1);
            }
        }
    draw_sprite(X0 + px, Y0 + py, you, 5);
    // The eye: a pixel cleared towards where you're going.
    if (pdir >= 0) plot(X0 + px + 2 + dx[pdir], Y0 + py + 2 + dy[pdir], 0);
    for (int i = 0; i < SEEKERS; i++) {
        // Afraid ones blink when the fright is nearly over.
        int scared = fright && !swait[i] && (fright > 60 || (frame & 4));
        draw_sprite(X0 + sx[i], Y0 + sy[i], scared ? afraid : seeker[i], 5);
    }
}

// Text centred on a row (32 cells across).
void centre(const char *s, int row) {
    int n = 0;
    while (s[n]) n++;
    draw_text(s, 16 - n / 2, row);
}

void banner(const char *s) {
    fill_rect(28, 47, 72, 11, 0);
    draw_rect(28, 47, 72, 11);
    centre(s, 8);
    show();
}

// ---- main ----
int main(void) {
    draw_maze();
    clear();
    centre("PROWL", 3);
    centre("EAT EVERY DOT", 6);
    centre("A POWER DOT TURNS THE HUNT", 8);
    centre("ARROWS MOVE. PRESS A KEY", 11);
    show();
    wait_key();
    for (;;) {
        reset();
        while (lives > 0) {
            if (!update(key())) {
                lives--;
                draw();
                banner(lives ? "CAUGHT" : "GAME OVER");
                wait(60);
                place_movers();
            }
            if (dots_left == 0) {
                level++;
                draw();
                banner("MAZE CLEARED");
                wait(60);
                fill_dots();
                place_movers();
            }
            draw();
            show();
            next_frame();
        }
        if (score > best) best = score;
        wait_key();
    }
}
