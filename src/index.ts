import {
    buildItx,
  buildMultichainReadonlyClient,
  buildRpcInfo,
  buildTokenMapping,
  deployment,
  encodeBridgingOps,
  initKlaster,
  klasterNodeHost,
  loadBicoV2Account,
  rawTx,
  singleTx,
} from "klaster-sdk";
import { createWalletClient, custom, encodeFunctionData, erc20Abi, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, arbitrumSepolia, baseSepolia } from "viem/chains";
import { lifiBridgePlugin } from "./bridge-plugin";
import { acrossBridgePlugin } from "./across-bridge-plugin";

async function setUpKlaster() {
    
    const privateKey = '0x301575511f576037a4a971741beeb2dc1045c13539f9206970f8d600db9835e1';
    const signerAccount = privateKeyToAccount(privateKey);
    const destinationTokenAddress = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

    console.log(signerAccount);

    // const signer = createWalletClient({
    //     transport: http(),
    //   });
      
    //   console.log(signer);

    const address = signerAccount.address;

    console.log(address);

    const klaster = await initKlaster({
        accountInitData: loadBicoV2Account({
            owner: address
        }),
        nodeUrl: klasterNodeHost.default,
    });

    console.log("klaster",klaster.account);
    

    const mcClient = buildMultichainReadonlyClient([
        buildRpcInfo(sepolia.id, sepolia.rpcUrls.default.http[0]),
        buildRpcInfo(baseSepolia.id, baseSepolia.rpcUrls.default.http[0])
    ]);

    console.log("Multichain Client",mcClient);

    const mcUSDC = buildTokenMapping([
        deployment(sepolia.id, "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
        deployment(baseSepolia.id, "0x036CbD53842c5426634e7929541eC2318f3dCF7e")
    ]);

    console.log("Token mapping", mcUSDC);


    // const mcUSDC = buildTokenMapping([
    //     deployment(optimism.id, "0x<USDC-ON-OPTIMISM-ADDRESS>"),
    //     deployment(base.id, "0x<USDC-ON-OPTIMISM-ADDRESS>"),
    //   ]);
      
    const uBalance = await mcClient.getUnifiedErc20Balance({
        tokenMapping: mcUSDC,
        account: klaster.account,
    });

    console.log(uBalance);

    // console.log(BigInt(3000000));
    
    

    const bridgeingOps = await encodeBridgingOps({
        tokenMapping: mcUSDC,
        account: klaster.account,
        // amount: uBalance.balance - BigInt(parseInt("3", uBalance.decimals)),
        amount: BigInt(10000000),
        bridgePlugin: acrossBridgePlugin,
        client: mcClient,
        destinationChainId: baseSepolia.id,
        unifiedBalance: uBalance
    });

    const sendERC20Op = rawTx({
        gasLimit: 120000n,
        to: destinationTokenAddress,
        data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [signerAccount.address, bridgeingOps.totalReceivedOnDestination]
        })
    });

    const itx = buildItx({
        steps: bridgeingOps.steps.concat(singleTx(baseSepolia.id, sendERC20Op)),
        feeTx: klaster.encodePaymentFee(sepolia.id, "USDC"),
    });

    const quote = await klaster.getQuote(itx);
    const signed = await signerAccount.signMessage({
        message: {
            raw: quote.itxHash,
        },
    });

    console.log("Quote", quote);
    

    const result = await klaster.execute(quote, signed);

    console.log(result.itxHash);
    
    
}

setUpKlaster();