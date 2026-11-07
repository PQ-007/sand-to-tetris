// Corridors: find the door out of a maze, seen in 3D from inside it
// (docs/programs/corridors.md). C on machine.h; a new maze every game.
#include <machine.h>

// The map: 16 × 16 cells, 1 = wall, 2 = the door out, 0 = floor.
// Positions are 8.8 fixed point: 256 units to a cell.
#define N 16
#define UNIT 256
char map[N][N];

int px, py, angle; // the player; angle in 256ths of a turn, 0 = east
int level, started, best_time;
int show_map;

// ---- the maze: carve passages from room to room (a random depth-first
// walk), rooms at odd cells.

int stack_x[64], stack_y[64];
int dist[N][N];

void carve(void) {
    for (int y = 0; y < N; y++)
        for (int x = 0; x < N; x++) map[y][x] = 1;
    int top = 0;
    stack_x[0] = 1;
    stack_y[0] = 1;
    map[1][1] = 0;
    const int ddx[4] = {2, 0, -2, 0};
    const int ddy[4] = {0, 2, 0, -2};
    while (top >= 0) {
        int x = stack_x[top], y = stack_y[top];
        // The unvisited rooms next door.
        int options[4], n = 0;
        for (int d = 0; d < 4; d++) {
            int nx = x + ddx[d], ny = y + ddy[d];
            if (nx > 0 && ny > 0 && nx < N - 2 && ny < N - 2 && map[ny][nx]) options[n++] = d;
        }
        if (!n) {
            top--;
            continue;
        }
        int d = options[rand_below(n)];
        map[y + ddy[d] / 2][x + ddx[d] / 2] = 0;
        map[y + ddy[d]][x + ddx[d]] = 0;
        top++;
        stack_x[top] = x + ddx[d];
        stack_y[top] = y + ddy[d];
    }
    // A few extra openings, so there's more than one way round.
    for (int i = 0; i < 6; i++) {
        int x = 1 + rand_below(N - 3), y = 1 + rand_below(N - 3);
        if ((x + y) & 1) map[y][x] = 0;
    }
    // The door: on the outer wall next to the room farthest from the
    // start (a breadth-first walk counts the steps).
    for (int y = 0; y < N; y++)
        for (int x = 0; x < N; x++) dist[y][x] = -1;
    int qx[N * N], qy[N * N], head = 0, tail = 0;
    qx[tail] = 1;
    qy[tail++] = 1;
    dist[1][1] = 0;
    int fx = 1, fy = 1;
    while (head < tail) {
        int x = qx[head], y = qy[head++];
        for (int d = 0; d < 4; d++) {
            int nx = x + ddx[d] / 2, ny = y + ddy[d] / 2;
            if (map[ny][nx] || dist[ny][nx] >= 0) continue;
            dist[ny][nx] = dist[y][x] + 1;
            qx[tail] = nx;
            qy[tail++] = ny;
            // Farthest so far, among cells beside the outer wall.
            if ((nx == 1 || ny == 1 || nx == N - 3 || ny == N - 3) && dist[ny][nx] > dist[fy][fx]) {
                fx = nx;
                fy = ny;
            }
        }
    }
    if (fx == N - 3) map[fy][fx + 1] = 2;
    else if (fy == N - 3) map[fy + 1][fx] = 2;
    else if (fx == 1) map[fy][0] = 2;
    else map[0][fx] = 2;
}

// The map cell under a position (a macro: it's in the innermost loop).
#define CELL(x, y) map[(y) >> 8][(x) >> 8]

int cell(int x, int y) { return CELL(x, y); }

void start_level(void) {
    carve();
    px = UNIT + UNIT / 2;
    py = UNIT + UNIT / 2;
    angle = map[1][2] ? 64 : 0; // face an open way
    started = ticks();
}

// ---- moving

// Steps of a quarter of a pixel... of a cell: 1/16 cell a frame forward.
// Returns 1 when the player walks into the door.
int move(int k) {
    if (k == KEY_LEFT) angle -= 4;
    if (k == KEY_RIGHT) angle += 4;
    angle &= 255;
    int speed = k == KEY_UP ? 16 : k == KEY_DOWN ? -12 : 0;
    if (!speed) return 0;
    int mx = cos256(angle) * speed / 256;
    int my = sin256(angle) * speed / 256;
    // Keep a margin from walls; slide along them one axis at a time.
    int margin = mx > 0 ? 48 : -48;
    int c = cell(px + mx + margin, py);
    if (c == 2) return 1;
    if (!c) px += mx;
    margin = my > 0 ? 48 : -48;
    c = cell(px, py + my + margin);
    if (c == 2) return 1;
    if (!c) py += my;
    return 0;
}

// ---- drawing: one ray per 2-pixel column, 64 columns over a quarter turn

// Each ray: step a quarter cell at a time until a wall, then halve the
// step four times to find the wall within 1/64 of a cell.
int ray(int a, int *side, int *kind, int *along) {
    int sx = cos256(a) >> 2, sy = sin256(a) >> 2;
    int x = px, y = py;
    int n = 0;
    int c;
    do {
        x += sx;
        y += sy;
        n++;
    } while (!(c = CELL(x, y)) && n != 60);
    if (!c) return 60 * 16;
    // Between (x - sx, y - sy) (open) and (x, y) (wall).
    int lx = x - sx, ly = y - sy;
    int frac = 16;
    int half = 8;
    while (half) {
        int mx = (lx + x) >> 1, my = (ly + y) >> 1;
        if (CELL(mx, my)) {
            x = mx;
            y = my;
            frac -= half;
        } else {
            lx = mx;
            ly = my;
        }
        half >>= 1;
    }
    *kind = CELL(x, y);
    // Which face: did the last step cross a line of x or of y?
    *side = (lx >> 8) != (x >> 8);
    *along = *side ? y & 255 : x & 255;
    return (n - 1) * 16 + frac;
}

