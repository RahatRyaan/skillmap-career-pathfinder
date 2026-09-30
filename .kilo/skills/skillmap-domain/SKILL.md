---
name: skillmap-domain
description: The SkillMap AI domain model and scoring contract. Load before changing or reviewing any score, gap, priority, or roadmap calculation.
---

# SkillMap AI domain

## The pipeline

```
Current Skills → Target Career → Required Skills → Skill Gap → Priority
              → Personalised Roadmap → Progress → Adaptive Re-plan
```

## The 0–5 scale

| Level | Meaning                             |
| ----- | ----------------------------------- |
| 0     | Never used this                     |
| 1     | Tried it once or twice with help    |
| 2     | Can do simple guided tasks          |
| 3     | Can complete tasks independently    |
| 4     | Can handle complex real-world tasks |
| 5     | Can teach others and advise on it   |

Not a percentage of proficiency. "Can do it independently" is the anchor, and
level 3 is the level most jobs actually mean.

## Importance and its weight

| Importance | Weight |
| ---------- | ------ |
| `high`     | 3      |
| `medium`   | 2      |
| `low`      | 1      |

`isCore: true` marks a skill a role genuinely cannot work without. It does not
change the weight — importance does that.

## Gap labels

| Gap | Importance    | Label          |
| --- | ------------- | -------------- |
| 0   | any           | **Strong**     |
| 1   | any           | **Developing** |
| 2   | low or medium | **Gap**        |
| 2   | high          | **Critical**   |
| ≥3  | any           | **Critical**   |

A high-importance skill two levels short is as urgent as a low-importance one
three levels short, because missing it disqualifies you from the role.

## What each term means

| Term                    | Meaning                                                                                                        |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Alignment**           | How much of a career's requirement list you meet, weighted by importance. Not a hiring probability.            |
| **Gap**                 | `max(0, required − current)` for one skill                                                                     |
| **Normalized**          | `min(current / required, 1)` — your progress toward one requirement                                            |
| **Transferable credit** | A capped contribution from a related skill. Max 40%, same category only, above 0.75 similarity.                |
| **Priority score**      | Five weighted factors: gap size, importance, prerequisite position, inverse effort, relevance to what you have |
| **Priority rank**       | The priority score after a hard prerequisite sort                                                              |
| **Snapshot**            | A recorded alignment measurement, written only when something changed                                          |
| **Current roadmap**     | The one non-archived roadmap per (student, career)                                                             |

## The gap between rank and score

**Score and rank can disagree, deliberately.** Score is the weighted
arithmetic. Rank respects prerequisites as a hard constraint. A skill can score
higher and still rank lower because something it depends on has not been
learned yet.

When a student asks why a lower-scoring skill comes first, the answer is the
prerequisite, and the UI says exactly that.

## The disclaimer

> This score represents alignment with the selected skill requirements and is
> not a prediction of employment.

It travels with every score. It is not optional and it is not decoration — it is
the difference between measuring a skill list and implying a job outcome.
