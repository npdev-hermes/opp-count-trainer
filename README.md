# Count at the Table — OPP blackjack trainer

Play: https://npdev-hermes.github.io/opp-count-trainer/

A static, mobile-responsive practice table with hit, stand, double, split, two automated seats, a dealer, adjustable fun-chip bets, and continuous 2/6/8-deck shoes. No accounts, real money, or backend. Accuracy/history are saved locally; active games are not saved across reloads.

## Counting convention
Based on Carlos Zilzer's [Easy OPP Count](https://www.lasvegasadvisor.com/gambling-with-an-edge/the-easy-opp-count-a-new-approach-to-card-counting/), introduced by Arnold Snyder. OPP means **One Per Person**. Start at +6. Every final hand contributes number of 2–6 cards minus one, including the dealer. Split hands replace the original hand. All other ranks have zero card contribution.

**OPP is running-count-only.** The extra true-count-style quiz uses `(running count - 6) / (cards remaining / 52)`, rounded to one decimal. This is a custom normalization drill, NOT an official OPP true count, NOT Hi-Lo, and NOT a validated betting signal. Answers are hidden until submission. Both entries are required; each round is graded once.

## Table rules and deliberate simplifications
- S17, US dealer peek, natural blackjack pays 3:2, natural versus natural pushes.
- Double any initial two cards / after split, up to four player hands. Split equal ranks only.
- Split aces receive one card, no resplitting aces. Split 21 pays even money.
- No insurance, surrender, or burn card.
- Automated seats hit to 17, never split/double; this is not optimal basic strategy.
- Dealer completes its hand even if all players bust, for counting practice.
- Cut at 75% dealt, checked between rounds. Conservative low-card safety reserve may shuffle a short shoe earlier; no mid-round reshuffle. Each shoe resets RC to +6.
- Initial bankroll 1,000 fun chips. New session resets chips, new shoe keeps them.
- Practice tool only, no profit guarantees.

## Run and test
Requires Node 18+ for tests, Python 3 for a local server; no app dependencies or build step.

```sh
npm test
python3 -m http.server 8089
```
Open http://localhost:8089. Deployment uses GitHub Pages from main, root directory.

Engine tests cover OPP arithmetic, dealing, peek, payouts, splits/DAS/aces, shoe reconciliation, normalization, automatic seats, and short-shoe safety. Desktop/mobile browser smoke checks additionally verify gameplay, quiz gating, hidden answers, and lack of horizontal overflow.
