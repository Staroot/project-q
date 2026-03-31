import './styles.css';

type Lane = 0 | 1 | 2 | 3;
type Judgment = 'Perfect' | 'Good' | 'Miss';
type Scene = 'start' | 'playing' | 'paused' | 'result';

interface ChartNote {
  lane: Lane;
  time: number;
  hit?: boolean;
}

interface Chart {
  id: string;
  title: string;
  artist: string;
  bpm: number;
  offset: number;
  previewText: string;
  notes: ChartNote[];
  duration: number;
}

interface HitWindow {
  perfect: number;
  good: number;
}

interface JudgmentCounts {
  Perfect: number;
  Good: number;
  Miss: number;
}

interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  health: number;
  counts: JudgmentCounts;
  totalHitErrorMs: number;
  attempted: number;
  lastJudgment: Judgment | null;
}

const LANES = 4;
const KEYMAP: Record<string, Lane> = {
  d: 0,
  f: 1,
  j: 2,
  k: 3
};

const LANE_COLORS = ['#57b5ff', '#4ef2cd', '#ffd166', '#ff7fb0'];
const HIT_WINDOW: HitWindow = { perfect: 50, good: 110 };

const demoChart: Chart = {
  id: 'demo-001',
  title: 'Pulse Training Pattern',
  artist: 'Generated Tone Track',
  bpm: 120,
  offset: 1.0,
  previewText: 'Simple, evenly spaced notes for timing practice.',
  duration: 34,
  notes: buildDemoNotes()
};

function buildDemoNotes(): ChartNote[] {
  const notes: ChartNote[] = [];
  const beat = 60 / 120;
  const start = 2;
  const measures = 16;
  for (let m = 0; m < measures; m += 1) {
    const t = start + m * beat * 2;
    notes.push({ lane: (m % 4) as Lane, time: t });
    notes.push({ lane: ((m + 1) % 4) as Lane, time: t + beat });

    if (m % 2 === 0) {
      notes.push({ lane: 1, time: t + beat * 1.5 });
    }
    if (m % 4 === 3) {
      notes.push({ lane: 2, time: t + beat * 0.5 });
      notes.push({ lane: 3, time: t + beat * 0.5 });
    }
  }
  return notes.sort((a, b) => a.time - b.time);
}

class PulseAudioTrack {
  private context: AudioContext | null = null;
  private startAtCtxTime = 0;
  private startOffsetSec = 0;
  private lookaheadId: number | null = null;

  start(offset = 0): Promise<void> {
    return this.ensureContext().then(() => {
      if (!this.context) return;
      this.stop();
      this.startOffsetSec = Math.max(0, offset);
      this.startAtCtxTime = this.context.currentTime - this.startOffsetSec;
      this.lookaheadId = window.setInterval(() => this.scheduleTicks(), 100);
    });
  }

  pause(currentSongTime: number): void {
    this.stop();
    this.startOffsetSec = currentSongTime;
  }

  resume(): Promise<void> {
    return this.start(this.startOffsetSec);
  }

  seek(time: number): void {
    this.startOffsetSec = Math.max(0, time);
    if (this.lookaheadId !== null) {
      this.start(this.startOffsetSec);
    }
  }

  getSongTime(): number {
    if (!this.context) return this.startOffsetSec;
    if (this.lookaheadId === null) return this.startOffsetSec;
    return this.context.currentTime - this.startAtCtxTime;
  }

  stop(): void {
    if (this.lookaheadId !== null) {
      window.clearInterval(this.lookaheadId);
      this.lookaheadId = null;
    }
  }

