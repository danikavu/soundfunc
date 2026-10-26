/**
 * Writes the device's Max patch (m4l/device/SoundFunc.maxpat) — generated, so the wiring
 * lives in code and the kit menu always matches the kits.
 *
 *   Live's transport ── [metro 10] → [transport] → [pack] → clock ─┐
 *                                                                  ▼
 *   device controls (Play, Channel, MIDI, Kit) ──────────────► [v8 soundfunc.js]
 *   [pattr] (the project, saved with the Live Set) ──restore──►    │
 *   editor window ([jweb], the SoundFunc app) ◄──────────────────► │
 *                                                                  ├─► [pipe] (on time) → decode → [midiout]
 *                                                                  └─► [midiout] (right now: stopping)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { KITS } from '../src/engine/presets';

type Box = Record<string, unknown> & { id: string };
const boxes: { box: Box }[] = [];
const lines: { patchline: { source: [string, number]; destination: [string, number] } }[] = [];
let n = 0;

/** an object box; `io` = [inlets, outlets] as Max will count them */
function obj(text: string, io: [number, number], at: [number, number], extra: Record<string, unknown> = {}): string {
  const id = `obj-${++n}`;
  boxes.push({ box: { id, maxclass: 'newobj', text, numinlets: io[0], numoutlets: io[1], outlettype: Array(io[1]).fill(''), patching_rect: [at[0], at[1], Math.max(60, text.length * 7 + 14), 22], ...extra } });
  return id;
}
function msg(text: string, at: [number, number]): string {
  const id = `obj-${++n}`;
  boxes.push({ box: { id, maxclass: 'message', text, numinlets: 2, numoutlets: 1, outlettype: [''], patching_rect: [at[0], at[1], Math.max(40, text.length * 7 + 14), 22] } });
  return id;
}
/** a Live control: a parameter Live sees (automatable, saved with the set) */
function live(maxclass: string, name: string, at: [number, number], present: [number, number, number, number], valueof: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  const id = `obj-${++n}`;
  boxes.push({
    box: {
      id,
      maxclass,
      varname: name,
      numinlets: 1,
      numoutlets: maxclass === 'live.text' ? 2 : maxclass === 'live.menu' ? 3 : 1,
      outlettype: maxclass === 'live.menu' ? ['', '', 'float'] : maxclass === 'live.text' ? ['', ''] : [''],
      parameter_enable: 1,
      patching_rect: [at[0], at[1], present[2], present[3]],
      presentation: 1,
      presentation_rect: present,
      saved_attribute_attributes: { valueof: { parameter_longname: name, parameter_shortname: name, parameter_initial_enable: 1, ...valueof } },
      ...extra,
    },
  });
  return id;
}
function label(text: string, at: [number, number], present: [number, number, number, number], extra: Record<string, unknown> = {}): string {
  const id = `obj-${++n}`;
  boxes.push({ box: { id, maxclass: 'comment', text, numinlets: 1, numoutlets: 0, patching_rect: [at[0], at[1], present[2], present[3]], presentation: 1, presentation_rect: present, fontsize: 10, ...extra } });
  return id;
}
const wire = (from: string, outlet: number, to: string, inlet: number) => lines.push({ patchline: { source: [from, outlet], destination: [to, inlet] } });

// ---------- the brain ----------
const v8 = obj('v8 soundfunc.js', [1, 6], [420, 300]);

// Live's transport, read every 10 ms at high priority: tempo, playing, raw ticks
const metro = obj('metro 10 @active 1', [2, 1], [40, 40]);
const transport = obj('transport', [2, 9], [40, 80]);
// [transport] sends right to left: ticks, state … tempo — so tempo (arriving last) fires the pack
const clockPack = obj('pack 0. 0 0.', [3, 1], [40, 120]);
const clockMsg = obj('prepend clock', [2, 1], [40, 160]);
wire(metro, 0, transport, 0);
wire(transport, 4, clockPack, 0);
wire(transport, 6, clockPack, 1);
wire(transport, 7, clockPack, 2);
wire(clockPack, 0, clockMsg, 0);
wire(clockMsg, 0, v8, 0);

