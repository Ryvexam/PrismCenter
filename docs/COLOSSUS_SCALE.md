# Colossus-Scale Simulation Model

PrismCenter originally reasoned around classical AI datacenter footprints up to roughly 200 MW. That scale does not represent a Colossus-like campus, so the product now exposes explicit 30 MW, 300 MW, 1 GW, and 2 GW comparison bands.

These values are order-of-magnitude planning assumptions. They are not claims about currently commissioned capacity, a grid-connection offer, or an engineering design.

## Public Reference Points

- The 2025 *Trends in AI Supercomputers* paper estimates xAI Colossus at 200,000 AI chips, about 300 MW, and roughly USD 7 billion of hardware: <https://arxiv.org/abs/2504.16026>.
- Reuters reported in December 2024 that the Memphis expansion target was at least one million GPUs: <https://www.reuters.com/technology/artificial-intelligence/musks-xai-plans-massive-expansion-ai-supercomputer-memphis-2024-12-04/>.
- Reuters reported in March 2025 that the expansion included a water-recycling plant and Tesla Megapacks: <https://www.reuters.com/technology/artificial-intelligence/elon-musks-xai-buys-new-property-memphis-amid-supercomputer-expansion-2025-03-07/>.

The simulator deliberately separates those public reference points from its own assumptions. Future changes must update this document and the tests in the same pull request.

## Reference Scenarios

| Scenario | GPUs | Site load | Daily energy | Monthly energy | Yearly energy | Daily power cost at 0.08 EUR/kWh |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Regional baseline | ~25,000 | 30 MW | 0.72 GWh | 21.6 GWh | 0.263 TWh | ~57,600 EUR |
| Colossus 1 order of magnitude | ~200,000 | 300 MW | 7.2 GWh | 216 GWh | 2.628 TWh | ~576,000 EUR |
| Gigawatt campus | up to ~1,000,000 | 1,000 MW | 24 GWh | 720 GWh | 8.76 TWh | ~1.92M EUR |
| Extreme expansion | up to ~1,000,000 | 2,000 MW | 48 GWh | 1,440 GWh | 17.52 TWh | ~3.84M EUR |

## GPU-to-Site Load Rule

GPU thermal design power is not total site demand. The model includes server CPUs and memory, networking, storage, power conversion, cooling, and redundancy before applying PUE:

```text
gpu_power_mw = gpu_count * gpu_power_kw / 1000
site_load_mw = gpu_power_mw * server_overhead_factor * pue
```

Default assumptions:

- H100 / H200 equivalent: 0.7 kW per GPU.
- GB200 / Blackwell equivalent: 1.2 kW per GPU.
- Realistic server overhead factor: 1.45.
- Realistic PUE: 1.25.
- Stressed PUE: 1.40.

Under the realistic defaults, 200,000 H100-equivalent GPUs produce about 254 MW of estimated site demand, which sits inside the intended 250–300 MW planning band. The fixed Colossus 1 comparison remains 300 MW to preserve a conservative infrastructure envelope.

## Energy Cost Rule

```text
daily_kwh = site_load_mw * 1000 * 24
daily_cost = daily_kwh * electricity_price_eur_per_kwh
```

The UI uses `0.08 EUR/kWh` by default because it matches the requested comparison. Real costs can diverge substantially because of PPAs, grid fees, gas generation, batteries, redundancy, taxes, maintenance, curtailment, and capacity-market constraints.

## Grid-Scoring Consequences

The grid score compares embedded Caparéseau capacity and RTE voltage signals against the selected scenario.

- 30 MW can remain plausible around 90 kV or 225 kV infrastructure, subject to the actual connection study.
- 300 MW strongly favors 400 kV and penalizes departments that expose only 225 kV or lower signals.
- 1 GW requires 400 kV credibility and is heavily penalized otherwise.
- 2 GW is a stress test; even a 400 kV signal receives an additional penalty because one departmental capacity aggregate cannot prove multi-source delivery or N+1 resilience.

Above 300 MW, PrismCenter must present the result as an industrial energy-project screening exercise. Required follow-up includes RTE studies, reinforcement timelines, dedicated generation or procurement, storage, redundancy, cooling, water, heat reuse, land, permitting, and environmental review.
