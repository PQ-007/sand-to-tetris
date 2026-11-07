---
number: 5
title: Swarm
summary: "A formation steps side to side and down while you shoot from below. The whole formation is five bytes and one offset."
---

**Swarm** sends 40 drones in five rows. They step sideways together, drop when they reach the edge, and drop bombs; the fewer there are, the faster they step. Left and right move your ship, and space fires one shot at a time. Four bunkers shelter you until shots and bombs wear them away. The drones score 30, 20 or 10 by row. It's `games/swarm.c`, about 260 lines of C; the drones' pictures were drawn for it, two frames each, so they flap as they step.

## A formation in five bytes

Where each drone is never has to be stored. The formation is one offset, `(ox, oy)`, and five 8-bit numbers, `alive[row]`, a bit per drone. Drone c of row r is at `ox + 12c`, `oy + 9r` if its bit is set. Moving all 40 is adding 2 to `ox`. A shot finds the drone it hit by dividing its position by the cell size, then checks and clears one bit. The formation's edges come from OR-ing the five rows together and finding the first and last 1.

## Faster as they fall

The formation steps once every `2 + count / 3` frames, where `count` is the drones still flying: about every 15 frames at the start, every 2 for the last few. Speeding up as the target shrinks is what makes the end of a wave tense.

## Bunkers you can wear away

Each bunker is a 16 × 6 picture stored as six words, drawn with `draw_sprite`, the same as a drone. When a shot or a bomb meets a bunker, the game checks the bit under it, and if it's set, clears it and the bits beside it. The damage is just bits turned off, so it builds up hit by hit.

## Try changing it

- Draw your own drones: each row of a picture is one word, bit 15 at the left.
- Let the formation shoot more, or let your ship fire two shots at once.
- Add a sixth row, and see how the game slows down drawing it.
