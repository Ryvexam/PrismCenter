# Colossus-Scale Simulation Model

PrismCenter originally reasons around classical AI datacenter footprints: 5, 30, 80 and 200 MW. For a Colossus-like simulation, that scale is too small. This document defines the working assumptions used by `src/data/colossusScenarios.js`.

## Reference Scenarios

| Scenario | GPUs | Site load | Daily energy | Monthly energy | Yearly energy | Daily power cost at 0.08 EUR/kWh |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Current baseline | ~40,000 | 30 MW | 0.72 GWh | 21.6 GWh | 0.263 TWh | ~57,600 EUR |
| Colossus 1 order of magnitude | ~200,000 | 300 MW | 7.2 GWh | 216 GWh | 2.63 TWh | ~576,000 EUR |
| Colossus 2 1 GW target | up to ~1,000,000 | 1,000 MW | 24 GWh | 720 GWh | 8.76 TWh | ~1.92M EUR |
| Colossus 2 2 GW extension | up to ~1,000,000 | 2,000 MW | 48 GWh | 1,440 GWh | 17.52 TWh | ~3.84M EUR |

## GPU-to-Site Load Rule

The model separates raw GPU draw from total site power:

```text
site_load_mw = gpu_count * gpu_power_kw * pue / 1000
```

Default assumptions:

- H100 / H200: 0.7 kW per GPU.
- GB200-equivalent: 1.2 kW per GPU for high-density Blackwell-style systems.
- PUE realistic case: 1.35.
- PUE stressed case: 1.55.

This intentionally stays conservative: it is an order-of-magnitude simulator, not an engineering design tool.

## Energy Cost Rule

```text
daily_kwh = site_load_mw * 1000 * 24
daily_cost = daily_kwh * electricity_price_eur_per_kwh
```

The default price is `0.08 EUR/kWh`, matching the rough comparison used in discussion. Real contracts can diverge strongly because of wholesale pricing, PPAs, grid fees, gas turbines, batteries, redundancy, maintenance, taxes and curtailment constraints.

## Product Implication

A 30 MW app simulation does not meaningfully represent a Colossus-like campus. The UI and scoring should expose at least these power bands:

- 30 MW: regional or initial AI datacenter.
- 300 MW: Colossus 1 order of magnitude.
- 1 GW: nuclear-reactor-class campus.
- 2 GW: extreme expansion / Blackwell-scale campus.

The scoring model should heavily penalize departments without 400 kV credibility, available transmission capacity, cooling strategy and energy procurement narrative when the selected scenario is above 300 MW.
