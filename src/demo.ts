import { buildItx, buildMultichainReadonlyClient, buildRpcInfo, buildTokenMapping, deployment, encodeBridgingOps, getTokenAddressForChainId, initKlaster, klasterNodeHost, loadBicoV2Account, loadSafeV141Account, mcUSDC, MultichainClient, MultichainTokenMapping, rawTx, singleTx } from "klaster-sdk";
import { createWalletClient, custom, encodeFunctionData, erc20Abi, http, parseUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arbitrum, base, baseSepolia, optimism, polygon, scroll, sepolia } from 'viem/chains'
import { acrossBridgePlugin } from "./across-bridge-plugin";

async function setUpKlaster() {
  
  const privateKey = generatePrivateKey();
  const signerAccount = privateKeyToAccount(privateKey);

  const signer = createWalletClient({
    transport: http('https://test')
  });

  const klaster = await initKlaster({
    accountInitData: loadSafeV141Account({
      signers: [
        signerAccount.address
      ],
      threshold: 1n
    }),
    nodeUrl: klasterNodeHost.default,
  });
  

  const mcClient = buildMultichainReadonlyClient(
    [sepolia, baseSepolia].map(x => {
      return {
        chainId: x.id,
        rpcUrl: x.rpcUrls.default.http[0]
      }
    })
  )

  // A lambda which intersects the chains available in the token mapping with the ones available 
  // in the multichain client
  const intersectTokenAndClients = (token: MultichainTokenMapping, mcClient: MultichainClient) => {
    return token.filter(deployment => mcClient.chainsRpcInfo.map(info => info.chainId).includes(deployment.chainId))
  }

  const mUSDC = buildTokenMapping([
    deployment(sepolia.id, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'),
    deployment(baseSepolia.id, '0x036CbD53842c5426634e7929541eC2318f3dCF7e')
  ])

  const uBalance = await mcClient.getUnifiedErc20Balance({
    tokenMapping: mUSDC,
    account: klaster.account
  })

  const destinationChainId = baseSepolia.id

  const bridgingOps = await encodeBridgingOps({
    tokenMapping: mUSDC,
    account: klaster.account,
    amount: parseUnits("1", uBalance.decimals), // Don't send entire balance
    bridgePlugin: acrossBridgePlugin,
    client: mcClient,
    destinationChainId: destinationChainId,
    unifiedBalance: {
      balance: parseUnits("3", 6),
      decimals: 6,
      breakdown: [
        {
          chainId: sepolia.id,
          amount: parseUnits("0.5", 6)
        }, 
        {
          chainId: baseSepolia.id,
          amount: parseUnits("2", 6)
        }
      ]
    }
  })

  const recipient = '0x063B3184a74C510b5c6f5bBd122CC19689E0c706'
  const destChainTokenAddress = getTokenAddressForChainId(mUSDC, destinationChainId)!

  const sendERC20Op = rawTx({
    gasLimit: 100000n,
    to: destChainTokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'transfer',
      args: [
        recipient,
        bridgingOps.totalReceivedOnDestination
      ]
    })
  })

  const iTx = buildItx({
    steps: bridgingOps.steps.concat(
      singleTx(destinationChainId, sendERC20Op)
    ),
    feeTx: klaster.encodePaymentFee(sepolia.id, 'ETH')
  })

  const quote = await klaster.getQuote(iTx)
  
  console.log(quote.itxHash)
}

setUpKlaster()