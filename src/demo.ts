import { buildItx, buildMultichainReadonlyClient, buildRpcInfo, buildTokenMapping, deployment, encodeBridgingOps, getTokenAddressForChainId, initKlaster, klasterNodeHost, loadBicoV2Account, loadSafeV141Account, mcUSDC, MultichainClient, MultichainTokenMapping, rawTx, singleTx } from "klaster-sdk";
import { createWalletClient, custom, encodeFunctionData, erc20Abi, http, parseUnits } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { arbitrumSepolia, sepolia } from 'viem/chains'
import { acrossBridgePlugin } from "./across-bridge-plugin";

async function setUpKlaster() {

  const privateKey = '0x301575511f576037a4a971741beeb2dc1045c13539f9206970f8d600db9835e1';
  const signerAccount = privateKeyToAccount(privateKey);
  const sourceAddress = '0xB3Ce5E1FCB9C5B94b44ed6e81a25FdD628d5d9DC';

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
    [sepolia, arbitrumSepolia].map(x => {
      return {
        chainId: x.id,
        rpcUrl: x.rpcUrls.default.http[0]
      }
    })
  );

  // A lambda which intersects the chains available in the token mapping with the ones available 
  // in the multichain client
  const intersectTokenAndClients = (token: MultichainTokenMapping, mcClient: MultichainClient) => {
    return token.filter(deployment => mcClient.chainsRpcInfo.map(info => info.chainId).includes(deployment.chainId))
  }

  // Update LINK token addresses on Sepolia and Arbitrum Sepolia
  const mLINK = buildTokenMapping([
    deployment(sepolia.id, '0x779877A7B0D9E8603169DdbD7836e478b4624789'), // LINK on Sepolia
    deployment(arbitrumSepolia.id, '0xb1D4538B4571d411F07960EF2838Ce337FE1E80E') // LINK on Arbitrum Sepolia
  ]);

  // Retrieve LINK balance
  const uBalance = await mcClient.getUnifiedErc20Balance({
    tokenMapping: mLINK,
    account: klaster.account
  });

  // console.log('Hello', uBalance);
  

  const destinationChainId = arbitrumSepolia.id;
  const transferAmount = parseUnits("1", uBalance.decimals);

  // Bridging operations for LINK transfer
  // const bridgingOps = await encodeBridgingOps({
  //   tokenMapping: mLINK,
  //   account: klaster.account,
  //   amount: parseUnits("1", uBalance.decimals), // Send 1 LINK token
  //   bridgePlugin: acrossBridgePlugin,
  //   client: mcClient,
  //   destinationChainId: destinationChainId,
  //   unifiedBalance: {
  //     balance: parseUnits("3", 18),
  //     decimals: 18, // assuming LINK has 18 decimals
  //     breakdown: [
  //       {
  //         chainId: sepolia.id,
  //         amount: parseUnits("2", 18)
  //       },
  //       {
  //         chainId: arbitrumSepolia.id,
  //         amount: parseUnits("1", 18)
  //       }
  //     ]
  //   }
  // });


  const bridgingOps = await encodeBridgingOps({
    tokenMapping: mLINK,
    account: klaster.account,
    amount: transferAmount,
    bridgePlugin: acrossBridgePlugin,
    client: mcClient,
    destinationChainId,
    unifiedBalance: uBalance
  });

  console.log('Hi',bridgingOps);
  

  const recipient = '0xB3Ce5E1FCB9C5B94b44ed6e81a25FdD628d5d9DC'; // Same recipient address on destination chain
  const destChainTokenAddress = getTokenAddressForChainId(mLINK, destinationChainId)!;

  // Create transaction to send LINK on the destination chain
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
  });

  const iTx = buildItx({
    steps: bridgingOps.steps.concat(
      singleTx(destinationChainId, sendERC20Op)
    ),
    feeTx: klaster.encodePaymentFee(sepolia.id, 'ETH')
  });

  const quote = await klaster.getQuote(iTx);

  const signed = await signerAccount.signMessage({
    message: {
      raw: quote.itxHash
    }
  });

  const result = await klaster.execute(quote, signed);

  console.log(result.itxHash);
  
}

setUpKlaster();