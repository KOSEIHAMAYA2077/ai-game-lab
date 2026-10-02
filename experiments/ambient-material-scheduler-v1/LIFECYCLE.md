# Artificial clock ordering

This supplements the frozen METHOD without changing its proposal values. It is written before the cases and results.

`accept(state,event)` processes earlier deadlines strictly before `event.at`, then ingests that event. Events with the same timestamp are a group. After the full group, the harness calls `advanceTo(state,t)` to process deadlines at that timestamp. Thus material arriving exactly at a batch deadline is available to that batch, and a hide/focus at a deadline can cancel work before it occurs. The final horizon also calls `advanceTo`.

The artificial clock has no timers, renderer or wall-clock sleeps. Reveal records describe proposed presentation work, not actual UI drawing. Candidate expiry is processed before shape application when equal. Dirty unparsed input blocks applying an older hysteresis candidate until the next batch interprets the latest window. Focus/gap clear lexical context, while append history and current shape remain.

All normalized events use one monotonic `seq`; an observed jump is disclosed and does not create missing letters. `epoch` is changed only by focus. The producer is synthetic. There is no ACK/replay or validation of an OS API's claimed commit evidence here.
