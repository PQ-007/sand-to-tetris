---
number: 7
title: Prowl
summary: "Clear a maze of dots while three seekers hunt you, each its own way. A power dot turns the hunt around."
---

**Prowl** is a maze chase. The arrows move you through a maze drawn for this game; eat every dot to clear it. Three seekers leave a box in the middle one by one and come after you. Eat one of the four blinking power dots and for a few seconds they turn into crosses and flee: catch them for 200, 400 and 800 points. You have three lives. It's `games/prowl.c`, about 300 lines of C.

## The maze is text

The maze is 14 lines of 21 characters in the program: `#` for a wall, `.` for a dot, `o` for a power dot, `-` for the box's door. Walls aren't drawn as blocks: each wall cell gets a line on each side that faces a corridor, which turns the text into a maze of thin double lines. That takes thousands of instructions, so it's drawn once, with `draw_into`, into an image of its own; each frame copies that image in and draws the dots and movers on top.

## Moving on a grid

You and the seekers move a pixel at a time, but only choose a direction in the middle of a cell (when both coordinates divide by 6). Turning back works at once. Any other turn is remembered until you reach a cell where that way is open, so you can press an arrow a little early.

## Three ways to hunt

At each cell, a seeker looks at the ways it can go (never straight back) and takes the one that brings it closest to a target cell:

- the first targets **your cell**;
- the second targets the cell **four ahead of you**, so it tends to cut you off;
- the third targets you while it's far away, but heads for its own corner once it's within five cells.

Afraid, they choose at random. Three simple rules make three characters you can learn to read.

## Try changing it

- Redraw the maze: it's text, but keep every dot reachable and every corridor joined to another.
- Give the seekers a fourth way to hunt.
- Make the fright last longer, or shorten it every level.
