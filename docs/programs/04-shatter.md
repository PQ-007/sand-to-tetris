---
number: 4
title: Shatter
summary: "Keep the ball in play and break the wall. Walls are rows of bits, and the ball moves one axis at a time so it knows which side it hit."
---

**Shatter** is a brick breaker. Left and right move the paddle, space launches the ball, and every brick you hit breaks; the dark bricks in the top two rows take two hits. Clear the wall and the next one comes, in a new pattern, with a quicker ball and a narrower paddle. You have three balls. It's `games/shatter.c`, about 210 lines of C.

## Walls are rows of bits

Each level's wall is six numbers, one per row, with a bit for each of the 10 bricks: `0x3FF` is a full row, `0x2AA` every other brick. Four patterns take turns: full, checkered, a pyramid and a wall with gaps. Building a level reads the bits into `bricks[row][col]`, the hits each brick has left.

## One axis at a time

When the ball hits a brick, it has to bounce the right way: off a brick's top or bottom it turns round up and down, off its side left and right. Shatter moves the ball one axis at a time. It moves across first and checks for a brick; if there is one, the ball hit a side, so it reverses its left-right speed. Then it moves up or down and checks again. The ball never has to work out the angle it came in at.

## The paddle aims

As in Rally, where the ball lands on the paddle sets its new direction: the left-right speed is proportional to the distance from the paddle's middle. Near the edges the ball leaves at a sharp angle, which is how you reach the last bricks in the corners.

## Try changing it

- Draw a wall of your own: six numbers of 10 bits in `patterns`.
- Give some bricks three hits, or make a row unbreakable.
- Keep the paddle wide in later levels and speed the ball up instead.
