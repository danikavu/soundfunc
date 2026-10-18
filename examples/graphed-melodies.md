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
