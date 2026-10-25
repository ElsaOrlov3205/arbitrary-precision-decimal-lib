/**
 * Arbitrary-precision decimal arithmetic.
 *
 * Numbers are stored internally as { sign, digits, scale } where:
 *   - sign   is 1, -1, or 0 (zero is always positive, sign 0).
 *   - digits is an array of decimal digits, most-significant first,
 *            with no leading zeros (except the value 0 itself, which is []).
 *   - scale  is the number of digits that represent the fractional part.
 *            So 1.23 = { sign:1, digits:[1,2,3], scale:2 } and
 *            100   = { sign:1, digits:[1,0,0], scale:0 }.
 *
 * We use plain arrays rather than BigInt because the brief asks for
 * digit-array representation, and doing the long-add/multiply by hand keeps
 * the data model honest. This is slower than native BigInt but adequate for
 * exact financial calculations of the sizes seen in practice.
 */

function trimLeadingZeros(arr) {
  let i = 0;
  while (i < arr.length && arr[i] === 0) i++;
  return arr.slice(i);
}

function cmpDigits(a, b) {
  if (a.length !== b.length) return a.length < b.length ? -1 : 1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

function addDigits(a, b) {
  const out = [];
  let carry = 0;
  let i = a.length - 1;
  let j = b.length - 1;
  while (i >= 0 || j >= 0 || carry) {
    const x = i >= 0 ? a[i--] : 0;
    const y = j >= 0 ? b[j--] : 0;
    const s = x + y + carry;
    out.push(s % 10);
    carry = s >= 10 ? 1 : 0;
  }
  return out.reverse();
}

function subDigits(a, b) {
  // Precondition: a >= b (digit-wise, same length handled by caller via cmpDigits).
  const out = [];
  let borrow = 0;
  let i = a.length - 1;
  let j = b.length - 1;
  while (i >= 0) {
    const x = a[i--];
    const y = j >= 0 ? b[j--] : 0;
    let d = x - y - borrow;
    if (d < 0) {
      d += 10;
      borrow = 1;
    } else {
      borrow = 0;
    }
    out.push(d);
  }
  return out.reverse();
}

function mulDigits(a, b) {
  if (a.length === 0 || b.length === 0) return [];
  const out = new Array(a.length + b.length).fill(0);
  for (let i = a.length - 1; i >= 0; i--) {
    let carry = 0;
    for (let j = b.length - 1; j >= 0; j--) {
      const idx = i + j + 1;
      const s = out[idx] + a[i] * b[j] + carry;
      out[idx] = s % 10;
      carry = (s / 10) | 0;
    }
    out[i] += carry;
  }
  return trimLeadingZeros(out);
}

// Long division of digit arrays producing a quotient and remainder.
// We implement this on integer digit arrays; the caller handles scale bookkeeping.
function divmodDigits(a, b) {
  if (b.length === 0) throw new Error('Division by zero');
  if (cmpDigits(a, b) < 0) return { quotient: [], remainder: a };

  const quotient = [];
  let remainder = [];
  for (let i = 0; i < a.length; i++) {
    remainder = trimLeadingZeros([...remainder, a[i]]);
    // Find the largest digit q such that b * q <= remainder.
    let q = 0;
    // Linear scan 0..9; digit arrays are small per position so this is fine.
    for (let cand = 9; cand >= 1; cand--) {
      const prod = mulDigits(b, [cand]);
      if (cmpDigits(prod, remainder) <= 0) {
        q = cand;
        remainder = subDigits(remainder, prod);
        break;
      }
    }
    quotient.push(q);
  }
  return { quotient: trimLeadingZeros(quotient), remainder: trimLeadingZeros(remainder) };
}

export class Decimal {
  constructor(sign, digits, scale) {
    this.sign = sign;
    this.digits = digits;
    this.scale = scale;
  }

  static fromString(str) {
    if (typeof str !== 'string') throw new Error('Input must be a string');
    if (str.length === 0) throw new Error('Empty string is not a number');

    let s = str;
    let sign = 1;
    if (s[0] === '-') {
      sign = -1;
      s = s.slice(1);
    } else if (s[0] === '+') {
      s = s.slice(1);
    }
    if (s.length === 0) throw new Error('No digits after sign');

    let dot = s.indexOf('.');
    if (dot === -1) dot = s.length;
    const intPart = s.slice(0, dot);
    const fracPart = dot === s.length ? '' : s.slice(dot + 1);

    const digitsStr = intPart + fracPart;
    if (digitsStr.length === 0) throw new Error('No digits');
    if (!/^[0-9]+$/.test(digitsStr)) throw new Error('Invalid digit sequence');

    let digits = digitsStr.split('').map(Number);
    digits = trimLeadingZeros(digits);
    const scale = fracPart.length;

    if (digits.length === 0) return new Decimal(0, [], 0);
    return new Decimal(sign, digits, scale);
  }

  static fromInteger(n) {
    if (!Number.isInteger(n)) throw new Error('fromInteger requires an integer');
    return Decimal.fromString(String(n));
  }

  toString() {
    if (this.sign === 0 || this.digits.length === 0) return '0';
    let d = this.digits;
    let scale = this.scale;
    // If scale >= digits.length, we need leading zeros in the output: 0.00...
    let out;
    if (scale === 0) {
      out = d.join('');
    } else if (scale >= d.length) {
      out = '0.' + '0'.repeat(scale - d.length) + d.join('');
    } else {
      const intLen = d.length - scale;
      out = d.slice(0, intLen).join('') + '.' + d.slice(intLen).join('');
    }
    return this.sign < 0 ? '-' + out : out;
  }

  isZero() {
    return this.sign === 0 || this.digits.length === 0;
  }

  negate() {
    if (this.isZero()) return this;
    return new Decimal(-this.sign, this.digits, this.scale);
  }

  abs() {
    if (this.isZero()) return this;
    return new Decimal(1, this.digits, this.scale);
  }

  cmp(other) {
    if (!(other instanceof Decimal)) throw new Error('cmp expects a Decimal');
    if (this.isZero() && other.isZero()) return 0;
    if (this.isZero()) return -other.sign;
    if (other.isZero()) return this.sign;
    if (this.sign !== other.sign) return this.sign < other.sign ? -1 : 1;

    // Same non-zero sign. Bring to a common scale by comparing digit arrays
    // as integers after scaling both up.
    const maxScale = Math.max(this.scale, other.scale);
    const a = this._integerScaled(maxScale);
    const b = other._integerScaled(maxScale);
    const c = cmpDigits(a, b);
    return this.sign < 0 ? -c : c;
  }

  // Return the digit array as if the number were an integer with `targetScale`
  // digits after the decimal point, i.e. multiply by 10^(targetScale - this.scale).
  _integerScaled(targetScale) {
    if (targetScale < this.scale) throw new Error('Cannot reduce scale in _integerScaled');
    const pad = targetScale - this.scale;
    return [...this.digits, ...new Array(pad).fill(0)];
  }

  add(other) {
    if (!(other instanceof Decimal)) throw new Error('add expects a Decimal');
    if (this.isZero()) return other;
    if (other.isZero()) return this;

    const maxScale = Math.max(this.scale, other.scale);
    const a = { sign: this.sign, digits: this._integerScaled(maxScale) };
    const b = { sign: other.sign, digits: other._integerScaled(maxScale) };

    if (a.sign === b.sign) {
      return new Decimal(a.sign, addDigits(a.digits, b.digits), maxScale);
    }
    // Different signs: subtract smaller magnitude from larger.
    const c = cmpDigits(a.digits, b.digits);
    if (c === 0) return new Decimal(0, [], 0);
    if (c > 0) {
      return new Decimal(a.sign, subDigits(a.digits, b.digits), maxScale);
    } else {
      return new Decimal(b.sign, subDigits(b.digits, a.digits), maxScale);
    }
  }

  sub(other) {
    if (!(other instanceof Decimal)) throw new Error('sub expects a Decimal');
    return this.add(other.negate());
  }

  mul(other) {
    if (!(other instanceof Decimal)) throw new Error('mul expects a Decimal');
    if (this.isZero() || other.isZero()) return new Decimal(0, [], 0);
    const sign = this.sign * other.sign;
    const digits = mulDigits(this.digits, other.digits);
    const scale = this.scale + other.scale;
    return new Decimal(sign, digits, scale);
  }

  /**
   * Divide this by other, to a fixed number of fractional digits.
   *
   * Rounding is ROUND_HALF_UP: if the digit discarded is 5 or more, round away
   * from zero. This is the rounding most jurisdictions expect for financial
   * totals and keeps results deterministic across platforms.
   *
   * We require an explicit `maxFractionalDigits` so the caller decides how
   * much precision to keep. A division like 1/3 would otherwise loop forever;
   * making precision explicit is the only honest answer.
   */
  div(other, maxFractionalDigits = 20) {
    if (!(other instanceof Decimal)) throw new Error('div expects a Decimal');
    if (other.isZero()) throw new Error('Division by zero');
    if (!Number.isInteger(maxFractionalDigits) || maxFractionalDigits < 0) {
      throw new Error('maxFractionalDigits must be a non-negative integer');
    }
    if (this.isZero()) return new Decimal(0, [], 0);

    const sign = this.sign * other.sign;

    // We want `maxFractionalDigits` fractional digits in the result.
    // dividendInt / divisorInt  = quotientInt, where
    //   dividendInt = this.digits * 10^(extraScale),
    //   divisorInt  = other.digits,
    //   extraScale  = maxFractionalDigits + other.scale - this.scale.
    // The resulting scale is maxFractionalDigits.
    let extraScale = maxFractionalDigits + other.scale - this.scale;

    let dividend;
    if (extraScale >= 0) {
      dividend = [...this.digits, ...new Array(extraScale).fill(0)];
    } else {
      // Need to drop digits; if the dropped part is nonzero the input was
      // more precise than the result can represent, which is caller error.
      // We still handle it by truncating.
      dividend = this.digits.slice(0, this.digits.length + extraScale);
      dividend = trimLeadingZeros(dividend);
    }
    const divisor = other.digits;

    let { quotient, remainder } = divmodDigits(dividend, divisor);

    // ROUND_HALF_UP: if remainder * 2 >= divisor, round up.
    if (remainder.length > 0) {
      const doubled = mulDigits(remainder, [2]);
      if (cmpDigits(doubled, divisor) >= 0) {
        quotient = addDigits(quotient, [1]);
      }
    }

    if (quotient.length === 0) return new Decimal(0, [], 0);
    return new Decimal(sign, quotient, maxFractionalDigits);
  }

  equals(other) {
    if (!(other instanceof Decimal)) throw new Error('equals expects a Decimal');
    return this.cmp(other) === 0;
  }
}
