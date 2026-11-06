use uint::construct_uint;
construct_uint! { pub struct U256(4); }
pub const Q: u128 = 1_000_000_000_000_000_000_000_000;
pub fn muldiv(a: u128, b: u128, c: u128, round_up: bool) -> u128 {
    assert!(c > 0, "PRICE_STALE");
    let n = U256::from(a) * U256::from(b);
    let d = U256::from(c);
    let result = n / d
        + if round_up && n % d != U256::zero() {
            U256::one()
        } else {
            U256::zero()
        };
    assert!(result <= U256::from(u128::MAX), "AMOUNT_OVERFLOW");
    result.as_u128()
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn overflow_safe_rounding() {
        assert_eq!(muldiv(u128::MAX, u128::MAX, u128::MAX, false), u128::MAX);
        assert_eq!(muldiv(5, 2, 3, true), 4);
        assert_eq!(muldiv(5, 2, 3, false), 3);
    }
    #[test]
    fn golden_vectors() {
        let n0 = muldiv(20_000_000, Q, 5_000_000, true);
        let escrow = muldiv(n0, 11000, 10000, true);
        for (price, bps, expected_fee, expected_refund) in [
            (5_000_000, 10000, 4 * Q / 10, 4 * Q / 10),
            (10_000_000, 10000, 2 * Q / 10, 24 * Q / 10),
            (4_000_000, 10000, 44 * Q / 100, 0),
            (5_000_000, 5000, 2 * Q / 10, 24 * Q / 10),
            (5_000_000, 0, 0, 44 * Q / 10),
        ] {
            let award = muldiv(
                muldiv(20_000_000, Q, price, true).min(escrow),
                bps,
                10000,
                false,
            );
            let fee = muldiv(award, 1000, 10000, false);
            assert_eq!(fee, expected_fee);
            assert_eq!(escrow - award, expected_refund);
            assert_eq!(escrow, escrow - award + fee + (award - fee));
        }
    }
    #[test]
    fn ten_thousand_conservation_checks() {
        let mut s = 19u128;
        for _ in 0..10000 {
            s = (s * 48271) % 2147483647;
            let usd = 1_000_000 + s % 99_000_000;
            let p = 1 + s % 100_000_000;
            let n0 = muldiv(usd, Q, p, true);
            let escrow = muldiv(n0, 11000, 10000, true);
            let owed = muldiv(usd, Q, 1 + (s * 31) % 100_000_000, true);
            let award = muldiv(owed.min(escrow), s % 10001, 10000, false);
            let fee = muldiv(award, 1000, 10000, false);
            assert_eq!(escrow, escrow - award + fee + award - fee);
        }
    }
}
