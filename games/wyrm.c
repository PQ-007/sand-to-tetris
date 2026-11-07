// Wyrm: steer a growing worm to the food without hitting a wall or
// yourself (docs/programs/wyrm.md). C on machine.h.
#include <machine.h>

#define COLS 32
#define ROWS 22
#define TOP 8 // the score bar
#define CELLS (COLS * ROWS)

// The body is a ring of cells: the head at xs[head], the tail len - 1
// before it. grid marks the cells the body covers, so a collision is one
// lookup instead of a search.
int xs[CELLS];
int ys[CELLS];
int head;
int len;
char grid[ROWS][COLS];

int dir;      // 0 right, 1 down, 2 left, 3 up
int next_dir; // the last arrow pressed, taken at the next step
const int dx[4] = {1, 0, -1, 0};
const int dy[4] = {0, 1, 0, -1};

int food_x, food_y;
// A bonus byte appears now and then and fades: worth more, gone soon.
int bonus_x, bonus_y, bonus_left;
int grow;
int score;
int best;

// A free cell for (*x, *y), not on the body and not at (ox, oy).
void place(int *x, int *y, int ox, int oy) {
    do {
        *x = rand_below(COLS);
        *y = rand_below(ROWS);
    } while (grid[*y][*x] || (*x == ox && *y == oy));
}

void reset(void) {
    memset(grid, 0, CELLS);
    len = 3;
    head = 2;
    for (int i = 0; i < 3; i++) {
        xs[i] = 4 + i;
        ys[i] = ROWS / 2;
        grid[ROWS / 2][4 + i] = 1;
    }
    dir = next_dir = 0;
    grow = 0;
    score = 0;
    bonus_left = 0;
    place(&food_x, &food_y, -1, -1);
}

// One step forward; 0 when the worm hits a wall or itself.
int step(void) {
    if ((next_dir ^ dir) != 2) dir = next_dir; // no turning back on itself
    int x = xs[head] + dx[dir];
    int y = ys[head] + dy[dir];
    if ((unsigned)x >= COLS || (unsigned)y >= ROWS) return 0;
    // The tail moves out of the way first, unless the worm is growing.
    if (grow) {
        grow--;
    } else {
        int tail = head - len + 1;
        if (tail < 0) tail += CELLS;
        grid[ys[tail]][xs[tail]] = 0;
        len--;
    }
    if (grid[y][x]) return 0;
    if (++head == CELLS) head = 0;
    xs[head] = x;
    ys[head] = y;
    grid[y][x] = 1;
    len++;
    if (x == food_x && y == food_y) {
        score++;
        grow += 2;
        place(&food_x, &food_y, bonus_left ? bonus_x : -1, bonus_y);
        if (bonus_left == 0 && rand_below(4) == 0) {
            place(&bonus_x, &bonus_y, food_x, food_y);
            bonus_left = 60;
        }
    } else if (bonus_left && x == bonus_x && y == bonus_y) {
        score += 5;
        grow += 4;
        bonus_left = 0;
    }
    if (bonus_left) bonus_left--;
    return 1;
}

// Steps get quicker as the score goes up: frames between steps.
int delay(void) { return max(2, 7 - score / 6); }

void draw(void) {
    clear();
    draw_text("WYRM", 0, 0);
    draw_text("SCORE", 12, 0);
    draw_int(score, 18, 0);
    draw_text("BEST", 24, 0);
    draw_int(best, 29, 0);
    fill_rect(0, TOP - 2, 128, 1, 1);
    // The body: 3 × 3 blocks with a gap, joined towards the next cell, so
    // the worm reads as one line.
    int i = head;
    for (int n = 0; n < len; n++) {
        int x = xs[i], y = ys[i];
        fill_rect(x * 4, TOP + y * 4, 3, 3, 1);
        int j = i == 0 ? CELLS - 1 : i - 1;
        if (n + 1 < len) {
            int px = xs[j], py = ys[j];
            if (px == x + 1) fill_rect(x * 4 + 3, TOP + y * 4, 1, 3, 1);
            if (py == y + 1) fill_rect(x * 4, TOP + y * 4 + 3, 3, 1, 1);
            if (px == x - 1) fill_rect(x * 4 - 1, TOP + y * 4, 1, 3, 1);
            if (py == y - 1) fill_rect(x * 4, TOP + y * 4 - 1, 3, 1, 1);
        }
        i = j;
    }
    // The head's eye: a pixel cleared on the side it's heading.
    plot(xs[head] * 4 + 1 + dx[dir], TOP + ys[head] * 4 + 1 + dy[dir], 0);
    // Food: a hollow square; the bonus: a blinking cross.
    draw_rect(food_x * 4, TOP + food_y * 4, 3, 3);
    if (bonus_left && (bonus_left > 20 || (ticks() & 4))) {
        int bx = bonus_x * 4, by = TOP + bonus_y * 4;
        plot(bx + 1, by, 1);
        fill_rect(bx, by + 1, 3, 1, 1);
        plot(bx + 1, by + 2, 1);
    }
}

// Text centred on a row (32 cells across).
void centre(const char *s, int row) {
    int n = 0;
    while (s[n]) n++;
    draw_text(s, 16 - n / 2, row);
}

void title(const char *line) {
    clear();
    centre("WYRM", 4);
    centre(line, 7);
    centre("ARROWS STEER", 10);
    centre("PRESS A KEY", 12);
    show();
}

// ---- main ----
int main(void) {
    use_buffer();
    title("EAT. GROW. DON'T BITE.");
    wait_key();
    for (;;) {
        reset();
        int last = ticks();
        int alive = 1;
        while (alive) {
            int k = key();
            if (k == KEY_RIGHT) next_dir = 0;
            if (k == KEY_DOWN) next_dir = 1;
            if (k == KEY_LEFT) next_dir = 2;
            if (k == KEY_UP) next_dir = 3;
            if (ticks() - last >= delay()) {
                last = ticks();
                alive = step();
            }
            draw();
            show();
            next_frame();
        }
        if (score > best) best = score;
        draw();
        fill_rect(36, 38, 56, 20, 0);
        draw_rect(36, 38, 56, 20);
        centre("GAME OVER", 7);
        show();
        wait(45);
        wait_key();
    }
}
