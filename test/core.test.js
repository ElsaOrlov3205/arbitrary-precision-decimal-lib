import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Decimal } from '../src/index.js';

test('fromString parses integer', () => {
  const d = Decimal.fromString('42');
  assert.equal(d.toString(), '42');
});

test('fromString parses negative decimal', () => {
  const d = Decimal.fromString('-1.25');
  assert.equal(d.toString(), '-1.25');
});

test('fromString strips leading zeros', () => {
  const d = Decimal.fromString('00012.3400');
  assert.equal(d.toString(), '12.3400');
});

test('fromString rejects empty', () => {
  assert.throws(() => Decimal.fromString(''), /Empty string/);
});

test('fromString rejects letters', () => {
  assert.throws(() => Decimal.fromString('1.2.3'), /Invalid digit sequence/);
});

test('fromString handles zero variants', () => {
  assert.equal(Decimal.fromString('0').toString(), '0');
  assert.equal(Decimal.fromString('0.00').toString(), '0');
  assert.equal(Decimal.fromString('-0').toString(), '0');
  assert.equal(Decimal.fromString('+5').toString(), '5');
});

test('add simple', () => {
  assert.equal(Decimal.fromString('1.50').add(Decimal.fromString('2.50')).toString(), '4.00');
});

test('add with differing scales', () => {
  assert.equal(Decimal.fromString('1.5').add(Decimal.fromString('2.25')).toString(), '3.75');
});

test('add cancellation to zero', () => {
  assert.equal(Decimal.fromString('1.5').add(Decimal.fromString('-1.5')).toString(), '0');
});

test('sub handles borrow across scales', () => {
  assert.equal(Decimal.fromString('1.00').sub(Decimal.fromString('0.99')).toString(), '0.01');
});

test('mul basic', () => {
  assert.equal(Decimal.fromString('1.5').mul(Decimal.fromString('2')).toString(), '3.0');
});

test('mul scale accumulates', () => {
  assert.equal(Decimal.fromString('0.1').mul(Decimal.fromString('0.1')).toString(), '0.01');
});

test('mul negative', () => {
  assert.equal(Decimal.fromString('-3').mul(Decimal.fromString('-2')).toString(), '6');
  assert.equal(Decimal.fromString('-3').mul(Decimal.fromString('2')).toString(), '-6');
});

test('div exact', () => {
  assert.equal(Decimal.fromString('10').div(Decimal.fromString('2'), 2).toString(), '5.00');
});

test('div rounds half up', () => {
  // 1 / 2 = 0.5, to 0 digits rounds to 1
  assert.equal(Decimal.fromString('1').div(Decimal.fromString('2'), 0).toString(), '1');
  // 1 / 4 = 0.25, to 1 digit -> 0.3 (round half up)
  assert.equal(Decimal.fromString('1').div(Decimal.fromString('4'), 1).toString(), '0.3');
  // 1 / 8 = 0.125, to 2 digits -> 0.13
  assert.equal(Decimal.fromString('1').div(Decimal.fromString('8'), 2).toString(), '0.13');
  // 1 / 3 = 0.3333..., to 4 digits -> 0.3333
  assert.equal(Decimal.fromString('1').div(Decimal.fromString('3'), 4).toString(), '0.3333');
});

test('div negative rounding', () => {
  // -1 / 4 to 1 digit: magnitude 0.25 rounds up to 0.3, sign negative
  assert.equal(Decimal.fromString('-1').div(Decimal.fromString('4'), 1).toString(), '-0.3');
});

test('div by zero throws', () => {
  assert.throws(() => Decimal.fromString('1').div(Decimal.fromString('0')), /Division by zero/);
});

test('cmp ordering', () => {
  assert.equal(Decimal.fromString('1.5').cmp(Decimal.fromString('1.50')), 0);
  assert.equal(Decimal.fromString('1.5').cmp(Decimal.fromString('1.6')), -1);
  assert.equal(Decimal.fromString('2').cmp(Decimal.fromString('1.9')), 1);
  assert.equal(Decimal.fromString('-1').cmp(Decimal.fromString('1')), -1);
  assert.equal(Decimal.fromString('0').cmp(Decimal.fromString('-0')), 0);
});

test('equals', () => {
  assert.ok(Decimal.fromString('1.00').equals(Decimal.fromString('1')));
  assert.ok(!Decimal.fromString('1.00').equals(Decimal.fromString('1.01')));
});

test('negate and abs', () => {
  assert.equal(Decimal.fromString('-5.0').negate().toString(), '5.0');
  assert.equal(Decimal.fromString('5.0').negate().toString(), '-5.0');
  assert.equal(Decimal.fromString('-5.0').abs().toString(), '5.0');
  assert.equal(Decimal.fromString('0').negate().toString(), '0');
});
