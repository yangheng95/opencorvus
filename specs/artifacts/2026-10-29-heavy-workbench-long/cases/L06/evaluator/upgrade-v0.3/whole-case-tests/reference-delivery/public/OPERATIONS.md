# Four-product operations desk: staged commitments

Original synthetic business, no real supplier/customer. Static catalogue/BOM/route/pack/freight/lead/holding/sales terms inherit the declared L06 manufacturing model. This is a new instance, not the old0.2 input or lower bound. Eight equally probable joint paths combine three later announcements at weeks4,8,12. The tree is public support; the actual selected future is private to execution.

The spot supplier can serve a conservative current-needs alternative but is costly. Forward suppliers offer lower unit prices, integer packs, dispatch minimums and lead1/2. Supply announcements never revoke already placed orders. Production routes share real work hours; warehouse limits apply before consumption/dispatch. All current demand must be fulfilled. Historical cash arrives only after the declared lag; late receivables remain assets and cannot be spent early. Completed-week actions and receipts cannot be edited on restart.

Compare a lawful full-observation-history policy, an executable costly alternative and a clearly labelled information relaxation. An action may stay unchanged after news. Neither a path label nor a solver status proves causality, physical feasibility, quality or approval. Preserve failures and give practical operator recovery/credit advice. All money/volume/hour units are the raw table integer units; not real currency commitments.


## Binding terminal and cost rules

Weeks are integers0..15. Each positive raw order must be due before16; empty trucks are allowed and pay freight when on, including MOQ0. All weekly demand is delivered. Settled end-week cash must be at least−9000 in weeks0..14 and at least0 in week15. Final finished stock is exactly zero. Raw leftovers are allowed, pay normal holding through week15 and receive no terminal salvage credit. Historical orders arrive even if the current supplier capacity is reduced. Purchase/freight/production/holding are costs at the current week; sales become cash only at their original absolute due week. Receivables due16 or later remain reported assets, not current cash or negative operating cost.

## Canonical lawful alternative and quality target

The canonical current-needs alternative is fully defined: before each action apply only historical due arrivals/receipts. Required made[j]=max(0,current_demand[j]−old_finished[j]). In product order[0,3,1,2], assign required production to allowed plants in explicit plant-index order, using remaining current hours. Compute BOM requirements for that made vector. The last indexed supplier is the lead0 spot source with unit packs. Order max(0,required_raw−raw_after_historical_arrivals) from it, use one truck if any positive quantity, and if that truck's volume is below its minimum, add the missing volume in raw0 (unit volume1). Other suppliers/trucks are zero. Apply the exact weekly rules and repeat from the original prefix. The supplied public exercise implements this same alternative, not an arbitrary candidate baseline.

For these registered raw tables this executable policy has expected cost70640 minor units. A submitted physically valid causal policy must cost at most60044 (=85%×70640) under the exact public probabilities. This15% improvement goal was declared before the author solve. It is not a claim of global optimality or a universal business guarantee.
