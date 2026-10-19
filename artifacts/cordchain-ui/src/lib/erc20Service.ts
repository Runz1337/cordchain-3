import {
  createWalletClient,
  custom,
  getAddress,
  parseAbi,
  type Hash,
  type Address,
} from 'viem';
import { baseSepolia } from 'viem/chains';
import { publicClient, BASE_SEPOLIA_CHAIN_ID, BASE_SEPOLIA_EXPLORER } from './blockchain';
import artifact from './erc20Artifact.json';

export const CORDCHAIN_ERC20_ABI = artifact.abi as unknown as import('viem').Abi;
export const CORDCHAIN_ERC20_BYTECODE = `0x${artifact.bytecode}` as `0x${string}`;

export interface OnChainDeployResult {
  contractAddress: Address;
  transactionHash: Hash;
  blockNumber: bigint;
  explorerUrl: string;
  tokenExplorerUrl: string;
}

export interface VerifiedOnChainToken {
  address: Address;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: bigint;
  formattedTotalSupply: number;
}

// viem v2's over-eager generic inference (eip7702/kzg union branches) breaks
// narrow call-site typing; assert to the inferred parameter types instead.
type ReadArgs = Parameters<typeof publicClient.readContract>[0];

/**
 * Ensures user wallet is connected to Base Sepolia network.
 */
export async function ensureBaseSepoliaNetwork(): Promise<void> {
  const ethereum = (window as unknown as { ethereum?: any }).ethereum;
  if (!ethereum) {
    throw new Error('No Web3 wallet found. Please install MetaMask, Coinbase Wallet, or Rabby.');
  }

  const currentChainIdHex: string = await ethereum.request({ method: 'eth_chainId' });
  const currentChainId = parseInt(currentChainIdHex, 16);

  if (currentChainId !== BASE_SEPOLIA_CHAIN_ID) {
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}` }],
      });
    } catch (switchError: any) {
      // Chain not added to wallet yet
      if (switchError.code === 4902 || switchError?.data?.originalError?.code === 4902) {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${BASE_SEPOLIA_CHAIN_ID.toString(16)}`,
              chainName: 'Base Sepolia',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://sepolia.base.org'],
              blockExplorerUrls: [BASE_SEPOLIA_EXPLORER],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }
}

/**
 * Deploys a real ERC-20 Smart Contract onto Base Sepolia directly from the user's Web3 wallet.
 */
export async function deployCommunityTokenOnBaseSepolia({
  name,
  symbol,
  totalSupply,
  guildId,
}: {
  name: string;
  symbol: string;
  totalSupply: number;
  guildId: string;
}): Promise<OnChainDeployResult> {
  const ethereum = (window as unknown as { ethereum?: any }).ethereum;
  if (!ethereum) {
    throw new Error('Web3 wallet required to deploy on-chain. Please install MetaMask or Coinbase Wallet.');
  }

  await ensureBaseSepoliaNetwork();

  const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No Ethereum account selected in wallet.');
  }

  const ownerAddress = getAddress(accounts[0]);
  const cleanSymbol = symbol.startsWith('$') ? symbol.slice(1) : symbol;

  const walletClient = createWalletClient({
    chain: baseSepolia,
    transport: custom(ethereum),
  });

  type DeployArgs = Parameters<typeof walletClient.deployContract>[0];

  // Deploy ERC-20 contract transaction
  const hash = await walletClient.deployContract({
    abi: CORDCHAIN_ERC20_ABI,
    bytecode: CORDCHAIN_ERC20_BYTECODE,
    chain: baseSepolia,
    account: ownerAddress,
    args: [name, cleanSymbol, BigInt(totalSupply), ownerAddress, guildId],
  } as unknown as DeployArgs);

  // Wait for block confirmation on Base Sepolia
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (!receipt.contractAddress) {
    throw new Error('Contract deployment failed on Base Sepolia. No contract address returned.');
  }

  const contractAddress = getAddress(receipt.contractAddress);

  return {
    contractAddress,
    transactionHash: hash,
    blockNumber: receipt.blockNumber,
    explorerUrl: `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`,
    tokenExplorerUrl: `${BASE_SEPOLIA_EXPLORER}/address/${contractAddress}`,
  };
}

/**
 * Reads and verifies an existing ERC-20 contract on Base Sepolia RPC.
 */
export async function verifyBaseSepoliaToken(rawAddress: string): Promise<VerifiedOnChainToken> {
  if (!rawAddress || !rawAddress.startsWith('0x') || rawAddress.length !== 42) {
    throw new Error('Invalid contract address format. Must be a 42-character hex address.');
  }

  const address = getAddress(rawAddress);

  const nameName = await publicClient.readContract({
    address,
    abi: parseAbi(['function name() view returns (string)']),
    functionName: 'name',
  } as unknown as ReadArgs);
  const symbolSymbol = await publicClient.readContract({
    address,
    abi: parseAbi(['function symbol() view returns (string)']),
    functionName: 'symbol',
  } as unknown as ReadArgs);
  const decimalsNum = await publicClient.readContract({
    address,
    abi: parseAbi(['function decimals() view returns (uint8)']),
    functionName: 'decimals',
  } as unknown as ReadArgs);
  const totalSupplyRaw = await publicClient.readContract({
    address,
    abi: parseAbi(['function totalSupply() view returns (uint256)']),
    functionName: 'totalSupply',
  } as unknown as ReadArgs);
  const [name, symbol, decimals, totalSupply] = [
    String(nameName),
    String(symbolSymbol),
    Number(decimalsNum),
    BigInt(totalSupplyRaw as unknown as bigint),
  ];

  const scale = 10n ** BigInt(decimals);
  const formattedTotalSupply = Number(totalSupply / scale);

  return {
    address,
    name: String(name),
    symbol: String(symbol),
    decimals: Number(decimals),
    totalSupply: BigInt(totalSupply),
    formattedTotalSupply,
  };
}

/**
 * Prompts the user's wallet to add the newly minted ERC-20 token directly into MetaMask/Coinbase wallet.
 */
export async function addTokenToMetaMask(address: string, symbol: string, iconUrl?: string): Promise<boolean> {
  const ethereum = (window as unknown as { ethereum?: any }).ethereum;
  if (!ethereum) return false;

  try {
    const cleanSymbol = symbol.startsWith('$') ? symbol.slice(1) : symbol;
    const wasAdded: boolean = await ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address,
          symbol: cleanSymbol.slice(0, 11),
          decimals: 18,
          image: iconUrl,
        },
      },
    });
    return wasAdded;
  } catch (err) {
    console.warn('Could not add token to wallet:', err);
    return false;
  }
}