// where the device lives, so the editor can find ui/index.html beside it
const thisDevice = obj('live.thisdevice', [1, 3], [240, 40]);
const pathMsg = msg('path', [240, 80]);
const thisPatcher = obj('thispatcher', [1, 2], [240, 120]);
const routePath = obj('route path', [2, 2], [240, 160]);
const pathPre = obj('prepend devicepath', [2, 1], [240, 200]);
wire(thisDevice, 0, pathMsg, 0);
wire(pathMsg, 0, thisPatcher, 0);
wire(thisPatcher, 1, routePath, 0);
wire(routePath, 0, pathPre, 0);
wire(pathPre, 0, v8, 0);

// ---------- on time: [pipe] lets each event go at its moment, then it becomes MIDI bytes ----------
const pipe = obj('pipe 0 0', [2, 1], [420, 360]);
wire(v8, 1, pipe, 1); // the delay first…
wire(v8, 0, pipe, 0); // …then the event
const split = obj('t i i i', [1, 3], [420, 400]);
const b0 = obj('expr ($i1 >> 16) & 255', [1, 1], [420, 440]);
const b1 = obj('expr ($i1 >> 8) & 255', [1, 1], [560, 440]);
const b2 = obj('expr $i1 & 255', [1, 1], [700, 440]);
const bytes = obj('pack 0 0 0', [3, 1], [420, 480]);
const twoByte = obj('zl filter 255', [2, 2], [420, 520]);
const midiOut = obj('midiout', [1, 0], [420, 560]);
wire(pipe, 0, split, 0);
wire(split, 2, b2, 0);
wire(split, 1, b1, 0);
wire(split, 0, b0, 0);
wire(b2, 0, bytes, 2);
wire(b1, 0, bytes, 1);
wire(b0, 0, bytes, 0);
wire(bytes, 0, twoByte, 0);
wire(twoByte, 0, midiOut, 0);
wire(v8, 2, midiOut, 0); // right now: note-offs when stopping
// what is played into the track passes straight through, so you can play along
const midiIn = obj('midiin', [1, 1], [700, 520]);
wire(midiIn, 0, midiOut, 0);

// ---------- kept with the Live Set ----------
const pattr = obj('pattr soundfunc_project', [2, 3], [640, 300], {
  parameter_enable: 1,
  saved_attribute_attributes: { valueof: { parameter_longname: 'SoundFunc project', parameter_shortname: 'project', parameter_type: 3, parameter_invisible: 1 } },
});
const restore = obj('prepend restore', [2, 1], [640, 340]);
wire(v8, 4, pattr, 0);
wire(pattr, 0, restore, 0);
wire(restore, 0, v8, 0);

// ---------- the device's face ----------
label('SOUNDFUNC', [880, 20], [8, 6, 120, 16], { fontface: 1, fontsize: 11 });
const play = live('live.toggle', 'Play', [880, 60], [8, 28, 20, 20], { parameter_type: 2, parameter_enum: ['off', 'on'], parameter_mmax: 1, parameter_initial: [1] });
label('Play', [910, 60], [32, 30, 40, 16]);
const channel = live('live.menu', 'Channel', [880, 100], [8, 56, 84, 18], {
  parameter_type: 2,
  parameter_enum: ['All', ...Array.from({ length: 16 }, (_, i) => `Channel ${i + 1}`)],
  parameter_mmax: 16,
  parameter_initial: [0],
});
const midiMode = live('live.menu', 'MIDI', [880, 140], [8, 80, 84, 18], { parameter_type: 2, parameter_enum: ['Notes only', 'Notes + bends'], parameter_mmax: 1, parameter_initial: [1] });
const kits = ['Keep', ...KITS.map((k) => k.name)];
const kit = live('live.menu', 'Kit', [880, 180], [100, 56, 120, 18], { parameter_type: 2, parameter_enum: kits, parameter_mmax: kits.length - 1, parameter_initial: [0] });
const edit = live('live.text', 'Edit', [880, 220], [100, 80, 120, 18], { parameter_type: 2, parameter_enum: ['val1', 'val2'], parameter_mmax: 1 }, { text: 'Open editor…', mode: 0 });
const status = obj('comment', [1, 0], [880, 260], { maxclass: 'comment', text: 'SoundFunc', presentation: 1, presentation_rect: [8, 108, 220, 40], fontsize: 10, linecount: 2 });
for (const [ctrl, word] of [
  [play, 'active'],
  [channel, 'channel'],
  [midiMode, 'midi'],
  [kit, 'kit'],
] as const) {
  const pre = obj(`prepend ${word}`, [2, 1], [1000, 60 + 40 * n]);
  wire(ctrl, 0, pre, 0);
  wire(pre, 0, v8, 0);
}
wire(v8, 5, status, 0);

