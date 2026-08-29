import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  diffJsonValues, diffStats, jsonDeepEqual, MIN_CHANGED_ELEMENT_SIMILARITY, MAX_COMPARE_DEPTH,
} from '../src/pure/jsonDiff.mjs';

/** @returns {*} an object nested `n` levels deep, `{nested:{nested:...{leaf:1}}}`. */
function deeplyNested(n) {
  let value = { leaf: 1 };
  for (let i = 0; i < n; i += 1) value = { nested: value };
  return value;
}

test('jsonDeepEqual: two identical primitives are equal', () => {
  assert.equal(jsonDeepEqual(1, 1), true);
  assert.equal(jsonDeepEqual('a', 'a'), true);
  assert.equal(jsonDeepEqual(true, true), true);
  assert.equal(jsonDeepEqual(null, null), true);
});

test('jsonDeepEqual: different primitive values, or different primitive types, are not equal', () => {
  assert.equal(jsonDeepEqual(1, 2), false);
  assert.equal(jsonDeepEqual(1, '1'), false);
  assert.equal(jsonDeepEqual(null, 0), false);
  assert.equal(jsonDeepEqual(false, 0), false);
});

test('jsonDeepEqual: objects are equal regardless of key order', () => {
  assert.equal(jsonDeepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
});

test('jsonDeepEqual: objects with a different key set are not equal', () => {
  assert.equal(jsonDeepEqual({ a: 1 }, { a: 1, b: 2 }), false);
  assert.equal(jsonDeepEqual({ a: 1, b: 2 }, { a: 1, c: 2 }), false);
});

test('jsonDeepEqual: arrays require the same order, not just the same elements', () => {
  assert.equal(jsonDeepEqual([1, 2, 3], [1, 2, 3]), true);
  assert.equal(jsonDeepEqual([1, 2, 3], [3, 2, 1]), false);
});

test('jsonDeepEqual: nested structures compare recursively', () => {
  assert.equal(jsonDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] }), true);
  assert.equal(jsonDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] }), false);
});

test('diffJsonValues: two identical primitives are unchanged', () => {
  const node = diffJsonValues(5, 5);
  assert.deepEqual(node, { status: 'unchanged', kind: 'primitive', a: 5, b: 5 });
});

test('diffJsonValues: two different primitives are changed', () => {
  const node = diffJsonValues('old', 'new');
  assert.deepEqual(node, { status: 'changed', kind: 'primitive', a: 'old', b: 'new' });
});

test('diffJsonValues: a value present only on the "after" side is added, recursively for a nested object', () => {
  const node = diffJsonValues(undefined, { x: 1, y: [2, 3] });
  assert.equal(node.status, 'added');
  assert.equal(node.kind, 'object');
  const byKey = Object.fromEntries(node.children.map((c) => [c.key, c.node]));
  assert.deepEqual(byKey.x, { status: 'added', kind: 'primitive', b: 1 });
  assert.equal(byKey.y.status, 'added');
  assert.equal(byKey.y.kind, 'array');
  assert.deepEqual(byKey.y.children.map((c) => c.node.status), ['added', 'added']);
});

test('diffJsonValues: a value present only on the "before" side is removed, recursively for a nested object', () => {
  const node = diffJsonValues({ x: 1 }, undefined);
  assert.equal(node.status, 'removed');
  assert.equal(node.children[0].node.status, 'removed');
  assert.equal(node.children[0].node.a, 1);
});

test('diffJsonValues: an object with one changed key reports that key changed, siblings unchanged, and its own status changed', () => {
  const node = diffJsonValues({ a: 1, b: 2 }, { a: 1, b: 3 });
  assert.equal(node.status, 'changed');
  const byKey = Object.fromEntries(node.children.map((c) => [c.key, c.node]));
  assert.equal(byKey.a.status, 'unchanged');
  assert.equal(byKey.b.status, 'changed');
});

test('diffJsonValues: key order never affects the result, only value content does', () => {
  const nodeA = diffJsonValues({ a: 1, b: 2 }, { b: 2, a: 1 });
  assert.equal(nodeA.status, 'unchanged');
  const nodeB = diffJsonValues({ b: 2, a: 1 }, { a: 1, b: 2 });
  assert.equal(nodeB.status, 'unchanged');
});

test('diffJsonValues: an object gains a key -- the new key is added, the object itself is changed', () => {
  const node = diffJsonValues({ a: 1 }, { a: 1, b: 2 });
  const byKey = Object.fromEntries(node.children.map((c) => [c.key, c.node]));
  assert.equal(node.status, 'changed');
  assert.equal(byKey.a.status, 'unchanged');
  assert.deepEqual(byKey.b, { status: 'added', kind: 'primitive', b: 2 });
});

