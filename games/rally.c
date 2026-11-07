// Rally: a paddle-and-ball duel with the computer, first to 7
// (docs/programs/rally.md). C on machine.h.
#include <machine.h>

#define TOP 9       // the field starts below the score
#define BOTTOM 96
#define PH 14       // paddle height
#define PW 2        // paddle width
#define LEFT_X 4    // the player's paddle
#define RIGHT_X 122 // the computer's
#define WIN 7

// The ball moves in sixteenths of a pixel, so it can travel at any angle
// and speed with whole numbers (fixed point: 16 = one pixel).
#define FP 16
int bx, by, vx, vy;
int you_y, cpu_y; // paddles' top rows
int you, cpu;     // points
int rallies;      // hits since the serve: the ball speeds up
int best_rally;

// The computer's paddle speed, in sixteenths of a pixel a frame: fast
// enough to win most points, slow enough to be beaten on a steep ball.
#define CPU_SPEED 22

void serve(int towards) {
    bx = 64 * FP;
    by = (TOP + 20 + rand_below(BOTTOM - TOP - 40)) * FP;
    vx = towards * 24;
    vy = rand_below(33) - 16;
    rallies = 0;
}

void reset(void) {
    you = cpu = 0;
    you_y = cpu_y = (TOP + BOTTOM - PH) / 2;
    serve(rand_below(2) ? 1 : -1);
}

// Where on the paddle the ball hit, -7..7, steers it: the edges send it
// off steeply, the middle straight.
void bounce(int paddle_y, int dir) {
    int hit = by / FP + 1 - (paddle_y + PH / 2);
    vy = hit * 5;
    rallies++;
    if (rallies > best_rally) best_rally = rallies;
    int speed = min(24 + rallies * 2, 56);
    vx = dir * speed;
}

// One frame of play; returns 1 or -1 when a point is won (by you or the
// computer), else 0.
int update(int k) {
    if (k == KEY_UP) you_y -= 2;
    if (k == KEY_DOWN) you_y += 2;
    you_y = clamp(you_y, TOP, BOTTOM - PH);

    // The computer follows the ball only while it comes its way.
    int target = vx > 0 ? by - (PH / 2) * FP : (TOP + (BOTTOM - TOP - PH) / 2) * FP;
    int cy = cpu_y * FP;
    if (cy < target - CPU_SPEED) cy += CPU_SPEED;
    else if (cy > target + CPU_SPEED) cy -= CPU_SPEED;
    cpu_y = clamp(cy / FP, TOP, BOTTOM - PH);

    bx += vx;
    by += vy;
    if (by < TOP * FP) {
        by = TOP * FP;
        vy = -vy;
    }
    if (by > (BOTTOM - 2) * FP) {
        by = (BOTTOM - 2) * FP;
        vy = -vy;
    }
    int x = bx / FP;
    int y = by / FP;
    if (vx < 0 && x <= LEFT_X + PW && x >= LEFT_X - 2 && y + 2 > you_y && y < you_y + PH) {
        bx = (LEFT_X + PW) * FP;
        bounce(you_y, 1);
    }
    if (vx > 0 && x + 2 >= RIGHT_X && x <= RIGHT_X + 2 && y + 2 > cpu_y && y < cpu_y + PH) {
        bx = (RIGHT_X - 2) * FP;
        bounce(cpu_y, -1);
    }
    if (x < -4) return -1;
    if (x > 130) return 1;
    return 0;
}

void draw(void) {
    clear();
    // Big score digits on either side of the net.
    draw_int(you, 12, 0);
    draw_int(cpu, 19, 0);
    draw_text("YOU", 4, 0);
    draw_text("CPU", 25, 0);
    fill_rect(0, TOP - 1, 128, 1, 1);
    for (int y = TOP + 1; y < BOTTOM; y += 6) fill_rect(63, y, 2, 3, 1);
    fill_rect(LEFT_X, you_y, PW, PH, 1);
    fill_rect(RIGHT_X, cpu_y, PW, PH, 1);
    fill_rect(bx / FP, by / FP, 2, 2, 1);
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
    clear();
    centre("RALLY", 4);
    centre("FIRST TO 7", 7);
    centre("UP AND DOWN MOVE YOUR PADDLE", 10);
    centre("PRESS A KEY", 12);
    show();
    wait_key();
    for (;;) {
        reset();
        while (you < WIN && cpu < WIN) {
            int point = update(key());
            if (point) {
                if (point > 0) you++;
                else cpu++;
                draw();
                show();
                wait(40);
                serve(point > 0 ? -1 : 1);
            }
            draw();
            show();
            next_frame();
        }
        draw();
        fill_rect(24, 36, 80, 26, 0);
        draw_rect(24, 36, 80, 26);
        centre(you == WIN ? "YOU WIN" : "THE CPU WINS", 7);
        draw_text("LONGEST RALLY", 8, 8);
        draw_int(best_rally, 22, 8);
        show();
        wait(60);
        wait_key();
    }
}
