import { ITvlParams, ITvlReturn } from '../../../../interfaces/ITvl';
import formatter from '../../../../util/formatter';
import uniswapV3 from '../../../../util/calculators/uniswapV3chain';
import uniswapV2 from '../../../../util/calculators/uniswapV2';
import thanosVault, {
  CL_INITIALIZE_TOPIC,
  BIN_INITIALIZE_TOPIC,
} from '../../../../util/calculators/thanosVault';
import BigNumber from 'bignumber.js';
import CONSTANTS from '../../../../constants/contracts.json';

const V2_START_BLOCK = 19727118;
const V2_FACTORY_ADDRESS = '0xba34aA640b8Be02A439221BCbea1f48c1035EEF9';

const V3_START_BLOCK = 19730499;
const V3_FACTORY_ADDRESS = '0xa1288b64F2378276d0Cc56F08397F70BecF7c0EA';

// Thanos (V4)
const THANOS_START_BLOCK = 40500004;
const THANOS_VAULT_ADDRESS = '0x126c5d558589788292c33667fba07e07b4b0990b';
const THANOS_CL_POOL_MANAGER_ADDRESS =
  '0xbb07a7bdfc50829ce932adccc0498f0e29f49f50';
const THANOS_BIN_POOL_MANAGER_ADDRESS =
  '0xd243e0c2fc2a91eace239e0c54023559a47c5f04';

async function tvl(params: ITvlParams): Promise<Partial<ITvlReturn>> {
  const { block, chain, provider, web3 } = params;
  if (block < V2_START_BLOCK) {
    return {};
  }
  let balancesV3 = {};

  const { balances: balancesV2 } = await uniswapV2.getTvl(
    V2_FACTORY_ADDRESS,
    block,
    chain,
    provider,
    web3,
  );

  if (block >= V3_START_BLOCK) {
    balancesV3 = await uniswapV3.getTvl(
      V3_FACTORY_ADDRESS,
      V3_START_BLOCK,
      block,
      chain,
      provider,
      web3,
      'algebra',
    );
  }

  // Thanos (V4) balances, all pool funds are held by a single Vault
  let balancesThanos = {};
  if (block >= THANOS_START_BLOCK) {
    balancesThanos = await thanosVault.getTvl(
      THANOS_VAULT_ADDRESS,
      [
        { address: THANOS_CL_POOL_MANAGER_ADDRESS, topic: CL_INITIALIZE_TOPIC },
        {
          address: THANOS_BIN_POOL_MANAGER_ADDRESS,
          topic: BIN_INITIALIZE_TOPIC,
        },
      ],
      THANOS_START_BLOCK,
      block,
      chain,
      provider,
      web3,
    );

    // Thanos pools use the zero address for the native token
    const ethBalance = await web3.eth.getBalance(THANOS_VAULT_ADDRESS, block);
    balancesThanos[CONSTANTS.WMAIN_ADDRESS.base] = BigNumber(
      balancesThanos[CONSTANTS.WMAIN_ADDRESS.base] || 0,
    )
      .plus(ethBalance)
      .toFixed();
  }

  const balances = formatter.sum([balancesV2, balancesV3, balancesThanos]);

  return { balances };
}

export { tvl };
