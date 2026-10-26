# arbitrary-precision-decimal-lib

Performs arbitrary-precision decimal arithmetic on numbers stored as digit arrays, for exact financial calculations where binary floating point would introduce rounding error.

## Usage

```js
import { Decimal } from 'arbitrary-precision-decimal-lib';

const a = Decimal.fromString('1.15');
const b = Decimal.fromString('2.30');
console.log(a.add(b).toString());        // '3.45'
console.log(a.mul(b).toString());        // '2.6450'
console.log(Decimal.fromString('10').div(Decimal.fromString('3'), 4).toString()); // '3.3333'
console.log(Decimal.fromString('-1.5').abs().toString()); // '1.5'
```

## Why this exists

Binary floating point cannot represent 0.1 exactly, so sums like 0.10 + 0.20 sometimes print as 0.30000000000000004. For money that is unacceptable. This library keeps each number as a sign, a digit array, and a scale, and does long addition, subtraction, multiplication, and division by hand so every result is exact to the scale requested.

The trade-off: this is slower than native `BigInt` and far slower than `Number`. It is meant for correctness in financial code, not for heavy numeric work.

## Awkward edge: division requires a precision argument

`1 / 3` has no finite decimal expansion. Rather than pick an arbitrary default and hide the truncation, `div(other, maxFractionalDigits)` makes you state how many fractional digits you want. Rounding is `ROUND_HALF_UP` (0.125 to two places is 0.13). If you omit the argument it defaults to 20 fractional digits; if you need more, pass it explicitly.
