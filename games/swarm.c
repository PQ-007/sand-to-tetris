// Swarm: a formation steps side to side and down; shoot it before it lands
// (docs/programs/swarm.md). C on machine.h.
#include <machine.h>

#define TOP 8
#define COLS 8
#define ROWS 5
#define CW 12 // a formation cell
#define CH 9
#define SHIP_Y 88
#define BUNKER_Y 74
#define BOMBS 3

// Sprites drawn for this game: a word per row, the leftmost pixel in bit
// 15. Three kinds of drone, two frames each (they flap as they step).
const int drones[3][2][6] = {
    {{0x8100, 0x5A00, 0x3C00, 0x6600, 0x3C00, 0x1800},
     {0x4200, 0x5A00, 0x3C00, 0x6600, 0x3C00, 0x2400}},
    {{0x3C00, 0x5A00, 0xFF00, 0x6600, 0x9900, 0x4200},
     {0x3C00, 0x5A00, 0xFF00, 0x6600, 0x5A00, 0x8100}},
    {{0x2400, 0x7E00, 0xDB00, 0xFF00, 0x4200, 0x8100},
     {0x2400, 0x7E00, 0xDB00, 0xFF00, 0x2400, 0x4200}},
};
const int ship[5] = {0x0800, 0x1C00, 0x7F00, 0xFF80, 0xA280};
const int burst[6] = {0x4400, 0x2800, 0x9200, 0x2800, 0x4400, 0x0000};

int alive[ROWS]; // a bit per drone, the leftmost in bit 7
int count;
int ox, oy, step_dir, frame, next_step;
int sx;       // the ship's left edge
int shot_x, shot_y, shot; // one shot at a time
int bomb_x[BOMBS], bomb_y[BOMBS];
int bunkers[4][6];   // 16 × 6 pixels each, eaten away by hits
int lives, score, wave, best;
int boom_x, boom_y, boom; // a drone just hit

const int bunker_shape[6] = {0x3FFC, 0x7FFE, 0xFFFF, 0xFFFF, 0xF00F, 0xE007};

void new_wave(void) {
    for (int r = 0; r < ROWS; r++) alive[r] = 0xFF;
    count = ROWS * COLS;
    ox = 16;
    oy = TOP + 6 + min(wave, 4) * 4;
    step_dir = 1;
    shot = 0;
    for (int i = 0; i < BOMBS; i++) bomb_y[i] = 0;
}

void reset(void) {
    lives = 3;
    score = 0;
    wave = 0;
    sx = 60;
    for (int b = 0; b < 4; b++) memcpy(bunkers[b], bunker_shape, 6);
    new_wave();
}

int bunker_x(int b) { return 10 + b * 30; }

// Is (x, y) on a bunker pixel? If so it's knocked out, with neighbours.
int hits_bunker(int x, int y) {
    int dy = y - BUNKER_Y;
    if (dy < 0 || dy >= 6) return 0;
    for (int b = 0; b < 4; b++) {
        int dx = x - bunker_x(b);
        if (dx < 0 || dx >= 16) continue;
        unsigned bit = 0x8000u >> dx;
        if (!(bunkers[b][dy] & bit)) return 0;
        unsigned mask = bit | (bit << 1) | (bit >> 1);
        bunkers[b][dy] &= ~mask;
        if (dy > 0) bunkers[b][dy - 1] &= ~bit;
        if (dy < 5) bunkers[b][dy + 1] &= ~bit;
        return 1;
    }
    return 0;
}

// The leftmost and rightmost columns still flying.
int edge(int right) {
    int any = 0;
    for (int r = 0; r < ROWS; r++) any |= alive[r];
    for (int c = 0; c < COLS; c++) {
        int col = right ? COLS - 1 - c : c;
        if (any & (0x80 >> col)) return col;
    }
    return 0;
}

// Fewer drones step more often.
int interval(void) { return 2 + count / 3; }

// The formation's step; 0 when it reaches the bunkers.
int march(void) {
    frame ^= 1;
    int lx = ox + edge(0) * CW + step_dir * 2;
    int rx = ox + edge(1) * CW + 8 + step_dir * 2;
    if (lx < 1 || rx > 127) {
        step_dir = -step_dir;
        oy += 4;
    } else {
        ox += step_dir * 2;
    }
    // The lowest row still flying.
    for (int r = ROWS - 1; r >= 0; r--)
        if (alive[r]) return oy + r * CH + 6 < BUNKER_Y + 2;
    return 1;
}

void drop_bomb(void) {
    int c = rand_below(COLS);
    for (int r = ROWS - 1; r >= 0; r--) {
        if (!(alive[r] & (0x80 >> c))) continue;
        for (int i = 0; i < BOMBS; i++) {
            if (bomb_y[i]) continue;
            bomb_x[i] = ox + c * CW + 3;
            bomb_y[i] = oy + r * CH + 7;
            return;
        }
        return;
    }
}