  private async ensureContext(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  private scheduleTicks(): void {
    if (!this.context || this.lookaheadId === null) return;
    const nowSong = this.getSongTime();
    const horizon = nowSong + 0.2;
    const beat = 60 / demoChart.bpm;

    const startBeatIndex = Math.floor(nowSong / beat);
    const endBeatIndex = Math.floor(horizon / beat);
    for (let i = startBeatIndex; i <= endBeatIndex; i += 1) {
      const tickAt = i * beat;
      if (tickAt < nowSong || tickAt < 0) continue;
      if (Math.abs((nowSong % beat) - (tickAt % beat)) < 0.01) continue;
      this.playTick(tickAt);
    }
  }

  private playTick(songTime: number): void {
    if (!this.context) return;
    const when = this.startAtCtxTime + songTime;
    if (when <= this.context.currentTime) return;

    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'square';
    osc.frequency.value = Math.round(songTime / (60 / demoChart.bpm)) % 4 === 0 ? 880 : 550;

    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(0.08, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);

    osc.connect(gain).connect(this.context.destination);
    osc.start(when);
    osc.stop(when + 0.09);
  }
}

class RhythmGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly ui: {
    scene: HTMLElement;
    score: HTMLElement;
    combo: HTMLElement;
    acc: HTMLElement;
    health: HTMLElement;
    last: HTMLElement;
    info: HTMLElement;
    actions: HTMLElement;
  };

  private scene: Scene = 'start';
  private chart: Chart = demoChart;
  private state: ScoreState = this.makeFreshState();
  private songTime = 0;
  private noteSpeed = 320;
  private travelDistance = 420;
  private startLead = this.travelDistance / this.noteSpeed;
  private activeKeys = new Set<Lane>();
  private audio = new PulseAudioTrack();
  private raf = 0;

  constructor(root: HTMLElement) {
    root.innerHTML = `
      <div class="game-root">
        <div class="canvas-wrap"><canvas id="game-canvas" width="700" height="760"></canvas></div>
        <aside class="panel">
          <h1>Project Q</h1>
          <div id="scene-copy"></div>
          <div class="meta-row"><span>Score</span><span class="value" id="score">0</span></div>
          <div class="meta-row"><span>Combo</span><span class="value" id="combo">0</span></div>
          <div class="meta-row"><span>Accuracy</span><span class="value" id="acc">100.00%</span></div>
          <div class="meta-row"><span>Health</span><span class="value" id="health">100</span></div>
          <div class="meta-row"><span>Last</span><span class="value" id="last">-</span></div>
          <p id="song-info"></p>
          <div id="actions"></div>
          <p class="footer-note">Keys: <span class="kbd">D</span><span class="kbd">F</span><span class="kbd">J</span><span class="kbd">K</span></p>
        </aside>
      </div>`;

    this.canvas = root.querySelector('#game-canvas') as HTMLCanvasElement;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;

    this.ui = {
      scene: root.querySelector('#scene-copy') as HTMLElement,
      score: root.querySelector('#score') as HTMLElement,
      combo: root.querySelector('#combo') as HTMLElement,
      acc: root.querySelector('#acc') as HTMLElement,
      health: root.querySelector('#health') as HTMLElement,
      last: root.querySelector('#last') as HTMLElement,
      info: root.querySelector('#song-info') as HTMLElement,
      actions: root.querySelector('#actions') as HTMLElement
    };

    this.bindKeys();
    this.renderUi();
    this.loop();
  }

  private makeFreshState(): ScoreState {
    return {
      score: 0,
      combo: 0,
      maxCombo: 0,
      health: 100,
      counts: { Perfect: 0, Good: 0, Miss: 0 },
      totalHitErrorMs: 0,
      attempted: 0,
      lastJudgment: null
    };
  }

  private bindKeys(): void {
    window.addEventListener('keydown', (ev) => {
      if (ev.repeat) return;
      const key = ev.key.toLowerCase();

      if (key === 'enter' && this.scene === 'start') {
        void this.startGame();
        return;
      }

      if (key === 'escape' && (this.scene === 'playing' || this.scene === 'paused')) {
        if (this.scene === 'playing') {
          this.pauseGame();
        } else {
          void this.resumeGame();
        }
        return;
      }

      if (key === 'r' && (this.scene === 'playing' || this.scene === 'paused' || this.scene === 'result')) {
        void this.startGame();
        return;
      }

      if (this.scene !== 'playing') return;
      const lane = KEYMAP[key];
      if (lane === undefined) return;
      this.activeKeys.add(lane);
      this.hitLane(lane);
    });

    window.addEventListener('keyup', (ev) => {
      const lane = KEYMAP[ev.key.toLowerCase()];
      if (lane !== undefined) this.activeKeys.delete(lane);
    });
  }

