// Debris: steer a ship through drifting rocks and shoot them to pieces
// (docs/programs/debris.md). C on machine.h; everything is drawn with lines.
#include <machine.h>

#define TOP 8
#define FP 16 // positions in sixteenths of a pixel
#define W (128 * FP)
#define H ((96 - TOP) * FP)
#define ROCKS 24
#define SHOTS 4

struct Rock {
    int x, y, vx, vy;
    int size; // 0 = none, 1 small, 2 medium, 3 big
    int px[8], py[8]; // its outline, offsets from the centre
};

struct Rock rocks[ROCKS];
int shot_x[SHOTS], shot_y[SHOTS], shot_vx[SHOTS], shot_vy[SHOTS], shot_life[SHOTS];
int x, y, vx, vy, angle; // the ship (angle in 256ths of a turn, 0 = right)
int thrust, safe;         // safe: frames of protection after a new ship
int lives, score, wave, best;

const int radius[4] = {0, 3, 6, 10};
// 256 × the cosine and sine of the eight directions of an outline.
const int dir_x[8] = {256, 181, 0, -181, -256, -181, 0, 181};
const int dir_y[8] = {0, 181, 256, 181, 0, -181, -256, -181};

void add_rock(int rx, int ry, int size) {
    for (int i = 0; i < ROCKS; i++) {
        struct Rock *r = &rocks[i];
        if (r->size) continue;
        r->x = rx;
        r->y = ry;
        int speed = 6 + (3 - size) * 5 + wave;
        int a = rand_below(256);
        r->vx = cos256(a) * speed / 256;
        r->vy = sin256(a) * speed / 256;
        r->size = size;
        // A lumpy outline: each corner a little in or out.
        for (int k = 0; k < 8; k++) {
            int d = radius[size] - rand_below(size + 1);
            r->px[k] = dir_x[k] * d / 256;
            r->py[k] = dir_y[k] * d / 256;
        }
        return;
    }
}

void new_ship(void) {
    x = W / 2;
    y = H / 2;
    vx = vy = 0;
    angle = 192; // pointing up
    safe = 120;
}

void new_wave(void) {
    for (int i = 0; i < 3 + wave && i < 8; i++) {
        // Along the edges, away from the ship in the middle.
        int along = rand_below(4);
        int rx = along & 1 ? rand_below(W) : (along & 2 ? 0 : W - FP);
        int ry = along & 1 ? (along & 2 ? 0 : H - FP) : rand_below(H);
        add_rock(rx, ry, 3);
    }
}

void reset(void) {
    for (int i = 0; i < ROCKS; i++) rocks[i].size = 0;
    for (int i = 0; i < SHOTS; i++) shot_life[i] = 0;
    lives = 3;
    score = 0;
    wave = 0;
    new_ship();
    new_wave();
}

// Positions wrap around the field's edges.
int wrap(int v, int size) {
    if (v < 0) return v + size;
    if (v >= size) return v - size;
    return v;
}

int rocks_left(void) {
    int n = 0;
    for (int i = 0; i < ROCKS; i++) n += rocks[i].size != 0;
    return n;
}

// Is (px, py) within r pixels of rock i? (Positions in pixels.)
int touches(int i, int px, int py, int r) {
    struct Rock *k = &rocks[i];
    int dx = abs(k->x / FP - px), dy = abs(k->y / FP - py);
    if (dx > r || dy > r) return 0;
    return dx * dx + dy * dy <= r * r;
}

void smash(int i) {
    struct Rock *k = &rocks[i];
    int size = k->size;
    score += size == 3 ? 20 : size == 2 ? 50 : 100;
    k->size = 0;
    if (size > 1) {
        add_rock(k->x, k->y, size - 1);
        add_rock(k->x, k->y, size - 1);
    }
}

