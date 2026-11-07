---
number: 2
title: Wyrm
summary: "Steer a worm that grows each time it eats. The body is a ring of cells, and a grid makes every collision one lookup."
---

**Wyrm** is a worm on a 32 × 22 grid of 4-pixel cells. The arrow keys steer it. Each hollow square it eats is a point and two more cells of body; now and then a blinking cross appears, worth five points if you reach it before it fades. Hitting a wall or your own body ends the game, and the worm speeds up as the score climbs. It's `games/wyrm.c`, about 180 lines of C.

## The body is a ring

The worm's cells are kept in two arrays, `xs` and `ys`, used as a **ring**: `head` is the index of the head, and the tail is `len − 1` places before it, wrapping round from 0 to the end. A step writes the new head one place on and, unless the worm is growing, forgets the tail by shrinking `len`. Nothing is ever shifted along the array, so a step costs the same for a worm of 3 cells or 300.

## A grid for collisions

To know whether the head runs into the body, the game could compare it with every body cell. Instead it keeps `grid[y][x]`, a 1 for every cell the body covers, updated as the head arrives and the tail leaves. A collision is one lookup: **[[collision detection|collision-detection]]** in constant time. The tail leaves before the head arrives, so the worm may chase its own tail without dying.

## Speed from the timer

The **[[game loop|game-loop]]** runs once a frame: read the arrows, step if it's time, draw, `show()`, `next_frame()`. It's time when `ticks()` has moved on by `max(2, 7 − score / 6)` frames since the last step, so the worm takes a step every 7 frames at first and every 2 at its fastest, whatever the speed of the simulation.

## Try changing it

- Let the worm wrap round the edges instead of dying (hint: `(x + COLS) % COLS`).
- Make the bonus appear more often, or move.
- Drop `use_buffer()` and `show()`, and watch the flicker that **[[double buffering|double-buffering]]** hides.
