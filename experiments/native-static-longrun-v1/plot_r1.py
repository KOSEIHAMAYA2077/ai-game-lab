#!/usr/bin/env python3
# coding: utf-8
"""Post-run descriptive figure only; no new process or model measurement."""
import hashlib
import json
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

HERE = Path(__file__).resolve().parent
raw = json.loads((HERE / 'SAMPLES-R1.json').read_text())
queries = json.loads((HERE / 'QUERIES-RAW-R1.json').read_text())
summary = json.loads((HERE / 'SUMMARY-R1.json').read_text())
valid = [x for x in raw if x.get('residentBytes') is not None]
assert valid, 'No valid saved samples'
minutes = [x['elapsedSeconds'] / 60 for x in valid]
resident = [x['residentBytes'] / 1048576 for x in valid]
cpu = [x['cumulativeCPUSeconds'] for x in valid]
fig, axes = plt.subplots(2, 1, figsize=(10, 6.4), sharex=True, constrained_layout=True)
axes[0].plot(minutes, resident, color='#305b88', linewidth=1.5, label='Native PID RSS (ps)')
axes[0].set_ylabel('Resident memory (MiB)')
axes[0].set_ylim(0, max(resident) * 1.15)
axes[0].legend(loc='lower right', frameon=False)
axes[1].step(minutes, cpu, where='post', color='#63558c', linewidth=1.5)
axes[1].set_ylabel('Cumulative CPU time (s)')
axes[1].set_xlabel('Elapsed wall time (minutes)')
axes[1].set_ylim(0, max(0.1, max(cpu) * 1.25))
for ax in axes:
    ax.grid(axis='y', color='#dddddd', linewidth=0.6)
    ax.set_xlim(0, max(100, summary['elapsedSeconds'] / 60))
    ax.spines[['top', 'right']].set_visible(False)
for q in queries:
    color = '#c07022' if q['kind'] == 'long4000' else '#a2a2a2'
    axes[0].axvline(q['sentElapsedSeconds'] / 60, color=color, linewidth=0.65, alpha=0.5)
completed = (summary['failure'] is None and summary['exitCode'] == 0
             and summary['elapsedSeconds'] >= summary['scheduledDurationSeconds'])
fig.suptitle('Native CPU CLI: saved artificial-input / idle observation', fontsize=14)
axes[0].set_title(
    f"{len(valid)}/{len(raw)} valid samples; {len(queries)} replies; "
    'M5 / 32 GiB macOS; UI and GPU excluded', fontsize=10, loc='left')
axes[1].set_title('ps CPU time is rounded; flat intervals do not prove zero CPU use', fontsize=9, loc='left')
fig.savefig(HERE / 'RESOURCE-R1.png', dpi=180)
fig.savefig(HERE / 'RESOURCE-R1.svg')
rows = []
for name in ['plot_r1.py', 'SAMPLES-R1.json', 'QUERIES-RAW-R1.json', 'SUMMARY-R1.json',
             'RESOURCE-R1.png', 'RESOURCE-R1.svg']:
    p = HERE / name
    rows.append({'path': name, 'bytes': p.stat().st_size,
                 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
(HERE / 'FIGURE-R1.json').write_text(json.dumps({
    'descriptivePostRunOnly': True, 'completedScheduledDuration': completed,
    'runtimeMatplotlibVersion': matplotlib.__version__,
    'newNativeModelOSCalls': 0, 'missingSamples': len(raw) - len(valid),
    'scope': 'RSS/rounded CPU of one native PID only, no whole-widget or leak-free claim.',
    'files': rows}, indent=2) + '\n')