// One frame; 0 when the ship is hit or the drones land.
int update(int k, int fire) {
    if (k == KEY_LEFT) sx -= 2;
    if (k == KEY_RIGHT) sx += 2;
    sx = clamp(sx, 1, 118);
    if (fire && !shot) {
        shot = 1;
        shot_x = sx + 4;
        shot_y = SHIP_Y - 3;
    }
    if (shot) {
        shot_y -= 4;
        if (shot_y < TOP) shot = 0;
        else if (hits_bunker(shot_x, shot_y) || hits_bunker(shot_x, shot_y + 2)) shot = 0;
        else {
            int c = (shot_x - ox) / CW, r = (shot_y - oy) / CH;
            int in_x = shot_x - ox - c * CW, in_y = shot_y - oy - r * CH;
            if (shot_x >= ox && shot_y >= oy && c < COLS && r < ROWS && in_x < 8 && in_y < 7 &&
                (alive[r] & (0x80 >> c))) {
                alive[r] &= ~(0x80 >> c);
                count--;
                score += (3 - r / 2) * 10;
                shot = 0;
                boom = 8;
                boom_x = ox + c * CW;
                boom_y = oy + r * CH;
            }
        }
    }
    if (boom) boom--;
    if (--next_step <= 0) {
        next_step = interval();
        if (!march()) return 0;
        if (rand_below(3) == 0) drop_bomb();
    }
    for (int i = 0; i < BOMBS; i++) {
        if (!bomb_y[i]) continue;
        bomb_y[i]++;
        int x = bomb_x[i], y = bomb_y[i];
        if (y > 95 || hits_bunker(x, y + 3)) bomb_y[i] = 0;
        else if (y + 3 >= SHIP_Y && y <= SHIP_Y + 4 && x >= sx && x < sx + 9) {
            bomb_y[i] = 0;
            return 0;
        }
    }
    return 1;
}

void draw(void) {
    clear();
    draw_text("SCORE", 0, 0);
    draw_int(score, 6, 0);
    draw_text("WAVE", 14, 0);
    draw_int(wave + 1, 19, 0);
    for (int i = 0; i < lives; i++) draw_sprite(104 + i * 8, 2, ship + 2, 3);
    fill_rect(0, TOP - 2, 128, 1, 1);
    for (int r = 0; r < ROWS; r++) {
        if (!alive[r]) continue;
        const int *s = drones[r / 2][frame];
        for (int c = 0; c < COLS; c++)
            if (alive[r] & (0x80 >> c)) draw_sprite(ox + c * CW, oy + r * CH, s, 6);
    }
    if (boom) draw_sprite(boom_x, boom_y, burst, 6);
    for (int b = 0; b < 4; b++) draw_sprite(bunker_x(b), BUNKER_Y, bunkers[b], 6);
    draw_sprite(sx, SHIP_Y, ship, 5);
    if (shot) fill_rect(shot_x, shot_y, 1, 3, 1);
    for (int i = 0; i < BOMBS; i++)
        if (bomb_y[i]) {
            plot(bomb_x[i], bomb_y[i], 1);
            plot(bomb_x[i] + 1, bomb_y[i] + 1, 1);
            plot(bomb_x[i], bomb_y[i] + 2, 1);
        }
    fill_rect(0, 95, 128, 1, 1);
}

// Text centred on a row (32 cells across).
void centre(const char *s, int row) {
    int n = 0;
    while (s[n]) n++;
    draw_text(s, 16 - n / 2, row);
}

void banner(const char *s) {
    fill_rect(24, 44, 80, 14, 0);
    draw_rect(24, 44, 80, 14);
    centre(s, 8);
    show();
}

// ---- main ----
int main(void) {
    use_buffer();
    clear();
    centre("SWARM", 3);
    for (int i = 0; i < 3; i++) draw_sprite(44 + i * 14, 30, drones[i][0], 6);
    centre("LEFT AND RIGHT MOVE, SPACE FIRES", 8);
    centre("PRESS A KEY", 11);
    show();
    wait_key();
    for (;;) {
        reset();
        int held = 0;
        while (lives > 0) {
            int k = key();
            // A shot per press: holding space doesn't fire again.
            int fire = k == KEY_SPACE && !held;
            held = k == KEY_SPACE;
            if (!update(k, fire)) {
                lives--;
                draw();
                banner(lives ? "SHIP LOST" : "GAME OVER");
                wait(60);
                if (oy + ROWS * CH > BUNKER_Y) {
                    // They landed: the game is over whatever the lives.
                    lives = 0;
                }
                for (int i = 0; i < BOMBS; i++) bomb_y[i] = 0;
                sx = 60;
            }
            if (count == 0) {
                wave++;
                new_wave();
                draw();
                banner("WAVE CLEARED");
                wait(60);
            }
            draw();
            show();
            next_frame();
        }
        if (score > best) best = score;
        draw();
        banner("GAME OVER");
        wait(30);
        wait_key();
    }
}
