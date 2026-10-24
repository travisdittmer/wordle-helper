import type { Tile } from './feedback';

/** The guess + tiles being entered in the feedback editor. */
export type Draft = {
  guess: string;
  tiles: Tile[];
  /** True once the user types or taps; solver suggestions then stop replacing the draft. */
  edited: boolean;
};

export type DraftAction =
  | { type: 'suggest'; guess: string }
  | { type: 'edit-guess'; guess: string }
  | { type: 'edit-tiles'; tiles: Tile[] }
  /** Feedback applied, undone or reset: clear the editor so the next suggestion fills it. */
  | { type: 'board-changed' };

const BLANK_TILES: Tile[] = ['B', 'B', 'B', 'B', 'B'];

export const initialDraft: Draft = { guess: '', tiles: BLANK_TILES, edited: false };

export function draftReducer(draft: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'suggest':
      return draft.edited ? draft : { guess: action.guess, tiles: BLANK_TILES, edited: false };
    case 'edit-guess':
      return { ...draft, guess: action.guess, edited: true };
    case 'edit-tiles':
      return { ...draft, tiles: action.tiles, edited: true };
    case 'board-changed':
      return initialDraft;
  }
}
