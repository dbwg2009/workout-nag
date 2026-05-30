import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkout, isQuestion, isWorkoutReport } from '../src/core/workoutlog';

test('parses sets x reps', () => {
  const r = parseWorkout('4x12 press-ups and 3x8 pull-ups');
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { exercise: 'press-ups', sets: 4, reps: 12 });
  assert.deepEqual(r[1], { exercise: 'pull-ups', sets: 3, reps: 8 });
});

test('parses durations', () => {
  const r = parseWorkout('60s plank, 45 sec hollow hold');
  assert.ok(r.some((e) => e.exercise.includes('plank') && e.seconds === 60));
  assert.ok(r.some((e) => e.seconds === 45));
});

test('strips a leading LOG', () => {
  const r = parseWorkout('LOG 5x10 squats');
  assert.deepEqual(r[0], { exercise: 'squats', sets: 5, reps: 10 });
});

test('isQuestion detects questions', () => {
  assert.equal(isQuestion('should I do 4x12 press-ups?'), true);
  assert.equal(isQuestion('how many sets'), true);
  assert.equal(isQuestion('did 4x12 press-ups'), false);
});

test('isWorkoutReport: statement with sets logs, question does not', () => {
  assert.equal(isWorkoutReport('did 4x12 press-ups', parseWorkout('did 4x12 press-ups')), true);
  assert.equal(
    isWorkoutReport('should I do 4x12 press-ups?', parseWorkout('should I do 4x12 press-ups?')),
    false
  );
  assert.equal(isWorkoutReport('how are you', parseWorkout('how are you')), false);
});