  private async startGame(): Promise<void> {
    this.chart.notes.forEach((n) => delete n.hit);
    this.state = this.makeFreshState();
    this.songTime = 0;
    this.scene = 'playing';
    await this.audio.start(0);
    this.renderUi();
  }

  private pauseGame(): void {
    this.songTime = this.audio.getSongTime();
    this.audio.pause(this.songTime);
    this.scene = 'paused';
    this.renderUi();
  }

  private async resumeGame(): Promise<void> {
    if (this.scene !== 'paused') return;
    this.scene = 'playing';
    await this.audio.resume();
    this.renderUi();
  }

  private endGame(): void {
    this.audio.stop();
    this.scene = 'result';
    this.renderUi();
  }

  private hitLane(lane: Lane): void {
    const hitTime = this.audio.getSongTime();
    const target = this.chart.notes.find((n) => !n.hit && n.lane === lane && Math.abs((n.time - hitTime) * 1000) <= HIT_WINDOW.good);

    if (!target) {
      this.applyJudgment('Miss', null);
      return;
    }

    const errMs = Math.abs((target.time - hitTime) * 1000);
    target.hit = true;

    if (errMs <= HIT_WINDOW.perfect) {
      this.applyJudgment('Perfect', errMs);
    } else {
      this.applyJudgment('Good', errMs);
    }
  }

  private applyJudgment(judgment: Judgment, errMs: number | null): void {
    this.state.lastJudgment = judgment;
    this.state.counts[judgment] += 1;
    this.state.attempted += 1;

    if (judgment === 'Perfect') {
      this.state.score += 1000 + this.state.combo * 2;
      this.state.combo += 1;
      this.state.health = Math.min(100, this.state.health + 1.2);
      if (errMs !== null) this.state.totalHitErrorMs += errMs;
    } else if (judgment === 'Good') {
      this.state.score += 600 + this.state.combo;
      this.state.combo += 1;
      this.state.health = Math.min(100, this.state.health + 0.3);
      if (errMs !== null) this.state.totalHitErrorMs += errMs;
    } else {
      this.state.combo = 0;
      this.state.health = Math.max(0, this.state.health - 8);
    }

    this.state.maxCombo = Math.max(this.state.maxCombo, this.state.combo);
    this.renderUi();
  }

  private update(): void {
    if (this.scene !== 'playing') return;
    this.songTime = this.audio.getSongTime();

    for (const note of this.chart.notes) {
      if (note.hit) continue;
      const deltaMs = (this.songTime - note.time) * 1000;
      if (deltaMs > HIT_WINDOW.good) {
        note.hit = true;
        this.applyJudgment('Miss', null);
      }
    }

    const allResolved = this.chart.notes.every((n) => n.hit);
    const timedOut = this.songTime > this.chart.duration;
    if (allResolved || timedOut || this.state.health <= 0) {
      this.endGame();
    }
  }

  private getAccuracy(): number {
    const total = this.state.counts.Perfect + this.state.counts.Good + this.state.counts.Miss;
    if (total === 0) return 100;
    const weighted = this.state.counts.Perfect * 1 + this.state.counts.Good * 0.7;
    return (weighted / total) * 100;
  }

