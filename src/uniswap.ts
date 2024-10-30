import { ChainId, Token, WETH9, CurrencyAmount, TradeType, Percent } from '@uniswap/sdk-core';
import { Pair, Route, Trade } from '@uniswap/v2-sdk';
import { ethers } from 'ethers';

const PRIVATE_KEY = '301575511f576037a4a971741beeb2dc1045c13539f9206970f8d600db9835e1';
const ALCHEMY_URL = 'https://eth-sepolia.g.alchemy.com/v2/v1Jr-KUNg7WP49AuX4dBn1ycnjhoWDWG';
const provider = new ethers.providers.JsonRpcProvider(ALCHEMY_URL);
const USDC_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
const chainId = ChainId.SEPOLIA;

const ROUTER_ADDRESS = '0xeE567Fe1712Faf6149d80dA1E6934E354124CfE3';

const uniswapV2PairABI = [
    "function getReserves() view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)",
    "function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)"
];

const init = async () => {
    try {
        const USDC = new Token(chainId, USDC_ADDRESS, 6, 'USDC', 'USD Coin');

        const pairAddress = Pair.getAddress(USDC, WETH9[USDC.chainId]);
        console.log(`Pair Address: ${pairAddress}`);

        const pairContract = new ethers.Contract(pairAddress, [
            'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
            'function token0() external view returns (address)',
            'function token1() external view returns (address)'
        ], provider);

        const reserves = await pairContract["getReserves"]();
        const [reserve0, reserve1] = reserves
        
        const tokens = [USDC, WETH9[USDC.chainId]];
        const [token0, token1] = tokens[0].sortsBefore(tokens[1]) ? tokens : [tokens[1], tokens[0]]

        const pair = new Pair(CurrencyAmount.fromRawAmount(token0, reserve0), CurrencyAmount.fromRawAmount(token1, reserve1));

        // console.log(pair);

        const route = new Route([pair], WETH9[USDC.chainId], USDC)

        console.log(route.midPrice.toSignificant(6)) 
        console.log(route.midPrice.invert().toSignificant(6)) 

        const amountIn = ethers.utils.parseEther('0.00001');

        const trade = new Trade(route, CurrencyAmount.fromRawAmount(WETH9[chainId], amountIn.toString()), TradeType.EXACT_INPUT);

        console.log(trade.executionPrice.toSignificant(6))
        
        const slippageTolerance = new Percent('50', '10000');

        const amountOutMin = trade.minimumAmountOut(slippageTolerance);

        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
        const router = new ethers.Contract(ROUTER_ADDRESS, uniswapV2PairABI, wallet);


        const path = [WETH9[chainId].address, USDC.address];
        const to = wallet.address;

        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

        const tx = await router.swapExactETHForTokens(
            amountOutMin.quotient.toString(),
            path,
            to,
            deadline,
            {
                value: amountIn,
                gasLimit: 300000
            }
        );

        console.log(`Transaction hash: ${tx.hash}`);
        await tx.wait();
        console.log('Swap completed!');
        
        
    } catch (error) {
        console.error("Error fetching reserves:", error);
    }
};

init();
