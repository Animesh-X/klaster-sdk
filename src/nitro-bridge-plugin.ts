import axios from "axios";
import { batchTx, BridgePlugin, BridgePluginParams, encodeApproveTx, rawTx } from "klaster-sdk";

// Axios instance for base configuration
const nitroClient = axios.create({
  baseURL: "https://api-beta.pathfinder.routerprotocol.com/api/v2",
  headers: {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
  },
});

// Fetch suggested fees from Nitro
/**
 * Fetches the suggested fees for Nitro based on bridge plugin parameters.
 * @param params - BridgePluginParams containing token and chain information.
 * @returns A promise resolving to the fee data from Nitro.
 */
async function fetchSuggestedFees(params: BridgePluginParams) {
  const response = await nitroClient.get("/quote", {
    params: {
      fromTokenAddress: params.sourceToken,
      toTokenAddress: params.destinationToken,
      amount: params.amount,
      fromTokenChainId: params.sourceChainId,
      toTokenChainId: params.destinationChainId,
      partnerId: 1,
      slippageTolerance: 2,
      destFuel: 0,
    },
  });
  return response.data;
}

// Prepare and send Nitro transaction
/**
 * Prepares and sends the Nitro transaction with the source and destination addresses.
 * @param sender - The sender's address.
 * @param receiver - The receiver's address.
 * @param feeData - The fee data returned from Nitro.
 * @returns A promise resolving to the Nitro transaction result.
 */
async function prepareAndSendTransaction(
  sender: any,
  receiver: any,
  feeData: any
) {
  const transactionData = {
    ...feeData,
    senderAddress: sender,
    receiverAddress: receiver,
    metaData: { ataAddress: null },
  };

  const response = await nitroClient.post("/transaction", transactionData);
  return response.data;
}

// Main Nitro Bridge Plugin
/**
 * Main Nitro Bridge Plugin that fetches fees, prepares transactions, and executes them.
 * @param params - BridgePluginParams containing token and chain information.
 * @returns A promise resolving to the transaction batch and received amount.
 */
export const nitroBridgePlugin: BridgePlugin = async (params) => {
  // Fetch Nitro suggested fees
  const feeData = await fetchSuggestedFees(params);

  // Get source and destination addresses
  const [senderAddress, receiverAddress] = params.account.getAddresses([
    params.sourceChainId,
    params.destinationChainId,
  ]);

  // Prepare transaction with addresses and fee data
  const transactionResult = await prepareAndSendTransaction(
    senderAddress,
    receiverAddress,
    feeData
  );

  // Calculate the output amount on the destination chain
  const receivedAmount = BigInt(transactionResult.destination.tokenAmount);

  // Create approval transaction for source token
  const approvalTx = encodeApproveTx({
    tokenAddress: params.sourceToken,
    amount: receivedAmount,
    recipient: transactionResult.txn.to,
  });

  // Create the transaction to initiate bridging
  const callBridgeTx = rawTx({
    to: transactionResult.txn.to,
    data: transactionResult.txn.data,
    gasLimit: transactionResult.txn.data, // Update if needed
  });

  // Return the batch of transactions
  return {
    receivedOnDestination: receivedAmount,
    txBatch: batchTx(params.sourceChainId, [approvalTx, callBridgeTx]),
  };
};