// 256 × cos of each column's angle from the view's centre, over 4.
int column_cos[64];

void tables(void) {
    for (int i = 0; i < 64; i++) column_cos[i] = cos256(i - 32) >> 2;
}

void draw_view(void) {
    clear();
    int *buf = __buf;
    // The floor: a sparse dot pattern, denser further down.
    for (int y = 56; y < 96; y += 3) {
        int pattern = y > 80 ? 0x8888 : y > 66 ? 0x8080 : 0x8000;
        int *row = buf + y * 8;
        int p = pattern >> (y & 3);
        for (int w = 0; w < 8; w++) row[w] = p;
    }
    for (int i = 0; i < 64; i++) {
        int side, kind, along;
        int d = ray(angle + i - 32, &side, &kind, &along);
        // Straight-on distance, so walls don't bulge (in 64ths of a cell).
        unsigned perp = ((unsigned)d * column_cos[i]) >> 6;
        if (perp < 4) perp = 4;
        int h = 4096 / perp;
        if (h > 96) h = 96;
        int top = 48 - h / 2, bottom = top + h;
        int w = i >> 3;
        unsigned mask = 0xC000u >> ((i & 7) << 1);
        unsigned keep = ~mask;
        // The floor dots behind the wall go (only every third row has any).
        if (bottom > 56) {
            int *f = buf + 56 * 8 + w;
            int *end = buf + bottom * 8 + w;
            for (; f < end; f += 24) *f &= keep;
        }
        // Pointers down the column: comparing pointers is cheap (unsigned),
        // and the buffer starts clear, so only lit rows are written.
        int *p = buf + top * 8 + w;
        int *last = buf + (bottom - 1) * 8 + w;
        *p |= mask;
        *last |= mask;
        int edge = along < 20 || along > 236;
        unsigned bits = mask;
        int step = 8;
        if (kind == 2) {
            // The door: solid, its frame left light.
            if (edge) continue;
            p += 8;
        } else if (edge) {
            // A corner of a block: a dotted line.
            bits = mask & 0x5555;
            p += 8;
        } else {
            // Faces: east-west walls dark, north-south light, both lighter
            // far away; lit rows are multiples of the period on screen, so
            // the pattern holds still as you move.
            int period = side ? (h > 24 ? 2 : 4) : (h > 24 ? 8 : 16);
            int row = (top + period) & ~(period - 1);
            p = buf + row * 8 + w;
            step = period * 8;
        }
        for (; p < last; p += step) *p |= bits;
    }
}

void draw_map(void) {
    // Top-left, a pixel... three pixels a cell, with you as a blinking dot.
    fill_rect(0, 0, N * 3 + 2, N * 3 + 2, 0);
    for (int y = 0; y < N; y++)
        for (int x = 0; x < N; x++) {
            int c = map[y][x];
            if (c == 1) fill_rect(1 + x * 3, 1 + y * 3, 3, 3, 1);
            if (c == 2) draw_rect(1 + x * 3, 1 + y * 3, 3, 3);
        }
    if (ticks() & 8) {
        int x = 1 + px * 3 / 256, y = 1 + py * 3 / 256;
        fill_rect(x, y, 2, 2, 1);
    }
}

void draw_hud(void) {
    int t = (ticks() - started) / 60;
    fill_rect(92, 0, 36, 7, 0);
    draw_int(t, 24, 0);
    draw_char('S', 24 + (t > 99 ? 3 : t > 9 ? 2 : 1), 0);
    fill_rect(0, 89, 24, 7, 0);
    draw_text("MAZE", 0, 15);
    draw_int(level + 1, 5, 15);
}

// Text centred on a row (32 cells across).
void centre(const char *s, int row) {
    int n = 0;
    while (s[n]) n++;
    draw_text(s, 16 - n / 2, row);
}

// ---- main ----
int main(void) {
    use_buffer();
    tables();
    clear();
    centre("CORRIDORS", 3);
    centre("FIND THE DARK DOOR OUT", 6);
    centre("UP WALKS, LEFT AND RIGHT TURN", 8);
    centre("M SHOWS THE MAP", 10);
    centre("PRESS A KEY", 12);
    show();
    wait_key();
    for (;;) {
        start_level();
        int held = 0;
        for (;;) {
            int k = key();
            if ((k == 'm' || k == 'M') && !held) show_map = !show_map;
            held = k == 'm' || k == 'M';
            if (move(k)) break;
            draw_view();
            if (show_map) draw_map();
            draw_hud();
            show();
            next_frame();
        }
        int t = (ticks() - started) / 60;
        if (!best_time || t < best_time) best_time = t;
        fill_rect(16, 30, 96, 30, 0);
        draw_rect(16, 30, 96, 30);
        centre("YOU FOUND THE WAY OUT", 6);
        draw_text("TIME", 9, 8);
        draw_int(t, 14, 8);
        draw_text("BEST", 18, 8);
        draw_int(best_time, 23, 8);
        show();
        level++;
        wait(30);
        wait_key();
    }
}
