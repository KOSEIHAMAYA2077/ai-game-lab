"""Bounded owned offscreen attempt, isolated from the launching shell session.

No OS/input capture, settings, history access, or process discovery. Existing
attempt/run directories are refused. Child handles only, no broad PID kills.
"""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
import time


def utc():
    return datetime.now(timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    p = argparse.ArgumentParser()
    for key in ('attempt', 'run', 'engine', 'shader', 'sampler', 'helper'):
        p.add_argument('--' + key, type=Path, required=True)
    p.add_argument('--seconds', type=int, default=7200)
    args = p.parse_args()
    if not 30 <= args.seconds <= 7200:
        raise SystemExit('Duration must be 30..7200 seconds')
    paths = vars(args)
    if not all(paths[k].is_absolute() for k in ('attempt', 'run', 'engine', 'shader', 'sampler', 'helper')):
        raise SystemExit('Absolute paths required')
    if args.attempt.exists() or args.run.exists():
        raise SystemExit('Attempt/run already exists; preserve it and choose new names')
    if not all(paths[k].is_file() for k in ('engine', 'shader', 'sampler', 'helper')):
        raise SystemExit('Owned prepared helper missing')
    args.attempt.mkdir(parents=True)
    meta = {'startedUTC': utc(), 'durationSeconds': args.seconds,
            'scope': 'offscreen-engine-not-window-app',
            'source': {k: {'fileName': paths[k].name, 'sha256': digest(paths[k])}
                       for k in ('engine', 'shader', 'sampler', 'helper')},
            'supervisorSHA256': digest(Path(__file__)),
            'runDirectoryName': args.run.name,
            'existingOutputsReplaced': False, 'historyRead': False,
            'historyWrite': False, 'supervisorPID': os.getpid(), 'supervisorParentPID': os.getppid(),
            'launchSessionDetached': os.getsid(0) == os.getpid(),
            'detachmentGuaranteesProcessPersistence': False}
    (args.attempt / 'launch.json').write_text(json.dumps(meta, indent=2) + '\n')
    children = []
    started = time.monotonic()
    result = {'startedUTC': meta['startedUTC'], 'status': 'initializing',
              'scope': meta['scope']}
    try:
        with (args.attempt / 'engine.stdout.log').open('x') as log, (args.attempt / 'engine.stderr.log').open('x') as err:
            engine = subprocess.Popen([str(args.engine), str(args.run), str(args.shader), str(args.seconds)],
                                      stdin=subprocess.DEVNULL, stdout=log, stderr=err,
                                      start_new_session=True, close_fds=True)
            children.append(engine)
            result['enginePID'] = engine.pid
            (args.attempt / 'child-identity.json').write_text(json.dumps(result, indent=2) + '\n')
            ready_until = time.monotonic() + 60
            while not (args.run / 'progress.json').exists():
                if engine.poll() is not None or time.monotonic() > ready_until:
                    raise RuntimeError('Engine exited or did not become ready within 60 seconds')
                time.sleep(.25)
            with (args.attempt / 'sampler.stdout.log').open('x') as sl, (args.attempt / 'sampler.stderr.log').open('x') as se:
                sampler = subprocess.Popen(['/usr/bin/python3', str(args.sampler), '--helper', str(args.helper),
                                            '--run', str(args.run), '--interval', '5'],
                                           stdin=subprocess.DEVNULL, stdout=sl, stderr=se,
                                           start_new_session=True, close_fds=True)
                children.append(sampler)
                result['samplerPID'] = sampler.pid
                result['status'] = 'running'
                (args.attempt / 'child-identity.json').write_text(json.dumps(result, indent=2) + '\n')
                result['engineExitCode'] = engine.wait(timeout=args.seconds + 90)
                result['samplerExitCode'] = sampler.wait(timeout=30)
                result['engineFinalPresent'] = (args.run / 'result.json').exists()
                result['samplerFinalPresent'] = (args.run / 'resource-cpu-intervals.json').exists()
                result['status'] = 'children-exited'
    except (RuntimeError, subprocess.TimeoutExpired, OSError) as exc:
        result['status'] = 'supervisor-failed'
        result['exceptionType'] = type(exc).__name__
    finally:
        # Only our still-live unreaped child handles can be terminated here.
        for child in children:
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    child.kill()
                    child.wait(timeout=10)
        result['finishedUTC'] = utc()
        result['supervisedElapsedSeconds'] = time.monotonic() - started
        result['completionRequiresEngineAndSamplerValidation'] = True
        result['childExitCodes'] = [{'pid': c.pid, 'code': c.returncode} for c in children]
        (args.attempt / 'exit.json').write_text(json.dumps(result, indent=2) + '\n')
    return 0 if result['status'] == 'children-exited' and all(c.returncode == 0 for c in children) else 1


if __name__ == '__main__':
    raise SystemExit(main())
