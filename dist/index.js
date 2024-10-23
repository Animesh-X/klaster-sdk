import { buildItx, buildMultichainReadonlyClient, buildRpcInfo, buildTokenMapping, deployment, encodeBridgingOps, initKlaster, klasterNodeHost, loadBicoV2Account, rawTx, singleTx, } from "klaster-sdk";
import { encodeFunctionData, erc20Abi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia, arbitrumSepolia } from "viem/chains";
import { acrossBridgePlugin } from "./across-bridge-plugin";
async function setUpKlaster() {
    const privateKey = '0x301575511f576037a4a971741beeb2dc1045c13539f9206970f8d600db9835e1';
    const signerAccount = privateKeyToAccount(privateKey);
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
    console.log("klaster", klaster.account);
    const mcClient = buildMultichainReadonlyClient([
        buildRpcInfo(sepolia.id, sepolia.rpcUrls.default.http[0]),
        buildRpcInfo(arbitrumSepolia.id, arbitrumSepolia.rpcUrls.default.http[0])
    ]);
    console.log("Multichain Client", mcClient);
    const mcUSDC = buildTokenMapping([
        deployment(sepolia.id, "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"),
        deployment(arbitrumSepolia.id, "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d")
    ]);
    console.log("Token mapping", mcUSDC);
    // const mcUSDC = buildTokenMapping([
    //     deployment(optimism.id, "0x<USDC-ON-OPTIMISM-ADDRESS>"),
    //     deployment(base.id, "0x<USDC-ON-OPTIMISM-ADDRESS>"),
    //   ]);
    const uBalance = await mcClient.getUnifiedErc20Balance({
        tokenMapping: mcUSDC,
        account: klaster.account
    });
    console.log(uBalance);
    const bridgeingOps = await encodeBridgingOps({
        tokenMapping: mcUSDC,
        account: klaster.account,
        amount: uBalance.balance - BigInt(parseInt("2", uBalance.decimals)),
        bridgePlugin: acrossBridgePlugin,
        client: mcClient,
        destinationChainId: arbitrumSepolia.id,
        unifiedBalance: uBalance
    });
    const sendERC20Op = rawTx({
        gasLimit: 120000n,
        to: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
        data: encodeFunctionData({
            abi: erc20Abi,
            functionName: "transfer",
            args: [signerAccount.address, bridgeingOps.totalReceivedOnDestination]
        })
    });
    const itx = buildItx({
        steps: bridgeingOps.steps.concat(singleTx(arbitrumSepolia.id, sendERC20Op)),
        feeTx: klaster.encodePaymentFee(sepolia.id, "USDC"),
    });
    const quote = await klaster.getQuote(itx);
    const signed = await signerAccount.signMessage({
        message: {
            raw: quote.itxHash,
        },
    });
    const result = await klaster.execute(quote, signed);
    console.log(result.itxHash);
}
setUpKlaster();
