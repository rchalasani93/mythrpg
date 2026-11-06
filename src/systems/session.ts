import { loadSave, writeSave, type SaveFile } from './save';
import { DIFFICULTY_DEFS } from '../data/difficulty';
import type { RunState } from './run';

/** The single source of truth for the save file while the game is open. */
class Session {
  save: SaveFile = loadSave();

  get run(): RunState | null {
    return this.save.run;
  }

  setRun(run: RunState | null): void {
    this.save.run = run;
    this.persist();
  }

  /** Saves the run at the start of a floor, unless the difficulty forbids mid-run saves. */
  checkpoint(): void {
    const run = this.save.run;
    if (run && !DIFFICULTY_DEFS[run.difficulty].midRunSave) {
      writeSave({ meta: this.save.meta, run: null });
      return;
    }
    this.persist();
  }

  persist(): void {
    writeSave(this.save);
  }

  addToCodex(id: string): void {
    if (!this.save.meta.codex.includes(id)) this.save.meta.codex.push(id);
  }
}

export const session = new Session();
