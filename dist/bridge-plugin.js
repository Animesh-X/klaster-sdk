import { getRoutes } from "@lifi/sdk";
import { batchTx, rawTx } from "klaster-sdk";
export const lifiBridgePlugin = async (data) => {
    const routesRequest = {
        fromChainId: data.sourceChainId,
        toChainId: data.destinationChainId,
        fromTokenAddress: data.sourceToken,
        toTokenAddress: data.destinationToken,
        fromAmount: data.amount.toString(),
        options: {
            order: "FASTEST"
        }
    };
    const result = await getRoutes(routesRequest);
    const route = result.routes.at(0);
    if (!route) {
        throw new Error("No route found");
    }
    const routeSteps = route.steps.map(step => {
        if (!step.transactionRequest) {
            throw Error('....');
        }
        const { to, gasLimit, data, value } = step.transactionRequest;
        if (!to || !gasLimit || !data || !value) {
            throw Error('.....');
        }
        return rawTx({
            to: to,
            gasLimit: BigInt(gasLimit),
            data: data,
            value: BigInt(value)
        });
    });
    return {
        receivedOnDestination: BigInt(route.toAmountMin),
        txBatch: batchTx(data.sourceChainId, routeSteps),
    };
};