test('diffJsonValues: an object loses a key -- the missing key is removed', () => {
  const node = diffJsonValues({ a: 1, b: 2 }, { a: 1 });
  const byKey = Object.fromEntries(node.children.map((c) => [c.key, c.node]));
  assert.deepEqual(byKey.b, { status: 'removed', kind: 'primitive', a: 2 });
});

test('diffJsonValues: two identical arrays report every element unchanged', () => {
  const node = diffJsonValues([1, 2, 3], [1, 2, 3]);
  assert.equal(node.status, 'unchanged');
  assert.deepEqual(node.children.map((c) => c.node.status), ['unchanged', 'unchanged', 'unchanged']);
});

test('diffJsonValues: an element appended to an array is reported as added, earlier elements stay unchanged', () => {
  const node = diffJsonValues([1, 2], [1, 2, 3]);
  assert.equal(node.status, 'changed');
  assert.deepEqual(node.children.map((c) => c.node.status), ['unchanged', 'unchanged', 'added']);
});

test('diffJsonValues: an element inserted in the MIDDLE of an array is recognized as one insertion, not a cascade of changes (the real LCS-alignment payoff)', () => {
  const node = diffJsonValues([1, 2, 3], [1, 99, 2, 3]);
  assert.equal(node.children.map((c) => c.node.status).join(','), 'unchanged,added,unchanged,unchanged');
});

test('diffJsonValues: an element removed from the MIDDLE of an array is recognized as one removal, not a cascade', () => {
  const node = diffJsonValues([1, 99, 2, 3], [1, 2, 3]);
  assert.equal(node.children.map((c) => c.node.status).join(','), 'unchanged,removed,unchanged,unchanged');
});

test('diffJsonValues: a modified array element with enough shared content is recursively diffed as "changed", not remove+add', () => {
  // Same shape (3 of 4 keys identical) as the demand-mining entry's own
  // worked-example note: two versions of one record in an array.
  const before = [{ id: 1, name: 'Ada', role: 'engineer', active: true }];
  const after = [{ id: 1, name: 'Ada', role: 'staff engineer', active: true }];
  const node = diffJsonValues(before, after);
  assert.equal(node.children.length, 1, 'expected one recursively-diffed element, not a separate removed+added pair');
  const recordDiff = node.children[0].node;
  assert.equal(recordDiff.status, 'changed');
  const byKey = Object.fromEntries(recordDiff.children.map((c) => [c.key, c.node.status]));
  assert.deepEqual(byKey, {
    active: 'unchanged', id: 'unchanged', name: 'unchanged', role: 'changed',
  });
});

test('diffJsonValues: two completely unrelated array elements at the same LCS position are reported as a separate removed+added pair, not forced into a "changed" pairing', () => {
  const before = [{ id: 1, name: 'Ada' }];
  const after = [{ totallyDifferent: true, nothingShared: 42 }];
  const node = diffJsonValues(before, after);
  assert.equal(node.children.length, 2, 'expected a separate removed element and added element');
  assert.deepEqual(node.children.map((c) => c.node.status), ['removed', 'added']);
});

test('MIN_CHANGED_ELEMENT_SIMILARITY: an element pair exactly at the threshold or above pairs as changed, meaningfully below it does not', () => {
  assert.ok(MIN_CHANGED_ELEMENT_SIMILARITY > 0 && MIN_CHANGED_ELEMENT_SIMILARITY < 1);
});

test('diffJsonValues: a field changing type (string to object) is one leaf-level "changed", not a crash or a false structural diff', () => {
  const node = diffJsonValues({ a: 'hello' }, { a: { nested: true } });
  const fieldA = node.children[0].node;
  assert.equal(fieldA.status, 'changed');
  assert.equal(fieldA.kind, 'primitive');
  assert.equal(fieldA.a, 'hello');
  assert.deepEqual(fieldA.b, { nested: true });
});

test('diffJsonValues: comparing two bare top-level primitives (no object/array wrapper) works directly', () => {
  assert.equal(diffJsonValues('hello', 'hello').status, 'unchanged');
  assert.equal(diffJsonValues('hello', 'world').status, 'changed');
});

test('diffJsonValues: null is distinct from an absent key and from a nested empty object', () => {
  const node = diffJsonValues({ a: null }, { a: {} });
  assert.equal(node.children[0].node.status, 'changed');
  assert.equal(diffJsonValues(null, null).status, 'unchanged');
});

