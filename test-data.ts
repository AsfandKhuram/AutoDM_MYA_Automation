// Central source of truth for loan-application test applicant data.
//
// The borrower identities below come from the Fannie Mae DO/DU "Test Credit
// Agency" borrower list (test credit reports are keyed off the SSN/ITIN):
//   https://singlefamily.fanniemae.com/media/16156/display
// These are fictitious borrowers provided by Fannie Mae for testing.

export type TestBorrower = {
  firstName: string;
  lastName: string;
  ssn: string;
  /** Fannie Mae reference address (specs usually type their own address for autocomplete). */
  address: string;
  /** Estimated credit scores from the Fannie Mae sheet (reference only). */
  creditScores: number[] | 'NA';
};

// Full Fannie Mae Test Credit Agency borrower table (borrower + optional co-borrower).
export const FANNIE_MAE_TEST_BORROWERS: Array<{
  borrower: TestBorrower;
  coBorrower?: TestBorrower;
}> = [
  {
    borrower: { firstName: 'John', lastName: 'Homeowner', ssn: '999-40-5000', address: '175 13th Street, Washington, DC 20013', creditScores: [760, 779, 785] },
    coBorrower: { firstName: 'Mary', lastName: 'Homeowner', ssn: '500-22-2000', address: '175 13th Street, Washington, DC 20013', creditScores: [783, 768, 771] },
  },
  {
    borrower: { firstName: 'Andy', lastName: 'America', ssn: '999-60-3333', address: '4321 Cul de Sac Street, Someplace, MA 02723', creditScores: [724, 740, 742] },
    coBorrower: { firstName: 'Amy', lastName: 'America', ssn: '500-60-2222', address: '4321 Cul de Sac Street, Someplace, MA 02723', creditScores: [750, 739, 728] },
  },
  {
    borrower: { firstName: 'Patrick', lastName: 'Purchaser', ssn: '999-12-1234', address: '1234 Main Street, Baltimore, MD 20600', creditScores: [670, 661, 675] },
    coBorrower: { firstName: 'Lorraine', lastName: 'Purchaser', ssn: '999-56-5678', address: '1234 Main Street, Baltimore, MD 20600', creditScores: [678, 670, 663] },
  },
  { borrower: { firstName: 'Suzi', lastName: 'Builder', ssn: '999-60-6666', address: '5404 Pawnee Trail, Louisville, KY 40207', creditScores: [630, 625, 619] } },
  { borrower: { firstName: 'Alice', lastName: 'Firstimer', ssn: '991-91-9991', address: '9991 Warford Street, Dawson, IA 50066', creditScores: [715, 710, 703] } },
  { borrower: { firstName: 'Penny', lastName: 'Public', ssn: '999-60-3000', address: '2935 Augusta #3, San Luis Obispo, CA 93401', creditScores: [670, 640, 650] } },
  {
    borrower: { firstName: 'Dad', lastName: 'Firstimer', ssn: '999-00-8881', address: '888 Willis Avenue, Dawson, IA 50060', creditScores: [660, 685, 672] },
    coBorrower: { firstName: 'Mom', lastName: 'Firstimer', ssn: '999-00-8882', address: '888 Willis Avenue, Dawson, IA 50060', creditScores: [674, 680, 695] },
  },
  { borrower: { firstName: 'Ross', lastName: 'Blemished', ssn: '000-88-9999', address: '309 North Elm Street, Orrville, OH 44667', creditScores: [595, 625, 610] } },
  {
    borrower: { firstName: 'Wanna', lastName: 'House', ssn: '000-11-2222', address: '98 Lincoln Street, Jefferson, TX 65433', creditScores: [547, 555, 525] },
    coBorrower: { firstName: 'Needa', lastName: 'House', ssn: '999-44-5555', address: '98 Lincoln Street, Jefferson, TX 65433', creditScores: [521, 530, 515] },
  },
  { borrower: { firstName: 'Elizabeth', lastName: 'Spender', ssn: '000-66-7777', address: '7054 Canaan Center Road, Wooster, OH 44691', creditScores: [525, 560, 585] } },
  { borrower: { firstName: 'Ken', lastName: 'Customer', ssn: '500-50-7000', address: '10655 Birch Street, Burbank, CA 91502', creditScores: [650, 639, 620] } },
  { borrower: { firstName: 'Homer', lastName: 'Loanseeker', ssn: '999-60-1111', address: '4420 Douglas Avenue East, Higley, AZ 85236', creditScores: [640, 636, 620] } },
  {
    borrower: { firstName: 'Mort', lastName: 'Gage', ssn: '000-00-0002', address: '123 Rocky Road, Pasadena, CA 91115', creditScores: [710, 680, 685] },
    coBorrower: { firstName: 'Ann', lastName: 'Gage', ssn: '000-00-0003', address: '123 Rocky Road, Pasadena, CA 91115', creditScores: [720] },
  },
  { borrower: { firstName: 'Sonny', lastName: 'Graves', ssn: '001-01-0021', address: '00357 Monument Road, San Jose, CA 95130', creditScores: [678, 702, 692] } },
  { borrower: { firstName: 'Loco', lastName: 'Motion', ssn: '999-47-8801', address: '00345 Yankee Point Road, San Jose, CA 95129', creditScores: [658, 584, 641] } },
  { borrower: { firstName: 'Pitt', lastName: 'Rock, Jr.', ssn: '666-00-6666', address: '1456 Peach Tree Lane, Atlanta, GA 30303', creditScores: [525, 515, 497] } },
  {
    borrower: { firstName: 'Jess T.', lastName: 'Sea', ssn: '999-00-1147', address: '7344 Deepinthe Heart Ave., El Paso, TX 80935', creditScores: [685, 645, 691] },
    coBorrower: { firstName: 'Ann T.', lastName: 'Sea', ssn: '999-00-9066', address: '7344 Deepinthe Heart Ave., El Paso, TX 80935', creditScores: [685, 645, 691] },
  },
  { borrower: { firstName: 'Ron', lastName: 'Tintin', ssn: '999-72-5641', address: '6 Circle Golf Course, Pinehurst, NC 28374', creditScores: [660, 670, 680] } },
  { borrower: { firstName: 'Lucky', lastName: 'Knowscore', ssn: '999-42-2345', address: '2121 13th Avenue, Las Vegas, NV 89109', creditScores: 'NA' } },
  { borrower: { firstName: 'Ima', lastName: 'One', ssn: '000-01-0001', address: '1234 Warford Street, Dawson, IA 50066', creditScores: [710, 703] } },
];

// ── Primary applicant used by the DMX loan-creation specs ─────────────────────
// Andy America (borrower) + Amy America (co-borrower), plus the additional inputs
// the specs fill in (phone / DOB / employment / assets / rent). DOB is not part
// of the Fannie Mae sheet — it is a fixed value the specs have always used.

export const PRIMARY_BORROWER = {
  firstName: 'Andy',
  lastName: 'America',
  phone: '2482253648',
  ssn: '999-60-3333',
  dob: '01/01/1980',
} as const;

export const PRIMARY_COBORROWER = {
  firstName: 'Amy',
  lastName: 'America',
  phone: '2486546956',
  ssn: '500-60-2222',
  dob: '01/02/1980',
} as const;

// Common employment / asset / housing values used across the DMX specs.
export const EMPLOYMENT = {
  employerName: 'Test inc',
  jobTitle: 'manager',
  employerPhone: '2483547241',
  state: 'Michigan',
  startDate: '01/01/2021',
  annualSalary: '100000',
} as const;

export const ASSETS = {
  institution: 'BOA',
  accountType: 'Savings account',
  balance: '30000',
  owner: 'Both',
} as const;

export const HOUSING = {
  monthlyRent: '1500',
  moveInDate: '01/2022',
} as const;
