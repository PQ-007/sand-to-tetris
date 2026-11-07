---
number: 3
title: Rally
summary: "A paddle-and-ball duel with the computer. The ball moves in sixteenths of a pixel, and where it hits the paddle sets its angle."
---

**Rally** is a duel: your paddle on the left, the computer's on the right, a ball between. Up and down move your paddle; the first to 7 points wins, and the longest rally is shown at the end. It's `games/rally.c`, about 150 lines of C. It's one player against the computer because the machine's keyboard holds one key at a time (address 0x6000 has room for one code), so two players couldn't both press keys at once.

## Sixteenths of a pixel

A ball that moves a whole pixel each frame can only go at a few speeds and angles. Rally keeps the ball's position and speed in sixteenths of a pixel instead: **[[fixed point|fixed-point]]** with a scale of 16. A speed of 24 is 1.5 pixels a frame, and the ball is drawn at `bx / 16`. The ball starts at 24, gains 2 with every hit, and stops at 56, 3.5 pixels a frame.

## Where it hits sets the angle

When the ball meets a paddle, the game measures how far from the paddle's middle it hit, from −7 to 7, and sets the up-down speed to five times that. Off the middle, the ball comes back flat; off the edges, steeply. That one rule is what makes aiming possible.

## The computer's paddle

The computer only follows the ball while the ball is coming its way, and then by at most 22 sixteenths of a pixel a frame; otherwise it drifts back to the middle. A slow ball it always reaches. A fast, steep ball can outrun it, which is how you score.

## Try changing it

- Change `CPU_SPEED` and see how quickly the game becomes unwinnable, or too easy.
- Let the ball speed up faster, or keep its speed after a point.
- Give the computer a weakness: make it react only once the ball has crossed the middle.