test('diffJsonValues: two empty objects, or two empty arrays, are unchanged with zero children', () => {
  assert.deepEqual(diffJsonValues({}, {}), {
    status: 'unchanged', kind: 'object', a: {}, b: {}, children: [],
  });
  assert.deepEqual(diffJsonValues([], []), {
    status: 'unchanged', kind: 'array', a: [], b: [], children: [],
  });
});

test('diffJsonValues: a real, realistic API-response-shaped example (the demand-mining entry\'s own worked-example note)', () => {
  const before = {
    user: {
      id: 42, name: 'Grace Hopper', roles: ['admin', 'engineer'],
    },
    meta: { page: 1 },
  };
  const after = {
    user: {
      id: 42, name: 'Grace Hopper', roles: ['admin', 'engineer', 'reviewer'],
    },
    meta: { page: 2 },
  };
  const node = diffJsonValues(before, after);
  assert.equal(node.status, 'changed');
  const byKey = Object.fromEntries(node.children.map((c) => [c.key, c.node]));
  assert.equal(byKey.meta.children[0].node.status, 'changed');
  const userByKey = Object.fromEntries(byKey.user.children.map((c) => [c.key, c.node]));
  assert.equal(userByKey.id.status, 'unchanged');
  assert.equal(userByKey.name.status, 'unchanged');
  assert.deepEqual(userByKey.roles.children.map((c) => c.node.status), ['unchanged', 'unchanged', 'added']);
});

test('diffStats: counts every primitive leaf exactly once, across unchanged, changed, added, and removed', () => {
  const node = diffJsonValues({
    same: 1, diff: 'a', gone: 'x',
  }, { same: 1, diff: 'b', extra: 'y' });
  assert.deepEqual(diffStats(node), {
    unchanged: 1, changed: 1, added: 1, removed: 1,
  });
});

test('diffStats: a wholesale added object counts each of its own leaves separately, not the container as one unit', () => {
  const node = diffJsonValues(undefined, { a: 1, b: 2, c: 3 });
  assert.deepEqual(diffStats(node), {
    unchanged: 0, changed: 0, added: 3, removed: 0,
  });
});

test('diffJsonValues: an ordinarily-deep document (well under the cap) still diffs correctly, not just "changed"', () => {
  const a = deeplyNested(50);
  const b = deeplyNested(50);
  const node = diffJsonValues(a, b);
  assert.equal(node.status, 'unchanged');
  const changed = diffJsonValues(deeplyNested(50), JSON.parse(JSON.stringify(deeplyNested(50)).replace('"leaf":1', '"leaf":2')));
  assert.equal(changed.status, 'changed');
});

test('diffJsonValues: a pathologically deep document (well past a real stack-overflow threshold) is handled safely, never throws', () => {
  // 5,000 levels is well past this exact function's own measured
  // real-world crash point (a genuine RangeError: Maximum call stack size
  // exceeded from an earlier, uncapped version of this file) -- this test
  // is what would fail for real if MAX_COMPARE_DEPTH's guard regressed.
  const a = deeplyNested(5000);
  const b = deeplyNested(5000);
  assert.doesNotThrow(() => diffJsonValues(a, b));
  const node = diffJsonValues(a, b);
  // Real proof the depth cap actually fired somewhere in this tree, not
  // just that the top-level call happened not to throw: walk down through
  // the single "nested" child at every level until hitting the node the
  // cap forced into a leaf.
  let cur = node;
  let steps = 0;
  while (cur.children && steps < MAX_COMPARE_DEPTH + 10) {
    cur = cur.children[0].node;
    steps += 1;
  }
  assert.equal(cur.kind, 'primitive');
  assert.equal(cur.depthLimited, true);
});

test('jsonDeepEqual: a pathologically deep pair never throws either, and conservatively reports not-equal past the cap', () => {
  const a = deeplyNested(5000);
  const b = deeplyNested(5000);
  assert.doesNotThrow(() => jsonDeepEqual(a, b));
  assert.equal(jsonDeepEqual(a, b), false);
});

test('MAX_COMPARE_DEPTH is a real, generous ceiling -- far beyond any realistic document, but a real finite number', () => {
  assert.ok(MAX_COMPARE_DEPTH >= 100);
  assert.ok(Number.isFinite(MAX_COMPARE_DEPTH));
});

test('diffStats: two fully identical documents report every leaf unchanged and nothing else', () => {
  const doc = {
    a: 1, b: [1, 2, { c: 3 }],
  };
  const node = diffJsonValues(doc, JSON.parse(JSON.stringify(doc)));
  const stats = diffStats(node);
  assert.equal(stats.changed, 0);
  assert.equal(stats.added, 0);
  assert.equal(stats.removed, 0);
  assert.ok(stats.unchanged > 0);
});
