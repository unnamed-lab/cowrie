/**
 * Minimal ABIs for the Cowrie frontend. These contain only the fragments the
 * dashboard calls — not the full compiled artifacts — so the wagmi/viem types
 * stay small and readable. Encrypted inputs are passed as
 * (bytes32 handle, bytes inputProof); encrypted handles are returned as bytes32.
 */

export const TOKEN_ABI = [
  {
    type: "function",
    name: "faucet",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint64" }],
    outputs: [],
  },
  {
    type: "function",
    name: "setOperator",
    stateMutability: "nonpayable",
    inputs: [
      { name: "operator", type: "address" },
      { name: "until", type: "uint48" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "confidentialBalanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

export const CIRCLE_ABI = [
  // Everyone pays the organizer's fixed amount — contribute takes no amount.
  { type: "function", name: "contribute", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "setFixedAmount",
    stateMutability: "nonpayable",
    inputs: [
      { name: "enc", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "function", name: "amountSet", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  {
    type: "function",
    name: "fixedAmountHandle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  { type: "function", name: "refundOpen", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "openRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "closeRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "claimRefund", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "refunded",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "contributed",
    stateMutability: "view",
    inputs: [
      { name: "", type: "uint256" },
      { name: "", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  { type: "function", name: "payout", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "round", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "contributionsThisRound",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  { type: "function", name: "memberCount", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "isMember",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "join",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "getMembers",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "authorizeMember",
    stateMutability: "nonpayable",
    inputs: [{ name: "member", type: "address" }],
    outputs: [],
  },
  {
    type: "function",
    name: "isAuthorized",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "organizer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "factory",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  { type: "function", name: "potTotalHandle", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  { type: "function", name: "dissolved", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "dissolveApprovals", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "dissolveApproved",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  { type: "function", name: "dissolve", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "approveDissolve", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const PAYROLL_ABI = [
  {
    type: "function",
    name: "fund",
    stateMutability: "nonpayable",
    inputs: [
      { name: "enc", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setSalary",
    stateMutability: "nonpayable",
    inputs: [
      { name: "employee", type: "address" },
      { name: "enc", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "function", name: "claim", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "salaryOf",
    stateMutability: "view",
    inputs: [{ name: "employee", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "isEmployee",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "period",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "organizer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  { type: "function", name: "title", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "dissolved", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "fundedHandle", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  { type: "function", name: "collectedHandle", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  {
    type: "function",
    name: "removeEmployee",
    stateMutability: "nonpayable",
    inputs: [{ name: "employee", type: "address" }],
    outputs: [],
  },
  { type: "function", name: "stopAndReclaim", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;

export const CROWDFUND_ABI = [
  {
    type: "function",
    name: "contribute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "enc", type: "bytes32" },
      { name: "proof", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "function", name: "finalize", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    type: "function",
    name: "settle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "cleartexts", type: "bytes" },
      { name: "decryptionProof", type: "bytes" },
    ],
    outputs: [],
  },
  { type: "function", name: "release", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "refund", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "state", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },
  { type: "function", name: "goal", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },
  { type: "function", name: "deadline", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  {
    type: "function",
    name: "reachedHandle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "contributionOf",
    stateMutability: "view",
    inputs: [{ name: "who", type: "address" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "beneficiary",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  { type: "function", name: "title", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  { type: "function", name: "description", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "string" }] },
  {
    type: "function",
    name: "totalRaisedHandle",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
] as const;

/** Crowdfund.state() enum order. */
export const CROWDFUND_STATE = ["Active", "Deciding", "Succeeded", "Failed"] as const;

export const FACTORY_ABI = [
  {
    type: "function",
    name: "createCircle",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "name", type: "string" },
      { name: "initialMembers", type: "address[]" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getUserCircles",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getCirclesCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allCircles",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const CROWDFUND_FACTORY_ABI = [
  {
    type: "function",
    name: "createCampaign",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "beneficiary", type: "address" },
      { name: "goal", type: "uint64" },
      { name: "duration", type: "uint256" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getUserCampaigns",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getCampaignsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allCampaigns",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

export const PAYROLL_FACTORY_ABI = [
  {
    type: "function",
    name: "createStream",
    stateMutability: "payable",
    inputs: [
      { name: "token", type: "address" },
      { name: "period", type: "uint256" },
      { name: "title", type: "string" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getUserStreams",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    type: "function",
    name: "getStreamsCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "allStreams",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;
