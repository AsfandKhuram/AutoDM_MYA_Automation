// Single source of truth for DMX loan-application URLs (per product, per env).
// Specs resolve their URL via resolveLoanApplicationUrl(), which allows runtime
// overrides so any spec can be pointed at a different environment without edits:
//   - LOAN_APPLICATION_URL : absolute URL override (wins over everything)
//   - LOAN_APPLICATION_ENV : 'dev' (default) or 'prod'

export type DmxProduct =
  | 'gri'
  | 'op'
  | 'cw'
  | 'owning'
  | 'kbhs'
  | 'premia'
  | 'qhl'
  | 'certainty';

export type DmxEnv = 'dev' | 'prod';

export const DMX_URLS: Record<DmxProduct, Record<DmxEnv, string>> = {
  gri: {
    dev: 'https://apply-gri.dev.saas.rate.com/apply/loan-purpose?emp-id=12657',
    prod: 'https://apply.guaranteedrate.com/apply/loan-purpose?emp-id=18580',
  },
  op: {
    dev: 'https://apply-op.dev.saas.rate.com/apply/loan-purpose?emp-id=921',
    prod: 'https://apply.originpoint.com/apply/loan-purpose',
  },
  cw: {
    dev: 'https://apply-cwhm.dev.saas.rate.com/apply/loan-purpose?emp-id=100000089',
    prod: 'https://apply.citywidehomeloans.com/apply/loan-purpose?emp-id=921',
  },
  owning: {
    dev: 'https://apply-owning.dev.saas.rate.com/apply/loan-purpose?emp-id=100000029',
    prod: 'https://apply.owning.com/apply/express-loan',
  },
  kbhs: {
    dev: 'https://apply-kbhs.dev.saas.rate.com/apply/loan-purpose?emp-id=927',
    prod: 'https://apply.kbhshomeloans.com/apply/loan-purpose?emp-id=921',
  },
  premia: {
    dev: 'https://apply-premia.dev.saas.rate.com/apply/loan-purpose?emp-id=927',
    prod: 'https://apply.premiarelocationmortgage.com/apply/loan-purpose?emp-id=921',
  },
  qhl: {
    dev: 'https://apply-qhl.dev.saas.rate.com/apply/loan-purpose?emp-id=100000090',
    prod: 'https://apply.onqhomeloans.com/apply/loan-purpose?emp-id=36705',
  },
  certainty: {
    dev: 'https://apply-certainty.dev.saas.rate.com/apply/loan-purpose?emp-id=100000073',
    prod: 'https://apply.certaintyhomelending.com/apply/loan-purpose?emp-id=33117',
  },
};

/**
 * Resolve the loan-application URL for a DMX product.
 * Precedence: LOAN_APPLICATION_URL env override > DMX_URLS[product][env],
 * where env comes from LOAN_APPLICATION_ENV ('prod' selects prod, else defaultEnv).
 */
export function resolveLoanApplicationUrl(product: DmxProduct, defaultEnv: DmxEnv = 'dev'): string {
  const override = process.env.LOAN_APPLICATION_URL;
  if (override) return override;
  const env: DmxEnv = process.env.LOAN_APPLICATION_ENV?.toLowerCase() === 'prod' ? 'prod' : defaultEnv;
  return DMX_URLS[product][env];
}
