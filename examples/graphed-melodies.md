# Graphed melodies

Functions written for a graphing calculator, ready for **Paste function** (sidebar → Tracks).
x is time in beats, y is pitch in octaves.

These two are *readings of screenshots*. The screenshots dropped some grouping (is `… + 5 mod 7`
the whole sum mod 7, or just 5?), so the parts marked below are best guesses. Pasting the original
LaTeX from Desmos (select the expression, ⌘C) is always exact.

## Bass kick + arpeggios

Uncertain: whether `- 2⌊x/4⌋` sits inside the `mod(…, 7)` as well as after it, and whether
`2(⌊4x⌋ mod 4 + ⌊x⌋ mod 2)` adds the two mods (read that way here).

```latex
\begin{cases}
-2 + \frac{\lfloor (12\operatorname{mod}(3\lfloor x/2\rfloor + 5, 7) + 2)/7 \rfloor}{12} + 2.5e^{-22\operatorname{frac}(x)} & \text{if } \operatorname{frac}(x) < \frac14 \\
\frac{\lfloor (12(\operatorname{mod}(3\lfloor x/2\rfloor + 2(\operatorname{mod}(\lfloor 4x\rfloor, 4) + \operatorname{mod}(\lfloor x\rfloor, 2)) + 1 - 2\lfloor x/4\rfloor, 7) - 2\lfloor x/4\rfloor + 4) + 2)/7 \rfloor}{12} + \frac{(\lfloor x/2\rfloor = 2)(\operatorname{mod}(\lfloor 4x\rfloor, 8) = 1)}{12} + \frac{e^{-12\operatorname{frac}(4x)}}{6} & \text{if } \operatorname{frac}(4x) < 0.8
\end{cases}
```

## Bassline with sparse melody

Uncertain: the inner floor `⌊(⌊x/2⌋ + 3 + (⌊4x⌋ mod 8)/3)/2⌋` — the screenshot was too small to
be sure of its fraction bars.

```latex
\begin{cases}
\begin{cases} \frac{\lfloor (12(12 - \operatorname{mod}(\lfloor 4x\rfloor, 8) - \lfloor (\lfloor x/2\rfloor + 3 + \operatorname{mod}(\lfloor 4x\rfloor, 8)/3)/2 \rfloor) + 2)/7 \rfloor}{12} + \frac{(\operatorname{mod}(\lfloor 4x\rfloor, 8) = 3)\max(0, \lfloor x/2\rfloor - 1)}{12} + \frac{e^{-12\operatorname{frac}(4x)}}{6} & \text{if } \operatorname{frac}(4x) < 0.8 \end{cases} & \text{if } (\operatorname{mod}(\lfloor 4x\rfloor, 8) - 3)(\operatorname{mod}(\lfloor 4x\rfloor, 8) - 6) = 0 \\
-2 + \frac{\lfloor (12\operatorname{mod}(3\lfloor x/2\rfloor + 5, 7) + 2)/7 \rfloor}{12} + \begin{cases} 2.5e^{-22\operatorname{frac}(x)} & \text{if } \operatorname{frac}(x) < \frac14 \\ (\operatorname{mod}(\lfloor 4x\rfloor, 8) = 7) + 0.22e^{-14\operatorname{frac}(4x)} & \text{if } \operatorname{frac}(4x) < 0.72 \end{cases} & \text{otherwise}
\end{cases}
```


## Bitmask melody (structured text)

Paste into **Paste function** as it is — definitions, nested `IF / ELSE IF / OTHERWISE`
blocks and the helper `g(x)` are all understood. Set **x starts at** −8 and **Length** 16: the
function plays different phrases for x < −4, −4 ≤ x < 0 and x ≥ 0.

### As written

```
frac(x) = x − ⌊x⌋

y(x) =
IF x < 4 AND frac(4x) < 0.8 AND ⌊42184 / 2^(|4x| mod 16)⌋ mod 2 = 1:
  y = (⌊(191514120807·(x < −4) + 81214171410·(⌊x/4⌋ − 1) + 121519201714·(x ≥ 0))/(100^6 − ⌊(3|4x| mod 15 + 1)/3⌋)⌋ mod 100)/12 + e^(−12·frac(4x))/6
OTHERWISE:
  y = −2 + ⌊(12(3⌊x/2⌋ + 5 mod 7) + 2)/7⌋/12 + g(x)

g(x) =
IF x ≥ 4:
  IF frac(x) < 1/2:
    3e^(−30·frac(x))
  OTHERWISE:
    e^(12·frac(x) − 12) + tri(24x)/24
OTHERWISE:
  IF frac(x) < 1/4:
    2.5e^(−22·frac(x))
  ELSE IF frac(4x) < 0.72:
    (⌊4x⌋ mod 2) + 0.22e^(−14·frac(4x))
```

Read literally, the melody line is always the same note: `100^6 − ⌊…⌋` is about 10¹², so the
division rounds to 0. `|4x|` (absolute value) also changes *within* each 16th, scrambling the
`42184` rhythm mask.

### Probably intended

Three symbols that likely got lost in transcription — `⌊4x⌋` instead of `|4x|`, `= −1`
instead of `− 1` (so each 12-digit number is one phrase of semitone pairs), and the digit-pair
exponent `100^(5 − i)`:

```
frac(x) = x − ⌊x⌋

y(x) =
IF x < 4 AND frac(4x) < 0.8 AND ⌊42184 / 2^(⌊4x⌋ mod 16)⌋ mod 2 = 1:
  y = (⌊(191514120807·(x < −4) + 81214171410·(⌊x/4⌋ = −1) + 121519201714·(x ≥ 0))/100^(5 − ⌊(3⌊4x⌋ mod 15 + 1)/3⌋)⌋ mod 100)/12 + e^(−12·frac(4x))/6
OTHERWISE:
  y = −2 + ⌊(12(3⌊x/2⌋ + 5 mod 7) + 2)/7⌋/12 + g(x)

g(x) =
IF x ≥ 4:
  IF frac(x) < 1/2:
    3e^(−30·frac(x))
  OTHERWISE:
    e^(12·frac(x) − 12) + tri(24x)/24
OTHERWISE:
  IF frac(x) < 1/4:
    2.5e^(−22·frac(x))
  ELSE IF frac(4x) < 0.72:
    (⌊4x⌋ mod 2) + 0.22e^(−14·frac(4x))
```

This plays phrases like 15 8 19 12 / 14 8 12 14 / 20 15 19 12 (semitones above the root)
on the syncopated rhythm 42184 = 1010010011001000₂.
