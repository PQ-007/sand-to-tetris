---
number: 8
title: Corridors
summary: "Find the door out of a maze seen in 3D from inside. A new maze every game, drawn by casting 64 rays through it each frame."
---

**Corridors** puts you inside a maze. Up walks forward, down walks back, left and right turn, and M shows a map. Somewhere on the outside wall is a dark door: walk into it to escape. Your time is shown, and every game is a new maze. It's `games/corridors.c`, about 300 lines of C, and the most work the machine does in this section: about 100,000 instructions a frame.

## A new maze every game

The map is 16 × 16 cells. The game fills it with wall, then carves passages with a random walk: from the current room, pick a neighbouring room not yet visited, knock down the wall between, and move there; when there is none, go back the way you came (a stack of rooms). That visits every room, so every room can be reached. A few extra walls are knocked down so there's more than one way round. Then a breadth-first walk from the start counts the steps to every cell, and the door goes in the outside wall next to the farthest one.

## Casting rays

The view is **[[ray casting|ray-casting]]**: the screen is 64 columns, 2 pixels wide, covering a quarter turn. For each column, the game sends a ray from you in that column's direction, a quarter of a cell at a time, until it lands in a wall. Then it halves the step four times between the last open point and the wall to find the wall within 1/64 of a cell. The nearer the wall, the taller its column: 4,096 divided by the distance. Positions are **[[fixed point|fixed-point]]** with 256 units to a cell.

## No bulging walls

A ray to the side travels further than the one straight ahead, even to the same flat wall, so walls would bulge like a fish-eye. Multiplying each distance by the cosine of the ray's angle from the centre of the view gives the straight-ahead distance instead, and walls look flat.

## Black and white

With one bit per pixel there's no grey, so walls are patterns of lines: faces seen looking east or west are denser than faces seen looking north or south, both get sparser with distance, and the corners of blocks are dotted lines. The door is solid. Only the rows that light up are written, a few pointers apart, which keeps a frame within the Machine's Fast speed.

## Try changing it

- Make the maze bigger: change `N`, and the map's size on screen.
- Draw the floor as a checkerboard that moves as you walk.
- Put a second door in, and a key you must find first.
