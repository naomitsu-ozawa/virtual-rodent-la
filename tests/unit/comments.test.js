import { describe, it, expect, beforeEach } from 'vitest';
import {
  createComment, sanitizeComments, commentMatchesSeries, commentTarget, commentVoxel,
  addComment, removeComment, getComments, setComments, onCommentsChange, commentsForProject, COMMENT_MAX_TEXT,
  mergeComments, loadProjectComments, markCommentsSaved, hasUnsavedComments, resetCommentsSaved, restoreComment,
} from '../../docs/comments.js';
import { datasetFingerprint, packProject, unpackProject } from '../../docs/project-file.js';

const mk = (uid, extra = {}) => ({ id: 's::' + uid, description: 'Mouse CT', modality: 'CT', columns: 16, rows: 16, spacingX: 0.1, spacingY: 0.1, spacingZ: 0.2, slices: Array.from({ length: 12 }, (_, i) => (i ? {} : { studyUid: 's', seriesUid: uid })), ...extra });
const fpA = datasetFingerprint(mk('1')), fpB = datasetFingerprint(mk('2'));

beforeEach(() => { setComments([]); resetCommentsSaved(); });

describe('create / save / restore a position', () => {
  it('keeps text, time, voxel position and the series', () => {
    const c = createComment({ text: 'nodule', position: { i: 3, j: 5, k: 4 }, series: fpA, now: Date.UTC(2026, 9, 5) });
    expect(c).toMatchObject({ text: 'nodule', position: { i: 3, j: 5, k: 4 }, createdAt: '2026-10-05T00:00:00.000Z', series: fpA });
    expect(typeof c.id).toBe('string');
  });
  it('rejects a missing / non-numeric position', () => {
    for (const p of [null, undefined, {}, { i: 1, j: 2 }, { i: 'a', j: 1, k: 1 }, { i: null, j: 1, k: 1 }]) expect(createComment({ text: 'x', position: p, series: fpA })).toBeNull();
    expect(commentVoxel({ i: 1.4, j: '2', k: 3 })).toEqual({ i: 1, j: 2, k: 3 });
  });
  it('limits the text length', () => {
    expect(createComment({ text: 'a'.repeat(COMMENT_MAX_TEXT + 50), position: { i: 0, j: 0, k: 0 }, series: fpA }).text).toHaveLength(COMMENT_MAX_TEXT);
  });
  it('round-trips through the project file (zip + JSON)', () => {
    addComment(createComment({ text: 'a', position: { i: 3, j: 5, k: 4 }, series: fpA, id: 'c1' }));
    addComment(createComment({ text: 'b', position: { i: 0, j: 15, k: 11 }, series: fpB, id: 'c2' }));
    const saved = commentsForProject(fpA);
    expect(saved.map(c => c.id)).toEqual(['c1']); // only the series being saved
    const { project } = unpackProject(packProject({ dataset: fpA, comments: saved }));
    setComments(project.comments);
    expect(getComments()).toEqual(saved);
    expect(getComments()[0].position).toEqual({ i: 3, j: 5, k: 4 });
  });
  it('sanitizeComments drops broken entries and fixes duplicate ids', () => {
    const out = sanitizeComments([{ id: 'x', position: { i: 1, j: 1, k: 1 } }, { id: 'x', text: 'y', position: { i: 2, j: 2, k: 2 } }, { position: { i: 'q' } }, null, 'str']);
    expect(out.map(c => c.position.i)).toEqual([1, 2]);
    expect(new Set(out.map(c => c.id)).size).toBe(2);
    expect(sanitizeComments('nope')).toEqual([]);
  });
});

describe('series match decides whether "view this place" is available', () => {
  const c = createComment({ text: 't', position: { i: 1, j: 1, k: 1 }, series: fpA });
  it('same series: enabled', () => expect(commentMatchesSeries(c, datasetFingerprint(mk('1')))).toBe(true));
  it('other series uid: disabled', () => expect(commentMatchesSeries(c, fpB)).toBe(false));
  it('other size: disabled', () => expect(commentMatchesSeries(c, datasetFingerprint(mk('1', { columns: 8 })))).toBe(false));
  it('no series on the comment or no open series: disabled', () => {
    expect(commentMatchesSeries({ ...c, series: null }, fpA)).toBe(false);
    expect(commentMatchesSeries(c, null)).toBe(false);
  });
});

