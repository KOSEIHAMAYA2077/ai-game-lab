# Physical twist comparison

The prior v0.13 scaffold evaluation stays unchanged. This experiment checks physical rotation of completed noncircular material sections, plus the general removal of color words from relation-model inputs. Learned weights and confidence thresholds are unchanged.

- Re-use the previously observed 44 synthetic cases only as a regression comparison, never as a new unknown-language accuracy estimate.
- Add 12 metamorphic operations: three attachment relations, each uncolored and in red/yellow/blue. Changing the ink must not change parent/child primitive types or relation kind. Record full model/evidence output; required dimensions may be scored separately from free variation.
- Check actual surface points against an independently inverted swept-volume model. A point's section coordinate is recovered by solving the centerline-normal plane equation; then physical section twist is inverted. Include nonzero bend/twist, not just zero-twist bounding boxes.
- Above uses actual material anchor points at several times. End-point placement is measured separately and must not be called universal watertight contact.
- Record unsupported geometry, model holds, and actual material-contact failures separately.
- Actual UI checks include images, first partially forming frame versus completed absorption, runtime errors, and external requests. Fixed official assets may be downloaded only during preparation. Full generation target 10 seconds, allowance 30 seconds; M5/32GB is not target laptop evidence.
- Freeze distribution hashes across each run. Save new results only under this directory and retain the previous evaluation files.
