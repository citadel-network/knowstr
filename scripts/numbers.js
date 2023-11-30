import { EOS_CONTRACT, api, fetchAll } from "./database.js";
import { referrals } from "./referrals.js";
import BigNumber from "bignumber.js";
import { gifts } from "./gifts.js";
import { reservations } from "./reservations.js";
import { proposals } from "./proposals.js";
import { backers } from "./backers.js";

/*
(async () => {
  const gifts = await fetchAll(api, EOS_CONTRACT, EOS_CONTRACT, "referrals");
  console.log(JSON.stringify(gifts));
})();
*/

/*
(async () => {
  const referrals = await api.rpc.get_table_rows({
    json: true,
    code: EOS_CONTRACT,
    scope: EOS_CONTRACT,
    table: "referrals",
    limit: 1000,
  });
  const referralsWithAccounts = await Promise.all(
    referrals.rows.map(async (referral) => {
      const accounts = await api.rpc.get_table_rows({
        json: true,
        code: EOS_CONTRACT,
        scope: referral.user,
        table: "accounts",
        limit: 10,
      });
      return {
        ...referral,
        accounts: accounts.rows,
      };
    })
  );
  console.log(JSON.stringify(referralsWithAccounts));
})();
*/

function isRelevant(gift) {
  if (gift.bid_status === 4 && gift.offer_status === 5) {
    return true;
  }
  if (gift.offer_status === 0 && gift.bid_status === 0) {
    return true;
  }
  if (gift.offer_status === 1 && gift.bid_status === 0) {
    return true;
  }
  if (gift.offer_status === 5 && gift.bid_status === 0) {
    return true;
  }
  return false;
}

function giftPerUser() {
  const props = JSON.parse(proposals).rows;
  const reserves = JSON.parse(reservations).rows;
  return JSON.parse(gifts)
    .rows.filter((gift) => isRelevant(gift))
    .reduce((rdx, gift) => {
      const reservation = reserves.filter(
        (reservation) => gift.reservation_id === reservation.id
      )[0];
      const bid = props.filter((prop) => reservation.bid === prop.id)[0];
      const offer = props.filter((prop) => reservation.offer === prop.id)[0];
      const bidder = rdx[bid.user] || {
        delivered: new BigNumber(0),
        spent: new BigNumber(0),
      };
      const offerer = rdx[offer.user] || {
        delivered: new BigNumber(0),
        spent: new BigNumber(0),
      };
      return {
        ...rdx,
        [bid.user]: {
          ...bidder,
          spent: bidder.spent.plus(new BigNumber(gift.volume)),
        },
        [offer.user]: {
          ...offerer,
          delivered: offerer.delivered.plus(new BigNumber(gift.volume)),
        },
      };
    }, {});
}

function sumGifts(user, bids) {
  const userProposals = JSON.parse(proposals).rows.filter(
    (prop) =>
      prop.user === user.user && (bids ? prop.bid === 1 : prop.bid === 0)
  );
  const userReservations = JSON.parse(reservations).rows.filter(
    (reservation) =>
      userProposals.filter((proposal) =>
        bids
          ? proposal.id === reservation.bid
          : proposal.id === reservation.offer
      ).length >= 1
  );
  const userGifts = JSON.parse(gifts).rows.filter(
    (gift) =>
      isRelevant(gift) &&
      userReservations.filter(
        (reservation) => reservation.id === gift.reservation_id
      ).length >= 1
  );
  return userGifts.reduce((sum, gift) => {
    return sum.plus(new BigNumber(gift.volume));
  }, new BigNumber(0));
}

function sumAllGifts() {
  return JSON.parse(gifts)
    .rows.filter((gift) => isRelevant(gift))
    .reduce((sum, gift) => {
      return sum.plus(new BigNumber(gift.volume));
    }, new BigNumber(0));
}

function shares(user) {
  return JSON.parse(backers).rows.reduce((sum, backer) => {
    if (backer.user === user.user) {
      return sum.plus(new BigNumber(backer.shares).multipliedBy(TATOSHI));
    }
    return sum;
  }, new BigNumber(0));
}

function spendings(user) {
  const giftSpend = sumGifts(user, true);
  return giftSpend.plus(
    JSON.parse(backers).rows.reduce((sum, backer) => {
      if (backer.user === user.user) {
        return sum.plus(new BigNumber(backer.shares).multipliedBy(TATOSHI));
      }
      return sum;
    }, new BigNumber(0))
  );
}

function delivered(user) {
  const sum = sumGifts(user, false);
  if (user.user === "zybzqxqeunzd") {
    return sum.plus(new BigNumber(150000).multipliedBy(TATOSHI));
  }
  return sum;
}

const TATOSHI = 1000000000;

(() => {
  const users = JSON.parse(referrals).map((user) => ({
    ...user,
    accounts: user.accounts.reduce((rdx, account) => {
      rdx[account.id] = account.balance;
      return rdx;
    }, {}),
  }));
  const x = giftPerUser();
  const result = users.map((user) => ({
    ...user,
    liquidOffers: new BigNumber(user["total_offers_reserved"]),
    honour: new BigNumber(user["honor"]),
    credit: new BigNumber(user.accounts.credit),
    trust: new BigNumber(user.accounts.trust),
    reserved: new BigNumber(user.accounts.reserved),
    spending: (x[user.user] || { spent: new BigNumber(0) }).spent.plus(
      shares(user)
    ),
    delivered: (x[user.user] || { delivered: new BigNumber(0) }).delivered.plus(
      user.user === "zybzqxqeunzd"
        ? new BigNumber(150000).multipliedBy(TATOSHI)
        : new BigNumber(0)
    ),
  }));

  const total = result.reduce(
    (rdx, user) => {
      const maxCredit = BigNumber.min(user.liquidOffers, user.honour);
      const creditWithdrawn = maxCredit.minus(user.credit);
      console.log(
        user.user,
        user.trust.dividedBy(TATOSHI).toString(),
        creditWithdrawn.dividedBy(TATOSHI).toString(),
        user.delivered.dividedBy(TATOSHI).toString(),
        user.spending.dividedBy(TATOSHI).toString()
      );
      return {
        balance: rdx.balance
          .plus(user.trust)
          .plus(user.reserved)
          .minus(creditWithdrawn),
        trust: rdx.trust.plus(user.trust.plus(user.reserved)),
        withdrawn: rdx.withdrawn.plus(creditWithdrawn),
        delivered: rdx.delivered.plus(user.delivered),
        spending: rdx.spending.plus(user.spending),
        diff: rdx.diff.plus(user.delivered).minus(user.spending),
      };
    },
    {
      balance: new BigNumber(0),
      delivered: new BigNumber(0),
      spending: new BigNumber(0),
      trust: new BigNumber(0),
      withdrawn: new BigNumber(0),
      diff: new BigNumber(0),
    }
  );
  console.log(
    "Total",
    total.trust.dividedBy(TATOSHI).toString(),
    total.withdrawn.dividedBy(TATOSHI).toString(),
    total.delivered.dividedBy(TATOSHI).toString(),
    total.spending.dividedBy(TATOSHI).toString(),
    total.diff.dividedBy(TATOSHI).toString()
  );

  console.log("Balance", total.balance.dividedBy(TATOSHI).toString());
  console.log("Sum All Requests", sumAllGifts().dividedBy(TATOSHI).toString());
})();