describe('target position is clamped into the volume', () => {
  const dims = { columns: 16, rows: 16, slices: 12 };
  it('inside: unchanged', () => expect(commentTarget({ position: { i: 3, j: 5, k: 4 } }, dims)).toEqual({ i: 3, j: 5, k: 4 }));
  it('outside: clamped, not rejected', () => expect(commentTarget({ position: { i: 99, j: -4, k: 12 } }, dims)).toEqual({ i: 15, j: 0, k: 11 }));
  it('no volume: null', () => expect(commentTarget({ position: { i: 1, j: 1, k: 1 } }, null)).toBeNull());
});

describe('store', () => {
  it('add / remove notify listeners and getComments returns copies', () => {
    let n = 0; const off = onCommentsChange(() => n++);
    const c = addComment(createComment({ text: 'a', position: { i: 1, j: 2, k: 3 }, series: fpA }));
    getComments()[0].position.i = 99;
    expect(getComments()[0].position.i).toBe(1);
    expect(removeComment(c.id)).toBe(true); expect(removeComment(c.id)).toBe(false);
    expect(n).toBe(2); off();
  });
});

describe('loading a project merges, it never drops comments in memory', () => {
  const mkc = (id, series, text = id) => createComment({ id, text, position: { i: 1, j: 2, k: 3 }, series });
  it('keeps an unsaved comment of the same series and one of another series', () => {
    addComment(mkc('c1', fpA)); addComment(mkc('c2', fpA)); addComment(mkc('b1', fpB));
    loadProjectComments([mkc('c1', fpA)], fpA);
    expect(getComments().map(c => c.id).sort()).toEqual(['b1', 'c1', 'c2']);
  });
  it('adds what only the file has; a comment deleted since the save comes back (no data lost)', () => {
    addComment(mkc('c2', fpA));
    loadProjectComments([mkc('c1', fpA), mkc('c2', fpA)], fpA);
    expect(getComments().map(c => c.id).sort()).toEqual(['c1', 'c2']);
    expect(mergeComments([], [mkc('x', fpA)], fpA).map(c => c.id)).toEqual(['x']);
  });
  it('an incoming id used by a comment of another series gets a new id', () => {
    addComment(mkc('dup', fpB, 'mine on B'));
    loadProjectComments([mkc('dup', fpA, 'from file')], fpA);
    const l = getComments();
    expect(l).toHaveLength(2);
    expect(l.find(c => c.text === 'mine on B').id).toBe('dup');
    expect(l.find(c => c.text === 'from file').id).not.toBe('dup');
  });
});

describe('unsaved comment changes', () => {
  const mkc = (id, series) => createComment({ id, text: id, position: { i: 1, j: 1, k: 1 }, series });
  it('clean at start; add / delete make it dirty; save or load makes it clean', () => {
    expect(hasUnsavedComments()).toBe(false);
    addComment(mkc('c1', fpA)); expect(hasUnsavedComments()).toBe(true);
    markCommentsSaved(fpA); expect(hasUnsavedComments()).toBe(false);
    const c = getComments()[0]; removeComment('c1'); expect(hasUnsavedComments()).toBe(true);
    restoreComment(c, 0); expect(hasUnsavedComments()).toBe(false); // undo: back to what was saved
    removeComment('c1'); markCommentsSaved(fpA); expect(hasUnsavedComments()).toBe(false);
  });
  it('a comment of another series is never saved with this project: stays unsaved', () => {
    addComment(mkc('b1', fpB)); markCommentsSaved(fpA); expect(hasUnsavedComments()).toBe(true);
  });
  it('after loading, comments only in memory still count as unsaved', () => {
    addComment(mkc('c2', fpA)); loadProjectComments([mkc('c1', fpA)], fpA);
    expect(hasUnsavedComments()).toBe(true);
  });
  it('restoreComment puts the comment back at its place and refuses a duplicate', () => {
    addComment(mkc('a', fpA)); addComment(mkc('b', fpA)); addComment(mkc('c', fpA));
    const b = getComments()[1]; removeComment('b');
    expect(restoreComment(b, 1)).toBe(true);
    expect(getComments().map(c => c.id)).toEqual(['a', 'b', 'c']);
    expect(restoreComment(b, 1)).toBe(false);
  });
});