// One frame; 0 when a rock hits the ship.
int update(int k, int fire) {
    if (k == KEY_LEFT) angle -= 6;
    if (k == KEY_RIGHT) angle += 6;
    angle &= 255;
    thrust = k == KEY_UP;
    if (thrust) {
        vx += cos256(angle) / 32;
        vy += sin256(angle) / 32;
    }
    // A little drag, and a top speed.
    vx -= vx / 32;
    vy -= vy / 32;
    vx = clamp(vx, -40, 40);
    vy = clamp(vy, -40, 40);
    x = wrap(x + vx, W);
    y = wrap(y + vy, H);
    if (fire) {
        for (int i = 0; i < SHOTS; i++) {
            if (shot_life[i]) continue;
            shot_x[i] = x + cos256(angle) * 5 / 16;
            shot_y[i] = y + sin256(angle) * 5 / 16;
            shot_vx[i] = cos256(angle) * 3 / 16 + vx;
            shot_vy[i] = sin256(angle) * 3 / 16 + vy;
            shot_life[i] = 32;
            break;
        }
    }
    for (int i = 0; i < SHOTS; i++) {
        if (!shot_life[i]) continue;
        shot_life[i]--;
        shot_x[i] = wrap(shot_x[i] + shot_vx[i], W);
        shot_y[i] = wrap(shot_y[i] + shot_vy[i], H);
        for (int j = 0; j < ROCKS; j++) {
            if (rocks[j].size && touches(j, shot_x[i] / FP, shot_y[i] / FP, radius[rocks[j].size])) {
                smash(j);
                shot_life[i] = 0;
                break;
            }
        }
    }
    int hit = 0;
    for (int j = 0; j < ROCKS; j++) {
        struct Rock *r = &rocks[j];
        if (!r->size) continue;
        r->x = wrap(r->x + r->vx, W);
        r->y = wrap(r->y + r->vy, H);
        if (!safe && touches(j, x / FP, y / FP, radius[r->size] + 2)) hit = 1;
    }
    if (safe) safe--;
    return !hit;
}

// A point `len` pixels from the ship in direction a (plus the field's top).
void tip(int a, int len, int *px, int *py) {
    *px = x / FP + cos256(a) * len / 256;
    *py = TOP + y / FP + sin256(a) * len / 256;
}

void draw(void) {
    clear();
    draw_text("SCORE", 0, 0);
    draw_int(score, 6, 0);
    draw_text("WAVE", 14, 0);
    draw_int(wave + 1, 19, 0);
    for (int i = 0; i < lives; i++) {
        draw_line(110 + i * 6, 5, 112 + i * 6, 0, 1);
        draw_line(112 + i * 6, 0, 114 + i * 6, 5, 1);
    }
    fill_rect(0, TOP - 2, 128, 1, 1);
    for (int i = 0; i < ROCKS; i++) {
        struct Rock *r = &rocks[i];
        if (!r->size) continue;
        int cx = r->x / FP, cy = TOP + r->y / FP;
        for (int k = 0; k < 8; k++) {
            int n = (k + 1) & 7;
            draw_line(cx + r->px[k], cy + r->py[k], cx + r->px[n], cy + r->py[n], 1);
        }
    }
    for (int i = 0; i < SHOTS; i++)
        if (shot_life[i]) plot(shot_x[i] / FP, TOP + shot_y[i] / FP, 1);
    // The ship blinks while it's protected.
    if (!safe || (safe & 8)) {
        int ax, ay, bx, by, cx, cy;
        tip(angle, 5, &ax, &ay);
        tip(angle + 104, 4, &bx, &by);
        tip(angle - 104, 4, &cx, &cy);
        draw_line(ax, ay, bx, by, 1);
        draw_line(ax, ay, cx, cy, 1);
        draw_line(bx, by, cx, cy, 1);
        if (thrust && (ticks() & 2)) {
            int fx, fy;
            tip(angle + 128, 6, &fx, &fy);
            draw_line((bx + cx) / 2, (by + cy) / 2, fx, fy, 1);
        }
    }
}

// Text centred on a row (32 cells across).
void centre(const char *s, int row) {
    int n = 0;
    while (s[n]) n++;
    draw_text(s, 16 - n / 2, row);
}

void banner(const char *s) {
    fill_rect(28, 44, 72, 14, 0);
    draw_rect(28, 44, 72, 14);
    centre(s, 8);
    show();
}

// ---- main ----
int main(void) {
    use_buffer();
    clear();
    centre("DEBRIS", 3);
    centre("LEFT AND RIGHT TURN", 7);
    centre("UP THRUSTS, SPACE FIRES", 9);
    centre("PRESS A KEY", 12);
    show();
    wait_key();
    for (;;) {
        reset();
        int held = 0;
        while (lives > 0) {
            int k = key();
            int fire = k == KEY_SPACE && !held;
            held = k == KEY_SPACE;
            if (!update(k, fire)) {
                lives--;
                draw();
                banner(lives ? "SHIP LOST" : "GAME OVER");
                wait(60);
                new_ship();
            }
            if (rocks_left() == 0) {
                wave++;
                new_wave();
            }
            draw();
            show();
            next_frame();
        }
        if (score > best) best = score;
        wait_key();
    }
}