  private renderUi(): void {
    this.ui.score.textContent = `${Math.floor(this.state.score)}`;
    this.ui.combo.textContent = `${this.state.combo}`;
    this.ui.acc.textContent = `${this.getAccuracy().toFixed(2)}%`;
    this.ui.health.textContent = `${Math.floor(this.state.health)}`;
    this.ui.last.textContent = this.state.lastJudgment ?? '-';
    this.ui.info.textContent = `${this.chart.title} — ${this.chart.artist} | BPM ${this.chart.bpm}`;

    if (this.scene === 'start') {
      this.ui.scene.innerHTML = `<h2>Start</h2><p>${this.chart.previewText}</p><p>Press Enter or click start.</p>`;
      this.ui.actions.innerHTML = `<button id="start-btn">Start Demo Song</button>`;
      (this.ui.actions.querySelector('#start-btn') as HTMLButtonElement).onclick = () => {
        void this.startGame();
      };
    } else if (this.scene === 'playing') {
      this.ui.scene.innerHTML = '<h2>Playing</h2><p>Press Esc to pause, R to restart.</p>';
      this.ui.actions.innerHTML = `<button id="pause-btn">Pause</button> <button id="restart-btn">Restart</button>`;
      (this.ui.actions.querySelector('#pause-btn') as HTMLButtonElement).onclick = () => this.pauseGame();
      (this.ui.actions.querySelector('#restart-btn') as HTMLButtonElement).onclick = () => {
        void this.startGame();
      };
    } else if (this.scene === 'paused') {
      this.ui.scene.innerHTML = '<h2>Paused</h2><p>Press Esc to resume or R to restart.</p>';
      this.ui.actions.innerHTML = `<button id="resume-btn">Resume</button> <button id="restart-btn">Restart</button>`;
      (this.ui.actions.querySelector('#resume-btn') as HTMLButtonElement).onclick = () => {
        void this.resumeGame();
      };
      (this.ui.actions.querySelector('#restart-btn') as HTMLButtonElement).onclick = () => {
        void this.startGame();
      };
    } else {
      const { Perfect, Good, Miss } = this.state.counts;
      this.ui.scene.innerHTML = `
        <h2>Results</h2>
        <ul class="result-list">
          <li>Perfect: ${Perfect}</li>
          <li>Good: ${Good}</li>
          <li>Miss: ${Miss}</li>
          <li>Max Combo: ${this.state.maxCombo}</li>
        </ul>
        <p>Press R or click retry.</p>`;
      this.ui.actions.innerHTML = `<button id="retry-btn">Retry Song</button>`;
      (this.ui.actions.querySelector('#retry-btn') as HTMLButtonElement).onclick = () => {
        void this.startGame();
      };
    }
  }

  private draw(): void {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    const laneWidth = width / LANES;
    const receptorY = 650;
    const laneTop = 80;

    this.ctx.fillStyle = '#080b14';
    this.ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < LANES; i += 1) {
      this.ctx.fillStyle = i % 2 === 0 ? '#11182d' : '#0f1627';
      this.ctx.fillRect(i * laneWidth, laneTop, laneWidth, receptorY - laneTop + 40);

      this.ctx.strokeStyle = '#2f3d66';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(i * laneWidth, laneTop, laneWidth, receptorY - laneTop + 40);

      if (this.activeKeys.has(i as Lane)) {
        this.ctx.fillStyle = 'rgba(255,255,255,0.18)';
        this.ctx.fillRect(i * laneWidth + 6, receptorY - 12, laneWidth - 12, 34);
      }
    }

    this.ctx.fillStyle = '#f5f7ff';
    this.ctx.fillRect(0, receptorY, width, 6);

    for (const note of this.chart.notes) {
      if (note.hit) continue;
      const tUntilHit = note.time - this.songTime;
      const y = receptorY - tUntilHit * this.noteSpeed;
      if (y < laneTop - 30 || y > height + 30) continue;

      const x = note.lane * laneWidth + 8;
      const w = laneWidth - 16;
      const h = 16;
      this.ctx.fillStyle = LANE_COLORS[note.lane];
      this.ctx.fillRect(x, y - h / 2, w, h);
    }

    this.ctx.fillStyle = '#b7c6f5';
    this.ctx.font = '16px sans-serif';
    this.ctx.fillText(`Time ${this.songTime.toFixed(2)}s`, 10, 28);

    if (this.scene === 'start') {
      this.drawOverlay('Press Enter to Start');
    } else if (this.scene === 'paused') {
      this.drawOverlay('Paused');
    } else if (this.scene === 'result') {
      this.drawOverlay(this.state.health <= 0 ? 'Failed' : 'Song Complete');
    }
  }

  private drawOverlay(text: string): void {
    this.ctx.fillStyle = 'rgba(4, 7, 14, 0.58)';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 42px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(text, this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.textAlign = 'start';
  }

  private loop = (): void => {
    this.update();
    this.draw();
    this.raf = window.requestAnimationFrame(this.loop);
  };

  destroy(): void {
    window.cancelAnimationFrame(this.raf);
    this.audio.stop();
  }
}

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('app root missing');

const game = new RhythmGame(root);
window.addEventListener('beforeunload', () => game.destroy());
