import { describe, expect, it } from 'vitest';
import { allTopicIds, generate, mockExam, TOPICS } from '../learning/questions';
import { roundTo } from '../calculations/core';

describe('practice questions — independently checked answer keys', () => {
  it('every listed topic has templates', () => {
    for (const t of TOPICS) expect(allTopicIds()).toContain(t.id);
  });
  for (const topic of allTopicIds()) {
    it(`${topic}: 300 random questions match the engine and are well-formed`, () => {
      for (let seed = 1; seed <= 300; seed++) {
        const q = generate(topic, seed * 7919);
        expect(Number.isFinite(q.correct), q.prompt).toBe(true);
        expect(roundTo(q.engine, q.dp), q.prompt).toBe(roundTo(q.correct, q.dp));
        expect(q.choices.length).toBe(4);
        expect(new Set(q.choices).size).toBe(4);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.explanation.length).toBeGreaterThan(0);
        expect(q.prompt).not.toMatch(/NaN|undefined|Infinity/);
        expect(q.choices.join(' ')).not.toMatch(/NaN|undefined|Infinity/);
      }
    });
  }
  it('is deterministic per seed', () => {
    expect(generate('iv', 42)).toEqual(generate('iv', 42));
  });
  it('mock exam has 20 questions across topics', () => {
    const m = mockExam(123);
    expect(m.length).toBe(20);
    expect(new Set(m.map((q) => q.topic)).size).toBe(allTopicIds().length);
  });
});