// the editor: the SoundFunc app in its own window
const openBang = obj('t b', [1, 1], [880, 300]);
const openMsg = msg('open', [880, 340]);
const pcontrol = obj('pcontrol', [1, 1], [880, 380]);
wire(edit, 0, openBang, 0);
wire(openBang, 0, openMsg, 0);
wire(openMsg, 0, pcontrol, 0);
const W = 1440, H = 900;
const editor: Box = {
  id: `obj-${++n}`,
  maxclass: 'newobj',
  text: 'p SoundFunc-editor',
  numinlets: 2,
  numoutlets: 1,
  outlettype: [''],
  patching_rect: [880, 420, 140, 22],
  patcher: {
    fileversion: 1,
    appversion: { major: 9, minor: 0, revision: 0, architecture: 'x64', modernui: 1 },
    classnamespace: 'box',
    rect: [80, 80, W, H],
    openinpresentation: 1,
    toolbarvisible: 0,
    boxes: [
      { box: { id: 'e-in-open', maxclass: 'inlet', numinlets: 0, numoutlets: 1, outlettype: [''], patching_rect: [10, 10, 30, 30] } },
      { box: { id: 'e-in', maxclass: 'inlet', numinlets: 0, numoutlets: 1, outlettype: [''], patching_rect: [60, 10, 30, 30] } },
      { box: { id: 'e-web', maxclass: 'jweb', numinlets: 1, numoutlets: 1, outlettype: [''], patching_rect: [10, 50, W, H], presentation: 1, presentation_rect: [0, 0, W, H], rendermode: 1 } },
      { box: { id: 'e-out', maxclass: 'outlet', numinlets: 1, numoutlets: 0, patching_rect: [10, H + 60, 30, 30] } },
    ],
    lines: [
      { patchline: { source: ['e-in', 0], destination: ['e-web', 0] } },
      { patchline: { source: ['e-web', 0], destination: ['e-out', 0] } },
    ],
  },
};
boxes.push({ box: editor });
wire(pcontrol, 0, editor.id, 0);
wire(v8, 3, editor.id, 1);
const uiPre = obj('prepend ui', [2, 1], [880, 460]);
wire(editor.id, 0, uiPre, 0);
wire(uiPre, 0, v8, 0);

const patch = {
  patcher: {
    fileversion: 1,
    appversion: { major: 9, minor: 0, revision: 0, architecture: 'x64', modernui: 1 },
    classnamespace: 'box',
    rect: [60, 60, 1200, 700],
    openinpresentation: 1,
    devicewidth: 236,
    boxes,
    lines,
    dependency_cache: [{ name: 'soundfunc.js', bootpath: '.', type: 'TEXT', implicit: 1 }],
    project: { version: 1, creationdate: 0, modificationdate: 0, viewrect: [0, 0, 300, 500], autoorganize: 1, hideprojectwindow: 1, devpathtype: 0, devpath: '.', sortmode: 0, viewmode: 0 },
  },
};

// run from the project folder (npm run build:m4l)
mkdirSync('m4l/device', { recursive: true });
writeFileSync('m4l/device/SoundFunc.maxpat', JSON.stringify(patch, null, 2));
console.log(`wrote m4l/device/SoundFunc.maxpat — ${boxes.length} objects, ${lines.length} wires, kits: ${KITS.length}`);
