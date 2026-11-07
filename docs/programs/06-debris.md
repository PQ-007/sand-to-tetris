---
number: 6
title: Debris
summary: "Steer a ship that drifts among rocks and shoot them to pieces. Angles are 256ths of a turn, motion is fixed point, and everything is drawn with lines."
---

**Debris** is a ship in a field of drifting rocks. Left and right turn the ship, up thrusts, and space fires; the ship keeps drifting after you let go. A big rock you shoot splits into two medium ones, a medium one into two small ones, and a small one is gone. Clear the field and a bigger wave comes. Everything, from the ship to the score's lives, is drawn with straight lines. It's `games/debris.c`, about 260 lines of C.

## Angles and directions

The ship's angle is a number from 0 to 255, a 256th of a full turn per step, so it wraps round on its own when you AND it with 255. `cos256(a)` and `sin256(a)` from `machine.h` give 256 times the cosine and sine, from a table of 65 numbers for a quarter turn. Thrust adds `cos256(angle) / 32` to the left-right speed and `sin256(angle) / 32` to the up-down speed.

## Drift and drag

Positions and speeds are **[[fixed point|fixed-point]]** in sixteenths of a pixel. Every frame each speed loses a thirty-second of itself (`vx -= vx / 32`), so the ship slows down gently instead of stopping, and its speed is capped at 2.5 pixels a frame. Anything that leaves one edge comes back at the other: the field wraps round.

## Lumpy rocks

A rock is a centre, a speed, a size and eight corners. When it's made, each corner is put in one of eight directions at the rock's radius, minus a random bit, so no two rocks look alike. Drawing it is eight calls to `draw_line`, which uses Bresenham's method: step one pixel at a time along the longer direction, and keep a running error to decide when to step along the shorter one.

## Hitting a rock

A shot hits a rock when it's within the rock's radius: when dx² + dy² ≤ r². Squaring is a multiplication, which this machine does with a routine of shifts and adds, so the game first checks the cheap way, whether dx or dy alone is bigger than r, and only multiplies when the shot is close.

## Try changing it

- Give the ship a brake, or a hyperspace jump that moves it somewhere random.
- Make rocks split into three.
- Let rocks bounce off each other.
